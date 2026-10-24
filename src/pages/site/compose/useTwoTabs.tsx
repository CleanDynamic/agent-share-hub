/* CA-23 P4: two tabs (or two devices) on one build.

   WHAT THIS HOOK DOES. It opens the build's channel, so a write made in another tab shows the strip "Changed in another tab"; it
   watches the build for `staleWrites`, so a write that would undo another place's change is merged instead and the part both
   changed becomes a clash; it opens the clashes one at a time, in build order, in the clash window; and it puts the version not
   kept into Recently removed, with Restore.

   "Show changes" reads the build again and lets go of what this tab had laid over it. Words not yet written are kept (the post
   is not opened again over an unsaved edit): the write that follows is refused as a clash, and the window asks. A device that
   changed the build is heard of when the window is next looked at (the page is focused again), or when this tab's own write is
   refused. CA-22's sliding and outlining are not on main, so Show changes redraws without them. */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { composeBuildQueryKey } from "@/hooks/useComposeBuild";
import { getBuildHeader } from "@/lib/build/builds";
import { CLASH_COPY, clashView, type ClashView } from "@/lib/build/clashView";
import { flatNodes, knownStamp, noteRecord, watchBuild, type RawClash } from "@/lib/build/staleWrites";
import { openBuildChannel, rowsChanged, type BuildChannel } from "@/lib/build/tabSync";
import { pendingWrites } from "@/lib/build/pendingWrites";
import type { RemovedMeta } from "@/lib/build/removedLog";
import type { BuildRecord } from "@/lib/build";

import type { BuildHistoryApi } from "./useBuildHistory";
import type { ComposeNodes } from "./useComposeNodes";
import type { ComposeThread } from "./useComposeThread";

/** What the page says about a clash: its name ("Prompt 2"), its badge in Recently removed, and where it falls in the build. */
export interface ClashDescription {
  name: string;
  badge: RemovedMeta["badge"];
  /** Build order: the post, then the build's own fields, parts, sessions, then tiles top to bottom. */
  rank: number;
}

export interface TwoTabsInput {
  buildId: string | undefined;
  nodes: ComposeNodes;
  history: BuildHistoryApi;
  thread: ComposeThread;
  describe: (clash: RawClash) => ClashDescription;
  /** Show changes read the build again: the header's own fields (title, description) are opened on it again. */
  rehydrate?: () => void;
}

interface Open {
  id: string;
  raw: RawClash;
  info: ClashDescription;
}

const KIND: Record<RawClash["kind"], RemovedMeta["kind"]> = { tile: "tile", session: "session", part: "part", post: "file", field: "file" };

export interface TwoTabs {
  /** The strip "Changed in another tab" is showing. */
  changedElsewhere: boolean;
  showChanges: () => Promise<void>;
  /** The clash now open, if any. Others wait their turn. */
  clash: ClashView | null;
  /** How many are waiting, this one included. */
  clashes: number;
  keepThis: () => void;
  useOther: () => void;
  busy: boolean;
  /** Tell the other tabs a write went through. */
  announce: (write: { method: string; url: string; body: string | null }) => void;
}

