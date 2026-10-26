// SV-03 P2: "Remove empty drafts (N)". A draft is empty when it has no title, no sessions, no tiles, no files and no post;
// removing them is one delete, and it takes nothing else.

import { beforeEach, describe, expect, it, vi } from "vitest";

const reads: Array<[string, ...unknown[]]> = [];
const deletes: Array<[string, ...unknown[]]> = [];
let rows: unknown[] = [];
let removed: Array<{ id: string }> = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: (columns: string) => {
        reads.push(["select", columns]);
        const query: Record<string, unknown> = {
          eq: (...args: unknown[]) => (reads.push(["eq", ...args]), query),
          or: (...args: unknown[]) => (reads.push(["or", ...args]), query),
          limit: (...args: unknown[]) => (reads.push(["limit", ...args]), Promise.resolve({ data: rows, error: null })),
        };
        return query;
      },
      delete: () => {
        deletes.push(["delete"]);
        const query: Record<string, unknown> = {
          in: (...args: unknown[]) => (deletes.push(["in", ...args]), query),
          eq: (...args: unknown[]) => (deletes.push(["eq", ...args]), query),
          select: (...args: unknown[]) => (deletes.push(["select", ...args]), Promise.resolve({ data: removed, error: null })),
        };
        return query;
      },
    }),
  },
}));

import { isEmptyPost, listEmptyDraftIds, removeEmptyDrafts } from "./drafts";

const draft = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: "Untitled build",
  session_count: 0,
  post_doc: null,
  build_nodes: [{ count: 0 }],
  build_media: [{ count: 0 }],
  ...extra,
});

const doc = (...content: unknown[]) => ({ type: "doc", content });
const paragraph = (text?: string) => ({ type: "paragraph", content: text ? [{ type: "text", text }] : undefined });

beforeEach(() => {
  reads.length = 0;
  deletes.length = 0;
  rows = [];
  removed = [];
});

describe("isEmptyPost", () => {
  it("is empty for no post, an empty document and a document of blank paragraphs", () => {
    expect(isEmptyPost(null)).toBe(true);
    expect(isEmptyPost(undefined)).toBe(true);
    expect(isEmptyPost(doc())).toBe(true);
    expect(isEmptyPost(doc(paragraph(), paragraph("   ")))).toBe(true);
  });

  it("is not empty with words, or with anything that is not a paragraph", () => {
    expect(isEmptyPost(doc(paragraph("hello")))).toBe(false);
    expect(isEmptyPost(doc({ type: "mediaGrid", attrs: {} }))).toBe(false);
  });
});

describe("listEmptyDraftIds", () => {
  it("asks for this maker's untitled drafts with no sessions, with their counts, and keeps those with nothing in them", async () => {
    rows = [
      draft("empty"),
      draft("blank-title", { title: "" }),
      draft("has-post", { post_doc: doc(paragraph("words")) }),
      draft("has-tile", { build_nodes: [{ count: 2 }] }),
      draft("has-file", { build_media: [{ count: 1 }] }),
      draft("blank-post", { post_doc: doc(paragraph()) }),
    ];

    expect(await listEmptyDraftIds("u1")).toEqual(["empty", "blank-title", "blank-post"]);
    expect(reads).toEqual([
      ["select", "id, title, session_count, post_doc, build_nodes!build_nodes_build_id_fkey(count), build_media!build_media_build_id_fkey(count)"],
      ["eq", "creator_id", "u1"],
      ["eq", "status", "draft"],
      ["eq", "session_count", 0],
      ["or", "title.eq.,title.eq.Untitled build"],
      ["limit", 200],
    ]);
  });

  it("is empty for nobody signed in", async () => {
    expect(await listEmptyDraftIds(null)).toEqual([]);
    expect(reads).toEqual([]);
  });
});

describe("removeEmptyDrafts", () => {
  it("is one delete of the drafts that are empty now, scoped to this maker's drafts, and returns how many went", async () => {
    rows = [draft("empty"), draft("has-tile", { build_nodes: [{ count: 1 }] })];
    removed = [{ id: "empty" }];

    expect(await removeEmptyDrafts("u1")).toBe(1);
    expect(deletes).toEqual([["delete"], ["in", "id", ["empty"]], ["eq", "creator_id", "u1"], ["eq", "status", "draft"], ["select", "id"]]);
  });

  it("deletes nothing when nothing is empty", async () => {
    rows = [draft("has-tile", { build_nodes: [{ count: 1 }] })];
    expect(await removeEmptyDrafts("u1")).toBe(0);
    expect(deletes).toEqual([]);
  });
});
