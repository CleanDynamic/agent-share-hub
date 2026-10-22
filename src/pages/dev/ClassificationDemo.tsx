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
  "field:ai-ml": 12, "field:ai-ml.retrieval": 7, "field:ai-ml.retrieval.hybrid-search": 3, "field:ai-ml.nlp": 4, "field:medicine": 6, "field:medicine.clinical-practice": 3,
  "field:law": 3, "field:education": 5, "field:finance": 2, "field:software": 9, "field:data": 4, "field:social": 2,
  "task:create": 11, "task:create.writing": 6, "task:create.code": 5, "task:analyse": 7, "task:analyse.summarising": 4, "task:find": 4, "task:assess": 3,
  "built:web-app": 9, "built:document-or-report": 6, "built:autonomous-agent": 4, "built:script-or-tool": 3, "built:dataset": 2, "built:prompt-library": 2, "built:image-set": 1,
  "stack:ai-applications": 12, "stack:ai-applications.claude": 8, "stack:languages": 9, "stack:languages.python": 6, "stack:languages.typescript": 5, "stack:data-storage.supabase": 4, "stack:applications.stata": 1,
  "skill:no-coding": 8, "skill:some-setup": 5, "skill:writing-code": 3, "cost:free-plans-are-enough": 5, "cost:needs-a-paid-plan": 3,
  "setting:education": 4, "setting:education.lecturer": 2, "setting:work": 5, "setting:work.small-business": 3, "role:made-with-ai": 10, "role:runs-on-ai": 3, "technique:retrieval-rag": 5, "data:health-data": 2, "age:all-ages": 4,
};

const CLASSIFIED: Classification[] = [
  {
    ...emptyClassification(),
    declared: { ...emptyClassification().declared, field: [{ id: "ai-ml.retrieval.hybrid-search" }], task: [{ id: "find.research-and-search", primary: true }], setting: [{ id: "work.small-business" }] },
    derived: { stack: { values: ["ai-applications.claude", "data-storage.supabase"], from: [] }, built: { values: ["web-app"], from: [] }, role: { values: ["runs-on-ai"], from: [] }, skill: { values: ["some-setup"], from: [] } },
  },
  {
    ...emptyClassification(),
    declared: { ...emptyClassification().declared, field: [{ id: "medicine.medical-research.clinical-text-mining" }], task: [{ id: "analyse.text-analysis-nlp", primary: true }], setting: [{ id: "research.clinical-research" }], data: [{ id: "health-data" }] },
    derived: { stack: { values: ["languages.python", "ai-frameworks.transformers"], from: [] }, built: { values: ["script-or-tool"], from: [] }, role: { values: ["made-with-ai"], from: [] }, skill: { values: ["writing-code"], from: [] } },
  },
  {
    ...emptyClassification(),
    declared: { ...emptyClassification().declared, field: [{ id: "education.secondary-teaching.assessment" }], task: [{ id: "assess.marking-and-grading", primary: true }], setting: [{ id: "education.school-teacher" }] },
    derived: { stack: { values: ["ai-applications.chatgpt"], from: [] }, built: { values: ["prompt-library"], from: [] }, role: { values: ["made-with-ai"], from: [] }, skill: { values: ["no-coding"], from: [] } },
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
        onSave: async () => ({ written: true, missing: false }),
      }}
    />
  );
}

function GalleryDemo({ fit }: Pick<DesignPageProps, "fit">) {
  const [selected, setSelected] = useState<string[]>([]);
  const feed = feedFixture({ model: null, audience: null, sort: "newest", q: null });
  const rows = feed.kind === "all" ? feed.rows.slice(0, 5) : [];
  const section: FeedSectionView = { rows: rows.map((build: GalleryFeedRow) => feedRowView(build, null)), total: rows.length, hasMore: false, loadingMore: false, onMore: noop };
  const classifications = Object.fromEntries(rows.slice(0, 3).map((row, index) => [row.id, CLASSIFIED[index]]));
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
      sort="newest"
      onSortChange={noop}
      counts={FEED_FIXTURE_COUNTS}
      status="ready"
      onRetry={noop}
      list={{ kind: "all", list: section }}
      srcByPath={NO_SRC}
      onClearAll={() => setSelected([])}
      onNavigate={noop}
      classification={{ counts: COUNTS, selected, onToggle: (key) => setSelected((current) => (current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key])) }}
      classifications={classifications}
    />
  );
}

export default function ClassificationDemo({ fit = "board" }: DesignPageProps) {
  const [params] = useSearchParams();
  return params.get("part") === "gallery" ? <GalleryDemo fit={fit} /> : <CardDemo />;
}
