// Acceptance cover for the typed renderer registry (NS-P05).
//
// The fixtures are not invented: the registry rows are transcribed from the
// NS-P02 migration and the payloads from the NS-P03 demo seed, so a test
// passing here means the seeded build renders this way. The one exception is
// the comparison_table node, which the demo seed does not contain — its
// payload is written to the schema the migration declares.

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Only the URL signing is stubbed.
 *
 * build-media is a private bucket, so an <img src> needs a signed URL rather
 * than a path — signedMediaUrl is the one thing on the read path that talks to
 * storage, and jsdom cannot. Everything else in the lib layer is the real
 * module, so the transform widths asserted below are the ones the renderers
 * actually ask for.
 */
const signedMediaUrl = vi.fn(
  async (media: { path: string }, options?: { width?: number | string }) =>
    `https://project.supabase.co/storage/v1/render/image/sign/build-media/${media.path}?width=${options?.width}&quality=75&token=t`
);
vi.mock("@/lib/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/build")>();
  return {
    ...actual,
    signedMediaUrl: (media: { path: string }, options?: { width?: number | string }) =>
      signedMediaUrl(media, options),
  };
});

import type { Build, BuildMedia, BuildNode, NodeType } from "@/lib/build";
import { NodeCard } from "../NodeCard";
import { GenericRenderer, RENDERERS, resolveRenderer, getNodeCopyText } from "./index";
import { mediaSrc } from "./shared";

// --- fixtures ----------------------------------------------------------------

const build = { id: "b", slug: "inbox-triage-agent-demo", title: "Inbox triage agent" } as Build;

function makeType(partial: Partial<NodeType> & { key: string; renderer: string }): NodeType {
  return {
    label: partial.key,
    category: "narrative",
    colour: "#9CA3AF",
    icon: "StickyNote",
    copyable: false,
    is_active: true,
    sort: 1,
    schema: { fields: [] },
    ...partial,
  } as NodeType;
}

function makeNode(partial: Partial<BuildNode> & { type: string }): BuildNode {
  return {
    id: "n1",
    build_id: "b",
    parent_id: null,
    position: 0,
    title: "A node",
    note: null,
    payload: {},
    source_ref: null,
    event_id: null,
    is_gap: false,
    created_at: "",
    ...partial,
  } as BuildNode;
}

const noResolve = () => undefined;
/** "The build's media is loaded and holds nothing." See ResolveMedia. */
const noMedia = () => null;

/** A build_media row, as getMediaForBuild would return it. */
function makeMedia(partial: Partial<BuildMedia> & { id: string }): BuildMedia {
  return {
    build_id: "b",
    node_id: null,
    bucket: "build-media",
    path: `b/n/${partial.id}.png`,
    kind: "image",
    mime: "image/png",
    bytes: 120_000,
    width: 2400,
    height: 1350,
    duration: null,
    poster_path: null,
    created_at: "",
    ...partial,
  } as BuildMedia;
}

function renderCard(
  node: BuildNode,
  nodeType?: NodeType,
  resolveMedia: (id: string | null | undefined) => BuildMedia | null | undefined = noMedia
) {
  return render(
    <NodeCard
      node={node}
      nodeType={nodeType}
      build={build}
      resolveNode={noResolve}
      resolveMedia={resolveMedia}
    />
  );
}

/** jsdom keeps hex in some shorthands and rgb() in others; accept either. */
function colourMatches(value: string, hex: string): boolean {
  const int = parseInt(hex.replace("#", ""), 16);
  const rgb = `rgb(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255})`;
  return (
    value.trim().toLowerCase() === hex.toLowerCase() ||
    value.replace(/\s+/g, " ").trim() === rgb
  );
}

/** jsdom serialises colours to rgb(); accept either form. */
function borderLeftMatches(element: HTMLElement | null, hex: string): boolean {
  if (!element) return false;
  const { borderLeftWidth, borderLeftStyle, borderLeftColor } = element.style;
  if (borderLeftWidth !== "3px" || borderLeftStyle !== "solid") return false;
  const int = parseInt(hex.replace("#", ""), 16);
  const rgb = `rgb(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255})`;
  return (
    borderLeftColor.toLowerCase() === hex.toLowerCase() ||
    borderLeftColor.replace(/\s+/g, " ") === rgb
  );
}

