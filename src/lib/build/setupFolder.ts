// CA-04 P4 — a session's setup as the folder its tool expects.
//
// Instructions at the root; each skill under `.claude/skills/<name>/` with the files beside it; every server in
// `.mcp.json`, its secrets as the `${NAME}` placeholders they were saved as; every rule in `.claude/settings.json`
// as a hook. Nothing marked Not shared is written. File contents are fetched through `load` (a download link to its
// bytes); a file that cannot be loaded is left out and named in `missing`.

import { HOOK_EVENTS, pluginInstallLine, type SetupRule, type SetupServer } from "./setup";
import type { ReaderSetupItem } from "./readerSteps";
import type { ZipEntry } from "./zip";
import { REBUILD_COPY, notCarriedLine, skillFolder, type HarnessEntry } from "./harnessMap";

const EVENT_OF: Record<string, string> = Object.fromEntries(Object.entries(HOOK_EVENTS).map(([event, words]) => [words, event]));

const safe = (name: string) => name.replace(/[\\/:*?"<>|]+/g, "-").replace(/^\.+$/, "file").trim() || "file";

/** Where an instruction file goes: the root, or the folder its tool reads it from (.github/, .cursor/rules/). */
export function rootPath(path: string): string {
  const name = path.replace(/\\/g, "/");
  const at = name.search(/(^|\/)\.(github|cursor)\//);
  if (at >= 0) return name.slice(name[at] === "/" ? at + 1 : at);
  return name.split("/").pop() ?? name;
}

/** The .mcp.json the servers make. */
export function mcpJson(servers: readonly SetupServer[]): string {
  const mcpServers: Record<string, Record<string, unknown>> = {};
  for (const server of servers) {
    mcpServers[server.name] = {
      ...(server.type ? { type: server.type } : null),
      ...(server.url ? { url: server.url } : null),
      ...(server.command ? { command: server.command } : null),
      ...(server.args.length ? { args: server.args } : null),
      ...(Object.keys(server.env).length ? { env: server.env } : null),
      ...(Object.keys(server.headers).length ? { headers: server.headers } : null),
    };
  }
  return `${JSON.stringify({ mcpServers }, null, 2)}\n`;
}

/** The .claude/settings.json the rules make: each as a command hook on its event, its filter as the matcher. */
export function settingsJson(rules: readonly SetupRule[]): string {
  const hooks: Record<string, { matcher?: string; hooks: { type: "command"; command: string }[] }[]> = {};
  for (const rule of rules) {
    const event = EVENT_OF[rule.when] ?? rule.when;
    (hooks[event] ??= []).push({ ...(rule.filter ? { matcher: rule.filter } : null), hooks: [{ type: "command", command: rule.command }] });
  }
  return `${JSON.stringify({ hooks }, null, 2)}\n`;
}

/** SV-27 P6: "Install the email-triage skill from ClawHub." */
export const installLine = (item: Pick<ReaderSetupItem, "name" | "registry" | "skillName">): string => `Install the ${item.skillName ?? item.name} skill from ${item.registry ?? "its registry"}.`;

/** SV-30 P5: the plugins a folder asks to install: each as its install line, never as the plugin's files. Null when there are none. */
export const pluginsToInstall = (items: readonly ReaderSetupItem[]): string | null => {
  const lines = items.filter((item) => item.kind === "plugin" && item.plugin && !item.notShared).map((item) => pluginInstallLine(item.name, item.plugin as NonNullable<ReaderSetupItem["plugin"]>));
  return lines.length > 0 ? `${lines.join("\n")}\n` : null;
};

/**
 * SV-28 P8: the folder in another harness's layout, from its entry: the context file under its name, each skill in its skills
 * folder, and the MCP servers and hooks only where its file takes the same shape as Claude Code's. Whatever has no documented
 * equivalent is left out and listed in NOT-CARRIED.md at the root. Claude Code (or no entry) is the folder as it always was.
 */
export async function setupFolderFor(items: readonly ReaderSetupItem[], load: (url: string) => Promise<Uint8Array | null>, entry?: HarnessEntry | null): Promise<{ entries: ZipEntry[]; missing: string[]; notCarried: string[] }> {
  if (!entry || entry.harness === "claude-code") return { ...(await setupFolder(items, load)), notCarried: [] };
  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [];
  const missing: string[] = [];
  const notCarried: string[] = [];
  const note = (line: string) => {
    if (!notCarried.includes(line)) notCarried.push(line);
  };
  const shared = items.filter((item) => !item.notShared);
  const fetchInto = async (path: string, url: string | null, name: string) => {
    const data = url ? await load(url).catch(() => null) : null;
    if (data) entries.push({ path, data });
    else missing.push(name);
  };
  const local = (path: string) => path.replace(/^~\//, "");
  const context = [...items.filter((item) => item.kind === "instructions" && item.template), ...shared.filter((item) => item.kind === "instructions" && !item.template)];
  for (const [at, item] of context.entries()) {
    if (!entry.contextFile) {
      note(notCarriedLine("contextFile", entry));
      continue;
    }
    const path = at === 0 ? entry.contextFile : rootPath(item.path ?? item.name);
    if (item.template) entries.push({ path, data: encoder.encode(item.template) });
    else await fetchInto(path, item.download, item.name);
  }
  const toInstall = shared.filter((item) => item.kind === "skill" && item.origin === "registry" && !item.download && item.files.length === 0);
  if (toInstall.length > 0) entries.push({ path: "SKILLS-TO-INSTALL.md", data: encoder.encode(`${toInstall.map((item) => installLine(item)).join("\n")}\n`) });
  const plugins = pluginsToInstall(items);
  if (plugins) entries.push({ path: "PLUGINS-TO-INSTALL.md", data: encoder.encode(plugins) });
  for (const item of shared.filter((candidate) => candidate.kind === "skill" && !toInstall.includes(candidate))) {
    const folder = skillFolder(entry, safe(item.name));
    if (!folder) {
      note(notCarriedLine("skillsDir", entry));
      continue;
    }
    const base = item.path?.includes("/") ? item.path.slice(0, item.path.lastIndexOf("/") + 1) : "";
    await fetchInto(`${local(folder)}SKILL.md`, item.download, item.name);
    for (const file of item.files) {
      const inner = file.path && base && file.path.startsWith(base) ? file.path.slice(base.length) : file.name;
      await fetchInto(`${local(folder)}${inner}`, file.download, file.name);
    }
  }
  for (const item of shared.filter((candidate) => candidate.kind === "workflow" && candidate.workflow)) {
    entries.push({ path: `.github/workflows/${safe(item.workflow?.filename ?? "workflow.yml")}`, data: encoder.encode(item.workflow?.source ?? "") });
  }
  const servers = shared.flatMap((item) => (item.kind === "server" && item.server ? [item.server] : []));
  if (servers.length > 0) {
    if (entry.mcpConfig && entry.mcpJson) entries.push({ path: entry.mcpConfig, data: encoder.encode(mcpJson(servers)) });
    else if (entry.mcpConfig) note(`MCP servers (${servers.map((server) => server.name).join(", ")}): declare them in ${entry.mcpConfig}; its format is not the one .mcp.json uses, so they are not written here`);
    else note(notCarriedLine("mcpConfig", entry));
  }
  const rules = shared.flatMap((item) => (item.kind === "rule" && item.rule ? [item.rule] : []));
  if (rules.length > 0) {
    if (entry.hooks && entry.hooksJson) entries.push({ path: entry.hooks, data: encoder.encode(settingsJson(rules)) });
    else if (entry.hooks) note(`Hooks (${rules.length}): declare them in ${entry.hooks}; its format is not Claude Code's, so they are not written here`);
    else note(notCarriedLine("hooks", entry));
  }
  if (notCarried.length > 0) entries.push({ path: REBUILD_COPY.file, data: encoder.encode(`# ${REBUILD_COPY.notCarried}\n\n${notCarried.map((line) => `- ${line}`).join("\n")}\n`) });
  return { entries, missing, notCarried };
}

/** The folder's entries, in order: instructions, skills, .mcp.json, .claude/settings.json. */
export async function setupFolder(items: readonly ReaderSetupItem[], load: (url: string) => Promise<Uint8Array | null>): Promise<{ entries: ZipEntry[]; missing: string[] }> {
  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [];
  const missing: string[] = [];
  const shared = items.filter((item) => !item.notShared);
  const fetchInto = async (path: string, url: string | null, name: string) => {
    const data = url ? await load(url).catch(() => null) : null;
    if (data) entries.push({ path, data });
    else missing.push(name);
  };
  // SV-27 P6: a context file made into a template is written as its template; the original stays out (it is Not shared).
  for (const item of items.filter((entry) => entry.kind === "instructions" && entry.template)) entries.push({ path: rootPath(item.path ?? item.name), data: encoder.encode(item.template ?? "") });
  for (const item of shared.filter((entry) => entry.kind === "instructions" && !entry.template)) await fetchInto(rootPath(item.path ?? item.name), item.download, item.name);
  // SV-27 P6: a skill installed from a registry with no files of its own is a line telling the copier to install it by name.
  const toInstall = shared.filter((entry) => entry.kind === "skill" && entry.origin === "registry" && !entry.download && entry.files.length === 0);
  if (toInstall.length > 0) entries.push({ path: "SKILLS-TO-INSTALL.md", data: encoder.encode(`${toInstall.map((entry) => installLine(entry)).join("\n")}\n`) });
  const plugins = pluginsToInstall(items);
  if (plugins) entries.push({ path: "PLUGINS-TO-INSTALL.md", data: encoder.encode(plugins) });
  for (const item of shared.filter((entry) => entry.kind === "skill" && !toInstall.includes(entry))) {
    const folder = `.claude/skills/${safe(item.name)}`;
    await fetchInto(`${folder}/SKILL.md`, item.download, item.name);
    const base = item.path?.includes("/") ? item.path.slice(0, item.path.lastIndexOf("/") + 1) : "";
    for (const file of item.files) {
      const inner = file.path && base && file.path.startsWith(base) ? file.path.slice(base.length) : file.name;
      await fetchInto(`${folder}/${inner}`, file.download, file.name);
    }
  }
  for (const item of shared.filter((entry) => entry.kind === "workflow" && entry.workflow)) {
    entries.push({ path: `.github/workflows/${safe(item.workflow?.filename ?? "workflow.yml")}`, data: encoder.encode(item.workflow?.source ?? "") });
  }
  const servers = shared.flatMap((item) => (item.kind === "server" && item.server ? [item.server] : []));
  if (servers.length > 0) entries.push({ path: ".mcp.json", data: encoder.encode(mcpJson(servers)) });
  const rules = shared.flatMap((item) => (item.kind === "rule" && item.rule ? [item.rule] : []));
  if (rules.length > 0) entries.push({ path: ".claude/settings.json", data: encoder.encode(settingsJson(rules)) });
  return { entries, missing };
}
