/* UI-P06 — the Identity section: mark, lockup, cover fallback. */

import { CoverFallback } from "@/components/brand/CoverFallback";
import { Lockup } from "@/components/brand/Lockup";
import { Mark } from "@/components/brand/Mark";
import { useRoom } from "@/components/brand/useRoom";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

import { Example, Row, Section } from "./parts";

const LOCKUPS = [
  { size: 19, caption: "lockup 19 (mobile header)" },
  { size: 21, caption: "lockup 21 (site header)" },
  { size: 64, caption: "lockup 64 (sign in)" },
] as const;

export function IdentitySection() {
  const dusk = useRoom() === "dusk";

  return (
    <Section
      name="Identity"
      note="mark · lockup · cover fallback (6 skies, chosen by a hash of the build id)"
    >
      <Row style={{ color: t.text }}>
        <Example caption="mark 20">
          <Mark size={20} />
        </Example>
        <Example caption="mark 40 · Dusk halo">
          <Mark size={40} halo={dusk} />
        </Example>
        <Example caption="mark 74">
          <Mark size={74} />
        </Example>
        {LOCKUPS.map(({ size, caption }) => (
          <Example key={size} caption={caption}>
            <Lockup size={size} />
          </Example>
        ))}
      </Row>
      <div style={{ height: 16 }} />
      <Row gap={12}>
        {[0, 1, 2, 3, 4, 5].map((sky) => (
          <Example key={sky} caption={`sky ${sky}`}>
            <div style={{ width: 180, height: 110, borderRadius: r.media, overflow: "hidden" }}>
              <CoverFallback seed={`sky-${sky}`} sky={sky} radius={r.media} />
            </div>
          </Example>
        ))}
      </Row>
    </Section>
  );
}
