// BG-P21 — the repointed legacy token module.
//
// The claims: every colour this module publishes is a `var(--token)` reference
// and not a hex, the nine category entries land on the nine category tokens,
// `hexToRgba` still tints a token rather than returning it at full strength,
// and the one blurred surface carries the theme's single blur value.
//
// This module is deprecated and eighty files still import it, which is exactly
// why it is worth a spec: a regression here repaints all eighty at once.

import { describe, expect, it } from "vitest";

import {
  CATEGORY_COLOUR,
  FONT_STACK,
  GAP_RED,
  HAIRLINE,
  ORANGE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  VOID,
  bodyText,
  cardGlass,
  hexToRgba,
  panelGlass,
} from "./tokens";
import { CATEGORIES, categoryColour } from "@/lib/theme/category";
import { GLASS_BLUR } from "@/lib/theme/controls";
import { FIGTREE } from "@/lib/theme/type";

const TOKEN = /^var\(--[a-z0-9-]+\)$/;

describe("every colour resolves through the theme", () => {
  const named = {
    VOID,
    ORANGE,
    TEAL,
    TEXT_PRIMARY,
    TEXT_SECONDARY,
    TEXT_MUTED,
    HAIRLINE,
    GAP_RED,
  };

  for (const [name, value] of Object.entries(named)) {
    it(`${name} is a token reference, not a hex`, () => {
      expect(value).toMatch(TOKEN);
    });
  }

  it("names the jobs the two-theme system names", () => {
    expect(VOID).toBe("var(--bg)");
    expect(ORANGE).toBe("var(--action)");
    expect(TEAL).toBe("var(--evidence)");
    expect(HAIRLINE).toBe("var(--line)");
    expect(GAP_RED).toBe("var(--cat-breakage)");
  });

  it("collapses the third text rung onto the second", () => {
    // The old third rung was 3.0:1 at best. Two legal rungs, not three.
    expect(TEXT_PRIMARY).toBe("var(--text)");
    expect(TEXT_SECONDARY).toBe("var(--text2)");
    expect(TEXT_MUTED).toBe(TEXT_SECONDARY);
  });

  it("points the body face at the one Figtree stack", () => {
    expect(FONT_STACK).toBe(FIGTREE);
  });
});

describe("the category map agrees with the resolver", () => {
  it("carries a token for every entry and no hex anywhere", () => {
    const values = Object.values(CATEGORY_COLOUR);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) expect(value).toMatch(TOKEN);
  });

  for (const category of CATEGORIES) {
    // `agents` is spelled `agent` in this legacy map; the resolver treats the
    // two as one, which is the thing being checked.
    const key = category === "agents" ? "agent" : category;
    it(`${category} matches categoryColour("${key}")`, () => {
      expect(CATEGORY_COLOUR[key]).toBe(categoryColour(key));
    });
  }

  it("paints a gap in the breakage hue rather than inventing a tenth", () => {
    expect(CATEGORY_COLOUR.gap).toBe(CATEGORY_COLOUR.breakage);
  });
});

describe("hexToRgba tints a token instead of returning it whole", () => {
  it("mixes a token reference down to the alpha asked for", () => {
    expect(hexToRgba(TEAL, 0.06)).toBe("color-mix(in srgb, var(--evidence) 6%, transparent)");
    expect(hexToRgba(GAP_RED, 0.35)).toBe(
      "color-mix(in srgb, var(--cat-breakage) 35%, transparent)",
    );
  });

  it("never hands back the hue at full strength", () => {
    // The failure the second branch exists to prevent: a 6% wash rendering as
    // a solid panel with unreadable text on it.
    expect(hexToRgba(ORANGE, 0.05)).not.toBe(ORANGE);
  });

  it("clamps an out-of-range alpha rather than emitting an illegal mix", () => {
    expect(hexToRgba(TEAL, 1.4)).toContain(" 100%,");
    expect(hexToRgba(TEAL, -0.2)).toContain(" 0%,");
  });

  it("still converts a stored hex, which node_types.colour holds", () => {
    expect(hexToRgba("#E8571A", 0.15)).toBe("rgba(232,87,26,0.15)");
    expect(hexToRgba("2EC4B6", 0.5)).toBe("rgba(46,196,182,0.5)");
  });

  it("returns anything else unchanged", () => {
    expect(hexToRgba("transparent", 0.5)).toBe("transparent");
  });
});

describe("the glass surfaces", () => {
  it("blurs the panel once, at the theme's only blur value", () => {
    expect(panelGlass.background).toBe("var(--glass)");
    expect(panelGlass.backdropFilter).toBe(GLASS_BLUR);
    expect(GLASS_BLUR).toBe("blur(16px) saturate(1.15)");
  });

  it("leaves the card unblurred, so glass never nests", () => {
    expect(cardGlass.background).toBe("var(--glass-2)");
    expect(cardGlass.backdropFilter).toBeUndefined();
    expect(cardGlass.borderRadius).toBe("var(--r-card)");
  });
});

describe("the type floors", () => {
  it("emits no weight under 400 below 18px", () => {
    expect(Number(bodyText.fontWeight)).toBeGreaterThanOrEqual(400);
    expect(Number(bodyText.fontSize)).toBeLessThan(18);
  });
});
