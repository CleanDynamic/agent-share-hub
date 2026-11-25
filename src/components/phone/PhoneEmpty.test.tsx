// Mobile 28 G: one empty state for every list on a phone, and the drop on still water it draws.

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { DROP_CYCLE_S, DRAW_OVER, SPLASH_SHARE, STILL_T, dropTone, dropTrains, splashAt } from "@/lib/dots/dropField";

import { PhoneEmpty } from "./PhoneEmpty";

const mount = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

describe("PhoneEmpty", () => {
  it("draws the water, the line at 20/600, the second line and a secondary action", () => {
    const go = vi.fn();
    mount(<PhoneEmpty line="Nothing new in your spaces." detail="A second line." action={{ label: "See everyone", onClick: go }} data-testid="empty" />);
    expect(screen.getByTestId("phone-empty-water").getAttribute("aria-hidden")).toBe("true");
    const line = screen.getByText("Nothing new in your spaces.");
    expect(line.style.fontSize).toBe("20px");
    expect(line.style.fontWeight).toBe("600");
    expect(screen.getByText("A second line.").style.maxWidth).toBe("300px");
    const button = screen.getByRole("button", { name: "See everyone" });
    expect(button.getAttribute("data-variant")).toBe("raised");
    fireEvent.click(button);
    expect(go).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("empty").style.paddingBottom).toBe("140px");
  });

  it("makes the action main when it creates something, and a link when it has an address", () => {
    mount(<PhoneEmpty line="No builds yet." action={{ label: "New build", href: "/compose/new" }} />);
    const link = screen.getByRole("link", { name: "New build" });
    expect(link.getAttribute("href")).toBe("/compose/new");
    expect(link.getAttribute("data-variant")).toBe("main");
  });

  it("can head the list", () => {
    mount(<PhoneEmpty headingLevel={2} line="Nothing saved yet" />);
    expect(screen.getByRole("heading", { level: 2, name: "Nothing saved yet" })).toBeTruthy();
  });
});

describe("one drop on still water", () => {
  it("keeps three ring trains, one dropped every 2.6s", () => {
    expect(DROP_CYCLE_S).toBe(2.6);
    expect(dropTrains(10, 179, 110)).toHaveLength(3);
    const [a] = dropTrains(0.5, 179, 110);
    const [b] = dropTrains(0.5 + DROP_CYCLE_S, 179, 110);
    expect(a.front).toBeCloseTo(b.front);
  });

  it("splashes only in the first 18% of each cycle, and not in the still frame", () => {
    expect(splashAt(DROP_CYCLE_S * SPLASH_SHARE * 0.5)).toBeCloseTo(1);
    expect(splashAt(DROP_CYCLE_S * SPLASH_SHARE)).toBe(0);
    expect(splashAt(STILL_T)).toBe(0);
  });

  it("squashes the rings to half height: a ring reaches twice as far across as up", () => {
    const w = 358;
    const h = 220;
    const rings = dropTrains(STILL_T, w / 2, h / 2);
    const front = rings[0].front;
    const across = dropTone(w / 2 + front, h / 2, w, h, STILL_T, rings, 0);
    const up = dropTone(w / 2, h / 2 - front / 2, w, h, STILL_T, rings, 0);
    expect(Math.abs(across - up)).toBeLessThan(0.25);
  });

  it("leaves the faint parts as scattered dots: still water is mostly under the threshold", () => {
    const w = 358;
    const h = 220;
    let over = 0;
    let total = 0;
    for (let y = 2; y < 20; y += 4) {
      for (let x = 2; x < w; x += 4) {
        total++;
        if (dropTone(x, y, w, h, STILL_T, [], 0) > DRAW_OVER) over++;
      }
    }
    expect(over / total).toBeLessThan(0.3);
  });
});
