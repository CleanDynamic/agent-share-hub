/* UI-P11 — the Tagline section: the three-chip tagline at the two sizes the
   reference catalogue shows (46 on desktop Home, 30 on mobile Home). */

import { Tagline } from "@/components/brand/Tagline";

import { Example, Row, Section } from "./parts";

const LINES = ["Every AI build,", "hung with", "its proof."] as const;

export function TaglineSection() {
  return (
    <Section name="Tagline" note="three Sentient lines on filled chips; the middle line carries the mark">
      <Row style={{ alignItems: "flex-start" }}>
        <Example caption="tagline 46 (desktop home)">
          <Tagline lines={LINES} size={46} offsets={[0, 90, 30]} as="h2" />
        </Example>
        <Example caption="tagline 30 (mobile)">
          <Tagline lines={LINES} size={30} offsets={[0, 44, 14]} as="h2" />
        </Example>
      </Row>
    </Section>
  );
}
