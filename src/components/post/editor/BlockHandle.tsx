// BlockHandle: the grip in the left margin that moves a block (PT-06).
//
// One handle for the whole editor, drawn beside the block under the pointer, or beside the block the caret is in while
// the editor or the handle has focus. It is a real button: dragged, it carries the block (a text block, a picture or a
// row) to a new place; focused, Alt with the up and down arrows move the block one place. Both go through
// moveBlock, so a picture dropped beside another makes a row whichever way it got there.
//
// The grip is the PT-02 glyph in t.label, 24px left of the block. A phone has no margin and no pointer to hover with,
// so it has no handle; the arrow keys are for a keyboard, which a phone seldom has.

import { useEditorState, type Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { useCallback, useEffect, useRef, useState } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { VisuallyHidden } from "@/components/brand/VisuallyHidden";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";

import { gapPos, moveTextBlock, type PictureHost } from "./pictures";

/** The grip's box is 24 square and starts 24px left of the block. */
const MARGIN = 24;
const SIZE = 24;

interface Caret {
  index: number;
  focused: boolean;
  count: number;
}

function caretOf(editor: Editor | null): Caret {
  if (!editor) return { index: -1, focused: false, count: 0 };
  const { selection, doc } = editor.state;
  const index = selection.$from.depth > 0 || selection instanceof NodeSelection ? selection.$from.index(0) : -1;
  return { index, focused: editor.isFocused, count: doc.childCount };
}

export function BlockHandle({ editor, phone }: { editor: Editor | null; host?: PictureHost; phone: boolean }) {
  const layer = useRef<HTMLDivElement>(null);
  const caret = useEditorState({ editor, selector: ({ editor: current }) => caretOf(current) }) ?? { index: -1, focused: false, count: 0 };
  const [hover, setHover] = useState<number | null>(null);
  const [held, setHeld] = useState(false);
  const [top, setTop] = useState(0);
  const [said, setSaid] = useState("");
  const { state, handlers } = useInteractive<HTMLButtonElement>();

  const index = hover ?? (caret.focused || held ? caret.index : -1);
  const block = editor && index >= 0 && index < caret.count ? editor.state.doc.child(index) : null;
  // CA-07: the words move; a post's pictures stay its last block, and are moved inside their grid.
  const shown = !phone && Boolean(editor) && block !== null && block.type.name !== "postBreak" && block.type.name !== "postMediaGrid";

  // Hover: whichever block the pointer is level with, over the editor or in the margin beside it.
  useEffect(() => {
    const root = layer.current?.parentElement;
    if (!editor || !root || phone) return;
    const blocks = () => Array.from(editor.view.dom.children) as HTMLElement[];
    const onMove = (event: MouseEvent) => {
      const found = blocks().findIndex((child) => {
        const rect = child.getBoundingClientRect();
        return event.clientY >= rect.top - 6 && event.clientY <= rect.bottom + 6;
      });
      setHover(found >= 0 ? found : null);
    };
    const onLeave = () => setHover(null);
    root.addEventListener("mousemove", onMove);
    root.addEventListener("mouseleave", onLeave);
    return () => {
      root.removeEventListener("mousemove", onMove);
      root.removeEventListener("mouseleave", onLeave);
    };
  }, [editor, phone]);

  // Level with the top of the block, measured again whenever the document changes.
  const current = editor?.state.doc;
  useEffect(() => {
    const root = layer.current?.parentElement;
    if (!editor || !root || !shown) return;
    const dom = editor.view.dom.children[index] as HTMLElement | undefined;
    if (!dom) return;
    setTop(dom.getBoundingClientRect().top - root.getBoundingClientRect().top);
  }, [editor, shown, index, current]);

  const move = useCallback(
    (direction: -1 | 1) => {
      if (!editor || index < 0) return;
      setHover(null);
      if (moveTextBlock(editor, index, direction)) {
        setSaid(`Moved ${direction === -1 ? "up" : "down"}, now block ${index + direction + 1} of ${caret.count}`);
      }
    },
    [editor, index, caret.count],
  );

  return (
    <div ref={layer} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0 }}>
      {shown ? (
        <button
          type="button"
          data-block-handle=""
          aria-label="Move block"
          aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
          title="Drag to move. With the handle focused, Alt and the arrow keys move it."
          draggable
          {...handlers}
          onFocus={(event) => {
            handlers.onFocus(event);
            setHeld(true);
          }}
          onBlur={(event) => {
            handlers.onBlur(event);
            setHeld(false);
          }}
          onKeyDown={(event) => {
            if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
            event.preventDefault();
            move(event.key === "ArrowUp" ? -1 : 1);
          }}
          onDragStart={(event) => {
            if (!editor) return;
            const { state: current, view } = editor;
            const pos = gapPos(current.doc, index);
            view.dispatch(current.tr.setSelection(NodeSelection.create(current.doc, pos)));
            view.dragging = { slice: view.state.selection.content(), move: true };
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", " ");
            const dom = view.nodeDOM(pos);
            if (dom instanceof HTMLElement) event.dataTransfer.setDragImage(dom, 0, 0);
          }}
          onDragEnd={() => {
            if (editor) editor.view.dragging = null;
          }}
          style={{
            position: "absolute",
            left: -MARGIN,
            top,
            width: SIZE,
            height: SIZE,
            padding: 0,
            border: 0,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "grab",
            // Hover is a colour step; pressed sinks to the well.
            background: state.pressed ? t.well : "transparent",
            color: state.hovered ? t.text2 : t.label,
            ...ring(state.focusVisible),
          }}
        >
          <Glyph name="grip" size={16} />
        </button>
      ) : null}
      <span role="status" aria-live="polite">
        <VisuallyHidden>{said}</VisuallyHidden>
      </span>
    </div>
  );
}

export default BlockHandle;
