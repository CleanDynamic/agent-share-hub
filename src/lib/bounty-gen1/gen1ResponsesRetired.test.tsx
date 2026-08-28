// Tier 3 — generation-1 bounty responses are frozen (NS-P44).
//
// Two claims, pulling in opposite directions, which is why they are asserted
// in one file: the generation-1 authoring path must be DEAD, and every
// generation-1 row already written must still RENDER. A freeze that quietly
// took the read path with it would pass a spec that only checked the first
// half, and nobody would notice by eye — a solutions tab that stopped
// resolving looks exactly like a creator who has solved nothing.
//
// WHY THE ARCHIVE ROW IS SYNTHESISED HERE. The audit this prompt ran found no
// generation-1 rows to fixture against, because there is no generation-1
// schema to hold them: `bounty_responses`, `bounty_me_too` and
// `bounty_response_verifications` all answer PGRST205 on the project this repo
// points at, and `content_items.bounty_enabled` and `profiles.bounties_solved`
// answer 42703. The measurement is written up in docs/retired-surfaces.md. So
// the row below is the shape generation 1 WOULD return, mocked at the client,
// and what it proves is the thing that is actually in question after a freeze:
// that the read path is not gated by the flag. It cannot and does not claim
// the database holds one.
//
// WHY A COMPONENT SPEC AND NOT A BROWSER ONE. Both halves need a signed-in
// viewer and a generation-1 row, and the browser has neither: the Playwright
// config declares a `setup` project with no `.setup.ts` behind it, and the
// database has no generation-1 table. An anonymous browser spec would find no
// composer whatever this flag said, and would pass just as happily with the
// flag flipped back to true.
//
// THESE TESTS ARE PART OF THE ROLLBACK. They assert the frozen behaviour
// directly rather than reading the flag and asserting conditionally, because a
// test that agrees with whatever the flag says proves nothing. Flipping
// GEN1_BOUNTY_RESPONSES_ENABLED back to true is expected to revert the first
// describe block with it; docs/retired-surfaces.md lists that as a rollback
// step.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  // Deliberately not the profile being viewed: CreatorProfile redirects a
  // viewer to /profile when the two ids match, and the redirect would swallow
  // the surface under test.
  user: { id: "viewer-1" },
  profile: { id: "viewer-1", username: "viewer", display_name: "Viewer" },
  isLoggedIn: true,
  loading: false,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => auth,
}));

/**
 * The archive, as rows — one generation-1 response, marked as the solution,
 * on a creator who has solved one bounty.
 */
const db = vi.hoisted(() => ({
  rows: {
    profiles: [
      {
        id: "author-1",
        username: "author",
        display_name: "Author",
        avatar_url: null,
        banner_url: null,
        bio: "Writes prompts.",
        follower_count: 2,
        following_count: 1,
        created_at: "2026-01-04T10:00:00Z",
        joined_at: "2026-01-04T10:00:00Z",
        bounties_solved: 1,
      },
    ],
    bounty_responses: [
      {
        id: "resp-1",
        bounty_content_id: "bounty-1",
        responder_id: "author-1",
        is_solution: true,
        upvotes: 4,
        verified_count: 2,
        how_it_fixes: "Pins the constraint above the conversation so the model cannot talk itself out of it.",
        created_at: "2026-03-24T08:00:00Z",
        content_items: { id: "bounty-1", title: "Support bot over-apologises" },
      },
    ],
    content_items: [] as unknown[],
  } as Record<string, unknown[]>,
}));

/**
 * A table-aware chainable stub. Every builder method returns the chain;
 * awaiting it yields the rows for the table named in `.from()`, and
 * `.maybeSingle()` yields the first of them. Nothing here asserts on the query
 * that was built — the point is only that the read path runs and paints.
 */
vi.mock("@/integrations/supabase/client", () => {
  const chainFor = (table: string) => {
    const rows = db.rows[table] ?? [];
    const chain: Record<string, unknown> = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") {
            return (resolve: (v: unknown) => unknown) =>
              resolve({ data: rows, error: null, count: rows.length });
          }
          if (prop === "maybeSingle" || prop === "single") {
            return () => Promise.resolve({ data: rows[0] ?? null, error: null });
          }
          return () => chain;
        },
      }
    );
    return chain;
  };
  return {
    supabase: {
      from: (table: string) => chainFor(table),
      rpc: () => chainFor("__rpc"),
      storage: { from: () => chainFor("__storage") },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
      removeChannel: () => {},
      auth: { getUser: () => Promise.resolve({ data: { user: auth.user }, error: null }) },
    },
  };
});

import { BountyResponseComposer } from "@/components/BountyResponseComposer";
import CreatorProfile from "@/pages/CreatorProfile";
import {
  GEN1_BOUNTY_RESPONSES_ENABLED,
  Gen1BountyValidationError,
  assertGen1BountyResponsesEnabled,
} from "@/lib/bounty-gen1/flags";

function mount(ui: React.ReactNode, path = "/") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

describe("NS-P44 — the generation-1 composer cannot be opened", () => {
  it("renders nothing when it is mounted directly", () => {
    // The strongest form of the claim. Guarding the one affordance would prove
    // only that today's single call site is quiet; mounting the component
    // itself proves that no call site can open it, including one added later.
    const { container } = mount(
      <BountyResponseComposer
        bountyContentId="bounty-1"
        bountyTitle="Support bot over-apologises"
        bountyCreatorId="author-1"
        onClose={() => {}}
        onSubmitted={() => {}}
      />
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Submit your Blueprint")).toBeNull();
    expect(screen.queryByRole("button", { name: /submit blueprint/i })).toBeNull();
    // No field of it exists either — a composer that rendered its form with the
    // submit button removed would still be a composer that opened.
    expect(screen.queryByPlaceholderText(/paste your prompt/i)).toBeNull();
  });

  it("refuses the write with a named error, not a silent insert", () => {
    // The gate the submit handler calls. A call site that survives the freeze,
    // or a page re-routed after it, gets this rather than a row.
    expect(() => assertGen1BountyResponsesEnabled()).toThrow(Gen1BountyValidationError);
    try {
      assertGen1BountyResponsesEnabled();
      throw new Error("the gate did not throw");
    } catch (err) {
      expect((err as Gen1BountyValidationError).code).toBe("GEN1_BOUNTY_RESPONSES_RETIRED");
    }
  });

  it("is frozen by the flag, and the flag is off", () => {
    expect(GEN1_BOUNTY_RESPONSES_ENABLED).toBe(false);
  });
});

describe("NS-P44 — an existing generation-1 response still renders", () => {
  it("shows a solved response on the creator profile, which the freeze does not touch", async () => {
    // /creator/:username is a live route, and its Solutions tab is the one
    // reachable surface that reads `bounty_responses`. If the freeze had
    // reached the read path, this is where it would show.
    mount(
      <Routes>
        <Route path="/creator/:username" element={<CreatorProfile />} />
      </Routes>,
      "/creator/author"
    );

    // The counter chip the same read path feeds.
    expect(await screen.findByText(/bounties solved/i)).toBeInTheDocument();

    const solutionsTab = await screen.findByRole("button", { name: "Solutions" });
    fireEvent.click(solutionsTab);

    await waitFor(() => {
      expect(screen.getByText("Support bot over-apologises")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/pins the constraint above the conversation/i)
    ).toBeInTheDocument();
    // The badge, not the tab label — /solution/i alone matches both.
    expect(screen.getByText("\u2713 Solution")).toBeInTheDocument();
  });
});
