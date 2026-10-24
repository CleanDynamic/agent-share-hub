/* CA-23 P1: the save half of the status line, after "Draft · " or "Published · ".

   `saving…` (only once it has lasted 300 ms), `saved`, `saved 2 min ago`, `saved at 14:05`, `offline · 3 changes pending` and
   `not saved · Retry`. Not saved is in the danger text colour; the old detail ("Not saved: a value isn't allowed. Code 23514.")
   is its tooltip, and a screen reader reads it as its description. The line keeps its size and colour: 12.5 `t.text2`, set by
   the paragraph this sits in. */

import { useEffect, useRef, type CSSProperties } from "react";

import { useAnnounce } from "./BuildAnnouncer";
import { SAVE_WORDS, saveWords, type SaveState } from "./composeModel";
import { TextButton } from "./composeControls";
import { DANGER } from "./referencePieces";
import { useReason } from "./removePieces";
import { useMinuteNow, useShownSave } from "./useSaveLine";

/** The tooltip when the failure has no reason of its own. */
/** What a screen reader is told of the save: `Saved.` once, after a save that was under way, and that a failed one can be retried. */
export const SAVE_SAID = { saved: "Saved.", notSaved: "Not saved. Retry available." } as const;

export const NOT_SAVED_DETAIL = "Your last change didn't save.";

export interface SaveLineProps {
  save: SaveState;
  lastSavedAt?: Date | null;
  /** Writes waiting for a connection. */
  pending?: number;
  /** The tooltip on "not saved". */
  detail?: string;
  onRetry: () => void;
  retryUnderline?: boolean;
  retryStyle?: CSSProperties;
}

function NotSaved({ detail }: { detail: string }) {
  const reason = useReason(detail);
  return (
    <>
      <span data-testid="save-problem" {...reason.props} style={{ color: DANGER }}>
        {SAVE_WORDS.error}
      </span>
      {reason.note}
    </>
  );
}

export function SaveLine({ save, lastSavedAt = null, pending = 0, detail, onRetry, retryUnderline = false, retryStyle }: SaveLineProps) {
  const shown = useShownSave(save);
  const announce = useAnnounce();
  const before = useRef<SaveState>(save);
  useEffect(() => {
    // The state the write is in, not the one drawn: a save that lands inside the 300 ms before `saving…` is drawn is still a save.
    // Coming back online says "Reconnected" in its own notice, so offline to saved says nothing more.
    if (save === "saved" && (before.current === "saving" || before.current === "idle")) announce(SAVE_SAID.saved);
    else if (save === "error" && before.current !== "error") announce(SAVE_SAID.notSaved);
    before.current = save;
  }, [save, announce]);
  const now = useMinuteNow();
  if (shown === "idle") return null;
  if (shown === "error") {
    return (
      <>
        {" · "}
        <NotSaved detail={detail ?? NOT_SAVED_DETAIL} />
        {" · "}
        <TextButton underline={retryUnderline} onClick={onRetry} style={retryStyle}>
          Retry
        </TextButton>
      </>
    );
  }
  return (
    <>
      {" · "}
      {saveWords(shown, { lastSavedAt, pending, now })}
    </>
  );
}
