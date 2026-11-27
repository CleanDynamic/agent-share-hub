// MS-02, MS-03: test support for the map sandbox's pure modules: layout builders, the measure `01-finished-map.png` was
// drawn with, and the support inbox and 50-tile layouts built by hand (MS-05's `startFromBuild` doesn't exist yet).

import { mapSandboxFixture } from "@/dev/fixtures/mapSandbox";

import { MAP_WIDTH, type Measure } from "./mapGeometry";
import type { MapBox, MapLayout, MapNode, MapRegion, MapSplit } from "./mapLayout";

/* ── builders ── */

export const box = (id: string, tiles: string[] = [], over: Partial<MapBox> = {}): MapBox => ({ kind: "box", id, tiles, layout: "stack", indent: {}, show: {}, notes: {}, ...over });
export const split = (id: string, dir: MapSplit["dir"], children: MapNode[], sizes?: number[]): MapSplit => ({
  kind: "split",
  id,
  dir,
  sizes: sizes ?? children.map(() => (dir === "across" ? 1 / children.length : 0)),
  children,
});
export const region = (id: string, of: MapRegion["of"], child: MapNode, over: Partial<MapRegion> = {}): MapRegion => ({ kind: "region", id, of, child, ...over });
export const layout = (root: MapNode, over: Partial<MapLayout> = {}): MapLayout => ({
  v: 1,
  width: 960,
  background: "grey",
  dotGrid: true,
  numbers: "build",
  root,
  outlines: [],
  twoWay: [],
  twoWayDismissed: [],
  hiddenLinks: [],
  linkGutters: {},
  ...over,
});

/* ── the measure `01-finished-map.png` was drawn with ── */

export const HEIGHTS: Record<string, number> = { prompt: 113, file: 118, tool: 118, agent: 140, code: 145, check: 148, result: 118 };
export const PROMPT_WITH_SETTINGS = 220;
export const MIN_TILE = 200;
export const HEAD = 48;
export const NOTE_WIDTH = 200;

export function measureFor(name: "supportInbox" | "fiftyTiles"): Measure {
  const fixture = mapSandboxFixture(name);
  const kinds = new Map<string, string>(fixture.steps.map((step) => [step.id, step.kind]));
  fixture.results.forEach((result) => kinds.set(result.id, "result"));
  return {
    tile: (id, _width, parts) => {
      const kind = kinds.get(id) ?? "prompt";
      return { height: kind === "prompt" && parts.includes("settings") ? PROMPT_WITH_SETTINGS : HEIGHTS[kind] ?? HEIGHTS.prompt, minWidth: MIN_TILE };
    },
    chrome: (node) => ({ head: node.kind === "box" ? HEAD : 0, noteWidth: NOTE_WIDTH }),
  };
}
export const INBOX = measureFor("supportInbox");

/** The support inbox's plain arrangement: Part A with S1 and S2 side by side, Part B with S3 above the Result. */
export const inbox = (over: Partial<MapLayout> = {}) =>
  layout(
    split("m-root", "down", [
      region("m-a", { part: "ws-a" }, split("m-a-row", "across", [box("m-s1", ["p1", "f2", "p3"]), box("m-s2", ["p4", "c5", "k6"])])),
      region("m-b", { part: "ws-b" }, split("m-b-col", "down", [box("m-s3", ["a7", "t8"], { layout: "across" }), box("m-result", ["r9"])])),
    ]),
    over,
  );

/** The same without frames, so the leaves and gutters alone fill the canvas. */
export const inboxBare = (over: Partial<MapLayout> = {}) =>
  layout(
    split("m-root", "down", [
      split("m-a-row", "across", [box("m-s1", ["p1", "f2", "p3"]), box("m-s2", ["p4", "c5", "k6"])]),
      box("m-s3", ["a7", "t8"], { layout: "across" }),
      box("m-result", ["r9"]),
    ]),
    over,
  );

/** The 50-tile build: one frame per part, sessions that ran beside the one above them side by side, the Result last. */
export function fiftyLayout(width: number = MAP_WIDTH.standard): MapLayout {
  const fixture = mapSandboxFixture("fiftyTiles");
  const meta = fixture.making.sessions_meta as Record<string, { workstream: string; withAbove?: boolean }>;
  const keys = fixture.making.session_order as string[];
  const tilesOf = (key: string) => fixture.steps.filter((step) => step.session === key).map((step) => step.id);
  const parts: MapNode[] = [];
  for (const part of ["ws-a", "ws-b", "ws-c"]) {
    const rows: MapNode[][] = [];
    keys.filter((key) => meta[key].workstream === part).forEach((key) => {
      const made = box(`m-${key}`, tilesOf(key));
      if (meta[key].withAbove && rows.length) rows[rows.length - 1].push(made);
      else rows.push([made]);
    });
    const kids = rows.map((row, at) => (row.length === 1 ? row[0] : split(`m-${part}-row${at}`, "across", row)));
    parts.push(region(`m-${part}`, { part }, kids.length === 1 ? kids[0] : split(`m-${part}-col`, "down", kids)));
  }
  parts.push(box("m-result", fixture.results.map((result) => result.id)));
  return layout(split("m-root", "down", parts), { width });
}
