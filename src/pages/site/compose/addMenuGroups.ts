/* UX-02 P6: the Add step tile menu, laid out. PURE.

   F40: the first screen is five entries, Prompt, Agent, Tool, File and Dataset (`primary`). Every other type sits under a "More
   types" row (the caller opens it in place, and a search shows it all). Those are grouped by the category of the node type each
   creates, read from the live registry (`getNodeTypes`) and, while it is loading or if it fails, from the fallback table below, so
   the menu never waits. Group heads are the category names with a capital first letter. A group left with one entry has no head:
   its entry is listed after the headed groups, with Decision (F40: no group holds both Check and Approval, Check being Evidence and
   Approval Narrative, so Decision is listed ungrouped). Entries whose node type is not live are left out, and a group with none is
   not drawn; Check stays while it cannot be added (disabled, with its reason). Deployment is its own group; From Library, which is
   not a node type, is last. */

/** What the layout needs of an Add entry. */
export interface LayoutEntry {
  key: string;
  name: string;
  line: string;
  enabled: boolean;
  /** Whether its node type is live. An entry that is not is left out. */
  live: boolean;
  /** The node type it creates; null for From Library. */
  type: string | null;
  group?: string;
}

/**
 * The category of each node type an Add entry creates, from the seed migration (20260823130000_node_type_registry_seed.sql, where
 * `decision` is `narrative`; CA-13's `configuration` insert is ON CONFLICT DO NOTHING) and 20261001300000 for `team` and `manual_step`.
 */
export const ADD_CATEGORY_FALLBACK: Readonly<Record<string, string>> = {
  agent_config: "configuration",
  team: "configuration",
  integration: "configuration",
  dataset: "data",
  retrieval_config: "data",
  document: "artefact",
  code: "artefact",
  repo: "artefact",
  result: "evidence",
  eval_run: "evidence",
  decision: "narrative",
  manual_step: "narrative",
  system_prompt: "instruction",
  prompt: "instruction",
};

/** F40: the first screen, in this order. */
export const PRIMARY_KEYS = ["prompt", "agent", "tool", "file", "dataset"] as const;
/** F40: listed with the ungrouped entries whatever their category: no group holds both Check and Approval. */
const UNGROUPED_KEYS = ["decision"] as const;

/** The groups in order, and the entries in each in order: the prompt's table. */
const CATEGORY_ORDER = ["configuration", "data", "artefact", "evidence", "narrative", "instruction"] as const;
const ENTRY_ORDER = ["agent", "tool", "dataset", "retrieval", "file", "code", "repo", "result", "check", "decision", "manual", "approval", "system_prompt"];

/** "artefact" → "Artefact". */
export const groupHead = (category: string): string => category.charAt(0).toUpperCase() + category.slice(1);

export interface AddMenuLayout<T extends LayoutEntry> {
  /** F40: the first screen: Prompt, Agent, Tool, File, Dataset, those that are live. */
  primary: T[];
  /** F40: under "More types": the headed groups. */
  groups: { head: string; category: string; entries: T[] }[];
  /** Entries of groups of one, and Decision: no head, after the headed groups. */
  loose: T[];
  deployment: T[];
  library: T | null;
}

const rank = (list: readonly string[], value: string) => {
  const at = list.indexOf(value);
  return at < 0 ? list.length : at;
};

export function addMenuLayout<T extends LayoutEntry>(entries: readonly T[], live: Readonly<Record<string, string>> | undefined): AddMenuLayout<T> {
  const shown = entries.filter((entry) => entry.live);
  const primary = PRIMARY_KEYS.flatMap((key) => shown.filter((entry) => entry.key === key));
  const library = shown.find((entry) => entry.key === "library") ?? null;
  const deployment = shown.filter((entry) => entry.key.startsWith("deploy:"));
  const ungrouped = shown.filter((entry) => (UNGROUPED_KEYS as readonly string[]).includes(entry.key));
  const rest = shown.filter((entry) => !primary.includes(entry) && !ungrouped.includes(entry) && entry !== library && !entry.key.startsWith("deploy:"));
  const categoryOf = (entry: T) => (entry.type ? (live?.[entry.type] ?? ADD_CATEGORY_FALLBACK[entry.type] ?? "other") : "other");
  const byCategory = new Map<string, T[]>();
  for (const entry of rest) byCategory.set(categoryOf(entry), [...(byCategory.get(categoryOf(entry)) ?? []), entry]);
  const order = [...byCategory.keys()].sort((a, b) => rank(CATEGORY_ORDER, a) - rank(CATEGORY_ORDER, b) || a.localeCompare(b));
  const groups: AddMenuLayout<T>["groups"] = [];
  const loose: T[] = [...ungrouped];
  for (const category of order) {
    const list = [...(byCategory.get(category) ?? [])].sort((a, b) => rank(ENTRY_ORDER, a.key) - rank(ENTRY_ORDER, b.key));
    if (list.length === 1) loose.push(list[0]);
    else groups.push({ head: groupHead(category), category, entries: list });
  }
  loose.sort((a, b) => rank(ENTRY_ORDER, a.key) - rank(ENTRY_ORDER, b.key));
  return { primary, groups, loose, deployment, library };
}
