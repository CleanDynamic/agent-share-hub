// The checklist, in the compose right rail beneath the inspector.
//
// WHAT THIS PANEL IS NOT. It is not a mark, a rating or a verdict on the person
// who wrote the record. Every row is an instruction the creator can act on, and
// every row that is already done says what did it. The percentage is here
// because a checklist with a progress bar is a checklist — twelve of twenty
// boxes ticked is a state, not a judgement — and it never appears as a mark out
// of ten, a letter, or anything with an opinion in it.
//
// The rules are NS-P17's and stay there. This file reads SHAPE_RULES for the
// order of the list and computeCompleteness for which of them are outstanding;
// it holds no weights and decides nothing about what a shape needs. What it
// adds is the second half of each row — the label a ticked item reads under,
// and what in the record satisfied it — because `missing` is a list of what is
// absent and a checklist has to show both halves.
//
// EVERY ROW GOES SOMEWHERE. A row a creator cannot act on is a complaint, so a
// header field opens its own editor here and takes focus, a node that exists is
// selected in the tree, and a node that does not is created and handed to the
// inspector. Nothing in this panel points at a thing the creator then has to go
// and find.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  SHAPE_RULES,
  type Build,
  type BuildPatch,
  type BuildShape,
  type Completeness,
  type NodeCategory,
  type NodeTree,
  type NodeType,
  type RequirementKey,
} from "@/lib/build";
import {
  HAIRLINE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  bodyText,
  hexToRgba,
  labelText,
} from "@/components/build/tokens";
import {
  blurControl,
  controlStyle,
  focusControl,
  helpStyle,
} from "@/components/compose/fields";

/** Longest satisfied-by summary before it is cut. Rows are one line each. */
const SUMMARY_MAX = 72;

/**
 * What a row reads under once it is ticked.
 *
 * Not the same sentence as the instruction: "add what it costs to run" is
 * something to do, and a row that is done should read as a fact about the
 * record rather than as an order already obeyed.
 */
const DONE_LABEL: Record<RequirementKey, string> = {
  outcome: "what this does for someone",
  instruction_or_artefact: "the thing someone would run",
  evidence: "evidence that it worked",
  made_for: "who it is for",
  made_with: "what it was made with",
  cost: "what it costs to run",
  time_to_first_result: "how long to a first result",
  prerequisite: "what to have in place first",
  link: "where to find it",
  comparison: "the comparison behind the finding",
  dataset: "the dataset itself",
};

/** The requirements satisfied by a builds column rather than by a node. */
const FIELD_KEYS = new Set<RequirementKey>([
  "outcome",
  "made_for",
  "made_with",
  "cost",
  "time_to_first_result",
  "link",
]);

interface FlatNode {
  node: NodeTree;
  category: NodeCategory | undefined;
}

/**
 * Every placed node, with its category, MINUS the gaps.
 *
 * The exclusion mirrors computeCompleteness exactly. A gap is the creator
 * writing down that a part is missing, and a checklist that answered "what
 * satisfied this?" with the admission that nothing did would be worse than
 * saying nothing.
 */
function flattenPlaced(tree: NodeTree[], nodeTypes: NodeType[]): FlatNode[] {
  const categoryOf = new Map(
    nodeTypes.map((type) => [type.key, type.category as NodeCategory])
  );
  const out: FlatNode[] = [];
  const walk = (nodes: NodeTree[]) => {
    for (const node of nodes) {
      if (!node.is_gap) out.push({ node, category: categoryOf.get(node.type) });
      walk(node.children ?? []);
    }
  };
  walk(tree);
  return out;
}

