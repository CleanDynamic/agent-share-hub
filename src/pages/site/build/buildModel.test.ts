// UI-P29 — the Build page's view model: the words and numbers the first screen prints.

import { describe, expect, it } from "vitest";

import type { BuildEvent, ChangeLine, NodeTree, NodeType } from "@/lib/build";

import {
  BUILD_TABS,
  MISSING,
  anatomySubtitle,
  askLabel,
  breakageRows,
  buildTabs,
  clockLabel,
  deltaLine,
  divergenceSummary,
  durationLabel,
  eventText,
  evidenceDate,
  formatFirstResult,
  formatMoney,
  layerSteps,
  makerLabel,
  needsLine,
  openGaps,
  partMeta,
  partsInOrder,
  proofDetails,
  ranIt,
  replayEvents,
  replayMarkers,
  runBody,
  shortDate,
  tabLayer,
  tabReadsPart,
  timelineFrom,
  timelineSubtitle,
} from "./buildModel";

function node(id: string, over: Partial<NodeTree> = {}): NodeTree {
  return {
    id,
    build_id: "b1",
    parent_id: null,
    position: 0,
    type: "system_prompt",
    title: `Node ${id}`,
    note: null,
    payload: {},
    is_gap: false,
    source_ref: null,
    event_id: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    children: [],
    ...over,
  } as unknown as NodeTree;
}

function event(ordinal: number, over: Partial<BuildEvent> = {}): BuildEvent {
  return {
    id: `e${ordinal}`,
    build_id: "b1",
    ordinal,
    occurred_at: null,
    kind: "note",
    payload: {},
    phase: null,
    phase_title: null,
    visibility: "kept",
    produced_node_id: null,
    created_at: "2026-09-01T00:00:00Z",
    ...over,
  };
}

const type = (fields: NodeType["schema"]["fields"], label = "System prompt") =>
  ({ key: "system_prompt", label, schema: { fields } }) as unknown as NodeType;

describe("the tabs", () => {
  it("keeps BuildTabs' six keys, in its order", () => {
    expect(BUILD_TABS.map((tab) => tab.value)).toEqual(["anatomy", "watch", "run", "understand", "broke", "rebuilds"]);
  });

  it("lists Rebuilds only when there is a rebuild to show", () => {
    expect(buildTabs(false).map((tab) => tab.value)).not.toContain("rebuilds");
    expect(buildTabs(true).map((tab) => tab.value)).toContain("rebuilds");
  });

  it("presets the switch on the two layer tabs and no others", () => {
    expect(tabLayer("run")).toBe("run");
    expect(tabLayer("understand")).toBe("understand");
    expect(tabLayer("anatomy")).toBeNull();
    expect(tabLayer("watch")).toBeNull();
  });
});

describe("words and numbers", () => {
  it("dates in UTC as the orb says it", () => {
    expect(shortDate("2026-09-27T23:30:00Z")).toBe("27 Sep");
    expect(shortDate(null)).toBeNull();
    expect(shortDate("not a date")).toBeNull();
  });

  it("counts runs, parts and kept events", () => {
    expect(ranIt(41)).toBe("41 ran it");
    expect(ranIt(1284)).toBe("1,284 ran it");
    expect(anatomySubtitle(8, 1)).toBe("8 parts · 1 left open");
    expect(anatomySubtitle(1, 0)).toBe("1 part");
    expect(timelineSubtitle("26 minutes", 5)).toBe("26 minutes · 5 events kept");
    expect(timelineSubtitle(null, 1)).toBe("1 event kept");
  });

  it("formats money in its own currency, and leaves a figure it cannot", () => {
    expect(formatMoney(0, "GBP")).toBe("£0");
    expect(formatMoney(12, "gbp")).toBe("£12");
    expect(formatMoney(9.5, "USD")).toBe("US$9.50");
    expect(formatMoney(5, null)).toBe("5");
    expect(formatMoney(5, "credits")).toBe("5 CREDITS");
    expect(formatMoney(null, "GBP")).toBeNull();
    expect(askLabel(150)).toBe("£150 ask");
  });

  it("says the first result in minutes, then hours", () => {
    expect(formatFirstResult(20)).toBe("20 min");
    expect(formatFirstResult(120)).toBe("2 h");
    expect(formatFirstResult(90)).toBe("1.5 h");
    expect(formatFirstResult(null)).toBeNull();
  });

  it("names the maker by handle, else by name", () => {
    expect(makerLabel({ username: "maya", displayName: "Maya" })).toBe("@maya");
    expect(makerLabel({ username: null, displayName: "Maya Okafor" })).toBe("Maya Okafor");
    expect(makerLabel(null)).toBeNull();
  });
});

