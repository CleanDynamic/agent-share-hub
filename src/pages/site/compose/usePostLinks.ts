/* CA-06 P3 — what a link in the composer's post does, and the way back to it.

   Clicking a link (or Go to it on its card): the part comes to the middle of the window (the List's tile or session
   head, or the Map's box, centred in the map's well), is outlined for 1.6 seconds, is selected so Details shows it,
   and its window opens. A tile inside an agent or a team opens its parents first (the Map's trail; a team's agent in
   the List). A prompt opens the full prompt window, as a double-click does; any other part opens the part window.

   From a link, the window's footer offers Back to the post: the window closes, the words come to the middle, take
   focus and are outlined for 1.6 seconds. Closing it any other way leaves focus on the part and outlines it again.

   The List says which parts the post mentions, with its own Back to the post. */

import { useCallback, useMemo, useRef, useState, type MutableRefObject } from "react";

import { windowPrompts } from "@/components/build/FullPromptWindow";
import { centre, focusable, focusGroup, partElement, type PartRegistry } from "@/components/build/partNav";
import { flashOutline } from "@/components/post/RefLinks";
import { focusRing } from "@/lib/theme/focus";
import { t } from "@/lib/theme/tokens";
import { FOLD } from "@/lib/build/buildMotion";
import { groupKey, type SessionGroup, type Step } from "@/lib/build/graph";
import { refLookup, type RefEntry, type RefGroup } from "@/lib/build/postRefs";
import { parseRefTo, refTo } from "@/lib/build/thread";

import { goToIt } from "./buildMotion";

/** The steps that hold a part, outermost first, and the part; empty when it is not in the build. */
export function pathTo(steps: readonly Step[], id: string): Step[] {
  for (const step of steps) {
    if (step.id === id) return [step];
    const inner = pathTo([...step.children.filter((child) => !child.id.endsWith(":instructions")), ...(step.sentWith ?? [])], id);
    if (inner.length) return [step, ...inner];
  }
  return [];
}

/** After the page has drawn what a state change asked for: two frames, so a newly opened agent is laid out. */
const afterPaint = (run: () => void) => {
  if (typeof window.requestAnimationFrame !== "function") return void window.setTimeout(run, 0);
  window.requestAnimationFrame(() => window.requestAnimationFrame(run));
};

/** The words of a link in the post, for Back to the post: the ones clicked if they are still there, else the first. */
function wordsFor(to: string, clicked: HTMLElement | null): HTMLElement | null {
  if (clicked?.isConnected) return clicked;
  return document.querySelector<HTMLElement>(`[data-testid="sandbox-post"] [data-ref="${CSS.escape(to)}"]`);
}

export interface PostLinksInput {
  steps: readonly Step[];
  groups: readonly SessionGroup[];
  refGroups: readonly RefGroup[];
  registry: PartRegistry;
  lens: "list" | "map";
  phone: boolean;
  setSelectedId: (id: string) => void;
  setOpenPromptId: (id: string | null) => void;
  /** The agents and teams open in the Map, outermost first. Absent: nothing opens inside the Map (CA-17). */
  setTrail?: (ids: readonly string[]) => void;
  /** CA-19 P3: the build's groups as link targets (`groupRefEntries`), for Go to the group. */
  groupEntries?: ReadonlyMap<string, RefEntry>;
  /** CA-22 P6: the sessions that are folded, and the way to open one. A component inside a folded session opens it first (it unfolds over `FOLD`). */
  fold?: MutableRefObject<{ closed: ReadonlySet<string>; open: (key: string) => void } | null>;
}

