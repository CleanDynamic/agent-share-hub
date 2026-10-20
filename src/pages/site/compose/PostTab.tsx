/* PT-05 — the composer's post: the whole thread written as one page, laid out as X's composer.

   It sits at the top of the Build column, above the first prompt, with no box of its own: the maker's avatar on the
   left (36, a phone's 32), the editor beside it, and the toolbar (PostToolbar) under a hairline along the bottom. A
   thread draws as X draws one: every post after the first starts beside its own avatar, and a 2px line joins the
   avatars (ThreadRail). Nothing has to be typed to add anything: pictures, a row of pictures, lists, text size and
   another post are buttons on the toolbar. The slash menu stays for those who type it.

   WHAT IS WRITTEN LIVES IN `useComposeThread` (in the page). This file is the editor, the rail, the toolbar, the
   preview sheet and the two things drawn over the text: the format bar (desktop) and the slash menu. */

import { EditorContent, type Editor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Avatar } from "@/components/brand/Avatar";
import { ErrorState } from "@/components/brand/ErrorState";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { BlockHandle } from "@/components/post/editor/BlockHandle";
import { FormatBar } from "@/components/post/editor/FormatBar";
import { addPictures } from "@/components/post/editor/pictures";
import { PostToolbar } from "@/components/post/editor/PostToolbar";
import { ReferencePicker } from "@/components/post/editor/ReferencePicker";
import { applyRef, readRefSpot, removeRef, restoreTypedAt, type RefSpot } from "@/components/post/editor/references";
import { SlashMenu, type InsertPicture } from "@/components/post/editor/SlashMenu";
import { usePostEditor } from "@/components/post/editor/usePostEditor";
import { PostPreview, type PreviewMaker } from "@/components/post/PostPreview";
import { BLOCK_GAP } from "@/components/post/postType";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { PICTURE_ACCEPT } from "@/lib/build/postMedia";
import { getThreadMedia, type ThreadDoc } from "@/lib/build/thread";
import type { RefEntry, RefGroup } from "@/lib/build/postRefs";
import type { Build } from "@/lib/build/types";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import type { ComposeThread } from "./useComposeThread";

export interface PostTabProps {
  thread: ComposeThread;
  /** Below 768px. */
  phone: boolean;
  /** Replaces the toolbar's way of adding a picture. Absent: the tab asks for files itself (PT-06). */
  onInsertPicture?: InsertPicture;
  /** What the preview draws around the thread: the build row, the title as typed and the signed-in maker. */
  draft?: PostDraft;
  /** The preview sheet, opened by the toolbar's Preview. Absent: the tab holds it. */
  previewOpen?: boolean;
  onPreviewOpenChange?: (open: boolean) => void;
  /** CA-06: what the post's words can link to. Absent: no @, and a typed @ is only an @. */
  references?: PostReferences;
}

/** CA-06: the build's tiles and sessions, as @ lists them. */
export interface PostReferences {
  groups: readonly RefGroup[];
}

/** The parts of the draft that are not the thread. */
export interface PostDraft {
  build: Build | null;
  title: string;
  maker: PreviewMaker | null;
}

const NO_DRAFT: PostDraft = { build: null, title: "", maker: null };

/** The avatar beside each post, and the gap between it and the words. */
export const RAIL_AVATAR = { desktop: 36, phone: 32 } as const;
const RAIL_GAP = { desktop: 24, phone: 12 } as const;

/** The editor's element, or null before it is mounted (TipTap's view throws until then) and after it is destroyed. */
function viewDom(editor: Editor | null): HTMLElement | null {
  if (!editor || editor.isDestroyed) return null;
  try {
    return editor.view.dom as HTMLElement;
  } catch {
    return null;
  }
}

/** Where each post starts, in px from the top of the editor: 0, then just after each break. */
function postTops(editor: Editor | null): number[] {
  const dom = viewDom(editor);
  if (!dom) return [0];
  const base = dom.getBoundingClientRect().top;
  const breaks = Array.from(dom.children).filter((child) => child.hasAttribute("data-post-break"));
  return [0, ...breaks.map((child) => Math.round(child.getBoundingClientRect().bottom - base + BLOCK_GAP))];
}

const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, index) => value === b[index]);

/** The maker's avatar beside every post, and the thread line that joins them, as X draws a thread being written. */
function ThreadRail({ editor, maker, size }: { editor: Editor | null; maker: PreviewMaker | null; size: number }) {
  const [tops, setTops] = useState<number[]>([0]);

  useEffect(() => {
    if (!editor) return;
    const measure = () => {
      const next = postTops(editor);
      setTops((previous) => (same(previous, next) ? previous : next));
    };
    // A picture loading, or the column changing width, moves the posts after it.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    const watch = () => {
      const dom = viewDom(editor);
      if (dom) observer?.observe(dom);
      measure();
    };
    watch();
    editor.on("mount", watch);
    editor.on("update", measure);
    return () => {
      editor.off("mount", watch);
      editor.off("update", measure);
      observer?.disconnect();
    };
  }, [editor]);

  const name = maker?.name ?? "You";
  return (
    <div aria-hidden="true" data-testid="thread-rail" style={{ position: "relative", width: size, flex: "none", alignSelf: "stretch" }}>
      {tops.slice(1).map((top, index) => {
        const from = tops[index] + size + 4;
        const to = top - 4;
        return to > from ? (
          <span key={`line-${index}`} data-thread-line="" style={{ position: "absolute", left: size / 2 - 1, top: from, height: to - from, width: 2, borderRadius: 1, background: t.line }} />
        ) : null;
      })}
      {tops.map((top, index) => (
        <span key={`avatar-${index}`} style={{ position: "absolute", left: 0, top }}>
          <Avatar size={size} userId={maker?.id ?? ""} name={name} src={maker?.avatar ?? null} />
        </span>
      ))}
    </div>
  );
}

