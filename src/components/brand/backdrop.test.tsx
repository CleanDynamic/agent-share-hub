// UI-P13 — the page backdrop: the layer, the arc in both rooms and both
// artboards, Dusk's grain, and the rules that keep it static.

import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { Arc, ARC_BUILD_HERO, ARC_BUILD_HERO_MOBILE, ARC_PAGE_DESKTOP, ARC_PAGE_MOBILE, ARC_PROFILE_BANNER } from "./Arc";
import { PageBackdrop } from "./PageBackdrop";

const room = (name: "noon" | "dusk") => {
  document.documentElement.dataset.theme = name;
};
afterEach(() => {
  delete document.documentElement.dataset.theme;
});

const circles = (c: HTMLElement) => [...c.querySelectorAll("circle")];

describe("PageBackdrop", () => {
  it("is an absolute, inert, non-fixed layer at z-index 0 painting --ambient over --backdrop", () => {
    room("noon");
    // SSR markup: jsdom's cssstyle drops a `var()` inside a multi-layer background.
    const html = renderToStaticMarkup(<PageBackdrop />);
    expect(html).toContain("position:absolute;inset:0;z-index:0");
    expect(html).toContain("pointer-events:none");
    expect(html).toContain("background:var(--ambient), var(--backdrop)");
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("position:fixed");
    expect(html).toContain("aspect-ratio:1440 / 1066");
    expect(renderToStaticMarkup(<PageBackdrop viewport="mobile" />)).toContain("aspect-ratio:390 / 640");
  });

  it("draws the desktop artboard, pinned top-right and sliced", () => {
    room("noon");
    const { container } = render(<PageBackdrop viewport="desktop" />);
    const svg = container.querySelector('svg[data-ui="arc"]')!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 1440 1066");
    expect(svg.getAttribute("preserveAspectRatio")).toBe("xMaxYMin slice");
    const c = circles(container)[0];
    expect([c.getAttribute("cx"), c.getAttribute("cy"), c.getAttribute("r")]).toEqual(["1780", "-520", "1080"]);
  });

  it("draws the mobile artboard when asked", () => {
    room("noon");
    const { container } = render(<PageBackdrop viewport="mobile" />);
    expect(container.querySelector('svg[data-ui="arc"]')!.getAttribute("viewBox")).toBe("0 0 390 640");
    const c = circles(container)[0];
    expect([c.getAttribute("cx"), c.getAttribute("cy"), c.getAttribute("r")]).toEqual(["560", "-300", "470"]);
  });

  it("has grain on Dusk only, as the reference's fractal noise at .15 in overlay", () => {
    room("dusk");
    const dusk = render(<PageBackdrop />).container;
    const grain = dusk.querySelector<SVGElement>('svg[data-ui="grain"]')!;
    expect(grain).not.toBeNull();
    expect(grain.style.opacity).toBe("0.15");
    expect(grain.style.mixBlendMode).toBe("overlay");
    const noise = grain.querySelector("feTurbulence")!;
    expect(noise.getAttribute("type")).toBe("fractalNoise");
    expect(noise.getAttribute("baseFrequency")).toBe(".85");
    expect(noise.getAttribute("numOctaves")).toBe("2");
    expect(noise.getAttribute("stitchTiles")).toBe("stitch");

    room("noon");
    expect(render(<PageBackdrop />).container.querySelector('svg[data-ui="grain"]')).toBeNull();
  });

  it("is static: no animation, no displacement, no scroll listener's worth of elements", () => {
    for (const r of ["noon", "dusk"] as const) {
      room(r);
      const html = render(<PageBackdrop />).container.innerHTML;
      expect(html).not.toMatch(/<animate|<set|feDisplacementMap|animation/i);
    }
  });
});

