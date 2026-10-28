// SV-18 P3: a draft made from a collection's saved items, in order.

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LibrarySavedItem } from "@/lib/library/savedItems";

const createBuild = vi.fn(async () => ({ id: "draft-1", title: "Invoices" }));
const addSessionCopy = vi.fn(async () => ({}));
const writeNodeRows = vi.fn(async (rows: unknown[]) => rows);
let tree: unknown[] = [];
vi.mock("./builds", () => ({ createBuild: (...a: unknown[]) => createBuild(...(a as [])) }));
vi.mock("./addSession", () => ({ addSessionCopy: (...a: unknown[]) => addSessionCopy(...(a as [])) }));
vi.mock("./nodes", () => ({ getNodeTree: vi.fn(async () => tree) }));
vi.mock("./sessionEdit", async (importOriginal) => ({ ...(await importOriginal<typeof import("./sessionEdit")>()), writeNodeRows: (rows: unknown[]) => writeNodeRows(rows) }));
vi.mock("@/lib/social/types", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/social/types")>()), currentUserId: async () => "copier" }));

import { startBuildFromItems, startsABuild } from "./startFromCollection";

const step = (id: string, text: string): LibrarySavedItem => ({
  id,
  kind: "step",
  buildId: "b-src",
  ref: `n-${id}`,
  snapshot: { type: "prompt", title: null, note: null, payload: { text }, source: { buildId: "b-src", buildTitle: "S", buildSlug: null, makerId: "maya", nodeId: `n-${id}` } },
  sourceVersion: null,
  note: null,
  savedAt: "",
  lastUsedAt: "",
});
const session: LibrarySavedItem = { ...step("s1", ""), kind: "session", ref: "imp", snapshot: { title: "Triage", model: null, prompts: [{ text: "Sort." }], source: { buildId: "b-src", buildTitle: "S", buildSlug: null, makerId: "maya" } } };

beforeEach(() => {
  createBuild.mockClear();
  addSessionCopy.mockClear();
  writeNodeRows.mockClear();
  tree = [];
});

describe("startBuildFromItems", () => {
  it("makes no draft when nothing can start a build", async () => {
    expect(await startBuildFromItems([{ ...step("r", "x"), kind: "request" }], "Invoices")).toBeNull();
    expect(createBuild).not.toHaveBeenCalled();
  });

  it("makes the draft with the collection's name and puts each tile in with its source and credit, then a session", async () => {
    const id = await startBuildFromItems([step("a", "One"), step("b", "Two"), session], "Invoices");
    expect(id).toBe("draft-1");
    expect(createBuild).toHaveBeenCalledWith({ title: "Invoices" });
    expect(writeNodeRows).toHaveBeenCalledTimes(2);
    const [first] = writeNodeRows.mock.calls[0][0] as { source_ref: unknown; contributor_id?: string; payload: { text: string } }[];
    expect(first.payload.text).toBe("One");
    expect(first.source_ref).toMatchObject({ node_id: "n-a", saved_item_id: "a" });
    expect(first.contributor_id).toBe("maya");
    expect(addSessionCopy).toHaveBeenCalledTimes(1);
  });

  it("knows what can start a build", () => {
    expect(["step", "part", "session"].every((kind) => startsABuild({ kind: kind as LibrarySavedItem["kind"] }))).toBe(true);
    expect(startsABuild({ kind: "request" })).toBe(false);
  });
});
