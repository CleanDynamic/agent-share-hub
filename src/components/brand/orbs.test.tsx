// UI-P10 — the three orbs, and the level ring repainted onto the ring orb.
//
// Styles are asserted through SSR markup (jsdom's cssstyle drops var() values
// and multi-layer gradients); roles and structure on the rendered tree.

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LevelRing from "@/components/profile-game/LevelRing";

import { OrbRing } from "./OrbRing";

const markup = (node: React.ReactElement) => renderToStaticMarkup(node);

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
    // UI-P52 density pass: the arc's 9px is padding, so it goes 9 → 6; the 150px orb is over the band.
    expect(html).toContain("padding:6px");
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
    // UI-P52 density pass: 12% of 150 is 18, which renders at 13.
    expect(html).toContain("gap:2px;padding-bottom:13px");
    expect(html).not.toContain("<svg");
  });

  it("sets the level in Sentient at 20% of the size, -0.03em, line-height 1, and a DM Mono 10px caption", () => {
    // UI-P52 density pass: the figure is drawn at 20% of the size and display()
    // renders it through the table — 30 → 22 here, 24 → 20 at 120.
    const html = ring();
    expect(html).toContain("font-size:22px");
    expect(html).toContain("letter-spacing:-0.03em");
    expect(html).toContain("line-height:1");
    expect(html).toContain("Geist");
    expect(html).toContain("font-size:10px");
    expect(html).toContain("level");
    expect(markup(<OrbRing size={120} percent={50} value={3} label="x" />)).toContain("font-size:20px");
  });

  it("never sets Sentient under its floor, however small the ring", () => {
    // UI-P52 density pass: the figure is never drawn under 17px, which display()
    // renders at 16 — under Sentient's 20px floor, so in Figtree 600.
    expect(() => markup(<OrbRing size={36} percent={50} value={3} label="x" />)).not.toThrow();
    const html = markup(<OrbRing size={36} percent={50} value={3} label="x" />);
    expect(html).toContain("font-size:16px;font-weight:600");
    expect(html).not.toContain("Sentient");
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

  it("thins the arc with the size and stops at the orb's 9px, drawn", () => {
    const thick = markup(<LevelRing level={1} progressPct={10} size={150} />);
    const thin = markup(<LevelRing level={1} progressPct={10} size={36} />);
    // UI-P52 density pass: the drawn 9px renders at 6; the 3px is under the table's floor.
    expect(thick).toContain("padding:6px");
    expect(thin).toContain("padding:3px");
  });
});
