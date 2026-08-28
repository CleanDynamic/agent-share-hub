// Acceptance cover for the rebuild data layer (NS-P37).
//
// The diff is the content of a rebuild, so these tests are mostly about one
// question asked from several directions: given a fork and the edits someone
// made to it, does changeSet say the true thing, and does it say it the same
// way twice? The fixtures build a source record and then FORK it the way
// fork.ts does — fresh node ids, everything else carried, no media, no tray —
// rather than hand-writing a "draft", so a test that passes here is a test
// about the copy rules the diff actually has to survive.
//
// startRebuild and publishRebuild are the only two functions that write, and
// they are tested against mocked module boundaries: what is worth pinning down
// is which columns they set, in what order, and what they clean up when a write
// fails.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Build,
  BuildEvent,
  BuildRecord,
  NodeTree,
  NodeType,
} from "./types";

const mocks = vi.hoisted(() => ({
  forkBuild: vi.fn(),
  getBuildHeader: vi.fn(),
  updateBuild: vi.fn(),
  deleteBuild: vi.fn(),
  profile: { data: null, error: null } as { data: unknown; error: unknown },
}));

vi.mock("./fork", () => ({ forkBuild: mocks.forkBuild }));

vi.mock("./builds", () => ({
  BUILD_COLUMNS: "id",
  getBuildHeader: mocks.getBuildHeader,
  updateBuild: mocks.updateBuild,
  deleteBuild: mocks.deleteBuild,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => mocks.profile }),
      }),
    }),
  },
}));

import {
  NO_CHANGES_REASON,
  changeCount,
  changeSet,
  matchNodes,
  publishRebuild,
  rebuildReadiness,
  serialiseChangeSet,
  startRebuild,
} from "./rebuild";
import { publishReadiness } from "./publish";

// =============================================================================
// Fixtures
// =============================================================================

const NODE_TYPES = [
  {
    key: "prompt",
    label: "Prompt",
    category: "instruction",
    schema: {
      fields: [
        { key: "text", label: "Prompt text", type: "text", required: true },
        { key: "model", label: "Model", type: "string" },
        { key: "params", label: "Parameters", type: "text" },
      ],
    },
  },
  {
    key: "code",
    label: "Code",
    category: "artefact",
    schema: {
      fields: [
        { key: "language", label: "Language", type: "string" },
        { key: "source", label: "Source", type: "text" },
      ],
    },
  },
  {
    key: "result",
    label: "Result",
    category: "evidence",
    schema: { fields: [{ key: "summary", label: "Summary", type: "text" }] },
  },
  {
    key: "eval_run",
    label: "Eval run",
    category: "evidence",
    schema: { fields: [{ key: "model", label: "Model", type: "string" }] },
  },
] as unknown as NodeType[];

interface NodeSpec {
  id: string;
  type: string;
  title?: string | null;
  note?: string | null;
  payload?: Record<string, unknown>;
  source_ref?: Record<string, unknown> | null;
  children?: NodeSpec[];
}

function node(spec: NodeSpec, parentId: string | null = null, position = 0): NodeTree {
  return {
    id: spec.id,
    build_id: "b-source",
    parent_id: parentId,
    position,
    type: spec.type,
    title: spec.title ?? null,
    note: spec.note ?? null,
    payload: spec.payload ?? {},
    source_ref: spec.source_ref ?? null,
    event_id: null,
    is_gap: false,
    created_at: "2026-08-01T09:00:00Z",
    children: (spec.children ?? []).map((child, index) =>
      node(child, spec.id, index)
    ),
  } as unknown as NodeTree;
}

function tree(specs: NodeSpec[]): NodeTree[] {
  return specs.map((spec, index) => node(spec, null, index));
}

function event(ordinal: number, over: Partial<BuildEvent> = {}): BuildEvent {
  return {
    id: `e${ordinal}`,
    build_id: "b-source",
    ordinal,
    occurred_at: `2026-08-0${ordinal}T10:00:00Z`,
    kind: "prompt",
    payload: {},
    phase: null,
    phase_title: null,
    visibility: "kept",
    produced_node_id: null,
    created_at: "2026-08-01T09:00:00Z",
    ...over,
  } as unknown as BuildEvent;
}

