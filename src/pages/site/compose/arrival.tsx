/* CA-21 P7: adding a session, prompts fall into place.

   Both ways of adding a session from a chat end in the page's `onAddSession`; the page says what is arriving (`Arriving`) and
   `BuildList` shows it with the pieces `skeleton.tsx` draws, nothing held:

     press        the lane opens at the end of the chosen part (scrolled to first when that is off screen); everything below slides down
                  by its height over 200 ms; the rest of the build shows its skeleton, faded in over 120 ms
     +80 ms       an empty socket for each prompt, numbered, fade in over 160 ms
     +260 ms      the session's head falls into place: from 20 above and see-through, over 240 ms
     then         each prompt falls the same way, 110 ms after the one before (from the 9th on, with the 8th); a prompt not yet
                  written waits in its socket, and so do the ones after it, so the order never jumps
     +200 ms      after the last lands, the skeleton fades over 200 ms, and the page says "Added Session 2 with 3 prompts."

   A failed add closes the lane and the sockets back over 200 ms. Under reduced motion nothing moves: the session is there, complete. */

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

import { FADE_AFTER_MS, FALL_MS, FALL_SHIFT, HEAD_AFTER_MS, LANE_OPEN_MS, PROMPT_STEP_MS, SKELETON_OUT, STAGGERED_PROMPTS } from "@/lib/build/buildMotion";
import { skeletonOf, type Skeleton, type SkeletonContainer, type SkeletonItem } from "@/lib/build/sortLayout";
import { prefersReducedMotion, scrollBehavior, STANDARD } from "@/lib/theme/motion";

import { play, SLIDE_ATTR, snapshot, type Box } from "./flip";
import { ImportProgress, SocketBlocks, WrittenPrompt, useSlow } from "./ImportingPieces";
import { SessionHead } from "./SessionHead";
import type { SourceSession } from "./sourcesModel";
import { RUN } from "./tileRecipes";
import { leftEdge, naturalBox } from "./useBuildSorting";

/** What the page says is arriving. */
export interface Arriving {
  /** The session's key: the import's id, or the key made here. */
  key: string;
  /** A session from a chat, or an empty one the maker started. */
  kind: "chat" | "empty";
  /** Its head, as the library says it so far. */
  head: SourceSession;
  /** How many prompts it will have. */
  count: number;
  /** The part it joins; none: the end of the build (the last part, with parts). */
  part?: string;
  /** CA-24 P4: how far the import has got, when it can say. Absent: the tag and the sockets show, with no bar or count. */
  progress?: { done: number; total: number };
  /** CA-24 P4: the text of the prompts already in, when the import can say. Their sockets show them; the others show building blocks. */
  written?: readonly string[];
  /** CA-24 P4: ends the import, keeping what is in. Absent: it cannot be stopped, and there is no Stop. */
  onStop?: () => void;
  /** Writing: the rows are on their way. Written: the data has them. Failed: nothing was added. */
  status: "writing" | "written" | "failed";
}

type Phase = "idle" | "scrolling" | "open" | "landing" | "closing" | "quiet";

export interface Arrival {
  /** The placeholder session (its head and a place for each prompt) is drawn now. */
  block: boolean;
  /** Something is arriving: an empty session shows its place to drop. */
  active: boolean;
  skeleton: Skeleton | null;
  shown: boolean;
  /** The sockets that fade in with the lane. */
  fadeIn: ReadonlySet<string>;
  /** The lanes that open. */
  opening: ReadonlySet<string>;
}

const NONE: ReadonlySet<string> = new Set();

/** The median height of the prompts already on the page: what a place for a prompt not yet written is. */
function estimate(root: HTMLElement): number {
  const heights = [...root.querySelectorAll<HTMLElement>('[data-skel-kind="tile"]')].map((element) => naturalBox(element).h).filter((h) => h > 0).sort((a, b) => a - b);
  return heights.length > 0 ? Math.round(heights[Math.floor(heights.length / 2)]) : 108;
}

