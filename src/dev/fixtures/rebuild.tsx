/* UI-P31 — Rebuild's sample data, as `RebuildView` and `LineageView` take it.

   DEV ONLY (imported from `src/pages/dev/**` and `src/dev/**` alone). This is
   where `design/fixtures/sample-data.json → rebuild` becomes props: its family
   rows are `[title, maker, sky, reproduced, state, parent index]`, its changes
   `[kind, name, value]` rows with `header` rows opening each group.

   THE PHONE BOARD DRAWS A SHORTER LIST, in sample content only: no Title row and
   no Retry policy row, the values cut down ("data · 38"), and a Δ line without
   its third clause. `rebuildFixture` takes the viewport. */

import type { ChangeGroupView, ChangeRowKind, FamilyLamp, FamilyNodeView } from "@/pages/site/rebuild/rebuildModel";
import type { RebuildViewProps } from "@/pages/site/rebuild/RebuildView";

import { fixtures } from "../designFixtures";

type FamilyRow = [title: string, maker: string, sky: number, reproduced: number, state: "on" | "stale" | "draft", parent: number | null];
type ChangeRow = [kind: "header" | ChangeRowKind, name: string, value: string];

interface RebuildSample {
  title: string;
  readiness_pct: number;
  missing: string;
  changes: ChangeRow[];
  family: FamilyRow[];
}

const sample = () => fixtures.rebuild as unknown as RebuildSample;
const noop = () => undefined;

const LAMP: Record<FamilyRow[4], FamilyLamp> = { on: "healthy", stale: "stale", draft: "draft" };

/** The family, nested from its parent indices, in the sample's own order. */
export function familyFixture({ currentIndex = null }: { currentIndex?: number | null } = {}): FamilyNodeView {
  const rows = sample().family;
  const nodes: FamilyNodeView[] = rows.map(([title, maker, sky, reproduced, state], index) => ({
    id: `family-${index}`,
    to: `/b2/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    title,
    maker,
    reproduced,
    lamp: LAMP[state],
    seed: `family-${index}`,
    sky,
    draft: state === "draft",
    current: index === currentIndex,
    children: [],
  }));
  rows.forEach(([, , , , , parent], index) => {
    if (parent !== null) nodes[parent].children.push(nodes[index]);
  });
  return nodes[0];
}

/** The phone board's rows: no Title, no Retry policy, the values cut down. */
const PHONE_VALUES: Record<string, string | null> = {
  Title: null,
  "Made with": "sonnet-4.5 → opus 5",
  "Currency table": "data · 38",
  "Routing rules": "18 → 22",
  "Retry policy": null,
  "Routing sheet": "artefact",
  "Run log · 29 Sep": "120 invoices",
};

export function changesFixture(viewport: "desktop" | "mobile" = "desktop"): ChangeGroupView[] {
  const phone = viewport === "mobile";
  const groups: ChangeGroupView[] = [];
  sample().changes.forEach(([kind, name, value], index) => {
    if (kind === "header") {
      groups.push({ key: name.toLowerCase(), label: name, rows: [] });
      return;
    }
    const shown = phone ? PHONE_VALUES[name] : value;
    if (shown === null || shown === undefined) return;
    groups[groups.length - 1]?.rows.push({ key: `sample-${index}`, kind, name, value: shown });
  });
  return groups;
}

/** Everything `RebuildView` needs except `fit`, from the sample. */
export function rebuildFixture(viewport: "desktop" | "mobile" = "desktop"): Omit<RebuildViewProps, "fit"> {
  const phone = viewport === "mobile";
  const rebuild = sample();
  const [sourceTitle, sourceMaker] = rebuild.family[1];
  return {
    draftTitle: rebuild.title,
    source: { title: sourceTitle, maker: sourceMaker },
    family: familyFixture(),
    changes: changesFixture(viewport),
    readiness: {
      pct: rebuild.readiness_pct,
      headline: "One thing before it can hang",
      next: rebuild.missing,
      ready: false,
    },
    credit: {
      title: sourceTitle,
      handle: sourceMaker.replace(/^@/, ""),
      delta: phone ? "Δ swapped model, added currency table" : "Δ swapped model, added currency table, 4 more rules",
    },
    onPublish: noop,
    onKeepDraft: noop,
    workspaceTo: "/compose/sample-draft?from=rebuild",
  };
}