function Body({ thread, phone, onInsertPicture, draft = NO_DRAFT, previewOpen, onPreviewOpenChange, references }: PostTabProps) {
  const [notice, setNotice] = useState<string | null>(null);
  // The preview draws the document as the editor has it, on every change, not as it was last saved.
  const [liveDoc, setLiveDoc] = useState<ThreadDoc>(() => thread.readDoc());
  const [ownPreview, setOwnPreview] = useState(false);
  const showPreview = previewOpen ?? ownPreview;
  const setPreview = (open: boolean) => (onPreviewOpenChange ? onPreviewOpenChange(open) : setOwnPreview(open));

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

  // "Picture or video" and "Row of pictures": ask for files, then put them after the block the caret is in.
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

  const insertPicture = onInsertPicture ?? chooseFiles;

  /* CA-06 P2: @. The spot is read as it opens; the picker's field takes focus and the editor keeps the selection. */
  const [refSpot, setRefSpot] = useState<{ spot: RefSpot; anchor: { top: number; left: number } | null } | null>(null);
  const openRefs = useCallback(
    (typed = false) => {
      if (!editor || editor.isDestroyed) return false;
      const spot = readRefSpot(editor, typed);
      let anchor: { top: number; left: number } | null = null;
      try {
        const at = editor.view.coordsAtPos(spot.from);
        anchor = { top: at.bottom, left: at.left };
      } catch {
        anchor = null;
      }
      setRefSpot({ spot, anchor });
      return true;
    },
    [editor],
  );
  controls.openRefs ??= { current: null };
  controls.openRefs.current = references ? openRefs : null;
  const closeRefs = useCallback(() => setRefSpot(null), []);
  const chooseRef = (entry: RefEntry) => {
    if (editor && refSpot) applyRef(editor, refSpot.spot, entry);
    closeRefs();
  };
  const removeRefHere = () => {
    if (editor && refSpot) removeRef(editor, refSpot.spot);
    closeRefs();
  };
  const escapeRefs = useCallback(() => {
    setRefSpot((open) => {
      if (open && editor && !editor.isDestroyed) {
        if (open.spot.typed) restoreTypedAt(editor, open.spot);
        else editor.commands.focus();
      }
      return null;
    });
  }, [editor]);
  const avatar = phone ? RAIL_AVATAR.phone : RAIL_AVATAR.desktop;

  return (
    <div data-testid="post-tab" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "stretch", gap: phone ? RAIL_GAP.phone : RAIL_GAP.desktop, minWidth: 0 }}>
        <ThreadRail editor={editor} maker={draft.maker} size={avatar} />
        {/* The first line sits level with the middle of the avatar, as X's "What's happening?" does. */}
        <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: 12, position: "relative", paddingTop: Math.max(0, (avatar - 26) / 2) }}>
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
        </div>
      </div>
      {/* Under the words, not the avatar, as X lines its toolbar up; a phone gives the toolbar the whole width. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0, marginLeft: phone ? 0 : avatar + RAIL_GAP.desktop }}>
        {notice ? (
          <p role="status" style={{ margin: 0, fontFamily: FIGTREE, fontSize: 12.5, fontWeight: 400, lineHeight: "normal", color: t.text2 }}>
            {notice}
          </p>
        ) : null}
        <PostToolbar
          editor={editor}
          phone={phone}
          onInsertPicture={insertPicture}
          notice={setNotice}
          onPreview={() => setPreview(true)}
          onReference={references ? () => void openRefs(false) : undefined}
        />
      </div>
      <FormatBar editor={editor} controls={controls} phone={phone} />
      <SlashMenu editor={editor} controls={controls} onInsertPicture={insertPicture} notice={setNotice} phone={phone} />
      {references ? (
        <ReferencePicker
          open={Boolean(refSpot)}
          groups={references.groups}
          current={refSpot?.spot.current ?? null}
          anchor={refSpot?.anchor ?? null}
          phone={phone}
          onChoose={chooseRef}
          onRemove={removeRefHere}
          onClose={escapeRefs}
        />
      ) : null}
      <BottomSheet open={showPreview} onOpenChange={setPreview} title="Preview">
        {showPreview ? (
          <PostPreview doc={liveDoc} build={draft.build} title={draft.title} maker={draft.maker} media={pictures.rows} src={pictures.src} variant="sheet" />
        ) : null}
      </BottomSheet>
    </div>
  );
}

export function PostTab(props: PostTabProps) {
  const { thread, phone } = props;
  if (thread.status === "error") {
    return <ErrorState line="The post didn't load." panel="The post" onRetry={thread.retryLoad} />;
  }
  if (thread.status === "loading") {
    return (
      <LoadingRegion what="the post" announce>
        <div style={{ display: "flex", gap: phone ? RAIL_GAP.phone : RAIL_GAP.desktop }}>
          <Skeleton width={phone ? RAIL_AVATAR.phone : RAIL_AVATAR.desktop} height={phone ? RAIL_AVATAR.phone : RAIL_AVATAR.desktop} radius={999} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
            <Skeleton width={phone ? "60%" : 280} height={20} radius={4} />
            <Skeleton width="80%" height={16} radius={4} />
          </div>
        </div>
      </LoadingRegion>
    );
  }
  return <Body key={thread.version} {...props} />;
}

export default PostTab;
