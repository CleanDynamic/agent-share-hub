// The surface ladder: one set of tones that means the same in Dusk and Noon. Raised surfaces (frame, surface, module,
// window) each take their own tone; recessed ones (inset, well, the well that sits on the page) step the other way.
// Selection is a border, so the selected fill is the card's own.

import { describe, expect, it } from "vitest";

import { resolveToken, type ThemeKey } from "./resolve";
import { TOKEN_NAMES } from "./semantics";
import { contrast, luminance, parse } from "./luminance";

const LADDER: Record<string, Record<ThemeKey, string>> = {
  frame: { dusk: "#040504", noon: "#E6EAE6" },
  surface: { dusk: "#121513", noon: "#FFFFFF" },
  module: { dusk: "#1B1F1C", noon: "#F1F3F1" },
  tile: { dusk: "#1B1F1C", noon: "#F1F3F1" },
  window: { dusk: "#1B1F1C", noon: "#FFFFFF" },
  well: { dusk: "#121513", noon: "#FFFFFF" },
  "well-on-page": { dusk: "#121513", noon: "#FFFFFF" },
  paper: { dusk: "#040504", noon: "#E6EAE6" },
  inset: { dusk: "#242925", noon: "#E7EBE7" },
  control: { dusk: "#242925", noon: "#E7EBE7" },
  notepad: { dusk: "#17231B", noon: "#EAF3EC" },
  "notepad-edge": { dusk: "#2C3E31", noon: "#BFD5C4" },
  "modal-foot": { dusk: "#161917", noon: "#EBEEEB" },
  "field-edge": { dusk: "#646B66", noon: "#879189" },
  "selected-edge": { dusk: "#9A9AA2", noon: "#6E6E73" },
};

describe("the surface ladder", () => {
  it("declares the tokens the ladder adds", () => {
    for (const name of ["well-on-page", "inset", "notepad", "notepad-edge", "modal-foot", "field-edge"]) {
      expect(TOKEN_NAMES).toContain(name);
    }
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

  // SY-01: Page, Panel, Card, Raised, Notepad, in order, each distinguishable from its neighbour. Light puts the modal
  // window on white so a modal reads above the grey page; it shares Panel's tone there and is not a ladder step.
  it.each(["dusk", "noon"] as const)("%s: the five layers are five tones, in order of lightness (dark) or a step each (light)", (theme) => {
    const layers = ["frame", "surface", "module", "control", "notepad"].map((name) => resolveToken(theme, name));
    expect(new Set(layers).size).toBe(5);
    const neighbours = layers.slice(1).map((tone, i) => contrast(layers[i], tone));
    for (const ratio of neighbours) expect(ratio).toBeGreaterThan(1);
  });

  it("dark steps up one shade per layer from Page to Raised", () => {
    const [page, panel, card, raised] = ["frame", "surface", "module", "control"].map((n) => luminance(resolveToken("dusk", n)));
    expect(page).toBeLessThan(panel);
    expect(panel).toBeLessThan(card);
    expect(card).toBeLessThan(raised);
  });

  it("the notepad is the only green-tinted surface", () => {
    const green = (hex: string) => {
      const [r, g, b] = parse(hex);
      return g - Math.max(r, b);
    };
    for (const theme of ["dusk", "noon"] as const) {
      const tinted = ["frame", "surface", "module", "control", "modal-foot", "notepad"].filter((n) => green(resolveToken(theme, n)) >= 5);
      expect(tinted).toEqual(["notepad"]);
    }
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

describe("borders between areas are retired (SY-01)", () => {
  it.each(["dusk", "noon"] as const)("%s: the area borders are transparent", (theme) => {
    for (const name of ["surface-border", "module-border", "tile-border", "well-border", "seg-border", "line"]) {
      expect(resolveToken(theme, name), name).toBe("transparent");
    }
  });

  it.each(["dusk", "noon"] as const)("%s: the leftover hairline is the Card tone, so it disappears into the next layer", (theme) => {
    for (const name of ["hairline", "hairline-module"]) expect(resolveToken(theme, name), name).toBe(resolveToken(theme, "module"));
  });

  it.each(["dusk", "noon"] as const)("%s: the field edge is the one edge left and clears 3:1 against the field fill", (theme) => {
    expect(contrast(resolveToken(theme, "field-edge"), resolveToken(theme, "well"))).toBeGreaterThanOrEqual(3);
  });
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
  it("a selected module keeps the unselected fill and takes the selected border", async () => {
    const { moduleStyle } = await import("@/pages/site/compose/refinedStyles");
    expect(moduleStyle(true).background).toBe(moduleStyle(false).background);
    expect(moduleStyle(true).border).toBe("1px solid var(--selected-edge)");
    expect(moduleStyle(false).border).not.toBe(moduleStyle(true).border);
    expect(moduleStyle(true).boxShadow).toBe(moduleStyle(false).boxShadow);
  });

  it("Synth 09: a selected tile keeps its fill and its border (free for a maker's colour) and takes the Mint ring outside a gap", async () => {
    const { tileStyle } = await import("@/pages/site/compose/tileRecipes");
    expect(tileStyle(true).background).toBe(tileStyle(false).background);
    expect(tileStyle(true).border).toBe(tileStyle(false).border);
    expect(tileStyle(true).boxShadow).toBe("0 0 0 2px var(--surface), 0 0 0 4px var(--brand-accent)");
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
