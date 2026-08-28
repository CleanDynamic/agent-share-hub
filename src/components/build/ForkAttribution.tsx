// The line a derived build carries: where it came from, who made it, and — for
// a rebuild — what changed.
//
// Attribution is the point of lineage. A fork that does not visibly credit its
// source is a copy with extra columns, so this renders on the page rather than
// in a tooltip or a settings panel, and it names the source in a link a reader
// can follow.
//
// TWO SURFACES, ONE FILE, BECAUSE THEY ARE THE SAME SENTENCE AT TWO AGES.
//
//   A REBUILD (NS-P40) — a build carrying the frozen snapshot columns — gets the
//   credit banner: "Rebuilt from <title> by @<handle>", the rebuilder's note
//   beneath it, and the change set behind an expander. The snapshot is what it
//   says, always: source_title_at_fork and source_handle_at_fork were frozen at
//   fork time and are never maintained again, so this banner keeps rendering
//   after the source is renamed, unpublished or deleted. Only the LINK depends
//   on the source still resolving; when it does not, the same sentence reads as
//   plain text and says so — "(no longer available)" — rather than vanishing.
//   A credit the credited party can erase is not a credit.
//
//   AN NS-P16-ERA FORK — a fork taken before those columns existed — keeps
//   exactly the line it had: "forked from <title> at step N", rendered only
//   when the parent resolves, and nothing at all when it does not. There is no
//   snapshot to fall back on for those, and a dangling "forked from" naming
//   nobody is worse than no line: it claims a provenance the reader cannot
//   check.
//
// THE EXPANDER IS COMPUTED AT VIEW TIME, NOT STORED. changeSet takes two whole
// records, so the parent's record is fetched only when a reader asks to see
// what changed — the banner itself costs one header read, and the diff costs a
// record read that most readers never trigger. Where the parent cannot be read
// the expander is not offered at all, because the honest answer to "what
// changed" would be "I cannot tell you".

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  changeSet,
  getBuild,
  getForkOrigin,
  serialiseChangeSet,
  type Build,
  type BuildRecord,
  type ChangeKind,
  type ChangeLine,
  type ForkOrigin,
} from "@/lib/build";
import { rebuildCreditLine } from "./rebuildCredit";
import {
  HAIRLINE,
  ORANGE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  bodyText,
  hexToRgba,
  labelText,
} from "./tokens";

/** Lineage does not change while a reader is on the page. */
const STALE_TIME = 300_000;

/** What the banner says when the source cannot be reached any more. */
const GONE = "(no longer available)";

const EXPAND_LABEL = "See what changed";
const COLLAPSE_LABEL = "Hide what changed";
/** An expander that opens onto nothing has to say so in its own words. */
const NO_LINES = "Nothing in the record reads differently from its source.";

/**
 * Kind to colour, the same pairing the publish sheet's list uses (NS-P39), so
 * a rebuilder recognises their own change lines on the published page.
 */
const KIND_COLOUR: Record<ChangeKind, string> = {
  changed: ORANGE,
  added: TEAL,
  removed: "#9CA3AF",
  header: "#F59E0B",
};

export interface ForkAttributionProps {
  build: Build;
  /**
   * The whole record the page is already rendering.
   *
   * Handed in so that "See what changed" costs ONE read — the source's — rather
   * than two. It also makes the diff correct by construction: the lines are
   * computed against exactly the record on screen, not against a second copy
   * fetched a moment later. Omitted, the expander reads this build back itself.
   */
  record?: BuildRecord;
}

