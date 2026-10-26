/* CA-22 P2, P3: the build page's leaving and arriving, directed from what changed.

   THE PAGE LEARNS WHAT CHANGED by comparing the layout it drew (`layoutOf`: which tiles, in which sessions, in which parts) with the
   one it is now given. It learns HOW from the label the action gave (SV-06: `motion.expect({ kind, keys })`), taken by the first
   commit that touches those keys, in a layout effect: nothing is read while rendering. With no label nothing lifts or drops: a
   build swapped for another, or a write from another tab, is simply drawn, and what it shares with the old one slides.
   While rendering, a removal is held from the data alone; with no label asking for a lift it is let go before it is painted.

   LEAVING (something went). The old view is held on screen, in place, while what went lifts out (`LIFT`: fades and rises 8). The
   skeleton of the sessions involved shows meanwhile (their lanes and sockets; the removed one's socket stays where it was). Then
   the new view is drawn and everything slides by the gap (`slideMs`, by its distance), the skeleton's boxes with it, and the numbers crossfade
   (`useCrossfade` in the number badges). The skeleton fades out once the slides have ended, `FADE_AFTER_MS` after (SV-06: each
   step waits on the one before it ending, never on a timer; `SEQUENCE_CAP` ends anything still running at 1.2 s).
   A clear lifts every head and tile that is on screen from the last to the first, `STAGGER` apart, over `STAGGER_SPREAD_MAX` at most.

   ARRIVING (something came). The new view is drawn at once, so its place is already measured; the things below slide to open
   the gap (`slideMs`) while what came waits, see-through, and then drops in (`DROP`). A copy instead slides out from under its
   original. Several coming at once drop `STAGGER` apart. The skeleton of the sessions involved shows, then fades.

   Everything is a transform or an opacity, played by the List's one animator (`listMotion.ts`): the slides come from its pass
   round each commit, and the lifts and drops from its vocabulary (`buildMotion.tsx`). A new intent while one is running stops its
   steps where they are; what is moving keeps moving, and the next plan starts from where things are drawn. Under reduced motion
   nothing here does anything: the new view is simply drawn. */

import { useLayoutEffect, useRef, useState } from "react";

import { DROP, LIFT, SLIDE, STAGGER } from "@/lib/build/buildMotion";
import { SKELETON_IN } from "@/lib/build/buildMotion";
import type { Step } from "@/lib/build/graph";
import type { Skeleton } from "@/lib/build/sortLayout";

import { measureStill } from "./arrival";
import type { BuildListProps } from "./BuildList";
import { listRuns } from "./buildRuns";
import { captureWords, crossfadeFrom, dropIn, liftOut, motionOn, outlineOnce, slideOut, staggerDelay, type MotionRun, type Words } from "./buildMotion";
import { allOf, capSequence, openFrame, type ListMotion, type MotionKind, type MotionLabel } from "./listMotion";
import type { Box } from "./flip";

/* ── what is on the page ── */

export interface Layout {
  /** Top-level tile id → its session's key ("" when it stands alone). */
  tiles: Map<string, string>;
  /** Session key → its part's key ("" when there are no parts). */
  sessions: Map<string, string>;
  parts: Set<string>;
  /** The order inside each container: a session's tile ids, a part's session keys, and ("") the parts. */
  order: Map<string, string[]>;
}

export function layoutOf(view: BuildListProps): Layout {
  const tiles = new Map<string, string>();
  const sessions = new Map<string, string>();
  const runs = listRuns(view.steps, view.dividers, view.emptySessions ?? []);
  const partOf = new Map<string, string>();
  const parts = view.parts && view.parts.parts.length >= 2 ? view.parts : null;
  if (parts) for (const part of parts.parts) for (const key of part.sessions) partOf.set(key, part.view.key);
  const order = new Map<string, string[]>();
  const push = (container: string, id: string) => order.set(container, [...(order.get(container) ?? []), id]);
  for (const run of runs) {
    const key = run.head?.key ?? "";
    if (run.head) {
      const part = partOf.get(key) ?? (parts ? parts.parts[0].view.key : "");
      sessions.set(key, part);
      push(`part:${part}`, key);
    }
    for (const step of run.steps) {
      tiles.set(step.id, key);
      push(`session:${key}`, step.id);
    }
  }
  for (const part of parts?.parts ?? []) push("parts", part.view.key);
  return { tiles, sessions, parts: new Set(parts ? parts.parts.map((part) => part.view.key) : []), order };
}

