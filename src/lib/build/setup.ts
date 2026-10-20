// CA-04 P4 — a session's setup: what the AI was given before the first prompt.
//
// A SETUP ITEM IS A TOP-LEVEL NODE with `payload.setup = { session, kind }`, kind one of instructions, skill, server
// or rule. Files (instructions, a skill's SKILL.md and the files beside it) are the existing file type; a server is
// the existing `integration` type; a rule is the existing code type, its command as the code and `payload.rule =
// { when, filter? }`. Setup items are not steps: they take no number and no place in the List (graph.ts leaves them
// out of `isStepNode`).
//
// NO SECRET IS EVER STORED. A server's `env` and `headers` values are replaced with `${NAME}`, by their own key,
// before anything is written, and the .mcp.json and .claude/settings.json files themselves are never uploaded:
// only what is read out of them is kept. Pure, but for the writes at the end.

import type { Json } from "@/integrations/supabase/types";
import { matchesProjectFile, TOOLS } from "@/lib/tools/registry";

import { placeChildNode, placeTopNode } from "./composeCover";
import { CODE_TYPE, FILE_TYPE, TOOL_TYPE } from "./graph";
import { upsertNode } from "./nodes";
import { readWorkflow, usesClaudeAction, type WorkflowEvent, type WorkflowReading } from "./runsFrom";
import { buildLayerError, type BuildNode, type BuildNodeInsert, type NodeTree } from "./types";

/** CA-04 P6 adds "workflow": a GitHub workflow that runs Claude Code, kept as a code tile in the setup. */
export type SetupKind = "instructions" | "skill" | "server" | "rule" | "workflow";

export const SETUP_KINDS: readonly SetupKind[] = ["instructions", "skill", "server", "rule", "workflow"];

/** How a kind is named in a setup row. */
export const SETUP_KIND_LABEL: Record<SetupKind, string> = {
  instructions: "Instructions",
  skill: "Skill",
  server: "MCP server",
  rule: "Rule",
  workflow: "Workflow",
};

/** A hook's event in plain words; any other event reads as its name as written. */
export const HOOK_EVENTS: Record<string, string> = {
  SessionStart: "When the session starts",
  PreToolUse: "Before a tool runs",
  PostToolUse: "After a tool runs",
  Stop: "When it stops",
  PreCompact: "Before the chat is summarised",
};

export const whenOf = (event: string): string => HOOK_EVENTS[event] ?? event;

export interface SetupServer {
  name: string;
  /** "stdio", "http", "sse", as written; null when the entry names none. */
  type: string | null;
  url: string | null;
  command: string | null;
  args: string[];
  /** Every value is a `${NAME}` placeholder. */
  env: Record<string, string>;
  headers: Record<string, string>;
}

export interface SetupRule {
  when: string;
  /** The hook's matcher, as written. */
  filter: string | null;
  command: string;
}

/** One item of a session's setup, as read from its node. */
export interface SetupItem {
  id: string;
  session: string;
  kind: SetupKind;
  /** The file's name ("CLAUDE.md"), the skill's name, the server's name, or the rule's command. */
  name: string;
  /** A skill's description, word for word. */
  description: string | null;
  /** Where the file sat ("docs/CLAUDE.md"), when a folder was dropped. */
  path: string | null;
  mediaId: string | null;
  url: string | null;
  /** The maker keeps it to themselves: its name stays, its contents do not. */
  notShared: boolean;
  /** A skill's other files: the tiles inside it. */
  files: { id: string; name: string; path: string | null; mediaId: string | null }[];
  server: SetupServer | null;
  rule: SetupRule | null;
  /** CA-04 P6: a workflow file, as written, and what was read of it (null where the reader was not sure). */
  workflow: { filename: string; source: string; events: WorkflowEvent[] | null; prompt: string | null } | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);

/** Whether a node's payload marks it as part of a session's setup. */
export function isSetupPayload(payload: unknown): boolean {
  if (!isRecord(payload) || !isRecord(payload.setup)) return false;
  return typeof payload.setup.session === "string" && SETUP_KINDS.includes(payload.setup.kind as SetupKind);
}

