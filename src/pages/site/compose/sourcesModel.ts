/* UI-P64 — what the Sources panel draws, from what the build already holds.

   PURE. `buildSteps` and `sessionGroups` (UI-P62) give the sessions and their
   numbers; this shapes them into rows. A session's number is the one the build
   page and the Build panel use (DATA §5), so "Session 2" means the same thing
   everywhere. Prompts written by hand form a group of their own, "typed here".

   A file's note is "opened in session {n}" when its node names a session that
   is in the build, and "added by you" otherwise. A file a step makes is noted
   "made in step {n}". */

import { sessionFactsLine, togetherLine } from "@/lib/build/sessionFacts";
import { FILE_TYPE, groupKey, groupKind, madeByOf, shownGroups, stepTitle, TYPED_HERE, type SessionGroup, type Step } from "@/lib/build/graph";
import { detectExportSource } from "@/lib/build/lovable";
import { goalLine, toolLabel } from "@/lib/build/making";
import type { SessionSummary, UnfinishedSession } from "@/lib/build/sessions";
import { matchesProjectFile, toolFor, toolName } from "@/lib/tools/registry";
import { isSetupPayload } from "@/lib/build/setup";
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
  /** The import session's id, `typed-<uuid>` for a session made here, or `typed-legacy-{n}` for an old build's typed prompts. */
  key: string;
  number: number;
  tool: string;
  /** "{model} · {d MMM}", or "typed here". */
  detail: string;
  prompts: SourcePrompt[];
  /** TF-13: set for a session whose client names no tool. `value` is the tool the maker gave it, or null. */
  pickTool?: { value: string | null };
  /** CA-04 P4: how many items its setup holds; absent for none. */
  setupCount?: number;
  /** CA-04 P6: "Worked until …", and whether the goal was reached; absent when it had none. */
  goal?: { line: string; reached: boolean };
  /** CA-04 P6: "Runs when a pull request is opened", from a workflow in its setup; absent when it has none. */
  runsWhen?: string;
  /** CA-05 P2: length, cost, and nobody watching, one line, the parts that exist; the maker sees all of it. Absent when none. */
  facts?: string;
  /** CA-05 P5: "At the same time as Session 3 · own copy: fix-totals"; absent when the session says neither. */
  together?: string;
  /** CA-06 P4: the maker's colour for the session, "#RRGGBB"; absent when it has none. */
  colour?: string;
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
  /** CA-12: the session is already in this draft: "In this draft" stands where the + button was. */
  inThisDraft: boolean;
  /** CA-12: "Also in 2 drafts", for a session in other drafts; null for none. */
  alsoIn: string | null;
  /** CA-12: the first prompt, for the Add a session list's search. */
  firstPrompt: string | null;
  /** CA-12: the date as the line shows it, and the prompt count. */
  date: string;
  promptCount: number;
}

/** CA-12: an import that is not a session yet. */
export interface SourceUnfinishedItem {
  id: string;
  label: string;
  /** "Sent 3 Oct" for one still arriving; the reason for one that did not finish. */
  line: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "3 Mar": the day and the short month, as the rows read. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "" : `${at.getDate()} ${MONTHS[at.getMonth()]}`;
}

/** CA-05 P2: the line under a session's head. */
const factsOf = (group: SessionGroup, audience: "maker" | "reader"): string | null => sessionFactsLine({ extras: group.extras, words: group.longWords }, audience);

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children)]);

/**
 * The sessions of this build in order, each with the prompts it gave.
 *
 * `sessionGroups` lists only sessions that have a step, so a session just put
 * into the build, before any of its prompts is added, would vanish from both
 * this list and Not in a build. `inBuild` (the build's own sessions, oldest
 * first) fills that gap: those sessions follow the grouped ones with no prompts
 * under them, numbered on from the last.
 *
 * A session's tool is its client's tool, else the one the maker gave it
 * (`sessionTools`, TF-13), else "Unknown tool". Only a session whose client
 * names no tool can be given one, so only it carries `pickTool`.
 */
