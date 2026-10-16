// pictures: adding, replacing, removing and moving pictures in the composer's editor (PT-06).
//
// Not React. The node views (PictureView, PictureRowView) and the handle (BlockHandle) read the store and call these;
// the plugin at the bottom is what turns a drop or a paste into an upload.
//
// A PICTURE UPLOADING IS A postMedia WITH NO mediaId AND AN uploadId. The save already waits on a picture with no
// mediaId (thread.ts), so a half-finished picture is never written. The percent lives in the store, not in the
// document: it changes many times a second and is nobody's to save or undo.
//
// THE FILE IS NEVER DELETED HERE. Removing a picture takes its node out; saveThread writes the post-media set from
// what the document still shows, which clears the picture's place in the post. The build_media row and its object stay.

import type { Editor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection, Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import { mediaKindFor, probeFile } from "@/lib/build/media";
import {
  moveBlock,
  newPicture,
  newRow,
  pictureRejection,
  roomAt,
  signPostMedia,
  uploadPostPicture,
  ROW_COUNT_SENTENCE,
  type BlockPath,
  type Destination,
} from "@/lib/build/postMedia";
import type { GalleryMedia } from "@/lib/build";
import type { ThreadDoc, ThreadPostMedia } from "@/lib/build/thread";
import type { BuildMedia, MediaKind } from "@/lib/build/types";

// --- the store ---------------------------------------------------------------------

export interface PictureSnapshot {
  /** The thread's media rows by id: what a node view needs to find its file. */
  rows: ReadonlyMap<string, GalleryMedia>;
  /** path -> signed URL, as PostMedia takes it. */
  src: MediaSrcMap;
  /** uploadId -> percent, 0 to 100, while a picture uploads. */
  progress: ReadonlyMap<string, number>;
}

export interface PictureStore {
  getSnapshot(): PictureSnapshot;
  subscribe(listener: () => void): () => void;
  /** Add media rows, and sign them. */
  addRows(rows: readonly BuildMedia[]): void;
  /** null clears the upload's entry. */
  setProgress(uploadId: string, percent: number | null): void;
}

export function createPictureStore(sign: (rows: readonly BuildMedia[]) => Promise<Map<string, string>> = signPostMedia): PictureStore {
  let snapshot: PictureSnapshot = { rows: new Map(), src: new Map(), progress: new Map() };
  const listeners = new Set<() => void>();
  const set = (next: Partial<PictureSnapshot>) => {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    addRows(rows) {
      const fresh = rows.filter((row) => !snapshot.rows.has(row.id) || snapshot.rows.get(row.id)?.path !== row.path);
      if (fresh.length === 0) return;
      set({ rows: new Map([...snapshot.rows, ...fresh.map((row) => [row.id, row as GalleryMedia] as const)]) });
      void sign(fresh).then((signed) => {
        if (signed.size > 0) set({ src: new Map([...snapshot.src, ...signed]) });
      });
    },
    setProgress(uploadId, percent) {
      const progress = new Map(snapshot.progress);
      if (percent === null) progress.delete(uploadId);
      else progress.set(uploadId, percent);
      set({ progress });
    },
  };
}

// --- the host ----------------------------------------------------------------------

/** What the extensions and the node views share, and what PostTab fills in. */
export interface PictureHost {
  store: PictureStore;
  /** The live editor: it is rebuilt at a phone width, so it is read when needed and never held. */
  editor: { current: Editor | null };
  /** The build's id, creating the draft first when there is none (the same call the thread's save makes). */
  ensureBuild: { current: (() => Promise<string>) | null };
  /** A sentence under the editor. Cleared by the next edit. */
  notice: { current: ((sentence: string) => void) | null };
}

export function createPictureHost(): PictureHost {
  return { store: createPictureStore(), editor: { current: null }, ensureBuild: { current: null }, notice: { current: null } };
}

function say(host: PictureHost, sentences: readonly (string | null)[]): void {
  const sentence = sentences.filter(Boolean).join(" ");
  if (sentence) host.notice.current?.(sentence);
}

function live(host: PictureHost): Editor | null {
  const editor = host.editor.current;
  return editor && !editor.isDestroyed ? editor : null;
}

// --- positions ----------------------------------------------------------------------

/** The position of the gap before the top-level block at `gap`. */
export function gapPos(doc: PMNode, gap: number): number {
  let pos = 0;
  for (let index = 0; index < Math.min(gap, doc.childCount); index++) pos += doc.child(index).nodeSize;
  return pos;
}

/** A block's place from the position before it: top level, or in a row. Null anywhere else. */
export function pathOf(doc: PMNode, pos: number): BlockPath | null {
  if (pos < 0 || pos > doc.content.size) return null;
  const $pos = doc.resolve(pos);
  if ($pos.depth === 0) return $pos.index(0) < doc.childCount ? { top: $pos.index(0) } : null;
  if ($pos.depth === 1 && $pos.parent.type.name === "postMediaRow") return { top: $pos.index(0), child: $pos.index(1) };
  return null;
}

/** The position before the block at a path. */
export function posOfPath(doc: PMNode, path: BlockPath): number {
  const start = gapPos(doc, path.top);
  if (path.child === undefined) return start;
  const row = doc.child(path.top);
  let pos = start + 1;
  for (let index = 0; index < path.child; index++) pos += row.child(index).nodeSize;
  return pos;
}

function findUpload(doc: PMNode, uploadId: string): number {
  let found = -1;
  doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.type.name === "postMedia" && node.attrs.uploadId === uploadId) {
      found = pos;
      return false;
    }
    return true;
  });
  return found;
}

