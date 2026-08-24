// One build, as a card.
//
// THE FIGURE THAT LEADS IS THE REPRODUCTION COUNT, and that is the whole
// editorial position of this page in one design decision. Not views, not
// likes, not how recently it was posted: how many people who are not the
// creator ran the thing and said what happened. It is the only number on the
// platform that cannot be self-served — the database refuses a creator's
// reproduction of their own build — and so it is the only one worth putting
// first.
//
// Beneath the title sits the freshness line, in the same words the build page
// uses: "last confirmed working 3 days ago, on Sonnet 4.5". A card that leads
// with a big number and says nothing about when is a card that ages badly.
//
// The body is chosen by SHAPE and nothing else. Which body a shape gets is the
// table below; what each one does when the material is thin is cardBodies.tsx's
// business, and every one of them ends somewhere that renders.

import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import {
  HAIRLINE,
  ORANGE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  cardGlass,
  hexToRgba,
  labelText,
} from "@/components/build/tokens";
import {
  freshnessLabel,
  isStale,
  type BuildShape,
  type GalleryBuild,
} from "@/lib/build";
import {
  AppCardBody,
  DefaultCardBody,
  MediaCardBody,
  PromptCardBody,
  StudyCardBody,
  type CardBodyProps,
} from "./cardBodies";
import type { MediaSrcMap } from "./cardMedia";

/**
 * Shape to body. Five bodies, nine shapes: agent and workflow are apps as far
 * as a card is concerned — something deployed, with a link and a screenshot —
 * and dataset, technique and other have no card-shaped summary of their own, so
 * they take the default chain.
 */
const BODY_FOR_SHAPE: Partial<
  Record<BuildShape, (props: CardBodyProps) => ReactElement>
> = {
  app: AppCardBody,
  agent: AppCardBody,
  workflow: AppCardBody,
  prompt: PromptCardBody,
  study: StudyCardBody,
  media: MediaCardBody,
};

export interface GalleryCardProps {
  build: GalleryBuild;
  /** Signed once for the whole page, never per card. */
  srcByPath: MediaSrcMap;
}

export function GalleryCard({ build, srcByPath }: GalleryCardProps) {
  const Body =
    BODY_FOR_SHAPE[(build.shape ?? "other") as BuildShape] ?? DefaultCardBody;

  const count = build.reproduction_count ?? 0;
  const freshness = freshnessLabel(build);
  const stale = isStale(build);
  const promoted = build.status === "gallery";

  return (
    <Link
      to={`/b2/${build.slug}`}
      data-visual-slot="gallery-card"
      data-build-shape={build.shape ?? "other"}
      style={{
        ...cardGlass,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 14,
        textDecoration: "none",
        color: TEXT_PRIMARY,
      }}
    >
      <Body build={build} srcByPath={srcByPath} />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1.3,
              color: TEXT_PRIMARY,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {(build.title ?? "").trim() || "Untitled build"}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 300,
              lineHeight: 1.4,
              color: stale ? TEXT_MUTED : TEXT_SECONDARY,
            }}
          >
            {freshness ?? "not confirmed by anyone yet"}
          </p>
        </div>

        <ReproductionFigure count={count} stale={stale} />
      </div>

      {(build.made_for?.length ?? 0) > 0 || promoted ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            paddingTop: 10,
            borderTop: `1px solid ${HAIRLINE}`,
          }}
        >
          {promoted ? (
            <span
              style={{
                ...labelText,
                fontSize: 10.5,
                color: TEAL,
                padding: "1px 6px",
                borderRadius: 4,
                background: hexToRgba(TEAL, 0.1),
              }}
            >
              PICKED
            </span>
          ) : null}
          {(build.made_for ?? []).slice(0, 3).map((role) => (
            <span key={role} style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>
              {role}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

/**
 * The count, as a figure rather than a sentence.
 *
 * Zero is shown, not hidden. A build nobody has reproduced yet is a real state
 * and a reader is entitled to see it; suppressing the number would leave them
 * unable to tell "nobody yet" from "we are not saying".
 *
 * A stale build's figure is dimmed rather than removed — the reproductions
 * happened, and the freshness line beneath the title already says when.
 */
function ReproductionFigure({ count, stale }: { count: number; stale: boolean }) {
  // Orange for stale, the same colour the build page's stale prompt uses, so
  // the two surfaces say the same thing about the same build.
  const colour = count === 0 ? TEXT_MUTED : stale ? ORANGE : TEAL;

  return (
    <div
      style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 1,
      }}
      title={
        count === 0
          ? "Nobody other than the creator has recorded running this yet."
          : `${count} ${count === 1 ? "person" : "people"} other than the creator ran this and said what happened.`
      }
    >
      <span
        style={{
          fontSize: 26,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: colour,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {count}
      </span>
      <span
        style={{
          ...labelText,
          fontSize: 10,
          color: TEXT_MUTED,
          textAlign: "right",
        }}
      >
        {count === 1 ? "REPRODUCTION" : "REPRODUCTIONS"}
      </span>
    </div>
  );
}
