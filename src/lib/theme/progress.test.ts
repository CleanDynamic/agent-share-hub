// BG-P28b — the progress colour ladder.
//
// The module's comment block argues the decision; what is proved here is that
// the decision holds in the values it hands out. Three assertions carry the
// weight, and all three are the kind that a later mechanical recolour would
// silently break:
//
//   1. amber is never a text colour — the rule that exists because `--lit`
//      measures 3.01:1 on the Exhibition ground;
//   2. the ladder has exactly three rungs, and the top one is scarce;
//   3. the glow is Dusk-only, because a glow on a light ground is a sticker.

import { describe, expect, it } from "vitest";
import {
  LEGAL_PROGRESS_TEXT_TOKENS,
  PROGRESS_TIERS,
  legacyTier,
  levelLamp,
  lockedFill,
  progressFill,
  progressGlow,
  progressTrack,
  tierFill,
  xpText,
  type ProgressTier,
} from "./progress";

const LIT = "var(--lit)";

describe("the ladder", () => {
  it("has exactly three rungs", () => {
    expect(PROGRESS_TIERS).toEqual(["common", "rare", "highest"]);
  });

  it("spends the light on the top rung only", () => {
    const lit = PROGRESS_TIERS.filter((tier) => tierFill(tier).background === LIT);
    expect(lit).toEqual(["highest"]);
  });

  it("pairs the amber fill with its measured label colour, never with itself", () => {
    const highest = tierFill("highest");
    expect(highest.background).toBe(LIT);
    expect(highest.color).toBe("var(--on-lit)");
    expect(highest.color).not.toBe(highest.background);
  });

  it("climbs: transparent, then a ground, then the light", () => {
    expect(tierFill("common").background).toBe("transparent");
    expect(tierFill("rare").background).toBe("var(--recess)");
    expect(tierFill("highest").background).toBe(LIT);
  });

  it("holds the border width flat across the rungs, so a state change moves nothing", () => {
    const widths = PROGRESS_TIERS.map((tier) => tierFill(tier).borderWidth);
    expect(new Set(widths)).toEqual(new Set([1]));
    expect(lockedFill().borderWidth).toBe(1);
  });
});

describe("amber is light, never type", () => {
  it("never returns --lit as a text colour", () => {
    const colours = [
      ...PROGRESS_TIERS.map((tier) => tierFill(tier).color),
      lockedFill().color,
      xpText("primary").color,
      xpText("secondary").color,
      xpText("onLit").color,
    ];
    expect(colours).not.toContain(LIT);
  });

  it("only ever sets XP in a token the rule allows", () => {
    for (const emphasis of ["primary", "secondary", "onLit"] as const) {
      const colour = String(xpText(emphasis).color);
      const name = colour.replace(/^var\(|\)$/g, "");
      expect(LEGAL_PROGRESS_TEXT_TOKENS).toContain(name as never);
    }
  });

  it("does not list --lit among the legal text tokens", () => {
    expect(LEGAL_PROGRESS_TEXT_TOKENS).not.toContain("--lit" as never);
  });

  it("sets XP as data: mono, with tabular numerals", () => {
    const xp = xpText();
    expect(xp.fontVariantNumeric).toBe("tabular-nums");
    expect(String(xp.fontFamily)).toContain("DM Mono");
  });
});

describe("the lamp and the bar", () => {
  it("makes the lamp a filled circular mark rather than a border", () => {
    const lamp = levelLamp();
    expect(lamp.background).toBe(LIT);
    expect(lamp.borderRadius).toBe("var(--r-full)");
    expect(lamp.borderWidth).toBeUndefined();
  });

  it("dims the stale lamp rather than recolouring it", () => {
    expect(levelLamp({ dim: true }).opacity).toBe(0.45);
    expect(levelLamp({ dim: true }).background).toBe(levelLamp().background);
  });

  it("puts the light in the bar and a hairline in its groove", () => {
    expect(progressFill().background).toBe(LIT);
    expect(progressTrack().background).toBe("var(--line)");
  });
});

describe("the glow needs darkness to glow against", () => {
  it("is absent on Exhibition", () => {
    expect(progressGlow("exhibition")).toBeUndefined();
  });

  it("is a low-alpha amber radial on Dusk", () => {
    const glow = progressGlow("dusk");
    expect(glow).toBeDefined();
    expect(String(glow!.background)).toContain("radial-gradient");
    expect(String(glow!.background)).toContain("--lit");
  });
});

describe("the four legacy tiers collapse onto three rungs", () => {
  it("maps each name to a rung", () => {
    expect(legacyTier("bronze")).toBe<ProgressTier>("common");
    expect(legacyTier("silver")).toBe<ProgressTier>("rare");
    expect(legacyTier("gold")).toBe<ProgressTier>("rare");
    expect(legacyTier("platinum")).toBe<ProgressTier>("highest");
  });

  it("keeps the top rung scarce — one of the four, not two", () => {
    const tiers = ["bronze", "silver", "gold", "platinum"] as const;
    const highest = tiers.filter((tier) => legacyTier(tier) === "highest");
    expect(highest).toEqual(["platinum"]);
  });

  it("falls to the bottom rung for an absent or unknown tier", () => {
    expect(legacyTier(null)).toBe<ProgressTier>("common");
    expect(legacyTier(undefined)).toBe<ProgressTier>("common");
    expect(legacyTier("mythic")).toBe<ProgressTier>("common");
  });
});
