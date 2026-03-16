import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";

function statusBadge(status: string) {
  switch (status) {
    case "approved":
      return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">Approved</Badge>;
    case "rejected":
      return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">Rejected</Badge>;
    default:
      return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">Pending</Badge>;
  }
}

export default function MyUploads() {
  const { isLoggedIn, isCreator, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isLoggedIn) navigate("/login", { replace: true });
    if (!loading && isLoggedIn && !isCreator) navigate("/", { replace: true });
  }, [loading, isLoggedIn, isCreator, navigate]);

  const { data: items, isLoading } = useQuery({
    queryKey: ["my_uploads", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, title, content_type, status, download_count, created_at")
        .eq("creator_id", profile!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  if (loading) return null;

  return (
    <div className="py-12 px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">My uploads</h1>
          <Button size="sm" asChild>
            <Link to="/upload"><Plus className="h-4 w-4 mr-1.5" /> Upload new</Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-md" />)}
          </div>
        ) : items && items.length > 0 ? (
          <div className="border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Title</TableHead>
                  <TableHead className="text-muted-foreground">Type</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground text-right">Downloads</TableHead>
                  <TableHead className="text-muted-foreground text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="border-border cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/content/${item.id}`)}>
                    <TableCell className="text-foreground font-medium text-sm">{item.title}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{item.content_type}</TableCell>
                    <TableCell>{statusBadge(item.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm text-right">{item.download_count}</TableCell>
                    <TableCell className="text-muted-foreground text-xs text-right">
                      {new Date(item.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-muted-foreground mb-4">You haven't uploaded anything yet.</p>
            <Button asChild>
              <Link to="/upload">Upload your first content</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
