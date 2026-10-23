// CA-18 P4: the composer's frame drops the 1428 cap; every other page (the gallery, the build page) keeps it.

import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ORIGIN, frameOf, innerWidthOf } from "@/pages/site/compose/detailsLayout";

import { SiteFrameView } from "./SiteFrame";

const markup = (wide?: boolean) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <SiteFrameView viewport="desktop" wide={wide} breadcrumb={<i />}>
        <p>page</p>
      </SiteFrameView>
    </MemoryRouter>,
  );

describe("the frame's wide option", () => {
  it("keeps the surface at 1428 and the main padding unless asked", () => {
    const html = markup();
    expect(html).toContain("width:calc(100% - 12px);max-width:1428px;margin:0 auto 6px");
    expect(html).toContain("padding:24px clamp(16px, 4.6vw, 64px) 48px");
    expect(html).not.toContain("data-wide");
  });

  it("drops the cap and the side padding when wide, and starts the breadcrumb at the box's left edge (CA-18b P5)", () => {
    const html = markup(true);
    expect(html).toContain("max-width:none");
    expect(html).not.toContain("max-width:1428px");
    expect(html).toContain("padding:0 0 48px");
    expect(html).toContain(`padding:24px 0 0 ${frameOf(innerWidthOf(window.innerWidth)).boxLeft - ORIGIN}px`);
  });

  it("is off on the gallery and the build page, which do not pass it", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of ["src/pages/site/build/BuildPage.tsx", "src/pages/site/GalleryPage.tsx"]) {
      let source = "";
      try {
        source = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      expect(source).not.toMatch(/<SiteFrame[^>]*\bwide\b/);
    }
  });
});
