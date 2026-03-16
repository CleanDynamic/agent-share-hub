import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireCreator?: boolean;
}

export function ProtectedRoute({ children, requireCreator }: ProtectedRouteProps) {
  const { isLoggedIn, isCreator, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Skeleton className="h-8 w-48 rounded-md" />
      </div>
    );
  }

  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (requireCreator && !isCreator) return <Navigate to="/" replace />;

  return <>{children}</>;
}
