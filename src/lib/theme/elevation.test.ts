// BG-P04 — the elevation model.
//
// `css-parity.test.ts` proves the two theme blocks declare these shadows. What
// is proved here is the model: three levels and no fourth, a flat default that
// casts nothing, and — the claim the whole per-theme arrangement exists for —
// that Dusk's depth is not Noon's depth.

import { describe, expect, it } from "vitest";
import {
  ELEVATION_LEVELS,
  elevationFill,
  surface,
  ELEVATION_TOKENS,
  SCRIM,
  duskElevation,
  elevation,
  noonElevation,
} from "./elevation";
import { declared, resolveToken as resolveRefined } from "./resolve";

describe("the elevation model", () => {
  it("is six levels, and no seventh (Synth 03)", () => {
    expect(ELEVATION_LEVELS).toEqual(["page", "panel", "card", "raised", "overlay", "notepad"]);
  });

  it("casts nothing at page, panel and card, and draws no border at any level", () => {
    for (const level of ["page", "panel", "card"] as const) expect(elevation[level]).toEqual({ boxShadow: "none" });
    for (const level of ELEVATION_LEVELS) {
      expect(elevation[level], level).not.toHaveProperty("border");
      expect(elevation[level], level).not.toHaveProperty("borderWidth");
    }
  });

  it("spends tokens for the three levels that can differ by theme", () => {
    expect(elevation.raised.boxShadow).toBe("var(--elev-raised)");
    expect(elevation.overlay.boxShadow).toBe("var(--elev-overlay)");
    expect(elevation.notepad.boxShadow).toBe("var(--elev-notepad)");
  });

  it("fills each level from the ladder: Page, Panel, Card, Raised, then the window and the notepad", () => {
    expect(elevationFill).toEqual({
      page: "var(--frame)",
      panel: "var(--surface)",
      card: "var(--module)",
      raised: "var(--control)",
      overlay: "var(--window)",
      notepad: "var(--notepad)",
    });
    expect(surface("card")).toEqual({ background: "var(--module)", boxShadow: "none" });
  });

  it("puts the notepad above the overlay: a deeper drop, on its own edge", () => {
    const drop = (value: string) => Math.max(...[...value.matchAll(/ (\d+)px (\d+)px/g)].map((m) => Number(m[2])));
    for (const theme of ["noon", "dusk"] as const) {
      expect(resolveRefined(theme, "elev-notepad")).toContain("0 0 0 1px var(--notepad-edge)");
      expect(drop(resolveRefined(theme, "elev-notepad"))).toBeGreaterThan(24);
    }
    expect(resolveRefined("dusk", "elev-notepad")).toContain("0 32px 80px rgba(0,0,0,.65)");
  });

  it("keeps the scrim out of the overlay level", () => {
    // The scrim belongs to the page behind a dialog, not to the dialog. Folded
    // in, spreading `overlay` onto a backdrop would give it a shadow and no dim.
    expect(elevation.overlay).not.toHaveProperty("background");
    expect(SCRIM.background).toContain("var(--porthole)");
  });
});

describe("a shadow on a light ground is not a shadow on a dark ground", () => {
  const shadow = (theme: "noon" | "dusk", token: (typeof ELEVATION_TOKENS)[number]) => resolveRefined(theme, token);

  it("overlay differs between the themes", () => {
    expect(shadow("dusk", "elev-overlay")).not.toBe(shadow("noon", "elev-overlay"));
  });

  it("raised is shade, not shadow, in both themes (SY-01)", () => {
    // The Synth draft raises a control by painting it a step lighter on the ladder, so its shadow is none.
    expect(shadow("dusk", "elev-raised")).toBe("none");
    expect(shadow("noon", "elev-raised")).toBe("none");
  });

  it("the overlay's ring and drop carry the depth a shade cannot", () => {
    expect(shadow("dusk", "elev-overlay")).toContain("0 0 0 1px");
    expect(shadow("noon", "elev-overlay")).toContain("0 0 0 1px");
  });

  it("overlay is deeper than raised in both themes", () => {
    const spread = (value: string) => Math.max(...[...value.matchAll(/(\d+)px/g)].map((m) => Number(m[1])));
    for (const theme of ["noon", "dusk"] as const) {
      expect(
        spread(shadow(theme, "elev-overlay")),
        `${theme} overlay does not travel further than raised`,
      ).toBeGreaterThan(spread(shadow(theme, "elev-raised")));
    }
  });

  it("names the same tokens in both themes", () => {
    expect(Object.keys(noonElevation).sort()).toEqual([...ELEVATION_TOKENS].sort());
    expect(Object.keys(duskElevation).sort()).toEqual([...ELEVATION_TOKENS].sort());
  });
});

describe("elevation (UI-P81)", () => {
  // UI-P79 set the refined values and `css-parity.test.ts` proves index.css says
  // what `elevation.ts` says. What is pinned here is the wiring: the levels spend
  // `--elev-raised` and `--elev-overlay` (asserted at the top of this file), and
  // those point at the control and window recipes, and a
  // card's resting `--shadow-card` at the module's.
  it.each(["noon", "dusk"] as const)("%s: raised is the control recipe, overlay the window recipe, a card's shadow the module's", (theme) => {
    expect(declared(theme, "elev-raised")).toBe("var(--control-shadow)");
    expect(declared(theme, "elev-overlay")).toBe("var(--window-shadow)");
    expect(declared(theme, "shadow-card")).toBe("var(--module-shadow)");
  });

  it.each(["noon", "dusk"] as const)("%s: both levels resolve to a real shadow, and overlay travels further than raised", (theme) => {
    const raised = resolveRefined(theme, "elev-raised");
    const overlay = resolveRefined(theme, "elev-overlay");
    expect(raised).toBe(resolveRefined(theme, "control-shadow"));
    expect(overlay).toBe(resolveRefined(theme, "window-shadow"));
    const spread = (shadow: string) => Math.max(...[...shadow.matchAll(/(\d+)px/g)].map((m) => Number(m[1])));
    expect(spread(overlay)).toBeGreaterThan(spread(raised));
  });
});

describe("a changing elevation is a pseudo-element, never an animated box-shadow", () => {
  it("ships no transition, so nothing can animate one of these by spreading it", () => {
    // box-shadow cannot be composited: animating it re-rasterises on every
    // frame, which is what turns a grid of hovering cards into a dropped-frame
    // scroll. The hover case belongs on a ::after whose OPACITY moves, and a
    // pseudo-element cannot be written as a style object — so these levels
    // deliberately carry no motion of their own.
    for (const level of ELEVATION_LEVELS) {
      expect(elevation[level]).not.toHaveProperty("transition");
      expect(elevation[level]).not.toHaveProperty("transitionProperty");
    }
  });
});
