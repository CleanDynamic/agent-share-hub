/* PT-05 — the thread of the composer's Post tab: the document, and its save.

   THE DOCUMENT LIVES HERE, NOT IN THE TAB. The tab (and its editor) goes when
   the maker switches to Build, so what has been typed is held in a ref and the
   editor opens on it again. The tab count and the status line read this hook
   too, which is why it sits in the page and not in the tab.

   A BUILD WITH NO post_doc opens on `threadOf(build, media)`: the old post as a
   thread, each picture its own post, so it can be edited. Nothing is written
   until something changes; the first save writes post_doc.

   SAVING is `saveThread` on the composer's own debounce (SAVE_DEBOUNCE_MS), and
   it reports through the same three facts the header save does, so the status
   line reads them with `saveState`. A thread that cannot be saved (a post over
   1,000 characters, a link that is not http, https or mailto) WAITS: nothing is
   sent, and `hold` is the sentence the status line says. When the thread's first
   picture changes, the cover's evidence follows it (`syncThreadCover`).

   THE FIRST CHANGE MAKES THE DRAFT, as it does for a title: on /compose/new the
   save asks the page for the build (`ensureBuild`) before writing to it. */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { composeBuildQueryKey, SAVE_DEBOUNCE_MS } from "@/hooks/useComposeBuild";
import { syncThreadCover } from "@/lib/build/composeCover";
import { getThreadMedia, isThreadDoc, saveThread, splitThread, threadMediaIds, threadOf, type ThreadDoc } from "@/lib/build/thread";
import { emptyThread, holdSentence, sameThread, tidyThread } from "@/lib/build/threadEditor";
import type { Build } from "@/lib/build/types";

import { saveState, type SaveState } from "./composeModel";

/** Marks a thread that was opened before its build existed. */
const NEW = "new";

export interface ComposeThread {
  /** "loading" until the document is known; "error" when the old post's pictures could not be read. */
  status: "loading" | "ready" | "error";
  /** Changes whenever the document is read afresh, so the editor opens again on it. */
  version: number;
  /** The document as it stands, edits since the tab opened included. */
  readDoc: () => ThreadDoc;
  /** The editor's every change. */
  onDoc: (doc: ThreadDoc) => void;
  /** Posts, counted as the Gallery counts them (an empty post at either end is not one). */
  posts: number;
  save: SaveState;
  /** A sentence while the save is waiting, else null. */
  hold: string | null;
  /** Writes what is waiting now; resolves once it has landed or cannot. */
  flush: () => Promise<void>;
  retry: () => void;
  retryLoad: () => void;
}

export interface UseComposeThreadInput {
  build: Build | null;
  buildId: string | undefined;
  isOwner: boolean;
  ensureBuild: () => Promise<string>;
}

