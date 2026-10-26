/* CA-27 P1: Find in build, as the page holds it.

   `/` or the Find in build button opens the field. What is typed settles for FIND_DELAY, then the targets that hold it are counted
   and the first is gone to: scrolled to the middle (`pageScroll.ts`) and ringed. Enter and Shift+Enter move between matches (wrapping);
   a match inside a folded session or part opens it for as long as the find is on that match, unless the maker opened it themselves
   meanwhile. Esc or Close find ends it and gives focus back to where it was. The count is said through the page's announcer. */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";

import { captureOpener, returnFocus, type Opener } from "@/lib/focus/windowFocus";
import { FIND_DELAY, countWords, findMatches, normaliseFind, stepMatch, type FindTarget } from "@/lib/build/findInBuild";

import { useAnnounce } from "./BuildAnnouncer";
import { scrollToMiddle } from "./buildMotion";
import { tileElement } from "./largeBuild";
import { NO_FIND, type FindView } from "@/components/build/FindHit";
import { overlayOpen } from "./useBuildSelection";

/** The element a match is drawn as. */
export function elementOf(target: FindTarget): HTMLElement | null {
  if (target.kind === "tile") return tileElement(target.id);
  const id = CSS.escape(target.id);
  return document.querySelector<HTMLElement>(target.kind === "session" ? `[data-session-key="${id}"]` : `[data-workstream-group="${id}"]`);
}

export interface BuildFindInput {
  targets: readonly FindTarget[];
  /** Whether the maker has this session or part folded. */
  isFolded: (key: string) => boolean;
  /** Off a phone only. */
  enabled?: boolean;
}

export interface BuildFind {
  open: boolean;
  /** What the field holds. */
  input: string;
  /** What the settled search is for. */
  query: string;
  /** How many matches, and the one the find is on (0-based). */
  count: number;
  at: number;
  /** "2 of 5", or "No matches"; empty while nothing is typed. */
  words: string;
  inputRef: RefObject<HTMLInputElement>;
  /** What the List draws from. */
  view: FindView;
  /** The sessions and parts the find holds open for the current match. */
  forced: ReadonlySet<string>;
  /** The maker folded or opened this one themselves: the find lets go of it. */
  release: (key: string) => void;
  show: () => void;
  close: () => void;
  setInput: (value: string) => void;
  move: (by: 1 | -1) => void;
  onFieldKey: (event: KeyboardEvent<HTMLInputElement>) => void;
}

export function useBuildFind({ targets, isFolded, enabled = true }: BuildFindInput): BuildFind {
  const announce = useAnnounce();
  const [open, setOpen] = useState(false);
  const [input, setInputState] = useState("");
  const [query, setQuery] = useState("");
  const [at, setAt] = useState(0);
  const [released, setReleased] = useState<ReadonlySet<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const opener = useRef<Opener>({ el: null, place: null });

  /* The wait: the search follows the typing by FIND_DELAY. */
  useEffect(() => {
    const next = normaliseFind(input);
    if (next === query) return;
    const timer = window.setTimeout(() => {
      setQuery(next);
      setAt(0);
    }, FIND_DELAY);
    return () => window.clearTimeout(timer);
  }, [input, query]);

  const matches = useMemo(() => (open ? findMatches(targets, query) : []), [open, targets, query]);
  const count = matches.length;
  const index = count === 0 ? 0 : Math.min(at, count - 1);
  const current = count > 0 ? matches[index] : null;
  const words = open && query ? countWords(index, count) : "";

  const forced = useMemo(() => {
    const keys = new Set<string>();
    if (!current) return keys;
    const wanted = [current.kind === "tile" ? current.session : null, current.kind === "part" ? null : current.part];
    for (const key of wanted) if (key && isFolded(key) && !released.has(key)) keys.add(key);
    return keys;
  }, [current, isFolded, released]);

  /* A new match: what the maker touched is theirs again; then go to it once its session and part are open. */
  const currentId = current?.id ?? null;
  useEffect(() => setReleased(new Set()), [currentId]);
  useEffect(() => {
    if (!current) return;
    let stop = () => undefined as void;
    const frame = window.requestAnimationFrame(() => {
      const element = elementOf(current);
      if (!element) return;
      /* In a large build the tiles above were guessed at: it is kept in the middle while they are drawn (`hold`). */
      stop = scrollToMiddle(element, { hold: true }).cancel;
    });
    return () => {
      window.cancelAnimationFrame(frame);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, forced.size]);

  useEffect(() => {
    if (words) announce(words);
  }, [words, index, announce]);

  const show = useCallback(() => {
    if (!enabled) return;
    if (!open) opener.current = captureOpener();
    setOpen(true);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [enabled, open]);

  const close = useCallback(() => {
    setOpen(false);
    setInputState("");
    setQuery("");
    setAt(0);
    returnFocus(opener.current, inputRef.current);
  }, []);

  const move = useCallback((by: 1 | -1) => setAt((now) => stepMatch(Math.min(now, Math.max(count - 1, 0)), count, by)), [count]);

  const onFieldKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      /* A press before the wait is over searches now. */
      if (normaliseFind(input) !== query) {
        setQuery(normaliseFind(input));
        setAt(0);
      } else move(event.shiftKey ? -1 : 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };

  /* Esc from anywhere else on the page ends the find too, unless a menu or window has it. */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !overlayOpen()) close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  const view = useMemo<FindView>(() => (open && query ? { query, current: currentId } : NO_FIND), [open, query, currentId]);
  const release = useCallback((key: string) => setReleased((now) => new Set(now).add(key)), []);

  return { open, input, query, count, at: index, words, inputRef, view, forced, release, show, close, setInput: setInputState, move, onFieldKey };
}
