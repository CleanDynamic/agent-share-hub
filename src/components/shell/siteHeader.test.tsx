import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { SiteHeaderView, type SiteHeaderViewProps } from "./SiteHeader";

// The test setup's matchMedia says "no" to every query, which reads as a narrow
// window; these tests are about the full-width header.
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: query.includes("min-width"),
  media: query,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}));

const viewer = { id: "u1", name: "Maya Okafor", handle: "maya", hue: 1 };

function header(props: Partial<SiteHeaderViewProps> = {}) {
  const base: SiteHeaderViewProps = {
    current: "gallery",
    unread: 3,
    viewer,
    theme: "noon",
    onToggleTheme: vi.fn(),
    onSignIn: vi.fn(),
    onSignOut: vi.fn(),
    onNewBuild: vi.fn(),
    ...props,
  };
  render(
    <MemoryRouter>
      <SiteHeaderView {...base} />
    </MemoryRouter>,
  );
  return base;
}

describe("SiteHeaderView", () => {
  it("lists the five primary links with the current one marked", () => {
    header();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["Home", "Builds", "OpenBuilds", "Library", "Drafts"]);
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/", "/builds", "/openbuilds", "/library", "/drafts"]);
    expect(links.filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.textContent)).toEqual(["Builds"]);
  });

  it("draws the drafts count after the label, and nothing at 0", () => {
    header({ drafts: 4 });
    expect(screen.getByTestId("drafts-count").textContent).toBe("4");
    expect(screen.getByRole("link", { name: /^Drafts/ }).textContent).toBe("Drafts4");
  });

  it("draws no drafts count at 0", () => {
    header({ drafts: 0 });
    expect(screen.queryByTestId("drafts-count")).toBeNull();
  });

  it("has no current link on a route outside the five", () => {
    header({ current: null, activityCurrent: true });
    expect(within(screen.getByRole("navigation", { name: "Primary" })).queryByRole("link", { current: "page" })).toBeNull();
    expect(screen.getByRole("link", { name: "Activity, 3 unread" }).getAttribute("aria-current")).toBe("page");
  });

  it("names the Activity link with the unread count and caps the badge at 9+", () => {
    header({ unread: 12 });
    const bell = screen.getByRole("link", { name: "Activity, 12 unread" });
    expect(bell.getAttribute("href")).toBe("/notifications");
    expect(bell.textContent).toBe("9+");
  });

  it("draws no badge when nothing is unread", () => {
    header({ unread: 0 });
    const bell = screen.getByRole("link", { name: "Activity" });
    expect(bell.textContent).toBe("");
  });

  it("names the theme control after the painted theme and toggles on click", () => {
    const p = header({ theme: "dusk" });
    fireEvent.click(screen.getByRole("button", { name: "Theme: Dusk" }));
    expect(p.onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it("signed out: Sign in, no Library, no Drafts, no Activity", () => {
    const p = header({ viewer: null });
    expect(screen.queryByRole("link", { name: "Library" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Drafts" })).toBeNull();
    expect(screen.queryByRole("link", { name: /^Activity/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(p.onSignIn).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Account" })).toBeNull();
  });

  it("New build goes to the create route handler", () => {
    const p = header();
    fireEvent.click(screen.getByRole("button", { name: "New build" }));
    expect(p.onNewBuild).toHaveBeenCalled();
  });

  it("focuses the search on '/' outside a text field, and leaves '/' alone inside one", () => {
    header();
    const search = screen.getByRole("searchbox", { name: "Search builds" });
    fireEvent.keyDown(document.body, { key: "/" });
    expect(document.activeElement).toBe(search);
    const other = document.createElement("input");
    document.body.appendChild(other);
    other.focus();
    fireEvent.keyDown(other, { key: "/" });
    expect(document.activeElement).toBe(other);
    other.remove();
  });

  it("keeps the keyboard order lockup → links → search → New build → Activity → theme → account", () => {
    header();
    const focusable = Array.from(
      document.querySelectorAll<HTMLElement>("a[href], button, input"),
    ).map((el) => el.getAttribute("aria-label") ?? el.textContent);
    expect(focusable).toEqual([
      "buildgallery home",
      "Home",
      "Builds",
      "OpenBuilds",
      "Library",
      "Drafts",
      "Search builds",
      "New build",
      "Activity, 3 unread",
      "Theme: Noon",
      "Account",
    ]);
  });
});

/* UI-P87 — the refined header. Names and order are the current header's; styles are read from SSR markup, where the
   var() values survive (jsdom's cssstyle drops them). */
describe("SiteHeaderView under the refined look", () => {
  const REFINED = "/dev/kit/pages/home";
  const base = (props: Partial<SiteHeaderViewProps> = {}): SiteHeaderViewProps => ({
    current: "home",
    unread: 3,
    drafts: 2,
    viewer,
    theme: "dusk",
    onToggleTheme: vi.fn(),
    onSignIn: vi.fn(),
    onSignOut: vi.fn(),
    onNewBuild: vi.fn(),
    ...props,
  });
  const refined = (props: Partial<SiteHeaderViewProps> = {}) =>
    render(
      <MemoryRouter initialEntries={[REFINED]}>
        <SiteHeaderView {...base(props)} />
      </MemoryRouter>,
    );
  const markup = (props: Partial<SiteHeaderViewProps> = {}) =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={[REFINED]}>
        <SiteHeaderView {...base(props)} />
      </MemoryRouter>,
    );

  it("keeps every name and the order: links, search, New build, Activity, theme, account", () => {
    refined();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getAllByRole("link").map((a) => a.textContent)).toEqual(["Home", "Builds", "OpenBuilds", "Library", "Drafts2"]);
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("searchbox", { name: "Search builds" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "New build" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Activity, 3 unread" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Theme: Dusk" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Account" })).toBeTruthy();
  });

  it("sits on the frame: 48 high, 0 20px, gap 8, no background and no border", () => {
    const html = markup();
    const head = html.slice(html.indexOf("<header"), html.indexOf(">", html.indexOf("<header")));
    expect(head).toContain("height:48px");
    expect(head).toContain("padding:0 20px");
    expect(head).toContain("gap:8px");
    expect(head).not.toContain("background");
    expect(head).not.toMatch(/[;"]border(-bottom)?:/);
    expect(head).not.toContain("backdrop-filter");
  });

  it("marks the current link with the 2px --nav-mark bar and its glow, and the count at 11/500 --label", () => {
    const html = markup();
    expect(html.match(/data-ui="nav-mark"/g)).toHaveLength(1);
    expect(html).toContain("background:var(--nav-mark)");
    expect(html).toContain("box-shadow:var(--nav-lamp-glow)");
    expect(html).toMatch(/font-size:11px;font-weight:500;color:var\(--label\)/);
  });

  it("draws New build as a secondary button 30 high with no icon", () => {
    refined();
    const button = screen.getByRole("button", { name: "New build" });
    expect(button.getAttribute("data-variant")).toBe("secondary");
    expect(button.style.height).toBe("30px");
    expect(button.querySelector("svg")).toBeNull();
  });

  it("badges the bell with a 12px --lit-mark count, and on /notifications fills it with --control-on, never a colour", () => {
    const html = markup();
    expect(html).toContain("background:var(--lit-mark)");
    expect(html).toContain("color:var(--on-lit)");
    const current = markup({ activityCurrent: true });
    expect(current).toContain("background:var(--control-on)");
    expect(current).toContain("border:1px solid var(--control-border)");
  });

  it("is the current header with the switch off", () => {
    header();
  });
});
