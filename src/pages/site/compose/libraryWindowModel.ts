/* SV-18: what the window shows for the reader's saved items, worked out from the items, the place and the counts. Pure.

   Nothing is searched: what fits is a lookup (`fitsPlace`), the counts and the makers are Maps. The reader's items arrive as
   one list; a row is made only for an item that fits where the maker is adding. */

import { fitWords, fitsPlace, copyNoun, makerIdOf, missingKindWords, type LibraryPlace } from "@/lib/build/fromLibrary";
import { shortDate } from "@/lib/build/readerSteps";
import { modelLabel } from "@/lib/models/registry";
import type { LibrarySavedItem } from "@/lib/library/savedItems";
import type { SourceStatus } from "@/lib/library/sourceVersions";

import type { LibraryTab, LibraryWindowRow } from "./AddFromLibraryWindow";

type Record_ = Record<string, unknown>;
const record = (value: unknown): Record_ => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record_) : {});
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export const buildsWord = (count: number): string => `${count} ${count === 1 ? "build" : "builds"}`;

/** Where the tile or session is being added, in the head: "Session 2 · Clean-up agent". */
export const placeLabel = (place: LibraryPlace): string => place.name;

/** The title of a saved item: its own, else the first words of its text. */
export function savedTitle(item: Pick<LibrarySavedItem, "snapshot" | "kind">): string {
  const snap = item.snapshot;
  const prompts = Array.isArray(snap.prompts) ? (snap.prompts as { text?: unknown }[]) : [];
  const first = text(prompts[0]?.text) || text(record(snap.payload).text) || text(record(snap.payload).system_prompt);
  return text(snap.title) || first.split(/\s+/).slice(0, 8).join(" ") || "Untitled";
}

const KIND_WORD: Record<string, string> = { step: "Step", part: "Part", session: "Session" };

/** The word before the build: the tile's type ("Prompt", "Agent"), else the kind. */
function typeWord(item: Pick<LibrarySavedItem, "kind" | "snapshot">): string {
  if (item.kind === "session") return "Session";
  const noun = copyNoun(item);
  return noun ? noun[0].toUpperCase() + noun.slice(1) : KIND_WORD[item.kind];
}

export interface RowFacts {
  usedIn: ReadonlyMap<string, number>;
  /** Maker id → handle, without the @. */
  handles: ReadonlyMap<string, string>;
  /** Item id → what became of its source (SV-19). Absent while it loads or for a kind with no tile source: reads as Same. */
  sources?: ReadonlyMap<string, SourceStatus>;
}

/** "Prompt · Call notes that write themselves · @maya · Opus 5.5 · used in 4 builds". */
export function detailOf(item: LibrarySavedItem, facts: RowFacts): string {
  const snap = item.snapshot;
  const source = record(snap.source);
  const maker = makerIdOf(item);
  const handle = maker ? facts.handles.get(maker) : undefined;
  const model = modelLabel(text(snap.model) || text(record(snap.payload).model));
  const used = facts.usedIn.get(item.id) ?? 0;
  const prompts = Array.isArray(snap.prompts) ? snap.prompts.length : 0;
  return [typeWord(item), text(source.buildTitle), handle ? `@${handle}` : "", model, prompts ? `${prompts} ${prompts === 1 ? "prompt" : "prompts"}` : "", used > 0 ? `used in ${buildsWord(used)}` : "not used yet"].filter(Boolean).join(" · ");
}

/** The rows for these items at this place, in the order given (the reader's own: last used first). */
export function rowsFor(items: readonly LibrarySavedItem[], place: LibraryPlace, facts: RowFacts): { rows: LibraryWindowRow[]; byId: Map<string, LibrarySavedItem> } {
  const byId = new Map<string, LibrarySavedItem>();
  const rows: LibraryWindowRow[] = [];
  for (const item of items) {
    if (!fitsPlace(place, item)) continue;
    byId.set(item.id, item);
    const source = facts.sources?.get(item.id);
    rows.push({
      id: item.id,
      title: savedTitle(item),
      state: source?.state ?? "same",
      detail: detailOf(item, facts),
      savedOn: shortDate(item.savedAt) ?? "",
      currentOn: source?.state === "edited" ? shortDate(source.version) : null,
    });
  }
  return { rows, byId };
}

/** The footer for one item: what it is copied as, who is credited, and what their item will show. */
export function footerFor(item: LibrarySavedItem, facts: RowFacts, copierId: string | null): string {
  const lead = `Copied as a new ${copyNoun(item)} with its source.`;
  const maker = makerIdOf(item);
  const handle = maker ? facts.handles.get(maker) : undefined;
  if (!maker || !handle || maker === copierId) return lead;
  const used = (facts.usedIn.get(item.id) ?? 0) + 1;
  return `${lead} @${handle} is credited on the tile, and their ${item.kind === "session" ? "session" : item.kind === "part" ? "part" : "step"} will show used in ${buildsWord(used)}.`;
}

export interface CollectionFacts {
  id: string;
  name: string;
  /** Saved-item ids in it, in order. */
  itemIds: readonly string[];
}

/** The collections that have at least one item fitting here; the row says how many do. A collection with none is not listed. */
export function collectionRows(collections: readonly CollectionFacts[], byKept: ReadonlyMap<string, LibrarySavedItem>, place: LibraryPlace): { rows: LibraryWindowRow[]; items: Map<string, LibrarySavedItem[]> } {
  const items = new Map<string, LibrarySavedItem[]>();
  const rows: LibraryWindowRow[] = [];
  for (const collection of collections) {
    const fitting = collection.itemIds.flatMap((id) => {
      const item = byKept.get(id);
      return item && fitsPlace(place, item) ? [item] : [];
    });
    if (fitting.length === 0) continue;
    items.set(collection.id, fitting);
    const hidden = collection.itemIds.length - fitting.length;
    rows.push({ id: collection.id, title: collection.name, state: "same", detail: `${fitting.length} ${fitting.length === 1 ? "item fits" : "items fit"} here${hidden > 0 ? ` · ${hidden} ${hidden === 1 ? "does not" : "do not"}` : ""}`, savedOn: "", currentOn: null });
  }
  return { rows, items };
}

export const COLLECTION_FOOTER = "Copied in order, each as a new tile with its source. Their makers are credited on the tiles.";

export { fitWords, missingKindWords };
export type { LibraryTab };
