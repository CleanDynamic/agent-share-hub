// What a tool lets a maker pick, as pure rules (CA-02 P3). No React here: the composer's menus read these.
//
// A TOOL CARRIES ITS MODELS (`tools/registry.ts`). The model menu follows the tool: a fixed list grouped by lab, any
// model (suggested first), a tool's own tiers, a note for a tool that hides its model, or nothing for a tool that runs
// none. A typed tool we do not know cannot be checked, so it offers every current text model and takes a typed one.
//
// NOTHING SAVED IS EVER REWRITTEN. `pairCheck` only says whether a saved pair keeps the rules; an unknown tool or
// model is "unknown" and never an error.

import { MODEL_VERSIONS, normaliseModel, offeredTextModels, type Lab, type ModelVersion } from "@/lib/models/registry";

import { TOOLS, toolFor, type StepKey, type Tool } from "./registry";

/** The heading of the first group of an "any" menu. */
export const SUGGESTED = "Suggested";

export interface ModelGroup {
  lab: Lab | typeof SUGGESTED;
  models: ModelVersion[];
}

export type ModelMenu =
  | { state: "pick-tool" }
  | { state: "options"; groups: ModelGroup[]; other: boolean }
  | { state: "tiers"; tiers: string[] }
  | { state: "hidden"; note: string }
  | { state: "none" };

export type PairCheck = "ok" | "not-offered" | "tool-runs-no-model" | "tool-hides-model" | "unknown";

/** The roles an agent's later models can take when its harness names none. The first model is always "main". */
export const DEFAULT_ROLES: readonly string[] = ["main", "plans", "acts", "reviews", "other"];

const BY_ID: ReadonlyMap<string, ModelVersion> = new Map(MODEL_VERSIONS.map((version) => [version.id, version]));

const versionsOf = (ids: readonly string[]): ModelVersion[] =>
  ids.map((id) => BY_ID.get(id)).filter((version): version is ModelVersion => version !== undefined);

/** Models grouped by lab, the labs in the order they first appear and each lab's models in the order given. */
function byLab(models: readonly ModelVersion[]): ModelGroup[] {
  const groups: ModelGroup[] = [];
  for (const version of models) {
    const group = groups.find((candidate) => candidate.lab === version.lab);
    if (group) group.models.push(version);
    else groups.push({ lab: version.lab, models: [version] });
  }
  return groups;
}

/** Every current text model, by lab, leaving out the ones already shown. */
const everyTextModel = (shown: ReadonlySet<string> = new Set()): ModelGroup[] =>
  byLab(offeredTextModels().filter((version) => !shown.has(version.id)));

const toolOf = (toolRaw: string | null | undefined): Tool | null => toolFor(toolRaw);

const typed = (raw: string | null | undefined): string => (typeof raw === "string" ? raw.trim() : "");

/** What the model menu offers for this tool. */
export function modelMenu(toolRaw: string | null | undefined): ModelMenu {
  if (!typed(toolRaw)) return { state: "pick-tool" };
  const tool = toolOf(toolRaw);
  if (!tool) return { state: "options", groups: everyTextModel(), other: true };
  const { models } = tool;
  switch (models.mode) {
    case "fixed":
      return { state: "options", groups: byLab(versionsOf(models.ids)), other: models.other };
    case "any": {
      const suggested = versionsOf(models.suggested);
      const head: ModelGroup[] = suggested.length ? [{ lab: SUGGESTED, models: suggested }] : [];
      return { state: "options", groups: [...head, ...everyTextModel(new Set(suggested.map((version) => version.id)))], other: true };
    }
    case "tiers":
      return { state: "tiers", tiers: [...models.tiers] };
    case "hidden":
      return { state: "hidden", note: models.note };
    case "none":
      return { state: "none" };
  }
}

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/** A tier of any tool ("v0 Max", "Standard"), which is not a model. */
const isTierName = (raw: string): boolean =>
  TOOLS.some((tool) => tool.models.mode === "tiers" && tool.models.tiers.some((tier) => same(tier, raw)));

