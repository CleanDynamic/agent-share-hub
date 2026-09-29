// RC-P16 — the engagement row's budgets, counted in the rendered DOM
// ⟦hicks-law › Enforcing It in the Code⟧.
//
// A card carries three actions and a build page's header four beside its one
// primary ⟦hicks-law › Budgets⟧; the reproduction count is evidence and is
// never one of them; the header keeps exactly one filled button
// ⟦von-restorff-effect⟧; and liked is carried by aria-pressed and a filled
// icon, not by colour alone ⟦color-system⟧. Counted by role and accessible
// name, and — for the token-valued paint jsdom cannot hold — read off static
// markup (src/test/tokenStyle.tsx). A failing budget means the change is
// wrong, not the test.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, isLoggedIn: false }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
    storage: { from: () => ({ createSignedUrl: vi.fn() }) },
  },
}));

import { BuildHeader } from "@/components/build/BuildHeader";
import { ForkControl } from "@/components/build/ForkControl";
import { ReproductionAction } from "@/components/build/ReproductionAction";
import { GalleryCard } from "@/components/gallery/GalleryCard";
import { EngagementRow } from "@/components/social/EngagementRow";
import type { Build, GalleryBuild } from "@/lib/build";
import { staticDoc, styleOf } from "@/test/tokenStyle";

const CARD: GalleryBuild = {
  id: "b1",
  creator_id: "c1",
  slug: "inbox-triage",
  title: "Inbox triage agent",
  outcome: "Triages an inbox in under a minute.",
  shape: "other",
  status: "published",
  made_for: ["founder"],
  made_with: ["Claude"],
  live_url: null,
  repo_url: null,
  hero_node_id: null,
  cover_media_id: null,
  completeness: 82,
  reproduction_count: 12,
  last_confirmed_at: "2026-09-26T00:00:00.000Z",
  last_confirmed_model: "claude-sonnet-4-5",
  published_at: "2026-08-01T00:00:00.000Z",
  parent_build_id: null,
  rebuild_count: 2,
  rebuild_note: null,
  source_title_at_fork: null,
  source_handle_at_fork: null,
  nodes: [],
  media: [],
  bounties: [],
};

const PAGE_BUILD = {
  ...CARD,
  cost_setup: null,
  cost_monthly: null,
  currency: "GBP",
  time_to_first_result: null,
} as unknown as Build;

const ENGAGEMENT = { counts: { likes: 24, comments: 5 }, liked: false, saved: false };

function providers(node: ReactElement): ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>
  );
}

const names = (buttons: HTMLElement[]) => buttons.map((button) => button.getAttribute("aria-label"));

describe("the engagement budgets", () => {
  it("a card carries exactly three actions: Like, Comment, Save", () => {
    const { container } = render(providers(<GalleryCard build={CARD} srcByPath={new Map()} engagement={ENGAGEMENT} />));
    const card = container.querySelector('[data-visual-slot="gallery-card"]') as HTMLElement;

    const actions = within(card).getAllByRole("button");
    expect(actions).toHaveLength(3);
    expect(names(actions)).toEqual(["Like", "Comment", "Save"]);
  });

  it("the build page's row carries exactly four: Like, Comment, Save, Share", () => {
    render(providers(<EngagementRow variant="page" build={CARD} {...ENGAGEMENT} />));
    const actions = within(screen.getByTestId("engagement-row")).getAllByRole("button");
    expect(actions).toHaveLength(4);
    expect(names(actions)).toEqual(["Like", "Comment", "Save", "Share"]);
  });

  it("neither row says anything about reproductions: that is the plaque's", () => {
    for (const variant of ["card", "page"] as const) {
      const { unmount } = render(providers(<EngagementRow variant={variant} build={CARD} {...ENGAGEMENT} />));
      const row = screen.getByTestId("engagement-row");
      const said = [row.textContent ?? "", ...within(row).getAllByRole("button").map((button) => button.getAttribute("aria-label") ?? "")];
      expect(said.join(" ")).not.toMatch(/reproduc/i);
      unmount();
    }
  });

  it("the build header keeps exactly one filled button with the row in it", () => {
    const doc = staticDoc(
      providers(
        <BuildHeader
          build={PAGE_BUILD}
          tree={[]}
          nodeTypes={[]}
          actions={<ForkControl state={{ fork: vi.fn(), pending: false, error: null, signedIn: true }} />}
          reproduction={<ReproductionAction build={PAGE_BUILD} />}
          engagement={ENGAGEMENT}
        />,
      ),
    );

    const buttons = [...doc.querySelectorAll("button")];
    const filled = buttons.filter((button) => styleOf(button).includes("background:var(--action)"));
    expect(filled.map((button) => button.textContent)).toEqual(["Rebuild this"]);
    // The row is in the header, and none of its four is the filled one.
    const row = doc.querySelector('[data-testid="engagement-row"]');
    expect(row?.querySelectorAll("button")).toHaveLength(4);
  });

  it("liked is aria-pressed and a filled heart, not a colour alone", () => {
    const quiet = staticDoc(providers(<EngagementRow variant="card" build={CARD} {...ENGAGEMENT} />));
    const liked = staticDoc(providers(<EngagementRow variant="card" build={CARD} {...ENGAGEMENT} liked />));

    const like = (doc: Document) => doc.querySelector('[data-engagement-action="like"], [data-engagement-action="unlike"]');
    const heart = (doc: Document) => like(doc)?.querySelector("[data-engagement-icon]");

    expect(like(quiet)?.getAttribute("aria-label")).toBe("Like");
    expect(like(quiet)?.getAttribute("aria-pressed")).toBe("false");
    expect(heart(quiet)?.getAttribute("fill")).toBe("none");
    expect(styleOf(like(quiet))).toContain("color:var(--text2)");

    expect(like(liked)?.getAttribute("aria-label")).toBe("Unlike");
    expect(like(liked)?.getAttribute("aria-pressed")).toBe("true");
    expect(heart(liked)?.getAttribute("fill")).toBe("currentColor");
    expect(styleOf(heart(liked))).toContain("color:var(--action)");
    // The count beside a liked heart is --text (STATES.md row 8).
    expect(styleOf(like(liked))).toContain("color:var(--text)");
  });

  it("draws every icon at 18px with a 1.5 stroke", () => {
    const doc = staticDoc(providers(<EngagementRow variant="page" build={CARD} {...ENGAGEMENT} />));
    const icons = [...doc.querySelectorAll("[data-engagement-icon]")];
    expect(icons).toHaveLength(4);
    for (const icon of icons) {
      expect(icon.getAttribute("width")).toBe("18");
      expect(icon.getAttribute("stroke-width")).toBe("1.5");
    }
  });
});
