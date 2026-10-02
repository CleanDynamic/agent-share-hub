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
import { useDesignTheme, useDesignViewport, type DesignViewport } from "@/dev/useDesignTheme";

import type { Crumb } from "@/components/shell/breadcrumbTrail";

import { fixtures } from "@/dev/designFixtures";

import { FIXTURE_BUILD_TITLE, devChrome, type DevChromeOptions } from "./frameChrome";

/** What a registered compare entry receives. The view reads the 768px breakpoint itself; this is for sizing the wrapper. */
export interface DesignPageProps {
  viewport: DesignViewport;
  /** Page views are compared in `board` fit (UI-P16). */
  fit?: "board" | "content";
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
  /* UI-P29 — the Build page's first screen. */
  build: lazy(() => import("./BuildDemo")),
  /* UI-P31 — Rebuild, and the lineage page built from the same pieces (no board). */
  rebuild: lazy(() => import("./RebuildDemo")),
  lineage: lazy(() => import("./LineageDemo")),
  /* UI-P34 — Profile. */
  profile: lazy(() => import("./ProfileDemo")),
};

/** Entries that draw their own room and are not wrapped in the site frame. */
const UNFRAMED = new Set(["backdrop"]);

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
};

/** Where a board lights a different nav item than the default (the Gallery's): the Profile board lights Home in the header and on the dock. */
const CHROME: Record<string, Partial<DevChromeOptions>> = {
  profile: { current: "home", dockCurrent: "home" },
};

const WIDTH: Record<DesignViewport, number> = { desktop: 1440, mobile: 390 };

export default function KitPages() {
  const { page = "" } = useParams();
  const theme = useDesignTheme();
  const viewport = useDesignViewport();
  const View = Object.prototype.hasOwnProperty.call(VIEWS, page) ? VIEWS[page] : undefined;

  if (!View) return <div data-design-ready="false">Not built yet</div>;

  return (
    <div
      data-design-ready="true"
      data-design-page={page}
      data-design-theme={theme}
      data-design-viewport={viewport}
      style={{ width: WIDTH[viewport] }}
    >
      <Suspense fallback={null}>
        {UNFRAMED.has(page) ? (
          <View viewport={viewport} fit="board" />
        ) : (
          <SiteFrameView viewport={viewport} {...devChrome({ theme, trail: TRAILS[page], ...CHROME[page] })}>
            <View viewport={viewport} fit="board" />
          </SiteFrameView>
        )}
      </Suspense>
    </div>
  );
}
