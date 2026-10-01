/* UI-P29 — the Build page's sample data, as `BuildView` takes it.

   DEV ONLY (imported from `src/pages/dev/**` and `src/dev/**` alone). This is
   where `design/fixtures/sample-data.json → build_page` becomes props: its
   `build` index points into `builds`, its parts are `[category, title, meta,
   gap]` rows and its events `[kind, at, text]`. Nothing here reaches a
   production bundle. */

import { CoverFallback } from "@/components/brand/CoverFallback";
import type { TimelineEvent } from "@/components/brand/Timeline";
import { LAYER_BLURB, MINIMUM_PUBLISHABLE_SCORE } from "@/lib/build";
import { t } from "@/lib/theme/tokens";
import type { BuildViewProps } from "@/pages/site/build/BuildView";
import { buildTabs, formatFirstResult, formatMoney, type PartRowView } from "@/pages/site/build/buildModel";

import { FIXTURE_NOW, fixturePlaque, fixtures } from "../designFixtures";

type PartRow = [category: string, title: string, meta: string, gap: boolean];
type EventRow = [kind: TimelineEvent["kind"], at: string, text: string];

interface BuildPageSample {
  build: number;
  outcome: string;
  created_via: string;
  rebuilt_from: { title: string; maker: string };
  change_summary: string;
  last_reproduced: string;
  made_for: string;
  made_with: string;
  cost: { setup: number; monthly: number; currency: string };
  time_to_first_result_min: number;
  needs: string;
  completeness: number;
  gallery_threshold: number;
  next_missing: string;
  parts: PartRow[];
  selected_part_text: string;
  events: EventRow[];
}

const noop = () => undefined;
const yes = async () => true;

/** The phone board draws a shorter outcome under its 32px title. */
const PHONE_OUTCOME =
  "Checks every supplier invoice against its purchase order and routes mismatches to a person, with the reason.";

/** "Add a link to where it runs." as the view says it: "Next: add a link to where it runs." */
const asNext = (copy: string) => {
  const bare = copy.trim().replace(/\.$/, "");
  return bare.charAt(0).toLowerCase() + bare.slice(1);
};

/** The selected part's text, with its last sentence in the quieter ink, as the board draws it. */
function partText(text: string, phone: boolean) {
  const split = text.lastIndexOf(". ");
  if (phone || split < 0) return text.slice(0, phone && split >= 0 ? split + 1 : undefined);
  return (
    <>
      {text.slice(0, split + 1)} <span style={{ color: t.text2 }}>{text.slice(split + 2)}</span>
    </>
  );
}

/** Everything `BuildView` needs except `fit`, from the sample data. The phone board differs in sample content only. */
export function buildFixture(viewport: "desktop" | "mobile" = "desktop"): Omit<BuildViewProps, "fit"> {
  const phone = viewport === "mobile";
  const page = fixtures.build_page as unknown as BuildPageSample;
  const build = fixtures.builds[page.build - 1];

  const parts: PartRowView[] = page.parts.map(([category, title, meta, gap], index) => ({
    id: `part-${index + 1}`,
    number: index + 1,
    title,
    category,
    meta: gap ? null : meta,
    gap,
    ask: gap ? meta : null,
  }));

  return {
    now: FIXTURE_NOW.getTime(),
    hero: {
      title: build.title,
      outcome: phone ? PHONE_OUTCOME : page.outcome,
      shape: build.shape,
      viaConnector: page.created_via === "connector",
      cover: <CoverFallback seed={build.id} sky={build.cover_sky} radius={0} />,
      credit: {
        rebuiltFrom: { title: page.rebuilt_from.title, handle: page.rebuilt_from.maker.replace(/^@/, "") },
        // The phone board's plate names the source only.
        madeBy: phone ? null : build.maker,
      },
      delta: `Δ ${page.change_summary}`,
    },
    actions: { onCopyForAI: yes, onDownload: noop, onRebuild: noop, lineageTo: `/b2/${build.slug}/lineage` },
    proof: {
      build: fixturePlaque(build),
      lastRun: page.last_reproduced,
      action: { kind: "reproduce", onPress: noop },
      details: [
        { label: "Made for", value: page.made_for },
        { label: "Made with", value: page.made_with },
        { label: "Setup", value: formatMoney(page.cost.setup, page.cost.currency) ?? "—" },
        { label: "Monthly", value: formatMoney(page.cost.monthly, page.cost.currency) ?? "—" },
        { label: "First result", value: formatFirstResult(page.time_to_first_result_min) ?? "—" },
        { label: "Needs", value: page.needs },
      ],
      // The creator's block: drawn on the desktop board, left off the phone board.
      completeness: phone
        ? null
        : {
            score: page.completeness,
            publishAt: MINIMUM_PUBLISHABLE_SCORE,
            galleryAt: page.gallery_threshold,
            next: asNext(page.next_missing),
          },
    },
    anatomy: {
      parts,
      gaps: parts.filter((part) => part.gap).length,
      selectedId: parts[0]?.id ?? null,
      onSelect: noop,
      full: (
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          {parts.map((part) => (
            <li key={part.id}>{part.title}</li>
          ))}
        </ol>
      ),
    },
    viewer: {
      tabs: buildTabs(false),
      tab: "anatomy",
      onTabChange: noop,
      mode: "understand",
      onModeChange: noop,
      blurb: LAYER_BLURB.understand,
      content: partText(page.selected_part_text, phone),
      onCopy: yes,
    },
    timeline: {
      // The phone board draws four of the five: it leaves the note out.
      events: page.events.filter(([kind]) => !phone || kind !== "note").map(([kind, at, text]) => ({ kind, at, text })),
      duration: "26 minutes",
      onPlay: noop,
    },
  };
}
