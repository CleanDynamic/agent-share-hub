/* SV-18: /dev/kit/pages/vision-composer-add-from-library?theme=noon|dusk&state=…

   `AddFromLibraryWindow` over a still of the composer, with the board's sample data. The still is drawn as the board draws it
   (three session columns, the second one chosen); it is not the live composer. A vision page draws its own frame and its own
   `data-design-ready` (see `KitPages.tsx`): it says so once the fonts are in. */

import { useEffect, useState, type CSSProperties } from "react";

import { visionAddFromLibraryProps } from "@/dev/fixtures/vision/composer-add-from-library";
import { useDesignState, useDesignTheme } from "@/dev/useDesignTheme";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { AddFromLibraryWindow } from "@/pages/site/compose/AddFromLibraryWindow";

import type { DesignPageProps } from "./KitPages";

const column = (chosen: boolean): CSSProperties => ({ padding: 16, background: t.window, border: `1px solid ${chosen ? t.selectedEdge : t.moduleBorder}`, borderRadius: 8, height: 420, boxSizing: "border-box" });

function ComposerStill() {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, padding: "0 6px" }}>
      <div style={{ height: 56, display: "flex", alignItems: "center", gap: 16, padding: "0 20px", fontWeight: 600, fontSize: 14 }}>
        buildgallery <span style={{ fontWeight: 400, color: t.label }}>/ Drafts / Invoice chaser</span>
      </div>
      <div style={{ height: 838, background: t.surface, border: `1px solid ${t.surfaceBorder}`, borderRadius: 10, padding: "32px 76px", boxSizing: "border-box" }}>
        <div style={{ fontSize: 20, fontWeight: 500 }}>Invoice chaser</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginTop: 32 }}>
          <div style={column(false)}><div style={{ fontWeight: 500 }}>Session 1</div></div>
          <div style={column(true)}><div style={{ fontWeight: 500 }}>Session 2 · Clean-up agent</div></div>
          <div style={column(false)}><div style={{ fontWeight: 500 }}>Session 3</div></div>
        </div>
      </div>
    </div>
  );
}

export default function VisionComposerAddFromLibrary({ viewport = "desktop" }: DesignPageProps) {
  const theme = useDesignTheme();
  const state = useDesignState();
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let live = true;
    const done = () => live && setFontsReady(true);
    if (typeof document !== "undefined" && document.fonts?.ready) void document.fonts.ready.then(done, done);
    else done();
    return () => {
      live = false;
    };
  }, []);

  return (
    <div
      data-design-ready={fontsReady ? "true" : "false"}
      data-design-page="vision-composer-add-from-library"
      data-design-theme={theme}
      data-design-viewport={viewport}
      data-design-state={state}
      style={{ position: "relative", width: viewport === "mobile" ? 390 : 1440, height: 900, overflow: "hidden", background: t.frame, color: t.text, fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", fontVariantNumeric: "tabular-nums" }}
    >
      <ComposerStill />
      <AddFromLibraryWindow {...visionAddFromLibraryProps(state)} phone={viewport === "mobile"} />
    </div>
  );
}
