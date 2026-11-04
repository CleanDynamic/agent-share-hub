// UX-03 P6: Home hides what has nothing to show, and a maker whose builds nobody has run yet sees them listed instead.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { visionHomeProps } from "@/dev/fixtures/vision/home";

import { HomeView, type HomeViewProps } from "./HomeView";
import { HOME_BUILD_ROWS } from "./homeModel";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, isLoggedIn: false, loading: false }) }));

beforeEach(() =>
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)/.exec(query);
    return { matches: min ? 1440 >= Number(min[1]) : false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined };
  }),
);
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
    reproduced: 0,
    rows: Array.from({ length: HOME_BUILD_ROWS }, (_, at) => ({ id: `b${at}`, title: `Build ${at + 1}`, href: `/b2/build-${at + 1}`, published: "2 Nov", slug: `build-${at + 1}` })),
  },
};

/** Nothing to show anywhere in the room, and a week with no progress. */
const NOTHING: Partial<HomeViewProps> = {
  room: { reproducedToday: 0, litToday: 0, runsThisWeek: 0, runs: [] },
  requests: { status: "ready", data: [] },
  mostRun: { status: "ready", data: [] },
  whereNext: { status: "ready", data: [] },
  week: { status: "ready", data: { days: ["none", "none", "none", "none", "none", "none", "none"], today: 2, streak: 0, challenges: [{ slug: "run-three", title: "Run three builds", done: 0, target: 3 }] } },
  published: PUBLISHED,
  onCopyLink,
};

const room = () => screen.getByRole("complementary", { name: "The room" });
const headings = (within_: HTMLElement) => within(within_).queryAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);

describe("UX-03 P6: Home hides what has nothing to show", () => {
  it("with everything at zero, the room is the maker's published builds alone", () => {
    mount(NOTHING);
    expect(headings(room())).toEqual(["Your published builds"]);
    expect(room().textContent).not.toContain("Reproduced today");
    expect(room().textContent).not.toContain("Nothing is still open right now.");
    expect(room().textContent).not.toContain("Nothing run yet this week.");
    expect(room().textContent).not.toContain("Run a build this week and suggestions appear here.");
    const module = screen.getByRole("region", { name: "Your published builds" });
    expect(module.textContent).toContain("7 published · none reproduced yet");
    expect(within(module).getAllByTestId("home-published-row")).toHaveLength(HOME_BUILD_ROWS);
    expect(module.textContent).toContain("A reproduction is recorded when another signed-in person runs your build and says whether it worked.");
    fireEvent.click(within(module).getByRole("button", { name: "Copy link" }));
    expect(onCopyLink).toHaveBeenCalledWith("build-1");
    // Your week with no progress is not drawn either.
    expect(screen.queryByRole("heading", { name: "Your week" })).toBeNull();
  });

  it("with one still-open topic, shows Still open and not the published builds", () => {
    mount({ ...NOTHING, requests: { status: "ready", data: [{ id: "r1", title: "Make it work offline", detail: "Bakery site · 3 days left", reward: "£40", href: "/bounties/r1/solve" }] } });
    expect(headings(room())).toEqual(["Still open"]);
    expect(screen.queryByRole("region", { name: "Your published builds" })).toBeNull();
  });

  it("signed out, is unchanged: the room's modules, and no published builds", () => {
    mount({}, "populated");
    const before = headings(room());
    cleanup();
    mount({ published: { status: "signed-out" }, onCopyLink }, "populated");
    expect(headings(room())).toEqual(before);
    expect(screen.queryByRole("region", { name: "Your published builds" })).toBeNull();
  });

  it("keeps a count that is shown as it looks today", () => {
    mount({ ...NOTHING, room: { reproducedToday: 3, litToday: 0, runsThisWeek: 5, runs: [] } });
    expect(room().textContent).toContain("Reproduced today");
    expect(room().textContent).toContain("runs this week");
  });
});
