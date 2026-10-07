// UI-P36 — the sign-in page's view: the reference's boxes, the Back link, the
// Sign in · Join free switch that keeps ?redirect=, the orbs (and no orbs on a
// phone), the sentence as real text, and the theme control as a radio group.
//
// Token-valued styles are asserted through static markup, because jsdom's CSS
// parser drops every `var()`; behaviour is asserted on the rendered tree.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/contexts/ThemeContext";

import { SignInView, type SignInViewProps } from "./SignInView";
import { setViewport } from "./signinTest";

const base: SignInViewProps = {
  mode: "login",
  onBack: () => {},
  reproducedToday: 48,
  inGallery: 1284,
  children: <p>the card's body</p>,
};

const tree = (props: Partial<SignInViewProps> = {}) => (
  <ThemeProvider>
    <MemoryRouter>
      <SignInView {...base} {...props} />
    </MemoryRouter>
  </ThemeProvider>
);

const markup = (props?: Partial<SignInViewProps>) => renderToStaticMarkup(tree(props));

beforeEach(() => setViewport("desktop"));
afterEach(() => setViewport("desktop"));

describe("SignInView · desktop", () => {
  it("is the content centred in the viewport, a row with a 110px gap", () => {
    const html = markup();
    expect(html).toContain("min-height:100dvh");
    expect(html).toContain("align-items:center");
    expect(html).toContain("justify-content:center");
    expect(html).toContain("column-gap:110px");
    expect(html).not.toContain("height:1000px");
  });

  it("is the board's own height in board fit", () => {
    expect(markup({ fit: "board" })).toContain("height:1000px");
  });

  it("wraps below the width that holds both columns, so the card falls under the lockup", () => {
    expect(markup()).toContain("flex-wrap:wrap");
  });

  it("never scrolls sideways, even for the frame between two layouts", () => {
    expect(markup()).toContain("overflow-x:hidden");
  });

  it("stacks the lockup at 70, the tagline at 40 and the orbs in a 30px column", () => {
    const { container } = render(tree());
    const lockup = container.querySelector('[data-ui="lockup"]')!;
    // UI-P52 density pass: the lockup's gap 26 → 19 and the tagline's offsets
    // 70 → 50 and 24 → 17; the mark keeps its 77.
    expect(lockup.getAttribute("style")).toContain("gap: 19px");
    expect(lockup.querySelector('[data-ui="mark"]')!.getAttribute("width")).toBe("77");
    // UI-P52 density pass: the wordmark is drawn at 70 and display() renders it at 52.
    expect(lockup.querySelector("span")!.getAttribute("style")).toContain("font-size: 52px");
    const column = lockup.parentElement!;
    expect(column.getAttribute("style")).toContain("flex-direction: column");
    expect(column.getAttribute("style")).toContain("gap: 30px");
    expect(column.querySelector('[data-ui="tagline"] [style*="margin-left: 50px"]')).not.toBeNull();
    expect(column.querySelector('[data-ui="tagline"] [style*="margin-left: 17px"]')).not.toBeNull();
  });

  it("gives the sentence as real text under one heading", () => {
    render(tree());
    expect(screen.getByRole("heading", { level: 1, name: "Every AI build, hung with its proof." })).toBeTruthy();
  });

  it("draws two 140px orbs: Reproduced with today's runs, and Hung with the builds in the gallery", () => {
    const { container } = render(tree());
    const glass = container.querySelector('[data-ui="orb-glass"]')!;
    const solid = container.querySelector('[data-ui="orb-solid"]')!;
    expect(glass.getAttribute("style")).toContain("width: 140px");
    expect(glass.textContent).toBe("Reproduced48 today");
    expect(solid.getAttribute("style")).toContain("width: 140px");
    expect(solid.textContent).toBe("Hung1,284builds");
    expect(glass.parentElement!.getAttribute("style")).toContain("gap: 12px");
  });

  it("draws an empty disc, not a number, for a count that has not arrived", () => {
    const { container } = render(tree({ reproducedToday: null, inGallery: null }));
    expect(container.querySelector('[data-ui="orb-glass"]')).toBeNull();
    expect(container.querySelector('[data-ui="orb-solid"]')).toBeNull();
    expect(screen.queryByText(/today/)).toBeNull();
  });

  it("says 1 today and 0 today as they are", () => {
    const { container } = render(tree({ reproducedToday: 1, inGallery: 0 }));
    expect(container.querySelector('[data-ui="orb-glass"]')!.textContent).toBe("Reproduced1 today");
    expect(container.querySelector('[data-ui="orb-solid"]')!.textContent).toBe("Hung0builds");
  });

  it("draws the card 420 wide, padding 26, radius 20, on --header, unblurred (UI-P40)", () => {
    const html = markup();
    const card = html.slice(html.indexOf('data-testid="signin-card"'));
    expect(card).toContain("width:420px");
    expect(card).toContain("padding:26px");
    expect(card).toContain("border-radius:20px");
    expect(card).toContain("background:var(--header)");
    expect(card).toContain("border:1px solid var(--header-border)");
    expect(card).toContain("box-shadow:var(--shadow-float), var(--panel-highlight)");
    expect(card).toContain("gap:12px");
    // UI-P40: the card is not one of the four budgeted surfaces.
    expect(html).not.toMatch(/[;"]backdrop-filter:/);
  });

  it("puts the body in the card, and the theme control under it", () => {
    render(tree());
    const card = screen.getByTestId("signin-card");
    expect(within(card).getByText("the card's body")).toBeTruthy();
    expect(within(card).queryByRole("radiogroup")).toBeNull();
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeTruthy();
  });

  it("offers the theme as a radio group of Noon, Dusk and System, the room asked for checked", () => {
    render(tree({ themeValue: "dusk" }));
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((radio) => radio.textContent)).toEqual(["Noon", "Dusk", "System"]);
    expect(within(group).getByRole("radio", { name: "Dusk" }).getAttribute("aria-checked")).toBe("true");
    expect(within(group).getByRole("radio", { name: "Noon" }).getAttribute("aria-checked")).toBe("false");
  });
});

describe("SignInView · the card's top row", () => {
  it("has a Back link, a real link home, 13px in the quiet ink", () => {
    const html = markup();
    const back = html.slice(html.indexOf(">Back<") - 400, html.indexOf(">Back<"));
    expect(back).toContain('href="/"');
    expect(back).toContain("font-size:13px");
    expect(back).toContain("color:var(--text2)");
    render(tree());
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/");
  });

  it("goes back on a plain click, and leaves a new-tab click to the address", () => {
    const onBack = vi.fn();
    render(tree({ onBack }));
    const back = screen.getByRole("link", { name: "Back" });

    expect(fireEvent.click(back)).toBe(false);
    expect(onBack).toHaveBeenCalledTimes(1);

    fireEvent.click(back, { ctrlKey: true });
    fireEvent.click(back, { metaKey: true });
    fireEvent.click(back, { shiftKey: true });
    fireEvent.click(back, { button: 1 });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("switches between /login and /signup with two links, the current one marked", () => {
    render(tree({ mode: "login" }));
    const group = screen.getByRole("group", { name: "Sign in or join" });
    const [signIn, join] = within(group).getAllByRole("link");
    expect(signIn.textContent).toBe("Sign in");
    expect(signIn.getAttribute("href")).toBe("/login");
    expect(signIn.getAttribute("aria-current")).toBe("page");
    expect(join.textContent).toBe("Join free");
    expect(join.getAttribute("href")).toBe("/signup");
    expect(join.hasAttribute("aria-current")).toBe(false);
    // Links, not buttons: the one button named Sign in on the page is the form's.
    expect(within(group).queryAllByRole("button")).toHaveLength(0);
  });

  it("marks Join free as current on the join page", () => {
    render(tree({ mode: "signup" }));
    expect(screen.getByRole("link", { name: "Join free" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Sign in" }).hasAttribute("aria-current")).toBe(false);
  });

  it("keeps ?redirect= across the switch, in both directions", () => {
    render(tree({ mode: "login", carry: "?redirect=%2Fgallery" }));
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login?redirect=%2Fgallery");
    expect(screen.getByRole("link", { name: "Join free" }).getAttribute("href")).toBe("/signup?redirect=%2Fgallery");
  });

  it("draws the switch at 32 tall in 12px type", () => {
    const html = markup();
    // UI-P52 density pass: drawn 32, so 24px items, which render at 20.
    expect(html).toContain("height:20px");
    expect(html).toContain("font-size:12px");
  });

  it.each(["reset", "verify"] as const)("has no switch on the %s page, only the way back", (mode) => {
    render(tree({ mode }));
    expect(screen.queryByRole("group", { name: "Sign in or join" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Join free" })).toBeNull();
    expect(screen.getByRole("link", { name: "Back" })).toBeTruthy();
  });

  it("says which page it is on the root, for the tests and the compare", () => {
    render(tree({ mode: "reset" }));
    expect(screen.getByTestId("signin-view").getAttribute("data-mode")).toBe("reset");
    expect(screen.getByTestId("signin-view").getAttribute("data-viewport")).toBe("desktop");
  });
});

describe("SignInView · phone", () => {
  beforeEach(() => setViewport("phone"));

  it("is a column with 22px 14px 30px around it and a 14px gap", () => {
    render(tree());
    const root = screen.getByTestId("signin-view");
    expect(root.getAttribute("data-viewport")).toBe("mobile");
    expect(root.getAttribute("style")).toContain("padding: 22px 14px 30px");
    expect(root.getAttribute("style")).toContain("gap: 14px");
    expect(root.getAttribute("style")).toContain("min-height: 100dvh");
  });

  it("is the board's own height in board fit", () => {
    render(tree({ fit: "board" }));
    expect(screen.getByTestId("signin-view").getAttribute("style")).toContain("height: 844px");
  });

  it("never scrolls sideways", () => {
    render(tree());
    expect(screen.getByTestId("signin-view").getAttribute("style")).toContain("overflow-x: hidden");
  });

  it("draws the lockup at 34 and the tagline at 26, in an 18px column padded 10px 0 4px", () => {
    const { container } = render(tree());
    const lockup = container.querySelector('[data-ui="lockup"]')!;
    // UI-P52 density pass: the lockup's gap 12 → 9 and the tagline's offsets
    // 40 → 29 and 12 → 9; the mark keeps its 37.
    expect(lockup.getAttribute("style")).toContain("gap: 9px");
    expect(lockup.querySelector('[data-ui="mark"]')!.getAttribute("width")).toBe("37");
    const column = lockup.parentElement!;
    expect(column.getAttribute("style")).toContain("gap: 18px");
    expect(column.getAttribute("style")).toContain("padding: 10px 0px 4px");
    expect(column.querySelector('[data-ui="tagline"] [style*="margin-left: 29px"]')).not.toBeNull();
    expect(column.querySelector('[data-ui="tagline"] [style*="margin-left: 9px"]')).not.toBeNull();
  });

  it("puts the form in a glass panel, a 10px column with padding 16", () => {
    const { container } = render(tree());
    const panel = container.querySelector('[data-ui="panel"]')!;
    expect(panel.getAttribute("data-surface")).toBe("glass");
    expect(panel.classList.contains("bg-glass")).toBe(true);
    // UI-P52 density pass: Panel takes the drawn 16 and renders 12.
    expect(panel.getAttribute("style")).toContain("padding: 12px");
    const card = within(panel as HTMLElement).getByTestId("signin-card");
    expect(card.getAttribute("style")).toContain("flex-direction: column");
    expect(card.getAttribute("style")).toContain("gap: 10px");
  });

  it("starts the panel with the switch at 38 tall and 13px, and has no Back link", () => {
    const { container } = render(tree({ carry: "?redirect=%2Fgallery" }));
    const card = screen.getByTestId("signin-card");
    expect(card.firstElementChild!.getAttribute("data-ui")).toBe("segmented");
    expect(within(card).getByRole("link", { name: "Join free" }).getAttribute("href")).toBe("/signup?redirect=%2Fgallery");
    // UI-P52 density pass: drawn 38/13, so 30px items, which render 25/12. The
    // switch was under 44, so the touch floor does not hold it.
    expect(container.querySelector('[data-ui="segmented"] a')!.getAttribute("style")).toContain("height: 25px");
    expect(container.querySelector('[data-ui="segmented"] a')!.getAttribute("style")).toContain("font-size: 12px");
    expect(screen.queryByRole("link", { name: "Back" })).toBeNull();
  });

  it("draws no orbs", () => {
    const { container } = render(tree());
    expect(container.querySelector('[data-ui="orb-glass"]')).toBeNull();
    expect(container.querySelector('[data-ui="orb-solid"]')).toBeNull();
  });

  it("has no switch on the reset and verify pages", () => {
    render(tree({ mode: "verify" }));
    expect(screen.queryByRole("group", { name: "Sign in or join" })).toBeNull();
  });

  it("centres the theme control under the panel, 36 tall in 12px type", () => {
    const { container } = render(tree());
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    expect(group.parentElement!.getAttribute("style")).toContain("justify-content: center");
    // UI-P52 density pass: drawn 36, so 28px items, which render at 23.
    expect(group.querySelector("button")!.getAttribute("style")).toContain("height: 23px");
    expect(container.querySelector('[data-ui="panel"]')!.contains(group)).toBe(false);
  });
});
