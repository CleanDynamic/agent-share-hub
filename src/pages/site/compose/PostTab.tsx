/* PT-05 — the composer's post: the whole thread written as one page, laid out as X's composer.

   It sits at the top of the Build column, above the first prompt, with no box of its own: the maker's avatar on the
   left (36, a phone's 32), the editor beside it, and the toolbar (PostToolbar) under a hairline along the bottom. A
   thread draws as X draws one: every post after the first starts beside its own avatar, and a 2px line joins the
   avatars (ThreadRail). Nothing has to be typed to add anything: pictures, a row of pictures, lists, text size and
   another post are buttons on the toolbar. The slash menu stays for those who type it.

   WHAT IS WRITTEN LIVES IN `useComposeThread` (in the page). This file is the editor, the rail, the toolbar, the
   preview sheet and the two things drawn over the text: the format bar (desktop) and the slash menu. */

import { EditorContent, useEditorState, type Editor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentProps } from "react";

import { Avatar } from "@/components/brand/Avatar";
import { IconButton } from "@/components/brand/IconButton";
import { PanelFailed } from "./PanelBoundary";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { BlockHandle } from "@/components/post/editor/BlockHandle";
import { FormatBar } from "@/components/post/editor/FormatBar";
import { addPictures, postAtCaret, type EditRequest } from "@/components/post/editor/pictures";
import { EditMediaDialog } from "@/components/post/media/EditMediaDialog";
import { withoutGoneSteps } from "@/lib/build/gridSteps";
import { addPostAtEnd, PostToolbar, removePost } from "@/components/post/editor/PostToolbar";
import { LinkPanel } from "@/components/post/editor/LinkPanel";
import { readRefSpot, restoreTypedAt, type RefSpot } from "@/components/post/editor/references";
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
import { refLookup, shownName, type RefEntry, type RefGroup } from "@/lib/build/postRefs";
import { extraLinks, insertLinked, LINK_RULES_COPY, linkOf, linkRanges, linkWords, postAt, rangeRefusal, removeExtraLinks, trimRange, unlinkAt } from "@/lib/build/linkRules";
import { NOTICE_COPY } from "@/lib/build/referenceHistory";
import { TextLink } from "./modalRecipes";
import { DANGER, PAD, words as pieceWords } from "./referencePieces";
import { TextButton } from "./composeControls";
import { useHistoryKeys, type LinkEdit, type ReferenceHistoryControls } from "./useReferenceHistory";
import type { Build } from "@/lib/build/types";
import type { GalleryMedia } from "@/lib/build";
import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import type { ComposeThread } from "./useComposeThread";
import { reportError } from "@/lib/errors/report";

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
  /** CA-19 P2: the composer's one history of colour and link steps. Absent: links change straight in the editor. */
  history?: ReferenceHistoryControls;
  /** CA-19 P2: the editor, as it is built and rebuilt, for the history and the colour picker's linked text. */
  onEditor?: (editor: Editor | null) => void;
  /** CA-19 P3: the screen's name for a target ("Data model", "Session 3", "Login flow"). */
  nameOf?: (to: string) => string;
  /** CA-19 P4: the colour picker's "Select words in the post instead": the post asks for one stretch to link to this. */
  selecting?: { to: string; name: string } | null;
  /** The words were linked, or Cancel or Escape ended it. */
  onSelectingDone?: () => void;
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
/** SV-05 P5: the least room between the post's grip and its avatar. */
export const GRIP_CLEAR = 4;
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
  /* CA-19 P2: the composer's history and the colour picker reach the post through the editor. */
  const onEditor = references?.onEditor;
  useEffect(() => {
    onEditor?.(editor);
    return () => onEditor?.(null);
  }, [editor, onEditor]);
  const history = references?.history;
  /** A link change as one step of the history; without one (a dev page), straight in the editor. */
  const runLink = useCallback(
    (sentence: string, edit: LinkEdit): boolean => {
      if (history) return history.step(sentence, { edit });
      if (!editor || editor.isDestroyed) return false;
      const tr = editor.state.tr;
      if (edit(tr) === false || !tr.docChanged) return false;
      editor.view.dispatch(tr);
      return true;
    },
    [history, editor],
  );
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
      .catch((cause) => reportError(cause, { source: "console", context: "Compose thread media did not load" }));
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
  // CA-19 P2: Ctrl or Cmd Z, and Shift Z, step through the colour and link history while the panel is open.
  useHistoryKeys(Boolean(refSpot && history), { undo: () => history?.undo(), redo: () => history?.redo() });
  /* CA-19 P3: the link panel's words, their post, and why they cannot be linked; read as it opens. */
  const allTargets = useMemo(() => references?.lookup ?? refLookup(references?.groups ?? []), [references?.lookup, references?.groups]);
  const nameFor = references?.nameOf;
  const nameOf = useCallback((to: string) => nameFor?.(to) ?? shownName(allTargets.get(to)), [nameFor, allTargets]);
  const spotFacts = useMemo(() => {
    if (!refSpot || !editor || editor.isDestroyed) return null;
    const doc = editor.state.doc;
    const { from, to, current } = refSpot.spot;
    const range = current ? linkRanges(doc).find((candidate) => candidate.to === current && candidate.from <= from && candidate.end >= to) ?? null : null;
    const refusal = range ? null : rangeRefusal(doc, from, to);
    const trimmed = !range && !refusal && from !== to ? trimRange(doc, from, to) : null;
    if (trimmed && trimmed.from >= trimmed.to) return { range, refusal: LINK_RULES_COPY.oneStretch, words: "", post: postAt(doc, from) };
    const words = range ? range.text : trimmed ? doc.textBetween(trimmed.from, trimmed.to, "\n", "\n") : "";
    return { range, refusal, words, post: postAt(doc, from) };
  }, [refSpot, editor]);
  /** A target's linked text somewhere other than the words the panel is on. */
  const linkedElsewhere = useCallback(
    (to: string) => {
      if (!editor || editor.isDestroyed) return null;
      const range = linkOf(editor.state.doc, to);
      if (!range || (spotFacts?.range && spotFacts.range.from === range.from)) return null;
      return { words: range.text, post: range.post };
    },
    [editor, spotFacts],
  );
  const chooseRef = (entry: RefEntry) => {
    if (!editor || !refSpot || spotFacts?.refusal) return;
    const { spot } = refSpot;
    const name = nameOf(entry.to);
    const moving = linkedElsewhere(entry.to);
    const sentence = moving ? NOTICE_COPY.moved(name) : NOTICE_COPY.linked(spotFacts?.words || entry.name, name);
    let end = spot.to;
    runLink(sentence, (tr) => {
      const range = spotFacts?.range;
      if (range) {
        const done = linkWords(tr, range.from, range.end, entry.to);
        if (!done.ok) return false;
        end = done.to;
        return undefined;
      }
      if (spot.from !== spot.to) {
        const done = linkWords(tr, spot.from, spot.to, entry.to);
        if (!done.ok) return false;
        end = done.to;
        return undefined;
      }
      const done = insertLinked(tr, spot.from, entry.name, entry.to);
      end = done.to + 1;
      return { inserted: { at: done.from, size: entry.name.length + 1 } };
    });
    closeRefs();
    if (!editor.isDestroyed) editor.chain().focus().setTextSelection(Math.min(end, editor.state.doc.content.size)).run();
  };
  const removeRefHere = () => {
    if (editor && refSpot) {
      const { from, to } = refSpot.spot;
      runLink(NOTICE_COPY.removed, (tr) => (unlinkAt(tr, from, to).length ? undefined : false));
    }
    closeRefs();
    editor?.commands.focus();
  };
  /* CA-19 P4: select words to link to a component. Highlighting one stretch links it at once, as one step, and the bar goes. */
  const selecting = references?.selecting ?? null;
  const onSelectingDone = references?.onSelectingDone;
  const [selectRefusal, setSelectRefusal] = useState<string | null>(null);
  const postTop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setSelectRefusal(null);
    if (!selecting) return;
    postTop.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onSelectingDone?.();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [selecting, onSelectingDone]);
  useEffect(() => {
    const dom = viewDom(editor);
    if (!selecting || !dom || !editor) return;
    const settle = () => {
      const { from, to } = editor.state.selection;
      if (from === to) return;
      const refusal = rangeRefusal(editor.state.doc, from, to);
      const trimmed = refusal ? null : trimRange(editor.state.doc, from, to);
      if (refusal || !trimmed || trimmed.from >= trimmed.to) {
        setSelectRefusal(refusal ?? LINK_RULES_COPY.oneStretch);
        return;
      }
      const words = editor.state.doc.textBetween(trimmed.from, trimmed.to, "\n", "\n");
      if (runLink(NOTICE_COPY.linked(words, selecting.name), (tr) => (linkWords(tr, from, to, selecting.to).ok ? undefined : false))) onSelectingDone?.();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift" || event.shiftKey) settle();
    };
    dom.addEventListener("mouseup", settle);
    dom.addEventListener("keyup", onKeyUp);
    return () => {
      dom.removeEventListener("mouseup", settle);
      dom.removeEventListener("keyup", onKeyUp);
    };
  }, [selecting, editor, runLink, onSelectingDone]);

  /* CA-19 P1: an old post's extra links, and the one step that removes them. */
  const extras = useEditorState({ editor, selector: ({ editor: current }) => (current && !current.isDestroyed ? extraLinks(current.state.doc).length : 0) }) ?? 0;
  const removeExtras = () => runLink(NOTICE_COPY.removedExtra(extras), (tr) => (removeExtraLinks(tr) ? undefined : false));
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
    <div ref={postTop} data-testid="post-tab" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      {selecting ? <SelectWordsBar name={selecting.name} refusal={selectRefusal} onCancel={() => onSelectingDone?.()} /> : null}
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
          {/* SV-05 P5: the grip stands in the gap beside the avatar, 4 clear of it. */}
          <BlockHandle editor={editor} host={host} phone={phone} gutter={RAIL_GAP.desktop - GRIP_CLEAR} />
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
        {references && extras > 0 ? (
          <p data-testid="extra-links" style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontFamily: FIGTREE, fontSize: 12.5, fontWeight: 400, lineHeight: "normal", color: t.label }}>
            {LINK_RULES_COPY.alsoLinked}
            <TextLink phone={phone} onClick={removeExtras}>
              {LINK_RULES_COPY.removeExtra}
            </TextLink>
          </p>
        ) : null}
        <PostToolbar
          editor={editor}
          phone={phone}
          onInsertPicture={insertPicture}
          notice={setNotice}
          onPreview={() => setPreview(true)}
          onReference={references ? () => void openRefs(false) : undefined}
          referenceOpen={Boolean(refSpot)}
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
            if (spot) runLink(NOTICE_COPY.removed, (tr) => (unlinkAt(tr, spot.from).length ? undefined : false));
          }}
          onEnter={keepCard}
          onLeave={card.leave}
        />
      ) : null}
      {references ? (
        <LinkPanel
          open={Boolean(refSpot)}
          groups={references.groups}
          lookup={allTargets}
          current={refSpot?.spot.current ?? null}
          words={spotFacts?.words ?? ""}
          post={spotFacts?.post ?? 1}
          refusal={spotFacts?.refusal ?? null}
          linkedElsewhere={linkedElsewhere}
          nameOf={nameOf}
          anchor={refSpot?.anchor ?? null}
          phone={phone}
          onChoose={chooseRef}
          onRemove={removeRefHere}
          onClose={escapeRefs}
          history={history ? { canUndo: history.canUndo, canRedo: history.canRedo, onUndo: history.undo, onRedo: history.redo } : undefined}
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

export const SELECT_WORDS_COPY = {
  ask: (name: string) => `Select words to link to ${name}`,
  cancel: "Cancel",
} as const;

/** CA-19 P4: the bar at the top of the post while it asks for words: `--tile`, padding 10 14, 12.5, Cancel at 500 at the right. */
function SelectWordsBar({ name, refusal, onCancel }: { name: string; refusal: string | null; onCancel: () => void }) {
  return (
    <div role="status" data-testid="select-words-bar" style={{ display: "flex", alignItems: "center", gap: 12, background: t.tile, borderRadius: 8, padding: PAD.bar, minWidth: 0 }}>
      <span style={{ ...pieceWords(12.5, 400, refusal ? DANGER : t.text), flexGrow: 1, minWidth: 0 }}>{refusal ?? SELECT_WORDS_COPY.ask(name)}</span>
      <TextButton style={pieceWords(12.5, 500, t.text)} onClick={onCancel}>
        {SELECT_WORDS_COPY.cancel}
      </TextButton>
    </div>
  );
}

export function PostTab(props: PostTabProps) {
  const { thread, phone } = props;
  if (thread.status === "error") {
    return <PanelFailed panel="Post" onRetry={thread.retryLoad} />;
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