export interface Change {
  removedTiles: string[];
  addedTiles: string[];
  removedSessions: string[];
  addedSessions: string[];
  removedParts: string[];
  addedParts: string[];
  /** Tiles that stand in another session now, or in another place in theirs. */
  movedTiles: string[];
  /** Sessions that stand in another part now, or in another place in theirs. */
  movedSessions: string[];
  movedParts: string[];
}

const missing = <K,>(from: Iterable<K>, within: { has: (key: K) => boolean }): K[] => [...from].filter((key) => !within.has(key));

/**
 * What moved inside one container, from the order before and after (both cut to what is in both). One thing moved when taking it
 * out of both leaves the same order; with no such thing, nothing is named (a shuffle has no one thing to outline).
 */
export function movedWithin(before: readonly string[], after: readonly string[]): string[] {
  const kept = new Set(after);
  const a = before.filter((id) => kept.has(id));
  const inBefore = new Set(a);
  const b = after.filter((id) => inBefore.has(id));
  if (a.length === b.length && a.every((id, at) => id === b[at])) return [];
  return a.filter((id) => {
    const left = a.filter((other) => other !== id);
    const right = b.filter((other) => other !== id);
    return left.every((other, at) => other === right[at]);
  });
}

export function diffLayout(before: Layout, after: Layout): Change {
  const movedParts: string[] = [];
  const movedTiles = [...after.tiles].filter(([id, session]) => before.tiles.has(id) && before.tiles.get(id) !== session).map(([id]) => id);
  const movedSessions = [...after.sessions].filter(([key, part]) => before.sessions.has(key) && before.sessions.get(key) !== part).map(([key]) => key);
  for (const [container, ids] of after.order) {
    const was = before.order.get(container);
    if (!was) continue;
    const moved = movedWithin(was, ids);
    if (container === "parts") movedParts.push(...moved);
    else if (container.startsWith("part:")) movedSessions.push(...moved.filter((key) => !movedSessions.includes(key)));
    else movedTiles.push(...moved.filter((id) => !movedTiles.includes(id)));
  }
  return {
    removedTiles: missing(before.tiles.keys(), after.tiles),
    addedTiles: missing(after.tiles.keys(), before.tiles),
    removedSessions: missing(before.sessions.keys(), after.sessions),
    addedSessions: missing(after.sessions.keys(), before.sessions),
    removedParts: missing(before.parts, after.parts),
    addedParts: missing(after.parts, before.parts),
    movedTiles,
    movedSessions,
    movedParts,
  };
}

export const hasRemoved = (change: Change): boolean => change.removedTiles.length + change.removedSessions.length + change.removedParts.length > 0;
export const hasAdded = (change: Change): boolean => change.addedTiles.length + change.addedSessions.length + change.addedParts.length > 0;
export const hasMoved = (change: Change): boolean => change.movedTiles.length + change.movedSessions.length + change.movedParts.length > 0;

/**
 * Whether a removal is worth holding the old view for. Steps that say what they remove (a remove, a clear, a merge, an undo)
 * always are. A step that only says it changed something is, when tiles went or a session that held tiles; a session with none
 * going (the placeholder first session of a new post, replaced by a real one) is bookkeeping, and draws at once.
 */
export function liftsFor(kind: MotionKind, change: Change, before: Layout): boolean {
  if (!hasRemoved(change) || hasAdded(change)) return false;
  if (["remove", "clear", "merge", "undo", "redo", "restore"].includes(kind)) return true;
  if (kind !== "change") return false;
  return change.removedTiles.length > 0 || change.removedParts.length > 0 || change.removedSessions.some((key) => [...before.tiles.values()].includes(key));
}

/** The tiles whose words or settings differ between two views (their number does not count: it follows from the others). */
export function changedTiles(before: BuildListProps, after: BuildListProps): string[] {
  const digest = (step: Step) => JSON.stringify(step, (key, value) => (key === "number" ? undefined : value));
  const was = new Map(before.steps.map((step) => [step.id, digest(step)]));
  return after.steps.filter((step) => was.has(step.id) && was.get(step.id) !== digest(step)).map((step) => step.id);
}

/* ── finding things on the page ── */

