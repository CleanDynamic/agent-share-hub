import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const getUser = vi.fn();
const fromTable = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (t: string) => fromTable(t), auth: { getSession: () => getSession(), getUser: () => getUser() } },
}));

import { listDraftsWithSessions } from "./drafts";

const row = (id: string, title: string, session_count: number | null) => ({ id, title, updated_at: `2026-10-0${id}T00:00:00Z`, session_count });

let result: { data: unknown; error: unknown };
const calls: Array<[string, ...unknown[]]> = [];
const select = vi.fn();

beforeEach(() => {
  result = { data: [], error: null };
  calls.length = 0;
  getSession.mockReset();
  getUser.mockReset();
  select.mockReset();
  const query: Record<string, unknown> = {
    eq: (...args: unknown[]) => (calls.push(["eq", ...args]), query),
    order: (...args: unknown[]) => (calls.push(["order", ...args]), query),
    limit: (...args: unknown[]) => (calls.push(["limit", ...args]), Promise.resolve(result)),
  };
  select.mockImplementation(() => query);
  fromTable.mockReset();
  fromTable.mockImplementation(() => ({ select }));
});

describe("listDraftsWithSessions", () => {
  it("is one request: the title, the date and the count, for this maker's drafts, newest first, at most fifty", async () => {
    result = { data: [row("1", "One", 2), row("2", "Two", null)], error: null };

    const list = await listDraftsWithSessions("u1");

    expect(fromTable.mock.calls.map((c) => c[0])).toEqual(["builds"]);
    expect(select).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith("id, title, updated_at, session_count");
    expect(calls).toEqual([
      ["eq", "creator_id", "u1"],
      ["eq", "status", "draft"],
      ["order", "updated_at", { ascending: false }],
      ["limit", 50],
    ]);
    expect(list).toEqual([
      { id: "1", title: "One", updatedAt: "2026-10-01T00:00:00Z", sessionCount: 2 },
      { id: "2", title: "Two", updatedAt: "2026-10-02T00:00:00Z", sessionCount: 0 },
    ]);
  });

  it("asks for no post and no making: the long columns are not in the list", async () => {
    await listDraftsWithSessions("u1");
    const columns = String(select.mock.calls[0][0]);
    expect(columns).not.toMatch(/post_doc|making|\*/);
  });

  it("takes the maker from the caller and never asks the auth server who they are", async () => {
    await listDraftsWithSessions("u1");
    expect(getSession).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("is empty, and asks for nothing, when nobody is signed in", async () => {
    expect(await listDraftsWithSessions(null)).toEqual([]);
    expect(fromTable).not.toHaveBeenCalled();
  });

  it("throws when the read fails", async () => {
    result = { data: null, error: { message: "x" } };
    await expect(listDraftsWithSessions("u1")).rejects.toThrow(/listDraftsWithSessions/);
  });
});
