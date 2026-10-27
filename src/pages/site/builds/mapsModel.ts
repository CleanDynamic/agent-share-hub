/* SV-12: from a build's Map to what a card draws. PURE.

   NO SECOND LAYOUT. Every place comes from the composer's own `layoutSessionMap` (the stage a session is in, the place it
   takes in its part, the parts one under another or side by side). This turns that layout's px into the well's 400 x 220
   and keeps the boxes at the board's size: places are scaled, boxes are not, so the type stays 11 and 10. Places close up
   to the least that leaves a gap between boxes; a Map still larger than the well is drawn at that size and the well
   scrolls (`width` and `height` say how large), so no session is left out.

   Lines leave a box at the middle of the edge the layout chose, shifted by the layout's own spread where several meet
   one edge, and are drawn as the board draws them: a cubic that leaves one edge straight and arrives straight. Numbers
   are rounded to one decimal. */

import type { BuildsTableBuild } from "@/lib/build/gallery";
import type { BuildMap } from "@/lib/build/buildsMaps";
import { layoutSessionMap, type Edge, type MapSession, type SessionMapLayout, type SessionMapModel } from "@/lib/build/sessionMap";

import { BOX_H, BOX_W, WELL_H, WELL_W, type MapCardView, type MapDrawing, type MapLineView, type MapsDirection } from "./BuildsMapsView";
import { tableRow } from "./buildsModel";

/** The board's margins inside the well, and how far from the bottom and the right a box may reach. */
const LEFT = 16;
const TOP = 14;
const EDGE = 4;
/** The board's pitch between columns and between stacked sessions, and the least that keeps a gap between boxes. */
const COLUMN = 138;
const COLUMN_MIN = BOX_W + 12;
const ROW = 52;
const ROW_MIN = BOX_H + 6;

const EMPTY: MapDrawing = { width: WELL_W, height: WELL_H, boxes: [], lines: [], parts: [] };

/** One decimal, for `rendering-svg-precision`. */
const round1 = (value: number): number => Math.round(value * 10) / 10;

/** The scale that makes `span` of the layout reach `ideal` px, or less when `room` is all there is, and never below `least`. */
const fit = (span: number, ideal: number, room: number, least: number): number => (span <= 0 ? ideal : Math.max(least, Math.min(ideal, room / span)));

/** "claude-opus-5-5" is OPUS, "gpt-5" is GPT-5; a model that names none falls back to the app. */
export function modelWord(session: Pick<MapSession, "model" | "app">): string {
  const raw = (session.model ?? session.app ?? "").trim().toLowerCase();
  if (!raw) return "";
  const family = /(opus|sonnet|haiku|fable)/.exec(raw);
  if (family) return family[1].toUpperCase();
  const gpt = /^gpt-?[\w.]*/.exec(raw);
  if (gpt) return gpt[0].replace(/^gpt-?/, "GPT-").toUpperCase();
  return raw.replace(/^claude[-\s]*/, "").split(/[\s/]/)[0].slice(0, 10).toUpperCase();
}

/** "S1 Transcribe": the number the composer shows, then the maker's title, else the app. */
export const boxLabel = (session: Pick<MapSession, "number" | "title" | "app">): string => `S${session.number} ${session.title?.trim() || session.app || "Session"}`;

const partLabelOf = (model: SessionMapModel, key: string, label: string): string => {
  const name = model.parts.find((part) => part.key === key)?.name?.trim();
  return (name ? `${label} · ${name}` : label).toUpperCase();
};

interface Placed {
  key: string;
  x: number;
  y: number;
}

/** The point on a placed box where an edge's line meets it, shifted by `along` (the layout's spread). */
function edgePoint(box: Placed, edge: Edge, along: number): { x: number; y: number } {
  if (edge === "right") return { x: box.x + BOX_W, y: box.y + BOX_H / 2 + along };
  if (edge === "left") return { x: box.x, y: box.y + BOX_H / 2 + along };
  if (edge === "bottom") return { x: box.x + BOX_W / 2 + along, y: box.y + BOX_H };
  return { x: box.x + BOX_W / 2 + along, y: box.y };
}

const clamp = (value: number, least: number, most: number): number => Math.max(least, Math.min(most, value));

