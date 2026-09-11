// BG-P04 — the radius scale and the focus ring.
//
// `css-parity.test.ts` proves the two theme blocks in index.css declare the
// scale this module describes. What is proved here is the shape of the scale
// itself: six steps and no seventh, one circular step that is not a default,
// and an accessor that hands out `var()` references rather than pixels.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { RADIUS, RADIUS_NAMES, r, radiusVar, type RadiusName } from "./radius";
import { FOCUS_RING_OFFSET, FOCUS_RING_WIDTH, focusRing } from "./focus";
import { TOKEN_NAMES } from "./semantics";

const SRC = join(process.cwd(), "src");

/** Every .ts/.tsx file under src/, as [repo-relative path, contents]. */
function sourceFiles(dir = SRC): Array<[string, string]> {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    if (!/\.tsx?$/.test(entry.name)) return [];
    return [[relative(process.cwd(), full), readFileSync(full, "utf8")] as [string, string]];
  });
}

describe("the radius scale", () => {
  it("is exactly the six steps the spec lists", () => {
    expect(RADIUS).toEqual({
      "r-chip": "8px",
      "r-media": "10px",
      "r-control": "12px",
      "r-card": "14px",
      "r-panel": "16px",
      "r-full": "999px",
    });
  });

  it("resolves every step through the accessor, in both themes", () => {
    // One value per step, theme-independent by design, so "in both themes"
    // is the claim that the accessor names a token the blocks declare — which
    // css-parity.test.ts checks against the stylesheet itself.
    for (const name of RADIUS_NAMES) {
      const key = name.slice(2) as keyof typeof r;
      expect(r[key], `r.${key} is not --${name}`).toBe(`var(--${name})`);
      expect(radiusVar(name)).toBe(`var(--${name})`);
    }
  });

  it("hands out var() references, never pixels", () => {
    for (const value of Object.values(r)) expect(value).toMatch(/^var\(--r-[a-z]+\)$/);
  });

  it("steps upward from chip to panel, with no two steps the same", () => {
    const rectangular: RadiusName[] = ["r-chip", "r-media", "r-control", "r-card", "r-panel"];
    const px = rectangular.map((n) => parseInt(RADIUS[n], 10));
    expect(px).toEqual([...px].sort((a, b) => a - b));
    expect(new Set(px).size).toBe(px.length);
  });

  it("keeps --r-full for circular things, far above the rectangular steps", () => {
    // Not a "very rounded" step: the gap between the largest rectangular radius
    // and this one is what stops it being reached for as one.
    const panel = parseInt(RADIUS["r-panel"], 10);
    expect(parseInt(RADIUS["r-full"], 10)).toBeGreaterThan(panel * 10);
  });

  it("does not collide with the colour tokens sharing the root block", () => {
    for (const name of RADIUS_NAMES) {
      expect(TOKEN_NAMES as readonly string[]).not.toContain(name);
    }
  });

  it("never adopts the legacy pill tokens as steps of the scale", () => {
    // BG-P07 repointed --radius-btn and --radius-badge at --r-control and
    // --r-chip, so the pill is gone from the running app. The two NAMES still
    // exist in the legacy :root block because three consumers of them sit in
    // files that prompt was not allowed to edit; see the exemption below.
    // Neither is a step of this scale and neither may become one — a fourth
    // name for a radius the scale already has is how a six-step vocabulary
    // turns back into sixteen.
    expect(RADIUS_NAMES).not.toContain("radius-btn" as RadiusName);
    expect(RADIUS_NAMES).not.toContain("radius-badge" as RadiusName);
  });
});

