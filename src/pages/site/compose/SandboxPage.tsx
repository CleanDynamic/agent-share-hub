/* UI-P63 — /compose in the new composer: the container.

   It makes no write of its own. `useComposePage` (beside `ComposePage`) holds
   every field, the first-change-makes-the-draft rule, the debounced save, the
   cover and Publish, and this file hands the same values to `SandboxView`, so
   the Card writes exactly what the old composer did.

   What it adds is what the frame shows: the counts in the Build panel's head,
   whether Map is available yet (CONCEPT §5: two sessions or an agent), and
   which view is chosen. Everything here is read from the build already
   loaded; the steps are `buildSteps(tree)`.

   UI-P64: Sources. The sessions, files and library it draws are shaped in
   `sourcesModel.ts`. "Add session" is `attachSession` (which refreshes the
   making stats itself); a dropped or chosen file is `uploadMedia` then
   `addFile`, queued behind the composer's other node writes; a dropped `.json`
   is taken for a session export and sent to the intake.

   UI-P69: agents and teams. Add › "Agent or team" opens the dialog; `trail` is
   the agents and teams opened in the Map, outermost first (one level shows at a
   time, Esc or "Back to build" goes up one); the List's ghost rows add a prompt
   to an agent and an agent to a team.

   Mounted by `ComposeRoute` only while SANDBOX_COMPOSER_ENABLED is on. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { SeoHead } from "@/components/SeoHead";
import { useAuth } from "@/contexts/AuthContext";
import { useFinePointer, useIsPhone } from "@/components/shell/useMinWidth";
import { composeBuildQueryKey } from "@/hooks/useComposeBuild";
import type { BuildNode } from "@/lib/build/types";
import { addFile, buildSteps, canCheck, FILE_TYPE, groupKey, nestRefusal, groupKind, madeFileNamesOf, madeFilesOf, RESULT_TYPE, sessionGroups, shownGroups, testedStepOf, TOOL_TYPE, usesOf, type Step } from "@/lib/build/graph";
import { toolFor } from "@/lib/tools/registry";
import { addSetupFile, addSetupRule, addSetupServer, isSetupPayload, needsText, routeSetupFiles, setNotShared, setupItemsOf, type DroppedFile, type SetupDraft } from "@/lib/build/setup";
import { isLegacySession, sessionsMetaOf, sessionToolsOf, setSessionMeta, todayDay, newSessionKey, type MakingSession, type SessionMeta } from "@/lib/build/making";
import { fileKindFor, getMediaById, MEDIA_MAX_BYTES, mediaKindFor, signedMediaUrl, uploadMedia } from "@/lib/build/media";
import { attachSession } from "@/lib/build/sessions";
import { getNodeType } from "@/lib/build/nodeTypes";

import { mergeSave, PUBLISH_WORDS } from "./composeModel";
import { useComposePage } from "./ComposePage";
import type { PreviewMaker } from "@/components/post/PostPreview";
import { PostTab } from "./PostTab";
import { useComposeThread } from "./useComposeThread";
import { SandboxView, type SandboxCounts, type SandboxLens } from "./SandboxView";
import { AddManualStepDialog, type AddManualStepInput } from "./AddManualStepDialog";
import { AddToolDialog } from "./AddToolDialog";
import { AddSessionDialog } from "./AddSessionDialog";
import { buildSummary } from "@/lib/build/buildSummary";
import { AddCheckDialog, type AddCheckInput } from "./AddCheckDialog";
import { AddCodeDialog, type AddCodeInput } from "./AddCodeDialog";
import { AddAgentDialog, DEFAULT_AGENT_MODEL, type AddAgentInput, type AgentSeed } from "./AddAgentDialog";
import { BuildList, type AddAsAgentInput } from "./BuildList";
import { dividers, suggestionKey, type ListResult, type ListSuggestion } from "./buildListModel";
import { FullPromptWindow } from "@/components/build/FullPromptWindow";
import { BuildMap } from "./BuildMap";
import { attachFiles } from "./attachFiles";
import { DetailsPanel } from "./DetailsPanel";
import { pieces, resolveView, type MediaFacts } from "./detailsView";
import type { MapPiece, MapResult, MapSuggestion } from "@/lib/build/mapLayout";
import { suggestUses } from "@/lib/build/suggest";
import { SourcesPanel } from "./SourcesPanel";
import { isChatExport, librarySources, projectFileReminders, sourceFiles, sourceSessions } from "./sourcesModel";
import { librarySessionsKey } from "@/hooks/useLibrarySessions";

/** builds.making.sessions, read defensively: it is a json column. */
function makingSessions(making: unknown): MakingSession[] {
  const list = (making as { sessions?: unknown } | null)?.sessions;
  return Array.isArray(list) ? (list as MakingSession[]) : [];
}

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children)]);

