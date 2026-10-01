# UI-P20 — Switch on the frame for the first route

Follow `design/RULES.md`.

**Goal.** Wire `SiteFrame` into the app behind the flag and move one route — `/notifications`, the simplest — into it with its **existing** content, to prove the frame end to end before any page is rebuilt.

**Read first.** `AppShell.tsx` (where `FlatShell` is mounted and how routes reach it), `App.tsx`, `siteFrameRoutes.ts`, `e2e/tier1/*` specs that visit `/notifications` or rely on the old nav's test ids.

**Build.**
1. In `AppShell`, read `useSiteFrameFlag()` once. When it is on **and** `usesSiteFrame(pathname)`, render `SiteFrame` around the outlet instead of `FlatShell`; otherwise render exactly what renders today. This is a new branch that returns a different tree; no existing element's structural styles change.
2. Add `/notifications` to `SITE_FRAME_ROUTES`. The page renders its current component inside `<main>` for now (UI-P35 rebuilds it).
3. Make sure the old right rail, drawers and mobile bottom nav are not mounted on SiteFrame routes, and are unchanged everywhere else.
4. **`FrameRoute`** `src/components/shell/FrameRoute.tsx`: `<FrameRoute site={<NewPage />} legacy={<OldPage />} />` renders `site` when the flag is on and the current path is in `SITE_FRAME_ROUTES`, else `legacy`. Every page prompt (UI-P27 to UI-P36) swaps its route element to this, so the legacy page file is never edited and stays one flag away.
5. Add a tier1 spec `e2e/tier1/site-frame.spec.ts` that runs with the dev override `?frame=site`: `/notifications` shows `site-frame`, `site-header` (desktop) or `mobile-header` + `dock` (mobile), `breadcrumb` reading "Home / Activity", and `site-footer` (desktop); the Activity link / tile has `aria-current="page"` and the header search takes focus on "/".
6. Document in `design/README.md` → "Checking a change" how to view any route in the new frame locally (`?frame=site`).

**Do not.** Turn the flag on in production data. Change `FlatShell` or any other route.

**Done when.** With the flag off, every tier1 spec passes unchanged; with `?frame=site`, `/notifications` renders in the new frame at 390, 768, 1280 and 1440 with no horizontal scroll and the new spec passes on both Playwright projects.

**Commit.** `UI-P20: site frame behind the flag, /notifications moved`
