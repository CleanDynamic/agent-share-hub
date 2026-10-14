/* UI-P09 — the Panels section: glass and flat panels, the panel head, the wall
   label with its stats and details, and the striped bar. */

import { ChevronRight, Maximize2 } from "lucide-react";

import { CardHead } from "@/components/brand/CardHead";
import { Detail } from "@/components/brand/Detail";
import { Figure } from "@/components/brand/Figure";
import { IconButton } from "@/components/brand/IconButton";
import { Panel, PanelHead } from "@/components/brand/Panel";
import { Plaque } from "@/components/brand/Plaque";
import { Row as DataRow } from "@/components/brand/Row";
import { Stat } from "@/components/brand/Stat";
import { StripedBar } from "@/components/brand/StripedBar";
import { Tile, Well } from "@/components/brand/Tile";
import { Timeline } from "@/components/brand/Timeline";
import { WallLabel } from "@/components/brand/WallLabel";
import { useLook } from "@/lib/theme/look";
import { t } from "@/lib/theme/tokens";

import { Example, Row, Section } from "./parts";

const TOP = { alignItems: "flex-start" } as const;

/** UI-P85 — the refined look's layers and data marks, drawn from `components.html` (Progress, Rows, Timeline, Card). */
function RefinedBlocks() {
  const now = Date.parse("2026-10-14T12:00:00Z");
  const day = 86_400_000;
  const build = (count: number, confirmedDaysAgo: number | null) => ({
    reproduction_count: count,
    last_confirmed_at: confirmedDaysAgo === null ? null : new Date(now - confirmedDaysAgo * day).toISOString(),
    last_confirmed_model: confirmedDaysAgo === null ? null : "sonnet-4.5",
    published_at: new Date(now - 200 * day).toISOString(),
  });
  return (
    <Row style={TOP}>
      <Example caption="card · head, action, progress">
        <div style={{ width: 360 }}>
          <Panel surface="glass" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <CardHead
              title="This week’s challenges"
              subtitle="Resets Monday 00:00 UTC"
              action={<IconButton icon={ChevronRight} label="Open this week" size={34} />}
            />
            <StripedBar value={33} colour={t.lit} height={6} label="Run three builds, 1 of 3" />
          </Panel>
        </div>
      </Example>
      <Example caption="tile · completeness, ticks at publish 60 and gallery 80">
        <div style={{ width: 420 }}>
          <Tile style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <DataRow label="Completeness" value="86 / 100" style={{ borderBottom: "none", minHeight: 0 }} />
            <StripedBar
              value={86}
              colour={t.evidence}
              height={6}
              label="Completeness"
              ticks={[
                { at: 60, colour: t.label, label: "Publish 60" },
                { at: 80, colour: t.label, label: "Gallery 80" },
              ]}
            />
          </Tile>
        </div>
      </Example>
      <Example caption="rows · in a module, 40 and 48 · figure">
        <div style={{ width: 300 }}>
          <Panel surface="glass" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Figure label="Streak" lamp value="12" unit="days" />
            <div>
              <DataRow inModule label="Reproductions" value="41" />
              <DataRow inModule height={48} label="Last confirmed" value="3 days ago" />
            </div>
          </Panel>
        </div>
      </Example>
      <Example caption="well · dot grid">
        <Well dots style={{ width: 200, height: 96 }} />
      </Example>
      <Example caption="timeline">
        <div style={{ width: 300 }}>
          <Timeline
            events={[
              { kind: "breakage", at: "11:40", text: "Failed on euro totals" },
              { kind: "prompt", at: "18:05", text: "Asked for totals in pence" },
              { kind: "deploy", at: "26:30", text: "Running on the shared inbox" },
            ]}
          />
        </div>
      </Example>
      <Example caption="plaque · fresh, stale, not yet reproduced">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Plaque build={build(41, 3)} now={now} />
          <Plaque build={build(12, 130)} now={now} />
          <Plaque build={build(0, null)} now={now} />
        </div>
      </Example>
    </Row>
  );
}

export function PanelsSection() {
  const refined = useLook() === "refined";
  return (
    <Section
      name="Panels"
      note="liquid glass panel · plain panel · flat panel (workspace) · panel head · wall label · stat · striped bar"
    >
      <Row style={TOP}>
        <Example caption="panel · glass (liquid)">
          <div style={{ width: 320, height: 150 }}>
            <Panel surface="glass" padding="14px 16px" style={{ height: "100%" }}>
              <PanelHead
                title="Liquid glass panel"
                subtitle="page-level, on the backdrop"
                right={<IconButton icon={Maximize2} label="Open" size={34} />}
              />
            </Panel>
          </div>
        </Example>
        <Example caption="panel · plain">
          <div style={{ width: 320, height: 150 }}>
            <Panel surface="plain" padding="14px 16px" style={{ height: "100%" }}>
              <PanelHead title="Plain panel" subtitle="inside a panel or a grid" />
            </Panel>
          </div>
        </Example>
        <Example caption="panel · flat">
          <div style={{ width: 320, height: 150 }}>
            <Panel surface="flat" padding="14px 16px" style={{ height: "100%" }}>
              <PanelHead title="Flat panel" subtitle="compose / import only" />
            </Panel>
          </div>
        </Example>
        <Example caption="wall label + stats">
          <div style={{ width: 560 }}>
            <WallLabel
              columns={3}
              cells={[
                <Stat key="a" label="In the gallery" value="1,284" />,
                <Stat
                  key="b"
                  label="Reproduced this week"
                  value="312"
                  bar={{ value: 78, colour: t.lit, label: "Reproduced this week, 78% of target" }}
                />,
                <Stat
                  key="c"
                  label="Fresh"
                  value="86%"
                  bar={{ value: 86, colour: t.evidence, label: "Builds confirmed within 120 days" }}
                />,
              ]}
            />
          </div>
        </Example>
      </Row>
      <div style={{ height: 18 }} />
      <Row style={TOP}>
        <Example caption="wall label · details">
          <div style={{ width: 420 }}>
            <WallLabel
              columns={3}
              cells={[
                <Detail key="a" label="Made for" value="finance ops" />,
                <Detail key="b" label="Made with" value="sonnet-4.5" />,
                <Detail key="c" label="Monthly" value="£12" />,
              ]}
            />
          </div>
        </Example>
        <Example caption="striped bar · lamp · ticks at publish 60 and gallery threshold">
          <div style={{ width: 360 }}>
            <StripedBar
              value={86}
              colour={t.lit}
              height={11}
              label="Completeness"
              ticks={[
                { at: 60, colour: t.text2 },
                { at: 80, colour: t.text },
              ]}
            />
          </div>
        </Example>
        <Example caption="striped bar · action">
          <div style={{ width: 200 }}>
            <StripedBar value={50} colour={t.action} height={9} label="Bounty funded" />
          </div>
        </Example>
      </Row>
      {refined ? (
        <>
          <div style={{ height: 18 }} />
          <RefinedBlocks />
        </>
      ) : null}
    </Section>
  );
}
