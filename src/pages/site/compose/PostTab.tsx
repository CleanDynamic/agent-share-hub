/* PT-05 — the composer's post: the whole thread written as one page, laid out as X's composer.

   It sits at the top of the Build column, above the first prompt, with no box of its own: the maker's avatar on the
   left (36, a phone's 32), the editor beside it, and the toolbar (PostToolbar) under a hairline along the bottom. A
   thread draws as X draws one: every post after the first starts beside its own avatar, and a 2px line joins the
   avatars (ThreadRail). Nothing has to be typed to add anything: pictures, a row of pictures, lists, text size and
   another post are buttons on the toolbar. The slash menu stays for those who type it.

   WHAT IS WRITTEN LIVES IN `useComposeThread` (in the page). This file is the editor, the rail, the toolbar, the
   preview sheet and the two things drawn over the text: the format bar (desktop) and the slash menu. */

import { EditorContent, useEditorState, type Editor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ComponentProps } from "react";

import { Avatar } from "@/components/brand/Avatar";
import { IconButton } from "@/components/brand/IconButton";
import { ErrorState } from "@/components/brand/ErrorState";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { BlockHandle } from "@/components/post/editor/BlockHandle";
import { FormatBar } from "@/components/post/editor/FormatBar";
import { addPictures, postAtCaret, type EditRequest } from "@/components/post/editor/pictures";
import { EditMediaDialog } from "@/components/post/media/EditMediaDialog";
import { withoutGoneSteps } from "@/lib/build/gridSteps";
import { addPostAtEnd, PostToolbar, removePost } from "@/components/post/editor/PostToolbar";
import { ReferencePicker } from "@/components/post/editor/ReferencePicker";
import { applyRef, readRefSpot, removeRef, restoreTypedAt, type RefSpot } from "@/components/post/editor/references";
import { SlashMenu, type InsertPicture } from "@/components/post/editor/SlashMenu";
import { usePostEditor } from "@/components/post/editor/usePostEditor";
import { PostPreview, type PreviewMaker } from "@/components/post/PostPreview";
import { BLOCK_GAP, postType } from "@/components/post/postType";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { PICTURE_ACCEPT } from "@/lib/build/postMedia";
import { getThreadMedia, MAX_THREAD_POSTS, threadRefs, type ThreadDoc } from "@/lib/build/thread";
import { DIMMED_OPACITY, dimTransition, focusedPost, NEXT_PLACEHOLDER, repaintRefs } from "@/components/post/editor/extensions";
import { useInteractive } from "@/lib/theme/interactive";
import { ring } from "@/lib/theme/controls";
import { RefCard, refPaint, useRefCard } from "@/components/post/RefLinks";
import { useResolvedTheme } from "@/contexts/ThemeContext";
import type { RefEntry, RefGroup } from "@/lib/build/postRefs";
import type { Build } from "@/lib/build/types";
import type { GalleryMedia } from "@/lib/build";
import type { MediaSrcMap } from "@/components/gallery/cardMedia";
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
  /** Dev pages only (CA-07): the pictures' rows and files, put in the store as they are, with nothing fetched or signed. */
  devMedia?: { rows: readonly GalleryMedia[]; src: MediaSrcMap; progress?: ReadonlyMap<string, number> };
}

/** CA-06: the build's tiles and sessions, as @ lists them. */
export interface PostReferences {
  groups: readonly RefGroup[];
  /** Every part by its `to`, for painting links (P3). A link whose part is missing is drawn as plain words. */
  lookup?: ReadonlyMap<string, RefEntry>;
  /** A link was clicked: bring its part in. `el` is the words, for Back to the post. */
  onGo?: (to: string, el: HTMLElement) => void;
  /** The parts the post links to, every time the post changes. */
  onMentions?: (tos: string[]) => void;
}

/** The parts of the draft that are not the thread. */
export interface PostDraft {
  build: Build | null;
  title: string;
  maker: PreviewMaker | null;
}

const NO_DRAFT: PostDraft = { build: null, title: "", maker: null };

/** The avatar beside each post, and the gap between it and the words. */
export const RAIL_AVATAR = { desktop: 40, phone: 36 } as const;
export const RAIL_GAP = { desktop: 12, phone: 12 } as const;
/** CA-07: a post's first line starts this far below the top of its avatar, as X sets it. */
export const FIRST_LINE_DROP = 8;
/** Room kept at the right of the words for the focused post's remove button. */
const REMOVE_ROOM = 32;


/** The remove button beside a post's first line. */
const REMOVE_SIZE = 28;

