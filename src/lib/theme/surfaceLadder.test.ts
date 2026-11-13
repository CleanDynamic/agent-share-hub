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

describe("selection on the ladder (F3)", () => {
  it("SELECTED is the selected border alone: no fill of its own, no ring, no old edge colour", async () => {
    const { SELECTED } = await import("./refinedControl");
    expect(SELECTED).toEqual({ border: "1px solid var(--selected-edge)" });
  });
  it.each(["dusk", "noon"] as const)("%s: the selected ring carries the selected edge, not the old one", (theme) => {
    expect(resolveToken(theme, "selected-ring")).toBe("0 0 0 1px var(--selected-edge)");
  });
});

describe("selection on the composer's tiles (F3)", () => {
  it("a selected tile keeps the unselected fill and takes the selected border", async () => {
    const { tileStyle } = await import("@/pages/site/compose/tileRecipes");
    const { moduleStyle } = await import("@/pages/site/compose/refinedStyles");
    for (const recipe of [tileStyle, moduleStyle]) {
      expect(recipe(true).background).toBe(recipe(false).background);
      expect(recipe(true).border).toBe("1px solid var(--selected-edge)");
      expect(recipe(false).border).not.toBe(recipe(true).border);
      expect(recipe(true).boxShadow).toBe(recipe(false).boxShadow);
    }
  });
});

describe("one hover fill (F2)", () => {
  it("moves the resting fill four grey levels toward the text, or lays that step over a transparent rest", async () => {
    const { hoverFill, CONTROL_HOVER } = await import("./refinedControl");
    expect(hoverFill()).toBe("color-mix(in srgb, var(--text) 1.9%, transparent)");
    expect(hoverFill("transparent")).toBe(hoverFill());
    expect(hoverFill("var(--module)")).toBe("color-mix(in srgb, var(--text) 1.9%, var(--module))");
    expect(CONTROL_HOVER.background).toBe(hoverFill("var(--control)"));
  });

  it("no hover state in the edit area paints --control-on", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
    });
    const offenders = ["src/pages/site", "src/components/shell", "src/components/brand"].flatMap(walk).flatMap((file) =>
      readFileSync(file, "utf8").split("\n").flatMap((line, i) => (/hovered[^?]*\?\s*(\{\s*background(Color)?:\s*)?t\.controlOn/.test(line) ? [`${file}:${i + 1}`] : [])),
    );
    expect(offenders).toEqual([]);
  });
});

describe("overlays are windows (F4)", () => {
  it("the shared menu, popover, dialog and sheet surfaces are --window", async () => {
    const { menuPanelStyle, dialogPanelStyle, sheetPanelStyle } = await import("./controls");
    for (const style of [menuPanelStyle, dialogPanelStyle, sheetPanelStyle("right")]) expect(style.background).toBe("var(--window)");
    for (const style of [menuPanelStyle, dialogPanelStyle]) expect(style.borderColor).toBe("var(--window-border)");
  });

  it("no overlay in the edit area paints the card tone itself", async () => {
    const { readFileSync } = await import("node:fs");
    const OVERLAYS = [
      "src/pages/site/builds/BuildsFiltersDialog.tsx",
      "src/pages/site/builds/SetDialogs.tsx",
      "src/pages/site/compose/MadeWithLine.tsx",
      "src/pages/site/compose/SessionsPanel.tsx",
      "src/pages/site/compose/OpenRequestDialog.tsx",
      "src/pages/site/drafts/DraftsView.tsx",
      "src/pages/site/build/RunDialog.tsx",
      "src/pages/site/build/BuildView.tsx",
    ];
    for (const file of OVERLAYS) expect(readFileSync(file, "utf8"), file).not.toMatch(/background: t\.solid/);
  });
});
