// SV-28 Part 6: the trust boundary: outside content reaching an agent that can send or spend, with no approval between.

import { describe, expect, it } from "vitest";

import { beforeYouCopy } from "./deploymentNeeds";
import { crossingDetail, crossingLine, trustBoundaryOf } from "./trustBoundary";
import type { NodeTree } from "./types";

const node = (id: string, position: number, type: string, payload: Record<string, unknown>, title: string | null = null, children: NodeTree[] = []): NodeTree => {
  const made = { id, build_id: "b", parent_id: null, position, type, title, payload, children } as unknown as NodeTree;
  for (const child of children) (child as unknown as { parent_id: string }).parent_id = id;
  return made;
};

const reader = (extra: Record<string, unknown> = {}) => ({ model: "m", role: "Research", tools: ["gmail"], tool_permissions: { gmail: "read" }, ...extra });
const writer = (extra: Record<string, unknown> = {}) => ({ model: "m", role: "Operations", tools: ["slack"], tool_permissions: { slack: "write" }, ...extra });
const team = (a: Record<string, unknown>, b: Record<string, unknown>, after: NodeTree[] = []): NodeTree[] => [node("t", 1, "team", {}, "Team", [node("r", 0, "agent_config", a), node("o", 1, "agent_config", b)]), ...after];

describe("trustBoundaryOf", () => {
  it("an agent with Gmail (read) and Slack (write) gives one crossing", () => {
    const tree = [node("a", 1, "agent_config", { model: "m", role: "Assistant", tools: ["gmail", "slack"], tool_permissions: { gmail: "read", slack: "write" } })];
    const crossings = trustBoundaryOf({ tree });
    expect(crossings).toEqual([{ from: "a", to: "a", reads: ["Gmail", "Slack"], acts: ["Slack", "write"] }]);
    expect(crossingDetail(crossings[0], tree)).toBe("Reads outside content (Gmail and Slack) and can send (Slack, write). No approval between.");
    expect(crossingLine(crossings[0], tree)).toBe("Assistant reads outside content and can send in Slack, with no approval between.");
  });

  it("an agent that reads and writes through the same tool is a crossing (an email that makes it forward the inbox)", () => {
    const tree = [node("a", 1, "agent_config", { model: "m", role: "Inbox", tools: ["gmail"], tool_permissions: { gmail: "write" } })];
    const crossings = trustBoundaryOf({ tree });
    expect(crossings).toEqual([{ from: "a", to: "a", reads: ["Gmail"], acts: ["Gmail", "write"] }]);
    expect(crossingLine(crossings[0], tree)).toBe("Inbox reads outside content and can send in Gmail, with no approval between.");
  });

  it("a handoff from a Gmail reader to a Slack writer is a crossing, and goes once the rule has needs_approval; the Slack writer is one of its own", () => {
    const tree = team(reader({ handoffs: [{ to: "o", when: "a request needs action" }] }), writer());
    const crossings = trustBoundaryOf({ tree });
    // Slack is outside content too, so Operations reads and can send in it: a crossing of its own, which no handoff approval removes.
    expect(crossings).toEqual([
      { from: "r", to: "o", reads: ["Gmail"], acts: ["Slack", "write"] },
      { from: "o", to: "o", reads: ["Slack"], acts: ["Slack", "write"] },
    ]);
    expect(crossingDetail(crossings[0], tree)).toBe("Reads outside content (Gmail) and passes work to Operations, which can send (Slack, write). No approval between.");
    expect(crossingLine(crossings[0], tree)).toBe("Research reads outside content and passes work to Operations, which can send or spend, with no approval between.");
    expect(trustBoundaryOf({ tree: team(reader({ handoffs: [{ to: "o", when: "x", needs_approval: true }] }), writer()) })).toEqual([{ from: "o", to: "o", reads: ["Slack"], acts: ["Slack", "write"] }]);
  });

  it("an Approval step blocking the receiver removes the crossing", () => {
    const tree = team(reader({ handoffs: [{ to: "o", when: "x" }] }), writer(), [node("g", 0, "manual_step", { gate: { approves: "The reply", by: "maker", blocks: ["o"] } })]);
    expect(trustBoundaryOf({ tree })).toEqual([]);
  });

  it("approval_mode every (or reviewer) on the receiver removes it; full access makes one", () => {
    expect(trustBoundaryOf({ tree: team(reader({ handoffs: [{ to: "o", when: "x" }] }), writer({ approval_mode: "every" })) })).toEqual([]);
    expect(trustBoundaryOf({ tree: team(reader({ handoffs: [{ to: "o", when: "x" }] }), writer({ approval_mode: "reviewer" })) })).toEqual([]);
    expect(trustBoundaryOf({ tree: team(reader({ handoffs: [{ to: "o", when: "x" }] }), { model: "m", role: "Operations", approval_mode: "full" }) })[0].acts).toEqual(["full access"]);
  });

  it("every job of the receiver approved first removes it", () => {
    const tree = team(reader({ handoffs: [{ to: "o", when: "x" }] }), writer());
    (tree[0].children[1] as unknown as { children: NodeTree[] }).children = [node("j", 0, "prompt", { text: "Post it", needs_approval: true })];
    (tree[0].children[1].children[0] as unknown as { parent_id: string }).parent_id = "o";
    expect(trustBoundaryOf({ tree })).toEqual([]);
  });

  it("a build with no outside-content tools gives none", () => {
    const tree = team({ model: "m", role: "A", tools: ["supabase"], tool_permissions: { supabase: "write" }, handoffs: [{ to: "o", when: "x" }] }, { model: "m", role: "B", tools: ["stripe"], tool_permissions: { stripe: "delegated" } });
    expect(trustBoundaryOf({ tree })).toEqual([]);
  });

  it("reads tool nodes too, and shows each crossing once in Before you copy, blocking nothing", () => {
    const tree = [
      node("gm", 0, "integration", { service: "gmail" }),
      ...team(reader({ tools: [{ tool_ref: "gm" }], handoffs: [{ to: "o", when: "x" }, { to: "o", when: "y" }] }), writer()),
    ];
    const lines = beforeYouCopy(tree).filter((line) => line.includes("outside content"));
    expect(lines).toEqual(["Research reads outside content and passes work to Operations, which can send or spend, with no approval between.", "Operations reads outside content and can send in Slack, with no approval between."]);
  });
});
