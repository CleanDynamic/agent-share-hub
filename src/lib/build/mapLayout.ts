// The Map's layout (UI-P68): where every box and wire goes. PURE.
//
// CONCEPT §2.8, decision 1 A: BOXES PLACE THEMSELVES. Rows are sessions, left
// to right is by date, and nothing drags a box to a position. This file is the
// whole rule, so it is tested on its own and the view only draws what it says.
//
//   lanes    one per session, in order of its first step; one per run of
//            typed prompts; last, a dashed "Files and tools" lane when the
//            build has any. A step that is not a prompt (an agent, a team, a
//            manual step) sits in the lane of the step before it.
//   columns  column(step) = max( dateColumn(step),
//                                1 + column(previous step in its lane),
//                                1 + max(column of each earlier step it uses) )
//            dateColumn is the index of the step's session date among the
//            build's distinct dates; a typed prompt takes its neighbour's.
//            A result goes one column after the step it comes from; a file or
//            a tool sits one column before its first user.
//   wires    from an output dot (right edge, the middle of the header) to a
//            named input dot (left edge, the middle of its row). The next step
//            in the same session joins level with the header, unnamed. A loop
//            back (DATA §3, "until") rises 36 above both boxes.
//
// Units are px in the map's own space; the view adds its frame padding.

import type { SessionGroup, Step, StepKind, Use } from "./graph";

export const MAP_SIZES = {
  label: 100,
  column: 132,
  columnWide: 156,
  gap: 48,
  head: 28,
  row: 22,
  state: 16,
  body: 34,
  foot: 20,
  piece: 44,
  lanePad: 8,
  laneGap: 12,
  top: 24,
  loopRise: 36,
  arrow: 6,
} as const;

export interface MapPiece {
  id: string;
  name: string;
}

export interface MapResult {
  id: string;
  title: string;
  /** The step it comes from, when known. */
  fromId: string | null;
}

/** A suggested input for a step: drawn as a dashed row and a dashed wire, until it is accepted. */
export interface MapSuggestion {
  stepId: string;
  use: Use;
  label: string;
}

export interface MapInput {
  key: string;
  label: string;
  suggested: boolean;
  use: Use;
  /** The box this input comes from. */
  from: string;
}

export type MapBoxKind = "step" | "file" | "tool" | "result";

export interface MapBox {
  /** A step's id, or the node id of a file, a tool or a result. */
  id: string;
  kind: MapBoxKind;
  stepKind: StepKind | null;
  /** "3"; null for a file, a tool or a result. */
  number: string | null;
  title: string;
  /** The title is the default, which already holds the number. */
  defaultTitle: boolean;
  text: string;
  words: number;
  lane: number;
  column: number;
  x: number;
  y: number;
  w: number;
  h: number;
  inputs: MapInput[];
  /** Inputs the maker accepted, and the ones still only suggested. */
  accepted: number;
  suggested: number;
}

export interface MapLane {
  key: string;
  kind: "session" | "typed" | "files";
  label: string;
  /** "Claude · Opus 5.5". */
  sub: string;
  dashed: boolean;
  y: number;
  h: number;
}

export interface MapColumn {
  index: number;
  x: number;
  w: number;
  /** An ISO date, or null when nothing in the column has one. */
  date: string | null;
}

