/* CA-16 - /dev/kit/pages/classification?part=card|gallery&theme=noon|dusk&viewport=desktop|mobile.

   The Classification Card open on a build with tiles (`part=card`, the default), and the Gallery with the classification
   filters live and classified cards (`part=gallery`). Sample data only: nothing is read or written, and the Card's Save
   does nothing. No board image is compared. */

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { sandboxViewProps } from "@/dev/fixtures/sandbox";
import { FEED_FIXTURE_AUDIENCES, FEED_FIXTURE_COUNTS, FEED_FIXTURE_NOW, feedFixture } from "@/dev/fixtures/gallery-feed";
import { buildSteps } from "@/lib/build/graph";
import type { GalleryFeedRow } from "@/lib/build/gallery";
import type { NodeTree } from "@/lib/build/types";
import { deriveClassification } from "@/lib/classify/derive";
import { emptyClassification } from "@/lib/classify/facets";
import type { Classification } from "@/lib/classify/types";
import type { GalleryBy } from "@/lib/build/galleryParams";
import type { GalleryLens } from "@/lib/build/gallery";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { GalleryFeedView, type FeedSectionView } from "@/pages/site/gallery/GalleryFeedView";
import { feedRowView } from "@/pages/site/gallery/galleryModel";
import { SandboxCard } from "@/pages/site/compose/SandboxCard";

import type { DesignPageProps } from "./KitPages";

const noop = () => undefined;
const NO_SRC: ReadonlyMap<string, string> = new Map();

let counter = 0;
const node = (type: string, payload: Record<string, unknown>): NodeTree => {
  counter += 1;
  return { id: `demo-${counter}`, build_id: "demo", type, title: null, payload, position: counter, parent_id: null, source_ref: null, is_gap: false, created_at: "2026-10-22T00:00:00Z", children: [] } as unknown as NodeTree;
};

/** A build with tiles: two prompts, a deployed result with no code behind it, and a tool on a paid plan. */
const TREE: NodeTree[] = [
  node("prompt", { text: "Build hybrid search over our policy documents, and write a Python script that loads them" }),
  node("prompt", { text: "Add a reranking step and show the three best matches" }),
  node("integration", { service: "Notion", required_plan: "Plus, 8 pounds a month" }),
  node("result", { summary: "Live search page", url: "https://example.com/search", kind: "deployed" }),
];

const COUNTS: Record<string, number> = {
  "setting:research": 6, "built:multi-agent-system": 2, "field:ai-ml": 12, "field:ai-ml.retrieval": 7, "field:ai-ml.retrieval.hybrid-search": 3, "field:ai-ml.nlp": 4, "field:medicine": 6, "field:medicine.clinical-practice": 3,
  "field:law": 3, "field:education": 5, "field:finance": 2, "field:software": 9, "field:data": 4, "field:social": 2,
  "task:create": 11, "task:create.writing": 6, "task:create.code": 5, "task:analyse": 7, "task:analyse.summarising": 4, "task:find": 4, "task:assess": 3,
  "built:web-app": 9, "built:document-or-report": 6, "built:autonomous-agent": 4, "built:script-or-tool": 3, "built:dataset": 2, "built:prompt-library": 2, "built:image-set": 1,
  "stack:ai-applications": 12, "stack:ai-applications.claude": 8, "stack:languages": 9, "stack:languages.python": 6, "stack:languages.typescript": 5, "stack:data-storage.supabase": 4, "stack:applications.stata": 1,
  "skill:no-coding": 8, "skill:some-setup": 5, "skill:writing-code": 3, "cost:free-plans-are-enough": 5, "cost:needs-a-paid-plan": 3,
  "setting:education": 4, "setting:education.lecturer": 2, "setting:work": 5, "setting:work.small-business": 3, "role:made-with-ai": 10, "role:runs-on-ai": 3, "technique:retrieval-rag": 5, "data:health-data": 2, "age:all-ages": 4,
};

