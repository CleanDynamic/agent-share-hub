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

import { lazy, Suspense, type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePageReady } from "@/lib/routing/pageReady";
import { flushSync } from "react-dom";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { shortReason } from "@/lib/errors/code";

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
import { isLegacySession, isTypedSession, sessionOrderOf, sessionsMetaOf, sessionToolsOf, setSessionMeta, storedWorkstreamsOf, todayDay, newSessionKey, type MakingSession, type SessionMeta, type Workstream } from "@/lib/build/making";
import { defaultWorkstream, labelsOf, orderByWorkstream, orderWithNewSession, workstreamKeyOf, workstreamLabel, workstreamMark, workstreamsOf } from "@/lib/build/workstreams";
import { fileKindFor, getMediaById, MEDIA_MAX_BYTES, mediaKindFor, signedMediaUrl, uploadMedia } from "@/lib/build/media";
import { addSessionCopy, addSessionToBuild, fillMissingTiles, hasSession, type SessionCopy } from "@/lib/build/addSession";
import { buildSessionRowsKey } from "./useComposeSessions";
import { insertBuildSessionIfTable, nextSessionPosition } from "@/lib/build/buildSessions";
import { nextSessionNumber as nextNumber } from "@/lib/build/sessionNumbers";
import { collapsedKeys as readCollapsed, getSessionOrder, setCollapsed, setSessionOrder, orderKeys } from "@/lib/build/sessionLayout";
import { SessionJump, jumpItemsOf, useCurrentSession } from "@/components/build/SessionJump";
import { HEADER_HEIGHT } from "@/components/shell/chromeSize";
import { useSessionEdits } from "./useSessionEdits";
import { useViewOptions } from "./viewOptions";
import { movedLine, movedStep, moveBy, moveModelOf, writeOf, type MoveNames } from "@/lib/build/moveRules";
import { listPartsOf } from "./partsModel";
import type { Arriving } from "./arrival";
import { numberedWithArriving, replacedBy, withArrivingPart, withPartFolds, withParts, withoutSession } from "./sessionModel";
import { useNodeType } from "@/hooks/useNodeType";

import { mergeSave, PUBLISH_WORDS } from "./composeModel";
import { runtimeChecks, runtimeFindings } from "@/lib/build/runtimeChecks";
import { postFacts, publishChecklist, unpublishFailure, type ConfirmInput } from "@/lib/build/publishChecklist";
import { classificationLines } from "@/lib/classify/lines";
import { allTiles, orderOf } from "@/lib/build/buildSelection";
import { useComposePage } from "./ComposePage";
import type { PreviewMaker } from "@/components/post/PostPreview";
import type { PostTab as PostTabImpl } from "./PostTab";
import { useComposeThread } from "./useComposeThread";
import { useClassificationCard } from "./useClassificationCard";
import { useStoredBuildCounts } from "./useStoredBuildCounts";
import { storedCountsOf } from "@/lib/build/buildCounts";
import { BuildAnnouncer, noticeWords, useAnnounce } from "./BuildAnnouncer";
import { AddMenu, SandboxView, type PanelState, type SandboxCounts, type SandboxMissingItem, type SandboxLens } from "./SandboxView";
import type { PanelName } from "./PanelBoundary";
import type { AddManualStepDialog as AddManualStepDialogImpl, AddManualStepInput } from "./AddManualStepDialog";
import type { AddResultDialog as AddResultDialogImpl, AddResultInput } from "./AddResultDialog";
import type { AddToolDialog as AddToolDialogImpl, AddToolInput } from "./AddToolDialog";
import { buildSummary } from "@/lib/build/buildSummary";
import type { AddCheckDialog as AddCheckDialogImpl, AddCheckInput } from "./AddCheckDialog";
import type { AddCodeDialog as AddCodeDialogImpl, AddCodeInput } from "./AddCodeDialog";
import type { AddDatasetDialog as AddDatasetDialogImpl } from "./AddDatasetDialog";
import type { AddDecisionDialog as AddDecisionDialogImpl } from "./AddDecisionDialog";
import type { AddRepoDialog as AddRepoDialogImpl } from "./AddRepoDialog";
import type { AddSystemPromptDialog as AddSystemPromptDialogImpl } from "./AddSystemPromptDialog";
import type { DecisionInput } from "@/lib/build/graph";
import { AddAgentDialog, DEFAULT_AGENT_MODEL, type AddAgentInput, type AgentSeed } from "./AddAgentDialog";
import { ADD_FLASH_MS, BuildList, partName, type AddAsAgentInput, type PendingAdd } from "./BuildList";
import { useComposerScrollPadding } from "./composeChrome";
import { dividers, suggestionKey, type ListResult, type ListSuggestion } from "./buildListModel";
import type { FullPromptWindow as FullPromptWindowImpl } from "@/components/build/FullPromptWindow";
import { attachFiles } from "./attachFiles";
import { DetailsPanel, type DetailsHandlers } from "./DetailsPanel";
import type { TileEditDialog as TileEditDialogImpl } from "./TileEditDialog";
import { opensEditDialog } from "./TileEditDialog";
import { buildFactsOf, pieces, resolveView, type MediaFacts } from "./detailsView";
import { sessionMapFor, type MapPieceLike } from "@/lib/build/sessionMap";
import { centre, partElement } from "@/components/build/partNav";
import { flashOutline } from "@/components/post/RefLinks";
import { SessionMapColumn, NoMap } from "./SessionMap";
import type { SessionMapPanel as SessionMapPanelImpl } from "./SessionMapPanel";
import { makerMapOf, type MapSettings } from "@/lib/build/making";
import { suggestUses } from "@/lib/build/suggest";
import type { SourcesPanel as SourcesPanelImpl } from "./SourcesPanel";
import { FIRST_SESSION_KEY, NO_APP, isChatExport, librarySources, repeatsOf, projectFileReminders, shortDate, sourceFiles, sourceSessions, unfinishedSources, type SourceSession } from "./sourcesModel";
import { librarySessionsKey } from "@/hooks/useLibrarySessions";
import { useOnScreen } from "@/hooks/useOnScreen";
import { refGroups, refLookup } from "@/lib/build/postRefs";
import { makingWithGroupColours, previewGroupColour, withGroupColours, type ReferenceGroup } from "@/lib/build/referenceGroups";
import { setReferenceGroups } from "@/lib/build/referenceGroupsWrite";
import { NOTICE_ROOM, ReferenceNotice } from "./referencePieces";
import { OfflineStrip, OtherTabStrip, Strips } from "./saveStrips";
import { useConnectionWatch, useOffline, usePendingWrites, useReconnected } from "./usePendingWrites";
import { useLeaveGuard } from "./useLeaveGuard";
import { useWriteGuard } from "./useWriteGuard";
import type { LeaveWindow as LeaveWindowImpl } from "./saveWindows";
import type { ClashWindow as ClashWindowImpl } from "./ClashWindow";
import { useTwoTabs, type ClashDescription } from "./useTwoTabs";
import { useReferences } from "./useReferences";
import { BuildHistoryContext, useBuildHistory } from "./useBuildHistory";
import { classificationKey } from "./useClassificationCard";
import { writeClassification, type StoredClassification } from "@/lib/classify/storage";
import { computeFacets, hasClassification, shapeFromBuilt, shownValues } from "@/lib/classify/facets";
import { ReferenceBridgeContext, useReferenceBridge } from "./useReferenceBridge";
import type { ReferenceBridge } from "@/lib/build/referenceBridge";
import { BuildActionsContext, tileName, useBuildActions } from "./useBuildActions";
import { findTargetsOf } from "./findIndex";
import { useBuildFind } from "./useBuildFind";
import { useBuildShortcuts } from "./useBuildShortcuts";
import { BuildSelectionContext, useBuildSelection } from "./useBuildSelection";
import { SelectionBar, type SelectionBarProps } from "./removePieces";
import { outlineOnce, useHeld } from "./buildMotion";
import { scrollToShow } from "./pageScroll";
import { MotionChannel, MotionChannelContext } from "./listMotion";
import { BASE } from "@/lib/theme/motion";
import type { Drawn } from "@/lib/build/buildSelection";
import { ADDED, HANDLERS_THAT_CHANGE_NOTHING, HANDLERS_THAT_REMOVE, handlerSentence } from "@/lib/build/stepSentences";
import { NOTICE_COPY } from "@/lib/build/referenceHistory";
import { GroupLabelsProvider } from "./groupLabels";
import { useReferenceActions } from "./useReferenceActions";
import { DetailsReferencesProvider, type DetailsReferencesValue } from "./DetailsReferences";
import type { ReferenceWindows as ReferenceWindowsImpl } from "./ReferenceWindows";
import { showWords } from "./showWords";
import { useHistoryKeys } from "./useReferenceHistory";
import { PartRegistryProvider, type PartRegistry } from "@/components/build/partNav";
import { allParts, PartWindow } from "@/components/build/PartWindow";
import { linkOf } from "@/lib/build/linkRules";
import { parseRefTo, refTo } from "@/lib/build/thread";
import { usePostLinks } from "./usePostLinks";
import { useColourPicking } from "./useColourPicking";
import { previewColours, previewWorkstreams, type ColourPreview } from "@/lib/build/colourPreview";
import { sayFailed } from "./draftStart";
import { lazyWindow, preloadComposerWindows } from "./lazyWindow";
import { preloadAddFromLibrary } from "./addFromLibraryReads";
import { sessionCopyOf, type LibraryPlace } from "@/lib/build/fromLibrary";
import { touchSavedItems, type LibrarySavedItem } from "@/lib/library/savedItems";
import { reportError } from "@/lib/errors/report";

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
/** SV-07 P3: where a jump tab puts a session's head: this far below the sticky header. */
const JUMP_GAP = 24;

