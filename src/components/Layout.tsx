import { Outlet, useLocation } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Suspense, lazy } from "react";
import { useIdleReady } from "@/lib/routing/lazyHost";

/** SV-26 P2: the toast bus listens for xp and badges; it loads once the first page has settled (at idle), not with it. */
const GamificationToasts = lazy(() => import("@/components/ambient/GamificationToasts"));

// Auth routes are a dedicated full-screen entry point: no left rail, no right
// rail, no mobile bottom nav or top bar. Each auth page renders its own
// AuthShell, so we just hand the route straight through.
const AUTH_ROUTE_PREFIXES = [
  "/signup",
  "/login",
  "/auth/",
  "/verify-email",
  "/reset-password",
];

export function Layout() {
  const { pathname } = useLocation();
  const idle = useIdleReady();
  const isAuthRoute = AUTH_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isAuthRoute) {
    return <Outlet />;
  }

  return (
    <>
      <AppShell />
      {idle && (
        <Suspense fallback={null}>
          <GamificationToasts />
        </Suspense>
      )}
    </>
  );
}

