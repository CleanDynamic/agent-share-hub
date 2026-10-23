// CA-17 P4: the map of sessions. PURE.
//
// The map shows SESSIONS ONLY: one box each, its app's mark, its number and its title. No tiles. A line joins two sessions
// where a tile in one uses something from the other; however many tiles join them, one pair of sessions gets one line, and
// the tile-level sentences are kept for the panel ("Agent 9 reads Code 4").
//
// Two halves:
//   `tileLinksOf` / `sessionLinksOf`  which tiles use something from which, and what that makes between sessions;
//   `layoutSessionMap`                where every box, line, part label, divider and stage label goes, in a direction.
//
// Units are px in the map's own space; the view draws them as they are. In the horizontal map the origin is the top of
// the first part's label (or of the first box, when the build has one part) and the stage dividers rise 6 above it; in the
// vertical map it is the first row's top, and the strip rises 16 above it. `minY` says how far above the origin the
// drawing reaches.

import { groupKey, groupOfStep, shownGroups, stepTitle, type SessionGroup, type Step } from "./graph";
import { partLabelsOf, sessionsMetaOf, type PartLabels } from "./making";
import { REF_KIND } from "./postRefs";
import { dayLabel, stagesOf, stageDays, stagesRange, type StageInfo, type StagesResult } from "./stages";
import { workstreamLabel, workstreamsOf } from "./workstreams";

export const SESSION_MAP_SIZES = {
  boxW: 164,
  boxH: 38,
  /** Horizontal: columns 190 apart (a 26 gap), stacked sessions 50 apart. */
  columnPitch: 190,
  stackPitch: 50,
  /** Where the first row starts under a part's label. */
  labelToRow: 28,
  /** A part's dashed line sits this far under its last box; the next label this far under the line. */
  partLineBelow: 20,
  nextLabelBelow: 12,
  dividerAbove: 6,
  dividerBelow: 12,
  stripBelow: 26,
  stripH: 22,
  /** Vertical: rows 90 apart, a strip 72 wide, sessions side by side 184 apart. */
  rowPitch: 90,
  stripW: 72,
  stripAbove: 16,
  firstPartAfterStrip: 22,
  labelAboveRow: 46,
  sideBySide: 184,
  partLineAfter: 32,
  nextPartAfterLine: 30,
  dividerFromStrip: 12,
  /** Lines. */
  lineGap: 8,
  lineSpread: 14,
  lineWidth: 2.5,
  haloWidth: 9,
} as const;

const S = SESSION_MAP_SIZES;

export type MapDirection = "horizontal" | "vertical";

/* ── which tiles use something from which ── */

/** What one tile does with another. */
export type TileVerb = "uses" | "reads" | "calls" | "tests" | "runs after" | "is defined in";

export interface TileLink {
  /** The tile that uses something. */
  to: string;
  /** The tile it uses something from. */
  from: string;
  verb: TileVerb;
  /** "Agent 9 reads Code 4". */
  sentence: string;
  /** What it is that is used: a file's name, or the tile's own. */
  what: string;
}

/** A file or tool a build holds, as the old map drew them: `madeBy` is the tile that makes a file. */
export interface MapPieceLike {
  id: string;
  name: string;
  madeBy?: string | null;
}

const flat = (list: readonly Step[]): Step[] => list.flatMap((step) => [step, ...flat(step.children), ...flat(step.sentWith ?? [])]);

const kindWord = (step: Pick<Step, "kind">): string => REF_KIND[step.kind] ?? "Tile";
/** "Agent 9". A tile with no number ("File order-form.tsx") is named by its title. */
export const tileName = (step: Pick<Step, "kind" | "number" | "title" | "defaultTitle" | "filename">): string => `${kindWord(step)} ${step.number || step.filename || step.title || step.defaultTitle}`;

