// Prompt 9, G17 and G18: the versions the database holds are the legal texts' lastUpdated dates, and the texts cannot be
// marked reviewed while the minimum age is still open.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { MINIMUM_AGE, PRIVACY_VERSION, TERMS_VERSION } from "./legalConstants";
import privacy from "./privacy";
import { PRIVACY_REVIEWED, TERMS_REVIEWED } from "./reviewed";
import terms from "./terms";

const MIGRATIONS = path.resolve(__dirname, "../../../supabase/migrations");

/** The dates in the newest migration that defines public.legal_versions(). */
function versionsInDatabase(): { terms: string; privacy: string } {
  const files = fs
    .readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .filter((name) => /FUNCTION public\.legal_versions\(\)/.test(fs.readFileSync(path.join(MIGRATIONS, name), "utf8")));
  const sql = fs.readFileSync(path.join(MIGRATIONS, files[files.length - 1]), "utf8");
  const match = /SELECT DATE '(\d{4}-\d{2}-\d{2})' AS terms_version, DATE '(\d{4}-\d{2}-\d{2})' AS privacy_version/.exec(sql);
  if (!match) throw new Error("legal_versions() has no dates this test can read");
  return { terms: match[1], privacy: match[2] };
}

/** G18: a reviewed text needs the minimum age. */
export function ageOpenWhileReviewed(flags: { privacy: boolean; terms: boolean }, age: number | null): boolean {
  return (flags.privacy || flags.terms) && age === null;
}

describe("the legal versions (G17)", () => {
  it("are the texts' lastUpdated dates", () => {
    expect(TERMS_VERSION).toBe(terms.lastUpdated);
    expect(PRIVACY_VERSION).toBe(privacy.lastUpdated);
  });

  it("are the dates the database holds in legal_versions()", () => {
    expect(versionsInDatabase()).toEqual({ terms: terms.lastUpdated, privacy: privacy.lastUpdated });
  });
});

describe("the minimum age (G18)", () => {
  it("is 13, 18, or null while the owner has not answered", () => {
    expect([13, 18, null]).toContain(MINIMUM_AGE);
  });

  it("fails the build if a text is marked reviewed while the age is still open", () => {
    expect(ageOpenWhileReviewed({ privacy: PRIVACY_REVIEWED, terms: TERMS_REVIEWED }, MINIMUM_AGE)).toBe(false);
  });

  it("the rule catches a reviewed flag with no age, and passes once the age is set", () => {
    expect(ageOpenWhileReviewed({ privacy: true, terms: false }, null)).toBe(true);
    expect(ageOpenWhileReviewed({ privacy: false, terms: true }, null)).toBe(true);
    expect(ageOpenWhileReviewed({ privacy: true, terms: true }, 18)).toBe(false);
    expect(ageOpenWhileReviewed({ privacy: false, terms: false }, null)).toBe(false);
  });
});
