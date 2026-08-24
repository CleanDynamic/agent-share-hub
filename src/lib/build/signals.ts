// Trust signals: what other people have done with a build, and what the record
// itself is still missing.
//
// Three separate things live here because they answer the same reader's
// question — can I follow this? — from three directions:
//
//   reproductions  someone who is not the creator ran it and said what happened
//   freshness      how long ago that last happened, and on what
//   completeness   whether enough of the record is written down to follow at all
//
// COMPLETENESS IS SHAPE-RELATIVE. A prompt that lands its outcome, the prompt
// itself and one result is a finished record. An app with those three and
// nothing else is missing the link, the cost and the prerequisites. So the
// rule table below is data, one entry per shape, and every shape's rule set
// clears MINIMUM_PUBLISHABLE_SCORE on the same three items: an outcome line,
// one instruction or artefact node, one evidence node.
//
// WHAT THIS FILE WILL NOT DO. It reports a number and a list of instructions.
// It does not judge the build, and it does not judge the person: `missing`
// reads "add what it costs to run", never "no cost information". The number is
// how much of the shape's record is filled in, nothing more.

import { supabase } from "@/integrations/supabase/client";
import {
  buildLayerError,
  type Build,
  type BuildReproduction,
  type BuildShape,
  type NodeCategory,
  type NodeTree,
  type NodeType,
} from "./types";

export const REPRODUCTION_COLUMNS =
  "id, build_id, user_id, confirmed_at, model_used, worked, note";

const REPRODUCTIONS_DEFAULT_LIMIT = 20;
const REPRODUCTIONS_MAX_LIMIT = 200;

/** Past this, a confirmation is old enough that a reader should be told. */
export const STALE_AFTER_DAYS = 120;

const MS_PER_DAY = 86_400_000;

// =============================================================================
// Reproductions
// =============================================================================

export interface RecordReproductionInput {
  buildId: string;
  /** Defaults to true. false records that it did not work for them. */
  worked?: boolean;
  /** The model they actually ran it on. Omit it rather than guess it. */
  modelUsed?: string | null;
  note?: string | null;
}

/**
 * Record that the signed-in person ran this build, or update what they said
 * last time.
 *
 * One row per person per build, so re-running a build later moves that row
 * forward instead of counting twice — confirmed_at is set explicitly for that
 * reason, since the column default only applies on insert.
 *
 * The database rejects a creator recording a reproduction of their own build.
 * That rejection arrives as a row level security error, not a validation
 * message: the exclusion is the point of the signal, so it is enforced where
 * it cannot be skipped rather than in a form.
 */
export async function recordReproduction(
  input: RecordReproductionInput
): Promise<BuildReproduction> {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  if (sessionError) {
    throw buildLayerError("recordReproduction (session)", sessionError);
  }

  const userId = sessionData.session?.user?.id;
  if (!userId) {
    throw buildLayerError("recordReproduction", new Error("no signed-in user"));
  }

  const modelUsed = trimToNull(input.modelUsed);
  const note = trimToNull(input.note);

  const { data, error } = await supabase
    .from("build_reproductions")
    .upsert(
      {
        build_id: input.buildId,
        user_id: userId,
        confirmed_at: new Date().toISOString(),
        worked: input.worked ?? true,
        model_used: modelUsed,
        note,
      },
      { onConflict: "build_id,user_id" }
    )
    .select(REPRODUCTION_COLUMNS)
    .single();

  if (error) throw buildLayerError("recordReproduction", error);
  return data as BuildReproduction;
}

/**
 * The reproductions of one build, most recent first.
 *
 * Both outcomes come back. A build that four people got working and two did
 * not is a more useful page than one that only shows the four, and the header
 * counter already tells the working story on its own.
 */
