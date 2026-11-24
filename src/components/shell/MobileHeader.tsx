// The phone's top bar container (prompt 19). `PhoneTopBar` replaces the old 64 tall header; what sits in it is decided by the
// route (`phoneBarFor`) and by what the mounted page registered (`phoneBarRegistry`). This file owns the account drawer, the
// search page and the sign-in step, and none of the bar's look.
//
// More opens the More sheet: what the mounted page registered, then Copy link and Share. Signed out, the account slot is a "Sign in" ghost button. Back steps back through the history, or goes to the page's own
// fallback when the page was opened directly.

import { lazy, memo, Suspense, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { PhoneTopBar, type PhoneTopBarAction } from "@/components/phone/PhoneTopBar";
import { useAuth } from "@/contexts/AuthContext";
import { useResolvedTheme, useTheme } from "@/contexts/ThemeContext";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { deeper, openOver } from "@/pages/site/signin/signinUrl";

import { useEverOpened, useLoadAtIdle } from "@/lib/routing/lazyHost";

import type { FrameViewer } from "./frameTypes";
import { MoreSheet } from "./MoreSheet";
import { usePageBar } from "./phoneBarRegistry";
import { phoneBarFor } from "./phoneTopBar";
import { SITE_NAV } from "./siteNav";

/* The drawer and the search page draw nothing until first opened, so their code (and the dialog library and the gallery's data
   layer under them) loads then, or at idle once the first page is ready, whichever comes first: the same as `LazyBottomSheet`. */
const loadDrawer = () => import("./AccountDrawer");
const loadSearch = () => import("./PhoneSearchPage");
const Drawer = lazy(() => loadDrawer().then((m) => ({ default: m.AccountDrawer })));
const SearchPage = lazy(() => loadSearch().then((m) => ({ default: m.PhoneSearchPage })));

/** The bar's right slot for a route's table entry and the page's registered state; null where there is nothing to draw. */
function rightAction(
  right: ReturnType<typeof phoneBarFor>["right"],
  page: ReturnType<typeof usePageBar>,
  openSearch: () => void,
  openMore: () => void,
): PhoneTopBarAction | null {
  switch (right) {
    case "search":
      return { icon: "search", label: "Search", onClick: openSearch };
    case "markAll":
      return { text: "Mark all read", label: "Mark all read", disabled: !page.markAll || page.markAll.disabled, onClick: page.markAll?.run };
    case "more":
      return { icon: "more", label: "More", onClick: openMore };
    case "newBuild":
      return { icon: "new", label: "New build", to: SITE_NAV.create };
    case "settings":
      return page.settings ? { icon: "gear", label: "Conversation settings", onClick: page.settings } : null;
    case "skip":
      return page.skip ? { text: "Skip", label: "Skip", onClick: page.skip } : null;
    default:
      return null;
  }
}

function MobileHeaderContainer() {
  const { pathname, state: locationState } = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, user, profile, signOut } = useAuth();
  const resolved = useResolvedTheme();
  const { setTheme } = useTheme();
  const { count: unread } = useUnreadNotifications();
  const page = usePageBar();
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  useLoadAtIdle(loadDrawer);
  useLoadAtIdle(loadSearch);
  const drawerEver = useEverOpened(drawerOpen);
  const searchEver = useEverOpened(searchOpen);

  // A pushed page and a drawer belong to the page they were opened on.
  useEffect(() => {
    setSearchOpen(false);
    setDrawerOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  const viewer: FrameViewer | null =
    isLoggedIn && user
      ? { id: user.id, name: profile?.display_name || profile?.username || "User", handle: profile?.username || "", avatarUrl: profile?.avatar_url }
      : null;

  const spec = phoneBarFor(pathname);
  const signIn = () => navigate(openOver(pathname, window.location.search), { state: deeper(locationState) });
  const back = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(page.backTo ?? spec.backTo ?? "/");
  };

  const centre = spec.centre.kind === "logo" ? "logo" : spec.centre.kind === "title" ? (page.title ?? spec.centre.text) : (page.title ?? "");
  const signedOutAccount = spec.left === "account" && !viewer;

  return (
    <>
      <PhoneTopBar
        left={spec.left === "none" ? null : signedOutAccount ? null : spec.left}
        leftAction={signedOutAccount ? { text: "Sign in", label: "Sign in", onClick: signIn } : null}
        leftLabel={spec.left === "back" ? (page.backLabel ?? spec.backLabel ?? "Back") : undefined}
        onLeft={spec.left === "account" ? () => setDrawerOpen(true) : back}
        centre={centre}
        titleAs="p"
        right={rightAction(spec.right, page, () => setSearchOpen(true), () => setMoreOpen(true))}
        viewer={viewer}
        unread={unread > 0}
        theme={resolved}
        progress={page.progress}
      />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} items={page.more ?? []} />
      {searchEver ? (
        <Suspense fallback={null}>
          <SearchPage open={searchOpen} onOpenChange={setSearchOpen} />
        </Suspense>
      ) : null}
      {viewer && drawerEver ? (
        <Suspense fallback={null}>
          <Drawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            viewer={viewer}
            dark={resolved === "dusk"}
            onToggleDark={() => setTheme(resolved === "dusk" ? "noon" : "dusk")}
            onSignOut={async () => {
              await signOut();
              navigate("/");
            }}
          />
        </Suspense>
      ) : null}
    </>
  );
}

/* UI-P40: memoised, and it takes no props, so a page's data changing (which re-renders the frame around it) never re-renders
   the chrome. It updates on its own hooks only. */
export const MobileHeader = memo(MobileHeaderContainer);

export default MobileHeader;
