// Convert to a build record — the affordance, and the surface it lives on.
//
// WHERE THIS SITS, AND WHY IT IS NOT ON THE POST PAGE
// ---------------------------------------------------
// The right home for this is the creator's own post detail page: they are
// looking at the thing being converted, and the offer belongs next to it.
// ContentDetail.tsx is on the existing content path and is out of bounds for
// this prompt — every component it imports is too — so the affordance takes
// the route the task names as the alternative: /convert/:contentItemId, its
// own page, outside NeoScaleShell, lazy-loaded, importing nothing from the
// content path but the block type labels. Nothing on the old path changed to
// make this reachable, and nothing on it has to change for it to work.
//
// WHAT A CREATOR SEES BEFORE THEY AGREE
// -------------------------------------
// Not "convert?" with a yes and a no, but the actual outcome: every block, the
// node type it becomes, and — for the ones that do not map — the reason they
// will be waiting in the tray instead. The plan is computed by the same pure
// function that writes the record, so the list is the write rather than a
// description of it.
//
// THE ORIGINAL IS NEVER AT RISK, AND THE PAGE SAYS SO
// ---------------------------------------------------
// The post stays published, unchanged, at its own URL. That is not a caveat in
// small print here: it is the first line, because a creator who thinks this
// might replace their post will not press the button, and they would be right
// not to.

import { useCallback, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  convertContentItem,
  findConversion,
  getNodeTypes,
  planConversion,
  readSource,
  type Build,
  type ConversionPlan,
  type NodePlan,
  type NodeType,
} from "@/lib/build";
import {
  CATEGORY_COLOUR,
  FONT_STACK,
  HAIRLINE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  VOID,
  bodyText,
  hexToRgba,
  labelText,
  pageHeadingText,
  panelGlass,
  titleText,
} from "./tokens";

