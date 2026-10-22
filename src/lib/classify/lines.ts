/* CA-16 P6 — the two lines a build's card carries under its summary, and the Regulated area tag.

   PURE. The Gallery card, the Classification Card's preview and the build page all read these, so they cannot disagree.
   A build with no classification gives empty lines, and its card shows nothing new (P9).

   LINE ONE (mono): the first two Tools and stack values joined with " + ", then What was built, Role of AI, Skill
   needed. At most four items; a value that is not set is left out.
   LINE TWO: the most specific Field label, the primary Task, the first Setting. */

import { regulatedArea, shownValues } from "./facets";
import { CUSTOM_PREFIX } from "./facets";
import { valueOf, type Facet } from "./taxonomy";
import { isCustomEntry, type Classification, type Entry } from "./types";

export interface CardLines {
  line1: string[];
  line2: string[];
  regulated: boolean;
}

/** The label for a stored id, or the maker's own text for a custom one. */
export function labelFor(facet: Facet, id: string): string {
  if (id.startsWith(CUSTOM_PREFIX)) return id.slice(CUSTOM_PREFIX.length);
  return valueOf(facet, id)?.label ?? id;
}

const entryLabel = (facet: Facet, entry: Entry): string => (isCustomEntry(entry) ? entry.custom : labelFor(facet, entry.id));

/** Every Tools and stack value a build shows, derived first and then the maker's own, without repeats. */
export function stackValuesOf(c: Classification): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of shownValues(c, "stack").values) {
    const label = labelFor("stack", id);
    if (!seen.has(label.toLowerCase())) {
      seen.add(label.toLowerCase());
      out.push(label);
    }
  }
  for (const entry of c.declared.stack) {
    const label = entryLabel("stack", entry);
    if (!seen.has(label.toLowerCase())) {
      seen.add(label.toLowerCase());
      out.push(label);
    }
  }
  return out;
}

export function classificationLines(c: Classification | null | undefined): CardLines {
  if (!c) return { line1: [], line2: [], regulated: false };
  const line1: string[] = [];
  const stack = stackValuesOf(c).slice(0, 2);
  if (stack.length > 0) line1.push(stack.join(" + "));
  for (const facet of ["built", "role", "skill"] as const) {
    const first = shownValues(c, facet).values[0];
    if (first) line1.push(labelFor(facet, first));
  }

  const line2: string[] = [];
  const field = c.declared.field[0];
  if (field) line2.push(entryLabel("field", field));
  const task = c.declared.task.find((entry) => entry.primary) ?? c.declared.task[0];
  if (task) line2.push(entryLabel("task", task));
  const setting = c.declared.setting[0];
  if (setting) line2.push(entryLabel("setting", setting));

  return { line1: line1.slice(0, 4), line2, regulated: regulatedArea(c) };
}

export const REGULATED_TAG = "Regulated area";
export const REGULATED_NOTICE = "This build works in a regulated area. Check the rules that apply to you before using it.";
