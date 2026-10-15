// UI-P86 — the framed work, the cover fallback's refined picture, the picture light, the result window and the
// streak day.
//
// Styles are asserted through SSR markup (jsdom's cssstyle drops var() values); roles and names on the rendered tree.

import { act, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { BuildCard } from "./BuildCard";
import { CoverFallback } from "./CoverFallback";
import { FRAME_ARTWORK, FramedWork, PictureLight, ResultWindow } from "./FramedWork";
import { StreakDay, StreakWeek } from "./StreakDay";

const REFINED_URL = "/dev/kit/components";
const underRefined = (node: React.ReactElement) => <MemoryRouter initialEntries={[REFINED_URL]}>{node}</MemoryRouter>;
const refined = (node: React.ReactElement) => renderToStaticMarkup(underRefined(node));

afterEach(() => document.documentElement.removeAttribute("data-theme"));

describe("FramedWork", () => {
  it("is a raised object on Noon: white, a #D9D9D9 hairline, radius 4, padding 4, the picture on --paper at radius 2", () => {
    document.documentElement.setAttribute("data-theme", "noon");
    const html = renderToStaticMarkup(<FramedWork height={72}>x</FramedWork>);
    expect(html).toContain("border-radius:4px");
    expect(html).toContain("padding:4px");
    expect(html).toContain("background:#FFFFFF");
    expect(html).toContain("border:1px solid #D9D9D9");
    expect(html).toContain("background:var(--paper)");
    expect(html).toContain("border-radius:2px");
  });

  it("follows <html data-theme> as it changes, and is shaded in Dusk with a lighter top edge", async () => {
    document.documentElement.setAttribute("data-theme", "noon");
    const { container } = render(<FramedWork height={72}>x</FramedWork>);
    const frame = container.querySelector<HTMLElement>('[data-ui="framed-work"]')!;
    expect(frame.dataset.room).toBe("noon");
    act(() => document.documentElement.setAttribute("data-theme", "dusk"));
    await waitFor(() => expect(frame.dataset.room).toBe("dusk"));
    expect(FRAME_ARTWORK.dusk.background).toBe("linear-gradient(#2A2A2E, #1F1F22)");
    expect(FRAME_ARTWORK.dusk.borderTopColor).toBe("#3C3C42");
  });

  it("pads 3 under 40px high", () => {
    expect(renderToStaticMarkup(<FramedWork height={36}>x</FramedWork>)).toContain("padding:3px");
  });

  it("lit hangs the lamp bar 8px above and washes the top 60% of the picture; unlit has neither; never an amber edge", () => {
    const lit = renderToStaticMarkup(<FramedWork lit height={72}>x</FramedWork>);
    expect(lit).toContain('data-ui="lamp-dot"');
    expect(lit).toContain("top:-8px");
    expect(lit).toContain("width:max(12px, 25%)");
    expect(lit).toContain("height:60%");
    expect(lit).not.toMatch(/border[^;"]*var\(--lit\)/);
    const unlit = renderToStaticMarkup(<FramedWork height={72}>x</FramedWork>);
    expect(unlit).not.toContain('data-ui="lamp-dot"');
    expect(unlit).not.toContain("height:60%");
  });
});

describe("CoverFallback under the refined look", () => {
  it("draws the page sketch on --paper instead of the landscape, and keeps its sky in the markup", () => {
    const html = refined(<CoverFallback seed="b1" radius={2} sky={3} />);
    expect(html).toContain('data-ui="cover-fallback"');
    expect(html).toContain('data-sky="3"');
    expect(html).toContain("background:var(--paper)");
    expect(html).not.toContain("<svg");
  });
});

describe("BuildCard's cover under the refined look", () => {
  const build = { reproduction_count: 0, last_confirmed_at: null, last_confirmed_model: null, published_at: null };
  it("hangs in an unlit framed work: the card's one lamp is the picture lamp", () => {
    const html = refined(<BuildCard to="/b2/x" title="Inbox sorter" cover={<CoverFallback seed="x" radius={2} />} build={build} />);
    expect(html).toContain('data-ui="framed-work"');
    expect(html).not.toContain("data-lit");
  });
});

describe("PictureLight", () => {
  it("is a 40×3 bar and a cone clipped to the board's trapezoid", () => {
    const html = renderToStaticMarkup(<PictureLight />);
    expect(html).toContain("width:40px");
    expect(html).toContain("polygon(44.8% 0, 55.2% 0, 100% 100%, 0 100%)");
    expect(html).toContain("width:384px");
    expect(html).toContain("height:240px");
  });
});

describe("ResultWindow", () => {
  it("is a named 304×176 window with a 20px chrome row of three dots and the picture on --paper", () => {
    render(<ResultWindow label="Bakery homepage · Result">x</ResultWindow>);
    expect(screen.getByRole("img", { name: "Bakery homepage · Result" })).toBeTruthy();
    const html = renderToStaticMarkup(<ResultWindow label="r">x</ResultWindow>);
    expect(html).toContain("width:304px");
    expect(html).toContain("height:176px");
    expect(html).toContain("height:20px");
    expect(html.match(/width:4px;height:4px/g)).toHaveLength(3);
    expect(html).toContain("background:var(--paper)");
  });
});

describe("StreakDay", () => {
  const week = (
    <StreakWeek>
      <StreakDay dayName="Monday" letter="M" state="active" />
      <StreakDay dayName="Wednesday" letter="W" state="frozen" />
      <StreakDay dayName="Saturday" letter="S" state="none" />
    </StreakWeek>
  );

  it("keeps each day's accessible name", () => {
    render(week);
    expect(screen.getByRole("listitem", { name: "Monday: lit" })).toBeTruthy();
    expect(screen.getByRole("listitem", { name: "Wednesday: frozen" })).toBeTruthy();
    expect(screen.getByRole("listitem", { name: "Saturday: not lit" })).toBeTruthy();
  });

  it("lit is a control with a 14×3 lamp, frozen a control with a --frozen bar, not lit a dashed --line edge", () => {
    const html = renderToStaticMarkup(week);
    expect(html).toContain("gap:6px");
    expect(html).toContain("height:32px");
    expect(html).toContain("border-radius:6px");
    expect(html).toContain("background:var(--control)");
    expect(html).toContain('data-ui="lamp-dot"');
    expect(html).toContain("background-color:var(--frozen)");
    expect(html).toContain("border:1px dashed var(--line)");
    expect(html).toContain("font-size:11px");
    expect(html).toContain("color:var(--label)");
  });
});
