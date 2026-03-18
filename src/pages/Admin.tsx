import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { insertNotification } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { LogOut, CheckCircle, XCircle, Loader2, ExternalLink, Eye, Database } from "lucide-react";
import { SeoHead } from "@/components/SeoHead";

function SeedDemoButton() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSeed = async () => {
    setLoading(true);
    toast({ title: "Seeding demo data…", description: "This may take a minute." });
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seed-demo-data`,
        { method: "POST", headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Seed failed");
      toast({ title: json.message || "Demo data seeded!" });
    } catch (err: any) {
      toast({ title: "Seed failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" className="border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10" onClick={handleSeed} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
      Seed demo data
    </Button>
  );
}

function UpdateSeedButton() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleUpdate = async () => {
    setLoading(true);
    toast({ title: "Updating seed data…", description: "Adding WTE blocks, use instructions, and demo project." });
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-seed-data`,
        { method: "POST", headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      toast({ title: "Seed data updated!", description: `WTE: ${json.what_to_expect_blocks_updated}, Instructions: ${json.use_instructions_added}, Projects: ${json.projects_created}` });
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" className="border-primary text-primary hover:bg-primary/10" onClick={handleUpdate} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
      Update seed data
    </Button>
  );
}

function SeedButtonRow() {
  return (
    <div className="mb-6 flex justify-end gap-2">
      <SeedDemoButton />
      <UpdateSeedButton />
    </div>
  );
}
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
        .select("*, profiles!content_items_creator_id_fkey(username, display_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (contentId: string) => {
      // Fetch content info before approving
      const { data: contentRow } = await supabase
        .from("content_items")
        .select("creator_id, title")
        .eq("id", contentId)
        .maybeSingle();

      const { error } = await supabase
        .from("content_items")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("id", contentId);
      if (error) throw error;

      // Send approval notification
      if (contentRow) {
        insertNotification({
          recipient_id: contentRow.creator_id,
          actor_id: null,
          notification_type: "content_approved",
          content_id: contentId,
          metadata: { content_title: contentRow.title },
        });
      }
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

  // ── Projects ──
  // ── Learning Paths ──
  const { data: pendingPaths, isLoading: pendingPathsLoading } = useQuery({
    queryKey: ["admin_pending_paths"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_paths")
        .select("*, profiles!learning_paths_creator_id_fkey(username, display_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const approvePathMutation = useMutation({
    mutationFn: async (pathId: string) => {
      const { error } = await supabase
        .from("learning_paths")
        .update({ status: "approved" })
        .eq("id", pathId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_pending_paths"] });
      toast({ title: "Learning path approved" });
    },
  });

  const rejectPathMutation = useMutation({
    mutationFn: async (pathId: string) => {
      const { error } = await supabase
        .from("learning_paths")
        .update({ status: "rejected" })
        .eq("id", pathId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_pending_paths"] });
      toast({ title: "Learning path rejected" });
    },
  });
  const { data: pendingProjects, isLoading: pendingProjectsLoading } = useQuery({
    queryKey: ["admin_pending_projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, profiles(username, display_name), project_components(id, component_type, linked_content_id, inline_content_id)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: approvedProjects, isLoading: approvedProjectsLoading } = useQuery({
    queryKey: ["admin_approved_projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, profiles(username, display_name), project_components(id)")
        .eq("status", "approved")
        .order("approved_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch content items for pending project components
  const pendingProjContentIds = (pendingProjects ?? []).flatMap((p: any) =>
    (p.project_components ?? []).map((c: any) => c.linked_content_id || c.inline_content_id).filter(Boolean)
  );
  const { data: pendingProjContent } = useQuery({
    queryKey: ["admin_pending_proj_content", pendingProjContentIds.join(",")],
    queryFn: async () => {
      if (pendingProjContentIds.length === 0) return [];
      const { data } = await supabase.from("content_items").select("id, title, content_type, monetisation_type").in("id", pendingProjContentIds);
      return data ?? [];
    },
    enabled: pendingProjContentIds.length > 0,
  });

  const approveProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      // Approve project
      const { error } = await supabase
        .from("projects")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("id", projectId);
      if (error) throw error;

      // Approve all inline pending components
      const project = pendingProjects?.find((p: any) => p.id === projectId);
      if (project) {
        const inlineIds = (project.project_components ?? [])
          .filter((c: any) => c.inline_content_id)
          .map((c: any) => c.inline_content_id);
        if (inlineIds.length > 0) {
          await supabase
            .from("content_items")
            .update({ status: "approved", approved_at: new Date().toISOString() })
            .in("id", inlineIds)
            .eq("status", "pending");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_pending_projects"] });
      queryClient.invalidateQueries({ queryKey: ["admin_approved_projects"] });
      queryClient.invalidateQueries({ queryKey: ["admin_pending_content"] });
      toast({ title: "Project approved" });
    },
  });

  const rejectProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      // TODO: notify creator of rejection reason
      const { error } = await supabase
        .from("projects")
        .update({ status: "rejected" })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_pending_projects"] });
      toast({ title: "Project rejected" });
    },
  });

  const removeProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from("projects")
        .update({ status: "pending" })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_approved_projects"] });
      queryClient.invalidateQueries({ queryKey: ["admin_pending_projects"] });
      toast({ title: "Project removed from site" });
    },
  });

  // ── Stats ──
  const { data: totalRatings } = useQuery({
    queryKey: ["admin_total_ratings"],
    queryFn: async () => {
      const { count } = await supabase.from("content_ratings" as any).select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: totalComments } = useQuery({
    queryKey: ["admin_total_comments"],
    queryFn: async () => {
      const { count } = await supabase.from("content_comments" as any).select("*", { count: "exact", head: true }).eq("is_deleted", false);
      return count ?? 0;
    },
  });

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <div className="py-10 px-6">
      <SeoHead title="Admin — NeoScale AI" description="Admin panel." path="/admin" noIndex />
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          <div className="border border-border rounded-xl p-4 bg-card text-center">
            <p className="text-2xl font-bold text-foreground">{pendingItems?.length ?? 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending</p>
          </div>
          <div className="border border-border rounded-xl p-4 bg-card text-center">
            <p className="text-2xl font-bold text-foreground">{approvedToolsList.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">AI Tools</p>
          </div>
          <div className="border border-border rounded-xl p-4 bg-card text-center">
            <p className="text-2xl font-bold text-foreground">{pendingProjects?.length ?? 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending Projects</p>
          </div>
          <div className="border border-border rounded-xl p-4 bg-card text-center">
            <p className="text-2xl font-bold text-foreground">{approvedProjects?.length ?? 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Live Projects</p>
          </div>
          <div className="border border-border rounded-xl p-4 bg-card text-center">
            <p className="text-2xl font-bold text-foreground">{totalRatings ?? 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Ratings</p>
          </div>
          <div className="border border-border rounded-xl p-4 bg-card text-center">
            <p className="text-2xl font-bold text-foreground">{totalComments ?? 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Comments</p>
          </div>
        </div>

        {/* Seed demo data */}
        <SeedButtonRow />

        <Tabs defaultValue="content" className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="content">Content Queue</TabsTrigger>
            <TabsTrigger value="services">Service Listings</TabsTrigger>
            <TabsTrigger value="tools">AI Tools</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="paths">Learning Paths</TabsTrigger>
            <TabsTrigger value="curators">Curators</TabsTrigger>
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

          {/* ── Projects ── */}
          <TabsContent value="projects" className="space-y-6">
            {/* Pending Projects */}
            <h2 className="text-lg font-semibold text-foreground">Pending Projects</h2>
            {pendingProjectsLoading ? (
              <div className="space-y-3"><Skeleton className="h-20 w-full rounded-xl" /><Skeleton className="h-20 w-full rounded-xl" /></div>
            ) : !pendingProjects || pendingProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No pending projects.</p>
            ) : (
              <div className="space-y-3">
                {pendingProjects.map((proj: any) => {
                  const creator = proj.profiles as { username: string | null; display_name: string | null } | null;
                  const comps = proj.project_components ?? [];
                  return (
                    <div key={proj.id} className="border border-border rounded-xl p-4 bg-card space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-sm font-semibold text-foreground">{proj.title}</p>
                          <p className="text-xs text-muted-foreground">
                            by {creator?.display_name || creator?.username || "Unknown"} · {new Date(proj.created_at).toLocaleDateString()} · {comps.length} component{comps.length !== 1 ? "s" : ""}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{proj.description}</p>
                          {/* Component summaries */}
                          <div className="space-y-1 pt-1">
                            {comps.map((c: any, i: number) => {
                              const cid = c.linked_content_id || c.inline_content_id;
                              const ci = pendingProjContent?.find((x: any) => x.id === cid);
                              return (
                                <p key={c.id} className="text-[10px] text-muted-foreground">
                                  {i + 1}. {ci?.title ?? "Unknown"} — {ci?.content_type ?? ""} ({ci?.monetisation_type ?? "free"})
                                </p>
                              );
                            })}
                          </div>
                          {proj.cover_image_url && (
                            <button type="button" onClick={() => window.open(`/project/${proj.id}`, "_blank")} className="text-[10px] text-primary hover:underline">
                              View cover image
                            </button>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8" onClick={() => approveProjectMutation.mutate(proj.id)} disabled={approveProjectMutation.isPending}>
                            {approveProjectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs h-8 border-destructive text-destructive hover:bg-destructive/10" onClick={() => rejectProjectMutation.mutate(proj.id)} disabled={rejectProjectMutation.isPending}>
                            {rejectProjectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Approved Projects */}
            <h2 className="text-lg font-semibold text-foreground mt-8">Approved Projects</h2>
            {approvedProjectsLoading ? (
              <Skeleton className="h-20 w-full rounded-xl" />
            ) : !approvedProjects || approvedProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No approved projects.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-2 px-3 text-xs text-muted-foreground font-medium">Title</th>
                      <th className="py-2 px-3 text-xs text-muted-foreground font-medium">Creator</th>
                      <th className="py-2 px-3 text-xs text-muted-foreground font-medium">Components</th>
                      <th className="py-2 px-3 text-xs text-muted-foreground font-medium">Views</th>
                      <th className="py-2 px-3 text-xs text-muted-foreground font-medium">Approved</th>
                      <th className="py-2 px-3 text-xs text-muted-foreground font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedProjects.map((proj: any) => {
                      const creator = proj.profiles as { username: string | null; display_name: string | null } | null;
                      return (
                        <tr key={proj.id} className="border-b border-border">
                          <td className="py-2.5 px-3 text-foreground font-medium truncate max-w-[200px]">{proj.title}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">@{creator?.username || "unknown"}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{(proj.project_components ?? []).length}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{proj.view_count}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{proj.approved_at ? new Date(proj.approved_at).toLocaleDateString() : "—"}</td>
                          <td className="py-2.5 px-3">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" className="text-xs h-7 border-destructive text-destructive hover:bg-destructive/10">
                                  Remove
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-card border-border">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove "{proj.title}"?</AlertDialogTitle>
                                  <AlertDialogDescription>This will set the project back to pending. It will no longer be visible on the site.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => removeProjectMutation.mutate(proj.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ── Learning Paths ── */}
          <TabsContent value="paths" className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Pending Learning Paths</h2>
            {pendingPathsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ) : !pendingPaths || pendingPaths.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">No pending learning paths.</p>
            ) : (
              <div className="space-y-3">
                {pendingPaths.map((path: any) => {
                  const creator = path.profiles as any;
                  return (
                    <div key={path.id} className="border border-border rounded-xl p-4 bg-card flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{path.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          by {creator?.display_name || creator?.username || "Unknown"} · {path.difficulty_range}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{path.description}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                          onClick={() => approvePathMutation.mutate(path.id)}
                          disabled={approvePathMutation.isPending}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8 border-destructive text-destructive hover:bg-destructive/10"
                          onClick={() => rejectPathMutation.mutate(path.id)}
                          disabled={rejectPathMutation.isPending}
                        >
                          <XCircle className="h-3 w-3 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Curators ── */}
          <TabsContent value="curators" className="space-y-6">
            <CuratorsTab />
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


/* ---- Curators Tab ---- */
function CuratorsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingApps, isLoading: appsLoading } = useQuery({
    queryKey: ["admin_curator_apps_pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("curator_applications")
        .select("*, profiles:user_id(id, username, display_name, avatar_url, follower_count)")
        .eq("status", "pending")
        .order("applied_at", { ascending: true });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const { data: activeCurators, isLoading: curatorsLoading } = useQuery({
    queryKey: ["admin_active_curators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("curators")
        .select("*, profiles:user_id(id, username, display_name, follower_count)")
        .eq("is_active", true);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const { data: recCounts } = useQuery({
    queryKey: ["admin_curator_rec_counts"],
    queryFn: async () => {
      const { data } = await supabase.from("curator_recommendations").select("curator_id").eq("is_active", true);
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { counts[r.curator_id] = (counts[r.curator_id] || 0) + 1; });
      return counts;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (app: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("curator_applications").update({ status: "approved" } as any).eq("id", app.id);
      await supabase.from("curators").insert({ user_id: app.user_id, approved_by: user?.id ?? null } as any);
      await supabase.from("profiles").update({ is_curator: true, curator_application_status: "approved" } as any).eq("id", app.user_id);
      insertNotification({
        recipient_id: app.user_id,
        actor_id: null,
        notification_type: "curator_approved",
        metadata: { message: "You are now a NeoScale Curator. Start recommending content." },
      });
    },
    onSuccess: (_d, app) => {
      queryClient.invalidateQueries({ queryKey: ["admin_curator_apps_pending"] });
      queryClient.invalidateQueries({ queryKey: ["admin_active_curators"] });
      toast({ title: `Approved — ${app.profiles?.display_name || app.profiles?.username} is now a Curator.` });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (app: any) => {
      await supabase.from("curator_applications").update({ status: "rejected" } as any).eq("id", app.id);
      await supabase.from("profiles").update({ curator_application_status: "rejected" } as any).eq("id", app.user_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_curator_apps_pending"] });
      toast({ title: "Application rejected." });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (curator: any) => {
      await supabase.from("curators").update({ is_active: false } as any).eq("id", curator.id);
      await supabase.from("profiles").update({ is_curator: false } as any).eq("id", curator.user_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_active_curators"] });
      toast({ title: "Curator deactivated." });
    },
  });

  return (
    <>
      <h2 className="text-lg font-semibold text-foreground">Pending Applications</h2>
      {appsLoading ? (
        <div className="space-y-3"><Skeleton className="h-20 w-full rounded-xl" /></div>
      ) : !pendingApps || pendingApps.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No pending curator applications.</p>
      ) : (
        <div className="space-y-3">
          {pendingApps.map((app: any) => {
            const p = app.profiles;
            const initials = (p?.display_name || p?.username || "?").slice(0, 2).toUpperCase();
            return (
              <div key={app.id} className="border border-border rounded-xl p-4 bg-card flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium shrink-0 overflow-hidden">
                    {p?.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{p?.display_name || p?.username}</p>
                    <p className="text-xs text-muted-foreground">@{p?.username} · {p?.follower_count ?? 0} followers · applied {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : ""}</p>
                    <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{app.reason}</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8" onClick={() => approveMutation.mutate(app)} disabled={approveMutation.isPending}>
                    {approveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />} Approve
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-8 border-destructive text-destructive hover:bg-destructive/10" onClick={() => rejectMutation.mutate(app)} disabled={rejectMutation.isPending}>
                    {rejectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />} Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="text-lg font-semibold text-foreground mt-8">Active Curators</h2>
      {curatorsLoading ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : !activeCurators || activeCurators.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No active curators.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 px-3 text-xs text-muted-foreground font-medium">Curator</th>
                <th className="py-2 px-3 text-xs text-muted-foreground font-medium">Followers</th>
                <th className="py-2 px-3 text-xs text-muted-foreground font-medium">Recommendations</th>
                <th className="py-2 px-3 text-xs text-muted-foreground font-medium">Joined</th>
                <th className="py-2 px-3 text-xs text-muted-foreground font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {activeCurators.map((c: any) => (
                <tr key={c.id} className="border-b border-border">
                  <td className="py-2.5 px-3 text-foreground font-medium">{c.profiles?.display_name || c.profiles?.username} <span className="text-xs text-muted-foreground">@{c.profiles?.username}</span></td>
                  <td className="py-2.5 px-3 text-muted-foreground">{c.profiles?.follower_count ?? 0}</td>
                  <td className="py-2.5 px-3 text-muted-foreground">{recCounts?.[c.id] ?? 0}</td>
                  <td className="py-2.5 px-3 text-muted-foreground">{c.approved_at ? new Date(c.approved_at).toLocaleDateString() : "—"}</td>
                  <td className="py-2.5 px-3">
                    <Button size="sm" variant="outline" className="text-xs h-7 border-destructive text-destructive hover:bg-destructive/10" onClick={() => deactivateMutation.mutate(c)} disabled={deactivateMutation.isPending}>Deactivate</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default Admin;
