// usePostEditor: the TipTap editor of the composer's Post tab (PT-05).
//
// The editor opens on the document it is given and reports every change as the
// thread's JSON; saving, counting and the outline are the callers'. A phone
// width rebuilds the editor (the type scale differs), re-opened on whatever
// `readDoc` returns then, so the words typed so far are kept.

import { useEditor, type Editor } from "@tiptap/react";
import { useRef } from "react";

import type { ThreadDoc } from "@/lib/build/thread";
import { emptyThread } from "@/lib/build/threadEditor";

import { editorAttributes, postExtensions, type PostEditorControls } from "./extensions";

/** A document the editor can open: a thread with no blocks opens on one empty paragraph. */
export function loadable(doc: ThreadDoc): ThreadDoc {
  return Array.isArray(doc.content) && doc.content.length > 0 ? doc : emptyThread();
}

export interface UsePostEditorOptions {
  /** The document to open on, read when the editor is built. */
  readDoc: () => ThreadDoc;
  /** Below 768px. */
  phone: boolean;
  onDoc: (doc: ThreadDoc) => void;
}

export function usePostEditor({ readDoc, phone, onDoc }: UsePostEditorOptions): { editor: Editor | null; controls: PostEditorControls } {
  const controls = useRef<PostEditorControls>({ slashKey: { current: null }, openLink: { current: null } }).current;
  const onDocRef = useRef(onDoc);
  onDocRef.current = onDoc;

  const editor = useEditor(
    {
      extensions: postExtensions(phone, controls),
      content: loadable(readDoc()),
      // TipTap marks the editor tabindex="0", which the site's focus rule rings as a box. The page is a text surface with no
      // box: a contenteditable is a Tab stop without it, and the caret says where the words go.
      enableCoreExtensions: { tabindex: false },
      editorProps: { attributes: editorAttributes() },
      onUpdate: ({ editor: updated }) => onDocRef.current(updated.getJSON() as ThreadDoc),
    },
    [phone],
  );

  return { editor, controls };
}
