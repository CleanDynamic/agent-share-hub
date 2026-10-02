import React, { Suspense, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";

import { SolvePanel } from "@/components/bounty/SolvePanel";
import { getBounty, type Bounty } from "@/lib/bounty";
import { getBuild } from "@/lib/build";
import type { BuildNode, Build } from "@/lib/build/types";
import {
  type ResolveMedia,
  type ResolveNode,
} from "@/components/build/renderers";
import { getNodeType } from "@/lib/build/registry";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

/** Solve route for a specific bounty, showing the solve panel full-width. */
export default function BountySolveShowPage() {
  const { bountyId } = useParams<{ bountyId: string }>();
  const navigate = useNavigate();

  const bountyRecord = useQuery({
    queryKey: ["bounty-record", bountyId],
    queryFn: () => (bountyId ? getBounty(bountyId) : Promise.reject("No bounty ID")),
    enabled: !!bountyId,
  });

  const build = useQuery({
    queryKey: ["build", bountyRecord.data?.build?.id],
    queryFn: () => (bountyRecord.data?.build?.id ? getBuild(bountyRecord.data.build.id) : Promise.reject("No build")),
    enabled: !!bountyRecord.data?.build?.id,
  });

  const gapNode = useMemo(() => bountyRecord.data?.gapNode || null, [bountyRecord.data?.gapNode]);

  const nodeType = useQuery({
    queryKey: ["node-type", gapNode?.type],
    queryFn: () => (gapNode?.type ? getNodeType(gapNode.type) : undefined),
    enabled: !!gapNode?.type,
  });

  const buildNodes = useMemo(
    () => (build.data ? new Map((build.data.nodes ?? []).map((n) => [n.id, n])) : new Map()),
    [build.data]
  );

  const buildMedia = useMemo(
    () => (build.data ? new Map((build.data.media ?? []).map((m) => [m.id, m])) : new Map()),
    [build.data]
  );

  const resolveNode: ResolveNode = (nodeId) => buildNodes.get(nodeId) || null;
  const resolveMedia: ResolveMedia = (mediaId) => buildMedia.get(mediaId) || null;

  const isLoading = bountyRecord.isLoading || build.isLoading;
  const error = bountyRecord.error || build.error;

  if (error) {
    return (
      <div style={{ padding: SPACE.md, textAlign: "center" }}>
        <h1 style={{ color: t.text }}>Error</h1>
        <p style={{ color: t.text2 }}>{error instanceof Error ? error.message : "An error occurred"}</p>
        <Link to="/bounties" style={{ color: t.action, textDecoration: "underline" }}>
          Back to bounties
        </Link>
      </div>
    );
  }

  if (isLoading || !bountyRecord.data || !bountyRecord.data.build || !gapNode) {
    return (
      <div style={{ padding: SPACE.md, textAlign: "center" }}>
        <p style={{ color: t.text2 }}>Loading...</p>
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
        <div style={{ marginBottom: SPACE.md, fontFamily: FIGTREE, fontSize: 12, color: t.text2 }}>
          <Link to="/" style={{ color: t.action, textDecoration: "none" }}>
            Home
          </Link>
          {" / "}
          <Link to="/bounties" style={{ color: t.action, textDecoration: "none" }}>
            Bounties
          </Link>
          {" / "}
          <span style={{ color: t.text }}>{breadcrumbPart}</span>
        </div>

        {/* Solve panel displayed full-width, not as a sheet */}
        <Suspense fallback={<div style={{ color: t.text2 }}>Loading...</div>}>
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

/**
 * SolvePanel displayed in full-width mode (not as a sheet).
 * This renders the solve interface without the Sheet wrapper.
 */
interface SolvePanelFullWidthProps {
  bounty: Bounty;
  build: Build;
  gapNode: BuildNode;
  nodeType?: Awaited<ReturnType<typeof getNodeType>>;
  resolveNode: ResolveNode;
  resolveMedia: ResolveMedia;
  onSolved: () => void;
}

function SolvePanelFullWidth({
  bounty,
  build,
  gapNode,
  nodeType,
  resolveNode,
  resolveMedia,
  onSolved,
}: SolvePanelFullWidthProps) {
  const [open, setOpen] = React.useState(true);

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        fontFamily: FIGTREE,
      }}
    >
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
          if (change === "accepted") {
            onSolved();
          }
        }}
      />
    </div>
  );
}