/** IconButton asks for a lucide icon as well as a glyph; the glyph is what is drawn, so this names a type only. */
const NO_ICON = (() => null) as unknown as ComponentProps<typeof IconButton>["icon"];

interface Writing {
  /** The post the selection is in while the editor has focus, else -1. */
  post: number;
  /** Posts in the editor, empty ones included. */
  posts: number;
}

const NOT_WRITING: Writing = { post: -1, posts: 1 };

function readWriting(editor: Editor | null): Writing {
  if (!editor || editor.isDestroyed) return NOT_WRITING;
  let posts = 1;
  editor.state.doc.forEach((node) => {
    if (node.type.name === "postBreak") posts += 1;
  });
  return { post: focusedPost(editor.state), posts };
}

/** CA-07 P1: the row after the last post, as X ends a thread being written: the avatar at half strength, then the words. */
function AddPostRow({ avatar, maker, phone, onAdd }: { avatar: number; maker: PreviewMaker | null; phone: boolean; onAdd: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      data-testid="add-post-row"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onAdd}
      {...handlers}
      style={{
        display: "flex",
        alignItems: "center",
        gap: RAIL_GAP.desktop,
        padding: 0,
        border: 0,
        borderRadius: 6,
        background: "transparent",
        cursor: "pointer",
        textAlign: "left",
        minWidth: 0,
        minHeight: phone ? 44 : avatar,
        ...ring(state.focusVisible),
      }}
    >
      {/* Decorative: the maker's picture at half strength, or a plain circle, never initials too faint to read. */}
      <span aria-hidden="true" data-ghost-avatar="" style={{ display: "inline-flex", opacity: DIMMED_OPACITY, flex: "none" }}>
        {maker?.avatar ? (
          <Avatar size={avatar} userId={maker.id ?? ""} name={maker.name ?? "You"} src={maker.avatar} />
        ) : (
          <span style={{ width: avatar, height: avatar, borderRadius: 999, background: t.avatarFill, display: "block" }} />
        )}
      </span>
      <span data-ink={state.hovered ? "text2" : "label"} style={{ ...postType(phone).composer, color: state.hovered ? t.text2 : t.label }}>{NEXT_PLACEHOLDER}</span>
    </button>
  );
}

/** Whether a drag carries files. */
function hasFiles(transfer: DataTransfer | null | undefined): boolean {
  return Boolean(transfer && Array.from(transfer.types ?? []).includes("Files"));
}

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
function ThreadRail({ editor, maker, size, focused, onTops }: { editor: Editor | null; maker: PreviewMaker | null; size: number; focused: number; onTops?: (tops: number[]) => void }) {
  const [tops, setTops] = useState<number[]>([0]);
  const onTopsRef = useRef(onTops);
  onTopsRef.current = onTops;
  useEffect(() => onTopsRef.current?.(tops), [tops]);
  // CA-07: a post's avatar and its part of the line fade with its words while another post is being written.
  const fade = (index: number) => ({ opacity: focused >= 0 && index !== focused ? DIMMED_OPACITY : 1, transition: dimTransition() });

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
          <span key={`line-${index}`} data-thread-line="" style={{ position: "absolute", left: size / 2 - 1, top: from, height: to - from, width: 2, borderRadius: 1, background: t.line, ...fade(index) }} />
        ) : null;
      })}
      {tops.map((top, index) => (
        <span key={`avatar-${index}`} data-rail-avatar={index} style={{ position: "absolute", left: 0, top, ...fade(index) }}>
          <Avatar size={size} userId={maker?.id ?? ""} name={name} src={maker?.avatar ?? null} />
        </span>
      ))}
    </div>
  );
}

