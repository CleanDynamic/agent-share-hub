import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, useParams, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { AddToCollectionHost } from "@/components/library/AddToCollectionHost";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isPermissionError } from "@/lib/errors/permission";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PresenceProvider } from "@/components/PresenceProvider";
import { ShareMenuProvider } from "@/components/share/ShareMenuProvider";
import { ReblogComposeProvider } from "@/contexts/ReblogComposeContext";
import { QuotableSelectionProvider } from "@/components/quoting/QuotableSelectionProvider";
import { UploadPickerProvider } from "@/contexts/UploadPickerContext";
import { Layout } from "@/components/Layout";
import { AdminRoute } from "@/components/AdminRoute";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { RouteBoundary } from "@/components/routing/RouteBoundary";
import { SearchRedirect } from "@/components/routing/SearchRedirect";
import { CreatorRedirect } from "@/components/routing/CreatorRedirect";
import { lazyPage } from "@/components/routing/lazyPage";
import { FrameRoute } from "./components/shell/FrameRoute";
import { SiteFrame } from "./components/shell/SiteFrame";
import { LinkFrameRoute, SignInSite } from "./pages/site/signin/SignInRoutes";

const Upload = lazyPage(() => import("./pages/Upload"));
const UploadTypeSelector = lazyPage(() => import("./pages/UploadTypeSelector"));
const BlogUpload = lazyPage(() => import("./pages/BlogUpload"));
const BountyUploadShell = lazyPage(() => import("./pages/BountyUploadShell"));
import { LegacyUploadRoute } from "@/components/upload/LegacyUploadNotice";
const About = lazyPage(() => import("./pages/About"));
const ContentDetail = lazyPage(() => import("./pages/ContentDetail"));
const ContentOrReblogRoute = lazyPage(() => import("@/components/routing/ContentOrReblogRoute"));
const ProjectDetail = lazyPage(() => import("./pages/ProjectDetail"));
const Admin = lazyPage(() => import("./pages/Admin"));
const AdminLogin = lazyPage(() => import("./pages/AdminLogin"));


const AuthCallback = lazyPage(() => import("./pages/AuthCallback"));

const Onboarding = lazyPage(() => import("./pages/Onboarding"));
const OnboardingProfile = lazyPage(() => import("./pages/OnboardingProfile"));


const LibraryPage = lazyPage(() => import("./pages/Library"));
const CollectionDetailRoute = lazyPage(() => import("./pages/CollectionDetail"));
const NotFound = lazyPage(() => import("./pages/NotFound"));

const MessagesPage = lazyPage(() => import("./pages/Messages"));
const CollectionDetail = lazyPage(() => import("./pages/CollectionDetail"));
// LearningPathDetail removed from UI
const ApiDocs = lazyPage(() => import("./pages/ApiDocs"));

// UI-P46 — /drafts is the new page (builds and sessions); the old one, which reads
// content_items and content_blocks, is routed at /drafts/posts unchanged.
const DraftsPage = lazyPage(() => import("./pages/site/drafts/DraftsPage"));
const LegacyDraftsPage = lazyPage(() => import("./pages/Drafts"));
const PostPreviewPage = lazyPage(() => import("./pages/PostPreview"));
const PublishMetadata = lazyPage(() => import("./pages/PublishMetadata"));
const ContentEditPage = lazyPage(() => import("./pages/ContentEdit"));
const BountyUpload = lazyPage(() => import("@/pages/BountyUpload"));

// The gallery. Its own chunk: a reader who never opens it never pays for the
// card bodies. Reachable from the primary navigation (RC-P05), directly, and
// from the publish confirmation.

// RC-P05 — the Bounties board. Its own chunk, like every route the RC series
// adds (CONTRACT §2.6).
const Bounties = lazy(() => import("./pages/Bounties"));
// RC-P13 — the solvers board, under the bounties board. Its own chunk.
const Solvers = lazy(() => import("./pages/Solvers"));
// Solve route for a specific bounty.
const BountySolveShowPage = lazy(() => import("./pages/BountySolveShowPage"));
// RC-P14 — a build's family of rebuilds, at /b2/:slug/lineage and, for the old
// address, /b/:slug/lineage. Its own chunk, like every route the RC series adds.

