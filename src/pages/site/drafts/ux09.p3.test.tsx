// UX-09 Part 3: a draft made inside a reply shows `For @maya's topic` in --label under its title. The topic is read beside the
// drafts (listDraftTopics: one request, the same round), and a missing column (the migration not yet applied) reads as no lines.

import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fromTable = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (t: string) => fromTable(t) } }));

import { listDraftTopics } from "@/lib/build/drafts";

import { draftForLine, withTopics } from "./draftsModel";

let result: { data: unknown; error: unknown };
const calls: unknown[][] = [];

beforeEach(() => {
  result = { data: [], error: null };
  calls.length = 0;
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "not"]) query[method] = (...args: unknown[]) => (calls.push([method, ...args]), query);
  query.limit = (...args: unknown[]) => (calls.push(["limit", ...args]), Promise.resolve(result));
  fromTable.mockReset().mockImplementation((table: string) => (calls.push(["from", table]), query));
});

describe("listDraftTopics", () => {
  it("is one request for this maker's drafts made in a topic, with the topic's author", async () => {
    result = {
      data: [
        { id: "d1", topic: { id: "t1", author: { username: "maya" } } },
        { id: "d2", topic: { id: "t2", author: [{ username: "kit" }] } },
        { id: "d3", topic: null },
      ],
      error: null,
    };
    const topics = await listDraftTopics("u1");
    expect(calls[0]).toEqual(["from", "builds"]);
    expect(String(calls[1]?.[1])).toContain("topic:openbuild_posts!builds_made_for_topic_id_fkey(id, author:profiles!openbuild_posts_author_id_fkey(username))");
    expect(calls).toContainEqual(["eq", "creator_id", "u1"]);
    expect(calls).toContainEqual(["eq", "status", "draft"]);
    expect(calls).toContainEqual(["not", "made_for_topic_id", "is", null]);
    expect(calls.some((call) => call[0] === "limit")).toBe(true);
    expect([...topics]).toEqual([
      ["d1", { topicId: "t1", handle: "maya" }],
      ["d2", { topicId: "t2", handle: "kit" }],
    ]);
  });

  it("reads as no lines while the column is missing", async () => {
    result = { data: null, error: { code: "42703", message: "column builds.made_for_topic_id does not exist" } };
    await expect(listDraftTopics("u1")).resolves.toEqual(new Map());
    result = { data: null, error: { code: "PGRST200", message: "no relationship" } };
    await expect(listDraftTopics("u1")).resolves.toEqual(new Map());
  });

  it("throws any other refusal", async () => {
    result = { data: null, error: { code: "57014", message: "timeout" } };
    await expect(listDraftTopics("u1")).rejects.toThrow();
  });

  it("asks nothing signed out", async () => {
    await expect(listDraftTopics(null)).resolves.toEqual(new Map());
    expect(fromTable).not.toHaveBeenCalled();
  });
});

describe("the line", () => {
  it("says For @maya's topic", () => {
    expect(draftForLine({ madeFor: { topicId: "t1", handle: "maya" } })).toBe("For @maya's topic");
    expect(draftForLine({ madeFor: null })).toBeNull();
    expect(draftForLine({})).toBeNull();
  });

  it("is merged into the drafts it belongs to", () => {
    const drafts = [{ id: "d1", title: "Reply: a", updatedAt: "", sessionCount: 1 }, { id: "d2", title: "b", updatedAt: "", sessionCount: 0 }];
    const merged = withTopics(drafts, new Map([["d1", { topicId: "t1", handle: "maya" }]]));
    expect(merged.map((draft) => draft.madeFor ?? null)).toEqual([{ topicId: "t1", handle: "maya" }, null]);
    expect(withTopics(drafts, undefined)).toEqual(drafts);
  });

  it("is drawn under the title in --label", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    const { DraftsView } = await import("./DraftsView");
    const { draftsViewProps } = await import("@/dev/fixtures/drafts");
    const drafts = [{ id: "d1", title: "Reply: a", updatedAt: "2026-11-01T00:00:00Z", sessionCount: 1, madeFor: { topicId: "t1", handle: "maya" } }];
    const tree = (
      <MemoryRouter>
        <DraftsView {...draftsViewProps()} drafts={drafts} />
      </MemoryRouter>
    );
    render(tree);
    const row = screen.getByTestId("draft-row");
    const line = within(row).getByTestId("draft-for-topic");
    expect(line.textContent).toBe("For @maya's topic");
    expect(line.previousElementSibling?.getAttribute("data-testid")).toBe("draft-title");
    // jsdom drops var() colours from live styles; the markup keeps them.
    const { renderToStaticMarkup } = await import("react-dom/server");
    expect(renderToStaticMarkup(tree)).toMatch(/data-testid="draft-for-topic" style="[^"]*color:var\(--label/);
  });
});
