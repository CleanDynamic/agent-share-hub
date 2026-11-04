// UX-03 P10: every theme control says Light, Dark and System, and sets the same stored values as before (noon, dusk, system,
// under bg-theme). The footer's control, which repeated the header's, is gone.

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, isLoggedIn: false, loading: false, signOut: vi.fn() }) }));

import { ThemeProvider, THEME_STORAGE_KEY } from "@/contexts/ThemeContext";
import { SiteFooterView } from "@/components/shell/SiteFooter";

import { ThemeSegmented } from "./ThemeSegmented";
import { ThemeToggle } from "./ThemeToggle";

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

const stored = () => window.localStorage.getItem(THEME_STORAGE_KEY);

describe("UX-03 P10: Light, Dark and System", () => {
  it("ThemeToggle names its choices Light, Dark, System and stores noon, dusk, system", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    expect(within(group).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Light", "Dark", "System"]);
    for (const [name, value] of [["Dark", "dusk"], ["Light", "noon"], ["System", "system"]] as const) {
      act(() => fireEvent.click(within(group).getByRole("radio", { name })));
      expect(stored()).toBe(value);
    }
    expect(document.body.textContent).not.toMatch(/Noon|Dusk/);
  });

  it("ThemeSegmented names its choices Light, Dark, System and stores noon, dusk, system", () => {
    render(
      <ThemeProvider>
        <ThemeSegmented />
      </ThemeProvider>,
    );
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["Light", "Dark", "System"]);
    for (const [name, value] of [["Dark", "dusk"], ["Light", "noon"], ["System", "system"]] as const) {
      act(() => fireEvent.click(screen.getByRole("button", { name })));
      expect(stored()).toBe(value);
    }
    expect(document.body.textContent).not.toMatch(/Noon|Dusk/);
  });

  it("the footer has no theme control: the header's is the one", () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <SiteFooterView signedIn={false} onSignOut={vi.fn()} onConnect={vi.fn()} />
        </MemoryRouter>
      </ThemeProvider>,
    );
    const footer = screen.getByTestId("site-footer");
    expect(within(footer).queryByRole("button", { name: /^(Light|Dark|System|Noon|Dusk)$/ })).toBeNull();
    expect(within(footer).queryByRole("radiogroup")).toBeNull();
  });
});
