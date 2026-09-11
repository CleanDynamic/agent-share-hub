import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider, THEME_STORAGE_KEY } from "@/contexts/ThemeContext";
import { ThemeToggle } from "./ThemeToggle";
import { focusRing } from "@/lib/theme/focus";
import { themeToggleSegmentStyle } from "@/lib/theme/controls";

/* ────────────────────────────────────────────────
   ThemeToggle — the control, not the styling. BG-P07 owns how it looks; these
   cover what a radio group owes a keyboard and a screen reader.
──────────────────────────────────────────────── */

const renderToggle = () =>
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );

const group = () => screen.getByRole("radiogroup", { name: "Theme" });
const option = (name: string) => within(group()).getByRole("radio", { name });
const checked = () => within(group()).getByRole("radio", { checked: true }).textContent;

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("ThemeToggle", () => {
  it("is a labelled radio group of the three themes", () => {
    renderToggle();
    expect(within(group()).getAllByRole("radio").map((r) => r.textContent))
      .toEqual(["Exhibition", "Dusk", "System"]);
  });

  it("checks the current theme and only the current theme", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dusk");
    renderToggle();
    expect(checked()).toBe("Dusk");
    expect(within(group()).getAllByRole("radio", { checked: false })).toHaveLength(2);
  });

  it("switches the theme, and the root element with it", () => {
    renderToggle();
    fireEvent.click(option("Dusk"));
    expect(checked()).toBe("Dusk");
    expect(document.documentElement.dataset.theme).toBe("dusk");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dusk");
  });

  it("is one tab stop, with the checked option carrying it", () => {
    renderToggle();
    expect(option("Exhibition").tabIndex).toBe(0);
    expect(option("Dusk").tabIndex).toBe(-1);
    expect(option("System").tabIndex).toBe(-1);

    fireEvent.click(option("System"));
    expect(option("System").tabIndex).toBe(0);
    expect(option("Exhibition").tabIndex).toBe(-1);
  });

  it("moves the selection with the arrow keys, and wraps", () => {
    renderToggle();
    fireEvent.keyDown(group(), { key: "ArrowRight" });
    expect(checked()).toBe("Dusk");
    fireEvent.keyDown(group(), { key: "ArrowDown" });
    expect(checked()).toBe("System");
    fireEvent.keyDown(group(), { key: "ArrowRight" });
    expect(checked()).toBe("Exhibition");
    fireEvent.keyDown(group(), { key: "ArrowLeft" });
    expect(checked()).toBe("System");
  });

  /* BG-P07 moved this control onto the shared ring from src/lib/theme/focus.ts,
     which is written as LONGHANDS — outlineWidth/Style/Color/Offset — rather
     than as an `outline` shorthand, so these assertions changed shape.

     WHAT JSDOM CANNOT SEE, AND WHY THE COLOUR IS CHECKED SEPARATELY. jsdom's
     cssstyle validates colour values and does not recognise `var()` as one, so
     `outline-color: var(--lit)` is DROPPED on assignment and reads back as ""
     no matter what the component set. Verified by probe, not assumed: width,
     style and offset all survive; only the colour is lost. That is a limitation
     of the test environment and not a defect in the ring — a browser resolves
     it fine.

     So the geometry is asserted against the rendered element, where it is real,
     and the colour is asserted against focusRing itself in the test below. An
     assertion on the rendered outlineColor could only ever compare "" to "",
     which would pass whether or not the ring existed. */
  const GEOMETRY = ["outlineWidth", "outlineStyle", "outlineOffset"] as const;

  const ringOf = (element: HTMLElement) =>
    Object.fromEntries(GEOMETRY.map((property) => [property, element.style[property]]));

  const RING = Object.fromEntries(GEOMETRY.map((property) => [property, focusRing[property]]));
  const NO_RING = Object.fromEntries(GEOMETRY.map((property) => [property, ""]));

  it("shows a visible focus ring while focused, and drops it on blur", () => {
    renderToggle();
    const dusk = option("Dusk");
    expect(ringOf(dusk)).toEqual(NO_RING);

    act(() => dusk.focus());
    expect(dusk).toHaveFocus();
    expect(ringOf(dusk)).toEqual(RING);

    act(() => dusk.blur());
    expect(ringOf(dusk)).toEqual(NO_RING);
  });

  it("carries the ring along an arrow-key move", () => {
    renderToggle();
    act(() => option("Exhibition").focus());
    fireEvent.keyDown(group(), { key: "ArrowRight" });
    expect(option("Dusk")).toHaveFocus();
    expect(ringOf(option("Dusk"))).toEqual(RING);
  });

  it("uses the ONE shared ring, not a second definition of its own", () => {
    // BG-P02 gave this control a --text ring of its own because --lit measures
    // 1.80:1 on Exhibition's ground. focus.ts resolved that: the 2px offset
    // leaves a band of --bg under the ring, so it is read against two edges
    // rather than against the ground alone. One ring, everywhere.
    //
    // Asserted against the SOURCE the component spends rather than against the
    // rendered node, because jsdom drops the var() colour (see above). What the
    // rendered assertions above prove is that the ring is applied at all and
    // removed on blur; what this proves is that the ring it applies is the
    // shared one. Neither claim is checkable from the other.
    expect(themeToggleSegmentStyle({ focusVisible: true }).outlineColor).toBe(focusRing.outlineColor);
    expect(themeToggleSegmentStyle({ focusVisible: false }).outlineColor).toBeUndefined();
  });

  it("takes every colour from a token, never a literal", () => {
    renderToggle();
    const colours = [group(), ...within(group()).getAllByRole("radio")].flatMap((element) => {
      const { background, color, borderColor, outlineColor } = (element as HTMLElement).style;
      return [background, color, borderColor, outlineColor];
    });
    for (const value of colours) {
      if (!value || value === "none" || value === "transparent") continue;
      expect(value, `${value} is not a var(--token)`).toMatch(/var\(--/);
    }
  });
});