interface ConvertLoad {
  plan: ConversionPlan;
  /** The post's creator. Only they may convert it. */
  creatorId: string;
  /** The draft an earlier conversion already made, if there is one. */
  existing: Build | null;
  nodeTypes: NodeType[];
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-visual-slot="convert-frame"
      style={{
        minHeight: "100vh",
        background: VOID,
        color: TEXT_PRIMARY,
        fontFamily: FONT_STACK,
        isolation: "isolate",
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "28px 20px 64px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Quiet({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>{children}</p>
  );
}

/** A link that reads as a link without being a button pretending to be one. */
function Plain({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      style={{ ...bodyText, color: TEAL, textDecoration: "none", borderBottom: `1px solid ${hexToRgba(TEAL, 0.35)}` }}
    >
      {children}
    </Link>
  );
}

/** One line of the preview: what this block becomes, and what it is called. */
function PlanRow({ node, nodeTypes }: { node: NodePlan; nodeTypes: NodeType[] }) {
  const type = nodeTypes.find((candidate) => candidate.key === node.type);
  const colour = type?.colour ?? CATEGORY_COLOUR[type?.category ?? ""] ?? TEXT_SECONDARY;

  return (
    <li style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span
          style={{
            ...labelText,
            color: colour,
            background: hexToRgba(colour, 0.15),
            padding: "2px 8px",
            borderRadius: 6,
            textTransform: "uppercase",
            fontSize: 11,
          }}
        >
          {type?.label ?? node.type}
        </span>
        <span style={{ ...bodyText, minWidth: 0, overflowWrap: "anywhere" }}>{node.title}</span>
      </div>

      {node.children.length > 0 ? (
        <span style={{ ...bodyText, fontSize: 12, color: TEXT_MUTED }}>
          {node.children.length} step{node.children.length === 1 ? "" : "s"} nested under it
        </span>
      ) : null}

      {node.trayReason ? (
        <span style={{ ...bodyText, fontSize: 12, color: TEXT_SECONDARY, overflowWrap: "anywhere" }}>
          {node.trayReason}
        </span>
      ) : null}
    </li>
  );
}

function Section({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        ...panelGlass,
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <h2 style={{ ...titleText, margin: 0 }}>{title}</h2>
      {blurb ? <Quiet>{blurb}</Quiet> : null}
      {children}
    </section>
  );
}

export default function ConvertPrompt() {
  const { contentItemId = "" } = useParams();
  const location = useLocation();
  const { user, isLoggedIn, loading: authLoading } = useAuth();

  const [converted, setConverted] = useState<Build | null>(null);
  const [isConverting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useQuery<ConvertLoad>({
    queryKey: ["convert-source", contentItemId],
    enabled: Boolean(contentItemId) && isLoggedIn,
    // A conversion is a deliberate act on a page the creator opened on
    // purpose. Refetching it behind them would change the plan under the
    // button they are about to press.
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const [source, existing, nodeTypes] = await Promise.all([
        readSource(contentItemId),
        findConversion(contentItemId),
        getNodeTypes(),
      ]);
      return {
        plan: planConversion(source),
        creatorId: source.item.creator_id,
        existing,
        nodeTypes,
      };
    },
  });

  const convert = useCallback(async () => {
    if (isConverting) return;
    setConverting(true);
    setError(null);
    try {
      setConverted(await convertContentItem(contentItemId));
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setConverting(false);
    }
  }, [contentItemId, isConverting]);

  if (authLoading) {
    return <Frame><Quiet>…</Quiet></Frame>;
  }

  if (!isLoggedIn) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(returnTo)}`} replace />;
  }

  const postUrl = `/content/${contentItemId}`;

  if (load.isLoading) {
    return <Frame><Quiet>Reading the post…</Quiet></Frame>;
  }

  if (load.isError || !load.data) {
    return (
      <Frame>
        <h1 style={{ ...pageHeadingText, margin: 0 }}>That post could not be read</h1>
        <Quiet>{load.error ? messageOf(load.error) : "It may have been removed."}</Quiet>
        <Plain to={postUrl}>Back to the post</Plain>
      </Frame>
    );
  }

  const { plan, creatorId, existing, nodeTypes } = load.data;

  // Only a creator converts their own post. The data layer refuses this too —
  // this is the version of the refusal that reads like a sentence.
  if (user?.id !== creatorId) {
    return (
      <Frame>
        <h1 style={{ ...pageHeadingText, margin: 0 }}>This post is not yours</h1>
        <Quiet>
          A post is converted by the person who wrote it. Nothing here changes
          what you can already read.
        </Quiet>
        <Plain to={postUrl}>Back to the post</Plain>
      </Frame>
    );
  }

  const draft = converted ?? existing;

  // Already converted — this run or an earlier one. Either way the answer is
  // the draft that exists, never a second one.
  if (draft) {
    return (
      <Frame>
        <Helmet>
          <title>Converted — NeoScale</title>
        </Helmet>
        <h1 style={{ ...pageHeadingText, margin: 0 }}>
          {converted ? "Converted" : "You have already converted this post"}
        </h1>
        <Quiet>
          {converted
            ? "The draft is yours to arrange and publish. Your post is untouched and still live."
            : "There is already a draft build from this post. Opening it is better than making a second one."}
        </Quiet>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <Plain to={`/compose/${draft.id}`}>Open the draft</Plain>
          <Plain to={postUrl}>Back to the post</Plain>
        </div>
      </Frame>
    );
  }

  const placed = plan.nodes.filter((node) => node.placed);
  const tray = plan.nodes.filter((node) => !node.placed);

  return (
    <Frame>
      <Helmet>
        <title>Convert to a build record — NeoScale</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <Link to={postUrl} style={{ ...labelText, color: TEXT_SECONDARY, textDecoration: "none" }}>
            ← Back to the post
          </Link>
        </div>
        <h1 style={{ ...pageHeadingText, margin: 0 }}>
          Convert “{plan.header.title}” to a build record
        </h1>
        <Quiet>
          This makes a second record beside your post: the same material as a
          tree of typed parts, which other people can follow, run and report
          back on. Your post keeps its page, its readers and every word of it.
        </Quiet>
      </header>

      <Section
        title="What comes across"
        blurb={`${plan.counts.blocks} block${plan.counts.blocks === 1 ? "" : "s"} → ${plan.counts.placed} in the tree, ${plan.counts.tray} in the tray${plan.counts.steps > 0 ? `, ${plan.counts.steps} nested steps` : ""}${plan.counts.fromPost > 0 ? `, ${plan.counts.fromPost} from the post itself` : ""}.`}
      >
        {placed.length > 0 ? (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {placed.map((node, index) => (
              <PlanRow key={`${node.blockId ?? "post"}-${index}`} node={node} nodeTypes={nodeTypes} />
            ))}
          </ul>
        ) : (
          <Quiet>
            Nothing in this post maps cleanly onto a node type. Everything will
            be waiting in the tray.
          </Quiet>
        )}
      </Section>

      {tray.length > 0 ? (
        <Section
          title="What waits in the tray"
          blurb="Nothing is thrown away and nothing is forced into a type it does not fit. These sit beside the workspace until you place them or drop them."
        >
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {tray.map((node, index) => (
              <PlanRow key={`${node.blockId ?? "post"}-tray-${index}`} node={node} nodeTypes={nodeTypes} />
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Worth knowing">
        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          {plan.notes.map((note) => (
            <li key={note} style={{ ...bodyText, color: TEXT_SECONDARY }}>
              {note}
            </li>
          ))}
        </ul>
      </Section>

      {error ? (
        <p style={{ ...bodyText, margin: 0, color: "#EF4444" }} role="alert">
          {error}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        {/* VISUAL SLOT — the primary button surface is supplied externally.
            Structure only here: pill geometry, disabled state, no surface. */}
        <span data-visual-slot="btn-primary" style={{ display: "inline-flex" }}>
          <button
            type="button"
            onClick={() => void convert()}
            disabled={isConverting}
            style={{
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.04em",
              height: 34,
              padding: "0 18px",
              borderRadius: 100,
              background: "rgba(255,255,255,0.025)",
              border: `1px solid ${hexToRgba(TEAL, 0.32)}`,
              color: isConverting ? TEXT_MUTED : TEAL,
              cursor: isConverting ? "wait" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {isConverting ? "Converting…" : "Convert to a build record"}
          </button>
        </span>

        <span style={{ ...bodyText, fontSize: 12, color: TEXT_MUTED }}>
          Makes a draft. Nothing is published, and nothing about your post
          changes.
        </span>
      </div>

      <div style={{ height: 1, background: HAIRLINE }} />
    </Frame>
  );
}
