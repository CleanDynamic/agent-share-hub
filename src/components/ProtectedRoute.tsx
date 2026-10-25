import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { matchRoute } from "@/lib/routing/routeTable";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireCreator?: boolean;
}

export function ProtectedRoute({ children, requireCreator }: ProtectedRouteProps) {
  const { isLoggedIn, isCreator, loading, profileLoading } = useAuth();
  const location = useLocation();

  // The session is all a signed-in page waits for. A creator-only route also needs the profile to say who is a creator.
  if (loading || (requireCreator && isLoggedIn && profileLoading)) {
    // The route's own loading shape from the route table; a page not in it keeps the small skeleton.
    const Placeholder = matchRoute(location.pathname)?.entry.Placeholder;
    if (Placeholder) return <Placeholder />;
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Skeleton className="h-8 w-48 rounded-md" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (requireCreator && !isCreator) return <Navigate to="/" replace />;

  return <>{children}</>;
}
