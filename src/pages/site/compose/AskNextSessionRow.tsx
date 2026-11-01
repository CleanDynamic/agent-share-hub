/* SV-21: the ghost row at the end of a part: "Ask for the next session". A dashed, text-only row like the ones inside an agent.
   Pressed, it asks what the request is for and marks the part as one (`workstreams[i].open`); the request is filed when
   the build is published. Marked, the row says what is being asked, with a way to take it back.

   The row is one slide in the List (`ask:<part>`), so the List's animator brings it in and out with the rest. */

import { useState } from "react";

import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";

import { bareButton, text } from "./refinedStyles";
import { SLIDE_ATTR } from "./flip";
import { OPEN_REQUEST_COPY } from "./openRequestCopy";
import { OpenRequestWindow as OpenRequestDialog } from "./composerWindows";
import { TextButton } from "./composeControls";

export const ASK_ROW_COPY = {
  ask: "Ask for the next session",
  asking: (problem: string) => `Asking for the next session: ${problem}`,
  takeBack: "Take it back",
} as const;

export interface AskNextSessionRowProps {
  /** "Part B". */
  label: string;
  partKey: string;
  /** The problem the part was opened with; absent when it was not. */
  open?: string;
  phone: boolean;
  /** Mark the part with a problem, or (null) take the request back. */
  onOpen: (key: string, problem: string | null) => void;
}

export function AskNextSessionRow({ label, partKey, open, phone, onOpen }: AskNextSessionRowProps) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const [asking, setAsking] = useState(false);
  return (
    <>
      <div data-testid="ask-next-session" {...{ [SLIDE_ATTR]: `ask:${partKey}` }} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "4px 8px" }}>
        {open ? (
          <>
            <span style={{ ...text(13, 400, t.text2), minWidth: 0, overflowWrap: "anywhere" }}>{ASK_ROW_COPY.asking(open)}</span>
            <TextButton target={phone} style={text(13, 500, t.text2)} aria-label={`${ASK_ROW_COPY.takeBack}: ${label}`} onClick={() => onOpen(partKey, null)}>
              {ASK_ROW_COPY.takeBack}
            </TextButton>
          </>
        ) : (
          <button
            type="button"
            aria-label={`${ASK_ROW_COPY.ask} in ${label}`}
            {...handlers}
            onClick={() => setAsking(true)}
            style={{
              ...bareButton,
              minHeight: phone ? 44 : 32,
              padding: "0 12px",
              boxSizing: "border-box",
              borderRadius: 6,
              border: `1px dashed ${state.hovered ? t.text2 : t.line}`,
              ...text(12.5, 400, t.text2),
              ...ring(state.focusVisible),
            }}
          >
            {ASK_ROW_COPY.ask}
          </button>
        )}
      </div>
      <OpenRequestDialog
        open={asking}
        title={OPEN_REQUEST_COPY.askNext(label)}
        onClose={() => setAsking(false)}
        onSubmit={(problem) => {
          setAsking(false);
          onOpen(partKey, problem);
        }}
      />
    </>
  );
}
