// The Map's layout (UI-P68): where every box and wire goes. PURE.
//
// CONCEPT §2.8, decision 1 A: BOXES PLACE THEMSELVES. Rows are sessions, left
// to right is by date, and nothing drags a box to a position. This file is the
// whole rule, so it is tested on its own and the view only draws what it says.
//
//   lanes    one per session, in order of its first step; one per run of
//            typed prompts; last, a dashed "Files and tools" lane when the
//            build has any. An agent or a team has a lane of its own, labelled
//            "Agent 5" over "runs by itself" (UI-P69). A manual step takes a
//            "By hand" lane, one per run of manual steps, the way typed
//            prompts take "Typed here" (UI-P70).
//   columns  column(step) = max( dateColumn(step),
//                                1 + column(previous step in its lane),
//                                1 + max(column of each earlier step it uses) )
//            dateColumn is the index of the step's session date among the
//            build's distinct dates; a typed prompt takes its neighbour's.
//            A result goes one column after the step it comes from; a file or
//            a tool sits one column before its first user. A file a step makes
//            (`madeBy`) sits one column after that step, in the files band, and
//            whatever uses it sits after the file. An agent's or a team's box
//            spans two columns, so what follows it starts after both.
//   wires    from an output dot (right edge, the middle of the header) to a
//            named input dot (left edge, the middle of its row). The next step
//            in the same session joins level with the header, unnamed; so does
//            the wire from a step to a file it makes. A loop
//            back (DATA §3, "until") rises 36 above both boxes.
//
// Units are px in the map's own space; the view adds its frame padding.

import { checkStatus, groupKey, groupKind, groupOfStep, runsLabel, shownGroups, untilClause, type SessionGroup, type Step, type StepKind, type Use } from "./graph";

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
  /**
   * An agent's or a team's box is 112 tall: a head, then the named inputs down
   * the left and the title, counts and how it runs beside them. Only more than
   * three inputs make it taller.
   */
  agentHeight: 112,
  /** Opened view: the frame's padding, the caption above the boxes, the band of files and tools, and the outside column. */
  framePad: 16,
  frameCaption: 28,
  band: 72,
  outsideGap: 56,
  stackOffset: 5,
  /** Room above the opened frame for a wire that comes back over it. */
  outerRise: 24,
  /** CA-03 P4: room above a column of agents side by side, for its label. */
  sideLabel: 20,
  /** CA-04 P2: one row inside a step's box for each tile sent with it. */
  sentRow: 18,
} as const;

export interface MapPiece {
  id: string;
  name: string;
  /** The id of the step that makes this file; absent or null for a file nobody makes. */
  madeBy?: string | null;
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
  /** Columns the box covers: 2 for an agent or a team, else 1. */
  span: number;
  /** A manual step's tool ("Figma"); null for any other box. */
  tool?: string | null;
  /** An agent's or a team's "2 prompts · 1 file · 1 tool"; null for any other box. */
  contents: string | null;
  /** How an agent or a team runs, in words; null for any other box. */
  runs: string | null;
  /** More than one copy runs at once (opened view): how many. */
  stack: number | null;
  /** CA-03 P5, a check only: "Passed 14 of 14 runs", and whether every run passed. */
  status?: { line: string; allPassed: boolean } | null;
  /** CA-04 P2: the tiles sent with this step, depth first, drawn as small rows inside its box, never as boxes. */
  sentWith?: { id: string; kind: string; name: string }[];
}

