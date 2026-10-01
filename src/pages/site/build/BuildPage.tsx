/* UI-P29 — `/b2/:slug` in the site frame: the container.

   Loads the build through `src/lib/` functions only, maps it to `BuildView`'s
   props and renders it. No Supabase call in this file. The legacy page
   (`src/pages/BuildPage.tsx`) is not edited: `FrameRoute` picks one by the
   `site_frame` flag.

   EVERYTHING THE OLD FIRST SCREEN DID STILL WORKS, in its new places:
     reproducing      the proof panel's primary → which model → recordReproduction()
     re-confirming    the creator's primary → recordSelfConfirmation(); the
                      reproduction insert policy refuses a creator, and the count
                      stays other people
     copying          Copy for AI → toPortable() → toMarkdown() → clipboard
     downloading      Download → the portable file, as PortableExport writes it
     rebuilding       Rebuild → /rebuild/:slug (which calls startRebuild()), or
                      sign in first and come back to it
     every tab        BuildTabs' six keys in the part viewer: the anatomy's part,
                      Replay, Run it yourself, the understand layer, Where it
                      broke, Rebuilds — each the component the old page renders

   UI-P30 restyles the tab contents and brings the lower sections into the same
   grammar. Until then the comments and "where next" sit under the first screen
   as they are, so nothing a reader could do on the old page is missing here. */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/brand/Button";
import { CoverFallback } from "@/components/brand/CoverFallback";
import type { PartViewerMode } from "@/components/brand/PartViewer";
import { AnatomyTree } from "@/components/build/AnatomyTree";
import { BreakageView } from "@/components/build/BreakageView";
import { CreditLine } from "@/components/build/CreditLine";
import { useForkBuild } from "@/components/build/ForkControl";
import { GapPanel, SolvedCredit } from "@/components/build/GapPanel";
import { LayerView, RunItPanel } from "@/components/build/LayerView";
import { MEDIA_WIDTH, useMediaSrc, type ResolveMedia } from "@/components/build/MediaFigure";
import { RebuildsTab } from "@/components/build/RebuildsTab";
import { Replay } from "@/components/build/Replay";
import { RunView } from "@/components/build/RunView";
import { WhereNext } from "@/components/build/WhereNext";
import { getNodeCopyText, resolveRenderer } from "@/components/build/renderers";
import { ReportDialog } from "@/components/moderation/ReportDialog";
import { useCrumbTitle } from "@/components/shell/useBreadcrumb";
import { Comments } from "@/components/social/Comments";
import { useAuth } from "@/contexts/AuthContext";
import {
  listBuildBounties,
  listSolutionBuilds,
  listSolverHandles,
  type BuildBounty,
  type SolutionBuild,
} from "@/lib/bounty";
import {
  LAYER_BLURB,
  MINIMUM_PUBLISHABLE_SCORE,
  changeSet,
  collectGaps,
  computeCompleteness,
  galleryThreshold,
  getApprovedLayers,
  getBuild,
  getBuildBySlug,
  getBuildHeader,
  getMediaForBuild,
  layerOf,
  listRebuilds,
  recordReproduction,
  recordSelfConfirmation,
  resolveCover,
  serialiseChangeSet,
  type Build,
  type BuildLayer,
  type BuildMedia,
  type BuildNode,
  type BuildRecord,
  type NodeTree,
  type NodeType,
  type RebuildSummary,
} from "@/lib/build";
import { toMarkdown, toPortable } from "@/lib/build/portable";
import { getCreatedVia, type CreatedVia } from "@/lib/build/provenance";
import { shareDescription, shareTitle } from "@/lib/build/shareMeta";
import { isBuildHidden } from "@/lib/moderation";
import { getMakerName } from "@/lib/profile/makerName";
import { numberParts } from "@/lib/social";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { BuildView, BuildViewNotice, BuildViewSkeleton } from "./BuildView";
import {
  askLabel,
  buildTabs,
  deltaLine,
  makerLabel,
  partMeta,
  partsInOrder,
  proofDetails,
  shortDate,
  tabLayer,
  timelineFrom,
  type BuildTabKey,
  type PartRowView,
} from "./buildModel";
import { RunDialog, type RunSubmission } from "./RunDialog";

