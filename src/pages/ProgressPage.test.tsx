// RC-P27 — the progress page, in four sections.
//
// The claims: /analytics draws, under the h1, Needs you (only when something
// needs the maker), the builds table headed by its fact, This week and the
// badges, in that order; on a desktop XP and "Level" are nowhere on it, and
// nothing stands in their place (mobile 28 D opens the PHONE layout on a Level
// module read from the reader's own user_progress row, tested at the end); no text on it is drawn in --lit, while the progress fills are;
// it asks for five things and none is a parked feature's table or function;
// THIS WEEK is at most three challenges, each "n of m" in DM Mono with the same
// bar and no XP reward; BADGES is the six that are not about runs, earned first.
//
// Two renderings, because jsdom drops var() from a style object but keeps the
// attribute text: behaviour runs through the real data layer over a recording
// stand-in for supabase-js; colours are read from static markup rendered over
// a query cache filled with the same rows.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const USER = "maker-1";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "maker-1", email: "maker@example.test", email_confirmed_at: "2026-01-01T00:00:00.000Z" },
    profile: { id: "maker-1", username: "maker", display_name: "Maker", avatar_url: null },
    isLoggedIn: true,
    loading: false,
  }),
}));

type Answer = { data: unknown; error: unknown; status: number };

/** Every request the page makes, by table or "rpc:function", and what each is answered. */
const stand = vi.hoisted(() => ({
  requests: [] as string[],
  answers: {} as Record<string, { data: unknown; error: unknown; status: number }>,
}));

vi.mock("@/integrations/supabase/client", () => {
  const empty = { data: [], error: null, status: 200 };
  const chain = (table: string): unknown =>
    new Proxy(function builder() {}, {
      get(_target, prop) {
        if (prop === "then") {
          stand.requests.push(table);
          const answer = stand.answers[table] ?? empty;
          return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve(answer).then(resolve, reject);
        }
        return () => chain(table);
      },
    });
  return {
    supabase: {
      from: (table: string) => chain(table),
      rpc: (fn: string) => {
        stand.requests.push(`rpc:${fn}`);
        return Promise.resolve(stand.answers[`rpc:${fn}`] ?? { data: null, error: null, status: 200 });
      },
      auth: { getSession: async () => ({ data: { session: { user: { id: "maker-1" } } } }) },
      storage: { from: () => ({ createSignedUrl: vi.fn() }) },
    },
  };
});

import Analytics from "@/pages/Analytics";
import { MY_BUILD_STATS_KEY } from "@/components/analytics/BuildAnalytics";
import { levelOf, xpForLevel } from "@/lib/progress/level";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const NOW = new Date().toISOString();

/** A published build; build 4 has topics still open, so NEEDS YOU has a line. */
function build(n: number, open = 0) {
  return {
    id: `build-${n}`,
    slug: `build-${n}`,
    title: `Build ${n}`,
    reproduction_count: 5 - n,
    last_confirmed_at: ago(3),
    last_confirmed_model: "claude-sonnet-4-5",
    published_at: ago(60),
    rebuild_count: n,
    like_count: 10 * n,
    comment_count: n,
    save_count: 2 * n,
    still_open_topics: open,
  };
}
const metrics = (n: number) => ({
  build_id: `build-${n}`,
  runs: 5 - n,
  worked: 5 - n,
  failed_last_30_days: 0,
});

const WEEK = [
  { reason: "run_reported", source_id: "b-21", created_at: NOW },
  { reason: "run_reported", source_id: "b-22", created_at: NOW },
  { reason: "solution_accepted", source_id: "s-31", created_at: NOW },
];
const HELD = ["founder", "first-build", "runner", "well-proven", "family"];
const FIGURES = { builds: 2, reproductions_received: 7, rebuilds_of_their_work: 3 };

/** The tables and functions of the features XP-DESIGN.md parks, and of the old panels RC-P27 unmounted. */
const PARKED = [
  "perks",
  "user_perks",
  "daily_challenges",
  "challenge_history",
  "streak_days",
  "creator_marks",
  "solver_leaderboard_cache",
  "rpc:get_visible_surfaces",
  "rpc:get_quest_state",
  "rpc:claim_challenge",
  "rpc:has_perk",
  "rpc:set_user_track",
  "rpc:respec_track",
  "rpc:mark_depth_revealed",
  "rpc:record_daily_activity",
];

