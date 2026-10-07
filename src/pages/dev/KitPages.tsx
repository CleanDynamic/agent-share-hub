/* UI-P01 — /dev/kit/pages/:page?theme=noon|dusk&viewport=desktop|mobile.

   The compare target for the page boards in `design/reference/{desktop,mobile}`.
   It renders a pure page view (`HomeView`, `GalleryView`, …) with the sample
   data from `src/dev/designFixtures.ts`, so a comparison tests the UI and not
   the database.

   A page that has no view yet renders `data-design-ready="false"`, which is
   what `design-compare.spec.ts` reads to skip the pair with a message instead
   of failing it. Each page prompt (UI-P27 to UI-P36) adds its entry to `VIEWS`
   and the pair starts being compared.

   DEV ONLY: registered behind `import.meta.env.DEV` in App.tsx. */

import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { useParams } from "react-router-dom";
import { SiteFrameView } from "@/components/shell/SiteFrame";
import { useDesignState, useDesignTheme, useDesignViewport, type DesignState, type DesignViewport } from "@/dev/useDesignTheme";

import type { Crumb } from "@/components/shell/breadcrumbTrail";

import { fixtures } from "@/dev/designFixtures";

import { FIXTURE_BUILD_TITLE, devChrome, type DevChromeOptions } from "./frameChrome";

/** What a registered compare entry receives. The view reads the 768px breakpoint itself; this is for sizing the wrapper. */
export interface DesignPageProps {
  viewport: DesignViewport;
  /** Page views are compared in `board` fit (UI-P16). */
  fit?: "board" | "content";
  /**
   * UI-P37 — `?state=loading|empty|error` draws that state of the page from the
   * same sample data, in the same frame and the same fit. Absent (or anything
   * else) is the populated board, which is what the reference images show.
   */
  state?: DesignState;
}

/** `:page` (the `page` field of `design/reference/index.json`) → a lazy entry that renders the view with fixtures. */
const VIEWS: Record<string, LazyExoticComponent<ComponentType<DesignPageProps>> | undefined> = {
  /* UI-P13 — a throwaway for the page backdrop; not a board, so not in index.json. */
  backdrop: lazy(() => import("./BackdropDemo")),
  /* UI-P16 — the empty frame: backdrop, empty slots, the 820px grid placeholder. */
  frame: lazy(() => import("./FrameDemo")),
  /* UI-P27 — Home. */
  home: lazy(() => import("./HomeDemo")),
  /* UI-P28 — Gallery. */
  gallery: lazy(() => import("./GalleryDemo")),
  /* UI-P49 — the Gallery feed (no board is compared). */
  "gallery-feed": lazy(() => import("./GalleryFeedDemo")),
  /* UI-P29 — the Build page's first screen. */
  build: lazy(() => import("./BuildDemo")),
  /* UI-P31 — Rebuild, and the lineage page built from the same pieces (no board). */
  rebuild: lazy(() => import("./RebuildDemo")),
  lineage: lazy(() => import("./LineageDemo")),
  /* UI-P34 — Profile. */
  profile: lazy(() => import("./ProfileDemo")),
  /* UI-P35 — Activity. */
  activity: lazy(() => import("./ActivityDemo")),
  /* UI-P46 — Drafts (no board is compared). */
  drafts: lazy(() => import("./DraftsDemo")),
  /* UI-P47 — the composer (no board is compared). */
  compose: lazy(() => import("./ComposeDemo")),
  /* UI-P37 — the Bounties board, for its four states (no reference board is compared). */
  "bounty-board": lazy(() => import("./BountyBoardDemo")),
  /* UI-P36 — Sign in (and, with `?mode=`, Join, reset and verify). */
  signin: lazy(() => import("./SignInDemo")),
};

/** Entries that draw their own room and are not wrapped in the site frame (Sign in draws the bare one itself). */
const UNFRAMED = new Set(["backdrop", "signin"]);

/** The trail a board draws, where it is not the default Home / Gallery / the sample build. */
const TRAILS: Record<string, readonly Crumb[]> = {
  rebuild: [
    { label: "Home", href: "/" },
    { label: "Gallery", href: "/gallery" },
    { label: FIXTURE_BUILD_TITLE, href: "/b2/invoice-triage-agent" },
    { label: "Rebuild" },
  ],
  lineage: [
    { label: "Home", href: "/" },
    { label: "Gallery", href: "/gallery" },
    { label: FIXTURE_BUILD_TITLE, href: "/b2/invoice-triage-agent" },
    { label: "Lineage" },
  ],
  profile: [{ label: "Home", href: "/" }, { label: fixtures.viewer.name }],
  activity: [{ label: "Home", href: "/" }, { label: "Activity" }],
  drafts: [{ label: "Home", href: "/" }, { label: "Drafts" }],
  compose: [{ label: "Home", href: "/" }, { label: "Drafts", href: "/drafts" }, { label: "Photo renamer by date taken" }],
};

/** Where a board lights a different nav item than the default (the Gallery's): the Profile board lights Home in the header and on the dock; the Activity board lights no link, the bell, and the dock's Activity tile. */
const CHROME: Record<string, Partial<DevChromeOptions>> = {
  profile: { current: "home", dockCurrent: "home" },
  activity: { current: null, activityCurrent: true, dockCurrent: "activity" },
  drafts: { current: "drafts", dockCurrent: null },
  compose: { current: "drafts", dockCurrent: null },
};

const WIDTH: Record<DesignViewport, number> = { desktop: 1440, mobile: 390 };

export default function KitPages() {
  const { page = "" } = useParams();
  const theme = useDesignTheme();
  const viewport = useDesignViewport();
  const state = useDesignState();
  const View = Object.prototype.hasOwnProperty.call(VIEWS, page) ? VIEWS[page] : undefined;

  if (!View) return <div data-design-ready="false">Not built yet</div>;

  return (
    <div
      data-design-ready="true"
      data-design-page={page}
      data-design-theme={theme}
      data-design-viewport={viewport}
      data-design-state={state}
      style={{ width: WIDTH[viewport] }}
    >
      <Suspense fallback={null}>
        {UNFRAMED.has(page) ? (
          <View viewport={viewport} fit="board" state={state} />
        ) : (
          <SiteFrameView viewport={viewport} {...devChrome({ theme, trail: TRAILS[page], ...CHROME[page] })}>
            <View viewport={viewport} fit="board" state={state} />
          </SiteFrameView>
        )}
      </Suspense>
    </div>
  );
}
