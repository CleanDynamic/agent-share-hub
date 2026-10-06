/* UI-P46 — the Drafts page's words, as pure functions.

   Titles, the meta lines, the session's date and the + menu's items. No React,
   no data access: `DraftsView` renders what these return and the tests read it.
   The relative time is the feed's own `shortAgo` ("17m", "2d"), not a new one. */

import type { DraftListItem } from "@/lib/build/drafts";
import type { SessionSummary } from "@/lib/build/sessions";
import { shortAgo } from "@/pages/site/home/homeModel";

export const UNTITLED = "Untitled build";

/** Drafts the + menu offers beside the target and "Start a new build". */
export const MENU_DRAFTS_MAX = 8;

/** The characters of the first prompt the + button's accessible name keeps. */
export const ADD_LABEL_MAX = 60;

const CLIENT_LABEL: Record<string, string> = {
  claude: "Claude",
  "claude-code": "Claude Code",
  chatgpt: "ChatGPT",
  cursor: "Cursor",
  web: "Pasted",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** An empty title, or the placeholder, reads "Untitled build" in `--text2`. */
export function isUntitled(title: string | null | undefined): boolean {
  const clean = (title ?? "").trim();
  return clean === "" || clean === UNTITLED;
}

export function draftTitle(title: string | null | undefined): string {
  return isUntitled(title) ? UNTITLED : (title as string).trim();
}

/** "2 sessions · edited 17m ago", "No sessions · edited just now". */
export function draftMeta(draft: Pick<DraftListItem, "sessionCount" | "updatedAt">, now: number): string {
  const ago = shortAgo(draft.updatedAt, now);
  const edited = ago === "" ? "" : ago === "now" ? " · edited just now" : ` · edited ${ago} ago`;
  const n = draft.sessionCount;
  return `${n === 0 ? "No sessions" : `${n} session${n === 1 ? "" : "s"}`}${edited}`;
}

/** "Today", "Yesterday", or "3 Oct". */
export function sessionDate(iso: string, now: number): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const today = new Date(now);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(today) - startOf(at)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${at.getDate()} ${MONTHS[at.getMonth()]}`;
}

/** The model's name, or the client that sent the session when there is none. */
export function sessionSource(session: Pick<SessionSummary, "modelName" | "client">): string {
  return session.modelName || CLIENT_LABEL[session.client ?? ""] || "Unknown tool";
}

/** "{modelName} · {date}", ending " · for {draft}" when the connector was aimed at one. */
export function sessionMeta(session: SessionSummary, drafts: readonly DraftListItem[], now: number): string {
  const parts = [sessionSource(session), sessionDate(session.createdAt, now)].filter(Boolean);
  const target = session.targetBuildId ? drafts.find((d) => d.id === session.targetBuildId) : undefined;
  if (target) parts.push(`for ${draftTitle(target.title)}`);
  return parts.join(" · ");
}

export function promptLine(session: Pick<SessionSummary, "firstPrompt">): string {
  return session.firstPrompt ?? "Untitled session";
}

export function addLabel(session: Pick<SessionSummary, "firstPrompt">): string {
  const text = promptLine(session);
  const clipped = text.length > ADD_LABEL_MAX ? `${text.slice(0, ADD_LABEL_MAX).trimEnd()}…` : text;
  return `Add “${clipped}” to a build`;
}

/** A session in a build: the draft's title, or "a build" when the draft is not in the list. */
export function attachedTitle(session: Pick<SessionSummary, "buildId">, drafts: readonly DraftListItem[]): string {
  const draft = drafts.find((d) => d.id === session.buildId);
  return draft ? draftTitle(draft.title) : "a build";
}

export type MenuItem =
  | { key: string; label: string; kind: "target"; buildId: string }
  | { key: string; label: string; kind: "new" }
  | { key: string; label: string; kind: "draft"; buildId: string }
  | { key: string; label: string; kind: "open"; buildId: string }
  | { key: string; label: string; kind: "remove" };

/** The + menu of a session not in a build, in order. "remove" is drawn after a separator. */
export function menuItems(session: SessionSummary, drafts: readonly DraftListItem[]): MenuItem[] {
  const items: MenuItem[] = [];
  const target = session.targetBuildId ? drafts.find((d) => d.id === session.targetBuildId) : undefined;
  if (target) items.push({ key: "target", kind: "target", buildId: target.id, label: `Add to ${draftTitle(target.title)}` });
  items.push({ key: "new", kind: "new", label: "Start a new build" });
  for (const draft of drafts.slice(0, MENU_DRAFTS_MAX)) {
    items.push({ key: `draft-${draft.id}`, kind: "draft", buildId: draft.id, label: `Add to ${draftTitle(draft.title)}` });
  }
  items.push({ key: "remove", kind: "remove", label: "Remove session" });
  return items;
}

/** The + menu of a session already in a build: one way on. */
export function attachedMenuItems(session: SessionSummary, drafts: readonly DraftListItem[]): MenuItem[] {
  if (!session.buildId) return [];
  return [{ key: "open", kind: "open", buildId: session.buildId, label: `Open ${attachedTitle(session, drafts)}` }];
}
