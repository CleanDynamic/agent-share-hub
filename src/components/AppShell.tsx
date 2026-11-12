import { useState } from "react";
import { useLocation } from "react-router-dom";

import { FrameChromeContext } from "@/components/shell/frameChrome";
import { FrameOutlet } from "@/components/shell/FrameOutlet";
import { SiteFrame } from "@/components/shell/SiteFrame";
import { matchRoute } from "@/lib/routing/routeTable";

/* SV-04 P4: one frame for the site and the composer. What the frame needs to know about a page (the composer's `wide`
   and its "Skip to build") comes from the matched route's entry in the route table, so no page draws a SiteFrame of its
   own; a legacy workspace hides the chrome through `useHideFrameChrome`. */
export function AppShell() {
  const { pathname } = useLocation();
  const frame = matchRoute(pathname)?.entry.frame;
  const [chromeHidden, setChromeHidden] = useState(false);
  const SkipLink = frame?.SkipLink;
  return (
    <FrameChromeContext.Provider value={setChromeHidden}>
      <SiteFrame wide={frame?.wide} skipLink={SkipLink ? <SkipLink /> : undefined} chrome={!chromeHidden}>
        <FrameOutlet />
      </SiteFrame>
    </FrameChromeContext.Provider>
  );
}

export default AppShell;
