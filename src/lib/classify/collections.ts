/* CA-16b P3: the Gallery's collections: a short fixed list, each standing for some facet values.

   A collection is applied as filters, so it can only say what the filters can: an OR within a facet and an AND across
   facets. Its count is read from the same counts the filters use: within one facet the largest of its values (the same
   build can carry two), across facets the smallest. It is an estimate until the filters are applied, and it never claims
   more builds than there are. Add a collection by adding an entry; use ids the taxonomy knows. */

import { isKnown, type Facet } from "./taxonomy";

export interface Collection {
  id: string;
  name: string;
  /** The line under the name. */
  line: string;
  /** Facet to ids: an OR within a facet, an AND across facets. */
  values: Partial<Record<Facet, readonly string[]>>;
}

export const COLLECTIONS: readonly Collection[] = [
  { id: "ai-for-teachers", name: "AI for teachers", line: "Marking, lesson planning, presentations", values: { field: ["education"] } },
  // The board also lets Task group Analyse with a science field stand here; the filters cannot say an OR across facets, so it is the Setting alone.
  { id: "research-with-ai", name: "Research with AI", line: "Literature review, text analysis, statistics", values: { setting: ["research"] } },
  // "With a sample run" is not something a build records yet, so it is the two agent kinds.
  { id: "runs-on-its-own", name: "Runs on its own", line: "Autonomous agents shown running", values: { built: ["autonomous-agent", "multi-agent-system"] } },
];

/** The facet keys a collection applies: `field:education`. Ids the taxonomy does not know are dropped. */
export function keysOf(collection: Collection): string[] {
  return (Object.entries(collection.values) as [Facet, readonly string[]][]).flatMap(([facet, ids]) => ids.filter((id) => isKnown(facet, id)).map((id) => `${facet}:${id}`));
}

/** How many builds a collection holds, from the facet counts. */
export function countOf(collection: Collection, counts: Readonly<Record<string, number>>): number {
  const perFacet = (Object.entries(collection.values) as [Facet, readonly string[]][]).map(([facet, ids]) => Math.max(0, ...ids.filter((id) => isKnown(facet, id)).map((id) => counts[`${facet}:${id}`] ?? 0)));
  return perFacet.length === 0 ? 0 : Math.min(...perFacet);
}

/** The collections that have builds, with their counts. */
export function visibleCollections(counts: Readonly<Record<string, number>>): { collection: Collection; count: number }[] {
  return COLLECTIONS.map((collection) => ({ collection, count: countOf(collection, counts) })).filter((entry) => entry.count > 0);
}
