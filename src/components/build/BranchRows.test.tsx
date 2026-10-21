import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { callsOf } from "@/lib/build/decisionCopy";
import type { Step } from "@/lib/build/graph";

import { drawBranches } from "./BranchRows";
import { LinkLines } from "./LinkLines";

afterEach(() => cleanup());

const step = (id: string, kind: Step["kind"], extra: Partial<Step> = {}): Step =>
  ({ id, kind, number: id, title: null, defaultTitle: id, text: "", words: 0, model: null, sessionId: null, tool: null, runs: null, uses: [], children: [], ...extra }) as Step;
const decision = step("d", "decision", {
  defaultTitle: "team",
  decision: { provider: "typesafe-jev", model: "jev-1.13.0", calledFrom: ["c"], stateFrom: null, questions: [{ id: "team", type: "choice", instructions: "", options: [{ key: "billing" }, { key: "support" }] }] },
});
const when = (key: string) => ({ decision: "d", question: "team", is: [key] });

const draw = (steps: Step[]) => render(<div>{drawBranches(steps, (s) => s, steps, (s) => <p key={s.id} data-testid="tile">{s.id}</p>)}</div>);

describe("branch rows (CA-13 P3)", () => {
  it("draws a run with no decision and no condition exactly as it was", () => {
    draw([step("1", "prompt"), step("2", "agent")]);
    expect(screen.queryByTestId("branch-group")).toBeNull();
    expect(screen.queryByTestId("how-it-runs")).toBeNull();
    expect(screen.getAllByTestId("tile").map((n) => n.textContent)).toEqual(["1", "2"]);
  });

  it("puts a quiet 'How it runs' over the decision, a head over each branch, and 'Branches join here' after them", () => {
    draw([step("1", "prompt"), decision, step("3", "agent", { runsWhen: when("billing") }), step("4", "agent", { runsWhen: when("support") }), step("5", "agent")]);
    expect(screen.getByTestId("how-it-runs").textContent).toBe("How it runs");
    const heads = screen.getAllByTestId("branch-head").map((n) => n.textContent);
    expect(heads).toEqual(["If team is billing", "If team is support"]);
    const groups = screen.getAllByTestId("branch-group");
    expect(groups[0].textContent).toContain("3");
    expect(groups[0].getAttribute("style")).toContain("margin-left: 16px");
    expect(screen.getByTestId("branch-join").textContent).toBe("Branches join here");
    // The joining step is outside every branch.
    expect(groups.some((g) => g.textContent?.includes("5"))).toBe(false);
  });
});

describe("link lines (CA-13 rule 4)", () => {
  it("a Code tile says which decision it calls, and links to it", () => {
    const lines = callsOf("c", [decision]);
    expect(lines.map((line) => line.label)).toEqual(["Calls Decision 'team' (Jev)"]);
    expect(callsOf("other", [decision])).toEqual([]);
    const opened: string[] = [];
    render(<LinkLines lines={lines} onOpen={(id) => opened.push(id)} />);
    screen.getByRole("button", { name: "Calls Decision 'team' (Jev)" }).click();
    expect(opened).toEqual(["d"]);
  });
});