function buildRow(over: Partial<Build> = {}): Build {
  return {
    id: "b-source",
    creator_id: "creator-1",
    slug: "inbox-triage-agent-k3f9x1",
    title: "Inbox Triage Agent",
    outcome: "Sorts a full inbox and drafts the replies.",
    shape: "prompt",
    status: "published",
    made_for: ["founder"],
    made_with: ["Claude Sonnet"],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: null,
    cost_setup: null,
    cost_monthly: null,
    currency: "GBP",
    time_to_first_result: null,
    completeness: 60,
    reproduction_count: 0,
    last_confirmed_at: null,
    last_confirmed_model: null,
    parent_build_id: null,
    root_build_id: null,
    forked_from_event_id: null,
    source_content_item_id: null,
    monetisation_type: "free",
    price_gbp: null,
    donation_enabled: false,
    created_at: "2026-08-01T09:00:00Z",
    updated_at: "2026-08-01T09:00:00Z",
    published_at: "2026-08-01T09:00:00Z",
    rebuild_note: null,
    rebuild_count: 0,
    source_title_at_fork: null,
    source_handle_at_fork: null,
    solves_node_id: null,
    ...over,
  } as unknown as Build;
}

/** The source used by every diff test: a prompt with its result, and a file. */
function sourceRecord(): BuildRecord {
  return {
    build: buildRow(),
    tree: tree([
      {
        id: "n-prompt",
        type: "prompt",
        title: "Draft the reply",
        payload: { text: "Write a short reply", model: "Claude Sonnet" },
        children: [
          {
            id: "n-result",
            type: "result",
            title: "The reply it wrote",
            payload: { summary: "Three sentences, right tone" },
          },
        ],
      },
      {
        id: "n-code",
        type: "code",
        title: "The wrapper",
        payload: { language: "ts", source: "run()" },
      },
    ]),
    tray: [],
    events: [event(1), event(2), event(3)],
    nodeTypes: NODE_TYPES,
  };
}

/**
 * The fork of a record, copied the way fork.ts copies one: every node id minted
 * fresh, parent_id remapped, everything else carried; no media, no tray; the
 * lineage columns on the header and nowhere else.
 */
function forkOf(source: BuildRecord): BuildRecord {
  const copyNode = (original: NodeTree, parentId: string | null): NodeTree =>
    ({
      ...original,
      id: `d:${original.id}`,
      build_id: "b-draft",
      parent_id: parentId,
      payload: structuredClone(original.payload),
      children: original.children.map((child) => copyNode(child, `d:${original.id}`)),
    }) as unknown as NodeTree;

  return {
    build: buildRow({
      id: "b-draft",
      creator_id: "creator-2",
      slug: "inbox-triage-agent-9m2p4z",
      status: "draft",
      published_at: null,
      parent_build_id: source.build.id,
      root_build_id: source.build.root_build_id ?? source.build.id,
      hero_node_id: source.build.hero_node_id
        ? `d:${source.build.hero_node_id}`
        : null,
      // forkBuild copies no build_media rows, so a fresh fork has no cover.
      cover_media_id: null,
      source_title_at_fork: source.build.title,
      source_handle_at_fork: "ama",
    }),
    tree: source.tree.map((root) => copyNode(root, null)),
    tray: [],
    events: source.events
      .filter((original) => original.visibility !== "hidden")
      .map((original) => ({ ...original, id: `d:${original.id}`, build_id: "b-draft" })),
    nodeTypes: NODE_TYPES,
  };
}

/** The draft's copy of a source node, so a test can edit it in place. */
function draftNode(record: BuildRecord, sourceId: string): NodeTree {
  const find = (nodes: NodeTree[]): NodeTree | undefined => {
    for (const candidate of nodes) {
      if (candidate.id === `d:${sourceId}`) return candidate;
      const inside = find(candidate.children);
      if (inside) return inside;
    }
    return undefined;
  };
  const found = find(record.tree);
  if (!found) throw new Error(`no draft copy of ${sourceId}`);
  return found;
}