function pathOf(a: { x: number; y: number }, b: { x: number; y: number }, along: "x" | "y"): string {
  const [x1, y1, x2, y2] = [round1(a.x), round1(a.y), round1(b.x), round1(b.y)];
  if (along === "x") {
    if (x2 < x1) return `M${x1} ${y1} L${x2} ${y2}`;
    const mx = round1((x1 + x2) / 2);
    return `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
  }
  if (y2 < y1) return `M${x1} ${y1} L${x2} ${y2}`;
  const my = round1((y1 + y2) / 2);
  return `M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}`;
}

/** One direction of a build's Map as the well draws it. */
export function drawingOf(model: SessionMapModel, layout: SessionMapLayout): MapDrawing {
  const sessions = new Map(model.sessions.map((session) => [session.key, session]));
  const horizontal = layout.direction === "horizontal";
  const labelled = model.hasParts;
  const boxes = layout.boxes;
  const minX = Math.min(...boxes.map((box) => box.x));
  const maxX = Math.max(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxY = Math.max(...boxes.map((box) => box.y));
  // Where the first thing is drawn: a part label at the top, else the first row (centred when the Map has one part).
  const top = labelled ? Math.min(...layout.partLabels.map((label) => label.y)) : minY;

  /* The layout's px to the well's: columns (horizontal) or sessions side by side (vertical) go sideways, stages
     (vertical) or stacked sessions and parts (horizontal) go down. */
  const ideal = horizontal ? { x: COLUMN / 190, y: ROW / 50 } : { x: 110 / 184, y: ROW / 90 };
  const sx = fit(maxX - minX, ideal.x, WELL_W - LEFT * 2 - BOX_W, horizontal ? COLUMN_MIN / 190 : COLUMN_MIN / 184);
  const sy = fit(maxY - top, ideal.y, WELL_H - TOP - BOX_H - EDGE * 2, horizontal ? ROW_MIN / 50 : ROW_MIN / 90);
  const contentH = (maxY - top) * sy + BOX_H;
  const y0 = labelled ? TOP : Math.max(TOP, (WELL_H - contentH) / 2);
  const toX = (x: number): number => LEFT + (x - minX) * sx;
  const toY = (y: number): number => y0 + (y - top) * sy;

  const placed = new Map<string, Placed>();
  const kept: MapDrawing["boxes"][number][] = [];
  for (const box of boxes) {
    const session = sessions.get(box.key);
    if (!session) continue;
    const x = round1(toX(box.x));
    const y = round1(toY(box.y));
    placed.set(box.key, { key: box.key, x, y });
    kept.push({ key: box.key, x, y, label: boxLabel(session), meta: `${modelWord(session)}${modelWord(session) ? " · " : ""}${session.tiles}` });
  }

  const byKey = new Map(boxes.map((box) => [box.key, box]));
  const lines: MapLineView[] = [];
  for (const line of layout.lines) {
    const a = placed.get(line.from);
    const b = placed.get(line.to);
    const [layoutA, layoutB] = [byKey.get(line.from), byKey.get(line.to)];
    if (!a || !b || !layoutA || !layoutB) continue;
    const sideways = line.fromEdge === "left" || line.fromEdge === "right";
    const spread = (edge: Edge, box: typeof layoutA, x: number, y: number): number =>
      edge === "left" || edge === "right" ? clamp((y - (box.y + box.h / 2)) * sy, -(BOX_H / 2 - 5), BOX_H / 2 - 5) : clamp((x - (box.x + box.w / 2)) * sx, -(BOX_W / 2 - 8), BOX_W / 2 - 8);
    const from = edgePoint(a, line.fromEdge, spread(line.fromEdge, layoutA, line.x1, line.y1));
    const to = edgePoint(b, line.toEdge, spread(line.toEdge, layoutB, line.x2, line.y2));
    lines.push({ id: line.id, d: pathOf(from, to, sideways ? "x" : "y") });
  }

  const parts = labelled
    ? layout.partLabels.map((label) => ({
        key: label.key,
        x: round1(toX(label.x)),
        y: round1(toY(label.y)),
        label: partLabelOf(model, label.key, label.label),
      }))
    : [];
  const right = Math.max(...kept.map((box) => box.x + BOX_W));
  const bottom = Math.max(...kept.map((box) => box.y + BOX_H));
  return { width: Math.max(WELL_W, round1(right + LEFT)), height: Math.max(WELL_H, round1(bottom + TOP)), boxes: kept, lines, parts };
}

const plural = (n: number, one: string): string => `${n} ${n === 1 ? one : `${one}s`}`;

/** The Map in words: the sessions, then who uses whom. */
export function mapWords(title: string, model: SessionMapModel | null): string {
  if (!model) return `${title}: no sessions yet.`;
  const number = new Map(model.sessions.map((session) => [session.key, session.number]));
  const named = model.sessions.map((session) => boxLabel(session)).join(", ");
  const uses = model.links
    .map((link) => [number.get(link.from) ?? 0, number.get(link.session) ?? 0] as const)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([from, session]) => `S${from} to S${session}`)
    .join(", ");
  return `Map of ${title}: ${plural(model.sessions.length, "session")}, ${named}.${uses ? ` Lines: ${uses}.` : " No lines."}`;
}

export const mapSummary = (model: SessionMapModel | null): string => {
  if (!model) return "No sessions";
  const parts = model.parts.length > 1 ? `${plural(model.parts.length, "part")} · ` : "";
  return `${parts}${plural(model.sessions.length, "session")}`;
};

/** One card from the Table's build and its Map (null while it is still being read, or when it has none). */
export function cardOf(build: BuildsTableBuild, map: BuildMap | undefined, now: number): MapCardView {
  const row = tableRow(build, now);
  const model = map?.model ?? null;
  const drawings = !map
    ? null
    : model
      ? { horizontal: drawingOf(model, layoutSessionMap(model, "horizontal")), vertical: drawingOf(model, layoutSessionMap(model, "vertical")) }
      : { horizontal: EMPTY, vertical: EMPTY };
  return {
    id: row.id,
    href: row.href,
    title: row.title,
    maker: build.maker?.handle ?? null,
    summary: mapSummary(model),
    reproduced: `${row.reproductions} reproduced`,
    lit: row.lit,
    sessions: model?.sessions.length ?? 0,
    words: mapWords(row.title, model),
    drawings,
  };
}

export type { MapsDirection };
