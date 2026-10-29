// CA-17 P2: what the List needs to know about the build's parts, worked out from `making` and the session groups. PURE.
//
// With fewer than two parts there is nothing to draw, and `listPartsOf` says so by returning null.

import { groupKey, shownGroups, type SessionGroup } from "@/lib/build/graph";
import { partLabelsOf, sessionsMetaOf, type PartLabels } from "@/lib/build/making";
import { nameColourFor } from "@/lib/theme/partColour";
import type { ThemeKey } from "@/lib/theme/resolve";
import { t } from "@/lib/theme/tokens";
import { startsAfterChoices, workstreamLabel, workstreamTitle, workstreamsOf, type WorkstreamGroup } from "@/lib/build/workstreams";

import type { ListPart } from "./BuildList";
import { NO_APP } from "./sourcesModel";

/** "Session 2 · Build the portal": a session as a menu names it. */
export function sessionChoiceLabel(group: Pick<SessionGroup, "number" | "title" | "tool">): string {
  const rest = group.title || (group.tool && group.tool !== NO_APP ? group.tool : "");
  return rest ? `Session ${group.number} · ${rest}` : `Session ${group.number}`;
}

export interface PartsModel {
  /** The parts as the List draws them. */
  list: ListPart[];
  /** Part key to "Part B · Support agent". */
  titles: Map<string, string>;
  /** Session key to the key of its part. */
  partOf: Map<string, string>;
  /** The sessions that share the stage of the session above. */
  withAbove: Set<string>;
  groups: WorkstreamGroup[];
  labels: PartLabels;
}

/** The build's parts for the List, or null when it has fewer than two. */
export function listPartsOf(making: unknown, sessionGroupsList: readonly SessionGroup[], theme: ThemeKey): PartsModel | null {
  const shown = shownGroups(sessionGroupsList);
  const order = shown.map((group) => groupKey(group));
  const groups = workstreamsOf(making, order);
  if (groups.length < 2) return null;
  const labels = partLabelsOf(making);
  const meta = sessionsMetaOf(making);
  const byKey = new Map(shown.map((group) => [groupKey(group), group]));
  const partOf = new Map(groups.flatMap((part) => part.sessions.map((key) => [key, part.key] as const)));
  const titles = new Map(groups.map((part) => [part.key, workstreamTitle(part, part.index, labels)]));
  const withAbove = new Set(order.filter((key) => meta[key]?.withAbove));
  const list: ListPart[] = groups.map((part) => {
    const after = part.startsAfter ? byKey.get(part.startsAfter) : undefined;
    const afterPart = part.startsAfter ? groups.find((other) => other.sessions.includes(part.startsAfter as string)) : undefined;
    return {
      title: titles.get(part.key) as string,
      sessions: part.sessions,
      startsAfterChoices: startsAfterChoices(part.key, groups).flatMap((key) => {
        const group = byKey.get(key);
        return group ? [{ key, label: sessionChoiceLabel(group) }] : [];
      }),
      view: {
        key: part.key,
        label: workstreamLabel(part.index, labels),
        name: part.name,
        colour: part.colour,
        nameColour: part.colour ? nameColourFor(part.colour, theme) : t.text,
        sessions: part.sessions.length,
        collapsed: Boolean(part.collapsed),
        startsAfter: part.startsAfter,
        ...(part.open ? { open: part.open.problem } : null),
        startsAfterLine: after && afterPart ? `${workstreamLabel(afterPart.index, labels)} · Session ${after.number}` : undefined,
      },
    };
  });
  return { list, titles, partOf, withAbove, groups, labels };
}
