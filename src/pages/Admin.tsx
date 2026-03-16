import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { LogOut, CheckCircle, XCircle, Loader2, Wrench } from "lucide-react";
import { Input } from "@/components/ui/input";

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Pending content ──
  const { data: pendingItems, isLoading: pendingLoading } = useQuery({
    queryKey: ["admin_pending_content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("*, profiles(username, display_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (contentId: string) => {
      const { error } = await supabase
        .from("content_items")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("id", contentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_pending_content"] });
      toast({ title: "Content approved" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (contentId: string) => {
      const { error } = await supabase
        .from("content_items")
        .update({ status: "rejected" })
        .eq("id", contentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_pending_content"] });
      toast({ title: "Content rejected" });
    },
  });

  // ── Service listings ──
  const { data: allListings, isLoading: listingsLoading } = useQuery({
    queryKey: ["admin_service_listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_listings")
        .select("*, profiles(username, display_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const toggleListingMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("service_listings")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_service_listings"] });
      toast({ title: "Listing updated" });
    },
  });

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <div className="py-10 px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </div>

        <Tabs defaultValue="content" className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="content">Content Queue</TabsTrigger>
            <TabsTrigger value="services">Service Listings</TabsTrigger>
          </TabsList>

          {/* ── Content approval queue ── */}
          <TabsContent value="content" className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Pending Submissions</h2>
            {pendingLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ) : !pendingItems || pendingItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">No pending submissions.</p>
            ) : (
              <div className="space-y-3">
                {pendingItems.map((item) => {
                  const creator = item.profiles as { username: string | null; display_name: string | null } | null;
                  return (
                    <div key={item.id} className="border border-border rounded-xl p-4 bg-card flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          by {creator?.display_name || creator?.username || "Unknown"} · {item.content_type} · {item.difficulty}
                          {item.monetisation_type !== "free" && ` · ${item.monetisation_type}`}
                        </p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                          onClick={() => approveMutation.mutate(item.id)}
                          disabled={approveMutation.isPending}
                        >
                          {approveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8 border-destructive text-destructive hover:bg-destructive/10"
                          onClick={() => rejectMutation.mutate(item.id)}
                          disabled={rejectMutation.isPending}
                        >
                          {rejectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
                          Reject
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Service listings management ── */}
          <TabsContent value="services" className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Service Listings</h2>
            {listingsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : !allListings || allListings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">No service listings yet.</p>
            ) : (
              <div className="space-y-3">
                {allListings.map((listing) => {
                  const creator = listing.profiles as { username: string | null; display_name: string | null } | null;
                  return (
                    <div key={listing.id} className="border border-border rounded-xl p-4 bg-card flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-foreground truncate">{listing.title}</p>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${listing.is_active ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-muted text-muted-foreground border-border"}`}
                          >
                            {listing.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          by @{creator?.username || "unknown"} · <span className="font-semibold text-orange-400">£{Number(listing.price_gbp ?? 0).toFixed(2)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">{listing.is_active ? "Active" : "Deactivated"}</span>
                        <Switch
                          checked={listing.is_active}
                          onCheckedChange={(checked) =>
                            toggleListingMutation.mutate({ id: listing.id, is_active: checked })
                          }
                          disabled={toggleListingMutation.isPending}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