export interface MapLane {
  key: string;
  kind: "session" | "typed" | "files" | "agent" | "hand";
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
  /** A word or two drawn on the wire: "sent back until approved". */
  label?: string;
  /** Where the label sits (its middle). */
  labelX?: number;
  labelY?: number;
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

const isContainer = (step: Pick<Step, "kind">): boolean => step.kind === "agent" || step.kind === "team";

/** Columns a step's box covers. */
const spanOf = (step: Pick<Step, "kind">): number => (isContainer(step) ? 2 : 1);

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/**
 * "2 prompts · 1 file · 1 tool", leaving out zeros: what an agent or a team holds.
 * A team counts its agents where an agent counts its prompts; an agent's own
 * instructions are not counted.
 */
export function containsLine(step: Step): string {
  const inner = step.children.filter((child) => !child.id.endsWith(":instructions"));
  const files = new Set<string>();
  const tools = new Set<string>();
  for (const part of [step, ...step.children]) {
    for (const use of part.uses) {
      if (use.kind === "file") files.add(use.node_id);
      else if (use.kind === "tool") tools.add(use.node_id);
    }
  }
  const parts: string[] = [];
  if (inner.length > 0) parts.push(step.kind === "team" ? plural(inner.length, "agent") : plural(inner.length, "prompt"));
  if (files.size > 0) parts.push(plural(files.size, "file"));
  if (tools.size > 0) parts.push(plural(tools.size, "tool"));
  return parts.join(" · ");
}

interface Placed {
  box: MapBox;
  /** Position in the cell, for stacking. */
  order: number;
}

/**
 * Lay the build out. `steps` are the top-level steps in order (an agent or a
 * team is one box; what is inside it shows when it is opened, CONCEPT §2.5).
 */
const SENT_KIND: Record<string, string> = { prompt: "Prompt", code: "Code", file: "File", manual: "Manual step", check: "Check", agent: "Agent", team: "Team" };

/** CA-04 P2: a step's tiles as the rows its box draws: kind and name, depth first. */
export function sentRows(step: Step): { id: string; kind: string; name: string }[] {
  return (step.sentWith ?? []).flatMap((tile) => {
    const words = tile.text.replace(/\s+/g, " ").trim();
    const name =
      tile.kind === "file" || tile.kind === "code"
        ? (tile.filename ?? tile.title ?? tile.language ?? "")
        : (tile.title ?? (words ? (words.length > 40 ? `${words.slice(0, 39)}…` : words) : ""));
    return [{ id: tile.id, kind: SENT_KIND[tile.kind] ?? tile.kind, name }, ...sentRows(tile)];
  });
}

export function layoutMap(
  steps: readonly Step[],
  allGroups: readonly SessionGroup[],
  files: readonly MapPiece[],
  tools: readonly MapPiece[],
  results: readonly MapResult[],
  suggestions: readonly MapSuggestion[] = [],
): MapLayout {
  const S = MAP_SIZES;

  /* ── lanes ── */
  /* CA-04 P1: an old build's implicit group (its steps before any session) draws no lane; a session made here is a
     session lane like an imported one. */
  const groups = shownGroups(allGroups);
  const lanes: MapLane[] = groups.map((group) => ({
    key: groupKey(group),
    kind: groupKind(group) === "legacy" ? "typed" : "session",
    label: groupKind(group) === "legacy" ? "Typed here" : `Session ${group.number}`,
    sub: [group.tool, group.model].filter(Boolean).join(" · "),
    dashed: false,
    y: 0,
    h: 0,
  }));
  const laneOfNumber = new Map<string, number>();
  groups.forEach((group, at) => group.stepNumbers.forEach((number) => laneOfNumber.set(number, at)));

  const stepLane: number[] = [];
  steps.forEach((step, at) => {
    if (isContainer(step)) {
      lanes.push({ key: `agent-${step.id}`, kind: "agent", label: `${step.kind === "team" ? "Team" : "Agent"} ${step.number}`, sub: "runs by itself", dashed: false, y: 0, h: 0 });
      stepLane.push(lanes.length - 1);
      return;
    }
    if (step.kind === "manual") {
      // A run of manual steps shares one lane.
      const before = at > 0 && steps[at - 1].kind === "manual" ? stepLane[at - 1] : undefined;
      if (before !== undefined) {
        stepLane.push(before);
        return;
      }
      lanes.push({ key: `hand-${step.id}`, kind: "hand", label: "By hand", sub: "", dashed: false, y: 0, h: 0 });
      stepLane.push(lanes.length - 1);
      return;
    }
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
    const group = groupOfStep(groups, step);
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
  /* A file made by a step inside an agent or a team is made by that container's box: the Map draws top-level steps only. */
  const topOf = new Map<string, number>();
  const note = (step: Step, at: number) => {
    topOf.set(step.id, at);
    step.children.forEach((child) => note(child, at));
    (step.sentWith ?? []).forEach((tile) => note(tile, at));
  };
  steps.forEach(note);
  const makerOf = new Map<string, number>();
  for (const file of files) {
    const at = file.madeBy ? topOf.get(file.madeBy) : undefined;
    if (at !== undefined) makerOf.set(file.id, at);
  }
  const stepColumn: number[] = [];
  const lastInLane = new Map<number, number>();
  steps.forEach((step, at) => {
    let column = dateColumn[at];
    const before = lastInLane.get(stepLane[at]);
    if (before !== undefined) column = Math.max(column, stepColumn[before] + spanOf(steps[before]));
    for (const use of step.uses) {
      if (use.kind === "file") {
        // A made file sits one column after its step, and what uses it one more after that.
        const maker = makerOf.get(use.node_id);
        if (maker !== undefined && maker < at) column = Math.max(column, stepColumn[maker] + spanOf(steps[maker]) + 1);
        continue;
      }
      if (use.kind !== "output") continue;
      const from = indexOfStep.get(use.node_id);
      // A use of a later step is a loop: it does not push this one right.
      if (from !== undefined && from < at) column = Math.max(column, stepColumn[from] + spanOf(steps[from]));
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
    const container = isContainer(step);
    const sent = sentRows(step);
    const size = container
      ? { w: 2 * S.column + S.gap, h: Math.max(S.agentHeight, S.head + S.row * inputs.length + S.lanePad) }
      : sizeOf(inputs.length);
    const { w } = size;
    const h = size.h + S.sentRow * sent.length;
    add({
      id: step.id,
      kind: "step",
      stepKind: step.kind,
      number: step.number,
      // CA-02 P7: untitled code reads by its file name, or its language, under the box's "Code"; CA-03 P5: an untitled
      // check by what it tested, under the box's "Check".
      title: step.title ?? (step.kind === "code" ? (step.filename ?? step.language ?? step.defaultTitle) : step.kind === "check" ? step.text : step.defaultTitle),
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
      tool: step.kind === "manual" ? step.tool : null,
      span: spanOf(step),
      contents: container ? containsLine(step) : null,
      runs: container ? runsLabel(step.runs) : null,
      stack: null,
      ...(step.kind === "check" ? { text: step.check?.passing ?? "", status: step.check ? checkStatus(step.check) : null } : null),
      ...(sent.length > 0 ? { sentWith: sent } : null),
    });
  });

  // Results: one column after the step each comes from.
  const lastStep = steps.length - 1;
  for (const result of results) {
    const from = result.fromId ? indexOfStep.get(result.fromId) : undefined;
    const at = from ?? lastStep;
    const lane = at >= 0 ? stepLane[at] : Math.max(0, lanes.length - 1);
    const column = at >= 0 ? stepColumn[at] + spanOf(steps[at]) : 0;
    const source = from !== undefined ? steps[from] : null;
    const inputs: MapInput[] = source ? [{ key: `output:${source.id}`, label: `Output of ${source.number}`, suggested: false, use: { kind: "output", node_id: source.id }, from: source.id }] : [];
    const { w, h } = sizeOf(inputs.length);
    add({ id: result.id, kind: "result", stepKind: null, number: null, title: result.title, defaultTitle: false, text: "", words: 0, lane, column, x: 0, y: 0, w, h, inputs, accepted: inputs.length, suggested: 0, span: 1, contents: null, runs: null, stack: null });
  }

  // Files and tools: one column before the first step that uses them.
  const firstUser = new Map<string, number>();
  steps.forEach((step, at) => {
    for (const use of step.uses) if (use.kind !== "output" && !firstUser.has(use.node_id)) firstUser.set(use.node_id, stepColumn[at]);
  });
  const addPiece = (piece: MapPiece, kind: "file" | "tool") => {
    const user = firstUser.get(piece.id);
    const maker = makerOf.get(piece.id);
    // A made file is one column after its step; any other piece is one before its first user.
    const column = maker !== undefined ? stepColumn[maker] + spanOf(steps[maker]) : user === undefined ? 0 : user - 1;
    add({ id: piece.id, kind, stepKind: null, number: null, title: piece.name, defaultTitle: false, text: "", words: 0, lane: filesLane, column, x: 0, y: 0, w: S.column, h: S.piece, inputs: [], accepted: 0, suggested: 0, span: 1, contents: null, runs: null, stack: null });
  };
  for (const file of files) addPiece(file, "file");
  for (const tool of tools) addPiece(tool, "tool");

  // A file before the first column pushes everything right, so no column is negative.
  const shift = Math.min(0, ...boxes.map((box) => box.column));
  if (shift < 0) for (const box of boxes) box.column -= shift;

  /* ── places ── */
  const columnCount = boxes.reduce((most, box) => Math.max(most, box.column + box.span), 0);
  const columnWidth = Array.from({ length: columnCount }, () => 0);
  for (const box of boxes) {
    // A box that spans columns is as wide as they are together, so each takes a share.
    const share = box.span > 1 ? S.column : box.w;
    for (let at = box.column; at < box.column + box.span; at++) columnWidth[at] = Math.max(columnWidth[at], share);
  }
  for (const box of boxes) if (box.span > 1) box.w = columnWidth.slice(box.column, box.column + box.span).reduce((sum, w) => sum + w, 0) + S.gap * (box.span - 1);
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
  // A step to a file it makes, joined level with the header and unnamed, from its output dot to the file's left edge.
  for (const file of files) {
    const maker = makerOf.get(file.id);
    const from = maker !== undefined ? boxOf.get(steps[maker].id) : undefined;
    const to = boxOf.get(file.id);
    if (from && to) wire(from, to, null, false);
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

/* ── an opened agent or team (UI-P69, CONCEPT §2.5) ── */

export interface OpenedLayout {
  /** The steps inside the container, left to right by sub-number. */
  boxes: MapBox[];
  /** Files and tools used inside: the band along the bottom of the frame. */
  band: MapBox[];
  /** Boxes the container uses or goes into, drawn dimmed on the right. */
  outside: MapBox[];
  wires: MapWire[];
  /** The dashed frame, in the opened map's own space. */
  frame: { x: number; y: number; w: number; h: number };
  /** Where "files and tools" is captioned inside the frame. */
  bandY: number;
  /** CA-03 P4: each column of agents side by side, and where its "Side by side" label sits (its top left). */
  sideBySide: { ids: string[]; x: number; y: number }[];
  width: number;
  height: number;
}

/** The sub-steps a container opens onto: an agent's instructions and prompts, a team's agents. */
export const insideOf = (container: Step): Step[] => container.children;

/**
 * CA-03 P4: the agents of a team that run side by side, as groups of ids in order, each of two or more. A team that
 * runs several at the same time has every agent after its lead side by side. Otherwise, two or more agents are side
 * by side when the same later step uses each of them (an agent after them in the team, a step of the build, or a
 * result) and none of them uses another: a chain is not side by side. An agent's own prompts never are.
 */
export function sideBySideGroups(container: Step, steps: readonly Step[] = [], results: readonly { fromId: string | null }[] = []): string[][] {
  if (container.kind !== "team") return [];
  const agents = container.children.filter((child) => child.kind === "agent");
  if (container.runs?.how === "parallel") {
    const helpers = agents.slice(1).map((agent) => agent.id);
    return helpers.length >= 2 ? [helpers] : [];
  }
  const ids = new Set(agents.map((agent) => agent.id));
  const feeds = (user: Pick<Step, "uses">) => user.uses.filter((use) => use.kind === "output" && ids.has(use.node_id)).map((use) => use.node_id);
  const at = new Map(agents.map((agent, index) => [agent.id, index]));
  const users: string[][] = [
    // Inside the team only an earlier agent feeds a later one: a use of a later agent is a loop sent back.
    ...agents.map((user, index) => feeds(user).filter((id) => (at.get(id) ?? index) < index)),
    ...flatSteps(steps).filter((step) => !ids.has(step.id) && step.id !== container.id).map(feeds),
    ...results.map((result) => (result.fromId && ids.has(result.fromId) ? [result.fromId] : [])),
  ];
  const groups: string[][] = [];
  const taken = new Set<string>();
  for (const fed of users) {
    const candidates = agents.filter((agent) => fed.includes(agent.id) && !taken.has(agent.id));
    // None of them may use another of them.
    const free = candidates.filter((agent) => !agent.uses.some((use) => use.kind === "output" && candidates.some((other) => other.id === use.node_id)));
    if (free.length < 2) continue;
    groups.push(free.map((agent) => agent.id));
    free.forEach((agent) => taken.add(agent.id));
  }
  return groups;
}

const flatSteps = (list: readonly Step[]): Step[] => list.flatMap((step) => [step, ...flatSteps(step.children)]);

/**
 * Lay out what is inside one agent or team.
 *
 *   one lane, left to right by sub-number, by the same column rule as the
 *   Map: a box sits one column after the one before it and after every earlier
 *   box it uses. A use of a later box is a loop and is routed above.
 *   A box that runs several at once is drawn stacked (`stack` is its count).
 *   Files and tools used inside sit in a band along the bottom of the frame.
 *   Outside the frame, on the right: every box the container uses or goes
 *   into (a step, or the result), for the view to draw dimmed.
 */
export function layoutOpened(
  container: Step,
  steps: readonly Step[],
  files: readonly MapPiece[],
  tools: readonly MapPiece[],
  results: readonly MapResult[] = [],
): OpenedLayout {
  const S = MAP_SIZES;
  const inside = insideOf(container);
  const pieceName = new Map<string, string>();
  for (const piece of [...files, ...tools]) pieceName.set(piece.id, piece.name);
  const insideAt = new Map(inside.map((child, at) => [child.id, at]));
  const stackOf = (child: Step): number | null => (child.runs?.how === "parallel" && typeof child.runs.count === "number" && child.runs.count > 1 ? child.runs.count : null);

  /* ── columns: one lane, so each box is after the one before; agents side by side share one column (CA-03 P4) ── */
  const groups = sideBySideGroups(container, steps, results);
  const groupOf = new Map<string, number>();
  groups.forEach((group, index) => group.forEach((id) => groupOf.set(id, index)));
  const groupColumn = new Map<number, number>();
  const column: number[] = [];
  /** Each box's place, top to bottom, in its column. */
  const slot: number[] = [];
  inside.forEach((child, at) => {
    const group = groupOf.get(child.id);
    if (group !== undefined && groupColumn.has(group)) {
      column.push(groupColumn.get(group)!);
      slot.push(groups[group].indexOf(child.id));
      return;
    }
    let next = at === 0 ? 0 : Math.max(...column) + 1;
    for (const use of child.uses) {
      const from = use.kind === "output" ? insideAt.get(use.node_id) : undefined;
      const sameGroup = from !== undefined && group !== undefined && groupOf.get(inside[from].id) === group;
      if (from !== undefined && from < at && !sameGroup) next = Math.max(next, column[from] + 1);
    }
    if (group !== undefined) groupColumn.set(group, next);
    column.push(next);
    slot.push(0);
  });

  /* ── what is used inside, and what is outside ── */
  const usedPieces: string[] = [];
  const outsideSteps: Step[] = [];
  const notePiece = (id: string) => {
    if (pieceName.has(id) && !usedPieces.includes(id)) usedPieces.push(id);
  };
  for (const part of [container, ...inside]) {
    for (const use of part.uses) {
      if (use.kind !== "output") notePiece(use.node_id);
      else if (!insideAt.has(use.node_id) && use.node_id !== container.id) {
        const outer = steps.find((candidate) => candidate.id === use.node_id);
        if (outer && !outsideSteps.includes(outer)) outsideSteps.push(outer);
      }
    }
  }
  const goesInto = steps.filter((candidate) => candidate.id !== container.id && candidate.uses.some((use) => use.kind === "output" && use.node_id === container.id));
  const goesIntoResults = results.filter((result) => result.fromId === container.id);

  /* ── boxes inside ── */
  const labelFor = (child: Step, use: Use): string | null => {
    if (use.kind !== "output") return pieceName.get(use.node_id) ?? null;
    const at = insideAt.get(use.node_id);
    if (at !== undefined) {
      const source = inside[at];
      if (at > insideAt.get(child.id)!) return `Sent back by ${source.number}`;
      const many = stackOf(source);
      return many ? `Output of ${source.number} × ${many}` : `Output of ${source.number}`;
    }
    const outer = steps.find((candidate) => candidate.id === use.node_id);
    return outer ? `Output of ${outer.number}` : null;
  };

  const boxes: MapBox[] = inside.map((child, at) => {
    const inputs: MapInput[] = child.uses.flatMap((use) => {
      const label = labelFor(child, use);
      return label ? [{ key: `${use.kind}:${use.node_id}`, label, suggested: false, use, from: use.node_id }] : [];
    });
    const w = inputs.length >= 3 ? S.columnWide : S.column;
    const h = S.head + (inputs.length > 0 ? S.row * inputs.length + S.state : 0) + S.body + S.foot;
    return {
      id: child.id,
      kind: "step" as const,
      stepKind: child.kind,
      number: child.number,
      title: child.title ?? child.defaultTitle,
      defaultTitle: child.title === null,
      text: child.text,
      words: child.words,
      lane: 0,
      column: column[at],
      x: 0,
      y: 0,
      w,
      h,
      inputs,
      accepted: inputs.length,
      suggested: 0,
      span: 1,
      contents: null,
      runs: child.kind === "agent" ? runsLabel(child.runs) : null,
      stack: stackOf(child),
    };
  });

  const columnCount = boxes.reduce((most, box) => Math.max(most, box.column + 1), 0);
  const columnWidth = Array.from({ length: columnCount }, () => 0);
  // A stacked box shows two copies behind it, offset down and right.
  const stackExtra = (box: MapBox) => (box.stack ? 2 * S.stackOffset : 0);
  for (const box of boxes) columnWidth[box.column] = Math.max(columnWidth[box.column], box.w + stackExtra(box));
  const columnX: number[] = [];
  const innerLeft = S.framePad;
  let cursor = innerLeft;
  for (let at = 0; at < columnCount; at++) {
    columnX.push(cursor);
    cursor += columnWidth[at] + S.gap;
  }
  const innerWidth = columnCount > 0 ? cursor - S.gap - innerLeft : S.column;

  // Space above the frame for a wire from outside that comes back over it.
  const frameTop = S.outerRise;
  const loops = inside.some((child, at) => child.uses.some((use) => (insideAt.get(use.node_id) ?? -1) > at));
  const rowY = frameTop + S.frameCaption + (loops ? S.loopRise : 0) + (groups.length > 0 ? S.sideLabel : 0) + S.framePad;
  // Boxes side by side stack down their column, a lane's gap apart.
  const columnHeight = Array.from({ length: columnCount }, () => 0);
  const order = boxes.map((box, at) => ({ box, at })).sort((a, b) => a.box.column - b.box.column || slot[a.at] - slot[b.at]);
  for (const { box } of order) {
    box.x = columnX[box.column];
    box.y = rowY + columnHeight[box.column] + (columnHeight[box.column] > 0 ? S.laneGap : 0);
    columnHeight[box.column] = box.y - rowY + box.h + stackExtra(box);
  }
  const tallest = Math.max(S.body, ...columnHeight);
  const sideBySide = groups.map((ids) => {
    const at = groupColumn.get(groups.indexOf(ids)) ?? 0;
    return { ids, x: columnX[at] ?? innerLeft, y: rowY - S.sideLabel };
  });

  /* ── the band of files and tools ── */
  const bandY = rowY + tallest + S.framePad;
  const band: MapBox[] = usedPieces.map((id, at) => ({
    id,
    kind: files.some((file) => file.id === id) ? ("file" as const) : ("tool" as const),
    stepKind: null,
    number: null,
    title: pieceName.get(id) ?? "",
    defaultTitle: false,
    text: "",
    words: 0,
    lane: 1,
    column: at,
    x: innerLeft + at * (S.column + S.gap / 2),
    y: bandY + 20,
    w: S.column,
    h: S.piece,
    inputs: [],
    accepted: 0,
    suggested: 0,
    span: 1,
    contents: null,
    runs: null,
    stack: null,
  }));
  const bandWidth = band.length > 0 ? band.length * (S.column + S.gap / 2) - S.gap / 2 : 0;

  const frameW = Math.max(innerWidth, bandWidth) + 2 * S.framePad;
  const frameBottom = (band.length > 0 ? bandY + 20 + S.piece : bandY - S.framePad) + S.framePad;
  const frame = { x: 0, y: frameTop, w: frameW, h: frameBottom - frameTop };

  /* ── outside, on the right ── */
  const outsideX = frame.x + frame.w + S.outsideGap;
  const outside: MapBox[] = [];
  let outsideY = frame.y + S.frameCaption;
  const addOutside = (id: string, kind: "step" | "result", step: Step | null, title: string, number: string | null, inputs: MapInput[]) => {
    const h = S.head + (inputs.length > 0 ? S.row * inputs.length + S.state : 0) + S.body + S.foot;
    outside.push({
      id,
      kind,
      stepKind: step?.kind ?? null,
      number,
      title,
      defaultTitle: step ? step.title === null : false,
      text: step?.text ?? "",
      words: step?.words ?? 0,
      lane: 2,
      column: 0,
      x: outsideX,
      y: outsideY,
      w: inputs.length >= 3 ? S.columnWide : S.column,
      h,
      inputs,
      accepted: inputs.length,
      suggested: 0,
      span: 1,
      contents: null,
      runs: null,
      stack: null,
    });
    outsideY += h + S.laneGap;
  };
  for (const outer of outsideSteps) addOutside(outer.id, "step", outer, outer.title ?? outer.defaultTitle, outer.number, []);
  for (const next of goesInto) {
    if (outside.some((box) => box.id === next.id)) continue;
    addOutside(next.id, "step", next, next.title ?? next.defaultTitle, next.number, [
      { key: `output:${container.id}`, label: `Output of ${container.number}`, suggested: false, use: { kind: "output", node_id: container.id }, from: container.id },
    ]);
  }
  for (const result of goesIntoResults) {
    addOutside(result.id, "result", null, result.title, null, [
      { key: `output:${container.id}`, label: `Output of ${container.number}`, suggested: false, use: { kind: "output", node_id: container.id }, from: container.id },
    ]);
  }

  /* ── wires ── */
  const wires: MapWire[] = [];
  const all = new Map<string, MapBox>([...boxes, ...band, ...outside].map((box) => [box.id, box]));
  const inBand = new Set(band.map((box) => box.id));
  const isOutside = new Set(outside.map((box) => box.id));
  const wire = (from: MapBox, to: MapBox, inputAt: number | null, label?: string) => {
    const fromBand = inBand.has(from.id);
    const x1 = fromBand ? from.x + from.w / 2 : from.x + from.w;
    const y1 = fromBand ? from.y : from.y + S.head / 2;
    const x2 = to.x;
    const y2 = inputAt === null ? to.y + S.head / 2 : to.y + S.head + S.row * inputAt + S.row / 2;
    const loop = !fromBand && x2 <= x1;
    // A box outside comes back over the frame; one inside, over the row it is in.
    const rise = isOutside.has(from.id) ? frame.y - S.outerRise / 2 : Math.min(from.y, to.y) - S.loopRise / 2;
    const d = fromBand
      ? `M ${x1} ${y1} C ${x1} ${y1 - 50}, ${x2 - 40} ${y2}, ${x2 - S.arrow} ${y2}`
      : loop
        ? `M ${x1} ${y1} H ${x1 + 14} V ${rise} H ${x2 - 14} V ${y2} H ${x2 - S.arrow}`
        : `M ${x1} ${y1} C ${x1 + 0.6 * (x2 - x1)} ${y1}, ${x2 - 0.6 * (x2 - x1)} ${y2}, ${x2 - S.arrow} ${y2}`;
    wires.push({
      id: `${from.id}>${to.id}:${inputAt ?? "next"}`,
      from: from.id,
      to: to.id,
      suggested: false,
      loop,
      named: inputAt !== null,
      d,
      x1,
      y1,
      x2,
      y2,
      ...(label ? { label, labelX: (x1 + x2) / 2, labelY: loop ? rise - 5 : (y1 + y2) / 2 - 6 } : null),
    });
  };
  boxes.forEach((box, at) => {
    const child = inside[at];
    box.inputs.forEach((input, index) => {
      const from = all.get(input.from);
      if (!from) return;
      const sentBack = input.from !== child.id && (insideAt.get(input.from) ?? -1) > at;
      const detail = sentBack ? inside[insideAt.get(input.from)!].runs?.detail : undefined;
      wire(from, box, index, sentBack && detail ? `sent back ${untilClause(detail)}` : sentBack ? "sent back" : undefined);
    });
  });
  // Inside an agent, each prompt follows the one before it.
  if (container.kind === "agent") {
    boxes.forEach((box, at) => {
      if (at === 0) return;
      if (wires.some((candidate) => candidate.from === boxes[at - 1].id && candidate.to === box.id)) return;
      wire(boxes[at - 1], box, null);
    });
  }
  // The container's output leaves its last box for what goes into it; from a last column side by side, every box in
  // it, joining at the step they feed (CA-03 P4).
  const lastColumn = boxes.reduce((most, box) => Math.max(most, box.column), -1);
  const lasts = groups.length > 0 ? boxes.filter((box) => box.column === lastColumn) : boxes.slice(-1);
  for (const box of outside) {
    if (!box.inputs.some((input) => input.from === container.id)) continue;
    for (const last of lasts) wire(last, box, 0);
  }

  const width = outside.length > 0 ? outsideX + Math.max(...outside.map((box) => box.w)) : frame.x + frame.w;
  const height = Math.max(frame.y + frame.h + 8, outsideY - S.laneGap);
  return { boxes, band, outside, wires, frame, bandY, sideBySide, width, height };
}
