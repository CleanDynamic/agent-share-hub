// The public build page: /b2/:slug.
//
// It renders OUTSIDE NeoScaleShell, as a sibling route with its own full-bleed
// frame. The shell's centre column is a hardcoded 600x775 panel inside a 3D
// card flip; a hero, a summary strip and five tabs do not fit in it. The route
// is lazy because this page pulls in the whole build record renderer and no
// other route needs it.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  getApprovedLayers,
  getBuildBySlug,
  getMediaForBuild,
  layerOf,
  listRebuilds,
  nodeMediaId,
} from "@/lib/build";
import type {
  BuildLayer,
  BuildMedia,
  BuildNode,
  BuildRecord,
  NodeTree,
  RebuildSummary,
} from "@/lib/build";
import { AnatomyTree } from "@/components/build/AnatomyTree";
import {
  MEDIA_WIDTH,
  useMediaSrc,
  type ResolveMedia,
} from "@/components/build/MediaFigure";
import { BuildHeader, type HeroMedia } from "@/components/build/BuildHeader";
import { BreakageView } from "@/components/build/BreakageView";
import { BuildTabs } from "@/components/build/BuildTabs";
import { ForkAttribution } from "@/components/build/ForkAttribution";
import { LayerView, RunItPanel } from "@/components/build/LayerView";
import { ForkControl, useForkBuild } from "@/components/build/ForkControl";
import { PortableExport } from "@/components/build/PortableExport";
import { ReproductionAction } from "@/components/build/ReproductionAction";
import { RebuildCount, RebuildsTab } from "@/components/build/RebuildsTab";
import { Replay } from "@/components/build/Replay";
import { RunView } from "@/components/build/RunView";
import {
  FONT_STACK,
  HAIRLINE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  VOID,
  bodyText,
  headingText,
  labelText,
  panelGlass,
} from "@/components/build/tokens";

/** The app's QueryClient defaults to staleTime 0. A build record does not
 *  change while a reader is looking at it, so refetching on focus is waste. */
const STALE_TIME = 60_000;

/**
 * Every placed node by id, flattened once.
 *
 * This is what backs resolveNode: a renderer that meets a node_id reference —
 * an agent's tool, an eval's dataset, a prompt's output — turns it into the
 * referenced node's title without a query. Renderers never call Supabase, so
 * the page hands them the tree it has already loaded.
 *
 * Tray nodes are deliberately absent. They are unplaced by definition and
 * nothing public renders them, so a reference into the tray resolves to
 * nothing rather than leaking an unpublished title.
 */
function indexTree(tree: NodeTree[]): Map<string, BuildNode> {
  const index = new Map<string, BuildNode>();
  const walk = (nodes: NodeTree[]) => {
    for (const node of nodes) {
      index.set(node.id, node);
      if (node.children.length > 0) walk(node.children);
    }
  };
  walk(tree);
  return index;
}

/**
 * Every media row on the build, by id, from ONE query.
 *
 * This is the whole reason resolveMedia is a prop rather than a hook inside
 * MediaFigure: a build page with twenty screenshots asks the database for its
 * media once, not twenty times. Nothing below this component queries media.
 */
function indexMedia(media: BuildMedia[]): Map<string, BuildMedia> {
  return new Map(media.map((row) => [row.id, row]));
}

/**
 * The hero node's payload with a loadable media URL written into it.
 *
 * BuildHeader has read hero_node_id since NS-P04 and takes the src straight
 * off the node's payload — it knows nothing about build_media and does not
 * need to. So the page resolves the hero's media id, signs it at hero width,
 * and hands the header a tree whose hero node carries the result as
 * `media_url`. The header is unchanged by this prompt, and a build whose hero
 * is a live_app still takes the live_url path inside it.
 *
 * Only the hero node is copied. Every other node in the tree comes back by
 * reference, so the anatomy below does not re-render because the hero's
 * signature arrived.
 */
