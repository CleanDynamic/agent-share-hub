/* SV-13: the Builds Classification board's sample data, as `BuildsClassificationView` takes it.

   Copied from the `<script type="text/x-dc">` block of `design/reference/vision/source/BuildsClassification.dc.html`: six
   builds and, for each, the eight facets with the values the board draws and where each came from. DEV ONLY (the dev page
   `vision-builds-classification` and the view's tests). Every name, number and sentence is sample content.

   EACH BUILD IS MADE INTO A REAL `Classification` and drawn by `cardOf`, the live page's own path. A label the lists know
   becomes its id (so it links); one they do not become the maker's own words (so it is text, drawn the same). The board's
   "Regulated area" is put on a card whose classification does not make it regulated (the sample says "Personal data"). */

import { REGULATED_TAG } from "@/lib/classify/lines";
import { emptyClassification } from "@/lib/classify/facets";
import { valueByLabel, type Facet } from "@/lib/classify/taxonomy";
import type { Classification, Entry } from "@/lib/classify/types";
import type { BuildsTableBuild } from "@/lib/build/gallery";
import { visionBuildsTableProps } from "@/dev/fixtures/vision/builds-table";
import type { BuildsClassificationViewProps } from "@/pages/site/builds/BuildsClassificationView";
import { DEFAULT_FACETS, cardOf } from "@/pages/site/builds/classificationModel";

const noop = () => undefined;

/** The board's date; the lamp of a build confirmed in the last 120 days is lit. */
export const CLASSIFICATION_NOW = Date.parse("2026-10-26T12:00:00Z");

/** [facet label, values, how: "s" stated, "t" from tiles, "c" corrected, tiles]. */
type Row = readonly [facet: string, values: readonly string[], how: "s" | "t" | "c", tiles?: number];
type Sample = readonly [title: string, maker: string, shape: string, reproduced: number, lit: boolean, regulated: boolean, rows: readonly Row[]];

const SAMPLES: readonly Sample[] = [
  ["Call notes that write themselves", "maya", "workflow", 6, true, true, [
    ["Field", ["Sales"], "s"], ["Task", ["Summarise calls"], "s"], ["What was built", ["Automation workflow"], "t", 3], ["Techniques", ["Single agent", "Structured output"], "t", 4],
    ["Autonomy", ["AI acts with approval gates"], "t", 2], ["Tools and stack", ["Claude", "Notion", "Zoom"], "t", 6], ["Data handled", ["Personal data"], "s"], ["Cost to run", ["Extra usage under £10 a month"], "c"],
  ]],
  ["Account research brief", "mira", "agent", 4, true, false, [
    ["Field", ["Sales"], "s"], ["Task", ["Research accounts"], "s"], ["What was built", ["Multi-agent system"], "t", 4], ["Techniques", ["Multi-agent orchestration", "Browser use", "Tool use"], "t", 7],
    ["Autonomy", ["Fully autonomous"], "t", 3], ["Tools and stack", ["Claude", "GPT-5", "Exa"], "t", 5], ["Data handled", ["Public data only"], "s"], ["Cost to run", ["Extra usage £10 to £50 a month"], "t", 3],
  ]],
  ["Inbox triage in one prompt", "kit", "prompt", 31, true, false, [
    ["Field", ["Sales"], "s"], ["Task", ["Sort email"], "s"], ["What was built", ["Configured assistant"], "t", 1], ["Techniques", ["System prompt", "Classification"], "t", 1],
    ["Autonomy", ["AI suggests and you approve"], "t", 1], ["Tools and stack", ["Claude", "Gmail"], "t", 2], ["Data handled", ["Confidential business data"], "s"], ["Cost to run", ["Free plans are enough"], "t", 1],
  ]],
  ["Quote to invoice", "suntzu", "app", 3, true, true, [
    ["Field", ["Sales", "Finance"], "s"], ["Task", ["Create invoices"], "s"], ["What was built", ["Web app"], "t", 2], ["Techniques", ["Code execution"], "t", 3],
    ["Autonomy", ["You do each step"], "t", 4], ["Tools and stack", ["Claude Code", "Supabase", "Stripe"], "t", 9], ["Data handled", ["Financial data"], "s"], ["Cost to run", ["Needs a paid plan"], "t", 1],
  ]],
  ["Cold email personaliser", "jay", "agent", 7, false, true, [
    ["Field", ["Sales"], "s"], ["Task", ["Write outreach"], "s"], ["What was built", ["Autonomous agent"], "t", 2], ["Techniques", ["Retrieval (RAG)", "Tool use"], "t", 5],
    ["Autonomy", ["Fully autonomous"], "c"], ["Tools and stack", ["Claude", "Linear"], "t", 3], ["Data handled", ["Personal data"], "s"], ["Cost to run", ["Extra usage £10 to £50 a month"], "t", 2],
  ]],
  ["Weekly pipeline digest", "dax", "workflow", 8, true, false, [
    ["Field", ["Sales"], "s"], ["Task", ["Report on pipeline"], "s"], ["What was built", ["Automation workflow"], "t", 3], ["Techniques", ["Prompt chain", "Structured output"], "t", 4],
    ["Autonomy", ["Fully autonomous"], "t", 1], ["Tools and stack", ["Claude", "Zapier", "HubSpot"], "t", 5], ["Data handled", ["Confidential business data"], "s"], ["Cost to run", ["Extra usage under £10 a month"], "t", 2],
  ]],
];

