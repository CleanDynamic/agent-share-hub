/* CA-13 P4 — how sure, one look everywhere.

   Closed: the answer, then "92% confidence", then a thin bar 48 wide and 4 tall in `--text2` on `--hairline`. Below 60% the words
   read "unsure (54%)" in `--label`: no red, amber or green. Opened: every option with its share as a bar, high to low, the
   chosen one in `--text`. A source note says "From the run" or "Maker's figure". A screen reader hears one sentence:
   "billing, 92 percent sure, from the run". Used for Decision answers, Classify helpers and Check cases. */

import { useId, useState } from "react";

import { certaintySource, certaintySpoken, certaintyWords, sortedShares, type CertaintySource } from "@/lib/build/certainty";
import { t } from "@/lib/theme/tokens";
import { TextButton } from "@/pages/site/compose/composeControls";
import { text, tnum } from "@/pages/site/compose/refinedStyles";

export interface CertaintyProps {
  /** The answer in words: "billing", "Annoyed". */
  answer: string;
  /** 0..1: the chosen answer's share. */
  share: number;
  /** Every option's share; when present the row can be opened. */
  probabilities?: Readonly<Record<string, number>>;
  source?: CertaintySource;
  /** Hide the answer's own word, where a line already names it. */
  bare?: boolean;
}

const bar = (share: number, color: string, width: number, height: number) => (
  <span aria-hidden="true" style={{ display: "inline-block", width, height, borderRadius: 2, background: t.hairline, overflow: "hidden", flexShrink: 0 }}>
    <span style={{ display: "block", width: `${Math.max(0, Math.min(1, share)) * 100}%`, height: "100%", background: color }} />
  </span>
);

export function Certainty({ answer, share, probabilities, source, bare = false }: CertaintyProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const words = certaintyWords(share);
  const shares = probabilities ? sortedShares(probabilities) : [];
  const note = certaintySource(source);
  return (
    <span data-testid="certainty" style={{ display: "inline-flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span role="img" aria-label={certaintySpoken(answer, share, source)} style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {bare ? null : <span style={text(13, 500, t.text)}>{answer}</span>}
        <span data-testid="certainty-words" data-unsure={words.unsure || undefined} style={{ ...text(12.5, 400, words.unsure ? t.label : t.text2), ...tnum }}>{words.text}</span>
        {bar(share, t.text2, 48, 4)}
      </span>
      {shares.length > 1 ? (
        <TextButton onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={id} style={{ alignSelf: "flex-start", fontSize: 12 }}>
          {open ? "Hide the options" : "Show every option"}
        </TextButton>
      ) : null}
      {open ? (
        <span id={id} role="list" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {shares.map((row) => (
            <span key={row.key} role="listitem" data-chosen={row.key === answer || undefined} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ ...text(12.5, row.key === answer ? 500 : 400, row.key === answer ? t.text : t.text2), flex: "0 0 96px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.key}</span>
              {bar(row.share, row.key === answer ? t.text : t.text2, 120, 4)}
              <span style={{ ...text(12, 400, t.text2), ...tnum }}>{Math.round(row.share * 100)}%</span>
            </span>
          ))}
        </span>
      ) : null}
      {note ? <span style={text(11.5, 400, t.label)}>{note}</span> : null}
    </span>
  );
}
