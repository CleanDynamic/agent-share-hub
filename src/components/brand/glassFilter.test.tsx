// UI-P09b — the one SVG filter behind liquid glass. UI-P81 — and its absence under the refined look.

import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { GLASS_FILTER_ID, GlassFilter } from "./GlassFilter";

const html = renderToStaticMarkup(<GlassFilter />);

/** The filter at a URL. The look comes from the router, as it does in the app: `?look=` counts on `/dev/*` only. */
const at = (url: string) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <GlassFilter />
    </MemoryRouter>,
  );

describe("GlassFilter", () => {
  it("is a hidden, zero-size SVG that assistive technology skips", () => {
    expect(html).toContain('width="0"');
    expect(html).toContain('height="0"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("position:absolute");
  });

  it("holds the one filter, clipped to the panel", () => {
    expect(GLASS_FILTER_ID).toBe("bg-glass-distortion");
    expect(html).toContain('id="bg-glass-distortion"');
    expect(html).toContain('x="0%" y="0%" width="100%" height="100%"');
  });

  it("carries the values measured at panel size, not the card's", () => {
    expect(html).toContain('baseFrequency="0.012 0.012"');
    expect(html).toContain('numOctaves="2"');
    expect(html).toContain('seed="92"');
    expect(html).toContain('stdDeviation="2"');
    expect(html).toContain('scale="42"');
    expect(html).toContain('xChannelSelector="R"');
    expect(html).toContain('yChannelSelector="G"');
    expect(html).not.toContain("0.035");
    expect(html).not.toContain('scale="180"');
  });
});

describe("GlassFilter under the refined look (UI-P81)", () => {
  it("renders nothing: no SVG, no filter and no displacement map in the document", () => {
    const refined = at("/dev/kit/pages/home?look=refined");
    expect(refined).toBe("");
    expect(refined).not.toContain("feDisplacementMap");
    expect(refined).not.toContain(GLASS_FILTER_ID);
  });

  it("still renders where the look is current, on a dev route too", () => {
    expect(at("/dev/kit/pages/home?look=current")).toContain(`id="${GLASS_FILTER_ID}"`);
    expect(at("/dev/kit/pages/home")).toContain(`id="${GLASS_FILTER_ID}"`);
  });

  it("ignores ?look=refined off the dev routes, where a visitor cannot opt in", () => {
    expect(at("/gallery?look=refined")).toContain(`id="${GLASS_FILTER_ID}"`);
  });

  it("is the same markup as before for the current look", () => {
    expect(at("/dev/kit?look=current")).toBe(html);
  });
});
