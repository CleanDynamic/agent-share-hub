// UI-P82 — the glyph set and the Icon switch.
//
// Attributes are read off the rendered tree. The look is chosen the way a dev page chooses it: `?look=refined` on a
// `/dev/*` route (UI-P78); with no router the switch decides, so that one test reads `REFINED_LOOK_ENABLED`.

import { render } from "@testing-library/react";
import { Bell, Search, Sparkles } from "lucide-react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { REFINED_LOOK_ENABLED } from "@/lib/theme/look";

import { Glyph } from "./Glyph";
import { Icon } from "./Icon";
import { GLYPHS, GLYPH_NAMES, type GlyphName } from "./glyphs";

/** The UI-P82 table, spelled out so that a path cannot change without this file changing too. */
const TABLE: Record<GlyphName, string> = {
  chev: "M6.5 4 10.5 8l-4 4",
  chevd: "M4 6.5 8 10.5l4-4",
  chevl: "M9.5 4 5.5 8l4 4",
  search: "M10.25 10.25 13.5 13.5M11.25 7a4.25 4.25 0 1 1-8.5 0 4.25 4.25 0 0 1 8.5 0z",
  bell: "M4.5 11V7.5a3.5 3.5 0 0 1 7 0V11l1 1.25h-9zM6.75 14.25h2.5",
  moon: "M12.75 9.75A5.25 5.25 0 0 1 6.25 3.25a5.25 5.25 0 1 0 6.5 6.5z",
  sun: "M8 5.25a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5zM8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1 1M11.4 11.4l1 1M3.6 12.4l1-1M11.4 4.6l1-1",
  plus: "M8 3.5v9M3.5 8h9",
  x: "M4.5 4.5l7 7M11.5 4.5l-7 7",
  pencil: "M10.5 3.5l2 2L6 12H4v-2z",
  file: "M4 2.5h5.5L12 5v8.5H4zM9.5 2.5V5H12",
  layers: "M8 2.5 13.5 5.5 8 8.5 2.5 5.5zM2.5 8.5 8 11.5l5.5-3M2.5 11.25 8 14.25l5.5-3",
  panel: "M2.5 3h11v10h-11zM6 3v10M8.5 6.5 10 8l-1.5 1.5",
  larr: "M13 8H3.5M7 4.5 3.5 8 7 11.5",
  rarr: "M3 8h9.5M9 4.5 12.5 8 9 11.5",
  check: "M3.5 8.5 6.5 11.5 12.5 4.5",
  more: "M3.5 8h.01M8 8h.01M12.5 8h.01",
  up: "M8 13V3.5M4.5 7 8 3.5 11.5 7",
  image: "M2.5 3.5h11v9h-11zM2.5 10.5l3-3 3 3 2-2 3 3M10.5 6h.01",
  play: "M5 3.5v9l7-4.5z",
  expand: "M9.5 2.5h4v4M13.5 2.5l-5 5M6.5 13.5h-4v-4M2.5 13.5l5-5",
  grid: "M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z",
  globe:
    "M13.5 8a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0zM2.5 8h11M8 2.5c1.5 1.5 2.3 3.4 2.3 5.5S9.5 12 8 13.5M8 2.5C6.5 4 5.7 5.9 5.7 8s.8 4 2.3 5.5",
  mail: "M2.5 4h11v8h-11zM2.5 4.5 8 9l5.5-4.5",
};

const REFINED_URL = "/dev/kit/components?look=refined";
const CURRENT_URL = "/dev/kit/components?look=current";
const at = (url: string, node: React.ReactElement) => <MemoryRouter initialEntries={[url]}>{node}</MemoryRouter>;
const svgOf = (container: HTMLElement) => container.querySelector("svg") as SVGSVGElement;

describe("the glyph table", () => {
  it("is the 24 glyphs of the UI-P82 table, in its order", () => {
    expect(GLYPH_NAMES).toHaveLength(24);
    expect(GLYPH_NAMES).toEqual(Object.keys(TABLE));
  });

  it.each(Object.entries(TABLE))("%s keeps the table's path", (name, d) => {
    expect(GLYPHS[name as GlyphName]).toBe(d);
  });
});

