// UX-10 P10: the old profile is retired: none of its copy is left in the profile's folder, its components with no other importer
// are gone, and the new copy keeps to the words the prompt allows.

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CUSTOMISE_COPY } from "./CustomiseProfile";
import { FEED_COPY } from "./ProfileFeed";
import { HEAD_COPY } from "./ProfileHead";
import { SIDE_TITLES } from "./ProfileSide";
import { FEED_OPTIONS } from "./profileFeedModel";

const DIR = "src/pages/site/profile";
const sources = () =>
  readdirSync(DIR)
    .filter((file) => /\.tsx?$/.test(file) && !/test\.tsx?$/.test(file))
    .map((file) => [file, readFileSync(`${DIR}/${file}`, "utf8")] as const);

describe("the retired profile", () => {
  it.each([
    ["Builds hung"],
    ["Reproduced by others"],
    ["Rebuilds of their work"],
    ["Bounties solved"],
    ["outlined days were frozen"],
    ["Common · rare · highest"],
    ["eyebrowLine"],
    ["WORKS_TABS"],
    ["ActivityGrid"],
    ["figuresBarsExpected"],
    ["RING_CAPTION"],
    ["ProfileBanner"],
  ])("%s is gone from the profile's folder", (copy) => {
    for (const [file, text] of sources()) expect(text.includes(copy), `${file} still has ${copy}`).toBe(false);
  });

  it("deletes the components nothing else imports", () => {
    expect(existsSync(`${DIR}/ProfileBanner.tsx`)).toBe(false);
    expect(existsSync("src/components/profile/EditProfileSheet.tsx")).toBe(false);
    const importers = execSync('grep -rl "EditProfileSheet\\|ProfileBanner" src --include=*.ts --include=*.tsx || true').toString().trim().split("\n").filter(Boolean);
    // Only comments that name what was replaced, and this test.
    for (const file of importers.filter((one) => !one.endsWith("ux10.p10.test.ts"))) expect(readFileSync(file, "utf8")).not.toMatch(/import[^;]*(EditProfileSheet|ProfileBanner)/);
  });
});

describe("the new copy", () => {
  const shown: string[] = [
    ...Object.values(HEAD_COPY),
    ...(Object.values(FEED_COPY) as unknown[]).filter((value): value is string => typeof value === "string"),
    ...Object.values(SIDE_TITLES),
    ...FEED_OPTIONS.map((option) => option.label),
    ...(Object.values(CUSTOMISE_COPY) as unknown[]).flatMap((value) => (typeof value === "string" ? [value] : Object.values(value as Record<string, string>))),
  ];

  it("never says request, bounty, claim, solver, solve, answer, fork, component, hung, XP or rarity, and has no em dash", () => {
    for (const line of shown) {
      expect(line, line).not.toMatch(/\b(request|bounty|claim|solver|solve|answer|fork|component|hung|xp|rarity)\b/i);
      expect(line, line).not.toContain(String.fromCharCode(0x2014));
    }
  });

  it("never calls a topic a post or a thread", () => {
    for (const line of shown) expect(line, line).not.toMatch(/\b(thread)\b/i);
    expect(readFileSync(`${DIR}/profileEntries.ts`, "utf8")).not.toMatch(/Untitled post/);
  });
});
