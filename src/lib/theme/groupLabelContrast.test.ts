// CA-19 P8: every group label's name keeps 4.5:1 on the label's own fill (`--hairline` over the surface), in both themes,
// through nameColourFor. The fixture's colours, the six suggestions and the greys at either end of the wheel's reach.

import { describe, expect, it } from "vitest";

import { REFS_COLOURS } from "@/dev/fixtures/references";

import { contrast } from "./luminance";
import { groundOn, nameColourFor, NAME_TEXT_FLOOR, SUGGESTED_COLOURS } from "./partColour";

const COLOURS = [...new Set([...SUGGESTED_COLOURS, ...Object.values(REFS_COLOURS), "#5A5A5A", "#E0E0E0", "#2E6B3A", "#F2E3A0"])];

describe.each(["noon", "dusk"] as const)("a group label in %s", (theme) => {
  it.each(COLOURS)("%s reads at 4.5:1 or better on --hairline", (hex) => {
    expect(contrast(nameColourFor(hex, theme, "hairline"), groundOn(theme, "hairline"))).toBeGreaterThanOrEqual(NAME_TEXT_FLOOR);
  });
});

it("measures a name on the surface as before when no fill is named", () => {
  for (const hex of SUGGESTED_COLOURS) expect(nameColourFor(hex, "noon")).toBe(nameColourFor(hex, "noon", undefined));
});
