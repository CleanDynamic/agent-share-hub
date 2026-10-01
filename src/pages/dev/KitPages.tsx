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
import { useDesignTheme, useDesignViewport, type DesignViewport } from "@/dev/useDesignTheme";

/** What a registered compare entry receives. The view reads the 768px breakpoint itself; this is for sizing the wrapper. */
export interface DesignPageProps {
  viewport: DesignViewport;
}

/** `:page` (the `page` field of `design/reference/index.json`) → a lazy entry that renders the view with fixtures. */
const VIEWS: Record<string, LazyExoticComponent<ComponentType<DesignPageProps>> | undefined> = {
  /* UI-P13 — a throwaway for the page backdrop; not a board, so not in index.json. */
  backdrop: lazy(() => import("./BackdropDemo")),
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
        <View viewport={viewport} />
      </Suspense>
    </div>
  );
}
