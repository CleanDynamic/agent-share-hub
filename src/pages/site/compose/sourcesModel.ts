/* UI-P64 — Sources, as data.

   PURE. Everything the Sources panel draws is worked out here from what the
   page already holds: the steps (`buildSteps`), the session groups
   (`sessionGroups`), the build's file nodes, the sessions attached to this
   build, and the creator's library. Nothing here reads or writes the backend.

   SESSION NUMBERS ARE THE LIST'S. A session is numbered by where its first
   step sits ("Session 2" is the second run of steps), exactly as
   `sessionGroups` numbers it, so Sources, the List's dividers and Details say
   the same thing. A session attached to the build that has given it no step
   yet has no place in that order, so it follows the others, oldest first.

   NOTHING IS WRITTEN FOR THE MAKER. A prompt's title is the one they typed or
   its default ("Prompt 3"); a file is "opened in session {n}" only when its
   name is written word for word in one of that session's prompts, and
   "added by you" otherwise. */

import { FILE_TYPE, stepTitle, TYPED_HERE, type SessionGroup, type Step } from "@/lib/build/graph";
import { MEDIA_MAX_BYTES, mediaKindFor } from "@/lib/build/media";
import { toolLabel } from "@/lib/build/making";
import type { SessionSummary } from "@/lib/build/sessions";
import type { NodeTree } from "@/lib/build/types";

import { sessionSource } from "../drafts/draftsModel";

/** Rows shown in any group before "Show {n} more" (CONCEPT §7). */
export const SOURCES_VISIBLE = 6;

export interface SourcesPrompt {
  /** The step's id: what clicking the row selects. */
  id: string;
  /** "3", or "3.2": as the List numbers it. */
  number: string;
  title: string;
  /** The title is the default, not one the maker typed. */
  isDefault: boolean;
}

export interface SourcesSession {
  /** The session's id, or "typed-{n}" for prompts written here. */
  key: string;
  sessionId: string | null;
  number: number;
  tool: string | null;
  model: string | null;
  /** "6 Oct", or "typed here". */
  date: string;
  prompts: SourcesPrompt[];
}

export interface SourcesFile {
  id: string;
  name: string;
  /** "opened in session 4" or "added by you". */
  origin: string;
}

export interface SourcesLibraryRow {
  id: string;
  /** The model's name, or the tool that sent it. */
  source: string;
  /** "5 Oct · 6 prompts". */
  line: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "6 Oct". Empty for a date that is not one. */
export function dayMonth(iso: string | null | undefined): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return `${at.getDate()} ${MONTHS[at.getMonth()]}`;
}

/** "Session 4 · Claude Code", or "Session 4" while the tool is not known. */
export function sessionHeading(session: Pick<SourcesSession, "number" | "tool">): string {
  return session.tool ? `Session ${session.number} · ${session.tool}` : `Session ${session.number}`;
}