const make = (declared: Partial<Classification["declared"]>, derived: Classification["derived"]): Classification => ({ ...emptyClassification(), declared: { ...emptyClassification().declared, ...declared }, derived });

/** The board's six builds: what each says about itself, and how many people tried it. */
const BOARD: { title: string; outcome: string; name: string; handle: string; tries: { tried: number; worked: number }; classification: Classification }[] = [
  {
    title: "Clinical note extraction",
    outcome: "Pulls medications, doses and follow-up dates out of free-text clinic notes into a table.",
    name: "Priya Nair",
    handle: "priya",
    tries: { tried: 4, worked: 3 },
    classification: make(
      { field: [{ id: "medicine.medical-research.clinical-text-mining" }], task: [{ id: "analyse.text-analysis-nlp", primary: true }], setting: [{ id: "research.clinical-research" }], data: [{ id: "health-data" }] },
      { stack: { values: ["custom:Claude API", "languages.python"], from: [] }, built: { values: ["dataset"], from: [] }, role: { values: ["runs-on-ai"], from: [] }, skill: { values: ["writing-code"], from: [] } },
    ),
  },
  {
    title: "Survey analysis in Stata",
    outcome: "Turns a raw survey export into cleaned tables, weights and a short written summary.",
    name: "Tom Okafor",
    handle: "tomo",
    tries: { tried: 3, worked: 2 },
    classification: make(
      { field: [{ id: "social.sociology.quantitative-methods" }], task: [{ id: "analyse.quantitative-analysis", primary: true }], setting: [{ id: "education.postgraduate-student" }] },
      { stack: { values: ["applications.stata", "ai-applications.chatgpt"], from: [] }, built: { values: ["script-or-tool"], from: [] }, role: { values: ["made-with-ai"], from: [] }, skill: { values: ["some-setup"], from: [] } },
    ),
  },
  {
    title: "Essay marking agents",
    outcome: "Three agents mark an essay against a rubric, compare notes and write the feedback.",
    name: "Hannah Lee",
    handle: "hannah",
    tries: { tried: 5, worked: 4 },
    classification: make(
      { field: [{ id: "education.secondary-teaching.assessment" }], task: [{ id: "assess.marking-and-grading", primary: true }], setting: [{ id: "education.school-teacher" }], data: [{ id: "student-or-child-data" }] },
      { stack: { values: ["ai-applications.claude-code", "data-storage.postgresql"], from: [] }, built: { values: ["multi-agent-system"], from: [] }, role: { values: ["runs-on-ai"], from: [] }, skill: { values: ["some-setup"], from: [] } },
    ),
  },
  {
    title: "Weekly lesson slides",
    outcome: "Drafts a week of Year 9 lesson slides from the scheme of work, ready to edit.",
    name: "Sam Ortiz",
    handle: "samo",
    tries: { tried: 0, worked: 0 },
    classification: make(
      { field: [{ id: "education.primary-teaching.lesson-planning" }], task: [{ id: "create.presentations", primary: true }], setting: [{ id: "education.school-teacher" }] },
      { stack: { values: ["ai-applications.chatgpt", "applications.google-classroom"], from: [] }, built: { values: ["document-or-report"], from: [] }, role: { values: ["made-with-ai"], from: [] }, skill: { values: ["no-coding"], from: [] } },
    ),
  },
  {
    title: "Momentum trading bot",
    outcome: "Backtests a momentum rule on daily prices, then places paper trades with a daily risk limit.",
    name: "Jo Brandt",
    handle: "jo",
    tries: { tried: 4, worked: 2 },
    classification: make(
      { field: [{ id: "finance.trading-and-investing.algorithmic-trading" }], task: [{ id: "act.executing-transactions", primary: true }], setting: [{ id: "personal.hobby" }], data: [{ id: "financial-data" }] },
      { stack: { values: ["languages.python", "cloud.docker"], from: [] }, built: { values: ["autonomous-agent"], from: [] }, role: { values: ["runs-on-ai"], from: [] }, skill: { values: ["writing-code"], from: [] } },
    ),
  },
  {
    title: "UGC video workflow",
    outcome: "Takes a product brief and returns five short creator-style video scripts with shot lists.",
    name: "Maria Silva",
    handle: "maria",
    tries: { tried: 2, worked: 2 },
    classification: make(
      { field: [{ id: "marketing-and-sales.user-generated-content" }], task: [{ id: "create.video", primary: true }], setting: [{ id: "work.agency" }] },
      { stack: { values: ["applications.n8n", "ai-applications.claude"], from: [] }, built: { values: ["automation-workflow"], from: [] }, role: { values: ["runs-on-ai"], from: [] }, skill: { values: ["no-coding"], from: [] } },
    ),
  },
];

