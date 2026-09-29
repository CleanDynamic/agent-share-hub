import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { getBuildFamily, type RebuildTreeNode } from "@/lib/build";
import { isPermissionError } from "@/lib/errors/permission";
import { ring, skeletonStyle } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, body, tabular } from "@/lib/theme/type";

/* ────────────────────────────────────────────────────────────────────────────
   RC-P14 — a build's family of rebuilds, drawn as a tree.

   THE FAMILY IS A SEQUENCE DRAWN WITH A CONNECTING LINE ⟦law-of-continuity ›
   Timelines; indentation⟧. Each generation is an ordered list inside its
   parent's row, indented 24 through padding-inline-start ⟦better-layout ›
   Align to shared edges⟧, with a 1px --line rule on its leading side: the
   rule is the path from a build to its rebuilds, and the indent is the second
   axis that says "one generation on". Siblings keep the order they arrived in,
   oldest first.

   A ROW: the title, linking to that build's page; who made it; how many
   reproduced it, in DM Mono with tabular figures; and, when the rebuilder
   wrote one, their note on one clamped line after a "Δ", in DM Mono 12
   ⟦buildgallery-theme › Rebuild credit⟧. The build being viewed is marked
   "you are here" and is not a link: it is where the reader already is.

   BELOW 768 THE INDENT STOPS GROWING AFTER DEPTH 4 ⟦responsive-design⟧: five
   indents already spend 120 of a 358px column. Deeper rows sit at depth 4's
   edge and say "depth n" instead, so a deep family never scrolls sideways.
   ──────────────────────────────────────────────────────────────────────────── */

/** Each generation's indent, and the deepest level a phone indents. */
const INDENT = 24;
const PHONE_INDENT_DEPTH = 4;

/** How many placeholder rows stand in for the family while it loads. */
const LOADING_ROWS = 3;

/** DM Mono 12 on --text2: the "you are here", "depth n" and note lines. */
const mono12 = {
  fontFamily: DM_MONO,
  fontSize: 12,
  fontWeight: 400,
  lineHeight: 1.4,
  color: t.text2,
} as const;

function makerName(node: RebuildTreeNode): string {
  const maker = node.maker;
  return (
    maker?.display_name?.trim() || (maker?.username ? `@${maker.username}` : "") || "a maker"
  );
}

export interface RebuildTreeProps {
  /** The family's root, nested (buildTree / getBuildFamily). */
  root: RebuildTreeNode;
  /** The build the reader is on: marked "you are here", not linked. */
  currentId: string;
}

/** The family, drawn. Presentational: the rows it is handed and nothing else. */
export function RebuildTree({ root, currentId }: RebuildTreeProps) {
  const phone = useBreakpoint() === "mobile";
  return (
    <ol
      data-testid="rebuild-tree"
      aria-label="The family of rebuilds, oldest first"
      style={{ listStyle: "none", margin: 0, padding: 0 }}
    >
      <TreeItem node={root} currentId={currentId} phone={phone} />
    </ol>
  );
}

