// The surface ladder's role changes in the brand primitives. jsdom stores nothing for a `var()` colour, so the paint
// is read from static markup.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Avatar } from "./Avatar";

const styleOf = (html: string, selector: string) =>
  new DOMParser().parseFromString(html, "text/html").querySelector(selector)?.getAttribute("style") ?? "";

describe("the surface ladder in the brand primitives", () => {
  it("draws an initials avatar on its fill with an edge", () => {
    const style = styleOf(renderToStaticMarkup(<Avatar size={26} userId="u1" name="Ada Lovelace" />), '[data-ui="avatar"]');
    expect(style).toContain("background:var(--avatar-fill)");
    expect(style).toContain("border:1px solid var(--module-border)");
  });
});
