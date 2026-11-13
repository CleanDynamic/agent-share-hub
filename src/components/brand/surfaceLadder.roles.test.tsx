// The surface ladder's role changes in the brand primitives. jsdom stores nothing for a `var()` colour, so the paint
// is read from static markup.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Avatar } from "./Avatar";
import { Pill } from "./Pill";

const styleOf = (html: string, selector: string) =>
  new DOMParser().parseFromString(html, "text/html").querySelector(selector)?.getAttribute("style") ?? "";

describe("the surface ladder in the brand primitives", () => {
  it("draws an initials avatar on its fill with an edge", () => {
    const style = styleOf(renderToStaticMarkup(<Avatar size={26} userId="u1" name="Ada Lovelace" />), '[data-ui="avatar"]');
    expect(style).toContain("background:var(--avatar-fill)");
    expect(style).toContain("border:1px solid var(--module-border)");
  });

  it("draws a plain status chip on its fill with an edge", () => {
    for (const tone of [undefined, "lit-ink"] as const) {
      const style = styleOf(renderToStaticMarkup(<Pill tone={tone}>4 runs</Pill>), '[data-ui="pill"]');
      expect(style).toContain("background:var(--pill)");
      expect(style).toContain("border:1px solid var(--module-border)");
    }
  });
});

describe("the media grid on the surface ladder", () => {
  it("is a well holding inset cells, not a hairline fill", async () => {
    const { GridFrame } = await import("@/components/post/media/PostMediaGrid");
    const layout = { columns: "1fr 1fr", rows: "1fr", ratio: 2, cells: [{ area: {} }, { area: {} }] };
    const html = renderToStaticMarkup(
      <GridFrame layout={layout as never} count={2} renderCell={(index, style) => <div key={index} data-cell="" style={style} />} />,
    );
    expect(styleOf(html, "[data-post-media-grid]")).toContain("background:var(--well)");
    expect(styleOf(html, "[data-cell]")).toContain("background:var(--inset)");
  });
});
