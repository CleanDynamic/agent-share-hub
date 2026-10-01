/* UI-P09 — the Panels section: glass and flat panels, the panel head, the wall
   label with its stats and details, and the striped bar. */

import { Maximize2 } from "lucide-react";

import { Detail } from "@/components/brand/Detail";
import { IconButton } from "@/components/brand/IconButton";
import { Panel, PanelHead } from "@/components/brand/Panel";
import { Stat } from "@/components/brand/Stat";
import { StripedBar } from "@/components/brand/StripedBar";
import { WallLabel } from "@/components/brand/WallLabel";
import { t } from "@/lib/theme/tokens";

import { Example, Row, Section } from "./parts";

const TOP = { alignItems: "flex-start" } as const;

export function PanelsSection() {
  return (
    <Section
      name="Panels"
      note="glass panel · flat panel (workspace) · panel head · wall label · stat · striped bar"
    >
      <Row style={TOP}>
        <Example caption="panel · glass">
          <div style={{ width: 320, height: 150 }}>
            <Panel variant="glass" padding="14px 16px" style={{ height: "100%" }}>
              <PanelHead
                title="Glass panel"
                subtitle="reading surfaces"
                right={<IconButton icon={Maximize2} label="Open" size={34} />}
              />
            </Panel>
          </div>
        </Example>
        <Example caption="panel · flat">
          <div style={{ width: 320, height: 150 }}>
            <Panel variant="flat" padding="14px 16px" style={{ height: "100%" }}>
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
    </Section>
  );
}
