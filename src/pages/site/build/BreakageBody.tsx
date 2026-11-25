/* UI-P30 — "Where it broke", inside the part viewer.

   Every recorded breakage in the order it happened (collectBreakages: a
   written-up part and the step it links are one breakage, not two), as rows: a
   7px `--cat-breakage` dot, the part's name in Figtree 13 600, what happened in
   Figtree 13 `--text2`, and the fix in `--text`. Each row that names a step
   opens the replay there.

   Then every gap still open, as a dashed breakage card: what is missing, the
   and the one primary, "Reply" (UX-09 P1,
   which renamed it): the still-open topic's reply box when the gap has one.

   UX-09 P1: each row also has "Start a topic", the page's New post window with
   the build attached and the row's step in the words.

   RESOLVED, NOT ALARMING. A breakage is the creator saying where it went wrong
   so the next person does not repeat it; the hue is spent on the dot and the
   dashed edge, never on a ground or on the prose.

   PURE. */

import type { CSSProperties } from "react";
import { Play } from "lucide-react";

import { Button } from "@/components/brand/Button";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import type { BreakageBodyView, BreakageRowView, OpenGapView } from "./buildModel";
import { EMPTY } from "@/lib/copy/copy";

function Row({ row, onOpenReplay, onStartTopic }: { row: BreakageRowView; onOpenReplay?: (ordinal: number) => void; onStartTopic?: (row: BreakageRowView) => void }) {
  return (
    <li
      data-testid="build-breakage-row"
      data-breakage-start={row.start ?? undefined}
      style={{
        display: "grid",
        gridTemplateColumns: "7px minmax(0, 1fr) auto",
        gap: 7,
        alignItems: "start",
        padding: "7px 0",
        borderBottom: `1px solid ${t.hairline}`,
      }}
    >
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: r.full, background: t.catBreakage, marginTop: 4 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, fontFamily: FIGTREE, fontSize: 13, lineHeight: 1.5 }}>
        <h3 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, fontWeight: 500, lineHeight: 1.5, color: t.text }}>{row.name}</h3>
        {row.happened ? <p style={{ margin: 0, color: t.text2, whiteSpace: "pre-wrap" }}>{row.happened}</p> : null}
        {row.fix ? (
          <p style={{ margin: 0, color: t.text, whiteSpace: "pre-wrap" }}>
            <span style={{ fontFamily: FIGTREE, fontSize: 13, letterSpacing: ".09em", color: t.label, marginRight: 4 }}>FIX</span>
            {row.fix}
          </p>
        ) : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
        {row.span && onOpenReplay && row.start !== null ? (
          <Button
            variant="ghost"
            size={28}
            fontSize={13}
            icon={Play}
            aria-label={`Watch ${row.span} in the replay`}
            onClick={() => onOpenReplay(row.start as number)}
          >
            {row.span}
          </Button>
        ) : (
          /* As tall as the Button it stands in for (28 drawn, 24 rendered), so a row keeps its height either way. */
          <span style={{ fontFamily: DM_MONO, fontSize: 13, color: t.label, lineHeight: "24px" }}>{row.span ?? "no step recorded"}</span>
        )}
        {row.attempts ? <span style={{ fontFamily: DM_MONO, fontSize: 13, color: t.label }}>{row.attempts}</span> : null}
        {onStartTopic ? (
          <Button variant="ghost" size={28} fontSize={13} aria-label={`Start a topic: ${row.name}`} onClick={() => onStartTopic(row)}>
            Start a topic
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function Gap({ gap, onReply }: { gap: OpenGapView; onReply?: (topicId: string) => void }) {
  const reply = gap.topicId && onReply ? () => onReply(gap.topicId as string) : null;
  return (
    <li
      data-testid="build-open-gap"
      data-part-id={gap.id}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 9,
        alignItems: "center",
        padding: "9px 10px",
        borderRadius: r.card,
        /* Longhands: a shorthand holding a var() is one declaration some engines drop whole. */
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: t.catBreakage,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, fontFamily: FIGTREE, fontSize: 13, lineHeight: 1.5 }}>
        <h3 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, fontWeight: 500, lineHeight: 1.5, color: t.text }}>{gap.title}</h3>
        <p style={{ margin: 0, color: t.text2 }}>{gap.problem ?? "Left open on purpose: the build works without it."}</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        {reply ? (
          <Button variant="primary" size={30} fontSize={13} aria-label={`Reply: ${gap.title}`} onClick={reply}>
            Reply
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/* ── on a phone (prompt 22) ── */

/** A Card with a 3px inset on its left in the given tone: Danger for a breakage, Warn for a gap left open. */
const phoneCard = (tone: string): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "12px 14px 12px 17px",
  borderRadius: 12,
  background: t.module,
  boxShadow: `inset 3px 0 0 ${tone}`,
  minWidth: 0,
  fontFamily: FIGTREE,
});

const capital = (words: string): string => (words ? words.charAt(0).toUpperCase() + words.slice(1) : words);

function PhoneRow({ row, onOpenReplay, onStartTopic }: { row: BreakageRowView; onOpenReplay?: (ordinal: number) => void; onStartTopic?: (row: BreakageRowView) => void }) {
  const meta = [row.span ? capital(row.span) : null, row.attempts].filter(Boolean).join(" · ");
  const replay = row.span && onOpenReplay && row.start !== null;
  return (
    <li data-testid="build-breakage-row" data-breakage-start={row.start ?? undefined} style={phoneCard(t.dangerText)}>
      {meta ? <span style={{ fontSize: 13, lineHeight: "16px", color: t.label }}>{meta}</span> : null}
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, lineHeight: "20px", color: t.text, overflowWrap: "anywhere" }}>{row.name}</h3>
      {row.happened ? <p style={{ margin: 0, fontSize: 13, lineHeight: "18px", color: t.text2, whiteSpace: "pre-wrap" }}>{row.happened}</p> : null}
      {row.fix ? <p style={{ margin: 0, fontSize: 13, lineHeight: "18px", color: t.text2, whiteSpace: "pre-wrap" }}>{`Fix: ${row.fix}`}</p> : null}
      {replay || onStartTopic ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
          {replay ? (
            <Button variant="secondary" size={32} fontSize={13} data-hit="" aria-label={`Watch ${row.span} in the replay`} onClick={() => onOpenReplay(row.start as number)}>
              Open the replay
            </Button>
          ) : null}
          {onStartTopic ? (
            <Button variant="secondary" size={32} fontSize={13} data-hit="" aria-label={`Start a topic: ${row.name}`} onClick={() => onStartTopic(row)}>
              Start a topic
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function PhoneGap({ gap, onReply }: { gap: OpenGapView; onReply?: (topicId: string) => void }) {
  const reply = gap.topicId && onReply ? () => onReply(gap.topicId as string) : null;
  return (
    <li data-testid="build-open-gap" data-part-id={gap.id} style={phoneCard(t.warn)}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, lineHeight: "20px", color: t.text, overflowWrap: "anywhere" }}>{gap.title}</h3>
      <p style={{ margin: 0, fontSize: 13, lineHeight: "18px", color: t.text2 }}>{gap.problem ?? "Left open on purpose: the build works without it."}</p>
      {reply ? (
        <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
          <Button variant="secondary" size={32} fontSize={13} data-hit="" aria-label={`Reply: ${gap.title}`} onClick={reply}>
            Reply
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function PhoneBreakage({ breakage }: { breakage: BreakageBodyView }) {
  const { rows, gaps, onOpenReplay, onReply, onStartTopic } = breakage;
  if (rows.length === 0 && gaps.length === 0) {
    return (
      <section data-testid="build-breakage" aria-label="Where it broke" style={{ fontFamily: FIGTREE }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: "20px", color: t.text2 }}>Either nothing broke, or nothing was written down. Both are worth knowing.</p>
      </section>
    );
  }
  return (
    <section data-testid="build-breakage" aria-label="Where it broke" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.length === 0 ? null : <ol aria-label={rows.length === 1 ? "1 recorded breakage" : `${rows.length.toLocaleString("en-GB")} recorded breakages`} style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((row) => (
          <PhoneRow key={row.key} row={row} onOpenReplay={onOpenReplay} onStartTopic={onStartTopic} />
        ))}
      </ol>}
      {gaps.length > 0 ? (
        <ul aria-label="Still open" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {gaps.map((gap) => (
            <PhoneGap key={gap.id} gap={gap} onReply={onReply} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function BreakageBody({ breakage, phone = false }: { breakage: BreakageBodyView; phone?: boolean }) {
  if (phone) return <PhoneBreakage breakage={breakage} />;
  const { rows, gaps, onOpenReplay, onReply, onStartTopic } = breakage;

  if (rows.length === 0 && gaps.length === 0) {
    return (
      <section data-testid="build-breakage" aria-label="Where it broke" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <p style={{ margin: 0, fontWeight: 500 }}>{EMPTY.breakages}</p>
        <p style={{ margin: 0, color: t.text2 }}>Either nothing broke, or nothing was written down. Both are worth knowing.</p>
      </section>
    );
  }

  return (
    <section data-testid="build-breakage" aria-label="Where it broke" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.length > 0 ? (
        <div>
          <p style={{ margin: 0, fontSize: 13, color: t.text2 }}>
            {rows.length === 1 ? "1 recorded breakage" : `${rows.length.toLocaleString("en-GB")} recorded breakages`}, in the order they
            happened.
          </p>
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {rows.map((row) => (
              <Row key={row.key} row={row} onOpenReplay={onOpenReplay} onStartTopic={onStartTopic} />
            ))}
          </ol>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: t.text2 }}>{EMPTY.breakages}</p>
      )}

      {gaps.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Eyebrow size={10} as="h3" style={{ margin: 0 }}>
            Still open
          </Eyebrow>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {gaps.map((gap) => (
              <Gap key={gap.id} gap={gap} onReply={onReply} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default BreakageBody;
