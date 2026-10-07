/* UI-P49 — the Gallery feed's sample: the ten builds from Miles's canvas
   "Gallery discovery concept", artboard A, as `listGalleryFeed` returns them.

   DEV ONLY (imported from `src/pages/dev/**` alone). There is no board for the
   feed; these rows are what /dev/kit/pages/gallery-feed draws, in both themes,
   and the demo filters, sorts and splits them in memory the way the data layer
   does, so the page can be checked with "Any model" and with one chosen. */

import type { GalleryFeed, GalleryFeedCounts, GalleryFeedRow, GalleryFeedSort } from "@/lib/build/gallery";
import type { ModelProof } from "@/lib/build/signals";
import { MODEL_VERSIONS, type ModelVersion } from "@/lib/models/registry";

import { FIXTURE_NOW } from "../designFixtures";

export const FEED_FIXTURE_NOW = FIXTURE_NOW.getTime();

const daysAgo = (days: number): string => new Date(FEED_FIXTURE_NOW - days * 86_400_000).toISOString();

const version = (id: string): ModelVersion => {
  const found = MODEL_VERSIONS.find((entry) => entry.id === id);
  if (!found) throw new Error(`gallery-feed fixture: no model ${id}`);
  return found;
};

/** One model's figures: worked count, and the newest confirmation that many days ago. */
const proof = (id: string, worked: number, lastDays: number): ModelProof => ({
  modelId: id,
  modelName: version(id).name,
  worked,
  lastConfirmedAt: worked > 0 ? daysAgo(lastDays) : null,
});

interface Seed {
  n: number;
  title: string;
  outcome: string;
  shape: string;
  handle: string;
  models: string[];
  madeFor: string[];
  proof: ModelProof[];
  rebuilds?: number;
  gapGbp?: number;
  published: number;
  nodes?: string[];
  rebuiltFrom?: { title: string; handle: string };
}

