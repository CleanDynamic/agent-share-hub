// SV-18 P2: what a saved item fits, and the copy it makes.

import { describe, expect, it } from "vitest";

import type { LibrarySavedItem } from "@/lib/library/savedItems";

import { AGENT_TYPE, TEAM_TYPE, nestRefusal } from "./graph";
import { fitsPlace, insertSavedTile, sessionCopyOf, savedName, type InsertContext, type LibraryPlace } from "./fromLibrary";
import type { BuildSnapshot } from "./buildSnapshot";
import type { BuildNode, NodeTree } from "./types";

const BUILD = "b-here";
const row = (id: string, type: string, parent: string | null, position: number, payload: Record<string, unknown> = {}): BuildNode =>
  ({ id, build_id: BUILD, parent_id: parent, position, type, title: null, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "" }) as BuildNode;

const snapshot = (): BuildSnapshot => ({
  nodes: [row("agent", AGENT_TYPE, null, 0, { system_prompt: "Be brief." }), row("p0", "prompt", "agent", 1, { text: "first" }), row("team", TEAM_TYPE, null, 1), row("loose", "prompt", null, 2, { text: "loose", session: "typed-a" })],
  sessions: [],
  making: {},
});

let counter = 0;
const context = (copierId = "copier"): InsertContext => ({ buildId: BUILD, copierId, newId: () => `new-${++counter}`, now: () => "2026-10-28T00:00:00Z" });

const saved = (kind: LibrarySavedItem["kind"], snapshotBody: Record<string, unknown>, id = "si-1", ref: string | null = "src-node"): LibrarySavedItem => ({
  id,
  kind,
  buildId: "b-src",
  ref,
  snapshot: snapshotBody,
  sourceVersion: null,
  note: null,
  savedAt: "2026-10-12T00:00:00Z",
  lastUsedAt: "2026-10-12T00:00:00Z",
});

const source = { buildId: "b-src", buildTitle: "Call notes", buildSlug: "call-notes", makerId: "maya", nodeId: "src-node" };
const promptStep = saved("step", {
  type: "prompt",
  title: "Summary on one prompt",
  note: null,
  payload: { text: "Summarise the call.", model: "claude-opus-5-5" },
  source,
});
const agentStep = saved("step", { type: AGENT_TYPE, title: "Research brief", note: null, payload: { system_prompt: "Research." }, source }, "si-2");
const session = saved("session", { title: "Inbox triage", model: "claude-sonnet-5-5", prompts: [{ text: "Sort my inbox." }, { text: "Draft replies." }], source: { ...source, nodeId: undefined, tool: "Claude Code" } }, "si-3", "import-9");

const agent: LibraryPlace = { kind: "agent", id: "agent", name: "Clean-up agent" };
const team: LibraryPlace = { kind: "team", id: "team", name: "Review team" };
const top: LibraryPlace = { kind: "top", session: "typed-a", name: "Session 1" };

describe("what fits where", () => {
  it("lists prompts inside an agent, agents inside a team, and everything at the top", () => {
    expect([promptStep, agentStep, session].map((item) => fitsPlace(agent, item))).toEqual([true, false, false]);
    expect([promptStep, agentStep, session].map((item) => fitsPlace(team, item))).toEqual([false, true, false]);
    expect([promptStep, agentStep, session].map((item) => fitsPlace(top, item))).toEqual([true, true, true]);
  });

  it("never lists a saved request, filter set or collection", () => {
    for (const kind of ["request", "filter_set", "collection"] as const) expect(fitsPlace(top, saved(kind, { type: "prompt" }))).toBe(false);
  });

  it("agrees with the composer's own nesting rule", () => {
    const tree = [
      { ...row("agent", AGENT_TYPE, null, 0), children: [] },
      { ...row("team", TEAM_TYPE, null, 1), children: [] },
      { ...row("prompt", "prompt", null, 2), children: [] },
      { ...row("a2", AGENT_TYPE, null, 3), children: [] },
    ] as NodeTree[];
    const fits = (container: "agent" | "team", id: string) => nestRefusal(tree, id, container) === null;
    expect(fits("agent", "prompt")).toBe(fitsPlace(agent, promptStep));
    expect(fits("agent", "a2")).toBe(fitsPlace(agent, agentStep));
    expect(fits("team", "a2")).toBe(fitsPlace(team, agentStep));
    expect(fits("team", "prompt")).toBe(fitsPlace(team, promptStep));
  });
});