/** The setup a node belongs to, or null. */
export function setupOfNode(node: Pick<BuildNode, "payload">): { session: string; kind: SetupKind } | null {
  if (!isSetupPayload(node.payload)) return null;
  const setup = (node.payload as Record<string, Record<string, string>>).setup;
  return { session: setup.session, kind: setup.kind as SetupKind };
}

function readServer(payload: Record<string, unknown>, name: string): SetupServer | null {
  const raw = isRecord(payload.server) ? payload.server : null;
  if (!raw) return null;
  const strings = (value: unknown): Record<string, string> =>
    isRecord(value) ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string")) : {};
  return {
    name,
    type: str(raw.type),
    url: str(raw.url),
    command: str(raw.command),
    args: Array.isArray(raw.args) ? raw.args.filter((arg): arg is string => typeof arg === "string") : [],
    env: strings(raw.env),
    headers: strings(raw.headers),
  };
}

function workflowOf(payload: Record<string, unknown>): SetupItem["workflow"] {
  const read = isRecord(payload.workflow) ? payload.workflow : {};
  const events = Array.isArray(read.events)
    ? read.events.flatMap((event) =>
        isRecord(event) && typeof event.name === "string" ? [{ name: event.name, types: Array.isArray(event.types) ? event.types.filter((type): type is string => typeof type === "string") : [] }] : [],
      )
    : null;
  return { filename: str(payload.filename) ?? "workflow.yml", source: str(payload.source) ?? "", events: events && events.length > 0 ? events : null, prompt: str(read.prompt) };
}

/** The setup items of a tree, in position order; with `session`, only that session's. */
export function setupItemsOf(tree: readonly NodeTree[], session?: string | null): SetupItem[] {
  const out: SetupItem[] = [];
  const top = [...tree].filter((node) => node.parent_id === null).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  for (const node of top) {
    const setup = setupOfNode(node);
    if (!setup || (session !== undefined && session !== null && setup.session !== session)) continue;
    const payload = node.payload as Record<string, unknown>;
    const skill = isRecord(payload.skill) ? payload.skill : null;
    const rule = isRecord(payload.rule) ? payload.rule : null;
    const name =
      setup.kind === "workflow"
        ? (str(payload.filename) ?? "workflow.yml")
        : setup.kind === "skill"
        ? (str(skill?.name) ?? str(payload.title) ?? "Skill")
        : setup.kind === "server"
          ? (str(payload.service) ?? "MCP server")
          : setup.kind === "rule"
            ? (str(payload.source) ?? "")
            : (str(payload.title) ?? "Untitled file");
    out.push({
      id: node.id,
      session: setup.session,
      kind: setup.kind,
      name,
      description: str(skill?.description),
      path: str(payload.path),
      mediaId: str(payload.media_id),
      url: str(payload.url),
      notShared: payload.not_shared === true,
      files: (node.children ?? [])
        .filter((child) => child.type === FILE_TYPE)
        .map((child) => {
          const inner = (isRecord(child.payload) ? child.payload : {}) as Record<string, unknown>;
          return { id: child.id, name: str(inner.title) ?? "Untitled file", path: str(inner.path), mediaId: str(inner.media_id) };
        }),
      server: setup.kind === "server" ? readServer(payload, name) : null,
      rule: setup.kind === "rule" ? { when: str(rule?.when) ?? "", filter: str(rule?.filter), command: str(payload.source) ?? "" } : null,
      workflow: setup.kind === "workflow" ? workflowOf(payload) : null,
    });
  }
  return out;
}

/* ── routing a drop ── */

/** A dropped file, with where it sat when a folder was dropped ("skills/order-forms/SKILL.md"), and its text when read. */
export interface DroppedFile {
  name: string;
  path: string;
  text?: string;
}