describe("Arc", () => {
  it("on Dusk: haze 170 at .5 blurred 46, middle 16 at .95 blurred 7, core --arc-1 2.4, outer ring at r + 12", () => {
    room("dusk");
    const { container } = render(<Arc geometry={ARC_PAGE_DESKTOP} />);
    const [haze, middle, core, outer] = circles(container);
    expect(haze.getAttribute("stroke-width")).toBe("170");
    expect(haze.getAttribute("opacity")).toBe("0.5");
    expect(haze.getAttribute("stroke")).toBe("var(--arc-haze)");
    expect(middle.getAttribute("stroke-width")).toBe("16");
    expect(middle.getAttribute("opacity")).toBe("0.95");
    expect(core.getAttribute("stroke")).toBe("var(--arc-1)");
    expect(core.getAttribute("stroke-width")).toBe("2.4");
    expect(outer.getAttribute("r")).toBe("1092");
    expect(outer.getAttribute("stroke")).toBe("var(--arc-outer)");
    expect(outer.getAttribute("opacity")).toBe("0.5");
    const blurs = [...container.querySelectorAll("feGaussianBlur")].map((b) => b.getAttribute("stdDeviation"));
    expect(blurs).toEqual(["46", "7"]);
    const stops = [...container.querySelectorAll("stop")].map((s) => s.getAttribute("offset"));
    expect(stops).toEqual(["0", "0.4", "1"]);
  });

  it("on Noon: haze 130 at .6, one 2.4 gradient core with stops at 0 / .55 / 1, outer ring at .35, one blur", () => {
    room("noon");
    const { container } = render(<Arc geometry={ARC_PAGE_DESKTOP} />);
    const [haze, core, outer] = circles(container);
    expect(circles(container)).toHaveLength(3);
    expect(haze.getAttribute("stroke-width")).toBe("130");
    expect(haze.getAttribute("opacity")).toBe("0.6");
    expect(core.getAttribute("stroke-width")).toBe("2.4");
    expect(core.getAttribute("stroke")).toMatch(/^url\(#arc-grad-/);
    expect(outer.getAttribute("opacity")).toBe("0.35");
    expect([...container.querySelectorAll("feGaussianBlur")]).toHaveLength(1);
    expect([...container.querySelectorAll("stop")].map((s) => s.getAttribute("offset"))).toEqual(["0", "0.55", "1"]);
  });

  it("runs the gradient userSpaceOnUse from cx − r at the top to the artboard's bottom-right corner", () => {
    room("noon");
    const g = (geom: typeof ARC_PAGE_DESKTOP) => {
      const { container } = render(<Arc geometry={geom} />);
      const l = container.querySelector("linearGradient")!;
      return [l.getAttribute("gradientUnits"), ...["x1", "y1", "x2", "y2"].map((a) => l.getAttribute(a))];
    };
    expect(g(ARC_PAGE_DESKTOP)).toEqual(["userSpaceOnUse", "700", "0", "1440", "1066"]);
    expect(g(ARC_PAGE_MOBILE)).toEqual(["userSpaceOnUse", "90", "0", "390", "640"]);
    expect(g(ARC_BUILD_HERO)).toEqual(["userSpaceOnUse", "480", "0", "900", "400"]);
    expect(g(ARC_PROFILE_BANNER)).toEqual(["userSpaceOnUse", "390", "0", "900", "260"]);
    expect(g(ARC_BUILD_HERO_MOBILE)).toEqual(["userSpaceOnUse", "100", "0", "362", "380"]);
  });

  it("carries the reference's smaller geometries", () => {
    expect(ARC_BUILD_HERO).toEqual({ width: 900, height: 400, cx: 1100, cy: -260, r: 620 });
    expect(ARC_PROFILE_BANNER).toEqual({ width: 900, height: 260, cx: 1150, cy: -420, r: 760 });
    expect(ARC_BUILD_HERO_MOBILE).toEqual({ width: 362, height: 380, cx: 520, cy: -240, r: 420 });
  });

  it("gives every instance its own ids, so two arcs on a page cannot share a gradient", () => {
    room("dusk");
    const { container } = render(
      <>
        <Arc geometry={ARC_PAGE_DESKTOP} />
        <Arc geometry={ARC_BUILD_HERO} />
      </>,
    );
    const ids = [...container.querySelectorAll("[id]")].map((e) => e.id);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
  });
});
