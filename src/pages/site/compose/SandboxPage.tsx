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
import { useResolvedTheme } from "@/contexts/ThemeContext";
import { useFinePointer, useIsPhone } from "@/components/shell/useMinWidth";
import { composeBuildQueryKey } from "@/hooks/useComposeBuild";
import type { BuildNode } from "@/lib/build/types";
import { addFile, buildSteps, fileKindOf, previewOf, canCheck, resultFactsOf, resultHoldsWord, FILE_TYPE, groupKey, nestRefusal, groupKind, madeFileNamesOf, madeFilesOf, RESULT_TYPE, sessionGroups, shownGroups, testedStepOf, TOOL_TYPE, usesOf, type ResultInput, type Step } from "@/lib/build/graph";
import { toolFor } from "@/lib/tools/registry";
import { addWrittenPrompt } from "@/lib/build/composePrompts";
import { addSetupFile, addSetupRule, addSetupServer, addSetupWorkflow, isSetupPayload, needsText, routeSetupFiles, setNotShared, setupItemsOf, type DroppedFile, type SetupDraft } from "@/lib/build/setup";
import { connection } from "@/lib/build/connection";
import { pendingWrites, trackWrite } from "@/lib/build/pendingWrites";
import { fieldLabel } from "@/lib/build/clash";
import type { RawClash } from "@/lib/build/staleWrites";
import { RECONNECTED } from "@/lib/build/reconnect";
import { goalRefusal, patchMaking, type SessionGoal } from "@/lib/build/making";
import { countCases, isTestFileName, TEST_FILE_MAX_BYTES } from "@/lib/build/testCases";
import { extrasOf, extrasRefusal, readResultFile, togetherChanges, withExtras, type SessionExtras } from "@/lib/build/sessionFacts";
import { claudePromptOf, runsWhenLine, type WorkflowEvent } from "@/lib/build/runsFrom";
import { isLegacySession, isTypedSession, sessionsMetaOf, sessionToolsOf, setSessionMeta, storedWorkstreamsOf, todayDay, newSessionKey, type MakingSession, type SessionMeta } from "@/lib/build/making";
import { defaultWorkstream, labelsOf, orderByWorkstream, orderWithNewSession, workstreamKeyOf, workstreamLabel, workstreamMark, workstreamsOf } from "@/lib/build/workstreams";
import { fileKindFor, getMediaById, MEDIA_MAX_BYTES, mediaKindFor, signedMediaUrl, uploadMedia } from "@/lib/build/media";
import { addSessionToBuild } from "@/lib/build/addSession";
import { buildSessionRowsKey } from "./useComposeSessions";
import { insertBuildSessionIfTable, nextSessionPosition } from "@/lib/build/buildSessions";
import { collapsedKeys as readCollapsed, getSessionOrder, setCollapsed, setSessionOrder, orderKeys } from "@/lib/build/sessionLayout";
import { SessionJump, jumpTo, useCurrentSession } from "@/components/build/SessionJump";
import { useSessionEdits } from "./useSessionEdits";
import { useViewOptions } from "./viewOptions";
import { movedLine, movedStep, moveBy, moveModelOf, writeOf, type MoveNames } from "@/lib/build/moveRules";
import { listPartsOf } from "./partsModel";
import type { Arriving } from "./arrival";
import { getNodeType } from "@/lib/build/nodeTypes";

import { mergeSave, PUBLISH_WORDS } from "./composeModel";
import { runtimeChecks } from "@/lib/build/runtimeChecks";
import { useComposePage } from "./ComposePage";
import type { PreviewMaker } from "@/components/post/PostPreview";
import { PostTab } from "./PostTab";
import { useComposeThread } from "./useComposeThread";
import { useClassificationCard } from "./useClassificationCard";
import { AddMenu, SandboxView, type SandboxCounts, type SandboxMissingItem, type SandboxLens } from "./SandboxView";
import { AddManualStepDialog, type AddManualStepInput } from "./AddManualStepDialog";
import { AddResultDialog, type AddResultInput } from "./AddResultDialog";
import { AddToolDialog, type AddToolInput } from "./AddToolDialog";
import { buildSummary } from "@/lib/build/buildSummary";
import { AddCheckDialog, type AddCheckInput } from "./AddCheckDialog";
import { AddCodeDialog, type AddCodeInput } from "./AddCodeDialog";
import { AddDatasetDialog } from "./AddDatasetDialog";
import { AddDecisionDialog } from "./AddDecisionDialog";
import { AddRepoDialog } from "./AddRepoDialog";
import { AddSystemPromptDialog } from "./AddSystemPromptDialog";
import type { DecisionInput } from "@/lib/build/graph";
import { AddAgentDialog, DEFAULT_AGENT_MODEL, type AddAgentInput, type AgentSeed } from "./AddAgentDialog";
import { ADD_FLASH_MS, BuildList, partName, type AddAsAgentInput, type PendingAdd } from "./BuildList";
import { useComposerScrollPadding } from "./composeChrome";
import { dividers, suggestionKey, type ListResult, type ListSuggestion } from "./buildListModel";
import { FullPromptWindow } from "@/components/build/FullPromptWindow";
import { attachFiles } from "./attachFiles";
import { DetailsPanel, type DetailsHandlers } from "./DetailsPanel";
import { TileEditDialog } from "./TileEditDialog";
import { buildFactsOf, pieces, resolveView, type MediaFacts } from "./detailsView";
import { sessionMapFor, type MapPieceLike } from "@/lib/build/sessionMap";
import { centre, partElement } from "@/components/build/partNav";
import { flashOutline } from "@/components/post/RefLinks";
import { SessionMapColumn, NoMap } from "./SessionMap";
import { SessionMapPanel } from "./SessionMapPanel";
import { makerMapOf, type MapSettings } from "@/lib/build/making";
import { suggestUses } from "@/lib/build/suggest";
import { SourcesPanel } from "./SourcesPanel";
import { FIRST_SESSION_KEY, NO_APP, isChatExport, librarySources, projectFileReminders, shortDate, sourceFiles, sourceSessions, unfinishedSources, type SourceSession } from "./sourcesModel";
import { librarySessionsKey } from "@/hooks/useLibrarySessions";
import { useOnScreen } from "@/hooks/useOnScreen";
import { refGroups, refLookup } from "@/lib/build/postRefs";
import { makingWithGroupColours, previewGroupColour, withGroupColours, type ReferenceGroup } from "@/lib/build/referenceGroups";
import { setReferenceGroups } from "@/lib/build/referenceGroupsWrite";
import { ReferenceNotice } from "./referencePieces";
import { OfflineStrip, OtherTabStrip, Strips } from "./saveStrips";
import { useConnectionWatch, useOffline, usePendingWrites, useReconnected } from "./usePendingWrites";
import { useLeaveGuard } from "./useLeaveGuard";
import { useWriteGuard } from "./useWriteGuard";
import { LeaveWindow } from "./saveWindows";
import { ClashWindow } from "./ClashWindow";
import { useTwoTabs, type ClashDescription } from "./useTwoTabs";
import { useReferences } from "./useReferences";
import { BuildHistoryContext, useBuildHistory } from "./useBuildHistory";
import { classificationKey } from "./useClassificationCard";
import { writeClassification, type StoredClassification } from "@/lib/classify/storage";
import { computeFacets, shapeFromBuilt, shownValues } from "@/lib/classify/facets";
import { ReferenceBridgeContext, useReferenceBridge } from "./useReferenceBridge";
import type { ReferenceBridge } from "@/lib/build/referenceBridge";
import { BuildActionsContext, tileName, useBuildActions } from "./useBuildActions";
import { useBuildShortcuts } from "./useBuildShortcuts";
import { BuildSelectionContext, useBuildSelection } from "./useBuildSelection";
import { SelectionBar, type SelectionBarProps } from "./removePieces";
import { useFlip, useHeld } from "./buildMotion";
import { BASE } from "@/lib/theme/motion";
import type { Drawn } from "@/lib/build/buildSelection";
import { ADDED, HANDLERS_THAT_CHANGE_NOTHING, HANDLERS_THAT_REMOVE, handlerSentence } from "@/lib/build/stepSentences";
import { NOTICE_COPY } from "@/lib/build/referenceHistory";
import { GroupLabelsProvider } from "./groupLabels";
import { useReferenceActions } from "./useReferenceActions";
import { DetailsReferencesProvider, type DetailsReferencesValue } from "./DetailsReferences";
import { ReferenceWindows, showWords } from "./ReferenceWindows";
import { useHistoryKeys } from "./useReferenceHistory";
import { PartRegistryProvider, type PartRegistry } from "@/components/build/partNav";
import { allParts, PartWindow } from "@/components/build/PartWindow";
import { linkOf } from "@/lib/build/linkRules";
import { parseRefTo, refTo } from "@/lib/build/thread";
import { usePostLinks } from "./usePostLinks";
import { useColourPicking } from "./useColourPicking";
import { previewColours, previewWorkstreams, type ColourPreview } from "@/lib/build/colourPreview";
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