const SEEDS: Seed[] = [
  {
    n: 1,
    title: "Photo renamer by date taken",
    outcome: "Renames a folder of photos to the date each was taken, and files the ones with no date in their own folder.",
    shape: "app",
    handle: "maria",
    models: ["claude-sonnet-5-5", "claude-opus-5-5"],
    madeFor: ["Photographers"],
    proof: [proof("sonnet-5-5", 5, 3), proof("opus-5", 4, 12), proof("gpt-6-astra", 2, 30)],
    rebuilds: 3,
    gapGbp: 25,
    published: 40,
    nodes: ["prompt", "code"],
  },
  {
    n: 2,
    title: "CV tailored to a job ad",
    outcome: "Rewrites your CV against one job advert, keeping every claim true and saying which ones it moved up.",
    shape: "prompt",
    handle: "dana",
    models: ["gpt-6-astra"],
    madeFor: ["Job seekers"],
    proof: [proof("gpt-6-astra", 15, 1)],
    rebuilds: 6,
    published: 90,
    nodes: ["prompt"],
  },
  {
    n: 3,
    title: "Monthly budget from a bank export",
    outcome: "Turns a bank's CSV export into a month's budget by category, with the three biggest surprises named.",
    shape: "workflow",
    handle: "tom",
    models: ["gpt-5.6"],
    madeFor: ["Households"],
    proof: [proof("gpt-5-6", 3, 140)],
    published: 220,
    nodes: ["prompt", "data"],
  },
  {
    n: 4,
    title: "Receipt photos to an expenses sheet",
    outcome: "Reads a stack of receipt photos into one expenses sheet with the VAT split out.",
    shape: "agent",
    handle: "sam",
    models: ["claude-sonnet-5-5"],
    madeFor: ["Freelancers"],
    proof: [],
    published: 2,
    nodes: ["prompt", "code"],
  },
  {
    n: 5,
    title: "Inbox triage for a small shop",
    outcome: "Sorts a shop's inbox into orders, returns and questions, and drafts a reply to each question.",
    shape: "agent",
    handle: "priya",
    models: ["claude-sonnet-5-5"],
    madeFor: ["Shop owners"],
    proof: [proof("sonnet-5-5", 9, 2), proof("gemini-4-argon", 1, 20)],
    rebuilds: 2,
    published: 25,
    nodes: ["prompt", "tool"],
  },
  {
    n: 6,
    title: "Lesson plan from a curriculum objective",
    outcome: "Writes a one-hour lesson plan from a single curriculum objective, with a starter, two activities and an exit ticket.",
    shape: "prompt",
    handle: "owen",
    models: ["gemini-4-argon"],
    madeFor: ["Teachers"],
    proof: [proof("gemini-4-argon", 7, 6), proof("sonnet-5-5", 2, 9)],
    published: 60,
    nodes: ["prompt"],
  },
  {
    n: 7,
    title: "Meeting notes to actions",
    outcome: "Pulls every action, owner and date out of a meeting transcript and posts them as a checklist.",
    shape: "workflow",
    handle: "lena",
    models: ["claude-opus-5-5"],
    madeFor: ["Managers"],
    proof: [proof("opus-5-5", 4, 4)],
    rebuilds: 1,
    published: 14,
    nodes: ["prompt", "tool"],
    rebuiltFrom: { title: "Standup summariser", handle: "kofi" },
  },
  {
    n: 8,
    title: "Recipe scaler with shopping list",
    outcome: "Scales a recipe to any number of people and turns it into a shopping list grouped by aisle.",
    shape: "app",
    handle: "jo",
    models: ["gpt-6-1-sol"],
    madeFor: ["Home cooks"],
    proof: [proof("gpt-6-1-sol", 2, 8)],
    published: 7,
    nodes: ["code"],
  },
  {
    n: 9,
    title: "Tenancy agreement checker",
    outcome: "Reads a tenancy agreement and lists the clauses worth asking about, each with the plain-English question to ask.",
    shape: "study",
    handle: "ade",
    models: ["claude-sonnet-5-5", "deepseek-v4-pro"],
    madeFor: ["Tenants"],
    proof: [proof("sonnet-5-5", 3, 15), proof("deepseek-v4-pro", 1, 50)],
    gapGbp: 60,
    published: 70,
    nodes: ["prompt", "data"],
  },
  {
    n: 10,
    title: "Podcast episode to show notes",
    outcome: "Turns an episode's audio into show notes with chapters, links mentioned and a two-line summary.",
    shape: "workflow",
    handle: "rui",
    models: ["grok-4.7"],
    madeFor: ["Podcasters"],
    proof: [proof("grok-4-7", 1, 125)],
    published: 180,
    nodes: ["prompt", "tool"],
  },
];

function row(seed: Seed): GalleryFeedRow {
  const id = `feed-fixture-${String(seed.n).padStart(2, "0")}`;
  const worked = seed.proof.reduce((sum, entry) => sum + entry.worked, 0);
  const newest = [...seed.proof]
    .filter((entry) => entry.lastConfirmedAt)
    .sort((a, b) => Date.parse(b.lastConfirmedAt!) - Date.parse(a.lastConfirmedAt!))[0];
  return {
    id,
    creator_id: `creator-${seed.handle}`,
    slug: seed.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    title: seed.title,
    outcome: seed.outcome,
    shape: seed.shape,
    status: "gallery",
    made_for: seed.madeFor,
    made_with: [],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: null,
    completeness: 95,
    reproduction_count: worked,
    last_confirmed_at: newest?.lastConfirmedAt ?? null,
    last_confirmed_model: newest?.modelName ?? null,
    published_at: daysAgo(seed.published),
    parent_build_id: seed.rebuiltFrom ? "feed-fixture-source" : null,
    rebuild_count: seed.rebuilds ?? 0,
    rebuild_note: null,
    source_title_at_fork: seed.rebuiltFrom?.title ?? null,
    source_handle_at_fork: seed.rebuiltFrom?.handle ?? null,
    nodes: (seed.nodes ?? []).map((type, i) => ({ id: `${id}-node-${i}`, type }) as GalleryFeedRow["nodes"][number]),
    media: [],
    bounties: seed.gapGbp ? [{ id: `${id}-ask`, reward_gbp: seed.gapGbp, status: "open" }] : [],
    models_used: seed.models,
    creatorHandle: seed.handle,
    proof: seed.proof,
  };
}

