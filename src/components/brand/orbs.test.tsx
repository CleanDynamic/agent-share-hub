// UI-P10 — the three orbs, and the level ring repainted onto the ring orb.
//
// Styles are asserted through SSR markup (jsdom's cssstyle drops var() values
// and multi-layer gradients); roles and structure on the rendered tree.

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LevelRing from "@/components/profile-game/LevelRing";

import { OrbGlass } from "./OrbGlass";
import { OrbRing } from "./OrbRing";
import { OrbSolid } from "./OrbSolid";

const markup = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("OrbGlass", () => {
  it("is a circle of the painted glass ground, with the edge, the inner light and the drop", () => {
    const html = markup(<OrbGlass size={162} label="Reproduced today" sub="48 runs" />);
    expect(html).toContain('data-ui="orb-glass"');
    expect(html).toContain("width:162px;height:162px;border-radius:50%");
    expect(html).toContain("background:var(--orb-glass)");
    expect(html).toContain(
      "box-shadow:inset 0 0 0 1px var(--orb-glass-edge), inset 0 12px 40px rgba(255,255,255,.18), 0 20px 50px rgba(0,0,0,.25)",
    );
  });

  it("centres a column with gap 5 and keeps 16% of the size clear at the foot", () => {
    expect(markup(<OrbGlass size={162} label="L" />)).toContain("gap:5px;padding-bottom:25px");
    expect(markup(<OrbGlass size={118} label="L" />)).toContain("gap:5px;padding-bottom:18px");
    expect(markup(<OrbGlass size={162} label="L" />)).toContain("flex-direction:column;align-items:center;justify-content:center");
  });

  it("draws a static dotted circle: 18px, r 7.5, stroke --on-orb-glass 1.6, dashed 1.2 3.4, round caps", () => {
    const html = markup(<OrbGlass size={162} label="L" />);
    expect(html).toContain('width="18" height="18" viewBox="0 0 20 20"');
    expect(html).toContain('r="7.5"');
    expect(html).toContain('stroke="var(--on-orb-glass)"');
    expect(html).toContain('stroke-width="1.6"');
    expect(html).toContain('stroke-dasharray="1.2 3.4"');
    expect(html).toContain('stroke-linecap="round"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/animation|<animate|transition/);
  });

  it("sets the label in Figtree 13px 500 and the sub-label in DM Mono 10px at 80%", () => {
    const html = markup(<OrbGlass size={162} label="Reproduced today" sub="48 runs" />);
    expect(html).toContain("font-weight:500;font-size:13px");
    expect(html).toContain("color:var(--on-orb-glass);text-align:center");
    expect(html).toContain("font-size:10px");
    expect(html).toContain("opacity:0.8");
    expect(html).toContain("Reproduced today");
    expect(html).toContain("48 runs");
  });

  it("omits the sub-label when there is none", () => {
    expect(markup(<OrbGlass size={118} label="41 ran it" />)).not.toContain("opacity:0.8");
  });

  it("is real text, so the count is read as words", () => {
    render(<OrbGlass size={118} label="41 ran it" sub="last 27 Sep" />);
    expect(screen.getByText("41 ran it")).toBeTruthy();
    expect(screen.getByText("last 27 Sep")).toBeTruthy();
  });
});

describe("OrbSolid", () => {
  it("is a circle of the solid ground with the drop shadow only", () => {
    const html = markup(<OrbSolid size={162} top="This week" value="312" bottom="runs reported" />);
    expect(html).toContain('data-ui="orb-solid"');
    expect(html).toContain("width:162px;height:162px;border-radius:50%");
    expect(html).toContain("background:var(--orb-solid)");
    expect(html).toContain("box-shadow:0 20px 50px rgba(0,0,0,.25)");
    expect(html).not.toContain("inset");
    expect(html).toContain("gap:3px");
  });

  it.each([
    [162, 27],
    [150, 25],
    [140, 23],
    [128, 21],
    [118, 20],
  ])("a %ipx orb sets its number at %ipx", (size, px) => {
    const html = markup(<OrbSolid size={size} top="t" value="1" bottom="b" />);
    expect(html).toContain(`font-size:${px}px`);
    expect(html).toContain("letter-spacing:-0.03em");
    expect(html).toContain("color:var(--on-orb-solid)");
  });

  it("sets the two lines in Figtree 11px --on-orb-solid-2", () => {
    const html = markup(<OrbSolid size={162} top="This week" value="312" bottom="runs reported" />);
    expect(html.match(/font-size:11px;line-height:normal;color:var\(--on-orb-solid-2\)/g)).toHaveLength(2);
    expect(html).toContain("This week");
    expect(html).toContain("runs reported");
  });
});

describe("OrbRing", () => {
  const ring = (percent = 77, size = 150) =>
    markup(<OrbRing size={size} percent={percent} value={7} caption="level" label="Level 7, 77% of the way to level 8" />);

  it("is one image with the full label", () => {
    render(<OrbRing size={150} percent={77} value={7} caption="level" label="Level 7, 77% of the way to level 8" />);
    expect(screen.getByRole("img", { name: "Level 7, 77% of the way to level 8" })).toBeTruthy();
  });

  it("is a conic arc of --lit over --ring-track, 9px thick, with the ring glow", () => {
    const html = ring();
    expect(html).toContain("conic-gradient(var(--lit) 0 77%, var(--ring-track) 77% 100%)");
    expect(html).toContain("padding:9px");
    expect(html).toContain("box-shadow:var(--ring-glow)");
    expect(html).toContain("width:150px;height:150px;border-radius:50%");
  });

  it.each([
    [0, "0 0%", "0% 100%"],
    [100, "0 100%", "100% 100%"],
    [-5, "0 0%", "0% 100%"],
    [140, "0 100%", "100% 100%"],
  ])("clamps %i%% into the arc", (percent, filled, rest) => {
    const html = ring(percent);
    expect(html).toContain(`var(--lit) ${filled}`);
    expect(html).toContain(`var(--ring-track) ${rest}`);
  });

  it("holds a glass disc, with no spinner, and keeps 12% of the size clear at the foot", () => {
    const html = ring();
    expect(html).toContain("background:var(--orb-glass)");
    expect(html).toContain("box-shadow:inset 0 0 0 1px var(--orb-glass-edge)");
    expect(html).toContain("gap:2px;padding-bottom:18px");
    expect(html).not.toContain("<svg");
  });

  it("sets the level in Sentient at 20% of the size, -0.03em, line-height 1, and a DM Mono 10px caption", () => {
    const html = ring();
    expect(html).toContain("font-size:30px");
    expect(html).toContain("letter-spacing:-0.03em");
    expect(html).toContain("line-height:1");
    expect(html).toContain("Sentient");
    expect(html).toContain("font-size:10px");
    expect(html).toContain("level");
    expect(markup(<OrbRing size={120} percent={50} value={3} label="x" />)).toContain("font-size:24px");
  });

  it("never sets Sentient under its 17px floor, however small the ring", () => {
    expect(() => markup(<OrbRing size={36} percent={50} value={3} label="x" />)).not.toThrow();
    expect(markup(<OrbRing size={36} percent={50} value={3} label="x" />)).toContain("font-size:17px");
  });

  it("holds an avatar in place of the figure, clipped to the disc", () => {
    const html = markup(
      <OrbRing size={36} percent={50} value={3} label="Level 3" thickness={3}>
        <span>face</span>
      </OrbRing>,
    );
    expect(html).toContain("face");
    expect(html).toContain("overflow:hidden");
    expect(html).toContain("padding:3px");
    expect(html).not.toContain("letter-spacing:-0.03em");
  });

  it("does not animate", () => {
    expect(ring()).not.toMatch(/animation|transition|transform/);
  });
});

describe("LevelRing, repainted onto the ring orb", () => {
  it("is the ring orb at the same footprint, labelled with the way to the next level", () => {
    const { container } = render(<LevelRing level={7} progressPct={77.4} size={80} />);
    expect(screen.getByRole("img", { name: "Level 7, 77% of the way to level 8" })).toBeTruthy();
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.style.width).toBe("80px");
    expect(outer.style.height).toBe("80px");
    expect(container.querySelector('[data-ui="orb-ring"]')).not.toBeNull();
  });

  it("shows the level, and the word 'level'", () => {
    render(<LevelRing level={12} progressPct={5} size={104} />);
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("level")).toBeTruthy();
  });

  it("clamps progress into 0 to 100", () => {
    render(<LevelRing level={2} progressPct={180} size={80} />);
    expect(screen.getByRole("img", { name: "Level 2, 100% of the way to level 3" })).toBeTruthy();
  });

  it("wraps an avatar, which replaces the figure", () => {
    render(
      <LevelRing level={4} progressPct={20} size={36}>
        <span>face</span>
      </LevelRing>,
    );
    expect(screen.getByText("face")).toBeTruthy();
    expect(screen.queryByText("level")).toBeNull();
  });

  it("thins the arc with the size and stops at the orb's 9px", () => {
    const thick = markup(<LevelRing level={1} progressPct={10} size={150} />);
    const thin = markup(<LevelRing level={1} progressPct={10} size={36} />);
    expect(thick).toContain("padding:9px");
    expect(thin).toContain("padding:3px");
  });
});
