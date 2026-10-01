/* UI-P17 — the site frame's chrome, fed from the sample data.

   The dev compare page renders `SiteFrameView` with these slots instead of the
   live ones, so a comparison tests the frame and not the database or the
   session. The viewer is `design/fixtures/sample-data.json → viewer`. UI-P17 adds
   the header; UI-P18 the breadcrumb and footer; UI-P19 the phone header and dock. */

import type { ReactNode } from "react";

import type { FrameViewer } from "@/components/shell/frameTypes";
import { SiteHeaderView } from "@/components/shell/SiteHeader";
import type { PrimarySection } from "@/components/shell/siteNav";
import { fixtures } from "@/dev/designFixtures";

/** The sample viewer, as the chrome takes it. */
export const FIXTURE_FRAME_VIEWER: FrameViewer = {
  id: fixtures.viewer.handle,
  name: fixtures.viewer.name,
  handle: fixtures.viewer.handle.replace(/^@/, ""),
  hue: fixtures.viewer.avatar_hue,
};

export interface DevChromeOptions {
  theme: "noon" | "dusk";
  /** Which primary link is current (the boards differ). */
  current?: PrimarySection | null;
  activityCurrent?: boolean;
}

export interface DevChrome {
  header?: ReactNode;
  breadcrumb?: ReactNode;
  footer?: ReactNode;
  mobileHeader?: ReactNode;
  dock?: ReactNode;
}

const noop = () => undefined;

export function devChrome({ theme, current = "gallery", activityCurrent = false }: DevChromeOptions): DevChrome {
  return {
    header: (
      <SiteHeaderView
        current={current}
        activityCurrent={activityCurrent}
        unread={fixtures.viewer.unread}
        viewer={FIXTURE_FRAME_VIEWER}
        theme={theme}
        onToggleTheme={noop}
        onSignIn={noop}
        onSignOut={noop}
        onNewBuild={noop}
      />
    ),
  };
}