// --- writing to the document ----------------------------------------------------------

/** Change the attributes of the picture marked `uploadId`, out of the undo history. False when it is gone. */
function patchUpload(host: PictureHost, uploadId: string, attrs: Record<string, unknown>): boolean {
  const editor = live(host);
  if (!editor) return false;
  const pos = findUpload(editor.state.doc, uploadId);
  if (pos < 0) return false;
  const node = editor.state.doc.nodeAt(pos) as PMNode;
  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs }).setMeta("addToHistory", false));
  return true;
}

/** Take the picture at `pos` out; a row left with one picture becomes that picture. The file stays. */
export function removePictureAt(editor: Editor, pos: number): void {
  const { state, view } = editor;
  const node = state.doc.nodeAt(pos);
  if (!node) return;
  const $pos = state.doc.resolve(pos);
  const tr = state.tr;
  if ($pos.depth === 1 && $pos.parent.type.name === "postMediaRow") {
    const row = $pos.parent;
    const rowStart = $pos.before(1);
    if (row.childCount <= 2) {
      const rest: PMNode[] = [];
      row.forEach((child, _offset, index) => {
        if (index !== $pos.index(1)) rest.push(child);
      });
      tr.replaceWith(rowStart, rowStart + row.nodeSize, rest);
    } else {
      tr.delete(pos, pos + node.nodeSize);
    }
  } else {
    tr.delete(pos, pos + node.nodeSize);
  }
  view.dispatch(tr.scrollIntoView());
}

/** Replace the document with `doc` and select the block at `at`. Pictures are NodeSelected, text gets a caret. */
export function applyThread(editor: Editor, doc: ThreadDoc, at: BlockPath): void {
  const { state, view } = editor;
  const tr = state.tr.replaceWith(0, state.doc.content.size, state.schema.nodeFromJSON(doc).content);
  const pos = Math.min(posOfPath(tr.doc, at), tr.doc.content.size);
  const node = tr.doc.nodeAt(pos);
  if (node && (node.type.name === "postMedia" || node.type.name === "postMediaRow")) tr.setSelection(NodeSelection.create(tr.doc, pos));
  else if (node?.isTextblock) tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)));
  view.dispatch(tr.scrollIntoView());
}

/** Move a block, or say why not. Returns whether the document changed. */
export function moveBlockIn(host: PictureHost, editor: Editor, from: BlockPath, to: Destination): boolean {
  const result = moveBlock(editor.getJSON() as ThreadDoc, from, to);
  if (!result) return false;
  if ("refused" in result) {
    say(host, [result.refused]);
    return false;
  }
  applyThread(editor, result.doc, result.at);
  return true;
}

function insertBlocks(editor: Editor, gap: number, blocks: readonly unknown[], replaceEmpty: boolean): void {
  const { state, view } = editor;
  const nodes = blocks.map((block) => state.schema.nodeFromJSON(block));
  const at = Math.max(0, Math.min(gap, state.doc.childCount));
  const pos = gapPos(state.doc, at);
  const existing = at < state.doc.childCount ? state.doc.child(at) : null;
  const tr = state.tr;
  if (replaceEmpty && existing && existing.type.name === "paragraph" && existing.content.size === 0) tr.replaceWith(pos, pos + existing.nodeSize, nodes);
  else tr.insert(pos, nodes);
  view.dispatch(tr.scrollIntoView());
}

// --- uploading ----------------------------------------------------------------------

