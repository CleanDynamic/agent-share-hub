// RC-P27 — the progress page, in six sections.
//
// The claims: /analytics draws exactly six sections, in order (the reset note,
// Progress, Needs you, Your builds, This week, Badges), and with the note read
// and nothing needing the maker, the other four in the same order; no text on
// it is drawn in --lit, while the progress fills are; it asks for six things
// and none is a parked feature's table or function, and the frame's progress
// hook asks for user_progress alone; PROGRESS is three figures in DM Mono with
// tabular digits in --text, the bar, and the six sources of XP; THIS WEEK is
// at most three challenges, each "n of m" in DM Mono with the same bar; BADGES
// is the ten, earned first; and a refused read is a refusal, never level 1.
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
import { beforeEach, describe, expect, it, vi } from "vitest";

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
import { RESET_NOTE_KEY } from "@/components/progress/ResetNote";
import { useProgress } from "@/hooks/useProgress";
import { XP_SOURCES } from "@/lib/progress/sources";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const NOW = new Date().toISOString();

/** A published build; build 4 has solutions waiting, so NEEDS YOU has a line. */
function build(n: number) {
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
  };
}
const metrics = (n: number, waiting = 0) => ({
  build_id: `build-${n}`,
  runs: 5 - n,
  worked: 5 - n,
  failed_last_30_days: 0,
  open_bounties: waiting ? 1 : 0,
  solutions_waiting: waiting,
});

const PROGRESS = { xp_total: 412, level: 3 }; // level 3 starts at 243 and level 4 at 485
const WEEK = [
  { reason: "run_reported", source_id: "b-21", created_at: NOW },
  { reason: "run_reported", source_id: "b-22", created_at: NOW },
  { reason: "solution_accepted", source_id: "s-31", created_at: NOW },
];
const HELD = ["founder", "first-build", "runner", "well-proven"];
const FIGURES = { builds: 2, reproductions_received: 7, rebuilds_of_their_work: 3, gaps_solved: 1 };

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
    user_progress: { data: PROGRESS, error: null, status: 200 },
    xp_events: { data: WEEK, error: null, status: 200 },
    user_badges: { data: HELD.map((badge_key) => ({ badge_key })), error: null, status: 200 },
    builds: { data: [build(1), build(4)], error: null, status: 200 },
    "rpc:maker_build_metrics": { data: [metrics(1), metrics(4, needsYou ? 3 : 0)], error: null, status: 200 },
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
  await screen.findAllByTestId("progress-figure-value");
  await screen.findByTestId("maker-figures");
}

/** A section by what names it: its heading, or the note. */
function sectionName(element: Element): string {
  if (element.getAttribute("role") === "note") return "Reset note";
  return element.querySelector("h2")?.textContent ?? `(${element.getAttribute("data-testid")})`;
}

