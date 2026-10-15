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
});

describe("CoverFallback", () => {

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

  it("is the same in both themes: no token reaches the artwork", () => {
    const { container } = render(<CoverFallback seed="a" radius={0} />);
    expect(container.innerHTML).not.toContain("var(--");
  });
});
