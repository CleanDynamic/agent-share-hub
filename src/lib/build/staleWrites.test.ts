// CA-23 P4, on supabase-js with only the network faked (CA-08's fake): a write that would undo a change made elsewhere is refused,
// merged where the two changed different things, and handed over as a clash where they changed the same thing.
//
// builds: `.eq("updated_at", known)`, so a stale write changes no rows. build_nodes: no `updated_at`, so the row is read inside the
// write and compared with what the tab knew.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("./__audit__/fakeSupabase")).clientModule);

import { REPO_SCHEMA, requests, startAuditBackend, tableRows, type Row } from "./__audit__/fakeSupabase";
import { getBuild, updateBuild } from "./builds";
import { patchMaking } from "./making";
import { upsertNode } from "./nodes";
import { writeNodeRows } from "./sessionEdit";
import { flatNodes, knownStamp, noteRecord, watchBuild, type RawClash } from "./staleWrites";
import type { BuildNode, BuildPatch } from "./types";

const DRAFT = "0d0d0d0d-0000-4000-8000-000000000001";
const NODE = "0a0a0a0a-0000-4000-8000-000000000001";

const session = (title: string) => ({ tool: "claude", date: "2026-10-24", title });

function open(seed?: (rows: Record<string, Row[]>) => void) {
  startAuditBackend({
    schema: REPO_SCHEMA,
    seed: (rows) => {
      const draft = rows.builds.find((row) => row.id === DRAFT) as Row;
      draft.making = { sessions_meta: { s1: session("Alpha"), s2: session("Two") }, workstreams: [{ key: "ws-a", name: "A" }], session_order: ["s1", "s2"] };
      draft.post_doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Base post" }] }] };
      rows.build_nodes.push({ id: NODE, build_id: DRAFT, parent_id: null, position: 0, type: "prompt", title: null, note: null, payload: { text: "base text", session: "s1" }, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-24T19:00:00Z" });
      seed?.(rows);
    },
  });
}

const clashes: RawClash[] = [];
let stop = () => undefined as void;

async function read() {
  stop = watchBuild(DRAFT, (clash) => void clashes.push(clash));
  const record = await getBuild(DRAFT);
  if (!record) throw new Error("no record");
  noteRecord(DRAFT, { build: record.build as unknown as Record<string, unknown>, tree: flatNodes(record.tree) });
  return record;
}

/** Somebody else changes the row, at a moment of their own. */
const elsewhere = (change: Row) => {
  const row = tableRows("builds").find((candidate) => candidate.id === DRAFT) as Row;
  Object.assign(row, change, { updated_at: new Date(Date.now() + 5_000).toISOString() });
};
const elsewhereNode = (payload: Record<string, unknown>) => {
  const row = tableRows("build_nodes").find((candidate) => candidate.id === NODE) as Row;
  row.payload = { ...(row.payload as object), ...payload };
};
const build = () => tableRows("builds").find((row) => row.id === DRAFT) as Row;
const node = () => tableRows("build_nodes").find((row) => row.id === NODE) as Row;

beforeEach(() => {
  clashes.length = 0;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  stop();
  vi.restoreAllMocks();
});

describe("the build's row: updated_at", () => {
  it("writes with the stamp it knows, and moves on to the stamp the write left", async () => {
    open();
    await read();
    const first = knownStamp(DRAFT);
    const row = await updateBuild(DRAFT, { title: "Mine" } as BuildPatch);
    expect(row.title).toBe("Mine");
    const patch = requests().find((request) => request.method === "PATCH" && request.path.includes("/builds"));
    expect(patch?.path).toContain("updated_at=eq.");
    expect(knownStamp(DRAFT)).toBe(row.updated_at);
    expect(knownStamp(DRAFT)).not.toBe(first);
  });

  it("refuses a stale write: nothing is changed, and what the other place wrote stands", async () => {
    open();
    await read();
    elsewhere({ title: "Theirs" });
    const row = await updateBuild(DRAFT, { title: "Mine" } as BuildPatch);
    expect(build().title).toBe("Theirs");
    expect(row.title).toBe("Theirs");
    // The first try changed no rows (406, PGRST116); nothing else was written.
    const patches = requests().filter((request) => request.method === "PATCH" && request.path.includes("/builds"));
    expect(patches.map((request) => request.status)).toEqual([406]);
    expect(clashes).toHaveLength(1);
    expect(clashes[0]).toMatchObject({ kind: "field", key: "title", fields: [{ key: "title", mine: "Mine", theirs: "Theirs" }] });
  });

  it("settles a clash by writing the version asked for, over the build as it stands", async () => {
    open();
    await read();
    elsewhere({ title: "Theirs" });
    await updateBuild(DRAFT, { title: "Mine" } as BuildPatch);
    await clashes[0].write("mine");
    expect(build().title).toBe("Mine");
    await clashes[0].write("theirs");
    expect(build().title).toBe("Theirs");
  });

  it("merges what the two places changed apart: both stay, no clash", async () => {
    open();
    await read();
    elsewhere({ title: "Theirs" });
    const row = await updateBuild(DRAFT, { outcome: "Mine" } as BuildPatch);
    expect(row.title).toBe("Theirs");
    expect(build()).toMatchObject({ title: "Theirs", outcome: "Mine" });
    expect(clashes).toHaveLength(0);
  });

  it("is not fooled by a bump that changed nothing (a trigger moved updated_at): the write goes after it", async () => {
    open();
    await read();
    elsewhere({});
    await updateBuild(DRAFT, { title: "Mine" } as BuildPatch);
    expect(build().title).toBe("Mine");
    expect(clashes).toHaveLength(0);
  });

  it("writes in turn, each with the stamp the one before left: a tab does not refuse itself", async () => {
    open();
    await read();
    await Promise.all([updateBuild(DRAFT, { title: "One" } as BuildPatch), updateBuild(DRAFT, { outcome: "Two" } as BuildPatch), updateBuild(DRAFT, { title: "Three" } as BuildPatch)]);
    expect(build()).toMatchObject({ title: "Three", outcome: "Two" });
    expect(requests().filter((request) => request.method === "PATCH" && request.status !== 200)).toHaveLength(0);
    expect(clashes).toHaveLength(0);
  });

  it("is as it always was for a build that is not open in the composer", async () => {
    open();
    await updateBuild(DRAFT, { title: "Plain" } as BuildPatch);
    const patch = requests().find((request) => request.method === "PATCH" && request.path.includes("/builds"));
    expect(patch?.path).not.toContain("updated_at=eq.");
    expect(build().title).toBe("Plain");
  });
});

describe("the post", () => {
  it("is a clash when both changed it", async () => {
    open();
    await read();
    const theirs = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Their post" }] }] };
    const mine = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "My post" }] }] };
    elsewhere({ post_doc: theirs });
    await updateBuild(DRAFT, { post_doc: mine } as unknown as BuildPatch);
    expect(build().post_doc).toEqual(theirs);
    expect(clashes).toHaveLength(1);
    expect(clashes[0]).toMatchObject({ kind: "post", key: "post" });
    await clashes[0].write("mine");
    expect(build().post_doc).toEqual(mine);
  });
});

