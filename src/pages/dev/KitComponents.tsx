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
import { cardTitle } from "@/lib/theme/type";

export default function KitComponents() {
  const theme = useDesignTheme();

  return (
    <div
      data-design-page="components"
      data-design-theme={theme}
      style={{
        width: 1440,
        minHeight: "100vh",
        padding: "32px 40px",
        boxSizing: "border-box",
        background: t.bg,
        color: t.text,
      }}
    >
      <h1 style={{ ...cardTitle, margin: 0 }}>Component catalogue · {theme === "noon" ? "Noon" : "Dusk"}</h1>
      {/* UI-P06 onward: <section data-catalogue="Identity">…</section> and so on. */}
    </div>
  );
}
