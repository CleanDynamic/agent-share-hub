// PT-08 — the build page opens with the maker's thread under the title, every post open. Without a thread the hero is
// today's, with its well and result window.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, isLoggedIn: false }),
}));

import { buildFixture } from "@/dev/fixtures/build";
import { buildStepsFixture } from "@/dev/fixtures/buildSteps";
import type { Post } from "@/lib/build/thread";

import { BuildView, type BuildViewProps } from "./BuildView";
import { stepTabs, type BuildThreadView } from "./buildModel";

const posts: Post[] = [
  { content: [{ type: "paragraph", content: [{ type: "text", text: "First I sorted the inbox by hand." }] }] },
  { content: [{ type: "paragraph", content: [{ type: "text", text: "Then I taught the agent the rules." }] }] },
  { content: [{ type: "paragraph", content: [{ type: "text", text: "It now clears forty a day." }] }] },
];

function threadView(over: Partial<BuildThreadView> = {}): BuildThreadView {
  return {
    posts,
    mediaById: new Map(),
    srcByPath: new Map(),
    published: "6 Oct",
    build: { id: "b1", slug: "inbox-triage", title: "Inbox triage agent", rebuild_count: 2 },
    engagement: { counts: { likes: 24, comments: 5 }, liked: false, saved: false },
    follow: { following: false, busy: false, onToggle: () => undefined },
    ...over,
  };
}

function props(over: { thread?: BuildThreadView | null; rebuilt?: boolean; viewport?: "desktop" | "mobile" } = {}): BuildViewProps {
  const { title, outcome, ...steps } = buildStepsFixture("list");
  const base = buildFixture(over.viewport ?? "desktop");
  const rebuilt = over.rebuilt ?? false;
  return {
    ...base,
    hero: {
      ...base.hero,
      title,
      outcome,
      credit: { rebuiltFrom: rebuilt ? { title: "Inbox sorter", handle: "kofi" } : null, madeBy: "@maya" },
      delta: rebuilt ? "Δ swapped model" : null,
      thread: over.thread === undefined ? threadView() : over.thread,
      maker: { name: "Maya Okafor", handle: "maya", avatarUrl: null, userId: "u-maya" },
      madeWith: ["Claude Code"],
      modelsUsed: [],
    },
    viewer: { ...base.viewer, tabs: stepTabs(false), tab: "anatomy" },
    steps,
  };
}