/** A build record does not change while a reader is looking at it. */
const STALE_TIME = 60_000;

const recordKey = (slug: string) => ["build", "getBuildBySlug", slug] as const;

/* ── small pure helpers over the record ── */

/** Every placed node by id: what renderers resolve references through. */
function indexTree(tree: readonly NodeTree[]): Map<string, BuildNode> {
  return new Map(partsInOrder(tree).map((node) => [node.id, node]));
}

/** The solver a bounty credited on this node (source_ref = {source: 'bounty', solver_id, …}). */
function bountyRef(node: BuildNode, key: "solver_id" | "solution_build_id"): string | null {
  const ref = node.source_ref;
  if (!ref || typeof ref !== "object" || Array.isArray(ref)) return null;
  const record = ref as Record<string, unknown>;
  if (record.source !== "bounty") return null;
  return typeof record[key] === "string" ? (record[key] as string) : null;
}

function idsIn(tree: readonly NodeTree[], key: "solver_id" | "solution_build_id"): string[] {
  return [...new Set(partsInOrder(tree).map((node) => bountyRef(node, key)).filter((id): id is string => Boolean(id)))];
}

/** The creator's own words for the picture, else the node's title, else the build's. */
function coverAlt(build: Build, media: BuildMedia | null, nodes: Map<string, BuildNode>): string {
  const node = media?.node_id ? nodes.get(media.node_id) : undefined;
  const payload = node?.payload && typeof node.payload === "object" && !Array.isArray(node.payload) ? (node.payload as Record<string, unknown>) : null;
  const caption = typeof payload?.caption === "string" ? payload.caption.trim() : "";
  return caption || (node?.title ?? "").trim() || (build.title ?? "").trim() || "Build cover";
}

