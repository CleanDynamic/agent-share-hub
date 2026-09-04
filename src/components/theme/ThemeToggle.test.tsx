import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider, THEME_STORAGE_KEY } from "@/contexts/ThemeContext";
import { ThemeToggle } from "./ThemeToggle";

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

  it("shows a visible focus ring while focused, and drops it on blur", () => {
    renderToggle();
    const dusk = option("Dusk");
    expect(dusk.style.outline).toBe("none");

    act(() => dusk.focus());
    expect(dusk).toHaveFocus();
    expect(dusk.style.outline).toMatch(/2px solid var\(--/);
    expect(dusk.style.outlineOffset).toBe("2px");

    act(() => dusk.blur());
    expect(dusk.style.outline).toBe("none");
  });

  it("carries the ring along an arrow-key move", () => {
    renderToggle();
    act(() => option("Exhibition").focus());
    fireEvent.keyDown(group(), { key: "ArrowRight" });
    expect(option("Dusk")).toHaveFocus();
    expect(option("Dusk").style.outline).toMatch(/2px solid var\(--/);
  });

  it("takes every colour from a token, never a literal", () => {
    renderToggle();
    const colours = [group(), ...within(group()).getAllByRole("radio")].flatMap((element) => {
      const { background, color, borderColor, outline } = (element as HTMLElement).style;
      return [background, color, borderColor, outline];
    });
    for (const value of colours) {
      if (!value || value === "none" || value === "transparent") continue;
      expect(value, `${value} is not a var(--token)`).toMatch(/var\(--/);
    }
  });
});