/** SV-26 P3: these windows load the first time they open, or at idle once the composer is ready (lazyWindow.tsx). */
const AddManualStepDialog = lazyWindow<ComponentProps<typeof AddManualStepDialogImpl>>(() => import("./AddManualStepDialog").then((m) => ({ default: m.AddManualStepDialog })), (p) => p.open);
const AddResultDialog = lazyWindow<ComponentProps<typeof AddResultDialogImpl>>(() => import("./AddResultDialog").then((m) => ({ default: m.AddResultDialog })), (p) => p.open);
const AddToolDialog = lazyWindow<ComponentProps<typeof AddToolDialogImpl>>(() => import("./AddToolDialog").then((m) => ({ default: m.AddToolDialog })), (p) => p.open);
const AddCheckDialog = lazyWindow<ComponentProps<typeof AddCheckDialogImpl>>(() => import("./AddCheckDialog").then((m) => ({ default: m.AddCheckDialog })), (p) => p.open);
const AddCodeDialog = lazyWindow<ComponentProps<typeof AddCodeDialogImpl>>(() => import("./AddCodeDialog").then((m) => ({ default: m.AddCodeDialog })), (p) => p.open);
const AddDatasetDialog = lazyWindow<ComponentProps<typeof AddDatasetDialogImpl>>(() => import("./AddDatasetDialog").then((m) => ({ default: m.AddDatasetDialog })), (p) => p.open);
const AddDecisionDialog = lazyWindow<ComponentProps<typeof AddDecisionDialogImpl>>(() => import("./AddDecisionDialog").then((m) => ({ default: m.AddDecisionDialog })), (p) => p.open);
const AddRepoDialog = lazyWindow<ComponentProps<typeof AddRepoDialogImpl>>(() => import("./AddRepoDialog").then((m) => ({ default: m.AddRepoDialog })), (p) => p.open);
const AddSystemPromptDialog = lazyWindow<ComponentProps<typeof AddSystemPromptDialogImpl>>(() => import("./AddSystemPromptDialog").then((m) => ({ default: m.AddSystemPromptDialog })), (p) => p.open);
const TileEditDialog = lazyWindow<ComponentProps<typeof TileEditDialogImpl>>(() => import("./TileEditDialog").then((m) => ({ default: m.TileEditDialog })), (p) => opensEditDialog(p.view));
const FullPromptWindow = lazyWindow<ComponentProps<typeof FullPromptWindowImpl>>(() => import("@/components/build/FullPromptWindow").then((m) => ({ default: m.FullPromptWindow })), (p) => p.openId !== null);

/** SV-26 P3: the Post tab, the Map's panel and Sources are panes that draw when their tab or window is on; same loading. */
const PostTab = lazyWindow<ComponentProps<typeof PostTabImpl>>(() => import("./PostTab").then((m) => ({ default: m.PostTab })), () => true);
const SessionMapPanel = lazyWindow<ComponentProps<typeof SessionMapPanelImpl>>(() => import("./SessionMapPanel").then((m) => ({ default: m.SessionMapPanel })), () => true);
const SourcesPanel = lazyWindow<ComponentProps<typeof SourcesPanelImpl>>(() => import("./SourcesPanel").then((m) => ({ default: m.SourcesPanel })), () => true);

const ReferenceWindows = lazyWindow<ComponentProps<typeof ReferenceWindowsImpl>>(
  () => import("./ReferenceWindows").then((m) => ({ default: m.ReferenceWindows })),
  (p) => Boolean(p.actions.groupWindow) || p.actions.coloursOpen,
);

const ClashWindow = lazyWindow<ComponentProps<typeof ClashWindowImpl>>(() => import("./ClashWindow").then((m) => ({ default: m.ClashWindow })), (p) => Boolean(p.view));
const LeaveWindow = lazyWindow<ComponentProps<typeof LeaveWindowImpl>>(() => import("./saveWindows").then((m) => ({ default: m.LeaveWindow })), (p) => p.open);

/** SV-18: the Add from Library window is its own chunk, fetched on hover or focus of Add › From Library and at idle. */
const AddFromLibrary = lazy(() => import("./AddFromLibrary"));

/** SV-07 P2: what `insertSession` adds: a chat imported, an empty session started here, or a ready-made copy. */
type SessionSource =
  | { kind: "import"; importId: string; head: { tool: string; detail: string; date: string }; count: number }
  | { kind: "empty" }
  | { kind: "copy"; copy: SessionCopy; head: { tool: string; detail: string; date: string } };

/** What a session that has no entry yet starts from: a typed session's tool and day, else nothing of its own. */
const fallbackMeta = (group: Parameters<typeof groupKind>[0] & { tool?: string | null; startedAt?: string | null } | undefined, key: string): SessionMeta =>
  groupKind(group ?? { sessionId: key }) === "typed" ? { tool: group?.tool ?? null, date: group?.startedAt ?? todayDay() } : { tool: null, date: "" };
const latestOf = (a: Date | null | undefined, b: Date | null | undefined): Date | null => (a && b ? (a.getTime() >= b.getTime() ? a : b) : (a ?? b ?? null));

