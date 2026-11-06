// UX-09 Part 1: Where it broke offers a topic. Each recorded breakage row has `Start a topic`, which hands the row to the page (the
// page opens the New post window with failedRunDraft, the same prefill Home's failed run uses), and a gap's `Solve it` is `Reply`:
// to the still-open topic's reply box when the gap has one, else to the old request's solve sheet, as before.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { failedRunDraft } from "@/pages/site/home/runTopic";

import { BreakageBody } from "./BreakageBody";
import { openGaps, type BreakageRowView, type OpenGapView } from "./buildModel";

const row = (over: Partial<BreakageRowView> = {}): BreakageRowView => ({
  key: "node-b1",
  name: "Webhook timed out",
  happened: "The call hung.",
  fix: null,
  span: "step 4",
  start: 4,
  attempts: null,
  ...over,
});

const gap = (over: Partial<OpenGapView> = {}): OpenGapView => ({
  id: "g1",
  title: "Auth for the second account",
  problem: null,
  topicId: null,
  ...over,
});

describe("UX-09 P1: Start a topic on each breakage row", () => {
  it("each row has a Start a topic control that hands the row to the page", () => {
    const onStartTopic = vi.fn();
    render(<BreakageBody breakage={{ rows: [row(), row({ key: "node-b2", name: "Rate limit", start: null, span: null })], gaps: [], onStartTopic }} />);
    const controls = screen.getAllByRole("button", { name: /^Start a topic/ });
    expect(controls).toHaveLength(2);
    expect(controls[0].textContent).toBe("Start a topic");
    fireEvent.click(screen.getByRole("button", { name: "Start a topic: Webhook timed out" }));
    expect(onStartTopic).toHaveBeenCalledWith(expect.objectContaining({ key: "node-b1", start: 4 }));
  });

  it("draws no Start a topic when the page gives no way to start one (signed out on a draft, a fixture)", () => {
    render(<BreakageBody breakage={{ rows: [row()], gaps: [] }} />);
    expect(screen.queryByRole("button", { name: /^Start a topic/ })).toBeNull();
  });

  it("the prefill is failedRunDraft's: the build attached and the step in the words", () => {
    const draft = failedRunDraft({ buildId: "b-1", model: null, step: { number: "4", nodeId: null } });
    expect(draft.body).toBe("Didn't work for me at Step 4.\n\n");
    expect(draft.attachments).toEqual([{ key: JSON.stringify({ kind: "build", buildId: "b-1" }), input: { kind: "build", buildId: "b-1" } }]);
    // A breakage names a replay step, not a step tile: there is no node to mark still open.
    expect(draft.stillOpen).toBe(false);
    expect(draft.openNodeId).toBeNull();
  });

  it("a step tile that is known is still marked still open", () => {
    const draft = failedRunDraft({ buildId: "b-1", model: "claude-opus-4-1", step: { number: "3", nodeId: "n-3" } });
    expect(draft.stillOpen).toBe(true);
    expect(draft.openNodeId).toBe("n-3");
    expect(draft.added).toEqual(["open"]);
  });
});

describe("UX-09 P1: a gap's Solve it is Reply", () => {
  it("no Solve it is left", () => {
    render(<BreakageBody breakage={{ rows: [], gaps: [gap(), gap({ id: "g2", topicId: "t-1" })], onReply: vi.fn() }} />);
    expect(screen.queryByText("Solve it")).toBeNull();
    expect(screen.queryByRole("button", { name: /Solve it/ })).toBeNull();
  });

  it("a gap with a still-open topic replies in that topic", () => {
    const onReply = vi.fn();
    render(<BreakageBody breakage={{ rows: [], gaps: [gap({ topicId: "t-1" })], onReply }} />);
    const button = screen.getByRole("button", { name: "Reply: Auth for the second account" });
    expect(button.textContent).toBe("Reply");
    fireEvent.click(button);
    expect(onReply).toHaveBeenCalledWith("t-1");
  });

  it("a gap with neither draws no Reply", () => {
    render(<BreakageBody breakage={{ rows: [], gaps: [gap()], onReply: vi.fn() }} />);
    expect(screen.queryByRole("button", { name: /^Reply/ })).toBeNull();
  });

  it("openGaps takes the still-open topic about the gap, newest given first", () => {
    const tree = [{ id: "g1", type: "step", title: "Auth", is_gap: true, payload: {}, children: [] }] as unknown as Parameters<typeof openGaps>[0];
    const gaps = openGaps(tree, new Map([["g1", "t-9"]]));
    expect(gaps[0]?.topicId).toBe("t-9");
    expect(openGaps(tree)[0]?.topicId).toBeNull();
  });
});

describe("UX-09 P1: stillOpenTopicsByNode", () => {
  it("takes the newest still-open topic about each step, and no reply or closed topic", async () => {
    const { stillOpenTopicsByNode } = await import("@/lib/openbuilds/connections");
    const post = (id: string, over: Record<string, unknown>) => ({ id, parentId: null, stillOpen: true, aboutNodeId: "g1", createdAt: "2026-11-01T00:00:00Z", ...over });
    const topics = [
      post("old", { createdAt: "2026-10-01T00:00:00Z" }),
      post("new", { createdAt: "2026-11-02T00:00:00Z" }),
      post("reply", { parentId: "new", createdAt: "2026-11-03T00:00:00Z" }),
      post("closed", { stillOpen: false, createdAt: "2026-11-04T00:00:00Z" }),
      post("other", { aboutNodeId: "g2" }),
    ] as unknown as Parameters<typeof stillOpenTopicsByNode>[0];
    expect([...stillOpenTopicsByNode(topics)]).toEqual([["g1", "new"], ["g2", "other"]]);
  });
});
