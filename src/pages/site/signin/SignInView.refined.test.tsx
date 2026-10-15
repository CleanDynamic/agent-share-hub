// UI-P95 — the sign-in entrance under the refined look: no orbs, no chips, the counts as modules, the card a module.
// `/dev/*` lets the URL pick the look, so a MemoryRouter at /dev/signin?look=refined renders the refined branch.

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { ThemeProvider } from "@/contexts/ThemeContext";

import { SignInView } from "./SignInView";
import { setViewport } from "./signinTest";

const at = (look: "refined" | "current") =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[`/dev/signin?look=${look}`]}>
        <SignInView mode="login" onBack={() => {}} reproducedToday={48} inGallery={1284}>
          <p>the card's body</p>
        </SignInView>
      </MemoryRouter>
    </ThemeProvider>,
  );

beforeEach(() => setViewport("desktop"));

describe("SignInView · refined look", () => {
  it("draws the counts as modules, not orbs, with the same words", () => {
    const { container } = at("refined");
    expect(container.querySelector('[data-ui="orb-glass"]')).toBeNull();
    expect(container.querySelector('[data-ui="orb-solid"]')).toBeNull();
    expect(screen.getByText("Reproduced")).toBeTruthy();
    expect(screen.getByText("48")).toBeTruthy();
    expect(screen.getByText("1,284")).toBeTruthy();
  });

  it("keeps the tagline as one heading of real text", () => {
    at("refined");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Every AI build, hung with its proof.");
  });
});