export interface InsertAt {
  /** Before the top-level block at this index. */
  gap: number;
  /** The block there is an empty paragraph the pictures replace. */
  replaceEmpty?: boolean;
}

interface Item {
  file: File;
  uploadId: string;
  w: number | null;
  h: number | null;
}

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `up-${Math.random().toString(36).slice(2, 10)}`);

function failure(file: File): string {
  return `${file.name || "That file"} did not upload. Check your connection and try again.`;
}

async function probeAll(files: readonly File[]) {
  return Promise.all(files.map((file) => probeFile(file, (mediaKindFor(file.type) ?? "image") as MediaKind)));
}

/** Upload one item into its node. `restore` puts the old picture back when it fails (a replacement). */
async function runUpload(host: PictureHost, buildId: string, item: Item, restore?: Record<string, unknown>): Promise<void> {
  try {
    const done = await uploadPostPicture(buildId, item.file, (percent) => host.store.setProgress(item.uploadId, percent), { w: item.w, h: item.h });
    host.store.addRows([done.media]);
    patchUpload(host, item.uploadId, { mediaId: done.media.id, w: done.w, h: done.h, uploadId: null });
  } catch (cause) {
    console.error("[Compose] picture upload failed", cause);
    const editor = live(host);
    if (editor) {
      if (restore) patchUpload(host, item.uploadId, { ...restore, uploadId: null });
      else {
        const pos = findUpload(editor.state.doc, item.uploadId);
        if (pos >= 0) removePictureAt(editor, pos);
      }
    }
    say(host, [failure(item.file)]);
  } finally {
    host.store.setProgress(item.uploadId, null);
  }
}

async function startUploads(host: PictureHost, items: readonly Item[], restore?: Record<string, unknown>): Promise<void> {
  let buildId: string;
  try {
    const ensure = host.ensureBuild.current;
    if (!ensure) throw new Error("no build to upload to");
    buildId = await ensure();
  } catch (cause) {
    console.error("[Compose] could not start the picture upload", cause);
    const editor = live(host);
    for (const item of items) {
      if (!editor) break;
      if (restore) patchUpload(host, item.uploadId, { ...restore, uploadId: null });
      else {
        const pos = findUpload(editor.state.doc, item.uploadId);
        if (pos >= 0) removePictureAt(editor, pos);
      }
    }
    say(host, items.map((item) => failure(item.file)));
    return;
  }
  await Promise.all(items.map((item) => runUpload(host, buildId, item, restore)));
}

/**
 * Put files in the post at `at`: refuse the ones that cannot go (naming the file and the limit), refuse the ones that
 * do not fit (naming the post's four), insert a node for each at its probed size, then upload them.
 *
 * `kind` "row" inserts one postMediaRow of the files; it needs two or three to survive.
 */
export async function addPictures(host: PictureHost, files: readonly File[], at: InsertAt, kind: "single" | "row" = "single"): Promise<void> {
  if (files.length === 0) return;
  const refusals: string[] = [];
  let accepted: File[] = [];
  for (const file of files) {
    const reason = pictureRejection(file);
    if (reason) refusals.push(reason);
    else accepted.push(file);
  }
  if (kind === "row" && files.length > 3) {
    say(host, [ROW_COUNT_SENTENCE]);
    return;
  }

  const probes = accepted.length > 0 ? await probeAll(accepted) : [];
  const editor = live(host);
  if (!editor) return;

  if (accepted.length > 0) {
    const doc = editor.getJSON() as ThreadDoc;
    const gap = Math.max(0, Math.min(at.gap, doc.content.length));
    const room = roomAt(doc, gap, accepted.length);
    if (room.allowed < accepted.length) {
      refusals.push(room.sentence as string);
      accepted = accepted.slice(0, room.allowed);
    }
  }

  if (kind === "row" && accepted.length < 2) {
    say(host, [...refusals, ROW_COUNT_SENTENCE]);
    return;
  }
  if (accepted.length === 0) {
    say(host, refusals);
    return;
  }

  const items: Item[] = accepted.map((file, index) => ({ file, uploadId: newId(), w: probes[index]?.width ?? null, h: probes[index]?.height ?? null }));
  const pictures: ThreadPostMedia[] = items.map((item) => newPicture({ w: item.w, h: item.h, uploadId: item.uploadId }));
  insertBlocks(editor, at.gap, kind === "row" ? [newRow(pictures)] : pictures, Boolean(at.replaceEmpty));
  // The insert is an edit, which clears the last sentence; the refusals are said after it.
  say(host, refusals);
  await startUploads(host, items);
}

