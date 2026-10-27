/* SV-11: /dev/kit/pages/vision-builds-table?theme=noon|dusk&viewport=desktop|mobile

   `BuildsView` with the vision board's sample data, in the site frame with the board's page area. A vision page draws
   its own frame and its own `data-design-ready` (see `KitPages.tsx`): it says so once the fonts are in. */

import { useEffect, useState } from "react";

import { visionBuildsTableProps } from "@/dev/fixtures/vision/builds-table";
import { useDesignTheme } from "@/dev/useDesignTheme";
import { SiteFrameView } from "@/components/shell/SiteFrame";
import { BuildsView } from "@/pages/site/builds/BuildsView";

import { devChrome } from "./frameChrome";
import type { DesignPageProps } from "./KitPages";

export default function VisionBuildsTable({ viewport = "desktop", state = "populated" }: DesignPageProps) {
  const theme = useDesignTheme();
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
      data-design-page="vision-builds-table"
      data-design-theme={theme}
      data-design-viewport={viewport}
      data-design-state={state}
      style={{ width: viewport === "mobile" ? 390 : 1440 }}
    >
      <SiteFrameView viewport={viewport} fit="board" board {...devChrome({ theme, current: "gallery", trail: [{ label: "Home", href: "/" }, { label: "Builds" }], dockCurrent: null })}>
        <BuildsView {...visionBuildsTableProps()} />
      </SiteFrameView>
    </div>
  );
}