export async function getReproductions(
  buildId: string,
  limit: number = REPRODUCTIONS_DEFAULT_LIMIT
): Promise<BuildReproduction[]> {
  const capped = Math.max(
    1,
    Math.min(Math.floor(limit) || REPRODUCTIONS_DEFAULT_LIMIT, REPRODUCTIONS_MAX_LIMIT)
  );

  const { data, error } = await supabase
    .from("build_reproductions")
    .select(REPRODUCTION_COLUMNS)
    .eq("build_id", buildId)
    .order("confirmed_at", { ascending: false })
    .limit(capped);

  if (error) throw buildLayerError("getReproductions", error);
  return (data ?? []) as BuildReproduction[];
}

// =============================================================================
// Freshness
// =============================================================================

/** The columns freshnessLabel actually reads, so a caller can pass a stub. */
export type FreshnessSource = Pick<
  Build,
  "last_confirmed_at" | "last_confirmed_model"
>;

/** The columns isStale actually reads. */
export type StalenessSource = Pick<Build, "last_confirmed_at" | "published_at">;

/**
 * "last confirmed working 3 days ago, on Sonnet 4.5", or null.
 *
 * null when nobody has confirmed it — an unconfirmed build has no freshness to
 * report, and a caller that wants to say something about that should say it in
 * its own words rather than be handed a sentence here.
 *
 * The model half is dropped entirely when model_used was never given. A reader
 * takes "on X" as a fact someone stated; there is no honest way to fill it in.
 */
export function freshnessLabel(
  build: FreshnessSource,
  now: number = Date.now()
): string | null {
  const days = daysSince(build.last_confirmed_at, now);
  if (days === null) return null;

  const when = relativeDays(days);
  const model = presentModelName(build.last_confirmed_model);
  return model
    ? `last confirmed working ${when}, on ${model}`
    : `last confirmed working ${when}`;
}

/**
 * True when the last confirmation is older than STALE_AFTER_DAYS, or when
 * there has never been one and the build was published that long ago.
 *
 * An unpublished build is never stale: nobody has been given the chance.
 */
export function isStale(
  build: StalenessSource,
  now: number = Date.now()
): boolean {
  const confirmed = daysSince(build.last_confirmed_at, now);
  if (confirmed !== null) return confirmed > STALE_AFTER_DAYS;

  const published = daysSince(build.published_at, now);
  if (published === null) return false;
  return published > STALE_AFTER_DAYS;
}

/** Whole days between an ISO timestamp and now. null if absent or unparseable. */
function daysSince(value: string | null, now: number): number | null {
  if (!value) return null;
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.floor((now - at) / MS_PER_DAY));
}

/** 0 -> "today", 1 -> "yesterday", 3 -> "3 days ago", 40 -> "5 weeks ago". */
function relativeDays(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return plural(Math.floor(days / 7), "week");
  if (days < 365) return plural(Math.floor(days / 30), "month");
  return plural(Math.floor(days / 365), "year");
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
}

/**
 * "claude-sonnet-4-5" -> "Sonnet 4.5". Anything else is returned as given.
 *
 * This tidies an identifier a person already supplied. It never derives a
 * model from a build's other fields — an unstated model stays unstated.
 */
function presentModelName(raw: string | null): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  const match = /^claude-(opus|sonnet|haiku)-(\d+)-(\d+)(?:-\d{8})?$/i.exec(value);
  if (!match) return value;

  const family = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
  return `${family} ${match[2]}.${match[3]}`;
}

// =============================================================================
// Completeness
// =============================================================================

export type RequirementKey =
  | "outcome"
  | "instruction_or_artefact"
  | "evidence"
  | "made_for"
  | "made_with"
  | "cost"
  | "time_to_first_result"
  | "prerequisite"
  | "link"
  | "comparison"
  | "dataset";

/** One thing the record does not have yet, and what to do about it. */
export interface MissingItem {
  key: RequirementKey;
  /** An instruction to the creator. Always an action, never a verdict. */
  copy: string;
}

export interface Completeness {
  /** 0-100: how much of this shape's record is filled in. */
  score: number;
  /** In rule order, so the first item is the one worth doing first. */
  missing: MissingItem[];
}

