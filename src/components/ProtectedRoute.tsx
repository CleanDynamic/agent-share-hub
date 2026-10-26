import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { RoutePlaceholder } from "@/lib/routing/RoutePlaceholder";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireCreator?: boolean;
}

export function ProtectedRoute({ children, requireCreator }: ProtectedRouteProps) {
  const { isLoggedIn, isCreator, loading, profileLoading } = useAuth();
  const location = useLocation();

  // The session is all a signed-in page waits for. A creator-only route also needs the profile to say who is a creator.
  if (loading || (requireCreator && isLoggedIn && profileLoading)) {
    // SV-04: the route's own loading shape from the route table, the one the frame's boundary shows; never a small skeleton.
    return <RoutePlaceholder />;
  }

  if (!isLoggedIn) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (requireCreator && !isCreator) return <Navigate to="/" replace />;

  return <>{children}</>;
}
