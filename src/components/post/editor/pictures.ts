// pictures: adding, uploading, removing, reordering and editing the pictures in the composer's editor (PT-06, CA-07).
//
// Not React. The grid's node view (GridView) reads the store and calls these; the plugin at the bottom turns a paste
// into an upload (a drop is the composer's, PostTab).
//
// CA-07: A POST'S PICTURES ARE ONE postMediaGrid, ITS LAST BLOCK. Every picture added goes into the grid of the post it
// is meant for, which is made at the post's end when there is none.
//
// A PICTURE UPLOADING IS A postMedia WITH NO mediaId AND AN uploadId; one that did not upload also carries `failed`,
// which the hold sentence reads (threadEditor), so the save names it. The save already waits on a picture with no
// mediaId (thread.ts), so a half-finished picture is never written. The percent, the file's own preview (an object URL)
// and whether it failed live in the store, not in the document: they change many times a second, or hold a file, and
// are nobody's to save or undo.
//
// THE FILE IS NEVER DELETED HERE. Removing a picture takes its node out; saveThread writes the post-media set from
// what the document still shows, which clears the picture's place in the post. The build_media row and its object stay.

import type { Editor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";

import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import { mediaKindFor, probeFile } from "@/lib/build/media";
import { newPicture, pictureRejection, POST_FULL_SENTENCE, signPostMedia, THREAD_FULL_SENTENCE, uploadPostPicture } from "@/lib/build/postMedia";
import type { GalleryMedia } from "@/lib/build";
import type { RefEntry, RefGroup } from "@/lib/build/postRefs";
import { MAX_POST_PICTURES, MAX_THREAD_MEDIA, type PostMediaAttrs, type ThreadPostMedia } from "@/lib/build/thread";
import type { BuildMedia, MediaKind } from "@/lib/build/types";

// --- the store ---------------------------------------------------------------------

/** The file itself, shown while it uploads. */
export interface UploadPreview {
  /** An object URL for the file. Revoked when the tile goes or the real file is signed. */
  url: string;
  kind: "image" | "video";
  gif: boolean;
}

export interface PictureSnapshot {
  /** The thread's media rows by id: what a node view needs to find its file. */
  rows: ReadonlyMap<string, GalleryMedia>;
  /** path -> signed URL, as PostMedia takes it. */
  src: MediaSrcMap;
  /** uploadId -> percent, 0 to 100, while a picture uploads. */
  progress: ReadonlyMap<string, number>;
  /** uploadId -> the file's own preview, from the moment it is accepted. */
  previews: ReadonlyMap<string, UploadPreview>;
  /** CA-07 P6: the build's steps a grid can link to, as the build page numbers them. Null: no Link a step. */
  steps: StepRefs | null;
}

export interface PictureStore {
  getSnapshot(): PictureSnapshot;
  subscribe(listener: () => void): () => void;
  /** Add media rows, and sign them. */
  addRows(rows: readonly BuildMedia[]): void;
  /** null clears the upload's entry. */
  setProgress(uploadId: string, percent: number | null): void;
  /** null revokes the preview's URL and clears it. */
  setPreview(uploadId: string, preview: UploadPreview | null): void;
  /** An upload landed as `mediaId`: its preview is kept under the file's id until the real file is signed. */
  handOff(uploadId: string, mediaId: string): void;
  setSteps(steps: StepRefs | null): void;
  /** Dev pages only: rows and their files as they are, with nothing signed. */
  seed(rows: readonly GalleryMedia[], src: MediaSrcMap, progress?: ReadonlyMap<string, number>): void;
}

/** Where a landed upload's preview waits for its signed file. */
export const landedKey = (mediaId: string) => `media:${mediaId}`;

/** Object URLs, through the window's, so a test without them still runs. */
const objectUrls = {
  make: (file: File): string => (typeof URL !== "undefined" && typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : ""),
  revoke: (url: string): void => {
    if (url && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
  },
};

export function createPictureStore(sign: (rows: readonly BuildMedia[]) => Promise<Map<string, string>> = signPostMedia): PictureStore {
  let snapshot: PictureSnapshot = { rows: new Map(), src: new Map(), progress: new Map(), previews: new Map(), steps: null };
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
        if (signed.size === 0) return;
        // The real file is signed: a landed upload's own preview is no longer needed.
        const previews = new Map(snapshot.previews);
        for (const row of fresh) {
          const waiting = previews.get(landedKey(row.id));
          if (waiting && signed.has(row.path)) {
            objectUrls.revoke(waiting.url);
            previews.delete(landedKey(row.id));
          }
        }
        set({ src: new Map([...snapshot.src, ...signed]), previews });
      });
    },
    setProgress(uploadId, percent) {
      const progress = new Map(snapshot.progress);
      if (percent === null) progress.delete(uploadId);
      else progress.set(uploadId, percent);
      set({ progress });
    },
    setPreview(uploadId, preview) {
      const previews = new Map(snapshot.previews);
      const old = previews.get(uploadId);
      if (old && old.url !== preview?.url) objectUrls.revoke(old.url);
      if (preview) previews.set(uploadId, preview);
      else previews.delete(uploadId);
      set({ previews });
    },
    seed(rows, src, progress) {
      set({ rows: new Map([...snapshot.rows, ...rows.map((row) => [row.id, row] as const)]), src: new Map([...snapshot.src, ...src]), progress: new Map([...snapshot.progress, ...(progress ?? [])]) });
    },
    setSteps(steps) {
      if (steps !== snapshot.steps) set({ steps });
    },
    handOff(uploadId, mediaId) {
      const preview = snapshot.previews.get(uploadId);
      if (!preview) return;
      const previews = new Map(snapshot.previews);
      previews.delete(uploadId);
      if (snapshot.rows.get(mediaId) && snapshot.src.has(snapshot.rows.get(mediaId)?.path ?? "")) objectUrls.revoke(preview.url);
      else previews.set(landedKey(mediaId), preview);
      set({ previews });
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
  /** uploadId -> the file, kept for Retry, and whether it was stopped. Not in the store: nothing draws it. */
  files: Map<string, { file: File; stopped: boolean }>;
  /** CA-07 P5: the Edit dialog, opened on a grid at a picture. Null while nothing can open it. */
  openEdit: { current: ((request: EditRequest) => void) | null };
}

