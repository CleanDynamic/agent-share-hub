// Prompt 6 step 7 (D5): tiles in the editor are whole pixels tall. Two lines inherited the page's 1.55 line height (21.7px at 14,
// 18.6px at 12): the hover-only "Send with the step above" in a tile's footer, and an inner card's number. Heights are measured in
// the browser; this holds the two styles.

import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { done, mountList, stubMedia } from "./ca21Harness";

beforeEach(stubMedia);
afterEach(done);

describe("whole-pixel tile heights", () => {
  it("stands the footer's nest control at the top of its line, so the inherited line height adds no fraction", () => {
    mountList();
    const controls = screen.getAllByTestId("nest-control");
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) expect(control.style.verticalAlign).toBe("top");
  });

  it("gives an inner card's number a whole-pixel line height (19px, for 12px text)", () => {
    mountList();
    const numbers = screen.queryAllByTestId("inner-card-number");
    expect(numbers.length).toBeGreaterThan(0);
    for (const number of numbers) expect(number.style.lineHeight).toBe("19px");
  });
});
