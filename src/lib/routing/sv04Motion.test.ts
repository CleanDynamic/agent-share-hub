// SV-04 P7: nothing else moves. The page fade (index.css, PageChangeProvider, PageArrival) and the progress line
// (PageProgress) are the only motion SV-04 adds: no `animate()` call, no CSS transition, and no keyframes but theirs.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** The files SV-04 added. */
const ADDED = [
  "src/components/brand/coverHeight.ts",
  "src/components/gallery/GalleryCardSkeleton.tsx",
  "src/pages/site/library/LibraryFrame.tsx",
  "src/components/shell/FrameOutlet.tsx",
  "src/components/shell/PageArrival.tsx",
  "src/components/shell/PageProgress.tsx",
  "src/components/shell/frameChrome.ts",
  "src/lib/routing/PageChangeProvider.tsx",
  "src/lib/routing/PageLink.tsx",
  "src/lib/routing/ScrollKeeper.tsx",
  "src/lib/routing/go.ts",
  "src/pages/site/bounties/BountiesFrame.tsx",
  "src/pages/site/build/BuildViewSkeleton.tsx",
  "src/pages/site/drafts/DraftsFrame.tsx",
  "src/pages/site/builds/BuildsFrame.tsx",
];

const code = (path: string) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/** The keyframes SV-04 owns: the page area's fade out and in, and the progress line's fill, finish and fade. */
const OURS = ["bgPageIn", "bgPageOut", "bgPageProgress", "bgPageProgressFill", "bgPageProgressOut"];

describe("SV-04 adds no motion but the page fade and the progress line", () => {
  it.each(ADDED)("%s calls no animate() and sets no transition", (path) => {
    const source = code(path);
    expect(source).not.toMatch(/\.animate\(/);
    expect(source).not.toMatch(/\btransition\s*:/);
    expect(source).not.toMatch(/@keyframes/);
  });

  it.each(ADDED)("%s runs no keyframes but SV-04's own", (path) => {
    const used = [...code(path).matchAll(/\banimation\s*:\s*`?([^`"',}]+)/g)].flatMap((match) => [...match[1].matchAll(/\b(bg[A-Za-z]+)\b/g)].map((name) => name[1]));
    for (const name of used) expect(OURS).toContain(name);
  });

  it("defines the page's keyframes in index.css, opacity and scaleX only", () => {
    const css = readFileSync("src/index.css", "utf8");
    const page = [...css.matchAll(/@keyframes (bgPage[A-Za-z]*) \{([\s\S]*?)\n\}/g)];
    expect(page.map((match) => match[1]).sort()).toEqual([...OURS].sort());
    for (const [, , body] of page) {
      const properties = [...body.matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1]);
      for (const property of properties) expect(["opacity", "transform"]).toContain(property);
      expect(body).not.toMatch(/translate|rotate|scale\((?!.)|scaleY|blur/);
    }
  });

  it("animates no view-transition group but the page area's old and new pictures", () => {
    const css = readFileSync("src/index.css", "utf8");
    const rules = [...css.matchAll(/(::view-transition[^{]+)\{([^}]*)\}/g)];
    const animated = rules.filter(([, , body]) => (body.match(/animation:\s*([^;]+)/)?.[1].trim() ?? "none") !== "none").map(([, selector]) => selector.trim());
    expect(animated).toEqual(["::view-transition-old(page)", "::view-transition-new(page)"]);
  });
});