function texts(record: BuildRecord, draft: BuildRecord): string[] {
  return serialiseChangeSet(changeSet(record, draft)).map((line) => line.text);
}

// =============================================================================
// The diff
// =============================================================================

describe("changeSet", () => {
  it("finds nothing at all in a fork nobody has touched", () => {
    const source = sourceRecord();
    const changes = changeSet(source, forkOf(source));

    expect(changeCount(changes)).toBe(0);
    expect(changes).toMatchObject({
      added: [],
      removed: [],
      changed: [],
      outcome_changed: false,
      title_changed: false,
      cover_changed: false,
      events_added: 0,
      header: [],
    });
  });

  it("reports an edited payload field with its before and after", () => {
    const source = sourceRecord();
    const draft = forkOf(source);
    draftNode(draft, "n-prompt").payload = {
      text: "Write a short reply",
      model: "Llama 3 70B",
    };

    const changes = changeSet(source, draft);

    expect(changes.added).toEqual([]);
    expect(changes.removed).toEqual([]);
    expect(changes.changed).toHaveLength(1);
    expect(changes.changed[0]).toMatchObject({
      node_id: "d:n-prompt",
      source_node_id: "n-prompt",
      type: "prompt",
      type_label: "Prompt",
      title: "Draft the reply",
      fields: [
        { key: "model", label: "Model", before: "Claude Sonnet", after: "Llama 3 70B" },
      ],
    });
  });

  it("reports the title and the note as fields of their own", () => {
    const source = sourceRecord();
    const draft = forkOf(source);
    const edited = draftNode(draft, "n-code");
    edited.title = "The wrapper, tidied";
    edited.note = "Dropped the retry loop.";

    const [change] = changeSet(source, draft).changed;

    expect(change.fields).toEqual([
      { key: "title", label: "Title", before: "The wrapper", after: "The wrapper, tidied" },
      { key: "note", label: "Note", before: null, after: "Dropped the retry loop." },
    ]);
  });

  it("counts a node the draft grew as an addition", () => {
    const source = sourceRecord();
    const draft = forkOf(source);
    draft.tree.push(
      node({ id: "d:n-eval", type: "eval_run", title: "Run 4", payload: {} }, null, 2)
    );

    const changes = changeSet(source, draft);

    expect(changes.removed).toEqual([]);
    expect(changes.changed).toEqual([]);
    expect(changes.added).toEqual([
      { node_id: "d:n-eval", type: "eval_run", type_label: "Eval run", title: "Run 4" },
    ]);
  });

  it("counts a node the draft dropped as a removal, children and all", () => {
    const source = sourceRecord();
    const draft = forkOf(source);
    draft.tree = draft.tree.filter((root) => root.id !== "d:n-prompt");

    const changes = changeSet(source, draft);

    expect(changes.added).toEqual([]);
    expect(changes.changed).toEqual([]);
    expect(changes.removed.map((removed) => removed.node_id)).toEqual([
      "n-prompt",
      "n-result",
    ]);
  });

  it("still pairs a node whose only edit was its title", () => {
    const source = sourceRecord();
    const draft = forkOf(source);
    draftNode(draft, "n-prompt").title = "Draft a shorter reply";

    const changes = changeSet(source, draft);

    // The pairing is the point: a rename that read as a removal plus an
    // addition would say the creator threw the prompt away and wrote a new one.
    expect(changes.added).toEqual([]);
    expect(changes.removed).toEqual([]);
    expect(changes.changed).toHaveLength(1);
    expect(changes.changed[0].fields).toEqual([
      {
        key: "title",
        label: "Title",
        before: "Draft the reply",
        after: "Draft a shorter reply",
      },
    ]);
  });

  it("pairs on carried identity when titles and order both moved", () => {
    const source: BuildRecord = {
      ...sourceRecord(),
      tree: tree([
        {
          id: "n-a",
          type: "prompt",
          title: "First pass",
          payload: { text: "one" },
          source_ref: { source: "transcript", session_id: "s1", index: 1 },
        },
        {
          id: "n-b",
          type: "prompt",
          title: "Second pass",
          payload: { text: "two" },
          source_ref: { source: "transcript", session_id: "s1", index: 5 },
        },
      ]),
    };

    const draft = forkOf(source);
    // Both renamed AND swapped: structure alone would pair them the wrong way
    // round and report two edits instead of one.
    draft.tree = [draft.tree[1], draft.tree[0]];
    draftNode(draft, "n-a").title = "Opening move";
    draftNode(draft, "n-b").title = "Follow-up";

    const matching = matchNodes(source.tree, draft.tree);

    expect(
      matching.pairs.map(({ source: before, draft: after }) => [before.id, after.id])
    ).toEqual([
      ["n-a", "d:n-a"],
      ["n-b", "d:n-b"],
    ]);
    expect(matching.addedNodes).toEqual([]);
    expect(matching.removedNodes).toEqual([]);
  });

  it("ignores a payload that only came back in another key order", () => {
    const source = sourceRecord();
    const draft = forkOf(source);
    draftNode(draft, "n-prompt").payload = {
      model: "Claude Sonnet",
      text: "Write a short reply",
    };

    expect(changeSet(source, draft).changed).toEqual([]);
  });

  it("treats a field cleared to empty as the field it never had", () => {
    const source = sourceRecord();
    const draft = forkOf(source);
    draftNode(draft, "n-prompt").payload = {
      text: "Write a short reply",
      model: "Claude Sonnet",
      params: "   ",
    };

    expect(changeSet(source, draft).changed).toEqual([]);
  });

  it("leaves the tray out of it on both sides", () => {
    const source = sourceRecord();
    source.tray = [node({ id: "n-tray", type: "result", title: "Not placed" })];
    const draft = forkOf(source);
    draft.tray = [node({ id: "d:n-tray-2", type: "code", title: "Scratch" })];

    expect(changeCount(changeSet(source, draft))).toBe(0);
  });

  it("counts the steps a draft added, and never the hidden ones", () => {
    const source = sourceRecord();
    const draft = forkOf(source);
    draft.events = [
      ...draft.events,
      event(4, { id: "d:e4", build_id: "b-draft" }),
      event(5, { id: "d:e5", build_id: "b-draft", visibility: "hidden" }),
    ];

    expect(changeSet(source, draft).events_added).toBe(1);
  });

  it("counts only the steps beyond the moment it was forked at", () => {
    const source = sourceRecord();
    const draft = forkOf(source);
    // Forked at step 2, so the draft holds two of the source's three — and its
    // own third step lands on the ordinal, date and kind the source's uncopied
    // third step happens to carry. Compared against the whole source sequence
    // that collision would swallow a real addition.
    draft.build = { ...draft.build, forked_from_event_id: "e2" } as Build;
    draft.events = [
      event(1, { id: "d:e1", build_id: "b-draft" }),
      event(2, { id: "d:e2", build_id: "b-draft" }),
      event(3, { id: "d:e3", build_id: "b-draft" }),
    ];

    expect(changeSet(source, draft).events_added).toBe(1);
  });

  it("reads the header edits, and says which they were", () => {
    const source = sourceRecord();
    const draft = forkOf(source);
    draft.build = {
      ...draft.build,
      title: "Inbox Triage Agent, on Llama",
      outcome: "Sorts a full inbox and drafts the replies, locally.",
      cover_media_id: "media-9",
    } as Build;

    const changes = changeSet(source, draft);

    expect(changes.title_changed).toBe(true);
    expect(changes.outcome_changed).toBe(true);
    expect(changes.cover_changed).toBe(true);
    expect(changes.header.map((field) => field.key)).toEqual([
      "title",
      "outcome",
      "cover",
    ]);
  });

  it("does not call a fork's empty cover a change to it", () => {
    const source = sourceRecord();
    source.build = { ...source.build, cover_media_id: "media-1" } as Build;

    // forkBuild copies no media, so the draft starts with nothing to point at.
    expect(changeSet(source, forkOf(source)).cover_changed).toBe(false);
  });

  it("follows the hero through the copy rather than through its id", () => {
    const source = sourceRecord();
    source.build = { ...source.build, hero_node_id: "n-prompt" } as Build;

    const untouched = forkOf(source);
    expect(changeSet(source, untouched).cover_changed).toBe(false);

    const moved = forkOf(source);
    moved.build = { ...moved.build, hero_node_id: "d:n-code" } as Build;
    expect(changeSet(source, moved).cover_changed).toBe(true);
  });
});