/** The portable file, written the way PortableExport writes it. */
function downloadPortable(record: BuildRecord) {
  const json = `${JSON.stringify(toPortable(record), null, 2)}\n`;
  const blob = new Blob([json], { type: "application/json" });
  const objectUrl = typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : null;
  const anchor = document.createElement("a");
  anchor.href = objectUrl ?? `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
  anchor.download = `${record.build.slug}.neoscale.json`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
}

async function copyText(text: string | null | undefined): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // A denied clipboard is not worth a toast on a read surface.
    return false;
  }
}

/* ── the anatomy tab's body: one part, read one of two ways ── */

function PartContent({
  node,
  nodeType,
  build,
  mode,
  understand,
  resolveNode,
  resolveMedia,
  footer,
}: {
  node: BuildNode;
  nodeType: NodeType | undefined;
  build: Build;
  mode: PartViewerMode;
  understand: BuildLayer | null;
  resolveNode: (id: string) => BuildNode | undefined;
  resolveMedia: ResolveMedia;
  footer: ReactNode;
}) {
  if (mode === "understand") {
    const steps = (understand?.content.steps ?? []).filter((step) => step.node_ref === node.id && step.body.trim());
    const words = steps.length > 0 ? steps.map((step) => step.body.trim()) : (node.note ?? "").trim() ? [(node.note ?? "").trim()] : [];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {words.length > 0 ? (
          words.map((text, index) => (
            <p key={index} style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              {text}
            </p>
          ))
        ) : (
          <p style={{ margin: 0, color: t.text2 }}>There is no plain-language reading of this part yet.</p>
        )}
        {footer}
      </div>
    );
  }

  const Renderer = resolveRenderer(nodeType?.renderer);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }} data-node-id={node.id}>
      <Renderer node={node} nodeType={nodeType} build={build} resolveNode={resolveNode} resolveMedia={resolveMedia} />
      {footer}
    </div>
  );
}

/* ── the page ── */

export function BuildPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  /* ── the record and what hangs off it ── */

  const recordQuery = useQuery<BuildRecord | null>({
    queryKey: recordKey(slug),
    queryFn: () => getBuildBySlug(slug),
    enabled: Boolean(slug),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });
  const record = recordQuery.data ?? null;
  const build = record?.build;
  const buildId = build?.id;
  const tree = useMemo(() => record?.tree ?? [], [record?.tree]);
  const nodeTypes = useMemo(() => record?.nodeTypes ?? [], [record?.nodeTypes]);

  /* The current crumb: the title, a skeleton while it loads, and words for the two dead ends. */
  useCrumbTitle(build ? build.title : recordQuery.isPending ? null : recordQuery.isError ? "Build" : "Not found");

  const media = useQuery<BuildMedia[]>({
    queryKey: ["build", "getMediaForBuild", buildId],
    queryFn: () => getMediaForBuild(buildId as string),
    enabled: Boolean(buildId),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });
  const layers = useQuery<BuildLayer[]>({
    queryKey: ["build", "getApprovedLayers", buildId],
    queryFn: () => getApprovedLayers(buildId as string),
    enabled: Boolean(buildId),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });
  const rebuilds = useQuery<RebuildSummary[]>({
    queryKey: ["build", "listRebuilds", buildId],
    queryFn: () => listRebuilds(buildId as string),
    enabled: Boolean(buildId),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });
  const createdVia = useQuery<CreatedVia | null>({
    queryKey: ["build", "getCreatedVia", buildId],
    queryFn: () => getCreatedVia(buildId as string),
    enabled: Boolean(buildId),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });
  const bounties = useQuery<BuildBounty[]>({
    queryKey: ["bounty", "listBuildBounties", buildId, user?.id ?? null],
    queryFn: () => listBuildBounties({ buildId: buildId as string, viewerId: user?.id ?? null }),
    enabled: Boolean(buildId),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  /* A rebuild's Δ needs its source's whole record: read once, only for a rebuild. */
  const sourceId = build?.source_title_at_fork ? build.parent_build_id : null;
  const source = useQuery<BuildRecord | null>({
    queryKey: ["build", "getBuild", sourceId],
    queryFn: () => getBuild(sourceId as string),
    enabled: Boolean(sourceId),
    staleTime: 5 * STALE_TIME,
    refetchOnWindowFocus: false,
  });

  const solverIds = useMemo(() => idsIn(tree, "solver_id"), [tree]);
  const solverHandles = useQuery<Map<string, string | null>>({
    queryKey: ["bounty", "listSolverHandles", solverIds.join(",")],
    queryFn: () => listSolverHandles(solverIds),
    enabled: solverIds.length > 0,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });
  const solutionIds = useMemo(() => idsIn(tree, "solution_build_id"), [tree]);
  const solutionBuilds = useQuery<Map<string, SolutionBuild>>({
    queryKey: ["bounty", "listSolutionBuilds", solutionIds.join(",")],
    queryFn: () => listSolutionBuilds(solutionIds),
    enabled: solutionIds.length > 0,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  const viewerIsCreator = Boolean(user && build && user.id === build.creator_id);
  const hidden = useQuery<boolean>({
    queryKey: ["moderation", "isBuildHidden", buildId],
    queryFn: () => isBuildHidden(buildId as string),
    enabled: Boolean(buildId) && viewerIsCreator,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });
  const needsMakerName = Boolean(build) && !(build?.outcome ?? "").trim();
  const makerName = useQuery<string | null>({
    queryKey: ["profile", "getMakerName", build?.creator_id],
    queryFn: () => getMakerName(build?.creator_id as string),
    enabled: needsMakerName && Boolean(build?.creator_id),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  /* ── lookups ── */

  const nodesById = useMemo(() => indexTree(tree), [tree]);
  const resolveNode = useCallback((id: string) => nodesById.get(id), [nodesById]);
  const typesByKey = useMemo(() => new Map(nodeTypes.map((type) => [type.key, type])), [nodeTypes]);
  const mediaById = useMemo(() => new Map((media.data ?? []).map((row) => [row.id, row])), [media.data]);
  const resolveMedia = useMemo<ResolveMedia>(
    () => (id) => {
      if (!id) return null;
      return mediaById.get(id) ?? (media.isPending ? undefined : null);
    },
    [mediaById, media.isPending],
  );
  const bountyByNode = useMemo(() => {
    const index = new Map<string, BuildBounty>();
    for (const entry of bounties.data ?? []) if (entry.bounty.gap_node_id) index.set(entry.bounty.gap_node_id, entry);
    return index;
  }, [bounties.data]);
  const gaps = useMemo(() => new Set(collectGaps(tree).map((node) => node.id)), [tree]);

  const understandLayer = layerOf(layers.data ?? [], "understand");
  const runLayer = layerOf(layers.data ?? [], "run");

  /* ── the cover ── */

  const cover = useMemo(() => (build ? resolveCover(build, tree, media.data ?? []) : null), [build, tree, media.data]);
  const coverStill =
    cover?.kind === "image"
      ? cover
      : cover?.poster_path
        ? { bucket: cover.bucket, path: cover.poster_path, kind: "image" as const }
        : null;
  const coverSrc = useMediaSrc(coverStill, MEDIA_WIDTH.hero);

  /* ── what the reader is looking at ── */

  const [tab, setTab] = useState<BuildTabKey>("anatomy");
  const [mode, setMode] = useState<PartViewerMode>("run");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [jumpTo, setJumpTo] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [reporting, setReporting] = useState<{ type: "build"; id: string } | null>(null);

  /* The replay's jump is one-shot: cleared on the commit after it was read. */
  useEffect(() => {
    if (jumpTo !== null) setJumpTo(null);
  }, [jumpTo]);

  /* #node-<id> in the address selects that part, as the old page scrolled to it. */
  const { hash } = location;
  useEffect(() => {
    if (!record || !hash.startsWith("#node-")) return;
    const id = hash.slice("#node-".length);
    if (nodesById.has(id)) {
      setSelectedId(id);
      setTab("anatomy");
    }
  }, [record, hash, nodesById]);

  const ordered = useMemo(() => partsInOrder(tree), [tree]);
  const selected = (selectedId ? nodesById.get(selectedId) : undefined) ?? ordered[0] ?? null;

  const selectPart = useCallback((id: string) => {
    setSelectedId(id);
    setTab("anatomy");
  }, []);

  const onTabChange = useCallback((next: BuildTabKey) => {
    setTab(next);
    const layer = tabLayer(next);
    if (layer) setMode(layer);
  }, []);

  /* On the anatomy the switch reads the part two ways; anywhere else it is the
     Run / Understand pair of tabs, so moving it moves the tab with it. */
  const onModeChange = useCallback(
    (next: PartViewerMode) => {
      setMode(next);
      if (tab !== "anatomy") setTab(next);
    },
    [tab],
  );

  const openReplayAt = useCallback((ordinal: number) => {
    setJumpTo(ordinal);
    setTab("watch");
  }, []);

  const forkState = useForkBuild(build);

  /* ── writes ── */

  const putHeader = useCallback(
    (header: Build) =>
      queryClient.setQueryData<BuildRecord | null>(recordKey(slug), (current) => (current ? { ...current, build: header } : current)),
    [queryClient, slug],
  );

  const submitRun = useCallback(
    async ({ worked, model, note }: RunSubmission) => {
      if (!build) return;
      if (viewerIsCreator) await recordSelfConfirmation({ buildId: build.id, modelUsed: model });
      else await recordReproduction({ buildId: build.id, worked, modelUsed: model, note });
      // The count and the clock are kept by the database; read them back rather than guess.
      const fresh = await getBuildHeader(build.id);
      if (fresh) putHeader(fresh);
    },
    [build, viewerIsCreator, putHeader],
  );

  const onBountyChanged = useCallback(
    (change: "submitted" | "accepted" | "me_too") => {
      void bounties.refetch();
      if (change === "accepted") void queryClient.invalidateQueries({ queryKey: recordKey(slug) });
    },
    [bounties, queryClient, slug],
  );

  const renderFooter = useCallback(
    (node: BuildNode): ReactNode => {
      if (!build) return null;
      const entry = bountyByNode.get(node.id);
      if (entry && node.is_gap && entry.bounty.status === "open") {
        return (
          <GapPanel
            node={node}
            nodeType={typesByKey.get(node.type)}
            build={build}
            entry={entry}
            resolveNode={resolveNode}
            resolveMedia={resolveMedia}
            onChanged={onBountyChanged}
          />
        );
      }
      const solver = bountyRef(node, "solver_id");
      if (solver) {
        const fromId = bountyRef(node, "solution_build_id");
        const from = fromId ? (solutionBuilds.data?.get(fromId) ?? null) : null;
        return <SolvedCredit handle={solverHandles.data?.get(solver) ?? null} build={from ? { slug: from.slug, title: from.title } : null} />;
      }
      return null;
    },
    [build, bountyByNode, typesByKey, resolveNode, resolveMedia, onBountyChanged, solutionBuilds.data, solverHandles.data],
  );

  /* ── the states ── */

  if (recordQuery.isPending && Boolean(slug)) return <BuildViewSkeleton />;

  if (recordQuery.isError) {
    return (
      <BuildViewNotice
        line="This build could not be loaded."
        action={
          <Button variant="secondary" size={36} fontSize={13} onClick={() => void recordQuery.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (!record || !build) {
    return (
      <BuildViewNotice
        line="No build at this address."
        detail={`Nothing is published at /b2/${slug}. It may have been unpublished, or the link may be wrong.`}
        action={
          <Button variant="secondary" size={36} fontSize={13} onClick={() => navigate("/gallery")}>
            See the gallery
          </Button>
        }
      />
    );
  }

  /* ── mapped for the view ── */

  const parts: PartRowView[] = ordered.map((node, index) => {
    const nodeType = typesByKey.get(node.type);
    const reward = bountyByNode.get(node.id)?.bounty;
    return {
      id: node.id,
      number: index + 1,
      title: (node.title ?? "").trim() || "Untitled part",
      category: nodeType?.category ?? node.type,
      meta: partMeta(node, nodeType),
      gap: gaps.has(node.id),
      ask: reward && reward.status === "open" && typeof reward.reward_gbp === "number" ? askLabel(reward.reward_gbp) : null,
    };
  });

  const completeness = viewerIsCreator ? computeCompleteness(build, tree, nodeTypes) : null;
  const delta = source.data ? deltaLine(serialiseChangeSet(changeSet(source.data, record))) : null;
  const timeline = timelineFrom(record.events);
  const hasRebuilds = (rebuilds.data ?? []).length > 0;
  const loginBack = (to: string) => `/login?redirect=${encodeURIComponent(to)}`;

  const content: ReactNode = (() => {
    switch (tab) {
      case "watch":
        return (
          <Replay
            build={build}
            events={record.events}
            nodeTypes={nodeTypes}
            resolveNode={resolveNode}
            resolveMedia={resolveMedia}
            focusOrdinal={jumpTo}
            onFork={forkState.fork}
            forkPending={forkState.pending}
            divergences={rebuilds.data}
            onOpenRebuild={(rebuild) => navigate(`/b2/${rebuild.slug}`)}
          />
        );
      case "run": {
        const sequence = <RunView tree={tree} nodeTypes={nodeTypes} build={build} />;
        return runLayer ? <RunItPanel sequence={sequence} layer={runLayer} resolveNode={resolveNode} onOpenNode={selectPart} /> : sequence;
      }
      case "understand":
        return understandLayer ? (
          <LayerView layer={understandLayer} resolveNode={resolveNode} onOpenNode={selectPart} />
        ) : (
          <p style={{ margin: 0, color: t.text2 }}>There is no plain-language reading of this build yet.</p>
        );
      case "broke":
        return (
          <BreakageView
            build={build}
            events={record.events}
            tree={tree}
            nodeTypes={nodeTypes}
            resolveNode={resolveNode}
            resolveMedia={resolveMedia}
            onOpenReplay={openReplayAt}
          />
        );
      case "rebuilds":
        return <RebuildsTab rebuilds={rebuilds.data ?? []} family={{ rootId: build.root_build_id ?? build.id, currentId: build.id }} />;
      case "anatomy":
      default:
        return selected ? (
          <PartContent
            node={selected}
            nodeType={typesByKey.get(selected.type)}
            build={build}
            mode={mode}
            understand={understandLayer}
            resolveNode={resolveNode}
            resolveMedia={resolveMedia}
            footer={renderFooter(selected)}
          />
        ) : (
          <p style={{ margin: 0, color: t.text2 }}>Nothing has been placed in this build yet.</p>
        );
    }
  })();

  const coverNode = coverSrc ? (
    <img
      src={coverSrc}
      alt={coverAlt(build, cover, nodesById)}
      style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
    />
  ) : coverStill || media.isPending ? (
    // A picture is on its way: hold the ground rather than flash a landscape first.
    <div aria-hidden="true" style={{ width: "100%", height: "100%", background: t.recess }} />
  ) : (
    <CoverFallback seed={build.id} radius={0} />
  );

  return (
    <>
      <SeoHead
        title={shareTitle(build.title)}
        description={shareDescription({
          outcome: build.outcome,
          makerName: makerName.data ?? null,
          reproductionCount: build.reproduction_count,
        })}
        path={`/b2/${build.slug}`}
        ogType="article"
        image={coverSrc ?? undefined}
        noIndex={build.status === "draft"}
      />
      {hidden.data ? (
        <div
          role="status"
          data-testid="build-hidden-banner"
          style={{ background: t.recess, color: t.text, borderRadius: r.panel, padding: "16px 24px", marginBottom: 12, fontFamily: FIGTREE }}
        >
          An admin has hidden this build.
        </div>
      ) : null}
      <BuildView
        fit="content"
        hero={{
          title: build.title,
          outcome: (build.outcome ?? "").trim(),
          shape: build.shape,
          viaConnector: createdVia.data?.source === "connector",
          cover: coverNode,
          credit: {
            rebuiltFrom: build.source_title_at_fork?.trim()
              ? { title: build.source_title_at_fork.trim(), handle: build.source_handle_at_fork?.trim() || null }
              : null,
            madeBy: makerLabel(record.maker),
          },
          delta,
        }}
        actions={{
          onCopyForAI: () => copyText(toMarkdown(toPortable(record))),
          onDownload: () => downloadPortable(record),
          onRebuild: () => navigate(isLoggedIn ? `/rebuild/${build.slug}` : loginBack(`/rebuild/${build.slug}`)),
          lineageTo: `/b2/${build.slug}/lineage`,
        }}
        proof={{
          build,
          lastRun: shortDate(build.last_confirmed_at),
          action: {
            kind: !isLoggedIn ? "sign-in" : viewerIsCreator ? "reconfirm" : "reproduce",
            onPress: () => (isLoggedIn ? setRunning(true) : navigate(loginBack(location.pathname))),
          },
          details: proofDetails(build, tree),
          completeness: completeness
            ? {
                score: completeness.score,
                publishAt: MINIMUM_PUBLISHABLE_SCORE,
                galleryAt: galleryThreshold(build.shape),
                next: completeness.missing[0]?.copy ?? null,
              }
            : null,
        }}
        anatomy={{
          parts,
          gaps: gaps.size,
          selectedId: selected?.id ?? null,
          onSelect: selectPart,
          full: (
            <AnatomyTree
              tree={tree}
              nodeTypes={nodeTypes}
              build={build}
              resolveNode={resolveNode}
              resolveMedia={resolveMedia}
              renderFooter={renderFooter}
            />
          ),
        }}
        viewer={{
          tabs: buildTabs(hasRebuilds),
          tab,
          onTabChange,
          mode,
          onModeChange,
          blurb: tab === "anatomy" || tabLayer(tab) ? LAYER_BLURB[mode] : null,
          content,
          onCopy: () =>
            copyText(
              selected
                ? (getNodeCopyText(selected, typesByKey.get(selected.type)) ?? (selected.note ?? "").trim()) || selected.title
                : null,
            ),
        }}
        timeline={{ ...timeline, onPlay: () => setTab("watch") }}
      />

      <RunDialog
        open={running}
        onOpenChange={setRunning}
        creator={viewerIsCreator}
        suggestions={(build.made_with ?? []).filter((entry) => entry.trim().length > 0)}
        initialModel={viewerIsCreator ? (build.last_confirmed_model ?? "") : ""}
        onSubmit={submitRun}
      />

      {/* Under the first screen, as they are until UI-P30: the comments and where next. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 24 }}>
        {isLoggedIn && !viewerIsCreator ? (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <CreditLine maker={null} onReport={() => setReporting({ type: "build", id: build.id })} />
          </div>
        ) : null}
        {build.status !== "draft" ? (
          <Comments
            build={{ id: build.id, slug: build.slug }}
            parts={numberParts(tree)}
            attachRequest={null}
            onOpenPart={selectPart}
          />
        ) : null}
        <WhereNext buildId={build.id} creatorId={build.creator_id} madeWith={build.made_with} />
      </div>
      <ReportDialog target={reporting} onClose={() => setReporting(null)} />
    </>
  );
}

export default BuildPage;
