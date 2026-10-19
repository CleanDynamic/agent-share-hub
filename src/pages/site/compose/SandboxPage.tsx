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
import { addFile, buildSteps, canCheck, FILE_TYPE, madeFileNamesOf, madeFilesOf, RESULT_TYPE, sessionGroups, testedStepOf, TOOL_TYPE, usesOf, type Step } from "@/lib/build/graph";
import { sessionToolsOf, type MakingSession } from "@/lib/build/making";
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
    const groups = sessionGroups(steps, makingSessions(made), sessionToolsOf(made));
    const all = flatten(steps);
    const next: SandboxCounts = {
      sessions: groups.length,
      prompts: all.filter((step) => step.kind === "prompt").length,
      files: tree.filter((node) => node.type === FILE_TYPE).length,
    };
    return { counts: next, hasAgent: all.some((step) => step.kind === "agent" || step.kind === "team"), sessionCount: groups.length, steps, groups };
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
          .filter(([id]) => tree.some((node) => node.id === id && node.type === FILE_TYPE))
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
  const dividerRows = useMemo(() => dividers(steps, groups), [steps, groups]);

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

  const sourceSessionRows = useMemo(() => sourceSessions(groups, steps, sessions.sessions, sessionTools), [groups, steps, sessions.sessions, sessionTools]);
  const sourceFileRows = useMemo(() => sourceFiles(tree, groups, steps), [tree, groups, steps]);
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

  const onAddAgentOrTeam = useCallback(
    async (input: AddAgentInput) => {
      savingSeed.current = true;
      const id = await prompts.addAgentOrTeam(input).finally(() => {
        savingSeed.current = false;
      });
      settleSeed(Boolean(id));
      if (!id) return;
      setSelectedId(id);
      afterWrite();
    },
    [prompts, afterWrite, settleSeed],
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
      const id = await prompts.addManual({ ...input, afterId: afterStep?.id ?? null });
      if (!id) return;
      setSelectedId(id);
      afterWrite();
    },
    [prompts, afterStep, afterWrite],
  );

  const onAddCheck = useCallback(
    async (input: AddCheckInput) => {
      // A check uses the step it tested: the selected one, else the last agent, team or code.
      const id = await prompts.addCheckStep({ ...input, testedStep: testedStepOf(steps, afterStep?.id ?? null) });
      if (!id) return;
      setSelectedId(id);
      afterWrite();
    },
    [prompts, steps, afterStep, afterWrite],
  );

  const onAddCode = useCallback(
    async (input: AddCodeInput) => {
      savingCode.current = true;
      const id = await prompts.addCodeSteps(input).finally(() => {
        savingCode.current = false;
      });
      settleCode(Boolean(id));
      if (id) setSelectedId(id);
    },
    [prompts, settleCode],
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

  /** One file of the build: stored through the media path, then recorded as a file node, behind the other node writes. */
  const addOneFile = useCallback(
    async (file: File, verb: "add" | "attach" = "add"): Promise<BuildNode | null> => {
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
          const node = await addFile(id, nodes.current(), { title: file.name, media_id: media.id });
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

  /** A drop on a prompt's card: a chat export goes to the intake and nothing is attached. */
  const onDropOnStep = useCallback(
    async (stepId: string, files: File[]) => {
      if ((await Promise.all(files.map(isChatExport))).some(Boolean)) {
        navigate("/compose/start");
        return;
      }
      await attach(stepId, files);
    },
    [attach, navigate],
  );

  /** A drop sorts its files: a chat export goes to the intake, the rest are files of the build. */
  const onDropFiles = useCallback(
    async (files: File[]) => {
      if ((await Promise.all(files.map(isChatExport))).some(Boolean)) {
        navigate("/compose/start");
        return;
      }
      for (const file of files) void addOneFile(file);
    },
    [addOneFile, navigate],
  );

  /** The picker is an explicit choice of files, so nothing is taken for an export. */
  const onPicked = useCallback(
    (files: File[]) => {
      for (const file of files) void addOneFile(file);
    },
    [addOneFile],
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
          pickFor.current = null;
          if (files.length === 0) return;
          if (stepId) void attach(stepId, files);
          else onPicked(files);
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
            onDownload={(id) => void download(id)}
            onFields={prompts.setFields}
            onAddPicture={(id, file) => void addPicture(id, file)}
            onUseAsCover={(mediaId) => void setAsCover(mediaId)}
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
            fine={fine}
            onAccept={(suggestion) => prompts.accept(suggestion.stepId, suggestion.use, steps)}
            onDismiss={(suggestion) => prompts.dismiss(suggestion.stepId, suggestionKey(suggestion.use))}
            onAddPrompt={prompts.addNow}
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
