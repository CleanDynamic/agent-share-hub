// CA-23 P4: three versions of a thing, and what is a clash. A change made in one place only merges; a change made in two places to
// two different things is a clash.

import { describe, expect, it } from "vitest";

import { applyFields, differingFields, fieldLabel, mergeMaking, mergeTile, nodeContent, rowClashes, same, tileConflict, valueWords } from "./clash";
import type { BuildNode } from "./types";

const node = (over: Partial<BuildNode> & { payload?: Record<string, unknown> } = {}): BuildNode =>
  ({ id: "n1", build_id: "b1", parent_id: null, position: 0, type: "prompt", title: null, note: null, payload: { text: "base" }, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-24T20:00:00Z", ...over }) as BuildNode;

describe("same", () => {
  it("ignores the order of keys and missing against null", () => {
    expect(same({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(same({ a: undefined }, {})).toBe(true);
    expect(same([1, 2], [2, 1])).toBe(false);
  });
});

describe("a tile", () => {
  it("reads a row as its title, its note and the fields of its payload", () => {
    expect(nodeContent(node({ title: "T", payload: { text: "hi", model: "m" } }))).toEqual({ title: "T", note: null, "payload.text": "hi", "payload.model": "m" });
  });

  it("lists the fields that differ, in order", () => {
    expect(differingFields({ a: 1, b: 2, c: 3 }, { a: 1, b: 9, c: 8 })).toEqual([
      { key: "b", mine: 2, theirs: 9 },
      { key: "c", mine: 3, theirs: 8 },
    ]);
  });

  it("is a clash only where both changed the same field to different things", () => {
    const base = { "payload.text": "base", title: "t" };
    expect(tileConflict(base, { ...base, "payload.text": "mine" }, { ...base, "payload.text": "theirs" })).toEqual([{ key: "payload.text", mine: "mine", theirs: "theirs" }]);
    // Only theirs changed: no clash. Only mine changed: no clash. Both changed to the same: no clash.
    expect(tileConflict(base, base, { ...base, "payload.text": "theirs" })).toEqual([]);
    expect(tileConflict(base, { ...base, "payload.text": "mine" }, base)).toEqual([]);
    expect(tileConflict(base, { ...base, "payload.text": "same" }, { ...base, "payload.text": "same" })).toEqual([]);
    // Different fields: no clash.
    expect(tileConflict(base, { ...base, title: "mine" }, { ...base, "payload.text": "theirs" })).toEqual([]);
  });

  it("merges: each field from whoever changed it, theirs where both did", () => {
    const base = node({ title: "t", payload: { text: "base", model: "m" } });
    const mine = node({ title: "mine title", payload: { text: "mine text", model: "m" } });
    const theirs = node({ title: "t", payload: { text: "theirs text", model: "other" } });
    const { row, conflicts } = mergeTile(base, mine, theirs);
    expect(row.title).toBe("mine title");
    expect(row.payload).toEqual({ text: "theirs text", model: "other" });
    expect(conflicts).toEqual([{ key: "payload.text", mine: "mine text", theirs: "theirs text" }]);
  });

  it("takes theirs for a row mine only moved or rewrote unchanged, and keeps the place mine moved it to", () => {
    const base = node({ position: 1 });
    const theirs = node({ position: 1, payload: { text: "theirs" } });
    expect(mergeTile(base, node({ position: 1 }), theirs).row.payload).toEqual({ text: "theirs" });
    expect(mergeTile(base, node({ position: 4 }), theirs).row.position).toBe(4);
    expect(mergeTile(base, node({ position: 1 }), node({ position: 7, payload: { text: "base" } })).row.position).toBe(7);
  });

  it("sets and clears payload fields", () => {
    expect(applyFields(node({ payload: { text: "a", model: "m" } }), { "payload.text": "b", "payload.model": null, title: "T" })).toMatchObject({ title: "T", payload: { text: "b" } });
  });
});

describe("labels and words", () => {
  it("names a field in a word or two", () => {
    expect(fieldLabel("title")).toBe("Title");
    expect(fieldLabel("payload.text")).toBe("Text");
    expect(fieldLabel("payload.first_result")).toBe("First result");
    expect(fieldLabel("payload.firstResult")).toBe("First result");
    expect(valueWords(null)).toBe("(empty)");
    expect(valueWords("hello")).toBe("hello");
    expect(valueWords(3)).toBe("3");
  });
});

describe("the build's row", () => {
  const base = { title: "T", outcome: "O", post_doc: { v: 1 } };
  it("finds the keys both changed to different things", () => {
    expect(rowClashes(base, { title: "mine" }, { ...base, title: "theirs" })).toEqual([{ key: "title", mine: "mine", theirs: "theirs" }]);
    expect(rowClashes(base, { title: "mine", outcome: "mine" }, { ...base, title: "theirs" })).toEqual([{ key: "title", mine: "mine", theirs: "theirs" }]);
  });
  it("finds none where only one place changed a key, or both changed it alike", () => {
    expect(rowClashes(base, { title: "mine" }, base)).toEqual([]);
    expect(rowClashes(base, { title: "T" }, { ...base, title: "theirs" })).toEqual([]);
    expect(rowClashes(base, { title: "x" }, { ...base, title: "x" })).toEqual([]);
  });
  it("leaves `making` to mergeMaking", () => {
    expect(rowClashes({ making: { a: 1 } }, { making: { a: 2 } }, { making: { a: 3 } })).toEqual([]);
  });
});

describe("making", () => {
  const session = (title: string) => ({ tool: "claude", date: "2026-10-24", title });
  const base = { sessions_meta: { s1: session("One"), s2: session("Two") }, workstreams: [{ key: "ws-a", name: "A" }, { key: "ws-b", name: "B" }], session_order: ["s1", "s2"] };

  it("merges changes made in different sessions, and different keys", () => {
    const mine = { ...base, sessions_meta: { ...base.sessions_meta, s1: session("One, mine") } };
    const theirs = { ...base, sessions_meta: { ...base.sessions_meta, s2: session("Two, theirs") }, session_order: ["s2", "s1"] };
    const { merged, clashes } = mergeMaking(base, mine, theirs);
    expect(clashes).toEqual([]);
    expect(merged.sessions_meta).toEqual({ s1: session("One, mine"), s2: session("Two, theirs") });
    expect(merged.session_order).toEqual(["s2", "s1"]);
  });

  it("is a session clash where both changed the same session to different things", () => {
    const mine = { ...base, sessions_meta: { ...base.sessions_meta, s1: session("Mine") } };
    const theirs = { ...base, sessions_meta: { ...base.sessions_meta, s1: session("Theirs") } };
    const { merged, clashes } = mergeMaking(base, mine, theirs);
    expect(clashes).toEqual([{ kind: "session", key: "s1", mine: session("Mine"), theirs: session("Theirs") }]);
    // Until it is settled the session reads as the other place has it.
    expect((merged.sessions_meta as Record<string, unknown>).s1).toEqual(session("Theirs"));
  });

  it("is a part clash where both changed the same part", () => {
    const mine = { ...base, workstreams: [{ key: "ws-a", name: "Mine" }, { key: "ws-b", name: "B" }] };
    const theirs = { ...base, workstreams: [{ key: "ws-a", name: "Theirs" }, { key: "ws-b", name: "B" }] };
    const { clashes, merged } = mergeMaking(base, mine, theirs);
    expect(clashes).toEqual([{ kind: "part", key: "ws-a", mine: { key: "ws-a", name: "Mine" }, theirs: { key: "ws-a", name: "Theirs" } }]);
    expect(merged.workstreams).toEqual(theirs.workstreams);
  });

  it("merges changes to different parts", () => {
    const mine = { ...base, workstreams: [{ key: "ws-a", name: "Mine" }, { key: "ws-b", name: "B" }] };
    const theirs = { ...base, workstreams: [{ key: "ws-a", name: "A" }, { key: "ws-b", name: "Theirs" }] };
    const { clashes, merged } = mergeMaking(base, mine, theirs);
    expect(clashes).toEqual([]);
    expect(merged.workstreams).toEqual([{ key: "ws-a", name: "Mine" }, { key: "ws-b", name: "Theirs" }]);
  });

  it("takes mine for any other key both changed: only what the maker names gets a window", () => {
    const { merged, clashes } = mergeMaking({ session_order: ["a"] }, { session_order: ["b"] }, { session_order: ["c"] });
    expect(clashes).toEqual([]);
    expect(merged.session_order).toEqual(["b"]);
  });

  it("changes nothing when only mine changed, or only theirs", () => {
    expect(mergeMaking(base, base, { ...base, session_order: ["s2"] }).merged.session_order).toEqual(["s2"]);
    expect(mergeMaking(base, { ...base, session_order: ["s2"] }, base).merged.session_order).toEqual(["s2"]);
  });
});