export function useTwoTabs(input: TwoTabsInput): TwoTabs {
  const { buildId } = input;
  const queryClient = useQueryClient();
  const latest = useRef(input);
  latest.current = input;
  const [changed, setChanged] = useState(false);
  const [queue, setQueue] = useState<Open[]>([]);
  const [busy, setBusy] = useState(false);
  const channel = useRef<BuildChannel | null>(null);

  const refresh = useCallback(async () => {
    if (!buildId) return;
    await queryClient.refetchQueries({ queryKey: composeBuildQueryKey(buildId) });
    void queryClient.invalidateQueries({ queryKey: ["build"] });
  }, [buildId, queryClient]);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  /* ── watching the build, and hearing the other tabs ── */
  useLayoutEffect(() => {
    if (!buildId) return;
    const stop = watchBuild(
      buildId,
      (raw) => {
        setChanged(true);
        const info = latest.current.describe(raw);
        const id = `${raw.kind}:${raw.key}`;
        setQueue((current) => [...current.filter((entry) => entry.id !== id), { id, raw, info }].sort((a, b) => a.info.rank - b.info.rank));
      },
      // A write was merged with a change made elsewhere: say so, and show what the database now holds.
      () => {
        setChanged(true);
        void refreshRef.current();
      },
    );
    return () => {
      stop();
      setQueue([]);
    };
  }, [buildId]);

  useEffect(() => {
    if (!buildId) return;
    const open = openBuildChannel(buildId);
    channel.current = open;
    const stop = open.subscribe(() => setChanged(true));
    return () => {
      stop();
      open.close();
      channel.current = null;
      setChanged(false);
    };
  }, [buildId]);

  // A device that changed the build is heard of when this one is looked at again.
  useEffect(() => {
    if (!buildId) return;
    const look = async () => {
      if (document.visibilityState === "hidden" || pendingWrites.total() > 0) return;
      try {
        const there = await getBuildHeader(buildId);
        const mine = knownStamp(buildId);
        if (there && mine && there.updated_at !== mine) setChanged(true);
      } catch {
        /* offline, or the build is not readable: nothing to say */
      }
    };
    document.addEventListener("visibilitychange", look);
    window.addEventListener("focus", look);
    return () => {
      document.removeEventListener("visibilitychange", look);
      window.removeEventListener("focus", look);
    };
  }, [buildId]);

  const announce = useCallback((write: { method: string; url: string; body: string | null }) => {
    channel.current?.announce(rowsChanged(write.method, write.url, write.body));
  }, []);

  /* ── Show changes ── */
  const showChanges = useCallback(async () => {
    if (!buildId) return;
    setChanged(false);
    latest.current.nodes.forget();
    await refresh();
    const record = queryClient.getQueryData<BuildRecord | null>(composeBuildQueryKey(buildId));
    if (record) noteRecord(buildId, { build: record.build as unknown as Record<string, unknown>, tree: flatNodes(record.tree) }, true);
    latest.current.thread.reload?.();
    latest.current.rehydrate?.();
  }, [buildId, queryClient, refresh]);

  /* ── the clash window ── */
  const current = queue[0] ?? null;
  const view = useMemo(() => (current ? clashView(current.info.name, current.raw.fields, current.raw.mineAt, current.raw.theirsAt) : null), [current]);

  const settle = useCallback(
    async (kept: "mine" | "theirs") => {
      const item = queue[0];
      if (!item || !buildId) return;
      const { nodes, history, thread } = latest.current;
      const other = kept === "mine" ? "theirs" : "mine";
      setBusy(true);
      try {
        // The other place's version is already in the database; this tab's is written only if it is the one kept.
        if (kept === "mine") await nodes.run(() => item.raw.write("mine"));
        if (item.raw.kind === "tile") nodes.forget([item.raw.key]);
        await refresh();
        if (item.raw.kind === "post") thread.reload?.(true);
        const name = kept === "mine" ? CLASH_COPY.otherVersion(item.info.name) : CLASH_COPY.thisVersion(item.info.name);
        history.addVersion({ kind: KIND[item.raw.kind], badge: item.info.badge, name }, async () => {
          await nodes.run(() => item.raw.write(other));
          if (item.raw.kind === "tile") nodes.forget([item.raw.key]);
          await refresh();
          if (item.raw.kind === "post") thread.reload?.(true);
        });
        setQueue((entries) => entries.filter((entry) => entry.id !== item.id));
      } catch (cause) {
        console.error("[Compose] a clash could not be settled", cause);
      } finally {
        setBusy(false);
      }
    },
    [queue, buildId, refresh],
  );

  const keepThis = useCallback(() => void settle("mine"), [settle]);
  const useOther = useCallback(() => void settle("theirs"), [settle]);

  return { changedElsewhere: changed, showChanges, clash: view, clashes: queue.length, keepThis, useOther, busy, announce };
}
