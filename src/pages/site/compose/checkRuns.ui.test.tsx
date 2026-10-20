// CA-05 P7 — test cases and scores on a Check: the lines on the List and the build page, and Runs in Details.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upsertNode = vi.fn();
vi.mock("@/lib/build/nodes", () => ({ upsertNode: (...a: unknown[]) => upsertNode(...a), getNodeTree: vi.fn(), reorderNodes: vi.fn(), deleteNode: vi.fn() }));

import { buildSteps, checkHistoryLine, checkRunsOf, setCheckRuns } from "@/lib/build/graph";
import { readerSteps } from "@/lib/build/readerSteps";
import type { BuildNode, NodeTree } from "@/lib/build/types";
import { StepsList } from "@/pages/site/build/BuildSteps";
import type { BuildStepsView } from "@/pages/site/build/buildModel";

import { BuildList } from "./BuildList";
import { DetailsPanel, type CheckView } from "./DetailsPanel";

beforeEach(() => {
  upsertNode.mockReset();
  upsertNode.mockImplementation(async (row: unknown) => row);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const node = (id: string, type: string, payload: Record<string, unknown>, position: number, children: NodeTree[] = []): NodeTree =>
  ({ id, build_id: "b", parent_id: null, position, type, title: null, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "", children }) as NodeTree;

const RUNS = [
  { at: "2026-10-10", passed: 31, total: 40 },
  { at: "2026-10-12", passed: 37, total: 40 },
  { at: "2026-10-14", passed: 40, total: 40 },
];
const file = (id: string, name: string, rows?: number) => node(id, "document", { title: name, media_id: `m-${id}`, ...(rows ? { rows } : null) }, 1);
const tree = (checkPayload: Record<string, unknown> = {}, files: NodeTree[] = []): NodeTree[] => [
  node("a", "agent_config", { system_prompt: "Answer.", model: "Opus 5.5", session: "typed-a" }, 1),
  node("c", "eval_run", { tested: "Answers match the key", passing: "40 of 40", passed: 40, total: 40, run_at: "2026-10-14", ...checkPayload }, 2, files.map((f, i) => ({ ...f, parent_id: "c", position: i + 1 }))),
];

describe("what a check reads", () => {
  it("keeps runs newest first, drops bad ones and caps at 20", () => {
    expect(checkRunsOf(RUNS).map((run) => run.at)).toEqual(["2026-10-14", "2026-10-12", "2026-10-10"]);
    expect(checkRunsOf([{ at: "soon", passed: 1, total: 2 }, { at: "2026-10-10", passed: 3, total: 2 }, { at: "2026-10-10", passed: 1.5, total: 2 }, "x"])).toEqual([]);
    expect(checkRunsOf(Array.from({ length: 30 }, (_, i) => ({ at: `2026-09-${String(i + 1).padStart(2, "0")}`, passed: 1, total: 1 })))).toHaveLength(20);
  });
  it("says the history oldest first, five runs at most, and only from two", () => {
    expect(checkHistoryLine(checkRunsOf(RUNS))).toBe("31 of 40 → 37 of 40 → 40 of 40");
    expect(checkHistoryLine(checkRunsOf(RUNS.slice(0, 1)))).toBeNull();
    const six = Array.from({ length: 6 }, (_, i) => ({ at: `2026-10-0${i + 1}`, passed: i, total: 9 }));
    expect(checkHistoryLine(checkRunsOf(six))).toBe("1 of 9 → 2 of 9 → 3 of 9 → 4 of 9 → 5 of 9");
  });
  it("counts cases only from test files that were counted", () => {
    const [, check] = buildSteps(tree({}, [file("f1", "cases.csv", 40)]));
    expect(check.check?.cases).toBe(40);
    expect(buildSteps(tree({}, [file("f1", "cases.csv", 40), file("f2", "more.jsonl", 10)]))[1].check?.cases).toBe(50);
    expect(buildSteps(tree({}, [file("f1", "cases.csv")]))[1].check?.cases).toBeUndefined();
    expect(buildSteps(tree({}, [file("f1", "cases.csv", 40), file("f2", "more.jsonl")]))[1].check?.cases).toBeUndefined();
    expect(buildSteps(tree({}, [file("f1", "notes.txt", 40)]))[1].check?.cases).toBeUndefined();
    expect(buildSteps(tree())[1].check?.cases).toBeUndefined();
  });
});

describe("writing runs", () => {
  const row = (payload: Record<string, unknown>): BuildNode => ({ ...tree(payload)[1], children: undefined }) as unknown as BuildNode;
  it("keeps the newest run as the last run, so the status line agrees", async () => {
    await setCheckRuns(row({}), [RUNS[0], RUNS[2], RUNS[1]]);
    const saved = upsertNode.mock.calls[0][0].payload;
    expect(saved.runs.map((run: { at: string }) => run.at)).toEqual(["2026-10-14", "2026-10-12", "2026-10-10"]);
    expect([saved.passed, saved.total, saved.run_at]).toEqual([40, 40, "2026-10-14"]);
  });
  it("takes the key off for none and keeps the last run as it was", async () => {
    await setCheckRuns(row({ runs: RUNS }), []);
    const saved = upsertNode.mock.calls[0][0].payload;
    expect(saved.runs).toBeUndefined();
    expect(saved.passed).toBe(40);
  });
  it("refuses what cannot be kept", async () => {
    await expect(setCheckRuns(row({}), [{ at: "2026-10-10", passed: 5, total: 4 }])).rejects.toThrow(/more than the total/);
    await expect(setCheckRuns(row({}), [{ at: "someday", passed: 1, total: 4 }])).rejects.toThrow(/2026-10-12/);
    expect(upsertNode).not.toHaveBeenCalled();
  });
});

describe("the Check's lines", () => {
  const list = (steps: ReturnType<typeof buildSteps>) =>
    render(
      <MemoryRouter>
        <BuildList phone={false} steps={steps} dividers={new Map()} names={{}} suggestions={[]} intoResult={new Set()} results={[]} selectedId={null} onSelect={vi.fn()} onRename={vi.fn()} onMove={vi.fn()} onRemove={vi.fn()} onAccept={vi.fn()} onDismiss={vi.fn()} onAddPrompt={vi.fn(async () => true)} focusAdd={0} onAddAgentPrompt={vi.fn(async () => true)} onAddAgentTo={vi.fn()} />
      </MemoryRouter>,
    );

  it("are in the List: Tested on and the history", () => {
    list(buildSteps(tree({ runs: RUNS }, [file("f1", "cases.csv", 40)])));
    expect(screen.getByTestId("check-cases").textContent).toBe("Tested on 40 cases");
    expect(screen.getByTestId("check-history").textContent).toBe("31 of 40 → 37 of 40 → 40 of 40");
  });

  it("are absent for a check that has neither", () => {
    list(buildSteps(tree()));
    expect(screen.queryByTestId("check-cases")).toBeNull();
    expect(screen.queryByTestId("check-history")).toBeNull();
    expect(screen.getByTestId("check-status")).toBeTruthy();
  });

  it("are on the build page, and the test file has Download", () => {
    const steps = readerSteps(tree({ runs: RUNS }, [file("f1", "cases.csv", 40)]), null, new Map([["m-f1", { id: "m-f1", bytes: 12, bucket: "b", path: "p/cases.csv", kind: "file" } as never]]));
    const view = { steps, results: [], need: [], counts: "", map: { groups: [], files: [], tools: [], results: [] }, mapAvailable: false, onCopy: vi.fn(), resolveMedia: () => undefined, otherBody: () => null, focus: null } as unknown as BuildStepsView;
    render(
      <MemoryRouter>
        <StepsList view={view} phone={false} announce={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("check-cases").textContent).toBe("Tested on 40 cases");
    expect(screen.getByTestId("check-history").textContent).toBe("31 of 40 → 37 of 40 → 40 of 40");
    expect(within(screen.getByTestId("sent-with-tile")).getByText("cases.csv")).toBeTruthy();
  });
});

describe("Check Details › Runs", () => {
  const view = (runs?: typeof RUNS): CheckView => ({
    kind: "check",
    id: "c",
    number: "2",
    title: null,
    defaultTitle: "Check 2",
    check: { tested: "Answers match the key", passing: "40 of 40", onFail: null, passed: 40, total: 40, runAt: "2026-10-14", ...(runs ? { runs: checkRunsOf(runs) } : null) },
    uses: [],
    options: [],
    goesInto: [],
  });
  const mount = (v: CheckView) => {
    const onCheckRuns = vi.fn();
    render(<DetailsPanel phone={false} view={v} onCheckRuns={onCheckRuns} onRename={vi.fn()} onModel={vi.fn()} onAddUse={vi.fn()} onRemoveUse={vi.fn()} onRuns={vi.fn()} onRemoveInside={vi.fn()} onToggleSessionPrompt={vi.fn()} onDownload={vi.fn()} onFields={vi.fn()} onAddPicture={vi.fn()} onUseAsCover={vi.fn()} />);
    return onCheckRuns;
  };

  it("lists the runs newest first", () => {
    mount(view(RUNS));
    const rows = screen.getAllByTestId("check-run");
    expect(rows.map((r) => (within(r).getByLabelText(/^Date of run/) as HTMLInputElement).value)).toEqual(["2026-10-14", "2026-10-12", "2026-10-10"]);
    expect((within(rows[2]).getByLabelText("Passed in run 3") as HTMLInputElement).value).toBe("31");
  });

  it("adds a run once it is whole, and not before", () => {
    const onCheckRuns = mount(view(RUNS.slice(1)));
    fireEvent.click(screen.getByRole("button", { name: "Add a run" }));
    const [fresh] = screen.getAllByTestId("check-run");
    const date = within(fresh).getByLabelText("Date of run 1");
    fireEvent.change(date, { target: { value: "2026-10-16" } });
    fireEvent.keyDown(date, { key: "Enter" });
    expect(onCheckRuns).not.toHaveBeenCalled();
    expect(screen.getByText(/Each run needs a date/)).toBeTruthy();
    const passed = within(fresh).getByLabelText("Passed in run 1");
    fireEvent.change(passed, { target: { value: "38" } });
    fireEvent.keyDown(passed, { key: "Enter" });
    const total = within(fresh).getByLabelText("Out of in run 1");
    fireEvent.change(total, { target: { value: "40" } });
    fireEvent.keyDown(total, { key: "Enter" });
    expect(onCheckRuns).toHaveBeenCalledWith("c", [
      { at: "2026-10-16", passed: 38, total: 40 },
      { at: "2026-10-14", passed: 40, total: 40 },
      { at: "2026-10-12", passed: 37, total: 40 },
    ]);
  });

  it("removes a run", () => {
    const onCheckRuns = mount(view(RUNS));
    fireEvent.click(screen.getByRole("button", { name: "Remove run 3" }));
    expect(onCheckRuns).toHaveBeenCalledWith("c", [RUNS[2], RUNS[1]]);
  });

  it("stops offering a twenty-first", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ at: `2026-09-${String(i + 1).padStart(2, "0")}`, passed: 1, total: 1 }));
    mount(view(many));
    expect(screen.queryByRole("button", { name: "Add a run" })).toBeNull();
    expect(screen.getByText(/20 runs at most/)).toBeTruthy();
  });
});