/** What a drop becomes: setup items to make, and the files that stay the build's own. Indices into the drop. */
export type SetupDraft =
  | { kind: "instructions"; file: number }
  | { kind: "skill"; file: number; name: string | null; description: string | null; files: number[] }
  | { kind: "server"; server: SetupServer }
  | { kind: "rule"; rule: SetupRule }
  | { kind: "workflow"; file: number; reading: WorkflowReading };

const norm = (path: string) => path.replace(/\\/g, "/").replace(/^\.\//, "");
const baseName = (path: string) => norm(path).split("/").pop() ?? path;
const folderOf = (path: string) => {
  const parts = norm(path).split("/");
  parts.pop();
  return parts.join("/");
};

/** The instruction files the tool list's coding tools read: CLAUDE.md, AGENTS.md, .cursor/rules/*, .github/copilot-instructions.md. */
const INSTRUCTION_FILES: readonly string[] = [...new Set(TOOLS.flatMap((tool) => tool.projectFiles ?? []).filter((file) => file !== "SKILL.md"))];

export function isInstructionsFile(path: string): boolean {
  const name = norm(path);
  return INSTRUCTION_FILES.some((file) => (file.endsWith("/") ? name.toLowerCase().includes(file.toLowerCase()) : matchesProjectFile(name, file)));
}

/**
 * A SKILL.md's top block, its `name` and `description`, word for word: a front matter between `---` lines, each
 * value as written on its line (quotes around a whole value come off, nothing else changes). Null for a key it lacks.
 */
export function readSkillTop(text: string): { name: string | null; description: string | null } {
  const match = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match) return { name: null, description: null };
  const value = (key: string): string | null => {
    const line = new RegExp(`^${key}:[ \\t]*(.*)$`, "m").exec(match[1]);
    if (!line) return null;
    const raw = line[1].trim();
    const unquoted = /^(["']).*\1$/.test(raw) ? raw.slice(1, -1) : raw;
    return unquoted || null;
  };
  return { name: value("name"), description: value("description") };
}

/** `${NAME}` for every value, by its own key. The values are never kept. */
export const placeholders = (values: unknown): Record<string, string> =>
  isRecord(values) ? Object.fromEntries(Object.keys(values).map((key) => [key, `\${${key}}`])) : {};

/** The servers an .mcp.json names, one per entry, every secret replaced. Empty for text that is not one. */
export function readMcpJson(text: string): SetupServer[] {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return [];
  }
  const entries = isRecord(root) && isRecord(root.mcpServers) ? root.mcpServers : isRecord(root) && isRecord(root.servers) ? root.servers : null;
  if (!entries) return [];
  return Object.entries(entries).flatMap(([name, value]) => {
    if (!isRecord(value)) return [];
    return [
      {
        name,
        type: str(value.type),
        url: str(value.url),
        command: str(value.command),
        args: Array.isArray(value.args) ? value.args.filter((arg): arg is string => typeof arg === "string") : [],
        env: placeholders(value.env),
        headers: placeholders(value.headers),
      },
    ];
  });
}

/** The rules a .claude/settings.json's hooks make, one per command. Nothing else in the file is kept. */
export function readHooks(text: string): SetupRule[] {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return [];
  }
  if (!isRecord(root) || !isRecord(root.hooks)) return [];
  const out: SetupRule[] = [];
  for (const [event, entries] of Object.entries(root.hooks)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!isRecord(entry)) continue;
      const filter = str(entry.matcher);
      const hooks = Array.isArray(entry.hooks) ? entry.hooks : [entry];
      for (const hook of hooks) {
        const command = isRecord(hook) ? str(hook.command) : null;
        if (command) out.push({ when: whenOf(event), filter, command });
      }
    }
  }
  return out;
}

const isMcpJson = (path: string) => baseName(path).toLowerCase() === ".mcp.json";
/** A dropped `.claude/settings.json`; dropped on its own a file has no folder, so its name and its hooks say it. */
const isSettings = (file: DroppedFile) =>
  /(^|\/)\.claude\/settings(\.local)?\.json$/i.test(norm(file.path)) || (/^settings(\.local)?\.json$/i.test(baseName(file.path)) && readHooks(file.text ?? "").length > 0);
