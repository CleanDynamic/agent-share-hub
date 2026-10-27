/* CA-16 - /dev/kit/pages/classification?theme=noon|dusk&viewport=desktop|mobile.

   The Classification Card open on a build with tiles. Sample data only: nothing is read or written, and the Card's Save
   does nothing. No board image is compared. SV-11 retired the Gallery feed this page also drew (`part=gallery`). */

import { useMemo } from "react";

import { sandboxViewProps } from "@/dev/fixtures/sandbox";
import { buildSteps } from "@/lib/build/graph";
import type { NodeTree } from "@/lib/build/types";
import { deriveClassification } from "@/lib/classify/derive";
import { emptyClassification } from "@/lib/classify/facets";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { SandboxCard } from "@/pages/site/compose/SandboxCard";

const noop = () => undefined;

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

export default function ClassificationDemo() {
  return <CardDemo />;
}
