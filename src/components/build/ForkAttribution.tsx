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
// A REBUILD THAT ANSWERS A BOUNTY SAYS SO (NS-P53). builds.solves_node_id is
// the declaration startSolutionRebuild wrote onto the draft, and a build
// carrying it is not merely derived from its source — it was made to fill a
// named hole in it. That is worth a line of its own under the credit, pointing
// at the gap itself rather than at the source's front page, because the reader
// following it wants the question this build is the answer to.
//
// IT RENDERS WHETHER OR NOT THE SOLUTION WAS EVER ACCEPTED, and that is the
// point: an answer nobody took up is still an answer, and a line that appeared
// only on acceptance would quietly delete every rebuild that lost.
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
import { ChangeSummary, RebuildCredit } from "@/components/brand/RebuildCredit";
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
import { measure } from "@/lib/theme/type";

/** Lineage does not change while a reader is on the page. */
const STALE_TIME = 300_000;

/** What the banner says when the source cannot be reached any more. */
const GONE = "(no longer available)";

/** The bounty line. The source is named by the same snapshot the credit uses. */
const SOLVES_PREFIX = "Solves a bounty on ";
const EXPAND_LABEL = "See what changed";
const COLLAPSE_LABEL = "Hide what changed";
/** An expander that opens onto nothing has to say so in its own words. */
const NO_LINES = "Nothing in the record reads differently from its source.";

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
      {/* BG-P11: the shared credit, in the slot this paragraph already
          occupied. It composes the same sentence from the same two frozen
          snapshot columns — rebuildCredit.ts is still the only place the words
          are decided — and takes the two link targets rather than building the
          links itself, so the card and this banner cannot say the credit
          differently. `gone` stays a prop rather than `!to`: a banner that
          announced a missing source for the length of one request would libel
          every live source on the site. */}
      <RebuildCredit
        source={build}
        to={resolved ? `/b2/${resolved.slug}` : null}
        handleTo={resolved && handle ? `/creator/${handle}` : null}
        gone={gone}
      />

      {/* Under the credit, above the note: it qualifies what this build IS,
          which the rebuilder's commentary on it does not. The link carries the
          gap's node id in the hash, which the build page reads to scroll the
          gap panel into view — the panel is a card in the tree, not a route, so
          the address has to name the node rather than a page of its own. */}
      {build.solves_node_id ? (
        <p
          data-testid="rebuild-solves-line"
          data-solves-node={build.solves_node_id}
          style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}
        >
          {SOLVES_PREFIX}
          {resolved ? (
            <Link
              to={`/b2/${resolved.slug}#node-${build.solves_node_id}`}
              // The credit above links the same title to the source's front
              // page, so the two would otherwise be one accessible name over
              // two destinations. This one says where it actually goes.
              aria-label={`Open the gap this build solves on ${title || resolved.title}`}
              style={{ color: ORANGE, textDecoration: "none", fontWeight: 400 }}
            >
              {title || resolved.title}
            </Link>
          ) : (
            // Same rule the credit above follows: what a reader loses when the
            // source disappears is somewhere to click, not what was answered.
            <span style={{ color: TEXT_PRIMARY }}>{title || "a build"}</span>
          )}
        </p>
      ) : null}

      {/* The rebuilder's own words, quoted rather than paraphrased. */}
      {note ? (
        <blockquote
          data-testid="rebuild-banner-note"
          style={{
            ...bodyText,
            ...measure,
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

  /* BG-P11: the shared Δ summary, in the slot this list already occupied. The
     dot-per-kind this file drew became a Δ carrying the same four hues,
     resolved through the part categories rather than through two hexes and two
     imported constants — and the six-line rule the publish sheet has always
     applied now applies here too, from the same function.

     IT IS RENDERED HERE RATHER THAN INSIDE RebuildCredit ABOVE, because the
     banner puts its list below a button that gates the query these lines come
     from, three elements down from the credit. Folding it in would put the
     summary above the note and leave the expander below the thing it expands.
     BG-P21 owns that arrangement; see the handoff note. */
  return (
    <div data-testid="rebuild-banner-changes">
      <ChangeSummary lines={lines} />
    </div>
  );
}

export default ForkAttribution;
