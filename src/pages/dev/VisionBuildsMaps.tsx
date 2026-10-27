/* SV-12: /dev/kit/pages/vision-builds-maps?theme=noon|dusk&viewport=desktop|mobile

   `BuildsMapsView` with the vision board's sample data, in the site frame with the board's page area. A vision page
   draws its own frame and its own `data-design-ready` (see `KitPages.tsx`): it says so once the fonts are in. */

import { useEffect, useState } from "react";

import { visionBuildsMapsProps } from "@/dev/fixtures/vision/builds-maps";
import { useDesignTheme } from "@/dev/useDesignTheme";
import { SiteFrameView } from "@/components/shell/SiteFrame";
import BuildsMapsView, { type MapsDirection } from "@/pages/site/builds/BuildsMapsView";

import { devChrome } from "./frameChrome";
import type { DesignPageProps } from "./KitPages";

export default function VisionBuildsMaps({ viewport = "desktop", state = "populated" }: DesignPageProps) {
  const theme = useDesignTheme();
  const [fontsReady, setFontsReady] = useState(false);
  const [direction, setDirection] = useState<MapsDirection>("horizontal");
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
      data-design-page="vision-builds-maps"
      data-design-theme={theme}
      data-design-viewport={viewport}
      data-design-state={state}
      style={{ width: viewport === "mobile" ? 390 : 1440 }}
    >
      <SiteFrameView viewport={viewport} fit="board" board {...devChrome({ theme, current: "gallery", trail: [{ label: "Home", href: "/" }, { label: "Builds" }], dockCurrent: null })}>
        <BuildsMapsView {...visionBuildsMapsProps({ direction, onDirection: setDirection })} />
      </SiteFrameView>
    </div>
  );
}
