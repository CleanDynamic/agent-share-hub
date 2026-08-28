// Tier 3 — the retired surfaces (NS-P43).
//
// Two claims, and they pull in opposite directions, which is why they are
// asserted in one file: the authoring functions must be DEAD, and everything
// already published must still be ALIVE. A freeze that quietly took the read
// path with it would pass a test that only checked the first half, and this
// codebase has no way to notice that by eye — an archived reblog that stopped
// resolving looks exactly like an archived reblog nobody visited.
//
// WHAT LIVES HERE AND WHAT LIVES ELSEWHERE. NS-P42 already proved the UI half
// of the reblog retirement in src/components/reblog/composeRetired.test.tsx:
// six affordances, every button on each surface clicked, no composer mounted.
// This file is about the layer underneath — the functions themselves — plus
// the one read surface NS-P42 did not cover, the lineage page, which is the
// only place a remix-created derivation is rendered.
//
// THESE TESTS ARE PART OF THE ROLLBACK. They assert the frozen behaviour
// directly rather than reading the flags and asserting conditionally, because
// a test that agrees with whatever the flag says proves nothing. Flipping
// REBLOG_COMPOSE_ENABLED or REMIX_CREATE_ENABLED back to true is therefore
// expected to revert the matching describe block with it; docs/retired-
// surfaces.md lists that as a step of each rollback.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

/**
 * The archive, as rows. A reblog and a two-generation lineage, both of the
 * kind that existed before the freeze and must keep resolving after it.
 */
const db = vi.hoisted(() => {
  const reblog = {
    id: "reblog-1",
    slug: "reblog-abc12345",
    reblogger_id: "author-2",
    original_post_id: "post-root",
    parent_reblog_id: null,
    root_original_post_id: "post-root",
    text: "Still worth reading.",
    media_kind: "none",
    media_url: null,
    like_count: 3,
    bookmark_count: 1,
    comment_count: 0,
    reblog_count: 0,
    created_at: "2026-06-01T09:00:00Z",
    deleted_at: null,
    excerpt_text: null,
  };
  return {
    reblog,
    rows: {
      reblogs: [reblog],
      profiles: [
        { id: "author-1", username: "original", display_name: "Original", avatar_url: null },
      ],
      content_items: [
        {
          id: "post-root",
          title: "Original prompt",
          slug: "original-prompt",
          post_type: "blueprint",
          cover_image_url: null,
          creator_id: "author-1",
          visibility: "public",
          status: "approved",
        },
      ],
      post_lineage: [{ root_post_id: "post-root" }],
      reblog_likes: [],
      reblog_bookmarks: [],
      content_blocks: [],
    } as Record<string, unknown[]>,
  };
});

/**
 * A per-table chainable stub: `.maybeSingle()`/`.single()` answer with the
 * first row, awaiting the chain answers with all of them. Enough for the read
 * functions to complete; the write functions never reach it, which is the
 * point of half these tests.
 */
vi.mock("@/integrations/supabase/client", () => {
  const chainFor = (table: string) => {
    const rows = db.rows[table] ?? [];
    const chain: Record<string, unknown> = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "maybeSingle" || prop === "single") {
            return () => Promise.resolve({ data: rows[0] ?? null, error: null });
          }
          if (prop === "then") {
            return (resolve: (v: unknown) => unknown) =>
              resolve({ data: rows, error: null, count: rows.length });
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
      rpc: () => Promise.resolve({ data: [], error: null }),
      storage: {
        from: () => ({
          upload: () => Promise.resolve({ error: null }),
          getPublicUrl: () => ({ data: { publicUrl: "https://example.test/m.jpg" } }),
        }),
      },
    },
  };
});

/** The lineage the page renders: an original and one remix of it. */
const LINEAGE = [
  {
    post_id: "post-root",
    parent_post_id: null,
    root_post_id: "post-root",
    title: "Original prompt",
    slug: "original-prompt",
    creator_id: "author-1",
    depth: 0,
  },
  {
    post_id: "post-remix",
    parent_post_id: "post-root",
    root_post_id: "post-root",
    title: "Remix of: Original prompt",
    slug: "remix-of-original-prompt",
    creator_id: "author-2",
    depth: 1,
  },
];

vi.mock("@/lib/progress", () => ({
  getPostLineage: () => Promise.resolve(LINEAGE),
}));

import {
  ReblogValidationError,
  createReblog,
  deleteReblog,
  generateReblogSlug,
  updateReblog,
  uploadReblogMedia,
} from "@/lib/reblog";
import { bookmarkReblog, likeReblog } from "@/lib/reblog";
import { getReblog } from "@/lib/reblog/getReblog";
import { getReblogsByUser } from "@/lib/reblog/getReblogsByUser";
import { getReblogsOfPost } from "@/lib/reblog/getReblogsOfPost";
import { checkExcerptStillValid } from "@/lib/reblog/checkExcerptStillValid";
import { createRemix } from "@/lib/remix/createRemix";
import { RemixValidationError } from "@/lib/remix/flags";
import Lineage from "@/pages/Lineage";

