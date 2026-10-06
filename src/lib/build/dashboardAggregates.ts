// The Models and Makers tabs of the Gallery dashboard (UI-P44d).
//
// PURE FUNCTIONS over the rows listGalleryDashboard returns: no queries, so a
// tab is a fold of what the Builds tab already loaded and the three always
// agree.

import type { DashboardEngagement, DashboardRow } from "./gallery";
import { normaliseModel, type Lab } from "@/lib/models/registry";

const NO_ENGAGEMENT: DashboardEngagement = { runs: 0, rebuilds: 0, comments: 0, saves: 0, total: 0 };

function addEngagement(sum: DashboardEngagement, add: DashboardEngagement): DashboardEngagement {
  return {
    runs: sum.runs + add.runs,
    rebuilds: sum.rebuilds + add.rebuilds,
    comments: sum.comments + add.comments,
    saves: sum.saves + add.saves,
    total: sum.total + add.total,
  };
}

const time = (iso: string | null): number => (iso ? Date.parse(iso) || 0 : 0);

/** What a session with no model is counted under, as in getReproductionsByModel. */
const UNKNOWN_MODEL = "Unknown model";

export interface ModelRow {
  /** The ModelVersion id; null for a model the registry does not name. */
  modelId: string | null;
  modelName: string;
  lab: Lab | null;
  /** Builds with at least one session on this model. */
  builds: number;
  sessions: number;
  prompts: number;
  turns: number;
  /** The sum of engagement over those builds, each counted once. */
  engagement: DashboardEngagement;
  /** The newest published build made with it; null when none has a date. */
  lastUsed: { at: string; buildTitle: string } | null;
}

/**
 * One row per model that appears in the rows' making.sessions: a registry
 * version (spellings merged), an unlisted model under its trimmed text, and
 * sessions with no model under "Unknown model". A version nobody used has no
 * row. Most builds first, then name.
 *
 * lastUsed is the build's published_at: a session carries no date of its own.
 */
export function modelRows(rows: readonly DashboardRow[]): ModelRow[] {
  const byKey = new Map<string, ModelRow & { seen: Set<string> }>();

  for (const row of rows) {
    for (const session of row.making.sessions) {
      const version = normaliseModel(session.model);
      const raw = session.model?.trim() ?? "";
      const key = version ? `id:${version.id}` : raw ? `raw:${raw}` : "none";

      let entry = byKey.get(key);
      if (!entry) {
        entry = {
          modelId: version?.id ?? null,
          modelName: version?.name ?? (raw || UNKNOWN_MODEL),
          lab: version?.lab ?? null,
          builds: 0,
          sessions: 0,
          prompts: 0,
          turns: 0,
          engagement: NO_ENGAGEMENT,
          lastUsed: null,
          seen: new Set(),
        };
        byKey.set(key, entry);
      }

      entry.sessions += 1;
      entry.prompts += session.prompts;
      entry.turns += session.turns;

      if (!entry.seen.has(row.id)) {
        entry.seen.add(row.id);
        entry.builds += 1;
        entry.engagement = addEngagement(entry.engagement, row.engagement);
        if (row.published_at && time(row.published_at) > time(entry.lastUsed?.at ?? null)) {
          entry.lastUsed = { at: row.published_at, buildTitle: row.title };
        }
      }
    }
  }

  return [...byKey.values()]
    .map(({ seen: _seen, ...entry }) => entry)
    .sort((a, b) => b.builds - a.builds || a.modelName.localeCompare(b.modelName));
}

export interface MakerRow {
  creator: { id: string; handle: string };
  builds: number;
  /** Sum of the builds' session counts. */
  sessions: number;
  /** Distinct models across their builds, as names (spellings merged), A to Z. */
  models: string[];
  prompts: number;
  turns: number;
  engagement: DashboardEngagement;
  lastPublishedAt: string | null;
}

/** One row per creator, most builds first, then handle. */
export function makerRows(rows: readonly DashboardRow[]): MakerRow[] {
  const byCreator = new Map<string, MakerRow & { names: Set<string> }>();

  for (const row of rows) {
    let entry = byCreator.get(row.creator.id);
    if (!entry) {
      entry = {
        creator: row.creator,
        builds: 0,
        sessions: 0,
        models: [],
        prompts: 0,
        turns: 0,
        engagement: NO_ENGAGEMENT,
        lastPublishedAt: null,
        names: new Set(),
      };
      byCreator.set(row.creator.id, entry);
    }

    entry.builds += 1;
    entry.sessions += row.sessionCount;
    entry.prompts += row.promptCount;
    entry.turns += row.aiTurnCount;
    entry.engagement = addEngagement(entry.engagement, row.engagement);
    for (const used of row.modelsUsed) {
      const name = normaliseModel(used)?.name ?? used.trim();
      if (name) entry.names.add(name);
    }
    if (time(row.published_at) > time(entry.lastPublishedAt)) entry.lastPublishedAt = row.published_at;
  }

  return [...byCreator.values()]
    .map(({ names, ...entry }) => ({ ...entry, models: [...names].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => b.builds - a.builds || a.creator.handle.localeCompare(b.creator.handle));
}