/** The nearest ancestor carrying a left border, which AccentSection draws. */
function accentSectionFor(label: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = label.parentElement;
  while (current) {
    if (current.style.borderLeftWidth === "3px") return current;
    current = current.parentElement;
  }
  return null;
}

// --- 1. every renderer key resolves, unknown keys fall back -------------------

describe("the registry resolves every renderer in node_types", () => {
  // The twelve distinct values of node_types.renderer: the six category names
  // plus the six types whose payload earns a bespoke presentation.
  const KEYS = [
    "instruction",
    "prompt",
    "configuration",
    "agent_config",
    "data",
    "artefact",
    "generated_media",
    "evidence",
    "comparison_table",
    "narrative",
    "breakage",
    "gap",
  ];

  it("maps all twelve keys to a component that is not the fallback", () => {
    expect(Object.keys(RENDERERS).sort()).toEqual([...KEYS].sort());
    for (const key of KEYS) {
      const component = resolveRenderer(key);
      expect(component, `renderer "${key}"`).toBeTypeOf("function");
      expect(component, `renderer "${key}" should be typed, not the fallback`).not.toBe(
        GenericRenderer
      );
    }
  });

  it("falls back silently for an unknown, empty or missing renderer key", () => {
    expect(resolveRenderer("no_such_renderer")).toBe(GenericRenderer);
    expect(resolveRenderer("")).toBe(GenericRenderer);
    expect(resolveRenderer(null)).toBe(GenericRenderer);
    expect(resolveRenderer(undefined)).toBe(GenericRenderer);
  });

  it("still renders a node whose renderer value is unknown, rather than blanking", () => {
    const nodeType = makeType({
      key: "future_type",
      renderer: "a_renderer_written_next_month",
      label: "Future type",
      schema: { fields: [{ key: "body", label: "Body", type: "text", required: true }] },
    });
    const node = makeNode({
      type: "future_type",
      title: "A type from the future",
      payload: { body: "This still has to reach the reader." },
    });

    renderCard(node, nodeType);

    expect(screen.getByText("A type from the future")).toBeTruthy();
    expect(screen.getByText("This still has to reach the reader.")).toBeTruthy();
  });

  it("renders a node whose type is missing from the registry entirely", () => {
    const node = makeNode({
      type: "unregistered",
      title: "No registry row at all",
      payload: { anything: "still printed" },
    });

    renderCard(node, undefined);

    expect(screen.getByText("No registry row at all")).toBeTruthy();
    expect(screen.getByText("still printed")).toBeTruthy();
  });
});

// --- 2. the prompt node's copy button ----------------------------------------

// Transcribed from supabase/seeds/ns-demo-build.sql, node n_prompt.
const PROMPT_TEXT =
  "Thread summary:\n{{thread_summary}}\n\nMost recent messages, newest first:\n{{recent_messages}}\n\nToday is {{today}}. The account owner is {{owner_name}}.\n\nClassify.";

const promptType = makeType({
  key: "prompt",
  label: "Prompt",
  category: "instruction",
  colour: "#E8571A",
  renderer: "prompt",
  copyable: true,
  schema: {
    fields: [
      { key: "text", label: "Prompt text", type: "text", required: true },
      {
        key: "variables",
        label: "Variables",
        type: "list",
        of: [
          { key: "name", label: "Name", type: "string" },
          { key: "description", label: "Description", type: "string" },
          { key: "example", label: "Example", type: "string" },
        ],
      },
      { key: "model", label: "Model", type: "string" },
      { key: "params", label: "Parameters", type: "text" },
    ],
  },
});

const promptNode = makeNode({
  id: "n_prompt",
  type: "prompt",
  title: "Per-email classify call",
  payload: {
    text: PROMPT_TEXT,
    variables: [
      {
        name: "thread_summary",
        description: "Generated summary of the whole thread",
        example: "Supplier chasing sign-off on a revised quote.",
      },
      { name: "today", description: "Current date", example: "2026-08-15" },
    ],
    model: "claude-opus-4-5",
    params: "temperature 0.2, max_tokens 2048, top_p 0.95",
  },
});

