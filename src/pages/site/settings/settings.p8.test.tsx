// UX-15 P8: Appearance. The row's control and every other theme control are one choice, through ThemeContext, stored under bg-theme.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ThemeProvider, THEME_STORAGE_KEY } from "@/contexts/ThemeContext";
import { ThemeSegmented } from "@/components/theme/ThemeSegmented";

import { AppearanceView } from "./AppearanceView";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});
afterEach(cleanup);

const pressed = (group: HTMLElement, name: string) => within(group).getByRole("button", { name }).getAttribute("aria-pressed");

function mount() {
  render(
    <ThemeProvider>
      <MemoryRouter>
        <AppearanceView />
        {/* The control the phone's account sheet and the sign-in page draw: the same component, the same context. */}
        <div data-testid="elsewhere">
          <ThemeSegmented />
        </div>
      </MemoryRouter>
    </ThemeProvider>,
  );
  const here = screen.getAllByRole("group", { name: "Theme" }).find((el) => !el.closest('[data-testid="elsewhere"]')) as HTMLElement;
  return { here, elsewhere: screen.getByTestId("elsewhere") };
}

describe("Appearance", () => {
  it("is one row, named Theme, with Light, Dark and System", () => {
    const { here } = mount();
    expect(screen.getByRole("heading", { level: 2, name: "Appearance" })).toBeTruthy();
    expect(within(here).getAllByRole("button").map((b) => b.textContent)).toEqual(["Light", "Dark", "System"]);
    expect(document.querySelectorAll('[data-ui="setting-row"]')).toHaveLength(1);
  });

  it("changing the theme here changes the other control, and the page", () => {
    const { here, elsewhere } = mount();
    fireEvent.click(within(here).getByRole("button", { name: "Dark" }));
    expect(pressed(here, "Dark")).toBe("true");
    expect(pressed(elsewhere, "Dark")).toBe("true");
    expect(pressed(elsewhere, "Light")).toBe("false");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dusk");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dusk");
  });

  it("changing it in the other control changes this one", () => {
    const { here, elsewhere } = mount();
    fireEvent.click(within(elsewhere).getByRole("button", { name: "Light" }));
    expect(pressed(here, "Light")).toBe("true");
    fireEvent.click(within(elsewhere).getByRole("button", { name: "System" }));
    expect(pressed(here, "System")).toBe("true");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  });

  it("is the control the phone's account sheet and the sign-in page already draw, not a second one", () => {
    for (const file of ["src/components/shell/MobileHeader.tsx", "src/pages/site/signin/SignInView.tsx", "src/pages/site/settings/AppearanceView.tsx"]) {
      expect(readFileSync(file, "utf8"), file).toContain("ThemeSegmented");
    }
  });
});
