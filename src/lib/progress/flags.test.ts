// RC-P28 — guilds, leaderboards and reputation are parked
// (docs/reconciliation/XP-DESIGN.md › Parked). Their tables stay.
//
// The claims: the three flags are false; App.tsx lands each parked address, and
// anything under it, on the progress page, under that feature's flag; and a
// parked feature offers no way in that its flag does not govern: a file that
// names a parked address, or imports a parked feature's components, reads that
// feature's flag. What renders is proven where each surface is tested: the
// frame (src/components/shell/parkedEntryPoints.test.tsx), the level chip
// (NavProgressChip.test.tsx), the profile (Profile.test.tsx), the progress
// page (ProgressPage.test.tsx) and, in a browser,
// e2e/tier3/parked-features.spec.ts.
//
// NOT PARKED, SO NOT GATED: the bounty solvers board (/bounties/solvers, RC-P13)
// and the legacy per-bounty SolverLeaderboard, whose old address
// /b/:id/leaderboard lands on that board. They rank solvers on bounties, the
// Bounties home of CONTRACT §14, not people by XP, and the legacy one is a
// frozen read path CONTRACT §2.12 keeps live.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { GUILDS_ENABLED, LEADERBOARDS_ENABLED, REPUTATION_ENABLED } from "./flags";

const PARKED = [
  {
    flag: "GUILDS_ENABLED",
    address: "/guilds",
    components: [join("src", "components", "guilds") + sep],
  },
  {
    flag: "LEADERBOARDS_ENABLED",
    address: "/leaderboards",
    components: [join("src", "components", "leaderboards") + sep],
  },
  {
    flag: "REPUTATION_ENABLED",
    address: "/reputation",
    components: [
      join("src", "components", "reputation") + sep,
      join("src", "components", "progress", "gamification", "reputation-badge"),
    ],
  },
];

/** Every .ts and .tsx file under a folder that ships in the app: tests are not. */
function appFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return path === join("src", "test") ? [] : appFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** The modules a file imports, statically or lazily, as paths from the repository root. */
function importsOf(file: string, source: string): string[] {
  const specifiers = [...source.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)["']([^"']+)["']/g)].map((m) => m[1]);
  return specifiers.flatMap((specifier) => {
    if (specifier.startsWith("@/")) return [join("src", specifier.slice(2))];
    if (specifier.startsWith(".")) return [join(dirname(file), specifier)];
    return [];
  });
}

const namesAddress = (source: string, address: string) =>
  new RegExp(`["'\`]${address}(?=["'\`/?#])`).test(source);

const readsFlag = (source: string, flag: string) =>
  new RegExp(`import\\s*\\{[^}]*\\b${flag}\\b[^}]*\\}\\s*from\\s*["'][^"']*progress/flags["']`).test(source);

/** Whether a path (an import, extension or not, or a file) is one of a feature's parked components. */
const isParked = (path: string, parked: string) =>
  parked.endsWith(sep) ? path === parked.slice(0, -1) || path.startsWith(parked) : path === parked || path.startsWith(`${parked}.`);

const insideParkedFolder = (file: string) =>
  PARKED.some(({ components }) => components.some((parked) => isParked(file, parked)));

describe("parked features (RC-P28)", () => {
  it("guilds, leaderboards and reputation are parked", () => {
    expect({ GUILDS_ENABLED, LEADERBOARDS_ENABLED, REPUTATION_ENABLED }).toEqual({
      GUILDS_ENABLED: false,
      LEADERBOARDS_ENABLED: false,
      REPUTATION_ENABLED: false,
    });
  });

  it("App lands each parked address, and anything under it, on the progress page while its flag is false", () => {
    const app = readFileSync(join("src", "App.tsx"), "utf8");
    for (const { flag, address } of PARKED) {
      expect(app).toContain(`{!${flag} && <Route path="${address}/*" element={<Navigate to="/analytics" replace />} />}`);
    }
  });

  it("every file that names a parked address reads that feature's flag", () => {
    const ungated = appFiles("src")
      .filter((file) => !insideParkedFolder(file))
      .flatMap((file) => {
        const source = readFileSync(file, "utf8");
        return PARKED.filter(({ address, flag }) => namesAddress(source, address) && !readsFlag(source, flag)).map(
          ({ address }) => `${file} names ${address}`,
        );
      });
    expect(ungated).toEqual([]);
  });

  it("nothing imports a parked feature's components without reading its flag", () => {
    const ungated = appFiles("src")
      .filter((file) => !insideParkedFolder(file))
      .flatMap((file) => {
        const source = readFileSync(file, "utf8");
        const imported = importsOf(file, source);
        return PARKED.filter(
          ({ components, flag }) =>
            imported.some((path) => components.some((parked) => isParked(path, parked))) &&
            !readsFlag(source, flag),
        ).map(({ flag }) => `${file} mounts a component ${flag} parks`);
      });
    expect(ungated).toEqual([]);
  });
});
