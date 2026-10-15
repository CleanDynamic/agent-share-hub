// UI-P97 — the refined two-track row between the boards: two tracks from 1024, one column below, the aside's side
// hairline turned into a top one.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { asideStyle, mainStyle, trackRow } from "./refinedLayout";

const SIDE = { flex: "1 0 300px", maxWidth: 340, minWidth: 0, paddingLeft: 32, borderLeft: "1px solid var(--hairline)" } as const;

describe("refinedLayout", () => {
  it("keeps two tracks side by side from 1024 and leaves the aside as drawn", () => {
    expect(trackRow(false, 48)).toMatchObject({ display: "flex", flexWrap: "nowrap", gap: 48 });
    expect(asideStyle(false, SIDE)).toEqual(SIDE);
    expect(mainStyle(false, { flex: "999 1 640px" })).toEqual({ flex: "999 1 640px" });
  });

  it("is one column below 1024, the aside under the main column with a top hairline and no side one", () => {
    expect(trackRow(true, 48)).toMatchObject({ flexDirection: "column", gap: 48 });
    const aside = asideStyle(true, SIDE);
    expect(aside.borderLeft).toBeUndefined();
    expect(aside.paddingLeft).toBeUndefined();
    expect(aside.borderTop).toBe("1px solid var(--hairline)");
    expect(aside).toMatchObject({ flex: "none", width: "100%", maxWidth: "none", order: 1 });
  });

  it("drops a leading sidebar's right rule too", () => {
    const aside = asideStyle(true, { paddingRight: 24, borderRight: "1px solid var(--hairline)" });
    expect(aside.borderRight).toBeUndefined();
    expect(aside.borderTop).toBe("1px solid var(--hairline)");
  });

  it("gives the main column no flex basis in a column, where a basis is a height", () => {
    expect(mainStyle(true, { flex: "999 1 640px", minWidth: 0 })).toMatchObject({ flex: "none", width: "100%" });
  });
});

describe("the refined rules in index.css", () => {
  const css = readFileSync("src/index.css", "utf8");

  it("rings every focusable thing with the one ring, scoped to the refined look", () => {
    expect(css).toMatch(/:root\[data-look="refined"\] :where\([\s\S]*?a\[href\],[\s\S]*?\):focus-visible\s*\{\s*outline: 2px solid var\(--focus-ring\) !important;\s*outline-offset: 2px !important;/);
    expect(css).toContain(':root[data-look="refined"] [data-ring-inset]:focus-visible');
  });

  it("stops every transition and animation under the refined look except the theme change", () => {
    expect(css).toMatch(/:root\[data-look="refined"\]:not\(\[data-theme-changing\]\) \*,[\s\S]*?transition: none !important;\s*animation: none !important;/);
  });

  it("makes a phone's fields 16px", () => {
    expect(css).toMatch(/@media \(max-width: 767px\) \{\s*:root\[data-look="refined"\] :is\([\s\S]*?font-size: 16px !important;/);
  });
});
