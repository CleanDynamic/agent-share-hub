import { useSyncExternalStore } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { safeReturnPath } from "@/lib/auth/safeReturnPath";
import { sessionPhase, signedOutOnPurpose, subscribeSession } from "@/lib/query/sessionSignal";
import { RoutePlaceholder } from "@/lib/routing/RoutePlaceholder";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireCreator?: boolean;
}

export function ProtectedRoute({ children, requireCreator }: ProtectedRouteProps) {
  const { isLoggedIn, isCreator, loading, profileLoading } = useAuth();
  const location = useLocation();
  const phase = useSyncExternalStore(subscribeSession, sessionPhase, sessionPhase);
  const leftOnPurpose = useSyncExternalStore(subscribeSession, signedOutOnPurpose, signedOutOnPurpose);

  // The session is all a signed-in page waits for. A creator-only route also needs the profile to say who is a creator.
  if (loading || (requireCreator && isLoggedIn && profileLoading)) {
    // SV-04: the route's own loading shape from the route table, the one the frame's boundary shows; never a small skeleton.
    return <RoutePlaceholder />;
  }

  // The member signed out on purpose (in another tab, or by closing the dialog): quietly Home, without asking to sign in.
  if (!isLoggedIn && leftOnPurpose) return <Navigate to="/" replace />;

  if (!isLoggedIn && phase === "ended") {
    /* G16 (page states): the server ended the session and the listener opened the sign-in dialog over this page. The page
       stays under it, where the member left it; it does not navigate by itself (not even in the moment the session is
       cleared before the dialog's address is drawn). Closed without signing in, the listener marks the member as signed out
       on purpose, and the page goes Home (above). */
    return <>{children}</>;
  }

  if (!isLoggedIn) {
    // G16, G17: the whole address (path, query and hash) goes through safeReturnPath before it is written.
    return <Navigate to={`/login?redirect=${encodeURIComponent(safeReturnPath(`${location.pathname}${location.search}${location.hash}`))}`} replace />;
  }
  if (requireCreator && !isCreator) return <Navigate to="/" replace />;

  return <>{children}</>;
}