describe("the seeded prompt node", () => {
  const writeText = vi.fn((_text: string) => Promise.resolve());

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
  });

  it("shows a copy button that puts the raw prompt on the clipboard", async () => {
    renderCard(promptNode, promptType);

    const button = screen.getByRole("button", { name: /copy/i });
    fireEvent.click(button);

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));

    const copied = writeText.mock.calls[0][0];
    // Exactly the payload text: no label, no model line, no markup, no trim.
    expect(copied).toBe(PROMPT_TEXT);
    expect(copied).not.toMatch(/<[a-z]/i);
    expect(copied).not.toContain("claude-opus-4-5");
    expect(copied).not.toContain("Prompt text");
  });

  it("offers no copy control on a type whose registry row is not copyable", () => {
    const nodeType = makeType({
      key: "note",
      renderer: "narrative",
      label: "Note",
      copyable: false,
      schema: { fields: [{ key: "body", label: "Note", type: "text", required: true }] },
    });
    renderCard(makeNode({ type: "note", payload: { body: "A note." } }), nodeType);

    expect(screen.queryByRole("button", { name: /copy/i })).toBeNull();
  });

  it("renders the prompt with its whitespace kept and its variables tabled", () => {
    renderCard(promptNode, promptType);

    const block = document.querySelector("pre");
    expect(block).toBeTruthy();
    expect((block as HTMLElement).style.whiteSpace).toBe("pre-wrap");
    expect(block?.textContent).toBe(PROMPT_TEXT);

    // The variables table, and the model/params caption rather than a heading.
    expect(screen.getByText("thread_summary")).toBeTruthy();
    expect(screen.getByText("Generated summary of the whole thread")).toBeTruthy();
    expect(screen.getByText("2026-08-15")).toBeTruthy();
    expect(
      screen.getByText("claude-opus-4-5 · temperature 0.2, max_tokens 2048, top_p 0.95")
    ).toBeTruthy();
  });
});

// --- 3. the comparison table --------------------------------------------------

const comparisonType = makeType({
  key: "comparison_table",
  label: "Comparison table",
  category: "evidence",
  colour: "#2EC4B6",
  renderer: "comparison_table",
  schema: {
    fields: [
      {
        key: "columns",
        label: "Columns",
        type: "list",
        required: true,
        of: [
          { key: "key", label: "Key", type: "string" },
          { key: "label", label: "Label", type: "string" },
          { key: "type", label: "Type", type: "enum", options: ["string", "number", "boolean"] },
        ],
      },
      {
        key: "rows",
        label: "Rows",
        type: "list",
        of: [{ key: "cells", label: "Cells", type: "text" }],
      },
      { key: "winner", label: "Winner", type: "string" },
      { key: "method", label: "Method", type: "text" },
      { key: "n", label: "Sample size", type: "number" },
    ],
  },
});

const comparisonPayload = {
  columns: [
    { key: "model", label: "Model", type: "string" },
    { key: "accuracy", label: "Accuracy", type: "number" },
    { key: "cost", label: "Cost per 1k", type: "string" },
  ],
  rows: [
    { cells: "claude-haiku-4-5 | 91.2% | £0.34" },
    { cells: "claude-opus-4-5 | 96.7% | £2.80" },
    { cells: "gpt-baseline | 88.0% | £1.10" },
  ],
  winner: "claude-opus-4-5",
  method: "Same 60 hand-labelled emails through each model, three runs averaged.",
  n: 60,
};

