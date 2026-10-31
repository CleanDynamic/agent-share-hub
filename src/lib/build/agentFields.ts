// SV-27 Part 5 — the agent and team fields a deployment needs: the framework an agent built in code uses, the models the maker
// says it also works with, how its model is chosen, when it must ask before acting, where its commands run, its role in a team,
// and what it may do with each of its tools.
//
// Each key is new and optional, so an agent saved before reads exactly as it did. They are method: a fork keeps all of them
// (forkRules strips only evidence), and `rewritePayload` rewrites `runs.channels`. PURE, but for registering the cleaners the
// existing extras writer (`setExtras`) uses.

import type { Json } from "@/integrations/supabase/types";

import { TOOL_PERMISSIONS, registerCleaners, type ToolPermission } from "./tileExtras";

/* ── Framework ── */

export const FRAMEWORK_COPY = {
  label: "Framework",
  help: "A harness runs an agent for you. A framework is a library you build one with.",
  select: "Select a framework",
} as const;

/* ── Compatible models ── */

export const COMPATIBLE_MODELS_MAX = 8;
export const COMPATIBLE_COPY = {
  add: "Add compatible models",
  shown: "The maker says it also works with:",
} as const;

/* ── Model routing ── */

export const ROUTING_MODES = ["fixed", "maker_switches", "router"] as const;
export type RoutingMode = (typeof ROUTING_MODES)[number];
export const ROUTING_LABEL: Record<RoutingMode, string> = { fixed: "Always this model", maker_switches: "The maker switches it", router: "Chosen by a router" };
export const ROUTING_RULE_MAX = 120;
export const ROUTING_COPY = { label: "Model routing", rule: "The rule", rulePlaceholder: "cheapest open model that week", router: "Router", needsRouter: "Name the router that chooses the model." } as const;

export interface ModelRouting {
  mode: Exclude<RoutingMode, "fixed">;
  router?: string;
  rule?: string;
}

/* ── Approvals ── */

export const APPROVAL_MODES = ["full", "risky", "every", "reviewer"] as const;
export type ApprovalMode = (typeof APPROVAL_MODES)[number];
export const APPROVAL_LABEL: Record<ApprovalMode, string> = {
  full: "Full access, never asks",
  risky: "Asks before risky actions",
  every: "Asks before every action",
  reviewer: "AI reviewer, then asks you when unsure",
};
export const APPROVALS_COPY = { label: "Approvals", notSaid: "Not said", reviewer: "Reviewer model" } as const;

/* ── Sandbox ── */

export const SANDBOXES = ["none", "container", "vm", "vendor"] as const;
export type Sandbox = (typeof SANDBOXES)[number];
export const SANDBOX_LABEL: Record<Sandbox, string> = { none: "None, runs on the host", container: "Container", vm: "Virtual machine", vendor: "The vendor's cloud" };
export const SANDBOX_COPY = { label: "Sandbox", notSaid: "Not said" } as const;

/* ── Role in a team ── */

export const ROLE_MAX = 30;
export const ROLE_COPY = { label: "Role", placeholder: "Researcher", lone: "Only an agent in a team has a role." } as const;

/* ── Limits (Part 5.10) ── */

export const LIMITS_HINT = "Steps, budget, run time, prohibited actions";

/* ── reading ── */

type Raw = Record<string, unknown>;
const isRecord = (value: unknown): value is Raw => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "");

export interface AgentFields {
  framework?: string;
  compatibleModels?: string[];
  modelRouting?: ModelRouting;
  approvalMode?: ApprovalMode;
  reviewerModel?: string;
  sandbox?: Sandbox;
  role?: string;
  toolPermissions?: Record<string, ToolPermission>;
}

export const routingOf = (value: unknown): ModelRouting | null => {
  if (!isRecord(value) || (value.mode !== "maker_switches" && value.mode !== "router")) return null;
  const router = text(value.router, 60);
  const rule = text(value.rule, ROUTING_RULE_MAX);
  if (value.mode === "router" && !router) return null;
  return { mode: value.mode, ...(value.mode === "router" ? { router } : null), ...(rule ? { rule } : null) };
};

const permissionsOf = (value: unknown): Record<string, ToolPermission> | null => {
  if (!isRecord(value)) return null;
  const out = Object.fromEntries(Object.entries(value).filter(([tool, permission]) => tool && TOOL_PERMISSIONS.includes(permission as ToolPermission))) as Record<string, ToolPermission>;
  return Object.keys(out).length > 0 ? out : null;
};

const modelsOf = (value: unknown): string[] => (Array.isArray(value) ? [...new Set(value.map((entry) => text(entry, 60)).filter(Boolean))].slice(0, COMPATIBLE_MODELS_MAX) : []);