/** Put a new file in the picture at `pos`, keeping its width and caption. Its alt text described the old file, so it goes. */
export async function replacePicture(host: PictureHost, pos: number, file: File): Promise<void> {
  const editor = live(host);
  if (!editor) return;
  const reason = pictureRejection(file);
  if (reason) {
    say(host, [reason]);
    return;
  }
  const [probe] = await probeAll([file]);
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "postMedia") return;

  const uploadId = newId();
  const previous = { mediaId: node.attrs.mediaId, w: node.attrs.w, h: node.attrs.h, alt: node.attrs.alt };
  const item: Item = { file, uploadId, w: probe?.width ?? null, h: probe?.height ?? null };
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, mediaId: "", w: item.w, h: item.h, alt: "", uploadId }),
  );
  await startUploads(host, [item], previous);
}

// --- finding the drop -----------------------------------------------------------------

export type DropTarget = { kind: "gap"; gap: number; replaceEmpty: boolean } | { kind: "beside"; beside: BlockPath; side: "left" | "right" };

/** Where a drop at these coordinates goes: beside a picture when it is on its edge, else the nearest gap between blocks. */
export function locateDrop(view: EditorView, x: number, y: number): DropTarget {
  const { doc } = view.state;
  const hit = view.posAtCoords({ left: x, top: y });
  if (!hit) return { kind: "gap", gap: doc.childCount, replaceEmpty: false };

  if (hit.inside >= 0) {
    const inside = doc.nodeAt(hit.inside);
    if (inside?.type.name === "postMedia") {
      const path = pathOf(doc, hit.inside);
      const dom = view.nodeDOM(hit.inside) as HTMLElement | null;
      const box = (dom?.querySelector("[data-post-media-box]") as HTMLElement | null) ?? dom;
      if (path && box) {
        const rect = box.getBoundingClientRect();
        const edge = rect.width * 0.25;
        if (x - rect.left <= edge) return { kind: "beside", beside: path, side: "left" };
        if (rect.right - x <= edge) return { kind: "beside", beside: path, side: "right" };
      }
    }
  }

  const $pos = doc.resolve(hit.pos);
  if ($pos.depth === 0) return { kind: "gap", gap: $pos.index(0), replaceEmpty: false };
  const index = $pos.index(0);
  const block = doc.child(index);
  if (block.type.name === "paragraph" && block.content.size === 0) return { kind: "gap", gap: index, replaceEmpty: true };
  const dom = view.nodeDOM($pos.before(1)) as HTMLElement | null;
  const rect = dom?.getBoundingClientRect();
  const before = rect ? y < rect.top + rect.height / 2 : false;
  return { kind: "gap", gap: before ? index : index + 1, replaceEmpty: false };
}

// --- the plugin ------------------------------------------------------------------------

/** Files dropped or pasted become pictures; a picture or block dragged inside the editor is moved by moveBlock. */
export function picturePlugin(host: PictureHost): Plugin {
  return new Plugin({
    key: new PluginKey("postPictures"),
    props: {
      handleDrop(view, event, _slice, moved) {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (!moved && files.length > 0) {
          event.preventDefault();
          const where = locateDrop(view, event.clientX, event.clientY);
          // Files dropped on a picture's edge go after or before that picture's block; only a move makes a row.
          if (where.kind === "beside") void addPictures(host, files, { gap: where.beside.top + (where.side === "right" ? 1 : 0) });
          else void addPictures(host, files, { gap: where.gap, replaceEmpty: where.replaceEmpty });
          return true;
        }
        if (!moved || !(view.state.selection instanceof NodeSelection)) return false;
        const editor = host.editor.current;
        const from = pathOf(view.state.doc, view.state.selection.from);
        if (!editor || !from) return false;
        event.preventDefault();
        const where = locateDrop(view, event.clientX, event.clientY);
        moveBlockIn(host, editor, from, where.kind === "beside" ? { beside: where.beside, side: where.side } : { gap: where.gap });
        return true;
      },

      handlePaste(view, event) {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.length === 0) return false;
        event.preventDefault();
        const { selection, doc } = view.state;
        const index = selection.$from.depth > 0 || selection instanceof NodeSelection ? selection.$from.index(0) : doc.childCount - 1;
        const block = doc.maybeChild(index);
        const empty = Boolean(block && block.type.name === "paragraph" && block.content.size === 0);
        void addPictures(host, files, { gap: empty ? index : index + 1, replaceEmpty: empty });
        return true;
      },
    },
  });
}