function TreeItem({
  node,
  currentId,
  phone,
}: {
  node: RebuildTreeNode;
  currentId: string;
  phone: boolean;
}) {
  const childDepth = node.depth + 1;
  /* The children's list indents unless it is past a phone's last indent. */
  const indents = !phone || childDepth <= PHONE_INDENT_DEPTH;

  return (
    <li data-testid="rebuild-tree-row" data-depth={node.depth} style={{ margin: 0 }}>
      <TreeRow node={node} current={node.id === currentId} phone={phone} />
      {node.children.length > 0 ? (
        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            ...(indents
              ? { paddingInlineStart: INDENT, borderInlineStart: `1px solid ${t.line}` }
              : {}),
          }}
        >
          {node.children.map((child) => (
            <TreeItem key={child.id} node={child} currentId={currentId} phone={phone} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function TreeRow({
  node,
  current,
  phone,
}: {
  node: RebuildTreeNode;
  current: boolean;
  phone: boolean;
}) {
  const title = node.title?.trim() || "Untitled build";
  const count = node.reproduction_count ?? 0;
  const note = node.rebuild_note?.replace(/\s+/g, " ").trim() || null;

  return (
    <div
      data-current={current ? "true" : undefined}
      style={{ display: "flex", flexDirection: "column", paddingBlock: SPACE.xs, minWidth: 0 }}
    >
      {phone && node.depth > PHONE_INDENT_DEPTH ? (
        <span data-testid="rebuild-tree-depth" style={mono12}>
          depth {node.depth}
        </span>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: SPACE.xs }}>
        {current ? (
          <>
            <span
              data-testid="rebuild-tree-title"
              aria-current="true"
              style={{ ...body, fontWeight: 600, color: t.text, minHeight: 44, display: "inline-flex", alignItems: "center" }}
            >
              {title}
            </span>
            <span data-testid="rebuild-tree-here" style={mono12}>
              you are here
            </span>
          </>
        ) : (
          <TitleLink slug={node.slug}>{title}</TitleLink>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: SPACE.xs }}>
        <span style={{ ...body, color: t.text2 }}>{makerName(node)}</span>
        <span
          data-testid="rebuild-tree-reproduced"
          style={{
            fontFamily: DM_MONO,
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.45,
            ...tabular,
            color: count > 0 ? t.evidence : t.text2,
          }}
        >
          {count} reproduced
        </span>
      </div>

      {note ? (
        <span
          data-testid="rebuild-tree-note"
          title={note}
          style={{
            ...mono12,
            display: "block",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          Δ {note}
        </span>
      ) : null}
    </div>
  );
}

/** A title that opens its build: underlined at rest, 44 tall, the theme's ring. */
function TitleLink({ slug, children }: { slug: string; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={`/b2/${slug}`}
      data-testid="rebuild-tree-title"
      {...handlers}
      style={{
        ...body,
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        minHeight: 44,
        color: t.text,
        textDecoration: "underline",
        textDecorationThickness: "1px",
        textUnderlineOffset: "4px",
        textDecorationColor: t.line,
        borderRadius: r.chip,
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </Link>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   The family, fetched: loading, refused, drawn, or nothing to draw.
   ──────────────────────────────────────────────────────────────────────────── */

export interface RebuildFamilyProps {
  /** The family's root: root_build_id, or the build itself when it has none. */
  rootId: string;
  /** The build the reader is on. */
  currentId: string;
  /**
   * What to show when the family is only this build (nobody has rebuilt any of
   * it). Nothing, when not given.
   */
  empty?: ReactNode;
}

export function RebuildFamily({ rootId, currentId, empty = null }: RebuildFamilyProps) {
  const family = useQuery({
    queryKey: ["rebuild-family", rootId, currentId],
    queryFn: () => getBuildFamily({ rootId, currentId }),
  });

  /* STATES.md row 21: a refusal is its own sentence, never an empty family. */
  if (family.error) {
    return (
      <div
        data-testid="rebuild-family-error"
        style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: SPACE.sm }}
      >
        <p style={{ ...body, margin: 0, color: t.text2 }}>
          {isPermissionError(family.error) ? "You don't have access to this." : "Something went wrong."}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void family.refetch()}
          style={{ background: "transparent" }}
        >
          Try again
        </Button>
      </div>
    );
  }

  /* STATES.md row 20: the rows' shape, indented as a family is. */
  if (family.isLoading) {
    return (
      <div data-testid="rebuild-family-loading" aria-hidden>
        {Array.from({ length: LOADING_ROWS }, (_, index) => (
          <div
            key={index}
            style={{
              paddingBlock: SPACE.xs,
              paddingInlineStart: index === 0 ? 0 : INDENT,
            }}
          >
            <div style={{ ...skeletonStyle(), height: 44, maxWidth: 360 }} />
          </div>
        ))}
      </div>
    );
  }

  const root = family.data ?? null;
  if (!root || root.children.length === 0) return <>{empty}</>;
  return <RebuildTree root={root} currentId={currentId} />;
}

export default RebuildTree;
