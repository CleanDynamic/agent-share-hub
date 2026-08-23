// The registry's contract, and the four node shapes the acceptance check names.
//
// These render through NodeCard rather than calling a renderer directly, because
// the thing worth protecting is the whole path: registry key -> component ->
// copy control. A test that imported BreakageRenderer directly would still pass
// on the day resolveRenderer stopped reaching it.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Build, BuildNode, NodeType, NodeSchema } from "@/lib/build";
import { NodeCard } from "../NodeCard";
import { RENDERERS, resolveRenderer, resolveCopyText, GenericPayloadRenderer } from "./index";
import { mediaUrl } from "./media";
import { parseCells } from "./evidence";
import { makeResolveNode } from "./resolveNode";

const build = { id: "b", slug: "demo", title: "Demo build" } as unknown as Build;

function type(
  key: string,
  renderer: string,
  schema: NodeSchema,
  extra: Partial<NodeType> = {}
): NodeType {
  return {
    key,
    label: key,
    category: "narrative",
    colour: "#9CA3AF",
    icon: "StickyNote",
    renderer,
    copyable: false,
    is_active: true,
    sort: 1,
    schema,
    ...extra,
  } as NodeType;
}

function node(type: string, payload: Record<string, unknown>, extra: Partial<BuildNode> = {}): BuildNode {
  return {
    id: `n-${type}`,
    build_id: "b",
    parent_id: null,
    position: 0,
    type,
    title: `A ${type}`,
    note: null,
    payload,
    source_ref: null,
    event_id: null,
    is_gap: false,
    created_at: "",
    ...extra,
  } as BuildNode;
}

const noResolve = makeResolveNode([]);

function renderCard(n: BuildNode, t?: NodeType, resolveNode = noResolve) {
  return render(<NodeCard node={n} nodeType={t} build={build} resolveNode={resolveNode} />);
}

// --- the registry ------------------------------------------------------------

describe("the renderer registry", () => {
  const KEYS = [
    "instruction", "configuration", "data", "artefact", "evidence", "narrative",
    "prompt", "agent_config", "comparison_table", "generated_media", "breakage", "gap",
  ];

  it("resolves every one of the twelve renderer keys the registry declares", () => {
    expect(Object.keys(RENDERERS).sort()).toEqual([...KEYS].sort());
    for (const key of KEYS) {
      expect(typeof resolveRenderer(key)).toBe("function");
      expect(resolveRenderer(key)).not.toBe(GenericPayloadRenderer);
    }
  });

  it("falls back to GenericPayload for an unknown, empty or absent key", () => {
    for (const key of ["not_a_renderer", "", null, undefined]) {
      expect(resolveRenderer(key as string)).toBe(GenericPayloadRenderer);
    }
  });

  it("renders a node whose renderer key is unknown instead of blanking the card", () => {
    const unknown = type("future_type", "renderer_from_a_newer_deploy", {
      fields: [{ key: "body", label: "Body", type: "text", required: true }],
    });
    renderCard(node("future_type", { body: "Still readable." }), unknown);

    expect(screen.getByText("Still readable.")).toBeTruthy();
    expect(document.querySelector('[data-renderer-slot="renderer_from_a_newer_deploy"]')).toBeTruthy();
  });

  it("renders a node with no registry row at all", () => {
    const { container } = renderCard(node("orphan", { anything: "at all" }), undefined);
    expect(container.innerHTML).toContain("at all");
  });
});

// --- prompt ------------------------------------------------------------------

const promptType = type(
  "prompt",
  "prompt",
  {
    fields: [
      { key: "text", label: "Prompt text", type: "text", required: true },
      {
        key: "variables", label: "Variables", type: "list", of: [
          { key: "name", label: "Name", type: "string" },
          { key: "description", label: "Description", type: "string" },
          { key: "example", label: "Example", type: "string" },
        ],
      },
      { key: "model", label: "Model", type: "string" },
      { key: "params", label: "Parameters", type: "text" },
    ],
  },
  { category: "instruction", colour: "#E8571A", copyable: true }
);