/** An agent's or team's Part 5 fields, read defensively from its payload. */
export function agentFieldsOf(payload: unknown): AgentFields {
  const p = isRecord(payload) ? payload : {};
  const out: AgentFields = {};
  const framework = text(p.framework, 60);
  if (framework) out.framework = framework;
  const compatible = modelsOf(p.compatible_models);
  if (compatible.length > 0) out.compatibleModels = compatible;
  const routing = routingOf(p.model_routing);
  if (routing) out.modelRouting = routing;
  if (APPROVAL_MODES.includes(p.approval_mode as ApprovalMode)) out.approvalMode = p.approval_mode as ApprovalMode;
  const reviewer = text(p.reviewer_model, 60);
  if (reviewer && out.approvalMode === "reviewer") out.reviewerModel = reviewer;
  if (SANDBOXES.includes(p.sandbox as Sandbox)) out.sandbox = p.sandbox as Sandbox;
  const role = text(p.role, ROLE_MAX);
  if (role) out.role = role;
  const permissions = permissionsOf(p.tool_permissions);
  if (permissions) out.toolPermissions = permissions;
  return out;
}

/** "The maker says it also works with: GPT, Gemini", or null with none. */
export const compatibleLine = (names: readonly string[]): string | null => (names.length > 0 ? `${COMPATIBLE_COPY.shown} ${names.join(", ")}` : null);

/* ── the cleaners (the existing extras writer) ── */

const fail = (message: string): never => {
  throw new Error(message);
};

const AGENT_CLEANERS = {
  framework: (value: unknown): Json | null => text(value, 60) || null,
  compatible_models: (value: unknown): Json | null => {
    if (Array.isArray(value) && value.filter((entry) => text(entry, 60)).length > COMPATIBLE_MODELS_MAX) fail(`Compatible models: ${COMPATIBLE_MODELS_MAX} max`);
    const list = modelsOf(value);
    return list.length > 0 ? list : null;
  },
  model_routing: (value: unknown): Json | null => {
    if (!isRecord(value) || value.mode === "fixed" || value.mode === undefined || value.mode === null) return null;
    if (!ROUTING_MODES.includes(value.mode as RoutingMode)) fail("That is not a way a model is chosen.");
    if (typeof value.rule === "string" && value.rule.trim().length > ROUTING_RULE_MAX) fail(`The rule: ${ROUTING_RULE_MAX} characters max`);
    if (value.mode === "router" && !text(value.router, 60)) fail(ROUTING_COPY.needsRouter);
    return routingOf(value) as unknown as Json;
  },
  approval_mode: (value: unknown): Json | null => (APPROVAL_MODES.includes(value as ApprovalMode) ? (value as ApprovalMode) : null),
  reviewer_model: (value: unknown): Json | null => text(value, 60) || null,
  sandbox: (value: unknown): Json | null => (SANDBOXES.includes(value as Sandbox) ? (value as Sandbox) : null),
  role: (value: unknown): Json | null => {
    if (typeof value === "string" && value.trim().length > ROLE_MAX) fail(`Role: ${ROLE_MAX} characters max`);
    return text(value, ROLE_MAX) || null;
  },
  tool_permissions: (value: unknown): Json | null => permissionsOf(value) as Json | null,
};

registerCleaners("agent_config", AGENT_CLEANERS);
// A team takes the same fields as an agent, but for its framework, tools and role of its own.
registerCleaners("team", {
  compatible_models: AGENT_CLEANERS.compatible_models,
  model_routing: AGENT_CLEANERS.model_routing,
  approval_mode: AGENT_CLEANERS.approval_mode,
  reviewer_model: AGENT_CLEANERS.reviewer_model,
  sandbox: AGENT_CLEANERS.sandbox,
  framework: AGENT_CLEANERS.framework,
});

/**
 * Why a patch cannot be written on this node, beyond what the cleaners check: a role is only for an agent inside a team, and
 * Approvals' reviewer model only with the reviewer mode. Null when it can.
 */
export function agentFieldsRefusal(node: { type: string; parent_id: string | null; payload?: unknown }, patch: Record<string, unknown>): string | null {
  if ("role" in patch && text(patch.role, ROLE_MAX) && (node.type !== "agent_config" || node.parent_id === null)) return ROLE_COPY.lone;
  return null;
}

/** The patch Approvals writes: the mode, and the reviewer model only with `reviewer` (any other mode takes it off). */
export function approvalsPatch(mode: ApprovalMode | null, reviewerModel?: string | null): Record<string, unknown> {
  return { approval_mode: mode, reviewer_model: mode === "reviewer" ? (reviewerModel ?? null) : null };
}
