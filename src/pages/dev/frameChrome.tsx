/* UI-P17 — the site frame's chrome, fed from the sample data.

   The dev compare page renders `SiteFrameView` with these slots instead of the
   live ones, so a comparison tests the frame and not the database or the
   session. The viewer is `design/fixtures/sample-data.json → viewer`. UI-P17 adds
   the header; UI-P18 the breadcrumb and footer; UI-P19 the phone header and dock. */

import type { ReactNode } from "react";

import { DockView, type DockViewProps } from "@/components/shell/Dock";
import { MobileHeaderView } from "@/components/shell/MobileHeader";
import { BreadcrumbView } from "@/components/shell/Breadcrumb";
import type { FrameViewer } from "@/components/shell/frameTypes";
import { SiteFooterView } from "@/components/shell/SiteFooter";
import { SiteHeaderView } from "@/components/shell/SiteHeader";
import type { PrimarySection } from "@/components/shell/siteNav";
import { ThemeSegmented } from "@/components/theme/ThemeSegmented";
import { fixtures } from "@/dev/designFixtures";

import type { Crumb } from "@/components/shell/breadcrumbTrail";

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
  /** The compose board: New build draws as secondary, because Publish is the page's one primary. */
  composing?: boolean;
  /** The breadcrumb trail the board shows. Defaults to Home / Gallery / the sample build. */
  trail?: readonly Crumb[];
  /** Which dock tile has the lamp on the phone boards. */
  dockCurrent?: DockViewProps["current"];
}

export interface DevChrome {
  header?: ReactNode;
  breadcrumb?: ReactNode;
  footer?: ReactNode;
  mobileHeader?: ReactNode;
  dock?: ReactNode;
}

const noop = () => undefined;

/** The sample build's title, for the trails that end in a record. */
export const FIXTURE_BUILD_TITLE = fixtures.builds[fixtures.build_page.build - 1].title;

const DEFAULT_TRAIL: Crumb[] = [
  { label: "Home", href: "/" },
  { label: "Gallery", href: "/gallery" },
  { label: FIXTURE_BUILD_TITLE },
];

export function devChrome({ theme, current = "gallery", activityCurrent = false, composing = false, trail = DEFAULT_TRAIL, dockCurrent = "gallery" }: DevChromeOptions): DevChrome {
  return {
    header: (
      <SiteHeaderView
        current={current}
        activityCurrent={activityCurrent}
        composing={composing}
        unread={fixtures.viewer.unread}
        viewer={FIXTURE_FRAME_VIEWER}
        theme={theme}
        onToggleTheme={noop}
        onSignIn={noop}
        onSignOut={noop}
        onNewBuild={noop}
      />
    ),
    mobileHeader: (
      <MobileHeaderView viewer={FIXTURE_FRAME_VIEWER} onSearchOpen={noop} onAccountOpen={noop} onSignIn={noop} />
    ),
    dock: <DockView current={dockCurrent} unread={fixtures.viewer.unread} />,
    breadcrumb: <BreadcrumbView trail={trail} />,
    footer: (
      <SiteFooterView
        signedIn
        onSignOut={noop}
        onConnect={noop}
        themeControl={<ThemeSegmented size={32} fontSize={11} value={theme} onChange={noop} />}
      />
    ),
  };
}
