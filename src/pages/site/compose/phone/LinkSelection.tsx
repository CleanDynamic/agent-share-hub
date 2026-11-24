/* Prompt 23: "Link to a step" for the words selected in the post, on a phone. A web page cannot add a row to the phone's own
   selection menu, so the item stands just under the selection while it is there: a pill on Raised, 44 tall, the link icon at 16
   and the words 15/500. Pressing it opens the post's own link panel (the list of steps to link to), the same one Link a step
   opens from the toolbar. It keeps the selection: the press never takes focus from the editor. */

import type { Editor } from "@tiptap/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { MobileIcon } from "@/components/brand/MobileIcon";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { PHONE_EDITOR_COPY } from "./phoneEditorModel";

/** Air between the selection's foot and the item, clear of the phone's own handles and menu. */
const BELOW = 28;

export function LinkSelection({ editor, onLink }: { editor: Editor | null; onLink: () => void }) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const read = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty || !editor.isFocused) return setAt(null);
      try {
        const start = editor.view.coordsAtPos(from);
        const end = editor.view.coordsAtPos(to);
        setAt({ top: Math.max(start.bottom, end.bottom) + BELOW, left: Math.min(Math.max(16, start.left), window.innerWidth - 176) });
      } catch {
        setAt(null);
      }
    };
    const clear = () => setAt(null);
    editor.on("selectionUpdate", read);
    editor.on("focus", read);
    editor.on("blur", clear);
    window.addEventListener("scroll", clear, { passive: true });
    return () => {
      editor.off("selectionUpdate", read);
      editor.off("focus", read);
      editor.off("blur", clear);
      window.removeEventListener("scroll", clear);
    };
  }, [editor]);
  if (!at) return null;
  return createPortal(
    <button
      type="button"
      data-testid="link-selection"
      onPointerDown={(event) => event.preventDefault()}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        setAt(null);
        onLink();
      }}
      {...handlers}
      style={{
        position: "fixed",
        top: at.top,
        left: at.left,
        zIndex: 45,
        boxSizing: "border-box",
        minHeight: 44,
        padding: "0 16px",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        border: 0,
        borderRadius: 22,
        background: t.control,
        color: t.text,
        boxShadow: t.shadowFloat,
        fontFamily: FIGTREE,
        fontSize: 15,
        fontWeight: 500,
        cursor: "pointer",
        ...ring(state.focusVisible),
      }}
    >
      <MobileIcon name="link" size={16} />
      {PHONE_EDITOR_COPY.linkToStep}
    </button>,
    document.body,
  );
}

export default LinkSelection;
