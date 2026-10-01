/* UI-P08 — the Proof section: the lamp dot, the picture lamp and the plaque, in
   each of the three states. The fixture builds are the reference's own: 41
   reproduced three days ago on sonnet-4.5; 12 reproduced four months ago on
   gpt-5; and one nobody has reproduced. `FIXTURE_NOW` is frozen so "3 days ago"
   is the same on every run. */

import { LampDot } from "@/components/brand/LampDot";
import { PictureLamp } from "@/components/brand/PictureLamp";
import { Plaque, type PlaqueBuild } from "@/components/brand/Plaque";
import { t } from "@/lib/theme/tokens";

import { Example, Row, Section } from "./parts";

const DAY = 86_400_000;
const NOW = Date.parse("2026-09-01T12:00:00Z");
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

const FRESH: PlaqueBuild = {
  reproduction_count: 41,
  rebuild_count: 0,
  last_confirmed_at: ago(3),
  last_confirmed_model: "sonnet-4.5",
  published_at: ago(60),
};
const STALE: PlaqueBuild = {
  reproduction_count: 12,
  rebuild_count: 0,
  last_confirmed_at: ago(125),
  last_confirmed_model: "gpt-5",
  published_at: ago(300),
};
const NEVER: PlaqueBuild = {
  reproduction_count: 0,
  rebuild_count: 0,
  last_confirmed_at: null,
  last_confirmed_model: null,
  published_at: ago(10),
};

export function ProofSection() {
  return (
    <Section
      name="Proof"
      note="the lamp: lit while confirmed · dimmed when stale (> 120 days) · absent when never reproduced"
    >
      <Row>
        <Example caption="lamp dot · on">
          <LampDot />
        </Example>
        <Example caption="lamp dot · stale">
          <LampDot dim />
        </Example>
        <Example caption="picture lamp · on">
          <div style={{ width: 240 }}>
            <PictureLamp state="healthy" />
          </div>
        </Example>
        <Example caption="picture lamp · stale">
          <div style={{ width: 240 }}>
            <PictureLamp state="stale" />
          </div>
        </Example>
        <Example caption="picture lamp · none (spacer)">
          <div style={{ width: 240, outline: `1px dashed ${t.line}` }}>
            <PictureLamp state="unreproduced" />
          </div>
        </Example>
      </Row>
      <div style={{ height: 18 }} />
      <Row>
        <Example caption="plaque · fresh">
          <Plaque build={FRESH} now={NOW} size="card" />
        </Example>
        <Example caption="plaque · stale">
          <Plaque build={STALE} now={NOW} size="card" />
        </Example>
        <Example caption="plaque · never reproduced">
          <Plaque build={NEVER} now={NOW} size="card" />
        </Example>
      </Row>
    </Section>
  );
}
