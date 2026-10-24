/* CA-25: what Publish asks before it publishes. Pure.

   THE CHECKLIST has two sections. Required is the four things `missingForPublish` names, in `PUBLISH_ORDER`, each with its
   value once it is done, then what the checks stop on (`runtimeIssues.blockers`, the post's `threadHold`). Recommended is
   what is open and does not stop Publish: the sessions with no app, the Classification Card, and `runtimeIssues.reminders`.
   A recommended item that is done is not listed. The line counts what is still open in each section.

   CONFIRM is the last look: what is public, then what stays private. */

import { PUBLISH_ORDER, type PublishKey } from "@/pages/site/compose/composeModel";

import { postPlainText, splitThread, type ThreadDoc } from "./thread";

export type ChecklistAction = "add_cover" | "add_title" | "add_description" | "add_prompt" | "go_to" | "show_apps" | "open_card";

export interface ChecklistItem {
  /** `evidence`, `title`, `outcome`, `instruction_or_artefact`, `blocker-0`, `thread`, `apps`, `card`, `reminder-0`. */
  key: string;
  section: "required" | "recommended";
  done: boolean;
  words: string;
  /** Under the words; null for none. */
  detail: string | null;
  /** The text link at the right; absent for a done item. */
  action?: { id: ChecklistAction; label: string };
  /** `go_to`: the step to scroll to and outline; null for the post, or for something about the whole build. */
  stepId?: string | null;
  /** `show_apps`: the keys of the sessions with no app. */
  sessions?: readonly string[];
}

export interface ChecklistInput {
  /** `missingForPublish`'s answer. */
  missing: readonly PublishKey[];
  title: string;
  description: string;
  cover: "image" | "video" | null;
  /** Tiles in the build, for the Prompt's done detail. */
  tiles: number;
  blockers: readonly { line: string; stepId: string | null }[];
  /** The post's hold sentence while its save is waiting; null when there is none. */
  threadHold: string | null;
  reminders: readonly { line: string; stepId: string | null }[];
  /** The sessions with no app, in order. */
  appless: readonly { key: string; number: number }[];
  /** Whether the Classification Card has anything in it. */
  cardFilled: boolean;
}

export interface Checklist {
  required: ChecklistItem[];
  recommended: ChecklistItem[];
  openRequired: number;
  openRecommended: number;
  /** "2 required · 2 recommended"; a part with none open is left out. */
  line: string;
  /** "Complete 2 required items to publish"; null once nothing required is open. */
  note: string | null;
  /** Publish in the footer is live. */
  canPublish: boolean;
  /** Pressing Publish on the page opens the checklist, not Confirm. */
  needed: boolean;
}

export const CHECKLIST_COPY = {
  title: "Publish checklist",
  required: "Required",
  recommended: "Recommended",
  close: "Close",
  publish: "Publish",
  none: "None added",
  notFilled: "Not filled",
  goTo: "Go to it",
  postText: "Post text",
} as const;

const REQUIRED_WORDS: Record<PublishKey, { words: string; action: { id: ChecklistAction; label: string } }> = {
  evidence: { words: "Cover picture or video", action: { id: "add_cover", label: "Add cover" } },
  title: { words: "Title", action: { id: "add_title", label: "Add title" } },
  outcome: { words: "Description", action: { id: "add_description", label: "Add description" } },
  instruction_or_artefact: { words: "Prompt", action: { id: "add_prompt", label: "Add prompt" } },
};

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** "2", "2 and 4", "1, 2 and 4". */
const listOf = (numbers: readonly number[]): string => (numbers.length <= 1 ? numbers.join("") : `${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]}`);