/** The build's tiles, grouped as the reference picker lists them, and each by its `node:<id>`. */
export interface StepRefs {
  groups: readonly RefGroup[];
  lookup: ReadonlyMap<string, RefEntry>;
}

/** What opens Crop media (Part 5). */
export interface EditRequest {
  /** The grid's position in the document. */
  gridPos: number;
  /** The picture to start on. */
  index: number;
  /** The tab to open on. */
  tab: "crop" | "alt" | "warn";
  /** Where focus goes back to. */
  returnTo: HTMLElement | null;
}

export function createPictureHost(): PictureHost {
  return { store: createPictureStore(), editor: { current: null }, ensureBuild: { current: null }, notice: { current: null }, files: new Map(), openEdit: { current: null } };
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

/** One post as the editor holds it: where its blocks start and end, and its grid. */
export interface PostSpan {
  index: number;
  /** Position before its first block (after the break before it). */
  from: number;
  /** Position after its last block. */
  to: number;
  grid: { pos: number; node: PMNode } | null;
}

/** Every post of the document, in order, empty ones included. */
export function postSpans(doc: PMNode): PostSpan[] {
  const spans: PostSpan[] = [{ index: 0, from: 0, to: 0, grid: null }];
  doc.forEach((node, pos) => {
    if (node.type.name === "postBreak") {
      spans.push({ index: spans.length, from: pos + node.nodeSize, to: pos + node.nodeSize, grid: null });
      return;
    }
    const span = spans[spans.length - 1];
    span.to = pos + node.nodeSize;
    if (node.type.name === "postMediaGrid" && !span.grid) span.grid = { pos, node };
  });
  return spans;
}

/** The post the caret is in, or the last post when there is no caret. */
export function postAtCaret(editor: Editor): number {
  const { selection, doc } = editor.state;
  const index = selection.$from.depth > 0 || selection instanceof NodeSelection ? selection.$from.index(0) : doc.childCount - 1;
  let post = 0;
  doc.forEach((node, _pos, at) => {
    if (at < index && node.type.name === "postBreak") post += 1;
  });
  return post;
}

/** Pictures in each post, uploads in flight included. */
export function picturesPerPost(doc: PMNode): number[] {
  return postSpans(doc).map((span) => {
    let count = 0;
    doc.nodesBetween(span.from, span.to, (node) => {
      if (node.type.name === "postMedia") count += 1;
      return node.type.name !== "postMedia";
    });
    return count;
  });
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

/** The position of the grid's picture at `index`. */
export function picturePos(grid: PMNode, gridPos: number, index: number): number {
  let pos = gridPos + 1;
  for (let at = 0; at < index; at++) pos += grid.child(at).nodeSize;
  return pos;
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

/** Take the grid's picture at `index` out, in one undoable step; the last one out takes the grid (and its link) with it. The file stays. */
export function removePicture(editor: Editor, gridPos: number, index: number): void {
  const { state, view } = editor;
  const grid = state.doc.nodeAt(gridPos);
  if (!grid || grid.type.name !== "postMediaGrid" || index < 0 || index >= grid.childCount) return;
  const tr = state.tr;
  if (grid.childCount === 1) tr.delete(gridPos, gridPos + grid.nodeSize);
  else {
    const pos = picturePos(grid, gridPos, index);
    tr.delete(pos, pos + grid.child(index).nodeSize);
  }
  view.dispatch(tr);
}

/** Take the picture marked `uploadId` out, wherever it is. */
function removeUpload(editor: Editor, uploadId: string, history = true): void {
  const pos = findUpload(editor.state.doc, uploadId);
  if (pos < 0) return;
  const $pos = editor.state.doc.resolve(pos);
  const gridPos = $pos.before($pos.depth);
  const grid = editor.state.doc.nodeAt(gridPos) as PMNode;
  const tr = editor.state.tr;
  if (grid.childCount === 1) tr.delete(gridPos, gridPos + grid.nodeSize);
  else tr.delete(pos, pos + (editor.state.doc.nodeAt(pos) as PMNode).nodeSize);
  if (!history) tr.setMeta("addToHistory", false);
  editor.view.dispatch(tr);
}

/** Move the grid's picture at `from` to place `to`, in one undoable step. */
export function movePicture(editor: Editor, gridPos: number, from: number, to: number): boolean {
  const { state, view } = editor;
  const grid = state.doc.nodeAt(gridPos);
  if (!grid || grid.type.name !== "postMediaGrid" || from === to || from < 0 || to < 0 || from >= grid.childCount || to >= grid.childCount) return false;
  const children: PMNode[] = [];
  grid.forEach((child) => children.push(child));
  const [moved] = children.splice(from, 1);
  children.splice(to, 0, moved);
  view.dispatch(state.tr.replaceWith(gridPos + 1, gridPos + grid.nodeSize - 1, children));
  return true;
}

/** Change several of a grid's pictures at once, in one transaction, so one Undo takes them all back (Part 5). */
export function setPictureAttrs(editor: Editor, gridPos: number, patches: ReadonlyMap<number, Partial<PostMediaAttrs>>): void {
  const { state, view } = editor;
  const grid = state.doc.nodeAt(gridPos);
  if (!grid || grid.type.name !== "postMediaGrid" || patches.size === 0) return;
  const tr = state.tr;
  for (const [index, patch] of patches) {
    if (index < 0 || index >= grid.childCount) continue;
    const child = grid.child(index);
    tr.setNodeMarkup(picturePos(grid, gridPos, index), undefined, { ...child.attrs, ...patch });
  }
  if (tr.docChanged) view.dispatch(tr);
}

/** The step a grid's pictures come from: "node:<id>", or null for none (Part 6). */
export function setGridStep(editor: Editor, gridPos: number, step: string | null): void {
  const { state, view } = editor;
  const grid = state.doc.nodeAt(gridPos);
  if (!grid || grid.type.name !== "postMediaGrid" || grid.attrs.step === step) return;
  view.dispatch(state.tr.setNodeMarkup(gridPos, undefined, { ...grid.attrs, step }));
}

/**
 * Move a text block one place up (-1) or down (1). It never goes below its post's pictures: past them it starts the
 * next post, and up past a break it ends the post before, above that post's pictures. False when it cannot move.
 */
export function moveTextBlock(editor: Editor, index: number, direction: -1 | 1): boolean {
  const { state, view } = editor;
  const { doc } = state;
  const block = doc.maybeChild(index);
  const name = (at: number) => doc.maybeChild(at)?.type.name;
  if (!block || block.type.name === "postBreak" || block.type.name === "postMediaGrid") return false;
  let gap: number;
  if (direction === -1) {
    if (index === 0) return false;
    gap = name(index - 1) === "postBreak" && name(index - 2) === "postMediaGrid" ? index - 2 : index - 1;
  } else {
    const next = name(index + 1);
    if (!next) return false;
    if (next === "postMediaGrid") {
      if (name(index + 2) !== "postBreak") return false;
      gap = index + 3;
    } else gap = index + 2;
  }
  const from = gapPos(doc, index);
  const tr = state.tr.insert(gapPos(doc, gap), block.copy(block.content));
  const start = tr.mapping.map(from, 1);
  tr.delete(start, start + block.nodeSize);
  view.dispatch(tr.scrollIntoView());
  return true;
}

/** Append pictures to the post's grid, making the grid at the post's end when it has none. */
function insertIntoPost(editor: Editor, post: number, pictures: readonly ThreadPostMedia[]): void {
  const { state, view } = editor;
  const spans = postSpans(state.doc);
  const span = spans[Math.max(0, Math.min(post, spans.length - 1))];
  const nodes = pictures.map((picture) => state.schema.nodeFromJSON(picture));
  const tr = state.tr;
  if (span.grid) tr.insert(span.grid.pos + span.grid.node.nodeSize - 1, nodes);
  else tr.insert(span.to, state.schema.nodes.postMediaGrid.create({ step: null }, nodes));
  view.dispatch(tr);
}

// --- uploading ----------------------------------------------------------------------

interface Item {
  file: File;
  uploadId: string;
  w: number | null;
  h: number | null;
}

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `up-${Math.random().toString(36).slice(2, 10)}`);

async function probeAll(files: readonly File[]) {
  return Promise.all(files.map((file) => probeFile(file, (mediaKindFor(file.type) ?? "image") as MediaKind)));
}

function previewOf(file: File): UploadPreview {
  return { url: objectUrls.make(file), kind: mediaKindFor(file.type) === "video" ? "video" : "image", gif: file.type === "image/gif" };
}

/** Upload one item into its node. A failure leaves the tile, marked failed, for Retry or Remove. */
function setFailed(host: PictureHost, uploadId: string, failed: boolean): void {
  patchUpload(host, uploadId, { failed });
}

async function runUpload(host: PictureHost, buildId: string, item: Item): Promise<void> {
  setFailed(host, item.uploadId, false);
  try {
    const done = await uploadPostPicture(buildId, item.file, (percent) => host.store.setProgress(item.uploadId, percent), { w: item.w, h: item.h });
    // Stopped while it uploaded: the result is ignored (uploadMedia cannot be aborted) and the row stays in build_media.
    if (host.files.get(item.uploadId)?.stopped ?? true) return;
    host.store.handOff(item.uploadId, done.media.id);
    host.store.addRows([done.media]);
    if (patchUpload(host, item.uploadId, { mediaId: done.media.id, w: done.w, h: done.h, uploadId: null, failed: false })) host.files.delete(item.uploadId);
  } catch (cause) {
    console.error("[Compose] picture upload failed", cause);
    if (!(host.files.get(item.uploadId)?.stopped ?? true)) setFailed(host, item.uploadId, true);
  } finally {
    host.store.setProgress(item.uploadId, null);
  }
}

async function startUploads(host: PictureHost, items: readonly Item[]): Promise<void> {
  let buildId: string;
  try {
    const ensure = host.ensureBuild.current;
    if (!ensure) throw new Error("no build to upload to");
    buildId = await ensure();
  } catch (cause) {
    console.error("[Compose] could not start the picture upload", cause);
    for (const item of items) setFailed(host, item.uploadId, true);
    return;
  }
  await Promise.all(items.map((item) => runUpload(host, buildId, item)));
}

/** How many of `adding` fit in the post: its four and the thread's forty both count. */
export function roomInPost(doc: PMNode, post: number, adding: number): { allowed: number; sentence: string | null } {
  const counts = picturesPerPost(doc);
  const postRoom = Math.max(0, MAX_POST_PICTURES - (counts[post] ?? 0));
  const threadRoom = Math.max(0, MAX_THREAD_MEDIA - counts.reduce((total, count) => total + count, 0));
  if (adding <= Math.min(postRoom, threadRoom)) return { allowed: adding, sentence: null };
  return postRoom <= threadRoom ? { allowed: postRoom, sentence: POST_FULL_SENTENCE } : { allowed: threadRoom, sentence: THREAD_FULL_SENTENCE };
}

/**
 * Put files in the post's grid: refuse the ones that cannot go (pictureRejection's sentence), take the first ones that
 * fit in the order chosen (the post's four, the thread's forty), show each at once from the file itself, then upload.
 */
export async function addPictures(host: PictureHost, files: readonly File[], post: number): Promise<void> {
  if (files.length === 0) return;
  const refusals: string[] = [];
  let accepted: File[] = [];
  for (const file of files) {
    const reason = pictureRejection(file);
    if (reason) refusals.push(reason);
    else accepted.push(file);
  }

  const editor = live(host);
  if (!editor) return;
  if (accepted.length > 0) {
    const room = roomInPost(editor.state.doc, post, accepted.length);
    if (room.allowed < accepted.length) {
      refusals.push(room.sentence as string);
      accepted = accepted.slice(0, room.allowed);
    }
  }
  if (accepted.length === 0) {
    say(host, refusals);
    return;
  }

  const probes = await probeAll(accepted);
  const current = live(host);
  if (!current) return;
  const items: Item[] = accepted.map((file, index) => ({ file, uploadId: newId(), w: probes[index]?.width ?? null, h: probes[index]?.height ?? null }));
  for (const item of items) {
    host.files.set(item.uploadId, { file: item.file, stopped: false });
    host.store.setPreview(item.uploadId, previewOf(item.file));
  }
  insertIntoPost(current, post, items.map((item) => newPicture({ w: item.w, h: item.h, uploadId: item.uploadId })));
  // The insert is an edit, which clears the last sentence; the refusals are said after it.
  say(host, refusals);
  await startUploads(host, items);
}

/** Start a failed upload again with the same file. */
export async function retryUpload(host: PictureHost, uploadId: string): Promise<void> {
  const kept = host.files.get(uploadId);
  const editor = live(host);
  if (!kept || !editor) return;
  const pos = findUpload(editor.state.doc, uploadId);
  if (pos < 0) return;
  const node = editor.state.doc.nodeAt(pos) as PMNode;
  host.store.setProgress(uploadId, 0);
  await startUploads(host, [{ file: kept.file, uploadId, w: node.attrs.w, h: node.attrs.h }]);
}

/** Stop an upload: its result is ignored when it lands, and its tile goes. */
export function stopUpload(host: PictureHost, uploadId: string): void {
  const kept = host.files.get(uploadId);
  if (kept) kept.stopped = true;
  host.files.delete(uploadId);
  host.store.setPreview(uploadId, null);
  host.store.setProgress(uploadId, null);
  const editor = live(host);
  if (editor) removeUpload(editor, uploadId);
}

// --- the plugin ------------------------------------------------------------------------

/** A pasted picture goes into the post holding the caret. A pasted link to a picture is text, and stays a link. */
export function picturePlugin(host: PictureHost): Plugin {
  return new Plugin({
    key: new PluginKey("postPictures"),
    props: {
      handlePaste(_view, event) {
        const files = Array.from(event.clipboardData?.files ?? []);
        const editor = host.editor.current;
        if (files.length === 0 || !editor) return false;
        event.preventDefault();
        void addPictures(host, files, postAtCaret(editor));
        return true;
      },
      // Files dropped on the words are the composer's (PostTab), which knows which post they were dropped on.
      handleDrop(_view, event) {
        return Boolean(event.dataTransfer?.files?.length);
      },
    },
  });
}