const find = (root: ParentNode, selector: string): HTMLElement | null => root.querySelector<HTMLElement>(selector);
const tileEl = (root: ParentNode, id: string) => find(root, `[data-skel-kind="tile"][data-skel-id="${id}"]`) ?? find(root, `[data-node-id="${id}"]`);
const sessionEl = (root: ParentNode, key: string) => find(root, `[data-skel-kind="session"][data-skel-id="${key}"]`);
const headEl = (root: ParentNode, key: string) => sessionEl(root, key)?.querySelector<HTMLElement>('[data-testid="session-head"]') ?? null;
const partEl = (root: ParentNode, key: string) => find(root, `[data-skel-kind="part"][data-skel-id="${key}"]`);
const partHeadEl = (root: ParentNode, key: string) => partEl(root, key)?.querySelector<HTMLElement>('[data-testid="workstream-head"]') ?? null;

const present = (elements: (HTMLElement | null)[]): HTMLElement[] => elements.filter((element): element is HTMLElement => element !== null);

const onScreen = (element: HTMLElement): boolean => {
  const box = element.getBoundingClientRect();
  const height = typeof window === "undefined" ? 0 : window.innerHeight;
  return box.bottom > 0 && box.top < (height || Number.POSITIVE_INFINITY);
};

/* ── the sequences ── */

export interface LiftPlan {
  /** In the order they leave. */
  elements: HTMLElement[];
  /** Delay of each. */
  delays: number[];
  /** From the first starting to the last ending. */
  span: number;
  /** The sessions whose skeleton shows; null: all. */
  scope: Set<string> | null;
}

/** What lifts for a removal, from the page as it still stands. */
export function planLift(root: HTMLElement, change: Change, before: Layout, kind: MotionKind, stagger: number = STAGGER): LiftPlan {
  const goneParts = new Set(change.removedParts);
  const goneSessions = new Set(change.removedSessions);
  const goneTiles = new Set(change.removedTiles);
  const wholeBuild = kind === "clear" || (before.tiles.size > 0 && change.removedTiles.length === before.tiles.size);
  if (wholeBuild) {
    // Every head and tile on screen, last to first, staggered over a fixed spread however many there are. What is not in the
    // window is not lifted by the eye: it simply goes with the rest.
    const all = [...root.querySelectorAll<HTMLElement>('[data-testid="workstream-head"], [data-testid="session-head"], [data-skel-kind="tile"]')].reverse();
    const elements = all.filter(onScreen);
    const delays = elements.map((_, at) => staggerDelay(at, elements.length, stagger));
    return { elements, delays, span: (elements.length > 0 ? Math.max(...delays) : 0) + LIFT, scope: null };
  }
  const elements: HTMLElement[] = [];
  const scope = new Set<string>();
  const sessionOfTile = (id: string) => before.tiles.get(id) ?? "";
  for (const key of change.removedParts) {
    const el = partEl(root, key);
    if (el) elements.push(el);
  }
  for (const key of change.removedSessions) {
    if (goneParts.has(before.sessions.get(key) ?? "")) continue;
    const mine = [...before.tiles].filter(([, session]) => session === key).map(([id]) => id);
    const keepsTiles = mine.some((id) => !goneTiles.has(id));
    // "Keep the tiles" and a merge: only the head leaves, its tiles slide into the neighbouring session. Remove all: the block goes.
    const el = keepsTiles ? headEl(root, key) : sessionEl(root, key);
    if (el) elements.push(el);
  }
  for (const id of change.removedTiles) {
    const session = sessionOfTile(id);
    if (goneSessions.has(session) || goneParts.has(before.sessions.get(session) ?? "")) continue;
    const el = tileEl(root, id);
    if (el) {
      elements.push(el);
      if (session) scope.add(session);
    }
  }
  const delays = elements.map(() => 0);
  const onlyTiles = change.removedSessions.length === 0 && change.removedParts.length === 0 && scope.size > 0;
  return { elements, delays, span: elements.length > 0 ? LIFT : 0, scope: onlyTiles ? scope : null };
}

export interface DropPlan {
  /** Things that fall into place. */
  drops: HTMLElement[];
  /** Frames that open (a new part's): the top edge falls in with the head, the bottom edge slides down, the sides grow. */
  frames: HTMLElement[];
  /** Copies, with the original each comes out from under. */
  copies: { copy: HTMLElement; original: HTMLElement }[];
  scope: Set<string> | null;
  stagger: number;
}

