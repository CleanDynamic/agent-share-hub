// The Publish control, and the one screen a creator sees after using it.
//
// WHAT THIS CONTROL IS ALLOWED TO ASK FOR. Three things: a line saying what the
// build does for someone, one thing someone would run, one piece of evidence it
// worked. That is the whole gate. Cost, prerequisites, audience, links and
// every other field raise completeness and decide GALLERY PLACEMENT; none of
// them stands between a creator and a live page.
//
// WHAT THE CONFIRMATION IS NOT. A build below the gallery threshold has not
// been rejected, and nothing here says so. It is live, it is forkable, it is on
// its creator's profile, and the gallery is a further thing it can reach — the
// line names what would get it there, in the same instructing voice the
// completeness checklist uses. "Not good enough" is not a sentence this file
// is permitted to imply.
//
// Styled with inline style objects like everything else on this route:
// Tailwind's generated utilities win over hand-written classes at build time.

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  galleryShortfall,
  galleryThreshold,
  publishReadiness,
  readinessFrom,
  type Build,
  type Completeness,
  type MissingItem,
  type NodeTree,
  type NodeType,
} from "@/lib/build";
import {
  GAP_RED,
  HAIRLINE,
  ORANGE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  bodyText,
  cardGlass,
  headingText,
  hexToRgba,
  labelText,
  panelGlass,
  titleText,
} from "@/components/build/tokens";

export interface PublishControlProps {
  build: Build;
  /** The PLACED tree. Tray nodes are not part of the record. */
  tree: NodeTree[];
  nodeTypes: NodeType[];
  /** Computed once by the hook; this control never computes a second answer. */
  completeness: Completeness | null;
  onPublish: () => Promise<Build>;
  isPublishing: boolean;
  publishError: Error | null;
}

const controlBase: React.CSSProperties = {
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.04em",
  height: 30,
  padding: "0 14px",
  borderRadius: 100,
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.06)",
  color: TEXT_SECONDARY,
  cursor: "pointer",
};

export function PublishControl({
  build,
  tree,
  nodeTypes,
  completeness,
  onPublish,
  isPublishing,
  publishError,
}: PublishControlProps) {
  const [confirmation, setConfirmation] = useState<Build | null>(null);

  // The hook has already computed this record's completeness, memoised on the
  // same inputs. Deriving readiness from it keeps the bar off the tree on every
  // keystroke of the title; the second branch is for a caller without one.
  const readiness = completeness
    ? readinessFrom(completeness)
    : publishReadiness(build, tree, nodeTypes);
  const isLive = build.status === "published" || build.status === "gallery";
  const enabled = (readiness.ready || isLive) && !isPublishing;

  const label = isPublishing ? "Publishing…" : isLive ? "Published" : "Publish";

  const explanation = publishError
    ? publishError.message
    : readiness.reason
      ? readiness.reason
      : isLive
        ? "Live. Open the link, and see what would put it in the gallery."
        : "Put this in front of readers. It stays yours to edit.";

  const handleClick = useCallback(() => {
    void onPublish()
      .then((row) => setConfirmation(row))
      .catch(() => {
        /* surfaced through publishError, on the control itself */
      });
  }, [onPublish]);

  return (
    <>
      <Tooltip>
        {/* A disabled button fires no pointer events, so the span carries them. */}
        <TooltipTrigger asChild>
          {/* VISUAL SLOT — the primary button surface is supplied externally.
              Structure only here: pill geometry, states, no surface. */}
          <span
            data-visual-slot="btn-primary"
            style={{ display: "inline-flex", flexShrink: 0 }}
          >
            <button
              type="button"
              disabled={!enabled}
              onClick={handleClick}
              style={{
                ...controlBase,
                whiteSpace: "nowrap",
                color: publishError
                  ? GAP_RED
                  : isLive
                    ? TEAL
                    : enabled
                      ? TEXT_PRIMARY
                      : TEXT_MUTED,
                borderColor: publishError
                  ? hexToRgba(GAP_RED, 0.35)
                  : isLive
                    ? hexToRgba(TEAL, 0.35)
                    : enabled
                      ? hexToRgba(ORANGE, 0.45)
                      : "rgba(255,255,255,0.06)",
                background: publishError
                  ? hexToRgba(GAP_RED, 0.1)
                  : isLive
                    ? hexToRgba(TEAL, 0.1)
                    : enabled
                      ? hexToRgba(ORANGE, 0.14)
                      : "rgba(255,255,255,0.025)",
                cursor: enabled ? "pointer" : "not-allowed",
                pointerEvents: enabled ? "auto" : "none",
                opacity: isPublishing ? 0.7 : 1,
              }}
            >
              {label}
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">{explanation}</TooltipContent>
      </Tooltip>

      {confirmation ? (
        <PublishConfirmation
          build={confirmation}
          completeness={completeness}
          onClose={() => setConfirmation(null)}
        />
      ) : null}
    </>
  );
}