export interface MapWire {
  id: string;
  from: string;
  to: string;
  suggested: boolean;
  loop: boolean;
  /** Ends on a named input (false: level with the header). */
  named: boolean;
  d: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface MapLayout {
  lanes: MapLane[];
  columns: MapColumn[];
  boxes: MapBox[];
  wires: MapWire[];
  width: number;
  height: number;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;
const dayOf = (startedAt: string | null): string | null => (startedAt && ISO_DAY.test(startedAt) ? startedAt.slice(0, 10) : null);

const useKey = (use: Use): string => `${use.kind}:${use.node_id}`;

interface Placed {
  box: MapBox;
  /** Position in the cell, for stacking. */
  order: number;
}

/**
 * Lay the build out. `steps` are the top-level steps in order (an agent or a
 * team is one box; what is inside it shows when it is opened, CONCEPT §2.5).
 */
export function layoutMap(
  steps: readonly Step[],
  groups: readonly SessionGroup[],
  files: readonly MapPiece[],
  tools: readonly MapPiece[],
  results: readonly MapResult[],
  suggestions: readonly MapSuggestion[] = [],
): MapLayout {
  const S = MAP_SIZES;

  /* ── lanes ── */
  const lanes: MapLane[] = groups.map((group) => ({
    key: group.sessionId ?? `typed-${group.number}`,
    kind: group.sessionId ? "session" : "typed",
    label: group.sessionId ? `Session ${group.number}` : "Typed here",
    sub: [group.tool, group.model].filter(Boolean).join(" · "),
    dashed: false,
    y: 0,
    h: 0,
  }));
  const laneOfNumber = new Map<string, number>();
  groups.forEach((group, at) => group.stepNumbers.forEach((number) => laneOfNumber.set(number, at)));

  const stepLane: number[] = [];
  steps.forEach((step, at) => {
    let lane = laneOfNumber.get(step.number);
    if (lane === undefined) lane = at > 0 ? stepLane[at - 1] : undefined;
    if (lane === undefined) {
      // A first step that is not a prompt: the lane of the next prompt, or a lane of its own.
      const next = steps.slice(at + 1).find((candidate) => laneOfNumber.has(candidate.number));
      lane = next ? laneOfNumber.get(next.number) : undefined;
    }
    if (lane === undefined) {
      lanes.push({ key: "typed-0", kind: "typed", label: "Typed here", sub: "", dashed: false, y: 0, h: 0 });
      lane = lanes.length - 1;
    }
    stepLane.push(lane);
  });

  /* ── date columns ── */
  const days = new Set<string>();
  for (const group of groups) {
    const day = dayOf(group.startedAt);
    if (day) days.add(day);
  }
  const sortedDays = [...days].sort();
  const dayOfStep = (step: Step): string | null => {
    const group = step.sessionId
      ? groups.find((candidate) => candidate.sessionId === step.sessionId)
      : groups.find((candidate) => candidate.stepNumbers.includes(step.number));
    return group ? dayOf(group.startedAt) : null;
  };
  const stepDay: (string | null)[] = steps.map(dayOfStep);
  // A step with no date of its own takes its neighbour's: the one before, else the one after.
  const resolvedDay = stepDay.map((day, at) => {
    if (day) return day;
    for (let back = at - 1; back >= 0; back--) if (stepDay[back]) return stepDay[back];
    for (let ahead = at + 1; ahead < steps.length; ahead++) if (stepDay[ahead]) return stepDay[ahead];
    return null;
  });
  const dateColumn = resolvedDay.map((day) => (day ? sortedDays.indexOf(day) : 0));

  /* ── columns ── */
  const indexOfStep = new Map(steps.map((step, at) => [step.id, at]));
  const stepColumn: number[] = [];
  const lastInLane = new Map<number, number>();
  steps.forEach((step, at) => {
    let column = dateColumn[at];
    const before = lastInLane.get(stepLane[at]);
    if (before !== undefined) column = Math.max(column, 1 + stepColumn[before]);
    for (const use of step.uses) {
      if (use.kind !== "output") continue;
      const from = indexOfStep.get(use.node_id);
      // A use of a later step is a loop: it does not push this one right.
      if (from !== undefined && from < at) column = Math.max(column, 1 + stepColumn[from]);
    }
    stepColumn.push(column);
    lastInLane.set(stepLane[at], at);
  });

  /* ── the boxes, before they have a place ── */
  const pieceName = new Map<string, string>();
  for (const piece of [...files, ...tools]) pieceName.set(piece.id, piece.name);
  const hasPieces = files.length + tools.length > 0;
  if (hasPieces) lanes.push({ key: "files", kind: "files", label: "Files and tools", sub: "", dashed: true, y: 0, h: 0 });
  const filesLane = lanes.length - 1;

  const suggestionsFor = (id: string) => suggestions.filter((suggestion) => suggestion.stepId === id);

  const inputsOf = (id: string, uses: readonly Use[]): MapInput[] => {
    const named: MapInput[] = uses.flatMap((use) => {
      if (use.kind === "output") {
        const from = indexOfStep.get(use.node_id);
        return from === undefined ? [] : [{ key: useKey(use), label: `Output of ${steps[from].number}`, suggested: false, use, from: use.node_id }];
      }
      const name = pieceName.get(use.node_id);
      return name ? [{ key: useKey(use), label: name, suggested: false, use, from: use.node_id }] : [];
    });
    const taken = new Set(named.map((input) => input.key));
    const maybe: MapInput[] = suggestionsFor(id)
      .filter((suggestion) => !taken.has(useKey(suggestion.use)))
      .map((suggestion) => ({ key: useKey(suggestion.use), label: suggestion.label, suggested: true, use: suggestion.use, from: suggestion.use.node_id }));
    return [...named, ...maybe];
  };

  const sizeOf = (inputs: number) => {
    const w = inputs >= 3 ? S.columnWide : S.column;
    const h = S.head + (inputs > 0 ? S.row * inputs + S.state : 0) + S.body + S.foot;
    return { w, h };
  };

  const boxes: MapBox[] = [];
  const boxOf = new Map<string, MapBox>();
  const add = (box: MapBox) => {
    boxes.push(box);
    boxOf.set(box.id, box);
  };

  steps.forEach((step, at) => {
    const inputs = inputsOf(step.id, step.uses);
    const { w, h } = sizeOf(inputs.length);
    add({
      id: step.id,
      kind: "step",
      stepKind: step.kind,
      number: step.number,
      title: step.title ?? step.defaultTitle,
      defaultTitle: step.title === null,
      text: step.text,
      words: step.words,
      lane: stepLane[at],
      column: stepColumn[at],
      x: 0,
      y: 0,
      w,
      h,
      inputs,
      accepted: inputs.filter((input) => !input.suggested).length,
      suggested: inputs.filter((input) => input.suggested).length,
    });
  });

  // Results: one column after the step each comes from.
  const lastStep = steps.length - 1;
  for (const result of results) {
    const from = result.fromId ? indexOfStep.get(result.fromId) : undefined;
    const at = from ?? lastStep;
    const lane = at >= 0 ? stepLane[at] : Math.max(0, lanes.length - 1);
    const column = at >= 0 ? stepColumn[at] + 1 : 0;
    const source = from !== undefined ? steps[from] : null;
    const inputs: MapInput[] = source ? [{ key: `output:${source.id}`, label: `Output of ${source.number}`, suggested: false, use: { kind: "output", node_id: source.id }, from: source.id }] : [];
    const { w, h } = sizeOf(inputs.length);
    add({ id: result.id, kind: "result", stepKind: null, number: null, title: result.title, defaultTitle: false, text: "", words: 0, lane, column, x: 0, y: 0, w, h, inputs, accepted: inputs.length, suggested: 0 });
  }

  // Files and tools: one column before the first step that uses them.
  const firstUser = new Map<string, number>();
  steps.forEach((step, at) => {
    for (const use of step.uses) if (use.kind !== "output" && !firstUser.has(use.node_id)) firstUser.set(use.node_id, stepColumn[at]);
  });
  const addPiece = (piece: MapPiece, kind: "file" | "tool") => {
    const user = firstUser.get(piece.id);
    add({ id: piece.id, kind, stepKind: null, number: null, title: piece.name, defaultTitle: false, text: "", words: 0, lane: filesLane, column: user === undefined ? 0 : user - 1, x: 0, y: 0, w: S.column, h: S.piece, inputs: [], accepted: 0, suggested: 0 });
  };
  for (const file of files) addPiece(file, "file");
  for (const tool of tools) addPiece(tool, "tool");

  // A file before the first column pushes everything right, so no column is negative.
  const shift = Math.min(0, ...boxes.map((box) => box.column));
  if (shift < 0) for (const box of boxes) box.column -= shift;

  /* ── places ── */
  const columnCount = boxes.reduce((most, box) => Math.max(most, box.column + 1), 0);
  const columnWidth = Array.from({ length: columnCount }, () => 0);
  for (const box of boxes) columnWidth[box.column] = Math.max(columnWidth[box.column], box.w);
  const columnX: number[] = [];
  let cursor = S.label;
  for (let at = 0; at < columnCount; at++) {
    columnX.push(cursor);
    cursor += columnWidth[at] + S.gap;
  }
  const width = columnCount > 0 ? cursor - S.gap : S.label;

  // Boxes that share a lane and a column stack, so none sits on another.
  const cells = new Map<string, Placed[]>();
  for (const box of boxes) {
    const key = `${box.lane}:${box.column}`;
    const cell = cells.get(key) ?? [];
    cell.push({ box, order: cell.length });
    cells.set(key, cell);
  }
  const cellHeight = (cell: readonly Placed[]) => cell.reduce((sum, placed) => sum + placed.box.h, 0) + S.lanePad * (cell.length - 1);
  const laneBody = lanes.map((_, lane) => {
    let tallest = 0;
    for (const [key, cell] of cells) if (key.startsWith(`${lane}:`)) tallest = Math.max(tallest, cellHeight(cell));
    return tallest;
  });

  const loops = steps.some((step, at) => step.uses.some((use) => use.kind === "output" && (indexOfStep.get(use.node_id) ?? -1) > at));
  let y = S.top + (loops ? S.loopRise : 0);
  lanes.forEach((lane, at) => {
    lane.y = y;
    lane.h = laneBody[at] + S.lanePad;
    y += lane.h + S.laneGap;
  });
  const height = lanes.length > 0 ? y - S.laneGap : S.top;

  for (const cell of cells.values()) {
    let offset = 0;
    for (const { box } of cell) {
      box.x = columnX[box.column];
      box.y = lanes[box.lane].y + S.lanePad / 2 + offset;
      offset += box.h + S.lanePad;
    }
  }

  const columns: MapColumn[] = columnX.map((x, index) => {
    const dated = steps.findIndex((_, at) => boxes[at].column === index && resolvedDay[at]);
    return { index, x, w: columnWidth[index], date: dated >= 0 ? resolvedDay[dated] : null };
  });

  /* ── wires ── */
  const wires: MapWire[] = [];
  const wire = (from: MapBox, to: MapBox, inputAt: number | null, suggested: boolean): void => {
    // A use of a later step (DATA §3, "until") goes back: it is routed above both boxes.
    const fromAt = indexOfStep.get(from.id);
    const toAt = indexOfStep.get(to.id);
    const x1 = from.x + from.w;
    const y1 = from.y + S.head / 2;
    const x2 = to.x;
    const y2 = inputAt === null ? to.y + S.head / 2 : to.y + S.head + S.row * inputAt + S.row / 2;
    const loop = fromAt !== undefined && toAt !== undefined && fromAt > toAt;
    let d: string;
    if (loop) {
      const rise = Math.min(from.y, to.y) - S.loopRise;
      d = `M ${x1} ${y1} H ${x1 + 14} V ${rise} H ${x2 - 14} V ${y2} H ${x2 - S.arrow}`;
    } else {
      const dx = x2 - x1;
      d = `M ${x1} ${y1} C ${x1 + 0.6 * dx} ${y1}, ${x2 - 0.6 * dx} ${y2}, ${x2 - S.arrow} ${y2}`;
    }
    wires.push({ id: `${from.id}>${to.id}:${inputAt ?? "next"}`, from: from.id, to: to.id, suggested, loop, named: inputAt !== null, d, x1, y1, x2, y2 });
  };

  for (const box of boxes) {
    box.inputs.forEach((input, at) => {
      const from = boxOf.get(input.from);
      if (from) wire(from, box, at, input.suggested);
    });
  }
  // The next step in the same session, joined level with the header and unnamed.
  steps.forEach((step, at) => {
    const before = steps[at - 1];
    if (!before || before.kind !== "prompt" || step.kind !== "prompt" || !step.sessionId || before.sessionId !== step.sessionId) return;
    if (wires.some((candidate) => candidate.from === before.id && candidate.to === step.id)) return;
    const from = boxOf.get(before.id);
    const to = boxOf.get(step.id);
    if (from && to) wire(from, to, null, false);
  });

  return { lanes, columns, boxes, wires, width, height };
}

/** The boxes and wires directly joined to `id`, and `id` itself: what stays at full strength when it is selected. */
export function joinedTo(layout: Pick<MapLayout, "wires">, id: string | null): { boxes: ReadonlySet<string>; wires: ReadonlySet<string> } {
  const boxes = new Set<string>();
  const wires = new Set<string>();
  if (!id) return { boxes, wires };
  boxes.add(id);
  for (const wire of layout.wires) {
    if (wire.from !== id && wire.to !== id) continue;
    wires.add(wire.id);
    boxes.add(wire.from);
    boxes.add(wire.to);
  }
  return { boxes, wires };
}
