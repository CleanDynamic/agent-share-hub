// The line a forked build carries: where it came from, and when.
//
// Attribution is the point of lineage. A fork that does not visibly credit its
// source is a copy with extra columns, so this renders on the page rather than
// in a tooltip or a settings panel, and it names the source in a link a reader
// can follow.
//
// It renders nothing at all for a build that is not a fork, and nothing for a
// fork whose source is no longer readable — an unpublished source, or a deleted
// one. A dangling "forked from" naming nobody is worse than no line: it claims
// a provenance the reader cannot check.

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getForkOrigin, type Build, type ForkOrigin } from "@/lib/build";
import { HAIRLINE, ORANGE, TEXT_SECONDARY, bodyText, hexToRgba } from "./tokens";

/** Lineage does not change while a reader is on the page. */
const STALE_TIME = 300_000;

export function ForkAttribution({ build }: { build: Build }) {
  const isFork = Boolean(build.parent_build_id);

  const { data } = useQuery<ForkOrigin | null>({
    queryKey: ["build-fork-origin", build.id, build.parent_build_id],
    queryFn: () => getForkOrigin(build),
    enabled: isFork,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  if (!isFork || !data) return null;

  return (
    <p
      data-visual-slot="build-fork-attribution"
      data-forked-from={data.build.id}
      data-forked-at={data.ordinal ?? undefined}
      style={{
        ...bodyText,
        margin: 0,
        color: TEXT_SECONDARY,
        borderLeft: `2px solid ${hexToRgba(ORANGE, 0.5)}`,
        background: `linear-gradient(90deg, ${hexToRgba(ORANGE, 0.06)}, transparent 60%)`,
        borderTop: `1px solid ${HAIRLINE}`,
        borderRight: `1px solid ${HAIRLINE}`,
        borderBottom: `1px solid ${HAIRLINE}`,
        borderRadius: 8,
        padding: "8px 12px",
      }}
    >
      forked from{" "}
      <Link
        to={`/b2/${data.build.slug}`}
        style={{ color: ORANGE, textDecoration: "none", fontWeight: 400 }}
      >
        {data.build.title}
      </Link>
      {data.ordinal !== null ? ` at step ${data.ordinal}` : null}
    </p>
  );
}

export default ForkAttribution;