export function ForkAttribution({ build, record }: ForkAttributionProps) {
  const isFork = Boolean(build.parent_build_id);
  const credit = rebuildCreditLine(build);

  const { data: origin, isPending } = useQuery<ForkOrigin | null>({
    queryKey: ["build-fork-origin", build.id, build.parent_build_id],
    queryFn: () => getForkOrigin(build),
    enabled: isFork,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  // The snapshot decides whether this is a rebuild, not parent_build_id:
  // deleting a source sets that column to NULL and the credit has to survive it.
  if (credit) {
    // A build with no parent to look up is not "still looking": react-query
    // reports a disabled query as pending forever, so the fork test has to come
    // first or a deleted source would never be reported as one.
    return (
      <RebuildBanner
        build={build}
        record={record}
        origin={origin ?? null}
        resolving={isFork && isPending}
      />
    );
  }

  if (!isFork || !origin) return null;

  return (
    <p
      data-visual-slot="build-fork-attribution"
      data-forked-from={origin.build.id}
      data-forked-at={origin.ordinal ?? undefined}
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
        to={`/b2/${origin.build.slug}`}
        style={{ color: ORANGE, textDecoration: "none", fontWeight: 400 }}
      >
        {origin.build.title}
      </Link>
      {origin.ordinal !== null ? ` at step ${origin.ordinal}` : null}
    </p>
  );
}

/**
 * The credit banner of a published rebuild.
 *
 * The title is a link when the parent resolves and plain text when it does not,
 * and the sentence either side of it is identical — the snapshot's. What the
 * reader loses when a source disappears is somewhere to click, not who to
 * credit.
 */
function RebuildBanner({
  build,
  record,
  origin,
  resolving,
}: {
  build: Build;
  record?: BuildRecord;
  origin: ForkOrigin | null;
  /** The parent is still being read. Not the same as "there isn't one". */
  resolving: boolean;
}) {
  const [open, setOpen] = useState(false);

  const title = (build.source_title_at_fork ?? "").trim();
  const handle = (build.source_handle_at_fork ?? "").trim();
  const note = (build.rebuild_note ?? "").trim();
  const resolved = origin?.build ?? null;
  // Said only once the answer is in. A banner that announced a missing source
  // for the length of one request would libel every live source on the site.
  const gone = !resolved && !resolving;

  return (
    <section
      data-testid="rebuild-banner"
      data-visual-slot="build-rebuild-banner"
      data-source-resolved={resolved ? "true" : gone ? "false" : "pending"}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        borderLeft: `2px solid ${hexToRgba(ORANGE, 0.5)}`,
        background: `linear-gradient(90deg, ${hexToRgba(ORANGE, 0.06)}, transparent 60%)`,
        borderTop: `1px solid ${HAIRLINE}`,
        borderRight: `1px solid ${HAIRLINE}`,
        borderBottom: `1px solid ${HAIRLINE}`,
        borderRadius: 8,
        padding: "10px 12px",
      }}
    >
      <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>
        Rebuilt from{" "}
        {resolved ? (
          <Link
            to={`/b2/${resolved.slug}`}
            style={{ color: ORANGE, textDecoration: "none", fontWeight: 400 }}
          >
            {title}
          </Link>
        ) : (
          <span style={{ color: TEXT_PRIMARY }}>{title}</span>
        )}
        {handle ? (
          <>
            {" by "}
            {resolved ? (
              <Link
                to={`/creator/${handle}`}
                style={{ color: ORANGE, textDecoration: "none", fontWeight: 400 }}
              >
                @{handle}
              </Link>
            ) : (
              <span style={{ color: TEXT_PRIMARY }}>@{handle}</span>
            )}
          </>
        ) : null}
        {gone ? <span style={{ color: TEXT_MUTED }}> {GONE}</span> : null}
      </p>

      {/* The rebuilder's own words, quoted rather than paraphrased. */}
      {note ? (
        <blockquote
          data-testid="rebuild-banner-note"
          style={{
            ...bodyText,
            margin: 0,
            paddingLeft: 10,
            borderLeft: `2px solid ${HAIRLINE}`,
            color: TEXT_PRIMARY,
            fontStyle: "italic",
            whiteSpace: "pre-wrap",
          }}
        >
          {note}
        </blockquote>
      ) : null}

      {/* Offered only where the diff can actually be computed. */}
      {resolved ? (
        <>
          <button
            type="button"
            data-testid="rebuild-banner-expander"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            style={{
              ...labelText,
              fontFamily: "inherit",
              fontSize: 11,
              alignSelf: "flex-start",
              padding: "4px 8px",
              borderRadius: 8,
              background: "transparent",
              border: `1px solid ${HAIRLINE}`,
              color: TEXT_SECONDARY,
              cursor: "pointer",
            }}
          >
            {open ? COLLAPSE_LABEL : EXPAND_LABEL}
          </button>
          {open ? (
            <ChangeLines build={build} record={record} sourceId={resolved.id} />
          ) : null}
        </>
      ) : null}
    </section>
  );
}

/**
 * The change set, computed when it is asked for.
 *
 * Two whole records — this build's and its source's — go into changeSet, so
 * both are read here rather than on page load. The query is keyed by the pair,
 * so reopening the expander costs nothing.
 */
function ChangeLines({
  build,
  record,
  sourceId,
}: {
  build: Build;
  record?: BuildRecord;
  sourceId: string;
}) {
  const { data, isPending, isError } = useQuery<
    { source: BuildRecord | null; draft: BuildRecord | null }
  >({
    queryKey: ["rebuild-change-set", build.id, sourceId],
    queryFn: async () => {
      // The draft half is already in hand on the build page; only a caller that
      // did not pass the record pays for a second read.
      const [source, draft] = await Promise.all([
        getBuild(sourceId),
        record ? Promise.resolve(record) : getBuild(build.id),
      ]);
      return { source, draft };
    },
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  if (isPending) {
    return <p style={{ ...bodyText, margin: 0, color: TEXT_MUTED }}>Working out what changed…</p>;
  }

  if (isError || !data?.source || !data?.draft) {
    return (
      <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>
        The build this came from could not be read, so its changes cannot be listed.
      </p>
    );
  }

  const lines: ChangeLine[] = serialiseChangeSet(changeSet(data.source, data.draft));

  if (lines.length === 0) {
    return <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>{NO_LINES}</p>;
  }

  return (
    <ul
      data-testid="rebuild-banner-changes"
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {lines.map((line) => (
        <li
          key={line.key}
          data-change-kind={line.kind}
          style={{
            ...bodyText,
            margin: 0,
            padding: "3px 0",
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          {/* The dot carries the kind and the text carries the change, which is
              why it is aria-hidden: "orange bullet" adds nothing to the line a
              screen reader already reads out. */}
          <span
            aria-hidden
            style={{
              width: 5,
              height: 5,
              marginTop: 8,
              borderRadius: 999,
              flexShrink: 0,
              background: KIND_COLOUR[line.kind],
            }}
          />
          <span style={{ minWidth: 0 }}>{line.text}</span>
        </li>
      ))}
    </ul>
  );
}

export default ForkAttribution;
