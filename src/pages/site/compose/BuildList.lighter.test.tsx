// CA-15 P10: every tile follows the same rules: a header (number, type line, title), a body of at most two lines, and a footer
// of at most three counted facts with at most one link. Nothing is drawn that has nothing to show.

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";
import { buildSteps, resultFactsOf } from "@/lib/build/graph";
import { footerFactsOf } from "@/lib/build/tileLines";
import type { NodeTree } from "@/lib/build/types";

import { BuildList, type BuildListProps } from "./BuildList";

vi.mock("@/lib/build/media", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build/media")>()), getMediaById: vi.fn(() => Promise.resolve(null)) }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

let seq = 0;
const node = (id: string, type: string, payload: Record<string, unknown>, over: Partial<NodeTree> = {}): NodeTree =>
  ({ id, build_id: "b", parent_id: null, position: ++seq, type, title: null, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-07T09:00:00.000Z", children: [], ...over }) as NodeTree;

const QUESTIONS = [{ id: "team", type: "choice", instructions: "Which team?", options: [{ key: "billing" }, { key: "support" }] }];

/** One tile of every kind, with only what it needs to exist. */
const bare = (): NodeTree[] => [
  node("pr", "prompt", { text: "Write a two-line poem about a fox." }, { title: "Fox poem" }),
  node("ag", "agent_config", { system_prompt: "Review the draft.", model: "Opus 5.5" }, { title: "Reviewer" }),
  node("tm", "team", {}, { title: "Writers", children: [node("tm1", "agent_config", { system_prompt: "Lead.", model: "Opus 5.5" }, { title: "Lead one", parent_id: "tm" })] }),
  node("mn", "manual_step", { text: "Resize the hero image." }, { title: "Resize" }),
  node("cd", "code", { source: "const a = 1;", language: "ts" }, { title: "Constant" }),
  node("ck", "eval_run", { tested: "Places an order", passing: "The total shows £9.00" }, { title: "Order check" }),
  node("fl", "document", { step: true, title: "menu.pdf" }),
  node("tl", "integration", { step: true, service: "Slack" }),
  node("dc", "decision", { provider: "typesafe-jev", model: "jev-1.13.0", questions: QUESTIONS }, { title: "Route" }),
  node("sp", "system_prompt", { step: true, text: "Write in plain English." }, { title: "Voice" }),
  node("ds", "dataset", { step: true, description: "Support tickets" }, { title: "Tickets" }),
  node("rp", "repo", { step: true, url: "github.com/acme/shop" }),
];

/** The same, with every optional field given. */
const full = (): NodeTree[] => [
  node("pr", "prompt", { text: "Hi {name}, about {topic} and {more} in {place}.", reply: "A long answer\nover two lines" }, { title: "Fox poem" }),
  node("ag", "agent_config", { system_prompt: "Review the draft.", model: "Opus 5.5", limits: ["Never deploys", "Never emails"], helpers: [{ provider: "scaledown", job: "compress", tools: ["a"] }, { provider: "scaledown", job: "summarize" }], tools: [{ tool_ref: "t1" }, { tool_ref: "t2" }, { tool_ref: "t3" }, { tool_ref: "t4" }] }, { title: "Reviewer" }),
  node("tm", "team", { pattern: "parallel" }, { title: "Writers", children: [node("tm1", "agent_config", { system_prompt: "Lead.", model: "Opus 5.5" }, { title: "Lead one", parent_id: "tm" }), node("tm2", "agent_config", { system_prompt: "Second.", model: "Opus 5.5" }, { title: "Second", parent_id: "tm" })] }),
  node("mn", "manual_step", { text: "One\nTwo\nThree\nFour", tool: "figma" }, { title: "Resize" }),
  node("cd", "code", { source: "a\nb\nc\nd\ne", language: "ts", filename: "app.ts", tool: "claude-code", model: "Opus 5.5" }, { title: "Constant" }),
  node("ck", "eval_run", { tested: "Places an order", passing: "The total shows £9.00", passed: 3, total: 4, method: "automated", cases: [{ input: "a", expected: "b", actual: "b", passed: true }, { input: "c", expected: "d", actual: "d", passed: true }] }, { title: "Order check" }),
  node("fl", "document", { step: true, title: "data.csv", size: 2048, preview: ["a,b", "1,2", "3,4"], summary: "A note" }),
  node("tl", "integration", { step: true, service: "Slack", connection: "mcp", scopes: "Posted a message", permissions: "write", alternatives: ["Email", "Teams"] }),
  node("dc", "decision", { provider: "typesafe-jev", model: "jev-1.13.0", questions: QUESTIONS, examples: [{ team: "billing" }, { team: "support" }] }, { title: "Route" }),
  node("sp", "system_prompt", { step: true, text: "Use {tone} and {voice}.", version: "v2", model: "Opus 5.5", scope: "all" }, { title: "Voice" }),
  node("ds", "dataset", { step: true, description: "Support tickets", use: "evaluation", format: "CSV", columns: ["a", "b"], record_count: 1200, source: "Helpdesk", licence: "CC BY 4.0" }, { title: "Tickets" }),
  node("rp", "repo", { step: true, url: "github.com/acme/shop", ownership: "third_party", description: "A shop", usage: ["copied", "docs"], language: "Go", licence_spdx: "MIT", fetched_at: "2026-10-07T09:00:00Z", author: "acme", stars: 12 }),
];

function show(nodes: NodeTree[], over: Partial<BuildListProps> = {}) {
  const base = sandboxListProps("bakery");
  const props = {
    ...base,
    steps: buildSteps(nodes),
    dividers: new Map(),
    results: [],
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onMove: vi.fn(),
    onRemove: vi.fn(),
    onAccept: vi.fn(),
    onDismiss: vi.fn(),
    ...over,
  } as unknown as BuildListProps;
  render(
    <MemoryRouter>
      <BuildList {...props} />
    </MemoryRouter>,
  );
  return props;
}

const cards = () => screen.getAllByTestId("step-card");
const typeLine = (card: HTMLElement) => card.querySelector('[data-testid$="-eyebrow"]') as HTMLElement | null;

/** A direct child of a tile that draws nothing: no words, no picture, no control. */
const emptyRows = (card: HTMLElement) =>
  Array.from(card.children).filter((child) => !(child.textContent ?? "").trim() && !child.querySelector("svg, img, button, input, textarea, [role='img'], [data-mark], canvas"));

describe("every tile, with every optional field empty (CA-15 P10)", () => {
  it("has a type line, a title and no empty rows", () => {
    show(bare());
    const found = cards();
    expect(found.map((card) => card.getAttribute("data-kind") ?? "team-or-agent")).toHaveLength(12);
    for (const card of found) {
      const line = typeLine(card);
      const name = card.getAttribute("aria-label");
      expect(line?.textContent?.trim(), `${name}: type line`).toBeTruthy();
      expect(within(card).getByRole("heading", { level: 3 }).textContent?.trim(), `${name}: title`).toBeTruthy();
      expect(emptyRows(card).map((row) => row.outerHTML.slice(0, 80)), `${name}: empty rows`).toEqual([]);
    }
  });

  it("draws no footer where a tile has no counted fact and no link", () => {
    show(bare());
    for (const kind of ["manual", "tool", "file", "system_prompt", "dataset"]) {
      const card = cards().find((el) => el.getAttribute("data-kind") === kind) as HTMLElement;
      expect(within(card).queryByTestId("tile-footer"), kind).toBeNull();
    }
  });

  it("says each kind in its type line", () => {
    show(bare());
    const says = (kind: string) => typeLine(cards().find((el) => el.getAttribute("data-kind") === kind) as HTMLElement)?.textContent;
    expect(says("prompt")).toBe("Prompt");
    expect(says("manual")).toBe("Manual step · Another tool");
    expect(says("code")).toBe("Code · TypeScript · 1 line");
    expect(says("check")).toBe("Check");
    expect(says("tool")).toBe("Tool");
    expect(says("system_prompt")).toBe("System prompt · Applies to 1 prompt");
    expect(says("dataset")).toBe("Dataset");
    expect(says("repo")).toBe("GitHub repository");
    expect(screen.getAllByTestId("container-eyebrow").map((el) => el.textContent)).toEqual(["Agent · Opus 5.5", "Multi-agent team"]);
  });

  it("draws a result with its type line and title, and nothing empty", () => {
    const node1 = node("r1", "result", { summary: "A poem" });
    show([], { results: [{ id: "r1", title: "A poem", holds: "Nothing added yet", facts: resultFactsOf(node1), from: null }] });
    const card = screen.getByTestId("result-card");
    expect(within(card).getByTestId("result-eyebrow").textContent).toBe("Result");
    expect(within(card).queryByTestId("tile-footer")).toBeNull();
  });
});

describe("every tile, with every optional field given (CA-15 P10)", () => {
  it("has a footer of at most three facts and at most one link", () => {
    show(full());
    for (const card of cards()) {
      const name = card.getAttribute("aria-label");
      const footers = within(card).queryAllByTestId("tile-footer").filter((footer) => footer.closest('[data-testid="step-card"]') === card);
      expect(footers.length, `${name}: footers`).toBeLessThanOrEqual(1);
      for (const footer of footers) {
        const facts = within(footer).getByTestId("tile-footer-facts").textContent ?? "";
        expect(facts.split(" · ").length, `${name}: ${facts}`).toBeLessThanOrEqual(3);
        expect(footer.querySelectorAll("a, button").length, `${name}: links`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("says the same facts as footerFactsOf, each counted and none empty or zero", () => {
    const steps = buildSteps(full());
    for (const step of steps) {
      const facts = footerFactsOf(step);
      expect(facts.length, step.id).toBeLessThanOrEqual(3);
      for (const fact of facts) {
        expect(fact.trim(), step.id).toBe(fact);
        expect(fact, step.id).not.toMatch(/^0\b/);
      }
    }
    expect(footerFactsOf(steps[0])).toEqual(["8 words", "4 variables"]);
    expect(footerFactsOf(steps.find((step) => step.id === "ag") as never)).toEqual(["2 supporting models", "4 tools", "2 limits"]);
    expect(footerFactsOf(steps.find((step) => step.id === "ck") as never)).toEqual(["2 test cases", "Automated"]);
  });

  it("shows at most two lines of the thing itself in the body", () => {
    show(full());
    const code = cards().find((el) => el.getAttribute("data-kind") === "code") as HTMLElement;
    expect(within(code).getByTestId("code-gutter-numbers").textContent).toBe("1\n2\n3");
    const manual = cards().find((el) => el.getAttribute("data-kind") === "manual") as HTMLElement;
    expect(within(manual).getByTestId("manual-lines").querySelectorAll("li")).toHaveLength(2);
    const decision = cards().find((el) => el.getAttribute("data-kind") === "decision") as HTMLElement;
    expect(within(decision).queryAllByTestId("decision-line").length).toBeLessThanOrEqual(2);
  });

  it("puts the one link of each tile in its footer: Show all lines, Show all steps, Show prompts, Show agents", () => {
    show(full());
    const link = (kind: string, name: string) => within(cards().find((el) => el.getAttribute("data-kind") === kind) as HTMLElement).getByRole("button", { name });
    expect(link("code", "Show all 5 lines").closest('[data-testid="tile-footer"]')).toBeTruthy();
    expect(link("manual", "Show all steps").closest('[data-testid="tile-footer"]')).toBeTruthy();
    const team = screen.getByRole("group", { name: /^Team/ });
    expect(within(team).getByRole("button", { name: "Show agents" }).closest('[data-testid="tile-footer"]')).toBeTruthy();
  });
});

describe("what a tile folds away (CA-15 P10)", () => {
  it("starts with an agent's prompts folded, and Show prompts opens them as they were drawn, Hide prompts folds them again", () => {
    show(buildListWithAgent());
    const agent = screen.getByRole("group", { name: /^Agent/ });
    expect(within(agent).queryAllByTestId("inner-card")).toHaveLength(0);
    const open = within(agent).getByRole("button", { name: "Show prompts" });
    expect(open.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(open);
    expect(within(agent).getAllByTestId("inner-card").length).toBeGreaterThan(0);
    const close = within(agent).getByRole("button", { name: "Hide prompts" });
    expect(close.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(close);
    expect(within(agent).queryAllByTestId("inner-card")).toHaveLength(0);
  });

  it("an agent with no prompts has no link to fold, and keeps its way to add one", () => {
    show([node("ag", "agent_config", { system_prompt: "", model: "Opus 5.5" }, { title: "Empty" })]);
    const agent = screen.getByRole("group", { name: /^Agent/ });
    expect(within(agent).queryByRole("button", { name: /^Show prompts/ })).toBeNull();
    expect(within(agent).getByRole("button", { name: "Add a prompt to this agent" })).toBeTruthy();
  });

  it("opening a link never selects the tile", () => {
    const props = show(buildListWithAgent());
    fireEvent.click(screen.getByRole("button", { name: "Show prompts" }));
    expect(props.onSelect).not.toHaveBeenCalled();
  });
});

function buildListWithAgent(): NodeTree[] {
  return [node("ag", "agent_config", { system_prompt: "Review the draft." , model: "Opus 5.5" }, { title: "Reviewer", children: [node("ag-p", "prompt", { text: "Also check the tone." }, { parent_id: "ag" })] })];
}

describe("what a tile draws only when it is near (CA-15 P10)", () => {
  const twoPrompts = () => [node("p1", "prompt", { text: "One" }, { title: "One" }), node("p2", "prompt", { text: "Two" }, { title: "Two" })];
  const near = (tile: HTMLElement, type: string) => act(() => void tile.dispatchEvent(new Event(type)));

  it("keeps the drag handle's label and draws it only while its tile is hovered or has focus, with no fade", () => {
    show(twoPrompts(), { onNest: vi.fn(() => Promise.resolve(true)), canNest: () => true } as never);
    const tile = screen.getByRole("group", { name: /^Prompt 2/ });
    const handle = within(tile).getByTestId("drag-handle");
    expect(handle.getAttribute("aria-label")).toBe("Move prompt 2");
    expect(handle.style.opacity).toBe("0");
    near(tile, "pointerenter");
    expect(handle.style.opacity).toBe("1");
    near(tile, "pointerleave");
    expect(handle.style.opacity).toBe("0");
    near(tile, "focusin");
    expect(handle.style.opacity).toBe("1");
    expect(handle.style.transition).toBe("");
  });

  it("puts 'Send with the step above' on the footer's line, so a tile that can take it has no row of its own", () => {
    show(twoPrompts(), { onNest: vi.fn(() => Promise.resolve(true)), canNest: () => true } as never);
    const tile = screen.getByRole("group", { name: /^Prompt 2/ });
    expect(within(within(tile).getByTestId("tile-footer")).getByTestId("nest-control")).toBeTruthy();
  });

  it("draws 'Send with the step above' the same way, with no fade", () => {
    show(twoPrompts(), { onNest: vi.fn(() => Promise.resolve(true)), canNest: () => true } as never);
    const tile = screen.getByRole("group", { name: /^Prompt 2/ });
    const control = within(tile).getByTestId("nest-control");
    expect(control.style.opacity).toBe("0");
    near(tile, "pointerenter");
    expect(control.style.opacity).toBe("1");
    expect(control.style.transition).toBe("");
  });

  it("draws both at once on a phone, which has no hover", () => {
    cleanup();
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: /max-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    show(twoPrompts(), { phone: true, onNest: vi.fn(() => Promise.resolve(true)), canNest: () => true } as never);
    const tile = screen.getByRole("group", { name: /^Prompt 2/ });
    expect(within(tile).getByTestId("drag-handle").style.opacity).toBe("1");
    expect(within(tile).getByTestId("nest-control").style.opacity).toBe("1");
  });
});

describe("the rows that must draw nothing when they have nothing (CA-15 P10)", () => {
  it("draws no Uses row, no nest row, no cost lines, no made line, no mentioned line and no shape chip on a bare tile", () => {
    show(bare());
    for (const card of cards()) {
      const name = card.getAttribute("aria-label");
      for (const id of ["tile-cost", "mentioned-line", "shape-chip", "nest-control", "sent-with", "sent-with-found"]) expect(within(card).queryByTestId(id), `${name}: ${id}`).toBeNull();
      expect(within(card).queryByText("Uses"), name ?? "").toBeNull();
      expect(within(card).queryByText(/^Makes /), name ?? "").toBeNull();
    }
  });

  it("a shape chip with nothing to say is not drawn", () => {
    show([node("p1", "prompt", { text: "One", output_shape: {} }, { title: "One" })]);
    expect(screen.queryByTestId("shape-chip")).toBeNull();
  });
});