describe("the tree", () => {
  const tree = [
    node("a", { children: [node("a1"), node("a2", { type: "prerequisite", title: "Gmail" })] }),
    node("b", { type: "prerequisite", title: "Xero" }),
    node("c", { type: "prerequisite", title: "A missing key", is_gap: true }),
  ];

  it("numbers parts depth first, the order the record reads in", () => {
    expect(partsInOrder(tree).map((part) => part.id)).toEqual(["a", "a1", "a2", "b", "c"]);
  });

  it("joins the prerequisites' titles, and a gap is not a need met", () => {
    expect(needsLine(tree)).toBe("Gmail + Xero");
    expect(needsLine([node("x")])).toBeNull();
  });

  it("reads a part's meta off its payload, never inventing a figure", () => {
    const rules = type([{ key: "rules", label: "Rules", type: "list" }]);
    expect(partMeta(node("r", { payload: { rules: [{}, {}, {}] } }), rules)).toBe("3 rules");
    expect(partMeta(node("r", { payload: { rules: [{}] } }), rules)).toBe("1 rule");

    const prompt = type([{ key: "text", label: "Text", type: "text" }]);
    expect(partMeta(node("p", { payload: { text: "one two three four" } }), prompt)).toBe("4 w");

    expect(partMeta(node("s", { payload: {} }), type([], "Screenshot"))).toBe("screenshot");
    expect(partMeta(node("s", { payload: {} }), null)).toBeNull();
  });
});

describe("the proof's details", () => {
  it("prints the six facts in order, with a dash for each one the record leaves out", () => {
    const details = proofDetails(
      {
        made_for: ["finance ops"],
        made_with: ["sonnet-4.5", "xero"],
        cost_setup: 0,
        cost_monthly: 12,
        currency: "GBP",
        time_to_first_result: 20,
      },
      [node("n", { type: "prerequisite", title: "Gmail + Xero" })],
    );
    expect(details).toEqual([
      { label: "Made for", value: "finance ops" },
      { label: "Made with", value: "sonnet-4.5, xero" },
      { label: "Setup", value: "£0" },
      { label: "Monthly", value: "£12" },
      { label: "First result", value: "20 min" },
      { label: "Needs", value: "Gmail + Xero" },
    ]);

    const empty = proofDetails(
      { made_for: null, made_with: [], cost_setup: null, cost_monthly: null, currency: null, time_to_first_result: null },
      [],
    );
    expect(empty.every((detail) => detail.value === MISSING)).toBe(true);
  });
});

describe("the Δ line", () => {
  const line = (text: string): ChangeLine => ({ kind: "changed", key: text, text });

  it("leads with the first change and counts the rest", () => {
    expect(deltaLine([line("Swapped model: sonnet-4.5 → opus-5")])).toBe("Δ swapped model: sonnet-4.5 → opus-5");
    expect(deltaLine([line("Added a prompt 'Retry'"), line("Removed the note"), line("Renamed it")])).toBe(
      "Δ added a prompt 'Retry', and 2 more",
    );
  });

  it("says nothing when nothing was worked out or nothing differs", () => {
    expect(deltaLine(null)).toBeNull();
    expect(deltaLine([])).toBeNull();
  });
});

