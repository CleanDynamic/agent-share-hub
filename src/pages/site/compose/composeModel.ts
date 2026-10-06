/* UI-P47 — the composer's rules, as pure functions.

   What a publish still needs (in plain words and the canvas's order), where a
   new node goes, which node is the cover's, how "Who it's for" is parsed. No
   React and no data access: `ComposeView` renders what these return, the
   container writes what they decide, and the tests read them directly. */

import {
  MINIMUM_PUBLISHABLE_KEYS,
  computeCompleteness,
  type Build,
  type Completeness,
  type MissingItem,
  type NodeTree,
  type NodeType,
  type RequirementKey,
} from "@/lib/build";
import { EVIDENCE_NODE_TYPES, nodeMediaId } from "@/lib/build/cover";

export const UNTITLED = "Untitled build";

/** "Description" counts out of this many characters. `builds.outcome` has no limit of its own. */
export const OUTCOME_MAX = 200;

/** "Who it's for" keeps this many entries. */
export const AUDIENCE_MAX = 4;

/** The three things a publish needs, plus the title, in the canvas's order, in plain words. */
export type PublishKey = "evidence" | "title" | "outcome" | "instruction_or_artefact";

const PUBLISH_ORDER: readonly PublishKey[] = ["evidence", "title", "outcome", "instruction_or_artefact"];

const PUBLISH_WORDS: Record<PublishKey, string> = {
  evidence: "a cover picture or video",
  title: "a title",
  outcome: "a description",
  instruction_or_artefact: "a prompt",
};

export const isUntitled = (title: string | null | undefined): boolean => {
  const clean = (title ?? "").trim();
  return clean === "" || clean === UNTITLED;
};

/**
 * What the draft still needs before it can be published: the minimum publishable
 * keys `computeCompleteness` reports missing, plus the title when it is empty or
 * "Untitled build". Returns the keys in the canvas's order.
 */
export function missingKeys(
  build: Pick<Build, "title" | "shape" | "outcome" | "made_for" | "made_with" | "cost_setup" | "cost_monthly" | "time_to_first_result" | "live_url" | "repo_url">,
  tree: NodeTree[],
  nodeTypes: NodeType[],
  completeness: Completeness = computeCompleteness(build, tree, nodeTypes),
): PublishKey[] {
  const minimum = new Set<RequirementKey>(MINIMUM_PUBLISHABLE_KEYS);
  const missing = new Set<string>(completeness.missing.filter((item) => minimum.has(item.key)).map((item) => item.key));
  if (isUntitled(build.title)) missing.add("title");
  return PUBLISH_ORDER.filter((key) => missing.has(key));
}

/** The words for a list of missing keys, in the order given. */
export function missingWords(keys: readonly PublishKey[]): string[] {
  return keys.map((key) => PUBLISH_WORDS[key]);
}

/** "a cover picture or video, a title, a description, a prompt" */
export function joinWords(words: readonly string[]): string {
  return words.join(", ");
}

/** The toast a click on a not-yet-ready Publish shows. */
export function publishBlockedLine(keys: readonly PublishKey[]): string {
  return `To publish, add ${joinWords(missingWords(keys))}.`;
}

const GALLERY_WORDS: Partial<Record<RequirementKey, string>> = {
  outcome: "a description",
  instruction_or_artefact: "a prompt",
  evidence: "a cover picture or video",
  made_for: "an audience",
  made_with: "the models and tools it was made with",
  cost: "a running cost",
  time_to_first_result: "a time to first result",
  prerequisite: "a prerequisite",
  link: "a link",
  comparison: "a comparison",
  dataset: "a dataset",
};

/** What would put a published build in the Gallery, as noun phrases ("an audience and a link"). */
export function galleryWords(items: readonly MissingItem[]): string {
  const words = items.map((item) => GALLERY_WORDS[item.key] ?? item.copy);
  if (words.length <= 1) return words[0] ?? "more detail";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** "photographers, families" → ["photographers", "families"]: trimmed, deduplicated (case-blind), the first four. */
export function parseAudience(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(",")) {
    const entry = part.trim();
    if (!entry || seen.has(entry.toLowerCase())) continue;
    seen.add(entry.toLowerCase());
    out.push(entry);
    if (out.length === AUDIENCE_MAX) break;
  }
  return out;
}

/** Where a node the composer writes goes: top level, after everything already there. */
export function nextTopPosition(tree: readonly Pick<NodeTree, "parent_id" | "position">[]): number {
  let highest = -1;
  for (const node of tree) {
    if (node.parent_id === null && typeof node.position === "number" && node.position > highest) highest = node.position;
  }
  return highest + 1;
}

/** The node type a cover of this kind is written as. */
export const coverNodeType = (kind: "image" | "video"): "screenshot" | "recording" =>
  kind === "video" ? "recording" : "screenshot";

function flatten(tree: readonly NodeTree[]): NodeTree[] {
  return tree.flatMap((node) => [node, ...flatten(node.children ?? [])]);
}

/** The cover's node: the evidence node whose payload names the post's first picture. */
export function coverNodeFor(tree: readonly NodeTree[], firstMediaId: string | null): NodeTree | null {
  if (!firstMediaId) return null;
  return flatten(tree).find((node) => EVIDENCE_NODE_TYPES.has(node.type) && nodeMediaId(node) === firstMediaId) ?? null;
}

export type SaveState = "idle" | "saving" | "saved" | "failed";

/** The status line's save words. "failed" is completed by a "Try again" button in the view. */
export function saveWords(state: SaveState, justNow: boolean): string {
  switch (state) {
    case "saving":
      return "saving…";
    case "failed":
      return "not saved — ";
    case "saved":
      return justNow ? "saved just now" : "saved";
    default:
      return "";
  }
}
