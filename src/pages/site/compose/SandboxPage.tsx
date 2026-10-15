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
import { useFinePointer, useIsPhone } from "@/components/shell/useMinWidth";
import { composeBuildQueryKey } from "@/hooks/useComposeBuild";
import { addFile, buildSteps, FILE_TYPE, RESULT_TYPE, sessionGroups, TOOL_TYPE, usesOf, type Step } from "@/lib/build/graph";
import type { MakingSession } from "@/lib/build/making";
import { getMediaById, MEDIA_MAX_BYTES, mediaKindFor, signedMediaUrl, uploadMedia } from "@/lib/build/media";
import { attachSession } from "@/lib/build/sessions";
import { getNodeType } from "@/lib/build/nodeTypes";
import { useLook } from "@/lib/theme/look";

import { PUBLISH_WORDS } from "./composeModel";
import { useComposePage } from "./ComposePage";
import { SandboxView, type SandboxCounts, type SandboxLens } from "./SandboxView";
import { AddManualStepDialog, type AddManualStepInput } from "./AddManualStepDialog";
import { AddAgentDialog, DEFAULT_AGENT_MODEL, type AddAgentInput } from "./AddAgentDialog";
import { BuildList } from "./BuildList";
import { dividers, suggestionKey, type ListResult, type ListSuggestion } from "./buildListModel";
import { FullPromptWindow } from "@/components/build/FullPromptWindow";
import { BuildMap } from "./BuildMap";
import { DetailsPanel } from "./DetailsPanel";
import { pieces, resolveView, type MediaFacts } from "./detailsView";
import type { MapResult, MapSuggestion } from "@/lib/build/mapLayout";
import { suggestUses } from "@/lib/build/suggest";
import { SourcesPanel } from "./SourcesPanel";
import { RefinedBuildList } from "./RefinedBuildList";
import { RefinedDetailsPanel } from "./RefinedDetailsPanel";
import { RefinedSandboxView } from "./RefinedSandboxView";
import { RefinedSourcesPanel } from "./RefinedSourcesPanel";
import { isSessionExport, librarySources, sourceFiles, sourceSessions } from "./sourcesModel";
import { librarySessionsKey } from "@/hooks/useLibrarySessions";

/** builds.making.sessions, read defensively: it is a json column. */
function makingSessions(making: unknown): MakingSession[] {
  const list = (making as { sessions?: unknown } | null)?.sessions;
  return Array.isArray(list) ? (list as MakingSession[]) : [];
}

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children)]);

