// BF-05 · marks, type and targets on the Builds pages.
//
// G1: a mark a reader must see to understand or use a control reaches 3:1 (WCAG 1.4.11). `--line` is a hairline
// colour (1.4:1) and is kept for decoration only. G2: no view sets type under 12px, except the Map's own drawing.
// The scans read each non-test .tsx file of this folder as text; a failure names the file and the line.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { contrast } from "@/lib/theme/luminance";
import { dusk, noon } from "@/lib/theme/semantics";

const DIR = path.resolve(__dirname);
const FILES = fs
  .readdirSync(DIR)
  .filter((name) => name.endsWith(".tsx") && !name.includes(".test."))
  .sort();

/** Source lines with comments blanked (line breaks kept) so a comment is not a use. */
function lines(file: string): string[] {
  const source = fs.readFileSync(path.join(DIR, file), "utf8");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .split("\n")
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"));
}

/** Every place `pattern` matches, as `file:line`, minus the lines an allow list excuses (matched by a fragment of the line). */
function uses(pattern: RegExp, allowed: readonly { file: string; has: string; why: string }[]): string[] {
  const found: string[] = [];
  for (const file of FILES) {
    lines(file).forEach((line, index) => {
      if (!pattern.test(line)) return;
      if (allowed.some((a) => a.file === file && line.includes(a.has))) return;
      found.push(`${file}:${index + 1}  ${line.trim().slice(0, 110)}`);
    });
  }
  return found;
}

describe("G1: marks a reader must see reach 3:1", () => {
  const themes = { noon, dusk } as const;

  it("--label reaches 3:1 on --surface and --module in both themes", () => {
    for (const [name, theme] of Object.entries(themes)) {
      for (const ground of ["surface", "module"] as const) {
        expect(contrast(theme.label, theme[ground]), `${name} --label on --${ground}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("--selected-edge reaches 3:1 on --well and --control in both themes", () => {
    for (const [name, theme] of Object.entries(themes)) {
      for (const ground of ["well", "control"] as const) {
        expect(contrast(theme["selected-edge"], theme[ground]), `${name} --selected-edge on --${ground}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  // Hairline-like decoration only. A mark a reader must see to understand or use a control is `--label` or `--selected-edge`.
  const LINE_ALLOWED = [
    { file: "BuildsTableView.tsx", has: "value === 0 ? t.line", why: "an empty week is a tick on a baseline; the chart has a text summary and BF-01 shows a dash when every week is empty" },
    { file: "BuildsFiltersView.tsx", has: "state.focusVisible ? t.line : \"transparent\"", why: "the resize handle's rule, drawn only while focused; the focus ring is the mark" },
    { file: "BuildsFiltersView.tsx", has: "color: t.line, cursor: \"grab\"", why: "the grip; BF-07 deletes it (BF-15 checks it is gone)" },
    { file: "BuildsFiltersView.tsx", has: "on ? t.text : t.line", why: "the Autonomy segment; BF-09 deletes it (BF-15 checks it is gone)" },
    { file: "BuildsMapsView.tsx", has: "stroke={t.line}", why: "the Map's own drawing, which BF-05 does not change" },
  ] as const;

  it("no Builds file paints a meaningful mark in --line", () => {
    expect(uses(/\bt\.line\b/, LINE_ALLOWED), "t.line used outside the allow list").toEqual([]);
  });
});

describe("G2: no text under 12px on Builds", () => {
  // The Map is drawn in the well's own 400 by 220 units; its box and part labels are part of the drawing.
  const SMALL_ALLOWED = [
    { file: "BuildsMapsView.tsx", has: "fontSize: 10, letterSpacing", why: "a part label, in the Map's drawing" },
    { file: "BuildsMapsView.tsx", has: "fontSize: 11, fontWeight: 500", why: "a box label, in the Map's drawing" },
    { file: "BuildsMapsView.tsx", has: "fontSize: 10, lineHeight", why: "a box's meta line, in the Map's drawing" },
  ] as const;

  it("no Builds view sets type under 12px outside the Map's drawing", () => {
    const small = /\btext\(\s*(?:[0-9]|1[01])(?:\.\d+)?\s*,|\bfontSize:\s*['"]?(?:[0-9]|1[01])(?:\.\d+)?\b/;
    expect(uses(small, SMALL_ALLOWED), "type under 12px outside the Map's drawing").toEqual([]);
  });
});