describe("a session's title and a part, in making", () => {
  it("is a session clash when both changed the same session; the other changes still land", async () => {
    open();
    await read();
    const making = build().making as { sessions_meta: Record<string, unknown> };
    elsewhere({ making: { ...making, sessions_meta: { ...making.sessions_meta, s1: session("Beta") } } });
    await patchMaking(DRAFT, { sessions_meta: { s1: session("Alpha mine"), s2: session("Two mine") } });
    expect(clashes).toHaveLength(1);
    expect(clashes[0]).toMatchObject({ kind: "session", key: "s1" });
    expect(clashes[0].fields.map((field) => field.key)).toContain("title");
    const now = build().making as { sessions_meta: Record<string, { title: string }> };
    // s1 reads as the other place has it until settled; s2, which only this tab changed, landed.
    expect(now.sessions_meta.s1.title).toBe("Beta");
    expect(now.sessions_meta.s2.title).toBe("Two mine");
    await clashes[0].write("mine");
    expect((build().making as { sessions_meta: Record<string, { title: string }> }).sessions_meta.s1.title).toBe("Alpha mine");
  });

  it("is a part clash when both changed the same part", async () => {
    open();
    await read();
    const making = build().making as Record<string, unknown>;
    elsewhere({ making: { ...making, workstreams: [{ key: "ws-a", name: "Theirs" }] } });
    await patchMaking(DRAFT, { workstreams: [{ key: "ws-a", name: "Mine" }] });
    expect(clashes).toHaveLength(1);
    expect(clashes[0]).toMatchObject({ kind: "part", key: "ws-a" });
    await clashes[0].write("mine");
    expect((build().making as { workstreams: { name: string }[] }).workstreams[0].name).toBe("Mine");
  });

  it("merges changes to different sessions without a window", async () => {
    open();
    await read();
    const making = build().making as { sessions_meta: Record<string, unknown> };
    elsewhere({ making: { ...making, sessions_meta: { ...making.sessions_meta, s2: session("Two theirs") } } });
    await patchMaking(DRAFT, { sessions_meta: { s1: session("Alpha mine"), s2: session("Two") } });
    expect(clashes).toHaveLength(0);
    const now = build().making as { sessions_meta: Record<string, { title: string }> };
    expect(now.sessions_meta.s1.title).toBe("Alpha mine");
    expect(now.sessions_meta.s2.title).toBe("Two theirs");
  });
});

