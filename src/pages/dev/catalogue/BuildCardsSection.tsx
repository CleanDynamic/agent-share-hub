/* UI-P14 — the Build cards section: fresh, rebuilt (credit and Δ), stale, never
   reproduced, and a gap, in the reference's own order and at its 280px column.
   UI-P15 adds the two vacant frames to the same section.

   The cards are the pure `BuildCard` with the fixture builds' own pieces, so a
   comparison tests the card and not the database. */

import { BuildCard, CardCredit, COVER_HEIGHT } from "@/components/brand/BuildCard";
import { CoverFallback } from "@/components/brand/CoverFallback";
import { fixturePlaque, fixtures, FIXTURE_NOW, type FixtureBuild } from "@/dev/designFixtures";

import { Example, Row, Section } from "./parts";

const CARD_WIDTH = 280;

interface Sample {
  caption: string;
  /** 1-based index into the fixture builds, as the sample data's own references are. */
  build: number;
  rebuilt?: boolean;
  gap?: boolean;
}

const SAMPLES: readonly Sample[] = [
  { caption: "fresh · rebuilt (credit + Δ)", build: 1, rebuilt: true },
  { caption: "fresh", build: 2 },
  { caption: "stale · lamp dimmed", build: 6 },
  { caption: "never reproduced · no lamp", build: 8 },
  { caption: "gap · dashed breakage edge", build: 4, gap: true },
];

function Card({ build, rebuilt, gap }: { build: FixtureBuild; rebuilt?: boolean; gap?: boolean }) {
  return (
    <BuildCard
      to={`/b2/${build.slug}`}
      title={build.title}
      shape={build.shape}
      cover={<CoverFallback seed={build.id} sky={build.cover_sky} radius={0} />}
      coverHeight={COVER_HEIGHT.catalogue}
      credit={<CardCredit rebuiltFrom={rebuilt ? build.rebuilt_from : null} by={build.maker} />}
      delta={rebuilt ? build.change_summary : null}
      build={fixturePlaque(build)}
      now={FIXTURE_NOW.getTime()}
      categories={build.part_categories}
      gap={gap}
      openAsk={gap && build.open_gap_reward_gbp ? `1 part unsolved · £${build.open_gap_reward_gbp}` : null}
    />
  );
}

export function BuildCardsSection() {
  return (
    <Section
      name="Build cards"
      note="fixed order: cover (shape tag) → title → credit + Δ → plaque → part chips → open ask"
    >
      <Row style={{ alignItems: "flex-start" }}>
        {SAMPLES.map(({ caption, build, rebuilt, gap }) => (
          <Example key={caption} caption={caption} style={{ width: CARD_WIDTH }}>
            <Card build={fixtures.builds[build - 1]} rebuilt={rebuilt} gap={gap} />
          </Example>
        ))}
      </Row>
    </Section>
  );
}
