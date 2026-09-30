// RC-P23 — analytics on builds, rendered.
//
// The claims: the page asks for its build numbers in three requests and never
// for a legacy post (and no module it imports can); NEEDS YOU lists the three
// reasons, one line per build, and is absent when nothing needs the maker;
// YOUR BUILDS is the four figures, the order in one sentence and a table of
// exactly eight columns, numbers in DM Mono at the trailing edge, a stale claim
// saying so, and no sort control; the empty and refused states are STATES.md's;
// and both sections sit directly under the level and XP, where the legacy
// engagement grid used to be at the foot of the tab. The build numbers, and
// since RC-P27 the progress page's own reads, run through the real data layer
// over a recording stand-in for supabase-js.

import fs from "node:fs";
import path from "node:path";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  user: { id: "maker-1", email: "maker@example.test", email_confirmed_at: "2026-01-01T00:00:00.000Z" },
  profile: { id: "maker-1", username: "maker", display_name: "Maker", avatar_url: null },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, profile: auth.profile, isLoggedIn: true, loading: false }),
}));

/** Every request the page makes, by table or function. */
const recorded = vi.hoisted(() => ({ requests: [] as string[] }));
const answers = vi.hoisted(() => ({
  builds: { data: [] as unknown[], error: null as unknown, status: 200 },
  metrics: { data: [] as unknown[], error: null as unknown, status: 200 },
  figures: { data: [{ builds: 0, reproductions_received: 0, rebuilds_of_their_work: 0, gaps_solved: 0 }] as unknown[], error: null as unknown, status: 200 },
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string): unknown =>
    new Proxy(function builder() {}, {
      get(_target, prop) {
        if (prop === "then") {
          recorded.requests.push(table);
          const answer = table === "builds" ? answers.builds : { data: [], error: null, status: 200 };
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
        recorded.requests.push(`rpc:${fn}`);
        if (fn === "maker_build_metrics") return Promise.resolve(answers.metrics);
        if (fn === "maker_stats") return Promise.resolve(answers.figures);
        return Promise.resolve({ data: null, error: null, status: 200 });
      },
      auth: {
        getSession: async () => ({ data: { session: { user: { id: "maker-1" } } } }),
        resend: vi.fn(async () => ({})),
      },
      storage: { from: () => ({ createSignedUrl: vi.fn() }) },
    },
  };
});

import Analytics from "@/pages/Analytics";
import { t } from "@/lib/theme/tokens";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

function build(n: number, over: Record<string, unknown> = {}) {
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
    ...over,
  };
}