export const FEED_FIXTURE_ROWS: readonly GalleryFeedRow[] = SEEDS.map(row);

/** The Model menu's numbers over the ten. */
export const FEED_FIXTURE_COUNTS: GalleryFeedCounts = (() => {
  const byModel: Record<string, number> = {};
  for (const build of FEED_FIXTURE_ROWS) {
    for (const entry of build.proof) {
      if (entry.modelId && entry.worked > 0) byModel[entry.modelId] = (byModel[entry.modelId] ?? 0) + 1;
    }
  }
  return { all: FEED_FIXTURE_ROWS.length, byModel };
})();

/** The audiences, as getGalleryFacets().roles reads. */
export const FEED_FIXTURE_AUDIENCES = (() => {
  const counts = new Map<string, number>();
  for (const build of FEED_FIXTURE_ROWS) for (const value of build.made_for ?? []) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].map(([value, count]) => ({ value, label: value, count }));
})();

const time = (iso: string | null): number => (iso ? Date.parse(iso) : 0);

function bySort(sort: GalleryFeedSort, figure: (build: GalleryFeedRow) => { worked: number; last: string | null }) {
  return (a: GalleryFeedRow, b: GalleryFeedRow): number => {
    let primary = 0;
    if (sort === "reproduced") primary = figure(b).worked - figure(a).worked;
    else if (sort === "confirmed") primary = time(figure(b).last) - time(figure(a).last);
    else if (sort === "rebuilt") primary = (b.rebuild_count ?? 0) - (a.rebuild_count ?? 0);
    return primary || time(b.published_at) - time(a.published_at);
  };
}

export interface FeedFixtureFilters {
  model: string | null;
  audience: string | null;
  sort: GalleryFeedSort;
  q: string | null;
}

/** The fixture through the same rules as listGalleryFeed: one list, or the two with a model. */
export function feedFixture({ model, audience, sort, q }: FeedFixtureFilters): GalleryFeed {
  const text = (q ?? "").trim().toLowerCase().replace(/^@/, "");
  const matches = FEED_FIXTURE_ROWS.filter(
    (build) =>
      (!audience || (build.made_for ?? []).includes(audience)) &&
      (!text ||
        `${build.title} ${build.outcome} ${build.creatorHandle} ${build.models_used.join(" ")}`.toLowerCase().includes(text)),
  );
  const overall = (build: GalleryFeedRow) => ({ worked: build.reproduction_count ?? 0, last: build.last_confirmed_at });
  const chosen = model ? (MODEL_VERSIONS.find((entry) => entry.id === model) ?? null) : null;

  if (!chosen) {
    return {
      kind: "all",
      model: null,
      rows: [...matches].sort(bySort(sort, overall)),
      hasMore: false,
      counts: FEED_FIXTURE_COUNTS,
      total: matches.length,
    };
  }

  const on = (build: GalleryFeedRow) => build.proof.find((entry) => entry.modelId === chosen.id);
  const reproducedOn = matches
    .filter((build) => (on(build)?.worked ?? 0) > 0)
    .sort(bySort(sort, (build) => ({ worked: on(build)?.worked ?? 0, last: on(build)?.lastConfirmedAt ?? null })));
  const notYet = matches.filter((build) => !reproducedOn.includes(build)).sort(bySort(sort, overall));
  return {
    kind: "model",
    model: chosen,
    reproducedOn,
    notYet,
    hasMoreReproducedOn: false,
    hasMoreNotYet: false,
    counts: FEED_FIXTURE_COUNTS,
    totalReproducedOn: reproducedOn.length,
    totalNotYet: notYet.length,
  };
}