/** What drops for an arrival, from the page as it is now. */
export function planDrop(root: HTMLElement, change: Change, after: Layout, before: Layout, kind: MotionKind): DropPlan {
  const addedSessions = new Set(change.addedSessions);
  const addedParts = new Set(change.addedParts);
  const drops: HTMLElement[] = [];
  const copies: DropPlan["copies"] = [];
  const frames: HTMLElement[] = [];
  const scope = new Set<string>();
  for (const key of change.addedParts) {
    const head = partHeadEl(root, key);
    if (head) drops.push(head);
    const frame = partEl(root, key);
    if (frame) frames.push(frame);
  }
  for (const key of change.addedSessions) {
    if (addedParts.has(after.sessions.get(key) ?? "")) continue;
    const head = headEl(root, key);
    if (head) drops.push(head);
    scope.add(key);
  }
  for (const id of change.addedTiles) {
    const session = after.tiles.get(id) ?? "";
    const el = tileEl(root, id);
    if (!el) continue;
    if (session) scope.add(session);
    if (addedSessions.has(session) || addedParts.has(after.sessions.get(session) ?? "")) {
      drops.push(el);
      continue;
    }
    const original = kind === "duplicate" ? (el.previousElementSibling as HTMLElement | null) : null;
    if (original && original.getAttribute("data-skel-kind") === "tile" && !change.addedTiles.includes(original.getAttribute("data-skel-id") ?? "")) copies.push({ copy: el, original });
    else if (original && original.getAttribute("data-skel-kind") === "tile" && copies.some((entry) => entry.copy === original)) copies.push({ copy: el, original });
    else drops.push(el);
  }
  const wholeBuild = before.tiles.size === 0 && after.tiles.size > 1;
  return { drops, frames, copies, scope: wholeBuild ? null : scope.size > 0 ? scope : null, stagger: drops.length > 1 || wholeBuild ? STAGGER : 0 };
}

/* ── the hook ── */

export interface Director {
  /** What to draw: the held view while something lifts out, else what is given. */
  view: BuildListProps;
  skeleton: Skeleton | null;
  shown: boolean;
  /** The skeleton's fade has ended: take it away (`SkeletonLayer`'s `onGone`, `FADE_AFTER_MS` after it is no longer shown). */
  gone: () => void;
  /** Ids of the things leaving now. */
  busy: boolean;
}

interface Frozen {
  held: BuildListProps;
  layout: Layout;
  /** What the change was heading for: drawn at once if another change interrupts it. */
  target: BuildListProps;
  targetLayout: Layout;
  change: Change;
  started: boolean;
  label: MotionLabel | null;
}

/** A commit the director looks at once it is drawn: what changed, and the views either side, for the label to say how it moves. */
interface Work {
  change: Change;
  before: Layout;
  after: Layout;
  was: BuildListProps;
  now: BuildListProps;
}

/** Everything a change touches, as a label names it. */
const keysOf = (change: Change): string[] => [...change.removedTiles, ...change.addedTiles, ...change.removedSessions, ...change.addedSessions, ...change.removedParts, ...change.addedParts, ...change.movedTiles, ...change.movedSessions, ...change.movedParts];

const anything = (change: Change): boolean => hasRemoved(change) || hasAdded(change) || hasMoved(change);

/** The kinds of step that can change a tile's words or kind without moving it. */
const WORDS = new Set<MotionKind>(["convert", "undo", "redo"]);

