// CA-05 P11 — everything at once: every item of CA-04 and CA-05 in one build, read back through buildSteps,
// sessionGroups and the build page's renderers. If any part is missing, a line below names it.
//
// NOT HERE, and said so: the chat marked as summarised and the helpers a session started (P4). The formats on disk do
// not record them (design/audits/composer/ca-05/p4-not-in-the-file.md), so there is nothing to read back.

import { createElement } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SHAPES, shapeDetailsProps, shapeListProps, shapeMapProps } from "@/dev/fixtures/shapes";
import { NeedPanel, StepsList } from "@/pages/site/build/BuildSteps";
import { BuildList } from "@/pages/site/compose/BuildList";
import { DetailsPanel } from "@/pages/site/compose/DetailsPanel";

import { bracketed } from "./changes";
import { copyTogether } from "./copyTogether";
import { buildSteps, groupKey, sessionGroups, stepRunsLabel, trainedModelOf } from "./graph";
import { layoutMap } from "./mapLayout";
import { sessionsMetaOf } from "./making";
import { buildCounts, readerMap, readerResults, readerSteps, stepsMarkdown, whatYouNeed } from "./readerSteps";
import { setupItemsOf } from "./setup";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(cleanup);

const { tree, making } = SHAPES.everything;
const steps = buildSteps(tree);
const metas = sessionsMetaOf(making);
const groups = sessionGroups(steps, [], {}, metas);
const [g1, g2, g3, g4] = groups;
const media = new Map([
  ["m-cases", { id: "m-cases", bytes: 900, bucket: "b", path: "p/cases.csv", kind: "file" } as never],
  ["m-ratings", { id: "m-ratings", bytes: 52_000, bucket: "b", path: "p/ratings.csv", kind: "file" } as never],
]);

describe("everything at once, read back", () => {
  it("reads the four sessions with what each carries", () => {
    expect(groups.map((group) => [group.number, group.tool, group.startedAt, group.stepNumbers])).toEqual([
      [1, "Claude", "2026-10-12", ["1", "2"]],
      [2, "Claude Code", "2026-10-14", ["3", "4", "5"]],
      [3, "Claude Code", "2026-10-14", ["6"]],
      [4, "Ollama", "2026-10-16", ["7"]],
    ]);
    // P2: cost, tokens, cached and background are in its entry; the length is its own.
    expect(g1.extras).toMatchObject({ cost: 3.4, tokens: 1_200_000, cached: 900_000, showCost: true, background: true });
    expect(g1.longWords).toBeUndefined();
    expect(g1.extras?.words).toBe(150_000);
    // P3, P5: started with, at the same time as, own copy.
    expect(g2.extras?.startedWith).toContain("--worktree fix-totals");
    expect(g2.extras?.parallelWith).toEqual([groupKey(g3)]);
    expect(g3.extras?.parallelWith).toEqual([groupKey(g2)]);
    expect([g2.extras?.ownCopy, g3.extras?.ownCopy]).toEqual(["fix-totals", "fix-receipts"]);
    expect(g2.goal?.reached).toBe("reached");
  });

  it("reads P1 (words a reader changes), P7 (cases and runs), P8 (a local model) and P9 (agent lines) off the steps", () => {
    const [p1, , a1, a2, check, , p4] = steps;
    expect(p1.changes).toHaveLength(2);
    expect(bracketed(p1.text, p1.changes)).toBe("Write a welcome email for [Ada's Bakery] and sign it [Ada].");
    expect(copyTogether(p1)).toContain("[Ada's Bakery]");
    expect(check.check?.cases).toBe(40);
    expect(check.check?.runs?.map((run) => `${run.passed} of ${run.total}`)).toEqual(["40 of 40", "37 of 40", "31 of 40"]);
    expect(a1.modelRun).toEqual({ precision: "4-bit", where: "computer" });
    expect(p4.modelRun).toEqual({ precision: "4-bit", where: "computer" });
    expect(a1.memoryTidy).toBe("Every Sunday, keeps the 50 most useful notes");
    expect(stepRunsLabel(a2)).toBe("Again until the review has no changes · at most 3 times · changes its checklist each round");
  });

  it("reads P6 (loaded when) and P10 (a trained model)", () => {
    expect(setupItemsOf(tree, groupKey(g2)).map((item) => [item.kind, item.loaded])).toEqual([["instructions", "start"], ["skill", "when-needed"], ["server", "start"], ["rule", "start"]]);
    expect(setupItemsOf(tree, groupKey(g3)).map((item) => [item.kind, item.loaded])).toEqual([["workflow", "start"]]);
    const result = tree.find((node) => node.id === "e-r1")!;
    expect(trainedModelOf(result)).toEqual({ baseModel: "muse-spark-open", method: "Rated answers, ranked by me", trainedOn: { id: "e-tr", name: "ratings.csv", rows: 1200 } });
  });

  it("lays sessions 2 and 3 out one above the other in one column", () => {
    const map = shapeMapProps("everything");
    const layout = layoutMap(map.steps, map.groups, map.files, map.tools, map.results, map.suggestions);
    const lane = (label: string) => layout.lanes.findIndex((entry) => entry.label === label);
    expect(Math.abs(lane("Session 2") - lane("Session 3"))).toBe(1);
    expect(layout.lanes[lane("Session 2")].together).toBe(layout.lanes[lane("Session 3")].together);
    const column = (id: string) => layout.boxes.find((box) => box.id === id)?.column;
    // The agents have lanes of their own; the first step in each session's lane starts together.
    expect(column("e-chk")).toBe(column("e-p3"));
  });
});