const FACET_OF: Record<string, Facet> = {
  Field: "field", Task: "task", "What was built": "built", Techniques: "technique", Autonomy: "autonomy", "Tools and stack": "stack", "Data handled": "data", "Cost to run": "cost",
};

const entry = (facet: Facet, label: string): Entry => {
  const known = valueByLabel(facet, label);
  return known ? { id: known.id } : { custom: label };
};
const idOf = (facet: Facet, label: string): string => valueByLabel(facet, label)?.id ?? `custom:${label}`;

function classificationOf(rows: readonly Row[]): Classification {
  const c = emptyClassification();
  for (const [name, values, how, tiles = 0] of rows) {
    const facet = FACET_OF[name];
    if (how === "s") {
      if (facet === "field" || facet === "task" || facet === "data") c.declared[facet] = values.map((label) => entry(facet, label));
    } else if (how === "c") {
      c.disputes[facet] = { values: values.map((label) => idOf(facet, label)), reason: "Corrected by the maker", at: "2026-10-01T00:00:00Z" };
    } else {
      c.derived[facet] = { values: values.map((label) => idOf(facet, label)), from: Array.from({ length: tiles }, (_, n) => `t${n + 1}`) };
    }
  }
  return c;
}

function buildOf(sample: Sample, index: number): { build: BuildsTableBuild; regulated: boolean } {
  const [title, maker, shape, reproduced, lit, regulated, rows] = sample;
  return {
    build: {
      id: `class-${index + 1}`,
      slug: `class-${index + 1}`,
      title,
      shape,
      madeWith: [],
      reproductionCount: reproduced,
      lastConfirmedAt: lit ? "2026-10-20T09:00:00Z" : "2025-01-01T09:00:00Z",
      lastConfirmedModel: null,
      publishedAt: "2025-01-01T09:00:00Z",
      rebuildCount: 0,
      maker: { handle: maker, name: null },
      open: { count: 0, reward: null },
      classifiedAs: classificationOf(rows),
    },
    regulated,
  };
}

export function visionBuildsClassificationProps(over: Partial<BuildsClassificationViewProps> = {}): BuildsClassificationViewProps {
  return {
    view: "classification",
    hrefFor: () => "#",
    buildsLabel: "18 builds",
    activeCount: 6,
    panel: undefined,
    facets: DEFAULT_FACETS,
    onFacets: noop,
    cards: SAMPLES.map(buildOf).map(({ build, regulated }) => {
      const card = cardOf(build, DEFAULT_FACETS, () => "#", CLASSIFICATION_NOW);
      return regulated && !card.subtitle.endsWith(REGULATED_TAG) ? { ...card, subtitle: `${card.subtitle} · ${REGULATED_TAG}` } : card;
    }),
    ...over,
  };
}

export const visionClassificationPanel = () => visionBuildsTableProps().filters;
