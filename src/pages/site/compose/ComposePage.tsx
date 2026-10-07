/* UI-P47 / UI-P48 — /compose/new and /compose/:buildId in the site frame: the
   container.

   NO DRAFT IS CREATED BY OPENING THE PAGE. On /compose/new nothing is written
   until the first change (a title, a description, a picture, a prompt's first
   words, a session, a detail), which creates the build with what has been typed
   and replaces the URL with /compose/{id}. What is typed between the request
   and the record loading is held and written through `patchBuild` once it has.

   EVERY HEADER WRITE GOES THROUGH `useComposeBuild`: `patchBuild` debounces at
   800ms and keeps `completeness` current, and `publish()` carries unsaved edits
   in one write. `publishBuild` is never called here, because a debounced save
   may be in flight.

   THE COVER IS THE BUILD'S EVIDENCE TOO, and its writes live in
   `src/lib/build/composeCover.ts` (the post's media set, then a placed node).

   UI-P48's parts are run by four hooks beside this file: `useComposeNodes`
   (one queue for every node the composer writes, and the overlay that keeps
   them on screen), `useComposePrompts`, `useComposeDetails` and
   `useComposeSessions` (Your sessions and Made with). Publish writes whatever
   they still hold first. This file makes no Supabase call. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { SeoHead } from "@/components/SeoHead";
import { useMediaSrc } from "@/components/build/MediaFigure";
import { useCrumbTitle } from "@/components/shell/useBreadcrumb";
import { useComposeBuild, composeBuildQueryKey } from "@/hooks/useComposeBuild";
import { computeCompleteness, createBuild, galleryShortfall, getGalleryFacets, inGallery, MEDIA_MAX_BYTES, mediaKindFor, acceptedMediaTypes } from "@/lib/build";
import type { BuildMedia, BuildPatch } from "@/lib/build";
import {
  addComposerCover,
  coverMediaTypes,
  getComposerCover,
  removeComposerCover,
  replaceComposerCover,
} from "@/lib/build/composeCover";
import { refreshMakingStats } from "@/lib/build/making";
import { modelLabel } from "@/lib/models/registry";
import { sessionDate, sessionSource } from "@/pages/site/drafts/draftsModel";

import { ComposeView, type ComposeSession, type ComposeStatus } from "./ComposeView";
import {
  isUntitled,
  madeWithChips,
  missingForPublish,
  parseAudience,
  PUBLISH_WORDS,
  publishToast,
  saveState,
  sessionMetaLine,
  UNTITLED,
} from "./composeModel";
import { useComposeDetails } from "./useComposeDetails";
import { useComposeNodes } from "./useComposeNodes";
import { useComposePrompts } from "./useComposePrompts";
import { useComposeSessions } from "./useComposeSessions";

const coverKey = (buildId: string | undefined) => ["build", "getComposerCover", buildId] as const;

const ACCEPT = coverMediaTypes(acceptedMediaTypes());

export function ComposePage() {
  const { buildId } = useParams<{ buildId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const compose = useComposeBuild(buildId);
  const { build } = compose;

  /* ── what is typed ── */

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState("");
  const form = useRef({ title: "", description: "", audience: "" });

  /** The build id whose fields the inputs already show. Null until one has been read or made here. */
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!build || hydratedFor.current === build.id) return;
    hydratedFor.current = build.id;
    const next = {
      title: isUntitled(build.title) ? "" : build.title,
      description: build.outcome ?? "",
      audience: (build.made_for ?? []).join(", "),
    };
    form.current = next;
    setTitle(next.title);
    setDescription(next.description);
    setAudience(next.audience);
  }, [build]);

  /* ── the first change makes the draft ── */

  const creating = useRef<Promise<string> | null>(null);
  /** Edits made before the record could take them. */
  const held = useRef<BuildPatch>({});
  const [createdHere, setCreatedHere] = useState(false);

  const ensureBuild = useCallback((): Promise<string> => {
    if (buildId) return Promise.resolve(buildId);
    if (!creating.current) {
      const { title: typed, description: said, audience: forWho } = form.current;
      creating.current = createBuild({
        title: typed.trim() || UNTITLED,
        outcome: said.trim() ? said : null,
        made_for: parseAudience(forWho),
      })
        .then((created) => {
          hydratedFor.current = created.id;
          setCreatedHere(true);
          // replace: /compose/new must not sit in history, or Back re-enters it and starts a second draft.
          navigate(`/compose/${created.id}`, { replace: true });
          return created.id;
        })
        .catch((cause: unknown) => {
          creating.current = null;
          console.error("[Compose] createBuild failed", cause);
          toast.error("Couldn't start your draft. Try again.");
          throw cause;
        });
    }
    return creating.current;
  }, [buildId, navigate]);

  const edit = useCallback(
    (patch: BuildPatch) => {
      if (buildId && compose.isOwner) {
        compose.patchBuild(patch);
        return;
      }
      held.current = { ...held.current, ...patch };
      ensureBuild().catch(() => undefined);
    },
    [buildId, compose, ensureBuild],
  );

  useEffect(() => {
    if (!compose.isOwner || Object.keys(held.current).length === 0) return;
    const patch = held.current;
    held.current = {};
    compose.patchBuild(patch);
  }, [compose, compose.isOwner]);

  const onTitle = (value: string) => {
    form.current.title = value;
    setTitle(value);
    edit({ title: value.trim() || UNTITLED });
  };
  const onDescription = (value: string) => {
    form.current.description = value;
    setDescription(value);
    edit({ outcome: value.trim() ? value : null });
  };
  const onAudience = (value: string) => {
    form.current.audience = value;
    setAudience(value);
    edit({ made_for: parseAudience(value) });
  };

  useCrumbTitle(title.trim() || UNTITLED);

  /* ── the cover ── */

  const coverQuery = useQuery<BuildMedia | null>({
    queryKey: coverKey(buildId),
    queryFn: () => getComposerCover(buildId as string),
    enabled: Boolean(buildId) && compose.isOwner,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const coverMedia = coverQuery.data ?? null;
  const coverUrl = useMediaSrc(coverMedia, 1200);

  const [adding, setAdding] = useState<number | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const onFiles = async (files: File[]) => {
    const file = files[0];
    if (!file || adding !== null) return;
    const kind = mediaKindFor(file.type);
    if (kind !== "image" && kind !== "video") {
      setMediaError("Add an image or a short video.");
      return;
    }
    if (file.size > MEDIA_MAX_BYTES) {
      setMediaError(`That file is too big. The limit is ${Math.round(MEDIA_MAX_BYTES / (1024 * 1024))} MB.`);
      return;
    }
    setMediaError(null);
    setAdding(0);
    try {
      const id = await ensureBuild();
      const onProgress = (fraction: number) => setAdding(fraction);
      const media = coverMedia
        ? await replaceComposerCover({ buildId: id, file, onProgress, current: coverMedia })
        : await addComposerCover({ buildId: id, file, onProgress });
      queryClient.setQueryData(coverKey(id), media);
      await queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(id) });
    } catch (cause) {
      console.error("[Compose] cover failed", cause);
      setMediaError("That didn't add. Try again.");
    } finally {
      setAdding(null);
    }
  };

  const onRemoveCover = async () => {
    if (!buildId || !coverMedia) return;
    try {
      await removeComposerCover(buildId, coverMedia);
      queryClient.setQueryData(coverKey(buildId), null);
      await queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(buildId) });
    } catch (cause) {
      console.error("[Compose] cover removal failed", cause);
      setMediaError("That didn't remove. Try again.");
    }
  };

  /* ── UI-P48: prompts, sessions, made with, more details ── */

  const nodes = useComposeNodes(buildId, compose.tree);
  const sessions = useComposeSessions({
    buildId,
    owner: compose.isOwner,
    ensureBuild,
    recordMadeWith: build?.made_with ?? [],
  });
  const prompts = useComposePrompts({
    buildId,
    nodes,
    ensureBuild,
    sessions: sessions.sessions,
    sessionPrompts: sessions.promptsOf,
  });
  const details = useComposeDetails({ build, hydrate: !createdHere, nodes, ensureBuild, edit });

  const now = Date.now();
  const sessionViews: ComposeSession[] = sessions.sessions.map((session, index) => {
    const { prompts: read, error } = sessions.promptsState(session.id);
    return {
      id: session.id,
      number: index + 1,
      label: sessionSource(session),
      modelKnown: session.modelName !== null,
      date: sessionDate(session.createdAt, now),
      prompts: read
        ? read.map((prompt) => ({ ordinal: prompt.ordinal, text: prompt.text, added: prompts.isAdded(session.id, prompt.sourceRef.index) }))
        : null,
      promptsError: error,
    };
  });
  const otherSessions =
    sessions.others?.map((session) => ({
      id: session.id,
      firstPrompt: session.firstPrompt ?? "Untitled session",
      meta: sessionMetaLine(session, now),
    })) ?? null;
  const madeWith = madeWithChips(sessions.sessions, sessions.madeWith);

  /* ── publish ── */

  const missing = useMemo(() => missingForPublish({ title, completeness: compose.completeness }), [title, compose.completeness]);

  const onPublish = async () => {
    // What is still waiting to be written goes first, and is counted.
    await Promise.all([prompts.flush(), details.flush()]);
    const counted = compose.build ? computeCompleteness(compose.build, nodes.current(), compose.nodeTypes) : null;
    const needed = missingForPublish({ title, completeness: counted ?? compose.completeness });
    if (needed.length > 0) {
      toast(publishToast(needed));
      return;
    }
    try {
      const row = await compose.publish();
      try {
        await refreshMakingStats(row.id);
      } catch (cause) {
        console.warn("[Compose] making stats not refreshed", cause);
      }
      await queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(row.id) });
    } catch (cause) {
      console.error("[Compose] publish failed", cause);
      toast.error("Couldn't publish. Try again.");
    }
  };

  const live = build !== null && build.status !== "draft";
  const published = useMemo(() => {
    if (!build || !live) return null;
    const shortfall = galleryShortfall(build.shape, build.completeness ?? 0, compose.completeness?.missing ?? []);
    return {
      slug: build.slug,
      inGallery: inGallery(build),
      shortfall: shortfall.map((item) => item.copy).join(" and "),
    };
  }, [build, live, compose.completeness]);

  /* ── the audiences the Gallery already knows ── */

  const facets = useQuery({
    queryKey: ["build", "getGalleryFacets"],
    queryFn: getGalleryFacets,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
  const audienceOptions = useMemo(() => (facets.data?.roles ?? []).map((role) => role.value), [facets.data]);

  /* ── the page's state ── */

  const status: ComposeStatus = !buildId
    ? "ready"
    : compose.loadError
      ? "error"
      : compose.isLoading
        ? createdHere ? "ready" : "loading"
        : !build || !compose.isOwner
          ? "notFound"
          : "ready";

  return (
    <>
      <SeoHead title="Compose — buildgallery" description="Write your build." path="/compose" noIndex />
      <ComposeView
        status={status}
        onRetry={() => void queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(buildId) })}
        title={title}
        onTitle={onTitle}
        description={description}
        onDescription={onDescription}
        audience={audience}
        onAudience={onAudience}
        audienceOptions={audienceOptions}
        save={saveState({ isSaving: compose.isSaving, saveError: compose.saveError, lastSavedAt: compose.lastSavedAt })}
        onRetrySave={() => compose.patchBuild({ title: title.trim() || UNTITLED })}
        missing={missing.map((key) => PUBLISH_WORDS[key])}
        intakeHref={buildId ? null : "/compose/start"}
        slug={build?.slug ?? null}
        published={published}
        publishing={compose.isPublishing}
        onPublish={() => void onPublish()}
        cover={coverMedia ? { url: coverUrl, kind: coverMedia.kind === "video" ? "video" : "image" } : null}
        adding={adding}
        mediaError={mediaError}
        accept={ACCEPT}
        onFiles={(files) => void onFiles(files)}
        onRemoveCover={() => void onRemoveCover()}
        prompts={prompts.rows}
        focusPrompt={prompts.focus}
        onPromptText={prompts.setText}
        onMovePrompt={prompts.move}
        onRemovePrompt={prompts.remove}
        onWritePrompt={prompts.write}
        onDropPrompt={prompts.drop}
        sessionsStatus={sessions.status}
        onRetrySessions={sessions.retry}
        sessions={sessionViews}
        onSessionsOpen={sessions.setOpenIds}
        onRetrySessionPrompts={sessions.retryPrompts}
        onAddSessionPrompt={prompts.add}
        onSetSessionModel={(sessionId, model) =>
          void sessions.setModel(sessionId, model).then((saved) => {
            if (saved) prompts.relabel(sessionId, modelLabel(model));
          })
        }
        otherSessions={otherSessions}
        onAttachSession={sessions.attach}
        madeWith={madeWith}
        onToggleMadeWith={sessions.toggleMadeWith}
        onAddMadeWith={sessions.addMadeWith}
        details={details.details}
        onDetail={details.setDetail}
        onGapSwitch={details.setGapOn}
      />
    </>
  );
}

export default ComposePage;
