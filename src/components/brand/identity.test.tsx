// UI-P06 — mark, lockup and cover fallback.
//
// The geometry is the reference's, so the checks are on the drawn numbers; the
// one behaviour is the cover's hash, which has to be stable and cover all six
// skies, and the lockup's two derived numbers (the mark and the gap) at every
// size the design uses.

import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { COVER_SKIES, CoverFallback, hashSeed, skyIndex } from "./CoverFallback";
import { Lockup } from "./Lockup";
import { Mark } from "./Mark";

const q = (root: ParentNode, sel: string) => root.querySelector(sel) as SVGElement | HTMLElement;

describe("Mark", () => {
  it("draws the lamp, the frame and the work, and nothing else without a halo", () => {
    const { container } = render(<Mark size={40} />);
    const svg = q(container, "svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 40 40");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("width")).toBe("40");

    const ellipses = container.querySelectorAll("ellipse");
    expect(ellipses).toHaveLength(1);
    expect(ellipses[0].getAttribute("cx")).toBe("20");
    expect(ellipses[0].getAttribute("cy")).toBe("4.8");
    expect(ellipses[0].getAttribute("fill")).toBe("var(--lit)");

    const [frame, work] = Array.from(container.querySelectorAll("rect"));
    expect(frame.getAttribute("fill")).toBe("none");
    expect(frame.getAttribute("stroke")).toBe("currentColor");
    expect(frame.getAttribute("stroke-width")).toBe("3");
    expect(work.getAttribute("fill")).toBe("currentColor");
  });

  it("draws the halo first, at 22%, and only when asked", () => {
    const { container } = render(<Mark size={40} halo />);
    const ellipses = Array.from(container.querySelectorAll("ellipse"));
    expect(ellipses).toHaveLength(2);
    expect(ellipses[0].getAttribute("cy")).toBe("9");
    expect(ellipses[0].getAttribute("opacity")).toBe(".22");
    expect(ellipses[1].getAttribute("cy")).toBe("4.8");
  });

  it("lets the tagline put its own lamp colour on the lamp", () => {
    const { container } = render(<Mark size={20} lamp="var(--tagline-lamp)" />);
    expect(container.querySelector("ellipse")?.getAttribute("fill")).toBe("var(--tagline-lamp)");
  });
});

describe("Lockup", () => {
  /** [size, mark, gap] at every size the design uses. */
  it.each([
    [16, 17, 6],
    [19, 20, 7],
    [21, 23, 7],
    [34, 37, 12],
    [64, 70, 24],
    [70, 77, 26],
  ])("at %ipx the mark is %ipx and the gap %ipx", (size, mark, gap) => {
    const { container } = render(<Lockup size={size} />);
    const row = q(container, '[data-ui="lockup"]') as HTMLElement;
    expect(row.style.gap).toBe(`${gap}px`);
    expect(q(container, "svg").getAttribute("width")).toBe(String(mark));
    const word = row.querySelector("span") as HTMLElement;
    expect(word.textContent).toBe("buildgallery");
    expect(word.style.fontSize).toBe(`${size}px`);
    expect(word.style.letterSpacing).toBe("-0.03em");
    expect(word.style.lineHeight).toBe("1");
  });

  it("is a plain row with no name of its own when it is not a link", () => {
    const { container } = render(<Lockup size={21} />);
    expect(container.querySelector("a")).toBeNull();
  });

  it("names a link home 'buildgallery home'", () => {
    const { getByRole } = render(
      <MemoryRouter>
        <Lockup size={21} to="/" />
      </MemoryRouter>,
    );
    const link = getByRole("link", { name: "buildgallery home" });
    expect(link.getAttribute("href")).toBe("/");
  });

  it("draws the halo only in the Dusk room", () => {
    document.documentElement.dataset.theme = "dusk";
    const dusk = render(<Lockup size={21} />);
    expect(dusk.container.querySelectorAll("ellipse")).toHaveLength(2);
    dusk.unmount();

    document.documentElement.dataset.theme = "noon";
    const noon = render(<Lockup size={21} />);
    expect(noon.container.querySelectorAll("ellipse")).toHaveLength(1);
    noon.unmount();
    delete document.documentElement.dataset.theme;
  });
});

describe("CoverFallback", () => {
  it("draws the landscape the reference draws", () => {
    const { container } = render(<CoverFallback seed="abc" radius="10px" sky={0} />);
    const svg = q(container, "svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 300 180");
    expect(svg.getAttribute("preserveAspectRatio")).toBe("xMidYMid slice");

    const stops = Array.from(container.querySelectorAll("stop"));
    expect(stops.map((s) => [s.getAttribute("offset"), s.getAttribute("stop-color")])).toEqual([
      ["0", "#2A2340"],
      [".55", "#8C78C4"],
      ["1", "#E8A283"],
    ]);

    const sun = q(container, "ellipse");
    expect(sun.getAttribute("cx")).toBe("70");
    expect(sun.getAttribute("cy")).toBe("112");
    expect(sun.getAttribute("fill")).toBe("#F3C6A5");
    expect(sun.getAttribute("opacity")).toBe(".9");

    const hills = Array.from(container.querySelectorAll("path"));
    expect(hills.map((h) => h.getAttribute("fill"))).toEqual(["#5C5480", "#372F4A", "#1F1B2B"]);
    expect(hills[0].getAttribute("d")).toBe(
      "M0 118 C40 98 70 108 100 94 C130 80 160 102 200 96 C240 90 270 106 300 98 L300 180 L0 180Z",
    );
  });

  it("puts the sun where each sky says", () => {
    const xs = [0, 1, 2, 3, 4, 5].map((sky) => {
      const { container, unmount } = render(<CoverFallback seed="x" radius={0} sky={sky} />);
      const cx = q(container, "ellipse").getAttribute("cx");
      unmount();
      return Number(cx);
    });
    expect(xs).toEqual([70, 120, 190, 230, 150, 210]);
  });

  it("chooses the same sky for the same seed, every time", () => {
    expect(skyIndex("build-1")).toBe(skyIndex("build-1"));
    expect(hashSeed("build-1")).toBe(hashSeed("build-1"));
  });

  it("reaches all six skies across a spread of ids", () => {
    const seen = new Set<number>();
    for (let n = 0; n < 200; n += 1) seen.add(skyIndex(`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(COVER_SKIES).toHaveLength(6);
  });

  it("gives every instance its own gradient id", () => {
    const { container } = render(
      <>
        <CoverFallback seed="a" radius={0} />
        <CoverFallback seed="a" radius={0} />
      </>,
    );
    const ids = Array.from(container.querySelectorAll("linearGradient")).map((g) => g.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const rect of Array.from(container.querySelectorAll("rect"))) {
      expect(ids).toContain(rect.getAttribute("fill")?.slice(5, -1));
    }
  });

  it("is the same in both themes: no token reaches the artwork", () => {
    const { container } = render(<CoverFallback seed="a" radius={0} />);
    expect(container.innerHTML).not.toContain("var(--");
  });

  it("falls back to the hash when the forced sky is out of range", () => {
    const { container } = render(<CoverFallback seed="a" radius={0} sky={9} />);
    expect(q(container, "svg").getAttribute("data-sky")).toBe(String(skyIndex("a")));
  });
});