/**
 * Whether a saved tool and model keep the rules. No model is "ok". A model saved as the tool's own name for a tool
 * that hides its model ("Manus" on Manus), or as one of a tool's tiers, is "ok": that is what the composer saves.
 */
export function pairCheck(toolRaw: string | null | undefined, modelRaw: string | null | undefined): PairCheck {
  const model = typed(modelRaw);
  if (!model) return "ok";
  const tool = toolOf(toolRaw);
  if (!tool) return "unknown";
  const version = normaliseModel(model);
  const { models } = tool;
  switch (models.mode) {
    case "none":
      return "tool-runs-no-model";
    case "hidden":
      return toolFor(model)?.id === tool.id ? "ok" : "tool-hides-model";
    case "tiers":
      if (models.tiers.some((tier) => same(tier, model))) return "ok";
      return version ? "not-offered" : "unknown";
    case "any":
      return version ? "ok" : "unknown";
    case "fixed":
      if (!version) return "unknown";
      return models.ids.includes(version.id) || models.other ? "ok" : "not-offered";
  }
}

/** Whether a tool can be named on this Add item. A typed tool we do not know fits every step; a retired one fits none. */
export function fitsStep(toolRaw: string | null | undefined, step: StepKey): boolean {
  if (!typed(toolRaw)) return true;
  const tool = toolOf(toolRaw);
  return tool ? tool.steps.includes(step) : true;
}

/**
 * The model to keep once the tool changes. A model the new tool does not offer, does not run or does not show is
 * cleared, and so is a stand-in that only meant something to the old tool (a tier, or a tool's own name). No tool
 * leaves no model, quietly: the menu has nothing to offer.
 */
export function nextModelAfterToolChange(toolRaw: string | null | undefined, currentModel: string | null | undefined): { model: string | null; cleared: boolean } {
  const model = typed(currentModel);
  if (!model) return { model: null, cleared: false };
  if (!typed(toolRaw)) return { model: null, cleared: false };
  const check = pairCheck(toolRaw, model);
  if (check === "not-offered" || check === "tool-runs-no-model" || check === "tool-hides-model") return { model: null, cleared: true };
  if (check === "ok") return { model, cleared: false };
  // "unknown": a typed model stays, but a tier or a tool's name carried over from the old tool does not.
  const standIn = !normaliseModel(model) && (isTierName(model) || toolFor(model) !== null);
  return standIn ? { model: null, cleared: true } : { model, cleared: false };
}

/** The roles an agent's models can take in this harness: its own when it names them, else DEFAULT_ROLES. */
export function modelRoles(toolRaw: string | null | undefined): string[] {
  const roles = toolOf(toolRaw)?.roles;
  return roles && roles.length ? [...roles] : [...DEFAULT_ROLES];
}

/** What a model menu saves for a tool that hides its model: the tool's own name ("Manus"). */
export function hiddenModelName(toolRaw: string | null | undefined): string | null {
  const tool = toolOf(toolRaw);
  return tool && tool.models.mode === "hidden" ? tool.name : null;
}

/**
 * The harness of an agent that runs in its maker's own code, as the menus read it: a name no tool has, so it offers
 * every current text model and takes a typed one (CA-02 P5, "My own code (API)", saved as no harness).
 */
export const OWN_CODE = "My own code (API)";

/** The tool an agent's model menu reads: its harness, or OWN_CODE when it has none. */
export const harnessTool = (harness: string | null | undefined): string => (typed(harness) ? (harness as string) : OWN_CODE);

/**
 * The model a new agent starts on in this harness: the harness's own name when it hides its model, `preferred` when
 * the harness offers it, else the first model it lists; null when it names tiers or runs no model (one must be picked).
 */
export function startingModel(harness: string | null | undefined, preferred: string): string | null {
  const tool = harnessTool(harness);
  const menu = modelMenu(tool);
  if (menu.state === "hidden") return hiddenModelName(tool);
  if (menu.state !== "options") return null;
  if (pairCheck(tool, preferred) === "ok" || pairCheck(tool, preferred) === "unknown") return preferred;
  return menu.groups[0]?.models[0]?.name ?? null;
}
