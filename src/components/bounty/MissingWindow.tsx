// The missing window (UI-P15): "MISSING" over the part's name, in a dashed frame
// laid on a cover, where the part that is not there would hang.
//
// FIXED COLOURS, ON PURPOSE. The window sits on ARTWORK — the build's picture or
// its painted sky — and not on the room, so it does not follow the theme: a
// near-white ink and a dark scrim read on any sky in either room. They are the
// two named constants below, exactly where `design/tokens/token-map.md` says a
// value that is identical in both themes and sits on artwork lives. Nothing
// theme-dependent is ever a constant.
//
// THIS IS THE VACANT FRAME'S WINDOW, and a new component beside
// `MissingBlockOverlay` rather than a rewrite of it: the overlay replaces the
// body of a block inside a bounty post and carries its own call to action, and
// the structural change that would turn it into this is not a repaint.

import { DM_MONO, FIGTREE } from "@/lib/theme/type";

/** The window's ink and its dashed edge. */
const WINDOW_INK = "#F7F8F9";
/** The scrim under it, so the ink reads on any sky. */
const WINDOW_SCRIM = "rgba(14,11,20,.55)";

export interface MissingWindowProps {
  /** What is missing: "Duplicate detector". */
  part: string;
}

export function MissingWindow({ part }: MissingWindowProps) {
  return (
    <div
      data-ui="missing-window"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 110,
        /* 48 since the UI-P54 density pass (58 before). The kit keeps the old
           −29px margin because the pass never maps a negative value, which
           leaves its window 5px low; this keeps the window centred, −height/2. */
        height: 48,
        marginLeft: -55,
        marginTop: -24,
        boxSizing: "border-box",
        borderRadius: 10,
        border: `1.5px dashed ${WINDOW_INK}`,
        background: WINDOW_SCRIM,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: WINDOW_INK,
      }}
    >
      <span style={{ fontFamily: DM_MONO, fontSize: 10, letterSpacing: ".1em", lineHeight: "normal" }}>MISSING</span>
      <span
        style={{
          fontFamily: FIGTREE,
          fontSize: 11,
          fontWeight: 600,
          textAlign: "center",
          lineHeight: "normal",
          // A long name wraps inside the window rather than clipping: the part's
          // name is the one thing the window exists to say.
          maxWidth: "100%",
          overflowWrap: "anywhere",
        }}
      >
        {part}
      </span>
    </div>
  );
}

export default MissingWindow;