function withHeroMedia(
  tree: NodeTree[],
  heroNodeId: string | null,
  src: string | null
): NodeTree[] {
  if (!heroNodeId || !src) return tree;

  let done = false;
  const walk = (nodes: NodeTree[]): NodeTree[] => {
    if (done) return nodes;
    let touched = false;
    const next = nodes.map((node) => {
      if (node.id === heroNodeId) {
        done = true;
        touched = true;
        const payload =
          node.payload && typeof node.payload === "object" && !Array.isArray(node.payload)
            ? (node.payload as Record<string, unknown>)
            : {};
        return { ...node, payload: { ...payload, media_url: src } as NodeTree["payload"] };
      }
      const children = walk(node.children);
      if (children !== node.children) {
        touched = true;
        return { ...node, children };
      }
      return node;
    });
    return touched ? next : nodes;
  };

  return walk(tree);
}

function trimmed(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return text.length > 0 ? text : null;
}

/** The creator's own description of the picture, when the payload carries one. */
function payloadCaption(node: BuildNode | undefined): string | null {
  const payload =
    node?.payload && typeof node.payload === "object" && !Array.isArray(node.payload)
      ? (node.payload as Record<string, unknown>)
      : null;
  const caption = payload?.caption;
  return typeof caption === "string" ? trimmed(caption) : null;
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-visual-slot="build-page-frame"
      style={{
        minHeight: "100vh",
        background: VOID,
        color: TEXT_PRIMARY,
        fontFamily: FONT_STACK,
      }}
    >
      <div
        style={{
          ...panelGlass,
          borderLeft: "none",
          borderRight: "none",
          borderTop: "none",
          position: "sticky",
          top: 0,
          zIndex: 2,
        }}
      >
        <div
          style={{
            maxWidth: 880,
            margin: "0 auto",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Link
            to="/"
            style={{ ...labelText, color: TEXT_SECONDARY, textDecoration: "none" }}
          >
            ← NeoScale
          </Link>
        </div>
      </div>

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "32px 24px 96px" }}>
        {children}
      </main>
    </div>
  );
}

function Message({ heading, detail }: { heading: string; detail: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "72px 0",
        borderTop: `1px solid ${HAIRLINE}`,
      }}
    >
      <h1 style={{ ...headingText, margin: 0 }}>{heading}</h1>
      <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>{detail}</p>
    </div>
  );
}

