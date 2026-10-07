/* UI-P50 — the Gallery dashboard's sample: the ten builds from Miles's canvas
   "Gallery discovery concept", artboard B, as `listGalleryDashboard` returns them.

   DEV ONLY (imported from `src/pages/dev/**` and the unit tests alone). There is
   no board for the dashboard; these rows are what
   /dev/kit/pages/gallery-dashboard draws, in both themes. The demo filters and
   sorts them in memory with the same functions the page uses. Dates are fixed,
   and "now" is fixed with them, so the "7 / 30 / 90 days" menu always answers
   the same. */

import type { DashboardRow } from "@/lib/build/gallery";
import { normaliseModel } from "@/lib/models/registry";

export const DASHBOARD_FIXTURE_NOW = Date.parse("2026-10-07T12:00:00Z");

interface Seed {
  n: number;
  title: string;
  handle: string;
  /** Model names as the registry spells them. */
  models: string[];
  madeFor: string[];
  sessions: number;
  prompts: number;
  turns: number;
  runs: number;
  rebuilds: number;
  /** [date, what] */
  last: [string, string];
  series: number[];
}

const SEEDS: Seed[] = [
  {
    n: 1,
    title: "CV tailored to a job ad",
    handle: "dana",
    models: ["GPT-6 Astra"],
    madeFor: ["Job seekers"],
    sessions: 1,
    prompts: 4,
    turns: 10,
    runs: 62,
    rebuilds: 12,
    last: ["2026-10-05", "Reproduced on GPT-6 Astra"],
    series: [0, 1, 2, 2, 3, 4, 3, 5, 6, 4, 7, 8, 9, 11],
  },
  {
    n: 2,
    title: "Pull request reviewer for small teams",
    handle: "kofi",
    models: ["Opus 5.5", "Sonnet 5.5", "DeepSeek V4 Pro"],
    madeFor: ["Developers"],
    sessions: 4,
    prompts: 24,
    turns: 102,
    runs: 40,
    rebuilds: 12,
    last: ["2026-10-04", "Reproduced on Opus 5.5"],
    series: [1, 0, 2, 1, 3, 2, 2, 4, 3, 5, 4, 6, 5, 7],
  },
  {
    n: 3,
    title: "Photo renamer by date taken",
    handle: "maria",
    models: ["Sonnet 5.5", "Opus 5.5"],
    madeFor: ["Photographers"],
    sessions: 3,
    prompts: 17,
    turns: 58,
    runs: 11,
    rebuilds: 3,
    last: ["2026-10-02", "Rebuilt by @sam"],
    series: [0, 0, 1, 0, 1, 1, 0, 2, 1, 0, 2, 1, 3, 2],
  },
  {
    n: 4,
    title: "Inbox triage for a small shop",
    handle: "priya",
    models: ["Sonnet 5.5", "Gemini 3.8 Flash", "GPT-5.6"],
    madeFor: ["Shop owners"],
    sessions: 5,
    prompts: 31,
    turns: 140,
    runs: 9,
    rebuilds: 2,
    last: ["2026-09-28", "Reproduced on Sonnet 5.5"],
    series: [2, 1, 1, 2, 0, 1, 1, 0, 2, 1, 0, 1, 1, 1],
  },
  {
    n: 5,
    title: "Monthly budget from a bank export",
    handle: "tomas",
    models: ["Gemini 4 Argon"],
    madeFor: ["Households"],
    sessions: 2,
    prompts: 9,
    turns: 26,
    runs: 21,
    rebuilds: 4,
    last: ["2026-09-21", "Reproduced on Gemini 4 Argon"],
    series: [0, 1, 0, 2, 1, 1, 2, 0, 1, 3, 1, 0, 2, 1],
  },
  {
    n: 6,
    title: "Receipt photos to an expenses sheet",
    handle: "sam",
    models: ["GPT-6.1 Sol"],
    madeFor: ["Freelancers"],
    sessions: 1,
    prompts: 6,
    turns: 15,
    runs: 14,
    rebuilds: 1,
    last: ["2026-09-12", "Published"],
    series: [0, 0, 0, 1, 0, 2, 1, 0, 0, 1, 0, 1, 0, 0],
  },
  {
    n: 7,
    title: "Lesson plan from a curriculum objective",
    handle: "ines",
    models: ["Haiku 5.5"],
    madeFor: ["Teachers"],
    sessions: 2,
    prompts: 12,
    turns: 33,
    runs: 8,
    rebuilds: 0,
    last: ["2026-08-30", "Reproduced on Haiku 5.5"],
    series: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  },
  {
    n: 8,
    title: "Meeting notes to actions",
    handle: "leo",
    models: ["Grok 4.7", "Opus 5"],
    madeFor: ["Managers"],
    sessions: 3,
    prompts: 15,
    turns: 49,
    runs: 6,
    rebuilds: 1,
    last: ["2026-08-14", "Rebuilt by @kofi"],
    series: [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  },
  {
    n: 9,
    title: "Recipe scaler with shopping list",
    handle: "amara",
    models: ["Gemini 3.8 Flash", "Sonnet 5.5"],
    madeFor: ["Home cooks"],
    sessions: 2,
    prompts: 8,
    turns: 21,
    runs: 4,
    rebuilds: 0,
    last: ["2026-07-19", "Published"],
    series: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  },
  {
    n: 10,
    title: "Tenancy agreement checker",
    handle: "ruth",
    models: ["Opus 5.5", "GPT-6 Luna"],
    madeFor: ["Renters"],
    sessions: 6,
    prompts: 38,
    turns: 171,
    runs: 3,
    rebuilds: 0,
    last: ["2026-06-30", "Reproduced on Opus 5.5"],
    series: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
];

const id = (n: number) => `00000000-0000-4000-8000-${String(200 + n).padStart(12, "0")}`;
const creator = (n: number) => `00000000-0000-4000-8000-${String(800 + n).padStart(12, "0")}`;

function row(seed: Seed): DashboardRow {
  const total = seed.runs + seed.rebuilds;
  const perSession = (value: number, index: number) =>
    index === seed.sessions - 1 ? value - Math.floor(value / seed.sessions) * (seed.sessions - 1) : Math.floor(value / seed.sessions);
  return {
    id: id(seed.n),
    slug: `dashboard-build-${seed.n}`,
    title: seed.title,
    creator: { id: creator(seed.n), handle: seed.handle },
    outcome: null,
    madeFor: seed.madeFor,
    modelsUsed: seed.models,
    sessionCount: seed.sessions,
    promptCount: seed.prompts,
    aiTurnCount: seed.turns,
    making: {
      sessions: Array.from({ length: seed.sessions }, (_, index) => ({
        client: "Claude",
        model: seed.models[index % seed.models.length],
        prompts: perSession(seed.prompts, index),
        turns: perSession(seed.turns, index),
      })),
    },
    reproduction_count: seed.runs,
    last_confirmed_at: `${seed.last[0]}T09:00:00Z`,
    last_confirmed_model: normaliseModel(seed.models[0])?.id ?? null,
    published_at: `${seed.last[0]}T09:00:00Z`,
    status: "gallery",
    shape: "app",
    completeness: 95,
    engagement: { runs: seed.runs, rebuilds: seed.rebuilds, comments: 0, saves: 0, total },
    lastActivity: { at: `${seed.last[0]}T09:00:00Z`, what: seed.last[1] },
    series: seed.series,
    proof: [],
  };
}

export const DASHBOARD_FIXTURE_ROWS: DashboardRow[] = SEEDS.map(row);