function CardDemo() {
  const phone = useIsPhone();
  const steps = useMemo(() => buildSteps(TREE), []);
  const derivation = useMemo(() => deriveClassification(steps, { tree: TREE, outcome: "Finds the right policy fast" }), [steps]);
  const base = sandboxViewProps("bakery");
  return (
    <SandboxCard
      {...base}
      title="Policy search"
      description="Finds the right policy fast, from every document we hold."
      open
      onOpenChange={noop}
      field={null}
      phone={phone}
      classification={{
        live: true,
        stored: emptyClassification(),
        derived: derivation.derived,
        questions: derivation.questions,
        texts: steps.filter((step) => step.kind === "prompt").map((step) => step.text),
        maker: { id: "demo-maker", name: "Miles", handle: "neoscaleai", avatar: null },
        onSave: async () => ({ written: true, missing: false }),
      }}
    />
  );
}

function GalleryDemo({ fit }: Pick<DesignPageProps, "fit">) {
  const [selected, setSelected] = useState<string[]>([]);
  const [tab, setTab] = useState<GalleryBy | null>(null);
  const [lens, setLens] = useState<GalleryLens>("all");
  const feed = feedFixture({ model: null, audience: null, sort: "newest", q: null });
  const base = feed.kind === "all" ? feed.rows : [];
  const rows = BOARD.map((entry, index) => ({
    ...base[index % base.length],
    id: `board-${index}`,
    slug: `board-${index}`,
    title: entry.title,
    outcome: entry.outcome,
    creatorName: entry.name,
    creatorHandle: entry.handle,
    reproduction_count: entry.tries.worked,
    bounties: [],
  })) as GalleryFeedRow[];
  const section: FeedSectionView = { rows: rows.map((build) => feedRowView(build, null)), total: rows.length, hasMore: false, loadingMore: false, onMore: noop };
  const classifications = Object.fromEntries(rows.map((row, index) => [row.id, BOARD[index].classification]));
  const tries = Object.fromEntries(rows.map((row, index) => [row.id, BOARD[index].tries]));
  const toggle = (key: string) => setSelected((current) => (current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]));
  return (
    <GalleryFeedView
      fit={fit}
      now={FEED_FIXTURE_NOW}
      view="feed"
      onViewChange={noop}
      query={null}
      onSearch={noop}
      model={null}
      onModelChange={noop}
      tool={null}
      onToolChange={noop}
      audience={null}
      onAudienceChange={noop}
      audiences={FEED_FIXTURE_AUDIENCES}
      sort="reproduced"
      onSortChange={noop}
      counts={FEED_FIXTURE_COUNTS}
      status="ready"
      onRetry={noop}
      list={{ kind: "all", list: section }}
      srcByPath={NO_SRC}
      onClearAll={() => setSelected([])}
      onNavigate={noop}
      classification={{ counts: COUNTS, selected, onToggle: toggle, onApply: (keys) => setSelected((current) => [...current, ...keys.filter((key) => !current.includes(key))]) }}
      classifications={classifications}
      board={{ tab, onTab: setTab, lens, onLens: setLens, tries }}
    />
  );
}

export default function ClassificationDemo({ fit = "board" }: DesignPageProps) {
  const [params] = useSearchParams();
  return params.get("part") === "gallery" ? <GalleryDemo fit={fit} /> : <CardDemo />;
}
