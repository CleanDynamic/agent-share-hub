/* SV-10: /dev/kit/pages/vision-home?theme=noon|dusk&viewport=desktop|mobile&state=…

   `HomeView` with the vision board's sample data, in the site frame with the board's page area. A vision page draws
   its own frame and its own `data-design-ready` (see `KitPages.tsx`): it says so once the fonts are in. */

import { useEffect, useState } from "react";

import { visionHomeProps } from "@/dev/fixtures/vision/home";
import { useDesignTheme } from "@/dev/useDesignTheme";
import { SiteFrameView } from "@/components/shell/SiteFrame";
import { HomeView } from "@/pages/site/home/HomeView";

import { devChrome } from "./frameChrome";
import type { DesignPageProps } from "./KitPages";

export default function VisionHome({ viewport = "desktop", state = "populated" }: DesignPageProps) {
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
      data-design-page="vision-home"
      data-design-theme={theme}
      data-design-viewport={viewport}
      data-design-state={state}
      style={{ width: viewport === "mobile" ? 390 : 1440 }}
    >
      <SiteFrameView viewport={viewport} fit="board" board="home" {...devChrome({ theme, current: "home", trail: [{ label: "Home" }], dockCurrent: null })}>
        <HomeView {...visionHomeProps(state)} />
      </SiteFrameView>
    </div>
  );
}