/** The node that satisfied a node-shaped requirement, or null. */
function satisfyingNode(
  key: RequirementKey,
  placed: FlatNode[]
): NodeTree | null {
  const first = (predicate: (entry: FlatNode) => boolean) =>
    placed.find(predicate)?.node ?? null;

  switch (key) {
    case "instruction_or_artefact":
      return first(
        (entry) => entry.category === "instruction" || entry.category === "artefact"
      );
    case "evidence":
      return first((entry) => entry.category === "evidence");
    case "prerequisite":
      return first((entry) => entry.node.type === "prerequisite");
    case "comparison":
      return first(
        (entry) =>
          entry.node.type === "comparison_table" || entry.node.type === "eval_run"
      );
    case "dataset":
      return first((entry) => entry.node.type === "dataset");
    default:
      return null;
  }
}

/**
 * The type to create when a node-shaped requirement has nothing satisfying it.
 *
 * Read out of the registry rather than hardcoded, so a type retired in
 * node_types stops being offered here without a code change. Where the rule
 * names a type — prerequisite, dataset, comparison_table — this asks for that
 * type by key, because that is the same thing the rule tests for.
 */
function typeToAdd(key: RequirementKey, nodeTypes: NodeType[]): string | null {
  const active = nodeTypes.filter((type) => type.is_active);
  const byKey = (wanted: string) =>
    active.find((type) => type.key === wanted)?.key ?? null;
  const byCategory = (category: string) =>
    [...active]
      .filter((type) => type.category === category)
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))[0]?.key ?? null;

  switch (key) {
    case "instruction_or_artefact":
      return byCategory("instruction") ?? byCategory("artefact");
    case "evidence":
      return byCategory("evidence");
    case "prerequisite":
      return byKey("prerequisite");
    case "comparison":
      return byKey("comparison_table") ?? byKey("eval_run");
    case "dataset":
      return byKey("dataset");
    default:
      return null;
  }
}

