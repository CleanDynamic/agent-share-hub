// BG-P05 — the legacy badge vocabulary, resolved into the nine.
//
// `LEGACY_BADGE_CATEGORY` is the decision: each legacy content-type label, and
// which of the nine part categories it means. `TYPE_COLORS` is that decision
// rendered as the Tailwind classes a badge wears, written out literally because
// Tailwind generates a utility only for a class string it can find by scanning
// the source.
//
// Two tables that must agree, so this asserts that they do. A label given a new
// category in the first and not the second would otherwise ship as a badge in
// the old hue with a comment claiming otherwise.

import { describe, expect, it } from "vitest";
import {
  DIFFICULTIES,
  DIFFICULTY_COLORS,
  DIFFICULTY_LABEL_CLASS,
  LEGACY_BADGE_CATEGORY,
  TYPE_COLORS,
  TYPE_COLOR_FALLBACK,
} from "./content-types";
import { CATEGORIES, categoryFill, normaliseCategory } from "./theme/category";

/**
 * The three tokens a `TYPE_COLORS` class string spends, as [background, text,
 * border].
 *
 * The class strings are READ here rather than rebuilt. Tailwind finds candidates
 * by scanning source TEXT — comments included — so a template literal that
 * interpolates a token name into a utility would have Tailwind emit a rule whose
 * declaration still contains the interpolation, which is not valid CSS and fails
 * the production build with a lightningcss parse error. Nothing in this file is
 * shaped like a utility, deliberately.
 */
function tokensOf(classes: string): string[] {
  return [...classes.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]);
}

/** The three tokens a badge in this category should be spending. */
function expectedTokens(category: string): string[] {
  const fill = categoryFill(category);
  const bg = tokensOf(fill.background)[0];
  const fg = tokensOf(fill.color)[0];
  return [bg, fg, fg];
}

/** Which utility each token sits in, so a swapped pair fails rather than passes. */
function utilitiesOf(classes: string): string[] {
  return classes.split(/\s+/).map((c) => c.slice(0, c.indexOf("-")));
}

describe("the legacy badge mapping table", () => {
  it("maps every legacy label to one of the nine", () => {
    for (const [label, category] of Object.entries(LEGACY_BADGE_CATEGORY)) {
      expect(
        normaliseCategory(category),
        `"${label}" maps to "${category}", which is not one of the nine`,
      ).toBe(category);
    }
  });

  it("renders each label in the category the table gives it", () => {
    for (const [label, category] of Object.entries(LEGACY_BADGE_CATEGORY)) {
      const classes = TYPE_COLORS[label];
      expect(tokensOf(classes), `TYPE_COLORS["${label}"] is not its mapped category`).toEqual(
        expectedTokens(category),
      );
      expect(utilitiesOf(classes), `TYPE_COLORS["${label}"] spends its tokens in the wrong places`)
        .toEqual(["bg", "text", "border"]);
    }
  });

  it("covers exactly the labels TYPE_COLORS carries, and no more", () => {
    expect(Object.keys(TYPE_COLORS).sort()).toEqual(Object.keys(LEGACY_BADGE_CATEGORY).sort());
  });

  it("records the mapping, so changing a label's meaning has to be deliberate", () => {
    expect(LEGACY_BADGE_CATEGORY).toEqual({
      "Prompt File": "instruction",
      "Agent Blueprint": "agents",
      "AI Agent Install Guide": "configuration",
      "Model Config Guide": "configuration",
      "Integration Guide": "configuration",
      "Workflow Template": "configuration",
      "Evaluation Framework": "evidence",
      "Agent Stack": "configuration",
      "AI Tools (LLMs)": "configuration",
      "Failure Library": "breakage",
      Blog: "narrative",
      "Open Question": "breakage",
      Challenge: "instruction",
    });
  });

  it("names no hue outside the nine, and invents no tenth", () => {
    const used = new Set(Object.values(LEGACY_BADGE_CATEGORY));
    for (const category of used) expect(CATEGORIES).toContain(category);
    // Three of the nine describe parts of a build rather than kinds of writing
    // about one, so nothing in the legacy vocabulary lands on them. Recorded
    // rather than asserted away: it is the shape of the mismatch.
    expect([...CATEGORIES].filter((c) => !used.has(c)).sort()).toEqual([
      "artefact",
      "data",
      "media",
    ]);
  });

  it("an unmapped content type is the fallback, not an invented hue", () => {
    expect(TYPE_COLORS["Sculpture"]).toBeUndefined();
    expect(tokensOf(TYPE_COLOR_FALLBACK)).toEqual(expectedTokens(""));
    expect(tokensOf(TYPE_COLOR_FALLBACK)).toEqual([
      "--cat-fallback-fill",
      "--cat-fallback",
      "--cat-fallback",
    ]);
  });
});

describe("difficulty carries no colour", () => {
  it("every level is the same uncoloured mono label", () => {
    for (const level of DIFFICULTIES) {
      expect(DIFFICULTY_COLORS[level]).toEqual({
        color: "var(--text2)",
        bg: "transparent",
        border: "transparent",
      });
    }
  });

  it("the label class is mono, --text2, and carries no fill or border", () => {
    expect(DIFFICULTY_LABEL_CLASS).toContain("text-[var(--text2)]");
    expect(DIFFICULTY_LABEL_CLASS).toContain("bg-transparent");
    expect(DIFFICULTY_LABEL_CLASS).toContain("border-transparent");
    expect(DIFFICULTY_LABEL_CLASS).toMatch(/font-family:'DM_Mono'/);
  });

  it("names no category hue — difficulty is not a part category", () => {
    for (const category of CATEGORIES) {
      expect(DIFFICULTY_LABEL_CLASS).not.toContain(`--cat-${category}`);
    }
  });
});