const whatOf = (step: Pick<Step, "kind" | "filename" | "title" | "defaultTitle">): string => (step.kind === "code" || step.kind === "file" ? (step.filename ?? step.title ?? step.defaultTitle) : (step.title ?? step.defaultTitle));

/**
 * Every connection between two tiles: uses (of another tile's output, a file a tile makes, or a tool), a code tile's call
 * to a decision, a tile that runs after a decision, a check that tests a tile, an agent defined in a code tile. Pure.
 */
export function tileLinksOf(steps: readonly Step[], files: readonly MapPieceLike[] = []): TileLink[] {
  const all = flat(steps);
  const byId = new Map(all.map((step) => [step.id, step]));
  const makerOf = new Map(files.flatMap((file) => (file.madeBy ? [[file.id, file.madeBy] as const] : [])));
  const nameOfFile = new Map(files.map((file) => [file.id, file.name]));
  const out: TileLink[] = [];
  const seen = new Set<string>();
  const add = (to: Step, fromId: string, verb: TileVerb, what?: string) => {
    const from = byId.get(fromId);
    if (!from || from.id === to.id) return;
    const key = `${to.id}>${from.id}:${verb}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ to: to.id, from: from.id, verb, sentence: `${tileName(to)} ${verb} ${tileName(from)}`, what: what ?? whatOf(from) });
  };
  for (const step of all) {
    for (const use of step.uses) {
      if (use.kind === "file") {
        const maker = makerOf.get(use.node_id);
        if (maker) add(step, maker, "reads", nameOfFile.get(use.node_id));
        else if (byId.has(use.node_id)) add(step, use.node_id, "reads");
      } else if (use.kind === "output") add(step, use.node_id, step.kind === "check" ? "tests" : "uses");
      else if (byId.has(use.node_id)) add(step, use.node_id, "uses");
    }
    // A Code tile's call to the Decision it calls: the code is the one that uses the decision.
    for (const id of step.decision?.calledFrom ?? []) {
      const code = byId.get(id);
      if (code) add(code, step.id, "calls");
    }
    if (step.runsWhen && byId.get(step.runsWhen.decision)) add(step, step.runsWhen.decision, "runs after");
    for (const id of step.definedIn ?? []) add(step, id, "is defined in");
  }
  return out;
}

/** The session of each tile: a tile inside another is in its top-level tile's session. */
export function sessionOfTiles(steps: readonly Step[], sessionOfTop: (top: Step) => string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  const note = (step: Step, session: string) => {
    out.set(step.id, session);
    step.children.forEach((child) => note(child, session));
    (step.sentWith ?? []).forEach((tile) => note(tile, session));
  };
  for (const top of steps) {
    const session = sessionOfTop(top);
    if (session) note(top, session);
  }
  return out;
}

/** One line of the map: the later session (`session`) uses something from the earlier one (`from`). */
export interface SessionLink {
  id: string;
  session: string;
  from: string;
  tiles: TileLink[];
}

/**
 * Tile links grouped by session pair, keeping only pairs whose two tiles are in different sessions. One pair of sessions
 * gets one link however many tiles join them; its `tiles` are the sentences.
 */
export function sessionLinksOf(links: readonly TileLink[], sessionOf: ReadonlyMap<string, string>): SessionLink[] {
  const out = new Map<string, SessionLink>();
  for (const link of links) {
    const session = sessionOf.get(link.to);
    const from = sessionOf.get(link.from);
    if (!session || !from || session === from) continue;
    const id = `${from}>${session}`;
    const found = out.get(id) ?? { id, session, from, tiles: [] };
    found.tiles.push(link);
    out.set(id, found);
  }
  return [...out.values()];
}

/* ── what the map is drawn from ── */

export interface MapSession {
  key: string;
  number: number;
  /** The app's name ("Claude"); null when none is chosen. */
  app: string | null;
  /** The maker's title; absent when none. */
  title?: string;
  /** The maker's colour for the session. */
  colour?: string;
  /** The key of its part. */
  part: string;
  /** Its day, "2026-10-09". */
  day?: string;
  /** How many tiles it holds. */
  tiles: number;
}

export interface MapPart {
  key: string;
  /** "Part B". */
  label: string;
  name?: string;
  colour?: string;
  index: number;
  sessions: string[];
  /** "Part A · Session 2". */
  startsAfterLine?: string;
}

/** A tile of a session, as the panel lists it under "In this session". */
export interface MapTile {
  id: string;
  /** "3", or "" for a tile with no number. */
  number: string;
  title: string;
  /** "Prompt", "Code". */
  kind: string;
}

export interface SessionMapModel {
  sessions: MapSession[];
  /** The top-level tiles of each session, by key. */
  tiles: Record<string, MapTile[]>;
  parts: MapPart[];
  /** Two or more parts: part labels and dividers are drawn. */
  hasParts: boolean;
  stages: StagesResult;
  links: SessionLink[];
  labels: PartLabels;
}

/** Everything the layout needs from the build: the model, with its stages worked out. */
export function sessionMapModel(input: {
  sessions: readonly MapSession[];
  parts: readonly (Omit<MapPart, "sessions" | "label"> & { sessions: readonly string[]; startsAfter?: string })[];
  links: readonly SessionLink[];
  meta: Parameters<typeof stagesOf>[0]["meta"];
  labels: PartLabels;
  tiles?: Record<string, MapTile[]>;
}): SessionMapModel {
  const order = input.parts.flatMap((part) => part.sessions);
  const days = Object.fromEntries(input.sessions.map((session) => [session.key, session.day]));
  const stages = stagesOf({
    workstreams: input.parts.map((part) => ({ key: part.key, sessions: [...part.sessions], startsAfter: part.startsAfter })),
    order,
    meta: input.meta,
    uses: input.links.map((link) => ({ session: link.session, from: link.from })),
    days,
  });
  const parts: MapPart[] = input.parts.map((part) => ({ key: part.key, label: workstreamLabel(part.index, input.labels), name: part.name, colour: part.colour, index: part.index, sessions: [...part.sessions], startsAfterLine: part.startsAfterLine }));
  return { sessions: [...input.sessions], tiles: input.tiles ?? {}, parts, hasParts: input.parts.length >= 2, stages, links: [...input.links], labels: input.labels };
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

/**
 * The map of a build, from what the page already holds: the session groups, the top-level steps, the files and the
 * `making`. Sessions come in the order of the build; their parts, labels, stages and lines are worked out here.
 */
export function sessionMapFor(input: { groups: readonly SessionGroup[]; steps: readonly Step[]; files?: readonly MapPieceLike[]; making: unknown }): SessionMapModel {
  const shown = shownGroups(input.groups);
  const keys = shown.map((group) => groupKey(group));
  const parts = workstreamsOf(input.making, keys);
  const partOf = new Map(parts.flatMap((part) => part.sessions.map((key) => [key, part.key] as const)));
  const meta = sessionsMetaOf(input.making);
  const labels = partLabelsOf(input.making);
  const byKey = new Map(shown.map((group) => [groupKey(group), group]));
  const partIndexOf = new Map(parts.flatMap((part) => part.sessions.map((key) => [key, part.index] as const)));

  const sessions: MapSession[] = shown.map((group) => {
    const key = groupKey(group);
    const day = group.startedAt && ISO_DAY.test(group.startedAt) ? group.startedAt.slice(0, 10) : undefined;
    return { key, number: group.number, app: group.tool ?? null, title: group.title, colour: group.colour, part: partOf.get(key) ?? parts[0].key, day, tiles: group.stepNumbers.length };
  });

  const sessionOf = sessionOfTiles(input.steps, (top) => {
    const group = groupOfStep(shown, top);
    return group ? groupKey(group) : undefined;
  });
  const links = sessionLinksOf(tileLinksOf(input.steps, input.files ?? []), sessionOf);

  const tiles: Record<string, MapTile[]> = {};
  for (const top of input.steps) {
    const key = sessionOf.get(top.id);
    if (!key) continue;
    (tiles[key] ??= []).push({ id: top.id, number: top.number, title: stepTitle(top), kind: REF_KIND[top.kind] ?? "Tile" });
  }

  return sessionMapModel({
    sessions,
    tiles,
    parts: parts.map((part) => {
      const after = part.startsAfter ? byKey.get(part.startsAfter) : undefined;
      const afterIndex = part.startsAfter ? partIndexOf.get(part.startsAfter) : undefined;
      return {
        key: part.key,
        index: part.index,
        name: part.name,
        colour: part.colour,
        sessions: part.sessions,
        startsAfter: part.startsAfter,
        startsAfterLine: after && afterIndex !== undefined ? `${workstreamLabel(afterIndex, labels)} · Session ${after.number}` : undefined,
      };
    }),
    links,
    meta,
    labels,
  });
}

/* ── the layout ── */

export interface MapBoxPos {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  stage: number;
  part: string;
}

export interface MapLinePos {
  id: string;
  /** The earlier session's key, and the later one's. */
  from: string;
  to: string;
  /** The curve, as an SVG path. */
  d: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** The edges it meets: right to left horizontally, bottom to top vertically; the nearest edges within one stage. */
  fromEdge: Edge;
  toEdge: Edge;
}

export type Edge = "left" | "right" | "top" | "bottom";

export interface MapPartLabelPos {
  key: string;
  x: number;
  y: number;
  label: string;
  /** "4 sessions", or "Starts after Part A · Session 2". */
  note: string;
}

export interface MapDividerPos {
  id: string;
  kind: "stage" | "part";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface MapStageLabelPos {
  stage: number;
  x: number;
  y: number;
  /** "STAGE 3 · 9 OCT" (horizontal); in the vertical strip the two lines. */
  text: string;
  line1: string;
  line2: string;
}

export interface SessionMapLayout {
  direction: MapDirection;
  /** The drawing reaches this far above the origin (negative). */
  minY: number;
  width: number;
  /** The bottom edge of the lowest thing, from the origin. */
  height: number;
  boxes: MapBoxPos[];
  lines: MapLinePos[];
  partLabels: MapPartLabelPos[];
  dividers: MapDividerPos[];
  strip: { x: number; y: number; w: number; h: number };
  stageLabels: MapStageLabelPos[];
}

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/** The count under a part's label, or what it starts after. */
export const partNote = (part: Pick<MapPart, "sessions" | "startsAfterLine">): string => (part.startsAfterLine ? `Starts after ${part.startsAfterLine}` : plural(part.sessions.length, "session"));

/** "STAGE 3 · 9 OCT", capitals; the date is left off when the stage has none. */
export function stageText(stage: Pick<StageInfo, "number" | "date">): string {
  const day = dayLabel(stage.date);
  return day ? `STAGE ${stage.number} · ${day.toUpperCase()}` : `STAGE ${stage.number}`;
}

interface Slot {
  stage: number;
  slot: number;
}

/** The place each session takes in its part: its stage, and how many sessions of the part share that stage above it. */
function slotsOf(model: SessionMapModel): Map<string, Slot> {
  const out = new Map<string, Slot>();
  for (const part of model.parts) {
    const used = new Map<number, number>();
    for (const key of part.sessions) {
      const stage = model.stages.stageOf[key] ?? 1;
      const slot = used.get(stage) ?? 0;
      used.set(stage, slot + 1);
      out.set(key, { stage, slot });
    }
  }
  return out;
}

const mid = (n: number) => n / 2;

/** Where a line leaves or meets a box: the edge, 8 off it, at the box's middle plus the spread. */
function pointOn(box: MapBoxPos, edge: Edge, offset: number, gap: number): { x: number; y: number } {
  if (edge === "right") return { x: box.x + box.w + gap, y: box.y + mid(box.h) + offset };
  if (edge === "left") return { x: box.x - gap, y: box.y + mid(box.h) + offset };
  if (edge === "bottom") return { x: box.x + mid(box.w) + offset, y: box.y + box.h + gap };
  return { x: box.x + mid(box.w) + offset, y: box.y - gap };
}

/** The line between two boxes, as a cubic that leaves one edge straight and arrives at the other straight. */
function curve(a: { x: number; y: number }, b: { x: number; y: number }, along: "x" | "y"): string {
  if (along === "x") {
    const k = Math.max(Math.abs(b.x - a.x) / 2, 4) * (b.x >= a.x ? 1 : -1);
    return `M ${a.x} ${a.y} C ${a.x + k} ${a.y}, ${b.x - k} ${b.y}, ${b.x} ${b.y}`;
  }
  const k = Math.max(Math.abs(b.y - a.y) / 2, 4) * (b.y >= a.y ? 1 : -1);
  return `M ${a.x} ${a.y} C ${a.x} ${a.y + k}, ${b.x} ${b.y - k}, ${b.x} ${b.y}`;
}

/** The gap a line keeps from a box: 8, less when the two faces are so close that 8 on each side would leave nothing. */
const gapFor = (faces: number): number => Math.min(S.lineGap, Math.max(1, (faces - 4) / 2));

function linesOf(model: SessionMapModel, boxes: ReadonlyMap<string, MapBoxPos>, direction: MapDirection): MapLinePos[] {
  interface Pending {
    link: SessionLink;
    a: MapBoxPos;
    b: MapBoxPos;
    fromEdge: Edge;
    toEdge: Edge;
    along: "x" | "y";
  }
  const pending: Pending[] = [];
  for (const link of model.links) {
    const earlier = boxes.get(link.from);
    const later = boxes.get(link.session);
    if (!earlier || !later) continue;
    // Drawn from the lower stage to the higher; a loop (a use that goes back) is still drawn, the same way round.
    const [a, b] = earlier.stage <= later.stage ? [earlier, later] : [later, earlier];
    let fromEdge: Edge;
    let toEdge: Edge;
    let along: "x" | "y";
    if (direction === "horizontal") {
      if (a.stage < b.stage) [fromEdge, toEdge, along] = ["right", "left", "x"];
      else [fromEdge, toEdge, along] = a.y <= b.y ? ["bottom", "top", "y"] : ["top", "bottom", "y"];
    } else if (a.stage < b.stage) [fromEdge, toEdge, along] = ["bottom", "top", "y"];
    else [fromEdge, toEdge, along] = a.x <= b.x ? ["right", "left", "x"] : ["left", "right", "x"];
    pending.push({ link, a, b, fromEdge, toEdge, along });
  }

  // Where several lines meet one edge their ends are spread 14 apart, ordered by where the other end is, so they do not cross at the box.
  const at = new Map<string, { id: string; other: number }[]>();
  const attach = (box: MapBoxPos, edge: Edge, id: string, other: MapBoxPos) => {
    const key = `${box.key}:${edge}`;
    const list = at.get(key) ?? [];
    list.push({ id, other: edge === "left" || edge === "right" ? other.y + other.h / 2 : other.x + other.w / 2 });
    at.set(key, list);
  };
  for (const item of pending) {
    attach(item.a, item.fromEdge, `${item.link.id}:from`, item.b);
    attach(item.b, item.toEdge, `${item.link.id}:to`, item.a);
  }
  const offsetOf = new Map<string, number>();
  for (const [key, list] of at) {
    const sideways = key.endsWith(":left") || key.endsWith(":right");
    const spacing = list.length < 2 ? 0 : Math.min(S.lineSpread, (sideways ? 28 : 140) / (list.length - 1));
    [...list].sort((p, q) => p.other - q.other || p.id.localeCompare(q.id)).forEach((entry, i) => offsetOf.set(entry.id, (i - (list.length - 1) / 2) * spacing));
  }

  return pending.map((item) => {
    // The room between the two faces the line runs between.
    const faces =
      item.fromEdge === "right" ? item.b.x - (item.a.x + item.a.w) : item.fromEdge === "left" ? item.a.x - (item.b.x + item.b.w) : item.fromEdge === "bottom" ? item.b.y - (item.a.y + item.a.h) : item.a.y - (item.b.y + item.b.h);
    const gap = gapFor(Math.max(faces, 0));
    const p1 = pointOn(item.a, item.fromEdge, offsetOf.get(`${item.link.id}:from`) ?? 0, gap);
    const p2 = pointOn(item.b, item.toEdge, offsetOf.get(`${item.link.id}:to`) ?? 0, gap);
    return { id: item.link.id, from: item.link.from, to: item.link.session, d: curve(p1, p2, item.along), x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, fromEdge: item.fromEdge, toEdge: item.toEdge };
  });
}

export function layoutSessionMap(model: SessionMapModel, direction: MapDirection): SessionMapLayout {
  const slots = slotsOf(model);
  const stagesN = Math.max(1, model.stages.stages.length);
  const boxes: MapBoxPos[] = [];
  const partLabels: MapPartLabelPos[] = [];
  const dividers: MapDividerPos[] = [];
  const stageLabels: MapStageLabelPos[] = [];
  const stageInfo = (n: number): StageInfo => model.stages.stages[n - 1] ?? { number: n, sessions: [] };
  const withLabels = model.hasParts;

  if (direction === "horizontal") {
    let y = 0;
    let lastBottom = 0;
    model.parts.forEach((part, at) => {
      const labelTop = y;
      const rowsTop = withLabels ? labelTop + S.labelToRow : labelTop;
      if (withLabels) partLabels.push({ key: part.key, x: 0, y: labelTop, label: part.label, note: partNote(part) });
      let rows = 0;
      for (const key of part.sessions) {
        const slot = slots.get(key);
        if (!slot) continue;
        rows = Math.max(rows, slot.slot + 1);
        boxes.push({ key, x: (slot.stage - 1) * S.columnPitch, y: rowsTop + slot.slot * S.stackPitch, w: S.boxW, h: S.boxH, stage: slot.stage, part: part.key });
      }
      const bottom = rows > 0 ? rowsTop + (rows - 1) * S.stackPitch + S.boxH : rowsTop;
      lastBottom = bottom;
      if (at < model.parts.length - 1) {
        const line = bottom + S.partLineBelow;
        dividers.push({ id: `part:${part.key}`, kind: "part", x1: 0, y1: line, x2: stagesN * S.columnPitch - (S.columnPitch - S.boxW), y2: line });
        y = line + S.nextLabelBelow;
      }
    });
    const width = stagesN * S.columnPitch - (S.columnPitch - S.boxW);
    const gapX = S.columnPitch - S.boxW;
    for (let s = 1; s < stagesN; s += 1) {
      const x = s * S.columnPitch - gapX / 2;
      dividers.push({ id: `stage:${s}`, kind: "stage", x1: x, y1: -S.dividerAbove, x2: x, y2: lastBottom + S.dividerBelow });
    }
    const strip = { x: 0, y: lastBottom + S.stripBelow, w: width, h: S.stripH };
    for (let s = 1; s <= stagesN; s += 1) {
      const info = stageInfo(s);
      const text = stageText(info);
      stageLabels.push({ stage: s, x: (s - 1) * S.columnPitch + 10, y: strip.y + 5, text, line1: `STAGE ${s}`, line2: dayLabel(info.date).toUpperCase() });
    }
    const posOf = new Map(boxes.map((box) => [box.key, box]));
    return { direction, minY: -S.dividerAbove, width, height: strip.y + strip.h, boxes, lines: linesOf(model, posOf, direction), partLabels, dividers, strip, stageLabels };
  }

  // Vertical: stages are rows, parts are columns.
  let x = S.stripW + S.firstPartAfterStrip;
  let right = x;
  model.parts.forEach((part, at) => {
    let widest = 1;
    for (const key of part.sessions) {
      const slot = slots.get(key);
      if (!slot) continue;
      widest = Math.max(widest, slot.slot + 1);
      boxes.push({ key, x: x + slot.slot * S.sideBySide, y: (slot.stage - 1) * S.rowPitch, w: S.boxW, h: S.boxH, stage: slot.stage, part: part.key });
    }
    if (withLabels) partLabels.push({ key: part.key, x, y: -S.labelAboveRow, label: part.label, note: partNote(part) });
    right = x + (widest - 1) * S.sideBySide + S.boxW;
    if (at < model.parts.length - 1) {
      const line = right + S.partLineAfter;
      dividers.push({ id: `part:${part.key}`, kind: "part", x1: line, y1: withLabels ? -S.labelAboveRow : -S.stripAbove, x2: line, y2: 0 });
      x = line + S.nextPartAfterLine;
    }
  });
  const lastBottom = (stagesN - 1) * S.rowPitch + S.boxH;
  const strip = { x: 0, y: -S.stripAbove, w: S.stripW, h: lastBottom + S.stripBelow + S.stripAbove };
  for (const divider of dividers) divider.y2 = lastBottom + S.stripBelow;
  const rowGap = S.rowPitch - S.boxH;
  for (let s = 1; s < stagesN; s += 1) {
    const y = (s - 1) * S.rowPitch + S.boxH + rowGap / 2;
    dividers.push({ id: `stage:${s}`, kind: "stage", x1: S.stripW + S.dividerFromStrip, y1: y, x2: right, y2: y });
  }
  for (let s = 1; s <= stagesN; s += 1) {
    const info = stageInfo(s);
    stageLabels.push({ stage: s, x: 10, y: (s - 1) * S.rowPitch + 3, text: stageText(info), line1: `STAGE ${s}`, line2: dayLabel(info.date).toUpperCase() });
  }
  const posOf = new Map(boxes.map((box) => [box.key, box]));
  return { direction, minY: withLabels ? -S.labelAboveRow : -S.stripAbove, width: right, height: strip.y + strip.h, boxes, lines: linesOf(model, posOf, direction), partLabels, dividers, strip, stageLabels };
}

/** The boxes in reading order: by stage, then by part, then as the part holds them. */
export function readingOrder(model: SessionMapModel): string[] {
  const rank = new Map(model.parts.flatMap((part) => part.sessions.map((key, at) => [key, [part.index, at] as const])));
  return model.sessions
    .map((session) => session.key)
    .sort((p, q) => (model.stages.stageOf[p] ?? 1) - (model.stages.stageOf[q] ?? 1) || (rank.get(p)?.[0] ?? 0) - (rank.get(q)?.[0] ?? 0) || (rank.get(p)?.[1] ?? 0) - (rank.get(q)?.[1] ?? 0));
}

/** The sessions joined to `key` by a line, either way. */
export function joinedSessions(model: Pick<SessionMapModel, "links">, key: string | null): Set<string> {
  const out = new Set<string>();
  if (!key) return out;
  for (const link of model.links) {
    if (link.session === key) out.add(link.from);
    if (link.from === key) out.add(link.session);
  }
  return out;
}

/** What the head says under its title: "5 stages · 7 to 12 Oct". */
export function mapSummary(model: Pick<SessionMapModel, "stages">): string {
  const count = model.stages.stages.length;
  const range = stagesRange(model.stages.stages);
  return [plural(count, "stage"), range].filter(Boolean).join(" · ");
}

export { stageDays };
