/* PT-05 — the composer's Post tab: the whole thread written as one page.

   A wrapping row with 48 between, 12 above it: the Posts outline (flex 1 1 170, max 190), the editor (flex 999 1 520,
   max 628: the width of a post in the Gallery) and an empty slot for the preview (flex 1 1 280, max 320, PT-07's).
   The editor has no box, border or background: the text sits on the surface, in the type the published post uses.

   WHAT IS WRITTEN LIVES IN `useComposeThread` (in the page), so it survives a switch to Build. This file is the
   editor, the outline and the two things drawn over it: the format bar and the slash menu. A phone (below 768) has
   no outline, no preview slot and no format bar; posts are reached by scrolling. */

import { EditorContent, useEditorState, type Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { useCallback, useState } from "react";

import { ErrorState } from "@/components/brand/ErrorState";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { FormatBar } from "@/components/post/editor/FormatBar";
import { PostOutline, type OutlineEntry } from "@/components/post/editor/PostOutline";
import { SlashMenu, type InsertPicture } from "@/components/post/editor/SlashMenu";
import { usePostEditor } from "@/components/post/editor/usePostEditor";
import type { ThreadDoc } from "@/lib/build/thread";
import { movePost, postLead, postRuns } from "@/lib/build/threadEditor";
import { prefersReducedMotion } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import type { ComposeThread } from "./useComposeThread";

export interface PostTabProps {
  thread: ComposeThread;
  /** Below 768px. */
  phone: boolean;
  /** PT-06 fills this: the two picture items of the slash menu are listed once it is given. */
  onInsertPicture?: InsertPicture;
}

interface Outline {
  entries: OutlineEntry[];
  active: number;
}

/** The posts as the outline lists them, and the one the caret is in. */
function outlineOf(editor: Editor | null): Outline {
  if (!editor) return { entries: [], active: 0 };
  const runs = postRuns(editor.getJSON() as ThreadDoc);
  const at = editor.state.selection.$from.index(0);
  let active = 0;
  for (const run of runs) if (at >= (run.index === 0 ? 0 : run.start - 1)) active = run.index;
  return { entries: runs.map((run) => ({ index: run.index, lead: postLead(run) })), active };
}

/** Where post `index` starts: the break before it, or the top. */
function breakPosition(editor: Editor, index: number): number {
  let found = -1;
  let seen = 0;
  editor.state.doc.forEach((node, offset) => {
    if (node.type.name !== "postBreak") return;
    seen += 1;
    if (seen === index) found = offset;
  });
  return found;
}

function Body({ thread, phone, onInsertPicture }: PostTabProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const { editor, controls } = usePostEditor({
    readDoc: thread.readDoc,
    phone,
    onDoc: (doc) => {
      setNotice(null);
      thread.onDoc(doc);
    },
  });
  const { entries, active } = useEditorState({ editor, selector: ({ editor: current }) => outlineOf(current) }) ?? { entries: [], active: 0 };

  const go = useCallback(
    (index: number) => {
      if (!editor) return;
      const { state, view } = editor;
      const at = index === 0 ? -1 : breakPosition(editor, index);
      const start = Math.min(at + 1, state.doc.content.size);
      view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(start), 1)));
      view.focus();
      const target = (index === 0 ? view.dom : view.nodeDOM(at)) as HTMLElement | null;
      if (!target) return;
      target.style.scrollMarginTop = "64px";
      target.scrollIntoView?.({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    },
    [editor],
  );

  const move = useCallback(
    (from: number, to: number) => {
      if (!editor) return;
      const doc = editor.getJSON() as ThreadDoc;
      const next = movePost(doc, from, to);
      if (next === doc) return;
      const { state, view } = editor;
      view.dispatch(state.tr.replaceWith(0, state.doc.content.size, state.schema.nodeFromJSON(next).content).scrollIntoView());
    },
    [editor],
  );

  return (
    <div data-testid="post-tab" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 48, paddingTop: 12, minWidth: 0 }}>
      {phone ? null : <PostOutline entries={entries} active={active} onGo={go} onMove={move} />}
      <div style={{ flex: "999 1 520px", maxWidth: 628, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <EditorContent editor={editor} />
        {notice ? (
          <p role="status" style={{ margin: 0, fontFamily: FIGTREE, fontSize: 12.5, fontWeight: 400, lineHeight: "normal", color: t.text2 }}>
            {notice}
          </p>
        ) : null}
      </div>
      {phone ? null : <div data-testid="post-preview-slot" aria-hidden="true" style={{ flex: "1 1 280px", maxWidth: 320 }} />}
      <FormatBar editor={editor} controls={controls} phone={phone} />
      <SlashMenu editor={editor} controls={controls} onInsertPicture={onInsertPicture} notice={setNotice} phone={phone} />
    </div>
  );
}

export function PostTab(props: PostTabProps) {
  const { thread, phone } = props;
  if (thread.status === "error") {
    return (
      <div style={{ paddingTop: 12 }}>
        <ErrorState line="The post didn't load." panel="The post" onRetry={thread.retryLoad} />
      </div>
    );
  }
  if (thread.status === "loading") {
    return (
      <div style={{ paddingTop: 12 }}>
        <LoadingRegion what="the post" announce>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 628 }}>
            <Skeleton width={phone ? "60%" : 280} height={28} radius={4} />
            <Skeleton height={16} radius={4} />
            <Skeleton width="80%" height={16} radius={4} />
          </div>
        </LoadingRegion>
      </div>
    );
  }
  return <Body key={thread.version} {...props} />;
}

export default PostTab;
