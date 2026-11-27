// A Prompt tile records one message as it was sent: the files and pictures attached to it, in their order and place, the text,
// the model and its effort, and what the app added that the maker could not see.
//
// DATA. An attachment is a File node linked to the prompt as an input (`Use { kind: "file" }`), in the order of the prompt's
// inputs, and used by nothing else (`attachmentOwners` in `graph.ts`). Where they sat is `payload.attachments_at` on the prompt
// ("before" when absent). A placeholder is a File node with a name and no media: an import said a file was attached, but the
// file did not come with it.
//
// PURE: text and lists only. The tree is read in `graph.ts`; the zip is in `zip.ts`.

import { modelLabel } from "@/lib/models/registry";

import type { FileKind } from "./graph";
import { EFFORT_LABEL, SENT_FROM_LABEL, type AttachmentsAt, type PromptContext, type PromptSettings } from "./tileExtras";

/** One file or picture attached to a prompt. */
export interface Attachment {
  /** The File node. */
  id: string;
  name: string;
  /** Null for a placeholder: a file an import named but did not bring. */
  mediaId: string | null;
  size: number | null;
  mime: string | null;
  kind: FileKind;
  /** `payload.note` on the File node, up to 140 characters. */
  note?: string;
  /** `payload.captured_at`, a day, on a picture. */
  capturedAt?: string;
}

export const ATTACHMENT_COPY = {
  attached: "Attached",
  attach: "Attach",
  camera: "Camera",
  after: "Attached after the text",
  remove: (name: string) => `Remove ${name}`,
  removeAsk: "Remove this attachment?",
  removeYes: "Remove",
  keep: "Keep",
  note: "Note",
  capturedOn: "Captured on",
  moveUp: "Move up",
  moveDown: "Move down",
  moveMenu: (name: string) => `Move ${name}`,
  more: (n: number) => `+${n}`,
  placeholder: (name: string) => `Not imported: attach ${name}`,
  count: (n: number) => `${n} ${n === 1 ? "attachment" : "attachments"}`,
  tooMany: (max: number) => `${max} attachments max on one prompt`,
  open: (name: string) => `Open ${name}`,
  context: "What the app added",
  sentFrom: "Sent from",
  fromName: "Name",
  webSearch: "Web search",
  memory: "Memory",
  projectFiles: "Project files",
  earlier: "Earlier messages in that chat",
  connectors: "Connectors used",
  connectorsHint: "One per line, 8 max",
  downloadWithFiles: "Download with files",
  privatePictures: "Check these pictures show nothing private",
} as const;

/** The most attachments a prompt takes. */
export { ATTACHMENTS_MAX } from "./tileExtras";

/** How a tile names a prompt with attachments when its text is shorter than four words: "Prompt example. · 4 attachments". */
export function attachmentsTitle(defaultTitle: string, words: number, count: number): string {
  return count > 0 && words < 4 ? `${defaultTitle} · ${ATTACHMENT_COPY.count(count)}` : defaultTitle;
}

/** One attachment as the attach list writes it: "screenshot.png (Pricing reference)". */
const listed = (attachment: Pick<Attachment, "name" | "note">): string => (attachment.note ? `${attachment.name} (${attachment.note})` : attachment.name);

/**
 * The block that tells a rebuilder what to attach, numbered in order: pictures cannot travel in text, so this is how they
 * know. Before the text: "Attach these 4 files first, in this order:"; after it: "Then attach these 4 files, in this order:".
 * Null when there are none.
 */
export function attachBlock(attachments: readonly Pick<Attachment, "name" | "note">[], at: AttachmentsAt): string | null {
  if (attachments.length === 0) return null;
  const n = attachments.length;
  const head =
    at === "after"
      ? n === 1
        ? "Then attach this file:"
        : `Then attach these ${n} files, in this order:`
      : n === 1
        ? "Attach this file first:"
        : `Attach these ${n} files first, in this order:`;
  return [head, ...attachments.map((attachment, index) => `${index + 1}. ${listed(attachment)}`)].join("\n");
}

const SENT_FROM_PHRASE: Record<NonNullable<PromptContext["from"]>, string> = {
  claude_app: "the Claude app",
  chatgpt_app: "the ChatGPT app",
  gemini_app: "the Gemini app",
  api: "an API call",
  harness: "a harness",
  other: "another app",
};

const andList = (items: readonly string[]): string => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/** The model a prompt was sent to: its settings' model, else its own. */
export const sentModelOf = (step: { settings?: PromptSettings; model: string | null }): string | null => step.settings?.model || step.model || null;

