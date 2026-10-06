/* UI-P47 — /compose/new and /compose/:buildId in the site frame: the container.

   Loads and writes through `useComposeBuild` and `src/lib/build/` only, maps
   them to `ComposeView`'s props and runs the view's handlers. The legacy screens
   (`Compose.tsx`, `ComposeNew.tsx`) are not edited; `ComposeRoute` picks between
   them and this.

   A DRAFT THAT DOES NOT EXIST YET IS NOT CREATED BY OPENING THE PAGE. /compose/new
   holds the three text fields in local state; the FIRST CHANGE (a title, a
   description, a cover) calls `createBuild({ title })`, seeds the composer's
   query with the new row, and replaces the URL with /compose/{id}. The route is
   one `:buildId` route, so that replace changes a parameter and does not remount
   this component: focus and the next keystroke stay where they were. Anything
   typed while the row was being made is written once it exists.

   THE FIELDS ARE STRINGS HERE, NOT THE BUILD. A half-typed "photographers, "
   must stay as typed; what is saved is the trimmed, deduplicated list.

   THE COVER IS ALSO THE BUILD'S EVIDENCE. Adding one writes the file, then the
   post's media set (never the `cover_media_id` mirror), then a top-level
   evidence node placed after everything already in the tree: a node left in the
   tray does not count towards publishing. */

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { SeoHead } from "@/components/SeoHead";
import { useCrumbTitle } from "@/components/shell/useBreadcrumb";
import { useAuth } from "@/contexts/AuthContext";
import { composeBuildQueryKey, useComposeBuild } from "@/hooks/useComposeBuild";
import {
  addPostMedia,
  createBuild,
  deleteMedia,
  deleteNode,
  galleryShortfall,
  getGalleryFacets,
  getNodeTree,
  getPostMedia,
  inGallery,
  mediaKindFor,
  removePostMedia,
  signedMediaUrl,
  uploadMedia,
  upsertNode,
  type BuildRecord,
  type Json,
} from "@/lib/build";
import { getNodeTypes } from "@/lib/build/nodeTypes";
import { refreshMakingStats } from "@/lib/build/making";

import { ComposeView, type ComposeMedia, type ComposePublished } from "./ComposeView";
import {
  UNTITLED,
  coverNodeFor,
  coverNodeType,
  galleryWords,
  isUntitled,
  missingKeys,
  missingWords,
  nextTopPosition,
  parseAudience,
  publishBlockedLine,
  type SaveState,
} from "./composeModel";

const NotFound = lazy(() => import("@/pages/NotFound"));

const SAVED_JUST_NOW_MS = 60_000;
const FACETS_STALE_MS = 10 * 60_000;
const URL_STALE_MS = 50 * 60_000;

interface Fields {
  title: string;
  description: string;
  audience: string;
}

const NO_FIELDS: Fields = { title: "", description: "", audience: "" };

/** What the empty draft is missing, before it exists: a stub that has no title or description yet. */
const stubBuild = (fields: Fields) =>
  ({
    title: fields.title,
    shape: "other",
    outcome: fields.description.trim() || null,
    made_for: parseAudience(fields.audience),
    made_with: [],
    cost_setup: null,
    cost_monthly: null,
    time_to_first_result: null,
    live_url: null,
    repo_url: null,
  }) as Parameters<typeof missingKeys>[0];

