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
import { flushSync } from "react-dom";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { SeoHead } from "@/components/SeoHead";
import { useAuth } from "@/contexts/AuthContext";
import { useFinePointer, useIsPhone } from "@/components/shell/useMinWidth";
import { composeBuildQueryKey } from "@/hooks/useComposeBuild";
import type { BuildNode } from "@/lib/build/types";
import { addFile, buildSteps, fileKindOf, previewOf, canCheck, resultFactsOf, resultHoldsWord, FILE_TYPE, groupKey, nestRefusal, groupKind, madeFileNamesOf, madeFilesOf, RESULT_TYPE, sessionGroups, shownGroups, testedStepOf, TOOL_TYPE, usesOf, type ResultInput, type Step } from "@/lib/build/graph";
import { toolFor } from "@/lib/tools/registry";
import { addWrittenPrompt } from "@/lib/build/composePrompts";
import { addSetupFile, addSetupRule, addSetupServer, addSetupWorkflow, isSetupPayload, needsText, routeSetupFiles, setNotShared, setupItemsOf, type DroppedFile, type SetupDraft } from "@/lib/build/setup";
import { goalRefusal, type SessionGoal } from "@/lib/build/making";
import { countCases, isTestFileName, TEST_FILE_MAX_BYTES } from "@/lib/build/testCases";
import { extrasOf, extrasRefusal, readResultFile, togetherChanges, withExtras, type SessionExtras } from "@/lib/build/sessionFacts";
import { claudePromptOf, runsWhenLine, type WorkflowEvent } from "@/lib/build/runsFrom";
import { isLegacySession, isTypedSession, sessionsMetaOf, sessionToolsOf, setSessionMeta, todayDay, newSessionKey, type MakingSession, type SessionMeta } from "@/lib/build/making";
import { fileKindFor, getMediaById, MEDIA_MAX_BYTES, mediaKindFor, signedMediaUrl, uploadMedia } from "@/lib/build/media";
import { addSessionToBuild, emptyFirstSession } from "@/lib/build/addSession";
import { buildSessionRowsKey } from "./useComposeSessions";
import { insertBuildSessionIfTable, nextSessionPosition, orderOf, setSessionCollapsed } from "@/lib/build/buildSessions";
import { getNodeType } from "@/lib/build/nodeTypes";

import { mergeSave, PUBLISH_WORDS } from "./composeModel";
import { useComposePage } from "./ComposePage";
import type { PreviewMaker } from "@/components/post/PostPreview";
import { PostTab } from "./PostTab";
import { useComposeThread } from "./useComposeThread";
import { SandboxView, type SandboxCounts, type SandboxLens } from "./SandboxView";
import { AddManualStepDialog, type AddManualStepInput } from "./AddManualStepDialog";
import { AddResultDialog, type AddResultInput } from "./AddResultDialog";
import { AddToolDialog, type AddToolInput } from "./AddToolDialog";
import { buildSummary } from "@/lib/build/buildSummary";
import { AddCheckDialog, type AddCheckInput } from "./AddCheckDialog";
import { AddCodeDialog, type AddCodeInput } from "./AddCodeDialog";
import { AddDecisionDialog } from "./AddDecisionDialog";
import type { DecisionInput } from "@/lib/build/graph";
import { AddAgentDialog, DEFAULT_AGENT_MODEL, type AddAgentInput, type AgentSeed } from "./AddAgentDialog";
import { ADD_FLASH_MS, BuildList, partName, type AddAsAgentInput, type PendingAdd } from "./BuildList";
import { useComposerScrollPadding } from "./composeChrome";
import { dividers, suggestionKey, type ListResult, type ListSuggestion } from "./buildListModel";
import { FullPromptWindow } from "@/components/build/FullPromptWindow";
import { BuildMap } from "./BuildMap";
import { attachFiles } from "./attachFiles";
import { DetailsPanel } from "./DetailsPanel";
import { pieces, resolveView, type MediaFacts } from "./detailsView";
import type { MapPiece, MapResult, MapSuggestion } from "@/lib/build/mapLayout";
import { suggestUses } from "@/lib/build/suggest";
import { SourcesPanel } from "./SourcesPanel";
import { FIRST_SESSION_KEY, NO_APP, isChatExport, librarySources, projectFileReminders, sourceFiles, sourceSessions, unfinishedSources, type SourceSession } from "./sourcesModel";
import { librarySessionsKey } from "@/hooks/useLibrarySessions";
import { useOnScreen } from "@/hooks/useOnScreen";
import { refGroups } from "@/lib/build/postRefs";
import { PartRegistryProvider, type PartRegistry } from "@/components/build/partNav";
import { allParts, PartWindow } from "@/components/build/PartWindow";
import { parseRefTo, refTo } from "@/lib/build/thread";
import { usePostLinks } from "./usePostLinks";
import { useColourPicking } from "./useColourPicking";
import { previewColours, type ColourPreview } from "@/lib/build/colourPreview";
import { sayFailed } from "./draftStart";

/** builds.making.sessions, read defensively: it is a json column. */
function makingSessions(making: unknown): MakingSession[] {
  const list = (making as { sessions?: unknown } | null)?.sessions;
  return Array.isArray(list) ? (list as MakingSession[]) : [];
}

