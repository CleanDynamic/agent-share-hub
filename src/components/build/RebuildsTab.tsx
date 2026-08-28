// The Rebuilds tab, and the count that sends a reader to it.
//
// WHAT THIS TAB IS FOR. A reproduction says "I ran your build and it worked".
// A rebuild says "I took your build somewhere else" — and unlike a
// reproduction, it leaves a record a reader can open, compare and rebuild in
// turn. That makes the list the more useful half of a build's social record and
// the reason it renders as rows with names on them rather than as a number.
//
// ROWS ARE LINKS AND NOTHING ELSE IS. Each row is one <Link> covering the whole
// row, so a reader can click anywhere in it, and so nothing inside it has to be
// a nested interactive element. The note is clipped to its first line here on
// purpose: the rebuild's own page renders it in full under its banner, and a
// list that unrolled three paragraphs per row would bury the rows below it.
//
// Everything is inline-styled, like every other surface on this route:
// Tailwind's generated utilities win over hand-written classes at build time.

import { Link } from "react-router-dom";
import type { RebuildSummary } from "@/lib/build";
import { BranchIcon } from "./BranchIcon";
import { creatorLabel, firstLine } from "./rebuildDisplay";
import {
  HAIRLINE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  bodyText,
  cardGlass,
  labelText,
  titleText,
} from "./tokens";

/** A date a reader can read. The exact time is on the rebuild's own page. */
function when(created_at: string): string {
  const date = new Date(created_at);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
}

export interface RebuildsTabProps {
  rebuilds: RebuildSummary[];
}

export function RebuildsTab({ rebuilds }: RebuildsTabProps) {
  if (rebuilds.length === 0) {
    return (
      <p style={{ ...bodyText, color: TEXT_MUTED, margin: 0, padding: "48px 0" }}>
        Nobody has rebuilt this yet.
      </p>
    );
  }

  return (
    <section
      data-testid="rebuilds-tab"
      data-visual-slot="build-rebuilds"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED, textTransform: "uppercase" }}>
        {rebuilds.length === 1 ? "One build started here" : `${rebuilds.length} builds started here`}
      </span>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {rebuilds.map((rebuild) => (
          <li key={rebuild.id}>
            <Link
              to={`/b2/${rebuild.slug}`}
              data-testid="rebuild-row"
              data-rebuild-id={rebuild.id}
              style={{
                ...cardGlass,
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "12px 14px",
                textDecoration: "none",
                color: TEXT_PRIMARY,
              }}
            >
              <Avatar rebuild={rebuild} />

              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ ...labelText, fontSize: 11, color: TEXT_SECONDARY }}>
                  {creatorLabel(rebuild)}
                  <span style={{ color: TEXT_MUTED }}> · {when(rebuild.created_at)}</span>
                </span>
                <span style={{ ...titleText }}>
                  {(rebuild.title ?? "").trim() || "Untitled build"}
                </span>
                {firstLine(rebuild.rebuild_note) ? (
                  <span
                    style={{
                      ...bodyText,
                      color: TEXT_SECONDARY,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {firstLine(rebuild.rebuild_note)}
                  </span>
                ) : null}
              </div>

              {/* The rebuild's own earned number, in the card's treatment. */}
              <span
                style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, flexShrink: 0 }}
                title={`${rebuild.reproduction_count} ${
                  rebuild.reproduction_count === 1 ? "person has" : "people have"
                } run this and said what happened.`}
              >
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    lineHeight: 1,
                    fontVariantNumeric: "tabular-nums",
                    color: rebuild.reproduction_count > 0 ? TEAL : TEXT_MUTED,
                  }}
                >
                  {rebuild.reproduction_count}
                </span>
                <span style={{ ...labelText, fontSize: 10, color: TEXT_MUTED }}>
                  {rebuild.reproduction_count === 1 ? "REPRO" : "REPROS"}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The rebuilder's avatar, or their initial.
 *
 * avatar_url is whatever the profile holds — an external URL for most accounts
 * — so it is rendered as it stands rather than signed. A profile with none
 * falls back to a letter, which is never blank because creatorLabel never is.
 */
function Avatar({ rebuild }: { rebuild: RebuildSummary }) {
  const url = rebuild.creator?.avatar_url?.trim();
  const initial = creatorLabel(rebuild).replace("@", "").charAt(0).toUpperCase();

  const frame = {
    width: 28,
    height: 28,
    borderRadius: 999,
    flexShrink: 0,
    border: `1px solid ${HAIRLINE}`,
    objectFit: "cover" as const,
  };

  // Named rather than decorative: the sweep in altText.test.ts holds every
  // image on this path to a non-empty alt, and an avatar announced as its URL
  // is exactly what that rule exists to prevent.
  if (url) {
    return (
      <img
        src={url}
        alt={`${creatorLabel(rebuild)} profile picture`}
        loading="lazy"
        style={frame}
      />
    );
  }

  return (
    <span
      aria-hidden
      style={{
        ...frame,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255,255,255,0.04)",
        ...labelText,
        fontSize: 12,
        color: TEXT_SECONDARY,
      }}
    >
      {initial}
    </span>
  );
}

export interface RebuildCountProps {
  count: number;
  /** Switch the page to the Rebuilds tab. */
  onOpen: () => void;
}

/**
 * The second earned number, beside the first.
 *
 * A REBUILD IS EARNED IN THE SAME SENSE A REPRODUCTION IS: somebody who is not
 * the creator went away, did work on top of this build, and published the
 * result. So the two sit in the same strip as siblings — but not as twins. The
 * reproduction count is the biggest figure on the page and stays that way; this
 * one is muted, small and quiet, because it counts a rarer act that already has
 * a whole tab of its own to be read in.
 *
 * It does not render at zero, and that is the difference from the reproduction
 * count, which shows its zero. "Nobody has run this yet" is information a
 * reader is entitled to; "nobody has rebuilt this yet" beside an absent tab is
 * an empty shelf, and the Rebuild control in the header already invites the
 * only action it could prompt.
 */
export function RebuildCount({ count, onOpen }: RebuildCountProps) {
  if (count <= 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED, textTransform: "uppercase" }}>
        Rebuilds
      </span>
      <button
        type="button"
        data-testid="rebuild-count"
        onClick={onOpen}
        title={`${count} ${count === 1 ? "build was" : "builds were"} started from this one.`}
        style={{
          ...bodyText,
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: 0,
          background: "transparent",
          border: "none",
          color: TEXT_SECONDARY,
          cursor: "pointer",
        }}
      >
        <BranchIcon colour={TEXT_MUTED} />
        <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 400 }}>
          {count} {count === 1 ? "rebuild" : "rebuilds"}
        </span>
      </button>
    </div>
  );
}

export default RebuildsTab;