describe("the timeline", () => {
  it("clocks a step from the start of the build", () => {
    expect(clockLabel(0)).toBe("00:00");
    expect(clockLabel(252_000)).toBe("04:12");
    expect(clockLabel(3 * 3600_000 + 5 * 60_000)).toBe("3h 05");
    expect(clockLabel(3 * 86_400_000)).toBe("day 4");
  });

  it("says how long the build took", () => {
    expect(durationLabel(30_000)).toBe("under a minute");
    expect(durationLabel(26.5 * 60_000)).toBe("26 minutes");
    expect(durationLabel(60_000)).toBe("1 minute");
    expect(durationLabel(5 * 3600_000)).toBe("5 hours");
    expect(durationLabel(4 * 86_400_000)).toBe("4 days");
  });

  it("keeps the kept steps, clocked from the first visible one, and spans every visible one", () => {
    const start = Date.parse("2026-09-09T10:00:00Z");
    const at = (minutes: number) => new Date(start + minutes * 60_000).toISOString();
    const { events, duration } = timelineFrom([
      event(3, { kind: "milestone", occurred_at: at(4.2), payload: { text: "First routed invoice" } }),
      event(1, { kind: "prompt", occurred_at: at(0), payload: { text: "Wrote the outcome" } }),
      event(2, { kind: "note", occurred_at: at(2), visibility: "folded", payload: { text: "folded away" } }),
      event(4, { kind: "deploy", occurred_at: at(26.5), visibility: "hidden" }),
      event(5, { kind: "breakage", occurred_at: at(11 + 40 / 60), phase_title: "Euro totals" }),
    ]);
    expect(events).toEqual([
      { kind: "prompt", at: "00:00", text: "Wrote the outcome" },
      { kind: "milestone", at: "04:12", text: "First routed invoice" },
      { kind: "breakage", at: "11:40", text: "Euro totals" },
    ]);
    expect(duration).toBe("11 minutes");
  });

  it("falls back from the lead to the phase to the kind", () => {
    expect(eventText(event(1, { payload: { text: "  spaced   out " } }))).toBe("spaced out");
    expect(eventText(event(1, { phase_title: "Setup" }))).toBe("Setup");
    expect(eventText(event(1, { kind: "milestone" }))).toBe("Milestone");
  });

  it("does not clock a step that carries no time", () => {
    expect(timelineFrom([event(1, { kind: "prompt", payload: { text: "x" } })])).toEqual({
      events: [{ kind: "prompt", at: MISSING, text: "x" }],
      duration: null,
    });
  });
});

/* ── UI-P30 — the tab bodies ── */

describe("which tabs read the selected part", () => {
  it("keeps the switch, Copy and blurb on the anatomy, Run and Understand, and drops them elsewhere", () => {
    expect(BUILD_TABS.filter((tab) => tabReadsPart(tab.value)).map((tab) => tab.value)).toEqual(["anatomy", "run", "understand"]);
  });
});

describe("the replay's steps", () => {
  const at = (minutes: number) => new Date(Date.parse("2026-09-09T10:00:00Z") + minutes * 60_000).toISOString();

  it("walks the visible steps in ordinal order, clocked from the first, in their phase runs", () => {
    const steps = replayEvents([
      event(3, { kind: "breakage", occurred_at: at(11), payload: { symptom: "Euro totals" }, phase: 2, phase_title: "Testing" }),
      event(1, { kind: "prompt", occurred_at: at(0), payload: { text: "Wrote the outcome" }, phase: 1, phase_title: "Setup" }),
      event(2, { kind: "note", occurred_at: at(4), visibility: "hidden", payload: { text: "private" }, phase: 1 }),
      event(4, { kind: "milestone", occurred_at: at(26.5), visibility: "folded", payload: { text: "Done" }, phase: 2 }),
    ]);
    expect(steps.map((step) => [step.ordinal, step.kind, step.at, step.text, step.phaseTitle])).toEqual([
      [1, "prompt", "00:00", "Wrote the outcome", "Setup"],
      [3, "breakage", "11:00", "Euro totals", "Testing"],
      [4, "milestone", "26:30", "Done", "Testing"],
    ]);
    expect(steps[1].phaseKey).toBe(steps[2].phaseKey);
    expect(steps[0].phaseKey).not.toBe(steps[1].phaseKey);
  });

  it("puts a dot over each step somebody rebuilt from, and none for a whole-build rebuild or an unseen step", () => {
    const steps = replayEvents([event(1), event(2), event(3)]);
    const rebuild = (id: string, username: string, from: string | null) =>
      ({ id, slug: id, title: id, creator: { id, username, display_name: null, avatar_url: null }, rebuild_note: null,
         created_at: "", forked_from_event_id: from, reproduction_count: 0 }) as never;
    const markers = replayMarkers(steps, [rebuild("a", "sam", "e2"), rebuild("b", "rae", "e2"), rebuild("c", "kofi", null), rebuild("d", "ada", "gone")]);
    expect(markers).toEqual([
      { index: 1, label: "2 people rebuilt from here", rebuilds: [{ id: "a", label: "@sam rebuilt from here" }, { id: "b", label: "@rae rebuilt from here" }] },
    ]);
    expect(divergenceSummary(markers)).toBe("2 rebuilds started from a step in this sequence");
  });
});

