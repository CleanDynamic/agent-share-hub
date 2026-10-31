/* CA-14 P2 to P7 — the writes behind a session's head and a tile's "Move to session…": title, order, remove, merge, split.

   Every change is planned first (`sessionEdit.ts`, `sessionLayout.ts`, pure) and then written in this order: the tiles'
   `payload.session` in one batch, the sessions' entries (`making.sessions_meta`), the order (`build_sessions` and
   `making.session_order`), then the tiles' places, so each session's tiles sit together in the order the sessions are
   numbered. A change a maker may want back (move to a session, remove, merge, split, move a part) is one step of the build's
   history (CA-20 P5): the title row's Undo takes it back, and a removal, a merge and a split also say so in the notice, with Undo.

   An import is never touched: a tile is read for its session from `payload.session` first, so giving a tile another session
   edits this draft's tile and nothing in the library. */

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { composeBuildQueryKey } from "@/hooks/useComposeBuild";
import { deleteBuildSession } from "@/lib/build/buildSessions";
import { buildSteps, groupKey, topSteps, type SessionGroup, type Step } from "@/lib/build/graph";
import { isLegacySession, newSessionKey, newWorkstreamKey, patchMaking, setMapSettings, type MapSettings, refreshMakingStats, sessionsCollapsedOf, sessionsMetaOf, setPartLabels, setSessionMeta, setSessionOpen, setWorkstreams, storedWorkstreamsOf, todayDay, type PartLabels, type SessionMeta, type Workstream } from "@/lib/build/making";
import { reorderNodes } from "@/lib/build/nodes";
import { droppedKey, movedKey, orderKeys, setSessionOrder, stackBySessionMoves } from "@/lib/build/sessionLayout";
import { dayOfNode, insertedAfter, mergedTitle, mergeTitleNote, planLayout, reassigned, splitPlan, tilesOfSession, withoutKey, writeNodeRows } from "@/lib/build/sessionEdit";
import { goingWith, dropNodes } from "@/lib/build/removeNodes";
import { REMOVE_COPY } from "@/lib/build/componentMenus";
import type { RemovedMeta } from "@/lib/build/removedLog";
import { flatOrder, moveBy, type MoveModel } from "@/lib/build/moveRules";
import { refTo } from "@/lib/build/thread";
import type { BuildNode, NodeTree } from "@/lib/build/types";
import { toolFor } from "@/lib/tools/registry";
import {
  addWorkstream,
  droppedWorkstream,
  moveSessionToWorkstream,
  moveWorkstream,
  removeWorkstream,
  sanitisedStarts,
  withWorkstream,
  workstreamPatch,
  workstreamsOf,
  startsAfterChoices,
  type WorkstreamChange,
} from "@/lib/build/workstreams";

import { sayFailed } from "./draftStart";
import type { BuildHistoryApi, TrackOptions } from "./useBuildHistory";
import { NOT_AVAILABLE, type ReferenceBridge } from "@/lib/build/referenceBridge";
import { rowOf, type ComposeNodes } from "./useComposeNodes";
import { buildSessionRowsKey } from "./useComposeSessions";
import { NO_APP } from "./sourcesModel";
import { reportError } from "@/lib/errors/report";

export interface SessionEditsInput {
  buildId: string | undefined;
  made: unknown;
  nodes: ComposeNodes;
  steps: readonly Step[];
  groups: readonly SessionGroup[];
  /** An old build's run of typed prompts, saved as a session first. Resolves its new key. */
  claim: (key: string) => Promise<string | null>;
  /** What a screen reader hears. */
  say: (line: string) => void;
  /** The session being added to, so it is not left pointing at one that is gone. */
  onGone: (key: string) => void;
  /** CA-17 P2: the build's parts when it has two or more: each part's key and its title ("Part B · Support agent"), and the part each session is in. */
  parts?: { titles: ReadonlyMap<string, string>; partOf: ReadonlyMap<string, string> };
  /** CA-20 P5: the build's history, which takes each change as a step. Absent: changes are made and not recorded. */
  history?: BuildHistoryApi | null;
  /** CA-20 P2: the reference bridge, to let go of what points at a session or a part that goes. Absent: nothing to let go of. */
  bridge?: ReferenceBridge;
  /** CA-21 P1: where every tile, session and part stands, so Move up and Move down always have somewhere to go. Absent: a session swaps with the one next to it in its part. */
  moveModel?: MoveModel;
  /** SV-07 P3: the parts as Add a part will write them, drawn from the click until the write lands; null when it has. */
  showParts?: (workstreams: readonly Workstream[] | null) => void;
}

const findTop = (tree: readonly NodeTree[], id: string): NodeTree | undefined => tree.find((node) => node.id === id);

