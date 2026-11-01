// SV-30 P4: where a session ran and what it could reach. PURE.
//
// Facts, not advice: a label says what was so ("Access: code (write)"), never whether it was wise. Every key is the maker's to give;
// the window proposes access systems from the session's setup, and a proposal is unticked until the maker ticks it.

import { toolFor } from "@/lib/tools/registry";

export const ENVIRONMENTS = ["local", "remote_dev", "cloud_sandbox"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];
export const ENVIRONMENT_LABEL: Record<Environment, string> = { local: "The maker's machine", remote_dev: "Remote development environment", cloud_sandbox: "Cloud sandbox" };

export const ISOLATIONS = ["worktree", "container", "vm", "none"] as const;
export type Isolation = (typeof ISOLATIONS)[number];
export const ISOLATION_LABEL: Record<Isolation, string> = { worktree: "Git worktree", container: "Container", vm: "Virtual machine", none: "No isolation" };

export const ACCESS_SYSTEMS = ["code", "tests", "run_app", "prod_logs", "metrics", "deploy", "release", "feature_flags", "issues", "email_users", "database"] as const;
export type AccessSystem = (typeof ACCESS_SYSTEMS)[number];
export const ACCESS_LABEL: Record<AccessSystem, string> = {
  code: "code",
  tests: "tests",
  run_app: "run the app",
  prod_logs: "production logs",
  metrics: "metrics",
  deploy: "deploy",
  release: "release",
  feature_flags: "feature flags",
  issues: "issues",
  email_users: "email users",
  database: "database",
};
export const ACCESS_SCOPES = ["read", "write"] as const;
export type AccessScope = (typeof ACCESS_SCOPES)[number];

export interface AccessEntry {
  system: AccessSystem;
  scope: AccessScope;
}

/** A stored access list, read defensively: known systems and scopes only, a system once (the last wins), in the order of the list. */
export function accessOf(value: unknown): AccessEntry[] {
  if (!Array.isArray(value)) return [];
  const bySystem = new Map<AccessSystem, AccessScope>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { system, scope } = entry as { system?: unknown; scope?: unknown };
    if (ACCESS_SYSTEMS.includes(system as AccessSystem) && ACCESS_SCOPES.includes(scope as AccessScope)) bySystem.set(system as AccessSystem, scope as AccessScope);
  }
  return ACCESS_SYSTEMS.flatMap((system) => (bySystem.has(system) ? [{ system, scope: bySystem.get(system) as AccessScope }] : []));
}

/** "Access: code (write) · tests (write) · production logs (read)"; null when none. */
export function accessLine(access: readonly AccessEntry[] | undefined): string | null {
  return access && access.length > 0 ? `Access: ${access.map((entry) => `${ACCESS_LABEL[entry.system]} (${entry.scope})`).join(" · ")}` : null;
}

/** "Cloud sandbox · Git worktree · Could install packages": the parts that were said. */
export function environmentLine(facts: { environment?: Environment; isolation?: Isolation; can_install?: boolean }): string | null {
  const parts = [
    facts.environment ? ENVIRONMENT_LABEL[facts.environment] : null,
    facts.isolation ? `Isolation: ${ISOLATION_LABEL[facts.isolation].toLowerCase()}` : null,
    facts.can_install === true ? "Could install packages" : facts.can_install === false ? "Could not install packages" : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Which access system a tool list entry names. The tool list (`registry.ts`) carries no such field, so this is the one table of
 * the entries that stand for a system; any other tool names none. Used only to propose, never to set.
 */
export const TOOL_ACCESS: Readonly<Record<string, AccessSystem>> = {
  github: "code",
  gitlab: "code",
  linear: "issues",
  jira: "issues",
  postgres: "database",
  supabase: "database",
  netlify: "deploy",
  vercel: "deploy",
  cloudflare: "deploy",
  resend: "email_users",
};

/** The systems the named tools and servers stand for, once each, in list order. The names are a session's setup servers and tools. */
export function proposedAccess(names: readonly string[]): AccessSystem[] {
  const found = new Set<AccessSystem>();
  for (const name of names) {
    const id = toolFor(name)?.id;
    const system = id ? TOOL_ACCESS[id] : undefined;
    if (system) found.add(system);
  }
  return ACCESS_SYSTEMS.filter((system) => found.has(system));
}
