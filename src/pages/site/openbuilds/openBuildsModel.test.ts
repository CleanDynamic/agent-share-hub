// SV-14: the address and the steps strip. A strip's numbers are the build's top-level step numbers (`topSteps`), the
// same the composer and the build page show.

import { describe, expect, it } from "vitest";

import type { StepRequestRecord } from "@/lib/bounty/openBuilds";

import { briefWords, modelTestWords, releaseCheckWords, isBuildKindTab, addressSearch, offerChoice, offerLine, readAddress, sessionRequestWords, sizeOfTab, stripFor, stripsFor, type StripNode } from "./openBuildsModel";

const node = (id: string, position: number | null, extra: Partial<StripNode> = {}): StripNode => ({
  id,
  build_id: "b1",
  parent_id: null,
  type: "prompt",
  title: `Title ${id}`,
  position,
  is_gap: false,
  payload: {},
  ...extra,
});

describe("the address", () => {
  it("reads the tab and the sort, falling back to All and Most needed", () => {
    expect(readAddress(new URLSearchParams(""))).toEqual({ tab: "all", sort: "needed" });
    expect(readAddress(new URLSearchParams("type=steps&sort=reward"))).toEqual({ tab: "steps", sort: "reward" });
  });

  it("reads the Sessions and Parts tabs, and sizes each tab's read", () => {
    expect(readAddress(new URLSearchParams("type=sessions"))).toEqual({ tab: "sessions", sort: "needed" });
    expect(readAddress(new URLSearchParams("type=parts")).tab).toBe("parts");
    expect(["all", "steps", "sessions", "parts"].map((tab) => sizeOfTab(tab as never))).toEqual(["all", "step", "session", "part"]);
  });

  it("ignores a tab that has no live type yet, and a sort it does not know", () => {
    expect(readAddress(new URLSearchParams("type=reviews&sort=oldest"))).toEqual({ tab: "all", sort: "needed" });
  });

  it("writes only what is not the default, and keeps other parameters", () => {
    expect(addressSearch(new URLSearchParams("x=1"), { tab: "steps", sort: "needed" }).toString()).toBe("x=1&type=steps");
    expect(addressSearch(new URLSearchParams("type=steps&sort=reward"), { tab: "all" }).toString()).toBe("sort=reward");
  });
});

describe("the steps strip", () => {
  const steps = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => node(`s${n}`, n * 10));

  it("numbers by place among the top-level steps and opens the gap's", () => {
    const gap = { ...steps[3], is_gap: true, type: "code", title: "Paywalled sources" };
    const strip = stripFor([...steps.slice(0, 3), gap, ...steps.slice(4)], "s4", "Paywalled sources");
    expect(strip.number).toBe("4");
    expect(strip.tiles.map((tile) => tile.number)).toEqual(["2", "3", "4", "5", "6"]);
    expect(strip.tiles.find((tile) => tile.open)).toMatchObject({ id: "s4", kind: "Code", title: "Paywalled sources" });
  });

  it("keeps five tiles at either end of the build", () => {
    expect(stripFor(steps, "s1", "First").tiles.map((tile) => tile.number)).toEqual(["1", "2", "3", "4", "5"]);
    expect(stripFor(steps, "s8", "Last").tiles.map((tile) => tile.number)).toEqual(["4", "5", "6", "7", "8"]);
  });

  it("leaves out what is not a step: an unplaced node, a tool not added as a tile, a setup node", () => {
    const rows = [
      node("a", 1),
      node("tray", null),
      node("tool", 2, { type: "tool" }),
      node("rule", 3, { type: "code", payload: { setup: { kind: "rule" } } }),
      node("b", 4, { is_gap: true }),
    ];
    const strip = stripFor(rows, "b", "Gap");
    expect(strip.tiles.map((tile) => [tile.id, tile.number])).toEqual([
      ["a", "1"],
      ["b", "2"],
    ]);
  });

  it("opens the top-level step a gap sits straight inside, with the gap's title", () => {
    const rows = [node("a", 1), node("agent", 2, { type: "agent_config" }), node("inner", 1, { parent_id: "agent", is_gap: true, title: "Inner" })];
    const strip = stripFor(rows, "inner", "Inner");
    expect(strip.number).toBe("2");
    expect(strip.tiles.find((tile) => tile.open)).toMatchObject({ id: "agent", number: "2", kind: "Agent", title: "Inner" });
  });

  it("draws a gap it cannot place as the gap tile alone, unnumbered", () => {
    const strip = stripFor([node("a", 1)], "deep", "Deep gap");
    expect(strip).toEqual({ number: null, tiles: [{ id: "deep", number: "", kind: "Step", title: "Deep gap", open: true }] });
  });

  it("names an untitled step by its kind", () => {
    expect(stripFor([node("a", 1, { title: null }), node("g", 2, { is_gap: true })], "g", "Gap").tiles[0].title).toBe("Prompt");
  });

  it("groups one read's rows by build", () => {
    const rows = [node("a", 1), node("g", 2, { is_gap: true }), node("x", 1, { build_id: "b2", is_gap: true })];
    const strips = stripsFor(rows, [
      { key: "r1", buildId: "b1", gapId: "g", gapTitle: "Gap" },
      { key: "r2", buildId: "b2", gapId: "x", gapTitle: "Other" },
    ]);
    expect(strips.get("r1")?.tiles.map((tile) => tile.id)).toEqual(["a", "g"]);
    expect(strips.get("r2")?.tiles.map((tile) => tile.id)).toEqual(["x"]);
  });
});


