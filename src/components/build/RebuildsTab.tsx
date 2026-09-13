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
import { cardGlass } from "./tokens";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import {
  body as bodyType,
  data as dataType,
  eyebrow,
  measure,
  tabular,
} from "@/lib/theme/type";

/* ── BG-P21 — WHY THESE ROWS ARE NOT `RebuildCredit` ──────────────────────────

   The shared credit renders "Rebuilt from <title> by @<handle>" out of the two
   FROZEN SNAPSHOT COLUMNS a rebuild carries, plus the machine-computed change
   summary. `RebuildSummary` — what `listRebuilds` returns, and all this tab has
   — carries neither: it is id, slug, title, creator, note, date, fork event and
   reproduction count. Feeding the shared component would mean widening the
   query, which is a data-layer change and not a repaint.

   And the sentence would be the same on every row anyway: every descendant here
   was rebuilt from THIS build, by the creator whose page the reader is on. The
   credit's job is to say where a build came from, and on this tab the answer is
   "from the thing you are looking at" — once, in the heading above the list.

   So the rows take the credit's VOICE instead of its component: the rebuilder
   and the date in mono on `--text2`, the title in the body face, the rebuilder's
   own note as the line that differs between rows. When `listRebuilds` grows the
   snapshot columns, this list should render the shared component per row and
   the heading should lose its count — that is the change, and it belongs with
   the query that makes it possible.
   ─────────────────────────────────────────────────────────────────────────── */

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
      <p style={{ ...bodyType, ...measure, color: t.text2, margin: 0, padding: "48px 0" }}>
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
      <span style={{ ...eyebrow, color: t.text2 }}>
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
                color: t.text,
              }}
            >
              <Avatar rebuild={rebuild} />

              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                {/* The credit's voice: who, and when, in mono on --text2. */}
                <span style={{ ...dataType, ...tabular, color: t.text2 }}>
                  {creatorLabel(rebuild)}
                  <span> · {when(rebuild.created_at)}</span>
                </span>
                <span style={{ ...bodyType, fontWeight: 600, color: t.text }}>
                  {(rebuild.title ?? "").trim() || "Untitled build"}
                </span>
                {firstLine(rebuild.rebuild_note) ? (
                  <span
                    style={{
                      ...bodyType,
                      color: t.text2,
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
                    ...dataType,
                    ...tabular,
                    fontSize: 18,
                    fontWeight: 500,
                    lineHeight: 1,
                    color: rebuild.reproduction_count > 0 ? t.evidence : t.text2,
                  }}
                >
                  {rebuild.reproduction_count}
                </span>
                <span style={{ ...eyebrow, color: t.text2 }}>
                  {rebuild.reproduction_count === 1 ? "repro" : "repros"}
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
    /* An avatar is a circle, which is what `--r-full` exists for. */
    borderRadius: r.full,
    flexShrink: 0,
    border: `1px solid ${t.line}`,
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
        background: t.recess,
        ...dataType,
        color: t.text2,
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
      <span style={{ ...eyebrow, color: t.text2 }}>Rebuilds</span>
      <button
        type="button"
        data-testid="rebuild-count"
        onClick={onOpen}
        title={`${count} ${count === 1 ? "build was" : "builds were"} started from this one.`}
        /* A FACT IN THE FACTS STRIP, so it is weighted like the facts either
           side of it: the mono data role on --text, which is exactly what Fact
           prints. It is a button because it navigates, not because it is a
           control worth looking like one. */
        style={{
          ...dataType,
          ...tabular,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: 0,
          background: "transparent",
          border: "none",
          color: t.text,
          cursor: "pointer",
        }}
      >
        <BranchIcon colour={t.text2} />
        <span>
          {count} {count === 1 ? "rebuild" : "rebuilds"}
        </span>
      </button>
    </div>
  );
}

export default RebuildsTab;