/** The columns computeCompleteness reads, so a caller can pass a stub. */
export type CompletenessSource = Pick<
  Build,
  | "shape"
  | "outcome"
  | "made_for"
  | "made_with"
  | "cost_setup"
  | "cost_monthly"
  | "time_to_first_result"
  | "live_url"
  | "repo_url"
>;

/**
 * The three items the minimum publishable record is made of. Every shape's
 * rules weight these so that having them, and nothing else, clears
 * MINIMUM_PUBLISHABLE_SCORE.
 */
const CORE_WEIGHT = 20;

/** A header field that makes a record followable rather than merely readable. */
const CONTEXT_WEIGHT = 6;

/** The one node or link a particular shape is not itself without. */
const ANCHOR_WEIGHT = 10;

/** Three core items out of any shape's rules land at or above this. */
export const MINIMUM_PUBLISHABLE_SCORE = 60;

export interface ShapeRequirement {
  key: RequirementKey;
  weight: number;
}

/** What each shape asks for. Shared by every shape, in this order, first. */
const CORE: ShapeRequirement[] = [
  { key: "outcome", weight: CORE_WEIGHT },
  { key: "instruction_or_artefact", weight: CORE_WEIGHT },
  { key: "evidence", weight: CORE_WEIGHT },
];

const AUDIENCE: ShapeRequirement[] = [
  { key: "made_for", weight: CONTEXT_WEIGHT },
  { key: "made_with", weight: CONTEXT_WEIGHT },
];

const RUNNING_COST: ShapeRequirement[] = [
  { key: "cost", weight: CONTEXT_WEIGHT },
  { key: "time_to_first_result", weight: CONTEXT_WEIGHT },
];

/**
 * The rule table. One entry per shape, each a list of weighted requirements.
 *
 * The three shapes that ship something runnable ask for nine things, weighted
 * to total 100. A prompt asks for five, weighted to total 72. That is what
 * "shape-relative" means in practice: the same three core items earn 60 of an
 * app's 100 and 60 of a prompt's 72, and both records are publishable.
 */
export const SHAPE_RULES: Record<BuildShape, ShapeRequirement[]> = {
  app: [
    ...CORE,
    ...AUDIENCE,
    ...RUNNING_COST,
    { key: "prerequisite", weight: CONTEXT_WEIGHT },
    { key: "link", weight: ANCHOR_WEIGHT },
  ],
  agent: [
    ...CORE,
    ...AUDIENCE,
    ...RUNNING_COST,
    { key: "prerequisite", weight: CONTEXT_WEIGHT },
    { key: "link", weight: ANCHOR_WEIGHT },
  ],
  workflow: [
    ...CORE,
    ...AUDIENCE,
    ...RUNNING_COST,
    { key: "prerequisite", weight: CONTEXT_WEIGHT },
    { key: "link", weight: ANCHOR_WEIGHT },
  ],
  // A prompt is the artefact. There is nothing to deploy, nothing to stand up
  // first, and no monthly bill.
  prompt: [...CORE, ...AUDIENCE],
  // The dataset node is the thing itself; without it the record describes
  // something the reader cannot get hold of.
  dataset: [...CORE, ...AUDIENCE, { key: "dataset", weight: ANCHOR_WEIGHT }],
  // A study is its comparison. The finding without the run behind it is a
  // claim.
  study: [...CORE, ...AUDIENCE, { key: "comparison", weight: ANCHOR_WEIGHT }],
  media: [...CORE, ...AUDIENCE, { key: "cost", weight: CONTEXT_WEIGHT }],
  technique: [...CORE, ...AUDIENCE, { key: "prerequisite", weight: CONTEXT_WEIGHT }],
  other: [...CORE, ...AUDIENCE],
};

interface NodePresence {
  types: Set<string>;
  categories: Set<NodeCategory>;
}

interface Requirement {
  copy: string;
  met: (build: CompletenessSource, present: NodePresence) => boolean;
}

/**
 * Every requirement, with the sentence shown when it is not met yet.
 *
 * The copy is an instruction addressed to the creator. Read them as a list and
 * they should sound like a colleague pointing at the next thing to do.
 */