// RC-P23 — progress and the maker's build numbers, signed in only. Its own
// chunk: nobody reading the gallery pays for the XP panels or the table. The
// route asks for a session and nothing more: it used to require
// profiles.is_creator, a legacy flag nothing in the app sets, so the frame's
// level chip (every signed-in reader's way here) bounced them to Home, and a
// direct load raced the profile fetch and bounced creators too.
const Analytics = lazy(() => import("./pages/Analytics"));
// UI-P27 — Home in the site frame. Its own chunk, so the entry bundle keeps the
// legacy Home alone; `FrameRoute` picks one by the `site_frame` flag.
function OldLineageRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/b2/${slug}/lineage`} replace />;
}
const HomePage = lazy(() => import("./pages/site/home/HomePage"));
// UI-P28 — the Gallery in the site frame; its own chunk, picked by `FrameRoute`.
const GalleryPage = lazy(() => import("./pages/site/gallery/GalleryPage"));
// UI-P29 — the Build page in the site frame; its own chunk, picked by `FrameRoute`.
const BuildSitePage = lazy(() => import("./pages/site/build/BuildPage"));
// UI-P31 — Rebuild and lineage in the site frame; their own chunks, picked by `FrameRoute`.
const RebuildSitePage = lazy(() => import("./pages/site/rebuild/RebuildPage"));
const LineageSitePage = lazy(() => import("./pages/site/rebuild/LineagePage"));
// UI-P34 — the Profile in the site frame; its own chunk, picked by `FrameRoute`.
const ProfileSitePage = lazy(() => import("./pages/site/profile/ProfilePage"));
// UI-P35 — Activity in the site frame; its own chunk (it draws a chart), picked by `FrameRoute`.
const ActivitySitePage = lazy(() => import("./pages/site/activity/ActivityPage"));
// UI-P36 — Sign in, Join, reset and verify in the entrance's frame; each its own chunk, picked by `FrameRoute`.
const LoginSitePage = lazy(() => import("./pages/site/signin/LoginPage"));
const SignupSitePage = lazy(() => import("./pages/site/signin/SignupPage"));
const ResetPasswordSitePage = lazy(() => import("./pages/site/signin/ResetPasswordPage"));
const VerifyEmailSitePage = lazy(() => import("./pages/site/signin/VerifyEmailPage"));
// The heaviest page in the application. Lazy so it never enters the initial bundle.
// UI-P47 — one small route decides: the new composer for an ordinary draft, this
// legacy screen for a rebuild or a `from` URL. It is its own chunk.
const ComposeRoute = lazy(() => import("./pages/site/compose/ComposeRoute"));
// The intake step. Its own chunk, so arriving at /compose/new does not pay for
// the workspace before the creator has decided to open one.
const ComposeNew = lazy(() => import("./pages/ComposeNew"));
// The door into a rebuild: resolve a slug, fork it, hand the creator to their
// own workspace. Its own chunk — it is two queries and a sentence, and nothing
// that is not rebuilding should carry it.

// The Build File kit: two documents and the three steps that use them. Its
// own chunk — the prose is only read by someone who came to import a build.
const ImportPage = lazy(() => import("./pages/ImportPage"));
// The conversion offer for one existing post. Its own chunk and its own route:
// the affordance belongs on the creator's post page, and ContentDetail is on
// the existing content path, which this rebuild does not edit.
const ConvertPrompt = lazy(() => import("./components/build/ConvertPrompt"));
// EX-P03 — the OAuth consent screen. Its own chunk: the backend's authorization
// path points every third-party application here, but a reader who never
// authorizes one should not carry the page, and nothing in the application links
// to it — it is arrived at from somebody else's product.
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
// UI-P45 — /connect in the site frame: the connector guide, inline. Its own chunk.
const ConnectSitePage = lazy(() => import("./pages/site/connect/ConnectPage"));

/* BG-P07 — /dev/kit, the control-kit review page.

   GUARDED SO IT NEVER SHIPS. Vite replaces `import.meta.env.DEV` with the
   literal `false` in a production build, which makes this a `false ? … : null`
   whose live branch Rollup then eliminates — taking the dynamic import with it,
   so no chunk for the page is emitted at all. A route merely left unreachable
   would still ship the code; this does not.

   It is lazy for the same reason every heavy route here is, and it is linked
   from nowhere. BG-P30's audit and the prompts after it reach it by URL. */
const Kit = import.meta.env.DEV ? lazy(() => import("./pages/dev/Kit")) : null;

/* UI-P01 — /dev/kit/components and /dev/kit/pages/:page, the compare pages
   `npm run audit:design` screenshots against design/reference/. Guarded exactly
   like /dev/kit above, and for the same reason: they import the sample-data
   fixtures, which must not exist in a production bundle. */
const KitComponents = import.meta.env.DEV ? lazy(() => import("./pages/dev/KitComponents")) : null;
const KitPages = import.meta.env.DEV ? lazy(() => import("./pages/dev/KitPages")) : null;

/* BG-P14 — /dev/wide, the wide-layout demo.

   GUARDED THE SAME WAY AND FOR THE SAME REASON as /dev/kit above: Vite
   replaces `import.meta.env.DEV` with the literal `false` in a production
   build, Rollup eliminates the dead branch, and no chunk for the page is
   emitted at all.

   REGISTERED INSIDE <Layout />, UNLIKE /dev/kit, because the thing it exists
   to show is the frame around the page. The wide-route table
   (src/components/shell/wideRoutes.ts) carries its path under the same DEV
   guard. RC-P06 deleted its second path, /dev/wide/rail, with the right rail
   it demonstrated. */
const WideDemo = import.meta.env.DEV ? lazy(() => import("./pages/dev/WideDemo")) : null;
/* UI-P37: one retry, not three. TanStack's default backs off for about seven
   seconds before a panel may say "That didn't load.", seven seconds of skeleton;
   one retry is about one. A refusal is never retried: asking again changes nothing. */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: (count, error) => count < 1 && !isPermissionError(error) },
  },
});

const App = () => (
  <ErrorBoundary>
    {/* BG-P18b. `<BlobBackground />` stood here and painted the page: a fixed
        inset-0 div carrying a hard-coded #25252F ground under a 20px dot grid,
        in BOTH themes. That is what put three light panels on a dark dotted
        field with Noon selected — two themes on one screen, which the
        theme's first rule forbids outright. The ground is now `--bg` on
        html/body/#root and nothing else paints behind the frame.

        THE WRAPPER STAYS. Its `position: relative; z-index: 1` existed to lift
        the app above that fixed background, but it is also the stacking
        context every portalled overlay in the application has been positioned
        against; removing it is a structural change to an existing layout
        element for no visual gain. */}
    <div style={{ position: "relative", zIndex: 1 }}>
    <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ThemeProvider>
          <AuthProvider>
            <PresenceProvider />
            <ConnectionBanner />
            <ShareMenuProvider>
            <ReblogComposeProvider>
            <UploadPickerProvider>
            <QuotableSelectionProvider />
            {/* RC-P18 — the one "Add to a collection" dialog, opened from the
                Save toast; addToCollection.ts says why it lives here. */}
            <AddToCollectionHost />
            <Routes>
              <Route element={<Layout />}>
                <Route
                  path="/"
                  element={
                    <FrameRoute
                      site={
                        <RouteBoundary>
                          <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
                            <HomePage />
                          </Suspense>
                        </RouteBoundary>
                      }
                      legacy={
                        <RouteBoundary>
                          <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
                            <HomePage />
                          </Suspense>
                        </RouteBoundary>
                      }
                    />
                  }
                />
                {/* RC-P05 — the old discovery addresses. Each one duplicated
                    the Gallery, so each now lands on it (hicks-law › Remedies
                    1 Remove); the addresses stay reachable so a bookmark is
                    not a 404. /search carries its query across. The page
                    files stay until RC-P29 deletes them. */}
                <Route path="/browse" element={<Navigate to="/gallery" replace />} />
                <Route path="/discover" element={<Navigate to="/gallery" replace />} />
                <Route path="/discover-legacy" element={<Navigate to="/gallery" replace />} />
                <Route path="/recent" element={<Navigate to="/gallery" replace />} />
                <Route path="/fyp" element={<Navigate to="/gallery" replace />} />
                <Route path="/search" element={<SearchRedirect />} />
                <Route path="/category/:slug" element={<Navigate to="/gallery" replace />} />
                {/* The previous publishing tool. Still registered, still
                    saving, still publishing — wrapped in a banner that names
                    it as previous and links to the replacement. No redirect:
                    a draft in progress has to be finishable. */}
                <Route path="/upload" element={<LegacyUploadRoute><UploadTypeSelector /></LegacyUploadRoute>} />
                <Route path="/upload/blueprint" element={<LegacyUploadRoute><Upload /></LegacyUploadRoute>} />
                <Route path="/upload/blog" element={<LegacyUploadRoute><BlogUpload /></LegacyUploadRoute>} />
                <Route path="/upload/bounty" element={<LegacyUploadRoute bounty><BountyUploadShell /></LegacyUploadRoute>} />
                <Route path="/about" element={<About />} />
                <Route path="/api-docs" element={<ApiDocs />} />
                <Route path="/content/:id" element={<ContentDetail />} />
                <Route path="/b/:id" element={<ContentOrReblogRoute />} />
                <Route path="/b/:id/thread" element={<ContentOrReblogRoute mode="thread" />} />
                {/* RC-P13 — the legacy leaderboard ranked people against one
                    legacy bounty post, and after the clear it reads nothing.
                    Its address lands on the solvers board. The page file stays
                    until the legacy bounty path is removed. */}
                <Route path="/b/:id/leaderboard" element={<Navigate to="/bounties/solvers" replace />} />
                {/* RC-P14 — the old lineage address. It drew remix lineage; it
                    now lands on /b2/:slug/lineage when the slug names a build,
                    and says there is no build at it otherwise. */}
                <Route path="/b/:slug/lineage" element={<OldLineageRedirect />} />
                <Route path="/content/:id/edit" element={<ProtectedRoute requireCreator><ContentEditPage /></ProtectedRoute>} />
                <Route path="/project/:id" element={<ProjectDetail />} />
                {/* RC-P22 — one address for each thing. The old creator page,
                    the old uploads list and the old saves list duplicated
                    the profile and the Library (hicks-law › Remedies 1
                    Remove), so each address lands on its one home; the
                    creator's handle is carried across. The page files stay
                    until RC-P29 deletes them. */}
                <Route path="/creator/:username" element={<CreatorRedirect />} />
                <Route path="/creator" element={<Navigate to="/profile" replace />} />
                <Route path="/my-uploads" element={<Navigate to="/profile" replace />} />
                <Route path="/saved" element={<Navigate to="/library" replace />} />
                <Route path="/collections/:slug" element={<CollectionDetail />} />
                {/* /path/:id route removed */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                {/* UI-P36 — the four entrance pages in the site frame behind the
                    flag. Layout hands these straight through, outside AppShell,
                    so the site branch brings its own bare frame (as /rebuild/:slug
                    does). The two an emailed link can open are held until the
                    flag is known, because a link's token works once: the legacy
                    page must not mount first and spend it. /auth/callback is not
                    repainted here. */}
                <Route path="/signup" element={<FrameRoute site={<SignInSite><SignupSitePage /></SignInSite>} legacy={<SignInSite><SignupSitePage /></SignInSite>} />} />
                <Route path="/login" element={<FrameRoute site={<SignInSite><LoginSitePage /></SignInSite>} legacy={<SignInSite><LoginSitePage /></SignInSite>} />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/verify-email" element={<LinkFrameRoute site={<SignInSite><VerifyEmailSitePage /></SignInSite>} legacy={<SignInSite><VerifyEmailSitePage /></SignInSite>} />} />
                <Route path="/verify-email/:token" element={<LinkFrameRoute site={<SignInSite><VerifyEmailSitePage /></SignInSite>} legacy={<SignInSite><VerifyEmailSitePage /></SignInSite>} />} />
                <Route path="/reset-password" element={<LinkFrameRoute site={<SignInSite><ResetPasswordSitePage /></SignInSite>} legacy={<SignInSite><ResetPasswordSitePage /></SignInSite>} />} />
                <Route path="/reset-password/:token" element={<LinkFrameRoute site={<SignInSite><ResetPasswordSitePage /></SignInSite>} legacy={<SignInSite><ResetPasswordSitePage /></SignInSite>} />} />
                <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                <Route path="/onboarding/profile" element={<ProtectedRoute><OnboardingProfile /></ProtectedRoute>} />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <FrameRoute
                        site={
                          <RouteBoundary>
                            <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
                              <ProfileSitePage />
                            </Suspense>
                          </RouteBoundary>
                        }
                        legacy={<Suspense fallback={null}><ProfileSitePage /></Suspense>}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile/:handle"
                  element={
                    <FrameRoute
                      site={
                        <RouteBoundary>
                          <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
                            <ProfileSitePage />
                          </Suspense>
                        </RouteBoundary>
                      }
                      legacy={<Suspense fallback={null}><ProfileSitePage /></Suspense>}
                    />
                  }
                />
                <Route path="/library" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
                <Route path="/library/collections/:collectionId" element={<CollectionDetailRoute />} />
                <Route path="/library/:handle/collections/:collectionId" element={<CollectionDetailRoute />} />
                <Route path="/library/:handle" element={<LibraryPage />} />
                
                <Route path="/drafts" element={<ProtectedRoute><DraftsPage /></ProtectedRoute>} />
                {/* UI-P46 — the content path stays live (RULES §3). PublishMetadata,
                    PostPreview and MyUploads send people to /drafts for content_items
                    drafts, which the new page does not show; this is deliberate. */}
                <Route path="/drafts/posts" element={<ProtectedRoute><LegacyDraftsPage /></ProtectedRoute>} />
                <Route path="/upload/preview/:draftId" element={<ProtectedRoute><PostPreviewPage /></ProtectedRoute>} />
                <Route path="/publish/:contentItemId" element={<ProtectedRoute><PublishMetadata /></ProtectedRoute>} />
                <Route path="/feed" element={<Navigate to="/gallery" replace />} />
                {/* UI-P45 — /connect, in the frame. Public: it reads nothing and asks nobody to sign in. */}
                <Route
                  path="/connect"
                  element={
                    <FrameRoute
                      site={
                        <RouteBoundary>
                          <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
                            <ConnectSitePage />
                          </Suspense>
                        </RouteBoundary>
                      }
                    />
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <FrameRoute
                        site={
                          <RouteBoundary>
                            <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
                              <ActivitySitePage />
                            </Suspense>
                          </RouteBoundary>
                        }
                        legacy={<Suspense fallback={null}><ActivitySitePage /></Suspense>}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
                <Route path="/messages/:threadId" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
                <Route path="/analytics" element={<RouteBoundary><Suspense fallback={<div style={{ minHeight: "60vh", background: "var(--bg)" }} />}><ProtectedRoute><Analytics /></ProtectedRoute></Suspense></RouteBoundary>} />
                {/* NS-P54. The standalone bounty form, retired the same way
                    the previous publishing tool was: the route stays
                    registered so a bookmark is not a 404, the notice above it
                    says where bounties live now, and the submit is frozen
                    behind src/lib/bounty-legacy/flags.ts. ProtectedRoute stays
                    outermost — a signed-out visitor still meets the login
                    redirect, not a notice over one. */}
                <Route path="/bounty/new" element={<ProtectedRoute><LegacyUploadRoute bounty><BountyUpload /></LegacyUploadRoute></ProtectedRoute>} />
                {WideDemo && (
                  <Route
                    path="/dev/wide"
                    element={
                      <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--bg)" }} />}>
                        <WideDemo />
                      </Suspense>
                    }
                  />
                )}

                {/* ── BG-P15 — the gallery, the build page and the import page.

                    THESE THREE MOVED IN FROM OUTSIDE. Until this prompt they
                    were registered after this block, which meant no left rail,
                    no right rail, no wordmark and no mobile chrome: a reader
                    who arrived on one of them got a "← buildgallery" text link
                    standing in for the whole application, and the product read
                    as two websites. The move is exactly this — the same three
                    <Route> elements with the same lazy components and the same
                    Suspense boundaries, sitting inside <Route
                    element={<Layout />}> instead of after it.

                    THEY RENDER WIDE, and that is decided in
                    src/components/shell/wideRoutes.ts, not here. Three entries
                    in that table give them the 1600px frame and the per-route
                    right-rail answer — the rail on the build page, suppressed
                    on the other two. This file only decides that Layout wraps
                    them at all.

                    STILL LAZY, WHICH IS WHY THE SUSPENSE BOUNDARIES CAME WITH
                    THEM. Moving a route inside Layout changes who renders it,
                    not when its chunk is fetched: the three
                    `lazy(() => import(…))` calls at the top of this file are
                    untouched, so each page is still its own chunk and none of
                    them is in the initial bundle.

                    THE FALLBACKS LOST THEIR HARD-CODED #08080C. Outside the
                    frame, a full-viewport dark block was the page's own ground
                    arriving before the page. Inside it, that block would paint
                    over the frame and flash dark on Noon, so it is
                    `--bg` — the live theme's ground — and it fills the centre
                    column rather than the viewport, because the frame is
                    already on screen and only the page is still coming. ── */}
                <Route
                  path="/b2/:slug"
                  element={
                    <FrameRoute
                      site={
                        <RouteBoundary>
                          <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
                            <BuildSitePage />
                          </Suspense>
                        </RouteBoundary>
                      }
                      legacy={<Suspense fallback={<div style={{ minHeight: "60vh", background: "var(--bg)" }} />}><BuildSitePage /></Suspense>}
                    />
                  }
                />
                {/* RC-P14 — every published rebuild in a build's family, beside
                    the build page it belongs to. Wide through /b2/*. UI-P31 —
                    in the site frame behind the flag: the family as a tree, and
                    what each rebuild changed. */}
                <Route
                  path="/b2/:slug/lineage"
                  element={
                    <FrameRoute
                      site={
                        <RouteBoundary>
                          <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
                            <LineageSitePage />
                          </Suspense>
                        </RouteBoundary>
                      }
                      legacy={<RouteBoundary><Suspense fallback={<div style={{ minHeight: "60vh", background: "var(--bg)" }} />}><LineageSitePage /></Suspense></RouteBoundary>}
                    />
                  }
                />
                <Route
                  path="/gallery"
                  element={
                    <FrameRoute
                      site={
                        <RouteBoundary>
                          <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
                            <GalleryPage />
                          </Suspense>
                        </RouteBoundary>
                      }
                      legacy={<Suspense fallback={<div style={{ minHeight: "60vh", background: "var(--bg)" }} />}><GalleryPage /></Suspense>}
                    />
                  }
                />
                {/* RC-P05 — the Bounties board's address, so the navigation has
                    a destination before RC-P12 fills it. Lazy, with the
                    Gallery's fallback, inside its own RouteBoundary
                    (CONTRACT §2.6). */}
                <Route path="/bounties" element={<RouteBoundary><Suspense fallback={<div style={{ minHeight: "60vh", background: "var(--bg)" }} />}><Bounties /></Suspense></RouteBoundary>} />
                {/* RC-P13 — the solvers board, lazy inside its own RouteBoundary
                    like the board it sits under (CONTRACT §2.6). */}
                <Route path="/bounties/solvers" element={<RouteBoundary><Suspense fallback={<div style={{ minHeight: "60vh", background: "var(--bg)" }} />}><Solvers /></Suspense></RouteBoundary>} />
                {/* Solve route for a specific bounty, inside its own RouteBoundary. */}
                <Route path="/bounties/:bountyId/solve" element={<RouteBoundary><Suspense fallback={<div style={{ minHeight: "60vh", background: "var(--bg)" }} />}><BountySolveShowPage /></Suspense></RouteBoundary>} />
                <Route path="/import" element={<Suspense fallback={<div style={{ minHeight: "60vh", background: "var(--bg)" }} />}><ImportPage /></Suspense>} />
              </Route>
              {/* ── BG-P16 — the four authoring routes.

                  THEY STAY OUT HERE, ON PURPOSE. Unlike the three routes
                  BG-P15 moved in, these are not reading surfaces: an authoring
                  workspace drops navigation the way Figma and Docs do, because
                  a tray, a tree and an inspector cannot share a viewport with
                  two rails and a mobile bottom bar, and because a creator who
                  is building should not be offered somewhere else to go. What
                  BG-P16 fixed was not their position but the fact that leaving
                  the frame happened abruptly and looked like a different
                  product — they now share one WorkspaceBar, so the workspace
                  reads as the same product in a different mode.

                  THE FALLBACKS LOSE THEIR HARD-CODED #08080C, which is the
                  same correction BG-P15 made to the routes it moved. That void
                  is neither theme's ground: it was the workspace's own colour
                  arriving before the workspace, and now that the workspace is
                  `--bg` it would be a flash of black before a luminous grey
                  room on Noon. `--bg` is the live theme's ground, so the
                  fallback is the room the route is about to paint. ── */}
              {/* UI-P47 — /compose/start is the legacy intake (paste a transcript, a repo);
                  /compose/new and /compose/:buildId are ComposeRoute: the new composer
                  in the site frame, or the legacy screen for a rebuild or a `from` URL. */}
              <Route path="/compose/start" element={<Suspense fallback={<div style={{ position: "fixed", inset: 0, background: "var(--bg)" }} />}><ComposeNew /></Suspense>} />
              <Route path="/compose/:buildId" element={<Suspense fallback={<div style={{ position: "fixed", inset: 0, background: "var(--bg)" }} />}><ComposeRoute /></Suspense>} />
              {/* UI-P31 — /rebuild/:slug behind the flag is a page in the site
                  frame (the family, what changed, readiness), not a door. It
                  stays out here so the legacy door renders exactly as it did,
                  outside every frame; the site page brings its own SiteFrame,
                  which is the frame AppShell would have chosen for it. */}
              <Route
                path="/rebuild/:slug"
                element={
                  <FrameRoute
                    site={
                      <SiteFrame>
                        <RouteBoundary>
                          <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
                            <RebuildSitePage />
                          </Suspense>
                        </RouteBoundary>
                      </SiteFrame>
                    }
                    legacy={<Suspense fallback={<div style={{ position: "fixed", inset: 0, background: "var(--bg)" }} />}><RebuildSitePage /></Suspense>}
                  />
                }
              />
              <Route path="/convert/:contentItemId" element={<Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--bg)" }} />}><ConvertPrompt /></Suspense>} />
              {/* ── EX-P03 — /oauth/consent.

                  OUT HERE FOR A DIFFERENT REASON THAN THE FOUR ABOVE. They are
                  authoring workspaces that drop navigation because a tray, a
                  tree and an inspector cannot share a viewport with two rails.
                  This is a decision with two answers, arrived at mid-way through
                  somebody else's sign-in flow — a frame offering somewhere else
                  to go is an invitation to abandon an OAuth exchange that the
                  application which sent the visitor here is still waiting on.

                  It renders its own AuthShell, exactly as /login and /signup do
                  through Layout's auth passthrough. Registering it here rather
                  than adding a sixth prefix to that list keeps Layout untouched
                  and puts the route where its Suspense boundary already lives.

                  THE FALLBACK IS `--bg` AND FULL-VIEWPORT, matching the
                  authoring routes above: this page has no frame already on
                  screen to fill around, so the fallback is the whole room. ── */}
              <Route path="/oauth/consent" element={<Suspense fallback={<div style={{ position: "fixed", inset: 0, background: "var(--bg)" }} />}><OAuthConsent /></Suspense>} />
              {Kit && (
                <Route
                  path="/dev/kit"
                  element={
                    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--bg)" }} />}>
                      <Kit />
                    </Suspense>
                  }
                />
              )}
              {KitComponents && (
                <Route
                  path="/dev/kit/components"
                  element={
                    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--bg)" }} />}>
                      <KitComponents />
                    </Suspense>
                  }
                />
              )}
              {KitPages && (
                <Route
                  path="/dev/kit/pages/:page"
                  element={
                    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--bg)" }} />}>
                      <KitPages />
                    </Suspense>
                  }
                />
              )}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </UploadPickerProvider>
            </ReblogComposeProvider>
            </ShareMenuProvider>
          </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </HelmetProvider>
    </div>
  </ErrorBoundary>
);

export default App;