/** "Sonnet 5.5 · 6 Oct", leaving out what is not known. */
export function sessionLine(session: Pick<SourcesSession, "model" | "date">): string {
  return [session.model, session.date].filter(Boolean).join(" · ");
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const stringOf = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

/**
 * The sessions in this build, in number order, each with the prompts it gave
 * the build. `attached` is the build's own sessions (oldest first); `library`
 * is the creator's whole list. Either can supply a session's tool, model and
 * date, which are read from the session itself when it is known, and from the
 * build's record of it when it is not.
 */
export function sessionsInBuild({
  steps,
  groups,
  attached,
  library,
}: {
  steps: readonly Step[];
  groups: readonly SessionGroup[];
  attached: readonly SessionSummary[];
  library: readonly SessionSummary[];
}): SourcesSession[] {
  const known = new Map<string, SessionSummary>();
  for (const session of library) known.set(session.id, session);
  for (const session of attached) known.set(session.id, session);

  const byNumber = new Map<string, Step>();
  for (const step of steps) if (step.kind === "prompt") byNumber.set(step.number, step);

  const out: SourcesSession[] = groups.map((group) => {
    const summary = group.sessionId ? known.get(group.sessionId) : undefined;
    const prompts: SourcesPrompt[] = [];
    for (const number of group.stepNumbers) {
      const step = byNumber.get(number);
      if (step) prompts.push({ id: step.id, number: step.number, title: stepTitle(step), isDefault: step.title === null });
    }
    return {
      key: group.sessionId ?? `typed-${group.number}`,
      sessionId: group.sessionId,
      number: group.number,
      tool: (summary ? toolLabel(summary.client) : null) ?? group.tool,
      model: summary?.modelName ?? group.model,
      date: group.sessionId === null ? TYPED_HERE : dayMonth(summary?.createdAt ?? group.startedAt),
      prompts,
    };
  });

  const placed = new Set(out.map((session) => session.sessionId).filter((id): id is string => id !== null));
  let next = out.length;
  for (const session of attached) {
    if (placed.has(session.id)) continue;
    next += 1;
    out.push({
      key: session.id,
      sessionId: session.id,
      number: next,
      tool: toolLabel(session.client),
      model: session.modelName,
      date: dayMonth(session.createdAt),
      prompts: [],
    });
  }
  return out;
}

/**
 * The build's files, in the order they were added. The origin is a fact read
 * from the prompts: the first prompt of any session that writes the name word
 * for word, else the maker added it.
 */
export function filesInBuild(tree: readonly NodeTree[], steps: readonly Step[], groups: readonly SessionGroup[]): SourcesFile[] {
  const nodes = tree
    .filter((node) => node.type === FILE_TYPE)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return nodes.map((node) => {
    const payload = isRecord(node.payload) ? node.payload : {};
    const name = stringOf(payload.title) ?? stringOf(node.title) ?? "File";
    return { id: node.id, name, origin: fileOrigin(name, steps, groups) };
  });
}

export function fileOrigin(name: string, steps: readonly Step[], groups: readonly SessionGroup[]): string {
  for (const step of steps) {
    if (step.kind !== "prompt" || !step.sessionId || !step.text.includes(name)) continue;
    const group = groups.find((candidate) => candidate.sessionId === step.sessionId);
    if (group) return `opened in session ${group.number}`;
  }
  return "added by you";
}

/**
 * The creator's sessions that can still be added to this build: waiting, in no
 * build. A session in another build, or marked expired, is the library's, and
 * `attachSession` refuses it, so it is not offered here.
 */
export function notInBuild(library: readonly SessionSummary[]): SourcesLibraryRow[] {
  return library
    .filter((session) => session.status === "parsed" && !session.buildId)
    .map((session) => {
      const n = session.promptCount;
      const prompts = `${n} ${n === 1 ? "prompt" : "prompts"}`;
      return {
        id: session.id,
        source: sessionSource(session),
        line: [dayMonth(session.createdAt), prompts].filter(Boolean).join(" · "),
      };
    });
}

/** The first `SOURCES_VISIBLE` rows, and how many are left behind "Show {n} more". */
export function capRows<T>(rows: readonly T[], all: boolean): { shown: readonly T[]; more: number } {
  if (all || rows.length <= SOURCES_VISIBLE) return { shown: rows, more: 0 };
  return { shown: rows.slice(0, SOURCES_VISIBLE), more: rows.length - SOURCES_VISIBLE };
}

/* ── what is dropped ── */

/**
 * A chat export is a .json or a .zip: the intake reads those as sessions. Any
 * other file is a file of the build.
 */
export function isSessionExport(file: Pick<File, "name" | "type">): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".json") || name.endsWith(".zip") || file.type === "application/json" || file.type === "application/zip";
}

const EXTENSION_TYPES: Readonly<Record<string, string>> = {
  md: "text/markdown",
  markdown: "text/markdown",
  txt: "text/plain",
  csv: "text/csv",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/** A browser often sends no type for `.md`; the extension says what it is. */
export function typeOfFile(file: Pick<File, "name" | "type">): string {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[extension] ?? "";
}

/** The file with its type filled in, as the media path needs it. */
export function fileForUpload(file: File): File {
  const type = typeOfFile(file);
  return type === file.type ? file : new File([file], file.name, { type, lastModified: file.lastModified });
}

/** Why a file cannot be added, in a sentence; null when it can. */
export function fileProblem(file: Pick<File, "name" | "type" | "size">): string | null {
  if (file.size > MEDIA_MAX_BYTES) {
    return `${file.name} is too big. The limit is ${Math.round(MEDIA_MAX_BYTES / (1024 * 1024))} MB.`;
  }
  if (mediaKindFor(typeOfFile(file)) === null) return `${file.name} isn't a kind of file that can be added.`;
  return null;
}
