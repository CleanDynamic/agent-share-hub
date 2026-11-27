// MS-05: the plain arrangement a map starts from. PURE.
//
// When `making.map_layout` is absent the composer and the build page both draw this, worked out on every render, and it is
// written only once the maker changes something (README Decision 4). So its ids are made from the build's keys, never
// random: the same build gives the same layout on every render.
//
// One region per part, stacked in the parts' order (none when the build has one part). Inside each part, one session region
// per session holding one box of its top-level tiles in build order; sessions that ran side by side (the same stage, from
// `stagesOf` through `sessionMapFor`) sit in one `across` split, the stages stack. A Result gets a full-width box at the end
// of its part, inside its session's region when that keeps the region a rectangle.
//
// LEGACY SESSIONS (`typed-legacy-<n>`) work here like any session: their keys are only ever read, and `startFromBuild` is
// only stored once the maker edits (MS-06). MS-06 must then key a legacy session's region by its first tile's id instead,
// because a `typed-legacy-<n>` key is never written (`graph.ts` refuses it).

import { groupKey, type SessionGroup, type Step } from "./graph";
import { MAP_WIDTH } from "./mapGeometry";
import type { MapBox, MapLayout, MapNode, MapRegion, MapSplit } from "./mapLayout";
import { sessionMapFor } from "./sessionMap";

/** What a Result needs here: its id and the number of the step it came from (`ListResult`). */
export type StartResult = { id: string; from: string | null };

const box = (id: string, tiles: string[]): MapBox => ({ kind: "box", id, tiles, layout: "stack", indent: {}, show: {}, notes: {} });
const split = (id: string, dir: MapSplit["dir"], children: MapNode[]): MapNode =>
  children.length === 1 ? children[0] : { kind: "split", id, dir, sizes: children.map(() => (dir === "across" ? 1 / children.length : 0)), children };
const region = (id: string, of: MapRegion["of"], child: MapNode): MapRegion => ({ kind: "region", id, of, child });

/** The plain arrangement of a build: valid, readable, and the same on every render. */
export function startFromBuild(steps: readonly Step[], groups: readonly SessionGroup[], making: unknown, results: readonly StartResult[] = []): MapLayout {
  const model = sessionMapFor({ groups, steps, making });
  const keyOfNumber = new Map<string, string>();
  const implicit: string[] = [];
  for (const group of groups) {
    for (const number of group.stepNumbers) {
      if (group.implicit) implicit.push(number);
      else keyOfNumber.set(number, groupKey(group));
    }
  }
  const tilesOf = new Map<string, string[]>();
  const implicitTiles: string[] = [];
  for (const step of steps) {
    if (implicit.includes(step.number)) implicitTiles.push(step.id);
    const key = keyOfNumber.get(step.number);
    if (key) tilesOf.set(key, [...(tilesOf.get(key) ?? []), step.id]);
  }

  // Results by the session of the step each came from; a Result whose step has no session goes at the very end.
  const resultsOf = new Map<string, string[]>();
  const loose: string[] = [];
  for (const result of results) {
    const key = result.from ? keyOfNumber.get(result.from) : undefined;
    if (key && tilesOf.has(key)) resultsOf.set(key, [...(resultsOf.get(key) ?? []), result.id]);
    else loose.push(result.id);
  }

  const outlines: string[] = [];
  const sessionNode = (key: string, withResults: boolean): MapNode => {
    const tiles = box(`m-box-${key}`, tilesOf.get(key) ?? []);
    const extra = withResults ? (resultsOf.get(key) ?? []).map((id) => box(`m-result-${id}`, [id])) : [];
    return region(`m-session-${key}`, { session: key }, split(`m-session-${key}-col`, "down", [tiles, ...extra]));
  };

  /** One part's rows: a run of sessions in one stage side by side, the stages stacked, then any Result that couldn't go in its session's region. */
  const rowsOf = (partKey: string, sessions: readonly string[]): MapNode[] => {
    const placed = sessions.filter((key) => tilesOf.has(key));
    const runs: string[][] = [];
    for (const key of placed) {
      const last = runs[runs.length - 1];
      if (last && model.stages.stageOf[last[0]] === model.stages.stageOf[key]) last.push(key);
      else runs.push([key]);
    }
    const after: MapNode[] = [];
    const rows = runs.map((run, at) => {
      const alone = run.length === 1 && at === runs.length - 1;
      const kids = run.map((key) => {
        if (resultsOf.has(key) && !alone) {
          // The Result's full-width box would leave its session region not a rectangle: it goes after the rows, and the session is outlined.
          outlines.push(key);
          after.push(...(resultsOf.get(key) ?? []).map((id) => box(`m-result-${id}`, [id])));
        }
        return sessionNode(key, alone);
      });
      return split(`m-${partKey}-row-${at}`, "across", kids);
    });
    return [...rows, ...after];
  };

  const top: MapNode[] = [];
  if (implicitTiles.length) top.push(box("m-box-implicit", implicitTiles));
  if (model.hasParts) {
    for (const part of model.parts) {
      const rows = rowsOf(part.key, part.sessions);
      if (rows.length) top.push(region(`m-part-${part.key}`, { part: part.key }, split(`m-part-${part.key}-rows`, "down", rows)));
    }
  } else {
    top.push(...rowsOf("build", model.parts.flatMap((part) => part.sessions)));
  }
  top.push(...loose.map((id) => box(`m-result-${id}`, [id])));

  return {
    v: 1,
    width: MAP_WIDTH.standard,
    background: "grey",
    dotGrid: false,
    numbers: "build",
    root: top.length ? split("m-root", "down", top) : box("m-box-empty", []),
    outlines,
    twoWay: [],
    twoWayDismissed: [],
    hiddenLinks: [],
    linkGutters: {},
  };
}
