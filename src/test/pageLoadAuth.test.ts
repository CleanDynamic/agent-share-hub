// SV-03 P1: a read that runs when a page loads names the signed-in reader from the stored session
// (`auth.getSession()`, no network) and never asks the auth server (`auth.getUser()`, one round trip each).
//
// `getUser` stays where the server's own answer matters or the reader has just acted: a save, a publish, a send, a search
// they typed. Those are the other calls in the report; this list is the ones that run on load.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PAGE_LOAD_FILES = [
  "src/lib/profile/colourSwatches.ts",
  "src/components/ContentBlockViewer.tsx",
  "src/components/ExistingBlueprintSearch.tsx",
  "src/hooks/useDocumentComments.ts",
  "src/pages/ContentDetail.legacy.tsx",
];

const callsOf = (file: string) => {
  const source = readFileSync(file, "utf8");
  return source.split("\n").flatMap((line, at) => (/auth\.getUser\(/.test(line) ? [`${file}:${at + 1}`] : []));
};

describe("page-load paths", () => {
  it.each(PAGE_LOAD_FILES)("%s asks the auth server only for an action", (file) => {
    // ContentBlockViewer keeps one: the ad impression is written when the ad is shown, not when the page loads.
    const allowed = file.endsWith("ContentBlockViewer.tsx") ? 1 : 0;
    expect(callsOf(file)).toHaveLength(allowed);
  });
});