export function usePostLinks({ steps, groups, refGroups, registry, lens, phone, setSelectedId, setOpenPromptId, setTrail, groupEntries, fold }: PostLinksInput) {
  const lookup = useMemo(() => refLookup(refGroups), [refGroups]);
  const [openPart, setOpenPart] = useState<string | null>(null);
  /** The link the open window came from: its part and its words. */
  const [fromPost, setFromPost] = useState<{ to: string; words: HTMLElement | null } | null>(null);
  const [reveal, setReveal] = useState<{ id: string; n: number } | null>(null);
  const [mentioned, setMentioned] = useState<ReadonlySet<string>>(new Set());
  /** Back to the post was pressed: the words get focus as the window lets it go. */
  const pendingBack = useRef<{ to: string; words: HTMLElement | null } | null>(null);
  const shownTo = useRef<string | null>(null);

  const onMentions = useCallback((tos: string[]) => {
    setMentioned((previous) => (previous.size === tos.length && tos.every((to) => previous.has(to)) ? previous : new Set(tos)));
  }, []);

  /** The element drawing a part, or the nearest step round it that is drawn (a tile inside a Map box is a row). */
  const elementFor = useCallback(
    (to: string): HTMLElement | null => {
      const found = partElement(registry, to);
      if (found) return found;
      const target = parseRefTo(to);
      if (target?.kind !== "node") return null;
      const path = pathTo(steps, target.id);
      for (let at = path.length - 2; at >= 0; at -= 1) {
        const around = partElement(registry, refTo({ kind: "node", id: path[at].id }));
        if (around) return around;
      }
      return null;
    },
    [registry, steps],
  );

  /** The List: to the middle (`pageScroll.ts`) when not in view, then outlined once in the link's colour. The Map's well scrolls sideways too, and keeps its way. */
  const arrive = useCallback(
    (el: HTMLElement, colour: string | null) => {
      if (lens === "map" && !phone) {
        centre(el);
        flashOutline(el);
      } else goToIt(el, colour);
    },
    [lens, phone],
  );

  /** Brings a part in: centred, outlined, selected, its window open. `words` is the link it came from, if any. */
  const goToNow = useCallback(
    (to: string, words: HTMLElement | null) => {
      const target = parseRefTo(to);
      const entry = lookup.get(to) ?? groupEntries?.get(to);
      if (!target || !entry) return;
      shownTo.current = to;
      // CA-19 P3: a group has no window. Its members are selected (the first in Details) and outlined, the rest dimmed, until Escape.
      if (target.kind === "group") {
        const members = entry.group?.members.map((member) => member.to) ?? [];
        const first = parseRefTo(members[0]);
        if (first && first.kind !== "group") setSelectedId(first.id);
        afterPaint(() => focusGroup(registry, members, t.dimFilter, { width: focusRing.outlineWidth, style: focusRing.outlineStyle, colour: focusRing.outlineColor, offset: focusRing.outlineOffset }));
        return;
      }
      // CA-17 P5: a whole part has no window: its head (the List) or its label (the Map) comes to the middle and is outlined.
      if (target.kind === "workstream") {
        afterPaint(() => {
          const el = elementFor(to);
          if (el) arrive(el, entry.colour);
        });
        return;
      }
      if (target.kind === "node") {
        const path = pathTo(steps, target.id);
        const containers = path.slice(0, -1).filter((step) => step.kind === "agent" || step.kind === "team");
        if (lens === "map" && !phone) setTrail?.(containers.map((step) => step.id));
        setReveal((previous) => ({ id: target.id, n: (previous?.n ?? 0) + 1 }));
      } else if (lens === "map" && !phone) setTrail?.([]);
      setSelectedId(target.id);
      afterPaint(() => {
        const el = elementFor(to);
        if (el) arrive(el, entry.colour);
        setFromPost(words ? { to, words } : null);
        const isPrompt = target.kind === "node" && windowPrompts(steps).some((step) => step.id === target.id);
        if (isPrompt) setOpenPromptId(target.id);
        else setOpenPart(to);
      });
    },
    [lookup, groupEntries, registry, steps, lens, phone, setTrail, setSelectedId, elementFor, setOpenPromptId, arrive],
  );

  /** CA-22 P6: a component inside a folded session unfolds that session first, and is gone to once it has opened. */
  const goTo = useCallback(
    (to: string, words: HTMLElement | null) => {
      const target = parseRefTo(to);
      const closed = fold?.current?.closed;
      if (closed && closed.size > 0 && target?.kind === "node") {
        const top = pathTo(steps, target.id)[0];
        const session = top ? groups.find((group) => group.stepNumbers.includes(top.number)) : undefined;
        const key = session ? groupKey(session) : null;
        if (key && closed.has(key)) {
          fold?.current?.open(key);
          window.setTimeout(() => goToNow(to, words), FOLD);
          return;
        }
      }
      goToNow(to, words);
    },
    [fold, steps, groups, goToNow],
  );

  /** The words a link is made of: to the middle, focused, outlined. */
  const showWords = useCallback((to: string, clicked: HTMLElement | null) => {
    const el = wordsFor(to, clicked);
    if (!el) return;
    centre(el);
    el.focus({ preventScroll: true });
    flashOutline(el);
  }, []);

  /** Back to the post, from a window's footer: the window closes and the words come back. */
  const backToPost = useCallback(() => {
    pendingBack.current = fromPost;
    setOpenPart(null);
    setOpenPromptId(null);
    setFromPost(null);
    // The post is hidden while an agent or a team is open in the Map.
    setTrail?.([]);
    // The window hands focus back as it closes (onCloseAutoFocus); this is for a window that did not.
    window.setTimeout(() => {
      const from = pendingBack.current;
      pendingBack.current = null;
      if (from) showWords(from.to, from.words);
    }, 300);
  }, [fromPost, setOpenPromptId, setTrail, showWords]);

  /** The List's "Back to the post" under a part the post mentions. */
  const backToMention = useCallback((to: string) => afterPaint(() => showWords(to, null)), [showWords]);

  /** A window opened from a link closed some other way: focus stays on the part, outlined again. */
  const onCloseAutoFocus = useCallback(
    (event: Event) => {
      const to = shownTo.current;
      shownTo.current = null;
      const back = pendingBack.current;
      if (back) {
        event.preventDefault();
        pendingBack.current = null;
        afterPaint(() => showWords(back.to, back.words));
        return;
      }
      if (!to) return;
      event.preventDefault();
      const el = elementFor(to);
      if (!el) return;
      focusable(el).focus({ preventScroll: true });
      flashOutline(el);
    },
    [elementFor, showWords],
  );

  /** A row in a team's or a session's window: that part, keeping the way back to the post. */
  const goFromWindow = useCallback((to: string) => goTo(to, fromPost?.words ?? null), [goTo, fromPost]);

  const closeWindows = useCallback(() => {
    setOpenPart(null);
    setFromPost(null);
  }, []);

  return { lookup, goTo, goFromWindow, openPart, closeWindows, fromPost: Boolean(fromPost), backToPost, backToMention, onCloseAutoFocus, mentioned, onMentions, reveal };
}
