/* UI-P11 — the Compositions section: the large pieces the pages are built from.
   There is no section of this name in the reference catalogue (the pieces are
   drawn on the page boards), so the harness skips it; the plate and the viewer
   are compared as part of the Gallery and Build boards (UI-P28, UI-P29). */

import { useState } from "react";

import { PartViewer, type PartViewerMode } from "@/components/brand/PartViewer";
import { MarkTile, RankRung, type RankTier } from "@/components/brand/RankRung";
import { Timeline, type TimelineEvent } from "@/components/brand/Timeline";
import { fixtures } from "@/dev/designFixtures";

import { Example, Row, Section } from "./parts";

const TABS = [
  { value: "anatomy", label: "Anatomy" },
  { value: "built", label: "Watch it get built" },
  { value: "run", label: "Run it yourself" },
  { value: "broke", label: "Where it broke" },
  { value: "result", label: "Result" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const TIERS: readonly RankTier[] = ["highest", "rare", "common", "none"];

export function CompositionsSection() {
  const [tab, setTab] = useState<TabValue>("anatomy");
  const [mode, setMode] = useState<PartViewerMode>("understand");
  const events = fixtures.build_page.events.map(
    ([kind, at, text]): TimelineEvent => ({ kind: kind as TimelineEvent["kind"], at, text }),
  );

  return (
    <Section
      name="Compositions"
      note="part viewer · timeline · rank rungs · creator-mark tiles"
    >
      <Row style={{ alignItems: "flex-start", gap: 29 }}>
        <Example caption="part viewer">
          <div style={{ width: 640, height: 400 }}>
            <PartViewer<TabValue>
              number={1}
              category="instruction"
              categoryLabel="instruction"
              name="System prompt"
              tabs={TABS}
              tab={tab}
              onTabChange={setTab}
              mode={mode}
              onModeChange={setMode}
              blurb="What each step does, and why, in plain language."
            >
              {fixtures.build_page.selected_part_text}
            </PartViewer>
          </div>
        </Example>
        <Example caption="timeline · watch it get built">
          <div style={{ width: 300 }}>
            <Timeline events={events} />
          </div>
        </Example>
      </Row>
      <div style={{ height: 20 }} />
      <Row style={{ alignItems: "flex-end", gap: 23 }}>
        {([28, 32, 40] as const).map((size) => (
          <Example key={size} caption={`rank rung · ${size}`}>
            <Row gap={7}>
              {TIERS.map((tier, i) => (
                <RankRung key={tier} rank={i + 1} tier={tier} size={size} />
              ))}
            </Row>
          </Example>
        ))}
        <Example caption="creator-mark tiles · highest, rare, common, none">
          <Row gap={10} style={{ alignItems: "flex-start" }}>
            <MarkTile tier="highest" caption="First hang" />
            <MarkTile tier="rare" caption="Proven" />
            <MarkTile tier="common" caption="Rebuilt" />
            <MarkTile tier="none" caption="Unsolved" />
          </Row>
        </Example>
      </Row>
    </Section>
  );
}