/** CA-12 P8: the first 4 lines of a text or code file, for its tile; empty for anything else, and for a file too big to read here. */
async function previewOfFile(file: File): Promise<string[]> {
  if (file.size > 512 * 1024 || fileKindOf(file.name, file.type) === "picture" || fileKindOf(file.name, file.type) === "pdf" || fileKindOf(file.name, file.type) === "other") return [];
  try {
    return previewOf(await file.slice(0, 4096).text());
  } catch {
    return [];
  }
}

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children)]);

export function SandboxPage() {
  /* CA-10 (CA-09 F10): the session library polls only while Sources is on screen (on a phone, while its sheet is open). */
  const [sourcesAnchor, sourcesOnScreen] = useOnScreen<HTMLDivElement>();
  const { viewProps, missing, build, tree, ensureBuild, firstSession, nodes, sessions, prompts, compose, buildId } = useComposePage({ sessionsActive: sourcesOnScreen });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const phone = useIsPhone();
  const fine = useFinePointer();
  /* CA-10 (CA-09 F12): a focused field or a new tile scrolled into view lands above the phone's dock and action bar. */
  useComposerScrollPadding(phone);

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
  /* CA-12 P5: sessions are numbered by `build_sessions.position`; a draft with no rows is numbered by its steps, as before. */
  const order = useMemo(() => orderOf(sessions.rows), [sessions.rows]);
  /** CA-06 P5: the colour the picker shows before it is saved, laid over the build everywhere it is drawn. */
  const [colourPreview, setColourPreview] = useState<ColourPreview | null>(null);
  const { counts, hasAgent, sessionCount, steps: savedSteps, groups: savedGroups } = useMemo(() => {
    const steps = buildSteps(tree);
    // CA-04 P1: every step sits in a session; a session made here carries its tool and day in `making.sessions_meta`.
    const groups = sessionGroups(steps, makingSessions(made), sessionToolsOf(made), sessionsMetaOf(made), order);
    const all = flatten(steps);
    const next: SandboxCounts = {
      sessions: shownGroups(groups).length,
      prompts: all.filter((step) => step.kind === "prompt").length,
      files: tree.filter((node) => node.type === FILE_TYPE && !isSetupPayload(node.payload)).length,
    };
    return { counts: next, hasAgent: all.some((step) => step.kind === "agent" || step.kind === "team"), sessionCount: shownGroups(groups).length, steps, groups };
  }, [tree, made, order]);
  const { steps, groups } = useMemo(() => previewColours(savedSteps, savedGroups, colourPreview), [savedSteps, savedGroups, colourPreview]);
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
  /** CA-13 P1, P2: Add › Decision, disabled until the `decision` node type is live. */
  const decisionType = useQuery({ queryKey: ["build", "getNodeType", "decision"], queryFn: () => getNodeType("decision"), staleTime: Infinity });
  const decisionAvailable = Boolean(decisionType.data?.is_active);
  const [addDecisionOpen, setAddDecisionOpen] = useState(false);
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

  /* CA-10 (CA-09 F2): Add › Prompt focuses the add field INSIDE THE TAP that chose it, so an iPhone raises the
     keyboard, and says so (true), so the menu does not hand focus back to Add. The field is drawn only in the List: from
     the Map it switches first, in the same tap. Scrolled to the middle (the page's scroll padding keeps it above the
     phone's bars), then focused without a second scroll, then ringed for a moment. */
  const addPromptField = useRef<HTMLTextAreaElement | null>(null);
  const [addPromptFlash, setAddPromptFlash] = useState(0);
  /** "Name a file it makes": the prompt whose Makes field Details opens, and when it was asked. */
  const [focusMakes, setFocusMakes] = useState<{ id: string; at: number } | null>(null);
  const onAddPromptFocus = useCallback((): boolean => {
    if (!addPromptField.current && lens !== "list") flushSync(() => onLens("list"));
    const field = addPromptField.current;
    if (!field) return false;
    field.scrollIntoView?.({ block: "center" });
    field.focus({ preventScroll: true });
    setAddPromptFlash((count) => count + 1);
    return true;
  }, [lens, onLens]);
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
          holds: resultHoldsWord(resultFactsOf(node)),
          facts: resultFactsOf(node),
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
  /** CA-04 P6: when each session runs, from the workflow files in its setup. */
  const runsWhen = useMemo(() => {
    const events = new Map<string, WorkflowEvent[]>();
    for (const item of setupItemsOf(tree)) if (item.workflow?.events) events.set(item.session, [...(events.get(item.session) ?? []), ...item.workflow.events]);
    return Object.fromEntries([...events].map(([key, list]) => [key, runsWhenLine(list)]));
  }, [tree]);
  const dividerRows = useMemo(() => dividers(steps, groups, setupCounts, runsWhen), [steps, groups, setupCounts, runsWhen]);
  /** CA-06 P2: what the post's words can link to: each session, then its tiles. */
  const postRefGroups = useMemo(() => refGroups({ steps, groups }), [steps, groups]);

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
    tileNext.current = false;
    picker.current?.click();
  }, []);
  /** CA-12 P8: Add › File places a File tile at the end of the current session, as well as listing the file under Sources. */
  const tileNext = useRef(false);
  const pickTile = useCallback(() => {
    pickFor.current = null;
    tileNext.current = true;
    picker.current?.click();
  }, []);
  const pickForStep = useCallback((stepId: string) => {
    pickFor.current = stepId;
    picker.current?.click();
  }, []);

  const sourceSessionRows = useMemo(() => sourceSessions(groups, steps, sessions.sessions, sessionTools, setupCounts, runsWhen), [groups, steps, sessions.sessions, sessionTools, setupCounts, runsWhen]);
  const sourceFileRows = useMemo(() => sourceFiles(tree, groups, steps), [tree, groups, steps]);

  /* ── links in the post (CA-06 P3) ── */

  const registry = useRef<PartRegistry>(new Map()).current;
  const links = usePostLinks({
    steps,
    groups,
    refGroups: postRefGroups,
    registry,
    lens: phone ? "list" : lens,
    phone,
    setSelectedId,
    setOpenPromptId,
    setTrail,
  });

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
        ? sourceSessionRows.map((row) => ({ key: row.key, label: `Session ${row.number} · ${row.tool}`, tool: row.tool === NO_APP ? null : row.tool }))
        : undefined,
    [shown, sourceSessionRows],
  );
  /* CA-12 P3: a session with no tile yet is still drawn, as its head. A post whose draft is not made has Session 1 already. */
  const emptySessions = useMemo<SourceSession[]>(() => {
    const withTiles = new Set(shown.filter((group) => group.stepNumbers.length > 0).map((group) => groupKey(group)));
    const empties = sourceSessionRows.filter((row) => !withTiles.has(row.key) && isTypedSession(row.key));
    if (empties.length === 0 && !buildId && shown.length === 0) return [{ key: FIRST_SESSION_KEY, number: 1, tool: NO_APP, detail: "", prompts: [] }];
    return empties;
  }, [shown, sourceSessionRows, buildId]);
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
    // CA-12 P3: a new post's first change makes the draft and its Session 1, and goes into it.
    if (!key) {
      if (!buildId) await ensureBuild();
      return firstSession.current;
    }
    if (!isLegacySession(key)) return key;
    const last = shown[shown.length - 1];
    if (last && groupKey(last) === key) return null;
    return claim(key);
  }, [currentSession, shown, claim, buildId, ensureBuild, firstSession]);

  /* CA-12 P4/P5: the session just added is scrolled to and outlined once; the row says "Adding…" until the write lands. */
  const [ringedSession, setRingedSession] = useState<{ key: string; n: number } | null>(null);
  const [startingSession, setStartingSession] = useState(false);
  useEffect(() => {
    if (!ringedSession) return;
    document.querySelector(`[data-session-key="${ringedSession.key}"]`)?.scrollIntoView?.({ block: "center" });
    const timer = window.setTimeout(() => setRingedSession(null), ADD_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [ringedSession]);

  /**
   * CA-12 P4: "Start a new one here": an empty session with the app picked. If Session 1 is still empty and has no app,
   * the app goes there instead and the session stays Session 1; otherwise the new session is the next one in order.
   */
  const onStartSession = useCallback(
    async (tool: string) => {
      setStartingSession(true);
      try {
        const id = await ensureBuild();
        const empty = buildId ? emptyFirstSession(sessions.rows, made, tree) : firstSession.current;
        let key: string;
        if (empty) {
          key = empty;
          const before = sessionsMetaOf(made)[key] ?? { tool: null, date: todayDay() };
          await setSessionMeta(id, key, { ...before, tool });
        } else {
          key = newSessionKey();
          await setSessionMeta(id, key, { tool, date: todayDay() });
          await insertBuildSessionIfTable({ buildId: id, sessionKey: key, importId: null, position: nextSessionPosition(sessions.rows) });
        }
        await Promise.all([refreshRecord(id), queryClient.invalidateQueries({ queryKey: ["build", "listBuildSessions"] })]);
        setChosenSession(key);
        setRingedSession((current) => ({ key, n: (current?.n ?? 0) + 1 }));
      } catch (cause) {
        console.error("[Sandbox] session not made", cause);
        sayFailed(cause, "Couldn't make that session. Try again.");
      } finally {
        setStartingSession(false);
      }
    },
    [ensureBuild, buildId, sessions.rows, made, tree, firstSession, refreshRecord, queryClient],
  );

  /** CA-12 P5: opening or closing a long session, kept; it shows at once and the server's answer follows. */
  const [collapseOverride, setCollapseOverride] = useState<Readonly<Record<string, boolean>>>({});
  const collapsedKeys = useMemo(() => {
    const out = new Set(sessions.rows.filter((row) => row.collapsed).map((row) => row.sessionKey));
    for (const [key, closed] of Object.entries(collapseOverride)) {
      if (closed) out.add(key);
      else out.delete(key);
    }
    return out;
  }, [sessions.rows, collapseOverride]);
  const onToggleCollapsed = useCallback(
    (key: string, closed: boolean) => {
      setCollapseOverride((previous) => ({ ...previous, [key]: closed }));
      if (!buildId) return;
      void setSessionCollapsed(buildId, key, closed)
        .then(() => queryClient.invalidateQueries({ queryKey: buildSessionRowsKey(buildId) }))
        .catch((cause) => {
          console.error("[Sandbox] collapse not saved", cause);
          setCollapseOverride((previous) => ({ ...previous, [key]: !closed }));
          sayFailed(cause, "Couldn't save that. Try again.");
        });
    },
    [buildId, queryClient],
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
        sayFailed(cause, "Couldn't save that session. Try again.");
      }
    },
    [claim, ensureBuild, groups, made, refreshRecord],
  );

  /** CA-04 P6: what a session worked until; an old build's run of typed prompts is saved as a session first. */
  const onSessionGoal = useCallback(
    async (key: string, goal: SessionGoal | null) => {
      if (goal) {
        const why = goalRefusal(goal);
        if (why) {
          toast.error(why);
          return;
        }
      }
      try {
        if (isLegacySession(key)) {
          await claim(key, { goal: goal ?? undefined });
          return;
        }
        const id = await ensureBuild();
        const group = groups.find((candidate) => groupKey(candidate) === key);
        const before: SessionMeta = sessionsMetaOf(made)[key] ?? (groupKind(group ?? { sessionId: key }) === "typed" ? { tool: group?.tool ?? null, date: group?.startedAt ?? todayDay() } : { tool: null, date: "" });
        const { goal: _old, ...rest } = before;
        await setSessionMeta(id, key, goal ? { ...rest, goal } : rest);
        await refreshRecord(id);
      } catch (cause) {
        console.error("[Sandbox] goal not saved", cause);
        sayFailed(cause, "Couldn't save the goal. Try again.");
      }
    },
    [claim, ensureBuild, groups, made, refreshRecord],
  );

  /** CA-05: what a session carries beyond its steps (cost, background, ...), written whole; an old build's run of typed prompts is saved as a session first. */
  const onSessionExtras = useCallback(
    async (key: string, extras: SessionExtras) => {
      const why = extrasRefusal(extras);
      if (why) {
        toast.error(why);
        return;
      }
      try {
        if (isLegacySession(key)) {
          await claim(key, extras);
          return;
        }
        const id = await ensureBuild();
        const group = groups.find((candidate) => groupKey(candidate) === key);
        const before: SessionMeta = sessionsMetaOf(made)[key] ?? (groupKind(group ?? { sessionId: key }) === "typed" ? { tool: group?.tool ?? null, date: group?.startedAt ?? todayDay() } : { tool: null, date: "" });
        await setSessionMeta(id, key, withExtras(before, extras));
        await refreshRecord(id);
      } catch (cause) {
        console.error("[Sandbox] session facts not saved", cause);
        sayFailed(cause, "Couldn't save that. Try again.");
      }
    },
    [claim, ensureBuild, groups, made, refreshRecord],
  );

  /** CA-05 P5: the sessions one ran at the same time as. The pairing is written on both sides, so the Map and the List agree. */
  const onSessionTogether = useCallback(
    async (key: string, next: string[]) => {
      try {
        const self = isLegacySession(key) ? await claim(key) : key;
        if (!self) return;
        const id = await ensureBuild();
        const metas = sessionsMetaOf(made);
        const changes = togetherChanges(Object.fromEntries(Object.entries(metas).map(([other, meta]) => [other, meta.parallelWith])), self, next);
        for (const [other, list] of Object.entries(changes)) {
          const group = groups.find((candidate) => groupKey(candidate) === other);
          const before: SessionMeta = metas[other] ?? (groupKind(group ?? { sessionId: other }) === "typed" ? { tool: group?.tool ?? null, date: group?.startedAt ?? todayDay() } : { tool: null, date: "" });
          await setSessionMeta(id, other, withExtras(before, { ...extrasOf(before), parallelWith: list }));
        }
        await refreshRecord(id);
      } catch (cause) {
        console.error("[Sandbox] sessions at the same time not saved", cause);
        sayFailed(cause, "Couldn't save that. Try again.");
      }
    },
    [claim, ensureBuild, groups, made, refreshRecord],
  );

  /** CA-06 P4: a session's colour, or none; an old build's run of typed prompts has no colour button, so is never here. */
  const onSessionColour = useCallback(
    async (key: string, colour: string | null) => {
      try {
        const id = await ensureBuild();
        const group = groups.find((candidate) => groupKey(candidate) === key);
        const before: SessionMeta = sessionsMetaOf(made)[key] ?? (groupKind(group ?? { sessionId: key }) === "typed" ? { tool: group?.tool ?? null, date: group?.startedAt ?? todayDay() } : { tool: null, date: "" });
        const { colour: _old, ...rest } = before;
        await setSessionMeta(id, key, colour ? { ...rest, colour } : rest);
        await refreshRecord(id);
      } catch (cause) {
        console.error("[Sandbox] session colour not saved", cause);
        sayFailed(cause, "Couldn't save that colour. Try again.");
      }
    },
    [ensureBuild, groups, made, refreshRecord],
  );

  /** CA-12 P3: "Pick an app" on a session made here. On a post with no draft yet, the draft and its Session 1 are made first. */
  const onPickApp = useCallback(
    async (key: string, tool: string | null) => {
      try {
        const id = await ensureBuild();
        const real = key === FIRST_SESSION_KEY ? firstSession.current : key;
        if (!real) return;
        const before = sessionsMetaOf(made)[real] ?? { tool: null, date: todayDay() };
        await setSessionMeta(id, real, { ...before, tool });
        await refreshRecord(id);
      } catch (cause) {
        console.error("[Sandbox] app not saved", cause);
        sayFailed(cause, "Couldn't save that app. Try again.");
      }
    },
    [ensureBuild, firstSession, made, refreshRecord],
  );

  const onAddPrompt = useCallback(
    async (input: { text: string; tool: string | null; model: string | null }) => prompts.addNow({ ...input, session: await sessionToWrite() }),
    [prompts, sessionToWrite],
  );
  const reminderRows = useMemo(() => projectFileReminders(sourceSessionRows, sourceFileRows), [sourceSessionRows, sourceFileRows]);
  const libraryRows = useMemo(() => librarySources(sessions.library, adding, Date.now(), buildId ?? null), [sessions.library, adding, buildId]);
  const unfinishedRows = useMemo(() => unfinishedSources(sessions.unfinished, Date.now()), [sessions.unfinished]);

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

  /* ── colour (CA-06 P4) ── */

  /** Writes a part's colour, or takes it off: a tile's `payload.colour`, a session's `sessions_meta[key].colour`. */
  const writeColour = useCallback(
    (to: string, colour: string | null) => {
      const target = parseRefTo(to);
      if (!target) return;
      if (target.kind === "session") void onSessionColour(target.id, colour);
      else {
        prompts.setColour(target.id, colour);
        afterWrite();
      }
    },
    [onSessionColour, prompts, afterWrite],
  );
  /* CA-06 P5: the picker the colour buttons open. */
  const { onColour, picker: colourPicker } = useColourPicking({ preview: colourPreview, setPreview: setColourPreview, savedSteps, savedGroups, write: writeColour, phone });
  /** Details' colour: the selected tile's or session's, with its button. */
  const detailsColour = useMemo(() => {
    if (!selectedId) return null;
    const group = shown.find((candidate) => groupKey(candidate) === selectedId && groupKind(candidate) !== "legacy");
    if (group) {
      const what = `Session ${group.number}`;
      const to = refTo({ kind: "session", id: selectedId });
      return { what, colour: group.colour ?? null, onPick: (anchor: HTMLElement) => onColour(to, anchor, what, group.colour ?? null) };
    }
    const step = allParts(steps).find((candidate) => candidate.id === selectedId);
    if (!step) return null;
    const what = partName(step);
    const to = refTo({ kind: "node", id: step.id });
    return { what, colour: step.colour ?? null, onPick: (anchor: HTMLElement) => onColour(to, anchor, what, step.colour ?? null) };
  }, [selectedId, shown, steps, onColour]);

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

  const onAddDecision = useCallback(
    async (input: DecisionInput) => {
      const session = await sessionToWrite();
      const id = await prompts.addDecisionTile({ ...input, session });
      if (!id) return;
      setSelectedId(id);
      setRinged((current) => ({ id, n: (current?.n ?? 0) + 1 }));
      afterWrite();
    },
    [prompts, afterWrite, sessionToWrite],
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
      return id;
    },
    [prompts],
  );

  /* CA-10 (CA-09 T7, Add › Result and Add › Session): until the write lands (on a new post `ensureBuild` makes the
     draft first) a tile saying so stands at the end of the List, where the new one will be, drawn and scrolled to in
     the tap itself, so the press never shows nothing. A new Result is then scrolled to the middle and ringed once, as
     the build page rings a `#node-` step; a session's steps land where its tile stood. */
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null);
  const [ringed, setRinged] = useState<{ id: string; n: number } | null>(null);
  const showPending = useCallback(
    (kind: PendingAdd) => {
      if (lens !== "list") return;
      flushSync(() => setPendingAdd(kind));
      document.querySelector('[data-testid="add-pending"]')?.scrollIntoView?.({ block: "center" });
    },
    [lens],
  );
  const [addResultOpen, setAddResultOpen] = useState(false);
  /** CA-12 P9: Add › Result asks what the result is first; the files it holds are stored, then the tile stands at the end of the List. */
  const onAddResultInput = useCallback(
    async (input: AddResultInput) => {
      showPending("result");
      try {
        let made: ResultInput;
        if (input.kind === "link") made = { kind: "link", url: input.url };
        else if (input.kind === "model") made = { kind: "model", baseModel: input.baseModel, method: input.method };
        else {
          const build = await ensureBuild();
          const stored = [];
          for (const file of input.kind === "file" ? [input.file] : input.files) stored.push({ file, media: await nodes.run(() => uploadMedia({ buildId: build, file })) });
          made =
            input.kind === "file"
              ? { kind: "file", mediaId: stored[0].media.id, name: stored[0].file.name, size: stored[0].file.size, mime: stored[0].file.type || null }
              : { kind: "media", mediaIds: stored.map((one) => one.media.id), names: stored.map((one) => one.file.name) };
        }
        const id = await prompts.addResultOf(made);
        if (id) {
          setSelectedId(id);
          setRinged((current) => ({ id, n: (current?.n ?? 0) + 1 }));
        }
      } catch (cause) {
        console.error("[Sandbox] result not added", cause);
        sayFailed(cause, "Couldn't add that result. Try again.");
      } finally {
        setPendingAdd(null);
      }
    },
    [ensureBuild, nodes, prompts, showPending],
  );
  const onAddResult = useCallback(() => setAddResultOpen(true), []);
  useEffect(() => {
    if (!ringed) return;
    document.querySelector(`[data-tile-id="${ringed.id}"]`)?.scrollIntoView?.({ block: "center" });
    const timer = window.setTimeout(() => setRinged(null), ADD_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [ringed]);

  /** CA-12 P7: Add › Tool places a Tool tile at the end of the current session and selects it. */
  const onAddTool = useCallback(
    async (input: AddToolInput) => {
      const session = await sessionToWrite();
      const id = await prompts.addToolTile({ service: input.service, connection: input.connection, scopes: input.scopes, session });
      if (id) {
        setSelectedId(id);
        setRinged((current) => ({ id, n: (current?.n ?? 0) + 1 }));
      }
    },
    [prompts, sessionToWrite],
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
        sayFailed(cause, "Couldn't download that. Try again.");
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
        sayFailed(cause, `Couldn't add ${file.name}. Try again.`);
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
        sayFailed(cause, "Couldn't use that as the cover. Try again.");
      }
    },
    [viewProps],
  );

  /**
   * CA-12 P5: a finished session added to this draft, every prompt a tile. On a new post the draft (and its Session 1,
   * which the added session then replaces) is made first. The row says "Adding…" until it lands; the new session's head
   * is scrolled to and outlined once.
   */
  const onAddSession = useCallback(
    async (importId: string) => {
      setAdding((previous) => new Set(previous).add(importId));
      try {
        const id = await ensureBuild();
        const added = await addSessionToBuild(importId, { kind: "existing", buildId: id });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(id) }),
          queryClient.invalidateQueries({ queryKey: ["build", "listBuildSessions"] }),
          queryClient.invalidateQueries({ queryKey: ["build", "getMadeWith"] }),
          queryClient.invalidateQueries({ queryKey: librarySessionsKey }),
        ]);
        setChosenSession(added.sessionKey);
        setRingedSession((current) => ({ key: added.sessionKey, n: (current?.n ?? 0) + 1 }));
      } catch (cause) {
        console.error("[Sandbox] session not added", cause);
        sayFailed(cause, "Couldn't add that session. Try again.");
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
    async (file: File, verb: "add" | "attach" = "add", parentId: string | null = null, rows: number | null = null, tile = false): Promise<BuildNode | null> => {
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
          const tileFacts = tile && !parentId ? { tile: true, session: await sessionToWrite(), size: file.size, mime: file.type || null, preview: await previewOfFile(file) } : null;
          const node = await addFile(id, nodes.current(), { title: file.name, media_id: media.id, parentId, rows, ...tileFacts });
          nodes.record(node.id, node);
          added.node = node;
        });
        await queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(id) });
        return added.node;
      } catch (cause) {
        console.error("[Sandbox] file not added", cause);
        sayFailed(cause, `Couldn't ${verb} ${file.name}. Try again.`);
        return null;
      }
    },
    [ensureBuild, nodes, queryClient, sessionToWrite],
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

  /**
   * CA-05 P10: the file a trained model was trained on, sent with its result: the ratings or the examples. A file that
   * was there goes; a .csv, .json or .jsonl file keeps the number of rows it holds when they can be counted exactly.
   */
  const onTrainedOn = useCallback(
    async (resultId: string, file: File) => {
      const rows = isTestFileName(file.name) && file.size <= TEST_FILE_MAX_BYTES ? countCases(file.name, await file.text().catch(() => "")) : null;
      const added = await addOneFile(file, "attach", resultId, rows);
      if (!added) return;
      const before = (tree.find((candidate) => candidate.id === resultId)?.children ?? []).filter((child) => child.type === FILE_TYPE && child.id !== added.id);
      for (const old of before) prompts.removeInside(old.id);
    },
    [addOneFile, prompts, tree],
  );

  /** A drop on a step's card: a chat export goes to the intake and nothing is attached. */
  const onDropOnStep = useCallback(
    async (stepId: string, files: File[]) => {
      if ((await Promise.all(files.map(isChatExport))).some(Boolean)) {
        navigate("/compose/start");
        return;
      }
      // CA-04 P2: a file dropped on a step is sent with it: a tile inside that step.
      // CA-05 P7: on a Check, a .csv, .json or .jsonl file is its test cases, with their number when it can be counted exactly.
      const onCheck = steps.some((step) => step.id === stepId && step.kind === "check");
      for (const file of files) {
        const cases = onCheck && isTestFileName(file.name) && file.size <= TEST_FILE_MAX_BYTES ? countCases(file.name, await file.text().catch(() => "")) : null;
        await addOneFile(file, "attach", stepId, cases);
      }
    },
    [addOneFile, navigate, steps],
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
            } else if (draft.kind === "workflow") {
              // CA-04 P6: kept as written; its prompt, when read plainly, is the session's prompt.
              const file = files[draft.file];
              const node = await addSetupWorkflow(id, nodes.current(), key, { filename: file.name, source: dropped[draft.file].text ?? "", reading: draft.reading });
              nodes.record(node.id, node);
              if (draft.reading.prompt) {
                const prompt = await addWrittenPrompt({ buildId: id, tree: nodes.current(), text: draft.reading.prompt, session: key });
                nodes.record(prompt.id, prompt);
              }
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
        sayFailed(cause, "Couldn't add that to the setup. Try again.");
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
          sayFailed(cause, "Couldn't change that. Try again.");
        }),
    [nodes, tree],
  );

  /** "Setup 2" on a session's head: the session in Details, scrolled to its Setup. */
  const [focusSetup, setFocusSetup] = useState<{ key: string; at: number } | null>(null);
  const onOpenSetup = useCallback((key: string) => {
    setSelectedId(key);
    setFocusSetup({ key, at: Date.now() });
  }, []);

  /**
   * CA-05 P2: a dropped Claude Code result file (the JSON a script run prints) tells what the session cost, the tokens it
   * used and the tokens read from the cache. It is read, never stored, and goes to the current session. Resolves with
   * the files that are not one.
   */
  const takeResultFiles = useCallback(
    async (files: File[]): Promise<File[]> => {
      const rest: File[] = [];
      for (const file of files) {
        const facts = /\.jsonl?$/i.test(file.name) && file.size <= 2 * 1024 * 1024 ? readResultFile(await file.text().catch(() => "")) : null;
        if (!facts) {
          rest.push(file);
          continue;
        }
        try {
          const key = await sessionForSetup(null);
          if (!key) {
            rest.push(file);
            continue;
          }
          const group = groups.find((candidate) => groupKey(candidate) === key);
          const { cost, tokens, cached } = facts;
          const { cost: _c, currency: _u, tokens: _t, cached: _k, ...kept } = group?.extras ?? {};
          await onSessionExtras(key, { ...kept, ...(cost !== undefined ? { cost, currency: "USD" as const } : null), ...(tokens ? { tokens } : null), ...(cached ? { cached } : null) });
        } catch (cause) {
          console.error("[Sandbox] result file not read", cause);
          rest.push(file);
        }
      }
      return rest;
    },
    [groups, onSessionExtras, sessionForSetup],
  );

  /** A drop sorts its files: a chat export goes to the intake, a setup file to the current session's setup, the rest are files of the build. */
  const onDropFiles = useCallback(
    async (files: File[], paths?: string[]) => {
      if ((await Promise.all(files.map(isChatExport))).some(Boolean)) {
        navigate("/compose/start");
        return;
      }
      for (const file of await addSetup(await takeResultFiles(files), paths)) void addOneFile(file);
    },
    [addOneFile, addSetup, navigate, takeResultFiles],
  );

  /** The picker is an explicit choice of files, so nothing is taken for an export; setup files still go to the setup. */
  const onPicked = useCallback(
    async (files: File[], tile = false) => {
      for (const file of await addSetup(await takeResultFiles(files), undefined)) {
        const added = await addOneFile(file, "add", null, null, tile);
        if (added && tile) setSelectedId(added.id);
      }
    },
    [addOneFile, addSetup, takeResultFiles],
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
          else {
            const tile = tileNext.current;
            tileNext.current = false;
            void onPicked(files, tile);
          }
        }}
      />
      <PartRegistryProvider registry={registry}>
      <SandboxView
        {...viewProps}
        saveProblem={compose.saveFailure}
        loadError={compose.loadError ?? undefined}
        save={mergeSave(viewProps.save, thread.save)}
        onRetrySave={onRetrySave}
        onPublish={() => void onPublish()}
        post={
          <PostTab
            thread={thread}
            phone={phone}
            draft={{ build, title: viewProps.title, maker }}
            references={{ groups: postRefGroups, lookup: links.lookup, onGo: links.goTo, onMentions: links.onMentions }}
          />
        }
        threadNote={thread.hold}
        onAddFile={pickTile}
        onAddPromptFocus={onAddPromptFocus}
        onAddTool={() => setAddToolOpen(true)}
        onAddResult={onAddResult}
        onAddAgent={() => setAddAgentOpen(true)}
        onAddDecision={() => setAddDecisionOpen(true)}
        decisionAvailable={decisionAvailable}
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
            onDecision={(id, input) => {
              prompts.setDecision(id, input);
              afterWrite();
            }}
            onRuntime={(id, patch) => {
              prompts.setRuntime(id, patch);
              afterWrite();
            }}
            onReadHelpers={(id, read) => {
              const agent = steps.find((step) => step.id === id);
              if (!agent) return;
              // The agent, its tools and its helpers, as found: only what the code wrote out literally.
              prompts.setRuntime(id, { helpers: read.helpers });
              if (read.model || read.tools.length) {
                const have = (agent.toolRefs ?? []).map((ref) => listFacts.names[ref]).filter(Boolean);
                prompts.setAgent(id, { model: read.model ?? agent.model ?? "", harness: agent.harness ? (toolFor(agent.harness)?.id ?? agent.harness) : "deep-agents", tools: [...new Set([...have, ...read.tools])] });
              }
              afterWrite();
            }}
            onRunsWhen={(id, runsWhen) => {
              prompts.setRunsWhen(id, steps, runsWhen);
              afterWrite();
            }}
            onRuns={(id, runs) => {
              prompts.setRuns(id, runs);
              // CA-04 P6: a pasted `claude -p "…"` keeps its command as written; its quoted text is the session's prompt.
              const said = runs?.how === "script" && runs.detail ? claudePromptOf(runs.detail) : null;
              if (said) {
                const top = steps.find((step) => step.id === id || step.children.some((child) => child.id === id));
                const group = top ? groups.find((candidate) => candidate.stepNumbers.includes(top.number)) : undefined;
                const key = group && groupKind(group) !== "legacy" ? groupKey(group) : null;
                void prompts.addNow({ text: said, tool: null, model: null, session: key });
              }
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
            onSessionGoal={(key, goal) => void onSessionGoal(key, goal)}
            onSessionExtras={(key, extras) => void onSessionExtras(key, extras)}
            onCheckRuns={prompts.setCheckRuns}
            onCheckCases={prompts.setCheckCases}
            onModelRun={prompts.setModelRun}
            onTrainedOn={(id, file) => void onTrainedOn(id, file)}
            onAgentNotes={prompts.setAgentNotes}
            onSessionTogether={(key, keys) => void onSessionTogether(key, keys)}
            onDownload={(id) => void download(id)}
            onFields={prompts.setFields}
            onAddPicture={(id, file) => void addPicture(id, file)}
            onUseAsCover={(mediaId) => void setAsCover(mediaId)}
            onAddToSetup={pickForSetup}
            onToolConnection={prompts.setConnection}
            onNotShared={onNotShared}
            focusSetup={focusSetup}
            colour={detailsColour}
          />
        }
        list={
          <BuildList
            phone={phone}
            steps={steps}
            costGroups={groups}
            dividers={dividerRows}
            emptySessions={emptySessions}
            onPickApp={(key, tool) => void onPickApp(key, tool)}
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
            mentioned={links.mentioned}
            onBackToPost={links.backToMention}
            reveal={links.reveal}
            onColour={onColour}
            fine={fine}
            onAccept={(suggestion) => prompts.accept(suggestion.stepId, suggestion.use, steps)}
            onDismiss={(suggestion) => prompts.dismiss(suggestion.stepId, suggestionKey(suggestion.use))}
            onAddPrompt={onAddPrompt}
            sessionChoices={sessionChoices}
            currentSession={currentSession}
            onCurrentSession={setChosenSession}
                onAddAsAgent={onAddAsAgent}
            onKeepAsCode={onKeepAsCode}
            inBuild={inBuild}
            addPromptRef={addPromptField}
            addPromptFlash={addPromptFlash}
            pendingAdd={pendingAdd}
            ringedId={ringed?.id ?? null}
            addSession={{
              library: libraryRows,
              hasMore: sessions.libraryHasMore,
              loadingMore: sessions.libraryLoadingMore,
              onMore: sessions.libraryMore,
              adding: adding.size > 0 || startingSession,
              onAdd: (importId) => void onAddSession(importId),
              onStartNew: (tool) => void onStartSession(tool),
            }}
            collapsed={collapsedKeys}
            onToggleCollapsed={onToggleCollapsed}
            ringedSession={ringedSession}
          />
        }
        sources={
          <div ref={sourcesAnchor} style={{ minWidth: 0 }}>
          <SourcesPanel
            phone={phone}
            fine={fine}
            status={sessions.status}
            onRetry={sessions.retry}
            sessions={sourceSessionRows}
            files={sourceFileRows}
            library={libraryRows}
            libraryHasMore={sessions.libraryHasMore}
            libraryLoadingMore={sessions.libraryLoadingMore}
            onLibraryMore={sessions.libraryMore}
            arriving={unfinishedRows.arriving}
            didntFinish={unfinishedRows.didntFinish}
            reminders={reminderRows}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAddSession={(id) => void onAddSession(id)}
            onDropFiles={onDropFiles}
            onPick={pick}
            connectHref="/connect"
          />
          </div>
        }
        missing={missing.map((key) => ({ key, label: PUBLISH_WORDS[key] }))}
        counts={counts}
        lens={lens}
        onLens={onLens}
        mapAvailable={mapAvailable}
        mapHint={mapAvailable && !switched}
      />
      </PartRegistryProvider>
      <AddAgentDialog
        open={addAgentOpen}
        onOpenChange={onAgentDialog}
        nextNumber={steps.length + 1}
        teamsAvailable={teamsAvailable}
        seed={agentSeed}
        inBuild={inBuild}
        onAdd={(input) => void onAddAgentOrTeam(input)}
      />
      <AddDecisionDialog
        open={addDecisionOpen}
        onOpenChange={setAddDecisionOpen}
        inBuild={inBuild}
        codeTiles={codeTilesOf(steps)}
        stepChoices={stepChoicesOf(steps)}
        onAddCode={() => {
          setAddDecisionOpen(false);
          setAddCodeOpen(true);
        }}
        onAdd={(input) => void onAddDecision(input)}
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
      <AddResultDialog open={addResultOpen} onOpenChange={setAddResultOpen} onAdd={(input) => void onAddResultInput(input)} />
      <AddToolDialog open={addToolOpen} onOpenChange={setAddToolOpen} inBuild={inBuild} onAdd={(input) => void onAddTool(input)} />
      <FullPromptWindow
        steps={steps}
        groups={groups}
        names={listFacts.names}
        openId={openPromptId}
        mode="maker"
        onTitle={prompts.rename}
        onChanges={prompts.setChanges}
        onReply={prompts.setReply}
        onNavigate={setOpenPromptId}
        onClose={() => {
          setOpenPromptId(null);
          links.closeWindows();
        }}
        fromPost={links.fromPost}
        onBackToPost={links.backToPost}
        onCloseAutoFocus={links.onCloseAutoFocus}
      />
      {colourPicker}
      <PartWindow
        steps={steps}
        groups={groups}
        names={listFacts.names}
        open={links.openPart}
        fromPost={links.fromPost}
        onBackToPost={links.backToPost}
        onClose={links.closeWindows}
        onGo={links.goFromWindow}
        onDownload={(id) => void download(id)}
        audience="maker"
        setupCounts={setupCounts}
        onCloseAutoFocus={links.onCloseAutoFocus}
      />
    </>
  );
}

/** CA-13 rule 4: the Code tiles of a build, for "Called from" and "Read from a Code tile". */
export const codeTilesOf = (steps: readonly Step[]): { id: string; label: string; source: string }[] =>
  steps.flatMap((step) => (step.kind === "code" ? [{ id: step.id, label: step.filename ?? step.title ?? step.defaultTitle, source: step.text }] : []));

/** CA-13 P2: the steps a decision can read the output of. */
export const stepChoicesOf = (steps: readonly Step[]): { id: string; label: string }[] =>
  steps.filter((step) => step.kind !== "decision").map((step) => ({ id: step.id, label: `${step.number} · ${step.title ?? step.defaultTitle}` }));

export default SandboxPage;