/** The page, with its one announcer around it (CA-26 P4). */
export function SandboxPage() {
  return (
    <BuildAnnouncer>
      <SandboxPageBody />
    </BuildAnnouncer>
  );
}

function SandboxPageBody() {
  const announce = useAnnounce();
  /* CA-10 (CA-09 F10): the session library polls only while Sources is on screen (on a phone, while its sheet is open). */
  const [sourcesAnchor, sourcesOnScreen] = useOnScreen<HTMLDivElement>();
  const { viewProps, missing, build, tree, ensureBuild, firstSession, nodes, sessions, prompts, compose, buildId, rehydrate } = useComposePage({ sessionsActive: sourcesOnScreen });
  usePageReady("composer", !buildId || Boolean(build));
  const navigate = useNavigate();
  /* CA-20: the build's one history: every change the maker makes is a step of it, CA-19's colour and link steps too. */
  const bridgeHolder = useRef<ReferenceBridge | undefined>(undefined);
  /* SV-06 P2: where every action says how the List should move for it; the List and Sources take it from here. */
  const [motion] = useState(() => new MotionChannel());
  const buildHistory = useBuildHistory({ buildId, nodes, motion, getBridge: () => bridgeHolder.current, peek: () => ({ making: (build as { making?: unknown } | null)?.making, sessions: sessions.rows }) });
  const notice = buildHistory.notice;
  useEffect(() => {
    if (notice) announce(noticeWords(notice));
  }, [notice, announce]);
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
  /* CA-25 P3: unpublish through the build's own update. A refusal (row-level security, a trigger) is told apart from a try that can be
     made again, and nothing is done to get around it. */
  const unpublish = useCallback(async (): Promise<"done" | "refused" | "failed"> => {
    try {
      await compose.unpublish();
      return "done";
    } catch (cause) {
      // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
      console.error("[Sandbox] unpublish failed", cause);
      const failure = unpublishFailure(cause);
      toast.error(failure === "failed" ? "Build not unpublished" : `Build not unpublished: ${shortReason(cause)}`);
      return failure;
    }
  }, [compose]);
  const runtimeFound = useMemo(() => runtimeFindings(buildSteps(tree)), [tree]);
  /* CA-25: what Publish waits for before the checklist opens: a connection, and the post's words written. The checklist and Confirm replace the
     toasts: a broken Decision, a post that cannot be saved and the reminders are items there. */
  const preparePublish = useCallback(async (): Promise<boolean> => {
    // Publishing waits for a connection: a publish held until later would go live when the maker has long moved on.
    if (connection.isOffline()) {
      toast(PUBLISH_OFFLINE);
      return false;
    }
    await flushThread();
    return true;
  }, [flushThread]);
  const onPublish = useCallback(() => viewProps.onPublish(), [viewProps]);
  /* CA-23: the one pending-writes count, and whether there is a connection. The write guard holds writes while there is none. */
  useConnectionWatch();
  /* CA-23 P4: two tabs (or two devices) on one build. What each clash is called and where it falls is said once the page knows its tiles (`describeClash`, below). */
  const describeClash = useRef<(clash: RawClash) => ClashDescription>(() => ({ name: "This", badge: "", rank: 0 }));
  const twoTabs = useTwoTabs({ buildId, nodes, history: buildHistory, thread, rehydrate, describe: (clash) => describeClash.current(clash) });
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
  const onLens = useCallback((next: SandboxLens) => setLens(next), []);

  /* CA-21 P7: the session on its way, for the List to open a lane for and fill; it lets go when its animation is over. */
  const [arriving, setArriving] = useState<Arriving | null>(null);
  const storedMade = (build as { making?: unknown } | null)?.making;
  /* SV-07 P2: one model from the click to the saved row. An import that replaces the empty Session 1 is drawn in its place from the
     click: that session is left out of what is drawn, so the two are never drawn side by side. */
  const replaced = useMemo(() => replacedBy(storedMade, getSessionOrder(storedMade, sessions.rows), (key) => hasSession(tree, key), arriving), [storedMade, sessions.rows, tree, arriving]);
  /* SV-07 P3: the parts Add a part is writing, drawn from the click until the stored parts have them. */
  const [shownParts, setShownParts] = useState<readonly Workstream[] | null>(null);
  /* SV-07 P3: a part folded or opened shows it at once, as a session does, until the write lands. */
  const [partFolds, setPartFolds] = useState<Readonly<Record<string, boolean>>>({});
  const made = useMemo(() => withArrivingPart(withPartFolds(withParts(withoutSession(storedMade, replaced), shownParts), partFolds), arriving), [storedMade, replaced, shownParts, partFolds, arriving]);
  /* CA-12 P5: sessions are numbered by `build_sessions.position`; a draft with no rows is numbered by its steps, as before. */
  const order = useMemo(() => orderByWorkstream(getSessionOrder(made, sessions.rows).filter((key) => key !== replaced), sessionsMetaOf(made), storedWorkstreamsOf(made)), [made, sessions.rows, replaced]);
  /** CA-06 P5: the colour the picker shows before it is saved, laid over the build everywhere it is drawn. */
  const [colourPreview, setColourPreview] = useState<ColourPreview | null>(null);
  const { counts, hasAgent, sessionCount, steps: savedSteps, groups: savedGroups } = useMemo(() => {
    const steps = buildSteps(tree);
    // CA-04 P1: every step sits in a session; a session made here carries its tool and day in `making.sessions_meta`.
    // SV-07 P2: the session on its way already has its number, and the ones after it have theirs.
    const groups = numberedWithArriving(sessionGroups(steps, makingSessions(made), sessionToolsOf(made), sessionsMetaOf(made), order, storedWorkstreamsOf(made)), arriving, (group) => groupKey(group));
    const all = flatten(steps);
    const next: SandboxCounts = {
      sessions: shownGroups(groups).length,
      // SV-07 P7: a Summary tile is no prompt.
      prompts: all.filter((step) => step.kind === "prompt" && !step.summary).length,
      files: tree.filter((node) => node.type === FILE_TYPE && !isSetupPayload(node.payload)).length,
    };
    return { counts: next, hasAgent: all.some((step) => step.kind === "agent" || step.kind === "team"), sessionCount: shownGroups(groups).length, steps, groups };
  }, [tree, made, order, arriving]);
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

  const teamType = useNodeType(compose.nodeTypes, "team");
  const teamsAvailable = Boolean(teamType?.is_active);
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  /** CA-13 P1, P2: Add › Decision, disabled until the `decision` node type is live. */
  const decisionType = useNodeType(compose.nodeTypes, "decision");
  const decisionAvailable = Boolean(decisionType?.is_active);
  const [addDecisionOpen, setAddDecisionOpen] = useState(false);
  /** CA-15 P9: Add › System prompt, Dataset and GitHub repository, each disabled until its node type is live. */
  const systemPromptType = useNodeType(compose.nodeTypes, "system_prompt");
  const datasetType = useNodeType(compose.nodeTypes, "dataset");
  const repoType = useNodeType(compose.nodeTypes, "repo");
  const systemPromptAvailable = Boolean(systemPromptType?.is_active);
  const datasetAvailable = Boolean(datasetType?.is_active);
  const repoAvailable = Boolean(repoType?.is_active);
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
  const manualType = useNodeType(compose.nodeTypes, "manual_step");
  const manualAvailable = Boolean(manualType?.is_active);
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
    // SV-07 P2: the empty Session 1 of a post with no draft is drawn only while nothing is on its way.
    if (empties.length === 0 && !buildId && shown.length === 0 && !arriving) return [{ key: FIRST_SESSION_KEY, number: 1, tool: NO_APP, detail: "", prompts: [] }];
    return empties;
  }, [shown, sourceSessionRows, buildId, order, arriving]);
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
  useEffect(() => {
    if (sessionSaid) announce(sessionSaid);
  }, [sessionSaid, announce]);
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
  const edits = useSessionEdits({ buildId, made, nodes, steps, groups, claim, say: setSessionSaid, moveModel, parts: partsModel ?? undefined, history: buildHistory, bridge, showParts: setShownParts, onGone: (key) => {
    if (chosenRef.current === key) setChosenSession(null);
    setPromptSession((current) => (current === key ? null : current));
  } });
  /** SV-07 P3: fold or open a part, shown at once; the at-once fold lets go when the write has landed (or failed). */
  const onPartFold = useCallback(
    (key: string, collapsed: boolean): Promise<void> => {
      setPartFolds((previous) => ({ ...previous, [key]: collapsed }));
      return edits.onPartFold(key, collapsed).finally(() =>
        setPartFolds((previous) => {
          if (previous[key] !== collapsed) return previous;
          const { [key]: _done, ...rest } = previous;
          return rest;
        }),
      );
    },
    [edits],
  );
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
  /** SV-07 P3: the part a session was last added to, marked in Your sessions' "Add this session to". */
  const [lastPart, setLastPart] = useState<string | undefined>(undefined);
  /* SV-05 P2: a new session's number is the next place at the end of its part, from the one numbering. */
  const nextSessionNumber = useCallback(
    (part?: string) => nextNumber(shownGroups(groups).map(groupKey), { meta: sessionsMetaOf(made), workstreams: storedWorkstreamsOf(made) }, part),
    [groups, made],
  );
  useEffect(() => {
    if (!ringedSession) return;
    // SV-07 P4: only through SV-06's scroll helper, and only when the session just added is wholly off screen.
    const session = document.querySelector<HTMLElement>(`[data-session-key="${ringedSession.key}"]`);
    const box = session?.getBoundingClientRect();
    if (session && box && (box.bottom < 0 || box.top > window.innerHeight)) scrollToShow(session, { align: "middle" });
    const timer = window.setTimeout(() => setRingedSession(null), ADD_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [ringedSession]);

  /**
   * SV-07 P2: the one way a session is added: a chat imported, an empty one started here, or a ready-made copy (SV-18, SV-21).
   * The pending entry is drawn at once, in its final part and place, with its number; the animator is told first; the saved
   * session then takes its place in the same frame (`arriving`, below the List). Resolves the new keys, for `motion.expect`.
   */
  const insertSession = useCallback(
    async (source: SessionSource, workstream?: string): Promise<string[]> => {
      const part = buildId ? defaultWorkstream(made, workstream) : undefined;
      const key = source.kind === "import" ? source.importId : source.kind === "copy" ? source.copy.key : newSessionKey();
      const number = nextSessionNumber(part);
      const head = source.kind === "empty" ? { tool: NO_APP, detail: "", date: shortDate(new Date().toISOString()) } : source.head;
      // SV-07 P3: a closed part is opened first (the animator's unfold), and the session then arrives in it.
      if (part && storedWorkstreamsOf(made).some((entry) => entry.key === part && entry.collapsed)) void onPartFold(part, false).catch(() => undefined);
      if (workstream) setLastPart(workstream);
      motion.expect({ kind: "add", keys: [key] });
      setArriving({ key, kind: source.kind === "empty" ? "empty" : "chat", head: { key, number, prompts: [], ...head }, count: source.kind === "import" ? source.count : source.kind === "copy" ? source.copy.tiles.length : 0, part, status: "writing" });
      if (source.kind === "import") setSessionSaid(`Adding ${head.tool} · ${head.date} as Session ${number}…`);
      try {
        const id = await ensureBuild();
        if (source.kind === "import") {
          // SV-05 P4: the progress row follows the tiles as each batch is written. Stop is not offered: a session is never half-added.
          await addSessionToBuild(source.importId, { kind: "existing", buildId: id, workstream }, (progress) => setArriving((current) => (current && current.key === key ? { ...current, progress } : current)));
        } else if (source.kind === "copy") await addSessionCopy(id, source.copy, workstream);
        else {
          const keys = orderKeys(groups).filter((entry) => !isLegacySession(entry));
          await trackWrite("making", async () => {
            await setSessionMeta(id, key, { tool: null, date: todayDay(), ...(part ? { workstream: part } : null) });
            await insertBuildSessionIfTable({ buildId: id, sessionKey: key, importId: null, position: nextSessionPosition(sessions.rows) });
            // SV-07 P1: the order as it is stored when it is written: a session added meanwhile, not yet drawn here, keeps its place.
            const withStored = (fresh: Record<string, unknown>) => [...keys, ...sessionOrderOf(fresh).filter((entry) => !keys.includes(entry) && entry !== key)];
            if (part) await setSessionOrder(id, (fresh) => orderWithNewSession(fresh, withStored(fresh), key, part));
            else await patchMaking(id, (fresh) => ({ session_order: [...withStored(fresh), key] }));
          });
        }
        await Promise.all([
          refreshRecord(id),
          queryClient.invalidateQueries({ queryKey: ["build", "listBuildSessions"] }),
          ...(source.kind === "empty" ? [] : [queryClient.invalidateQueries({ queryKey: ["build", "getMadeWith"] })]),
          ...(source.kind === "import" ? [queryClient.invalidateQueries({ queryKey: librarySessionsKey })] : []),
        ]);
        setChosenSession(key);
        setArriving((current) => (current && current.key === key ? { ...current, status: "written" } : current));
        setRingedSession((current) => ({ key, n: (current?.n ?? 0) + 1 }));
        return [key];
      } catch (cause) {
        setArriving((current) => (current && current.key === key ? { ...current, status: "failed" } : current));
        throw cause;
      }
    },
    [buildId, made, nextSessionNumber, ensureBuild, groups, sessions.rows, refreshRecord, queryClient, setChosenSession, onPartFold],
  );

  /**
   * CA-14 P5: "Start a new session": an empty session at the end, "No app chosen", at once. Its app is picked later in
   * its head. If Session 1 is still empty and has no app, nothing new is made: Session 1 is the one to use. Written
   * where a session made here is kept (`sessions_meta`, `build_sessions` when the table is there, `session_order`), so it
   * works before the CA-12 table is live.
   */
  const onStartSession = useCallback(async function again(workstream?: string) {
    setStartingSession(true);
    try {
      const fresh = !buildId;
      const first = shown[0];
      // CA-17 P3: with parts the session joins the chosen one (else the last); an empty Session 1 is used only when it is in that part.
      const part = fresh ? undefined : defaultWorkstream(made, workstream);
      const emptyFirst = Boolean(first && groupKind(first) === "typed" && !first.tool && first.stepNumbers.length === 0 && (!part || workstreamKeyOf(sessionsMetaOf(made)[groupKey(first)], storedWorkstreamsOf(made)) === part));
      if (fresh || (emptyFirst && first)) {
        // Nothing new is made: a new post's Session 1, or the empty one there is, is the one to use.
        const id = await ensureBuild();
        const key = fresh ? firstSession.current : groupKey(first);
        await Promise.all([refreshRecord(id), queryClient.invalidateQueries({ queryKey: ["build", "listBuildSessions"] })]);
        if (key) {
          setChosenSession(key);
          setRingedSession((current) => ({ key, n: (current?.n ?? 0) + 1 }));
        }
      } else await insertSession({ kind: "empty" }, workstream);
    } catch (cause) {
      // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
      console.error("[Sandbox] session not made", cause);
      sayFailed(cause, "Session not made", () => void again(workstream));
    } finally {
      setStartingSession(false);
    }
  }, [ensureBuild, buildId, shown, made, firstSession, refreshRecord, queryClient, setChosenSession, insertSession]);

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
    function again(key: string, closed: boolean) {
      setCollapseOverride((previous) => ({ ...previous, [key]: closed }));
      if (!buildId) return;
      void setCollapsed(buildId, key, closed)
        .then(() => Promise.all([queryClient.invalidateQueries({ queryKey: buildSessionRowsKey(buildId) }), queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(buildId) })]))
        .catch((cause) => {
          // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
          console.error("[Sandbox] collapse not saved", cause);
          setCollapseOverride((previous) => ({ ...previous, [key]: !closed }));
          sayFailed(cause, "Fold not saved", () => again(key, closed));
        });
    },
    [buildId, queryClient],
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
        for (const part of parts) if (Boolean(part.collapsed) !== closed) void onPartFold(part.key, closed);
      },
    };
  }, [groups, made, collapsedKeys, onToggleCollapsed, onPartFold]);

  const onSessionMeta = useCallback(
    async function again(key: string, change: { tool?: string | null; date?: string }): Promise<void> {
      try {
        if (isLegacySession(key)) {
          await claim(key, change);
          return;
        }
        const id = await ensureBuild();
        const group = groups.find((candidate) => groupKey(candidate) === key);
        // SV-07 P1: changed on the entry as it is stored, not as this page last read it.
        await setSessionMeta(id, key, (stored) => ({ ...(stored ?? { tool: group?.tool ?? null, date: group?.startedAt ?? todayDay() }), ...change }));
        await refreshRecord(id);
      } catch (cause) {
        // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
        console.error("[Sandbox] session not saved", cause);
        sayFailed(cause, "Session not saved", () => void again(key, change));
      }
    },
    [claim, ensureBuild, groups, refreshRecord],
  );

  /** CA-04 P6: what a session worked until; an old build's run of typed prompts is saved as a session first. */
  const onSessionGoal = useCallback(
    async function again(key: string, goal: SessionGoal | null): Promise<void> {
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
        await setSessionMeta(id, key, (stored) => {
          const { goal: _old, ...rest } = stored ?? fallbackMeta(group, key);
          return goal ? { ...rest, goal } : rest;
        });
        await refreshRecord(id);
      } catch (cause) {
        // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
        console.error("[Sandbox] goal not saved", cause);
        sayFailed(cause, "Goal not saved", () => void again(key, goal));
      }
    },
    [claim, ensureBuild, groups, refreshRecord],
  );

  /** CA-05: what a session carries beyond its steps (cost, background, ...), written whole; an old build's run of typed prompts is saved as a session first. */
  const onSessionExtras = useCallback(
    async function again(key: string, extras: SessionExtras): Promise<void> {
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
        await setSessionMeta(id, key, (stored) => withExtras(stored ?? fallbackMeta(group, key), extras));
        await refreshRecord(id);
      } catch (cause) {
        // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
        console.error("[Sandbox] session facts not saved", cause);
        sayFailed(cause, "Session details not saved", () => void again(key, extras));
      }
    },
    [claim, ensureBuild, groups, refreshRecord],
  );

  /** CA-05 P5: the sessions one ran at the same time as. The pairing is written on both sides, so the Map and the List agree. */
  const onSessionTogether = useCallback(
    async function again(key: string, next: string[]): Promise<void> {
      try {
        const self = isLegacySession(key) ? await claim(key) : key;
        if (!self) return;
        const id = await ensureBuild();
        const metas = sessionsMetaOf(made);
        const changes = togetherChanges(Object.fromEntries(Object.entries(metas).map(([other, meta]) => [other, meta.parallelWith])), self, next);
        for (const [other, list] of Object.entries(changes)) {
          const group = groups.find((candidate) => groupKey(candidate) === other);
          await setSessionMeta(id, other, (stored) => {
            const before = stored ?? fallbackMeta(group, other);
            return withExtras(before, { ...extrasOf(before), parallelWith: list });
          });
        }
        await refreshRecord(id);
      } catch (cause) {
        // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
        console.error("[Sandbox] sessions at the same time not saved", cause);
        sayFailed(cause, "Ran alongside not saved", () => void again(key, next));
      }
    },
    [claim, ensureBuild, groups, made, refreshRecord],
  );

  /** CA-06 P4: a session's colour, or none; an old build's run of typed prompts has no colour button, so is never here. */
  const onSessionColour = useCallback(
    async function again(key: string, colour: string | null): Promise<void> {
      try {
        const id = await ensureBuild();
        const group = groups.find((candidate) => groupKey(candidate) === key);
        // In the node queue, behind any write already going: a part's colour and its sessions' are written one after another.
        await nodes.run(() =>
          setSessionMeta(id, key, (stored) => {
            const { colour: _old, ...rest } = stored ?? fallbackMeta(group, key);
            return colour ? { ...rest, colour } : rest;
          }),
        );
        await refreshRecord(id);
      } catch (cause) {
        // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
        console.error("[Sandbox] session colour not saved", cause);
        sayFailed(cause, "Colour not saved", () => void again(key, colour));
      }
    },
    [ensureBuild, groups, refreshRecord, nodes],
  );

  /** CA-12 P3: "Pick an app" on a session made here. On a post with no draft yet, the draft and its Session 1 are made first. */
  const onPickApp = useCallback(
    async function again(key: string, tool: string | null): Promise<void> {
      try {
        const id = await ensureBuild();
        const real = key === FIRST_SESSION_KEY ? firstSession.current : key;
        if (!real) return;
        await setSessionMeta(id, real, (stored) => ({ ...(stored ?? { tool: null, date: todayDay() }), tool }));
        await refreshRecord(id);
      } catch (cause) {
        // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
        console.error("[Sandbox] app not saved", cause);
        sayFailed(cause, "App not saved", () => void again(key, tool));
      }
    },
    [ensureBuild, firstSession, refreshRecord],
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
  /* SV-07 P7: the same chat imported again says which session it repeats. */
  const repeats = useMemo(() => repeatsOf(sessions.sessions, groups), [sessions.sessions, groups]);
  const libraryRows = useMemo(() => librarySources(sessions.library, adding, Date.now(), buildId ?? null, repeats), [sessions.library, adding, buildId, repeats]);
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
  saveGroupsRef.current = async function again(list: ReferenceGroup[], order?: string[]): Promise<void> {
    try {
      await nodes.run(async () => {
        const id = await ensureBuild();
        await setReferenceGroups(id, list, order);
        await refreshRecord(id);
      });
    } catch (cause) {
      // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
      console.error("[Sandbox] reference groups not saved", cause);
      sayFailed(cause, "Colours not saved", () => void again(list, order));
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
        // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
        console.error("[Sandbox] check not added", cause);
        sayFailed(cause, "Check not added");
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

  /* ── SV-18: Add from Library ──
     The window lists the reader's saved items that fit where the maker is adding: the session they are adding to, or the agent
     or team whose "Add … from Library" row they pressed. Insert puts them in through the composer's one writer: tiles as one
     step of the history, like Duplicate, with the animator told first; a saved session through `insertSession`, the way a
     session is added. */
  const [library, setLibrary] = useState<{ place: LibraryPlace; open: boolean } | null>(null);
  const [inserted, setInserted] = useState<{ id: string; n: number } | null>(null);
  const sessionName = useCallback(
    (key: string | null): string => {
      const row = key ? sourceSessionRows.find((entry) => entry.key === key) : undefined;
      return row ? [`Session ${row.number}`, row.title].filter(Boolean).join(" · ") : "this build";
    },
    [sourceSessionRows],
  );
  const openLibrary = useCallback(
    async (place: LibraryPlace) => {
      try {
        // A new post has no draft yet: it is made now, so the pick has somewhere to go.
        if (!buildId) await ensureBuild();
        setLibrary({ place, open: true });
      } catch (cause) {
        sayFailed(cause, "Library did not open");
      }
    },
    [buildId, ensureBuild],
  );
  const onAddFromLibrary = useCallback(() => {
    const picked = chosenRef.current;
    const key = picked && sourceSessionRows.some((row) => row.key === picked) ? picked : currentSession;
    void openLibrary({ kind: "top", session: key, name: sessionName(key) });
  }, [sourceSessionRows, currentSession, openLibrary, sessionName]);
  const onAddFromLibraryTo = useCallback(
    (parentId: string) => {
      const step = flatten(steps).find((candidate) => candidate.id === parentId);
      if (!step) return;
      const top = steps.find((candidate) => candidate.id === parentId || flatten(candidate.children).some((child) => child.id === parentId));
      const where = top?.session ? sessionName(top.session) : "";
      void openLibrary({ kind: step.kind === "team" ? "team" : "agent", id: parentId, name: [where, step.title ?? step.defaultTitle].filter(Boolean).join(" · ") });
    },
    [steps, openLibrary, sessionName],
  );
  const warmLibrary = useCallback(() => preloadAddFromLibrary(queryClient, user?.id ?? null), [queryClient, user?.id]);
  /* Once the composer is up, at idle: the window's code and its first reads, so the first open is not a wait. */
  useEffect(() => {
    if (!user?.id) return;
    const schedule = window.requestIdleCallback ?? ((run: () => void) => window.setTimeout(run, 1500));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = schedule(() => {
      preloadAddFromLibrary(queryClient, user.id);
      preloadComposerWindows();
    });
    return () => cancel(handle as number);
  }, [queryClient, user?.id]);
  const onInsertFromLibrary = useCallback(
    async (items: LibrarySavedItem[], place: LibraryPlace) => {
      const copier = user?.id;
      if (!copier || items.length === 0) return;
      try {
        const at: LibraryPlace = place.kind === "top" ? { ...place, session: await sessionToWrite() } : place;
        let run: LibrarySavedItem[] = [];
        let first: string | null = null;
        const flush = async () => {
          if (run.length === 0) return;
          const ids = await actions.insertFromLibrary(run, at, copier);
          first ??= ids[0] ?? null;
          run = [];
        };
        for (const item of items) {
          if (item.kind !== "session") {
            run.push(item);
            continue;
          }
          await flush();
          const copy = sessionCopyOf(item, copier);
          await insertSession({ kind: "copy", copy, head: { tool: copy.meta.tool ?? NO_APP, detail: "", date: shortDate(new Date().toISOString()) } });
        }
        await flush();
        if (first) setInserted((current) => ({ id: first as string, n: (current?.n ?? 0) + 1 }));
        void touchSavedItems(items.map((item) => item.id)).catch(() => undefined);
        void queryClient.invalidateQueries({ queryKey: ["library", "savedItemsUsedIn"] });
        void queryClient.invalidateQueries({ queryKey: ["library", "listSavedItems"] });
      } catch (cause) {
        // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
        console.error("[Compose] not added from Library", cause);
        sayFailed(cause, "Not added from Library", () => void onInsertFromLibrary(items, place));
      }
    },
    [user?.id, sessionToWrite, actions, insertSession, queryClient],
  );
  /* The new tile is brought into view only when it would be wholly off screen (SV-06's helper), and ringed once. */
  useEffect(() => {
    if (!inserted) return;
    const tile = document.querySelector<HTMLElement>(`[data-tile-id="${inserted.id}"]`);
    const box = tile?.getBoundingClientRect();
    if (tile && box && (box.bottom < 0 || box.top > window.innerHeight)) scrollToShow(tile, { align: "middle" });
    const timer = window.setTimeout(() => setInserted(null), ADD_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [inserted]);

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
    async function again(input: AddResultInput): Promise<void> {
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
        // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
        console.error("[Sandbox] result not added", cause);
        sayFailed(cause, "Result not added", () => void again(input));
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
  /* SV-23 P1: the counts the Builds table filters on are the ones shown here, written with the facets once everything they are
     worked from has loaded. */
  const storedCounts = useMemo(() => (build && sessions.buildLoaded ? storedCountsOf(savedSteps, savedGroups, storedWorkstreamsOf(made)) : null), [build, sessions.buildLoaded, savedSteps, savedGroups, made]);
  useStoredBuildCounts({ buildId, build, owner: compose.isOwner, counts: storedCounts });
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
        buildHistory.record({ sentence: "Saved the Classification", undo: put(before), redo: put(after) });
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
  /* CA-25: the Publish checklist's input. The sessions with no app are the ones a maker can still give one; a legacy session cannot be. */
  const appless = useMemo(() => sourceSessionRows.filter((row) => row.tool === NO_APP && !isLegacySession(row.key)).map((row) => ({ key: row.key, number: row.number })), [sourceSessionRows]);
  const tileCount = useMemo(() => allTiles(orderOf(drawn)).length, [drawn]);
  const checklist = useMemo(
    () =>
      publishChecklist({
        missing,
        title: viewProps.title,
        description: viewProps.description,
        cover: viewProps.cover?.kind ?? null,
        tiles: tileCount,
        blockers: runtimeFound.blockers,
        threadHold,
        reminders: runtimeFound.reminders,
        appless: appless,
        // Until the database holds the classification, the Card cannot be filled: it is not asked for.
        cardFilled: !classificationCard.live || hasClassification(classificationCard.stored),
      }),
    [missing, viewProps.title, viewProps.description, viewProps.cover?.kind, tileCount, runtimeFound, threadHold, appless, classificationCard.live, classificationCard.stored],
  );
  /* CA-25 P2: what Confirm lists, read when it opens: the post as it stands, and the parts, sessions, tiles and files. */
  const confirmInput = useCallback(
    (): ConfirmInput => {
      const lines = hasClassification(classificationCard.stored) ? classificationLines(classificationCard.stored) : null;
      return {
        post: postFacts(thread.readDoc()),
        parts: partsModel?.list.length ?? 1,
        sessions: counts.sessions,
        tiles: tileCount,
        files: sourceFileRows.map((file) => file.name),
        card: lines ? [...new Set([...lines.line1, ...lines.line2])] : [],
      };
    },
    [thread, partsModel, counts.sessions, tileCount, sourceFileRows, classificationCard.stored],
  );
  const showApps = useCallback(
    (keys: readonly string[]) => {
      selection.selectSessions(keys);
      const first = keys.find((key) => document.querySelector(`[data-session-key="${key}"]`));
      if (first) document.querySelector(`[data-session-key="${first}"]`)?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    },
    [selection],
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
    async function again(nodeId: string): Promise<void> {
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
        // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
        console.error("[Sandbox] download failed", cause);
        sayFailed(cause, "File not downloaded", () => void again(nodeId));
      }
    },
    [tree],
  );

  const addPicture = useCallback(
    async function again(resultId: string, file: File): Promise<void> {
      if (!mediaKindFor(file.type) || file.size > MEDIA_MAX_BYTES) {
        toast.error(`${file.name}: image only`);
        return;
      }
      try {
        const id = await ensureBuild();
        const media = await nodes.run(() => uploadMedia({ buildId: id, file }));
        prompts.setFields(resultId, { media_id: media.id });
      } catch (cause) {
        // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
        console.error("[Sandbox] picture not added", cause);
        sayFailed(cause, `${file.name} not added`, () => void again(resultId, file));
      }
    },
    [ensureBuild, nodes, prompts],
  );

  const setAsCover = useCallback(
    async function again(mediaId: string): Promise<void> {
      try {
        const media = await getMediaById(mediaId);
        if (!media) throw new Error("media missing");
        const response = await fetch(await signedMediaUrl(media, { width: "original" }));
        const blob = await response.blob();
        viewProps.onFiles([new File([blob], media.filename ?? "cover", { type: media.mime ?? blob.type })]);
      } catch (cause) {
        // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
        console.error("[Sandbox] cover not set", cause);
        sayFailed(cause, "Cover not set", () => void again(mediaId));
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
    async function again(importId: string, workstream?: string): Promise<void> {
      setAdding((previous) => new Set(previous).add(importId));
      // CA-21 P7: the lane opens as soon as it is pressed; the count is all it needs of the chat to make a place for each prompt.
      const item = libraryRows.find((row) => row.id === importId);
      const head = { tool: item?.appKnown ? item.app : NO_APP, detail: item ? [item.model, item.date].filter(Boolean).join(" · ") : "", date: item?.date ?? "" };
      try {
        await insertSession({ kind: "import", importId, head, count: item?.promptCount ?? 0 }, workstream);
      } catch (cause) {
        // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
        console.error("[Sandbox] session not added", cause);
        sayFailed(cause, "Session not added", () => void again(importId, workstream));
      } finally {
        setAdding((previous) => {
          const next = new Set(previous);
          next.delete(importId);
          return next;
        });
      }
    },
    [libraryRows, insertSession],
  );

  /** SV-05 P3: Retry on a session that came in short: its missing prompts are imported again, and the head's line goes. */
  const onRetryImport = useCallback(
    async function again(key: string): Promise<void> {
      if (!buildId) return;
      try {
        const written = await fillMissingTiles(key, buildId);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(buildId) }),
          queryClient.invalidateQueries({ queryKey: ["build", "listBuildSessions"] }),
          queryClient.invalidateQueries({ queryKey: ["build", "getMadeWith"] }),
        ]);
        setSessionSaid(`Imported ${written} ${written === 1 ? "prompt" : "prompts"}.`);
      } catch (cause) {
        // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
        console.error("[Sandbox] prompts not imported", cause);
        sayFailed(cause, "Prompts not imported", () => void again(key));
      }
    },
    [buildId, queryClient],
  );

  /** One file of the build: stored through the media path, then recorded as a file node, behind the other node writes. CA-04 P2: with `parentId`, sent with that step. */
  const addOneFile = useCallback(
    async function again(file: File, verb: "add" | "attach" = "add", parentId: string | null = null, rows: number | null = null, tile = false): Promise<BuildNode | null> {
      const decided = fileKindFor(file);
      if ("refused" in decided) {
        toast.error(decided.refused);
        return null;
      }
      if (file.size > MEDIA_MAX_BYTES) {
        toast.error(`${file.name}: ${Math.round(MEDIA_MAX_BYTES / (1024 * 1024))} MB max`);
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
        // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
        console.error("[Sandbox] file not added", cause);
        sayFailed(cause, `${file.name} not ${verb === "attach" ? "attached" : "added"}`, () => void again(file, verb, parentId, rows, tile));
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
      toast.error(`${file.name}: ${Math.round(MEDIA_MAX_BYTES / (1024 * 1024))} MB max`);
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
        // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
        console.error("[Sandbox] setup not added", cause);
        sayFailed(cause, "Setup item not added");
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
    function again(id: string): void {
      void nodes
        .run(async () => {
          const node = tree.find((candidate) => candidate.id === id);
          if (!node) return;
          const { children: _children, ...row } = node;
          nodes.record(id, await setNotShared(row, true));
        })
        .catch((cause) => {
          // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
          console.error("[Sandbox] not marked", cause);
          sayFailed(cause, "Item not kept private", () => again(id));
        });
    },
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
          // eslint-disable-next-line no-console -- a deliberate log, as before (SV-26)
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

  /* CA-14 P5: what the Add items do, shared by the Add button at the top and each session's "+ Add tile". */
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
    onAddFromLibrary,
    onWarmLibrary: warmLibrary,
  };
  /** Choosing a session for the next tile: at once, and a folded session is opened so the tile lands where it can be seen. */
  const aimAt = (key: string) => {
    setChosenSession(key);
    if (collapsedKeys.has(key)) onToggleCollapsed(key, false);
  };
  /* CA-14 P6: the session list, when it is on and there are two sessions to jump between. */
  const jumpItems = useMemo(() => jumpItemsOf(sourceSessionRows), [sourceSessionRows]);
  const headOf = useCallback((key: string) => document.querySelector<HTMLElement>(`[data-session-key="${key}"] [data-testid="session-head"]`), []);
  const inView = useCurrentSession(
    useMemo(() => jumpItems.map((item) => item.key), [jumpItems]),
    headOf,
    viewOptions.sessionList,
  );
  /**
   * SV-07 P3: a jump tab opens the session's part first when it is closed, then the scroll helper brings the head to 24 below the
   * sticky header, and the session is outlined once.
   */
  const onJump = (key: string) => {
    const part = partsModel?.partOf.get(key);
    if (part && storedWorkstreamsOf(made).some((entry) => entry.key === part && entry.collapsed)) flushSync(() => void onPartFold(part, false).catch(() => undefined));
    const head = headOf(key);
    if (!head) return;
    // Focus first: a keyboard focus asks the roving list to show the head ("nearest"), and the jump's scroll must have the last word.
    head.focus({ preventScroll: true });
    const run = scrollToShow(head, { align: "start", hold: true, offset: HEADER_HEIGHT + JUMP_GAP });
    void run.finished.then(() => {
      const session = head.closest<HTMLElement>("[data-session-key]");
      if (session) outlineOnce(session);
    });
  };
  const sessionList = viewOptions.sessionList && jumpItems.length >= 2 ? <SessionJump items={jumpItems} current={inView} phone={phone} onJump={onJump} /> : null;
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
    onRetrySessionPrompts: (key) => sessions.retryPrompts(key),
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
    if (write.kind === "tile" && write.session) return edits.onMoveTile(id, write.session, { order: write.atEnd, sentence, said, failed: "Tile not moved" });
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

  /* CA-27 P1: Find in build: what it reads is what the List is drawn from. */
  const findTargets = useMemo(() => findTargetsOf({ steps, dividers: dividerRows, emptySessions, parts: partsModel ? { parts: partsModel.list } : undefined }), [steps, dividerRows, emptySessions, partsModel]);
  const isFolded = useCallback((key: string) => collapsedKeys.has(key) || Boolean(partsModel?.list.find((part) => part.view.key === key)?.view.collapsed), [collapsedKeys, partsModel]);
  const find = useBuildFind({ targets: findTargets, isFolded, enabled: !phone && lens === "list" });

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
    openFind: find.show,
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

  /* The Add a session row's props, shared by the List's row and the empty build's "Import from connected chats". */
  const addSessionProps = {
    library: libraryRows,
    hasMore: sessions.libraryHasMore,
    loadingMore: sessions.libraryLoadingMore,
    onMore: sessions.libraryMore,
    adding: adding.size > 0 || startingSession,
    onAdd: (importId: string, part?: string) => void stepOf.session(importId, part),
    onStartNew: (part?: string) => void stepOf.startSession(part),
    parts: addToParts,
  };
  /* CA-24 P2: no sessions and no tiles (a new post's default Session 1 doesn't count): "Add your first session" stands in place
     of the list. Add › Prompt chooses to write one, so it brings the first session's prompt box back. */
  const stillEmpty = steps.length === 0 && shown.length === 0 && emptySessions.every((row) => row.key === FIRST_SESSION_KEY) && promptSession === null && !pendingAdd && !arriving && !ringed;
  /* Once the maker has started the build, the panel does not come back in between (a tile that is written but not read yet is not an empty build). */
  const leftEmpty = useRef(false);
  if (!stillEmpty) leftEmpty.current = true;
  const emptyBuildShown = stillEmpty && !leftEmpty.current;
  /* CA-24 P3: what each panel's own queries say. Retry reads that panel's queries again and no others. Sources and the post draw their own
     failure (their read is theirs); the build's sessions and Details' prompts are read here. The map reads nothing. */
  const detailsFailed = view?.kind === "session" && view.status === "error" ? view.key : null;
  const panels: Partial<Record<PanelName, PanelState>> = {
    Build: { failed: sessions.buildFailed, error: sessions.buildError, onRetry: sessions.retryBuild },
    Details: { failed: detailsFailed !== null, onRetry: () => (detailsFailed ? sessions.retryPrompts(detailsFailed) : undefined) },
  };
  const emptyBuildProps = emptyBuildShown
    ? { phone, fine, available: libraryRows.filter((row) => !row.inThisDraft).length, addSession: addSessionProps, onDropFiles: (files: File[], paths?: string[]) => void stepOf.dropped(files, paths), onPick: pick }
    : null;

  return (
    <MotionChannelContext.Provider value={motion}>
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
        noticeRoom={buildHistory.notice ? NOTICE_ROOM : undefined}
        classification={classification}
        saveProblem={compose.saveFailure}
        loadError={compose.loadError ?? undefined}
        save={mergeSave(viewProps.save, thread.save, writesFailed ? "error" : "idle", offline ? "offline" : "idle")}
        pendingWrites={pending}
        strips={strips}
        lastSavedAt={latestOf(viewProps.lastSavedAt, thread.lastSavedAt)}
        onRetrySave={onRetrySave}
        onPublish={onPublish}
        onUnpublish={unpublish}
        publishedAt={build?.published_at}
        publish={{ checklist, prepare: preparePublish, confirm: confirmInput, onShowApps: showApps }}
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
        find={phone ? undefined : find}
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
        panels={panels}
        emptyBuild={emptyBuildProps}
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
            onAddFromLibrary={onAddFromLibraryTo}
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
            sessionOps={{ onTitle: edits.onTitle, onMove: edits.onMove, onRemove: (key) => actions.askRemoveSessions([key]), onMergeUp: edits.onMergeUp, onMoveToPart: partsModel ? edits.onMoveToPart : undefined, onWithAbove: partsModel ? edits.onWithAbove : undefined, onRetryImport: (key) => void onRetryImport(key), onOpen: edits.onSessionOpen }}
            onDropSession={edits.onDrop}
            parts={
              partsModel
                ? {
                    parts: partsModel.list,
                    withAbove: partsModel.withAbove,
                    onToggle: (key, closed) => void onPartFold(key, closed),
                    onColour: (key, anchor, what, colour) => onColour(refTo({ kind: "workstream", id: key }), anchor, what, colour),
                    ops: { onName: edits.onPartName, onMove: edits.onPartMove, onRemove: edits.onPartRemove, onStartsAfter: edits.onPartStartsAfter, onOpen: edits.onPartOpen },
                  }
                : undefined
            }
            onDropOnWorkstream={partsModel ? edits.onDropOnPart : undefined}
            onDropWorkstream={partsModel ? edits.onDropPart : undefined}
            onAddPart={buildId ? () => void edits.onAddPart() : undefined}
            addingPart={shownParts !== null}
            onSplitHere={edits.onSplitHere}
            promptIn={promptSession}
            said={sessionSaid}
                onAddAsAgent={onAddAsAgent}
            onKeepAsCode={onKeepAsCode}
            inBuild={inBuild}
            addPromptRef={addPromptField}
            addPromptFlash={addPromptFlash}
            pendingAdd={pendingAdd}
            ringedId={ringed?.id ?? inserted?.id ?? null}
            addSession={addSessionProps}
            collapsed={collapsedKeys}
            onToggleCollapsed={onToggleCollapsed}
            find={find.open ? { view: find.view, forced: find.forced, release: find.release } : undefined}
            ringedSession={ringedSession}
            arriving={arriving}
            onArrived={(key, status) => {
              setArriving((current) => (current && current.key === key ? null : current));
              if (status === "written" && arriving && arriving.key === key) setSessionSaid(arriving.count > 0 ? `Added Session ${arriving.head.number} with ${arriving.count} ${arriving.count === 1 ? "prompt" : "prompts"}.` : `Added Session ${arriving.head.number}.`);
              if (status === "failed") setSessionSaid(arriving?.kind === "empty" ? "Session not made" : "Session not added");
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
            error={sessions.libraryError}
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
            lastPart={lastPart}
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
      />
      </DetailsReferencesProvider>
      </GroupLabelsProvider>
      </PartRegistryProvider>
      {library ? (
        <Suspense fallback={null}>
          <AddFromLibrary
            open={library.open}
            place={library.place}
            phone={phone}
            onClose={() => setLibrary((current) => (current ? { ...current, open: false } : null))}
            onInsert={(items, place) => void onInsertFromLibrary(items, place)}
          />
        </Suspense>
      ) : null}
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
        prompts={flatten(steps).filter((step) => step.kind === "prompt" && !step.summary && !step.id.endsWith(":instructions")).map((step) => ({ id: step.id, label: `${step.number} · ${step.title ?? step.defaultTitle}` }))}
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
    </MotionChannelContext.Provider>
  );
}

/** CA-13 rule 4: the Code tiles of a build, for "Called from" and "Read from a Code tile". */
export const codeTilesOf = (steps: readonly Step[]): { id: string; label: string; source: string }[] =>
  steps.flatMap((step) => (step.kind === "code" ? [{ id: step.id, label: step.filename ?? step.title ?? step.defaultTitle, source: step.text }] : []));

/** CA-13 P2: the steps a decision can read the output of. */
export const stepChoicesOf = (steps: readonly Step[]): { id: string; label: string }[] =>
  steps.filter((step) => step.kind !== "decision").map((step) => ({ id: step.id, label: `${step.number} · ${step.title ?? step.defaultTitle}` }));

export default SandboxPage;