export function publishChecklist(input: ChecklistInput): Checklist {
  const open = new Set(input.missing);
  const done = (key: PublishKey): string | null => {
    if (key === "evidence") return input.cover === "video" ? "Video" : "Picture";
    if (key === "title") return input.title.trim();
    if (key === "outcome") return input.description.trim();
    return plural(input.tiles, "tile", "tiles");
  };
  const required: ChecklistItem[] = PUBLISH_ORDER.map((key) => {
    const { words, action } = REQUIRED_WORDS[key];
    return open.has(key)
      ? { key, section: "required", done: false, words, detail: CHECKLIST_COPY.none, action }
      : { key, section: "required", done: true, words, detail: done(key) };
  });
  input.blockers.forEach((blocker, at) =>
    required.push({ key: `blocker-${at}`, section: "required", done: false, words: blocker.line, detail: null, action: { id: "go_to", label: CHECKLIST_COPY.goTo }, stepId: blocker.stepId }),
  );
  if (input.threadHold) {
    required.push({ key: "thread", section: "required", done: false, words: CHECKLIST_COPY.postText, detail: input.threadHold, action: { id: "go_to", label: CHECKLIST_COPY.goTo }, stepId: null });
  }

  const recommended: ChecklistItem[] = [];
  if (input.appless.length > 0) {
    const numbers = input.appless.map((session) => session.number);
    recommended.push({
      key: "apps",
      section: "recommended",
      done: false,
      words: `Apps for ${plural(input.appless.length, "session", "sessions")}`,
      detail: `${numbers.length === 1 ? "Session" : "Sessions"} ${listOf(numbers)} ${numbers.length === 1 ? "has" : "have"} no app`,
      action: { id: "show_apps", label: "Show" },
      sessions: input.appless.map((session) => session.key),
    });
  }
  if (!input.cardFilled) {
    recommended.push({ key: "card", section: "recommended", done: false, words: "Classification Card", detail: CHECKLIST_COPY.notFilled, action: { id: "open_card", label: "Open card" } });
  }
  input.reminders.forEach((reminder, at) =>
    recommended.push({ key: `reminder-${at}`, section: "recommended", done: false, words: reminder.line, detail: null, action: { id: "go_to", label: CHECKLIST_COPY.goTo }, stepId: reminder.stepId }),
  );

  const openRequired = required.filter((item) => !item.done).length;
  const openRecommended = recommended.length;
  const line = [openRequired > 0 ? `${openRequired} required` : null, openRecommended > 0 ? `${openRecommended} recommended` : null].filter(Boolean).join(" · ");
  return {
    required,
    recommended,
    openRequired,
    openRecommended,
    line,
    note: openRequired > 0 ? `Complete ${plural(openRequired, "required item", "required items")} to publish` : null,
    canPublish: openRequired === 0,
    needed: openRequired > 0 || openRecommended > 0,
  };
}

/* ── Confirm ── */

export interface ConfirmInput {
  /** The post's words and the links in it. */
  post: { words: number; links: number };
  parts: number;
  sessions: number;
  tiles: number;
  /** File names, in the order the build shows them. */
  files: readonly string[];
  /** The Classification Card's categories; empty when it is not filled. */
  card: readonly string[];
}

export interface ConfirmRow {
  key: "post" | "build" | "files" | "card";
  name: string;
  value: string;
}

export const CONFIRM_COPY = {
  title: (title: string): string => `Publish ${title}?`,
  line: "Visible to anyone with the link.",
  public: "Public",
  private: "Private",
  privateRow: "Your sessions not in the build, Recently removed",
  cancel: "Cancel",
  publish: "Publish",
  /** Files named before the rest are counted as `+N`. */
  filesShown: 3,
} as const;

export function confirmRows(input: ConfirmInput): ConfirmRow[] {
  const post = [plural(input.post.words, "word", "words"), input.post.links > 0 ? plural(input.post.links, "link", "links") : null].filter(Boolean).join(", ");
  const build = [input.parts > 1 ? plural(input.parts, "part", "parts") : null, plural(input.sessions, "session", "sessions"), plural(input.tiles, "tile", "tiles")].filter(Boolean).join(", ");
  const shown = input.files.slice(0, CONFIRM_COPY.filesShown).join(", ");
  const more = input.files.length - CONFIRM_COPY.filesShown;
  const files = input.files.length === 0 ? "None" : more > 0 ? `${shown} +${more}` : shown;
  return [
    { key: "post", name: "Post", value: post },
    { key: "build", name: "Build", value: build },
    { key: "files", name: "Files", value: files },
    { key: "card", name: "Classification Card", value: input.card.length > 0 ? input.card.join(", ") : CHECKLIST_COPY.notFilled },
  ];
}

/** Words and links of a post thread: links are the `link` marks (a web address) and the `ref` marks (a part of the build). */
export function postFacts(doc: ThreadDoc | null | undefined): { words: number; links: number } {
  if (!doc) return { words: 0, links: 0 };
  const words = splitThread(doc).reduce((sum, post) => sum + postPlainText(post).split(/\s+/).filter(Boolean).length, 0);
  let links = 0;
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const record = node as { marks?: unknown; content?: unknown };
    if (Array.isArray(record.marks)) for (const mark of record.marks) if ((mark as { type?: string })?.type === "link" || (mark as { type?: string })?.type === "ref") links += 1;
    if (Array.isArray(record.content)) record.content.forEach(walk);
  };
  walk(doc);
  return { words, links };
}

/* ── Published ── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const dayOf = (at: Date): number => Date.UTC(at.getFullYear(), at.getMonth(), at.getDate());

/** "Published today", "Published yesterday", "Published 2 days ago" to 30, then "Published 3 Oct" ("3 Oct 2025" in another year). */
export function publishedWords(publishedAt: string | null | undefined, now: Date = new Date()): string {
  const at = publishedAt ? new Date(publishedAt) : null;
  if (!at || Number.isNaN(at.getTime())) return "Published";
  const days = Math.round((dayOf(now) - dayOf(at)) / 86_400_000);
  if (days <= 0) return "Published today";
  if (days === 1) return "Published yesterday";
  if (days <= 30) return `Published ${days} days ago`;
  const date = `${at.getDate()} ${MONTHS[at.getMonth()]}`;
  return at.getFullYear() === now.getFullYear() ? `Published ${date}` : `Published ${date} ${at.getFullYear()}`;
}
