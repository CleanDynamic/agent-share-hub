// gridSteps: the step a post's pictures come from, and their descriptions, as the composer names them (CA-07 P6).
//
// Pure. A grid's `step` is "node:<build_nodes id>". The picker lists the build's tiles numbered as the build page
// numbers them (postRefs' groups, sessions left out); a step since deleted reads as no step, and is cleared from what
// is saved the next time the maker saves.

import type { RefEntry, RefGroup } from "./postRefs";
import { gridStepOf, type ThreadBlock, type ThreadDoc } from "./thread";

/** Every sentence the row under the grid, and the readers' line, say. */
export const GRID_LINKS_COPY = {
  link: "Link a step",
  linked: (entry: Pick<RefEntry, "number" | "title">) => `Linked to step ${stepName(entry)}`,
  notLinked: "Not linked",
  from: (entry: Pick<RefEntry, "number" | "title">) => `From step ${stepName(entry)}`,
  describe: "Add description",
  describeMany: "Add descriptions",
  described: "Description added",
} as const;

/** "4.2 Build agent". */
export function stepName(entry: Pick<RefEntry, "number" | "title">): string {
  return `${entry.number} ${entry.title}`.trim();
}

/** The picker's groups with only the build's tiles: a picture comes from a step, not a whole session. */
export function stepGroupsOf(groups: readonly RefGroup[]): RefGroup[] {
  return groups
    .map((group) => ({ ...group, entries: group.entries.filter((entry) => entry.to.startsWith("node:")) }))
    .filter((group) => group.entries.length > 0);
}

/** The step a grid is linked to, while it is still in the build; else null. */
export function linkedStep(step: unknown, lookup: ReadonlyMap<string, RefEntry> | null | undefined): RefEntry | null {
  const to = gridStepOf({ attrs: { step } });
  return to && lookup ? (lookup.get(to) ?? null) : null;
}

/** What Add description reads: one picture, several with some still to describe, or every one described. */
export function descriptionLabel(alts: readonly string[]): string {
  if (alts.length > 0 && alts.every((alt) => alt.trim())) return GRID_LINKS_COPY.described;
  return alts.length > 1 ? GRID_LINKS_COPY.describeMany : GRID_LINKS_COPY.describe;
}

/** The first picture with no description, or the first picture. */
export function firstUndescribed(alts: readonly string[]): number {
  const at = alts.findIndex((alt) => !alt.trim());
  return at < 0 ? 0 : at;
}

/** The thread with every grid's step that is no longer in the build cleared; the same object when there is none. */
export function withoutGoneSteps(doc: ThreadDoc, lookup: ReadonlyMap<string, RefEntry>): ThreadDoc {
  let changed = false;
  const content = doc.content.map((block): ThreadBlock => {
    if (block.type !== "postMediaGrid" || block.attrs?.step == null || linkedStep(block.attrs.step, lookup)) return block;
    changed = true;
    return { ...block, attrs: { ...block.attrs, step: null } };
  });
  return changed ? { ...doc, content } : doc;
}
