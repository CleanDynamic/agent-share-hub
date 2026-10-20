// CA-04 P4 — a session's setup as the folder its tool expects.
//
// Instructions at the root; each skill under `.claude/skills/<name>/` with the files beside it; every server in
// `.mcp.json`, its secrets as the `${NAME}` placeholders they were saved as; every rule in `.claude/settings.json`
// as a hook. Nothing marked Not shared is written. File contents are fetched through `load` (a download link to its
// bytes); a file that cannot be loaded is left out and named in `missing`.

import { HOOK_EVENTS, type SetupRule, type SetupServer } from "./setup";
import type { ReaderSetupItem } from "./readerSteps";
import type { ZipEntry } from "./zip";

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
  for (const item of shared.filter((entry) => entry.kind === "instructions")) await fetchInto(rootPath(item.path ?? item.name), item.download, item.name);
  for (const item of shared.filter((entry) => entry.kind === "skill")) {
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
