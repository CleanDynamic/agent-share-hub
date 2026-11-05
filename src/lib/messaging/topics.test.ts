// Topics in messages, the data layer (UX-09 Q4).
//
// The claims: the thread is the one direct thread between the two people (createDirectThread, never a thread per topic); a topic
// message is a text message carrying shared_post_id, with its note and a "Shared a topic" preview; a thread's topic cards are read in
// one request, roots only; and neither a note nor a topic's words reach an error.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
  builder: number;
}

let calls: Recorded[] = [];
let builders = 0;
let answer: (table: string, own: Recorded[]) => { data: unknown; error: unknown; status?: number } = () => ({ data: [], error: null });
let session: { user: { id: string } } | null = { user: { id: "reader-1" } };

function builder(table: string) {
  const id = (builders += 1);
  const mine = () => calls.filter((call) => call.builder === id);
  const self: Record<string, unknown> = {};
  for (const method of ["select", "insert", "update", "eq", "in", "order", "limit"]) {
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

const direct = vi.hoisted(() => ({ createDirectThread: vi.fn(async (_other: string) => "thread-1") }));
vi.mock("./createDirectThread", () => direct);

import { getSharedTopics, isTopicShareState, openTopicThread, sendTopicMessage } from "./topics";
import { SocialError } from "@/lib/social";

const callsOf = (table: string, method: string) => calls.filter((call) => call.table === table && call.method === method);

beforeEach(() => {
  calls = [];
  builders = 0;
  session = { user: { id: "reader-1" } };
  answer = () => ({ data: [], error: null });
  direct.createDirectThread.mockClear();
});

describe("openTopicThread", () => {
  it("opens the one direct thread with the topic's author", async () => {
    await expect(openTopicThread("maya")).resolves.toBe("thread-1");
    expect(direct.createDirectThread).toHaveBeenCalledWith("maya");
  });

  it("asks a signed-out reader to sign in, and makes no thread", async () => {
    session = null;
    await expect(openTopicThread("maya")).rejects.toMatchObject({ kind: "no_access" });
    expect(direct.createDirectThread).not.toHaveBeenCalled();
  });
});

describe("sendTopicMessage", () => {
  it("sends a text message carrying the topic, its note, and says so in the thread's preview", async () => {
    await sendTopicMessage("thread-1", "topic-1", "  have a look  ");
    expect(callsOf("dm_messages", "insert")[0].args[0]).toEqual({
      thread_id: "thread-1",
      sender_id: "reader-1",
      kind: "text",
      message_type: "text",
      body: "have a look",
      text_content: "have a look",
      shared_post_id: "topic-1",
    });
    expect(callsOf("dm_threads", "update")[0].args[0]).toMatchObject({ last_message_preview: "Shared a topic", last_message_sender_id: "reader-1" });
    expect(callsOf("dm_threads", "eq")[0].args).toEqual(["id", "thread-1"]);
  });

  it("sends no words when there is no note, and keeps the note out of an error", async () => {
    answer = (table) => (table === "dm_messages" ? { data: null, error: { code: "42501" }, status: 403 } : { data: [], error: null });
    const error = await sendTopicMessage("thread-1", "topic-1", "private words").catch((caught) => caught);
    expect(error).toBeInstanceOf(SocialError);
    expect(String(error.message)).not.toContain("private words");
    calls = [];
    answer = () => ({ data: [], error: null });
    await sendTopicMessage("thread-1", "topic-1");
    expect(callsOf("dm_messages", "insert")[0].args[0]).toMatchObject({ body: null, text_content: null });
  });
});

describe("getSharedTopics", () => {
  it("reads every card in one request, roots only, named by heading and author", async () => {
    answer = () => ({
      data: [
        { id: "topic-1", parent_id: null, body: "Speaker names from audio\nmore words", author: { username: "maya" } },
        { id: "reply-1", parent_id: "topic-1", body: "a reply", author: { username: "kit" } },
        { id: "topic-2", parent_id: null, body: "", author: [{ username: null }] },
      ],
      error: null,
    });
    const topics = await getSharedTopics(["topic-1", "reply-1", "topic-2", "topic-1"]);
    expect(callsOf("openbuild_posts", "request")).toHaveLength(1);
    expect(callsOf("openbuild_posts", "in")[0].args).toEqual(["id", ["topic-1", "reply-1", "topic-2"]]);
    expect(callsOf("openbuild_posts", "limit")[0].args).toEqual([3]);
    expect([...topics.values()]).toEqual([
      { id: "topic-1", heading: "Speaker names from audio", handle: "maya" },
      { id: "topic-2", heading: "A topic", handle: null },
    ]);
  });

  it("asks nothing for no topics", async () => {
    await expect(getSharedTopics([])).resolves.toEqual(new Map());
    expect(calls).toEqual([]);
  });
});

describe("isTopicShareState", () => {
  it("knows the router state a topic arrives in", () => {
    expect(isTopicShareState({ shareTopic: { id: "topic-1", label: "Speaker names" } })).toBe(true);
    expect(isTopicShareState(null)).toBe(false);
    expect(isTopicShareState({ shareTopic: { id: 1 } })).toBe(false);
  });
});
