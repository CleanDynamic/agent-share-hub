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
  /** SV-27 P1: the kind holds hooks (`HOOK_EVENTS`); stored as `rule`. */
  rule: "Hook",
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

/** CA-05 P6: what the AI read at the start of the session, and what it read only when it needed it. */
export type SetupLoaded = "start" | "when-needed";

export const SETUP_LOADED: readonly SetupLoaded[] = ["start", "when-needed"];

/**
 * Where each kind of item is read from unless the item says otherwise. The AI sees a skill's description at the start
 * and reads the rest when it uses the skill; instruction files, rules, servers and workflows are all there from the start.
 */
export const SETUP_LOADED_DEFAULT: Record<SetupKind, SetupLoaded> = {
  instructions: "start",
  rule: "start",
  skill: "when-needed",
  server: "start",
  workflow: "start",
};

/** The two quiet labels over a session's setup, when both have rows. */
export const SETUP_LOADED_LABEL: Record<SetupLoaded, string> = { start: "At the start", "when-needed": "Only when needed" };

/**
 * A setup split into what was read at the start and what only when needed, in the order each was added. Null when
 * either side is empty: the setup is then one list with no labels, as it always was.
 */
export function groupByLoaded<T extends { loaded: SetupLoaded }>(items: readonly T[]): { loaded: SetupLoaded; label: string; items: T[] }[] | null {
  const groups = SETUP_LOADED.map((loaded) => ({ loaded, label: SETUP_LOADED_LABEL[loaded], items: items.filter((item) => item.loaded === loaded) }));
  return groups.every((group) => group.items.length > 0) ? groups : null;
}

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

/** SV-27 P6: who wrote a skill: the maker, the agent itself, or a skill registry it was installed from. */
export const SKILL_ORIGINS = ["maker", "agent", "registry"] as const;
export type SkillOrigin = (typeof SKILL_ORIGINS)[number];
export const SKILL_ORIGIN_LABEL: Record<SkillOrigin, string> = { maker: "Written by the maker", agent: "Written by the agent", registry: "Installed from a skill registry" };
export const SKILL_NAME_MAX = 80;
export const REGISTRY_NAME_MAX = 40;

/** "Written by the agent", "From ClawHub"; null when the origin is not said. */
export function skillOriginLine(item: Pick<SetupItem, "origin" | "registry">): string | null {
  if (!item.origin) return null;
  if (item.origin === "registry") return item.registry ? `From ${item.registry}` : SKILL_ORIGIN_LABEL.registry;
  return SKILL_ORIGIN_LABEL[item.origin];
}

/** One item of a session's setup, as read from its node. */
export interface SetupItem {
  id: string;
  /** The session it belongs to; "" when it belongs to an agent (SV-27 P6). */
  session: string;
  /** SV-27 P6: the agent or team tile it belongs to, or null for a session's item. Exactly one of the two is set. */
  agent: string | null;
  /** SV-27 P6: a skill's origin, and for a registry skill the registry and the skill's name there. */
  origin: SkillOrigin | null;
  registry: string | null;
  skillName: string | null;
  /** SV-27 P6: an instructions file made into a template: the text with `{name}` variables, and their descriptions. */
  template: string | null;
  variables: { name: string; description: string }[];
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
  /** CA-05 P6: read at the start, or only when needed: what the item says, else what its kind is. */
  loaded: SetupLoaded;
  /** CA-04 P6: a workflow file, as written, and what was read of it (null where the reader was not sure). */
  workflow: { filename: string; source: string; events: WorkflowEvent[] | null; prompt: string | null } | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);

/** Whether a node's payload marks it as part of a session's setup. */
export function isSetupPayload(payload: unknown): boolean {
  if (!isRecord(payload) || !isRecord(payload.setup)) return false;
  // SV-27 P6: an item belongs to a session, or to an agent (`setup.agent`, a node id).
  const owned = typeof payload.setup.session === "string" || (typeof payload.setup.agent === "string" && payload.setup.agent.length > 0);
  return owned && SETUP_KINDS.includes(payload.setup.kind as SetupKind);
}

/** The setup a node belongs to, or null. An agent's item has `agent` set and `session` "". */
export function setupOfNode(node: Pick<BuildNode, "payload">): { session: string; agent?: string; kind: SetupKind; loaded?: SetupLoaded } | null {
  if (!isSetupPayload(node.payload)) return null;
  const setup = (node.payload as Record<string, Record<string, string>>).setup;
  const agent = typeof setup.agent === "string" && setup.agent ? setup.agent : null;
  return {
    session: agent ? "" : setup.session,
    ...(agent ? { agent } : null),
    kind: setup.kind as SetupKind,
    ...(SETUP_LOADED.includes(setup.loaded as SetupLoaded) ? { loaded: setup.loaded as SetupLoaded } : null),
  };
}

/** SV-27 P6: where an item's setup is kept, as one key: the session's key, or `agent:<id>`. */
export const setupOwnerKey = (item: Pick<SetupItem, "session" | "agent">): string => (item.agent ? `agent:${item.agent}` : item.session);

/** SV-27 P6: an agent's own setup items, in position order. */
export const agentSetupItemsOf = (tree: readonly NodeTree[], agentId: string): SetupItem[] => setupItemsOf(tree).filter((item) => item.agent === agentId);

/**
 * SV-27 P6: an item moved to a session or to an agent: the payload to write, as one change (one undo step). An item belongs to
 * exactly one of the two, so the other key is taken off.
 */
