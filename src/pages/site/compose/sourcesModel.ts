/* UI-P64 — what the Sources panel draws, from what the build already holds.

   PURE. `buildSteps` and `sessionGroups` (UI-P62) give the sessions and their
   numbers; this shapes them into rows. A session's number is the one the build
   page and the Build panel use (DATA §5), so "Session 2" means the same thing
   everywhere. Prompts written by hand form a group of their own, "typed here".

   A file's note is "opened in session {n}" when its node names a session that
   is in the build, and "added by you" otherwise. A file a step makes is noted
   "made in step {n}". */

import { FILE_TYPE, madeByOf, stepTitle, TYPED_HERE, type SessionGroup, type Step } from "@/lib/build/graph";
import { detectExportSource } from "@/lib/build/lovable";
import { toolLabel } from "@/lib/build/making";
import type { SessionSummary } from "@/lib/build/sessions";
import type { BuildNode } from "@/lib/build/types";
import { sessionDate, sessionSource } from "@/pages/site/drafts/draftsModel";

export interface SourcePrompt {
  /** The step's id. */
  id: string;
  /** "3", or "3.1". */
  number: string;
  title: string;
  /** The title is the default one, drawn in `--text2`. */
  isDefault: boolean;
}

export interface SourceSession {
  /** The import session's id, or "typed-{n}" for prompts written here. */
  key: string;
  number: number;
  tool: string;
  /** "{model} · {d MMM}", or "typed here". */
  detail: string;
  prompts: SourcePrompt[];
}

export interface SourceFile {
  id: string;
  name: string;
  note: string;
}

export interface SourceLibraryItem {
  id: string;
  label: string;
  /** "{d MMM} · {n} prompts". */
  line: string;
  adding: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "3 Mar": the day and the short month, as the rows read. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "" : `${at.getDate()} ${MONTHS[at.getMonth()]}`;
}

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children)]);

/**
 * The sessions of this build in order, each with the prompts it gave.
 *
 * `sessionGroups` lists only sessions that have a step, so a session just put
 * into the build, before any of its prompts is added, would vanish from both
 * this list and Not in a build. `inBuild` (the build's own sessions, oldest
 * first) fills that gap: those sessions follow the grouped ones with no prompts
 * under them, numbered on from the last.
 */
export function sourceSessions(
  groups: readonly SessionGroup[],
  steps: readonly Step[],
  inBuild: readonly SessionSummary[] = [],
): SourceSession[] {
  const prompts = flatten(steps).filter((step) => step.kind === "prompt");
  const grouped = groups.map((group) => {
    const mine = group.sessionId
      ? prompts.filter((step) => step.sessionId === group.sessionId)
      : prompts.filter((step) => group.stepNumbers.includes(step.number));
    // `sessionGroups` has already turned the client and the model into their labels.
    const model = group.model;
    const when = group.sessionId ? shortDate(group.startedAt) : TYPED_HERE;
    return {
      key: group.sessionId ?? `typed-${group.number}`,
      number: group.number,
      tool: group.tool ?? "Unknown tool",
      detail: [model, when].filter(Boolean).join(" · "),
      prompts: mine.map((step) => ({
        id: step.id,
        number: step.number,
        title: stepTitle(step),
        isDefault: step.title === null,
      })),
    };
  });
  const seen = new Set(groups.map((group) => group.sessionId));
  const waiting = inBuild
    .filter((session) => !seen.has(session.id))
    .map((session, at): SourceSession => ({
      key: session.id,
      number: groups.length + at + 1,
      tool: toolLabel(session.client) ?? "Unknown tool",
      detail: [session.modelName, shortDate(session.createdAt)].filter(Boolean).join(" · "),
      prompts: [],
    }));
  return [...grouped, ...waiting];
}

/** The build's files, from its top-level file nodes. */
export function sourceFiles(tree: readonly BuildNode[], groups: readonly SessionGroup[], steps: readonly Step[] = []): SourceFile[] {
  const numbers = new Map(flatten(steps).map((step) => [step.id, step.number]));
  return tree
    .filter((node) => node.type === FILE_TYPE && node.parent_id === null)
    .map((node) => {
      const payload = (node.payload ?? {}) as Record<string, unknown>;
      const name = typeof payload.title === "string" && payload.title.trim() ? payload.title : "Untitled file";
      const from = typeof payload.session_id === "string" ? groups.find((group) => group.sessionId === payload.session_id) : undefined;
      const maker = madeByOf(node);
      const made = maker ? numbers.get(maker) : undefined;
      if (made) return { id: node.id, name, note: `made in step ${made}` };
      return { id: node.id, name, note: from ? `opened in session ${from.number}` : "added by you" };
    });
}

/** The library's sessions that are in no build, newest first as the library lists them. */
export function librarySources(library: readonly SessionSummary[], adding: ReadonlySet<string>, now: number): SourceLibraryItem[] {
  return library
    .filter((session) => session.status === "parsed" && session.buildId === null)
    .map((session) => ({
      id: session.id,
      label: sessionSource(session),
      line: `${shortDate(session.createdAt) || sessionDate(session.createdAt, now)} · ${session.promptCount} ${session.promptCount === 1 ? "prompt" : "prompts"}`,
      adding: adding.has(session.id),
    }));
}

const CHAT_EXPORT_CHARS = 400_000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const carriesChat = (item: unknown): boolean => isRecord(item) && ("mapping" in item || "chat_messages" in item);

/** Whether the text of a .json file is a chat export (ChatGPT, Claude or Lovable) rather than a file of the build, such as a workflow. */
export function looksLikeChatExport(text: string): boolean {
  if (detectExportSource(text) === "lovable") return true;
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return false;
  }
  if (Array.isArray(root)) return root.some(carriesChat);
  if (!isRecord(root)) return false;
  if (carriesChat(root)) return true;
  return [root.conversations, root.messages].some((list) => Array.isArray(list) && list.some(carriesChat));
}

/** Whether a dropped file is a chat export (it goes to the intake) rather than a file of the build. */
export async function isChatExport(file: Pick<File, "name" | "type"> & Partial<Pick<File, "slice">>): Promise<boolean> {
  if (/\.jsonl$/i.test(file.name)) return true;
  if (!/\.json$/i.test(file.name) && file.type !== "application/json") return false;
  if (typeof file.slice !== "function") return false;
  try {
    return looksLikeChatExport(await file.slice(0, CHAT_EXPORT_CHARS).text());
  } catch {
    return false;
  }
}
