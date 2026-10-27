/* SV-12: the Maps view's own chunk: the builds the page holds and their Maps (when they have arrived) made into cards,
   and the view drawn from them. The mapper brings the composer's layout with it, which the rest of the page does not
   need, so the page imports this lazily and only when `?view=maps` is open (or pointed at). */

import type { BuildMap } from "@/lib/build/buildsMaps";
import type { BuildsTableBuild } from "@/lib/build/gallery";

import BuildsMapsView, { type BuildsMapsViewProps } from "./BuildsMapsView";
import { cardOf } from "./mapsModel";

export interface BuildsMapsPaneProps extends Omit<BuildsMapsViewProps, "cards" | "withMap"> {
  builds: readonly BuildsTableBuild[];
  /** The Maps read for these builds; undefined while the read is on its way. */
  maps: readonly BuildMap[] | undefined;
  now: number;
}

export default function BuildsMapsPane({ builds, maps, now, ...view }: BuildsMapsPaneProps) {
  const byId = new Map((maps ?? []).map((map) => [map.buildId, map]));
  const cards = builds.map((build) => cardOf(build, byId.get(build.id), now));
  const withMap = maps ? cards.filter((card) => card.sessions >= 2).length : null;
  return <BuildsMapsView {...view} cards={cards} withMap={withMap} />;
}
