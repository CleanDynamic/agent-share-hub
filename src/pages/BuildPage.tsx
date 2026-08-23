// The public build page: /b2/:slug.
//
// It renders OUTSIDE NeoScaleShell, as a sibling route with its own full-bleed
// frame. The shell's centre column is a hardcoded 600x775 panel inside a 3D
// card flip; a hero, a summary strip and five tabs do not fit in it. The route
// is lazy because this page pulls in the whole build record renderer and no
// other route needs it.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { getBuildBySlug } from "@/lib/build";
import type { BuildNode, BuildRecord, NodeTree } from "@/lib/build";
import { AnatomyTree } from "@/components/build/AnatomyTree";
import { BuildHeader } from "@/components/build/BuildHeader";
import { BuildTabs } from "@/components/build/BuildTabs";
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

  const { data, isLoading, isError, error } = useQuery<BuildRecord | null>({
    queryKey: ["build", slug],
    queryFn: () => getBuildBySlug(slug as string),
    enabled: Boolean(slug),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  // Above the early returns: hooks cannot be conditional.
  const nodesById = useMemo(() => indexTree(data?.tree ?? []), [data?.tree]);
  const resolveNode = useMemo(
    () => (id: string) => nodesById.get(id),
    [nodesById]
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

  return (
    <Frame>
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        <BuildHeader build={data.build} tree={data.tree} nodeTypes={data.nodeTypes} />
        <BuildTabs
          run={<RunView tree={data.tree} nodeTypes={data.nodeTypes} build={data.build} />}
        >
          <AnatomyTree
            tree={data.tree}
            nodeTypes={data.nodeTypes}
            build={data.build}
            resolveNode={resolveNode}
          />
        </BuildTabs>
      </div>
    </Frame>
  );
}
