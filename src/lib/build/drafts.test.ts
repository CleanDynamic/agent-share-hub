import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const fromTable = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (t: string) => fromTable(t), auth: { getSession: () => getSession() } },
}));

const listDraftBuildsByCreator = vi.fn();
vi.mock("./builds", () => ({
  listDraftBuildsByCreator: (...a: unknown[]) => listDraftBuildsByCreator(...a),
}));

import { listDraftsWithSessions } from "./drafts";

const draft = (id: string, title: string) => ({ id, title, updated_at: `2026-10-0${id}T00:00:00Z` });

let countResult: { data: unknown; error: unknown };
const limit = vi.fn();
const inFn = vi.fn();
const select = vi.fn();

beforeEach(() => {
  countResult = { data: [], error: null };
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } }, error: null });
  listDraftBuildsByCreator.mockReset();
  limit.mockReset();
  limit.mockImplementation(() => Promise.resolve(countResult));
  inFn.mockReset();
  inFn.mockImplementation(() => ({ limit }));
  select.mockReset();
  select.mockImplementation(() => ({ in: inFn }));
  fromTable.mockReset();
  fromTable.mockImplementation(() => ({ select }));
});

describe("listDraftsWithSessions", () => {
  it("lists fifty drafts and joins session_count, reading nothing from content tables", async () => {
    listDraftBuildsByCreator.mockResolvedValue([draft("1", "One"), draft("2", "Two")]);
    countResult = { data: [{ id: "1", session_count: 2 }, { id: "2", session_count: null }], error: null };

    const list = await listDraftsWithSessions();

    expect(listDraftBuildsByCreator).toHaveBeenCalledWith("u1", { limit: 50 });
    expect(fromTable.mock.calls.map((c) => c[0])).toEqual(["builds"]);
    expect(select).toHaveBeenCalledWith("id, session_count");
    expect(inFn).toHaveBeenCalledWith("id", ["1", "2"]);
    expect(limit).toHaveBeenCalledWith(2);
    expect(list).toEqual([
      { id: "1", title: "One", updatedAt: "2026-10-01T00:00:00Z", sessionCount: 2 },
      { id: "2", title: "Two", updatedAt: "2026-10-02T00:00:00Z", sessionCount: 0 },
    ]);
  });

  it("is empty, and asks for no counts, when there are no drafts or nobody is signed in", async () => {
    listDraftBuildsByCreator.mockResolvedValue([]);
    expect(await listDraftsWithSessions()).toEqual([]);
    expect(fromTable).not.toHaveBeenCalled();

    getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await listDraftsWithSessions()).toEqual([]);
    expect(listDraftBuildsByCreator).toHaveBeenCalledTimes(1);
  });

  it("counts a draft missing from the count read as zero, and throws when the read fails", async () => {
    listDraftBuildsByCreator.mockResolvedValue([draft("1", "One")]);
    expect((await listDraftsWithSessions())[0].sessionCount).toBe(0);
    countResult = { data: null, error: { message: "x" } };
    await expect(listDraftsWithSessions()).rejects.toThrow(/counts/);
  });
});
