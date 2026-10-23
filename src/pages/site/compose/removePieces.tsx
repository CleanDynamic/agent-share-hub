/* CA-20 — the small pieces removing, selecting, undoing and the shortcuts need, built from tokens and `modalRecipes.tsx`.

   P1: the reason a greyed item gives. A menu item that cannot be used says why: as a tooltip, and in words a screen reader
   reads (`aria-describedby`). The words sit next to the item, hidden, so the item's own name and text stay "Move up" and the words are read as its
   description. */

import { useId, type ReactNode } from "react";

import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";

/** The props and the hidden words that give a greyed control its reason. Nothing is drawn when there is none. */
export function useReason(reason: string | undefined): { props: { title?: string; "aria-describedby"?: string }; note: ReactNode } {
  const id = useId();
  if (!reason) return { props: {}, note: null };
  return {
    props: { title: reason, "aria-describedby": id },
    note: (
      <span id={id} data-testid="reason" aria-hidden="true" style={VISUALLY_HIDDEN}>
        {reason}
      </span>
    ),
  };
}
