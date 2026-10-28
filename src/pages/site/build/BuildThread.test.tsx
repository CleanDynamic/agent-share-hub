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
  it("shows the author row, the marks and every post open, with no well and no result window", () => {
    mount(props());
    const hero = screen.getByTestId("build-hero");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

    const row = within(hero).getByTestId("build-author-row");
    expect(within(row).getByText("Maya Okafor")).toBeTruthy();
    expect(row.textContent).toContain("@maya · 6 Oct");
    expect(row.querySelector("[data-made-with]")).not.toBeNull();

    for (const text of ["First I sorted the inbox by hand.", "Then I taught the agent the rules.", "It now clears forty a day."]) {
      expect(within(hero).getByText(text)).toBeTruthy();
    }
    expect(hero.querySelector('[data-thread-mode="page"]')).not.toBeNull();
    expect(within(hero).queryByRole("button", { name: /show (more|less)/i })).toBeNull();

    expect(within(hero).queryByRole("img", { name: /· Result$/ })).toBeNull();
    expect(hero.querySelector('[data-ui="picture-light"]')).toBeNull();
    expect(screen.getByTestId("build-thread-line")).toBeTruthy();
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

  it("keeps the four actions and Follow by name, and Follow calls through", () => {
    const onToggle = vi.fn();
    const p = props({ thread: threadView({ follow: { following: false, busy: false, onToggle } }) });
    mount(p);
    const dock = screen.getByRole("group", { name: "Take this build" });
    expect(within(dock).getAllByRole("button").map((button) => button.textContent)).toEqual(["Copy for AI", "Download", "Rebuild"]);
    expect(within(dock).getByRole("link", { name: "Lineage" }).getAttribute("href")).toBe(p.actions.lineageTo);

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

  it("puts the actions in the title block and the engagement row under the thread", () => {
    mount(props());
    const title = screen.getByTestId("build-title-block");
    expect(within(title).getByRole("group", { name: "Take this build" })).toBeTruthy();
    const hero = screen.getByTestId("build-hero");
    expect(hero.querySelector('a[href="/rebuild/inbox-triage"]')).not.toBeNull();
    const posts = screen.getByTestId("build-posts");
    const link = hero.querySelector('a[href="/rebuild/inbox-triage"]') as Element;
    expect(posts.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    const row = screen.getByTestId("build-thread-row");
    expect(row.style.justifyContent).toBe("space-between");
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
    expect(within(hero).getByRole("group", { name: "Take this build" })).toBeTruthy();
    expect(screen.queryByTestId("build-thread")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Follow/ })).toBeNull();
    expect(screen.getByTestId("build-second-row")).toBeTruthy();
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
