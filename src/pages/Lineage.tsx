import { Helmet } from "react-helmet-async";
import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { RebuildFamily } from "@/components/build/RebuildTree";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { getBuildHeaderBySlug } from "@/lib/build";
import { isPermissionError } from "@/lib/errors/permission";
import { ring, skeletonStyle } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { body } from "@/lib/theme/type";

/* ────────────────────────────────────────────────────────────────────────────
   RC-P14 — /b2/:slug/lineage: every published rebuild in a build's family.

   LINEAGE IS THE REBUILD NOW. This page used to draw remix derivations from
   the remix lineage table through its RPC, a legacy idea over data the clear
   emptied. It resolves the slug to a build and draws that build's family of
   rebuilds — from the family's root (root_build_id, or the build itself), with
   the build marked "you are here" — the same tree the build page's Rebuilds
   tab draws under THE FAMILY.

   TWO ADDRESSES, ONE PAGE. /b2/:slug/lineage is the canonical one, beside the
   build page it belongs to. /b/:slug/lineage, the old address, lands there
   when its slug names a build; otherwise there is nothing at it to draw.

   The order is stated, never offered: oldest first within each generation.

   THE HEADER NAMES THE BUILD AND OPENS IT (RC-P14c). "Rebuilds of this" says
   nothing on its own to a reader who arrived from a link, and the build's own
   row in the tree says "you are here" and is not a link, so the page could not
   take a reader to the build it is about. The eyebrow names it; one text link
   at the trailing end of the title row opens it, as "Solvers" does on the
   bounties board.
   ──────────────────────────────────────────────────────────────────────────── */

export interface LineageProps {
  /** Mounted at the old /b/:slug/lineage address: move to the canonical one. */
  legacy?: boolean;
}

export default function Lineage({ legacy = false }: LineageProps) {
  const { slug = "" } = useParams<{ slug: string }>();
  const phone = useBreakpoint() === "mobile";

  const build = useQuery({
    queryKey: ["build-header-by-slug", slug],
    queryFn: () => getBuildHeaderBySlug(slug),
    enabled: slug !== "",
  });

  if (legacy && build.data) {
    return <Navigate to={`/b2/${encodeURIComponent(slug)}/lineage`} replace />;
  }

  const found = build.data ?? null;
  const title = found?.title?.trim() || "this build";

  return (
    /* The boards' frame: 24 around the page on the wide frame, which has no
       inset of its own; on a phone the frame's own 16 is the margin. */
    <div
      data-visual-slot="lineage-frame"
      style={phone ? { paddingTop: SPACE.sm } : { padding: SPACE.md }}
    >
      <Helmet>
        <title>{`Rebuilds of ${title} — buildgallery`}</title>
      </Helmet>

      <PageHeader
        eyebrow={found ? found.title?.trim() || "Untitled build" : undefined}
        title="Rebuilds of this"
        description="Every published rebuild in this family."
        actions={found ? <OpenBuildLink slug={found.slug} /> : undefined}
      />

      <div data-visual-slot="lineage-column" style={{ maxWidth: 720 }}>
        {build.error ? (
          <StateLine
            testId="lineage-error"
            sentence={isPermissionError(build.error) ? "You don't have access to this." : "Something went wrong."}
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() => void build.refetch()}
                style={{ background: "transparent" }}
              >
                Try again
              </Button>
            }
          />
        ) : build.isLoading ? (
          <div data-testid="lineage-loading" aria-hidden>
            <div style={{ ...skeletonStyle(), height: 44, maxWidth: 360 }} />
          </div>
        ) : !found ? (
          <StateLine
            testId="lineage-not-found"
            sentence="No build at this address."
            action={
              <Button asChild variant="outline" style={{ background: "transparent" }}>
                <Link to="/gallery">Browse the gallery</Link>
              </Button>
            }
          />
        ) : (
          <RebuildFamily
            rootId={found.root_build_id ?? found.id}
            currentId={found.id}
            empty={
              /* STATES.md row 19: one sentence, one action, secondary (row 2)
                 as on the boards, because the frame spends the primary. */
              <StateLine
                testId="lineage-empty"
                sentence="No rebuilds yet."
                action={
                  <Button asChild variant="outline" style={{ background: "transparent" }}>
                    <Link to={`/rebuild/${encodeURIComponent(found.slug)}`}>Rebuild this</Link>
                  </Button>
                }
              />
            }
          />
        )}
      </div>
    </div>
  );
}

/** The way to the build this family is drawn for: a text link, underlined at rest, 44 tall, the theme's ring. */
function OpenBuildLink({ slug }: { slug: string }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={`/b2/${encodeURIComponent(slug)}`}
      data-testid="lineage-open-build"
      {...handlers}
      style={{
        ...body,
        display: "inline-flex",
        alignItems: "center",
        minHeight: 44,
        color: t.text,
        textDecoration: "underline",
        textUnderlineOffset: "4px",
        textDecorationThickness: "1px",
        borderRadius: r.chip,
        ...ring(state.focusVisible),
      }}
    >
      Open the build
    </Link>
  );
}

function StateLine({
  testId,
  sentence,
  action,
}: {
  testId: string;
  sentence: string;
  action: ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: SPACE.sm,
        paddingBottom: SPACE.lg,
      }}
    >
      <p style={{ ...body, margin: 0, color: t.text2 }}>{sentence}</p>
      {action}
    </div>
  );
}
