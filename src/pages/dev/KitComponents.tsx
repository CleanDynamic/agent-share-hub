/* UI-P01 — /dev/kit/components?theme=noon|dusk, the component catalogue.

   The compare target for `design/reference/components/{noon,dusk}.html`. It
   starts empty: UI-P06 to UI-P15 each add the sections they build, one
   `<section data-catalogue="<name>">` per section of the reference, using the
   reference's own names (Identity, Controls, Proof, Panels, Orbs, Tagline,
   Build cards, Charts, Frame). `design-compare.spec.ts` screenshots every
   section present on both sides, so the attribute value is load-bearing: it is
   the join key.

   1440px WIDE because the reference catalogue is. DEV ONLY: registered behind
   `import.meta.env.DEV` in App.tsx, so it is not in a production bundle. */

import { useDesignTheme } from "@/dev/useDesignTheme";
import { t } from "@/lib/theme/tokens";
import { display, FIGTREE, mono } from "@/lib/theme/type";

import { ControlsSection } from "./catalogue/ControlsSection";
import { IdentitySection } from "./catalogue/IdentitySection";
import { PanelsSection } from "./catalogue/PanelsSection";
import { ProofSection } from "./catalogue/ProofSection";

export default function KitComponents() {
  const theme = useDesignTheme();

  return (
    <div
      data-design-page="components"
      data-design-theme={theme}
      style={{
        width: 1440,
        minHeight: "100vh",
        boxSizing: "border-box",
        background: `${t.ambient}, ${t.backdrop}`,
        color: t.text,
        fontFamily: FIGTREE,
      }}
    >
      <header style={{ padding: "36px 40px 10px" }}>
        <div style={{ ...mono(12), lineHeight: "normal", letterSpacing: ".1em", color: t.label, textTransform: "uppercase" }}>
          buildgallery · component catalogue · {theme === "noon" ? "Noon" : "Dusk"}
        </div>
        <h1 style={{ ...display(56), margin: "8px 0 0", lineHeight: "normal", letterSpacing: "-0.035em", color: t.text }}>
          Every primitive, every state
        </h1>
      </header>
      <IdentitySection />
      <ControlsSection />
      <ProofSection />
      <PanelsSection />
      {/* UI-P10 onward: Panels, Orbs, Tagline, Build cards, Charts, Frame. */}
    </div>
  );
}