describe("everything at once, on the build page", () => {
  const reader = readerSteps(tree, making, media);
  const view = {
    steps: reader,
    results: readerResults(tree, media),
    need: whatYouNeed(reader, tree, making, media),
    counts: buildCounts(reader),
    map: readerMap(tree, making, media),
    mapAvailable: true,
    onCopy: async () => true,
    resolveMedia: () => undefined,
    otherBody: () => null,
    focus: null,
  };

  it("says every part", () => {
    const { container } = render(createElement(MemoryRouter, null, createElement("div", null, createElement(StepsList, { view, phone: false, announce: () => undefined }), createElement(NeedPanel, { view, onOpenOther: () => undefined }))));
    const text = container.textContent ?? "";
    const said = [
      // P1
      "2 words to change before you send it",
      // P2
      "Long session, about 150,000 words. Smaller models may not read it all at once.",
      "Cost about £3.40 and 1.2 million tokens",
      "Later runs cost less, because the start is reused.",
      "Ran in the background",
      // P5
      "At the same time as Session 3 · own copy: fix-totals",
      // P7
      "Tested on 40 cases",
      "31 of 40 → 37 of 40 → 40 of 40",
      // P8
      "Muse Spark Open · 4-bit · on my own computer",
      // P9
      "changes its checklist each round",
      // P10
      "A trained model, based on Muse Spark Open, trained on 1,200 rows of ratings.csv",
      // CA-04: tiles inside tiles, the goal, MCP
      "Sent with prompt 1",
      "Worked until the order form passes its tests · at most 40 turns · reached in 12",
      "MCP server · at a web address · sign in with your github account",
    ];
    for (const line of said) expect(text, line).toContain(line);
    const testIds = ["changes-line", "facts-line", "together-line", "check-cases", "check-history", "trained-model-line"];
    for (const id of testIds) expect(container.querySelector(`[data-testid="${id}"]`), id).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="changed-words"]')).toHaveLength(2);
  });

  it("opens a session's Setup to Started with, and groups the rest by when it was loaded", () => {
    render(createElement(MemoryRouter, null, createElement(StepsList, { view, phone: false, announce: () => undefined })));
    for (const toggle of screen.getAllByRole("button", { name: "Setup" })) fireEvent.click(toggle);
    expect(screen.getByTestId("started-with").textContent).toContain("claude --model opus --permission-mode plan --worktree fix-totals --max-turns 8");
    expect(screen.getAllByTestId("setup-loaded").map((group) => group.getAttribute("aria-label"))).toEqual(["At the start", "Only when needed"]);
  });

  it("puts the words in square brackets in Copy for AI, and says the run, the model and the trained model", () => {
    const md = stepsMarkdown({ title: "T" }, reader, view.results);
    expect(md).toContain("[Ada's Bakery]");
    expect(md).toContain("Started with:");
    expect(md).toContain("Model: Muse Spark Open · 4-bit · on my own computer.");
    expect(md).toContain("changes its checklist each round");
    expect(md).toContain("A trained model, based on Muse Spark Open, trained on 1,200 rows of ratings.csv. Rated answers, ranked by me.");
  });

  it("hides the cost from readers until Show readers is on", () => {
    const hidden = { ...making, sessions_meta: { ...making.sessions_meta, [groupKey(g1)]: { ...metas[groupKey(g1)], showCost: undefined } } };
    const [first] = readerSteps(tree, hidden as never, media);
    expect(first.chat && first.chat.kind === "new" ? first.chat.facts : null).toBe("Long session, about 150,000 words. Smaller models may not read it all at once. · Ran in the background");
  });
});

describe("everything at once, in the composer", () => {
  it("draws the List with the lines a maker sees", () => {
    const { container } = render(createElement(MemoryRouter, null, createElement(BuildList, shapeListProps("everything"))));
    const text = container.textContent ?? "";
    for (const line of ["Cost about £3.40 and 1.2 million tokens", "At the same time as Session 3 · own copy: fix-totals", "Tidies its notes: Every Sunday, keeps the 50 most useful notes", "Tested on 40 cases", "31 of 40 → 37 of 40 → 40 of 40", "changes its checklist each round", "Muse Spark Open · 4-bit · on my own computer"]) {
      expect(text, line).toContain(line);
    }
  });

  it("gives Session Details Started with, its settings in words, and the optional fields", () => {
    render(createElement(MemoryRouter, null, createElement(DetailsPanel, shapeDetailsProps("everything"))));
    expect(screen.getByRole("textbox", { name: "Started with" })).toBeTruthy();
    expect(screen.getByTestId("started-with-settings").textContent).toBe("Model: opusAllowed to: plan onlyOwn copy of the code: fix-totalsAt most 8 turns");
    for (const name of ["What it cost", "Own copy of the code"]) expect(screen.getByRole("textbox", { name })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Show readers" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ran at the same time as" })).toBeTruthy();
    const groupsShown = within(screen.getByTestId("session-setup")).getAllByTestId("setup-loaded");
    expect(groupsShown.map((group) => group.getAttribute("aria-label"))).toEqual(["At the start", "Only when needed"]);
  });

  it("gives the check, the agent and the result what their Details ask", () => {
    cleanup();
    render(createElement(MemoryRouter, null, createElement(DetailsPanel, shapeDetailsProps("everything", "e-chk"))));
    expect(screen.getAllByTestId("check-run")).toHaveLength(3);
    cleanup();
    render(createElement(MemoryRouter, null, createElement(DetailsPanel, shapeDetailsProps("everything", "e-a1"))));
    expect(screen.getByRole("button", { name: "How it was run" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "How it tidies its notes" })).toBeTruthy();
    cleanup();
    render(createElement(MemoryRouter, null, createElement(DetailsPanel, shapeDetailsProps("everything", "e-r1"))));
    expect((screen.getByRole("radio", { name: "A trained model" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByTestId("trained-on").textContent).toContain("ratings.csv · 1,200 rows");
  });
});