export function SandboxPage() {
  const { viewProps, missing, build, tree, ensureBuild, nodes, sessions, prompts } = useComposePage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const phone = useIsPhone();
  const fine = useFinePointer();
  /* UI-P93: the refined look renders the forks of the frame and its List, Sources and Details, with the same props. */
  const refined = useLook() === "refined";
  const View = refined ? RefinedSandboxView : SandboxView;
  const List = refined ? RefinedBuildList : BuildList;
  const Details = refined ? RefinedDetailsPanel : DetailsPanel;
  const Sources = refined ? RefinedSourcesPanel : SourcesPanel;

  const [lens, setLens] = useState<SandboxLens>("list");
  const [switched, setSwitched] = useState(false);
  const onLens = useCallback((next: SandboxLens) => {
    setLens(next);
    setSwitched(true);
  }, []);

  const made = (build as { making?: unknown } | null)?.making;
  const { counts, hasAgent, sessionCount, steps, groups } = useMemo(() => {
    const steps = buildSteps(tree);
    const groups = sessionGroups(steps, makingSessions(made));
    const all = flatten(steps);
    const next: SandboxCounts = {
      sessions: groups.length,
      prompts: all.filter((step) => step.kind === "prompt").length,
      files: tree.filter((node) => node.type === FILE_TYPE).length,
    };
    return { counts: next, hasAgent: all.some((step) => step.kind === "agent" || step.kind === "team"), sessionCount: groups.length, steps, groups };
  }, [tree, made]);

  const mapAvailable = sessionCount >= 2 || hasAgent;

  /* ── agents and teams (UI-P69) ── */

  const teamType = useQuery({ queryKey: ["build", "getNodeType", "team"], queryFn: () => getNodeType("team"), staleTime: Infinity });
  const teamsAvailable = Boolean(teamType.data?.is_active);
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  const [addManualOpen, setAddManualOpen] = useState(false);
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
  // UI-P71: exact facts only — a file named word for word in a prompt.
  const suggestions: ListSuggestion[] = useMemo(
    () =>
      suggestUses(
        steps,
        Object.entries(listFacts.names)
          .filter(([id]) => tree.some((node) => node.id === id && node.type === FILE_TYPE))
          .map(([id, name]) => ({ id, name })),
      ).map((suggestion) => ({ ...suggestion, label: listFacts.names[suggestion.use.node_id] ?? "File" })),
    [steps, tree, listFacts.names],
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
  /** UI-P67: the prompt open in the full prompt window. */
  const [openPromptId, setOpenPromptId] = useState<string | null>(null);
  const [adding, setAdding] = useState<ReadonlySet<string>>(new Set());
  const picker = useRef<HTMLInputElement>(null);
  const pick = useCallback(() => picker.current?.click(), []);

  const sourceSessionRows = useMemo(() => sourceSessions(groups, steps, sessions.sessions), [groups, steps, sessions.sessions]);
  const sourceFileRows = useMemo(() => sourceFiles(tree, groups), [tree, groups]);
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
      const id = await prompts.addAgentOrTeam(input);
      if (!id) return;
      setSelectedId(id);
      afterWrite();
    },
    [prompts, afterWrite],
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

  const onAddAgentPrompt = useCallback(
    async (agentId: string, text: string) => {
      const saved = await prompts.addPromptTo(agentId, text);
      if (saved) afterWrite();
      return saved;
    },
    [prompts, afterWrite],
  );

  const addPiece = useCallback(
    async (kind: "tool" | "result") => {
      const id = await prompts.addPiece(kind);
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
    async (file: File) => {
      if (!mediaKindFor(file.type)) {
        toast.error(`${file.name} is not a kind of file that can be added.`);
        return;
      }
      if (file.size > MEDIA_MAX_BYTES) {
        toast.error(`${file.name} is too big. The limit is ${Math.round(MEDIA_MAX_BYTES / (1024 * 1024))} MB.`);
        return;
      }
      try {
        const id = await ensureBuild();
        await nodes.run(async () => {
          const media = await uploadMedia({ buildId: id, file });
          const node = await addFile(id, nodes.current(), { title: file.name, media_id: media.id });
          nodes.record(node.id, node);
        });
        await queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(id) });
      } catch (cause) {
        console.error("[Sandbox] file not added", cause);
        toast.error(`Couldn't add ${file.name}. Try again.`);
      }
    },
    [ensureBuild, nodes, queryClient],
  );

  /** A drop sorts its files: a session export goes to the intake, the rest are files of the build. */
  const onDropFiles = useCallback(
    (files: File[]) => {
      if (files.some(isSessionExport)) {
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
          if (files.length > 0) onPicked(files);
        }}
      />
      <View
        {...viewProps}
        onAddFile={pick}
        onAddPromptFocus={onAddPromptFocus}
        onAddTool={() => void addPiece("tool")}
        onAddResult={() => void addPiece("result")}
        onAddAgent={() => setAddAgentOpen(true)}
        onAddManual={() => setAddManualOpen(true)}
        trail={trailSteps.map((step) => ({ id: step.id, title: step.title ?? step.defaultTitle }))}
        onTrail={onTrail}
        map={
          <BuildMap
            steps={steps}
            groups={groups}
            files={mapPieces.files}
            tools={mapPieces.tools}
            results={mapResults}
            suggestions={mapSuggestions}
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
          <Details
            phone={phone}
            view={view}
            onSelect={setSelectedId}
            onOpenPrompt={setOpenPromptId}
            onRename={prompts.rename}
            onModel={prompts.setModel}
            onAddUse={(id, use) => {
              prompts.accept(id, use, steps);
              afterWrite();
            }}
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
            onDownload={(id) => void download(id)}
            onFields={prompts.setFields}
            onAddPicture={(id, file) => void addPicture(id, file)}
            onUseAsCover={(mediaId) => void setAsCover(mediaId)}
          />
        }
        list={
          <List
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
            onAccept={(suggestion) => prompts.accept(suggestion.stepId, suggestion.use, steps)}
            onDismiss={(suggestion) => prompts.dismiss(suggestion.stepId, suggestionKey(suggestion.use))}
            onAddPrompt={prompts.addNow}
            focusAdd={focusAdd}
          />
        }
        addableSessions={libraryRows.filter((row) => !row.adding)}
        onAddSession={(id) => void onAddSession(id)}
        sources={
          <Sources
            phone={phone}
            fine={fine}
            status={sessions.status}
            onRetry={sessions.retry}
            sessions={sourceSessionRows}
            files={sourceFileRows}
            library={libraryRows}
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
        onOpenChange={setAddAgentOpen}
        nextNumber={steps.length + 1}
        teamsAvailable={teamsAvailable}
        onAdd={(input) => void onAddAgentOrTeam(input)}
      />
      <AddManualStepDialog
        open={addManualOpen}
        onOpenChange={setAddManualOpen}
        after={afterStep ? `${afterStep.number} · ${afterStep.title ?? afterStep.defaultTitle}` : null}
        available={manualAvailable}
        onAdd={(input) => void onAddManual(input)}
      />
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
