/* UI-P63 — /compose in the new composer: the container.

   It makes no write of its own beyond Sources'. `useComposePage` (beside
   `ComposePage`) holds every field, the first-change-makes-the-draft rule, the
   debounced save, the cover and Publish, and this file hands the same values to
   `SandboxView`, so the Card writes exactly what the old composer did.

   What it adds is what the frame shows: the counts in the Build panel's head,
   whether Map is available yet (CONCEPT §5: two sessions or an agent), and
   which view is chosen. Everything here is read from the build already
   loaded; the steps are `buildSteps(tree)`.

   UI-P64 — SOURCES. The rows are worked out in `sourcesModel` from the steps,
   the build's sessions and the creator's library. Two things are written here:
   a session joins the build (`useComposeSessions.addSession`, on the Made with
   queue), and a dropped or chosen file becomes a file of the build
   (`uploadMedia`, then `addFile` on the node queue, as a prompt is written).
   A .json or .zip is a session export, which the intake reads, so it is not
   uploaded; the panel says where to read it.

   Mounted by `ComposeRoute` only while SANDBOX_COMPOSER_ENABLED is on. */

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { SeoHead } from "@/components/SeoHead";
import { addFile, buildSteps, sessionGroups, type Step } from "@/lib/build/graph";
import type { MakingSession } from "@/lib/build/making";
import { deleteMedia, uploadMedia } from "@/lib/build/media";

import { PUBLISH_WORDS } from "./composeModel";
import { useComposePage } from "./ComposePage";
import { SandboxView, type SandboxCounts, type SandboxLens } from "./SandboxView";
import { SourcesPanel, type SourcesSelection } from "./SourcesPanel";
import { fileForUpload, fileProblem, filesInBuild, isSessionExport, notInBuild, sessionsInBuild } from "./sourcesModel";

/** builds.making.sessions, read defensively: it is a json column. */
function makingSessions(making: unknown): MakingSession[] {
  const list = (making as { sessions?: unknown } | null)?.sessions;
  return Array.isArray(list) ? (list as MakingSession[]) : [];
}

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children)]);

export function SandboxPage() {
  const { viewProps, missing, build, nodes, sessions, ensureBuild } = useComposePage();
  const tree = nodes.tree;

  const [lens, setLens] = useState<SandboxLens>("list");
  const [switched, setSwitched] = useState(false);
  const onLens = useCallback((next: SandboxLens) => {
    setLens(next);
    setSwitched(true);
  }, []);

  const [selected, setSelected] = useState<SourcesSelection | null>(null);
  const [intakeNote, setIntakeNote] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const made = (build as { making?: unknown } | null)?.making;
  const steps = useMemo(() => buildSteps(tree), [tree]);
  const groups = useMemo(() => sessionGroups(steps, makingSessions(made)), [steps, made]);
  const sourceSessions = useMemo(
    () => sessionsInBuild({ steps, groups, attached: sessions.sessions, library: sessions.library }),
    [steps, groups, sessions.sessions, sessions.library],
  );
  const sourceFiles = useMemo(() => filesInBuild(tree, steps, groups), [tree, steps, groups]);
  const libraryRows = useMemo(() => notInBuild(sessions.library), [sessions.library]);

  const { counts, hasAgent } = useMemo(() => {
    const all = flatten(steps);
    const next: SandboxCounts = {
      sessions: sourceSessions.length,
      prompts: all.filter((step) => step.kind === "prompt").length,
      files: sourceFiles.length,
    };
    return { counts: next, hasAgent: all.some((step) => step.kind === "agent" || step.kind === "team") };
  }, [steps, sourceSessions, sourceFiles]);

  const mapAvailable = counts.sessions >= 2 || hasAgent;

  const addSession = useCallback((sessionId: string) => void sessions.addSession(sessionId), [sessions]);

  /** Files dropped on Sources or chosen in the picker: files of the build, in order, one at a time. */
  const addFiles = useCallback(
    async (dropped: File[]) => {
      setIntakeNote(dropped.some(isSessionExport));
      const files = dropped.filter((file) => !isSessionExport(file));
      const accepted: File[] = [];
      for (const file of files) {
        const problem = fileProblem(file);
        if (problem) toast.error(problem);
        else accepted.push(file);
      }
      if (accepted.length === 0) return;

      let buildId: string;
      try {
        buildId = await ensureBuild();
      } catch {
        return; // ensureBuild has already said so.
      }
      for (const file of accepted) {
        let mediaId: string | null = null;
        try {
          const media = await uploadMedia({ buildId, file: fileForUpload(file) });
          mediaId = media.id;
          await nodes.run(async () => {
            const node = await addFile(buildId, nodes.current(), { title: file.name, media_id: media.id });
            nodes.record(node.id, node);
          });
        } catch (cause) {
          console.error("[Compose] file not added", cause);
          // The row is what the build sees; an upload with no file node is tidied away.
          if (mediaId) await deleteMedia(mediaId).catch(() => undefined);
          toast.error(`${file.name} didn't add. Try again.`);
        }
      }
    },
    [ensureBuild, nodes],
  );

  const openPicker = useCallback(() => picker.current?.click(), []);

  const sourcesPanel = (
    <SourcesPanel
      sessions={sourceSessions}
      files={sourceFiles}
      library={libraryRows}
      libraryStatus={sessions.status}
      onRetryLibrary={sessions.retry}
      selected={selected}
      onSelect={setSelected}
      onAttachSession={addSession}
      onFiles={(files) => void addFiles(files)}
      onPickFiles={openPicker}
      intakeNote={intakeNote}
    />
  );

  return (
    <>
      <SeoHead title="Compose — buildgallery" description="Write your build." path="/compose" noIndex />
      <input
        ref={picker}
        type="file"
        multiple
        hidden
        aria-label="Add files"
        data-testid="sources-file-input"
        onChange={(event) => {
          const chosen = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (chosen.length > 0) void addFiles(chosen);
        }}
      />
      <SandboxView
        {...viewProps}
        missing={missing.map((key) => ({ key, label: PUBLISH_WORDS[key] }))}
        counts={counts}
        lens={lens}
        onLens={onLens}
        mapAvailable={mapAvailable}
        mapHint={mapAvailable && !switched}
        sources={sourcesPanel}
        addSession={{ rows: libraryRows, onAttach: addSession }}
        onAddFile={openPicker}
      />
    </>
  );
}

export default SandboxPage;