export function sourceSessions(
  groups: readonly SessionGroup[],
  steps: readonly Step[],
  inBuild: readonly SessionSummary[] = [],
  sessionTools: Readonly<Record<string, string>> = {},
  setupCounts: Readonly<Record<string, number>> = {},
  runsWhen: Readonly<Record<string, string>> = {},
): SourceSession[] {
  const clients = new Map(inBuild.map((session) => [session.id, session.client]));
  const pickTool = (id: string): SourceSession["pickTool"] =>
    toolLabel(clients.get(id)) ? undefined : { value: sessionTools[id] ?? null };
  const prompts = flatten(steps).filter((step) => step.kind === "prompt");
  // CA-04 P1: an old build's implicit group (its steps before any session) has no row.
  const grouped = shownGroups(groups).map((group) => {
    const key = groupKey(group);
    const kind = groupKind(group);
    const mine = prompts.filter((step) => group.stepNumbers.includes(step.number) || (kind === "import" && step.sessionId === group.sessionId));
    // `sessionGroups` has already turned the client and the model into their labels.
    const model = group.model;
    const when = kind === "legacy" ? TYPED_HERE : shortDate(group.startedAt);
    return {
      key,
      number: group.number,
      tool: group.tool ?? (kind === "typed" ? "Typed here" : "Unknown tool"),
      detail: [model, when].filter(Boolean).join(" · "),
      ...(kind === "import" && group.sessionId ? { pickTool: pickTool(group.sessionId) } : null),
      ...(setupCounts[key] ? { setupCount: setupCounts[key] } : null),
      ...(group.goal ? { goal: { line: goalLine(group.goal), reached: group.goal.reached === "reached" } } : null),
      ...(runsWhen[key] ? { runsWhen: runsWhen[key] } : null),
      ...(group.colour ? { colour: group.colour } : null),
      ...(factsOf(group, "maker") ? { facts: factsOf(group, "maker") as string } : null),
      ...(togetherLine(group.extras, (other) => groups.find((candidate) => groupKey(candidate) === other)?.number) ? { together: togetherLine(group.extras, (other) => groups.find((candidate) => groupKey(candidate) === other)?.number) as string } : null),
      prompts: mine.map((step) => ({
        id: step.id,
        number: step.number,
        title: stepTitle(step),
        isDefault: step.title === null,
      })),
    };
  });
  const seen = new Set(groups.map(groupKey));
  const waiting = inBuild
    .filter((session) => !seen.has(session.id))
    .map((session, at): SourceSession => ({
      key: session.id,
      number: grouped.length + at + 1,
      tool: toolLabel(session.client) ?? (sessionTools[session.id] ? (toolName(sessionTools[session.id]) ?? sessionTools[session.id]) : "Unknown tool"),
      detail: [session.modelName, shortDate(session.createdAt)].filter(Boolean).join(" · "),
      pickTool: pickTool(session.id),
      prompts: [],
    }));
  return [...grouped, ...waiting];
}

/** The build's files, from its top-level file nodes. */
export function sourceFiles(tree: readonly BuildNode[], groups: readonly SessionGroup[], steps: readonly Step[] = []): SourceFile[] {
  const numbers = new Map(flatten(steps).map((step) => [step.id, step.number]));
  return tree
    // CA-04 P4: a session's setup is not a file of the build.
    .filter((node) => node.type === FILE_TYPE && node.parent_id === null && !isSetupPayload(node.payload))
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

export interface SourceReminder {
  toolId: string;
  /** "Claude Code reads CLAUDE.md". */
  line: string;
  /** The file to add. */
  file: string;
}

/** At most this many setup-file reminders in Sources. */
export const REMINDER_ROWS = 2;

/**
 * A quiet row for each coding tool the build uses that has no file matching its first project file yet
 * ("Claude Code reads CLAUDE.md"), at most two. A row goes once the file is in the build.
 */
export function projectFileReminders(sessions: readonly Pick<SourceSession, "tool">[], files: readonly Pick<SourceFile, "name">[]): SourceReminder[] {
  const seen = new Set<string>();
  const out: SourceReminder[] = [];
  for (const { tool: label } of sessions) {
    const tool = toolFor(label);
    const first = tool?.projectFiles?.[0];
    if (!tool || !first || seen.has(tool.id)) continue;
    seen.add(tool.id);
    if (files.some((file) => matchesProjectFile(file.name, first))) continue;
    out.push({ toolId: tool.id, line: `${tool.name} reads ${first}`, file: first });
    if (out.length === REMINDER_ROWS) break;
  }
  return out;
}

/** "Also in 2 drafts", from the drafts a session is in other than this one; null for none. */
export function alsoInLine(draftIds: readonly string[], buildId: string | null | undefined): string | null {
  const others = draftIds.filter((id) => id !== buildId).length;
  return others === 0 ? null : `Also in ${others} ${others === 1 ? "draft" : "drafts"}`;
}

/**
 * CA-12: every finished session, newest first as the library lists them: waiting, in this draft, in other drafts, and
 * ones marked expired. None is hidden and "expired" is never shown. One already in this draft says so; one in other
 * drafts keeps its + button and says where else it is.
 */
export function librarySources(library: readonly SessionSummary[], adding: ReadonlySet<string>, now: number, buildId: string | null = null): SourceLibraryItem[] {
  return library.map((session) => {
    const ids = session.draftIds ?? (session.buildId ? [session.buildId] : []);
    const date = shortDate(session.createdAt) || sessionDate(session.createdAt, now);
    return {
      id: session.id,
      label: sessionSource(session),
      line: `${date} · ${session.promptCount} ${session.promptCount === 1 ? "prompt" : "prompts"}`,
      adding: adding.has(session.id),
      inThisDraft: buildId !== null && ids.includes(buildId),
      alsoIn: alsoInLine(ids, buildId),
      firstPrompt: session.firstPrompt,
      date,
      promptCount: session.promptCount,
    };
  });
}

/** CA-12: the imports still arriving, and the ones that did not finish, for the two small groups at the bottom of Sources. */
export function unfinishedSources(list: readonly UnfinishedSession[], now: number): { arriving: SourceUnfinishedItem[]; didntFinish: SourceUnfinishedItem[] } {
  const arriving: SourceUnfinishedItem[] = [];
  const didntFinish: SourceUnfinishedItem[] = [];
  for (const item of list) {
    const label = sessionSource({ modelName: null, client: item.client });
    const sent = shortDate(item.createdAt) || sessionDate(item.createdAt, now);
    if (item.status === "open" || item.status === "assembling") arriving.push({ id: item.id, label, line: sent ? `Sent ${sent}` : "Sent" });
    else didntFinish.push({ id: item.id, label, line: item.reason ?? "It didn't finish." });
  }
  return { arriving, didntFinish };
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
