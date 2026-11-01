// SV-28 Part 8: what a harness calls each part of an agent's setup, so a setup prompt (and Download the setup) can be written for a
// harness other than the one the maker used.
//
// EVERY ENTRY IS READ FROM THE HARNESS'S OWN DOCUMENTATION: the page in its registry `source`, or a page linked from it, each row
// with the URLs read and the month. A field the documentation does not state is `null` and counts as not carried over; nothing is
// guessed. A harness whose documentation could not be read has no entry and is not offered. Claude Code's entry matches what
// `setupFolder.ts` writes. PURE data and two readers.

import { toolFor } from "@/lib/tools/registry";

import { monthWord } from "./harnessFacts";
import type { ApprovalMode, Sandbox } from "./agentFields";

export interface HarnessEntry {
  /** The registry tool id. */
  harness: string;
  name: string;
  /** The context file's name at the project root ("CLAUDE.md"), or null when not documented. */
  contextFile: string | null;
  /** Where a skill goes, `<name>` standing for the skill's name (".claude/skills/<name>/"). */
  skillsDir: string | null;
  /** Where MCP servers are declared (".mcp.json"). */
  mcpConfig: string | null;
  /** Whether that file takes the `.mcp.json` shape (`mcpServers` in JSON at the project root), so Download the setup can write it. */
  mcpJson?: true;
  /** Where hooks are declared, or null. */
  hooks: string | null;
  /** Whether that file takes Claude Code's `hooks` settings shape, so Download the setup can write it. */
  hooksJson?: true;
  /** The approval modes it documents, by SV-27's names, each with the harness's own name for it. */
  approvalModes: Partial<Record<ApprovalMode, string>> | null;
  /** The sandboxes it documents, by SV-27's names, each with its own name. */
  sandbox: Partial<Record<Sandbox, string>> | null;
  /** The URLs read. */
  source: readonly string[];
  /** The month they were read, "2026-10". */
  checked: string;
}

/*
 * Read on 1 November 2026. Each value is the documentation's own (the page and its words are in the SV-28 report). Left out for
 * want of documentation that could be read: Cursor (its docs pages returned "not found"), Codex (its registry source is a
 * third-party page that links to no Codex documentation), GitHub Copilot, Antigravity, Muse Code, Manus and Muse (their registry
 * sources are not the harness's documentation).
 */
