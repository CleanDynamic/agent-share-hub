/* UI-P33 / UI-P37 — /bounties/:bountyId/solve: the solve panel, full width of the column, under the breadcrumb.

   STATES (UI-P37). Loading is the panel's own shape in bones; a read that fails says "That didn't load." with a retry —
   never the exception — and a bounty nobody can find says so with a way back. */

import React, { Suspense, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";

import { EmptyState } from "@/components/brand/EmptyState";
import { ErrorState } from "@/components/brand/ErrorState";
import { Panel } from "@/components/brand/Panel";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { SolvePanel } from "@/components/bounty/SolvePanel";
import type { ResolveMedia, ResolveNode } from "@/components/build/renderers";
import { getBounty, type Bounty } from "@/lib/bounty";
import { getBuild, getMediaForBuild, getNodeType } from "@/lib/build";
import type { Build, BuildNode } from "@/lib/build/types";
import { partsInOrder } from "@/pages/site/build/buildModel";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

/** The panel before it arrives: a head, the problem and the form, as bones. */
function SolveSkeleton() {
  return (
    <div style={{ padding: SPACE.md }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Panel padding="18px 20px">
          <LoadingRegion what="the ask" announce data-testid="solve-loading" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Skeleton width="60%" height={28} />
            <Skeleton height={96} radius={14} />
            <Skeleton height={140} radius={12} />
            <Skeleton width={160} height={44} radius={12} />
          </LoadingRegion>
        </Panel>
      </div>
    </div>
  );
}

/** Solve route for a specific bounty, showing the solve panel full-width. */
export default function BountySolveShowPage() {
  const { bountyId } = useParams<{ bountyId: string }>();
  const navigate = useNavigate();

  const bountyRecord = useQuery({
    queryKey: ["bounty-record", bountyId],
    queryFn: () => getBounty(bountyId as string),
    enabled: Boolean(bountyId),
  });

  const buildId = bountyRecord.data?.build?.id;
  const build = useQuery({
    queryKey: ["build", "getBuild", buildId],
    queryFn: () => getBuild(buildId as string),
    enabled: Boolean(buildId),
  });
  const media = useQuery({
    queryKey: ["build", "getMediaForBuild", buildId],
    queryFn: () => getMediaForBuild(buildId as string),
    enabled: Boolean(buildId),
  });

  const gapNode = useMemo(() => bountyRecord.data?.gapNode ?? null, [bountyRecord.data?.gapNode]);

  const nodeType = useQuery({
    queryKey: ["node-type", gapNode?.type],
    queryFn: () => getNodeType(gapNode?.type as string),
    enabled: Boolean(gapNode?.type),
  });

  const nodes = useMemo(() => new Map<string, BuildNode>(partsInOrder(build.data?.tree ?? []).map((node) => [node.id, node])), [build.data]);
  const mediaById = useMemo(() => new Map((media.data ?? []).map((row) => [row.id, row])), [media.data]);

  const resolveNode: ResolveNode = (nodeId) => nodes.get(nodeId);
  const resolveMedia: ResolveMedia = (mediaId) => (mediaId ? (mediaById.get(mediaId) ?? (media.isPending ? undefined : null)) : null);

  const failed = bountyRecord.isError ? bountyRecord : build.isError ? build : null;
  if (failed) {
    return (
      <div style={{ padding: SPACE.md }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <Panel padding="24px 24px">
            <h1 style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", margin: -1 }}>Solve</h1>
            <ErrorState
              panel="The ask"
              onRetry={() => {
                void bountyRecord.refetch();
                void build.refetch();
              }}
              error={failed.error}
              data-testid="solve-error"
            />
          </Panel>
        </div>
      </div>
    );
  }

  if (bountyRecord.isPending || (buildId && build.isPending)) return <SolveSkeleton />;

  if (!bountyRecord.data || !bountyRecord.data.build || !gapNode) {
    return (
      <div style={{ padding: SPACE.md }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <Panel padding="0 20px">
            <h1 style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", margin: -1 }}>Solve</h1>
            <EmptyState line="There is no open ask at this address." action={{ label: "Back to bounties", onClick: () => navigate("/bounties") }} />
          </Panel>
        </div>
      </div>
    );
  }

  const breadcrumbPart = gapNode.title || "Missing part";
  const buildTitle = bountyRecord.data.build.title;

  return (
    <>
      <Helmet>
        <title>Solve · {buildTitle} — buildgallery</title>
        <meta name="description" content={`Solve this gap: ${breadcrumbPart}`} />
      </Helmet>

      <div style={{ padding: SPACE.md }}>
        {/* Breadcrumb: Home / Bounties / {part} */}
        <nav aria-label="Breadcrumb" style={{ marginBottom: SPACE.md, fontFamily: FIGTREE, fontSize: 12, color: t.text2 }}>
          <Link to="/" style={{ color: t.action, textDecoration: "none" }}>
            Home
          </Link>
          <span aria-hidden="true">{" / "}</span>
          <Link to="/bounties" style={{ color: t.action, textDecoration: "none" }}>
            Bounties
          </Link>
          <span aria-hidden="true">{" / "}</span>
          <span aria-current="page" style={{ color: t.text }}>{breadcrumbPart}</span>
        </nav>

        <Suspense fallback={<SolveSkeleton />}>
          <SolvePanelFullWidth
            bounty={bountyRecord.data.bounty}
            build={bountyRecord.data.build}
            gapNode={gapNode}
            nodeType={nodeType.data}
            resolveNode={resolveNode}
            resolveMedia={resolveMedia}
            onSolved={() => navigate("/bounties")}
          />
        </Suspense>
      </div>
    </>
  );
}

/** SolvePanel displayed in full-width mode (not as a sheet). */
interface SolvePanelFullWidthProps {
  bounty: Bounty;
  build: Build;
  gapNode: BuildNode;
  nodeType?: Awaited<ReturnType<typeof getNodeType>>;
  resolveNode: ResolveNode;
  resolveMedia: ResolveMedia;
  onSolved: () => void;
}

function SolvePanelFullWidth({ bounty, build, gapNode, nodeType, resolveNode, resolveMedia, onSolved }: SolvePanelFullWidthProps) {
  const [open, setOpen] = React.useState(true);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", fontFamily: FIGTREE }}>
      <SolvePanel
        open={open}
        onOpenChange={setOpen}
        bounty={bounty}
        build={build}
        gapNode={gapNode}
        nodeType={nodeType}
        resolveNode={resolveNode}
        resolveMedia={resolveMedia}
        onChanged={(change) => {
          if (change === "accepted") onSolved();
        }}
      />
    </div>
  );
}