/** The page, as a skeleton with nothing held: every tile's socket, every session's lane, the numbers. `only` (CA-22): just these sessions. */
export function measureStill(root: HTMLElement, only?: ReadonlySet<string>): Skeleton {
  const origin = naturalBox(root);
  const rel = (box: Box) => ({ x: box.x - origin.x, y: box.y - origin.y, w: box.w, h: box.h });
  const items: SkeletonItem[] = [...root.querySelectorAll<HTMLElement>('[data-skel-kind="tile"]')].filter((element) => !only || only.has(element.getAttribute("data-skel-container") ?? "")).map((element) => ({
    id: element.getAttribute("data-skel-id") as string,
    container: element.getAttribute("data-skel-container") ?? "",
    rect: rel(naturalBox(element)),
    radius: Number.parseFloat(typeof getComputedStyle === "function" ? getComputedStyle(element.firstElementChild ?? element).borderTopLeftRadius : "") || 10,
  }));
  const containers: SkeletonContainer[] = [...root.querySelectorAll<HTMLElement>('[data-skel-kind="session"]')].filter((element) => !only || only.has(element.getAttribute("data-skel-id") ?? "")).map((element) => {
    const id = element.getAttribute("data-skel-id") as string;
    return { id, rect: rel(naturalBox(element)), items: items.filter((item) => item.container === id).map((item) => item.id), framed: false, name: element.getAttribute("data-skel-name") ?? `Session` };
  });
  const left = items.length > 0 ? Math.min(...items.map((item) => item.rect.x)) + origin.x : origin.x;
  return skeletonOf({ kind: "tile", items, containers, held: null, moved: false, room: left - leftEdge() });
}

/** Where the new session will stand: the end of the part, or of the build. */
function anchorOf(root: HTMLElement, part: string | undefined): HTMLElement {
  const parts = [...root.querySelectorAll<HTMLElement>('[data-skel-kind="part"]')];
  if (parts.length > 0) return (part ? parts.find((element) => element.getAttribute("data-skel-id") === part) : undefined) ?? parts[parts.length - 1];
  const sessions = [...root.querySelectorAll<HTMLElement>('[data-skel-kind="session"]')];
  return sessions[sessions.length - 1] ?? root;
}

const fall = (element: Element, delay: number): Animation | null => {
  if (typeof (element as HTMLElement).animate !== "function") return null;
  return (element as HTMLElement).animate(
    [
      { opacity: 0, transform: `translateY(-${FALL_SHIFT}px)` },
      { opacity: 1, transform: "none" },
    ],
    { duration: FALL_MS, delay, easing: STANDARD, fill: "backwards" },
  );
};

