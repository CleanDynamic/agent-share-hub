/* SV-09: the Library vision board's sample data, as `LibraryView` takes it.

   Copied from the `<script type="text/x-dc">` block of `design/reference/vision/source/Library.dc.html` and the board's
   selected step and collection preview. DEV ONLY (the dev page `vision-library` and the view's tests). Every name,
   number and sentence is sample content. */

import type { DesignState } from "@/dev/useDesignTheme";
import type { LibraryViewProps } from "@/pages/site/library/LibraryView";
import { LIBRARY_KINDS, type CollectionEntry, type ItemState, type LibraryChange, type LibraryRow } from "@/pages/site/library/libraryModel";

const noop = () => undefined;

const KIND_COUNTS = [64, 18, 4, 9, 27, 3, 3];

export const visionLibraryCollections: CollectionEntry[] = [
  ["Sales prompts", "Public", 9],
  ["Agents to try", "Private", 6],
  ["Call tooling kit", "Private", 5],
  ["Best of Opus 5.5", "Public · @kit", 12],
  ["Research briefs", "Filter set", 21],
].map(([name, meta, count], index) => ({ id: `vc${index + 1}`, name: name as string, meta: meta as string, count: count as number }));

export const visionLibraryChanges: LibraryChange[] = [
  { id: "ch1", tag: "EDITED", item: "Summary on one prompt", detail: "1 line changed", age: "2d" },
  { id: "ch2", tag: "REMOVED", item: "Tone checker agent", detail: "build unpublished, your snapshot kept", age: "3d" },
  { id: "ch3", tag: "RUN", item: "Account research brief", detail: "worked on Opus 5.5 · @dax", age: "5h" },
  { id: "ch4", tag: "ANSWER", item: "Step 4 · Paywalled sources", detail: "@kit answered your saved request", age: "1d" },
];

const STATES: Record<string, ItemState> = { Same: "same", Edited: "edited", Removed: "removed", Stale: "stale" };

export const visionLibraryRows: LibraryRow[] = (
  [
    ["Summary on one prompt", "Step 7 · Call notes · @maya", "Prompt", "Edited", 4, "today"],
    ["Clean-up agent", "Session 2 · Call notes · @maya", "Agent", "Same", 3, "yesterday"],
    ["Search plan", "Step 2 · Research brief agent · @mira", "Prompt", "Same", 7, "3d ago"],
    ["Tone checker agent", "Step 3 · Cold email personaliser · @jay", "Agent", "Removed", 2, "1w ago"],
    ["Label list for triage", "Step 1 · Inbox triage · @kit", "Prompt", "Same", 19, "1w ago"],
    ["Lead score rubric", "Step 4 · Lead scoring · @luke", "Prompt", "Same", 5, "2w ago"],
    ["Objection classifier", "Step 2 · Objection coach · @ava", "Prompt", "Stale", 1, "1mo ago"],
  ] as const
).map(([title, detail, type, state, usedIn, lastUsed], index) => ({ id: `vr${index + 1}`, title, detail, type, state: STATES[state], usedIn, lastUsed }));

/** The view's props for a state; `?state=` on the dev page picks one. */
export function visionLibraryProps(state: DesignState = "populated"): LibraryViewProps {
  const status = state === "loading" ? "loading" : state === "error" ? "error" : "ready";
  const empty = state === "empty";
  return {
    head: { title: "Library", meta: empty ? "0 saved · 0 collections" : "64 saved · 5 collections" },
    kinds: {
      items: LIBRARY_KINDS.map((kind, index) => ({ ...kind, count: empty ? 0 : KIND_COUNTS[index], href: `?kind=${kind.value}` })),
      value: "steps",
      onChange: noop,
    },
    collections: {
      status,
      items: empty ? [] : visionLibraryCollections,
      current: null,
      hrefFor: (id) => `?collection=${id}`,
      onNew: noop,
      onRetry: noop,
      emptyLine: "No collections yet.",
    },
    changes:
      status === "ready" && !empty
        ? {
            figure: "6 changes",
            parts: [{ text: "Since your last visit" }, { text: "3 edited" }, { text: "1 removed", tone: "breakage" }, { text: "2 reproduced on Opus 5.5", tone: "evidence" }],
            to: "/notifications",
            rows: visionLibraryChanges,
          }
        : undefined,
    items: {
      tabs: [
        { value: "all", label: "Steps" },
        { value: "changed", label: "Changed" },
        { value: "removed", label: "Removed" },
      ],
      tab: "all",
      onTab: noop,
      controls: { filters: 2, sort: "Last used", onFilters: noop, onSort: noop },
      chips: [
        { name: "Step type", value: "Prompt, Agent", onRemove: noop },
        { name: "Field", value: "Sales", onRemove: noop },
      ],
      sameAsBuilds: true,
      status,
      what: "Steps didn't load.",
      onRetry: noop,
      empty: { line: "Save a step from any build and it waits for you here.", action: { label: "Browse builds", href: "/builds" } },
      itemColumn: "Step",
      rows: empty ? [] : visionLibraryRows,
      selected: "vr1",
      onSelect: noop,
    },
    selected:
      status === "ready" && !empty
        ? {
            kind: "step",
            id: "vr1",
            chip: "PROMPT",
            state: { text: "Edited 2d ago", tone: "lit" },
            title: "Summary on one prompt",
            source: "Step 7 · Call notes that write themselves · @maya",
            versions: {
              value: "saved",
              onChange: noop,
              saved: [
                { text: "Summarise the cleaned transcript in five sections: decisions, owners, dates, risks, next call." },
                { text: "Keep it under 200 words.", change: "removed" },
                { text: "Keep each section under 40 words. Quote the customer once.", change: "added" },
              ],
              current: [
                { text: "Summarise the cleaned transcript in five sections: decisions, owners, dates, risks, next call." },
                { text: "Keep each section under 40 words. Quote the customer once." },
              ],
              changed: "1 line changed since you saved it on 12 Oct",
            },
            rows: [
              { label: "Model", value: "Opus 5.5" },
              { label: "Source build", value: "6 reproduced", lamp: true },
              { label: "Used in", value: "4 builds · 1 yours" },
              { label: "In collections", value: "Sales prompts" },
            ],
            note: { value: "Good section split. Try with the call notes build.", onChange: noop },
            onUse: noop,
            onCopy: noop,
            openHref: "/builds",
          }
        : null,
    preview:
      status === "ready" && !empty
        ? {
            name: "Sales prompts",
            meta: "Public · 9 items · saved by 14 people",
            to: "?collection=vc1",
            status: "ready",
            rows: [
              { id: "p1", title: "Summary on one prompt", type: "Prompt" },
              { id: "p2", title: "Clean-up agent", type: "Agent" },
              { id: "p3", title: "Objection handling", type: "Session" },
            ],
            onStart: noop,
          }
        : undefined,
  };
}