export function movedSetupPayload(payload: unknown, owner: { session: string } | { agent: string }): Record<string, unknown> {
  const p = isRecord(payload) ? { ...payload } : {};
  const setup = isRecord(p.setup) ? { ...p.setup } : {};
  delete setup.session;
  delete setup.agent;
  p.setup = "agent" in owner ? { ...setup, agent: owner.agent } : { ...setup, session: owner.session };
  return p;
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
    const origin = setup.kind === "skill" && SKILL_ORIGINS.includes(payload.origin as SkillOrigin) ? (payload.origin as SkillOrigin) : null;
    out.push({
      id: node.id,
      session: setup.session,
      agent: setup.agent ?? null,
      origin,
      registry: origin === "registry" ? (str(payload.registry)?.trim().slice(0, REGISTRY_NAME_MAX) ?? null) : null,
      skillName: origin === "registry" ? (str(payload.skill_name)?.trim().slice(0, SKILL_NAME_MAX) ?? null) : null,
      template: setup.kind === "instructions" ? str(payload.template) : null,
      variables: setup.kind === "instructions" && Array.isArray(payload.variables) ? payload.variables.flatMap((entry) => (isRecord(entry) && typeof entry.name === "string" ? [{ name: entry.name, description: typeof entry.description === "string" ? entry.description : "" }] : [])) : [],
      kind: setup.kind,
      name,
      description: str(skill?.description),
      path: str(payload.path),
      mediaId: str(payload.media_id),
      url: str(payload.url),
      notShared: payload.not_shared === true,
      loaded: SETUP_LOADED.includes(setup.loaded as SetupLoaded) ? (setup.loaded as SetupLoaded) : SETUP_LOADED_DEFAULT[setup.kind],
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

const setupKey = (session: string, kind: SetupKind) => ({ session, kind, loaded: SETUP_LOADED_DEFAULT[kind] });

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

/* ── SV-27 P6: the agent's setup, context file templates and skill origins ── */

/** A context file's template: the selected words, each turned into a `{name}` variable with a description. */
export interface TemplatePick {
  /** The words in the original, as selected. */
  words: string;
  name: string;
  description: string;
}

export const TEMPLATE_COPY = {
  make: "Make a template",
  variable: (name: string) => `{${name}}`,
  badName: "A variable's name is letters, digits and underscores.",
  notInText: (words: string) => `"${words}" is not in the file.`,
} as const;

const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,59}$/;

/**
 * The template a context file becomes: every occurrence of each pick's words replaced by `{name}`, and the variables in the order
 * they were picked. Throws a plain sentence for a bad name or words that are not in the text. Pure.
 */
export function templateFrom(text: string, picks: readonly TemplatePick[]): { template: string; variables: { name: string; description: string }[] } {
  let template = text;
  for (const pick of picks) {
    if (!VARIABLE_NAME.test(pick.name)) throw new Error(TEMPLATE_COPY.badName);
    if (!pick.words || !template.includes(pick.words)) throw new Error(TEMPLATE_COPY.notInText(pick.words));
    template = template.split(pick.words).join(`{${pick.name}}`);
  }
  const variables = picks.filter((pick, at) => picks.findIndex((other) => other.name === pick.name) === at).map((pick) => ({ name: pick.name, description: pick.description.trim().slice(0, 140) }));
  return { template, variables };
}

/** A template filled with a copier's values; a variable with no value is left as `{name}`. */
export const fillTemplate = (template: string, values: Readonly<Record<string, string>>): string => template.replace(/\{([A-Za-z_][A-Za-z0-9_]{0,59})\}/g, (whole, name: string) => (values[name]?.trim() ? values[name].trim() : whole));

/**
 * The payload an instructions item takes with its template: the template and its variables, and the original marked Not shared
 * (the maker can undo that with `setNotShared`). A null template takes the template off and leaves Not shared as it is.
 */
export function withTemplate(payload: unknown, made: { template: string; variables: { name: string; description: string }[] } | null): Record<string, unknown> {
  const p = isRecord(payload) ? { ...payload } : {};
  if (!made) {
    delete p.template;
    delete p.variables;
    return p;
  }
  return { ...p, template: made.template, variables: made.variables, not_shared: true };
}

/** The payload a skill takes with its origin; registry needs the registry's name and the skill's name there. */
export function withSkillOrigin(payload: unknown, origin: SkillOrigin | null, registry?: { registry: string; skillName: string }): Record<string, unknown> {
  const p = isRecord(payload) ? { ...payload } : {};
  delete p.origin;
  delete p.registry;
  delete p.skill_name;
  if (!origin) return p;
  if (origin === "registry") {
    const name = registry?.registry.trim() ?? "";
    const skill = registry?.skillName.trim() ?? "";
    if (!name || !skill) throw new Error("Name the registry and the skill there.");
    if (name.length > REGISTRY_NAME_MAX || skill.length > SKILL_NAME_MAX) throw new Error(`The skill's name: ${SKILL_NAME_MAX} characters max`);
    return { ...p, origin, registry: name, skill_name: skill };
  }
  return { ...p, origin };
}

/** Writes an item's new owner, its template, or a skill's origin: one node write, one undo step. */
export async function setSetupPayload(node: BuildNode, payload: Record<string, unknown>): Promise<BuildNode> {
  refuseIf("setSetupPayload", isSetupPayload(payload) ? null : "That is not part of a setup.");
  return upsertNode({ ...node, payload: payload as Json });
}