export function useBuildDirector(incoming: BuildListProps, motion: ListMotion, getRoot: () => HTMLElement | null, getBusy: () => boolean = () => false): Director {
  const shownView = useRef(incoming);
  const shownLayout = useRef<Layout | null>(null);
  if (shownLayout.current === null) shownLayout.current = layoutOf(incoming);
  const frozen = useRef<Frozen | null>(null);
  const work = useRef<Work | null>(null);
  /** A tile about to be converted: the words of its kind line as they were, taken before the DOM changed, to crossfade from. */
  const words = useRef(new Map<string, Words | null>());
  const released = useRef(false);
  const remeasure = useRef<Set<string> | null | undefined>(undefined);
  /** SV-06 P3: each sequence counts up; a step that finds a newer one running stands down. */
  const sequence = useRef(0);
  const stopCap = useRef<() => void>(() => undefined);
  const [skeleton, setSkeleton] = useState<Skeleton | null>(null);
  const [shown, setShown] = useState(false);
  const [, redraw] = useState(0);

  /** A new sequence: the one running stops where its steps are (what is moving keeps moving), and this one gets its own cap. */
  const begin = (toEnd: () => void): number => {
    stopCap.current();
    sequence.current += 1;
    const mine = sequence.current;
    stopCap.current = capSequence(() => {
      if (sequence.current !== mine) return;
      toEnd();
      setShown(false);
      setSkeleton(null);
    });
    return mine;
  };
  const still = (mine: number) => sequence.current === mine;
  /** Another change while one runs: its steps stop where they are; what is moving keeps moving, and the next plan starts from there. */
  const endNow = () => {
    stopCap.current();
    sequence.current += 1;
    setShown(false);
    setSkeleton(null);
  };
  /** The skeleton fades once what it frames has ended; it is taken away when its own fade has. */
  const fadeWhen = (mine: number, ended: Promise<unknown>) => {
    void ended.then(() => {
      if (still(mine)) setShown(false);
    });
  };

  // A convert is about to land: its kind line's words are taken now, in the animator's measure, before the DOM changes.
  useLayoutEffect(
    () =>
      motion.onMeasure(() => {
        const label = motion.channel.waiting();
        const root = getRoot();
        if (label?.kind !== "convert" || !root) return;
        for (const id of label.keys) {
          const eyebrow = tileEl(root, id)?.querySelector<HTMLElement>('[data-testid$="-eyebrow"]');
          words.current.set(id, eyebrow ? captureWords(eyebrow) : null);
        }
      }),
    [motion, getRoot],
  );

  // ── which view is drawn, from the data alone ──
  let view = incoming;
  const layout = layoutOf(incoming);
  if (frozen.current && anything(diffLayout(frozen.current.targetLayout, layout))) {
    // Another change came while this one lifted: that one ends now, in its end state, and this one is drawn from there.
    shownView.current = frozen.current.target;
    shownLayout.current = frozen.current.targetLayout;
    frozen.current = null;
  }
  if (frozen.current) {
    // The same change, drawn again (a selection, a fold): what it is heading for takes the new props.
    frozen.current.target = incoming;
    view = frozen.current.held;
  } else {
    const before = shownLayout.current as Layout;
    const change = diffLayout(before, layout);
    const skipFreeze = released.current;
    released.current = false;
    // CA-21 owns a session on its way (its own lane, sockets and fall); a session replaced by another (the first one of a new post) is not a removal.
    const mine = !incoming.arriving && !shownView.current.arriving;
    if (motionOn() && mine && !skipFreeze && hasRemoved(change) && !hasAdded(change)) {
      // Held until the layout effect knows whether a label asks for a lift; with none it is let go before it is painted.
      frozen.current = { held: shownView.current, layout: before, target: incoming, targetLayout: layout, change, started: false, label: null };
      view = shownView.current;
    } else {
      if (mine && !skipFreeze && incoming !== shownView.current) work.current = { change, before, after: layout, was: shownView.current, now: incoming };
      shownView.current = incoming;
      shownLayout.current = layout;
    }
  }

  useLayoutEffect(() => {
    const element = getRoot();
    const current = frozen.current;

    // Leaving: lift what went, show the skeleton of the sessions involved, and draw the new view once the lift has ended.
    if (current && !current.started) {
      current.started = true;
      const label = motion.take(keysOf(current.change));
      if (!element || !label || !liftsFor(label.kind, current.change, current.layout)) {
        release(current);
        return;
      }
      endNow();
      current.label = label;
      const plan = planLift(element, current.change, current.layout, label.kind);
      if (plan.elements.length === 0) {
        release(current);
        return;
      }
      setSkeleton(measureStill(element, plan.scope ?? undefined));
      setShown(true);
      const lift = allOf(plan.elements.map((el, at) => liftOut([el], { delay: plan.delays[at] })));
      const mine = begin(() => {
        lift.finish();
        release(current);
      });
      // The new view is drawn when the lift has ended, however long the main thread kept it: never before, never on a guess.
      void lift.finished.then(() => {
        if (still(mine)) release(current, mine);
      });
      return;
    }

    // Just drawn the new view after a lift: the skeleton's boxes slide to their new places, then it fades when the slides end.
    if (remeasure.current !== undefined && element) {
      const scope = remeasure.current;
      remeasure.current = undefined;
      setSkeleton(measureStill(element, scope ?? undefined));
      fadeWhen(sequence.current, motion.plan().slides.finished);
    }

    const done = work.current;
    work.current = null;
    if (!done) return;
    const waiting = motion.channel.waiting();
    const changed = waiting && WORDS.has(waiting.kind) ? changedTiles(done.was, done.now) : [];
    if (!anything(done.change) && changed.length === 0) return;
    const label = motion.take([...keysOf(done.change), ...changed]);
    if (!label || !element || !motionOn()) return;
    endNow();

    // Converted: its kind line crossfades ("Prompt" to "Agent"); what stood below has already slid with its new size.
    if (label.kind === "convert") {
      for (const id of changed) {
        const eyebrow = tileEl(element, id)?.querySelector<HTMLElement>('[data-testid$="-eyebrow"]');
        if (eyebrow) crossfadeFrom(words.current.get(id) ?? null, eyebrow);
      }
      words.current.clear();
      return;
    }

    const { change } = done;
    // Moved, or only its words changed: the skeleton of the containers involved shows while it slides, and it is outlined once.
    if (!hasAdded(change) && !hasRemoved(change) && !getBusy()) {
      const shifted = hasMoved(change);
      const ringed = shifted ? [] : label.kind === "undo" || label.kind === "redo" ? changed : [];
      const scope = new Set<string>();
      const things: (HTMLElement | null)[] = [];
      for (const id of [...change.movedTiles, ...ringed]) {
        scope.add(done.after.tiles.get(id) ?? "");
        scope.add(done.before.tiles.get(id) ?? "");
        things.push(tileEl(element, id));
      }
      for (const key of change.movedSessions) {
        scope.add(key);
        things.push(sessionEl(element, key));
      }
      for (const key of change.movedParts) things.push(partEl(element, key));
      const targets = present(things);
      if (targets.length === 0) return;
      const rings: MotionRun[] = [];
      const mine = begin(() => rings.forEach((run) => run.finish()));
      const ring = () => {
        if (still(mine)) for (const target of targets) rings.push(outlineOnce(target));
      };
      if (shifted) {
        setSkeleton(measureStill(element, scope));
        setShown(true);
        // The ring comes where it lands, once the slide has brought it there; the skeleton fades as it does.
        const slides = motion.plan().slides.finished;
        void slides.then(ring);
        fadeWhen(mine, slides);
      } else ring();
      return;
    }

    // Arriving: the new view is there; what came waits, see-through, while the gap opens, then drops.
    if (hasAdded(change)) {
      const plan = planDrop(element, change, done.after, done.before, label.kind);
      if (plan.drops.length + plan.copies.length + plan.frames.length === 0) return;
      setSkeleton(measureStill(element, plan.scope ?? undefined));
      setShown(true);
      // What came waits, see-through, while the gap opens (its delay, on the same clock as the slide: this commit's plan, as long
      // as its longest move), then drops.
      const gap = Math.max(SLIDE, motion.plan().ms);
      const open = plan.stagger > 0 && plan.drops.length > 1 ? SKELETON_IN : gap;
      const arriving = allOf([...plan.frames.map((frame) => openFrame(frame, { delay: gap })), dropIn(plan.drops, { stagger: plan.stagger, delay: open }), ...plan.copies.map(({ copy, original }) => copyOut(copy, original, open))]);
      const mine = begin(() => arriving.finish());
      fadeWhen(mine, arriving.finished);
    }
  });

  /** The lift has ended (or there was none to make): draw the new view; whatever stood below slides up by the gap. */
  function release(current: Frozen, mine?: number) {
    if (frozen.current !== current || (mine !== undefined && !still(mine))) return;
    // The skeleton follows the slide only after a lift it was shown for.
    remeasure.current = current.label ? null : undefined;
    frozen.current = null;
    released.current = true;
    redraw((value) => value + 1);
  }

  useLayoutEffect(() => () => stopCap.current(), []);

  return { view, skeleton, shown, gone: () => setSkeleton(null), busy: frozen.current !== null };
}

/** A copy slides out from under its original: it starts at the original's place, behind it, and moves to its own while fading in. */
function copyOut(copy: HTMLElement, original: HTMLElement, delay: number): MotionRun {
  const box = original.getBoundingClientRect();
  const from: Box = { x: box.left, y: box.top, w: box.width, h: box.height };
  const was = original.style.zIndex;
  original.style.zIndex = "1";
  const run = slideOut(copy, from, DROP, delay);
  const done = () => {
    original.style.zIndex = was;
  };
  void run.finished.then(done);
  return run;
}
