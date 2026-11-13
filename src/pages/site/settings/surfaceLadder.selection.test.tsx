// The surface ladder's selection rule on the Settings side list: the current section and the others share one fill,
// and the current one is told apart by its border. jsdom stores nothing for a `var()` colour, so the paint is read from
// static markup.

import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { SettingsFrame } from "./SettingsFrame";

const prop = (style: string, name: string) => new RegExp(`(?:^|;)${name}:([^;]*)`).exec(style)?.[1] ?? "";

describe("the Settings side list on the surface ladder", () => {
  it("gives the current section the selected border and the same fill as the others", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/settings/privacy"]}>
        <SettingsFrame section="privacy" />
      </MemoryRouter>,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const links = [...doc.querySelectorAll('nav[aria-label="Settings"] a')];
    const current = links.find((a) => a.getAttribute("aria-current") === "page")?.getAttribute("style") ?? "";
    const other = links.find((a) => !a.hasAttribute("aria-current"))?.getAttribute("style") ?? "";
    expect(prop(current, "background")).toBe(prop(other, "background"));
    expect(prop(current, "border")).toBe("1px solid var(--selected-edge)");
    expect(prop(other, "border")).toBe("1px solid transparent");
  });
});