/** `order` without these keys. */
const withoutKeys = (order: readonly string[], going: ReadonlySet<string>): string[] => order.filter((entry) => !going.has(entry));

export function useSessionEdits(input: SessionEditsInput) {
  const queryClient = useQueryClient();
  const latest = useRef(input);
  latest.current = input;

  const editableKeys = useCallback(() => orderKeys(latest.current.groups).filter((key) => !isLegacySession(key)), []);

  const refresh = useCallback(
    async (id: string) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(id) }),
        queryClient.invalidateQueries({ queryKey: buildSessionRowsKey(id) }),
        queryClient.invalidateQueries({ queryKey: ["build", "listBuildSessions"] }),
      ]);
    },
    [queryClient],
  );

  /** Write a plan: payloads, entries, order, then places. */
  const applyLayout = useCallback(
    async (change: { order: string[]; reassign?: ReadonlyMap<string, string>; atEnd?: string[]; meta?: Record<string, SessionMeta | null>; dropKeys?: string[] }) => {
      const { buildId, made, nodes } = latest.current;
      if (!buildId) throw new Error("That draft is not saved yet.");
      await nodes.run(async () => {
      const entries = { ...sessionsMetaOf(made) };
      for (const [key, value] of Object.entries(change.meta ?? {})) {
        if (value) entries[key] = value;
        else delete entries[key];
      }
      const current = nodes.current();
      const base = reassigned(current, change.reassign ?? new Map());
      const plan = planLayout(base, { ...((made as object) ?? {}), sessions_meta: entries }, entries, change.order, change.atEnd);

      if (change.reassign && change.reassign.size > 0) {
        const rows = [...change.reassign.keys()].flatMap((id) => {
          const node = findTop(current, id);
          return node ? [{ ...rowOf(node), payload: { ...((node.payload ?? {}) as Record<string, unknown>), session: change.reassign?.get(id) } as BuildNode["payload"] }] : [];
        });
        for (const row of await writeNodeRows(rows)) nodes.record(row.id, row);
      }
      for (const [key, value] of Object.entries(change.meta ?? {})) await setSessionMeta(buildId, key, value);
      // The rows of sessions that go are deleted before the rest are reordered: a row left in the middle holds a place the others are moved into.
      for (const key of change.dropKeys ?? []) await deleteBuildSession(buildId, key).catch(() => undefined);
      await setSessionOrder(buildId, change.order);
      if (plan.moves.length > 0) {
        await reorderNodes(buildId, plan.moves);
        for (const move of plan.moves) {
          const node = findTop(nodes.current(), move.id);
          if (node) nodes.record(node.id, { ...rowOf(node), position: move.position });
        }
      }
      });
      await refresh(buildId);
    },
    [refresh],
  );

  /* CA-20 P5: a change the maker may want back is one step of the build's history. `sentence` can follow what the task did; `notice`
     says it in the notice too, with Undo. Without a history (a page that does not draw one) the task just runs. */
  const bridgeRef = useRef<ReferenceBridge>(NOT_AVAILABLE);
  bridgeRef.current = input.bridge ?? NOT_AVAILABLE;
  const track = useCallback(
    <T,>(sentence: string | ((result: T) => string), task: () => Promise<T>, options: boolean | TrackOptions = false): Promise<T> => {
      const current = latest.current.history;
      return current ? current.track(sentence, task, typeof options === "boolean" ? { notice: options } : options) : task();
    },
    [],
  );

  /** An old build's run of typed prompts is saved as a session made here first; the key it has after. */
  const stable = useCallback(async (key: string): Promise<string | null> => (isLegacySession(key) ? latest.current.claim(key) : key), []);

  /** A session edit: when it fails the maker is told ("Session not moved") with Retry, which runs the same edit again. */
  const guard = useCallback(
    async function again(line: string, task: () => Promise<unknown>): Promise<void> {
      try {
        await task();
      } catch (cause) {
        reportError(cause, { source: "console", context: "Sessions" });
        sayFailed(cause, line, () => void again(line, task));
      }
    },
    [],
  );

  /** A session's title: trimmed, 1 to 80 characters, or none. */
  const onTitle = useCallback(
    (key: string, title: string) =>
      void guard("Title not saved", () => track(`Changed the title of Session ${latest.current.groups.find((entry) => groupKey(entry) === key)?.number ?? ""}`.trim(), async () => {
        const real = await stable(key);
        const { buildId, made, groups } = latest.current;
        if (!real || !buildId) return;
        const group = groups.find((entry) => groupKey(entry) === key);
        const before: SessionMeta = sessionsMetaOf(made)[real] ?? { tool: group?.tool ? (toolFor(group.tool)?.id ?? group.tool) : null, date: isLegacySession(key) ? todayDay() : group?.startedAt && /^\d{4}-\d{2}-\d{2}$/.test(group.startedAt) ? group.startedAt : "" };
        const { title: _old, ...rest } = before;
        // In the node queue, behind any write already going: two saves in a row each read `making` as the one before left it.
        await latest.current.nodes.run(() => setSessionMeta(buildId, real, title.trim() ? { ...rest, title: title.trim() } : rest));
        await refresh(buildId);
      })),
    [guard, refresh, stable, track],
  );

  /**
   * SV-21: a session opened as a request with a problem, or taken back (null). Its entry in `making` changes, in the node queue
   * behind any write already going; the head says "Open as a request" from then on. The request is filed when the build is published.
   */
  const onSessionOpen = useCallback(
    (key: string, problem: string | null) =>
      void guard("Request not saved", () =>
        track(
          `${problem ? "Opened" : "Took back the request on"} Session ${latest.current.groups.find((entry) => groupKey(entry) === key)?.number ?? ""}`.trim(),
          async () => {
            const real = await stable(key);
            const { buildId } = latest.current;
            if (!real || !buildId) return;
            await latest.current.nodes.run(() => setSessionOpen(buildId, real, problem ? { problem } : null));
            await refresh(buildId);
          },
          { motion: "change", keys: [key] },
        ),
      ),
    [guard, refresh, stable, track],
  );

  /** CA-17 P2: set once `moveToPart` is made, further down; a drop between another part's sessions calls it. */
  const moveToPartRef = useRef<((key: string, to: string, before?: string) => Promise<void>) | null>(null);

  const sayMoved = useCallback((from: number, to: number) => latest.current.say(`Session ${from} moved to ${to}.`), []);

  const move = useCallback(
    (key: string, next: string[], from: number, to: number) =>
      guard("Session not moved", () =>
        track(
          `Moved Session ${from}${to < from ? " up" : " down"}`,
          async () => {
            await applyLayout({ order: next });
            sayMoved(from, to);
          },
          // SV-07 P4: the animator is told what moves before the model changes.
          { motion: "move", keys: [key] },
        ),
      ),
    [applyLayout, guard, sayMoved, track],
  );

  /** Move Up and Move Down, Alt with Up or Down on the head. CA-21 P1: at the edge of its part a session goes into the next part, never a silent refusal. */
  const onMove = useCallback(
    (key: string, by: -1 | 1): Promise<void> | void => {
      const model = latest.current.moveModel;
      const result = model ? moveBy(model, key, by) : null;
      if (model && result?.move.crossed && result.move.to.part) {
        const part = result.model.parts.find((entry) => entry.key === result.move.to.part);
        return moveToPartRef.current?.(key, result.move.to.part, part?.sessions[result.move.to.index + 1]);
      }
      const keys = editableKeys();
      const next = result ? flatOrder(result.model).filter((entry) => keys.includes(entry)) : movedKey(keys, key, by);
      if (next.join() === keys.join()) return;
      // Without a model, a session moves within its part; "Move to part…" is the way across.
      const { parts } = latest.current;
      const neighbour = keys[keys.indexOf(key) + by];
      if (!result && parts && parts.partOf.get(neighbour) !== parts.partOf.get(key)) return;
      const shown = orderKeys(latest.current.groups);
      const from = shown.indexOf(key) + 1;
      return move(key, next, from, from + by);
    },
    [editableKeys, move],
  );

  /** A session's head dropped on another's. */
  const onDrop = useCallback(
    (key: string, over: string): Promise<void> | void => {
      const keys = editableKeys();
      // CA-17 P2: dropped between another part's sessions, it joins that part, before the one it was dropped on.
      const { parts } = latest.current;
      if (parts && parts.partOf.get(over) && parts.partOf.get(over) !== parts.partOf.get(key)) return moveToPartRef.current?.(key, parts.partOf.get(over) as string, over);
      const next = droppedKey(keys, key, over);
      if (next.join() === keys.join()) return;
      const shown = orderKeys(latest.current.groups);
      const offset = shown.length - keys.length;
      return move(key, next, shown.indexOf(key) + 1, next.indexOf(key) + 1 + offset);
    },
    [editableKeys, move],
  );

  /* ── CA-17 P2: parts ── */

  /** Write a change to the parts: the parts, the sessions' entries, the one order, then the tiles' places. Resolves what was written, or null. */
  const applyParts = useCallback(
    async (plan: (making: unknown) => WorkstreamChange | null, onWritten?: () => void): Promise<WorkstreamChange | null> => {
      const { buildId, nodes } = latest.current;
      if (!buildId) throw new Error("That draft is not saved yet.");
      let applied: WorkstreamChange | null = null;
      await nodes.run(async () => {
        // SV-07 P1: the change is worked out from `making` as it stands inside the write's own step.
        let change: WorkstreamChange | null = null;
        const next = await patchMaking(buildId, (fresh) => {
          change = plan(fresh);
          return change && workstreamPatch(fresh, change);
        });
        if (!change) return;
        applied = change;
        await setSessionOrder(buildId, (change as WorkstreamChange).order);
        const laid = planLayout(nodes.current(), next, sessionsMetaOf(next), change.order);
        if (laid.moves.length > 0) {
          await reorderNodes(buildId, laid.moves);
          for (const move of laid.moves) {
            const node = findTop(nodes.current(), move.id);
            if (node) nodes.record(node.id, { ...rowOf(node), position: move.position });
          }
        }
      });
      // SV-07 P3: what waits on the write (Add a part's disabled row) lets go here, not after the refetch.
      onWritten?.();
      await refresh(buildId);
      return applied;
    },
    [refresh],
  );

  /** Change one or more of a part's own fields, nothing else. */
  const editPart = useCallback(
    (line: string, change: (stored: ReturnType<typeof storedWorkstreamsOf>) => ReturnType<typeof storedWorkstreamsOf>) =>
      guard(line, async () => {
        const { buildId, nodes } = latest.current;
        if (!buildId) return;
        await nodes.run(() => setWorkstreams(buildId, change).then(() => undefined));
        await refresh(buildId);
      }),
    [guard, refresh],
  );

  const titleOf = (key: string): string => latest.current.parts?.titles.get(key) ?? "that part";

  /** SV-07 P3: a part is being added: a second click makes no second part. */
  const addingPart = useRef(false);
  /**
   * "Add a part". SV-07 P3: the parts show at once, as they will be written (the same keys), and stay until the write lands.
   * Resolves the new part's key.
   */
  const onAddPart = useCallback(async (): Promise<string | null> => {
    if (addingPart.current) return null;
    addingPart.current = true;
    const fresh = [newWorkstreamKey(), newWorkstreamKey()];
    const keysOf = () => {
      let at = 0;
      return () => fresh[at++] ?? newWorkstreamKey();
    };
    const shown = addWorkstream(latest.current.made, editableKeys(), keysOf());
    if (shown) latest.current.showParts?.(shown.workstreams);
    let key: string | null = null;
    try {
      await guard("Part not added", () =>
        track("Added a part", async () => {
          const change = await applyParts(
            (making) => addWorkstream(making, editableKeys(), keysOf()),
            () => {
              addingPart.current = false;
              latest.current.showParts?.(null);
            },
          );
          key = change && "key" in change ? (change as WorkstreamChange & { key: string }).key : null;
          if (key) latest.current.say("Added a part.");
          // SV-07 P5: the notice is the one visible confirmation, now that the List prints no line.
        }, { notice: true, motion: "part", keys: shown ? [shown.key] : [] }),
      );
    } finally {
      addingPart.current = false;
      latest.current.showParts?.(null);
    }
    return key;
  }, [applyParts, editableKeys, guard, track]);

  /** SV-21: a part opened as a request for its next session, or taken back (null). The ghost row at its end is the one thing that comes or goes. */
  const onPartOpen = useCallback(
    (key: string, problem: string | null) =>
      void track(
        problem ? `Asked for the next session in ${titleOf(key)}` : `Took back the request in ${titleOf(key)}`,
        () => editPart("Request not saved", (stored) => withWorkstream(stored, key, { open: problem ? { problem } : undefined })),
        { motion: problem ? "add" : "remove", keys: [key] },
      ),
    [editPart, track],
  );

  const onPartName = useCallback((key: string, name: string) => void track(`Renamed ${titleOf(key)}`, () => editPart("Name not saved", (stored) => withWorkstream(stored, key, { name: name.trim() || undefined }))), [editPart, track]);
  /** SV-07 P3: resolves when the fold is written, so the page's at-once fold can let go then. */
  const onPartFold = useCallback((key: string, collapsed: boolean): Promise<void> => editPart("Fold not saved", (stored) => withWorkstream(stored, key, { collapsed })), [editPart]);
  const onPartColour = useCallback((key: string, colour: string | null) => editPart("Colour not saved", (stored) => withWorkstream(stored, key, { colour: colour ?? undefined })), [editPart]);
  const onPartStartsAfter = useCallback(
    (key: string, session: string | null) =>
      void track(`Changed when ${titleOf(key)} starts`, () => editPart("Start not saved", (stored) => {
        const { made, groups } = latest.current;
        const parts = workstreamsOf(made, orderKeys(groups));
        if (session && !startsAfterChoices(key, parts).includes(session)) return stored;
        const partOf = new Map(parts.flatMap((part) => part.sessions.map((entry) => [entry, part.key] as const)));
        return sanitisedStarts(withWorkstream(stored, key, { startsAfter: session ?? undefined }), (entry) => partOf.get(entry));
      })),
    [editPart, track],
  );

  /** Move up and Move down on a part's head. */
  const onPartMove = useCallback(
    (key: string, by: -1 | 1) =>
      guard("Part not moved", () =>
        track(`Moved ${titleOf(key)} ${by === -1 ? "up" : "down"}`, async () => {
          const done = await applyParts((making) => moveWorkstream(making, editableKeys(), key, by));
          if (done) latest.current.say(`${titleOf(key)} moved ${by === -1 ? "up" : "down"}.`);
        }),
      ),
    [applyParts, editableKeys, guard, track],
  );

  /** A part's head dropped on another's. */
  const onDropPart = useCallback(
    (key: string, over: string) =>
      guard("Part not moved", () =>
        track(`Moved ${titleOf(key)}`, async () => {
          const done = await applyParts((making) => droppedWorkstream(making, editableKeys(), key, over));
          if (done) latest.current.say(`${titleOf(key)} moved.`);
        }),
      ),
    [applyParts, editableKeys, guard, track],
  );

  /** "Remove part": its sessions join the part above (or the one below), nothing else is lost, so it goes at once. Its colour, group and linked text go with it, and Undo brings them back. */
  const onPartRemove = useCallback(
    (key: string) => {
      const sessionsIn = [...(latest.current.parts?.partOf ?? new Map<string, string>())].filter(([, part]) => part === key).length;
      const removedMeta: RemovedMeta = { kind: "part", badge: /^Part (\S+)/.exec(titleOf(key))?.[1] ?? "P", name: titleOf(key).split(" · ")[0], ...(sessionsIn > 0 ? { detail: `${sessionsIn} ${sessionsIn === 1 ? "session" : "sessions"}` } : null) };
      void guard("Part not removed", () =>
        track(
          (said: string | null) => said ?? "",
          async () => {
            const title = titleOf(key);
            // The parts' titles as they stand before the part goes: the page has the change as soon as it is written.
            const titles = latest.current.parts?.titles;
            let joins = "";
            // Let go of what points at the part first, so the size rule has run before the part is gone.
            if (storedWorkstreamsOf(latest.current.made).some((part) => part.key === key)) {
              const ref = [refTo({ kind: "workstream", id: key })];
              removedMeta.refs = bridgeRef.current.snapshot(ref);
              bridgeRef.current.release(ref);
            }
            const done = await applyParts((making) => {
              const change = removeWorkstream(making, editableKeys(), key);
              joins = change?.joins ?? "";
              return change;
            });
            if (!done) return null;
            const into = titles?.get(joins);
            const said = into ? REMOVE_COPY.part(title, into) : REMOVE_COPY.partAlone(title);
            latest.current.say(`${said}.`);
            return said;
          },
          { notice: true, removed: removedMeta, keys: [key] },
        ),
      );
    },
    [applyParts, editableKeys, guard, track],
  );

  /** "Move to part…", or a session's head dropped on a part: to the end of that part, or before `before`. */
  const moveToPart = useCallback(
    (key: string, to: string, before?: string) =>
      guard("Session not moved", async () => {
        if (isLegacySession(key)) return;
        await track(
          (said: string | null) => said ?? "",
          async () => {
            const done = await applyParts((making) => moveSessionToWorkstream(making, editableKeys(), key, to, before));
            if (!done) return null;
            // Said by the number it has now: the new order, counted as the List counts it.
            const offset = orderKeys(latest.current.groups).length - editableKeys().length;
            const number = done.order.indexOf(key) + 1 + offset;
            latest.current.say(`Session ${number} is now in ${titleOf(to)}.`);
            return `Moved Session ${number} to ${titleOf(to)}`;
          },
          { motion: "move", keys: [key] },
        );
      }),
    [applyParts, editableKeys, guard, track],
  );
  moveToPartRef.current = moveToPart;
  const onMoveToPart = useCallback((key: string, to: string) => moveToPart(key, to), [moveToPart]);

  /** "Same stage as the session above" in a session's menu. */
  const onWithAbove = useCallback(
    (key: string, on: boolean) =>
      void guard("Stage not saved", () =>
        track(`${on ? "Put" : "Took"} Session ${latest.current.groups.find((entry) => groupKey(entry) === key)?.number ?? ""} ${on ? "at the same stage as" : "off the stage of"} the session above`, async () => {
          const { buildId, nodes } = latest.current;
          if (!buildId || isLegacySession(key)) return;
          await nodes.run(() =>
            patchMaking(buildId, (fresh) => ({ sessions_meta: workstreamPatch(fresh, { workstreams: storedWorkstreamsOf(fresh), sessions: { [key]: { withAbove: on ? true : undefined } }, order: [] }).sessions_meta })).then(() => undefined),
          );
          await refresh(buildId);
        }),
      ),
    [guard, refresh, track],
  );

  /** CA-17 P4, P6: Create a map, Remove map, the direction and Show on build page. */
  const onMapSettings = useCallback(
    (next: MapSettings) =>
      void guard("Map settings not saved", () =>
        track(next.on ? "Changed the map" : "Removed the map", async () => {
          const { buildId, nodes } = latest.current;
          if (!buildId) return;
          await nodes.run(() => setMapSettings(buildId, next).then(() => undefined));
          await refresh(buildId);
        }),
      ),
    [guard, refresh, track],
  );

  /** "Label parts": 1, 2, 3 or A, B, C for the whole build. */
  const onLabels = useCallback(
    (labels: PartLabels) =>
      void guard("Labels not saved", () =>
        track(`Labelled the parts ${labels === "letters" ? "A, B, C" : "1, 2, 3"}`, async () => {
          const { buildId, nodes } = latest.current;
          if (!buildId) return;
          await nodes.run(() => setPartLabels(buildId, labels).then(() => undefined));
          await refresh(buildId);
        }),
      ),
    [guard, refresh, track],
  );

  /**
   * CA-20 P2: remove sessions, as one step. `all`: they go with their tiles, and the files those make. `keep`: the tiles move first, to
   * the end of the session above the first one that goes, or to the start of the session below it when none is above, and then
   * the sessions go. What points at a session (its colour, its group, the words that link to it) is let go first, and comes back
   * with it on Undo. `alsoTiles` are tiles chosen with the sessions that are not in them: they go in the same step, in either mode.
   * Resolves the sentence the notice says.
   */
  const onRemoveSessions = useCallback(
    (keys: readonly string[], mode: "keep" | "all", alsoTiles: readonly string[] = []): Promise<void> =>
      guard("Session not removed", async () => {
        const removedMeta: RemovedMeta = { kind: "session", badge: "S", name: "Session" };
        await track(
          (said: string | null) => said ?? "",
          async () => {
            const { buildId, made, nodes, steps, groups } = latest.current;
            if (!buildId) return null;
            const shown = orderKeys(groups);
            const removing = shown.filter((key) => keys.includes(key));
            if (removing.length === 0) return null;
            const numberOf = (key: string) => groups.find((entry) => groupKey(entry) === key)?.number ?? 0;
            const tiles = removing.flatMap((key) => tilesOfSession(steps, groups, key));
            const order = editableKeys();
            const leaving = new Set(removing);
            const rest = withoutKeys(order, leaving);
            const sessionRefs = removing.map((key) => refTo({ kind: "session", id: key }));
            const count = tiles.length + alsoTiles.length;
            Object.assign(removedMeta, {
              badge: removing.length === 1 ? `S${numberOf(removing[0])}` : "S",
              name: removing.length === 1 ? `Session ${numberOf(removing[0])}` : `${removing.length} sessions`,
              ...(count > 0 ? { detail: `${count} ${count === 1 ? "tile" : "tiles"}${mode === "keep" ? ", kept" : ""}` } : null),
            });

            if (mode === "keep") {
              if (rest.length === 0) return null;
              const at = order.indexOf(removing[0]);
              const above = order.slice(0, at).reverse().find((key) => !leaving.has(key));
              const target = above ?? rest.find((key) => order.indexOf(key) > at) ?? rest[0];
              const moving = tiles.map((step) => step.id);
              // Into the end of the session above: they come last. Into the start of the one below: its own tiles go behind them.
              const atEnd = above ? moving : tilesOfSession(steps, groups, target).map((step) => step.id);
              const keepRefs = [...sessionRefs, ...goingWith(nodes.current(), [...alsoTiles]).map((id) => refTo({ kind: "node", id }))];
              removedMeta.refs = bridgeRef.current.snapshot(keepRefs);
              bridgeRef.current.release(keepRefs);
              if (alsoTiles.length > 0) await nodes.run(() => dropNodes(nodes, alsoTiles));
              await applyLayout({ order: rest, reassign: new Map(moving.map((id) => [id, target])), atEnd, meta: Object.fromEntries(removing.map((key) => [key, null])), dropKeys: removing });
              await nodes.run(() => patchMaking(buildId, (fresh) => ({ sessions_collapsed: sessionsCollapsedOf(fresh).filter((entry) => !leaving.has(entry)) })).then(() => undefined));
              for (const key of removing) latest.current.onGone(key);
              await refreshMakingStats(buildId).catch(() => undefined);
              const offset = shown.length - order.length;
              const into = above ? numberOf(target) : rest.indexOf(target) + 1 + offset;
              if (alsoTiles.length > 0) return REMOVE_COPY.several(removing.length, alsoTiles.length);
              return removing.length === 1 ? REMOVE_COPY.sessionKept(numberOf(removing[0]), into) : REMOVE_COPY.severalKept(removing.length, into);
            }

            const tileIds = [...tiles.map((step) => step.id), ...alsoTiles];
            const allRefs = [...sessionRefs, ...goingWith(nodes.current(), tileIds).map((id) => refTo({ kind: "node", id }))];
            removedMeta.refs = bridgeRef.current.snapshot(allRefs);
            bridgeRef.current.release(allRefs);
            await nodes.run(async () => {
              await dropNodes(nodes, tileIds);
              for (const key of removing) {
                await setSessionMeta(buildId, key, null);
                await deleteBuildSession(buildId, key).catch(() => undefined);
              }
              await patchMaking(buildId, (fresh) => ({ session_order: rest, sessions_collapsed: sessionsCollapsedOf(fresh).filter((entry) => !leaving.has(entry)) }));
            });
            await refreshMakingStats(buildId).catch(() => undefined);
            for (const key of removing) latest.current.onGone(key);
            await refresh(buildId);
            if (removing.length === 1 && alsoTiles.length === 0) return REMOVE_COPY.session(numberOf(removing[0]), tiles.length);
            return REMOVE_COPY.several(removing.length, tiles.length + alsoTiles.length);
          },
          { notice: true, removed: removedMeta, keys: [...keys] },
        );
      }),
    [applyLayout, editableKeys, guard, refresh, track],
  );

  /** "Merge with the session above": this session's tiles go to the end of the one above, and this one is gone. */
  const onMergeUp = useCallback(
    (key: string) =>
      void guard("Sessions not merged", () =>
        track(
          (said: string | null) => said ?? "",
          async () => {
            const { made, steps, groups } = latest.current;
            const keys = editableKeys();
            const at = keys.indexOf(key);
            if (at < 1) return null;
            const upper = keys[at - 1];
            const entries = sessionsMetaOf(made);
            const mine = tilesOfSession(steps, groups, key);
            const title = mergedTitle(entries[upper]?.title, entries[key]?.title);
            const upperGroup = groups.find((entry) => groupKey(entry) === upper);
            const upperMeta: SessionMeta = entries[upper] ?? { tool: upperGroup?.tool ? (toolFor(upperGroup.tool)?.id ?? upperGroup.tool) : null, date: "" };
            const meta: Record<string, SessionMeta | null> = { [key]: null };
            if (title && title !== entries[upper]?.title && (entries[upper] || !isLegacySession(upper))) meta[upper] = { ...upperMeta, title };
            const reassign = new Map(mine.map((step) => [step.id, upper]));
            // The session that goes takes its colour, group and linked words with it.
            bridgeRef.current.release([refTo({ kind: "session", id: key })]);
            await applyLayout({ order: withoutKey(keys, key), reassign, atEnd: mine.map((step) => step.id), meta, dropKeys: [key] });
            latest.current.onGone(key);
            await refreshMakingStats(latest.current.buildId as string).catch(() => undefined);
            const number = groups.find((entry) => groupKey(entry) === key)?.number ?? at + 1;
            return mergeTitleNote(entries[upper]?.title, entries[key]?.title) ?? `Merged Session ${number} into the session above`;
          },
          true,
        ),
      ),
    [applyLayout, editableKeys, guard, track],
  );

  /** "Split session here": this tile and every tile after it start a new session right after this one. */
  const onSplitHere = useCallback(
    (stepId: string) =>
      void guard("Session not split", () =>
        track(
          (said: string | null) => said ?? "",
          async () => {
            const { made, steps, groups, nodes } = latest.current;
            const plan = splitPlan(steps, groups, stepId);
            if (!plan) return null;
            const keys = editableKeys();
            if (!keys.includes(plan.from)) return null;
            const group = groups.find((entry) => groupKey(entry) === plan.from);
            const entries = sessionsMetaOf(made);
            const key = newSessionKey();
            const day = dayOfNode(findTop(nodes.current(), stepId), todayDay());
            const tool = group?.tool && group.tool !== NO_APP ? (toolFor(group.tool)?.id ?? group.tool) : (entries[plan.from]?.tool ?? null);
            const part = entries[plan.from]?.workstream;
            const meta: Record<string, SessionMeta | null> = { [key]: { tool, date: day, ...(part ? { workstream: part } : null) } };
            const reassign = new Map(plan.tail.map((step) => [step.id, key]));
            await applyLayout({ order: insertedAfter(keys, key, plan.from), reassign, meta });
            const tile = steps.find((step) => step.id === stepId);
            return `Split Session ${group?.number ?? ""} at tile ${tile?.number ?? ""}`.replace("  ", " ");
          },
          true,
        ),
      ),
    [applyLayout, editableKeys, guard, track],
  );

  /**
   * "Move to session…", or a tile dropped on a session's head: to the end of that session. CA-21 P1, P3: with `order`, the session's
   * tiles are put in that order (a tile moved up or down, or dropped between tiles); `sentence` names the step, `said` is the line under
   * the build, and `notice` shows it with Undo.
   */
  const onMoveTile = useCallback(
    async (id: string, key: string, options: { order?: readonly string[]; sentence?: string; said?: string; notice?: boolean; failed?: string } = {}): Promise<boolean> => {
      let ok = false;
      await guard(options.failed ?? "Tile not moved", async () => {
        const target = await stable(key);
        if (!target) return;
        const { steps, groups } = latest.current;
        const step = steps.find((entry) => entry.id === id);
        const keys = orderKeys(groups).filter((entry) => !isLegacySession(entry)).concat(target).filter((entry, at, all) => all.indexOf(entry) === at);
        const number = groups.find((entry) => groupKey(entry) === key)?.number ?? "";
        const sentence = options.sentence ?? `Moved ${step ? `tile ${step.number}` : "the tile"} to Session ${number}`;
        await track(sentence, () => applyLayout({ order: keys, reassign: new Map([[id, target]]), atEnd: options.order ? [...options.order] : [id] }), options.notice ?? false);
        if (options.said) latest.current.say(options.said);
        ok = true;
      });
      return ok;
    },
    [applyLayout, guard, stable, track],
  );

  /** CA-20 P3: "Move to…" on the selection bar: several tiles to the end of one session, as one step. */
  const onMoveTiles = useCallback(
    async (ids: readonly string[], key: string): Promise<void> => {
      await guard("Tiles not moved", async () => {
        const target = await stable(key);
        if (!target) return;
        const { steps, groups } = latest.current;
        // Only a top-level tile has a session of its own.
        const top = ids.filter((id) => steps.some((step) => step.id === id));
        if (top.length === 0) return;
        const keys = orderKeys(groups).filter((entry) => !isLegacySession(entry)).concat(target).filter((entry, at, all) => all.indexOf(entry) === at);
        const number = groups.find((entry) => groupKey(entry) === key)?.number ?? "";
        await track(`Moved ${top.length === 1 ? "a tile" : `${top.length} tiles`} to Session ${number}`, () => applyLayout({ order: keys, reassign: new Map(top.map((id) => [id, target])), atEnd: top }));
      });
    },
    [applyLayout, guard, stable, track],
  );

  /** CA-20 P3: "Move to…" with sessions chosen: each to the end of a part, as one step. */
  const onMoveSessionsToPart = useCallback(
    (keys: readonly string[], to: string): Promise<void> =>
      guard("Sessions not moved", async () => {
        const moving = keys.filter((key) => !isLegacySession(key));
        if (moving.length === 0) return;
        await track(`Moved ${moving.length === 1 ? "a session" : `${moving.length} sessions`} to ${titleOf(to)}`, async () => {
          let order = editableKeys();
          for (const key of moving) {
            const done = await applyParts((making) => moveSessionToWorkstream(making, order, key, to));
            if (done) order = done.order;
          }
        });
      }),
    [applyParts, editableKeys, guard, track],
  );

  /* A tile added to a session that is not the last lands at the end of the draft; once it is written it is moved up to the
     end of its own session. Armed by the add (`arm`), done when the tree has grown. */
  const armed = useRef<number | null>(null);
  const arm = useCallback(() => {
    armed.current = topSteps(latest.current.nodes.current()).length;
  }, []);
  const topCount = topSteps(input.nodes.tree).length;
  useEffect(() => {
    if (armed.current === null || topCount <= armed.current) return;
    armed.current = null;
    const { buildId, nodes, made } = latest.current;
    if (!buildId) return;
    void nodes
      .run(async () => {
        const tree = nodes.current();
        const steps = buildSteps(tree);
        const plan = planLayout(tree, made, sessionsMetaOf(made), editableKeys());
        const moves = stackBySessionMoves(tree, steps, plan.groups);
        if (moves.length === 0) return;
        await reorderNodes(buildId, moves);
        for (const move of moves) {
          const node = findTop(nodes.current(), move.id);
          if (node) nodes.record(node.id, { ...rowOf(node), position: move.position });
        }
        await queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(buildId) });
      })
      .catch((cause) => reportError(cause, { source: "console", context: "Sessions a new tile was not put with its session" }));
  }, [topCount, editableKeys, queryClient]);

  return { onTitle, onSessionOpen, onPartOpen, onMove, onDrop, onRemoveSessions, onMoveTiles, onMoveSessionsToPart, onMergeUp, onSplitHere, onMoveTile, arm, onAddPart, onPartName, onPartFold, onPartColour, onPartStartsAfter, onPartMove, onDropPart, onPartRemove, onMoveToPart, onDropOnPart: onMoveToPart, onWithAbove, onLabels, onMapSettings };
}
