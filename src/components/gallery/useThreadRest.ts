// useThreadRest: the pictures of a build's later posts, asked for when its thread opens.
//
// A build's whole thread is one document (builds.post_doc), which the feed already holds, so the words of every post are
// at hand. What a closed thread does not hold is the later posts' pictures: one request (the build's post-media set, in the
// order the maker published them), signed once and cached under ["build-posts", buildId]. Hovering or focusing Show more
// warms the cache, so the press opens from it. The open state lasts while the reader stays on the page: it is component
// state, so a refresh starts closed. A different build in the same place starts closed too.

import { QueryClientContext } from "@tanstack/react-query";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { ThreadRest } from "@/components/post/PostThread";
import { getThreadMedia, type GalleryMedia } from "@/lib/build";

import { CARD_THREAD_WIDTH, signCardMedia, type MediaSrcMap } from "./cardMedia";

/** How long the rest of a thread is kept: under the fifty minutes its signatures live. */
const THREAD_STALE_MS = 40 * 60_000;

export interface ThreadRestData {
  rows: GalleryMedia[];
  src: MediaSrcMap;
}

export interface ThreadRestOptions {
  buildId: string;
  /** The build has a thread to open at all. */
  enabled: boolean;
  /** A preview already holds every picture: nothing is asked for. */
  preview?: boolean;
}

export function useThreadRest({ buildId, enabled, preview = false }: ThreadRestOptions) {
  const client = useContext(QueryClientContext);
  const [phase, setPhase] = useState<"closed" | "open">("closed");
  const [rest, setRest] = useState<ThreadRestData | null>(null);
  const [failed, setFailed] = useState(false);
  const [asking, setAsking] = useState(false);

  const query = useMemo(
    () => ({
      queryKey: ["build-posts", buildId] as const,
      queryFn: async (): Promise<ThreadRestData> => {
        const rows = (await getThreadMedia(buildId)) as GalleryMedia[];
        const src = await signCardMedia(rows.map((row) => ({ ...row, slotWidth: CARD_THREAD_WIDTH })), client);
        return { rows, src };
      },
      staleTime: THREAD_STALE_MS,
    }),
    [buildId, client],
  );

  const warm = useCallback(() => {
    if (preview || rest || !enabled || !client) return;
    void client.prefetchQuery(query);
  }, [preview, rest, enabled, client, query]);

  const ask = useCallback(async () => {
    if (preview || rest) return;
    const ready = client?.getQueryData<ThreadRestData>(query.queryKey);
    if (ready) {
      setRest(ready);
      return;
    }
    setFailed(false);
    setAsking(true);
    try {
      setRest(client ? await client.fetchQuery(query) : await query.queryFn());
    } catch {
      setFailed(true);
    } finally {
      setAsking(false);
    }
  }, [preview, rest, client, query]);

  const open = useCallback(() => {
    if (phase !== "closed") return;
    setPhase("open");
    void ask();
  }, [phase, ask]);

  const close = useCallback(() => setPhase("closed"), []);
  const retry = useCallback(() => void ask(), [ask]);

  // Another build in this place: its own thread, closed.
  useEffect(() => {
    setPhase("closed");
    setRest(null);
    setFailed(false);
    setAsking(false);
  }, [buildId]);

  const restState: ThreadRest = preview || rest ? "ready" : failed ? "failed" : asking ? "loading" : "ready";
  return { phase, rest, restState, open, close, warm, retry };
}