/** The page as static markup over a query cache holding the same rows, parsed back into a DOM. */
function staticPage(): HTMLElement {
  const client = freshClient();
  client.setQueryData(["progress", USER], PROGRESS);
  client.setQueryData(["progress.week", USER], WEEK);
  client.setQueryData(["progress.badges", USER], new Set(HELD));
  client.setQueryData([MY_BUILD_STATS_KEY, USER], {
    builds: [build(1), build(4)].map((row, index) => ({ ...row, ...metrics(index === 0 ? 1 : 4, index === 0 ? 0 : 3) })),
    figures: { builds: 2, reproductionsReceived: 7, rebuildsOfTheirWork: 3, gapsSolved: 1 },
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

describe("the six sections", () => {
  it("are the note, Progress, Needs you, Your builds, This week and Badges, in that order, and nothing else", async () => {
    renderPage();
    await settled();
    await screen.findByTestId("needs-you");

    const page = screen.getByTestId("progress-page");
    expect([...page.children].map(sectionName)).toEqual([
      "Reset note",
      "Progress",
      "Needs you",
      "Your builds",
      "This week",
      "Badges",
    ]);
    expect(within(page).getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Progress",
      "Needs you",
      "Your builds",
      "This week",
      "Badges",
    ]);
    expect(within(page).getAllByRole("note")).toHaveLength(1);
  });

  it("keep their order when the note has been read and nothing needs the maker", async () => {
    window.localStorage.setItem(RESET_NOTE_KEY, "1");
    answerAll({ needsYou: false });
    renderPage();
    await settled();

    const page = screen.getByTestId("progress-page");
    expect([...page.children].map(sectionName)).toEqual(["Progress", "Your builds", "This week", "Badges"]);
  });

  it("leave out every panel of the old product", async () => {
    renderPage();
    await settled();

    expect(screen.queryByRole("tablist")).toBeNull();
    for (const gone of [/skill tree/i, /daily/i, /quest/i, /streak/i, /perk/i, /XP ledger/i, /creator marks/i, /showcase/i, /trophies/i]) {
      expect(screen.queryByText(gone)).toBeNull();
    }
  });
});

describe("the page's reads", () => {
  it("ask for six things, and none of them is a parked feature's table or function", async () => {
    renderPage();
    await settled();

    expect([...stand.requests].sort()).toEqual([
      "builds",
      "rpc:maker_build_metrics",
      "rpc:maker_stats",
      "user_badges",
      "user_progress",
      "xp_events",
    ]);
    expect(stand.requests.filter((request) => PARKED.includes(request))).toEqual([]);
  });

  it("the frame's progress hook asks for user_progress and nothing else", async () => {
    function Chip() {
      const { level, progress } = useProgress();
      return <span data-testid="chip">{`${level}:${progress?.xp_total ?? "-"}`}</span>;
    }
    render(
      <Providers client={freshClient()}>
        <Chip />
      </Providers>,
    );

    expect((await screen.findByText("3:412")).getAttribute("data-testid")).toBe("chip");
    expect(stand.requests).toEqual(["user_progress"]);
  });
});

describe("colour", () => {
  it("draws no text in --lit, and the progress fills are --lit", () => {
    const root = staticPage();

    const inked = [...root.querySelectorAll("*")].filter((element) =>
      [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()),
    );
    expect(inked.length).toBeGreaterThan(40);
    expect(inked.filter((element) => inkOf(element, root) === "var(--lit)").map((element) => element.textContent)).toEqual([]);

    const fills = root.querySelectorAll("[data-striped-fill]");
    expect(fills).toHaveLength(4); // the level, and the three challenges
    for (const fill of fills) {
      // UI-P09: the bar is --lit stripes (a gradient), and nothing is written on it.
      expect(styleOf(fill)["background"]).toContain("var(--lit)");
      expect(fill.textContent).toBe("");
    }
    // The one other amber: a highest-tier badge's fill, whose ink is --on-lit.
    const highest = root.querySelector('[data-testid="badge-mark-well-proven"]');
    expect(styleOf(highest)["background"]).toBe("var(--lit)");
    expect(styleOf(highest)["color"]).toBe("var(--on-lit)");
  });
});

describe("PROGRESS", () => {
  it("gives the level, the XP and the XP to the next level in DM Mono with tabular digits, in --text", () => {
    const root = staticPage();

    const values = [...root.querySelectorAll('[data-testid="progress-figure-value"]')];
    expect(values.map((value) => value.textContent)).toEqual(["3", "412", "73"]);
    for (const value of values) {
      const style = styleOf(value);
      expect(style["font-family"]).toContain("DM Mono");
      expect(style["font-variant-numeric"]).toBe("tabular-nums");
      expect(style["color"]).toBe("var(--text)");
    }
    expect([...root.querySelectorAll('[data-testid="progress-figure"]')].map((figure) => figure.lastElementChild?.textContent)).toEqual([
      "level",
      "XP",
      "XP to level 4",
    ]);
  });

  it("draws the level's progress as the bar, 169 of the 242 XP between level 3 and level 4", async () => {
    renderPage();
    const bar = await screen.findByRole("progressbar", { name: "Progress to level 4" });

    expect(bar.getAttribute("aria-valuenow")).toBe("169");
    expect(bar.getAttribute("aria-valuemax")).toBe("242");
    expect(bar.getAttribute("aria-valuetext")).toBe("169 of 242 XP");
  });

  it("lists how you earn: the six sources, in order, each with its XP", async () => {
    renderPage();
    const heading = await screen.findByRole("heading", { level: 3, name: "How you earn" });

    const items = within(heading.parentElement as HTMLElement).getAllByTestId("xp-source");
    expect(items.map((item) => item.textContent)).toEqual(XP_SOURCES.map((source) => `${source.event}${source.xp} XP`));
  });

  it("says a refused read is a refusal, never level 1", async () => {
    stand.answers.user_progress = { data: null, error: { code: "42501", message: "denied" }, status: 403 };
    renderPage();

    const refusal = await screen.findByTestId("progress-error");
    expect(refusal.textContent).toContain("You don't have access to this.");
    expect(within(refusal).getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByTestId("progress-figure-value")).toBeNull();
    expect(screen.queryByRole("progressbar", { name: /Progress to level/ })).toBeNull();
  });
});

describe("THIS WEEK", () => {
  it("shows at most three challenges, each n of m in DM Mono beside the same bar", async () => {
    renderPage();
    const rows = await screen.findAllByTestId("weekly-challenge");

    expect(rows.length).toBeLessThanOrEqual(3);
    expect(rows.map((row) => within(row).getByTestId("weekly-challenge-count").textContent)).toEqual(["2 of 3", "1 of 1", "0 of 1"]);
    expect(rows.map((row) => within(row).getByRole("progressbar").getAttribute("aria-valuenow"))).toEqual(["2", "1", "0"]);
    for (const row of rows) {
      const count = within(row).getByTestId("weekly-challenge-count");
      expect(count.style.fontFamily).toContain("DM Mono");
      expect(count.style.fontVariantNumeric).toBe("tabular-nums");
    }
  });
});

describe("BADGES", () => {
  it("draws the ten as BadgeMark, earned first, then not yet", async () => {
    renderPage();
    const slots = await screen.findAllByTestId("badge-slot");

    const marks = slots.map((slot) => slot.querySelector('[role="img"]') as HTMLElement);
    expect(marks).toHaveLength(10);
    expect(marks.map((mark) => mark.getAttribute("data-earned"))).toEqual([
      "true",
      "true",
      "true",
      "true",
      "false",
      "false",
      "false",
      "false",
      "false",
      "false",
    ]);
    expect(marks.slice(0, 4).map((mark) => mark.getAttribute("data-testid"))).toEqual([
      "badge-mark-first-build",
      "badge-mark-runner",
      "badge-mark-founder",
      "badge-mark-well-proven",
    ]);
  });
});
