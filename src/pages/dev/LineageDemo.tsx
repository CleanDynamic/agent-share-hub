/* UI-P31 — /dev/kit/pages/lineage?theme=noon|dusk&viewport=desktop|mobile.

   `LineageView` with the rebuild board's sample family. There is no board for
   the lineage page; this is for looking at it, and for the tier-1 spec to drive.
   The sample build (Invoice triage agent) is the one in the address; picking a
   build shows the sample's change list against its parent. */

import { useState } from "react";

import { changesFixture, familyFixture } from "@/dev/fixtures/rebuild";
import { findNode } from "@/pages/site/rebuild/rebuildModel";
import { LineageView } from "@/pages/site/rebuild/LineageView";

import type { DesignPageProps } from "./KitPages";

export default function LineageDemo({ fit = "board", viewport, state = "populated" }: DesignPageProps) {
  const full = familyFixture({ currentIndex: 1 });
  /* UI-P37 — the other three states: the family waiting, a family of one, the family failing. */
  const family = state === "empty" ? { ...full, children: [] } : full;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const node = selectedId ? findNode(family, selectedId) : null;
  const parent = node ? findParent(family, node.id) : null;

  return (
    <LineageView
      fit={fit}
      title={family.children[0]?.title ?? family.title}
      family={state === "loading" || state === "error" ? null : family}
      familyLoading={state === "loading"}
      familyFailure={state === "error" ? { onRetry: () => undefined } : undefined}
      alone={state === "empty"}
      selectedId={selectedId}
      onSelect={setSelectedId}
      selection={
        node
          ? {
              title: node.title,
              to: node.to,
              parentTitle: parent?.title ?? null,
              groups: changesFixture(viewport),
              loading: false,
              failed: false,
            }
          : null
      }
    />
  );
}

function findParent(root: ReturnType<typeof familyFixture>, id: string): ReturnType<typeof familyFixture> | null {
  for (const child of root.children) {
    if (child.id === id) return root;
    const deeper = findParent(child, id);
    if (deeper) return deeper;
  }
  return null;
}
