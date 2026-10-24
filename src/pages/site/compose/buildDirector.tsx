/* CA-22 P2, P3: the build page's leaving and arriving, directed from what changed.

   THE PAGE LEARNS WHAT CHANGED by comparing the layout it drew (`layoutOf`: which tiles, in which sessions, in which parts) with the
   one it is now given. It learns HOW from the intent the action announced (`motionIntent.ts`). With no fresh intent nothing
   moves: a build swapped for another, or a write from another tab, simply appears.

   LEAVING (something went). The old view is held on screen, in place, while what went lifts out (`LIFT`: fades and rises 8). The
   skeleton of the sessions involved shows meanwhile (their lanes and sockets; the removed one's socket stays where it was). Then
   the new view is drawn and everything slides by the gap (`SLIDE`), the skeleton's boxes with it, and the numbers crossfade
   (`<Crossfade>` in the number badges). The skeleton fades out `FADE_AFTER_MS` later.
   A clear lifts every head and tile that is on screen from the last to the first, `STAGGER` apart, up to `STAGGER_CAP`.

   ARRIVING (something came). The new view is drawn at once, so its place is already measured; the things below slide to open
   the gap (`SLIDE`) while what came waits, see-through, and then drops in (`DROP`). A copy instead slides out from under its
   original. Several coming at once drop `STAGGER` apart. The skeleton of the sessions involved shows, then fades.

   Everything is a transform or an opacity, started on the Web Animations API (`buildMotion.tsx`). A new intent while one is
   running finishes it at once. Under reduced motion nothing here does anything: the new view is simply drawn. */

import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";

import { DROP, LIFT, SLIDE, STAGGER, STAGGER_CAP } from "@/lib/build/buildMotion";
import { FADE_AFTER_MS, SKELETON_IN, SKELETON_OUT } from "@/lib/build/buildMotion";
import { peekIntent, spendIntent, type MotionIntent } from "@/lib/build/motionIntent";
import type { Skeleton } from "@/lib/build/sortLayout";
import { prefersReducedMotion } from "@/lib/theme/motion";

import { measureStill } from "./arrival";
import type { BuildListProps } from "./BuildList";
import { runsOf, withEmptySessions } from "./buildRuns";
import { dropIn, finishRunning, liftOut, liftSpan, openClip, slideOut, staggerDelay, useFlip, type MotionRun } from "./buildMotion";
import { finishSlides, type Box } from "./flip";

/* ── what is on the page ── */

export interface Layout {
  /** Top-level tile id → its session's key ("" when it stands alone). */
  tiles: Map<string, string>;
  /** Session key → its part's key ("" when there are no parts). */
  sessions: Map<string, string>;
  parts: Set<string>;
}

export function layoutOf(view: BuildListProps): Layout {
  const tiles = new Map<string, string>();
  const sessions = new Map<string, string>();
  const runs = withEmptySessions(runsOf(view.steps, view.dividers), view.emptySessions ?? []);
  const partOf = new Map<string, string>();
  const parts = view.parts && view.parts.parts.length >= 2 ? view.parts : null;
  if (parts) for (const part of parts.parts) for (const key of part.sessions) partOf.set(key, part.view.key);
  for (const run of runs) {
    const key = run.head?.key ?? "";
    if (run.head) sessions.set(key, partOf.get(key) ?? (parts ? parts.parts[0].view.key : ""));
    for (const step of run.steps) tiles.set(step.id, key);
  }
  return { tiles, sessions, parts: new Set(parts ? parts.parts.map((part) => part.view.key) : []) };
}

export interface Change {
  removedTiles: string[];
  addedTiles: string[];
  removedSessions: string[];
  addedSessions: string[];
  removedParts: string[];
  addedParts: string[];
}

const missing = <K,>(from: Iterable<K>, within: { has: (key: K) => boolean }): K[] => [...from].filter((key) => !within.has(key));

export function diffLayout(before: Layout, after: Layout): Change {
  return {
    removedTiles: missing(before.tiles.keys(), after.tiles),
    addedTiles: missing(after.tiles.keys(), before.tiles),
    removedSessions: missing(before.sessions.keys(), after.sessions),
    addedSessions: missing(after.sessions.keys(), before.sessions),
    removedParts: missing(before.parts, after.parts),
    addedParts: missing(after.parts, before.parts),
  };
}

