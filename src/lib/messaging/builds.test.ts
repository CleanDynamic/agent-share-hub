// Builds in messages, the data layer (RC-P20).
//
// The claims: the picker's list is the reader's own published builds and
// their saves, merged, most recent first, each once, at most twenty, in three
// requests; the search box's words are normalised and matched literally; a
// build message is a text message carrying shared_build_id; and neither a
// note nor a search reaches an error.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
  builder: number;
}

let calls: Recorded[] = [];
let builders = 0;
let answer: (table: string, own: Recorded[]) => { data: unknown; error: unknown; status?: number } = () => ({
  data: [],
  error: null,
});
let session: { user: { id: string } } | null = { user: { id: "reader-1" } };

function builder(table: string) {
  const id = (builders += 1);
  const mine = () => calls.filter((call) => call.builder === id);
  const self: Record<string, unknown> = {};
  for (const method of ["select", "insert", "update", "eq", "in", "ilike", "order", "limit"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ table, method, args, builder: id });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
    calls.push({ table, method: "request", args: [], builder: id });
    return Promise.resolve(answer(table, mine())).then(resolve, reject);
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => builder(table),
    auth: { getSession: vi.fn(async () => ({ data: { session } })) },
  },
}));

import { SHAREABLE_BUILDS_MAX, listShareableBuilds, sendBuildMessage } from "@/lib/messaging/builds";
import { SocialError } from "@/lib/social";

const requests = () => calls.filter((call) => call.method === "request");
const callsOf = (table: string, method: string) => calls.filter((call) => call.table === table && call.method === method);

beforeEach(() => {
  calls = [];
  builders = 0;
  session = { user: { id: "reader-1" } };
  answer = () => ({ data: [], error: null });
});

describe("listShareableBuilds", () => {
  it("merges the reader's own builds and saves, newest first, each once, in three requests", async () => {
    answer = (table, own) => {
      if (table === "build_saves") {
        return {
          data: [
            { build_id: "saved-1", created_at: "2026-09-29T10:00:00.000Z" },
            { build_id: "own-1", created_at: "2026-09-20T10:00:00.000Z" },
          ],
          error: null,
        };
      }
      const selected = String(own.find((call) => call.method === "select")?.args[0]);
      if (selected.includes("published_at")) {
        return {
          data: [
            { id: "own-1", slug: "own-1", title: "My build", published_at: "2026-09-25T10:00:00.000Z", created_at: "2026-09-01T00:00:00.000Z" },
            { id: "own-2", slug: "own-2", title: "  ", published_at: null, created_at: "2026-09-02T00:00:00.000Z" },
          ],
          error: null,
        };
      }
      return {
        data: [
          { id: "saved-1", slug: "saved-1", title: "Their build" },
          { id: "own-1", slug: "own-1", title: "My build" },
        ],
        error: null,
      };
    };

    const list = await listShareableBuilds();

    expect(requests()).toHaveLength(3);
    expect(list.map((item) => [item.id, item.source])).toEqual([
      ["saved-1", "saved"],
      ["own-1", "yours"],
      ["own-2", "yours"],
    ]);
    expect(list[2].title).toBe("Untitled build");
    const own = callsOf("builds", "eq").map((call) => call.args);
    expect(own).toContainEqual(["creator_id", "reader-1"]);
    expect(callsOf("builds", "in")[0]?.args).toEqual(["status", ["published", "gallery"]]);
    for (const limit of callsOf("builds", "limit").concat(callsOf("build_saves", "limit")).slice(0, 2)) {
      expect(limit.args[0]).toBeLessThanOrEqual(SHAREABLE_BUILDS_MAX);
    }
  });

  it("shows twenty at most", async () => {
    answer = (table, own) => {
      if (table === "build_saves") return { data: [], error: null };
      const selected = String(own.find((call) => call.method === "select")?.args[0]);
      return selected.includes("published_at")
        ? {
            data: Array.from({ length: 25 }, (_, index) => ({
              id: `b-${index}`,
              slug: `b-${index}`,
              title: `Build ${index}`,
              published_at: `2026-09-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
              created_at: "2026-08-01T00:00:00.000Z",
            })),
            error: null,
          }
        : { data: [], error: null };
    };
    expect(await listShareableBuilds()).toHaveLength(20);
  });

  it("normalises the search and matches it as words, not as a pattern", async () => {
    await listShareableBuilds({ query: "  100%   done_ " });
    const patterns = calls.filter((call) => call.method === "ilike").map((call) => call.args);
    expect(patterns[0]).toEqual(["title", "%100\\% done\\_%"]);
  });

  it("asks nothing of a reader who is not signed in", async () => {
    session = null;
    await expect(listShareableBuilds()).rejects.toMatchObject({ kind: "no_access" });
    expect(requests()).toHaveLength(0);
  });
});

describe("sendBuildMessage", () => {
  it("sends a text message carrying the build and its note, and says so in the thread's preview", async () => {
    await sendBuildMessage("thread-1", "build-7", "  This one works  ");

    expect(callsOf("dm_messages", "insert")[0]?.args[0]).toEqual({
      thread_id: "thread-1",
      sender_id: "reader-1",
      kind: "text",
      message_type: "text",
      body: "This one works",
      text_content: "This one works",
      shared_build_id: "build-7",
    });
    expect(callsOf("dm_threads", "update")[0]?.args[0]).toMatchObject({ last_message_preview: "Shared a build" });
  });

  it("never puts the note in an error", async () => {
    const note = "the password is hunter2";
    answer = (table) =>
      table === "dm_messages"
        ? { data: null, error: { code: "42501", message: `new row ... (${note})`, details: note }, status: 403 }
        : { data: null, error: null };

    const error = (await sendBuildMessage("thread-1", "build-7", note).catch((e) => e)) as SocialError;
    expect(error).toBeInstanceOf(SocialError);
    expect(error.message).not.toContain("hunter2");
    expect(JSON.stringify({ ...error })).not.toContain("hunter2");
  });
});