const isSkillFile = (path: string) => baseName(path).toLowerCase() === "skill.md";
/** CA-04 P6: a workflow file that runs Claude Code's action: under .github/workflows/, or a .yml dropped on its own that uses it. */
const isYaml = (path: string) => /\.ya?ml$/i.test(path);
const isWorkflowFile = (file: DroppedFile) => isYaml(file.path) && usesClaudeAction(file.text ?? "");

/**
 * Where each dropped file goes: the session's setup when its name says what it is, the build's files otherwise.
 * Instruction files are instructions; a SKILL.md is a skill, and the other files in its folder are tiles inside it;
 * an .mcp.json is a server per entry; a .claude/settings.json is a rule per hook. `text` is read for the last three.
 */
export function routeSetupFiles(files: readonly DroppedFile[]): { drafts: SetupDraft[]; rest: number[] } {
  const drafts: SetupDraft[] = [];
  const taken = new Set<number>();
  const skillFolders = new Map<string, number>();
  files.forEach((file, at) => {
    if (isSkillFile(file.path)) skillFolders.set(folderOf(file.path), at);
  });
  files.forEach((file, at) => {
    if (taken.has(at)) return;
    if (isSkillFile(file.path)) {
      const folder = folderOf(file.path);
      const inside = folder
        ? files.flatMap((other, i) => (i !== at && !isSkillFile(other.path) && norm(other.path).startsWith(`${folder}/`) ? [i] : []))
        : [];
      inside.forEach((i) => taken.add(i));
      taken.add(at);
      const top = readSkillTop(file.text ?? "");
      drafts.push({ kind: "skill", file: at, name: top.name, description: top.description, files: inside });
    }
  });
  files.forEach((file, at) => {
    if (taken.has(at)) return;
    if (isMcpJson(file.path)) {
      taken.add(at);
      for (const server of readMcpJson(file.text ?? "")) drafts.push({ kind: "server", server });
    } else if (isSettings(file)) {
      taken.add(at);
      for (const rule of readHooks(file.text ?? "")) drafts.push({ kind: "rule", rule });
    } else if (isWorkflowFile(file)) {
      taken.add(at);
      drafts.push({ kind: "workflow", file: at, reading: readWorkflow(file.text ?? "") as WorkflowReading });
    } else if (isInstructionsFile(file.path)) {
      taken.add(at);
      drafts.push({ kind: "instructions", file: at });
    }
  });
  return { drafts, rest: files.map((_, at) => at).filter((at) => !taken.has(at)) };
}

/** Whether a dropped file needs its text read to be routed. */
export const needsText = (path: string): boolean => isSkillFile(path) || isMcpJson(path) || isYaml(path) || /(^|\/)settings(\.local)?\.json$/i.test(norm(path));

/* ── writes ── */

const setupKey = (session: string, kind: SetupKind) => ({ session, kind });

function refuseIf(operation: string, why: string | null) {
  if (why) throw buildLayerError(operation, new Error(why));
}

/** An instruction file or a skill's SKILL.md, or (with `parentId`) a file inside a skill. Stored as a file. */
export async function addSetupFile(
  buildId: string,
  tree: readonly NodeTree[],
  { session, kind, title, path, media_id, skill, parentId }: { session: string; kind: "instructions" | "skill"; title: string; path?: string | null; media_id?: string; skill?: { name: string | null; description: string | null }; parentId?: string },
): Promise<BuildNode> {
  refuseIf("addSetupFile", !title.trim() ? "A file needs its name." : null);
  const payload: Record<string, unknown> = { title: title.trim() };
  if (path && path !== title) payload.path = path;
  if (media_id) payload.media_id = media_id;
  if (parentId) return placeChildNode(buildId, tree as NodeTree[], parentId, { type: FILE_TYPE, title: null, payload: payload as Json });
  payload.setup = setupKey(session, kind);
  if (kind === "skill") payload.skill = { ...(skill?.name ? { name: skill.name } : null), ...(skill?.description ? { description: skill.description } : null) };
  return placeTopNode(buildId, tree, { type: FILE_TYPE, title: null, payload: payload as Json });
}

