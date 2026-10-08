/* UI-P48 — Your sessions and Made with, as the page runs them.

   READS. The build's sessions (`listBuildSessions`, oldest first), the
   sessions in no build (`listSessions()`, shared with Drafts), a session's
   prompts once its section is open (`getSessionPrompts`, read once: a
   session's conversation does not change), and Made with (`getMadeWith`).

   ONE MADE WITH WRITE AT A TIME. Ticking, typing a tool, adding a session and
   naming a model all rewrite `builds.made_with` (the last two through
   refreshMakingStats), each by reading it first, so they queue. A tick shows
   at once; what the server ends with is shown once the queue is empty, so two
   quick ticks never flicker back. Made with is put into the record's cache
   too, where completeness reads it. */

import { useCallback, useRef, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { composeBuildQueryKey } from "@/hooks/useComposeBuild";
import type { BuildRecord } from "@/lib/build";
import { getMadeWith, nextMadeWith, setMadeWithEntry, setMadeWithModel, type MadeWithState } from "@/lib/build/making";
import {
  attachSession,
  getSessionPrompts,
  listBuildSessions,
  listSessions,
  setSessionModel,
  type SessionPrompt,
  type SessionSummary,
} from "@/lib/build/sessions";

import { sessionAddedToast, type MadeWithChip } from "./composeModel";

const STALE_MS = 30_000;
const NO_SESSIONS: SessionSummary[] = [];

export const buildSessionsKey = (buildId: string | undefined) => ["build", "listBuildSessions", buildId] as const;
export const sessionPromptsKey = (sessionId: string) => ["build", "getSessionPrompts", sessionId] as const;
export const madeWithKey = (buildId: string | undefined) => ["build", "getMadeWith", buildId] as const;

export interface ComposeSessions {
  sessions: SessionSummary[];
  status: "loading" | "error" | "ready";
  retry: () => void;
  /** The sessions in no build, newest first; null until they have been read. */
  others: SessionSummary[] | null;
  /** Reading them failed and there is nothing to show. */
  othersError: boolean;
  retryOthers: () => void;
  /** On its way into this build, until both lists have been read again. */
  isAttaching: (sessionId: string) => boolean;
  setOpenIds: (ids: readonly string[]) => void;
  /** A session's prompts once read, and whether reading them failed. */
  promptsState: (sessionId: string) => { prompts: SessionPrompt[] | undefined; error: boolean };
  promptsOf: (sessionId: string) => SessionPrompt[] | undefined;
  retryPrompts: (sessionId: string) => void;
  attach: (sessionId: string) => void;
  /** Resolves true once the model is saved. */
  setModel: (sessionId: string, model: string) => Promise<boolean>;
  madeWith: MadeWithState;
  toggleMadeWith: (chip: MadeWithChip, on: boolean) => void;
  addMadeWith: (name: string) => void;
}

export function useComposeSessions({
  buildId,
  owner,
  ensureBuild,
  recordMadeWith,
}: {
  buildId: string | undefined;
  /** The record has loaded and is the signed-in creator's. */
  owner: boolean;
  ensureBuild: () => Promise<string>;
  /** `builds.made_with` as the record holds it: what Made with shows before its own read lands. */
  recordMadeWith: readonly string[];
}): ComposeSessions {
  const queryClient = useQueryClient();
  const enabled = Boolean(buildId) && owner;

  const buildSessions = useQuery({
    queryKey: buildSessionsKey(buildId),
    queryFn: () => listBuildSessions(buildId as string),
    enabled,
    staleTime: STALE_MS,
  });
  const others = useQuery({
    queryKey: ["build", "listSessions", false],
    queryFn: () => listSessions({ includeAttached: false }),
    staleTime: STALE_MS,
  });
  const madeWithQuery = useQuery({
    queryKey: madeWithKey(buildId),
    queryFn: () => getMadeWith(buildId as string),
    enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const [openIds, setOpenIdsState] = useState<readonly string[]>([]);
  const setOpenIds = useCallback((ids: readonly string[]) => setOpenIdsState(ids), []);
  const promptQueries = useQueries({
    queries: openIds.map((id) => ({
      queryKey: sessionPromptsKey(id),
      queryFn: () => getSessionPrompts(id),
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      retry: 1,
    })),
  });

  const promptsState = (sessionId: string) => {
    const at = openIds.indexOf(sessionId);
    const query = at === -1 ? undefined : promptQueries[at];
    return { prompts: query?.data, error: Boolean(query?.isError) };
  };
  const promptsOf = (sessionId: string) => queryClient.getQueryData<SessionPrompt[]>(sessionPromptsKey(sessionId));

  /* ── Made with ── */

  const latest = useRef({ buildId, ensureBuild, recordMadeWith });
  latest.current = { buildId, ensureBuild, recordMadeWith };

  const readMadeWith = (id: string): MadeWithState =>
    queryClient.getQueryData<MadeWithState>(madeWithKey(id)) ?? { madeWith: [...latest.current.recordMadeWith], excluded: [] };

  const showMadeWith = useCallback(
    (id: string, state: MadeWithState) => {
      queryClient.setQueryData<MadeWithState>(madeWithKey(id), state);
      queryClient.setQueryData<BuildRecord | null>(composeBuildQueryKey(id), (previous) =>
        previous ? { ...previous, build: { ...previous.build, made_with: state.madeWith } } : previous,
      );
    },
    [queryClient],
  );

  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);
  /** Run a Made with write after the others; show the server's answer once none is left. */
  const enqueue = useCallback(
    <T,>(task: () => Promise<{ id: string; state: MadeWithState | null; value: T }>): Promise<T> => {
      pending.current += 1;
      const next = queue.current.then(task).finally(() => {
        pending.current -= 1;
      });
      queue.current = next.then(
        ({ id, state }) => {
          if (pending.current === 0 && state) showMadeWith(id, state);
        },
        () => undefined,
      );
      return next.then(({ value }) => value);
    },
    [showMadeWith],
  );

  const settleMadeWith = (id: string) =>
    getMadeWith(id).then(
      (state) => showMadeWith(id, state),
      () => undefined,
    );

  const toggleMadeWith = (chip: MadeWithChip, on: boolean) => {
    const id = latest.current.buildId;
    if (!id || chip.kind === "tool") return;
    const kind = chip.kind;
    const name = kind === "model" ? (chip.model ?? "") : chip.label;
    if (!name) return;
    showMadeWith(id, nextMadeWith(readMadeWith(id), name, on, kind));
    enqueue(async () => {
      const state = kind === "model" ? await setMadeWithModel(id, name, on) : await setMadeWithEntry(id, name, on);
      return { id, state, value: undefined };
    }).catch((cause) => {
      console.error("[Compose] Made with not changed", cause);
      toast.error("Couldn't change Made with. Try again.");
      void settleMadeWith(id);
    });
  };

  const addMadeWith = (name: string) => {
    enqueue(async () => {
      const id = await latest.current.ensureBuild();
      const state = await setMadeWithEntry(id, name, true);
      return { id, state, value: undefined };
    }).catch((cause) => {
      console.error("[Compose] Made with entry not added", cause);
      toast.error("Couldn't add that to Made with. Try again.");
    });
  };

  /* ── sessions ── */

  const refreshLists = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["build", "listBuildSessions"] }),
      queryClient.invalidateQueries({ queryKey: ["build", "listSessions"] }),
      queryClient.invalidateQueries({ queryKey: ["build", "listDraftsWithSessions"] }),
    ]);

  /**
   * Sessions on their way into this build. A row stays in this set until both
   * lists have been read again, so its + cannot be pressed a second time in the
   * moment between the claim and the row leaving "Not in a build yet".
   */
  const [attaching, setAttaching] = useState<ReadonlySet<string>>(new Set());
  const attachingRef = useRef(attaching);
  const markAttaching = (sessionId: string, on: boolean) => {
    const next = new Set(attachingRef.current);
    if (on) next.add(sessionId);
    else next.delete(sessionId);
    attachingRef.current = next;
    setAttaching(next);
  };

  const attach = (sessionId: string) => {
    if (attachingRef.current.has(sessionId)) return;
    markAttaching(sessionId, true);
    const session = (others.data ?? []).find((candidate) => candidate.id === sessionId) ?? null;
    enqueue(async () => {
      const id = await latest.current.ensureBuild();
      await attachSession(sessionId, { kind: "existing", buildId: id });
      const state = await getMadeWith(id).catch(() => null);
      return { id, state, value: state };
    })
      .then((state) => toast(sessionAddedToast(session ?? { modelName: null, client: null }, state?.excluded ?? [])))
      .catch((cause) => {
        console.error("[Compose] attachSession failed", cause);
        toast.error("Couldn't add that session. Try again.");
      })
      .finally(() =>
        refreshLists()
          .catch(() => undefined)
          .then(() => markAttaching(sessionId, false)),
      );
  };

  const setModel = (sessionId: string, model: string) =>
    enqueue(async () => {
      await setSessionModel(sessionId, model);
      const id = latest.current.buildId;
      const state = id ? await getMadeWith(id).catch(() => null) : null;
      return { id: id ?? "", state, value: true };
    })
      .catch((cause) => {
        console.error("[Compose] setSessionModel failed", cause);
        toast.error("Couldn't save that model. Try again.");
        return false;
      })
      .finally(() => void queryClient.invalidateQueries({ queryKey: ["build", "listBuildSessions"] }));

  const status: ComposeSessions["status"] = !enabled ? (buildId ? "loading" : "ready") : buildSessions.isError ? "error" : buildSessions.isPending ? "loading" : "ready";

  return {
    sessions: buildSessions.data ?? NO_SESSIONS,
    status,
    retry: () => void buildSessions.refetch(),
    others: others.data ?? null,
    othersError: others.isError && others.data === undefined,
    retryOthers: () => void others.refetch(),
    isAttaching: (sessionId) => attaching.has(sessionId),
    setOpenIds,
    promptsState,
    promptsOf,
    retryPrompts: (sessionId) => void queryClient.refetchQueries({ queryKey: sessionPromptsKey(sessionId) }),
    attach,
    setModel,
    madeWith: madeWithQuery.data ?? { madeWith: [...recordMadeWith], excluded: [] },
    toggleMadeWith,
    addMadeWith,
  };
}