describe("session and part requests (SV-21)", () => {
  const meta = (tool: string | null, workstream: string, model?: string) => ({ tool, date: "2026-10-01", workstream, ...(model ? { model } : null) });
  const making = {
    workstreams: [{ key: "ws-a", name: "Support agent" }, { key: "ws-b" }],
    sessions_meta: {
      "typed-1": meta("claude-code", "ws-a", "Opus 5.5"),
      "typed-2": meta(null, "ws-a"),
      "typed-3": meta(null, "ws-b"),
      "typed-4": meta(null, "ws-b"),
    },
    session_order: ["typed-1", "typed-2", "typed-3", "typed-4"],
  };
  const request = (size: "session" | "part", key: string, madeOf: unknown = making): StepRequestRecord =>
    ({ problem: "Deploy it", target: { size, key, making: madeOf } }) as unknown as StepRequestRecord;

  it("names a session by its number and its part, and marks it open among its neighbours", () => {
    const words = sessionRequestWords(request("session", "typed-4"));
    expect(words?.title).toBe("Part 2 · Session 4 · Deploy it");
    expect(words?.sessions).toEqual([
      { key: "typed-3", label: "Session 3", detail: "Session" },
      { key: "typed-4", label: "Session 4", detail: "Open", open: true },
    ]);
  });

  it("describes the other sessions by their app and model", () => {
    const words = sessionRequestWords(request("session", "typed-2"));
    expect(words?.title).toBe("Part 1 · Support agent · Session 2 · Deploy it");
    expect(words?.sessions[0]).toEqual({ key: "typed-1", label: "Session 1", detail: "Claude Code · Opus 5.5" });
  });

  it("names a part, and ends its sessions with the one it asks for", () => {
    const words = sessionRequestWords(request("part", "ws-a"));
    expect(words?.title).toBe("Part 1 · Support agent · Deploy it");
    expect(words?.sessions.map((tile) => [tile.label, tile.open === true])).toEqual([["Session 1", false], ["Session 2", false], ["Next session", true]]);
  });

  it("leaves the part out when the build has one, and still draws a session the maker has since removed", () => {
    const one = { sessions_meta: { "typed-1": { tool: null, date: "2026-10-01" } }, session_order: ["typed-1"] };
    expect(sessionRequestWords(request("session", "typed-1", one))?.title).toBe("Session 1 · Deploy it");
    const gone = sessionRequestWords(request("session", "typed-9", one));
    expect(gone?.title).toBe("Session · Deploy it");
    expect(gone?.sessions.at(-1)).toEqual({ key: "typed-9", label: "Session", detail: "Open", open: true });
    expect(sessionRequestWords(request("part", "ws-gone", one))?.title).toBe("A part · Deploy it");
  });

  it("draws at most four tiles, around the open one", () => {
    const keys = Array.from({ length: 8 }, (_, at) => `typed-${at + 1}`);
    const many = { sessions_meta: Object.fromEntries(keys.map((key) => [key, { tool: null, date: "2026-10-01" }])), session_order: keys };
    expect(sessionRequestWords(request("session", "typed-6", many))?.sessions.map((tile) => tile.label)).toEqual(["Session 3", "Session 4", "Session 5", "Session 6"]);
    expect(sessionRequestWords(request("part", "ws-implicit", many))?.sessions).toHaveLength(4);
  });

  it("is nothing for a request that is not for a session or a part", () => {
    expect(sessionRequestWords({ problem: "", target: null } as unknown as StepRequestRecord)).toBeNull();
  });

  it("names a library session by its first prompt, with the app, model, day and prompts beneath", () => {
    const base = { id: "i", client: "claude-code", modelName: "Opus 5.5", firstPrompt: "  Deploy the worker  ", promptCount: 6, createdAt: "2026-10-03T10:00:00Z" };
    expect(offerChoice(base)).toEqual({ id: "i", name: "Deploy the worker", detail: "Claude Code · Opus 5.5 · 3 Oct · 6 prompts" });
    expect(offerChoice({ ...base, client: null, modelName: null, firstPrompt: null, promptCount: 1 })).toEqual({ id: "i", name: "Untitled session", detail: "No app chosen · 3 Oct · 1 prompt" });
  });

  it("says who offered what, and 'You' for the reader's own", () => {
    const offer = { handle: "kit", userId: "u9", session: { model: "Opus 5.5", prompts: [1, 2] } };
    expect(offerLine(offer, "maker")).toBe("@kit offered a session · Opus 5.5 · 2 prompts");
    expect(offerLine(offer, "u9")).toBe("You offered a session · Opus 5.5 · 2 prompts");
    expect(offerLine({ ...offer, handle: null, session: { model: null, prompts: [1] } }, null)).toBe("Someone offered a session · 1 prompt");
  });
});

