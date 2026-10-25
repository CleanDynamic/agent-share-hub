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
import { SkipToBuild } from "@/pages/site/compose/buildFocus";
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
  /* UI-P16 — the empty frame: backdrop, empty slots, the 820px grid placeholder. */
  frame: lazy(() => import("./FrameDemo")),
  /* UI-P27 — Home. */
  home: lazy(() => import("./HomeDemo")),
  /* UI-P28 — Gallery. */
  /* UI-P49 — the Gallery feed (no board is compared). */
  "gallery-feed": lazy(() => import("./GalleryFeedDemo")),
  /* UI-P50 — the Gallery dashboard (no board is compared). */
  "gallery-dashboard": lazy(() => import("./GalleryDashboardDemo")),
  /* UI-P29 — the Build page's first screen. */
  build: lazy(() => import("./BuildDemo")),
  /* UI-P73 — the build page with the steps drawn (no board image is compared). */
  "build-steps": lazy(() => import("./BuildStepsDemo")),
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
  /* UI-P63 — the new composer's frame (no board image is compared). */
  sandbox: lazy(() => import("./SandboxDemo")),
  /* CA-16 — the Classification Card, and the Gallery with the classification filters (no board is compared). */
  classification: lazy(() => import("./ClassificationDemo")),
  /* CA-15b: each tile modal open on its own, and a List with every kind of tile (no board image is in the repo). */
  modals: lazy(() => import("./ModalsDemo")),
  /* UI-P37 — the Bounties board, for its four states (no reference board is compared). */
  "bounty-board": lazy(() => import("./BountyBoardDemo")),
  /* PT-03 — the post thread, closed, open and in page mode (no board is compared). */
  "post-thread": lazy(() => import("./PostThreadDemo")),
  /* UI-P36 — Sign in (and, with `?mode=`, Join, reset and verify). */
  signin: lazy(() => import("./SignInDemo")),
  /* SV-02 — the vision boards (`design/reference/vision/index.json`). Each says "Not built yet" until its page prompt
     replaces the entry: SV-10 home, SV-14 openbuilds, SV-11 builds-table, SV-12 builds-maps, SV-13
     builds-classification, SV-09 library, SV-18 composer-add-from-library, SV-08 drafts. */
  "vision-home": lazy(() => import("./VisionNotBuilt")),
  "vision-openbuilds": lazy(() => import("./VisionNotBuilt")),
  "vision-builds-table": lazy(() => import("./VisionNotBuilt")),
  "vision-builds-maps": lazy(() => import("./VisionNotBuilt")),
  "vision-builds-classification": lazy(() => import("./VisionNotBuilt")),
  "vision-library": lazy(() => import("./VisionNotBuilt")),
  "vision-composer-add-from-library": lazy(() => import("./VisionNotBuilt")),
  "vision-drafts": lazy(() => import("./VisionNotBuilt")),
};

/** A vision page draws its own frame and its own `data-design-ready`, so the wrapper below stays out of its way. */
const isVision = (page: string): boolean => page.startsWith("vision-");

/** Entries that draw their own room and are not wrapped in the site frame (Sign in draws the bare one itself). */
const UNFRAMED = new Set(["backdrop", "signin"]);

/** UI-P91: `build-steps?part=steps` is the Map board, a bare surface the dev page draws itself. */
const isBare = (page: string, search: string): boolean => page === "build-steps" && new URLSearchParams(search).get("part") === "steps";

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
  /* UI-P57: the Home board draws Home alone. */
  home: [{ label: "Home" }],
  /* UI-P56: the Gallery board draws Home / Gallery, not the default trail's sample build. */
  "gallery-feed": [{ label: "Home", href: "/" }, { label: "Gallery" }],
  classification: [{ label: "Home", href: "/" }, { label: "Gallery" }],
  "gallery-dashboard": [{ label: "Home", href: "/" }, { label: "Gallery" }],
  profile: [{ label: "Home", href: "/" }, { label: fixtures.viewer.name }],
  activity: [{ label: "Home", href: "/" }, { label: "Activity" }],
  drafts: [{ label: "Home", href: "/" }, { label: "Drafts" }],
  compose: [{ label: "Home", href: "/" }, { label: "Drafts", href: "/drafts" }, { label: "Photo renamer by date taken" }],
  sandbox: [{ label: "Home", href: "/" }, { label: "Drafts", href: "/drafts" }, { label: "A fox poster" }],
};

/** Where a board lights a different nav item than the default (the Gallery's): the Profile board lights Home in the header and on the dock; the Activity board lights no link, the bell, and the dock's Activity tile. */
const CHROME: Record<string, Partial<DevChromeOptions>> = {
  /* UI-P57: the Home board lights Home in the header and on the dock, not the Gallery. */
  home: { current: "home", dockCurrent: "home" },
  frame: { current: "home", dockCurrent: "home" },
  profile: { current: "home", dockCurrent: "home" },
  activity: { current: null, activityCurrent: true, dockCurrent: "activity" },
  drafts: { current: "drafts", dockCurrent: null },
  compose: { current: "drafts", dockCurrent: null },
  sandbox: { current: "drafts", dockCurrent: null },
};

const WIDTH: Record<DesignViewport, number> = { desktop: 1440, mobile: 390 };

export default function KitPages() {
  const { page = "" } = useParams();
  const theme = useDesignTheme();
  const viewport = useDesignViewport();
  const state = useDesignState();
  const View = Object.prototype.hasOwnProperty.call(VIEWS, page) ? VIEWS[page] : undefined;

  if (!View) return <div data-design-ready="false">Not built yet</div>;

  if (isVision(page)) {
    return (
      <Suspense fallback={<div data-design-ready="false">Loading</div>}>
        <View viewport={viewport} fit="board" state={state} />
      </Suspense>
    );
  }

  return (
    <div
      data-design-ready="true"
      data-design-page={page}
      data-design-theme={theme}
      data-design-viewport={viewport}
      data-design-state={state}
      style={{ width: page === "sandbox" && new URLSearchParams(window.location.search).has("window") ? "100%" : WIDTH[viewport] }}
    >
      <Suspense fallback={null}>
        {UNFRAMED.has(page) || isBare(page, window.location.search) ? (
          <View viewport={viewport} fit="board" state={state} />
        ) : (
          <SiteFrameView viewport={viewport} fit="board" wide={page === "sandbox"} skipLink={page === "sandbox" ? <SkipToBuild /> : undefined} {...devChrome({ theme, trail: TRAILS[page], ...CHROME[page] })}>
            <View viewport={viewport} fit="board" state={state} />
          </SiteFrameView>
        )}
      </Suspense>
    </div>
  );
}