export const HARNESS_MAP: readonly HarnessEntry[] = [
  {
    harness: "claude-code",
    name: "Claude Code",
    contextFile: "CLAUDE.md",
    skillsDir: ".claude/skills/<name>/",
    mcpConfig: ".mcp.json",
    mcpJson: true,
    hooks: ".claude/settings.json",
    hooksJson: true,
    // permission-modes: bypassPermissions runs "Everything"; acceptEdits runs reads, file edits and common filesystem commands and
    // asks before the rest; default ("Manual") runs reads only. No mode is an AI reviewer that asks when unsure.
    approvalModes: { full: "bypassPermissions", risky: "acceptEdits", every: "default" },
    // sandboxing: "The sandbox is off by default"; containers and virtual machines run the whole Claude Code process.
    sandbox: { none: "sandbox off (its default)", container: "run Claude Code in a container", vm: "run Claude Code in a virtual machine" },
    source: [
      "https://code.claude.com/docs/en/model-config",
      "https://code.claude.com/docs/en/memory.md",
      "https://code.claude.com/docs/en/skills.md",
      "https://code.claude.com/docs/en/mcp.md",
      "https://code.claude.com/docs/en/hooks.md",
      "https://code.claude.com/docs/en/permission-modes.md",
      "https://code.claude.com/docs/en/sandboxing.md",
    ],
    checked: "2026-11",
  },
  {
    harness: "openclaw",
    name: "OpenClaw",
    contextFile: "AGENTS.md",
    skillsDir: "skills/<name>/",
    mcpConfig: "mcp.servers in ~/.openclaw/openclaw.json",
    hooks: "hooks.internal in ~/.openclaw/openclaw.json",
    // tools/permission-modes, tools.exec.mode: full runs "without ordinary policy prompts"; ask asks "a human on misses"; exec-approvals:
    // exec.ask "always" prompts "on every command".
    approvalModes: { full: "full", risky: "ask", every: "exec.ask always" },
    // gateway/sandboxing: "Sandboxing is off by default"; Docker is "the default local backend".
    sandbox: { none: "sandboxing off (its default)", container: "Docker" },
    source: [
      "https://docs.openclaw.ai/providers/models",
      "https://docs.openclaw.ai/automation",
      "https://docs.openclaw.ai/tools/skills",
      "https://docs.openclaw.ai/cli/mcp",
      "https://docs.openclaw.ai/automation/hooks",
      "https://docs.openclaw.ai/tools/permission-modes",
      "https://docs.openclaw.ai/tools/exec-approvals",
      "https://docs.openclaw.ai/gateway/sandboxing",
    ],
    checked: "2026-11",
  },
  {
    harness: "hermes-agent",
    name: "Hermes Agent",
    contextFile: "HERMES.md",
    skillsDir: "~/.hermes/skills/<name>/",
    mcpConfig: "mcp_servers in ~/.hermes/config.yaml",
    hooks: "hooks in ~/.hermes/config.yaml",
    // user-guide/security, approvals.mode: off disables "all approval checks"; manual prompts "on dangerous commands"; smart uses "an
    // auxiliary LLM to assess risk" and escalates uncertain cases to a person.
    approvalModes: { full: "off", risky: "manual", reviewer: "smart" },
    // user-guide/configuration, terminal backend: local, docker, ssh, modal, daytona, vercel_sandbox.
    sandbox: { none: "local", container: "docker", vendor: "modal, daytona or vercel_sandbox" },
    source: [
      "https://hermes-agent.nousresearch.com/docs/integrations/providers",
      "https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files",
      "https://hermes-agent.nousresearch.com/docs/user-guide/features/skills",
      "https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp",
      "https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks",
      "https://hermes-agent.nousresearch.com/docs/user-guide/security/",
      "https://hermes-agent.nousresearch.com/docs/user-guide/configuration",
    ],
    checked: "2026-11",
  },
  {
    harness: "devin-desktop",
    name: "Devin Desktop",
    contextFile: "AGENTS.md",
    skillsDir: ".devin/skills/<name>/",
    mcpConfig: ".devin/config.json",
    hooks: ".devin/hooks.v1.json",
    // desktop/devin-local/modes: five modes, Code, Smart, Ask, Plan and Bypass Permissions; only Bypass Permissions is described
    // plainly enough to match one of SV-27's modes.
    approvalModes: { full: "Bypass Permissions" },
    // Sandboxing is on or off ("When sandboxing is enabled, the session runs in Autonomous mode"); its kind is not stated.
    sandbox: null,
    source: [
      "https://docs.windsurf.com/windsurf/models",
      "https://docs.devin.ai/desktop/models",
      "https://docs.devin.ai/desktop/devin-local/customizations.md",
      "https://docs.devin.ai/desktop/devin-local/permissions.md",
      "https://docs.devin.ai/desktop/devin-local/modes.md",
    ],
    checked: "2026-11",
  },
];

/** The entry for a harness (an id or a name), or null when it has none. */
export function harnessEntry(harness: string | null | undefined): HarnessEntry | null {
  const id = toolFor(harness)?.id ?? harness ?? null;
  return HARNESS_MAP.find((entry) => entry.harness === id) ?? null;
}

/** The harnesses a setup can be rebuilt in. */
export const mappedHarnesses = (): readonly HarnessEntry[] => HARNESS_MAP;

/** The words for each field, as "Doesn't carry over" names them. */
export const FIELD_WORDS: Record<"contextFile" | "skillsDir" | "mcpConfig" | "hooks" | "approvalModes" | "sandbox", string> = {
  contextFile: "Context file",
  skillsDir: "Skills",
  mcpConfig: "MCP servers",
  hooks: "Hooks",
  approvalModes: "Approvals",
  sandbox: "Sandbox",
};

/** "Hooks: no documented equivalent in Codex CLI (docs, October 2026)". */
export const notCarriedLine = (field: keyof typeof FIELD_WORDS, entry: HarnessEntry): string => `${FIELD_WORDS[field]}: no documented equivalent in ${entry.name} (docs, ${monthWord(entry.checked)})`;

/** A skill's folder in a harness: `skillsDir` with the name put in. */
export const skillFolder = (entry: HarnessEntry, name: string): string | null => (entry.skillsDir ? entry.skillsDir.replace("<name>", name) : null);

export const REBUILD_COPY = { label: "Rebuild in", notCarried: "Doesn't carry over", file: "NOT-CARRIED.md" } as const;