function answerAll({ needsYou = true }: { needsYou?: boolean } = {}) {
  stand.answers = {
    xp_events: { data: WEEK, error: null, status: 200 },
    user_badges: { data: HELD.map((badge_key) => ({ badge_key })), error: null, status: 200 },
    builds: { data: [build(1), build(4, needsYou ? 3 : 0)], error: null, status: 200 },
    "rpc:maker_build_metrics": { data: [metrics(1), metrics(4)], error: null, status: 200 },
    "rpc:maker_stats": { data: [FIGURES], error: null, status: 200 },
  };
}

function Providers({ client, children }: { client: QueryClient; children: ReactNode }) {
  return (
    <HelmetProvider context={{}}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/analytics"]}>{children}</MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

const freshClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderPage() {
  return render(
    <Providers client={freshClient()}>
      <Analytics />
    </Providers>,
  );
}

/** Wait until every section has drawn its data. */
async function settled() {
  await screen.findAllByTestId("badge-slot");
  await screen.findAllByTestId("weekly-challenge");
  await screen.findByTestId("build-stats-table");
}

/** A section by what names it: its heading. */
function sectionName(element: Element): string {
  return element.querySelector("h2")?.textContent ?? `(${element.getAttribute("data-testid")})`;
}

/** The page as static markup over a query cache holding the same rows, parsed back into a DOM. */
function staticPage(): HTMLElement {
  const client = freshClient();
  client.setQueryData(["progress.week", USER], WEEK);
  client.setQueryData(["progress.badges", USER], new Set(HELD));
  client.setQueryData([MY_BUILD_STATS_KEY, USER], {
    builds: [build(1), build(4, 3)].map((row, index) => ({ ...row, ...metrics(index === 0 ? 1 : 4), still_open: index === 0 ? 0 : 3 })),
    figures: { builds: 2, reproductionsReceived: 7, rebuildsOfTheirWork: 3 },
  });
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <Providers client={client}>
      <Analytics />
    </Providers>,
  );
  return host;
}

function styleOf(element: Element | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (element?.getAttribute("style") ?? "").split(";")) {
    const at = part.indexOf(":");
    if (at > 0) out[part.slice(0, at).trim()] = part.slice(at + 1).trim();
  }
  return out;
}

/** The colour text is drawn in: the nearest style that sets one, the element's own or an ancestor's. */
function inkOf(element: Element, root: Element): string {
  for (let node: Element | null = element; node && node !== root.parentElement; node = node.parentElement) {
    const colour = styleOf(node)["color"];
    if (colour) return colour;
  }
  return "(inherited from the page)";
}

beforeEach(() => {
  stand.requests = [];
  answerAll();
  window.localStorage.clear();
});

describe("the sections", () => {
  it("are Needs you, Your builds, This week and Badges, in that order, under the h1, and nothing else", async () => {
    renderPage();
    await settled();
    await screen.findByTestId("needs-you");

    const page = screen.getByTestId("progress-page");
    expect([...page.children].map(sectionName)).toEqual(["Needs you", "2 builds", "This week", "3 of 6 badges"]);
    expect(within(page).getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Needs you",
      "2 builds",
      "This week",
      "3 of 6 badges",
    ]);
    expect(screen.getByRole("heading", { level: 1, name: "Your progress" })).toBeTruthy();
    expect(within(page).queryAllByRole("note")).toHaveLength(0);
  });

  it("starts with the builds table when nothing needs the maker, with no block above it", async () => {
    answerAll({ needsYou: false });
    renderPage();
    await settled();

    const page = screen.getByTestId("progress-page");
    expect([...page.children].map(sectionName)).toEqual(["2 builds", "This week", "3 of 6 badges"]);
  });

  it("draws no XP and no level anywhere on a desktop", async () => {
    renderPage();
    await settled();

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\bXP\b/i);
    expect(text).not.toMatch(/Level\s/);
    expect(text).not.toMatch(/level up/i);
    expect(screen.queryByTestId("progress-level")).toBeNull();
    expect(screen.queryByTestId("xp-reset-note")).toBeNull();
    expect(screen.queryByRole("progressbar", { name: /level/i })).toBeNull();
  });

  it("leaves out every panel of the old product", async () => {
    renderPage();
    await settled();

    expect(screen.queryByRole("tablist")).toBeNull();
    for (const gone of [/skill tree/i, /daily/i, /quest/i, /streak/i, /perk/i, /ledger/i, /creator marks/i, /showcase/i, /trophies/i]) {
      expect(screen.queryByText(gone)).toBeNull();
    }
  });
});