function Body({ thread, phone, onInsertPicture, draft = NO_DRAFT, previewOpen, onPreviewOpenChange, references, devMedia }: PostTabProps) {
  const [notice, setNotice] = useState<string | null>(null);
  // The preview draws the document as the editor has it, on every change, not as it was last saved.
  const [liveDoc, setLiveDoc] = useState<ThreadDoc>(() => thread.readDoc());
  const [ownPreview, setOwnPreview] = useState(false);
  const mentionsRef = useRef(references?.onMentions);
  mentionsRef.current = references?.onMentions;
  useEffect(() => {
    mentionsRef.current?.(threadRefs(thread.readDoc()));
    // Once, as the tab opens on the thread: every change after is onDoc's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const showPreview = previewOpen ?? ownPreview;
  const setPreview = (open: boolean) => (onPreviewOpenChange ? onPreviewOpenChange(open) : setOwnPreview(open));

  const { editor, controls } = usePostEditor({
    readDoc: thread.readDoc,
    phone,
    onDoc: (doc, quiet) => {
      // An edit clears the last sentence; an upload landing is not an edit.
      if (!quiet) setNotice(null);
      setLiveDoc(doc);
      thread.onDoc(references?.lookup ? withoutGoneSteps(doc, references.lookup) : doc);
      mentionsRef.current?.(threadRefs(doc));
    },
  });
  const host = controls.pictures;
  const pictures = useSyncExternalStore(host.store.subscribe, host.store.getSnapshot);
  // Read at the moment an upload needs them, so a render never holds a stale one.
  host.ensureBuild.current = thread.ensureBuild;
  host.notice.current = setNotice;
  // CA-07 P6: the build's tiles, for Link a step; a step since deleted is cleared from what is saved.
  const stepLookup = references?.lookup;
  const stepGroups = references?.groups;
  useEffect(() => {
    host.store.setSteps(stepLookup && stepGroups ? { groups: stepGroups, lookup: stepLookup } : null);
  }, [host, stepLookup, stepGroups]);
  // CA-07 P5: Edit on a picture opens Crop media.
  const [editRequest, setEditRequest] = useState<EditRequest | null>(null);
  host.openEdit.current = setEditRequest;

  useEffect(() => {
    if (devMedia) host.store.seed(devMedia.rows, devMedia.src, devMedia.progress);
  }, [host, devMedia]);
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

  // "Picture or video": ask for files (several at once), then put them in the post the caret is in.
  const chooser = useRef<HTMLInputElement>(null);
  const wanted = useRef<number | null>(null);
  const chooseFiles: InsertPicture = useCallback((current) => {
    wanted.current = postAtCaret(current);
    chooser.current?.click();
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
  /* CA-06 P3: the links' paint, what clicking one does, and the card over one. */
  const theme = useResolvedTheme();
  const { open: cardOpen, control: card, keep: keepCard } = useRefCard();
  const lookup = references?.lookup;
  const onGo = references?.onGo;
  controls.refs ??= { current: null };
  controls.refs.current = references
    ? {
        paint: (to) => refPaint(lookup?.get(to), theme),
        onGo: (to, el) => {
          card.close();
          onGo?.(to, el);
        },
        onHover: (to, el) => (el ? card.enter(to, el) : card.leave()),
      }
    : null;
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    try {
      repaintRefs(editor.view.dom as HTMLElement, controls);
    } catch {
      // A phone width rebuilds the editor; the new one paints as it mounts.
    }
  }, [editor, lookup, theme, controls]);
  /** The spot of a link the card is over: its words, for Change and Remove the link. */
  const spotOf = (to: string, el: HTMLElement): RefSpot | null => {
    if (!editor || editor.isDestroyed) return null;
    try {
      const at = editor.view.posAtDOM(el.firstElementChild ?? el, 0);
      return { from: at + 1, to: at + 1, current: to, typed: false };
    } catch {
      return null;
    }
  };
  const cardEntry = cardOpen ? lookup?.get(cardOpen.to) : undefined;

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

  /* CA-07 P1: the post being written. The others fade; its first line carries a remove button. */
  const writing = useEditorState({ editor, selector: ({ editor: current }) => readWriting(current) }) ?? NOT_WRITING;
  const [tops, setTops] = useState<number[]>([0]);
  const [removeHeld, setRemoveHeld] = useState(false);
  const lastPost = useRef(0);
  if (writing.post >= 0) lastPost.current = writing.post;
  const removeFor = writing.post >= 0 ? writing.post : removeHeld ? lastPost.current : -1;
  const showRemove = writing.posts >= 2 && removeFor >= 0 && removeFor < writing.posts;
  const removeTop = (tops[removeFor] ?? 0) + FIRST_LINE_DROP + Math.round((postType(phone).firstLine.composer - REMOVE_SIZE) / 2);

  /* CA-07 P4: files dragged over a post go into its grid; the post shows where they will land. Dropped anywhere else
     on the page, nothing happens, and the browser does not open the file. */
  const words = useRef<HTMLDivElement>(null);
  const [dropPost, setDropPost] = useState<number | null>(null);
  const postAtY = (clientY: number): number => {
    const box = words.current?.getBoundingClientRect();
    const y = clientY - (box?.top ?? 0);
    let post = 0;
    tops.forEach((top, index) => {
      if (y >= top) post = index;
    });
    return post;
  };
  useEffect(() => {
    const guard = (event: DragEvent) => {
      if (hasFiles(event.dataTransfer)) event.preventDefault();
    };
    window.addEventListener("dragover", guard);
    window.addEventListener("drop", guard);
    return () => {
      window.removeEventListener("dragover", guard);
      window.removeEventListener("drop", guard);
    };
  }, []);
  const editorHeight = words.current?.getBoundingClientRect().height ?? 0;
  const dropBox =
    dropPost === null
      ? null
      : { top: (tops[dropPost] ?? 0) + FIRST_LINE_DROP - 4, bottom: dropPost + 1 < tops.length ? tops[dropPost + 1] - BLOCK_GAP + 4 : Math.max(editorHeight, (tops[dropPost] ?? 0) + 40) + 4 };

  return (
    <div data-testid="post-tab" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "stretch", gap: phone ? RAIL_GAP.phone : RAIL_GAP.desktop, minWidth: 0 }}>
        <ThreadRail editor={editor} maker={draft.maker} size={avatar} focused={writing.post} onTops={setTops} />
        {/* The first line starts 8 below the avatar's top, as X sets it; room at the right for the remove button. */}
        <div
          ref={words}
          data-testid="post-words"
          onDragOverCapture={(event) => {
            if (!hasFiles(event.dataTransfer)) return;
            event.preventDefault();
            setDropPost(postAtY(event.clientY));
          }}
          onDragLeave={(event) => {
            if (!words.current?.contains(event.relatedTarget as Node | null)) setDropPost(null);
          }}
          onDropCapture={(event) => {
            if (!hasFiles(event.dataTransfer)) return;
            event.preventDefault();
            event.stopPropagation();
            setDropPost(null);
            const files = Array.from(event.dataTransfer.files ?? []);
            if (files.length > 0) void addPictures(host, files, postAtY(event.clientY));
          }}
          style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: 12, position: "relative", paddingTop: FIRST_LINE_DROP, paddingRight: REMOVE_ROOM }}
        >
          <EditorContent editor={editor} />
          {dropBox ? (
            <span
              aria-hidden="true"
              data-testid="post-drop-target"
              data-post={dropPost ?? undefined}
              style={{ position: "absolute", left: -4, right: -4, top: dropBox.top, height: Math.max(0, dropBox.bottom - dropBox.top), border: `2px dashed ${t.label}`, borderRadius: 16, pointerEvents: "none", boxSizing: "border-box" }}
            />
          ) : null}
          <BlockHandle editor={editor} host={host} phone={phone} />
          {showRemove && editor ? (
            <IconButton
              icon={NO_ICON}
              glyph="x"
              size={REMOVE_SIZE}
              boxed={false}
              label="Remove this post"
              data-testid="remove-post"
              // A cancelled mouse-down keeps the editor focused, so the post stays the one being written.
              onMouseDown={(event) => event.preventDefault()}
              onFocus={() => setRemoveHeld(true)}
              onBlur={() => setRemoveHeld(false)}
              onClick={() => {
                setRemoveHeld(false);
                removePost(editor, removeFor);
              }}
              style={{ position: "absolute", right: 0, top: removeTop }}
            />
          ) : null}
          <input
            ref={chooser}
            type="file"
            accept={PICTURE_ACCEPT}
            multiple
            hidden
            data-testid="post-picture-file"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              const post = wanted.current;
              wanted.current = null;
              if (files.length > 0 && post !== null) void addPictures(host, files, post);
            }}
          />
        </div>
      </div>
      {/* Under the words, not the avatar, as X lines its toolbar up; a phone gives the toolbar the whole width. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, marginLeft: phone ? 0 : avatar + RAIL_GAP.desktop }}>
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
      {cardOpen && cardEntry ? (
        <RefCard
          entry={cardEntry}
          anchor={cardOpen.el}
          onGo={() => {
            card.close();
            onGo?.(cardOpen.to, cardOpen.el);
          }}
          onChange={() => {
            card.close();
            const spot = spotOf(cardOpen.to, cardOpen.el);
            if (!spot || !editor) return;
            editor.commands.setTextSelection(spot.from);
            openRefs(false);
          }}
          onRemove={() => {
            card.close();
            const spot = spotOf(cardOpen.to, cardOpen.el);
            if (spot && editor) removeRef(editor, spot);
          }}
          onEnter={keepCard}
          onLeave={card.leave}
        />
      ) : null}
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
      <EditMediaDialog request={editRequest} editor={editor} host={host} phone={phone} onClose={() => setEditRequest(null)} />
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
