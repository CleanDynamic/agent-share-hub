// CA-17 P5 — a part as something a post can point at: the ref round trip, the picker's groups with and without parts, and
// the lookup the post draws its links from.

import { describe, expect, it } from "vitest";

import type { SessionGroup, Step } from "./graph";
import { filterRefGroups, hasPartRows, refGroups, refLookup, refMatches } from "./postRefs";
import { parseRefTo, refTo } from "./thread";

const step = (id: string, number: string, over: Partial<Step> = {}): Step =>
  ({ id, kind: "prompt", number, title: null, defaultTitle: `Prompt ${number}`, text: `Text of ${id}`, words: 3, model: null, sessionId: null, tool: null, runs: null, uses: [], children: [], ...over }) as Step;

const group = (key: string, number: number, stepNumbers: string[], over: Partial<SessionGroup> = {}): SessionGroup =>
  ({ key, kind: "typed", sessionId: null, number, tool: "Claude", model: null, startedAt: "2026-10-09", stepNumbers, ...over }) as SessionGroup;

const steps = [step("a", "1"), step("b", "2"), step("c", "3")];
const groups = [group("typed-1", 1, ["1"], { startedAt: "2026-10-09" }), group("typed-2", 2, ["2"], { tool: "n8n", startedAt: "2026-10-10" }), group("typed-3", 3, ["3"], { tool: "Claude Code", startedAt: "2026-10-10" })];

const meta = (extra: Record<string, Record<string, unknown>> = {}) => Object.fromEntries(["typed-1", "typed-2", "typed-3"].map((key) => [key, { tool: null, date: "2026-10-09", ...(extra[key] ?? {}) }]));

const two = (labels?: "letters") => ({
  ...(labels ? { part_labels: labels } : null),
  workstreams: [{ key: "ws-a", name: "Tenant portal", colour: "#8FBFB8" }, { key: "ws-b", name: "Support agent" }],
  sessions_meta: meta({ "typed-2": { workstream: "ws-b" }, "typed-3": { workstream: "ws-b" } }),
});

describe("a part's link", () => {
  it("round trips through the ref and the validator", () => {
    const to = refTo({ kind: "workstream", id: "ws-0a1b2c3d" });
    expect(to).toBe("workstream:ws-0a1b2c3d");
    expect(parseRefTo(to)).toEqual({ kind: "workstream", id: "ws-0a1b2c3d" });
    expect(parseRefTo("workstream:")).toBeNull();
    expect(parseRefTo("workstream:not valid!")).toBeNull();
    expect(parseRefTo("part:ws-a")).toBeNull();
  });
});

describe("the picker's groups", () => {
  it("are as they always were with one part, or none", () => {
    const plain = refGroups({ steps, groups });
    expect(refGroups({ steps, groups, making: { sessions_meta: meta() } })).toEqual(plain);
    expect(refGroups({ steps, groups, making: { workstreams: [{ key: "ws-a" }], sessions_meta: meta() } })).toEqual(plain);
    expect(hasPartRows(plain)).toBe(false);
  });

  it("gain a level with two parts: each part leads with its own row, its sessions follow, a level in", () => {
    const made = refGroups({ steps, groups, making: two("letters") });
    expect(hasPartRows(made)).toBe(true);
    expect(made.map((entry) => entry.key)).toEqual(["ws-a", "typed-1", "ws-b", "typed-2", "typed-3"]);
    const [part] = made[2].entries;
    expect(part).toMatchObject({
      to: "workstream:ws-b",
      number: "B",
      title: "The whole part · Support agent",
      kind: "Part",
      depth: 0,
      colour: null,
      name: "part b · support agent",
      eyebrow: "Part B",
      heading: "Support agent",
      id: "ws-b",
    });
    expect(part.body).toBe("2 sessions · n8n, Claude Code · 10 Oct");
    // The part A row carries its colour, for the bar under its number.
    expect(made[0].entries[0]).toMatchObject({ number: "A", colour: "#8FBFB8", body: "1 session · Claude · 9 Oct" });
    // Sessions and their tiles step in one level.
    expect(made[1].entries.map((entry) => [entry.kind, entry.depth])).toEqual([["Session", 1], ["Prompt", 1]]);
  });

  it("number the parts P1, P2 when they are labelled with numbers", () => {
    const made = refGroups({ steps, groups, making: two() });
    expect(made[2].entries[0]).toMatchObject({ number: "P2", name: "part 2 · support agent", eyebrow: "Part 2" });
  });

  it("read a part with no name as 'The whole part'", () => {
    const made = refGroups({ steps, groups, making: { workstreams: [{ key: "ws-a" }, { key: "ws-b" }], sessions_meta: meta({ "typed-3": { workstream: "ws-b" } }) } });
    expect(made.find((entry) => entry.key === "ws-b")?.entries[0]).toMatchObject({ title: "The whole part", heading: "Part 2" });
  });

  it("are searched by part title too", () => {
    const made = refGroups({ steps, groups, making: two("letters") });
    expect(filterRefGroups(made, "support").map((entry) => entry.key)).toEqual(["ws-b"]);
    expect(refMatches(made[2].entries[0], "whole part")).toBe(true);
    expect(refMatches(made[2].entries[0], "b")).toBe(true);
  });

  it("put every part in the lookup the post draws its links from, and a part that is gone is not in it", () => {
    const lookup = refLookup(refGroups({ steps, groups, making: two("letters") }));
    expect(lookup.get("workstream:ws-b")?.kind).toBe("Part");
    expect(lookup.get("workstream:ws-gone")).toBeUndefined();
  });
});
