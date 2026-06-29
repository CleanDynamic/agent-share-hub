import { Outlet, useLocation } from "react-router-dom";
import { NeoScaleShell } from "@/components/NeoScaleShell";
import GamificationToasts from "@/components/ambient/GamificationToasts";

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
  const isAuthRoute = AUTH_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isAuthRoute) {
    return <Outlet />;
  }

  return (
    <>
      <NeoScaleShell />
      <GamificationToasts />
    </>
  );
}