/**
 * The sentence the copies end a prompt with, from only what was given: "Sent to Opus 5.5 at Medium effort, from the Claude app,
 * with web search on, after 3 earlier messages." Null when nothing was.
 */
export function sentLine(model: string | null, settings: PromptSettings | null | undefined, context: PromptContext | null | undefined): string | null {
  const effort = settings && settings.effort !== "default" ? `${EFFORT_LABEL[settings.effort]} effort` : null;
  const head = ["Sent", model ? `to ${modelLabel(model)}` : null, effort ? `at ${effort}` : null].filter(Boolean).join(" ");
  const parts: string[] = [];
  if (context?.from) parts.push(`from ${context.fromName || SENT_FROM_PHRASE[context.from]}`);
  const on = [context?.webSearch ? "web search" : null, context?.memory ? "memory" : null, context?.projectFiles ? "project files" : null].filter((part): part is string => Boolean(part));
  if (on.length > 0) parts.push(`with ${andList(on)} on`);
  if (context?.connectors?.length) parts.push(`using ${andList(context.connectors)}`);
  if (context?.earlier) parts.push(`after ${context.earlier} earlier ${context.earlier === 1 ? "message" : "messages"}`);
  if (head === "Sent" && parts.length === 0) return null;
  return `${[head, ...parts].join(", ")}.`;
}

/** The reader's one meta line: "Opus 5.5 · Medium effort · Sent from Claude app · web search on · 3 earlier messages", only the parts given. */
export function metaLine(model: string | null, settings: PromptSettings | null | undefined, context: PromptContext | null | undefined): string | null {
  const parts = [
    model ? modelLabel(model) : null,
    settings && settings.effort !== "default" ? `${EFFORT_LABEL[settings.effort]} effort` : null,
    context?.from ? `Sent from ${context.fromName || SENT_FROM_LABEL[context.from]}` : null,
    context?.webSearch ? "web search on" : null,
    context?.memory ? "memory on" : null,
    context?.projectFiles ? "project files on" : null,
    context?.connectors?.length ? context.connectors.join(", ") : null,
    context?.earlier ? `${context.earlier} earlier ${context.earlier === 1 ? "message" : "messages"}` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** The ids after moving one attachment by `by` places; the same list when it cannot move. */
export function moveAttachment(ids: readonly string[], id: string, by: -1 | 1): string[] {
  const at = ids.indexOf(id);
  const to = at + by;
  if (at < 0 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
}

/** The ids with one dragged from `from` to `to`. */
export function dragAttachment(ids: readonly string[], from: number, to: number): string[] {
  if (from === to || from < 0 || from >= ids.length || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** A file's name as the zip stores it: its place first, "1-screenshot.png"; no folders, nothing a file system refuses. */
export function zipNameOf(index: number, name: string): string {
  const printable = Array.from(name, (char) => (char.charCodeAt(0) < 32 ? "-" : char)).join("");
  const safe = printable.replace(/[\\/:*?"<>|]+/g, "-").replace(/^\.+/, "").trim() || "file";
  return `${index + 1}-${safe}`;
}

/** The names in the "Download with files" zip, in order: prompt.md, then each attachment with its place. Placeholders hold no file. */
export function zipEntriesOf(attachments: readonly Pick<Attachment, "name" | "mediaId">[]): { name: string; mediaId: string | null }[] {
  return [{ name: "prompt.md", mediaId: null }, ...attachments.flatMap((attachment, index) => (attachment.mediaId ? [{ name: zipNameOf(index, attachment.name), mediaId: attachment.mediaId }] : []))];
}

/* ── imports: files a message named but did not bring ── */

/** The marker the chat import leaves on a turn whose files it named but could not bring: "[files on this turn: a.png, b.md]". */
const NAMED_FILES = /\n*\[files on this turn: ([^\]\n]*)\]\s*$/;

/** An imported turn's text without the marker, and the names it held, in order. The text is otherwise word for word. */
export function namedFilesOf(text: string): { text: string; names: string[] } {
  const found = NAMED_FILES.exec(text);
  if (!found) return { text, names: [] };
  const names = found[1].split(",").map((name) => name.trim()).filter(Boolean);
  return { text: text.slice(0, found.index).trimEnd(), names };
}

/** The placeholder on a prompt a picked file fills: the first with the same name, ignoring case; null when none waits for it. */
export function placeholderFor(attachments: readonly Pick<Attachment, "id" | "name" | "mediaId">[], fileName: string): string | null {
  const wanted = fileName.trim().toLowerCase();
  return attachments.find((attachment) => !attachment.mediaId && attachment.name.trim().toLowerCase() === wanted)?.id ?? null;
}
