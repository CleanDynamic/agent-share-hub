// UX-03 P6, Synth 07: Home hides what has nothing to show. The maker's published builds are the studio's third section, and
// the right panel's when it has nothing open and the studio is not on the page.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { visionHomeProps } from "@/dev/fixtures/vision/home";

import { HomeView, type HomeViewProps } from "./HomeView";
import { HOME_BUILD_ROWS } from "./homeModel";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, isLoggedIn: false, loading: false }) }));

let width = 1440;
beforeEach(() => {
  width = 1440;
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)/.exec(query);
    return { matches: min ? width >= Number(min[1]) : false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined };
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const mount = (over: Partial<HomeViewProps>, state: Parameters<typeof visionHomeProps>[0] = "populated") =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <HomeView {...visionHomeProps(state)} {...over} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const onCopyLink = vi.fn();
const PUBLISHED: HomeViewProps["published"] = {
  status: "ready",
  data: {
    total: 7,
    rows: Array.from({ length: HOME_BUILD_ROWS }, (_, at) => ({ id: `b${at}`, title: `Build ${at + 1}`, href: `/b2/build-${at + 1}`, published: "2 Nov", slug: `build-${at + 1}` })),
  },
};

/** Nothing open, and a week with no progress. */
const NOTHING: Partial<HomeViewProps> = {
  requests: { status: "ready", data: [] },
  week: { status: "ready", data: { days: ["none", "none", "none", "none", "none", "none", "none"], today: 2, streak: 0, challenges: [{ slug: "solve-a-gap", title: "Solve a gap", done: 0, target: 1 }] } },
  published: PUBLISHED,
  onCopyLink,
};

const room = () => screen.getByRole("complementary", { name: "The room" });
const headings = (within_: HTMLElement) => within(within_).queryAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);

describe("Home hides what has nothing to show", () => {
  it("with nothing open, the studio holds the published builds and the right panel holds nothing", () => {
    mount(NOTHING);
    expect(headings(room())).toEqual([]);
    const module = screen.getByRole("region", { name: "Your published builds" });
    expect(within(module).getByRole("heading", { level: 2, name: "7 published builds" })).toBeTruthy();
    expect(within(module).getAllByTestId("home-published-row")).toHaveLength(HOME_BUILD_ROWS);
    expect(module.textContent).not.toContain("reproduc");
    fireEvent.click(within(module).getByRole("button", { name: "Copy link" }));
    expect(onCopyLink).toHaveBeenCalledWith("build-1");
    // Your week with no progress is not drawn either.
    expect(screen.queryByRole("region", { name: "Your week" })).toBeNull();
  });

  it("with the studio off the page and nothing open, the right panel holds the published builds, once", () => {
    width = 1000;
    mount(NOTHING);
    expect(headings(room())).toEqual(["7 published builds"]);
    expect(screen.getAllByRole("region", { name: "Your published builds" })).toHaveLength(1);
  });

  it("with an open topic, the right panel shows it and not the published builds", () => {
    width = 1000;
    mount({ ...NOTHING, requests: { status: "ready", data: [{ id: "r1", title: "Make it work offline", detail: "@maya · in Bakery site", reward: "£40", href: "/bounties/r1/solve" }] } });
    expect(headings(room())).toEqual(["1 open in your spaces"]);
    expect(screen.queryByRole("region", { name: "Your published builds" })).toBeNull();
  });

  it("signed out, says across OpenBuilds and has no published builds", () => {
    mount({ published: { status: "signed-out" }, onCopyLink, stillOpenScope: "everyone" }, "populated");
    expect(headings(room())).toEqual(["3 open across OpenBuilds"]);
    expect(screen.queryByRole("region", { name: "Your published builds" })).toBeNull();
  });
});
