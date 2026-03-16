import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { LogOut, CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react";
import { SeoHead } from "@/components/SeoHead";

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

  // ── All AI tools (all statuses for admin) ──
  const { data: allTools, isLoading: toolsLoading } = useQuery({
    queryKey: ["admin_all_tools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_tools_registry" as any)
        .select("*, profiles:submitted_by(username, display_name)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const approveToolMutation = useMutation({
    mutationFn: async (toolId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("ai_tools_registry" as any)
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: user?.id ?? null,
        } as any)
        .eq("id", toolId);
      if (error) throw error;
    },
    onSuccess: (_data, toolId) => {
      const tool = allTools?.find((t: any) => t.id === toolId);
      queryClient.invalidateQueries({ queryKey: ["admin_all_tools"] });
      queryClient.invalidateQueries({ queryKey: ["approved_ai_tools"] });
      toast({ title: `${tool?.name || "Tool"} is now live in the AI Tools filter` });
    },
  });

  const rejectToolMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { error } = await supabase
        .from("ai_tools_registry" as any)
        .update({ status: "rejected", rejected_reason: reason || null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_all_tools"] });
      toast({ title: "Tool rejected" });
    },
  });

  const pendingToolsList = allTools?.filter((t: any) => t.status === "pending") ?? [];
  const approvedToolsList = allTools?.filter((t: any) => t.status === "approved") ?? [];
  const rejectedToolsList = allTools?.filter((t: any) => t.status === "rejected") ?? [];

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
            <TabsTrigger value="tools">AI Tools</TabsTrigger>
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

          {/* ── AI Tools registry ── */}
          <TabsContent value="tools" className="space-y-6">
            {toolsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : (
              <>
                {/* Stats bar */}
                <div className="flex gap-4 text-sm">
                  <span className="text-foreground font-medium">{approvedToolsList.length} tools approved</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{pendingToolsList.length} pending review</span>
                </div>

                {/* Pending */}
                {pendingToolsList.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Pending</h3>
                    {pendingToolsList.map((tool: any) => (
                      <ToolCard
                        key={tool.id}
                        tool={tool}
                        onApprove={() => approveToolMutation.mutate(tool.id)}
                        onReject={(reason) => rejectToolMutation.mutate({ id: tool.id, reason })}
                        approving={approveToolMutation.isPending}
                        rejecting={rejectToolMutation.isPending}
                      />
                    ))}
                  </div>
                )}

                {/* Approved */}
                {approvedToolsList.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Approved</h3>
                    {approvedToolsList.map((tool: any) => (
                      <div key={tool.id} className="border border-border rounded-xl p-4 bg-card">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{tool.name}</p>
                          {tool.is_official && (
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">Official</Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Approved</Badge>
                        </div>
                        {tool.description && <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{tool.category}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Rejected */}
                {rejectedToolsList.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground text-muted-foreground">Rejected</h3>
                    {rejectedToolsList.map((tool: any) => (
                      <div key={tool.id} className="border border-border rounded-xl p-3 bg-card opacity-60">
                        <p className="text-sm text-foreground">{tool.name}</p>
                        {tool.rejected_reason && <p className="text-xs text-destructive mt-0.5">{tool.rejected_reason}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {!allTools || allTools.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-10 text-center">No tools in the registry yet.</p>
                ) : null}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

/** A detailed card for a pending tool submission with approve/reject */
function ToolCard({
  tool,
  onApprove,
  onReject,
  approving,
  rejecting,
}: {
  tool: any;
  onApprove: () => void;
  onReject: (reason?: string) => void;
  approving: boolean;
  rejecting: boolean;
}) {
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const submitter = tool.profiles as { username: string | null; display_name: string | null } | null;

  return (
    <div className="border border-border rounded-xl p-4 bg-card space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">{tool.name}</p>
          {tool.website_url && (
            <a
              href={tool.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {tool.website_url} <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {tool.description && <p className="text-xs text-muted-foreground">{tool.description}</p>}
          <p className="text-xs text-muted-foreground">
            Category: {tool.category} · Submitted by @{submitter?.username || "unknown"} · {new Date(tool.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
            onClick={onApprove}
            disabled={approving}
          >
            {approving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 border-destructive text-destructive hover:bg-destructive/10"
            onClick={() => showReject ? onReject(rejectReason) : setShowReject(true)}
            disabled={rejecting}
          >
            {rejecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
            Reject
          </Button>
        </div>
      </div>
      {showReject && (
        <div className="flex gap-2">
          <Input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Rejection reason (optional)"
            className="h-8 text-xs bg-background border-border rounded-lg flex-1"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => onReject(rejectReason)}
            disabled={rejecting}
          >
            Confirm
          </Button>
        </div>
      )}
    </div>
  );
}

export default Admin;
