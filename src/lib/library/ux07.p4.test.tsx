// UX-07 P4: Save on a topic keeps it in the saver's Library (saved_items, kind 'post'), and nobody else sees a save.
//
// The data layer is driven through a recording fake of the client, as savedItems.test.ts drives it: a save inserts the reader's own
// row of kind 'post', an unsave deletes it, and the Library's Topics kind lists exactly those rows.

import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
  builder: number;
}

let calls: Recorded[] = [];
let builders = 0;
let rows: { id: string; user_id: string; kind: string; ref: string | null; snapshot: unknown }[] = [];
const session = { user: { id: "reader-1" } };

function builder(table: string) {
  const id = (builders += 1);
  const mine = () => calls.filter((call) => call.builder === id);
  const self: Record<string, unknown> = {};
  for (const method of ["select", "insert", "update", "delete", "eq", "in", "order", "limit", "range", "single", "maybeSingle", "is"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ table, method, args, builder: id });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown) => {
    const own = mine();
    const eq = (column: string) => own.find((call) => call.method === "eq" && call.args[0] === column)?.args[1];
    let data: unknown = [];
    if (table === "openbuild_posts") data = { id: "t1", root_id: "t1", parent_id: null, body: "Which model for a code review step?\nMore words", author: { username: "maya" } };
    if (table === "saved_items") {
      const insert = own.find((call) => call.method === "insert");
      const remove = own.find((call) => call.method === "delete");
      if (insert) rows.push({ id: `s${rows.length + 1}`, ...(insert.args[0] as Omit<(typeof rows)[number], "id">) });
      else if (remove) rows = rows.filter((row) => !(row.id === eq("id") && row.user_id === eq("user_id")));
      else data = rows.filter((row) => row.user_id === eq("user_id") && (!eq("kind") || row.kind === eq("kind"))).map((row) => ({ ...row, build_id: null, source_version: null, note: null, created_at: "2026-11-04T10:00:00Z", last_used_at: "2026-11-04T10:00:00Z" }));
    }
    return Promise.resolve({ data, error: null, status: 200 }).then(resolve);
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => builder(table), auth: { getSession: vi.fn(async () => ({ data: { session } })) } },
}));
vi.mock("@/lib/build/builds", () => ({ getBuildHeader: vi.fn(async () => null) }));
vi.mock("@/lib/build/nodes", () => ({ getNodeTree: vi.fn(async () => []), readNodeRows: vi.fn(async () => []) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, isLoggedIn: false, loading: false }) }));

import { PostCard } from "@/components/post/PostCard";
import type { PostCardData } from "@/components/post/postCardModel";
import { listSavedItems, saveItem, unsaveItem } from "./savedItems";
import { LIBRARY_KINDS, savedKindOf } from "@/pages/site/library/libraryModel";

beforeEach(() => {
  calls = [];
  builders = 0;
  rows = [];
});
afterEach(cleanup);

const topicsKind = () => savedKindOf("topics") ?? undefined;
const libraryTopics = async () => (await listSavedItems({ kind: topicsKind() })).items;

describe("UX-07 P4: saving a topic", () => {
  it("is one more kind in the Library, named Topics, reading saved_items of kind 'post'", () => {
    expect(LIBRARY_KINDS.at(-1)).toEqual({ value: "topics", label: "Topics" });
    expect(savedKindOf("topics")).toBe("post");
  });

  it("toggles the topic's Library entry: saved, it is listed; unsaved, it is gone", async () => {
    expect(await libraryTopics()).toEqual([]);
    await saveItem({ kind: "post", ref: "t1" });
    const insert = calls.find((call) => call.table === "saved_items" && call.method === "insert");
    expect(insert?.args[0]).toMatchObject({ user_id: "reader-1", kind: "post", ref: "t1", build_id: null, snapshot: { title: "Which model for a code review step?", rootId: "t1", authorHandle: "maya" } });
    const listed = await libraryTopics();
    expect(listed.map((item) => [item.kind, item.ref])).toEqual([["post", "t1"]]);

    await unsaveItem(listed[0].id);
    expect(await libraryTopics()).toEqual([]);
  });

  it("reads only the saver's own rows", async () => {
    await saveItem({ kind: "post", ref: "t1" });
    await libraryTopics();
    const list = calls.filter((call) => call.table === "saved_items" && call.method === "eq");
    expect(list.some((call) => call.args[0] === "user_id" && call.args[1] === "reader-1")).toBe(true);
  });
});

describe("UX-07 P4: nobody but the saver sees a save", () => {
  const card: PostCardData = {
    id: "t1",
    to: "/openbuilds/topics/t1",
    author: { id: "maya", name: "Maya Chen", handle: "maya", avatarUrl: null },
    age: "2h",
    spaces: [],
    reward: null,
    heading: "Which model for a code review step?",
    text: "More words",
    attachments: [],
    stillOpen: false,
    tags: [],
    closes: null,
    replies: null,
    pinned: false,
    hidden: null,
    engagementBuild: null,
  };

  it("gives the topic's Save no count, saved or not, whoever is looking", () => {
    render(
      <MemoryRouter>
        <PostCard card={card} topic={{ likes: 3, liked: false, onLike: () => undefined, replies: 2, onReply: () => undefined, save: { saved: true, onSave: () => undefined } }} />
      </MemoryRouter>,
    );
    const save = screen.getByRole("button", { name: "Unsave" });
    expect(save.getAttribute("aria-pressed")).toBe("true");
    expect(save.querySelector("[data-engagement-count]")).toBeNull();
    expect(within(screen.getByTestId("engagement-row")).queryByText(/saves?\b/i)).toBeNull();
  });

  it("draws the Library's compact card with the head, the heading and the first attachment only", () => {
    render(
      <MemoryRouter>
        <PostCard compact card={{ ...card, attachments: [{ kind: "line", key: "a", text: "Session · Claude Code · 3 prompts" }, { kind: "line", key: "b", text: "Second" }], tags: ["review"] }} topic={{ likes: 0, liked: false, onLike: () => undefined, replies: 0, onReply: () => undefined }} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Which model for a code review step?" })).toBeTruthy();
    expect(screen.getByText("Session · Claude Code · 3 prompts")).toBeTruthy();
    expect(screen.queryByText("Second")).toBeNull();
    expect(screen.queryByText("More words")).toBeNull();
    expect(screen.queryByText("#review")).toBeNull();
    expect(screen.queryByTestId("engagement-row")).toBeNull();
  });
});
