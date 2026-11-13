// The surface ladder: one set of tones that means the same in Dusk and Noon. Raised surfaces (frame, surface, module,
// window) each take their own tone; recessed ones (inset, well, the well that sits on the page) step the other way.
// Selection is a border, so the selected fill is the card's own.

import { describe, expect, it } from "vitest";

import { resolveToken, type ThemeKey } from "./resolve";
import { TOKEN_NAMES } from "./semantics";

const LADDER: Record<string, Record<ThemeKey, string>> = {
  frame: { dusk: "#0F0F10", noon: "#E4E4E4" },
  surface: { dusk: "#18181A", noon: "#EFEFEF" },
  // Noon's module stays #FAFAFA: the reference's #F7F7F7 drops four category hues under their pinned ratios in
  // contrast.test.ts (cat-artefact 3.87 against a 3.97 floor).
  module: { dusk: "#202023", noon: "#FAFAFA" },
  window: { dusk: "#28282C", noon: "#FFFFFF" },
  well: { dusk: "#131315", noon: "#E8E8E8" },
  "well-on-page": { dusk: "#0A0A0B", noon: "#DBDBDB" },
  inset: { dusk: "#1B1B1D", noon: "#F1F1F1" },
  control: { dusk: "#323237", noon: "#FFFFFF" },
  "selected-edge": { dusk: "#9A9AA2", noon: "#6E6E73" },
};

describe("the surface ladder", () => {
  it("declares the two tokens the ladder adds", () => {
    expect(TOKEN_NAMES).toContain("well-on-page");
    expect(TOKEN_NAMES).toContain("inset");
  });

  it.each(Object.entries(LADDER).flatMap(([name, v]) => (["dusk", "noon"] as const).map((theme) => ({ name, theme, want: v[theme] }))))(
    "$theme --$name is $want",
    ({ name, theme, want }) => {
      expect(resolveToken(theme, name)).toBe(want);
    },
  );

  it.each(["dusk", "noon"] as const)("%s: control-on is control and the selected fill is the card's", (theme) => {
    expect(resolveToken(theme, "control-on")).toBe(resolveToken(theme, "control"));
    expect(resolveToken(theme, "selected-fill")).toBe(resolveToken(theme, "module"));
  });

  it.each(["dusk", "noon"] as const)("%s: no two raised levels share a tone", (theme) => {
    const raised = ["frame", "surface", "module", "window"].map((name) => resolveToken(theme, name));
    expect(new Set(raised).size).toBe(4);
  });
});

describe("the ladder's role changes", () => {
  it.each(["dusk", "noon"] as const)("%s: an avatar's fill is the inset", (theme) => {
    expect(resolveToken(theme, "avatar-fill")).toBe(resolveToken(theme, "inset"));
  });

  it.each(["dusk", "noon"] as const)("%s: a status chip's fill is the inset", (theme) => {
    expect(resolveToken(theme, "pill")).toBe(resolveToken(theme, "inset"));
  });
});

describe("the ladder's three border greys", () => {
  const ROLES: Record<string, { tokens: string[]; dusk: string; noon: string }> = {
    divider: { tokens: ["hairline", "hairline-module"], dusk: "#26262A", noon: "#E2E2E2" },
    edge: { tokens: ["surface-border", "module-border", "tile-border", "well-border", "seg-border", "line"], dusk: "#303035", noon: "#D6D6D6" },
    "control edge": { tokens: ["control-border", "window-border", "seg-on-border"], dusk: "#404046", noon: "#C8C8C8" },
  };
  it.each(Object.entries(ROLES).flatMap(([role, v]) => (["dusk", "noon"] as const).flatMap((theme) => v.tokens.map((name) => ({ role, theme, name, want: v[theme] })))))(
    "$theme --$name is the $role, $want",
    ({ theme, name, want }) => {
      expect(resolveToken(theme, name)).toBe(want);
    },
  );
});

describe("hover on the ladder", () => {
  it("steps a hovered control's fill toward the text, since --control-on is --control", async () => {
    const { controlPaint } = await import("./refinedControl");
    expect(controlPaint({ hovered: true }).background).not.toBe(controlPaint({}).background);
    expect(controlPaint({ hovered: true }).background).toBe("color-mix(in srgb, var(--text) 1.9%, var(--control))");
  });
});
