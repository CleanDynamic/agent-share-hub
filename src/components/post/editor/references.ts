// references: what @ does to the post's words (CA-06 P2).
//
// Highlight some words and choose a part: those words carry the link, and they do not change. Choose with nothing
// highlighted: the part's name goes in as linked words, then a space. A highlight (or a caret) inside a link changes
// that whole link, or takes it off and keeps the words.

import type { Editor } from "@tiptap/react";

import type { RefEntry } from "@/lib/build/postRefs";

/** Where @ was pressed, read when the picker opens: the editor keeps it while the picker's field has focus. */
export interface RefSpot {
  from: number;
  to: number;
  /** The link the highlight, or the caret, is already in. */
  current: string | null;
  /** Opened by typing @: Escape puts it back. */
  typed: boolean;
}

/** The selection as @ finds it. */
export function readRefSpot(editor: Editor, typed = false): RefSpot {
  const { from, to } = editor.state.selection;
  const current = editor.isActive("ref") ? ((editor.getAttributes("ref").to as string | undefined) ?? null) : null;
  return { from, to, current, typed };
}

/** Selects the whole link the spot is in. */
function selectLink(editor: Editor, spot: RefSpot) {
  const inside = spot.from === spot.to ? spot.from : Math.min(spot.to, spot.from + 1);
  return editor.chain().focus().setTextSelection(inside).extendMarkRange("ref");
}

/** Links the spot to `entry`: the highlighted words, the link the spot is in, or the entry's name typed in. */
export function applyRef(editor: Editor, spot: RefSpot, entry: Pick<RefEntry, "to" | "name">): void {
  const mark = { type: "ref", attrs: { to: entry.to } };
  if (spot.current) {
    selectLink(editor, spot).setMark("ref", { to: entry.to }).run();
    editor.commands.setTextSelection(editor.state.selection.to);
    return;
  }
  if (spot.from !== spot.to) {
    editor.chain().focus().setTextSelection({ from: spot.from, to: spot.to }).setMark("ref", { to: entry.to }).setTextSelection(spot.to).run();
    return;
  }
  editor
    .chain()
    .focus()
    .setTextSelection(spot.from)
    .insertContent([
      { type: "text", text: entry.name, marks: [mark] },
      { type: "text", text: " " },
    ])
    .run();
}

/** Takes the link off; the words stay. */
export function removeRef(editor: Editor, spot: RefSpot): void {
  if (!spot.current) return;
  const end = spot.to;
  selectLink(editor, spot).unsetMark("ref").run();
  editor.commands.setTextSelection(end);
}

/** Escape on a picker opened by typing @: the @ goes back where it was typed, and the caret after it. */
export function restoreTypedAt(editor: Editor, spot: RefSpot): void {
  editor.chain().focus().setTextSelection(spot.from).insertContent("@").run();
}

/** Whether a typed @ at `pos` opens the picker: at the start of a block, or after a space, so an email address does not. */
export function opensOnAt(editor: Pick<Editor, "state">, pos: number): boolean {
  const $pos = editor.state.doc.resolve(pos);
  if ($pos.parent.type.name === "codeBlock") return false;
  const before = $pos.parent.textBetween(Math.max(0, $pos.parentOffset - 1), $pos.parentOffset, "\n", "\n");
  return before === "" || /\s/.test(before);
}
