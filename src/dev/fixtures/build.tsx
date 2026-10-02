/* UI-P29 — the Build page's sample data, as `BuildView` takes it.

   DEV ONLY (imported from `src/pages/dev/**` and `src/dev/**` alone). This is
   where `design/fixtures/sample-data.json → build_page` becomes props: its
   `build` index points into `builds`, its parts are `[category, title, meta,
   gap]` rows and its events `[kind, at, text]`. Nothing here reaches a
   production bundle. */

import type { ReactNode } from "react";

import { BuildCard, CardCredit } from "@/components/brand/BuildCard";
import { CoverFallback } from "@/components/brand/CoverFallback";
import type { TimelineEvent } from "@/components/brand/Timeline";
import { LAYER_ATTRIBUTION, LAYER_BLURB, MINIMUM_PUBLISHABLE_SCORE } from "@/lib/build";
import { t } from "@/lib/theme/tokens";
import { BreakageBody } from "@/pages/site/build/BreakageBody";
import { WhereNextPanels } from "@/pages/site/build/BuildLower";
import type { BuildViewProps } from "@/pages/site/build/BuildView";
import {
  buildTabs,
  formatFirstResult,
  formatMoney,
  type BuildTabKey,
  type CardView,
  type PartRowView,
} from "@/pages/site/build/buildModel";
import { RebuildsBody, REBUILD_CARD } from "@/pages/site/build/RebuildsBody";
import { ReplayBody } from "@/pages/site/build/ReplayBody";
import { LayerSteps, RunBody } from "@/pages/site/build/RunBody";

import { FIXTURE_NOW, fixturePlaque, fixtures, type FixtureBuild } from "../designFixtures";

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

/* ── UI-P30 — every other tab's body, and the sections under the first screen ──

   There is no board for these. `?tab=` on the compare page draws a tab's body
   from the same sample (its parts, its events, its open ask); `?lower=1` draws
   the sections under the first screen. The default (no parameter) is the board,
   unchanged. */

const now = FIXTURE_NOW.getTime();
const sample = () => fixtures.build_page as unknown as BuildPageSample;

/** A sample build as a card, the way the gallery fixture draws one. */
function sampleCard(b: FixtureBuild, size: "rebuild" | "wall"): CardView {
  return {
    key: b.id,
    render: (variant) => (
      <BuildCard
        to={`/b2/${b.slug}`}
        title={b.title}
        cover={<CoverFallback seed={b.id} radius={0} sky={b.cover_sky} />}
        coverHeight={size === "rebuild" ? REBUILD_CARD.coverHeight : variant === "phone" ? 96 : 92}
        titleSize={size === "rebuild" ? REBUILD_CARD.titleSize : variant === "phone" ? 18 : 19}
        shape={b.shape}
        credit={<CardCredit rebuiltFrom={b.rebuilt_from} by={b.maker} />}
        delta={b.change_summary}
        build={fixturePlaque(b)}
        categories={b.part_categories}
        openAsk={b.has_open_gap && b.open_gap_reward_gbp ? `1 part unsolved · £${b.open_gap_reward_gbp}` : null}
        gap={b.has_open_gap}
        now={now}
      />
    ),
  };
}

/** The tabs a sample body can be drawn for. */
export const SAMPLE_TABS: readonly BuildTabKey[] = ["anatomy", "watch", "run", "understand", "broke", "rebuilds"];

/** The viewer's content for `tab`, from the sample. Null for the anatomy, which the board itself draws. */
export function buildTabFixture(tab: BuildTabKey, viewport: "desktop" | "mobile" = "desktop"): ReactNode {
  const phone = viewport === "mobile";
  const page = sample();
  const parts = page.parts;
  switch (tab) {
    case "watch":
      return (
        <ReplayBody
          phone={phone}
          replay={{
            events: page.events.map(([kind, at, text], index) => ({
              id: `event-${index + 1}`,
              ordinal: index + 1,
              kind,
              at,
              text,
              phaseKey: "one",
              phaseTitle: null,
            })),
            markers: [{ index: 2, label: "@lee rebuilt from here", rebuilds: [{ id: "sample-3", label: "@lee rebuilt from here" }] }],
            focusOrdinal: null,
            produced: (index) => (index > 0 ? { ordinal: 2, node: <p style={{ margin: 0 }}>{page.selected_part_text}</p> } : null),
            onFork: noop,
            onOpenRebuild: noop,
          }}
        />
      );
    case "run":
      return (
        <RunBody
          phone={phone}
          onCopy={yes}
          run={{
            steps: parts
              .filter(([category]) => category === "instruction" || category === "configuration")
              .filter(([, , , gap]) => !gap)
              .map(([, title, meta], index) => ({
                id: `step-${index + 1}`,
                title,
                kind: meta,
                copyText: index === 0 ? page.selected_part_text : `${title}\n— ${meta}`,
              })),
            prerequisites: [{ id: "needs", title: page.needs, requirement: null }],
            allText: page.selected_part_text,
            words: null,
          }}
        />
      );
    case "understand":
      return (
        <LayerSteps
          phone={phone}
          onOpenPart={noop}
          layer={{
            attribution: LAYER_ATTRIBUTION,
            steps: parts.slice(0, 3).map(([, title], index) => ({
              n: index + 1,
              title,
              body: index === 0 ? page.selected_part_text : `What the ${title.toLowerCase()} does, and why.`,
              part: { id: `part-${index + 1}`, title },
            })),
          }}
        />
      );
    case "broke": {
      const breakage = page.events.find(([kind]) => kind === "breakage");
      const gap = parts.find(([, , , open]) => open);
      return (
        <BreakageBody
          breakage={{
            rows: breakage
              ? [
                  {
                    key: "sample-breakage",
                    name: breakage[2],
                    happened: "Totals in euros came back as pounds, so every euro invoice was flagged.",
                    fix: "Read the currency from the invoice before comparing totals.",
                    span: "step 3",
                    start: 3,
                    attempts: "4 attempts",
                  },
                ]
              : [],
            gaps: gap
              ? [{ id: "sample-gap", title: gap[1], problem: "The tolerance is fixed at 2%; it should be a setting.", reward: gap[2].replace(/ ask$/, ""), solvable: true }]
              : [],
            onOpenReplay: noop,
            onSolve: noop,
          }}
        />
      );
    }
    case "rebuilds":
      return (
        <RebuildsBody
          phone={phone}
          rebuilds={{
            cards: fixtures.builds.slice(1, 4).map((b) => sampleCard(b, "rebuild")),
            loading: false,
            lineageTo: `/b2/${fixtures.builds[page.build - 1].slug}/lineage`,
          }}
        />
      );
    case "anatomy":
    default:
      return null;
  }
}

/** The sections under the first screen, from the sample: where next, as the page draws it. */
export function buildLowerFixture(viewport: "desktop" | "mobile" = "desktop"): ReactNode {
  const b = fixtures.builds;
  return (
    <WhereNextPanels
      phone={viewport === "mobile"}
      rows={[
        { key: "rebuilds", heading: "Rebuilds of this", cards: b.slice(2, 5).map((card) => sampleCard(card, "wall")) },
        { key: "maker", heading: `More from ${b[0].maker}`, cards: b.slice(5, 8).map((card) => sampleCard(card, "wall")) },
      ]}
    />
  );
}