describe("briefs", () => {
  const brief = (answers: { slug: string; runs: number }[]) => ({
    id: "br1", slug: "dentist", title: "Book a dentist", maker: "dax", publishedAt: null, openSteps: 1, answerCount: answers.length, reproduced: answers.filter((a) => a.runs > 0).length,
    answers: answers.map((a, i) => ({ id: `a${i}`, slug: a.slug, title: a.slug, userId: `u${i}`, handle: i === 0 ? "maya" : null, runs: a.runs, createdAt: new Date(0).toISOString() })),
  });

  it("is read from the address and is not a bounty tab", () => {
    expect(readAddress(new URLSearchParams("type=briefs")).tab).toBe("briefs");
    expect(isBuildKindTab("briefs")).toBe(true);
    expect(isBuildKindTab("steps")).toBe(false);
  });

  it("words the open steps, the answers and the lamp, and links Compare only with two answers", () => {
    const two = briefWords(brief([{ slug: "a", runs: 3 }, { slug: "b", runs: 0 }]), 0);
    expect(two.meta).toEqual(["@dax", "1 open step"]);
    expect(two.answersLine).toBe("2 answers · 1 reproduced");
    expect(two.compareTo).toBe("/b2/a/compare/b");
    expect(two.answers.map((a) => [a.handle, a.lit])).toEqual([["@maya", true], ["someone", false]]);
    expect(briefWords(brief([{ slug: "a", runs: 0 }]), 0).compareTo).toBeUndefined();
  });
});

describe("model tests and the release check", () => {
  it("words a model test for the model it asks for, and links the check to the tab", () => {
    const words = modelTestWords({ buildId: "b1", slug: "call", title: "Call notes", maker: "maya", lastConfirmedAt: null, target: "Opus 5.5", models: [{ model: "Opus 5.5", state: "untested" }] }, 0);
    expect(words.title).toBe("Reproduce Call notes on Opus 5.5");
    expect(words.meta).toEqual(["Call notes", "@maya"]);
    const check = releaseCheckWords({ modelId: "opus-5-5", modelName: "Opus 5.5", releasedOn: "2026-10-26", works: 1, fails: 0, untested: 0, total: 1, nextSlug: null, bars: [{ s: "works", n: 1 }] }, Date.parse("2026-10-27T00:00:00Z"));
    expect(check).toMatchObject({ model: "Opus 5.5", released: "released 1 day ago", to: "/openbuilds?type=model-tests", runTo: undefined });
  });
});