/** Shown when Publish is pressed with no connection. */
const PUBLISH_OFFLINE = "You're offline. Publish when you reconnect.";

/** The later of two moments, either of which may be missing. */
const latestOf = (a: Date | null | undefined, b: Date | null | undefined): Date | null => (a && b ? (a.getTime() >= b.getTime() ? a : b) : (a ?? b ?? null));

export function SandboxPage() {
  /* CA-10 (CA-09 F10): the session library polls only while Sources is on screen (on a phone, while its sheet is open). */
  const [sourcesAnchor, sourcesOnScreen] = useOnScreen<HTMLDivElement>();
  const { viewProps, missing, build, tree, ensureBuild, firstSession, nodes, sessions, prompts, compose, buildId, rehydrate } = useComposePage({ sessionsActive: sourcesOnScreen });
  const navigate = useNavigate();
  /* CA-20: the build's one history: every change the maker makes is a step of it, CA-19's colour and link steps too. */
  const bridgeHolder = useRef<ReferenceBridge | undefined>(undefined);
  const buildHistory = useBuildHistory({ buildId, nodes, getBridge: () => bridgeHolder.current, peek: () => ({ making: (build as { making?: unknown } | null)?.making, sessions: sessions.rows }) });
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
  /* CA-14 P6: the View switches, kept for this maker on this device. */
  const [viewOptions, setViewOptions] = useViewOptions(user?.id ?? null);
  const runtimeIssues = useMemo(() => runtimeChecks(buildSteps(tree)), [tree]);
  const onPublish = useCallback(async () => {
    // Publishing waits for a connection: a publish held until later would go live when the maker has long moved on.
    if (connection.isOffline()) {
      toast(PUBLISH_OFFLINE);
      return;
    }
    await flushThread();
    // A thread that cannot be saved is not published half-written.
    if (threadHold) {
      toast(threadHold);
      return;
    }
    // CA-13 P18: a broken Decision or Runs when stops Publish; the rest are reminders said once and do not.
    if (runtimeIssues.blockers.length > 0) {
      toast(`To publish, fix this: ${runtimeIssues.blockers[0]}.`);
      return;
    }
    for (const line of runtimeIssues.reminders) toast(line);
    viewProps.onPublish();
  }, [flushThread, threadHold, viewProps, runtimeIssues]);
  /* CA-23: the one pending-writes count, and whether there is a connection. The write guard holds writes while there is none. */
  useConnectionWatch();
  /* CA-23 P4: two tabs (or two devices) on one build. What each clash is called and where it falls is said once the page knows its tiles (`describeClash`, below). */
  const describeClash = useRef<(clash: RawClash) => ClashDescription>(() => ({ name: "This", badge: "", rank: 0 }));
  const motionRoot = useRef<HTMLElement | null>(typeof document === "undefined" ? null : document.body);
  const flip = useFlip(motionRoot);
  const twoTabs = useTwoTabs({ buildId, nodes, history: buildHistory, thread, rehydrate, flip, describe: (clash) => describeClash.current(clash) });
  useWriteGuard(buildId, { onWritten: twoTabs.announce });
  useEffect(() => () => pendingWrites.reset(), []);
  const offline = useOffline();
  const { pending, failed: writesFailed, failedCount, retry: retryWrites } = usePendingWrites();
  /* CA-23 P3: leaving with changes that have not landed (or have stopped) asks first; closing the tab asks the browser's way. */
  const leaving = useLeaveGuard(pending + failedCount);
  useReconnected((count) => buildHistory.notify(RECONNECTED.saved(count), { undo: false }));
  const strips =
    offline || twoTabs.changedElsewhere ? (
      <Strips>
        {offline ? <OfflineStrip /> : null}
        {twoTabs.changedElsewhere ? <OtherTabStrip onShow={() => void twoTabs.showChanges()} /> : null}
      </Strips>
    ) : null;
  /* Retry sends every write that stopped, in order: the header's, the post's, and the node queue's and the rest of the tasks'. */
  const onRetrySave = useCallback(() => {
    if (thread.save === "error") thread.retry();
    if (viewProps.save === "error") viewProps.onRetrySave();
    if (writesFailed) void retryWrites();
  }, [thread, viewProps, writesFailed, retryWrites]);

  const [lens, setLens] = useState<SandboxLens>("list");
  const [switched, setSwitched] = useState(false);
  const onLens = useCallback((next: SandboxLens) => {
    setLens(next);
    setSwitched(true);
  }, []);

  const made = (build as { making?: unknown } | null)?.making;
  /* CA-12 P5: sessions are numbered by `build_sessions.position`; a draft with no rows is numbered by its steps, as before. */
  const order = useMemo(() => orderByWorkstream(getSessionOrder(made, sessions.rows), sessionsMetaOf(made), storedWorkstreamsOf(made)), [made, sessions.rows]);
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
  /* CA-17 P5: the sessions of a part, for its picker's "Also colour its sessions that have no colour", and the parts with the previewed colour on. */
  const sessionsOfPart = useCallback((workstream: string): readonly string[] => workstreamsOf(made, orderKeys(savedGroups)).find((part) => part.key === workstream)?.sessions ?? [], [made, savedGroups]);
  /* CA-19: single colours and reference groups, the one history of colour and link steps, and what is written but not yet saved. */
  const writeRef = useRef<(to: string, colour: string | null) => void>(() => undefined);
  const saveGroupsRef = useRef<(groups: ReferenceGroup[], order?: string[]) => Promise<void>>(async () => undefined);
  const nameRef = useRef<(to: string) => string>((to) => to);
  const references = useReferences({
    made,
    savedSteps,
    savedGroups,
    writeColour: (to, colour) => writeRef.current(to, colour),
    saveGroups: (list, order) => saveGroupsRef.current(list, order),
    loaded: Boolean(build),
    nameOf: (to) => nameRef.current(to),
    join: buildHistory.join,
  });
  /* CA-20: the only way removing, restoring, duplicating and grouping touch colours, groups and the post's links. */
  const bridge = useReferenceBridge(references);
  bridgeHolder.current = bridge;
  // A member is drawn in its group's colour; the picker's live colour goes over that.
  // The picker opened for a group (its window's Change…) previews the group's colour on every member.
  const previewedGroup = colourPreview && parseRefTo(colourPreview.to)?.kind === "group" ? (parseRefTo(colourPreview.to)?.id ?? null) : null;
  const makingDrawn = useMemo(() => previewGroupColour(references.making, previewedGroup, colourPreview?.colour ?? null), [references.making, previewedGroup, colourPreview?.colour]);
  const { steps, groups } = useMemo(() => {
    const drawn = withGroupColours(savedSteps, savedGroups, makingDrawn, references.pending);
    return previewColours(drawn.steps, drawn.groups, colourPreview, sessionsOfPart);
  }, [savedSteps, savedGroups, makingDrawn, references.pending, colourPreview, sessionsOfPart]);
  const madeShown = useMemo(() => previewWorkstreams(makingWithGroupColours(makingDrawn, references.pending), colourPreview), [makingDrawn, references.pending, colourPreview]);
  const sessionTools = useMemo(() => sessionToolsOf(made), [made]);

  /* CA-23 P4: what a clash is called, and where it falls in the build: the post, the build's own fields, parts, then each session before its tiles. */
  describeClash.current = (clash) => {
    if (clash.kind === "post") return { name: "Post", badge: "P", rank: 0 };
    if (clash.kind === "field") return { name: fieldLabel(clash.key), badge: "F", rank: 1 };
    if (clash.kind === "part") {
      const at = Math.max(0, storedWorkstreamsOf(made).findIndex((part) => part.key === clash.key));
      return { name: workstreamLabel(at, labelsOf(made)), badge: workstreamMark(at, labelsOf(made)), rank: 10 + at };
    }
    const all = flatten(savedSteps);
    if (clash.kind === "session") {
      const group = savedGroups.find((entry) => groupKey(entry) === clash.key);
      const first = group ? all.findIndex((step) => group.stepNumbers.includes(step.number)) : -1;
      return { name: `Session ${group?.number ?? ""}`.trim(), badge: `S${group?.number ?? ""}`, rank: first < 0 ? 1500 : 2000 + first - 0.5 };
    }
    const at = all.findIndex((step) => step.id === clash.key);
    const step = all[at];
    return { name: step ? tileName(step) : "Tile", badge: step?.number ? String(step.number) : "T", rank: at < 0 ? 9000 : 2000 + at };
  };

  /* The tools this build uses, read once: its steps' own and its sessions' (TF-02). The tool picker lists them first. */
  const inBuild = useMemo(() => {
    const names = [...flatten(steps).flatMap((step) => [step.tool, step.harness]), ...groups.map((group) => group.tool)];
    return names.filter((name): name is string => Boolean(name));
  }, [steps, groups]);

  const mapAvailable = sessionCount >= 2;

  /* ── agents and teams (UI-P69) ── */

  const teamType = useQuery({ queryKey: ["build", "getNodeType", "team"], queryFn: () => getNodeType("team"), staleTime: Infinity });
  const teamsAvailable = Boolean(teamType.data?.is_active);
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  /** CA-13 P1, P2: Add › Decision, disabled until the `decision` node type is live. */
  const decisionType = useQuery({ queryKey: ["build", "getNodeType", "decision"], queryFn: () => getNodeType("decision"), staleTime: Infinity });
  const decisionAvailable = Boolean(decisionType.data?.is_active);
  const [addDecisionOpen, setAddDecisionOpen] = useState(false);
  /** CA-15 P9: Add › System prompt, Dataset and GitHub repository, each disabled until its node type is live. */
  const systemPromptType = useQuery({ queryKey: ["build", "getNodeType", "system_prompt"], queryFn: () => getNodeType("system_prompt"), staleTime: Infinity });
  const datasetType = useQuery({ queryKey: ["build", "getNodeType", "dataset"], queryFn: () => getNodeType("dataset"), staleTime: Infinity });
  const repoType = useQuery({ queryKey: ["build", "getNodeType", "repo"], queryFn: () => getNodeType("repo"), staleTime: Infinity });
  const systemPromptAvailable = Boolean(systemPromptType.data?.is_active);
  const datasetAvailable = Boolean(datasetType.data?.is_active);
  const repoAvailable = Boolean(repoType.data?.is_active);
  const [addSystemPromptOpen, setAddSystemPromptOpen] = useState(false);
  const [addDatasetOpen, setAddDatasetOpen] = useState(false);
  const [addRepoOpen, setAddRepoOpen] = useState(false);
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
  /* ── List (UI-P65) ── */

  /* CA-10 (CA-09 F2): Add › Prompt focuses the add field INSIDE THE TAP that chose it, so an iPhone raises the
     keyboard, and says so (true), so the menu does not hand focus back to Add. The field is drawn only in the List: from
     the Map it switches first, in the same tap. Scrolled to the middle (the page's scroll padding keeps it above the
     phone's bars), then focused without a second scroll, then ringed for a moment. */
  const addPromptField = useRef<HTMLTextAreaElement | null>(null);
  /** CA-14 P5: opens the prompt box in the session being added to. Set once the sessions are known, below. */
  const promptOpenRef = useRef<(() => void) | null>(null);
  const [addPromptFlash, setAddPromptFlash] = useState(0);
  /** "Name a file it makes": the prompt whose Makes field Details opens, and when it was asked. */
  const [focusMakes, setFocusMakes] = useState<{ id: string; at: number } | null>(null);
  const onAddPromptFocus = useCallback((): boolean => {
    if (lens !== "list") flushSync(() => onLens("list"));
    /* CA-14 P5: the prompt box stands inside the session being added to; it is opened in this tap (flushSync), so the
       field exists to take focus before the tap ends and an iPhone raises its keyboard. */
    flushSync(() => promptOpenRef.current?.());
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
  /** The files, each with the step that makes it: a tile that reads a made file reads from that step's session. */
  const mapFiles = useMemo<MapPieceLike[]>(() => mapPieces.files.map((file) => ({ id: file.id, name: file.name, madeBy: madeFiles.get(file.id) ?? null })), [mapPieces.files, madeFiles]);
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
  const postRefGroups = useMemo(() => refGroups({ steps, groups, making: madeShown }), [steps, groups, madeShown]);

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
  const baseLookup = useMemo(() => refLookup(postRefGroups), [postRefGroups]);
  const groupEntriesOf = references.groupEntries;
  const groupTargets = useMemo(() => groupEntriesOf(baseLookup), [groupEntriesOf, baseLookup]);
  const foldRef = useRef<{ closed: ReadonlySet<string>; open: (key: string) => void } | null>(null);
  const links = usePostLinks({
    fold: foldRef,
    steps,
    groups,
    refGroups: postRefGroups,
    registry,
    lens: phone ? "list" : lens,
    phone,
    setSelectedId,
    setOpenPromptId,
    groupEntries: groupTargets,
  });
  /** CA-19: every link target, groups too, and the screen's name for each. */
  const withGroupTargets = references.withGroups;
  const nameIn = references.nameIn;
  const allTargets = useMemo(() => withGroupTargets(links.lookup), [withGroupTargets, links.lookup]);
  const nameOfTarget = useCallback((to: string) => nameIn(allTargets, to), [nameIn, allTargets]);
  nameRef.current = nameOfTarget;

  /* ── sessions (CA-04 P1) ── */

  /** The session the maker chose for what they add next; the build's last session while they have chosen none. */
  const [chosenSession, setChosenSessionState] = useState<string | null>(null);
  /* CA-14 P5: choosing a session for what is added next takes effect in the same tap, before the next render: an Add item's
     handler reads it straight away. */
  const chosenRef = useRef<string | null>(null);
  const setChosenSession = useCallback((key: string | null) => {
    chosenRef.current = key;
    setChosenSessionState(key);
  }, []);
  const shown = useMemo(() => shownGroups(groups), [groups]);
  const currentSession = useMemo(() => {
    if (chosenSession && sourceSessionRows.some((row) => row.key === chosenSession)) return chosenSession;
    const last = shown[shown.length - 1];
    return last ? groupKey(last) : null;
  }, [chosenSession, sourceSessionRows, shown]);
  /* CA-12 P3: a session with no tile yet is still drawn, as its head. A post whose draft is not made has Session 1 already. */
  const emptySessions = useMemo<SourceSession[]>(() => {
    const withTiles = new Set(shown.filter((group) => group.stepNumbers.length > 0).map((group) => groupKey(group)));
    // CA-14 P1: a session in the order with no tile is drawn, imported or made here.
    const empties = sourceSessionRows.filter((row) => !withTiles.has(row.key) && (isTypedSession(row.key) || order.includes(row.key)));
    if (empties.length === 0 && !buildId && shown.length === 0) return [{ key: FIRST_SESSION_KEY, number: 1, tool: NO_APP, detail: "", prompts: [] }];
    return empties;
  }, [shown, sourceSessionRows, buildId, order]);
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

  /* ── CA-14: naming, moving, folding, removing, merging and splitting sessions ── */

  /** What a screen reader hears when a session moves ("Session 3 moved to 2."). */
  const [sessionSaid, setSessionSaid] = useState("");
  /** The session whose prompt box is open. An empty draft has Session 1's open without it. */
  const [promptSession, setPromptSession] = useState<string | null>(null);
  /* CA-17 P2: the build's parts, when it has two or more. */
  const theme = useResolvedTheme();
  const partsModel = useMemo(() => listPartsOf(madeShown, groups, theme), [madeShown, groups, theme]);
  /** CA-17 P3: the parts "Add to" can choose; none until the build has two. */
  const addToParts = useMemo(() => partsModel?.list.map((part) => ({ key: part.view.key, label: part.view.label, title: part.title, colour: part.view.colour })), [partsModel]);
  /* CA-21 P1: where every tile, session and part stands: Move up, Move down, the keys and keyboard dragging all ask it. */
  const moveModel = useMemo(
    () => moveModelOf({ steps, heads: dividerRows, empties: emptySessions, parts: partsModel?.list.map((part) => ({ key: part.view.key, sessions: part.sessions })) }),
    [steps, dividerRows, emptySessions, partsModel],
  );
  const edits = useSessionEdits({ buildId, made, nodes, steps, groups, claim, say: setSessionSaid, moveModel, parts: partsModel ?? undefined, history: buildHistory, bridge, onGone: (key) => {
    if (chosenRef.current === key) setChosenSession(null);
    setPromptSession((current) => (current === key ? null : current));
  } });
  /* CA-20: removing (and, later, selecting, duplicating, converting and grouping) in one place, for the menus, the keys and the bars. */
  const { actions, dialogs: actionDialogs } = useBuildActions({
    buildId,
    made,
    onCleared: () => {
      setChosenSession(null);
      setPromptSession(null);
    },
    nodes,
    history: buildHistory,
    bridge,
    steps,
    groups,
    removeSessions: edits.onRemoveSessions,
    onGrouped: (group) => referenceActions.setGroupWindow({ draft: { ...group, members: [...group.members] }, isNew: false }),
  });
  /* CA-20 P3: choosing several tiles and sessions. The order is how the List draws them: a session's head, then its top-level tiles. */
  const drawn = useMemo<Drawn>(
    () => ({
      sessions: groups.map((group) => {
        const key = groupKey(group);
        return { key: group.implicit || isLegacySession(key) ? null : key, tiles: steps.filter((step) => group.stepNumbers.includes(step.number)).map((step) => step.id) };
      }),
    }),
    [groups, steps],
  );
  const selection = useBuildSelection({ drawn, onSelect: setSelectedId, phone });
  /* CA-20 P5: every change the maker makes, other than typing, is a step of the build's history. `asStep` makes a handler one. */
  const track = buildHistory.track;
  const asStep = useCallback(
    <A extends unknown[], R>(sentence: string | ((first: A[0]) => string), fn: (...args: A) => R | Promise<R>) =>
      (...args: A): Promise<R> =>
        track(typeof sentence === "string" ? sentence : sentence(args[0]), async () => fn(...args)),
    [track],
  );

  promptOpenRef.current = () => {
    const picked = chosenRef.current;
    const key = picked && sourceSessionRows.some((row) => row.key === picked) ? picked : currentSession;
    setPromptSession(key ?? FIRST_SESSION_KEY);
    if (key && collapsedKeys.has(key)) onToggleCollapsed(key, false);
  };

  /**
   * The session a new step records. None while it is an old build's last run of typed prompts, which a step added at
   * the end joins by itself; an earlier run is saved first, so the step can name it.
   */
  const sessionToWrite = useCallback(async (): Promise<string | null> => {
    const picked = chosenRef.current;
    const key = picked && sourceSessionRows.some((row) => row.key === picked) ? picked : currentSession;
    // CA-14 P5: a tile added to a session that is not the last is put with its own session once it is written.
    edits.arm();
    // CA-12 P3: a new post's first change makes the draft and its Session 1, and goes into it.
    if (!key) {
      if (!buildId) await ensureBuild();
      return firstSession.current;
    }
    if (!isLegacySession(key)) return key;
    const last = shown[shown.length - 1];
    if (last && groupKey(last) === key) return null;
    return claim(key);
  }, [currentSession, sourceSessionRows, edits, shown, claim, buildId, ensureBuild, firstSession]);

  /* CA-12 P4/P5: the session just added is scrolled to and outlined once; the row says "Adding…" until the write lands. */
  const [ringedSession, setRingedSession] = useState<{ key: string; n: number } | null>(null);
  const [startingSession, setStartingSession] = useState(false);
  /* CA-21 P7: the session on its way, for the List to open a lane for and fill; it lets go when its animation is over. */
  const [arriving, setArriving] = useState<Arriving | null>(null);
  const nextSessionNumber = useCallback(() => Math.max(0, ...groups.filter((group) => !group.implicit).map((group) => group.number)) + 1, [groups]);
  useEffect(() => {
    if (!ringedSession) return;
    document.querySelector(`[data-session-key="${ringedSession.key}"]`)?.scrollIntoView?.({ block: "center" });
    const timer = window.setTimeout(() => setRingedSession(null), ADD_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [ringedSession]);

  /**
   * CA-14 P5: "Start a new session": an empty session at the end, "No app chosen", at once. Its app is picked later in
   * its head. If Session 1 is still empty and has no app, nothing new is made: Session 1 is the one to use. Written
   * where a session made here is kept (`sessions_meta`, `build_sessions` when the table is there, `session_order`), so it
   * works before the CA-12 table is live.
   */
  const onStartSession = useCallback(async (workstream?: string) => {
    setStartingSession(true);
    try {
      const fresh = !buildId;
      const id = await ensureBuild();
      const first = shown[0];
      // CA-17 P3: with parts the session joins the chosen one (else the last); an empty Session 1 is used only when it is in that part.
      const part = fresh ? undefined : defaultWorkstream(made, workstream);
      const emptyFirst = Boolean(first && groupKind(first) === "typed" && !first.tool && first.stepNumbers.length === 0 && (!part || workstreamKeyOf(sessionsMetaOf(made)[groupKey(first)], storedWorkstreamsOf(made)) === part));
      let key: string;
      if (fresh && firstSession.current) key = firstSession.current;
      else if (emptyFirst && first) key = groupKey(first);
      else {
        key = newSessionKey();
        setArriving({ key, kind: "empty", head: { key, number: nextSessionNumber(), tool: NO_APP, detail: "", prompts: [], date: shortDate(new Date().toISOString()) }, count: 0, part, status: "writing" });
        const keys = orderKeys(groups).filter((entry) => !isLegacySession(entry));
        await trackWrite("making", async () => {
          await setSessionMeta(id, key, { tool: null, date: todayDay(), ...(part ? { workstream: part } : null) });
          await insertBuildSessionIfTable({ buildId: id, sessionKey: key, importId: null, position: nextSessionPosition(sessions.rows) });
          if (part) await setSessionOrder(id, orderWithNewSession(made, keys, key, part));
          else await patchMaking(id, { session_order: [...keys, key] });
        });
      }
      await Promise.all([refreshRecord(id), queryClient.invalidateQueries({ queryKey: ["build", "listBuildSessions"] })]);
      setChosenSession(key);
      setArriving((current) => (current && current.key === key ? { ...current, status: "written" } : current));
      setRingedSession((current) => ({ key, n: (current?.n ?? 0) + 1 }));
    } catch (cause) {
      setArriving((current) => (current ? { ...current, status: "failed" } : current));
      console.error("[Sandbox] session not made", cause);
      sayFailed(cause, "Couldn't make that session. Try again.");
    } finally {
      setStartingSession(false);
    }
  }, [ensureBuild, buildId, shown, groups, made, sessions.rows, firstSession, refreshRecord, queryClient, setChosenSession, nextSessionNumber]);

  /** CA-12 P5: opening or closing a long session, kept; it shows at once and the server's answer follows. */
  const [collapseOverride, setCollapseOverride] = useState<Readonly<Record<string, boolean>>>({});
  const collapsedKeys = useMemo(() => {
    const out = readCollapsed(made, sessions.rows, sourceSessionRows.map((row) => row.key));
    for (const [key, closed] of Object.entries(collapseOverride)) {
      if (closed) out.add(key);
      else out.delete(key);
    }
    return out;
  }, [made, sessions.rows, sourceSessionRows, collapseOverride]);
  const onToggleCollapsed = useCallback(
    (key: string, closed: boolean) => {
      setCollapseOverride((previous) => ({ ...previous, [key]: closed }));
      if (!buildId) return;
      void setCollapsed(buildId, key, closed, made)
        .then(() => Promise.all([queryClient.invalidateQueries({ queryKey: buildSessionRowsKey(buildId) }), queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(buildId) })]))
        .catch((cause) => {
          console.error("[Sandbox] collapse not saved", cause);
          setCollapseOverride((previous) => ({ ...previous, [key]: !closed }));
          sayFailed(cause, "Couldn't save that. Try again.");
        });
    },
    [buildId, queryClient, made],
  );

  foldRef.current = { closed: collapsedKeys, open: (key) => onToggleCollapsed(key, false) };

  /* CA-20 P7: Collapse all folds every session and part; once all are folded the same item opens them. Not a step of the history. */
  const foldAll = useMemo(() => {
    const keys = orderKeys(groups).filter((key) => !isLegacySession(key));
    const parts = storedWorkstreamsOf(made);
    if (keys.length + parts.length === 0) return undefined;
    const anyOpen = keys.some((key) => !collapsedKeys.has(key)) || parts.some((part) => !part.collapsed);
    return {
      anyOpen,
      run: (closed: boolean) => {
        for (const key of keys) if (collapsedKeys.has(key) !== closed) onToggleCollapsed(key, closed);
        for (const part of parts) if (Boolean(part.collapsed) !== closed) edits.onPartFold(part.key, closed);
      },
    };
  }, [groups, made, collapsedKeys, onToggleCollapsed, edits]);

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
        // In the node queue, behind any write already going: a part's colour and its sessions' are written one after another.
        await nodes.run(() => setSessionMeta(id, key, colour ? { ...rest, colour } : rest));
        await refreshRecord(id);
      } catch (cause) {
        console.error("[Sandbox] session colour not saved", cause);
        sayFailed(cause, "Couldn't save that colour. Try again.");
      }
    },
    [ensureBuild, groups, made, refreshRecord, nodes],
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
    async (input: { text: string; tool: string | null; model: string | null }) => {
      const session = await sessionToWrite();
      const saved = await prompts.addNow({ ...input, session });
      // The box stays open in its session, ready for the next prompt.
      if (saved && session) setPromptSession(session);
      return saved;
    },
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

  /* CA-18: the tile whose own window is open (to change it), seen as Details sees it. */
  const [editId, setEditId] = useState<string | null>(null);
  const editView = useMemo(
    () =>
      editId
        ? resolveView({
            selectedId: editId,
            steps,
            groups,
            tree,
            sources: sourceSessionRows,
            sourceFiles: sourceFileRows,
            promptsState: sessions.promptsState,
            intoResult: listFacts.intoResult,
            media: mediaFacts,
          })
        : null,
    [editId, steps, groups, tree, sourceSessionRows, sourceFileRows, sessions.promptsState, listFacts.intoResult, mediaFacts],
  );
  /** CA-18: how Details names the other tiles a section points at. */
  const buildFacts = useMemo(() => buildFactsOf({ steps, groups, names: listFacts.names, results: listFacts.results }), [steps, groups, listFacts.names, listFacts.results]);
  /** CA-18: a prompt as Details reads it, for the prompt window's Model, Uses and Makes. */
  const promptDetails = useCallback(
    (id: string) => {
      const found = resolveView({ selectedId: id, steps, groups, tree, sources: sourceSessionRows, sourceFiles: sourceFileRows, promptsState: sessions.promptsState, intoResult: listFacts.intoResult, media: mediaFacts });
      return found?.kind === "prompt" ? found : null;
    },
    [steps, groups, tree, sourceSessionRows, sourceFileRows, sessions.promptsState, listFacts.intoResult, mediaFacts],
  );
  /** Select a tile and open its window: a prompt's own window, any other tile's, a session's. A tile with none (a file) is only selected. */
  const openTile = useCallback(
    (id: string) => {
      setSelectedId(id);
      const part = allParts(steps).find((candidate) => candidate.id === id);
      if (part?.kind === "prompt" && !part.id.endsWith(":instructions")) setOpenPromptId(id);
      else setEditId(id);
    },
    [steps],
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
      // CA-19: a group's colour is kept on the group, never on a component.
      if (!target || target.kind === "group") return;
      if (target.kind === "session") void onSessionColour(target.id, colour);
      else if (target.kind === "workstream") void edits.onPartColour(target.id, colour);
      else {
        prompts.setColour(target.id, colour);
        afterWrite();
      }
    },
    [onSessionColour, prompts, afterWrite, edits],
  );
  writeRef.current = writeColour;
  saveGroupsRef.current = async (list: ReferenceGroup[], order?: string[]) => {
    try {
      await nodes.run(async () => {
        const id = await ensureBuild();
        await setReferenceGroups(id, list, order);
        await refreshRecord(id);
      });
    } catch (cause) {
      console.error("[Sandbox] reference groups not saved", cause);
      sayFailed(cause, "Couldn't save those colours. Try again.");
    }
  };
  /* CA-06 P5: the picker the colour buttons open. */
  /* CA-19 P4: the picker's linked text and groups, and Done as one step of the history. */
  const referenceActions = useReferenceActions({ references, lookup: allTargets, nameOf: nameOfTarget, dropPreview: () => setColourPreview(null) });
  const { onColour, picker: colourPicker, open: pickerOpen } = useColourPicking({
    preview: colourPreview,
    setPreview: setColourPreview,
    savedSteps,
    savedGroups,
    write: writeColour,
    phone,
    sessionsOfPart,
    commit: referenceActions.commit,
    references: referenceActions.pickerReferences,
    history: referenceActions.history,
  });
  useHistoryKeys(pickerOpen, references.history);
  /** Details' colour: the selected tile's or session's, with its button. */
  const detailsColour = useMemo(() => {
    if (!selectedId) return null;
    const group = shown.find((candidate) => groupKey(candidate) === selectedId && groupKind(candidate) !== "legacy");
    if (group) {
      const what = `Session ${group.number}`;
      const to = refTo({ kind: "session", id: selectedId });
      return { what, colour: group.colour ?? null, to, onPick: (anchor: HTMLElement) => onColour(to, anchor, what, group.colour ?? null) };
    }
    const step = allParts(steps).find((candidate) => candidate.id === selectedId);
    if (!step) return null;
    const what = partName(step);
    const to = refTo({ kind: "node", id: step.id });
    return { what, colour: step.colour ?? null, to, onPick: (anchor: HTMLElement) => onColour(to, anchor, what, step.colour ?? null) };
  }, [selectedId, shown, steps, onColour]);

  /* CA-18b P3: colour and references at the foot of Details. Read only: a row selects, Go to it scrolls, Open group opens CA-19's window. */
  const detailsRefs = useMemo<DetailsReferencesValue>(
    () => ({
      model: references.model,
      lookup: allTargets,
      linked: (to) => {
        const doc = references.editor && !references.editor.isDestroyed ? references.editor.state.doc : null;
        const range = doc ? linkOf(doc, to) : null;
        return range ? { words: range.text, post: range.post } : null;
      },
      onSelect: (to) => {
        const target = parseRefTo(to);
        if (target?.kind === "node" || target?.kind === "session") setSelectedId(target.id);
        else links.goTo(to, null);
      },
      onGoTo: showWords,
      onOpenGroup: referenceActions.openGroup,
    }),
    [references.model, references.editor, allTargets, links, referenceActions.openGroup],
  );

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

  /** CA-15 P9: a system prompt, a dataset or a repository is placed at the end of the current session and selected, as a tool is. */
  const onAddSourceTile = useCallback(
    async (add: (session: string | null) => Promise<string | null>) => {
      const session = await sessionToWrite();
      const id = await add(session);
      if (!id) return;
      setSelectedId(id);
      setRinged((current) => ({ id, n: (current?.n ?? 0) + 1 }));
      afterWrite();
    },
    [afterWrite, sessionToWrite],
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
    async ({ evidenceFile, evidenceUrl, ...input }: AddCheckInput) => {
      try {
        // CA-15 P5: evidence is a URL, or one file stored through the same media path as every other file.
        let evidence: { url?: string; mediaId?: string; name?: string } | null = null;
        if (evidenceFile) {
          const build = await ensureBuild();
          const media = await nodes.run(() => uploadMedia({ buildId: build, file: evidenceFile }));
          evidence = { mediaId: media.id, name: evidenceFile.name };
        } else if (evidenceUrl) evidence = { url: evidenceUrl };
        // A check uses the step it tested: the selected one, else the last agent, team or code.
        const id = await prompts.addCheckStep({ ...input, ...(evidence ? { evidence } : null), testedStep: testedStepOf(steps, afterStep?.id ?? null), session: await sessionToWrite() });
        if (!id) return;
        setSelectedId(id);
        afterWrite();
      } catch (cause) {
        console.error("[Sandbox] check not added", cause);
        sayFailed(cause, "Couldn't add that check. Try again.");
      }
    },
    [ensureBuild, nodes, prompts, steps, afterStep, afterWrite, sessionToWrite],
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
        const caption = input.caption.trim() || undefined;
        const upload = async (file: File) => {
          const build = await ensureBuild();
          return nodes.run(() => uploadMedia({ buildId: build, file }));
        };
        let made: ResultInput;
        if (input.kind === "link") made = { kind: "link", url: input.url, caption };
        else if (input.kind === "deployed") made = { kind: "deployed", url: input.url, caption };
        else if (input.kind === "model") made = { kind: "model", baseModel: input.baseModel, method: input.method, caption };
        else if (input.kind === "text") made = { kind: "text", text: input.text, caption };
        else if (input.kind === "message") made = { kind: "message", channel: input.channel, message: input.message, caption };
        else if (input.kind === "external_change") made = { kind: "external_change", application: input.application, change: input.change, caption };
        else if (input.kind === "metric") made = { kind: "metric", value: input.value, label: input.label, unit: input.unit, before: input.before, caption };
        else if (input.kind === "audio") {
          const media = await upload(input.file);
          made = { kind: "audio", mediaId: media.id, name: input.file.name, size: input.file.size, mime: input.file.type || null, seconds: media.duration ?? null, caption };
        } else if (input.kind === "table") {
          const media = input.file ? await upload(input.file) : null;
          made = { kind: "table", mediaId: media?.id ?? null, name: input.file?.name ?? null, size: input.file?.size ?? null, mime: input.file?.type || null, csv: input.csv, columns: input.columns, caption };
        } else if (input.kind === "offline") {
          const media = input.photo ? await upload(input.photo) : null;
          made = { kind: "offline", description: input.description, photoId: media?.id ?? null, caption };
        } else {
          const stored = [];
          for (const file of input.kind === "file" ? [input.file] : input.files) stored.push({ file, media: await upload(file) });
          made =
            input.kind === "file"
              ? { kind: "file", mediaId: stored[0].media.id, name: stored[0].file.name, size: stored[0].file.size, mime: stored[0].file.type || null, caption }
              : { kind: "media", mediaIds: stored.map((one) => one.media.id), names: stored.map((one) => one.file.name), caption };
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

  /* CA-16: the Classification Card's data. Its actions send the maker to the tile or the dialog that answers a question. */
  const classificationCard = useClassificationCard({
    buildId,
    build,
    tree,
    title: viewProps.title,
    description: viewProps.description,
    owner: compose.isOwner,
    ensureBuild,
  });
  /* CA-20 P5: Save in the Classification Card is a step: the card as it was is written back by Undo. */
  const saveCard = useCallback(
    async (draft: Parameters<typeof classificationCard.onSave>[0]) => {
      const id = await ensureBuild();
      const read = () => queryClient.getQueryData<StoredClassification>(classificationKey(id))?.classification;
      const before = read() ?? classificationCard.stored;
      const result = await classificationCard.onSave(draft);
      const after = read();
      if (result.written && after) {
        const put = (value: typeof before) => async () => {
          await writeClassification(id, value, { shape: shapeFromBuilt(shownValues(value, "built").values) });
          queryClient.setQueryData<StoredClassification>(classificationKey(id), { live: true, classification: value, facets: computeFacets(value) });
          await queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(id) });
        };
        buildHistory.record({ sentence: "Saved the Classification Card", undo: put(before), redo: put(after) });
      }
      return result;
    },
    [ensureBuild, queryClient, classificationCard, buildHistory],
  );
  const classification = useMemo(
    () => ({
      ...classificationCard,
      onSave: saveCard,
      maker,
      onSelectSource: (id: string) => setSelectedId(id),
      onAction: (action: "add-code" | "add-run" | "add-cost" | "add-tool", question: { tileId?: string }) => {
        if (action === "add-code") setAddCodeOpen(true);
        else if (action === "add-run") setAddResultOpen(true);
        else if (action === "add-tool") setAddToolOpen(true);
        else if (question.tileId) setSelectedId(question.tileId);
      },
    }),
    [classificationCard, saveCard, maker],
  );
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
      const id = await prompts.addToolTile({ ...input, session });
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
    async (importId: string, workstream?: string) => {
      setAdding((previous) => new Set(previous).add(importId));
      // CA-21 P7: the lane opens as soon as it is pressed; the count is all it needs of the chat to make a place for each prompt.
      const item = libraryRows.find((row) => row.id === importId);
      const number = nextSessionNumber();
      if (item) {
        setArriving({ key: importId, kind: "chat", head: { key: importId, number, tool: item.label, detail: [item.model, item.date].filter(Boolean).join(" · "), prompts: [], date: item.date }, count: item.promptCount, part: workstream, status: "writing" });
        setSessionSaid(`Adding ${item.label} · ${item.date} as Session ${number}…`);
      }
      try {
        const id = await ensureBuild();
        const added = await addSessionToBuild(importId, { kind: "existing", buildId: id, workstream });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(id) }),
          queryClient.invalidateQueries({ queryKey: ["build", "listBuildSessions"] }),
          queryClient.invalidateQueries({ queryKey: ["build", "getMadeWith"] }),
          queryClient.invalidateQueries({ queryKey: librarySessionsKey }),
        ]);
        setChosenSession(added.sessionKey);
        setArriving((current) => (current && current.key === importId ? { ...current, status: "written" } : current));
        setRingedSession((current) => ({ key: added.sessionKey, n: (current?.n ?? 0) + 1 }));
      } catch (cause) {
        setArriving((current) => (current && current.key === importId ? { ...current, status: "failed" } : current));
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
    [ensureBuild, queryClient, libraryRows, nextSessionNumber],
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

  /* CA-14 P5: what the Add items do, shared by the Add button at the top and each session's "+ Add Tile". */
  const addHandlers = {
    onAddFile: pickTile,
    onAddPromptFocus,
    onAddTool: () => setAddToolOpen(true),
    onAddResult,
    onAddAgent: () => setAddAgentOpen(true),
    onAddDecision: () => setAddDecisionOpen(true),
    decisionAvailable,
    onAddSystemPrompt: () => setAddSystemPromptOpen(true),
    onAddDataset: () => setAddDatasetOpen(true),
    onAddRepo: () => setAddRepoOpen(true),
    systemPromptAvailable,
    datasetAvailable,
    repoAvailable,
    onAddManual: () => setAddManualOpen(true),
    onAddCode: () => setAddCodeOpen(true),
    onAddCheck: () => setAddCheckOpen(true),
    checkable: canCheck(steps),
  };
  /** Choosing a session for the next tile: at once, and a folded session is opened so the tile lands where it can be seen. */
  const aimAt = (key: string) => {
    setChosenSession(key);
    if (collapsedKeys.has(key)) onToggleCollapsed(key, false);
  };
  /* CA-14 P6: the session list, when it is on and there are two sessions to jump between. */
  const jumpItems = useMemo(() => sourceSessionRows.map((row) => ({ key: row.key, number: row.number, label: row.title ?? row.tool })), [sourceSessionRows]);
  const headOf = useCallback((key: string) => document.querySelector<HTMLElement>(`[data-session-key="${key}"] [data-testid="session-head"]`), []);
  const inView = useCurrentSession(
    useMemo(() => jumpItems.map((item) => item.key), [jumpItems]),
    headOf,
    viewOptions.sessionList,
  );
  const sessionList = viewOptions.sessionList && jumpItems.length >= 2 ? <SessionJump items={jumpItems} current={inView} phone={phone} onJump={(key) => jumpTo(headOf(key))} /> : null;
  const addTargets = {
    sessions: sourceSessionRows.map((row) => ({ key: row.key, label: [`Session ${row.number} · ${row.tool}`, row.title].filter(Boolean).join(" · ") })),
    session: currentSession,
    onSession: aimAt,
  };

  /* ── CA-17 P4: the map of sessions ── */
  const published = (build as { status?: string } | null)?.status !== undefined && (build as { status?: string } | null)?.status !== "draft";
  const mapSettings = makerMapOf(made, published);
  const mapModel = useMemo(() => sessionMapFor({ groups, steps, files: mapFiles, making: madeShown }), [groups, steps, mapFiles, madeShown]);
  /** The map's selected session: a session's key held in the page's selection (a link to a session selects it too). */
  const mapSelected = selectedId && mapModel.sessions.some((session) => session.key === selectedId) ? selectedId : null;
  const mapActive = Boolean(mapSettings?.on);
  const changeMap = (next: MapSettings) => edits.onMapSettings(next);
  /** "Open in the build": the List, with the session's head in the middle of the window and outlined. */
  const openInBuild = useCallback(
    (key: string) => {
      setLens("list");
      setSelectedId(key);
      window.setTimeout(() => {
        const el = partElement(registry, refTo({ kind: "session", id: key }));
        if (el) {
          centre(el);
          flashOutline(el);
        }
      }, 60);
    },
    [registry],
  );
  const openTileInBuild = useCallback(
    (tileId: string) => {
      setLens("list");
      setSelectedId(tileId);
      window.setTimeout(() => {
        const el = partElement(registry, refTo({ kind: "node", id: tileId }));
        if (el) {
          centre(el);
          flashOutline(el);
        }
      }, 60);
    },
    [registry],
  );
  const mapColumn =
    mapSettings && mapActive ? (
      <SessionMapColumn
        model={mapModel}
        direction={mapSettings.direction}
        selected={mapSelected}
        onSelect={setSelectedId}
        shownLine={mapSettings.onBuildPage ? "Shown on build page" : "Not on build page"}
        controls={{
          onDirection: (direction) => changeMap({ ...mapSettings, direction }),
          onBuildPage: mapSettings.onBuildPage,
          onToggleBuildPage: (onBuildPage) => changeMap({ ...mapSettings, onBuildPage }),
          onRemove: () => changeMap({ ...mapSettings, on: false }),
        }}
      />
    ) : (
      <NoMap onCreate={() => changeMap({ on: true, direction: "horizontal", onBuildPage: false })} />
    );
  const mapPanel = mapSettings && mapActive ? <SessionMapPanel model={mapModel} selected={mapSelected} onOpenInBuild={openInBuild} onOpenTile={openTileInBuild} /> : null;

  /** The handlers Details had, which its tiles' windows now call (CA-18). */
  const detailsHandlers: DetailsHandlers = {
    onSelect: setSelectedId,
    onOpenPrompt: setOpenPromptId,
    onRename: prompts.rename,
    onModel: prompts.setModel,
    onAddMade: (stepId, name) => void prompts.addMadeFile(stepId, name),
    onRemoveMade: (fileId) => {
      actions.removeFile(fileId);
      afterWrite();
    },
    onAddUse: (id, use) => {
      prompts.accept(id, use, steps);
      afterWrite();
    },
    onAttach: pickForStep,
    onRemoveUse: (id, use) => {
      prompts.removeUse(id, use);
      afterWrite();
    },
    onDecision: (id, input) => {
      prompts.setDecision(id, input);
      afterWrite();
    },
    onRuntime: (id, patch) => {
      prompts.setRuntime(id, patch);
      afterWrite();
    },
    onReadHelpers: (id, read) => {
      const agent = steps.find((step) => step.id === id);
      if (!agent) return;
      // The agent, its tools and its helpers, as found: only what the code wrote out literally.
      prompts.setRuntime(id, { helpers: read.helpers });
      if (read.model || read.tools.length) {
        const have = (agent.toolRefs ?? []).map((ref) => listFacts.names[ref]).filter(Boolean);
        prompts.setAgent(id, { model: read.model ?? agent.model ?? "", harness: agent.harness ? (toolFor(agent.harness)?.id ?? agent.harness) : "deep-agents", tools: [...new Set([...have, ...read.tools])] });
      }
      afterWrite();
    },
    onRunsWhen: (id, runsWhen) => {
      prompts.setRunsWhen(id, steps, runsWhen);
      afterWrite();
    },
    onRuns: (id, runs) => {
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
    },
    onManual: (id, fields) => {
      prompts.setManual(id, fields);
      afterWrite();
    },
    onManualPicture: (id, file) => {
      void prompts.setManualPicture(id, file).then(afterWrite);
    },
    onInstructions: (id, text) => {
      prompts.setInstructions(id, text);
      afterWrite();
    },
    onAgentSetup: (id, setup) => {
      prompts.setAgent(id, setup);
      afterWrite();
    },
    onRemoveInside: (id) => {
      actions.removeTile(id);
      afterWrite();
    },
    onToggleSessionPrompt: (session, row, on) => {
      if (on) {
        const real = sessions.library.find((candidate) => candidate.id === session.key);
        if (real) prompts.add(real.id, row.ordinal);
      } else if (row.stepId) actions.removeTile(row.stepId);
    },
    onSessionTool: (sessionId, tool) => void sessions.setTool(sessionId, tool),
    onSessionMeta: (key, change) => void onSessionMeta(key, change),
    onSessionGoal: (key, goal) => void onSessionGoal(key, goal),
    onSessionExtras: (key, extras) => void onSessionExtras(key, extras),
    onExtras: (id, patch) => {
      prompts.setExtras(id, patch);
      afterWrite();
    },
    onCheckRuns: prompts.setCheckRuns,
    onCheckCases: prompts.setCheckCases,
    onCheckText: prompts.setCheckText,
    onCodeSource: prompts.setCodeSource,
    onModelRun: prompts.setModelRun,
    onTrainedOn: (id, file) => void onTrainedOn(id, file),
    onAgentNotes: prompts.setAgentNotes,
    onSessionTogether: (key, keys) => void onSessionTogether(key, keys),
    onDownload: (id) => void download(id),
    onFields: prompts.setFields,
    onAddPicture: (id, file) => void addPicture(id, file),
    onUseAsCover: (mediaId) => void setAsCover(mediaId),
    onAddToSetup: pickForSetup,
    onToolConnection: prompts.setConnection,
    onNotShared: onNotShared,
  };

  /* CA-20 P5: what a change was made to, in the screen's words ("Prompt 3", "Session 2"). */
  const whatIs = (id: unknown): string => {
    if (typeof id !== "string") return "the build";
    const isSession = sourceSessionRows.some((row) => row.key === id) || id.startsWith("typed-");
    const named = nameOfTarget(refTo({ kind: isSession ? "session" : "node", id }));
    return named && named !== NOTICE_COPY.noName ? named : "the build";
  };
  /** The tiles' and sessions' handlers, each one a step named after what it changed. Opening, picking and the removals (steps of their own) are left as they are. */
  const detailsStepped = Object.fromEntries(
    Object.entries(detailsHandlers).map(([name, fn]) => [name, typeof fn === "function" && !HANDLERS_THAT_CHANGE_NOTHING.has(name) && !HANDLERS_THAT_REMOVE.has(name) ? (...args: unknown[]) => track(handlerSentence(name, whatIs(args[0])), async () => (fn as (...a: unknown[]) => unknown)(...args)) : fn]),
  ) as unknown as DetailsHandlers;
  /* CA-21 P1: one place that moves a tile, a session or a part by one place. Never a silent refusal: it goes to the next session or part. */
  const moveOne = (id: string, by: -1 | 1): Promise<unknown> | void => {
    const result = moveBy(moveModel, id, by);
    const write = result ? writeOf(moveModel, result.model, id) : null;
    if (!result || !write) return;
    if (write.kind === "session") return edits.onMove(id, by);
    if (write.kind === "part") return edits.onPartMove(id, by);
    const names: MoveNames = {
      tile: whatIs,
      session: (key) => `Session ${groups.find((entry) => groupKey(entry) === key)?.number ?? ""}`.trim(),
      part: (key) => partsModel?.titles.get(key) ?? "that part",
    };
    const sentence = movedStep(whatIs(id), by);
    const said = movedLine(result.move, names);
    if (write.kind === "tile" && write.session) return edits.onMoveTile(id, write.session, { order: write.atEnd, sentence, said, failed: "Couldn't move that. Try again." });
    if (write.kind === "nested" && write.parent !== undefined && write.index !== undefined) {
      const parent = write.parent;
      const index = write.index;
      return track(sentence, async () => prompts.nest(id, parent, index)).then((done) => (setSessionSaid(said), done));
    }
    return track(sentence, async () => prompts.move(id, by)).then(() => setSessionSaid(said));
  };
  const stepOf = {
    prompt: asStep(ADDED.prompt, onAddPrompt),
    agent: asStep(ADDED.agent, onAddAgentOrTeam),
    decision: asStep(ADDED.decision, onAddDecision),
    manual: asStep(ADDED.manual, onAddManual),
    code: asStep(ADDED.code, onAddCode),
    check: asStep(ADDED.check, onAddCheck),
    result: asStep(ADDED.result, onAddResultInput),
    tool: asStep(ADDED.tool, onAddTool),
    sourceTile: (what: string) => asStep(what, onAddSourceTile),
    agentPrompt: asStep(ADDED.promptToAgent, onAddAgentPrompt),
    agentTo: asStep(ADDED.agentToTeam, onAddAgentTo),
    nest: asStep((id: string) => `Moved ${whatIs(id)}`, onNest),
    move: (id: string, direction: -1 | 1) => moveOne(id, direction),
    session: (importId: string, workstream?: string) => track(`Added Session ${nextSessionNumber()}`, async () => onAddSession(importId, workstream), { notice: true }),
    startSession: asStep(ADDED.session, onStartSession),
    picked: asStep(ADDED.file, onPicked),
    dropped: asStep(ADDED.file, onDropFiles),
    attach: asStep((id: string) => `Attached a file to ${whatIs(id)}`, attach),
    dropOnStep: asStep((id: string) => `Attached a file to ${whatIs(id)}`, onDropOnStep),
    setup: asStep("Added setup files", addSetup),
  };

  /* CA-20 P8: the build page's keys. */
  useBuildShortcuts({
    phone,
    history: buildHistory,
    actions,
    selection,
    selectedId,
    tiles: drawn.sessions.flatMap((session) => session.tiles),
    onSelect: setSelectedId,
    onMove: stepOf.move,
    openHelp: actions.shortcuts.open,
  });

  /* CA-22 P6: the selection bar is held while it falls away (on Esc or Clear selection), with the words it last had. */
  const barProps: SelectionBarProps | null =
    selection.size >= 2
      ? {
          phone,
          count: selection.size,
          holds: { tiles: selection.tiles.size, sessions: selection.sessions.size },
          moveTo: { sessions: addTargets.sessions, parts: (addToParts ?? []).map((part) => ({ key: part.key, label: part.title })) },
          onMoveToSession: (key) => void edits.onMoveTiles([...selection.tiles], key),
          onMoveToPart: (key) => void edits.onMoveSessionsToPart([...selection.sessions], key),
          onDuplicate: selection.tiles.size > 0 ? () => actions.duplicate([...selection.tiles]) : undefined,
          onGroup: bridge.available() && selection.tiles.size >= 2 ? () => actions.group([...selection.tiles]) : undefined,
          onUngroup: bridge.available() && [...selection.tiles].some((id) => actions.grouped(id)) ? () => actions.ungroup([...selection.tiles].filter((id) => actions.grouped(id))) : undefined,
          onRemove: () => actions.removeSelection(selection.items),
          onClear: selection.clear,
        }
      : null;
  const heldBar = useHeld(barProps, BASE);

  return (
    <BuildHistoryContext.Provider value={buildHistory}>
      <ReferenceBridgeContext.Provider value={bridge}>
        <BuildActionsContext.Provider value={actions}>
          <BuildSelectionContext.Provider value={selection}>
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
          if (setupKey) void stepOf.setup(files, undefined, { session: setupKey, all: true });
          else if (stepId) void stepOf.attach(stepId, files);
          else {
            const tile = tileNext.current;
            tileNext.current = false;
            void stepOf.picked(files, tile);
          }
        }}
      />
      <PartRegistryProvider registry={registry}>
      <GroupLabelsProvider making={makingDrawn} onOpen={referenceActions.openGroup}>
      <DetailsReferencesProvider value={detailsRefs}>
      <SandboxView
        {...viewProps}
        classification={classification}
        saveProblem={compose.saveFailure}
        loadError={compose.loadError ?? undefined}
        save={mergeSave(viewProps.save, thread.save, writesFailed ? "error" : "idle", offline ? "offline" : "idle")}
        pendingWrites={pending}
        strips={strips}
        lastSavedAt={latestOf(viewProps.lastSavedAt, thread.lastSavedAt)}
        onRetrySave={onRetrySave}
        onPublish={() => void onPublish()}
        post={
          <PostTab
            thread={thread}
            phone={phone}
            draft={{ build, title: viewProps.title, maker }}
            references={{
              groups: postRefGroups,
              lookup: allTargets,
              onGo: links.goTo,
              onMentions: links.onMentions,
              history: references.history,
              onEditor: references.setEditor,
              nameOf: nameOfTarget,
              selecting: referenceActions.selecting,
              onSelectingDone: () => referenceActions.setSelecting(null),
            }}
          />
        }
        threadNote={thread.hold}
        {...addHandlers}
        addTargets={addTargets}
        viewOptions={{ sessionList: viewOptions.sessionList, sessionCount: jumpItems.length, onChange: setViewOptions, labels: partsModel ? { value: partsModel.labels, onChange: edits.onLabels } : undefined, onColours: () => referenceActions.setColoursOpen(true), fold: foldAll }}
        sessionList={sessionList}
        selectionBar={heldBar.value ? <SelectionBar {...heldBar.value} leaving={heldBar.leaving} /> : null}
        summary={steps.length > 1 ? buildSummary(steps) || undefined : undefined}
        map={mapColumn}
        mapPanel={mapPanel}
        selectedKey={selectedId}
        onEditSelected={selectedId ? () => openTile(selectedId) : undefined}
        renderDetails={(plan) => (
          <DetailsPanel phone={phone} view={view} inBuild={inBuild} focusMakes={focusMakes} focusSetup={focusSetup} colour={detailsColour} build={buildFacts} onEdit={selectedId ? () => openTile(selectedId) : undefined} {...detailsStepped} plan={plan} />
        )}
        selection={
          <DetailsPanel phone={phone} view={view} inBuild={inBuild} focusMakes={focusMakes} focusSetup={focusSetup} colour={detailsColour} build={buildFacts} onEdit={selectedId ? () => openTile(selectedId) : undefined} {...detailsStepped} />
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
            onSelect={selection.selectTile}
            onOpenPrompt={setOpenPromptId}
            onEditTile={openTile}
            onRename={prompts.rename}
            onMove={stepOf.move}
            onRemove={actions.removeTile}
            onAddAgentPrompt={stepOf.agentPrompt}
            onAddAgentTo={(teamId) => void stepOf.agentTo(teamId)}
            onAttach={pickForStep}
            onNameMade={onNameMade}
            madeNames={madeByStep}
            onDropOnStep={(id, files) => void stepOf.dropOnStep(id, files)}
            onNest={stepOf.nest}
            canNest={canNest}
            onMoveToSession={edits.onMoveTile}
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
            onAddPrompt={stepOf.prompt}
            addToSession={(key) => <AddMenu phone={phone} variant="row" fixedSession={key} targets={{ onSession: aimAt }} {...addHandlers} />}
            sessionOps={{ onTitle: edits.onTitle, onMove: edits.onMove, onRemove: (key) => actions.askRemoveSessions([key]), onMergeUp: edits.onMergeUp, onMoveToPart: partsModel ? edits.onMoveToPart : undefined, onWithAbove: partsModel ? edits.onWithAbove : undefined }}
            onDropSession={edits.onDrop}
            parts={
              partsModel
                ? {
                    parts: partsModel.list,
                    withAbove: partsModel.withAbove,
                    onToggle: edits.onPartFold,
                    onColour: (key, anchor, what, colour) => onColour(refTo({ kind: "workstream", id: key }), anchor, what, colour),
                    ops: { onName: edits.onPartName, onMove: edits.onPartMove, onRemove: edits.onPartRemove, onStartsAfter: edits.onPartStartsAfter },
                  }
                : undefined
            }
            onDropOnWorkstream={partsModel ? edits.onDropOnPart : undefined}
            onDropWorkstream={partsModel ? edits.onDropPart : undefined}
            onAddPart={buildId ? () => void edits.onAddPart() : undefined}
            onSplitHere={edits.onSplitHere}
            promptIn={promptSession}
            said={sessionSaid}
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
              onAdd: (importId, part) => void stepOf.session(importId, part),
              onStartNew: (part) => void stepOf.startSession(part),
              parts: addToParts,
            }}
            collapsed={collapsedKeys}
            onToggleCollapsed={onToggleCollapsed}
            ringedSession={ringedSession}
            arriving={arriving}
            onArrived={(key, status) => {
              setArriving((current) => (current && current.key === key ? null : current));
              if (status === "written" && arriving && arriving.key === key) setSessionSaid(arriving.count > 0 ? `Added Session ${arriving.head.number} with ${arriving.count} ${arriving.count === 1 ? "prompt" : "prompts"}.` : `Added Session ${arriving.head.number}.`);
              if (status === "failed") setSessionSaid(arriving?.kind === "empty" ? "Couldn't make that session. Try again." : "Couldn't add that session. Try again.");
            }}
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
            onAddSession={(id, part) => void stepOf.session(id, part)}
            parts={addToParts}
            onDropFiles={(files, paths) => void stepOf.dropped(files, paths)}
            onPick={pick}
            connectHref="/connect"
            onRemoveFile={actions.removeFile}
          />
          </div>
        }
        missing={[...missing.map((key): SandboxMissingItem => ({ key, label: PUBLISH_WORDS[key] })), ...runtimeIssues.blockers.map((label, at) => ({ key: `runtime-${at}` as const, label }))]}
        counts={counts}
        lens={lens}
        onLens={onLens}
        mapAvailable={mapAvailable}
        mapHint={mapAvailable && !switched}
      />
      </DetailsReferencesProvider>
      </GroupLabelsProvider>
      </PartRegistryProvider>
      <AddAgentDialog
        open={addAgentOpen}
        onOpenChange={onAgentDialog}
        nextNumber={steps.length + 1}
        teamsAvailable={teamsAvailable}
        seed={agentSeed}
        inBuild={inBuild}
        onAdd={(input) => void stepOf.agent(input)}
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
        onAdd={(input) => void stepOf.decision(input)}
      />
      <AddSystemPromptDialog
        open={addSystemPromptOpen}
        onOpenChange={setAddSystemPromptOpen}
        prompts={flatten(steps).filter((step) => step.kind === "prompt" && !step.id.endsWith(":instructions")).map((step) => ({ id: step.id, label: `${step.number} · ${step.title ?? step.defaultTitle}` }))}
        session={currentSession}
        onAdd={(input) => void stepOf.sourceTile(ADDED.systemPrompt)((session) => prompts.addSystemPromptTile({ ...input, session }))}
      />
      <AddDatasetDialog open={addDatasetOpen} onOpenChange={setAddDatasetOpen} onAdd={(input) => void stepOf.sourceTile(ADDED.dataset)((session) => prompts.addDatasetTile({ ...input, session }))} />
      <AddRepoDialog open={addRepoOpen} onOpenChange={setAddRepoOpen} inBuild={inBuild} onAdd={(input) => void stepOf.sourceTile(ADDED.repo)((session) => prompts.addRepoTile({ ...input, session }))} />
      <AddManualStepDialog
        open={addManualOpen}
        onOpenChange={setAddManualOpen}
        after={afterStep ? `${afterStep.number} · ${afterStep.title ?? afterStep.defaultTitle}` : null}
        available={manualAvailable}
        inBuild={inBuild}
        onAdd={(input) => void stepOf.manual(input)}
      />
      <AddCheckDialog open={addCheckOpen} onOpenChange={setAddCheckOpen} onAdd={(input) => void stepOf.check(input)} />
      <AddCodeDialog open={addCodeOpen} onOpenChange={onCodeDialog} inBuild={inBuild} seed={codeSeed} onAdd={(input) => void stepOf.code(input)} />
      <AddResultDialog open={addResultOpen} onOpenChange={setAddResultOpen} inBuild={inBuild} onAdd={(input) => void stepOf.result(input)} />
      <AddToolDialog open={addToolOpen} onOpenChange={setAddToolOpen} inBuild={inBuild} onAdd={(input) => void stepOf.tool(input)} />
      <TileEditDialog view={editView} handlers={detailsStepped} inBuild={inBuild} teamsAvailable={teamsAvailable} onClose={() => setEditId(null)} />
      <FullPromptWindow
        steps={steps}
        groups={groups}
        names={listFacts.names}
        openId={openPromptId}
        mode="maker"
        details={promptDetails}
        handlers={detailsStepped}
        onTitle={prompts.rename}
        onChanges={prompts.setChanges}
        onReply={prompts.setReply}
        onExtras={prompts.setExtras}
        onText={prompts.setTextOf}
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
      <ClashWindow view={twoTabs.clash} busy={twoTabs.busy} onUseOther={twoTabs.useOther} onKeepThis={twoTabs.keepThis} />
      <LeaveWindow open={leaving.open} count={leaving.count} onStay={leaving.stay} onLeave={leaving.leave} />
      <ReferenceNotice notice={buildHistory.notice} onUndo={() => void buildHistory.undo()} onDone={buildHistory.dismiss} phone={phone} />
      {actionDialogs}
      {referenceActions.keepDialog}
      <ReferenceWindows references={references} actions={referenceActions} refGroups={postRefGroups} lookup={allTargets} phone={phone} />
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
          </BuildSelectionContext.Provider>
        </BuildActionsContext.Provider>
      </ReferenceBridgeContext.Provider>
    </BuildHistoryContext.Provider>
  );
}

/** CA-13 rule 4: the Code tiles of a build, for "Called from" and "Read from a Code tile". */
export const codeTilesOf = (steps: readonly Step[]): { id: string; label: string; source: string }[] =>
  steps.flatMap((step) => (step.kind === "code" ? [{ id: step.id, label: step.filename ?? step.title ?? step.defaultTitle, source: step.text }] : []));

/** CA-13 P2: the steps a decision can read the output of. */
export const stepChoicesOf = (steps: readonly Step[]): { id: string; label: string }[] =>
  steps.filter((step) => step.kind !== "decision").map((step) => ({ id: step.id, label: `${step.number} · ${step.title ?? step.defaultTitle}` }));

export default SandboxPage;
