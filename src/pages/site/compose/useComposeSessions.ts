/* UI-P48 — Your sessions and Made with, as the page runs them.

   READS. The creator's whole session library (`useLibrarySessions`, newest
   first: every session on the account, in this build, in another or in none,
   read again on opening, on coming back to the tab and while open, because a
   connector adds to it from outside the browser); the build's own sessions
   (`listBuildSessions`, oldest first), which Made with is drawn from; a
   session's prompts once its section is open (`getSessionPrompts`, read once: a
   session's conversation does not change); and Made with (`getMadeWith`).

   A SESSION IS THE ACCOUNT'S, NOT THE BUILD'S. Your sessions lists the library,
   so using a session here never takes it off the panel of another build. A
   prompt from any of them can be added. When the session was in no build yet,
   adding one of its prompts also puts it into this draft (`claimForBuild`), as
   the old "Not in a build yet" + did, so its tool and model join Made with.

   ONE MADE WITH WRITE AT A TIME. Ticking, typing a tool, adding a session and
   naming a model all rewrite `builds.made_with` (the last two through
   refreshMakingStats), each by reading it first, so they queue. A tick shows
   at once; what the server ends with is shown once the queue is empty, so two
   quick ticks never flicker back. Made with is put into the record's cache
   too, where completeness reads it. */

