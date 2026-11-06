// UX-10 P11: the profile's choice budget, its phone layout and its accessibility: one primary per view (Follow for a visitor; none
// on your own profile), a filter of at most five, no Sort, at most three actions in the head; the head a `header` with the name as
// the h1; the feed a `feed` of articles; pictures sized ahead.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { profileFixture } from "@/dev/fixtures/profile";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, isLoggedIn: false, loading: false }) }));

import { ProfileView } from "./ProfileView";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const wrap = (node: ReactNode) => (
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>{node}</MemoryRouter>
  </QueryClientProvider>
);
const primaries = () => document.querySelectorAll('[data-visual-slot="btn-primary"]');

function phone() {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: !query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined }));
}

describe("the choice budget", () => {
  it("a visitor's profile has one primary, Follow, and at most three head actions", () => {
    render(wrap(<ProfileView {...profileFixture("populated", false)} />));
    expect([...primaries()].map((button) => button.textContent)).toEqual(["Follow"]);
    expect(within(screen.getByTestId("profile-actions")).getAllByRole("button").length).toBeLessThanOrEqual(3);
  });

  it("your own profile has no primary: Edit profile is a control", () => {
    render(wrap(<ProfileView {...profileFixture("populated", true)} />));
    expect(primaries()).toHaveLength(0);
    expect(within(screen.getByTestId("profile-actions")).getAllByRole("button").map((button) => button.textContent)).toEqual(["Edit profile"]);
  });

  it("the filter holds at most five options, and there is no Sort", () => {
    render(wrap(<ProfileView {...profileFixture("populated", false)} />));
    expect(within(screen.getByRole("radiogroup", { name: "Show" })).getAllByRole("radio").length).toBeLessThanOrEqual(5);
    expect(screen.queryByRole("button", { name: /sort/i })).toBeNull();
    expect(screen.queryByText(/^Sort/)).toBeNull();
  });
});

describe("accessibility", () => {
  it("the head is a header with the name as the page's only h1; the feed is a feed of articles", () => {
    render(wrap(<ProfileView {...profileFixture("populated", false)} />));
    expect(screen.getByTestId("profile-head").tagName).toBe("HEADER");
    expect(screen.getAllByRole("heading", { level: 1 }).map((heading) => heading.textContent)).toEqual(["Maya Kent"]);
    const feed = screen.getByRole("feed");
    const articles = screen.getAllByTestId("profile-feed-item");
    expect(articles.every((article) => article.tagName === "ARTICLE" && article.getAttribute("aria-label"))).toBe(true);
    expect(feed.contains(articles[0])).toBe(true);
  });

  it("the header picture has its width and height set, so nothing shifts", () => {
    const props = profileFixture("populated", false);
    render(wrap(<ProfileView {...props} head={{ ...props.head, header: { url: "https://cdn.test/h.jpg", crop: null, alt: "" } }} />));
    const img = screen.getByTestId("profile-header-picture").querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("width")).toBe("1200");
    expect(img.getAttribute("height")).toBe("300");
    expect(screen.getByTestId("profile-header-picture").style.aspectRatio).toBe("4 / 1");
  });
});

describe("on a phone", () => {
  it("the avatar is 72 overlapping by 36, the actions in one row, About folded, the feed full width", () => {
    phone();
    render(wrap(<ProfileView {...profileFixture("populated", false)} />));
    const avatar = screen.getByTestId("profile-head").querySelector('[data-ui="avatar"]') as HTMLElement;
    expect(avatar.style.width).toBe("72px");
    expect((avatar.parentElement as HTMLElement).style.marginTop).toBe("-36px");
    expect(within(screen.getByTestId("profile-actions")).getAllByRole("button").map((button) => button.textContent)).toEqual(["Follow", "Message", "···"]);
    expect(screen.getByRole("button", { name: /About/ }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByTestId("profile-feed").parentElement?.style.maxWidth).toBe("");
  });
});