const RAW_PROMPT = "Thread summary:\n{{thread_summary}}\n\nClassify.";

describe("the prompt renderer", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("copies the raw prompt text and nothing around it", async () => {
    renderCard(
      node("prompt", {
        text: RAW_PROMPT,
        model: "claude-opus-4-5",
        params: "temperature 0.2",
        variables: [{ name: "thread_summary", description: "The summary", example: "Supplier chasing." }],
      }),
      promptType
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy to clipboard" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(RAW_PROMPT);

    const copied = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(copied).not.toMatch(/[<>]/);
    expect(copied).not.toContain("Prompt text");
    expect(copied).not.toContain("claude-opus-4-5");
  });

  it("shows model and params as a caption, not a heading", () => {
    const { container } = renderCard(
      node("prompt", { text: RAW_PROMPT, model: "claude-opus-4-5", params: "temperature 0.2" }),
      promptType
    );
    const caption = screen.getByText("claude-opus-4-5 · temperature 0.2");
    expect(caption.tagName).toBe("SPAN");
    expect(container.querySelectorAll("h1,h2,h4,h5,h6").length).toBe(0);
  });

  it("renders the variables table only when variables are present", () => {
    const { rerender } = renderCard(
      node("prompt", {
        text: RAW_PROMPT,
        variables: [{ name: "today", description: "Current date", example: "2026-08-15" }],
      }),
      promptType
    );
    expect(screen.getByText("{{today}}")).toBeTruthy();
    expect(screen.getByText("Current date")).toBeTruthy();
    expect(screen.getByText("2026-08-15")).toBeTruthy();

    rerender(
      <NodeCard
        node={node("prompt", { text: RAW_PROMPT, variables: [] })}
        nodeType={promptType}
        build={build}
        resolveNode={noResolve}
      />
    );
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("preserves the prompt's whitespace exactly", () => {
    const { container } = renderCard(node("prompt", { text: RAW_PROMPT }), promptType);
    const pre = container.querySelector("pre") as HTMLElement;
    expect(pre.textContent).toBe(RAW_PROMPT);
    expect(pre.style.whiteSpace).toBe("pre-wrap");
  });

  it("offers no copy control on a type the registry does not mark copyable", () => {
    renderCard(node("prompt", { text: RAW_PROMPT }), { ...promptType, copyable: false });
    expect(screen.queryByRole("button", { name: "Copy to clipboard" })).toBeNull();
  });
});

// --- agent_config ------------------------------------------------------------

const agentType = type(
  "agent_config",
  "agent_config",
  {
    fields: [
      { key: "system_prompt", label: "System prompt", type: "text", required: true },
      { key: "model", label: "Model", type: "string", required: true },
      { key: "temperature", label: "Temperature", type: "number" },
      { key: "tools", label: "Tools", type: "list", of: [{ key: "tool_ref", label: "Tool", type: "string", format: "node_id" }] },
      { key: "guardrails", label: "Guardrails", type: "list", of: [{ key: "rule", label: "Rule", type: "string" }] },
      { key: "test_passing", label: "Tests passing", type: "number" },
      { key: "test_total", label: "Tests total", type: "number" },
      { key: "test_run_at", label: "Tests run at", type: "string", format: "timestamp" },
    ],
  },
  { category: "configuration", colour: "#7C3AED", copyable: true }
);

describe("the agent_config renderer", () => {
  const tool = { ...node("tool_definition", {}, { id: "tool-1" }), title: "fetch_thread_context", children: [] };
  const resolve = makeResolveNode([tool as never]);

  const payload = {
    system_prompt: Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join("\n"),
    model: "claude-opus-4-5",
    temperature: 0.2,
    tools: [{ tool_ref: "tool-1" }, { tool_ref: "not-in-this-build" }],
    guardrails: [{ rule: "Never send." }, { rule: "Never invent a date." }],
    test_passing: 58,
    test_total: 60,
    test_run_at: "2026-08-14T09:12:00Z",
  };

  it("collapses the system prompt to six lines behind a reveal", () => {
    const { container } = renderCard(node("agent_config", payload), agentType, resolve);
    const pre = container.querySelector("pre") as HTMLElement;
    expect(pre.getAttribute("data-clamped-lines")).toBe("6");
    // The whole prompt is in the DOM either way — the clamp is visual, so the
    // text stays selectable and searchable while it is collapsed.
    expect(pre.textContent).toContain("line 12");

    fireEvent.click(screen.getByText("Show the whole system prompt"));
    const revealed = container.querySelector("pre") as HTMLElement;
    expect(revealed.getAttribute("data-clamped-lines")).toBeNull();
  });

  it("resolves tool references to the referenced node's title", () => {
    renderCard(node("agent_config", payload), agentType, resolve);
    expect(screen.getByText("fetch_thread_context")).toBeTruthy();
    // A reference outside the placed tree is shown as missing, never as a uuid.
    expect(screen.getByText("Tool not in this build")).toBeTruthy();
    expect(screen.queryByText("not-in-this-build")).toBeNull();
  });

  it("prints guardrails as a list and the test results as passing/total with a date", () => {
    renderCard(node("agent_config", payload), agentType, resolve);
    expect(screen.getAllByRole("listitem").length).toBe(2);
    expect(screen.getByText(/58\/60 passing · run /)).toBeTruthy();
  });
});

// --- dataset -----------------------------------------------------------------

const datasetType = type(
  "dataset",
  "data",
  {
    fields: [
      { key: "description", label: "Description", type: "text", required: true },
      { key: "record_count", label: "Record count", type: "number" },
      { key: "format", label: "Format", type: "string" },
      { key: "sample", label: "Sample records", type: "list", of: [{ key: "record", label: "Record", type: "text" }] },
    ],
  },
  { category: "data", colour: "#3B82F6" }
);

describe("the data renderer", () => {
  it("leads with the counts, then the description, then a capped sample", () => {
    const { container } = renderCard(
      node("dataset", {
        description: "Sixty hand-labelled emails.",
        record_count: 60,
        format: "JSONL",
        sample: Array.from({ length: 8 }, (_, i) => ({ record: `record ${i}` })),
      }),
      datasetType
    );

    expect(screen.getByText("60")).toBeTruthy();
    expect(screen.getByText("JSONL")).toBeTruthy();
    expect(screen.getByText("Sixty hand-labelled emails.")).toBeTruthy();

    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(5);
    expect(screen.getByText("Sample of 60 — showing 5")).toBeTruthy();
  });
});

// --- comparison_table --------------------------------------------------------

const comparisonType = type(
  "comparison_table",
  "comparison_table",
  {
    fields: [
      { key: "columns", label: "Columns", type: "list", required: true, of: [
        { key: "key", label: "Key", type: "string" }, { key: "label", label: "Label", type: "string" }] },
      { key: "rows", label: "Rows", type: "list", of: [{ key: "cells", label: "Cells", type: "text" }] },
      { key: "winner", label: "Winner", type: "string" },
      { key: "method", label: "Method", type: "text" },
      { key: "n", label: "Sample size", type: "number" },
    ],
  },
  { category: "evidence", colour: "#2EC4B6" }
);

const comparisonPayload = {
  columns: [
    { key: "model", label: "Model" },
    { key: "accuracy", label: "Accuracy" },
    { key: "cost", label: "Cost / 1k" },
  ],
  rows: [
    { cells: "gpt-4o-mini | 0.87 | $0.14" },
    { cells: "claude-opus-4-5 | 0.97 | $1.10" },
    { cells: "llama-3-70b | 0.79 | $0.06" },
  ],
  winner: "claude-opus-4-5",
  method: "Same 60 hand-labelled emails, three runs each, temperature 0.",
  n: 60,
};

describe("the comparison_table renderer", () => {
  it("renders a real table, marks the winner row, and footnotes method and n", () => {
    const { container } = renderCard(node("comparison_table", comparisonPayload), comparisonType);

    const table = screen.getByRole("table");
    expect(within(table).getByText("Accuracy")).toBeTruthy();
    expect(within(table).getAllByRole("row").length).toBe(4); // header + three rows
    expect(within(table).getByText("$1.10")).toBeTruthy();

    const marked = container.querySelectorAll('tbody tr[data-marked="true"]');
    expect(marked.length).toBe(1);
    expect(marked[0].textContent).toContain("claude-opus-4-5");
    expect((marked[0].querySelector("td") as HTMLElement).style.borderLeft).toBe("3px solid #2EC4B6");

    expect(
      screen.getByText(
        "Method: Same 60 hand-labelled emails, three runs each, temperature 0. · n = 60"
      )
    ).toBeTruthy();
  });

  it("survives a comparison with no rows recorded", () => {
    renderCard(node("comparison_table", { columns: comparisonPayload.columns }), comparisonType);
    expect(screen.getByText(/no columns or no rows/)).toBeTruthy();
  });
});

describe("parseCells", () => {
  it("accepts a pipe-delimited string, a JSON array and a real array", () => {
    expect(parseCells("a | b | c", 3)).toEqual(["a", "b", "c"]);
    expect(parseCells('["a","b"]', 2)).toEqual(["a", "b"]);
    expect(parseCells(["a", "b"], 2)).toEqual(["a", "b"]);
  });

  it("does not tear a single prose cell in half at its comma", () => {
    expect(parseCells("Fast, but wrong", 3)).toEqual(["Fast, but wrong"]);
    expect(parseCells("a, b, c", 3)).toEqual(["a", "b", "c"]);
  });
});

// --- breakage and gap --------------------------------------------------------

const breakageType = type(
  "breakage",
  "breakage",
  {
    fields: [
      { key: "symptom", label: "Symptom", type: "text", required: true },
      { key: "cause", label: "Cause", type: "text" },
      { key: "resolution", label: "Resolution", type: "text" },
      { key: "attempts", label: "Attempts", type: "number" },
    ],
  },
  { colour: "#EF4444" }
);

describe("the breakage renderer", () => {
  it("renders symptom, cause and resolution as three red-ruled sections", () => {
    const { container } = renderCard(
      node("breakage", {
        symptom: "Long threads were archived.",
        cause: "The deciding message sat at the far end of the context.",
        resolution: "A generated summary plus the last three messages.",
        attempts: 6,
      }),
      breakageType
    );

    const ruled = Array.from(container.querySelectorAll<HTMLElement>("div")).filter(
      (el) => el.style.borderLeft === "3px solid #EF4444"
    );
    expect(ruled.length).toBe(3);
    expect(ruled.map((el) => el.textContent)).toEqual([
      expect.stringContaining("Long threads were archived."),
      expect.stringContaining("far end of the context"),
      expect.stringContaining("last three messages"),
    ]);

    for (const label of ["Symptom", "Cause", "Resolution"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText("Resolved after 6 attempts")).toBeTruthy();
  });

  it("omits a section the creator did not fill in", () => {
    const { container } = renderCard(node("breakage", { symptom: "It broke." }), breakageType);
    const ruled = Array.from(container.querySelectorAll<HTMLElement>("div")).filter(
      (el) => el.style.borderLeft === "3px solid #EF4444"
    );
    expect(ruled.length).toBe(1);
  });
});

const gapType = type(
  "gap",
  "gap",
  {
    fields: [
      { key: "problem", label: "Problem", type: "text", required: true },
      { key: "what_i_tried", label: "What was tried", type: "text" },
      { key: "acceptance_criteria", label: "Acceptance criteria", type: "text" },
      { key: "reward_note", label: "Reward", type: "text" },
    ],
  },
  { colour: "#EF4444" }
);

describe("the gap renderer", () => {
  it("reads as an open invitation: unsolved, what was tried, and what solved means", () => {
    const { container } = renderCard(
      node("gap", {
        problem: "It cannot tell who to delegate to.",
        what_i_tried: "A static routing table, then a prompt over the team list.",
        acceptance_criteria: "Right on 45 of 50 held-out cases.",
        reward_note: "Happy to co-credit whoever cracks it.",
      }, { is_gap: true }),
      gapType
    );

    expect(screen.getByText("Unsolved")).toBeTruthy();
    expect(screen.getByText("It cannot tell who to delegate to.")).toBeTruthy();
    expect(screen.getByText("What was tried")).toBeTruthy();
    expect(screen.getByText("Right on 45 of 50 held-out cases.")).toBeTruthy();
    expect(screen.getByText("Happy to co-credit whoever cracks it.")).toBeTruthy();

    const callout = container.querySelector('[data-gap-callout="true"]') as HTMLElement;
    expect(callout.style.border).toContain("rgba(239,68,68");
  });
});

// --- media -------------------------------------------------------------------

describe("mediaUrl", () => {
  it("asks for a transform, never the original, for a storage path", () => {
    const url = mediaUrl("build-media/abc/shot.png", { width: 480, quality: 70 });
    expect(url).toContain("/storage/v1/render/image/public/build-media/abc/shot.png");
    expect(url).toContain("width=480");
    expect(url).toContain("quality=70");
  });

  it("rewrites a public object URL onto the render endpoint", () => {
    const url = mediaUrl(
      "https://p.supabase.co/storage/v1/object/public/build-media/shot.png",
      { width: 960 }
    );
    expect(url).toBe(
      "https://p.supabase.co/storage/v1/render/image/public/build-media/shot.png?width=960&quality=70"
    );
  });

  it("leaves a foreign URL alone and refuses an opaque id", () => {
    expect(mediaUrl("https://example.test/a.png", { width: 480 })).toBe("https://example.test/a.png");
    expect(mediaUrl("demo-media-triage-view-v2", { width: 480 })).toBeNull();
    expect(mediaUrl("", { width: 480 })).toBeNull();
    expect(mediaUrl(null, { width: 480 })).toBeNull();
  });
});

// --- copy text ---------------------------------------------------------------

describe("resolveCopyText", () => {
  it("defaults to the first required text field when a module offers nothing", () => {
    const noModule = type("future", "no_such_renderer", {
      fields: [
        { key: "label", label: "Label", type: "string", required: true },
        { key: "body", label: "Body", type: "text", required: true },
      ],
    });
    expect(resolveCopyText(node("future", { label: "x", body: "the body" }), noModule)).toBe("the body");
  });

  it("returns null when there is nothing worth copying", () => {
    const empty = type("future", "no_such_renderer", {
      fields: [{ key: "label", label: "Label", type: "string", required: true }],
    });
    expect(resolveCopyText(node("future", { label: "x" }), empty)).toBeNull();
    expect(resolveCopyText(node("future", {}), undefined)).toBeNull();
  });

  it("copies a configuration as key: value lines rather than one bare field", () => {
    const configType = type(
      "model_params",
      "configuration",
      {
        fields: [
          { key: "model", label: "Model", type: "string", required: true },
          { key: "temperature", label: "Temperature", type: "number" },
        ],
      },
      { category: "configuration", copyable: true }
    );
    expect(resolveCopyText(node("model_params", { model: "claude-opus-4-5", temperature: 0.2 }), configType))
      .toBe("model: claude-opus-4-5\ntemperature: 0.2");
  });
});
