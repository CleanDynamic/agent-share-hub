/* UX-07 Part 2: Discussed in OpenBuilds, on a build page after the classification.

   PURE: typed props, no fetching. The page's own pieces: `SectionHead` with its meta line (`3 topics · 6 replies · used to start
   2 topics`, each clause left out at zero), then `PlainRow`s, one per topic: its heading as a `PageLink` and
   `@maya · in Claude Code · 6 replies` in `--label`. Five rows, then `Show all` opens the rest in place. `Start a topic about this
   build` sits in the head as a control. Nothing is drawn when there is nothing to show, except the maker's control alone.

   Also here: the `2 replies` at the right of a step's head, which leads to the topic with the most replies on that step. */

import { useState } from "react";

import { PostControl } from "@/components/post/postControls";
import { PlainRow } from "@/components/vision/PlainRow";
import { SectionHead } from "@/components/vision/SectionHead";
import { PageLink } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, textStep } from "@/lib/theme/type";

export const DISCUSSED_TITLE = "Discussed in OpenBuilds";
export const START_TOPIC = "Start a topic about this build";
/** Rows shown before Show all. */
export const DISCUSSED_ROWS = 5;

export interface DiscussedRow {
  id: string;
  heading: string;
  to: string;
  /** "@maya · in Claude Code · 6 replies". */
  meta: string;
}

export interface DiscussedCounts {
  topics: number;
  replies: number;
  started: number;
}

export interface DiscussedSectionProps {
  counts: DiscussedCounts;
  rows: readonly DiscussedRow[];
  /** Opens the New post window with the build attached. Absent: not offered. */
  onStart?: () => void;
  /** The maker sees the control even when there is nothing else to show. */
  isMaker: boolean;
}

const plural = (n: number, one: string, many: string): string => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

/** "3 topics · 6 replies · used to start 2 topics", each clause left out at zero. */
export function discussedMeta({ topics, replies, started }: DiscussedCounts): string {
  return [topics > 0 ? plural(topics, "topic", "topics") : null, replies > 0 ? plural(replies, "reply", "replies") : null, started > 0 ? `used to start ${plural(started, "topic", "topics")}` : null]
    .filter(Boolean)
    .join(" · ");
}

/** "@maya · in Claude Code · 6 replies": who, where, how many replies (each left out when there is none). */
export function discussedRowMeta(handle: string | null, spaces: readonly string[], replies: number): string {
  return [handle ? `@${handle}` : null, spaces.length ? `in ${spaces.join(", ")}` : null, replies > 0 ? plural(replies, "reply", "replies") : null].filter(Boolean).join(" · ");
}

/** Whether the section is drawn: something to show, or the maker (who sees the control alone). */
export const discussedShown = (counts: DiscussedCounts, rows: number, isMaker: boolean, canStart: boolean): boolean =>
  rows > 0 || counts.topics + counts.replies + counts.started > 0 || (isMaker && canStart);

function HeadingLink({ to, children }: { to: string; children: string }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <PageLink to={to} {...handlers} style={{ color: t.text, textDecoration: state.hovered ? "underline" : "none", textUnderlineOffset: 3, borderRadius: r.control, fontWeight: 500, overflowWrap: "anywhere", ...ring(state.focusVisible) }}>
      {children}
    </PageLink>
  );
}

export function DiscussedSection({ counts, rows, onStart, isMaker }: DiscussedSectionProps) {
  const [all, setAll] = useState(false);
  if (!discussedShown(counts, rows.length, isMaker, onStart !== undefined)) return null;
  const shown = all ? rows : rows.slice(0, DISCUSSED_ROWS);
  return (
    <section aria-label={DISCUSSED_TITLE} data-testid="build-discussed" style={{ fontFamily: FIGTREE }}>
      <div style={{ display: "flex", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <SectionHead title={DISCUSSED_TITLE} meta={discussedMeta(counts) || undefined} headingLevel={2} />
        </div>
        {onStart ? <PostControl onClick={onStart}>{START_TOPIC}</PostControl> : null}
      </div>
      {shown.length > 0 ? (
        <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
          {shown.map((row, index) => (
            <PlainRow
              key={row.id}
              as="li"
              height={48}
              last={index === shown.length - 1}
              label={
                <span style={{ display: "flex", flexDirection: "column", gap: 2, padding: "6px 0" }}>
                  <HeadingLink to={row.to}>{row.heading || "Untitled post"}</HeadingLink>
                  {row.meta ? <span style={{ fontSize: textStep.meta, color: t.label }}>{row.meta}</span> : null}
                </span>
              }
            />
          ))}
        </ul>
      ) : null}
      {!all && rows.length > DISCUSSED_ROWS ? (
        <div style={{ marginTop: 12 }}>
          <PostControl onClick={() => setAll(true)}>Show all</PostControl>
        </div>
      ) : null}
    </section>
  );
}

/** `2 replies` at the right of a step's head (12 `--label`), leading to the topic with the most replies on that step. */
export function StepRepliesLink({ count, to }: { count: number; to: string }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  if (count <= 0) return null;
  return (
    <PageLink
      to={to}
      data-testid="step-replies"
      {...handlers}
      style={{ fontFamily: FIGTREE, fontSize: textStep.meta, color: t.label, textDecoration: state.hovered ? "underline" : "none", textUnderlineOffset: 3, borderRadius: r.control, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", ...ring(state.focusVisible) }}
    >
      {plural(count, "reply", "replies")}
    </PageLink>
  );
}