function metrics(n: number, over: Record<string, unknown> = {}) {
  return { build_id: `build-${n}`, runs: 5 - n, worked: 5 - n, failed_last_30_days: 0, open_bounties: 0, solutions_waiting: 0, ...over };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/analytics"]}>
          <Analytics />
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

beforeEach(() => {
  recorded.requests = [];
  answers.builds = { data: [], error: null, status: 200 };
  answers.metrics = { data: [], error: null, status: 200 };
  answers.figures = {
    data: [{ builds: 0, reproductions_received: 0, rebuilds_of_their_work: 0, gaps_solved: 0 }],
    error: null,
    status: 200,
  };
});

describe("Analytics on builds", () => {
  it("asks for its build numbers in three requests, and never for a legacy post", async () => {
    answers.builds.data = [build(1)];
    answers.metrics.data = [metrics(1)];
    renderPage();

    await screen.findByTestId("build-stats-table");
    const buildNumbers = recorded.requests.filter((request) => request === "builds" || request.startsWith("rpc:maker_"));
    expect([...buildNumbers].sort()).toEqual(["builds", "rpc:maker_build_metrics", "rpc:maker_stats"]);
    expect(recorded.requests.filter((request) => request.includes("content_items"))).toEqual([]);
  });

  it("draws a table of exactly eight columns, in order, with numbers in DM Mono at the trailing edge", async () => {
    answers.builds.data = [build(1), build(2)];
    answers.metrics.data = [metrics(1), metrics(2)];
    renderPage();

    const table = await screen.findByTestId("build-stats-table");
    const headers = within(table).getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).toEqual(["Build", "Got working", "Last confirmed", "Rebuilds", "Likes", "Comments", "Saves", "Open bounties"]);

    const firstRow = within(table).getAllByTestId("build-stats-row")[0];
    const cells = within(firstRow).getAllByRole("cell");
    expect(cells).toHaveLength(7);
    const gotWorking = cells[0];
    expect(gotWorking.textContent).toBe("4");
    expect(gotWorking.style.fontFamily).toContain("DM Mono");
    expect(gotWorking.style.fontVariantNumeric).toBe("tabular-nums");
    expect(gotWorking.style.textAlign).toBe("end");
    expect(within(firstRow).getByRole("link", { name: "Build 1" }).getAttribute("href")).toBe("/b2/build-1");
  });

  it("states the order in one sentence and offers no sort control", async () => {
    answers.builds.data = [build(2), build(1)];
    answers.metrics.data = [metrics(1), metrics(2)];
    renderPage();

    expect((await screen.findByTestId("build-stats-order")).textContent).toBe("Most got working first, then the most recently confirmed.");
    const titles = screen.getAllByTestId("build-stats-row").map((row) => within(row).getByRole("link").textContent);
    expect(titles).toEqual(["Build 1", "Build 2"]);
    expect(screen.queryAllByRole("button", { name: /sort/i })).toHaveLength(0);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  });

  it("says stale in words on a stale claim, never in a warning colour", async () => {
    answers.builds.data = [build(1, { last_confirmed_at: ago(200) })];
    answers.metrics.data = [metrics(1)];
    renderPage();

    const cell = await screen.findByTestId("build-stats-confirmed");
    expect(cell.getAttribute("data-stale")).toBe("true");
    expect(cell.textContent).toMatch(/months ago, on Sonnet 4\.5 · stale$/);
    expect(cell.style.color).not.toBe(t.catBreakage);
  });

  it("lists the three reasons in Needs you, one line per build, most pressing first", async () => {
    answers.builds.data = [
      build(1),
      build(2, { last_confirmed_at: ago(200) }),
      build(3, { last_confirmed_at: ago(45) }),
      build(4, { last_confirmed_at: null, reproduction_count: 0, published_at: ago(5) }),
    ];
    answers.metrics.data = [metrics(1), metrics(2), metrics(3, { failed_last_30_days: 2 }), metrics(4, { solutions_waiting: 3, open_bounties: 1 })];
    renderPage();

    const section = await screen.findByTestId("needs-you");
    expect(within(section).getByRole("heading", { name: "Needs you" })).toBeTruthy();
    const lines = within(section).getAllByTestId("needs-you-line").map((line) => line.textContent);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("Build 43 solutions waiting");
    expect(lines[1]).toBe("Build 3a recent run did not work");
    expect(lines[2]).toMatch(/^Build 2not confirmed since \d{1,2} \w+ \d{4}$/);
  });

  it("leaves Needs you out entirely when nothing needs the maker", async () => {
    answers.builds.data = [build(1)];
    answers.metrics.data = [metrics(1)];
    renderPage();

    await screen.findByTestId("build-stats-table");
    expect(screen.queryByTestId("needs-you")).toBeNull();
    expect(screen.queryByText(/needs you/i)).toBeNull();
  });

  it("says so when nothing is published, with a secondary New build", async () => {
    renderPage();

    const empty = await screen.findByTestId("build-stats-empty");
    expect(empty.textContent).toContain("Publish a build and its numbers show up here.");
    const action = within(empty).getByRole("link", { name: "New build" });
    expect(action.getAttribute("href")).toBe("/compose/new");
    expect(action.getAttribute("data-visual-slot")).toBe("btn-secondary");
    expect(screen.getAllByTestId("maker-figure")).toHaveLength(4);
  });

  it("says a refused read is a refusal, never an empty table", async () => {
    answers.builds = { data: null as unknown as unknown[], error: { code: "42501", message: "denied" }, status: 403 };
    renderPage();

    const refusal = await screen.findByTestId("build-stats-error");
    expect(refusal.textContent).toContain("You don't have access to this.");
    expect(within(refusal).getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByTestId("build-stats-empty")).toBeNull();
  });

  it("sits directly under the level and XP, and the legacy engagement grid is gone", async () => {
    answers.builds.data = [build(1)];
    answers.metrics.data = [metrics(1)];
    renderPage();

    const yours = await screen.findByTestId("your-builds");
    expect(within(yours).getByRole("heading", { name: "Your builds" })).toBeTruthy();
    expect(screen.queryByText("Your story starts here")).toBeNull();
    expect(screen.queryByText("Day-returns")).toBeNull();
    expect(screen.queryByText("Reblogs")).toBeNull();
  });
});

describe("the page's modules", () => {
  it("never name content_items: no module the Analytics page imports can ask for a legacy post", () => {
    const root = path.resolve(__dirname, "..");
    const exts = [".tsx", ".ts", ".jsx", ".js"];
    const importPattern = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
    const resolve = (spec: string, from: string): string | null => {
      let base: string;
      if (spec.startsWith("@/")) base = path.join(root, spec.slice(2));
      else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
      else return null;
      for (const candidate of [base, ...exts.map((ext) => base + ext), ...exts.map((ext) => path.join(base, `index${ext}`))]) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
      }
      return null;
    };

    const seen = new Set<string>();
    const stack = [path.join(root, "pages/Analytics.tsx")];
    while (stack.length > 0) {
      const file = stack.pop() as string;
      if (seen.has(file)) continue;
      seen.add(file);
      for (const match of fs.readFileSync(file, "utf8").matchAll(importPattern)) {
        const next = resolve(match[1] ?? match[2] ?? match[3], file);
        if (next && !seen.has(next)) stack.push(next);
      }
    }

    // The generated schema names every table, as types, and asks for none.
    const generated = path.join(root, "integrations/supabase/types.ts");
    const naming = [...seen].filter((file) => file !== generated && fs.readFileSync(file, "utf8").includes("content_items"));
    expect(seen.size).toBeGreaterThan(20);
    expect(naming.map((file) => path.relative(root, file))).toEqual([]);
  });
});