export function SandboxPage() {
  const { viewProps, missing, build, tree, ensureBuild, nodes, sessions, prompts, compose, buildId } = useComposePage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const phone = useIsPhone();
  const fine = useFinePointer();

  /* PT-05: the thread of the post above the build. Held here so the status line and Publish can see it. */
  const thread = useComposeThread({ build, buildId, isOwner: compose.isOwner, ensureBuild });
  const { flush: flushThread, hold: threadHold } = thread;
  /* PT-07: the post draws the signed-in maker beside it, and its preview draws them too. */
  const { user, profile } = useAuth();
  const maker = useMemo<PreviewMaker>(
    () => ({
      id: user?.id ?? null,
      name: profile?.display_name ?? profile?.username ?? null,
      handle: profile?.username ?? null,
      avatar: profile?.avatar_url ?? null,
    }),
    [user?.id, profile?.display_name, profile?.username, profile?.avatar_url],
  );
  const onPublish = useCallback(async () => {
    await flushThread();
    // A thread that cannot be saved is not published half-written.
    if (threadHold) {
      toast(threadHold);
      return;
    }
    viewProps.onPublish();
  }, [flushThread, threadHold, viewProps]);
  const onRetrySave = useCallback(() => {
    if (thread.save === "error") thread.retry();
    if (viewProps.save === "error") viewProps.onRetrySave();
  }, [thread, viewProps]);

  const [lens, setLens] = useState<SandboxLens>("list");
  const [switched, setSwitched] = useState(false);
  const onLens = useCallback((next: SandboxLens) => {
    setLens(next);
    setSwitched(true);
  }, []);

  const made = (build as { making?: unknown } | null)?.making;
  const { counts, hasAgent, sessionCount, steps, groups } = useMemo(() => {
    const steps = buildSteps(tree);
    // CA-04 P1: every step sits in a session; a session made here carries its tool and day in `making.sessions_meta`.
    const groups = sessionGroups(steps, makingSessions(made), sessionToolsOf(made), sessionsMetaOf(made));
    const all = flatten(steps);
    const next: SandboxCounts = {
      sessions: shownGroups(groups).length,
      prompts: all.filter((step) => step.kind === "prompt").length,
      files: tree.filter((node) => node.type === FILE_TYPE && !isSetupPayload(node.payload)).length,
    };
    return { counts: next, hasAgent: all.some((step) => step.kind === "agent" || step.kind === "team"), sessionCount: shownGroups(groups).length, steps, groups };
  }, [tree, made]);
  const sessionTools = useMemo(() => sessionToolsOf(made), [made]);

  /* The tools this build uses, read once: its steps' own and its sessions' (TF-02). The tool picker lists them first. */
  const inBuild = useMemo(() => {
    const names = [...flatten(steps).flatMap((step) => [step.tool, step.harness]), ...groups.map((group) => group.tool)];
    return names.filter((name): name is string => Boolean(name));
  }, [steps, groups]);

  const mapAvailable = sessionCount >= 2 || hasAgent;

  /* ── agents and teams (UI-P69) ── */

  const teamType = useQuery({ queryKey: ["build", "getNodeType", "team"], queryFn: () => getNodeType("team"), staleTime: Infinity });
  const teamsAvailable = Boolean(teamType.data?.is_active);
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  /** CA-02 P4: "Add as an agent" opens the dialog with the tool and the field's text, and waits to hear it was saved. */
  const [agentSeed, setAgentSeed] = useState<AgentSeed | null>(null);
  const seedDone = useRef<((saved: boolean) => void) | null>(null);
  /** True from Add until the agent's write settles, so closing the dialog on Add does not settle the field as unsaved. */
  const savingSeed = useRef(false);
  const settleSeed = useCallback((saved: boolean) => {
    seedDone.current?.(saved);
    seedDone.current = null;
  }, []);
  const onAddAsAgent = useCallback(
    (input: AddAsAgentInput) =>
      new Promise<boolean>((resolve) => {
        settleSeed(false);
        seedDone.current = resolve;
        setAgentSeed({ harness: input.harness, instructions: input.instructions });
        setAddAgentOpen(true);
      }),
    [settleSeed],
  );
  const onAgentDialog = useCallback(
    (open: boolean) => {
      setAddAgentOpen(open);
      if (!open) {
        setAgentSeed(null);
        // A dialog closed without saving leaves the field as it was; Add settles it once the write lands.
        if (!savingSeed.current) settleSeed(false);
      }
    },
    [settleSeed],
  );
  const [addManualOpen, setAddManualOpen] = useState(false);
  /** CA-03 P5: Add › Check. */
  const [addCheckOpen, setAddCheckOpen] = useState(false);
  /** CA-02 P6: Add › Tool names its tool first. */
  const [addToolOpen, setAddToolOpen] = useState(false);
  /** CA-02 P7: Add › Code, and "Keep it as code" with the text pasted into Typed here, which waits to hear it was saved. */
  const [addCodeOpen, setAddCodeOpen] = useState(false);
  const [codeSeed, setCodeSeed] = useState<string | null>(null);
  const codeDone = useRef<((saved: boolean) => void) | null>(null);
  const savingCode = useRef(false);
  const settleCode = useCallback((saved: boolean) => {
    codeDone.current?.(saved);
    codeDone.current = null;
  }, []);
  const onKeepAsCode = useCallback(
    (text: string) =>
      new Promise<boolean>((resolve) => {
        settleCode(false);
        codeDone.current = resolve;
        setCodeSeed(text);
        setAddCodeOpen(true);
      }),
    [settleCode],
  );
  const onCodeDialog = useCallback(
    (open: boolean) => {
      setAddCodeOpen(open);
      if (!open) {
        setCodeSeed(null);
        if (!savingCode.current) settleCode(false);
      }
    },
    [settleCode],
  );
  const manualType = useQuery({ queryKey: ["build", "getNodeType", "manual_step"], queryFn: () => getNodeType("manual_step"), staleTime: Infinity });
  const manualAvailable = Boolean(manualType.data?.is_active);
  /** Ids of the agents and teams opened in the Map, outermost first. */
  const [trail, setTrail] = useState<readonly string[]>([]);
  const trailSteps = useMemo(() => {
    const all = flatten(steps);
    const found: Step[] = [];
    for (const id of trail) {
      const step = all.find((candidate) => candidate.id === id && (candidate.kind === "agent" || candidate.kind === "team"));
      if (!step) break;
      found.push(step);
    }
    return found;
  }, [steps, trail]);
  const opened = trailSteps.length > 0 ? trailSteps[trailSteps.length - 1] : null;
  const onOpenContainer = useCallback(
    (id: string) =>
      setTrail((previous) => {
        const at = previous.indexOf(id);
        return at >= 0 ? previous.slice(0, at + 1) : [...previous, id];
      }),
    [],
  );
  const onBack = useCallback(() => setTrail((previous) => previous.slice(0, -1)), []);
  const onTrail = useCallback((depth: number) => setTrail((previous) => previous.slice(0, depth)), []);

  /* ── List (UI-P65) ── */

  const [focusAdd, setFocusAdd] = useState(0);
  /** "Name a file it makes": the prompt whose Makes field Details opens, and when it was asked. */
  const [focusMakes, setFocusMakes] = useState<{ id: string; at: number } | null>(null);
  const onAddPromptFocus = useCallback(() => setFocusAdd((count) => count + 1), []);
  const listFacts = useMemo(() => {
    const names: Record<string, string> = {};
    const intoResult = new Set<string>();
    const results: ListResult[] = [];
    const numberOf = new Map(steps.map((step) => [step.id, step.number]));
    for (const node of tree) {
      const payload = (node.payload ?? {}) as Record<string, unknown>;
      const str = (key: string) => (typeof payload[key] === "string" && (payload[key] as string).trim() ? (payload[key] as string) : null);
      if (node.type === FILE_TYPE) names[node.id] = str("title") ?? "Untitled file";
      else if (node.type === TOOL_TYPE) names[node.id] = str("service") ?? "Tool";
      else if (node.type === RESULT_TYPE) {
        const from = usesOf(node).find((use) => use.kind === "output");
        if (from) intoResult.add(from.node_id);
        results.push({
          id: node.id,
          title: str("summary") ?? str("url") ?? "Result",
          holds: payload.media_id ? "a picture" : payload.url ? "a link" : "text",
          from: from ? (numberOf.get(from.node_id) ?? null) : null,
        });
      }
    }
    return { names, intoResult, results };
  }, [tree, steps]);
  const mapPieces = useMemo(() => pieces(tree, []), [tree]);
  const madeFiles = useMemo(() => madeFilesOf(tree), [tree]);
  const madeNames = useMemo(() => madeFileNamesOf(tree), [tree]);
  /** The files each step makes, by step id: the List's "Makes" line. */
  const madeByStep = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const [fileId, stepId] of madeFiles) {
      const name = madeNames.get(fileId);
      if (name) (out[stepId] ??= []).push(name);
    }
    return out;
  }, [madeFiles, madeNames]);
  /** The Map's files: a made file says which step makes it, so the Map places it after that step. */
  const mapFiles = useMemo<MapPiece[]>(() => mapPieces.files.map((file) => ({ id: file.id, name: file.name, madeBy: madeFiles.get(file.id) ?? null })), [mapPieces.files, madeFiles]);
  // UI-P71: exact facts only — a file named word for word in a prompt.
  const suggestions: ListSuggestion[] = useMemo(
    () =>
      suggestUses(
        steps,
        Object.entries(listFacts.names)
          .filter(([id]) => tree.some((node) => node.id === id && node.type === FILE_TYPE && !isSetupPayload(node.payload)))
          .map(([id, name]) => ({ id, name })),
        madeFiles,
      ).map((suggestion) => ({ ...suggestion, label: listFacts.names[suggestion.use.node_id] ?? "File" })),
    [steps, tree, listFacts.names, madeFiles],
  );
  const mapSuggestions: MapSuggestion[] = useMemo(
    () => suggestions.map(({ stepId, use, label }) => ({ stepId, use, label })),
    [suggestions],
  );
  const mapResults = useMemo<MapResult[]>(
    () =>
      tree
        .filter((node) => node.type === RESULT_TYPE && node.parent_id === null)
        .map((node) => {
          const payload = (node.payload ?? {}) as Record<string, unknown>;
          const text = (key: string) => (typeof payload[key] === "string" && (payload[key] as string).trim() ? (payload[key] as string) : null);
          return { id: node.id, title: text("summary") ?? text("url") ?? "Result", fromId: usesOf(node).find((use) => use.kind === "output")?.node_id ?? null };
        }),
    [tree],
  );
  /** CA-04 P4: each session's setup, and how many items it holds. */
  const setupCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const item of setupItemsOf(tree)) out[item.session] = (out[item.session] ?? 0) + 1;
    return out;
  }, [tree]);
  const dividerRows = useMemo(() => dividers(steps, groups, setupCounts), [steps, groups, setupCounts]);

  /* ── Sources ── */

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const onNameMade = useCallback((stepId: string) => {
    setSelectedId(stepId);
    setFocusMakes({ id: stepId, at: Date.now() });
  }, []);
  // The ask belongs to the prompt it was made on: once something else is selected it is spent.
  useEffect(() => {
    if (focusMakes && selectedId !== focusMakes.id) setFocusMakes(null);
  }, [selectedId, focusMakes]);
  /** UI-P67: the prompt open in the full prompt window. */
  const [openPromptId, setOpenPromptId] = useState<string | null>(null);
  const [adding, setAdding] = useState<ReadonlySet<string>>(new Set());
  const picker = useRef<HTMLInputElement>(null);
  /** The prompt that opened the picker; none for Sources and Add › File, which add to the build. */
  const pickFor = useRef<string | null>(null);
  const pick = useCallback(() => {
    pickFor.current = null;
    picker.current?.click();
  }, []);
  const pickForStep = useCallback((stepId: string) => {
    pickFor.current = stepId;
    picker.current?.click();
  }, []);

  const sourceSessionRows = useMemo(() => sourceSessions(groups, steps, sessions.sessions, sessionTools, setupCounts), [groups, steps, sessions.sessions, sessionTools, setupCounts]);
  const sourceFileRows = useMemo(() => sourceFiles(tree, groups, steps), [tree, groups, steps]);

  /* ── sessions (CA-04 P1) ── */

  /** The session the maker chose for what they add next; the build's last session while they have chosen none. */
  const [chosenSession, setChosenSession] = useState<string | null>(null);
  const shown = useMemo(() => shownGroups(groups), [groups]);
  const currentSession = useMemo(() => {
    if (chosenSession && sourceSessionRows.some((row) => row.key === chosenSession)) return chosenSession;
    const last = shown[shown.length - 1];
    return last ? groupKey(last) : null;
  }, [chosenSession, sourceSessionRows, shown]);
  /* The add field names its session once the build has more than the one session its typed prompts make. */
  const sessionChoices = useMemo(
    () =>
      shown.length > 1 || shown.some((group) => groupKind(group) !== "legacy")
        ? sourceSessionRows.map((row) => ({ key: row.key, label: `Session ${row.number} · ${row.tool}`, tool: row.tool === "Typed here" || row.tool === "Unknown tool" ? null : row.tool }))
        : undefined,
    [shown, sourceSessionRows],
  );
  const [addSessionOpen, setAddSessionOpen] = useState(false);
  const refreshRecord = useCallback(async (id: string) => queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(id) }), [queryClient]);

  /** An old build's run of typed prompts, saved as a session made here so it can change. Resolves its new key. */
  const claim = useCallback(
    async (key: string, change: Partial<SessionMeta> = {}): Promise<string | null> => {
      const group = groups.find((candidate) => groupKey(candidate) === key);
      if (!group) return null;
      const ids = steps.filter((step) => group.stepNumbers.includes(step.number)).map((step) => step.id);
      const meta: SessionMeta = { tool: group.tool ? (toolFor(group.tool)?.id ?? group.tool) : null, date: todayDay(), ...change };
      const next = await prompts.claimSession(ids, meta);
      if (next) setChosenSession(next);
      return next;
    },
    [groups, steps, prompts],
  );

  /**
   * The session a new step records. None while it is an old build's last run of typed prompts, which a step added at
   * the end joins by itself; an earlier run is saved first, so the step can name it.
   */
  const sessionToWrite = useCallback(async (): Promise<string | null> => {
    const key = currentSession;
    if (!key) return null;
    if (!isLegacySession(key)) return key;
    const last = shown[shown.length - 1];
    if (last && groupKey(last) === key) return null;
    return claim(key);
  }, [currentSession, shown, claim]);

  const onNewSession = useCallback(
    async (tool: string | null) => {
      try {
        const id = await ensureBuild();
        const key = newSessionKey();
        await setSessionMeta(id, key, { tool, date: todayDay() });
        await refreshRecord(id);
        setChosenSession(key);
      } catch (cause) {
        console.error("[Sandbox] session not made", cause);
        toast.error("Couldn't make that session. Try again.");
      }
    },
    [ensureBuild, refreshRecord],
  );

  const onSessionMeta = useCallback(
    async (key: string, change: { tool?: string | null; date?: string }) => {
      try {
        if (isLegacySession(key)) {
          await claim(key, change);
          return;
        }
        const id = await ensureBuild();
        const group = groups.find((candidate) => groupKey(candidate) === key);
        const before = sessionsMetaOf(made)[key] ?? { tool: group?.tool ?? null, date: group?.startedAt ?? todayDay() };
        await setSessionMeta(id, key, { ...before, ...change });
        await refreshRecord(id);
      } catch (cause) {
        console.error("[Sandbox] session not saved", cause);
        toast.error("Couldn't save that session. Try again.");
      }
    },
    [claim, ensureBuild, groups, made, refreshRecord],
  );

  const onAddPrompt = useCallback(
    async (input: { text: string; tool: string | null; model: string | null }) => prompts.addNow({ ...input, session: await sessionToWrite() }),
    [prompts, sessionToWrite],
  );
  const reminderRows = useMemo(() => projectFileReminders(sourceSessionRows, sourceFileRows), [sourceSessionRows, sourceFileRows]);
  const libraryRows = useMemo(() => librarySources(sessions.library, adding, Date.now()), [sessions.library, adding]);

  /* ── Details (UI-P66) ── */

  // A session's prompts are read when it is selected, for its checklist.
  const selectedSession = sourceSessionRows.find((row) => row.key === selectedId && !row.key.startsWith("typed-"));
  const { setOpenIds } = sessions;
  useEffect(() => {
    setOpenIds(selectedSession ? [selectedSession.key] : []);
  }, [selectedSession, setOpenIds]);

  /** Media ids a selected file or result points at; their names and sizes come from build_media. */
  const mediaIds = useMemo(() => {
    const node = tree.find((candidate) => candidate.id === selectedId);
    const id = (node?.payload as { media_id?: unknown } | null)?.media_id;
    return typeof id === "string" && id ? [id] : [];
  }, [tree, selectedId]);
  const mediaRows = useQueries({
    queries: mediaIds.map((id) => ({ queryKey: ["build", "getMediaById", id], queryFn: () => getMediaById(id), staleTime: 60_000 })),
  });
  const mediaFacts = useCallback(
    (id: string): MediaFacts | undefined => {
      const row = mediaRows[mediaIds.indexOf(id)]?.data;
      return row ? { name: row.filename, bytes: row.bytes } : undefined;
    },
    [mediaRows, mediaIds],
  );

  const view = useMemo(
    () =>
      resolveView({
        selectedId,
        steps,
        groups,
        tree,
        sources: sourceSessionRows,
        sourceFiles: sourceFileRows,
        promptsState: sessions.promptsState,
        intoResult: listFacts.intoResult,
        media: mediaFacts,
      }),
    [selectedId, steps, groups, tree, sourceSessionRows, sourceFileRows, sessions.promptsState, listFacts.intoResult, mediaFacts],
  );

  /** Writes to a node inside an agent or a team are not laid over the tree, so read the build again once they land. */
  const afterWrite = useCallback(() => {
    void nodes.settled().then(() => {
      if (build?.id) void queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(build.id) });
    });
  }, [nodes, build?.id, queryClient]);

  /* ── tiles inside tiles (CA-04 P2) ── */

  const canNest = useCallback((id: string, parentId: string) => nestRefusal(tree, id, parentId) === null, [tree]);
  const onNest = useCallback(
    async (id: string, parentId: string | null, index: number) => {
      const done = await prompts.nest(id, parentId, index);
      if (done) afterWrite();
      return done;
    },
    [prompts, afterWrite],
  );
  /** A tile dropped on a session's head: placed after that session's last step, then put in it. */
  const onMoveToSession = useCallback(
    async (id: string, key: string) => {
      const group = groups.find((candidate) => groupKey(candidate) === key);
      const last = group?.stepNumbers[group.stepNumbers.length - 1];
      const end = last ? steps.findIndex((step) => step.number === last) + 1 : steps.length;
      const from = steps.findIndex((step) => step.id === id);
      const stable = isLegacySession(key) ? await claim(key) : key;
      if (!stable) return false;
      if (!(await prompts.nest(id, null, from >= 0 && from < end ? end - 1 : end))) return false;
      prompts.setSessionOf(id, stable);
      afterWrite();
      return true;
    },
    [groups, steps, claim, prompts, afterWrite],
  );

  const onAddAgentOrTeam = useCallback(
    async (input: AddAgentInput) => {
      savingSeed.current = true;
      const session = await sessionToWrite();
      const id = await prompts.addAgentOrTeam({ ...input, session }).finally(() => {
        savingSeed.current = false;
      });
      settleSeed(Boolean(id));
      if (!id) return;
      setSelectedId(id);
      afterWrite();
    },
    [prompts, afterWrite, settleSeed, sessionToWrite],
  );

  const onAddAgentTo = useCallback(
    async (teamId: string) => {
      const team = steps.find((candidate) => candidate.id === teamId);
      // The new agent starts on the model of the last one in the team.
      const model = team?.children[team.children.length - 1]?.model ?? DEFAULT_AGENT_MODEL;
      const id = await prompts.addAgentTo(teamId, model);
      if (!id) return;
      setSelectedId(id);
      afterWrite();
    },
    [prompts, steps, afterWrite],
  );

  /** Goes after the selected step (the one a selected step sits in, when it is inside an agent or a team), else at the end. */
  const afterStep = useMemo(() => {
    const top = steps.find((step) => step.id === selectedId || flatten(step.children).some((child) => child.id === selectedId));
    return top ?? null;
  }, [steps, selectedId]);

  const onAddManual = useCallback(
    async (input: AddManualStepInput) => {
      const id = await prompts.addManual({ ...input, afterId: afterStep?.id ?? null, session: await sessionToWrite() });
      if (!id) return;
      setSelectedId(id);
      afterWrite();
    },
    [prompts, afterStep, afterWrite, sessionToWrite],
  );

  const onAddCheck = useCallback(
    async (input: AddCheckInput) => {
      // A check uses the step it tested: the selected one, else the last agent, team or code.
      const id = await prompts.addCheckStep({ ...input, testedStep: testedStepOf(steps, afterStep?.id ?? null), session: await sessionToWrite() });
      if (!id) return;
      setSelectedId(id);
      afterWrite();
    },
    [prompts, steps, afterStep, afterWrite, sessionToWrite],
  );

  const onAddCode = useCallback(
    async (input: AddCodeInput) => {
      savingCode.current = true;
      const session = await sessionToWrite();
      const id = await prompts.addCodeSteps({ ...input, session }).finally(() => {
        savingCode.current = false;
      });
      settleCode(Boolean(id));
      if (id) setSelectedId(id);
    },
    [prompts, settleCode, sessionToWrite],
  );

  const onAddAgentPrompt = useCallback(
    async (agentId: string, text: string) => {
      const saved = await prompts.addPromptTo(agentId, text);
      if (saved) afterWrite();
      return saved;
    },
    [prompts, afterWrite],
  );

  const addPiece = useCallback(
    async (kind: "tool" | "result", name?: string) => {
      const id = await prompts.addPiece(kind, name);
      if (id) setSelectedId(id);
    },
    [prompts],
  );

  const download = useCallback(
    async (nodeId: string) => {
      const node = tree.find((candidate) => candidate.id === nodeId);
      const payload = (node?.payload ?? {}) as { media_id?: unknown; url?: unknown };
      try {
        if (typeof payload.media_id === "string" && payload.media_id) {
          const media = await getMediaById(payload.media_id);
          if (!media) throw new Error("media missing");
          window.open(await signedMediaUrl(media, { width: "original" }), "_blank", "noopener");
        } else if (typeof payload.url === "string" && payload.url) {
          window.open(payload.url, "_blank", "noopener");
        }
      } catch (cause) {
        console.error("[Sandbox] download failed", cause);
        toast.error("Couldn't download that. Try again.");
      }
    },
    [tree],
  );

  const addPicture = useCallback(
    async (resultId: string, file: File) => {
      if (!mediaKindFor(file.type) || file.size > MEDIA_MAX_BYTES) {
        toast.error(`${file.name} can't be added as a picture.`);
        return;
      }
      try {
        const id = await ensureBuild();
        const media = await nodes.run(() => uploadMedia({ buildId: id, file }));
        prompts.setFields(resultId, { media_id: media.id });
      } catch (cause) {
        console.error("[Sandbox] picture not added", cause);
        toast.error(`Couldn't add ${file.name}. Try again.`);
      }
    },
    [ensureBuild, nodes, prompts],
  );

  const setAsCover = useCallback(
    async (mediaId: string) => {
      try {
        const media = await getMediaById(mediaId);
        if (!media) throw new Error("media missing");
        const response = await fetch(await signedMediaUrl(media, { width: "original" }));
        const blob = await response.blob();
        viewProps.onFiles([new File([blob], media.filename ?? "cover", { type: media.mime ?? blob.type })]);
      } catch (cause) {
        console.error("[Sandbox] cover not set", cause);
        toast.error("Couldn't use that as the cover. Try again.");
      }
    },
    [viewProps],
  );

  const onAddSession = useCallback(
    async (importId: string) => {
      setAdding((previous) => new Set(previous).add(importId));
      try {
        const id = await ensureBuild();
        await attachSession(importId, { kind: "existing", buildId: id });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(id) }),
          queryClient.invalidateQueries({ queryKey: ["build", "listBuildSessions"] }),
          queryClient.invalidateQueries({ queryKey: ["build", "getMadeWith"] }),
          queryClient.invalidateQueries({ queryKey: librarySessionsKey }),
        ]);
      } catch (cause) {
        console.error("[Sandbox] session not added", cause);
        toast.error("Couldn't add that session. Try again.");
      } finally {
        setAdding((previous) => {
          const next = new Set(previous);
          next.delete(importId);
          return next;
        });
      }
    },
    [ensureBuild, queryClient],
  );

  /** One file of the build: stored through the media path, then recorded as a file node, behind the other node writes. CA-04 P2: with `parentId`, sent with that step. */
  const addOneFile = useCallback(
    async (file: File, verb: "add" | "attach" = "add", parentId: string | null = null): Promise<BuildNode | null> => {
      const decided = fileKindFor(file);
      if ("refused" in decided) {
        toast.error(decided.refused);
        return null;
      }
      if (file.size > MEDIA_MAX_BYTES) {
        toast.error(`${file.name} is too big. The limit is ${Math.round(MEDIA_MAX_BYTES / (1024 * 1024))} MB.`);
        return null;
      }
      try {
        const id = await ensureBuild();
        const added: { node: BuildNode | null } = { node: null };
        await nodes.run(async () => {
          const media = await uploadMedia({ buildId: id, file });
          const node = await addFile(id, nodes.current(), { title: file.name, media_id: media.id, parentId });
          nodes.record(node.id, node);
          added.node = node;
        });
        await queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(id) });
        return added.node;
      } catch (cause) {
        console.error("[Sandbox] file not added", cause);
        toast.error(`Couldn't ${verb} ${file.name}. Try again.`);
        return null;
      }
    },
    [ensureBuild, nodes, queryClient],
  );

  /** Files onto one prompt: each is added to the build and then listed as that prompt's input, in order. */
  const attach = useCallback(
    (stepId: string, files: File[]) =>
      attachFiles(stepId, files, (file) => addOneFile(file, "attach"), (id, use) => {
        prompts.accept(id, use, steps);
        afterWrite();
      }),
    [addOneFile, prompts, steps, afterWrite],
  );

  /** A drop on a step's card: a chat export goes to the intake and nothing is attached. */
  const onDropOnStep = useCallback(
    async (stepId: string, files: File[]) => {
      if ((await Promise.all(files.map(isChatExport))).some(Boolean)) {
        navigate("/compose/start");
        return;
      }
      // CA-04 P2: a file dropped on a step is sent with it: a tile inside that step.
      for (const file of files) await addOneFile(file, "attach", stepId);
    },
    [addOneFile, navigate],
  );

  /* ── the session setup (CA-04 P4) ── */

  /** The session a setup goes to: the one given, else the current one, saved first when it is an old build's run. */
  const sessionForSetup = useCallback(
    async (key: string | null): Promise<string | null> => {
      const wanted = key ?? currentSession;
      if (wanted && !isLegacySession(wanted)) return wanted;
      if (wanted) return claim(wanted);
      // A build with no session yet starts one, typed here, for its setup.
      const id = await ensureBuild();
      const made = newSessionKey();
      await setSessionMeta(id, made, { tool: null, date: todayDay() });
      setChosenSession(made);
      return made;
    },
    [currentSession, claim, ensureBuild],
  );

  /** A file stored for the setup, or null when it was refused (the maker has been told). */
  const storeSetupFile = useCallback(async (buildId: string, file: File): Promise<string | null> => {
    const decided = fileKindFor(file);
    if ("refused" in decided) {
      toast.error(decided.refused);
      return null;
    }
    if (file.size > MEDIA_MAX_BYTES) {
      toast.error(`${file.name} is too big. The limit is ${Math.round(MEDIA_MAX_BYTES / (1024 * 1024))} MB.`);
      return null;
    }
    return (await uploadMedia({ buildId, file })).id;
  }, []);

  /**
   * Files routed to a session's setup when their names say what they are (`routeSetupFiles`); with `all`, every file
   * goes to the setup, the ones no name places as instructions. Resolves with the files that stay the build's own.
   * An .mcp.json and a .claude/settings.json are read, never stored, and a server's secrets never leave this page.
   */
  const addSetup = useCallback(
    async (files: File[], paths: readonly string[] | undefined, { session = null, all = false }: { session?: string | null; all?: boolean } = {}): Promise<File[]> => {
      const dropped: DroppedFile[] = await Promise.all(
        files.map(async (file, at) => {
          const path = paths?.[at] || file.name;
          return { name: file.name, path, text: needsText(path) ? await file.text().catch(() => "") : undefined };
        }),
      );
      const { drafts, rest } = routeSetupFiles(dropped);
      const plan: SetupDraft[] = all ? [...drafts, ...rest.map((at): SetupDraft => ({ kind: "instructions", file: at }))] : drafts;
      const left = all ? [] : rest.map((at) => files[at]);
      if (plan.length === 0) return left;
      try {
        const id = await ensureBuild();
        const key = await sessionForSetup(session);
        if (!key) return left;
        await nodes.run(async () => {
          for (const draft of plan) {
            if (draft.kind === "server") {
              const node = await addSetupServer(id, nodes.current(), key, draft.server);
              nodes.record(node.id, node);
            } else if (draft.kind === "rule") {
              const node = await addSetupRule(id, nodes.current(), key, draft.rule);
              nodes.record(node.id, node);
            } else {
              const file = files[draft.file];
              const media = await storeSetupFile(id, file);
              if (!media) continue;
              const node = await addSetupFile(id, nodes.current(), {
                session: key,
                kind: draft.kind,
                title: file.name,
                path: dropped[draft.file].path,
                media_id: media,
                ...(draft.kind === "skill" ? { skill: { name: draft.name, description: draft.description } } : null),
              });
              nodes.record(node.id, node);
              if (draft.kind === "skill") {
                for (const at of draft.files) {
                  const inner = await storeSetupFile(id, files[at]);
                  if (!inner) continue;
                  const child = await addSetupFile(id, nodes.current(), { session: key, kind: "skill", title: files[at].name, path: dropped[at].path, media_id: inner, parentId: node.id });
                  nodes.record(child.id, child);
                }
              }
            }
          }
        });
        await refreshRecord(id);
      } catch (cause) {
        console.error("[Sandbox] setup not added", cause);
        toast.error("Couldn't add that to the setup. Try again.");
      }
      return left;
    },
    [ensureBuild, sessionForSetup, nodes, storeSetupFile, refreshRecord],
  );

  /** "Add to setup": the picker's next files go to that session's setup. */
  const setupFor = useRef<string | null>(null);
  const pickForSetup = useCallback((key: string) => {
    pickFor.current = null;
    setupFor.current = key;
    picker.current?.click();
  }, []);

  const onNotShared = useCallback(
    (id: string) =>
      void nodes
        .run(async () => {
          const node = tree.find((candidate) => candidate.id === id);
          if (!node) return;
          const { children: _children, ...row } = node;
          nodes.record(id, await setNotShared(row, true));
        })
        .catch((cause) => {
          console.error("[Sandbox] not marked", cause);
          toast.error("Couldn't change that. Try again.");
        }),
    [nodes, tree],
  );

  /** "Setup 2" on a session's head: the session in Details, scrolled to its Setup. */
  const [focusSetup, setFocusSetup] = useState<{ key: string; at: number } | null>(null);
  const onOpenSetup = useCallback((key: string) => {
    setSelectedId(key);
    setFocusSetup({ key, at: Date.now() });
  }, []);

  /** A drop sorts its files: a chat export goes to the intake, a setup file to the current session's setup, the rest are files of the build. */
  const onDropFiles = useCallback(
    async (files: File[], paths?: string[]) => {
      if ((await Promise.all(files.map(isChatExport))).some(Boolean)) {
        navigate("/compose/start");
        return;
      }
      for (const file of await addSetup(files, paths)) void addOneFile(file);
    },
    [addOneFile, addSetup, navigate],
  );

  /** The picker is an explicit choice of files, so nothing is taken for an export; setup files still go to the setup. */
  const onPicked = useCallback(
    async (files: File[]) => {
      for (const file of await addSetup(files, undefined)) void addOneFile(file);
    },
    [addOneFile, addSetup],
  );

  return (
    <>
      <SeoHead title="Compose · buildgallery" description="Write your build." path="/compose" noIndex />
      <input
        ref={picker}
        type="file"
        multiple
        hidden
        data-testid="sources-file"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          const stepId = pickFor.current;
          const setupKey = setupFor.current;
          pickFor.current = null;
          setupFor.current = null;
          if (files.length === 0) return;
          if (setupKey) void addSetup(files, undefined, { session: setupKey, all: true });
          else if (stepId) void attach(stepId, files);
          else void onPicked(files);
        }}
      />
      <SandboxView
        {...viewProps}
        save={mergeSave(viewProps.save, thread.save)}
        onRetrySave={onRetrySave}
        onPublish={() => void onPublish()}
        post={
          <PostTab
            thread={thread}
            phone={phone}
            draft={{ build, title: viewProps.title, maker }}
          />
        }
        threadNote={thread.hold}
        onNewSession={() => setAddSessionOpen(true)}
        onAddFile={pick}
        onAddPromptFocus={onAddPromptFocus}
        onAddTool={() => setAddToolOpen(true)}
        onAddResult={() => void addPiece("result")}
        onAddAgent={() => setAddAgentOpen(true)}
        onAddManual={() => setAddManualOpen(true)}
        onAddCode={() => setAddCodeOpen(true)}
        onAddCheck={() => setAddCheckOpen(true)}
        checkable={canCheck(steps)}
        summary={steps.length > 1 ? buildSummary(steps) || undefined : undefined}
        trail={trailSteps.map((step) => ({ id: step.id, title: step.title ?? step.defaultTitle }))}
        onTrail={onTrail}
        map={
          <BuildMap
            steps={steps}
            groups={groups}
            files={mapFiles}
            tools={mapPieces.tools}
            results={mapResults}
            suggestions={mapSuggestions}
            made={madeFiles}
            madeNames={madeNames}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onClear={() => setSelectedId(null)}
            onOpenPrompt={setOpenPromptId}
            opened={opened}
            onOpenContainer={onOpenContainer}
            onBack={onBack}
            onLeave={(id) => {
              setTrail([]);
              setSelectedId(id);
            }}
            onConnect={(toId, use) => {
              prompts.accept(toId, use, steps);
              afterWrite();
            }}
          />
        }
        selection={
          <DetailsPanel
            phone={phone}
            view={view}
            inBuild={inBuild}
            focusMakes={focusMakes}
            onSelect={setSelectedId}
            onOpenPrompt={setOpenPromptId}
            onRename={prompts.rename}
            onModel={prompts.setModel}
            onAddMade={(stepId, name) => void prompts.addMadeFile(stepId, name)}
            onRemoveMade={(fileId) => {
              prompts.removeMadeFile(fileId);
              afterWrite();
            }}
            onAddUse={(id, use) => {
              prompts.accept(id, use, steps);
              afterWrite();
            }}
            onAttach={pickForStep}
            onRemoveUse={(id, use) => {
              prompts.removeUse(id, use);
              afterWrite();
            }}
            onRuns={(id, runs) => {
              prompts.setRuns(id, runs);
              afterWrite();
            }}
            onManual={(id, fields) => {
              prompts.setManual(id, fields);
              afterWrite();
            }}
            onManualPicture={(id, file) => {
              void prompts.setManualPicture(id, file).then(afterWrite);
            }}
            onInstructions={(id, text) => {
              prompts.setInstructions(id, text);
              afterWrite();
            }}
            onAgentSetup={(id, setup) => {
              prompts.setAgent(id, setup);
              afterWrite();
            }}
            onRemoveInside={(id) => {
              prompts.removeInside(id);
              afterWrite();
            }}
            onToggleSessionPrompt={(session, row, on) => {
              if (on) {
                const real = sessions.library.find((candidate) => candidate.id === session.key);
                if (real) prompts.add(real.id, row.ordinal);
              } else if (row.stepId) prompts.remove(row.stepId);
            }}
            onSessionTool={(sessionId, tool) => void sessions.setTool(sessionId, tool)}
            onSessionMeta={(key, change) => void onSessionMeta(key, change)}
            onDownload={(id) => void download(id)}
            onFields={prompts.setFields}
            onAddPicture={(id, file) => void addPicture(id, file)}
            onUseAsCover={(mediaId) => void setAsCover(mediaId)}
            onAddToSetup={pickForSetup}
            onNotShared={onNotShared}
            focusSetup={focusSetup}
          />
        }
        list={
          <BuildList
            phone={phone}
            steps={steps}
            dividers={dividerRows}
            names={listFacts.names}
            suggestions={suggestions}
            intoResult={listFacts.intoResult}
            results={listFacts.results}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onOpenPrompt={setOpenPromptId}
            onRename={prompts.rename}
            onMove={prompts.move}
            onRemove={prompts.remove}
            onAddAgentPrompt={onAddAgentPrompt}
            onAddAgentTo={(teamId) => void onAddAgentTo(teamId)}
            onAttach={pickForStep}
            onNameMade={onNameMade}
            madeNames={madeByStep}
            onDropOnStep={(id, files) => void onDropOnStep(id, files)}
            onNest={onNest}
            canNest={canNest}
            onMoveToSession={onMoveToSession}
            onKeepSentWith={(suggestion) => {
              prompts.keepSentWith(suggestion);
              afterWrite();
            }}
            onIgnoreSentWith={prompts.ignoreSentWith}
            onOpenSetup={onOpenSetup}
            fine={fine}
            onAccept={(suggestion) => prompts.accept(suggestion.stepId, suggestion.use, steps)}
            onDismiss={(suggestion) => prompts.dismiss(suggestion.stepId, suggestionKey(suggestion.use))}
            onAddPrompt={onAddPrompt}
            sessionChoices={sessionChoices}
            currentSession={currentSession}
            onCurrentSession={setChosenSession}
            onNewSession={() => setAddSessionOpen(true)}
            onAddAsAgent={onAddAsAgent}
            onKeepAsCode={onKeepAsCode}
            inBuild={inBuild}
            focusAdd={focusAdd}
          />
        }
        addableSessions={libraryRows.filter((row) => !row.adding)}
        onAddSession={(id) => void onAddSession(id)}
        sources={
          <SourcesPanel
            phone={phone}
            fine={fine}
            status={sessions.status}
            onRetry={sessions.retry}
            sessions={sourceSessionRows}
            files={sourceFileRows}
            library={libraryRows}
            reminders={reminderRows}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAddSession={(id) => void onAddSession(id)}
            onDropFiles={onDropFiles}
            onPick={pick}
            connectHref="/connect"
          />
        }
        missing={missing.map((key) => ({ key, label: PUBLISH_WORDS[key] }))}
        counts={counts}
        lens={lens}
        onLens={onLens}
        mapAvailable={mapAvailable}
        mapHint={mapAvailable && !switched}
      />
      <AddAgentDialog
        open={addAgentOpen}
        onOpenChange={onAgentDialog}
        nextNumber={steps.length + 1}
        teamsAvailable={teamsAvailable}
        seed={agentSeed}
        inBuild={inBuild}
        onAdd={(input) => void onAddAgentOrTeam(input)}
      />
      <AddManualStepDialog
        open={addManualOpen}
        onOpenChange={setAddManualOpen}
        after={afterStep ? `${afterStep.number} · ${afterStep.title ?? afterStep.defaultTitle}` : null}
        available={manualAvailable}
        inBuild={inBuild}
        onAdd={(input) => void onAddManual(input)}
      />
      <AddCheckDialog open={addCheckOpen} onOpenChange={setAddCheckOpen} onAdd={(input) => void onAddCheck(input)} />
      <AddCodeDialog open={addCodeOpen} onOpenChange={onCodeDialog} inBuild={inBuild} seed={codeSeed} onAdd={(input) => void onAddCode(input)} />
      <AddSessionDialog open={addSessionOpen} onOpenChange={setAddSessionOpen} inBuild={inBuild} onAdd={(tool) => void onNewSession(tool)} />
      <AddToolDialog open={addToolOpen} onOpenChange={setAddToolOpen} inBuild={inBuild} onAdd={(service) => void addPiece("tool", service)} />
      <FullPromptWindow
        steps={steps}
        groups={groups}
        names={listFacts.names}
        openId={openPromptId}
        mode="maker"
        onTitle={prompts.rename}
        onNavigate={setOpenPromptId}
        onClose={() => setOpenPromptId(null)}
      />
    </>
  );
}

export default SandboxPage;