export function useArrival(input: { arriving: Arriving | null | undefined; landed: boolean; rootRef: RefObject<HTMLElement | null>; onArrived?: (key: string, status: Arriving["status"]) => void }): Arrival {
  const { arriving, landed, rootRef } = input;
  const [phase, setPhase] = useState<Phase>("idle");
  const [skeleton, setSkeleton] = useState<Skeleton | null>(null);
  const [shown, setShown] = useState(false);
  const [tick, setTick] = useState(0);
  const [fade, setFade] = useState<ReadonlySet<string>>(NONE);
  const before = useRef<Map<string, Box> | null>(null);
  const headAt = useRef(0);
  const timers = useRef<number[]>([]);
  const callback = useRef(input.onArrived);
  callback.current = input.onArrived;
  const key = arriving?.key ?? null;
  const status = arriving?.status ?? null;

  const clear = () => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  };
  const later = (ms: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, ms));
  };
  useEffect(() => clear, []);

  // It begins: scrolled to first when its place is off screen, then the lane opens.
  useEffect(() => {
    if (!key) return;
    const root = rootRef.current;
    if (prefersReducedMotion() || !root) {
      setPhase("quiet");
      return;
    }
    const anchor = anchorOf(root, arriving?.part);
    const box = anchor.getBoundingClientRect();
    const off = box.bottom < 0 || box.bottom > window.innerHeight;
    const open = () => {
      before.current = snapshot(root);
      headAt.current = performance.now() + HEAD_AFTER_MS;
      setShown(true);
      setPhase("open");
    };
    if (off && typeof anchor.scrollIntoView === "function") {
      setPhase("scrolling");
      anchor.scrollIntoView({ block: "center", behavior: scrollBehavior() });
      later(scrollBehavior() === "smooth" ? 450 : 0, open);
    } else open();
    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // The data has the session: its head and prompts fall into their sockets, in turn.
  useEffect(() => {
    if (phase === "quiet" && key && landed) {
      callback.current?.(key, "written");
      setPhase("idle");
      return;
    }
    if (phase !== "open" || !landed || !key || status === "failed") return;
    setPhase("landing");
  }, [phase, landed, key, status]);

  useLayoutEffect(() => {
    if (phase !== "landing" || !key) return;
    const root = rootRef.current;
    if (!root) return;
    const now = performance.now();
    const head = root.querySelector(`[data-session-key="${key}"] [data-testid="session-head"]`);
    const toHead = Math.max(0, headAt.current - now);
    // The head falls when its turn comes; if the placeholder's already did, the real one is simply there.
    if (head && toHead > 0) fall(head, toHead);
    const tiles = [...root.querySelectorAll(`[data-skel-kind="tile"][data-skel-container="${key}"]`)];
    // The first prompt waits for its turn, 110 ms after the head, and for its row; the others follow, 110 ms apart.
    const first = Math.max(0, headAt.current + PROMPT_STEP_MS - now);
    tiles.forEach((tile, at) => fall(tile, first + PROMPT_STEP_MS * Math.min(at, STAGGERED_PROMPTS - 1)));
    const last = tiles.length > 0 ? first + PROMPT_STEP_MS * Math.min(tiles.length - 1, STAGGERED_PROMPTS - 1) + FALL_MS : toHead + FALL_MS;
    later(last + FADE_AFTER_MS, () => setShown(false));
    later(last + FADE_AFTER_MS + SKELETON_OUT, () => {
      setSkeleton(null);
      setPhase("idle");
      callback.current?.(key, "written");
    });
    setTick((value) => value + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Nothing was added: the lane and the sockets close back, and everything slides up again.
  useLayoutEffect(() => {
    if (status !== "failed" || !key || (phase !== "open" && phase !== "scrolling")) return;
    clear();
    setShown(false);
    setPhase("closing");
    later(LANE_OPEN_MS, () => {
      setSkeleton(null);
      setPhase("idle");
      callback.current?.(key, "failed");
    });
  }, [status, key, phase]);

  const block = phase === "open" && status === "writing" && !landed;

  // After every change of what is drawn: slide what moved, and measure the page for the layer.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || phase === "idle" || phase === "quiet") return;
    if (before.current) {
      play(root, before.current, LANE_OPEN_MS);
      before.current = null;
    }
    if (phase === "open" || phase === "landing") {
      const next = measureStill(root);
      const same = (a: Skeleton | null) => a !== null && JSON.stringify(a) === JSON.stringify(next);
      setSkeleton((current) => (same(current) ? current : next));
      // The new session's sockets fade in with its lane.
      const mine = key ? [...root.querySelectorAll(`[data-skel-kind="tile"][data-skel-container="${key}"]`)].map((element) => element.getAttribute("data-skel-id") as string) : [];
      setFade((current) => (current.size === mine.length && mine.every((id) => current.has(id)) ? current : new Set(mine)));
    }
  });

  void tick;
  const opening = key && (phase === "open" || phase === "landing") ? new Set([key]) : NONE;
  return { block, active: phase === "open" || phase === "landing" || phase === "closing", skeleton, shown, fadeIn: fade, opening };
}

/** The place for the session while its prompts are on their way: its head, and an empty place for each prompt. */
export function ArrivingBlock({ arriving, rootRef, first }: { arriving: Arriving; rootRef: RefObject<HTMLElement | null>; first: boolean }) {
  const height = useRef<number | null>(null);
  if (height.current === null) height.current = rootRef.current ? estimate(rootRef.current) : 108;
  const head = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (head.current && typeof head.current.animate === "function" && !prefersReducedMotion()) fall(head.current, HEAD_AFTER_MS);
  }, []);
  /* CA-24 P4: past a second, a chat's import shows it is working: the tag, building blocks in each empty socket, and, when the import can say how far it is, the bar. */
  const slow = useSlow(arriving.kind === "chat" && arriving.status === "writing");
  return (
    <div
      data-testid="arriving-session"
      data-skel-kind="session"
      data-skel-id={arriving.key}
      data-skel-container={arriving.part ?? ""}
      data-skel-name={`Session ${arriving.head.number}`}
      {...{ [SLIDE_ATTR]: `session:${arriving.key}` }}
      style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, ...(first ? null : { marginTop: 16 }) }}
    >
      <div ref={head} data-testid="arriving-head" style={{ position: "relative" }}>
        <SessionHead session={arriving.head} phone={false} tiles={arriving.count} collapsed={false} controls={`session-tiles-${arriving.key}`} onToggle={() => undefined} first={false} last={false} editable={false} importing={slow} />
      </div>
      {arriving.count > 0 ? (
        <div id={`session-tiles-${arriving.key}`} data-testid="session-tiles" style={RUN}>
          {Array.from({ length: arriving.count }, (_, at) => (
            <div key={at} data-skel-kind="tile" data-skel-id={`${arriving.key}:wait:${at}`} data-skel-container={arriving.key} data-testid="arriving-place" style={{ position: "relative", height: height.current ?? 108, visibility: "hidden" }}>
              {arriving.written && at < arriving.written.length ? <WrittenPrompt text={arriving.written[at]} /> : slow ? <SocketBlocks /> : null}
            </div>
          ))}
        </div>
      ) : null}
      {slow ? <ImportProgress progress={arriving.progress} onStop={arriving.progress ? arriving.onStop : undefined} /> : null}
    </div>
  );
}