const REQUIREMENTS: Record<RequirementKey, Requirement> = {
  outcome: {
    copy: "add the one line that says what this does for someone",
    met: (build) => hasText(build.outcome),
  },
  instruction_or_artefact: {
    copy: "add the prompt, configuration or artefact someone would run",
    met: (_build, present) =>
      present.categories.has("instruction") || present.categories.has("artefact"),
  },
  evidence: {
    copy: "add one piece of evidence — a result, a screenshot or an eval run",
    met: (_build, present) => present.categories.has("evidence"),
  },
  made_for: {
    copy: "say who this is for",
    met: (build) => hasEntries(build.made_for),
  },
  made_with: {
    copy: "list the models and tools this was made with",
    met: (build) => hasEntries(build.made_with),
  },
  cost: {
    copy: "add what it costs to run",
    met: (build) => isNumber(build.cost_setup) || isNumber(build.cost_monthly),
  },
  time_to_first_result: {
    copy: "add how long it takes to get a first result",
    met: (build) => isNumber(build.time_to_first_result),
  },
  prerequisite: {
    copy: "add what someone needs in place before they start",
    met: (_build, present) => present.types.has("prerequisite"),
  },
  link: {
    copy: "add a link to the live thing, or to the repository",
    met: (build) => hasText(build.live_url) || hasText(build.repo_url),
  },
  comparison: {
    copy: "add the comparison table or eval run the finding rests on",
    met: (_build, present) =>
      present.types.has("comparison_table") || present.types.has("eval_run"),
  },
  dataset: {
    copy: "add the dataset itself, not only a description of it",
    met: (_build, present) => present.types.has("dataset"),
  },
};

/**
 * How much of this shape's record is filled in, and what to do next.
 *
 * `tree` is the PLACED tree, as getNodeTree returns it. Tray nodes never count
 * — unplaced material is not part of the record — and nodes flagged is_gap do
 * not count either, since a gap is an admitted hole rather than a filled one.
 *
 * `nodeTypes` is the registry, as getNodeTypes returns it. It is what maps a
 * node's type to its category; a node whose type is not in the registry passed
 * in cannot be classified and is skipped.
 */
export function computeCompleteness(
  build: CompletenessSource,
  tree: NodeTree[],
  nodeTypes: NodeType[]
): Completeness {
  const rules = SHAPE_RULES[build.shape as BuildShape] ?? SHAPE_RULES.other;
  const present = collectPresence(tree, nodeTypes);

  let total = 0;
  let earned = 0;
  const missing: MissingItem[] = [];

  for (const rule of rules) {
    const requirement = REQUIREMENTS[rule.key];
    total += rule.weight;
    if (requirement.met(build, present)) {
      earned += rule.weight;
    } else {
      missing.push({ key: rule.key, copy: requirement.copy });
    }
  }

  const score = total === 0 ? 100 : Math.round((earned / total) * 100);
  return { score, missing };
}

/** Which node types and categories the placed tree actually contains. */
function collectPresence(
  tree: NodeTree[],
  nodeTypes: NodeType[]
): NodePresence {
  const categoryOf = new Map<string, NodeCategory>(
    nodeTypes.map((type) => [type.key, type.category as NodeCategory])
  );
  const types = new Set<string>();
  const categories = new Set<NodeCategory>();

  const walk = (nodes: NodeTree[]): void => {
    for (const node of nodes) {
      // A gap is the creator saying "this part is missing". Counting it would
      // read that admission as the thing it admits to lacking.
      if (!node.is_gap) {
        types.add(node.type);
        const category = categoryOf.get(node.type);
        if (category) categories.add(category);
      }
      walk(node.children ?? []);
    }
  };

  walk(tree);
  return { types, categories };
}

// =============================================================================
// Shared predicates
// =============================================================================

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasEntries(value: string[] | null | undefined): boolean {
  return Array.isArray(value) && value.some((entry) => hasText(entry));
}

/** 0 is a stated cost, not an absent one, so truthiness is the wrong test. */
function isNumber(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}
