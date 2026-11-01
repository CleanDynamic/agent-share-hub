// SV-28 Parts 1, 3, 4 and 5: team instructions, handoff rules, jobs, output rules, rules followed, the Approval step, the
// workspace and the example run, checked at the payload they store and the steps they draw.

import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertNode = vi.fn();
vi.mock("./nodes", () => ({
  upsertNode: (...a: unknown[]) => upsertNode(...a),
  getNodeTree: vi.fn(),
  reorderNodes: vi.fn(async () => undefined),
  deleteNode: vi.fn(),
}));
const getNodeType = vi.fn();
vi.mock("./nodeTypes", () => ({ getNodeType: (...a: unknown[]) => getNodeType(...a), clearNodeTypeCache: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import type { Json } from "@/integrations/supabase/types";

import { layoutArchitecture } from "./architectureMap";
import { methodOf } from "./forkRules";
import { rewritePayload } from "./fork";
import { addManualStep, buildSteps, nestMoves, setExtras, tidyTeamWork, topSteps } from "./graph";
import { duplicateTiles } from "./duplicate";
import {
  EXAMPLE_COPY,
  GATE_COPY,
  HANDOFF_COPY,
  JOB_COPY,
  RULES_COPY,
  gateLine,
  jobLine,
  takesMerge,
  teamWorkFixes,
  workspaceLine,
} from "./teamFields";
import type { BuildNode, NodeTree } from "./types";

const BUILD = "28282828-0000-4000-8000-000000000028";
const node = (id: string, position: number, type: string, payload: Record<string, unknown>, title: string | null = null, children: NodeTree[] = []): NodeTree => {
  const made = { id, build_id: BUILD, parent_id: null, position, type, title, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "2026-11-01T09:00:00.000Z", children } as unknown as NodeTree;
  for (const child of children) (child as unknown as { parent_id: string }).parent_id = id;
  return made;
};
const row = (tree: readonly NodeTree[], id: string): BuildNode => {
  const all = (nodes: readonly NodeTree[]): NodeTree[] => nodes.flatMap((n) => [n, ...all(n.children ?? [])]);
  const { children: _c, ...rest } = all(tree).find((n) => n.id === id) as NodeTree;
  return rest as unknown as BuildNode;
};
const written = (): Record<string, unknown> => (upsertNode.mock.calls.at(-1)?.[0] as { payload: Record<string, Json> }).payload;

/** A team of three, a top-level agent outside it, a prompt inside the Writer, and two prompts after. */
function teamBuild(): NodeTree[] {
  return [
    node("p1", 1, "prompt", { text: "Plan the launch" }),
    node("t1", 2, "team", { pattern: "group", system_prompt: "Every agent writes plainly. Ask @Reviewer when unsure." }, "Launch team", [
      node("a1", 0, "agent_config", { model: "opus-5-5", role: "Researcher", system_prompt: "Find sources.", handoffs: [{ to: "a2", when: "three sources are found" }] }, "Researcher"),
      node("a2", 1, "agent_config", { model: "sonnet-5-5", role: "Writer", system_prompt: "Write the draft, then ask @Reviewer.", handoffs: [{ to: "a3", when: "the draft is complete" }] }, "Writer", [
        node("a2p", 0, "prompt", { text: "Draft the weekly email", deliverable: { kind: "draft", name: "Weekly pipeline email" }, destination: "gmail", needs_approval: true }),
      ]),
      node("a3", 2, "agent_config", { model: "qwen2-5", role: "Reviewer", system_prompt: "Check the draft.", handoffs: [{ to: "a2", when: "changes are needed" }] }, "Reviewer"),
    ]),
    node("ag", 3, "agent_config", { model: "opus-5-5", system_prompt: "Alone." }, "Solo"),
    node("p4", 4, "prompt", { text: "Send it" }),
  ];
}

beforeEach(() => {
  upsertNode.mockReset();
  upsertNode.mockImplementation(async (r: unknown) => r);
  getNodeType.mockReset();
  getNodeType.mockResolvedValue({ key: "x", is_active: true });
});

describe("Part 1 · team instructions", () => {
  it("save on the team, are read as the team's, and take no number", async () => {
    const tree = teamBuild();
    await setExtras(row(tree, "t1"), { system_prompt: "  Keep notes in {notes_folder}.  " }, tree);
    expect(written().system_prompt).toBe("Keep notes in {notes_folder}.");
    const steps = buildSteps(tree);
    const team = steps.find((step) => step.id === "t1");
    expect(team?.teamInstructions).toBe("Every agent writes plainly. Ask @Reviewer when unsure.");
    // Numbering unchanged: the team is 2, its agents 2.1 to 2.3, nothing for the instructions.
    expect(steps.map((step) => step.number)).toEqual(["1", "2", "3", "4"]);
    expect(team?.children.map((child) => child.number)).toEqual(["2.1", "2.2", "2.3"]);
  });

  it("are not a field of an agent's own row", async () => {
    await expect(setExtras(row(teamBuild(), "ag"), { workspace: { kind: "separate" } })).rejects.toThrow();
  });
});

describe("Part 1 · handoff rules", () => {
  it("save to another agent in the same team, with the condition and the approval switch", async () => {
    const tree = teamBuild();
    await setExtras(row(tree, "a1"), { handoffs: [{ to: "a3", when: " the sources are checked ", needs_approval: true }] }, tree);
    expect(written().handoffs).toEqual([{ to: "a3", when: "the sources are checked", needs_approval: true }]);
    expect(buildSteps(tree).find((s) => s.id === "t1")?.children[0].handoffs).toEqual([{ to: "a2", when: "three sources are found" }]);
  });

  it("refuse an agent outside the team, the agent itself, an empty condition and a ninth rule", async () => {
    const tree = teamBuild();
    await expect(setExtras(row(tree, "a1"), { handoffs: [{ to: "ag", when: "done" }] }, tree)).rejects.toThrow(HANDOFF_COPY.notInTeam);
    await expect(setExtras(row(tree, "a1"), { handoffs: [{ to: "a1", when: "done" }] }, tree)).rejects.toThrow(HANDOFF_COPY.notInTeam);
    await expect(setExtras(row(tree, "a1"), { handoffs: [{ to: "a2", when: " " }] }, tree)).rejects.toThrow(HANDOFF_COPY.needsWhen);
    await expect(setExtras(row(tree, "a1"), { handoffs: [{ to: "a2", when: "x".repeat(121) }] }, tree)).rejects.toThrow("120 characters");
    await expect(setExtras(row(tree, "a1"), { handoffs: Array.from({ length: 9 }, () => ({ to: "a2", when: "done" })) }, tree)).rejects.toThrow("8");
    await expect(setExtras(row(tree, "ag"), { handoffs: [{ to: "a2", when: "done" }] }, tree)).rejects.toThrow(HANDOFF_COPY.lone);
    expect(upsertNode).not.toHaveBeenCalled();
  });

  it("moving an agent out of its team takes off the rules that point at it or from it, in the same write", async () => {
    const tree = teamBuild();
    // The Writer leaves the team: it is now a top-level step.
    const moves = nestMoves(tree, "a2", null, 5);
    const writer = { ...row(tree, "a2"), parent_id: null, position: moves.find((m) => m.id === "a2")?.position } as unknown as NodeTree;
    const team = tree.find((n) => n.id === "t1") as NodeTree;
    const after: NodeTree[] = [...tree.filter((n) => n.id !== "t1"), { ...team, children: (team.children ?? []).filter((c) => c.id !== "a2") }, { ...writer, children: [] }];
    const fixes = teamWorkFixes(after, topSteps(after).map((s) => s.id));
    const byId = Object.fromEntries(fixes.map((fix) => [fix.id, fix.payload]));
    expect(byId.a1.handoffs).toBeUndefined();
    expect(byId.a3.handoffs).toBeUndefined();
    expect(byId.a2.handoffs).toBeUndefined();
    // Written through the node writer, one row each, by the step's tidy (useBuildHistory runs it inside the step).
    const done = await tidyTeamWork(after);
    expect(done.rows.map((r) => r.id).sort()).toEqual(["a1", "a2", "a3"]);
    expect(done.movedBeforeGate).toBe(false);
  });
});

describe("Part 1 · fork and duplicate", () => {
  it("a fork keeps both fields and points each handoff at the copied agent", () => {
    const ids = new Map([["a1", "c1"], ["a2", "c2"], ["a3", "c3"], ["t1", "ct"]]);
    const out = methodOf(rewritePayload({ system_prompt: "Rules", handoffs: [{ to: "a2", when: "three sources are found" }] } as Json, undefined, ids) as object) as Record<string, unknown>;
    expect(out.handoffs).toEqual([{ to: "c2", when: "three sources are found" }]);
    expect(methodOf({ system_prompt: "Team rules" })).toEqual({ system_prompt: "Team rules" });
  });

  it("Duplicate of a team points the copies' handoffs at the copied agents", () => {
    const tree = teamBuild();
    const flatRows = (nodes: readonly NodeTree[]): BuildNode[] => nodes.flatMap((n) => [row(tree, n.id), ...flatRows(n.children ?? [])]);
    let n = 0;
    const { snapshot } = duplicateTiles({ nodes: flatRows(tree), making: null, sessions: [] } as never, ["t1"], () => `d${++n}`);
    const copies = snapshot.nodes.filter((r) => r.id.startsWith("d"));
    const researcher = copies.find((r) => (r.payload as Record<string, unknown>).role === "Researcher");
    const writer = copies.find((r) => (r.payload as Record<string, unknown>).role === "Writer");
    expect((researcher?.payload as { handoffs: { to: string }[] }).handoffs[0].to).toBe(writer?.id);
  });
});

describe("Part 1 · the architecture map", () => {
  it("draws one line per rule, labelled hands off to, with when on it", () => {
    const tree = [...teamBuild(), node("m1", 9, "memory", { provider: "mem0", keeps: "notes", agent: "a1", tagged_by_agent: false, connects: [] })];
    const lines = layoutArchitecture(tree).lines.filter((line) => line.label === HANDOFF_COPY.line);
    expect(lines.map((line) => [line.from, line.to, line.when])).toEqual([
      ["a1", "a2", "three sources are found"],
      ["a2", "a3", "the draft is complete"],
      ["a3", "a2", "changes are needed"],
    ]);
  });
});

describe("Part 3 · jobs", () => {
  it("save on a prompt inside an agent and draw the job line", async () => {
    const tree = teamBuild();
    await setExtras(row(tree, "a2p"), { deliverable: { kind: "sheet", name: "Weekly pipeline sheet" }, destination: "Google Drive, Clients folder", needs_approval: true }, tree);
    expect(written()).toMatchObject({ deliverable: { kind: "sheet", name: "Weekly pipeline sheet" }, destination: "Google Drive, Clients folder", needs_approval: true });
    const job = buildSteps(tree).find((s) => s.id === "t1")?.children[1].children[1].job;
    expect(job).toEqual({ deliverable: { kind: "draft", name: "Weekly pipeline email" }, destination: "gmail", needsApproval: true });
    expect(jobLine(job ?? {}, (id) => (id === "gmail" ? "Gmail" : id))).toBe("Delivers a draft · Weekly pipeline email → Gmail · Approved first");
  });

  it("are refused on a prompt outside an agent, and absent from its step", async () => {
    const tree = teamBuild();
    await expect(setExtras(row(tree, "p1"), { deliverable: { kind: "doc", name: "Plan" } }, tree)).rejects.toThrow(JOB_COPY.onlyInAgent);
    await expect(setExtras(row(tree, "p1"), { needs_approval: true })).rejects.toThrow(JOB_COPY.onlyInAgent);
    const top = node("p9", 9, "prompt", { text: "x", deliverable: { kind: "doc", name: "Plan" } });
    expect(buildSteps([top])[0].job).toBeUndefined();
  });

  it("keep limits: a name of 61 characters and an unknown kind are refused", async () => {
    const tree = teamBuild();
    await expect(setExtras(row(tree, "a2p"), { deliverable: { kind: "draft", name: "x".repeat(61) } }, tree)).rejects.toThrow("60");
    await expect(setExtras(row(tree, "a2p"), { deliverable: { kind: "poem", name: "x" } }, tree)).rejects.toThrow();
    await expect(setExtras(row(tree, "a2p"), { destination: "x".repeat(61) }, tree)).rejects.toThrow("60");
  });
});

describe("Part 3 · output rules and rules followed", () => {
  it("save within their limits and refuse an address that is not https", async () => {
    const tree = teamBuild();
    await setExtras(row(tree, "a2"), { output_rules: "Drafts only, never send\n\nPlain English", rules_followed: [{ text: "GOV.UK style guide", url: "https://www.gov.uk/guidance/style-guide" }] }, tree);
    expect(written()).toMatchObject({ output_rules: ["Drafts only, never send", "Plain English"], rules_followed: [{ text: "GOV.UK style guide", url: "https://www.gov.uk/guidance/style-guide" }] });
    await expect(setExtras(row(tree, "a2"), { rules_followed: [{ text: "Guide", url: "http://example.com" }] }, tree)).rejects.toThrow(RULES_COPY.https);
    await expect(setExtras(row(tree, "a2"), { output_rules: Array.from({ length: 9 }, (_, i) => `rule ${i}`) }, tree)).rejects.toThrow("8");
    await expect(setExtras(row(tree, "a2"), { output_rules: ["x".repeat(101)] }, tree)).rejects.toThrow("100");
  });

  it("a fork keeps all four fields, with a tool destination pointed at the copied tool", () => {
    const ids = new Map([["tool-node-1", "tool-node-2"]]);
    const payload = { text: "Draft", deliverable: { kind: "draft", name: "Email" }, destination: "tool-node-1", needs_approval: true, output_rules: ["Drafts only"], rules_followed: [{ text: "Guide", url: "https://example.com/g" }] };
    const out = methodOf(rewritePayload(payload as Json, undefined, ids) as object) as Record<string, unknown>;
    expect(out).toEqual({ ...payload, destination: "tool-node-2" });
  });
});

describe("Part 4 · the Approval step", () => {
  it("Add > Approval makes a numbered manual_step that holds the gate", async () => {
    const tree = teamBuild();
    const created = await addManualStep(BUILD, tree, { gate: { approves: "The client email draft", by: "maker", blocks: ["p4"] } });
    expect(created).toMatchObject({ type: "manual_step", payload: { gate: { approves: "The client email draft", by: "maker", blocks: ["p4"] } } });
    const gateTree = [...tree.filter((n) => n.id !== "p4"), node("g1", 4, "manual_step", { gate: { approves: "The client email draft", by: "maker", blocks: ["p4"] } }), node("p4", 5, "prompt", { text: "Send it" })];
    const steps = buildSteps(gateTree);
    const gate = steps.find((s) => s.id === "g1");
    expect(gate?.number).toBe("4");
    expect(gate?.defaultTitle).toBe(GATE_COPY.title);
    expect(steps.find((s) => s.id === "p4")?.waitsFor).toEqual({ id: "g1", number: "4" });
    expect(gateLine(gate?.gate as never, ["5"])).toBe("The maker approves the client email draft before step 5");
    expect(GATE_COPY.waits("4")).toBe("Waits for approval (step 4)");
  });

  it("refuses a blocked step numbered before the gate, and a reviewer with no agent", async () => {
    const tree = [...teamBuild(), node("g1", 5, "manual_step", { gate: { approves: "Draft", by: "maker", blocks: [] } })];
    await expect(setExtras(row(tree, "g1"), { gate: { approves: "Draft", by: "maker", blocks: ["p1"] } }, tree)).rejects.toThrow(GATE_COPY.after);
    await expect(setExtras(row(tree, "g1"), { gate: { approves: "Draft", by: "reviewer", blocks: [] } }, tree)).rejects.toThrow(GATE_COPY.needsReviewer);
    await expect(addManualStep(BUILD, tree, { gate: { approves: "", by: "maker", blocks: [] } })).rejects.toThrow();
  });

  it("moving a blocked step above the gate takes it off blocks, in the same step, and says so", async () => {
    const tree = [node("g1", 1, "manual_step", { gate: { approves: "Draft", by: "client", blocks: ["p2", "p3"] } }), node("p2", 2, "prompt", { text: "a" }), node("p3", 3, "prompt", { text: "b" })];
    const moved = tree.map((n) => (n.id === "p3" ? ({ ...n, position: 0 } as NodeTree) : n));
    const done = await tidyTeamWork(moved);
    expect(done.movedBeforeGate).toBe(true);
    expect((written().gate as { blocks: string[] }).blocks).toEqual(["p2"]);
    expect(GATE_COPY.movedBefore).toBe("Moved before its approval, so it no longer waits for it");
  });

  it("a fork points blocks and the reviewer agent at the copies", () => {
    const ids = new Map([["p4", "c4"], ["a3", "c3"]]);
    const out = rewritePayload({ gate: { approves: "Draft", by: "reviewer", reviewer_agent: "a3", blocks: ["p4"] } } as Json, undefined, ids) as Record<string, unknown>;
    expect(out.gate).toEqual({ approves: "Draft", by: "reviewer", reviewer_agent: "c3", blocks: ["c4"] });
  });
});

describe("Part 5 · workspace and example run", () => {
  it("each workspace kind saves; merging hides with separate places", async () => {
    const tree = teamBuild();
    for (const kind of ["git_worktrees", "shared_folder", "separate"]) {
      await setExtras(row(tree, "t1"), { workspace: { kind, merge: "one_at_a_time", merged_by: "a3" } }, tree);
      expect((written().workspace as { kind: string }).kind).toBe(kind);
    }
    expect(written().workspace).toEqual({ kind: "separate" });
    expect(takesMerge("separate")).toBe(false);
    expect(workspaceLine({ kind: "git_worktrees", merge: "one_at_a_time", merged_by: "a3" }, () => "Reviewer")).toBe("Git worktrees · merged one at a time by Reviewer");
    await expect(setExtras(row(tree, "t1"), { workspace: { kind: "git_worktrees", merged_by: "ag" } }, tree)).rejects.toThrow();
  });

  it("an example run saves with 2 to 12 entries and refuses 1 or 13", async () => {
    const tree = teamBuild();
    const entry = (agent: string) => ({ agent, did: "Found three sources", passed_on: "A source list" });
    await setExtras(row(tree, "t1"), { example_run: [entry("a1"), entry("a2")] }, tree);
    expect(written().example_run).toEqual([entry("a1"), entry("a2")]);
    await setExtras(row(tree, "t1"), { example_run: Array.from({ length: 12 }, () => entry("a1")) }, tree);
    await expect(setExtras(row(tree, "t1"), { example_run: [entry("a1")] }, tree)).rejects.toThrow(EXAMPLE_COPY.range);
    await expect(setExtras(row(tree, "t1"), { example_run: Array.from({ length: 13 }, () => entry("a1")) }, tree)).rejects.toThrow(EXAMPLE_COPY.range);
    await expect(setExtras(row(tree, "t1"), { example_run: [entry("a1"), entry("ag")] }, tree)).rejects.toThrow();
  });

  it("moving an agent out removes its entries and who merges, in the same write", async () => {
    const team = node("t1", 1, "team", { workspace: { kind: "git_worktrees", merge: "one_at_a_time", merged_by: "a3" }, example_run: [{ agent: "a1", did: "x" }, { agent: "a3", did: "y" }, { agent: "a1", did: "z" }] }, "T", [node("a1", 0, "agent_config", { model: "m" })]);
    const out = node("a3", 2, "agent_config", { model: "m" });
    const fixes = teamWorkFixes([team, out], ["t1", "a3"]);
    expect(fixes).toEqual([{ id: "t1", payload: { workspace: { kind: "git_worktrees", merge: "one_at_a_time" }, example_run: [{ agent: "a1", did: "x" }, { agent: "a1", did: "z" }] } }]);
  });

  it("a fork points who merges and each entry's agent at the copies", () => {
    const ids = new Map([["a1", "c1"], ["a3", "c3"]]);
    const out = rewritePayload({ workspace: { kind: "git_worktrees", merged_by: "a3" }, example_run: [{ agent: "a1", did: "x" }] } as Json, undefined, ids) as Record<string, unknown>;
    expect(out).toEqual({ workspace: { kind: "git_worktrees", merged_by: "c3" }, example_run: [{ agent: "c1", did: "x" }] });
  });
});
