/* SV-12: the Builds Maps board's sample data, as `BuildsMapsView` takes it.

   Copied from the `<script type="text/x-dc">` block of `design/reference/vision/source/BuildsMaps.dc.html`: six builds, the
   sessions of each with their model and tile count, the parts, and which session uses which. DEV ONLY (the dev page
   `vision-builds-maps` and the view's tests). Every name, number and sentence is sample content.

   THE PLACES ARE NOT COPIED FROM THE BOARD. Each build is made into the same `SessionMapModel` the composer's Map works
   from, and laid out by `layoutSessionMap` and drawn by `cardOf`, the live page's own path, so the board is compared with
   what the page would draw for such a build. */

import type { BuildMap } from "@/lib/build/buildsMaps";
import type { BuildsTableBuild } from "@/lib/build/gallery";
import { sessionMapModel, type MapSession, type SessionLink } from "@/lib/build/sessionMap";
import { cardOf } from "@/pages/site/builds/mapsModel";
import { visionBuildsTableProps } from "@/dev/fixtures/vision/builds-table";
import type { BuildsMapsViewProps } from "@/pages/site/builds/BuildsMapsView";

const noop = () => undefined;

/** The board's date; the lamp of a build confirmed in the last 120 days is lit. */
export const MAPS_NOW = Date.parse("2026-10-26T12:00:00Z");

type Sample = readonly [title: string, maker: string, reproduced: number, lit: boolean, parts: readonly string[], sessions: readonly (readonly [part: number, title: string, model: string, tiles: number, parallel?: boolean])[], links: readonly (readonly [number, number])[]];

const SAMPLES: readonly Sample[] = [
  ["Call notes that write themselves", "maya", 6, true, ["Part A"], [[0, "Transcribe", "opus", 4], [0, "Clean-up", "agent", 3], [0, "Summary", "opus", 7]], [[1, 2], [2, 3], [1, 3]]],
  ["Account research brief", "mira", 4, true, ["Part A", "Part B"], [[0, "Plan", "opus", 3], [0, "Search", "agent", 6], [0, "Rank", "gpt-5", 4], [1, "Draft", "opus", 5], [1, "Edit", "opus", 2]], [[1, 2], [2, 3], [1, 4], [4, 5]]],
  ["Cold email personaliser", "jay", 7, false, ["Part A"], [[0, "Leads", "opus", 2], [0, "Research", "agent", 5], [0, "Tone", "opus", 3, true], [0, "Send", "code", 4]], [[1, 2], [1, 3], [2, 4], [3, 4]]],
  ["Weekly pipeline digest", "dax", 8, true, ["Part A"], [[0, "Pull CRM", "opus", 6], [0, "Digest", "opus", 5], [0, "Schedule", "code", 3]], [[1, 2], [2, 3]]],
  ["Quote to invoice", "suntzu", 3, true, ["Part A", "Part B"], [[0, "Scaffold", "cc", 9], [0, "Quotes", "cc", 7], [1, "Stripe", "cc", 5], [1, "Invoices", "cc", 4]], [[2, 4], [3, 4]]],
  ["Inbox triage in one prompt", "kit", 31, true, ["Part A"], [[0, "Triage", "opus", 6]], []],
];

const PART_NAMES: Record<string, readonly string[]> = {
  "Account research brief": ["Research", "Write"],
  "Quote to invoice": ["App", "Billing"],
};

function mapOf(sample: Sample, index: number): { build: BuildsTableBuild; map: BuildMap } {
  const [title, maker, reproduced, lit, parts, sessions, links] = sample;
  const id = `maps-${index + 1}`;
  const key = (n: number) => `${id}-s${n}`;
  const names = PART_NAMES[title] ?? [];
  const model = sessionMapModel({
    sessions: sessions.map(([part, name, modelName, tiles], at): MapSession => ({ key: key(at + 1), number: at + 1, app: "Claude", model: modelName, title: name, part: `${id}-p${part}`, tiles })),
    parts: parts.map((_, at) => ({
      key: `${id}-p${at}`,
      index: at,
      name: names[at],
      // A second part begins beside the first session of the first, as the board draws it.
      ...(at > 0 ? { startsAfter: key(1) } : null),
      sessions: sessions.flatMap(([part], n) => (part === at ? [key(n + 1)] : [])),
    })),
    links: links.map(([from, to]): SessionLink => ({ id: `${key(from)}>${key(to)}`, session: key(to), from: key(from), tiles: [] })),
    meta: Object.fromEntries(sessions.flatMap(([, , , , parallel], at) => (parallel ? [[key(at + 1), { withAbove: true, date: "" }]] : []))),
    labels: "letters",
  });
  return {
    build: {
      id,
      slug: id,
      title,
      shape: "",
      madeWith: [],
      reproductionCount: reproduced,
      lastConfirmedAt: lit ? "2026-10-20T09:00:00Z" : "2025-01-01T09:00:00Z",
      lastConfirmedModel: null,
      publishedAt: "2025-01-01T09:00:00Z",
      rebuildCount: 0,
      maker: { handle: maker, name: null },
      open: { count: 0, reward: null },
    },
    map: { buildId: id, model },
  };
}

export function visionBuildsMapsProps(over: Partial<BuildsMapsViewProps> = {}): BuildsMapsViewProps {
  const made = SAMPLES.map(mapOf);
  const table = visionBuildsTableProps();
  return {
    view: "maps",
    hrefFor: () => "#",
    activeCount: 6,
    chips: table.table?.chips ?? [],
    onRemoveChip: noop,
    panel: undefined,
    direction: "horizontal",
    onDirection: noop,
    buildsLabel: "18 builds",
    withMap: 14,
    cards: made.map(({ build, map }) => ({ ...cardOf(build, map, MAPS_NOW), href: "#" })),
    ...over,
  };
}
