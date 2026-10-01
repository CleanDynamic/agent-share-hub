import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { SiteHeaderView, type SiteHeaderViewProps } from "./SiteHeader";

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
  it("lists the four primary links with the current one marked", () => {
    header();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["Home", "Gallery", "Bounties", "Library"]);
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/", "/gallery", "/bounties", "/library"]);
    expect(links.filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.textContent)).toEqual(["Gallery"]);
  });

  it("has no current link on a route outside the four", () => {
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

  it("signed out: Sign in, no Library, no Activity", () => {
    const p = header({ viewer: null });
    expect(screen.queryByRole("link", { name: "Library" })).toBeNull();
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
      "Gallery",
      "Bounties",
      "Library",
      "Search builds",
      "New build",
      "Activity, 3 unread",
      "Theme: Noon",
      "Account",
    ]);
  });
});