function mount(p: BuildViewProps) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BuildView {...p} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** A window `wide` px across, or a phone. */
function screenIs(kind: "wide" | "phone") {
  window.matchMedia = ((query: string) => ({
    matches: kind === "wide" ? query.includes("min-width") : query.includes("max-width"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("the build page with a thread", () => {
  it("shows the byline with a 20 avatar and no marks, and post 1 open behind a toggle, with no well, no result window and no shape tag", () => {
    mount(props());
    const hero = screen.getByTestId("build-hero");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

    const row = within(hero).getByTestId("build-author-row");
    expect(within(row).getByText("Maya Okafor")).toBeTruthy();
    expect(row.textContent).toContain("@maya · 6 Oct");
    expect(row.querySelector("[data-made-with]")).toBeNull();
    expect(row.querySelector('[data-ui="avatar"]')?.getAttribute("style") ?? row.innerHTML).toMatch(/20px/);
    expect(screen.queryByTestId("build-shape-tag")).toBeNull();

    expect(within(hero).getByText("First I sorted the inbox by hand.")).toBeTruthy();
    expect(hero.querySelector('[data-thread-mode="page"]')).not.toBeNull();
    expect(hero.querySelector("[data-post-region]")?.getAttribute("data-post-region")).toBe("closed");
    fireEvent.click(within(hero).getByRole("button", { name: /show more/i }));
    for (const text of ["Then I taught the agent the rules.", "It now clears forty a day."]) {
      expect(within(hero).getByText(text)).toBeTruthy();
    }
    expect(hero.querySelector("[data-post-region]")?.getAttribute("data-post-region")).toBe("open");
    expect(within(hero).getByRole("heading", { level: 2, name: "Post" })).toBeTruthy();
    expect(within(hero).getByText("1 of 3 posts")).toBeTruthy();

    expect(within(hero).queryByRole("img", { name: /· Result$/ })).toBeNull();
    expect(hero.querySelector('[data-ui="picture-light"]')).toBeNull();
    expect(screen.queryByTestId("build-thread-line")).toBeNull();
    expect(screen.queryByTestId("build-author-column")).toBeNull();
  });

  it("credits the other people who made tiles: two named, then how many more, and nothing when there are none", () => {
    const p = props();
    const withMaker = (contributors?: string[]) => ({ ...p, hero: { ...p.hero, maker: { ...p.hero.maker!, contributors } } });
    const { unmount } = mount(withMaker(["kit", "dax", "lou", "max"]));
    expect(screen.getByTestId("build-contributors").textContent).toContain("with @kit, @dax and 2 more");
    unmount();
    mount(withMaker(undefined));
    expect(screen.queryByTestId("build-contributors")).toBeNull();
  });

  it("has one primary button, Rebuild, More, and a More menu with Download, Lineage and, on a rebuild, Compare", async () => {
    const p = props({ rebuilt: true });
    mount({ ...p, actions: { ...p.actions, compareTo: "/compare/inbox-triage" } });
    const group = screen.getByRole("group", { name: "Take this build" });
    expect(within(group).getAllByRole("button").map((button) => button.textContent ?? button.getAttribute("aria-label"))).toEqual(["Copy for AI", "Rebuild", ""]);
    expect(within(group).getByRole("button", { name: "More actions" })).toBeTruthy();
    expect(group.querySelectorAll('button[data-testid="build-copy-for-ai"]')).toHaveLength(1);
    fireEvent.keyDown(within(group).getByRole("button", { name: "More actions" }), { key: "Enter" });
    const items = (await screen.findAllByRole("menuitem")).map((entry) => entry.textContent);
    expect(items).toEqual(expect.arrayContaining(["Download the build", "Lineage", "Compare with the original"]));
    expect(items.indexOf("Download the build")).toBeLessThan(items.indexOf("Lineage"));
    expect(screen.getByTestId("build-lineage").getAttribute("href")).toBe(p.actions.lineageTo);
  });

  it("keeps Copy for AI, Rebuild and Follow by name, and Follow calls through", () => {
    const onToggle = vi.fn();
    const p = props({ thread: threadView({ follow: { following: false, busy: false, onToggle } }) });
    mount(p);
    const dock = screen.getByRole("group", { name: "Take this build" });
    expect(within(dock).getByRole("button", { name: "Copy for AI" })).toBeTruthy();
    expect(within(dock).getByRole("button", { name: "Rebuild" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Follow" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("says Following once followed", () => {
    mount(props({ thread: threadView({ follow: { following: true, busy: false, onToggle: () => undefined } }) }));
    expect(screen.getByRole("button", { name: "Following" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Follow" })).toBeNull();
  });

  it("has no Follow on the reader's own build", () => {
    mount(props({ thread: threadView({ follow: undefined }) }));
    expect(screen.queryByRole("button", { name: /^Follow/ })).toBeNull();
    expect(screen.getByTestId("build-author-row")).toBeTruthy();
  });

  it("puts the actions in the title block and the engagement row under the post, with no Rebuild in it", () => {
    mount(props());
    // Page shell: the title and its actions are the page's PageHeader on a desktop.
    expect(within(screen.getByRole("heading", { level: 1 }).closest("header")!).getByRole("group", { name: "Take this build" })).toBeTruthy();
    const hero = screen.getByTestId("build-hero");
    const engagement = within(hero).getByTestId("engagement-row");
    expect(engagement.querySelector('[data-engagement-action="rebuild"]')).toBeNull();
    expect(hero.querySelector('a[href="/rebuild/inbox-triage"]')).toBeNull();
    const foot = hero.querySelector("[data-post-foot]") as HTMLElement;
    expect(foot.contains(engagement)).toBe(true);
    expect(foot.querySelector("[data-post-toggle]")).not.toBeNull();
    const posts = screen.getByTestId("build-posts");
    expect(posts.contains(engagement)).toBe(true);
  });

  it("draws the credit line for a rebuild, and leaves it to the author row on an original", () => {
    const { unmount } = mount(props({ rebuilt: true }));
    expect(screen.getByTestId("build-hero").textContent).toContain("Rebuilt from Inbox sorter by @kofi · made by @maya");
    unmount();

    mount(props({ rebuilt: false }));
    expect(screen.getByTestId("build-hero").textContent).not.toContain("made by");
  });

  it("lays the thread and The build in one left column and the reproduction in the right", () => {
    screenIs("wide");
    mount(props());
    // UX-03 P2: one layout with a thread or without.
    const row = screen.getByTestId("build-main-row");
    // Page shell: the page grid's main and side template.
    expect(row.style.display).toBe("grid");
    const [left, right] = Array.from(row.children) as HTMLElement[];
    expect(left.contains(screen.getByTestId("build-hero"))).toBe(true);
    expect(left.contains(screen.getByTestId("build-steps-panel"))).toBe(true);
    expect(right.contains(screen.getByTestId("build-proof"))).toBe(true);
    expect(right.contains(screen.getByTestId("build-need"))).toBe(true);
  });
});

describe("the build page without a thread", () => {
  it("is today's hero: the well, the result window and the dock over it", () => {
    mount(props({ thread: null }));
    const hero = screen.getByTestId("build-hero");
    expect(hero.getAttribute("data-hero")).toBeNull();
    expect(within(hero).getByRole("img", { name: /· Result$/ })).toBeTruthy();
    // Page shell: the dock is the page header's action on a desktop.
    expect(within(screen.getByRole("heading", { level: 1 }).closest("header")!).getByRole("group", { name: "Take this build" })).toBeTruthy();
    expect(screen.queryByTestId("build-thread")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Follow/ })).toBeNull();
    // UX-03 P2: the same two columns as a thread's: the hero, then The build, on the left; the reproduction on the right.
    expect(screen.getByTestId("build-wide-column").contains(hero)).toBe(true);
    expect(screen.getByTestId("build-side-column").contains(screen.getByTestId("build-proof"))).toBe(true);
  });
});

describe("the build page with a thread on a phone", () => {
  it("wraps the actions under the title and keeps the page's order", () => {
    screenIs("phone");
    mount(props({ viewport: "mobile" }));
    const title = screen.getByTestId("build-title-block");
    expect(title.style.flexDirection).toBe("column");
    expect(within(title).getByRole("group", { name: "Take this build" })).toBeTruthy();
    expect(screen.getAllByRole("group", { name: "Take this build" })).toHaveLength(1);
    const order = ["build-hero", "build-proof", "build-steps"].map((id) => screen.getByTestId(id));
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});
