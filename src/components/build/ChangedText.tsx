/* CA-05 P1 — a prompt's text with the words a reader changes drawn in it.

   Those words get a 1px `--line` inset outline and radius 4, no colour. PURE: ranges in, text out. The same pieces
   are used by the full prompt window, the Details well and the build page, so the words are drawn one way. */

import type { CSSProperties } from "react";

import { segmentsOf, type ChangeRange } from "@/lib/build/changes";
import { t } from "@/lib/theme/tokens";

import { FindHit } from "./FindHit";

const CHANGED_WORDS: CSSProperties = { boxShadow: `inset 0 0 0 1px ${t.line}`, borderRadius: 4 };

export function ChangedText({ text, changes }: { text: string; changes?: readonly ChangeRange[] }) {
  if (!changes || changes.length === 0) return <FindHit text={text} />;
  return (
    <>
      {segmentsOf(text, changes).map((segment, index) =>
        segment.change ? (
          <span key={index} data-testid="changed-words" style={CHANGED_WORDS}>
            {segment.text}
          </span>
        ) : (
          segment.text
        ),
      )}
    </>
  );
}