describe("the focus ring", () => {
  it("is 2px of --lit with a 2px offset", () => {
    expect(focusRing).toEqual({
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineColor: "var(--lit)",
      outlineOffset: "2px",
    });
    expect(FOCUS_RING_WIDTH).toBe("2px");
    expect(FOCUS_RING_OFFSET).toBe("2px");
  });

  it("spends --lit and nothing else", () => {
    expect(focusRing.outlineColor).toBe("var(--lit)");
    const spent = Object.values(focusRing).filter((v) => v.startsWith("var("));
    expect(spent).toEqual(["var(--lit)"]);
  });

  it("is an outline, so it cannot shift a layout when it appears", () => {
    const keys = Object.keys(focusRing);
    expect(keys.every((k) => k.startsWith("outline"))).toBe(true);
    expect(keys).not.toContain("border");
    expect(keys).not.toContain("boxShadow");
  });

  it("carries the offset that makes amber legal here", () => {
    // The ring is read against a band of --bg rather than against the ground
    // alone. Without the offset the 3.0:1 UI floor is the whole argument, and
    // --lit is 1.80:1 on Exhibition's ground.
    expect(focusRing.outlineOffset).not.toBe("0");
    expect(parseInt(focusRing.outlineOffset, 10)).toBeGreaterThan(0);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   BG-P07 — the retirement of the pill tokens.

   Acceptance for that prompt was "no --radius-btn or --radius-badge consumer
   remains — grep proves zero". It is met for every file the prompt was allowed
   to touch, and cannot be met for three lines that sit in files it was not:
   LeftPanel.tsx and RightPanelExplore.tsx are externally-supplied visual shells
   (`neoscale-ui` RULE 3), and the buttons carrying those three references are
   the reserved primary and secondary button SURFACES — two independent reasons
   each to leave them alone. Editing them would have been an automatic-fail in
   code review, so they are exempted here in the open rather than quietly
   changed, exactly as BG-P03 exempted LeftPanel from the retired-face sweep.

   The visual acceptance is met anyway, and that is the point of the exemption
   rather than an excuse for it: --radius-btn and --radius-badge are now
   declared as var(--r-control) and var(--r-chip), so the three exempt call
   sites render at 12px like everything else. Nothing in the running app is a
   pill. What survives is the NAME, in three lines of source.

   These tests are the ratchet. The list may only ever shrink.
   ──────────────────────────────────────────────────────────────────────────── */
describe("the legacy pill tokens", () => {
  // Every remaining reference, by file and by count. Nothing may be added.
  const EXEMPT: Record<string, number> = {
    "src/components/layout/LeftPanel.tsx": 1,
    "src/components/layout/RightPanelExplore.tsx": 2,
  };

  /* Built fresh per use, never shared. A /g regex carries `lastIndex` between
     calls, so a single shared instance used with .test() skips every other
     match and would quietly report a clean sweep over a dirty tree. */
  const legacy = () => /var\(--radius-(?:btn|badge)\)/g;

  it("has no consumer outside the exempt shell files", () => {
    const offenders = sourceFiles()
      .filter(([path]) => !(path in EXEMPT))
      .filter(([, text]) => legacy().test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it("has an exemption list that is still doing work", () => {
    for (const [path, expected] of Object.entries(EXEMPT)) {
      const [, text] = sourceFiles().find(([p]) => p === path) ?? [];
      expect(text, `${path} is exempted but missing`).toBeDefined();
      const found = text?.match(legacy())?.length ?? 0;
      expect(found, `${path} no longer needs its exemption — remove the entry`).toBe(expected);
    }
  });

  it("declares both legacy names as the new scale, so no surface is a pill", () => {
    const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");
    expect(css).toMatch(/--radius-btn:\s*var\(--r-control\)/);
    expect(css).toMatch(/--radius-badge:\s*var\(--r-chip\)/);
    // The 100px the pill rule was built on must be gone from the declaration.
    expect(css).not.toMatch(/--radius-(?:btn|badge):\s*100px/);
  });

  it("leaves no stylesheet rule reading a legacy name", () => {
    const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");
    // Comments explain the retirement and are allowed to name the tokens; a
    // declaration that USES one is what this forbids.
    const uses = css.match(/:\s*var\(--radius-(?:btn|badge)\)/g) ?? [];
    expect(uses).toEqual([]);
  });
});