const REBLOG_MESSAGE = "Reblogging has been replaced by Rebuild.";

describe("frozen — reblog authoring throws instead of writing", () => {
  it.each([
    [
      "createReblog",
      () => createReblog({ rebloggerId: "author-2", originalPostId: "post-root", text: "hi" }),
    ],
    ["updateReblog", () => updateReblog({ reblogId: "reblog-1", userId: "author-2", text: "hi" })],
    ["deleteReblog", () => deleteReblog({ reblogId: "reblog-1", userId: "author-2" })],
    [
      "uploadReblogMedia",
      () =>
        uploadReblogMedia({
          rebloggerId: "author-2",
          reblogId: "reblog-1",
          file: new File(["x"], "x.png", { type: "image/png" }),
        }),
    ],
  ])("%s rejects with REBLOG_RETIRED", async (_name, call) => {
    await expect(call()).rejects.toMatchObject({
      name: "ReblogValidationError",
      code: "REBLOG_RETIRED",
      message: REBLOG_MESSAGE,
    });
    await expect(call()).rejects.toBeInstanceOf(ReblogValidationError);
  });

  // Synchronous, so it gets its own case rather than a promise assertion.
  it("generateReblogSlug throws REBLOG_RETIRED", () => {
    expect(() => generateReblogSlug()).toThrow(REBLOG_MESSAGE);
    try {
      generateReblogSlug();
      expect.unreachable("generateReblogSlug should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ReblogValidationError);
      expect((err as ReblogValidationError).code).toBe("REBLOG_RETIRED");
    }
  });

  // The gate is a call-time throw, not a module-time one: an import that stays
  // behind in a component or a script must keep type-checking and loading.
  it("importing the frozen functions is still valid", () => {
    for (const fn of [createReblog, updateReblog, deleteReblog, uploadReblogMedia]) {
      expect(typeof fn).toBe("function");
    }
  });
});

describe("frozen — remix creation throws instead of writing a lineage row", () => {
  it("createRemix rejects with REMIX_RETIRED", async () => {
    const call = () => createRemix({ sourcePostId: "post-root", remixerId: "author-2" });
    await expect(call()).rejects.toMatchObject({
      name: "RemixValidationError",
      code: "REMIX_RETIRED",
      message: "Remixing has been replaced by Rebuild.",
    });
    await expect(call()).rejects.toBeInstanceOf(RemixValidationError);
  });
});

describe("live — the reblog read path answers as it did", () => {
  it("getReblog resolves an archived reblog with its embedded original", async () => {
    const full = await getReblog({ slug: db.reblog.slug });
    expect(full?.id).toBe("reblog-1");
    expect(full?.text).toBe("Still worth reading.");
    expect(full?.embeddedOriginal?.title).toBe("Original prompt");
    expect(full?.embeddedOriginal?.unavailable).toBe(false);
  });

  it("getReblogsOfPost and getReblogsByUser still list", async () => {
    await expect(getReblogsOfPost({ postId: "post-root" })).resolves.toMatchObject({ total: 1 });
    await expect(getReblogsByUser({ userId: "author-2" })).resolves.toMatchObject({ total: 1 });
  });

  it("checkExcerptStillValid still checks", async () => {
    await expect(
      checkExcerptStillValid("reblog-1", "post-root", "Original prompt")
    ).resolves.toMatchObject({ isStillValid: true });
  });

  // Engagement on an existing reblog is deliberately outside the freeze: the
  // reblog is retired as a thing to WRITE, not as a thing to read and react to.
  it("liking and bookmarking an archived reblog still writes", async () => {
    await expect(likeReblog({ reblogId: "reblog-1", likerId: "viewer-1" })).resolves.toMatchObject({
      liked: true,
      newCount: 3,
    });
    await expect(
      bookmarkReblog({ reblogId: "reblog-1", bookmarkerId: "viewer-1" })
    ).resolves.toMatchObject({ bookmarked: true, newCount: 1 });
  });
});

describe("live — /b/:slug/lineage still renders a lineage created by remix", () => {
  it("draws the original and the remix derived from it", async () => {
    render(
      <HelmetProvider>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter initialEntries={["/b/original-prompt/lineage"]}>
            <Routes>
              <Route path="/b/:slug/lineage" element={<Lineage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </HelmetProvider>
    );

    await waitFor(() => expect(screen.getByText("Remix of: Original prompt")).toBeTruthy());
    // Both generations, and the handles that credit them.
    expect(screen.getAllByText("Original prompt").length).toBeGreaterThan(0);
    expect(screen.getByText("@original")).toBeTruthy();
    // No tombstone in place of the retired button: the page is unchanged, not
    // annotated with its own retirement.
    expect(screen.queryByText(/remix(ing)? (is|has been) (retired|disabled)/i)).toBeNull();
  });
});