export const hasRemoved = (change: Change): boolean => change.removedTiles.length + change.removedSessions.length + change.removedParts.length > 0;
export const hasAdded = (change: Change): boolean => change.addedTiles.length + change.addedSessions.length + change.addedParts.length > 0;

/**
 * Whether a removal is worth holding the old view for. Steps that say what they remove (a remove, a clear, a merge, an undo)
 * always are. A step that only says it changed something is, when tiles went or a session that held tiles; a session with none
 * going (the placeholder first session of a new post, replaced by a real one) is bookkeeping, and draws at once.
 */
export function liftsFor(kind: MotionIntent["kind"], change: Change, before: Layout): boolean {
  if (!hasRemoved(change) || hasAdded(change)) return false;
  if (["remove", "clear", "merge", "undo", "redo", "restore"].includes(kind)) return true;
  if (kind !== "change") return false;
  return change.removedTiles.length > 0 || change.removedParts.length > 0 || change.removedSessions.some((key) => [...before.tiles.values()].includes(key));
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
export function planLift(root: HTMLElement, change: Change, before: Layout, kind: MotionIntent["kind"], stagger: number = STAGGER): LiftPlan {
  const goneParts = new Set(change.removedParts);
  const goneSessions = new Set(change.removedSessions);
  const goneTiles = new Set(change.removedTiles);
  const wholeBuild = kind === "clear" || (before.tiles.size > 0 && change.removedTiles.length === before.tiles.size);
  if (wholeBuild) {
    // Every head and tile, last to first; only those on screen are staggered, the rest go with the last of them.
    const all = [...root.querySelectorAll<HTMLElement>('[data-testid="workstream-head"], [data-testid="session-head"], [data-skel-kind="tile"]')].reverse();
    const seen = all.filter(onScreen);
    const rest = all.filter((element) => !onScreen(element));
    const staggered = seen.slice(0, STAGGER_CAP);
    const together = [...seen.slice(STAGGER_CAP), ...rest];
    const last = staggerDelay(Math.max(staggered.length - 1, 0), stagger);
    const elements = [...staggered, ...together];
    const delays = [...staggered.map((_, at) => staggerDelay(at, stagger)), ...together.map(() => last)];
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
  /** Frames that open (a new part's), revealed from the top down. */
  frames: HTMLElement[];
  /** Copies, with the original each comes out from under. */
  copies: { copy: HTMLElement; original: HTMLElement }[];
  scope: Set<string> | null;
  stagger: number;
}

/** What drops for an arrival, from the page as it is now. */
export function planDrop(root: HTMLElement, change: Change, after: Layout, before: Layout, kind: MotionIntent["kind"]): DropPlan {
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
  intent: MotionIntent;
  started: boolean;
}

export function useBuildDirector(incoming: BuildListProps, getRoot: () => HTMLElement | null): Director {
  const shownView = useRef(incoming);
  const shownLayout = useRef<Layout | null>(null);
  if (shownLayout.current === null) shownLayout.current = layoutOf(incoming);
  const frozen = useRef<Frozen | null>(null);
  const arrive = useRef<{ change: Change; intent: MotionIntent; after: Layout; before: Layout } | null>(null);
  const released = useRef(false);
  const remeasure = useRef<Set<string> | null | undefined>(undefined);
  const timers = useRef<number[]>([]);
  const runs = useRef<MotionRun[]>([]);
  const active = useRef<MotionIntent | null>(null);
  const [skeleton, setSkeleton] = useState<Skeleton | null>(null);
  const [shown, setShown] = useState(false);
  const [, redraw] = useState(0);
  const rootObject = useMemo<RefObject<HTMLElement | null>>(() => ({ get current() { return getRoot(); } }) as RefObject<HTMLElement | null>, [getRoot]);
  const flip = useFlip(rootObject);

  const later = (ms: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, ms));
  };
  /** A new intent while one runs: everything of the running one ends at once, in its end state. */
  const endNow = () => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
    for (const run of runs.current) run.finish();
    runs.current = [];
    const root = getRoot();
    if (root) {
      finishSlides(root);
      for (const element of root.querySelectorAll<HTMLElement>("*")) finishRunning(element);
    }
    setShown(false);
    setSkeleton(null);
  };

  // ── decide, while rendering, which view is drawn ──
  let view = incoming;
  const intent = peekIntent();
  const root = getRoot();
  const reduced = prefersReducedMotion();
  if (frozen.current && intent && intent !== frozen.current.intent) {
    // Another change came while this one lifted: that one ends now, in its end state, and this one is drawn from there.
    shownView.current = frozen.current.target;
    shownLayout.current = frozen.current.targetLayout;
    frozen.current = null;
  }
  if (frozen.current) {
    view = frozen.current.held;
  } else {
    const layout = layoutOf(incoming);
    const before = shownLayout.current as Layout;
    const change = diffLayout(before, layout);
    const skipFreeze = released.current;
    released.current = false;
    // CA-21 owns a session on its way (its own lane, sockets and fall); a session replaced by another (the first one of a new post) is not a removal.
    const mine = !incoming.arriving && !shownView.current.arriving;
    if (intent && (reduced || !mine) && (hasRemoved(change) || hasAdded(change))) spendIntent(intent);
    if (intent && !reduced && mine && root && !skipFreeze && liftsFor(intent.kind, change, before)) {
      frozen.current = { held: shownView.current, layout: before, target: incoming, targetLayout: layout, change, intent, started: false };
      view = shownView.current;
    } else {
      if (intent && !reduced && mine && root && hasAdded(change)) arrive.current = { change, intent, after: layout, before };
      else if (intent && skipFreeze === false && (hasRemoved(change) || hasAdded(change))) spendIntent(intent);
      shownView.current = incoming;
      shownLayout.current = layout;
    }
  }

  useLayoutEffect(() => {
    const element = getRoot();
    const current = frozen.current;
    const known = active.current;
    if (intent && known && intent !== known && (timers.current.length > 0 || runs.current.length > 0)) endNow();
    if (!element) return;

    // Leaving: lift what went, show the skeleton of the sessions involved, and draw the new view once the lift has ended.
    if (current && !current.started) {
      current.started = true;
      active.current = current.intent;
      const plan = planLift(element, current.change, current.layout, current.intent.kind);
      if (plan.elements.length === 0) {
        release(current);
        return;
      }
      setSkeleton(measureStill(element, plan.scope ?? undefined));
      setShown(true);
      plan.elements.forEach((el, at) => runs.current.push(liftOut([el], { delay: plan.delays[at] })));
      later(plan.span, () => release(current));
      return;
    }

    // Just drawn the new view after a lift: the skeleton's boxes slide to their new places, then it fades.
    if (remeasure.current !== undefined) {
      const scope = remeasure.current;
      remeasure.current = undefined;
      const next = measureStill(element, scope ?? undefined);
      setSkeleton(next);
      later(SLIDE + FADE_AFTER_MS, () => setShown(false));
      later(SLIDE + FADE_AFTER_MS + SKELETON_OUT, () => {
        setSkeleton(null);
        const spent = active.current;
        if (spent) spendIntent(spent);
      });
    }

    // Arriving: the new view is there; what came waits, see-through, while the gap opens, then drops.
    const coming = arrive.current;
    if (coming) {
      arrive.current = null;
      active.current = coming.intent;
      const plan = planDrop(element, coming.change, coming.after, coming.before, coming.intent.kind);
      if (plan.drops.length + plan.copies.length + plan.frames.length === 0) {
        spendIntent(coming.intent);
        return;
      }
      setSkeleton(measureStill(element, plan.scope ?? undefined));
      setShown(true);
      const open = plan.stagger > 0 && plan.drops.length > 1 ? SKELETON_IN : SLIDE;
      runs.current.push(openClip(plan.frames, { delay: SLIDE }));
      runs.current.push(dropIn(plan.drops, { stagger: plan.stagger, delay: open }));
      for (const { copy, original } of plan.copies) runs.current.push(copyOut(copy, original, open));
      const count = plan.drops.length + plan.copies.length;
      const last = open + (plan.stagger > 0 ? staggerDelay(count - 1, plan.stagger) : 0) + DROP;
      later(last + FADE_AFTER_MS, () => setShown(false));
      later(last + FADE_AFTER_MS + SKELETON_OUT, () => {
        setSkeleton(null);
        spendIntent(coming.intent);
      });
    }
  });

  /** The lift has ended: draw the new view; whatever stood below slides up by the gap. */
  function release(current: Frozen) {
    if (frozen.current !== current) return;
    flip.measure({ ms: SLIDE });
    remeasure.current = null;
    frozen.current = null;
    released.current = true;
    redraw((value) => value + 1);
  }

  useLayoutEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
    },
    [],
  );

  return { view, skeleton, shown, busy: frozen.current !== null };
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