/**
 * A server, as the build's integration node: its name, its type and its address or command. `env` and `headers` are
 * replaced with placeholders here again, whatever they hold, so a value can never be written. CA-04 P5: connected
 * by MCP, at a web address when it has a url, else on the maker's computer.
 */
export async function addSetupServer(buildId: string, tree: readonly NodeTree[], session: string, server: SetupServer, tools?: Record<string, number>): Promise<BuildNode> {
  refuseIf("addSetupServer", !server.name.trim() ? "A server needs its name." : null);
  const kept: Record<string, unknown> = { ...(server.type ? { type: server.type } : null), ...(server.url ? { url: server.url } : null), ...(server.command ? { command: server.command } : null) };
  if (server.args.length) kept.args = server.args;
  const env = placeholders(server.env);
  const headers = placeholders(server.headers);
  if (Object.keys(env).length) kept.env = env;
  if (Object.keys(headers).length) kept.headers = headers;
  const payload: Record<string, unknown> = {
    service: server.name.trim(),
    setup: setupKey(session, "server"),
    server: kept,
    connection: "mcp",
    runs_at: server.url ? "web" : "local",
  };
  if (tools && Object.keys(tools).length) payload.tools_used = tools;
  return placeTopNode(buildId, tree, { type: TOOL_TYPE, title: null, payload: payload as Json });
}

/** A rule: its command as code, when it runs and its filter. */
export async function addSetupRule(buildId: string, tree: readonly NodeTree[], session: string, rule: SetupRule): Promise<BuildNode> {
  refuseIf("addSetupRule", !rule.command.trim() ? "A rule needs its command." : null);
  const payload = {
    source: rule.command,
    language: "bash",
    setup: setupKey(session, "rule"),
    rule: { when: rule.when, ...(rule.filter ? { filter: rule.filter } : null) },
  };
  return placeTopNode(buildId, tree, { type: CODE_TYPE, title: null, payload: payload as Json });
}

/** CA-04 P6: a workflow file, kept as written as a code tile in the setup, with what the reader was sure of. */
export async function addSetupWorkflow(buildId: string, tree: readonly NodeTree[], session: string, { filename, source, reading }: { filename: string; source: string; reading: WorkflowReading }): Promise<BuildNode> {
  refuseIf("addSetupWorkflow", !source.trim() ? "A workflow needs its lines." : null);
  const workflow = { ...(reading.events ? { events: reading.events } : null), ...(reading.prompt ? { prompt: reading.prompt } : null) };
  const payload = { source, language: "yaml", filename: filename.trim() || "workflow.yml", setup: setupKey(session, "workflow"), workflow };
  return placeTopNode(buildId, tree, { type: CODE_TYPE, title: null, payload: payload as unknown as Json });
}

/**
 * Mark a setup item Not shared, or shared again. Not shared keeps its name (and a skill's description) and drops
 * what a reader could open: the stored file and its link. Sharing again needs the file added again.
 */
export async function setNotShared(node: BuildNode, notShared: boolean): Promise<BuildNode> {
  refuseIf("setNotShared", setupOfNode(node) ? null : "That is not part of a session's setup.");
  const payload = { ...(node.payload as Record<string, unknown>) };
  if (notShared) {
    payload.not_shared = true;
    delete payload.media_id;
    delete payload.url;
    if (isRecord(payload.server)) payload.server = { ...payload.server, url: undefined, command: undefined, args: undefined };
  } else delete payload.not_shared;
  const row: BuildNodeInsert = {
    id: node.id,
    build_id: node.build_id,
    parent_id: node.parent_id,
    position: node.position,
    type: node.type,
    title: node.title,
    note: node.note,
    payload: JSON.parse(JSON.stringify(payload)) as Json,
    source_ref: node.source_ref,
    event_id: node.event_id,
    is_gap: node.is_gap,
  };
  return upsertNode(row);
}
