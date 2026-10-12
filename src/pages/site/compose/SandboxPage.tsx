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

   Mounted by `ComposeRoute` only while SANDBOX_COMPOSER_ENABLED is on. */

import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { SeoHead } from "@/components/SeoHead";
import { useFinePointer, useIsPhone } from "@/components/shell/useMinWidth";
import { composeBuildQueryKey } from "@/hooks/useComposeBuild";
import { addFile, buildSteps, FILE_TYPE, sessionGroups, type Step } from "@/lib/build/graph";
import type { MakingSession } from "@/lib/build/making";
import { MEDIA_MAX_BYTES, mediaKindFor, uploadMedia } from "@/lib/build/media";
import { attachSession } from "@/lib/build/sessions";

import { PUBLISH_WORDS } from "./composeModel";
import { useComposePage } from "./ComposePage";
import { SandboxView, type SandboxCounts, type SandboxLens } from "./SandboxView";
import { SourcesPanel } from "./SourcesPanel";
import { isSessionExport, librarySources, sourceFiles, sourceSessions } from "./sourcesModel";
import { librarySessionsKey } from "@/hooks/useLibrarySessions";

/** builds.making.sessions, read defensively: it is a json column. */
function makingSessions(making: unknown): MakingSession[] {
  const list = (making as { sessions?: unknown } | null)?.sessions;
  return Array.isArray(list) ? (list as MakingSession[]) : [];
}

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children)]);

export function SandboxPage() {
  const { viewProps, missing, build, tree, ensureBuild, nodes, sessions } = useComposePage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const phone = useIsPhone();
  const fine = useFinePointer();

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

  /* ── Sources ── */

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState<ReadonlySet<string>>(new Set());
  const picker = useRef<HTMLInputElement>(null);
  const pick = useCallback(() => picker.current?.click(), []);

  const sourceSessionRows = useMemo(() => sourceSessions(groups, steps, sessions.sessions), [groups, steps, sessions.sessions]);
  const sourceFileRows = useMemo(() => sourceFiles(tree, groups), [tree, groups]);
  const libraryRows = useMemo(() => librarySources(sessions.library, adding, Date.now()), [sessions.library, adding]);

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
      <SeoHead title="Compose — buildgallery" description="Write your build." path="/compose" noIndex />
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
      <SandboxView
        {...viewProps}
        onAddFile={pick}
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
    </>
  );
}

export default SandboxPage;