export function useComposeThread({ build, buildId, isOwner, ensureBuild }: UseComposeThreadInput): ComposeThread {
  const queryClient = useQueryClient();

  const docRef = useRef<ThreadDoc>(emptyThread());
  const savedRef = useRef<ThreadDoc>(emptyThread());
  const originRef = useRef<string | null>(null);
  const idRef = useRef<string | undefined>(buildId);
  const lastFirstRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const holdRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const againRef = useRef(false);
  const writableRef = useRef(false);
  const ensureRef = useRef(ensureBuild);
  ensureRef.current = ensureBuild;
  idRef.current = buildId ?? idRef.current;
  writableRef.current = !buildId || isOwner;

  const [version, setVersion] = useState(0);
  const [posts, setPosts] = useState(0);
  const [hold, setHold] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  /* ── opening ── */

  const needsMedia = Boolean(buildId && build && build.id === buildId && !isThreadDoc(build.post_doc));
  const media = useQuery({
    queryKey: ["build", "getThreadMedia", buildId],
    queryFn: () => getThreadMedia(buildId as string),
    enabled: needsMedia && isOwner,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const start = useCallback(
    (doc: ThreadDoc, origin: string) => {
      clearTimer();
      originRef.current = origin;
      docRef.current = doc;
      savedRef.current = doc;
      dirtyRef.current = false;
      lastFirstRef.current = threadMediaIds(doc)[0] ?? null;
      holdRef.current = holdSentence(doc);
      setHold(holdRef.current);
      setPosts(splitThread(doc).length);
      setVersion((current) => current + 1);
    },
    [clearTimer],
  );

  useEffect(() => {
    const want = buildId ?? NEW;
    if (originRef.current === want) return;
    if (!buildId) {
      start(emptyThread(), NEW);
      return;
    }
    // Typed before the draft existed: keep it, it belongs to this build now.
    if (originRef.current === NEW && dirtyRef.current) {
      originRef.current = buildId;
      return;
    }
    if (!build || build.id !== buildId) return;
    if (needsMedia && !media.isSuccess) return;
    start(threadOf(build, needsMedia ? (media.data ?? []) : []) ?? emptyThread(), buildId);
  }, [buildId, build, needsMedia, media.isSuccess, media.data, start]);

  /* ── saving ── */

  const flush = useCallback(async (): Promise<void> => {
    clearTimer();
    if (inFlightRef.current) {
      againRef.current = true;
      return inFlightRef.current;
    }
    if (!writableRef.current) return;

    const run = async () => {
      const doc = docRef.current;
      const waiting = dirtyRef.current && !holdSentence(doc);
      const behind = !dirtyRef.current && (threadMediaIds(savedRef.current)[0] ?? null) !== lastFirstRef.current;
      if (!waiting && !behind) return;

      setIsSaving(true);
      try {
        const id = await ensureRef.current();
        idRef.current = id;
        if (originRef.current === NEW) originRef.current = id;

        if (waiting) {
          await saveThread(id, tidyThread(doc));
          savedRef.current = doc;
          dirtyRef.current = !sameThread(docRef.current, doc);
        }

        // The cover's evidence follows the thread's first picture.
        const first = threadMediaIds(savedRef.current)[0] ?? null;
        if (first !== lastFirstRef.current) {
          await syncThreadCover(id, first, lastFirstRef.current);
          lastFirstRef.current = first;
          await queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(id) });
        }
        setSaveError(null);
        setLastSavedAt(new Date());
      } catch (cause) {
        console.error("[Compose] thread save failed", cause);
        setSaveError(cause instanceof Error ? cause : new Error(String(cause)));
      } finally {
        setIsSaving(false);
      }
    };

    const open = run();
    inFlightRef.current = open;
    try {
      await open;
    } finally {
      inFlightRef.current = null;
      // Typed while the write was open: it goes out on the next quiet moment.
      if ((againRef.current || dirtyRef.current) && !holdRef.current && timerRef.current === null) {
        againRef.current = false;
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          void flush();
        }, SAVE_DEBOUNCE_MS);
      }
    }
  }, [clearTimer, queryClient]);

  const schedule = useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void flush();
    }, SAVE_DEBOUNCE_MS);
  }, [clearTimer, flush]);

  const onDoc = useCallback(
    (doc: ThreadDoc) => {
      docRef.current = doc;
      const sentence = holdSentence(doc);
      holdRef.current = sentence;
      setHold(sentence);
      setPosts(splitThread(doc).length);
      dirtyRef.current = !sameThread(doc, savedRef.current);
      clearTimer();
      if (!dirtyRef.current || sentence || !writableRef.current) return;
      schedule();
    },
    [clearTimer, schedule],
  );

  // Typed while the build it makes was still loading (so its owner was not yet known): written once it is.
  useEffect(() => {
    if (isOwner && dirtyRef.current && !holdRef.current && timerRef.current === null && !inFlightRef.current) schedule();
  }, [isOwner, schedule]);

  // Leaving the composer mid-debounce must not lose the last words typed.
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      const id = idRef.current;
      if (id && dirtyRef.current && !holdRef.current && writableRef.current) {
        void saveThread(id, tidyThread(docRef.current)).catch(() => undefined);
      }
    },
    [],
  );

  const readDoc = useCallback(() => docRef.current, []);
  const retry = useCallback(() => {
    setSaveError(null);
    void flush();
  }, [flush]);
  const retryLoad = useCallback(() => {
    void media.refetch();
  }, [media]);

  return {
    status: version > 0 ? "ready" : media.isError ? "error" : "loading",
    version,
    readDoc,
    onDoc,
    posts,
    save: saveState({ isSaving, saveError, lastSavedAt }),
    hold,
    flush,
    retry,
    retryLoad,
  };
}
