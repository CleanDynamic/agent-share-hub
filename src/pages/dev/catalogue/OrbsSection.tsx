/* UI-P10 — the Orbs section: glass (a live count), solid (a total) and ring
   (progress as light), at the sizes the boards use. */

import { OrbGlass } from "@/components/brand/OrbGlass";
import { OrbRing } from "@/components/brand/OrbRing";
import { OrbSolid } from "@/components/brand/OrbSolid";

import { Example, Row, Section } from "./parts";

export function OrbsSection() {
  return (
    <Section name="Orbs" note="glass (a live count) · solid (a total) · ring (progress as light)">
      <Row>
        <Example caption="orb glass 162">
          <OrbGlass size={162} label="Reproduced today" sub="48 runs" />
        </Example>
        <Example caption="orb solid 162">
          <OrbSolid size={162} top="This week" value="312" bottom="runs reported" />
        </Example>
        <Example caption="orb ring 150">
          <OrbRing size={150} percent={77} value={7} caption="level" label="Level 7, 77% of the way to level 8" />
        </Example>
        <Example caption="orb glass 118">
          <OrbGlass size={118} label="41 ran it" sub="last 27 Sep" />
        </Example>
      </Row>
    </Section>
  );
}