describe("inserting a saved prompt inside an agent", () => {
  it("adds one prompt tile with the snapshot's method, its source and its maker credited", () => {
    const before = snapshot();
    const result = insertSavedTile(before, promptStep, agent, context());
    expect(result).not.toBeNull();
    expect(result?.ids).toHaveLength(1);
    const added = result?.snapshot.nodes.filter((entry) => !before.nodes.some((old) => old.id === entry.id)) ?? [];
    expect(added).toHaveLength(1);
    const [tile] = added;
    expect(tile).toMatchObject({ id: result?.ids[0], type: "prompt", parent_id: "agent", position: 2, title: "Summary on one prompt", contributor_id: "maya" });
    expect(tile.payload).toEqual({ text: "Summarise the call.", model: "claude-opus-5-5" });
    expect(tile.source_ref).toEqual({ node_id: "src-node", build_id: "b-src", saved_item_id: "si-1" });
  });

  it("does not touch the other rows", () => {
    const before = snapshot();
    const result = insertSavedTile(before, promptStep, agent, context());
    expect(result?.snapshot.nodes.slice(0, before.nodes.length)).toEqual(before.nodes);
  });

  it("writes no credit when the maker is the one copying", () => {
    const result = insertSavedTile(snapshot(), promptStep, agent, context("maya"));
    const tile = result?.snapshot.nodes.find((entry) => entry.id === result.ids[0]) as BuildNode & { contributor_id?: string };
    expect("contributor_id" in tile).toBe(false);
  });

  it("keeps the credit of the source tile's contributor, not the build's maker", () => {
    const item = saved("step", { type: "prompt", title: null, note: null, payload: { text: "x" }, source: { ...source, makerId: "kit" } });
    const result = insertSavedTile(snapshot(), item, agent, context());
    expect((result?.snapshot.nodes.at(-1) as BuildNode & { contributor_id?: string }).contributor_id).toBe("kit");
  });

  it("copies the method and never the evidence", () => {
    const item = saved("step", { type: "prompt", title: null, note: null, payload: { text: "x", run_cost: 4, trace_url: "https://t" }, source });
    const tile = insertSavedTile(snapshot(), item, agent, context())?.snapshot.nodes.at(-1);
    expect(tile?.payload).toEqual({ text: "x" });
  });

  it("refuses an item that does not fit", () => {
    expect(insertSavedTile(snapshot(), agentStep, agent, context())).toBeNull();
    expect(insertSavedTile(snapshot(), session, agent, context())).toBeNull();
  });
});

describe("inserting at the top level", () => {
  it("places the tile last, in the session the maker is adding to", () => {
    const result = insertSavedTile(snapshot(), promptStep, top, context());
    const tile = result?.snapshot.nodes.at(-1);
    expect(tile).toMatchObject({ parent_id: null, position: 3 });
    expect((tile?.payload as Record<string, unknown>).session).toBe("typed-a");
  });

  it("brings a part with its tiles, pointers between them pointing at the copies", () => {
    const part = saved(
      "part",
      {
        type: AGENT_TYPE,
        title: "Triage",
        note: null,
        payload: { system_prompt: "Triage." },
        source: { ...source, nodeId: "part-root" },
        children: [
          { id: "c1", type: "prompt", title: null, note: null, payload: { text: "one" }, children: [] },
          { id: "c2", type: "prompt", title: null, note: null, payload: { text: "two", uses: [{ kind: "output", node_id: "c1" }] }, children: [] },
        ],
      },
      "si-4",
      "part-root",
    );
    const before = snapshot();
    const result = insertSavedTile(before, part, top, context());
    const added = result?.snapshot.nodes.slice(before.nodes.length) ?? [];
    expect(added).toHaveLength(3);
    const [root, one, two] = added;
    expect([one.parent_id, two.parent_id]).toEqual([root.id, root.id]);
    expect([one.position, two.position]).toEqual([1, 2]);
    expect((two.payload as { uses: { node_id: string }[] }).uses[0].node_id).toBe(one.id);
    expect(one.source_ref).toMatchObject({ node_id: "c1", saved_item_id: "si-4" });
  });

  it("gives every new tile a new id", () => {
    const first = insertSavedTile(snapshot(), promptStep, top, context());
    const again = insertSavedTile(first?.snapshot as BuildSnapshot, promptStep, top, context());
    expect(new Set(again?.snapshot.nodes.map((entry) => entry.id)).size).toBe(again?.snapshot.nodes.length);
  });
});

describe("a saved session as a ready-made session", () => {
  it("is a session made here with one prompt tile per saved prompt, each naming the saved session", () => {
    const copy = sessionCopyOf(session, "copier", "typed-new", "2026-10-28");
    expect(copy.key).toBe("typed-new");
    expect(copy.meta).toMatchObject({ tool: "Claude Code", date: "2026-10-28", model: "claude-sonnet-5-5", title: "Inbox triage", contributor_id: "maya" });
    expect(copy.tiles.map((tile) => (tile.payload as { text: string }).text)).toEqual(["Sort my inbox.", "Draft replies."]);
    expect(copy.tiles[0].source_ref).toMatchObject({ import_session_id: "import-9", saved_item_id: "si-3" });
  });

  it("credits nobody when the maker is the one copying", () => {
    expect(sessionCopyOf(session, "maya", "typed-new").meta.contributor_id).toBeUndefined();
  });
});

describe("names", () => {
  it("names a step by its title, else the first words of its text", () => {
    expect(savedName(promptStep)).toBe("Summary on one prompt");
    expect(savedName(saved("step", { type: "prompt", payload: { text: "Summarise the call in three short bullets please" } }))).toBe("Summarise the call in three short");
  });
});