// =============================================================================
// The lines
// =============================================================================

describe("serialiseChangeSet", () => {
  it("names both models when a model field is what moved", () => {
    const source = sourceRecord();
    const draft = forkOf(source);
    draftNode(draft, "n-prompt").payload = {
      text: "Write a short reply",
      model: "Llama 3 70B",
    };

    const lines = serialiseChangeSet(changeSet(source, draft));

    expect(lines).toEqual([
      {
        kind: "changed",
        key: "changed:d:n-prompt",
        text: "Swapped model: Claude Sonnet → Llama 3 70B",
      },
    ]);
  });

  it("says how many other edits rode along with the swap", () => {
    const source = sourceRecord();
    const draft = forkOf(source);
    const edited = draftNode(draft, "n-prompt");
    edited.payload = { text: "Write two lines", model: "Llama 3 70B" };
    edited.note = "Shorter, and cheaper.";

    expect(texts(source, draft)).toEqual([
      "Swapped model: Claude Sonnet → Llama 3 70B (and 2 other edits)",
    ]);
  });

  it("falls back to naming the part when no model moved", () => {
    const source = sourceRecord();
    const draft = forkOf(source);
    draftNode(draft, "n-prompt").payload = {
      text: "Write two lines, no greeting",
      model: "Claude Sonnet",
    };

    expect(texts(source, draft)).toEqual(["Changed the prompt 'Draft the reply'"]);
  });

  it("writes additions, removals and header edits in one fixed order", () => {
    const source = sourceRecord();
    const draft = forkOf(source);

    draftNode(draft, "n-prompt").payload = {
      text: "Write two lines",
      model: "Claude Sonnet",
    };
    draft.tree.push(
      node({ id: "d:n-eval", type: "eval_run", title: "Run 4" }, null, 2)
    );
    draft.tree = draft.tree.filter((root) => root.id !== "d:n-code");
    draft.build = {
      ...draft.build,
      title: "Inbox Triage Agent, shorter",
      outcome: "Sorts a full inbox and drafts two-line replies.",
    } as Build;
    draft.events = [...draft.events, event(4, { id: "d:e4", build_id: "b-draft" })];

    expect(serialiseChangeSet(changeSet(source, draft))).toEqual([
      {
        kind: "changed",
        key: "changed:d:n-prompt",
        text: "Changed the prompt 'Draft the reply'",
      },
      { kind: "added", key: "added:d:n-eval", text: "Added an eval run 'Run 4'" },
      { kind: "removed", key: "removed:n-code", text: "Removed the code 'The wrapper'" },
      {
        kind: "header",
        key: "header:title",
        text: "Renamed it to 'Inbox Triage Agent, shorter'",
      },
      { kind: "header", key: "header:outcome", text: "Rewrote what it does" },
      { kind: "header", key: "header:events", text: "Added 1 step to the sequence" },
    ]);
  });

  it("clips a value that would run past the end of a line", () => {
    const source = sourceRecord();
    const draft = forkOf(source);
    draftNode(draft, "n-prompt").payload = {
      text: "Write a short reply",
      model: `Llama ${"3".repeat(120)}`,
    };

    const [line] = serialiseChangeSet(changeSet(source, draft));

    expect(line.text.length).toBeLessThan(100);
    expect(line.text.endsWith("…")).toBe(true);
  });

  it("says the same thing twice for the same input", () => {
    const source = sourceRecord();
    const draft = forkOf(source);
    draftNode(draft, "n-prompt").payload = {
      text: "Write two lines",
      model: "Llama 3 70B",
    };
    draft.tree.push(node({ id: "d:n-eval", type: "eval_run", title: "Run 4" }, null, 2));
    draft.tree = [draft.tree[1], draft.tree[0]];
    draft.build = { ...draft.build, title: "Inbox Triage, local" } as Build;

    const first = serialiseChangeSet(changeSet(source, draft));
    const second = serialiseChangeSet(changeSet(source, draft));

    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});

// =============================================================================
// The gate
// =============================================================================

describe("rebuildReadiness", () => {
  it("refuses a fork that changed nothing, and says what to do about it", () => {
    const source = sourceRecord();
    const draft = forkOf(source);
    const changes = changeSet(source, draft);

    // The draft is publishable on its own terms. The rebuild rule is the only
    // thing standing between it and a live page.
    expect(publishReadiness(draft.build, draft.tree, draft.nodeTypes).ready).toBe(true);

    expect(rebuildReadiness(source, draft, changes)).toEqual({
      ready: false,
      blocking: [],
      reason: NO_CHANGES_REASON,
    });
  });

  it("opens on one edited part", () => {
    const source = sourceRecord();
    const draft = forkOf(source);
    draftNode(draft, "n-prompt").payload = {
      text: "Write a short reply",
      model: "Llama 3 70B",
    };

    expect(rebuildReadiness(source, draft, changeSet(source, draft))).toEqual({
      ready: true,
      blocking: [],
      reason: null,
    });
  });

  it("opens on a rewritten outcome with the tree left alone", () => {
    const source = sourceRecord();
    const draft = forkOf(source);
    draft.build = {
      ...draft.build,
      outcome: "Sorts a full inbox and drafts the replies, on a local model.",
    } as Build;
    const changes = changeSet(source, draft);

    expect(changeCount(changes)).toBe(0);
    expect(rebuildReadiness(source, draft, changes).ready).toBe(true);
  });

  it("does not open on a rename, a cover or a longer sequence", () => {
    const source = sourceRecord();
    const draft = forkOf(source);
    draft.build = {
      ...draft.build,
      title: "Inbox Triage Agent (mine)",
      cover_media_id: "media-9",
    } as Build;
    draft.events = [...draft.events, event(4, { id: "d:e4", build_id: "b-draft" })];

    const changes = changeSet(source, draft);
    expect(changes.title_changed).toBe(true);
    expect(changes.cover_changed).toBe(true);
    expect(changes.events_added).toBe(1);

    expect(rebuildReadiness(source, draft, changes)).toEqual({
      ready: false,
      blocking: [],
      reason: NO_CHANGES_REASON,
    });
  });

  it("asks for the missing publish requirement first when both are outstanding", () => {
    const source = sourceRecord();
    const draft = forkOf(source);
    // Removing the only evidence node is a change — and leaves the draft short
    // of the minimum record.
    draftNode(draft, "n-prompt").children = [];

    const readiness = rebuildReadiness(source, draft, changeSet(source, draft));

    expect(readiness.ready).toBe(false);
    expect(readiness.blocking.map((item) => item.key)).toEqual(["evidence"]);
    expect(readiness.reason).toBe(
      "To publish, add one piece of evidence — a result, a screenshot or an eval run."
    );
  });
});

// =============================================================================
// The writes
// =============================================================================

describe("startRebuild", () => {
  const DRAFT = { id: "b-draft", title: "Inbox Triage Agent" } as unknown as Build;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profile = { data: { username: "ama" }, error: null };
    mocks.forkBuild.mockResolvedValue(DRAFT);
    mocks.getBuildHeader.mockResolvedValue(
      buildRow({ title: "Inbox Triage Agent", creator_id: "creator-1" })
    );
    mocks.updateBuild.mockImplementation(async (id: string, patch: Partial<Build>) => ({
      ...DRAFT,
      id,
      ...patch,
    }));
    mocks.deleteBuild.mockResolvedValue(undefined);
  });

  it("forks at the given moment and snapshots the credit onto the draft", async () => {
    const draft = await startRebuild({ sourceBuildId: "b-source", atEventOrdinal: 6 });

    expect(mocks.forkBuild).toHaveBeenCalledWith({
      sourceBuildId: "b-source",
      atEventOrdinal: 6,
    });
    expect(mocks.updateBuild).toHaveBeenCalledWith("b-draft", {
      source_title_at_fork: "Inbox Triage Agent",
      source_handle_at_fork: "ama",
    });
    expect(draft).toMatchObject({
      source_title_at_fork: "Inbox Triage Agent",
      source_handle_at_fork: "ama",
    });
  });

  it("leaves the title alone, so the rebuilder renames it themselves", async () => {
    await startRebuild({ sourceBuildId: "b-source" });

    const [, patch] = mocks.updateBuild.mock.calls[0] as [string, Partial<Build>];
    expect(patch.title).toBeUndefined();
  });

  it("snapshots a null handle rather than inventing one", async () => {
    mocks.profile = { data: { username: null }, error: null };

    await startRebuild({ sourceBuildId: "b-source" });

    expect(mocks.updateBuild).toHaveBeenCalledWith("b-draft", {
      source_title_at_fork: "Inbox Triage Agent",
      source_handle_at_fork: null,
    });
  });

  it("deletes the orphan draft when the snapshot write fails", async () => {
    mocks.updateBuild.mockRejectedValue(new Error("updateBuild failed: denied"));

    await expect(startRebuild({ sourceBuildId: "b-source" })).rejects.toThrow(
      "updateBuild failed: denied"
    );
    expect(mocks.deleteBuild).toHaveBeenCalledWith("b-draft");
  });

  it("deletes the orphan draft when the source cannot be read back", async () => {
    mocks.getBuildHeader.mockResolvedValue(null);

    await expect(startRebuild({ sourceBuildId: "b-source" })).rejects.toThrow(
      "no build b-source"
    );
    expect(mocks.updateBuild).not.toHaveBeenCalled();
    expect(mocks.deleteBuild).toHaveBeenCalledWith("b-draft");
  });

  it("does not clean up after a fork that never happened", async () => {
    mocks.forkBuild.mockRejectedValue(new Error("forkBuild failed: no signed-in user"));

    await expect(startRebuild({ sourceBuildId: "b-source" })).rejects.toThrow(
      "no signed-in user"
    );
    expect(mocks.deleteBuild).not.toHaveBeenCalled();
  });
});

describe("publishRebuild", () => {
  const DRAFT = {
    id: "b-draft",
    status: "draft",
    published_at: null,
  } as unknown as Build;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateBuild.mockImplementation(async (id: string, patch: Partial<Build>) => ({
      ...DRAFT,
      id,
      ...patch,
    }));
  });

  it("writes the note before it writes the status", async () => {
    const published = await publishRebuild(DRAFT, "Swapped the model and it got faster.");

    expect(mocks.updateBuild.mock.calls.map(([, patch]) => patch)).toEqual([
      { rebuild_note: "Swapped the model and it got faster." },
      { status: "published", published_at: expect.any(String) },
    ]);
    expect(published).toMatchObject({ status: "published" });
  });

  it("takes no note at all, because the diff is the content", async () => {
    await publishRebuild(DRAFT, null);

    expect(mocks.updateBuild.mock.calls[0][1]).toEqual({ rebuild_note: null });
  });

  it("stores a note of nothing but whitespace as no note", async () => {
    await publishRebuild(DRAFT, "   \n  ");

    expect(mocks.updateBuild.mock.calls[0][1]).toEqual({ rebuild_note: null });
  });
});