export default function BuildPage() {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();

  // The tab strip is controlled from here so that a breakage can send the
  // reader into the replay at the step it broke.
  const [tab, setTab] = useState("anatomy");

  /**
   * A one-shot jump request for the replay.
   *
   * Set on the way into the Watch tab and cleared on the very next commit, so
   * that asking for the same ordinal twice in a row is two jumps rather than
   * one. Child effects flush before parent effects, so the replay has already
   * read the ordinal by the time this clears it.
   */
  const [jumpTo, setJumpTo] = useState<number | null>(null);
  useEffect(() => {
    if (jumpTo !== null) setJumpTo(null);
  }, [jumpTo]);

  const openReplayAt = useCallback((ordinal: number) => {
    setJumpTo(ordinal);
    setTab("watch");
  }, []);

  /**
   * A reproduction has landed, and the header the database now holds.
   *
   * Written straight into the record the page is already rendering, so the
   * count moves the moment the sheet closes. Only the build half is replaced —
   * the tree, the tray and the events are untouched by a reproduction, and
   * refetching the whole record to move one integer would rebuild the page
   * under the reader.
   */
  /**
   * A step of a generated layer naming the node it explains.
   *
   * The Anatomy tab is untouched by this prompt, so the jump is made from the
   * outside: switch to the tab, then find the card by the data-node-id every
   * NodeCard has carried since NS-P04 and scroll it into view. Nothing about
   * the anatomy has to know a layer exists.
   */
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingNodeId) return;
    const frame = window.requestAnimationFrame(() => {
      const escaped =
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(pendingNodeId)
          : pendingNodeId;
      const card = document.querySelector(`[data-node-id="${escaped}"]`);
      // jsdom has no layout, so scrollIntoView is not always there to call.
      if (card && typeof card.scrollIntoView === "function") {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setPendingNodeId(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingNodeId]);

  const openNodeInAnatomy = useCallback((nodeId: string) => {
    setTab("anatomy");
    setPendingNodeId(nodeId);
  }, []);

  const onReproductionRecorded = useCallback(
    (build: BuildRecord["build"]) => {
      queryClient.setQueryData<BuildRecord | null>(["build", slug], (record) =>
        record ? { ...record, build } : record
      );
    },
    [queryClient, slug]
  );

  const { data, isLoading, isError, error } = useQuery<BuildRecord | null>({
    queryKey: ["build", slug],
    queryFn: () => getBuildBySlug(slug as string),
    enabled: Boolean(slug),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  const buildId = data?.build.id;

  /**
   * The build's media. ONE query for the page, whatever it holds.
   *
   * Separate from the record query rather than folded into getBuildBySlug so
   * that a build with no media pays nothing for it, and so the media can be
   * refetched after an upload without reloading the whole record.
   */
  const { data: media, isPending: mediaPending } = useQuery<BuildMedia[]>({
    queryKey: ["build-media", buildId],
    queryFn: () => getMediaForBuild(buildId as string),
    enabled: Boolean(buildId),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  /**
   * The generated layers this build's creator has APPROVED.
   *
   * A separate query key from the compose workspace's, and a separate function:
   * getApprovedLayers filters approved = true in the request, so unapproved
   * text never arrives in a reader's browser at all. A build with no approved
   * layer answers with an empty array and costs one small indexed read.
   */
  const { data: layers } = useQuery<BuildLayer[]>({
    queryKey: ["build-layers-approved", buildId],
    queryFn: () => getApprovedLayers(buildId as string),
    enabled: Boolean(buildId),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  /**
   * The published rebuilds of this build (NS-P40).
   *
   * ONE QUERY SERVES THREE SURFACES: the Rebuilds tab's rows, the count beside
   * the reproduction count, and the divergence markers on the replay scrubber.
   * Fetching it once here rather than in each of the three is the same rule the
   * media query follows, and it is why the marker row can never disagree with
   * the tab about which rebuilds exist.
   *
   * It runs on every build page rather than only where builds.rebuild_count is
   * already above zero. The counter is maintained by a trigger and is right in
   * every path the application takes, but it is denormalised, the NS-P36
   * migration documents an insert path that can undercount it, and gating the
   * fetch on it would let one stale integer hide a real rebuild from its
   * source's own page. One indexed read against a partial index, on a page that
   * already makes four, is the cheaper mistake.
   */
  const { data: rebuilds } = useQuery<RebuildSummary[]>({
    queryKey: ["build-rebuilds", buildId],
    queryFn: () => listRebuilds(buildId as string),
    enabled: Boolean(buildId),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  const runLayer = layerOf(layers ?? [], "run");
  const understandLayer = layerOf(layers ?? [], "understand");

  // Above the early returns: hooks cannot be conditional.
  const forkState = useForkBuild(data?.build);
  const nodesById = useMemo(() => indexTree(data?.tree ?? []), [data?.tree]);
  const resolveNode = useMemo(
    () => (id: string) => nodesById.get(id),
    [nodesById]
  );

  const mediaById = useMemo(() => indexMedia(media ?? []), [media]);
  const resolveMedia = useMemo<ResolveMedia>(
    () => (id) => {
      if (!id) return null;
      // undefined until the query settles, so a figure holds its slot instead
      // of announcing that an image which is on its way is unavailable.
      return mediaById.get(id) ?? (mediaPending ? undefined : null);
    },
    [mediaById, mediaPending]
  );

  // The hero: whatever hero_node_id points at, resolved through the same one
  // query.
  //
  // A VIDEO HERO IS NOW A PLAYER, not a still (NS-P31). Both are signed: the
  // poster because it is what fills the slot before anyone presses play, and
  // the video because a recording at the top of a build is the thing a reader
  // came to watch. A video with no poster still plays; it simply opens black.
  const heroNodeId = data?.build.hero_node_id ?? null;
  const heroMedia = resolveMedia(nodeMediaId(heroNodeId ? nodesById.get(heroNodeId) : undefined));
  const heroVideo = heroMedia?.kind === "video" ? heroMedia : null;
  const heroImage =
    heroMedia?.kind === "image"
      ? heroMedia
      : heroMedia?.poster_path
        ? { bucket: heroMedia.bucket, path: heroMedia.poster_path, kind: "image" as const }
        : null;
  const heroSrc = useMediaSrc(heroImage, MEDIA_WIDTH.hero);
  const heroVideoSrc = useMediaSrc(heroVideo, MEDIA_WIDTH.hero);

  // What the header is told about the hero: what it is, and what to call it.
  // A caption is the creator's own words for the picture; the node's title is
  // its words for the step, and the build's title is the floor.
  const hero = useMemo<HeroMedia | undefined>(() => {
    const node = heroNodeId ? nodesById.get(heroNodeId) : undefined;
    const alt =
      payloadCaption(node) ??
      trimmed(node?.title) ??
      trimmed(data?.build.title) ??
      "Build hero";

    if (heroVideo && heroVideoSrc) {
      return { kind: "video", src: heroVideoSrc, poster: heroSrc, alt };
    }
    if (heroSrc) return { kind: "image", src: heroSrc, alt };
    return undefined;
  }, [data?.build.title, heroNodeId, heroSrc, heroVideo, heroVideoSrc, nodesById]);
  const treeWithHero = useMemo(
    () => withHeroMedia(data?.tree ?? [], heroNodeId, heroSrc),
    [data?.tree, heroNodeId, heroSrc]
  );

  if (isLoading) {
    return (
      <Frame>
        <p style={{ ...bodyText, color: TEXT_MUTED, padding: "72px 0", margin: 0 }}>
          Loading the build…
        </p>
      </Frame>
    );
  }

  if (isError) {
    return (
      <Frame>
        <Message
          heading="This build could not be loaded"
          detail={
            error instanceof Error
              ? error.message
              : "Something went wrong fetching the record. Try again in a moment."
          }
        />
      </Frame>
    );
  }

  if (!data) {
    return (
      <Frame>
        <Message
          heading="No build at this address"
          detail={`Nothing is published at /b2/${slug ?? ""}. It may have been unpublished, or the link may be wrong.`}
        />
      </Frame>
    );
  }

  /**
   * The number beside the reproduction count.
   *
   * builds.rebuild_count is the earned figure and the one the gallery card
   * shows, so it leads — it is uncapped, while the list above is not. Where the
   * counter has drifted BELOW what the list actually found, the list wins: a
   * tab listing two rebuilds beside a header saying none is worse than either
   * number on its own.
   */
  const found = (rebuilds ?? []).length;
  const rebuildCount = Math.max(data.build.rebuild_count ?? 0, found);

  return (
    <Frame>
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {/* Above the build, not under it: a reader meets the provenance before
            they meet the work. */}
        <ForkAttribution build={data.build} record={data} />
        <BuildHeader
          build={data.build}
          tree={treeWithHero}
          nodeTypes={data.nodeTypes}
          hero={hero}
          actions={
            <>
              <PortableExport record={data} />
              <ForkControl state={forkState} />
            </>
          }
          reproduction={
            <ReproductionAction
              build={data.build}
              onRecorded={onReproductionRecorded}
            />
          }
          rebuilds={
            <RebuildCount
              count={rebuildCount}
              onOpen={() => setTab("rebuilds")}
            />
          }
        />
        <BuildTabs
          active={tab}
          onActiveChange={setTab}
          watch={
            <Replay
              build={data.build}
              events={data.events}
              nodeTypes={data.nodeTypes}
              resolveNode={resolveNode}
              resolveMedia={resolveMedia}
              focusOrdinal={jumpTo}
              onFork={forkState.fork}
              forkPending={forkState.pending}
            />
          }
          run={
            runLayer ? (
              <RunItPanel
                sequence={
                  <RunView tree={data.tree} nodeTypes={data.nodeTypes} build={data.build} />
                }
                layer={runLayer}
                resolveNode={resolveNode}
                onOpenNode={openNodeInAnatomy}
              />
            ) : (
              <RunView tree={data.tree} nodeTypes={data.nodeTypes} build={data.build} />
            )
          }
          understand={
            understandLayer ? (
              <LayerView
                layer={understandLayer}
                resolveNode={resolveNode}
                onOpenNode={openNodeInAnatomy}
              />
            ) : undefined
          }
          rebuilds={
            (rebuilds ?? []).length > 0 ? <RebuildsTab rebuilds={rebuilds ?? []} /> : undefined
          }
          broke={
            <BreakageView
              build={data.build}
              events={data.events}
              tree={data.tree}
              nodeTypes={data.nodeTypes}
              resolveNode={resolveNode}
              resolveMedia={resolveMedia}
              onOpenReplay={openReplayAt}
            />
          }
        >
          <AnatomyTree
            tree={data.tree}
            nodeTypes={data.nodeTypes}
            build={data.build}
            resolveNode={resolveNode}
            resolveMedia={resolveMedia}
          />
        </BuildTabs>
      </div>
    </Frame>
  );
}
