/* CA-15b P3: the tile recipes at the boards' sizes, and each kind's tile in the boards' order and words: the eyebrow, the
   title, the body, then the foot; a part with nothing to say is left out. */

import { cleanup, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";
import { buildSteps } from "@/lib/build/graph";
import { footerFactsOf, typeLineOf } from "@/lib/build/tileLines";
import type { NodeTree } from "@/lib/build/types";
import { t } from "@/lib/theme/tokens";

import { BuildList, type BuildListProps } from "./BuildList";
import { NumberBadge, RUN, SmallCodeWell, TILE_FOOT, TILE_INDENT, TileOptions, tileStyle } from "./tileRecipes";

vi.mock("@/lib/build/media", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build/media")>()), getMediaById: vi.fn(() => Promise.resolve(null)) }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the tile recipes (CA-15b P3)", () => {
  it("tile: --module, radius 10, padding 14 16, gap 8", () => {
    expect(tileStyle()).toMatchObject({ background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: 10, padding: "14px 16px", gap: 8 });
  });

  it("run: gap 10, padded 14 from a hairline down the left", () => {
    expect(RUN).toMatchObject({ gap: 10, paddingLeft: 14, borderLeft: `1px solid ${t.hairlineModule}` });
  });

  it("number badge 22 square, radius 5; options button 26 square, radius 6, a 14 glyph", () => {
    const badge = renderToStaticMarkup(<NumberBadge>3</NumberBadge>);
    expect(badge).toContain("height:22px");
    expect(badge).toContain("border-radius:5px");
    expect(badge).toContain("font-size:11px");
    render(<TileOptions label="Prompt 3 options" />);
    const options = screen.getByRole("button", { name: "Prompt 3 options" });
    expect(options.style.width).toBe("26px");
    expect(options.style.borderRadius).toBe("6px");
    expect(options.querySelector("svg")?.getAttribute("width")).toBe("14");
  });

  it("body and foot sit 34 in; the foot is at least 20 tall", () => {
    expect(TILE_INDENT).toBe(34);
    expect(TILE_FOOT).toMatchObject({ justifyContent: "space-between", minHeight: 20 });
  });

  it("small code well: a 28 gutter, 12/18, three lines", () => {
    render(<SmallCodeWell text={"a\nb\nc\nd"} label="Code 4" />);
    expect(screen.getByTestId("code-gutter-numbers").textContent).toBe("1\n2\n3");
    expect(screen.getByTestId("code-lines").textContent).toBe("a\nb\nc");
    expect(getComputedStyle(screen.getByRole("region", { name: "Code 4" })).gridTemplateColumns).toBe("28px minmax(0, 1fr)");
  });
});

let seq = 0;
const node = (id: string, type: string, payload: Record<string, unknown>, over: Partial<NodeTree> = {}): NodeTree =>
  ({ id, build_id: "b", parent_id: null, position: ++seq, type, title: null, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-07T09:00:00.000Z", children: [], ...over }) as NodeTree;

/** One tile of each kind, holding what the boards show. */
const boardTiles = (): NodeTree[] => [
  node("pr", "prompt", { text: "Create ten detailed implementation prompts.", reply: "Created the prompts for wave six." }),
  node("cd", "code", { source: "a\nb\nc\nd", language: "ts", filename: "src/editor/shortcuts.ts", tool: "claude-code" }, { title: "src/editor/shortcuts.ts" }),
  node("ck", "eval_run", { tested: "Places a test order", passing: "The total shows £9.00", passed: 8, total: 10, run_at: "2026-10-12", cases: [{ input: "a", expected: "b", actual: "b", passed: true }] }, { title: "Places a test order" }),
  node("tl", "integration", { step: true, service: "Gmail", connection: "mcp", scopes: "Read the inbox, drafted replies", permissions: "write", plan: "Free" }),
  node("tm", "team", { pattern: "parallel", runs: { how: "event" } }, { title: "Writers", children: [node("tm1", "agent_config", { system_prompt: "Lead.", model: "Opus 5.5" }, { title: "Menu writer", parent_id: "tm" }), node("tm2", "agent_config", { system_prompt: "Check.", model: "Opus 5.5" }, { title: "Checker", parent_id: "tm" })] }),
  node("ds", "dataset", { step: true, description: "Rated answers", use: "evaluation", format: "CSV", columns: ["input", "expected", "actual", "score"] }, { title: "Tickets" }),
  node("rp", "repo", { step: true, url: "github.com/ueberdosis/tiptap", ownership: "third_party", description: "Rich text editor", usage: ["dependency"], language: "TypeScript", licence_spdx: "MIT", fetched_at: "2026-10-07T09:00:00Z", author: "ueberdosis" }),
];

function show(nodes: NodeTree[]) {
  const base = sandboxListProps("bakery");
  const props = { ...base, steps: buildSteps(nodes), dividers: new Map(), results: [], onSelect: vi.fn(), onRename: vi.fn(), onMove: vi.fn(), onRemove: vi.fn(), onAccept: vi.fn(), onDismiss: vi.fn(), onOpenPrompt: vi.fn() } as unknown as BuildListProps;
  render(
    <MemoryRouter>
      <BuildList {...props} />
    </MemoryRouter>,
  );
}

const tile = (kind: string) => screen.getAllByTestId("step-card").find((card) => card.getAttribute("data-kind") === kind) as HTMLElement;

/** True when `a` comes before `b` in the page. */
const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("each kind's tile as its board (CA-15b P3)", () => {
  it("says the boards' eyebrows and feet", () => {
    const steps = buildSteps(boardTiles());
    const of = (id: string) => steps.find((step) => step.id === id) as (typeof steps)[number];
    expect(typeLineOf(of("cd"))).toBe("Code · TypeScript · 4 lines");
    expect(footerFactsOf(of("cd"))).toEqual(["Generated with Claude Code"]);
    expect(typeLineOf(of("ck"))).toBe("Check");
    expect(footerFactsOf(of("ck"))).toEqual(["1 test case", "Last run 12 Oct 2026"]);
    expect(typeLineOf(of("tl"))).toBe("Tool · MCP server");
    expect(footerFactsOf(of("tl"))).toEqual(["Read and write", "Free plan"]);
    expect(typeLineOf(of("tm"))).toBe("Multi-agent team · Parallel then merged");
    expect(footerFactsOf(of("tm"))[0]).toBe("2 agents");
    expect(typeLineOf(of("ds"))).toBe("Dataset · Evaluation");
    expect(footerFactsOf(of("ds")).slice(0, 2)).toEqual(["CSV", "4 columns"]);
    expect(typeLineOf(of("rp"))).toBe("GitHub repository · Third-party");
    expect(footerFactsOf(of("rp"))).toEqual(["TypeScript", "MIT", "Author ueberdosis"]);
  });

  it("draws the head, then the body, then the foot, in that order", () => {
    show(boardTiles());
    for (const card of screen.getAllByTestId("step-card")) {
      const badge = within(card).getByTestId("number-badge");
      const eyebrow = card.querySelector('[data-testid$="-eyebrow"]') as HTMLElement;
      const title = within(card).getByRole("heading", { level: 3 });
      expect(before(badge, eyebrow), card.getAttribute("aria-label") ?? "").toBe(true);
      expect(before(eyebrow, title)).toBe(true);
      const foot = within(card).queryByTestId("tile-footer");
      if (foot) expect(before(title, foot)).toBe(true);
    }
  });

  it("a prompt: its text, then the response line, then '48 words'-style facts and Open prompt", () => {
    show(boardTiles());
    const prompt = tile("prompt");
    const reply = within(prompt).getByTestId("prompt-reply");
    expect(reply.textContent).toBe("Response Created the prompts for wave six.");
    expect(before(reply, within(prompt).getByTestId("tile-footer"))).toBe(true);
    expect(within(prompt).getByTestId("tile-footer-facts").textContent).toBe("5 words");
    expect(within(prompt).getByRole("button", { name: "Open prompt" })).toBeTruthy();
  });

  it("a tool: its app's mark before its name, what it did in the body", () => {
    show(boardTiles());
    const tool = tile("tool");
    expect(within(within(tool).getByRole("heading", { level: 3 })).getByTestId("app-mark")).toBeTruthy();
    expect(within(tool).getByTestId("tool-scopes").textContent).toBe("Read the inbox, drafted replies");
    expect(within(tool).getByTestId("tile-footer-facts").textContent).toBe("Read and write · Free plan");
  });

  it("code: three lines in the small well, then the foot", () => {
    show(boardTiles());
    const code = tile("code");
    expect(within(code).getByTestId("code-lines").textContent).toBe("a\nb\nc");
    expect(within(code).getByTestId("tile-footer-facts").textContent).toBe("Generated with Claude Code");
    expect(within(code).getByRole("button", { name: "Show all 4 lines" })).toBeTruthy();
  });

  it("a check: 'Pass criteria:' then the criteria, then a dot line", () => {
    show(boardTiles());
    const check = tile("check");
    expect(within(check).getByTestId("check-criteria").textContent).toBe("Pass criteria: The total shows £9.00");
    expect(within(check).getByTestId("check-status")).toBeTruthy();
  });

  it("a team: its agents in a list, the lead marked Lead", () => {
    show(boardTiles());
    const agents = screen.getAllByTestId("team-agent");
    expect(agents[0].textContent).toMatch(/^Menu writer.*Lead/);
    expect(agents[1].textContent).not.toMatch(/Lead/);
  });

  it("a dataset: its columns in the data face, joined by ' · '", () => {
    show(boardTiles());
    expect(within(tile("dataset")).getByTestId("dataset-columns").textContent).toBe("input · expected · actual · score");
  });

  it("a repository: the mark before its name, then Open on GitHub in the foot", () => {
    show(boardTiles());
    const repo = tile("repo");
    expect(within(within(repo).getByRole("heading", { level: 3 })).getByTestId("app-mark")).toBeTruthy();
    expect(within(repo).getByRole("link", { name: "Open on GitHub" })).toBeTruthy();
  });

  it("leaves out a part that has nothing to say", () => {
    show([node("tl", "integration", { step: true, service: "Slack" })]);
    const tool = tile("tool");
    expect(within(tool).queryByTestId("tool-scopes")).toBeNull();
    expect(within(tool).queryByTestId("tile-footer")).toBeNull();
  });
});
