// SlashMenu: "/" at the start of an empty paragraph (PT-05).
//
// Typing / in an empty paragraph opens a list under the caret; what is typed
// after it narrows the list, the arrow keys and Enter choose, Esc closes. The
// editor keeps focus the whole time: the menu is driven by keys the editor
// forwards (controls.slashKey), and a click on an item is a cancelled
// mouse-down.
//
// THE PICTURE ITEM NEEDS A WAY TO ADD A PICTURE. "Picture or video" is listed
// only when the caller gives `onInsertPicture` (PostTab does: it asks for the
// files and puts them in the post the caret is in); without one it is not in the
// list. CA-07 took "Row of pictures" out: a post's pictures are one grid.

import { useEditorState, type Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { canStartPost, POST_LIMIT_SENTENCE } from "@/lib/build/threadEditor";
import type { ThreadDoc } from "@/lib/build/thread";
import { t } from "@/lib/theme/tokens";
import { menuSurface, text } from "@/pages/site/compose/refinedStyles";

import type { PostEditorControls } from "./extensions";

export type SlashId = "picture" | "bullet" | "ordered" | "title" | "heading" | "code" | "newPost";

export interface SlashItem {
  id: SlashId;
  name: string;
  line: string;
}

/** Asks for pictures for the post the caret is in: PostTab opens the file chooser (PT-06, CA-07). */
export type InsertPicture = (editor: Editor) => void;

const ITEMS: readonly SlashItem[] = [
  { id: "picture", name: "Picture or video", line: "Up to 4 pictures or videos" },
  { id: "bullet", name: "Bulleted list", line: "A list with dots" },
  { id: "ordered", name: "Numbered list", line: "A list with numbers" },
  { id: "title", name: "Title", line: "Large text to open a post" },
  { id: "heading", name: "Heading", line: "Smaller text for a section" },
  { id: "code", name: "Code", line: "Fixed-width text for commands" },
  { id: "newPost", name: "New post", line: "Start the next post in the thread" },
];

/** The items to list: the picture items only once there is a way to insert a picture. */
export function slashItems(query: string, canInsertPicture: boolean): SlashItem[] {
  const needle = query.trim().toLowerCase();
  return ITEMS.filter((item) => (canInsertPicture || item.id !== "picture") && item.name.toLowerCase().includes(needle));
}

interface SlashState {
  /** What follows the slash. */
  query: string;
  /** The slash and the query, as a range. */
  from: number;
  to: number;
  /** Where the paragraph starts, before it. */
  block: number;
}

function readSlash(editor: Editor | null): SlashState | null {
  if (!editor || !editor.isEditable) return null;
  const { selection } = editor.state;
  if (!selection.empty) return null;
  const { $from } = selection;
  if ($from.depth !== 1 || $from.parent.type.name !== "paragraph") return null;
  const typed = $from.parent.textContent;
  if (!typed.startsWith("/") || $from.parentOffset !== typed.length) return null;
  return { query: typed.slice(1), from: $from.start(), to: $from.pos, block: $from.before(1) };
}

/** An item is 40 high; a phone makes it 44, the touch size. */
const rowHeight = (phone: boolean) => (phone ? 44 : 40);

/** Runs one item at the slash. */
export function runSlash(editor: Editor, id: SlashId, at: SlashState, onInsertPicture: InsertPicture | undefined, notice: (sentence: string) => void): void {
  const clear = editor.chain().focus().deleteRange({ from: at.from, to: at.to });
  switch (id) {
    case "bullet":
      clear.toggleBulletList().run();
      return;
    case "ordered":
      clear.toggleOrderedList().run();
      return;
    case "title":
      clear.setHeading({ level: 1 }).run();
      return;
    case "heading":
      clear.setHeading({ level: 2 }).run();
      return;
    case "code":
      clear.setCodeBlock().run();
      return;
    case "picture":
      clear.run();
      onInsertPicture?.(editor);
      return;
    case "newPost": {
      if (!canStartPost(editor.getJSON() as ThreadDoc)) {
        // The slash goes first: any edit clears the last sentence.
        clear.run();
        notice(POST_LIMIT_SENTENCE);
        return;
      }
      const { state, view } = editor;
      const block = state.doc.nodeAt(at.block);
      if (!block) return;
      const { postBreak, paragraph } = state.schema.nodes;
      const tr = state.tr.replaceWith(at.block, at.block + block.nodeSize, [postBreak.create(), paragraph.create()]);
      // The caret goes to the empty paragraph after the break.
      tr.setSelection(TextSelection.create(tr.doc, at.block + 2));
      view.dispatch(tr.scrollIntoView());
      view.focus();
    }
  }
}

export function SlashMenu({
  editor,
  controls,
  onInsertPicture,
  notice,
  phone = false,
}: {
  editor: Editor | null;
  controls: PostEditorControls;
  onInsertPicture?: InsertPicture;
  notice: (sentence: string) => void;
  phone?: boolean;
}) {
  const ROW = rowHeight(phone);
  const slash = useEditorState({ editor, selector: ({ editor: current }) => readSlash(current) }) ?? null;
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  const listId = useRef(`slash-${Math.random().toString(36).slice(2, 8)}`).current;

  const items = useMemo(() => (slash ? slashItems(slash.query, Boolean(onInsertPicture)) : []), [slash, onInsertPicture]);
  const open = Boolean(editor && slash && items.length > 0 && dismissed !== slash.block);
  const query = slash?.query;

  useEffect(() => {
    setActive(0);
  }, [query]);
  useEffect(() => {
    if (!slash) setDismissed(null);
  }, [slash]);

  // The keys the editor hands over while the list is open.
  useEffect(() => {
    if (!open || !editor || !slash) {
      controls.slashKey.current = null;
      return;
    }
    controls.slashKey.current = (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        setActive((index) => (index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        runSlash(editor, items[Math.min(active, items.length - 1)].id, slash, onInsertPicture, notice);
        return true;
      }
      if (event.key === "Escape") {
        setDismissed(slash.block);
        return true;
      }
      return false;
    };
    return () => {
      controls.slashKey.current = null;
    };
  }, [open, editor, slash, items, active, controls, onInsertPicture, notice]);

  // Tell assistive technology the editor has a list open.
  useEffect(() => {
    let dom: HTMLElement | undefined;
    try {
      dom = editor?.view.dom;
    } catch {
      // A phone width rebuilds the editor; until the new one is mounted it has no view to mark.
      return;
    }
    if (!dom) return;
    if (open) {
      dom.setAttribute("aria-expanded", "true");
      dom.setAttribute("aria-controls", listId);
      dom.setAttribute("aria-activedescendant", `${listId}-${Math.min(active, items.length - 1)}`);
    } else {
      dom.removeAttribute("aria-expanded");
      dom.removeAttribute("aria-controls");
      dom.removeAttribute("aria-activedescendant");
    }
  }, [editor, open, active, items.length, listId]);

  useLayoutEffect(() => {
    if (!open || !editor || !slash) return;
    try {
      const caret = editor.view.coordsAtPos(slash.to);
      const height = items.length * ROW + 8;
      const below = caret.bottom + 4;
      const top = below + height > window.innerHeight - 8 && caret.top - 4 - height >= 8 ? caret.top - 4 - height : below;
      setPlace({ top, left: Math.max(8, Math.min(caret.left, window.innerWidth - 288)) });
    } catch {
      setPlace(null);
    }
  }, [open, editor, slash, items.length]);

  if (!open || !editor || !slash) return null;

  return createPortal(
    <div
      id={listId}
      role="listbox"
      aria-label="Insert"
      style={{ ...menuSurface(280), position: "fixed", zIndex: 60, top: place?.top ?? -9999, left: place?.left ?? 0, boxSizing: "border-box" }}
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          id={`${listId}-${index}`}
          role="option"
          aria-selected={index === active}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => setActive(index)}
          onClick={() => runSlash(editor, item.id, slash, onInsertPicture, notice)}
          style={{
            boxSizing: "border-box",
            height: ROW,
            padding: "0 12px",
            borderRadius: 6,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            cursor: "pointer",
            background: index === active ? t.tile : "transparent",
          }}
        >
          <span style={text(13, 500, t.text)}>{item.name}</span>
          <span style={text(12, 400, t.text2)}>{item.line}</span>
        </div>
      ))}
    </div>,
    document.body,
  );
}

export default SlashMenu;
