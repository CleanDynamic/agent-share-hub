// CA-17 P2, P5 — what the List reads about the build's parts.

import { describe, expect, it } from "vitest";

import type { SessionGroup } from "@/lib/build/graph";
import { contrast } from "@/lib/theme/luminance";
import { resolveToken } from "@/lib/theme/resolve";

import { listPartsOf, sessionChoiceLabel } from "./partsModel";

const group = (key: string, number: number, over: Partial<SessionGroup> = {}): SessionGroup =>
  ({ key, kind: "typed", sessionId: null, number, tool: "Claude", model: null, startedAt: "2026-10-09", stepNumbers: [String(number)], ...over }) as SessionGroup;

const groups = [group("typed-1", 1, { title: "Plan" }), group("typed-2", 2, { tool: "n8n" }), group("typed-3", 3, { title: "Triage" })];
const meta = { "typed-1": { tool: null, date: "2026-10-09" }, "typed-2": { tool: null, date: "2026-10-09", workstream: "ws-b", withAbove: true }, "typed-3": { tool: null, date: "2026-10-09", workstream: "ws-b" } };

describe("listPartsOf", () => {
  it("is null with fewer than two parts: nothing about parts is drawn", () => {
    expect(listPartsOf({ sessions_meta: meta }, groups, "dusk")).toBeNull();
    expect(listPartsOf({ workstreams: [{ key: "ws-a" }], sessions_meta: meta }, groups, "dusk")).toBeNull();
  });

  it("titles the parts, counts their sessions and reads who shares a stage", () => {
    const model = listPartsOf({ part_labels: "letters", workstreams: [{ key: "ws-a", name: "Tenant portal" }, { key: "ws-b", name: "Support agent", startsAfter: "typed-1" }], sessions_meta: meta }, groups, "dusk");
    expect(model?.list.map((part) => [part.title, part.view.sessions])).toEqual([["Part A · Tenant portal", 1], ["Part B · Support agent", 2]]);
    expect(model?.withAbove.has("typed-2")).toBe(true);
    expect(model?.partOf.get("typed-3")).toBe("ws-b");
    expect(model?.list[1].view.startsAfterLine).toBe("Part A · Session 1");
    expect(model?.list[1].startsAfterChoices).toEqual([{ key: "typed-1", label: "Session 1 · Plan" }]);
    // Part B starts after Part A, so Part A may not start after anything in Part B.
    expect(model?.list[0].startsAfterChoices).toEqual([]);
  });

  it("draws a part's name in its colour made readable on the surface, and in --text with none", () => {
    const made = { workstreams: [{ key: "ws-a", colour: "#7A3434" }, { key: "ws-b" }], sessions_meta: meta };
    const dusk = listPartsOf(made, groups, "dusk");
    expect(dusk?.list[0].view.colour).toBe("#7A3434");
    expect(dusk?.list[0].view.nameColour).not.toBe("#7A3434");
    expect(contrast(dusk?.list[0].view.nameColour as string, resolveToken("dusk", "surface"))).toBeGreaterThanOrEqual(4.5);
    expect(dusk?.list[1].view.nameColour).toBe("var(--text)");
  });
});

describe("sessionChoiceLabel", () => {
  it("reads 'Session 2 · title', else the app, else the number", () => {
    expect(sessionChoiceLabel({ number: 2, title: "Build", tool: "Claude" })).toBe("Session 2 · Build");
    expect(sessionChoiceLabel({ number: 2, title: undefined, tool: "n8n" })).toBe("Session 2 · n8n");
    expect(sessionChoiceLabel({ number: 2, title: undefined, tool: null })).toBe("Session 2");
  });
});
