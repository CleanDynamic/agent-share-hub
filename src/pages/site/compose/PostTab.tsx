/* PT-05 — the composer's Post tab: the whole thread written as one page.

   A wrapping row with 48 between, 12 above it: the Posts outline (flex 1 1 170, max 190), the editor (flex 999 1 520,
   max 628: the width of a post in the Gallery) and the preview (flex 1 1 280, max 320, PT-07): the draft drawn as the
   Gallery will draw it, from the document as the editor has it, not as it was last saved.
   The editor has no box, border or background: the text sits on the surface, in the type the published post uses.

   WHAT IS WRITTEN LIVES IN `useComposeThread` (in the page), so it survives a switch to Build. This file is the
   editor, the outline, the preview and the two things drawn over the text: the format bar and the slash menu. A phone
   (below 768) has no outline, no preview column and no format bar; posts are reached by scrolling, the toolbar is
   docked to the bottom of the screen, and the preview is a sheet the title row's Preview button opens. */

import { EditorContent, useEditorState, type Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { ErrorState } from "@/components/brand/ErrorState";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { BlockHandle } from "@/components/post/editor/BlockHandle";
import { FormatBar } from "@/components/post/editor/FormatBar";
import { addPictures } from "@/components/post/editor/pictures";
import { PhoneToolbar } from "@/components/post/editor/PhoneToolbar";
import { PostOutline, type OutlineEntry } from "@/components/post/editor/PostOutline";
import { SlashMenu, type InsertPicture } from "@/components/post/editor/SlashMenu";
import { usePostEditor } from "@/components/post/editor/usePostEditor";
import { PostPreview, type PreviewMaker } from "@/components/post/PostPreview";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { PICTURE_ACCEPT } from "@/lib/build/postMedia";
import { getThreadMedia, type ThreadDoc } from "@/lib/build/thread";
import type { Build } from "@/lib/build/types";
import { movePost, postLead, postRuns } from "@/lib/build/threadEditor";
import { prefersReducedMotion } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import type { ComposeThread } from "./useComposeThread";

export interface PostTabProps {
  thread: ComposeThread;
  /** Below 768px. */
  phone: boolean;
  /** Replaces the slash menu's way of adding a picture. Absent: the tab asks for files itself (PT-06). */
  onInsertPicture?: InsertPicture;
  /** What the preview draws around the thread: the build row, the title as typed and the signed-in maker. */
  draft?: PostDraft;
  /** A phone's preview sheet, opened by the title row's Preview button. */
  previewOpen?: boolean;
  onPreviewOpenChange?: (open: boolean) => void;
}

/** The parts of the draft that are not the thread. */
export interface PostDraft {
  build: Build | null;
  title: string;
  maker: PreviewMaker | null;
}

const NO_DRAFT: PostDraft = { build: null, title: "", maker: null };

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

function Body({ thread, phone, onInsertPicture, draft = NO_DRAFT, previewOpen = false, onPreviewOpenChange }: PostTabProps) {
  const [notice, setNotice] = useState<string | null>(null);
  // The preview draws the document as the editor has it, on every change, not as it was last saved.
  const [liveDoc, setLiveDoc] = useState<ThreadDoc>(() => thread.readDoc());
  const { editor, controls } = usePostEditor({
    readDoc: thread.readDoc,
    phone,
    onDoc: (doc) => {
      setNotice(null);
      setLiveDoc(doc);
      thread.onDoc(doc);
    },
  });
  const host = controls.pictures;
  const pictures = useSyncExternalStore(host.store.subscribe, host.store.getSnapshot);
  // Read at the moment an upload needs them, so a render never holds a stale one.
  host.ensureBuild.current = thread.ensureBuild;
  host.notice.current = setNotice;

  // The thread's pictures are in the store before the node views ask for them.
  const buildId = thread.buildId;
  useEffect(() => {
    if (!buildId) return;
    let stale = false;
    getThreadMedia(buildId)
      .then((rows) => {
        if (!stale) host.store.addRows(rows);
      })
      .catch((cause) => console.error("[Compose] thread media did not load", cause));
    return () => {
      stale = true;
    };
  }, [buildId, host]);

  // "Picture or video" and "Row of pictures": ask for files, then put them where the slash was.
  const chooser = useRef<HTMLInputElement>(null);
  const wanted = useRef<{ kind: "single" | "row"; gap: number; replaceEmpty: boolean } | null>(null);
  const chooseFiles: InsertPicture = useCallback((kind, current) => {
    const { selection, doc: document_ } = current.state;
    const index = selection.$from.index(0);
    const block = document_.maybeChild(index);
    const empty = Boolean(block && block.type.name === "paragraph" && block.content.size === 0);
    wanted.current = { kind, gap: empty ? index : index + 1, replaceEmpty: empty };
    const input = chooser.current;
    if (!input) return;
    input.multiple = kind === "row";
    input.click();
  }, []);

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

  const insertPicture = onInsertPicture ?? chooseFiles;
  const preview = (variant: "column" | "sheet") => (
    <PostPreview doc={liveDoc} build={draft.build} title={draft.title} maker={draft.maker} media={pictures.rows} src={pictures.src} variant={variant} />
  );

  return (
    <div data-testid="post-tab" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 48, paddingTop: 12, minWidth: 0 }}>
      {phone ? null : <PostOutline entries={entries} active={active} onGo={go} onMove={move} />}
      <div style={{ flex: "999 1 520px", maxWidth: 628, minWidth: 0, display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>
        <EditorContent editor={editor} />
        <BlockHandle editor={editor} host={host} phone={phone} />
        <input
          ref={chooser}
          type="file"
          accept={PICTURE_ACCEPT}
          hidden
          data-testid="post-picture-file"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            const want = wanted.current;
            wanted.current = null;
            if (files.length > 0 && want) void addPictures(host, files, { gap: want.gap, replaceEmpty: want.replaceEmpty }, want.kind);
          }}
        />
        {notice ? (
          <p role="status" style={{ margin: 0, fontFamily: FIGTREE, fontSize: 12.5, fontWeight: 400, lineHeight: "normal", color: t.text2 }}>
            {notice}
          </p>
        ) : null}
      </div>
      {phone ? null : preview("column")}
      <FormatBar editor={editor} controls={controls} phone={phone} />
      <SlashMenu editor={editor} controls={controls} onInsertPicture={insertPicture} notice={setNotice} phone={phone} />
      {phone ? (
        <>
          <PhoneToolbar editor={editor} onInsertPicture={insertPicture} notice={setNotice} />
          <BottomSheet open={previewOpen} onOpenChange={(open) => onPreviewOpenChange?.(open)} title="Preview">
            {previewOpen ? preview("sheet") : null}
          </BottomSheet>
        </>
      ) : null}
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