describe("the comparison table node", () => {
  it("renders a real HTML table from columns and rows", () => {
    renderCard(
      makeNode({ type: "comparison_table", title: "Model bake-off", payload: comparisonPayload }),
      comparisonType
    );

    const table = document.querySelector("table");
    expect(table).toBeTruthy();

    const headers = within(table as HTMLElement)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent);
    expect(headers).toEqual(["Model", "Accuracy", "Cost per 1k"]);

    const bodyRows = (table as HTMLElement).querySelectorAll("tbody tr");
    expect(bodyRows.length).toBe(3);
    expect(bodyRows[0].textContent).toContain("claude-haiku-4-5");
    expect(bodyRows[0].textContent).toContain("91.2%");
    expect(bodyRows[0].textContent).toContain("£0.34");
  });

  it("marks the winner row with a teal left border", () => {
    renderCard(
      makeNode({ type: "comparison_table", title: "Model bake-off", payload: comparisonPayload }),
      comparisonType
    );

    const bodyRows = Array.from(document.querySelectorAll("tbody tr")) as HTMLElement[];
    const winnerRow = bodyRows.find((row) => row.textContent?.includes("claude-opus-4-5"));
    const loserRow = bodyRows.find((row) => row.textContent?.includes("gpt-baseline"));

    expect(borderLeftMatches(winnerRow?.querySelector("td") as HTMLElement, "#2EC4B6")).toBe(true);
    expect(borderLeftMatches(loserRow?.querySelector("td") as HTMLElement, "#2EC4B6")).toBe(false);
  });

  it("prints the method and n as a footnote beneath the table", () => {
    const { container } = renderCard(
      makeNode({ type: "comparison_table", title: "Model bake-off", payload: comparisonPayload }),
      comparisonType
    );

    const footnote = screen.getByText(
      "Same 60 hand-labelled emails through each model, three runs averaged. · n = 60"
    );
    expect(footnote).toBeTruthy();

    // "Beneath": the footnote follows the table in document order.
    const table = container.querySelector("table") as HTMLElement;
    expect(table.compareDocumentPosition(footnote) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("reads rows written with the column keys directly, not only as cells", () => {
    renderCard(
      makeNode({
        type: "comparison_table",
        title: "Model bake-off",
        payload: {
          ...comparisonPayload,
          rows: [
            { model: "claude-opus-4-5", accuracy: "96.7%", cost: "£2.80" },
            { model: "gpt-baseline", accuracy: "88.0%", cost: "£1.10" },
          ],
        },
      }),
      comparisonType
    );

    const bodyRows = Array.from(document.querySelectorAll("tbody tr")) as HTMLElement[];
    expect(bodyRows.length).toBe(2);
    expect(bodyRows[0].textContent).toContain("96.7%");
    expect(borderLeftMatches(bodyRows[0].querySelector("td") as HTMLElement, "#2EC4B6")).toBe(true);
  });
});

// --- 4. the breakage node -----------------------------------------------------

const breakageType = makeType({
  key: "breakage",
  label: "Breakage",
  category: "narrative",
  colour: "#EF4444",
  renderer: "breakage",
  schema: {
    fields: [
      { key: "symptom", label: "Symptom", type: "text", required: true },
      { key: "cause", label: "Cause", type: "text" },
      { key: "resolution", label: "Resolution", type: "text" },
      { key: "attempts", label: "Attempts", type: "number" },
      { key: "event_start", label: "First event", type: "number" },
      { key: "event_end", label: "Last event", type: "number" },
    ],
  },
});

// Transcribed from the demo seed, node n_breakage.
const breakageNode = makeNode({
  id: "n_breakage",
  type: "breakage",
  title: "Long threads were all being archived",
  payload: {
    symptom:
      "Any thread past roughly forty messages came back archive, including threads plainly waiting on a reply from me.",
    cause:
      "The full thread was pasted into the prompt newest-last, so the message that actually mattered sat at the far end of a very long context.",
    resolution:
      "Stopped sending raw threads. The prompt now carries a generated thread summary plus the last three messages, newest first.",
    attempts: 6,
    event_start: 3,
    event_end: 4,
  },
});

describe("the seeded breakage node", () => {
  it("renders symptom, cause and resolution as three distinct red-bordered sections", () => {
    renderCard(breakageNode, breakageType);

    const sections = ["Symptom", "Cause", "Resolution"].map((label) => {
      const heading = screen.getByText(label);
      const section = accentSectionFor(heading);
      expect(section, `${label} should sit in its own accent section`).toBeTruthy();
      return section as HTMLElement;
    });

    for (const section of sections) {
      expect(borderLeftMatches(section, "#EF4444")).toBe(true);
    }

    // Three sections, not one block with three labels.
    expect(new Set(sections).size).toBe(3);

    expect(screen.getByText(/Any thread past roughly forty messages/)).toBeTruthy();
    expect(screen.getByText(/pasted into the prompt newest-last/)).toBeTruthy();
    expect(screen.getByText(/Stopped sending raw threads/)).toBeTruthy();
  });

  it("reads the attempt count back as resolved after N attempts", () => {
    renderCard(breakageNode, breakageType);
    expect(screen.getByText("Resolved after 6 attempts")).toBeTruthy();
  });

  it("says attempts so far when the breakage has no resolution yet", () => {
    renderCard(
      makeNode({
        type: "breakage",
        title: "Still broken",
        payload: { symptom: "It fails.", attempts: 1 },
      }),
      breakageType
    );
    expect(screen.getByText("1 attempt so far")).toBeTruthy();
  });
});

// --- the gap card, the bounty primitive --------------------------------------

describe("the seeded gap node", () => {
  const gapType = makeType({
    key: "gap",
    label: "Gap",
    colour: "#EF4444",
    renderer: "gap",
    schema: {
      fields: [
        { key: "problem", label: "Problem", type: "text", required: true },
        { key: "what_i_tried", label: "What was tried", type: "text" },
        { key: "acceptance_criteria", label: "Acceptance criteria", type: "text" },
        { key: "reward_note", label: "Reward", type: "text" },
      ],
    },
  });

  it("reads as an invitation: unsolved, the problem, what failed and the bar", () => {
    renderCard(
      makeNode({
        type: "gap",
        title: "Calendar-aware delegation",
        is_gap: true,
        payload: {
          problem: "It cannot tell who to delegate to.",
          what_i_tried: "A static routing table by keyword, which broke.",
          acceptance_criteria: "Right on 45 of 50 held-out cases.",
          reward_note: "Happy to co-credit whoever cracks it.",
        },
      }),
      gapType
    );

    expect(screen.getByText("Unsolved")).toBeTruthy();
    expect(screen.getByText("It cannot tell who to delegate to.")).toBeTruthy();
    expect(screen.getByText("What was tried")).toBeTruthy();
    expect(screen.getByText("Acceptance criteria")).toBeTruthy();
    expect(screen.getByText("Right on 45 of 50 held-out cases.")).toBeTruthy();
    expect(screen.getByText("Happy to co-credit whoever cracks it.")).toBeTruthy();
  });
});

// --- copy text resolution -----------------------------------------------------

describe("copy text resolution", () => {
  it("defaults to the first required text field when a module exports none", () => {
    const nodeType = makeType({
      key: "data_schema",
      renderer: "data",
      copyable: true,
      schema: {
        fields: [
          { key: "format", label: "Format", type: "string" },
          { key: "definition", label: "Definition", type: "text", required: true },
        ],
      },
    });
    const node = makeNode({ type: "data_schema", payload: { format: "SQL DDL", definition: "create table t ();" } });

    expect(getNodeCopyText(node, nodeType)).toBe("create table t ();");
  });

  it("falls back to the scalar settings for a config type with no text field", () => {
    const nodeType = makeType({
      key: "model_params",
      renderer: "configuration",
      copyable: true,
      schema: {
        fields: [
          { key: "model", label: "Model", type: "string", required: true },
          { key: "temperature", label: "Temperature", type: "number" },
        ],
      },
    });
    const node = makeNode({ type: "model_params", payload: { model: "claude-opus-4-5", temperature: 0.2 } });

    expect(getNodeCopyText(node, nodeType)).toBe("Model: claude-opus-4-5\nTemperature: 0.2");
  });

  it("returns null when there is nothing worth copying", () => {
    const nodeType = makeType({ key: "empty", renderer: "narrative", copyable: true });
    expect(getNodeCopyText(makeNode({ type: "empty" }), nodeType)).toBeNull();
  });
});

// --- media is requested transformed, never at original size ------------------

describe("media references", () => {
  it("rewrites a public storage URL to the render endpoint with width and quality", () => {
    const src = mediaSrc(
      "https://zyb.supabase.co/storage/v1/object/public/build-media/shot.png",
      { width: 480, quality: 70 }
    );
    expect(src).toBe(
      "https://zyb.supabase.co/storage/v1/render/image/public/build-media/shot.png?width=480&quality=70"
    );
    expect(src).not.toContain("/object/public/");
  });

  it("builds a bare bucket path against the project's storage, transformed", () => {
    const src = mediaSrc("build-media/nested/shot.png", { width: 900 });
    expect(src).toContain("/storage/v1/render/image/public/build-media/nested/shot.png");
    expect(src).toContain("width=900");
    expect(src).toContain("quality=");
  });

  it("leaves a third-party URL alone, since it cannot be asked to transform", () => {
    const src = mediaSrc("https://images.example.com/a.png", { width: 480 });
    expect(src).toBe("https://images.example.com/a.png");
  });

  it("refuses an opaque id rather than guessing a URL or querying for it", () => {
    expect(mediaSrc("demo-media-triage-view-v2", { width: 480 })).toBeNull();
    expect(mediaSrc(undefined, { width: 480 })).toBeNull();
  });
});

describe("the generated media variant grid", () => {
  const generatedMediaType = makeType({
    key: "generated_media",
    label: "Generated media",
    category: "artefact",
    colour: "#F59E0B",
    renderer: "generated_media",
    schema: {
      fields: [
        { key: "prompt", label: "Prompt", type: "text", required: true },
        { key: "model", label: "Model", type: "string", required: true },
        {
          key: "variants",
          label: "Variants",
          type: "list",
          of: [
            { key: "media_id", label: "Media", type: "string", format: "media_id" },
            { key: "chosen", label: "Chosen", type: "boolean" },
            { key: "note", label: "Note", type: "string" },
          ],
        },
      ],
    },
  });

  it("marks the chosen variant with a teal border and dims the rest to 60%", () => {
    renderCard(
      makeNode({
        type: "generated_media",
        title: "Hero image",
        payload: {
          prompt: "A dark control room, teal accents.",
          model: "imagen-4",
          variants: [
            { media_id: "build-media/v1.png", chosen: false, note: "too busy" },
            { media_id: "build-media/v2.png", chosen: true, note: "kept" },
            { media_id: "build-media/v3.png", chosen: false },
          ],
        },
      }),
      generatedMediaType
    );

    const figures = Array.from(document.querySelectorAll("figure")) as HTMLElement[];
    expect(figures.length).toBe(3);

    const chosen = figures[1];
    expect(colourMatches(chosen.style.borderColor, "#2EC4B6")).toBe(true);
    expect(chosen.style.opacity).toBe("1");
    expect(within(chosen).getByText("chosen")).toBeTruthy();

    expect(figures[0].style.opacity).toBe("0.6");
    expect(figures[2].style.opacity).toBe("0.6");
    expect(colourMatches(figures[0].style.borderColor, "#2EC4B6")).toBe(false);
  });

  it("requests each variant thumbnail transformed rather than at original size", () => {
    renderCard(
      makeNode({
        type: "generated_media",
        title: "Hero image",
        payload: {
          prompt: "A dark control room.",
          model: "imagen-4",
          variants: [{ media_id: "build-media/v1.png", chosen: true }],
        },
      }),
      generatedMediaType
    );

    const image = document.querySelector("img") as HTMLImageElement;
    expect(image).toBeTruthy();
    expect(image.getAttribute("src")).toContain("/render/image/public/");
    expect(image.getAttribute("src")).toContain("width=240");
    expect(image.getAttribute("loading")).toBe("lazy");
  });
});

// --- media resolved from the page's one query (NS-P12) -----------------------
//
// A renderer never looks a media id up. The page loads build_media once and
// passes resolveMedia down; these assert what the renderers then do with it —
// the element each kind produces, the width each slot asks for, and what a
// reference that has lost its row renders as.

describe("media resolved through resolveMedia", () => {
  const screenshotType = makeType({
    key: "screenshot",
    label: "Screenshot",
    category: "evidence",
    colour: "#2EC4B6",
    renderer: "evidence",
    schema: {
      fields: [
        { key: "media_id", label: "Media", type: "string", format: "media_id", required: true },
        { key: "caption", label: "Caption", type: "string" },
      ],
    },
  });

  const recordingType = makeType({
    key: "recording",
    label: "Recording",
    category: "evidence",
    colour: "#2EC4B6",
    renderer: "evidence",
    schema: {
      fields: [
        { key: "media_id", label: "Media", type: "string", format: "media_id", required: true },
        { key: "caption", label: "Caption", type: "string" },
      ],
    },
  });

  const generatedMediaType = makeType({
    key: "generated_media",
    label: "Generated media",
    category: "artefact",
    colour: "#F59E0B",
    renderer: "generated_media",
    schema: {
      fields: [
        { key: "prompt", label: "Prompt", type: "text", required: true },
        {
          key: "variants",
          label: "Variants",
          type: "list",
          of: [
            { key: "media_id", label: "Media", type: "string", format: "media_id" },
            { key: "chosen", label: "Chosen", type: "boolean" },
          ],
        },
      ],
    },
  });

  beforeEach(() => {
    signedMediaUrl.mockClear();
  });

  it("renders a screenshot at the in-tree width, never at original size", async () => {
    const media = makeMedia({ id: "media-1", path: "b/n/shot.png" });
    renderCard(
      makeNode({ type: "screenshot", payload: { media_id: "media-1", caption: "The queue" } }),
      screenshotType,
      (id) => (id === "media-1" ? media : null)
    );

    const image = (await screen.findByRole("img")) as HTMLImageElement;
    expect(image.getAttribute("src")).toContain("width=640");
    expect(image.getAttribute("src")).toContain("/render/image/");
    expect(image.getAttribute("src")).not.toContain("/object/");
    expect(signedMediaUrl).toHaveBeenCalledWith(
      expect.objectContaining({ path: "b/n/shot.png" }),
      { width: 640 }
    );
    expect(screen.getByText("The queue")).toBeInTheDocument();
  });

  it("renders a recording as a video with its poster, controls and no preload", async () => {
    const media = makeMedia({
      id: "media-2",
      kind: "video",
      mime: "video/mp4",
      path: "b/n/demo.mp4",
      poster_path: "b/n/demo.png",
    });
    renderCard(
      makeNode({ type: "recording", payload: { media_id: "media-2" } }),
      recordingType,
      (id) => (id === "media-2" ? media : null)
    );

    await waitFor(() => expect(document.querySelector("video")).toBeTruthy());
    const video = document.querySelector("video") as HTMLVideoElement;
    expect(video.getAttribute("preload")).toBe("none");
    expect(video.hasAttribute("controls")).toBe(true);
    // The poster is signed as an image, so it carries the transform too.
    await waitFor(() =>
      expect(video.getAttribute("poster")).toContain("b/n/demo.png")
    );
  });

  it("renders audio as a plain audio element", async () => {
    const media = makeMedia({
      id: "media-3",
      kind: "audio",
      mime: "audio/mpeg",
      path: "b/n/voice.mp3",
    });
    renderCard(
      makeNode({ type: "recording", payload: { media_id: "media-3" } }),
      recordingType,
      (id) => (id === "media-3" ? media : null)
    );

    await waitFor(() => expect(document.querySelector("audio")).toBeTruthy());
    expect(document.querySelector("img")).toBeNull();
  });

  it("says media unavailable rather than leaving a broken image", async () => {
    renderCard(
      makeNode({ type: "screenshot", payload: { media_id: "5f8c2b1e-0000-4000-8000-000000000001" } }),
      screenshotType,
      // Loaded, and this id is not in it.
      () => null
    );

    expect(await screen.findByText(/media unavailable/i)).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("holds the slot rather than crying unavailable while media is loading", () => {
    renderCard(
      makeNode({ type: "screenshot", payload: { media_id: "5f8c2b1e-0000-4000-8000-000000000001" } }),
      screenshotType,
      // Not loaded yet: nothing is known about this id.
      () => undefined
    );

    expect(screen.queryByText(/media unavailable/i)).not.toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("requests a variant grid cell at the grid's width, not the card's", async () => {
    const media = makeMedia({ id: "media-4", path: "b/n/v1.png" });
    renderCard(
      makeNode({
        type: "generated_media",
        payload: {
          prompt: "A dark control room.",
          variants: [{ media_id: "media-4", chosen: true }],
        },
      }),
      generatedMediaType,
      (id) => (id === "media-4" ? media : null)
    );

    const image = (await screen.findByRole("img")) as HTMLImageElement;
    expect(image.getAttribute("src")).toContain("width=240");
    expect(signedMediaUrl).toHaveBeenCalledWith(
      expect.objectContaining({ path: "b/n/v1.png" }),
      { width: 240 }
    );
  });
});