describe("a tile: no updated_at, so the row is read inside the write", () => {
  const mineRow = (record: { tree: readonly BuildNode[] }): BuildNode => {
    const row = flatNodes(record.tree as never).find((candidate) => candidate.id === NODE) as BuildNode;
    return { ...row, payload: { ...(row.payload as object), text: "mine text" } as BuildNode["payload"] };
  };

  it("reads the row just before writing it, and does not overwrite a change made elsewhere", async () => {
    open();
    const record = await read();
    elsewhereNode({ text: "theirs text" });
    const written = await writeNodeRows([mineRow(record)]);
    expect(node().payload).toMatchObject({ text: "theirs text" });
    expect(written[0].payload).toMatchObject({ text: "theirs text" });
    expect(clashes).toHaveLength(1);
    expect(clashes[0]).toMatchObject({ kind: "tile", key: NODE });
    expect(clashes[0].fields).toEqual([{ key: "payload.text", mine: "mine text", theirs: "theirs text" }]);
    expect(requests().some((request) => request.method === "GET" && request.path.includes("/build_nodes") && request.path.includes("id=in."))).toBe(true);
  });

  it("settles by writing either version", async () => {
    open();
    const record = await read();
    elsewhereNode({ text: "theirs text" });
    await writeNodeRows([mineRow(record)]);
    await clashes[0].write("mine");
    expect(node().payload).toMatchObject({ text: "mine text" });
    await clashes[0].write("theirs");
    expect(node().payload).toMatchObject({ text: "theirs text" });
  });

  it("writes straight away when nothing changed elsewhere, and learns what it wrote", async () => {
    open();
    const record = await read();
    await writeNodeRows([mineRow(record)]);
    expect(node().payload).toMatchObject({ text: "mine text" });
    expect(clashes).toHaveLength(0);
    // Its own write is not a change "elsewhere" the next time.
    await writeNodeRows([{ ...mineRow(record), payload: { text: "mine again", session: "s1" } as BuildNode["payload"] }]);
    expect(node().payload).toMatchObject({ text: "mine again" });
    expect(clashes).toHaveLength(0);
  });

  it("merges when only this tab changed the text and the other only moved the tile", async () => {
    open();
    const record = await read();
    (node() as Row).position = 3;
    await writeNodeRows([mineRow(record)]);
    expect(node().payload).toMatchObject({ text: "mine text" });
    expect(clashes).toHaveLength(0);
  });

  it("does the same for a single node (upsertNode)", async () => {
    open();
    const record = await read();
    elsewhereNode({ text: "theirs text" });
    const row = mineRow(record);
    const result = await upsertNode(row as never);
    expect(result.payload).toMatchObject({ text: "theirs text" });
    expect(clashes).toHaveLength(1);
  });

  it("checks nothing for a tile this tab never knew (a new one)", async () => {
    open();
    await read();
    const fresh = { id: "0a0a0a0a-0000-4000-8000-000000000099", build_id: DRAFT, parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: { text: "new" }, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-24T19:00:00Z" } as BuildNode;
    await writeNodeRows([fresh]);
    expect(requests().some((request) => request.method === "GET" && request.path.includes("id=in."))).toBe(false);
  });
});
