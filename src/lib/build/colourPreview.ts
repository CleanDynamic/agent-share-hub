// colourPreview: a colour drawn before it is saved (CA-06 P5). PURE.
//
// While the colour picker is open every change shows at once on the tile, the session and the post's links. The
// page draws its steps and sessions through `previewColours`, which lays the picker's colour over what is saved;
// Cancel drops the preview and the saved colour is back. A session's "Also colour its tiles that have no colour"
// previews (and, on Done, writes) only the tiles `uncolouredTiles` names: one with a colour of its own keeps it.

import { groupKey, type SessionGroup, type Step } from "./graph";
import { parseRefTo } from "./thread";

export interface ColourPreview {
  /** The part, as a link's `to`. */
  to: string;
  colour: string | null;
  /** A session's picker: its uncoloured tiles take the colour too. A part's (CA-17): its uncoloured sessions do. */
  alsoTiles: boolean;
}

const isInstructions = (step: Pick<Step, "id">) => step.id.endsWith(":instructions");

/** A step and everything inside it that is a part: an agent's prompts, a team's agents, the tiles sent with it. */
function everyTile(step: Step): Step[] {
  return [step, ...[...step.children.filter((child) => !isInstructions(child)), ...(step.sentWith ?? [])].flatMap(everyTile)];
}

/** The ids of a session's tiles, and of every tile inside them, that have no colour of their own. */
export function uncolouredTiles(steps: readonly Step[], group: Pick<SessionGroup, "stepNumbers">): string[] {
  return steps
    .filter((step) => group.stepNumbers.includes(step.number))
    .flatMap(everyTile)
    .filter((step) => !step.colour)
    .map((step) => step.id);
}

function recolour(steps: readonly Step[], ids: ReadonlySet<string>, colour: string | null): Step[] {
  return steps.map((step) => {
    const children = step.children.length ? recolour(step.children, ids, colour) : step.children;
    const sentWith = step.sentWith ? recolour(step.sentWith, ids, colour) : step.sentWith;
    const next: Step = { ...step, children, ...(sentWith ? { sentWith } : null) };
    if (ids.has(step.id)) {
      if (colour) next.colour = colour;
      else delete next.colour;
    }
    return next;
  });
}

/** CA-17 P5: the keys of a part's sessions that have no colour of their own, for "Also colour its sessions that have no colour". */
export function uncolouredSessions(groups: readonly SessionGroup[], keys: readonly string[]): string[] {
  const own = new Set(keys);
  return groups.filter((group) => own.has(groupKey(group)) && !group.colour).map((group) => groupKey(group));
}

/**
 * CA-17 P5: `builds.making` with a part's previewed colour laid over its `workstreams` entry. Anything else is returned as
 * it is. The part's head, the map and the post's links all read the parts from `making`, so they draw the preview too.
 */
export function previewWorkstreams(making: unknown, preview: ColourPreview | null): unknown {
  const target = preview ? parseRefTo(preview.to) : null;
  if (!preview || target?.kind !== "workstream" || !making || typeof making !== "object") return making;
  const list = (making as { workstreams?: unknown }).workstreams;
  if (!Array.isArray(list)) return making;
  const next = list.map((entry) => {
    if (!entry || typeof entry !== "object" || (entry as { key?: unknown }).key !== target.id) return entry;
    const copy = { ...(entry as Record<string, unknown>) };
    if (preview.colour) copy.colour = preview.colour;
    else delete copy.colour;
    return copy;
  });
  return { ...(making as object), workstreams: next };
}

/**
 * The steps and sessions with the picker's colour laid over them; as they are when there is no preview. `partSessions` names
 * the sessions of a part (CA-17), for a part's picker with "Also colour its sessions that have no colour".
 */
export function previewColours(steps: Step[], groups: SessionGroup[], preview: ColourPreview | null, partSessions?: (workstream: string) => readonly string[]): { steps: Step[]; groups: SessionGroup[] } {
  const target = preview ? parseRefTo(preview.to) : null;
  if (!preview || !target) return { steps, groups };
  if (target.kind === "workstream") {
    if (!preview.alsoTiles || !preview.colour || !partSessions) return { steps, groups };
    const keys = new Set(uncolouredSessions(groups, partSessions(target.id)));
    return keys.size ? { steps, groups: groups.map((group) => (keys.has(groupKey(group)) ? { ...group, colour: preview.colour as string } : group)) } : { steps, groups };
  }
  if (target.kind === "node") return { steps: recolour(steps, new Set([target.id]), preview.colour), groups };
  const group = groups.find((candidate) => groupKey(candidate) === target.id);
  if (!group) return { steps, groups };
  const nextGroups = groups.map((candidate) => {
    if (candidate !== group) return candidate;
    const next = { ...candidate };
    if (preview.colour) next.colour = preview.colour;
    else delete next.colour;
    return next;
  });
  const tiles = preview.alsoTiles && preview.colour ? new Set(uncolouredTiles(steps, group)) : new Set<string>();
  return { steps: tiles.size ? recolour(steps, tiles, preview.colour) : steps, groups: nextGroups };
}
