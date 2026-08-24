// One quiet line, and the only thing in the app that offers to rewrite text a
// creator has already signed off.
//
// WHY IT IS A QUESTION AND NOT A JOB. generate-build-layers refuses to
// overwrite an approved or creator-edited row without force: true, which
// leaves exactly one way for stale layers to be brought up to date — someone
// asking the creator. This is that ask. It never fires on its own, it is not
// on a timer, and nothing else in the app sets force.
//
// WHAT IT COSTS TO PRESS, said plainly on the line itself: a rewrite replaces
// the words currently on the build page, and the new ones are hidden from
// readers until the creator approves them. That is the generator's own
// behaviour — freshly generated content is unapproved content, because a tick
// given to one set of words is not a tick for another — and a creator should
// meet it before pressing, not after.
//
// It appears only for a build that is LIVE. On a draft there is nothing on a
// page to go stale, and the review pass at publish will regenerate an
// unapproved layer without needing to ask anyone.

import { useState } from "react";
import { useBuildLayers } from "@/hooks/useBuildLayers";
import { LayerReview, type LayerReviewResult } from "@/components/compose/LayerReview";
import { LAYER_TITLE, type Build, type Layer, type NodeTree } from "@/lib/build";
import {
  HAIRLINE,
  ORANGE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  bodyText,
  hexToRgba,
  labelText,
} from "@/components/build/tokens";

export interface LayerStaleNoticeProps {
  build: Build;
  /** The PLACED tree — the same thing the hash is taken over. */
  tree: NodeTree[];
}

function list(layers: Layer[]): string {
  const names = layers.map((layer) => LAYER_TITLE[layer]);
  return names.length === 2 ? `${names[0]} and ${names[1]}` : names[0];
}

export function LayerStaleNotice({ build, tree }: LayerStaleNoticeProps) {
  const { stale, hash, applyLayers } = useBuildLayers(build.id, tree);
  const [reviewing, setReviewing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isLive = build.status === "published" || build.status === "gallery";

  /**
   * Only the rows a creator has to be asked about.
   *
   * An unapproved, unedited row is invisible to readers and is regenerated
   * freely, so it is not worth a line. The ones that matter are the ones the
   * generator would protect: what a reader is seeing now, and what a creator
   * wrote themselves.
   */
  const protectedStale = stale.filter((row) => row.approved || row.edited_by_creator);
  const layers = protectedStale.map((row) => row.layer);

  const onResolved = (result: LayerReviewResult) => {
    applyLayers([...result.generated, ...result.written]);
    setReviewing(false);
  };

  if (!isLive || protectedStale.length === 0 || dismissed) return null;

  return (
    <>
      <div
        data-visual-slot="layer-stale-notice"
        role="status"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "12px 14px",
          borderTop: `1px solid ${HAIRLINE}`,
        }}
      >
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            width: 6,
            height: 6,
            marginTop: 7,
            borderRadius: 999,
            background: ORANGE,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>
            The record changed since {list(layers)}{" "}
            {layers.length === 2 ? "were" : "was"} written. Rewrite{" "}
            {layers.length === 2 ? "them" : "it"} from the record as it stands?
          </p>
          <p style={{ ...bodyText, margin: 0, fontSize: 12, color: TEXT_MUTED }}>
            This replaces what is on your build page now. You read the new words
            before anyone else does — nothing is shown until you approve it.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setReviewing(true)}
              style={{
                ...labelText,
                fontFamily: "inherit",
                height: 28,
                padding: "0 12px",
                borderRadius: 100,
                color: TEXT_PRIMARY,
                border: `1px solid ${hexToRgba(ORANGE, 0.45)}`,
                background: hexToRgba(ORANGE, 0.12),
                cursor: "pointer",
              }}
            >
              Rewrite {layers.length === 2 ? "them" : "it"}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              style={{
                ...labelText,
                fontFamily: "inherit",
                height: 28,
                padding: "0 12px",
                borderRadius: 100,
                color: TEXT_SECONDARY,
                border: `1px solid ${HAIRLINE}`,
                background: "rgba(255,255,255,0.025)",
                cursor: "pointer",
              }}
            >
              Leave them
            </button>
          </div>
        </div>
      </div>

      {reviewing ? (
        <LayerReview
          buildId={build.id}
          mode="review"
          only={layers}
          // The creator's own answer to the question above. This is the only
          // place in the app that sets it.
          force
          hash={hash}
          onResolve={onResolved}
          onCancel={() => setReviewing(false)}
        />
      ) : null}
    </>
  );
}

export default LayerStaleNotice;