import { useCallback, useRef, useState } from "react";
import { useQueries, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { composeBuildQueryKey } from "@/hooks/useComposeBuild";
import { librarySessionsKey, useLibrarySessions } from "@/hooks/useLibrarySessions";
import type { BuildRecord } from "@/lib/build";
import { listBuildSessionRows, type BuildSessionRow } from "@/lib/build/buildSessions";
import { getMadeWith, nextMadeWith, setMadeWithEntry, setMadeWithModel, setSessionTool, type MadeWithState } from "@/lib/build/making";
import { linkSessionToBuild } from "@/lib/build/addSession";
import {
  getSessionPrompts,
  listBuildSessions,
  setSessionModel,
  type SessionPrompt,
  type SessionSummary,
  type UnfinishedSession,
} from "@/lib/build/sessions";

import { trackWrite } from "@/lib/build/pendingWrites";

import type { MadeWithChip } from "./composeModel";
import { sayFailed } from "./draftStart";

const STALE_MS = 30_000;
const NO_SESSIONS: SessionSummary[] = [];
const NO_ROWS: BuildSessionRow[] = [];

export const buildSessionsKey = (buildId: string | undefined) => ["build", "listBuildSessions", buildId] as const;
/** CA-12: the draft's rows in `build_sessions`. Under the list's key, so whatever refreshes the sessions refreshes these. */
export const buildSessionRowsKey = (buildId: string | undefined) => ["build", "listBuildSessions", "rows", buildId] as const;
export const sessionPromptsKey = (sessionId: string) => ["build", "getSessionPrompts", sessionId] as const;
export const madeWithKey = (buildId: string | undefined) => ["build", "getMadeWith", buildId] as const;

/** Show Made with: the line's own cache, and the record the Card reads it from. */
export function showMadeWithIn(queryClient: QueryClient, id: string, state: MadeWithState) {
  queryClient.setQueryData<MadeWithState>(madeWithKey(id), state);
  queryClient.setQueryData<BuildRecord | null>(composeBuildQueryKey(id), (previous) =>
    previous ? { ...previous, build: { ...previous.build, made_with: state.madeWith } } : previous,
  );
}

export interface ComposeSessions {
  /** This build's own sessions, oldest first: what Made with is drawn from. */
  sessions: SessionSummary[];
  /** CA-12: this draft's rows in `build_sessions`, in order; empty for an old draft. */
  rows: BuildSessionRow[];
  /** Every finished session on the account, newest first: what Your sessions lists. */
  library: SessionSummary[];
  /** CA-12: the library has another page. */
  libraryHasMore: boolean;
  libraryLoadingMore: boolean;
  libraryMore: () => void;
  /** CA-12: imports still arriving, and ones that did not finish. */
  unfinished: UnfinishedSession[];
  /** The library's read. */
  status: "loading" | "error" | "ready";
  retry: () => void;
  /** The library's real error, for the log. */
  libraryError: unknown;
  /** SV-23: the build's own sessions and their rows have both been read (the stored counts wait for them). */
  buildLoaded: boolean;
  /** CA-24 P3: the build's own sessions or their rows never loaded. */
  buildFailed: boolean;
  buildError: unknown;
  /** Reads the build's own sessions and their rows again, and nothing else. */
  retryBuild: () => void;
  setOpenIds: (ids: readonly string[]) => void;
  /** A session's prompts once read, and whether reading them failed. */
  promptsState: (sessionId: string) => { prompts: SessionPrompt[] | undefined; error: boolean };
  promptsOf: (sessionId: string) => SessionPrompt[] | undefined;
  retryPrompts: (sessionId: string) => void;
  /** A prompt of this session was added: a session in no build yet joins this draft. */
  claimForBuild: (sessionId: string) => void;
  /** Resolves true once the model is saved. */
  setModel: (sessionId: string, model: string) => Promise<boolean>;
  /** TF-13: resolves true once the tool is saved. */
  setTool: (sessionId: string, tool: string | null) => Promise<boolean>;
  madeWith: MadeWithState;
  toggleMadeWith: (chip: MadeWithChip, on: boolean) => void;
  addMadeWith: (name: string) => void;
}

export function useComposeSessions({
  buildId,
  owner,
  canClaim,
  ensureBuild,
  recordMadeWith,
  libraryActive = true,
}: {
  buildId: string | undefined;
  /** The record has loaded and is the signed-in creator's. */
  owner: boolean;
  /** A draft, or a build not made yet: it can take a new session. False once published. */
  canClaim: boolean;
  ensureBuild: () => Promise<string>;
  /** `builds.made_with` as the record holds it: what Made with shows before its own read lands. */
  recordMadeWith: readonly string[];
  /** CA-10: the library's panel is on screen, so the library polls. */
  libraryActive?: boolean;
}): ComposeSessions {
  const queryClient = useQueryClient();
  const enabled = Boolean(buildId) && owner;

  const buildSessions = useQuery({
    queryKey: buildSessionsKey(buildId),
    queryFn: () => listBuildSessions(buildId as string),
    enabled,
    staleTime: STALE_MS,
  });
  const rows = useQuery({
    queryKey: buildSessionRowsKey(buildId),
    queryFn: () => listBuildSessionRows(buildId as string),
    enabled: Boolean(buildId),
    staleTime: STALE_MS,
  });
  const library = useLibrarySessions({ active: libraryActive });
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
    (id: string, state: MadeWithState) => showMadeWithIn(queryClient, id, state),
    [queryClient],
  );

  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);
  /** Run a Made with write after the others; show the server's answer once none is left. */
  const enqueue = useCallback(
    <T,>(task: () => Promise<{ id: string; state: MadeWithState | null; value: T }>): Promise<T> => {
      pending.current += 1;
      const next = trackWrite("sessions", task, { after: queue.current }).finally(() => {
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
      // eslint-disable-next-line no-console -- a deliberate, structured log that its tests assert (SV-26)
      console.error("[Compose] Made with not changed", cause);
      sayFailed(cause, "Made with not changed", () => toggleMadeWith(chip, on));
      void settleMadeWith(id);
    });
  };

  const addMadeWith = (name: string) => {
    enqueue(async () => {
      const id = await latest.current.ensureBuild();
      const state = await setMadeWithEntry(id, name, true);
      return { id, state, value: undefined };
    }).catch((cause) => {
      // eslint-disable-next-line no-console -- a deliberate, structured log that its tests assert (SV-26)
      console.error("[Compose] Made with entry not added", cause);
      sayFailed(cause, "Made with not added", () => addMadeWith(name));
    });
  };

  /* ── sessions ── */

  const refreshLists = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["build", "listBuildSessions"] }),
      queryClient.invalidateQueries({ queryKey: librarySessionsKey }),
      queryClient.invalidateQueries({ queryKey: ["build", "listSessions"] }),
      queryClient.invalidateQueries({ queryKey: ["build", "listDraftsWithSessions"] }),
    ]);

  /** Sessions on their way into this draft, so a second prompt from one cannot claim it twice. */
  const claiming = useRef(new Set<string>());

  /**
   * Put a session that is in no build yet into this draft, once one of its
   * prompts is added. A session already in a build (this one or another), or
   * marked expired, is left as it is: its prompt is added all the same, and it
   * stays in the library. A published build takes no new sessions. The prompt
   * is already added whatever happens here, so a failure is logged, not shown.
   */
  const claimForBuild = (sessionId: string) => {
    if (!canClaim || claiming.current.has(sessionId)) return;
    const session = (library.data ?? []).find((candidate) => candidate.id === sessionId);
    if (!session || (session.draftIds ?? []).includes(latest.current.buildId ?? "")) return;
    claiming.current.add(sessionId);
    enqueue(async () => {
      const id = await latest.current.ensureBuild();
      await linkSessionToBuild(sessionId, id);
      const state = await getMadeWith(id).catch(() => null);
      return { id, state, value: undefined };
    })
      // eslint-disable-next-line no-console -- a deliberate, structured log that its tests assert (SV-26)
      .catch((cause) => console.error("[Compose] session not put into this build", cause))
      .finally(() =>
        refreshLists()
          .catch(() => undefined)
          .then(() => claiming.current.delete(sessionId)),
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
        // eslint-disable-next-line no-console -- a deliberate, structured log that its tests assert (SV-26)
        console.error("[Compose] setSessionModel failed", cause);
        sayFailed(cause, "Model not saved", () => void setModel(sessionId, model));
        return false;
      })
      .finally(() => {
        void queryClient.invalidateQueries({ queryKey: ["build", "listBuildSessions"] });
        void queryClient.invalidateQueries({ queryKey: librarySessionsKey });
      });

  /** Give a session whose client names no tool its tool; the tool joins Made with, and the record is read again so every view follows. */
  const setTool = (sessionId: string, tool: string | null) =>
    enqueue(async () => {
      const id = latest.current.buildId;
      if (!id) throw new Error("no build yet");
      const state = await setSessionTool(id, sessionId, tool);
      return { id, state, value: true };
    })
      .catch((cause) => {
        // eslint-disable-next-line no-console -- a deliberate, structured log that its tests assert (SV-26)
        console.error("[Compose] setSessionTool failed", cause);
        sayFailed(cause, "Tool not saved", () => void setTool(sessionId, tool));
        return false;
      })
      .finally(() => {
        const id = latest.current.buildId;
        if (id) void queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(id) });
      });

  // A re-read that fails keeps the list already on screen; the error is for one that never loaded.
  const status: ComposeSessions["status"] = library.data !== undefined ? "ready" : library.isError ? "error" : "loading";

  return {
    sessions: buildSessions.data ?? NO_SESSIONS,
    rows: rows.data ?? NO_ROWS,
    library: library.data ?? NO_SESSIONS,
    libraryHasMore: library.hasMore,
    libraryLoadingMore: library.loadingMore,
    libraryMore: library.fetchMore,
    unfinished: library.unfinished,
    status,
    retry: () => void library.refetch(),
    libraryError: library.error ?? undefined,
    buildLoaded: buildSessions.data !== undefined && rows.data !== undefined,
    buildFailed: (buildSessions.isError && buildSessions.data === undefined) || (rows.isError && rows.data === undefined),
    buildError: buildSessions.error ?? rows.error ?? undefined,
    retryBuild: () => void Promise.all([queryClient.refetchQueries({ queryKey: buildSessionsKey(buildId), exact: true }), queryClient.refetchQueries({ queryKey: buildSessionRowsKey(buildId), exact: true })]),
    setOpenIds,
    promptsState,
    promptsOf,
    retryPrompts: (sessionId) => void queryClient.refetchQueries({ queryKey: sessionPromptsKey(sessionId) }),
    claimForBuild,
    setModel,
    setTool,
    madeWith: madeWithQuery.data ?? { madeWith: [...recordMadeWith], excluded: [] },
    toggleMadeWith,
    addMadeWith,
  };
}