describe("the page's reads", () => {
  it("ask for five things, and none of them is a parked feature's table or function", async () => {
    renderPage();
    await settled();

    expect([...stand.requests].sort()).toEqual([
      "builds",
      "rpc:maker_build_metrics",
      "rpc:maker_stats",
      "user_badges",
      "xp_events",
    ]);
    expect(stand.requests.filter((request) => PARKED.includes(request))).toEqual([]);
  });

});

describe("colour", () => {
  it("draws no text in --lit", () => {
    const root = staticPage();

    const inked = [...root.querySelectorAll("*")].filter((element) =>
      [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()),
    );
    expect(inked.length).toBeGreaterThan(25);
    expect(inked.filter((element) => inkOf(element, root) === "var(--lit)").map((element) => element.textContent)).toEqual([]);

    // The one other amber: a highest-tier badge's fill, whose ink is --on-lit.
    const highest = root.querySelector('[data-testid="badge-mark-family"]');
    expect(styleOf(highest)["background"]).toBe("var(--lit)");
    expect(styleOf(highest)["color"]).toBe("var(--on-lit)");
  });
});

describe("THIS WEEK", () => {
  it("shows the challenges that are not about runs, each n / m in mono beside the 4px bar", async () => {
    renderPage();
    const rows = await screen.findAllByTestId("weekly-challenge");

    expect(rows.length).toBeLessThanOrEqual(3);
    expect(rows.map((row) => row.textContent)).toEqual(["Solve a gap1 / 1"]);
    expect(rows.map((row) => within(row).getByRole("progressbar").getAttribute("aria-valuenow"))).toEqual(["1"]);
    expect(screen.queryByText(/run three|re-confirm/i)).toBeNull();
    for (const row of rows) {
      const count = within(row).getByTestId("weekly-challenge-count");
      expect(count.style.fontFamily).toContain("Geist");
      expect(count.style.fontVariantNumeric).toBe("tabular-nums");
    }
  });
});

describe("BADGES", () => {
  it("draws the badges that are not about runs as BadgeMark on Cards, earned first, then not yet", async () => {
    renderPage();
    const slots = await screen.findAllByTestId("badge-slot");

    const marks = slots.map((slot) => slot.querySelector('[role="img"]') as HTMLElement);
    expect(marks).toHaveLength(6);
    expect(marks.map((mark) => mark.getAttribute("data-earned"))).toEqual(["true", "true", "true", "false", "false", "false"]);
    expect(marks.map((mark) => mark.getAttribute("data-testid"))).toEqual([
      "badge-mark-first-build",
      "badge-mark-founder",
      "badge-mark-family",
      "badge-mark-solver",
      "badge-mark-rebuilt",
      "badge-mark-fixer",
    ]);
    expect(screen.getByRole("heading", { level: 2, name: "3 of 6 badges" })).toBeTruthy();
  });
});

describe("on a phone (mobile 28 D)", () => {
  const original = window.matchMedia;
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({ ...original(query), matches: query.includes("max-width") })) as typeof window.matchMedia;
    stand.answers["user_progress"] = { data: { xp_total: 1240, level: 6 }, error: null, status: 200 };
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it("opens on the Level module: the level, the XP line, the bar and the line about XP", async () => {
    renderPage();
    const module = await screen.findByTestId("progress-level");
    await within(module).findByRole("heading", { level: 2, name: /^Level \d+$/ });
    const level = levelOf(1240);
    expect(within(module).getByRole("heading", { level: 2 }).textContent).toBe(`Level ${level}`);
    expect(within(module).getByTestId("progress-level-line").textContent).toBe(`1,240 XP · ${(xpForLevel(level + 1) - 1240).toLocaleString("en-GB")} to level ${level + 1}`);
    const bar = within(module).getByRole("progressbar", { name: `Level ${level}` });
    expect(Number(bar.getAttribute("aria-valuenow"))).toBeGreaterThan(0);
    expect(within(module).getByText("Nobody can award XP to themselves.")).toBeTruthy();
    expect(screen.getByTestId("progress-page").firstElementChild).toBe(module);
  });

  it("reads the reader's own progress row once, and no parked feature's table", async () => {
    renderPage();
    await screen.findByRole("heading", { level: 2, name: /^Level / });
    expect(stand.requests.filter((request) => request === "user_progress")).toHaveLength(1);
    expect(stand.requests.filter((request) => PARKED.includes(request))).toEqual([]);
  });

  it("says a failed read in the module, never a level nobody measured", async () => {
    stand.answers["user_progress"] = { data: null, error: { message: "boom", code: "XX000" }, status: 500 };
    renderPage();
    expect(await screen.findByTestId("progress-level-error")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /^Level / })).toBeNull();
  });
});

