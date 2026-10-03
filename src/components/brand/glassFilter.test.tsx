// UI-P09b — the one SVG filter behind liquid glass.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GLASS_FILTER_ID, GlassFilter } from "./GlassFilter";

const html = renderToStaticMarkup(<GlassFilter />);

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