describe("the run sequence", () => {
  const types = [
    { key: "system_prompt", label: "System prompt", category: "instruction", copyable: true, schema: { fields: [{ key: "text", label: "Text", type: "text" }] } },
    { key: "prerequisite", label: "Prerequisite", category: "narrative", copyable: false, schema: { fields: [] } },
    { key: "result", label: "Result", category: "evidence", copyable: false, schema: { fields: [] } },
  ] as unknown as NodeType[];
  const tree = [
    node("p", { type: "prerequisite", title: "An API key", payload: { requirement: "Any provider." } }),
    node("s", { type: "system_prompt", title: "The prompt", note: "Never shown", payload: { text: "Do the thing." } }),
    node("r", { type: "result", title: "It worked" }),
  ];
  const build = { title: "Thing doer" } as never;

  it("reads the copyable parts as steps and the prerequisites as a checklist, never a note", () => {
    const run = runBody(build, tree, types, null, () => undefined);
    expect(run.steps).toEqual([{ id: "s", title: "The prompt", kind: "System prompt", copyText: "Do the thing." }]);
    expect(run.prerequisites).toEqual([{ id: "p", title: "An API key", requirement: "Any provider." }]);
    expect(run.allText).toContain("1. The prompt\nDo the thing.");
    expect(run.allText).not.toContain("Never shown");
    expect(run.words).toBeNull();
  });

  it("offers the run layer in words, naming the parts that still resolve, under its attribution", () => {
    const layer = { content: { steps: [{ n: 1, title: " Paste it ", body: "Into a chat.", node_ref: "s" }, { n: 2, title: "Then", body: "", node_ref: "gone" }] } };
    const words = layerSteps(layer as never, (id) => (id === "s" ? (tree[1] as never) : undefined));
    expect(words.attribution).toMatch(/^Written by buildgallery/);
    expect(words.steps).toEqual([
      { n: 1, title: "Paste it", body: "Into a chat.", part: { id: "s", title: "The prompt" } },
      { n: 2, title: "Then", body: "", part: null },
    ]);
    expect(runBody(build, tree, types, layer as never, () => undefined).words?.steps).toHaveLength(2);
  });
});

describe("where it broke", () => {
  const types = [{ key: "breakage", label: "Breakage", category: "narrative", renderer: "breakage", schema: { fields: [] } }] as unknown as NodeType[];

  it("reads a written-up breakage's symptom, fix and attempts, and an event-only one's own line, in step order", () => {
    const rows = breakageRows(
      [node("k", { type: "breakage", title: "Euro totals", event_id: "e5", payload: { symptom: "Totals were off.", resolution: "Parse the currency.", attempts: 3 } })],
      [event(2, { kind: "breakage", payload: { text: "It timed out." } }), event(5, { kind: "breakage" })],
      types,
    );
    expect(rows).toEqual([
      { key: "event-e2", name: "Breakage at step 2", happened: "It timed out.", fix: null, span: "step 2", start: 2, attempts: null },
      { key: "node-k", name: "Euro totals", happened: "Totals were off.", fix: "Parse the currency.", span: "step 5", start: 5, attempts: "3 attempts" },
    ]);
  });

  it("lists every gap still open, with the reward and a way to solve it only where a bounty is open", () => {
    const tree = [
      node("g1", { is_gap: true, title: "Delegation", payload: { gap_problem: "Who to hand it to." } }),
      node("g2", { is_gap: true, title: "Calendar" }),
      node("n", { title: "Not a gap" }),
    ];
    const bounties = new Map([["g1", { bounty: { id: "x", status: "open", reward_gbp: 150 }, solutions: 0, meToo: false }]]) as never;
    expect(openGaps(tree, bounties)).toEqual([
      { id: "g1", title: "Delegation", problem: "Who to hand it to.", reward: "£150", solvable: true },
      { id: "g2", title: "Calendar", problem: null, reward: null, solvable: false },
    ]);
  });
});

describe("a result's date", () => {
  it("is when the run was made, else the step it was recorded at, else when the part was placed", () => {
    const events = [event(1, { id: "e1", occurred_at: "2026-09-12T08:00:00Z" })];
    expect(evidenceDate({ payload: { run_at: "2026-09-29T10:00:00Z" }, event_id: "e1", created_at: "2026-09-01T00:00:00Z" }, events)).toBe("29 Sep");
    expect(evidenceDate({ payload: {}, event_id: "e1", created_at: "2026-09-01T00:00:00Z" }, events)).toBe("12 Sep");
    expect(evidenceDate({ payload: {}, event_id: null, created_at: "2026-09-01T00:00:00Z" }, events)).toBe("1 Sep");
    expect(evidenceDate({ payload: {}, event_id: null, created_at: "" }, events)).toBeNull();
  });
});
