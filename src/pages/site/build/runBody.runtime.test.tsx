import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Json } from "@/integrations/supabase/types";
import type { NodeTree, NodeType } from "@/lib/build";

import { runBody } from "./buildModel";
import { RunBody } from "./RunBody";

const node = (id: string, over: Partial<NodeTree>): NodeTree =>
  ({ id, build_id: "b1", parent_id: null, position: 1, type: "prompt", title: `Node ${id}`, note: null, payload: {}, is_gap: false, source_ref: null, event_id: null, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z", children: [], ...over }) as unknown as NodeTree;

const types = ["prompt", "code", "decision", "agent_config"].map((key) => ({ key, label: key === "code" ? "Code" : key === "decision" ? "Decision" : key === "prompt" ? "Prompt" : "Agent", category: "configuration", renderer: key === "code" ? "artefact" : "instruction", copyable: true, is_active: true, schema: { fields: [{ key: "text", label: "Text", type: "text", required: true }] } })) as unknown as NodeType[];

const questions = [{ id: "team", type: "choice", instructions: "Which team?", options: [{ key: "billing" }, { key: "support" }] }] as Json;
const when = (key: string) => ({ decision: "dec", question: "team", is: [key] }) as Json;
const tree = [
  node("p", { position: 1, title: "Ask for a router", payload: { text: "Make me a router" } }),
  node("c", { position: 2, type: "code", title: "router.py", payload: { source: "client.decide(questions)", language: "python", filename: "router.py" } }),
  node("dec", { position: 3, type: "decision", title: "Team", payload: { provider: "typesafe-jev", model: "jev-1.13.0", called_from: ["c"], questions, answer: { team: { value: "billing", probabilities: { billing: 0.92 } } }, install: "pip install my-thing", run_cost: { per: "call", ms: 120 } } }),
  node("a", { position: 4, type: "agent_config", title: "Billing agent", payload: { system_prompt: "Refund.", model: "m", runs_when: when("billing") } }),
  node("a2", { position: 5, type: "agent_config", title: "Support agent", payload: { system_prompt: "Help.", model: "m", runs_when: when("support") } }),
  node("e", { position: 6, payload: { text: "Reply" } }),
];

beforeEach(() => vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })));
afterEach(() => cleanup());

describe("the run view, for a build with a decision (CA-13 P13, P14)", () => {
  const build = { title: "Restaurant order router", making: { sessions_meta: {} } } as never;
  const run = runBody(build, tree, types, null, () => undefined);

  it("puts the maker's code first and folds the decision into it; branches are numbered under the code", () => {
    expect(run.steps.map((step) => [step.id, step.number])).toEqual([["p", "1"], ["c", "2"], ["a", "2a"], ["a2", "2b"], ["e", "3"]]);
    expect(run.steps[1].setsUp).toEqual(["Decision 'Team' (Jev 1.13): team"]);
    expect(run.steps[2].heading).toBe("If team is billing:");
    expect(run.steps[3].heading).toBe("If team is support:");
    expect(run.steps[4].heading).toBe("Then, in every case:");
  });

  it("lists what you need once, in the checklist at the top, and the copied text uses the same words", () => {
    expect(run.prerequisites.map((item) => item.title)).toEqual(["A TypeSafe account and API key (`TYPESAFE_API_KEY`). Jev is in early access.", "Install: pip install my-thing"]);
    expect(run.allText.startsWith("Restaurant order router\n\nBefore you start\n- A TypeSafe account")).toBe(true);
    expect(run.allText).toContain("If team is billing:\n2a. Billing agent");
    expect(run.allText).toContain("Then, in every case:\n3. Node e");
    expect(run.allText).not.toMatch(/120 ms/);
  });

  it("draws the numbers, the headings, 'What this code sets up' and the checklist", async () => {
    let written = "";
    render(<RunBody run={run} onCopy={async (text) => ((written = text), true)} />);
    expect(screen.getByTestId("build-run-before").textContent).toContain("A TypeSafe account and API key");
    expect(screen.getAllByTestId("build-run-heading").map((n) => n.textContent)).toEqual(["If team is billing:", "If team is support:", "Then, in every case:"]);
    const steps = screen.getAllByTestId("build-run-step");
    expect(steps.map((n) => n.getAttribute("data-number"))).toEqual(["1", "2", "2a", "2b", "3"]);
    expect(within(steps[1]).getByTestId("build-run-sets-up").textContent).toContain("Decision 'Team' (Jev 1.13): team");
    fireEvent.click(within(steps[1]).getByRole("button", { name: /Copy step 2/ }));
    await waitFor(() => expect(written).toBe("client.decide(questions)"));
  });

  it("is exactly what it was for a build with none of this", () => {
    const plain = runBody(build, [tree[0], tree[1]], types, null, () => undefined);
    expect(plain.steps.every((step) => step.number === undefined && step.heading === undefined)).toBe(true);
    expect(plain.prerequisites).toEqual([]);
  });
});