/**
 * What a creator sees the moment their build goes live.
 *
 * PORTALLED TO THE BODY, and not by preference. The compose top bar carries
 * backdropFilter, and a filtered element is the containing block for every
 * fixed-position descendant — a fixed overlay rendered inside the bar would be
 * trapped in a 52px-tall strip. The portal takes it out of that subtree.
 */
function PublishConfirmation({
  build,
  completeness,
  onClose,
}: {
  build: Build;
  completeness: Completeness | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const path = `/b2/${build.slug}`;
  const url =
    typeof window === "undefined" ? path : `${window.location.origin}${path}`;

  const score = completeness?.score ?? build.completeness ?? 0;
  const threshold = galleryThreshold(build.shape);
  const shortfall = galleryShortfall(
    build.shape,
    score,
    completeness?.missing ?? []
  );
  const promoted = build.status === "gallery";
  const inGalleryNow = promoted || score >= threshold;

  const copyLink = () => {
    void navigator.clipboard
      ?.writeText(url)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Your build is live"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(8,8,12,0.62)",
      }}
    >
      <div
        data-visual-slot="publish-confirmation"
        onClick={(event) => event.stopPropagation()}
        style={{
          ...panelGlass,
          width: "min(520px, 100%)",
          maxHeight: "100%",
          overflowY: "auto",
          borderRadius: 14,
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h2 style={{ ...headingText, margin: 0 }}>It’s live.</h2>
          <span style={{ ...labelText, color: TEAL }}>
            {promoted ? "In the gallery" : "Published"}
          </span>
        </div>

        <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>
          {build.title || "Your build"} is readable by anyone with the link, and
          anyone can fork it from any point in its sequence.
        </p>

        <div
          style={{
            ...cardGlass,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
          }}
        >
          <Link
            to={path}
            target="_blank"
            rel="noreferrer"
            style={{
              ...titleText,
              color: TEAL,
              textDecoration: "none",
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {path}
          </Link>
          <button
            type="button"
            onClick={copyLink}
            style={{
              ...labelText,
              fontFamily: "inherit",
              flexShrink: 0,
              height: 28,
              padding: "0 10px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.025)",
              border: `1px solid ${HAIRLINE}`,
              color: copied ? TEAL : TEXT_SECONDARY,
              cursor: "pointer",
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>

        <GalleryLine
          inGalleryNow={inGalleryNow}
          promoted={promoted}
          shortfall={shortfall}
        />

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              ...labelText,
              fontFamily: "inherit",
              height: 30,
              padding: "0 14px",
              borderRadius: 100,
              background: "rgba(255,255,255,0.025)",
              border: `1px solid ${HAIRLINE}`,
              color: TEXT_SECONDARY,
              cursor: "pointer",
            }}
          >
            Back to the workspace
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * The one honest line about the gallery.
 *
 * Two states, and neither is a refusal. A build that clears the bar is told
 * where to find itself. A build that does not is told what it already is —
 * live, forkable, on its creator's profile — and then what would get it there,
 * as instructions rather than as a verdict.
 */
function GalleryLine({
  inGalleryNow,
  promoted,
  shortfall,
}: {
  inGalleryNow: boolean;
  promoted: boolean;
  shortfall: MissingItem[];
}) {
  if (inGalleryNow) {
    return (
      <div
        style={{
          ...cardGlass,
          padding: "12px 14px",
          borderLeft: `2px solid ${TEAL}`,
          background: hexToRgba(TEAL, 0.06),
        }}
      >
        <p style={{ ...bodyText, margin: 0 }}>
          {promoted
            ? "This build has been promoted to the gallery by an editor, and appears there whatever it scores."
            : "This record carries enough for the gallery."}{" "}
          <Link to="/gallery" style={{ color: TEAL, textDecoration: "none" }}>
            See it at /gallery →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        ...cardGlass,
        padding: "12px 14px",
        borderLeft: `2px solid ${ORANGE}`,
        background: hexToRgba(ORANGE, 0.05),
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <p style={{ ...bodyText, margin: 0 }}>
        It is live and forkable, and it sits on your profile. The{" "}
        <Link to="/gallery" style={{ color: TEAL, textDecoration: "none" }}>
          gallery
        </Link>{" "}
        asks for a little more of the record
        {shortfall.length > 0 ? ":" : "."}
      </p>
      {shortfall.length > 0 ? (
      <ul
        style={{
          ...bodyText,
          margin: 0,
          paddingLeft: 18,
          color: TEXT_SECONDARY,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {shortfall.map((item) => (
          <li key={item.key}>{item.copy}</li>
        ))}
      </ul>
      ) : null}
      <p style={{ ...bodyText, margin: 0, color: TEXT_MUTED, fontSize: 12 }}>
        Nothing is lost by leaving it as it is. Add these whenever you like and
        it joins the gallery on its own.
      </p>
    </div>
  );
}