export default function ComposePage() {
  const { buildId: routeId } = useParams<{ buildId: string }>();
  const isNew = routeId === "new";
  const buildId = isNew ? undefined : routeId;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { loading: authLoading } = useAuth();

  const compose = useComposeBuild(buildId);
  const { build, tree, nodeTypes, patchBuild } = compose;

  /* ── the fields ── */

  const [fields, setFields] = useState<Fields>(NO_FIELDS);
  const fieldsRef = useRef<Fields>(NO_FIELDS);
  const seeded = useRef<string | null>(null);
  const idRef = useRef<string | undefined>(buildId);
  if (buildId) idRef.current = buildId;
  const [dirty, setDirty] = useState(false);

  const setField = useCallback((patch: Partial<Fields>) => {
    fieldsRef.current = { ...fieldsRef.current, ...patch };
    setFields(fieldsRef.current);
  }, []);

  // An existing draft: its values, once, when it loads. A draft this page just made keeps what was typed.
  useEffect(() => {
    if (!build || seeded.current === build.id) return;
    seeded.current = build.id;
    fieldsRef.current = {
      title: isUntitled(build.title) ? "" : build.title,
      description: build.outcome ?? "",
      audience: (build.made_for ?? []).join(", "),
    };
    setFields(fieldsRef.current);
  }, [build]);

  /* ── creating the draft on the first change ── */

  const creating = useRef<Promise<string> | null>(null);
  /** Set when this page made the row: what was typed meanwhile is written once the composer owns it. */
  const syncAfterCreate = useRef(false);

  const ensureBuild = useCallback(async (): Promise<string> => {
    if (idRef.current) return idRef.current;
    if (!creating.current) {
      creating.current = (async () => {
        try {
          const row = await createBuild({ title: fieldsRef.current.title.trim() || UNTITLED });
          const nodeTypeRows = await getNodeTypes();
          const record: BuildRecord = { build: row, tree: [], tray: [], events: [], nodeTypes: nodeTypeRows };
          qc.setQueryData(composeBuildQueryKey(row.id), record);
          seeded.current = row.id;
          idRef.current = row.id;
          syncAfterCreate.current = true;
          void qc.invalidateQueries({ queryKey: ["build", "countDraftBuilds"] });
          void qc.invalidateQueries({ queryKey: ["build", "listDraftsWithSessions"] });
          navigate(`/compose/${row.id}`, { replace: true });
          return row.id;
        } catch (error) {
          creating.current = null;
          console.error("[Compose] createBuild failed", error);
          toast.error("Couldn't start your draft. Try again.");
          throw error;
        }
      })();
    }
    return creating.current;
  }, [navigate, qc]);

  const patchFromFields = useCallback(
    (only?: Partial<Record<keyof Fields, true>>) => {
      const f = fieldsRef.current;
      patchBuild({
        ...(!only || only.title ? { title: f.title.trim() || UNTITLED } : {}),
        ...(!only || only.description ? { outcome: f.description.trim() || null } : {}),
        ...(!only || only.audience ? { made_for: parseAudience(f.audience) } : {}),
      });
    },
    [patchBuild],
  );

  // What was typed while the row was being made.
  useEffect(() => {
    if (!syncAfterCreate.current || !compose.isOwner || !build) return;
    syncAfterCreate.current = false;
    const f = fieldsRef.current;
    const want = { title: f.title.trim() || UNTITLED, outcome: f.description.trim() || null, made_for: parseAudience(f.audience) };
    const differs =
      want.title !== build.title ||
      want.outcome !== (build.outcome ?? null) ||
      want.made_for.join("\u0000") !== (build.made_for ?? []).join("\u0000");
    if (differs) patchFromFields();
  }, [compose.isOwner, build, patchFromFields]);

  const edited = useCallback(
    (patch: Partial<Fields>, key: keyof Fields) => {
      setField(patch);
      if (!idRef.current) {
        void ensureBuild().catch(() => undefined);
        return;
      }
      if (!compose.isOwner) return; // synced once the composer owns it
      setDirty(true);
      patchFromFields({ [key]: true });
    },
    [compose.isOwner, ensureBuild, patchFromFields, setField],
  );

  useEffect(() => {
    if (compose.lastSavedAt || compose.saveError) setDirty(false);
  }, [compose.lastSavedAt, compose.saveError]);

  /* ── the cover ── */

  const postMediaKey = useMemo(() => ["build", "getPostMedia", buildId] as const, [buildId]);
  const mediaQuery = useQuery({
    queryKey: postMediaKey,
    queryFn: () => getPostMedia(buildId as string),
    enabled: Boolean(buildId) && compose.isOwner,
    staleTime: Infinity,
  });
  const cover = mediaQuery.data?.[0] ?? null;
  const coverUrl = useQuery({
    queryKey: ["build", "signedMediaUrl", cover?.id],
    queryFn: () => signedMediaUrl(cover as NonNullable<typeof cover>),
    enabled: Boolean(cover),
    staleTime: URL_STALE_MS,
  });
  const [adding, setAdding] = useState<number | null>(null);

  /** The tree and the media set, read again after a write. */
  const refreshCover = useCallback(
    async (id: string) => {
      const fresh = await getNodeTree(id);
      qc.setQueryData<BuildRecord | null>(composeBuildQueryKey(id), (previous) => (previous ? { ...previous, tree: fresh } : previous));
      await qc.invalidateQueries({ queryKey: ["build", "getPostMedia", id] });
    },
    [qc],
  );

  const kindOf = (file: File): "image" | "video" | null => {
    const kind = mediaKindFor(file.type);
    return kind === "image" || kind === "video" ? kind : null;
  };

  const addCover = useCallback(
    async (file: File) => {
      const kind = kindOf(file);
      if (!kind) {
        toast.error("Choose a picture or a video.");
        return;
      }
      setAdding(0);
      try {
        const id = await ensureBuild();
        const media = await uploadMedia({ buildId: id, file, onProgress: setAdding });
        await addPostMedia(id, media.id);
        const placed = await getNodeTree(id);
        await upsertNode({
          build_id: id,
          parent_id: null,
          position: nextTopPosition(placed),
          type: coverNodeType(kind),
          payload: { media_id: media.id, caption: null } as Json,
        });
        await refreshCover(id);
      } catch (error) {
        console.error("[Compose] adding the cover failed", error);
        toast.error("Couldn't add that. Try again.");
      } finally {
        setAdding(null);
      }
    },
    [ensureBuild, refreshCover],
  );

  const replaceCover = useCallback(
    async (file: File) => {
      const kind = kindOf(file);
      if (!kind) {
        toast.error("Choose a picture or a video.");
        return;
      }
      if (!buildId || !cover) return addCover(file);
      setAdding(0);
      try {
        const node = coverNodeFor(tree, cover.id);
        const media = await uploadMedia({ buildId, file, onProgress: setAdding });
        await removePostMedia(buildId, cover.id);
        await deleteMedia(cover.id);
        await addPostMedia(buildId, media.id);
        if (node) {
          const payload = node.payload && typeof node.payload === "object" && !Array.isArray(node.payload) ? node.payload : {};
          await upsertNode({
            id: node.id,
            build_id: buildId,
            parent_id: node.parent_id,
            position: node.position,
            type: coverNodeType(kind),
            payload: { ...payload, media_id: media.id } as Json,
          });
        } else {
          const placed = await getNodeTree(buildId);
          await upsertNode({
            build_id: buildId,
            parent_id: null,
            position: nextTopPosition(placed),
            type: coverNodeType(kind),
            payload: { media_id: media.id, caption: null } as Json,
          });
        }
        await refreshCover(buildId);
      } catch (error) {
        console.error("[Compose] replacing the cover failed", error);
        toast.error("Couldn't replace that. Try again.");
        await qc.invalidateQueries({ queryKey: postMediaKey });
      } finally {
        setAdding(null);
      }
    },
    [addCover, buildId, cover, postMediaKey, qc, refreshCover, tree],
  );

  const removeCover = useCallback(async () => {
    if (!buildId || !cover) return;
    try {
      const node = coverNodeFor(tree, cover.id);
      await removePostMedia(buildId, cover.id);
      if (node) await deleteNode(node.id);
      await deleteMedia(cover.id);
      await refreshCover(buildId);
    } catch (error) {
      console.error("[Compose] removing the cover failed", error);
      toast.error("Couldn't remove that. Try again.");
      await qc.invalidateQueries({ queryKey: postMediaKey });
    }
  }, [buildId, cover, postMediaKey, qc, refreshCover, tree]);

  const media: ComposeMedia =
    adding !== null
      ? { state: "adding", pct: adding }
      : cover
        ? coverUrl.data
          ? { state: "set", kind: cover.kind === "video" ? "video" : "image", url: coverUrl.data }
          : { state: "loading" }
        : { state: "empty" };

  /* ── what a publish needs, and publishing ── */

  const keys = useMemo(
    () =>
      build
        ? missingKeys(build, tree, nodeTypes, compose.completeness ?? undefined)
        : missingKeys(stubBuild(fields), [], []),
    [build, compose.completeness, fields, nodeTypes, tree],
  );

  const publish = useCallback(async () => {
    if (keys.length > 0) {
      toast(publishBlockedLine(keys));
      return;
    }
    if (!build) return;
    try {
      const row = await compose.publish();
      try {
        await refreshMakingStats(row.id);
      } catch (error) {
        console.warn("[Compose] making stats not refreshed", error);
      }
      void qc.invalidateQueries({ queryKey: ["build", "countDraftBuilds"] });
      void qc.invalidateQueries({ queryKey: ["build", "listDraftsWithSessions"] });
    } catch (error) {
      console.error("[Compose] publish failed", error);
      toast.error("Couldn't publish. Try again.");
    }
  }, [build, compose, keys, qc]);

  const published: ComposePublished | null =
    build && build.status !== "draft"
      ? {
          slug: build.slug,
          inGallery: inGallery({ ...build, completeness: compose.completeness?.score ?? build.completeness }),
          shortfall: galleryWords(
            galleryShortfall(build.shape, compose.completeness?.score ?? build.completeness ?? 0, compose.completeness?.missing ?? []),
          ),
        }
      : null;

  /* ── the form's own data ── */

  const facets = useQuery({ queryKey: ["build", "getGalleryFacets"], queryFn: getGalleryFacets, staleTime: FACETS_STALE_MS });
  const audienceOptions = useMemo(
    () =>
      (facets.data?.roles ?? [])
        .map((role) => (typeof role === "string" ? role : role.value))
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    [facets.data],
  );

  const shownTitle = build ? build.title : fields.title;
  useCrumbTitle(isUntitled(shownTitle) ? UNTITLED : shownTitle.trim());

  /* ── states ── */

  if (!isNew && !authLoading && !compose.isLoading && !compose.loadError && (!build || !compose.isOwner)) {
    return (
      <Suspense fallback={null}>
        <NotFound />
      </Suspense>
    );
  }

  const status = !isNew && compose.loadError ? "error" : !isNew && (compose.isLoading || !build) ? "loading" : "ready";

  const saveState: SaveState = compose.saveError
    ? "failed"
    : compose.isSaving || dirty
      ? "saving"
      : build
        ? "saved"
        : "idle";
  const savedJustNow = compose.lastSavedAt !== null && Date.now() - compose.lastSavedAt.getTime() < SAVED_JUST_NOW_MS;

  return (
    <>
      <SeoHead title="Compose — buildgallery" description="Write your build." path={isNew ? "/compose/new" : `/compose/${routeId}`} noIndex />
      <ComposeView
        status={status}
        onRetry={() => void qc.invalidateQueries({ queryKey: composeBuildQueryKey(buildId) })}
        showStartLink={isNew}
        heading={shownTitle}
        title={fields.title}
        description={fields.description}
        audience={fields.audience}
        audienceOptions={audienceOptions}
        onTitle={(value) => edited({ title: value }, "title")}
        onDescription={(value) => edited({ description: value }, "description")}
        onAudience={(value) => edited({ audience: value }, "audience")}
        saveState={saveState}
        savedJustNow={savedJustNow}
        onSaveRetry={() => patchFromFields()}
        missing={missingWords(keys)}
        slug={build?.slug ?? null}
        published={published}
        publishing={compose.isPublishing}
        onPublish={() => void publish()}
        media={media}
        onFile={(file) => void addCover(file)}
        onReplace={(file) => void replaceCover(file)}
        onRemoveMedia={() => void removeCover()}
      />
    </>
  );
}
