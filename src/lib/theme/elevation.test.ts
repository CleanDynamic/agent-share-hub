// BG-P04 — the elevation model.
//
// `css-parity.test.ts` proves the two theme blocks declare these shadows. What
// is proved here is the model: three levels and no fourth, a flat default that
// casts nothing, and — the claim the whole per-theme arrangement exists for —
// that Dusk's depth is not Exhibition's depth.

import { describe, expect, it } from "vitest";
import {
  ELEVATION_LEVELS,
  ELEVATION_TOKENS,
  SCRIM,
  duskElevation,
  elevation,
  elevationThemes,
  exhibitionElevation,
} from "./elevation";

describe("the elevation model", () => {
  it("is three levels, and no fourth", () => {
    expect(ELEVATION_LEVELS).toEqual(["flat", "raised", "overlay"]);
  });

  it("is flat by default: a hairline, and nothing cast", () => {
    expect(elevation.flat).toEqual({
      boxShadow: "none",
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: "var(--line)",
    });
  });

  it("spends tokens for the two levels that cast, so both follow the theme", () => {
    expect(elevation.raised.boxShadow).toBe("var(--elev-raised)");
    expect(elevation.overlay.boxShadow).toBe("var(--elev-overlay)");
  });

  it("keeps the scrim out of the overlay level", () => {
    // The scrim belongs to the page behind a dialog, not to the dialog. Folded
    // in, spreading `overlay` onto a backdrop would give it a shadow and no dim.
    expect(elevation.overlay).not.toHaveProperty("background");
    expect(SCRIM.background).toContain("var(--porthole)");
  });
});

describe("a shadow on a light ground is not a shadow on a dark ground", () => {
  it("overlay differs between the themes", () => {
    expect(duskElevation["elev-overlay"]).not.toBe(exhibitionElevation["elev-overlay"]);
  });

  it("raised differs too", () => {
    expect(duskElevation["elev-raised"]).not.toBe(exhibitionElevation["elev-raised"]);
  });

  it("Dusk carries a lit top hairline at every level that casts", () => {
    // The hairline is what reads as "above" on a dark ground; the shadow only
    // says how far. Remove it and Dusk's menus sit flat on the page.
    for (const token of ELEVATION_TOKENS) {
      expect(duskElevation[token], `dusk --${token} has no lit edge`).toContain(
        "inset 0 1px 0 var(--glass-hi)",
      );
    }
  });

  it("Exhibition carries no inset edge — its room does the lighting", () => {
    for (const token of ELEVATION_TOKENS) {
      expect(exhibitionElevation[token]).not.toContain("inset");
    }
  });

  it("Exhibition's shadows are struck from --text, not from black", () => {
    for (const token of ELEVATION_TOKENS) {
      expect(exhibitionElevation[token]).toContain("rgba(27,32,38,");
      expect(exhibitionElevation[token]).not.toContain("rgba(0,0,0,");
    }
  });

  it("overlay is deeper than raised in both themes", () => {
    const spread = (shadow: string) =>
      Math.max(...[...shadow.matchAll(/(\d+)px/g)].map((m) => Number(m[1])));
    for (const [name, theme] of Object.entries(elevationThemes)) {
      expect(
        spread(theme["elev-overlay"]),
        `${name} overlay does not travel further than raised`,
      ).toBeGreaterThan(spread(theme["elev-raised"]));
    }
  });

  it("names the same two tokens in both themes", () => {
    expect(Object.keys(exhibitionElevation).sort()).toEqual([...ELEVATION_TOKENS].sort());
    expect(Object.keys(duskElevation).sort()).toEqual([...ELEVATION_TOKENS].sort());
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