function money(amount: number, currency: string | null): string {
  const code = (currency ?? "GBP").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${code}`;
  }
}

function truncate(value: string): string {
  const text = value.trim();
  return text.length > SUMMARY_MAX ? `${text.slice(0, SUMMARY_MAX - 1)}…` : text;
}

/** What in the record ticked this row. Null when the row is not ticked. */
function satisfiedBy(
  key: RequirementKey,
  build: Build,
  placed: FlatNode[],
  typesByKey: Map<string, NodeType>
): string | null {
  switch (key) {
    case "outcome":
      return build.outcome ? truncate(build.outcome) : null;
    case "made_for":
      return (build.made_for ?? []).join(", ") || null;
    case "made_with":
      return (build.made_with ?? []).join(", ") || null;
    case "cost": {
      const parts: string[] = [];
      if (typeof build.cost_setup === "number") {
        parts.push(`${money(build.cost_setup, build.currency)} to set up`);
      }
      if (typeof build.cost_monthly === "number") {
        parts.push(`${money(build.cost_monthly, build.currency)} a month`);
      }
      return parts.join(", ") || null;
    }
    case "time_to_first_result":
      return typeof build.time_to_first_result === "number"
        ? `${build.time_to_first_result} minutes`
        : null;
    case "link":
      return build.live_url || build.repo_url || null;
    default: {
      const node = satisfyingNode(key, placed);
      if (!node) return null;
      const label = typesByKey.get(node.type)?.label ?? node.type;
      return truncate(node.title ? `${label} — ${node.title}` : label);
    }
  }
}

/** "founder, solo dev" -> ["founder", "solo dev"]. Blanks are not entries. */
function splitList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/** "" -> null, so a cleared number field means unstated rather than zero. */
function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

const tickBase: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: 4,
  flexShrink: 0,
  marginTop: 2,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 10,
  lineHeight: 1,
};

export interface CompletenessPanelProps {
  build: Build;
  completeness: Completeness | null;
  tree: NodeTree[];
  nodeTypes: NodeType[];
  onPatch: (patch: BuildPatch) => void;
  /** Selects a node, which is what puts it in the inspector. */
  onSelectNode: (nodeId: string) => void;
  /** Appends a node of this type and selects it. The tree's own add. */
  onAddNode: (typeKey: string) => void;
}

export function CompletenessPanel({
  build,
  completeness,
  tree,
  nodeTypes,
  onPatch,
  onSelectNode,
  onAddNode,
}: CompletenessPanelProps) {
  const [open, setOpen] = useState(true);
  /** The requirement whose editor is showing, if any. */
  const [openField, setOpenField] = useState<RequirementKey | null>(null);
  /**
   * Raw text for the fields that store something other than text.
   *
   * A list column joined back with ", " swallows the comma the moment it is
   * typed, and a number column re-rendered from Number() eats the decimal
   * point. So the input shows what was typed and the column takes what it
   * parses to.
   */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const fieldRef = useRef<HTMLElement | null>(null);

  // A different build is a different record: its columns are not this one's.
  useEffect(() => {
    setDrafts({});
    setOpenField(null);
  }, [build.id]);

  // Opening a row is a request to type into it, so the editor takes focus as
  // soon as it exists rather than leaving the creator to click twice.
  useEffect(() => {
    if (openField && fieldRef.current) fieldRef.current.focus();
  }, [openField]);

  const placed = useMemo(() => flattenPlaced(tree, nodeTypes), [tree, nodeTypes]);
  const typesByKey = useMemo(
    () => new Map(nodeTypes.map((type) => [type.key, type])),
    [nodeTypes]
  );

  const rows = useMemo(() => {
    if (!completeness) return [];
    const missing = new Map(completeness.missing.map((item) => [item.key, item.copy]));
    const rules = SHAPE_RULES[build.shape as BuildShape] ?? SHAPE_RULES.other;
    return rules.map((rule) => ({
      key: rule.key,
      met: !missing.has(rule.key),
      copy: missing.get(rule.key) ?? DONE_LABEL[rule.key],
      done: satisfiedBy(rule.key, build, placed, typesByKey),
    }));
  }, [build, completeness, placed, typesByKey]);

  const draft = useCallback(
    (column: string, stored: string) => drafts[column] ?? stored,
    [drafts]
  );

  const write = useCallback(
    (column: string, raw: string, patch: BuildPatch) => {
      setDrafts((current) => ({ ...current, [column]: raw }));
      onPatch(patch);
    },
    [onPatch]
  );

  /**
   * A row was clicked. Put the creator in front of the thing that would tick it.
   *
   * Three outcomes, in the order the row can be in: a header field opens its
   * editor here; a node that already exists is selected and scrolled to; a node
   * that does not exist yet is created and handed to the inspector.
   */
  const act = useCallback(
    (key: RequirementKey) => {
      if (FIELD_KEYS.has(key)) {
        setOpenField((current) => (current === key ? null : key));
        return;
      }

      const node = satisfyingNode(key, placed);
      if (node) {
        onSelectNode(node.id);
        const row = document.querySelector(`[data-node-id="${node.id}"]`);
        if (row && typeof row.scrollIntoView === "function") {
          row.scrollIntoView({ block: "center" });
        }
        return;
      }

      const typeKey = typeToAdd(key, nodeTypes);
      if (typeKey) onAddNode(typeKey);
    },
    [nodeTypes, onAddNode, onSelectNode, placed]
  );

  if (!completeness) return null;

  const filled = completeness.score;
  const left = completeness.missing.length;

  return (
    <section
      data-visual-slot="compose-completeness"
      aria-label="What this record still needs"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 18,
        borderTop: `1px solid ${HAIRLINE}`,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        style={{
          ...labelText,
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: 0,
          background: "transparent",
          border: "none",
          textTransform: "uppercase",
          color: TEXT_SECONDARY,
          cursor: "pointer",
        }}
      >
        {open ? (
          <ChevronDown size={12} aria-hidden />
        ) : (
          <ChevronRight size={12} aria-hidden />
        )}
        The record
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={filled}
          aria-label="How much of this record is filled in"
          style={{
            height: 4,
            borderRadius: 4,
            background: "rgba(255,255,255,0.06)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${filled}%`,
              height: "100%",
              background: TEAL,
              transition: "width 200ms ease",
            }}
          />
        </div>
        <span style={{ ...labelText, fontSize: 11, color: TEXT_SECONDARY }}>
          {filled}% filled in
          {left > 0 ? ` · ${left === 1 ? "1 thing" : `${left} things`} left` : ""}
        </span>
      </div>

      {open ? (
        <>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {rows.map((row) => (
              <li key={row.key} style={{ margin: 0, padding: 0 }}>
                <button
                  type="button"
                  // The one handle every requirement is addressable by. The
                  // publish sheet's checklist routes a row here rather than
                  // carrying a second copy of what each one should do.
                  data-requirement={row.key}
                  onClick={() => act(row.key)}
                  aria-expanded={FIELD_KEYS.has(row.key) ? openField === row.key : undefined}
                  style={{
                    ...bodyText,
                    fontFamily: "inherit",
                    width: "100%",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    textAlign: "left",
                    padding: "6px 6px",
                    borderRadius: 8,
                    background:
                      openField === row.key ? "rgba(255,255,255,0.04)" : "transparent",
                    border: "1px solid transparent",
                    color: row.met ? TEXT_SECONDARY : TEXT_PRIMARY,
                    cursor: "pointer",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      ...tickBase,
                      background: row.met ? hexToRgba(TEAL, 0.18) : "transparent",
                      border: `1px solid ${row.met ? hexToRgba(TEAL, 0.5) : "rgba(255,255,255,0.14)"}`,
                      color: TEAL,
                    }}
                  >
                    {row.met ? "✓" : ""}
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span>{row.copy}</span>
                    {row.met && row.done ? (
                      <span style={{ ...helpStyle, color: TEXT_MUTED }}>{row.done}</span>
                    ) : null}
                  </span>
                </button>

                {openField === row.key ? (
                  <div style={{ padding: "4px 6px 10px 28px" }}>
                    <FieldEditor
                      requirement={row.key}
                      build={build}
                      draft={draft}
                      write={write}
                      onPatch={onPatch}
                      firstRef={fieldRef}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          {/* The consequence, said once and said straight. */}
          <p style={{ ...bodyText, margin: 0, fontSize: 12, color: TEXT_MUTED }}>
            Everything you publish is live, searchable and forkable. The gallery
            asks for a bit more.
          </p>
        </>
      ) : null}
    </section>
  );
}

interface FieldEditorProps {
  requirement: RequirementKey;
  build: Build;
  draft: (column: string, stored: string) => string;
  write: (column: string, raw: string, patch: BuildPatch) => void;
  onPatch: (patch: BuildPatch) => void;
  firstRef: React.MutableRefObject<HTMLElement | null>;
}

function Labelled({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...labelText, fontSize: 11, color: TEXT_SECONDARY }}>{text}</span>
      {children}
    </label>
  );
}

/**
 * The builds column behind one row, edited where the row is.
 *
 * These columns have no other editor in the workspace: the top bar owns title
 * and shape, the inspector owns nodes, and everything else about the header is
 * asked for here, at the moment the checklist says it is missing.
 */
function FieldEditor({
  requirement,
  build,
  draft,
  write,
  onPatch,
  firstRef,
}: FieldEditorProps) {
  const stack: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  };

  switch (requirement) {
    case "outcome":
      return (
        <div style={stack}>
          <Labelled text="The one line">
            <textarea
              ref={(element) => {
                firstRef.current = element;
              }}
              rows={2}
              value={build.outcome ?? ""}
              placeholder="Sorts a full inbox into three piles in under a minute."
              onChange={(event) =>
                onPatch({ outcome: event.target.value === "" ? null : event.target.value })
              }
              onFocus={(event) => focusControl(event.currentTarget)}
              onBlur={(event) => blurControl(event.currentTarget)}
              style={{ ...controlStyle, minHeight: 52, resize: "vertical", display: "block" }}
            />
          </Labelled>
        </div>
      );

    case "made_for":
    case "made_with": {
      const column = requirement;
      const stored = (build[column] ?? []).join(", ");
      return (
        <div style={stack}>
          <Labelled
            text={requirement === "made_for" ? "Who it is for" : "Models and tools"}
          >
            <input
              ref={(element) => {
                firstRef.current = element;
              }}
              type="text"
              value={draft(column, stored)}
              placeholder={
                requirement === "made_for"
                  ? "founders, solo developers"
                  : "Claude Opus 4.5, Supabase"
              }
              onChange={(event) =>
                write(column, event.target.value, {
                  [column]: splitList(event.target.value),
                } as BuildPatch)
              }
              onFocus={(event) => focusControl(event.currentTarget)}
              onBlur={(event) => blurControl(event.currentTarget)}
              style={controlStyle}
            />
          </Labelled>
          <span style={{ ...helpStyle, color: TEXT_MUTED }}>Separate them with commas.</span>
        </div>
      );
    }

    case "cost":
      return (
        <div style={stack}>
          <Labelled text={`To set up (${build.currency ?? "GBP"})`}>
            <input
              ref={(element) => {
                firstRef.current = element;
              }}
              type="number"
              inputMode="decimal"
              value={draft("cost_setup", build.cost_setup?.toString() ?? "")}
              placeholder="0"
              onChange={(event) =>
                write("cost_setup", event.target.value, {
                  cost_setup: parseNumber(event.target.value),
                })
              }
              onFocus={(event) => focusControl(event.currentTarget)}
              onBlur={(event) => blurControl(event.currentTarget)}
              style={controlStyle}
            />
          </Labelled>
          <Labelled text={`A month (${build.currency ?? "GBP"})`}>
            <input
              type="number"
              inputMode="decimal"
              value={draft("cost_monthly", build.cost_monthly?.toString() ?? "")}
              placeholder="18.40"
              onChange={(event) =>
                write("cost_monthly", event.target.value, {
                  cost_monthly: parseNumber(event.target.value),
                })
              }
              onFocus={(event) => focusControl(event.currentTarget)}
              onBlur={(event) => blurControl(event.currentTarget)}
              style={controlStyle}
            />
          </Labelled>
          <span style={{ ...helpStyle, color: TEXT_MUTED }}>
            Zero is an answer. Blank is not.
          </span>
        </div>
      );

    case "time_to_first_result":
      return (
        <div style={stack}>
          <Labelled text="Minutes to a first result">
            <input
              ref={(element) => {
                firstRef.current = element;
              }}
              type="number"
              inputMode="numeric"
              value={draft(
                "time_to_first_result",
                build.time_to_first_result?.toString() ?? ""
              )}
              placeholder="35"
              onChange={(event) =>
                write("time_to_first_result", event.target.value, {
                  time_to_first_result: parseNumber(event.target.value),
                })
              }
              onFocus={(event) => focusControl(event.currentTarget)}
              onBlur={(event) => blurControl(event.currentTarget)}
              style={controlStyle}
            />
          </Labelled>
        </div>
      );

    case "link":
      return (
        <div style={stack}>
          <Labelled text="The live thing">
            <input
              ref={(element) => {
                firstRef.current = element;
              }}
              type="url"
              value={build.live_url ?? ""}
              placeholder="https://"
              onChange={(event) =>
                onPatch({ live_url: event.target.value === "" ? null : event.target.value })
              }
              onFocus={(event) => focusControl(event.currentTarget)}
              onBlur={(event) => blurControl(event.currentTarget)}
              style={controlStyle}
            />
          </Labelled>
          <Labelled text="The repository">
            <input
              type="url"
              value={build.repo_url ?? ""}
              placeholder="https://github.com/"
              onChange={(event) =>
                onPatch({ repo_url: event.target.value === "" ? null : event.target.value })
              }
              onFocus={(event) => focusControl(event.currentTarget)}
              onBlur={(event) => blurControl(event.currentTarget)}
              style={controlStyle}
            />
          </Labelled>
          <span style={{ ...helpStyle, color: TEXT_MUTED }}>Either one ticks this.</span>
        </div>
      );

    default:
      return null;
  }
}

export default CompletenessPanel;
