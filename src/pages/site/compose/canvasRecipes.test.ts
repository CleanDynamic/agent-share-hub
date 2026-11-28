import { describe, expect, it } from "vitest";

import { MAP_FILLS } from "@/lib/build/mapLayout";
import { contrast, over, parse } from "@/lib/theme/luminance";
import { resolveToken } from "@/lib/theme/resolve";

import { BOX_EXPLANATION, BOX_TITLE, CANVAS_BACKGROUNDS, backgroundOf, canvasScope, fillFor, inkFor, type CanvasBackground } from "./canvasRecipes";

const PRESETS = Object.keys(CANVAS_BACKGROUNDS) as CanvasBackground[];
/** A token's value in the ink's theme, on a ground: composited first when it is translucent. */
const inkOn = (background: string, token: string, ground: string) => {
  const value = resolveToken(inkFor(background).theme, token);
  return parse(value)[3] === 1 ? value : over(value, ground);
};
const tokenOf = (reference: string) => (/^var\(--([a-z0-9-]+)\)$/.exec(reference) as RegExpExecArray)[1];

describe("canvas paint", () => {
  it("presets map to the README's colours; a custom colour is kept; anything else is grey", () => {
    expect(backgroundOf("dusk")).toBe("#141416");
    expect(backgroundOf("#aabbcc")).toBe("#AABBCC");
    expect(backgroundOf("purple")).toBe(CANVAS_BACKGROUNDS.grey);
  });

  it("light ink on the dark presets, dark ink on paper", () => {
    expect(PRESETS.map((preset) => inkFor(preset).theme)).toEqual(["dusk", "dusk", "dusk", "noon"]);
    expect(inkFor("#F0F0F0").theme).toBe("noon");
  });

  it("the canvas re-declares every token from its ink's theme", () => {
    const scope = canvasScope("paper") as Record<string, string>;
    expect(scope["--text"]).toBe(resolveToken("noon", "text"));
    expect(scope.background).toBe(CANVAS_BACKGROUNDS.paper);
    expect((canvasScope("grey") as Record<string, string>)["--text"]).toBe(resolveToken("dusk", "text"));
  });

  it.each(PRESETS)("every fill on %s: tile text 4.5:1, box titles 3:1", (preset) => {
    const ink = inkFor(preset);
    for (const fill of MAP_FILLS) {
      const box = fillFor(fill, preset);
      const text = inkOn(preset, tokenOf(ink.text), box);
      const explanation = inkOn(preset, tokenOf(BOX_EXPLANATION.color as string), box);
      const title = inkOn(preset, tokenOf(BOX_TITLE.color as string), box);
      expect(contrast(text, box), `${fill} text on ${preset}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(explanation, box), `${fill} explanation on ${preset}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(title, box), `${fill} title on ${preset}`).toBeGreaterThanOrEqual(3);
      // The List's tile card sits on the box: its text reads on the card, the card's edge is the theme's own.
      const card = inkOn(preset, "module", box);
      expect(contrast(inkOn(preset, "text", card), card)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
