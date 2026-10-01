// UI-P29 — the Build page's view model: the words and numbers the first screen prints.

import { describe, expect, it } from "vitest";

import type { BuildEvent, ChangeLine, NodeTree, NodeType } from "@/lib/build";

import {
  BUILD_TABS,
  MISSING,
  anatomySubtitle,
  askLabel,
  buildTabs,
  clockLabel,
  deltaLine,
  durationLabel,
  eventText,
  formatFirstResult,
  formatMoney,
  makerLabel,
  needsLine,
  partMeta,
  partsInOrder,
  proofDetails,
  ranIt,
  shortDate,
  tabLayer,
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