describe("Glyph", () => {
  it.each(GLYPH_NAMES)("%s renders one path, and nothing else", (name) => {
    const { container } = render(<Glyph name={name} />);
    const svg = svgOf(container);
    expect(svg.children).toHaveLength(1);
    const paths = svg.querySelectorAll("path");
    expect(paths).toHaveLength(1);
    expect(paths[0].getAttribute("d")).toBe(TABLE[name]);
  });

  it("is a 16px square-cap line drawing in currentColor, hidden from assistive technology", () => {
    const svg = svgOf(render(<Glyph name="search" />).container);
    expect(svg).toHaveAttribute("width", "16");
    expect(svg).toHaveAttribute("height", "16");
    expect(svg).toHaveAttribute("viewBox", "0 0 16 16");
    expect(svg).toHaveAttribute("fill", "none");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("stroke-width", "1.3");
    expect(svg).toHaveAttribute("stroke-linecap", "square");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("draws every glyph at stroke 1.3 but `more`, which is three dots and takes 2", () => {
    for (const name of GLYPH_NAMES) {
      const svg = svgOf(render(<Glyph name={name} />).container);
      expect(svg.getAttribute("stroke-width"), name).toBe(name === "more" ? "2" : "1.3");
    }
  });

  it("scales the drawing with `size`: width and height change, the viewBox does not", () => {
    const svg = svgOf(render(<Glyph name="globe" size={19} />).container);
    expect(svg).toHaveAttribute("width", "19");
    expect(svg).toHaveAttribute("height", "19");
    expect(svg).toHaveAttribute("viewBox", "0 0 16 16");
  });

  it("takes a colour for the stroke, and never a fill", () => {
    const svg = svgOf(render(<Glyph name="mail" color="var(--text2)" />).container);
    expect(svg).toHaveAttribute("stroke", "var(--text2)");
    expect(svg).toHaveAttribute("fill", "none");
  });
});

describe("Icon", () => {
  it("is the lucide icon under the current look, as given", () => {
    const svg = svgOf(
      render(at(CURRENT_URL, <Icon lucide={Search} glyph="search" size={16} strokeWidth={1.6} />)).container,
    );
    expect(svg).toHaveClass("lucide-search");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("width", "16");
    expect(svg).toHaveAttribute("stroke-width", "1.6");
    expect(svg).toHaveAttribute("stroke-linecap", "round");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg.querySelector(`path[d="${GLYPHS.search}"]`)).toBeNull();
  });

  it("follows the real switch with no router at all, since there is no URL to read", () => {
    const svg = svgOf(render(<Icon lucide={Bell} glyph="bell" />).container);
    if (REFINED_LOOK_ENABLED) {
      expect(svg).toHaveAttribute("viewBox", "0 0 16 16");
      expect(svg.querySelector("path")).toHaveAttribute("d", GLYPHS.bell);
    } else {
      expect(svg).toHaveClass("lucide-bell");
      expect(svg).toHaveAttribute("width", "24");
    }
  });

  it("leaves `aria-hidden` to the caller when the caller sets it", () => {
    const svg = svgOf(render(at(CURRENT_URL, <Icon lucide={Search} aria-hidden={false} />)).container);
    expect(svg).toHaveAttribute("aria-hidden", "false");
  });

  it("is the glyph under the refined look, drawn from `size` and `color` alone", () => {
    const svg = svgOf(
      render(at(REFINED_URL, <Icon lucide={Search} glyph="search" size={18} color="var(--label)" strokeWidth={1.6} />))
        .container,
    );
    expect(svg).not.toHaveClass("lucide");
    expect(svg).toHaveAttribute("viewBox", "0 0 16 16");
    expect(svg).toHaveAttribute("width", "18");
    expect(svg).toHaveAttribute("stroke", "var(--label)");
    expect(svg).toHaveAttribute("stroke-width", "1.3");
    expect(svg).toHaveAttribute("stroke-linecap", "square");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg.querySelectorAll("path")).toHaveLength(1);
    expect(svg.querySelector("path")).toHaveAttribute("d", GLYPHS.search);
  });

  it("draws a glyph at 16 when no size is given", () => {
    expect(svgOf(render(at(REFINED_URL, <Icon lucide={Bell} glyph="bell" />)).container)).toHaveAttribute("width", "16");
  });

  it("draws a lucide icon with no glyph at stroke 1.3 with square caps, whatever stroke it was given", () => {
    const svg = svgOf(render(at(REFINED_URL, <Icon lucide={Sparkles} size={16} strokeWidth={1.6} />)).container);
    expect(svg).toHaveClass("lucide-sparkles");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("width", "16");
    expect(svg).toHaveAttribute("stroke-width", "1.3");
    expect(svg).toHaveAttribute("stroke-linecap", "square");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});
