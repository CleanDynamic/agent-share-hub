/* /admin. Synth 15 Part F: in the site frame, two panels, `minmax(0, 1fr) 340px` (AdminFrame): the h1 "Admin" at 20/600 with
   Sign Out at the right and the site's counts as one line under it, then the tabs (Reports, Service Listings, AI Tools,
   Projects, Learning Paths, Curators; prompt 06's tabs at content width). Each tab is a table; the selected row is
   Card-filled and its detail fills the side panel, headed by its fact, with the same actions as its row. Confirmations
   and the rejection reason use the modal recipe. Every read, write, query key and toast is the page's own. */

import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { adminSetCurator } from "@/lib/auth/adminSetCurator";
import { insertNotification } from "@/lib/notifications";
import { useToast } from "@/hooks/use-toast";
import { SeoHead } from "@/components/SeoHead";
import { ReportsQueue } from "@/components/moderation/ReportsQueue";
import { AdminConfirm, RejectWithReason } from "@/components/admin/AdminDialogs";
import {
  ADMIN_META,
  AdminDetail,
  AdminEmpty,
  AdminLayout,
  AdminRowsLoading,
  AdminSection,
  AdminTable,
  DetailActions,
  DetailFact,
  RowAction,
  adminText,
  countOf,
  useAdminMode,
} from "@/components/admin/AdminFrame";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/brand/Button";
import { TextTabs } from "@/components/vision/TextTabs";
import { SITE_NAME } from "@/lib/site";
import { t } from "@/lib/theme/tokens";
import { textStep } from "@/lib/theme/type";

/* eslint-disable @typescript-eslint/no-explicit-any -- the admin's reads are untyped joins, as they were */

type TabValue = "reports" | "services" | "tools" | "projects" | "paths" | "curators";

const TABS: ReadonlyArray<{ value: TabValue; label: string }> = [
  { value: "reports", label: "Reports" },
  { value: "services", label: "Service Listings" },
  { value: "tools", label: "AI Tools" },
  { value: "projects", label: "Projects" },
  { value: "paths", label: "Learning Paths" },
  { value: "curators", label: "Curators" },
];

const day = (value: string | null | undefined): string => (value ? new Date(value).toLocaleDateString() : "");
const handle = (profile: { username?: string | null } | null | undefined): string => `@${profile?.username || "unknown"}`;
const who = (profile: { username?: string | null; display_name?: string | null } | null | undefined): string => profile?.display_name || profile?.username || "Unknown";
const linkStyle: CSSProperties = { ...adminText(textStep.body, t.text), textDecoration: "underline", textDecorationColor: t.label, textUnderlineOffset: 3, overflowWrap: "anywhere" };

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Pending content ──
  const { data: pendingItems } = useQuery({
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


  const [tab, setTab] = useState<TabValue>("reports");
  const mode = useAdminMode();

  const facts = [
    countOf(pendingItems?.length ?? 0, "pending item"),
    countOf(approvedToolsList.length, "AI tool"),
    countOf(pendingProjects?.length ?? 0, "pending project"),
    countOf(approvedProjects?.length ?? 0, "live project"),
    countOf(totalRatings ?? 0, "rating"),
    countOf(totalComments ?? 0, "comment"),
  ].join(" · ");

  const head = (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <h1 style={adminText(textStep.headline, t.text, { fontWeight: 600, lineHeight: "24px" })}>Admin</h1>
          <p data-testid="admin-facts" style={ADMIN_META}>{facts}</p>
        </div>
        <Button variant="secondary" size={mode === "cards" ? 44 : 32} onClick={handleSignOut}>
          Sign Out
        </Button>
      </div>
      <div style={{ overflowX: "auto", margin: "0 -16px", padding: "0 4px" }}>
        <TextTabs<TabValue>
          label="Admin sections"
          value={tab}
          onChange={setTab}
          tabs={TABS.map((entry) => ({ ...entry, id: `admin-tab-${entry.value}`, controls: `admin-panel-${entry.value}` }))}
        />
      </div>
    </>
  );

  return (
    <>
      <SeoHead title="Admin" description="Admin panel." path="/admin" noIndex />
      <AdminLayout head={head}>
        <div role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`} style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
          {/* RC-P17b: the reports queue. It takes the Content Queue's place: that tab moderated legacy posts, all of which the clear deletes. */}
          {tab === "reports" ? <ReportsQueue /> : null}
          {tab === "services" ? (
            <ServicesTab
              listings={allListings}
              loading={listingsLoading}
              onToggle={(id, is_active) => toggleListingMutation.mutate({ id, is_active })}
              busy={toggleListingMutation.isPending}
            />
          ) : null}
          {tab === "tools" ? (
            <ToolsTab
              tools={allTools}
              loading={toolsLoading}
              approved={approvedToolsList.length}
              pending={pendingToolsList.length}
              onApprove={(id) => approveToolMutation.mutate(id)}
              onReject={(id, reason) => rejectToolMutation.mutate({ id, reason })}
              approving={approveToolMutation.isPending}
              rejecting={rejectToolMutation.isPending}
            />
          ) : null}
          {tab === "projects" ? (
            <ProjectsTab
              pending={pendingProjects}
              approved={approvedProjects}
              loading={pendingProjectsLoading || approvedProjectsLoading}
              content={pendingProjContent}
              onApprove={(id) => approveProjectMutation.mutate(id)}
              onReject={(id) => rejectProjectMutation.mutate(id)}
              onRemove={(id) => removeProjectMutation.mutate(id)}
              approving={approveProjectMutation.isPending}
              rejecting={rejectProjectMutation.isPending}
              removing={removeProjectMutation.isPending}
            />
          ) : null}
          {tab === "paths" ? (
            <PathsTab
              paths={pendingPaths}
              loading={pendingPathsLoading}
              onApprove={(id) => approvePathMutation.mutate(id)}
              onReject={(id) => rejectPathMutation.mutate(id)}
              approving={approvePathMutation.isPending}
              rejecting={rejectPathMutation.isPending}
            />
          ) : null}
          {tab === "curators" ? <CuratorsTab /> : null}
        </div>
      </AdminLayout>
    </>
  );
};

/* ── Service listings ── */

function ServicesTab({ listings, loading, onToggle, busy }: { listings: any[] | undefined; loading: boolean; onToggle: (id: string, active: boolean) => void; busy: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const picked = listings?.find((listing) => listing.id === selected) ?? null;
  const price = (listing: any) => `£${Number(listing.price_gbp ?? 0).toFixed(2)}`;
  /* The listing's on/off switch, as it was before Synth 15: the same Switch, on when the listing is active, off when it is not. The
     Status column and the detail's Status fact already say which, so no word sits beside it. */
  const toggle = (listing: any) => (
    <Switch checked={Boolean(listing.is_active)} onCheckedChange={(checked) => onToggle(listing.id, checked)} disabled={busy} />
  );
  return (
    <AdminSection fact={loading ? "Service listings" : countOf(listings?.length ?? 0, "service listing")}>
      {loading ? (
        <AdminRowsLoading />
      ) : !listings || listings.length === 0 ? (
        <AdminEmpty>No service listings yet.</AdminEmpty>
      ) : (
        <AdminTable
          label="Service listings"
          rows={listings}
          rowKey={(listing) => listing.id}
          selected={selected}
          onSelect={setSelected}
          name={{ head: "Listing", cell: (listing) => listing.title, label: (listing) => listing.title }}
          columns={[
            { head: "By", meta: (listing) => handle(listing.profiles), cell: (listing) => handle(listing.profiles) },
            { head: "Price", numeric: true, meta: price, cell: price },
            { head: "Status", meta: (listing) => (listing.is_active ? "Active" : "Inactive"), cell: (listing) => (listing.is_active ? "Active" : "Inactive") },
          ]}
          actions={toggle}
        />
      )}
      {picked ? (
        <AdminDetail fact={picked.title} onClose={() => setSelected(null)}>
          <DetailFact label="By">{handle(picked.profiles)}</DetailFact>
          <DetailFact label="Price" mono>{price(picked)}</DetailFact>
          <DetailFact label="Status">{picked.is_active ? "Active" : "Deactivated"}</DetailFact>
          <DetailActions>{toggle(picked)}</DetailActions>
        </AdminDetail>
      ) : null}
    </AdminSection>
  );
}

/* ── AI tools ── */

function ToolsTab({
  tools,
  loading,
  approved,
  pending,
  onApprove,
  onReject,
  approving,
  rejecting,
}: {
  tools: any[] | undefined;
  loading: boolean;
  approved: number;
  pending: number;
  onApprove: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
  approving: boolean;
  rejecting: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [rejectingTool, setRejectingTool] = useState<any | null>(null);
  /* Pending first, then approved, then rejected, each in the order they were read. */
  const order: Record<string, number> = { pending: 0, approved: 1, rejected: 2 };
  const rows = [...(tools ?? [])].filter((tool) => tool.status in order).sort((a, b) => order[a.status] - order[b.status]);
  const picked = rows.find((tool) => tool.id === selected) ?? null;
  const status = (tool: any) => (tool.status === "approved" ? (tool.is_official ? "Approved · Official" : "Approved") : tool.status === "pending" ? "Pending" : "Rejected");
  const actions = (tool: any) =>
    tool.status === "pending" ? (
      <>
        <RowAction disabled={approving} onClick={() => onApprove(tool.id)}>
          Approve
        </RowAction>
        <RowAction disabled={rejecting} onClick={() => setRejectingTool(tool)}>
          Reject
        </RowAction>
      </>
    ) : null;
  return (
    <AdminSection fact={loading ? "AI tools" : `${approved} tools approved · ${pending} pending review`} label="AI tools">
      {loading ? (
        <AdminRowsLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty>No tools in the registry yet.</AdminEmpty>
      ) : (
        <AdminTable
          label="AI tools"
          rows={rows}
          rowKey={(tool) => tool.id}
          selected={selected}
          onSelect={setSelected}
          name={{ head: "Tool", cell: (tool) => tool.name, label: (tool) => tool.name }}
          columns={[
            { head: "Category", meta: (tool) => tool.category ?? "", cell: (tool) => tool.category },
            { head: "Status", meta: status, cell: status },
            { head: "Submitted", meta: (tool) => day(tool.created_at), cell: (tool) => day(tool.created_at) },
          ]}
          actions={(tool) => actions(tool)}
        />
      )}
      {picked ? (
        <AdminDetail fact={picked.name} onClose={() => setSelected(null)}>
          {picked.website_url ? (
            <DetailFact label="Website">
              <a href={picked.website_url} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                {picked.website_url}
              </a>
            </DetailFact>
          ) : null}
          {picked.description ? <DetailFact label="Description">{picked.description}</DetailFact> : null}
          <DetailFact label="Category">{picked.category}</DetailFact>
          <DetailFact label="Status">{status(picked)}</DetailFact>
          <DetailFact label="Submitted by">{`${handle(picked.profiles)} · ${day(picked.created_at)}`}</DetailFact>
          {picked.rejected_reason ? <DetailFact label="Rejection reason">{picked.rejected_reason}</DetailFact> : null}
          {actions(picked) ? <DetailActions>{actions(picked)}</DetailActions> : null}
        </AdminDetail>
      ) : null}
      <RejectWithReason
        open={rejectingTool !== null}
        onOpenChange={(open) => (!open ? setRejectingTool(null) : undefined)}
        name={rejectingTool?.name ?? "this tool"}
        busy={rejecting}
        onReject={(reason) => {
          if (rejectingTool) onReject(rejectingTool.id, reason);
          setRejectingTool(null);
        }}
      />
    </AdminSection>
  );
}

/* ── Projects ── */

function ProjectsTab({
  pending,
  approved,
  loading,
  content,
  onApprove,
  onReject,
  onRemove,
  approving,
  rejecting,
  removing,
}: {
  pending: any[] | undefined;
  approved: any[] | undefined;
  loading: boolean;
  content: any[] | undefined;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRemove: (id: string) => void;
  approving: boolean;
  rejecting: boolean;
  removing: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [removingProject, setRemovingProject] = useState<any | null>(null);
  const rows = [...(pending ?? []).map((project) => ({ ...project, live: false })), ...(approved ?? []).map((project) => ({ ...project, live: true }))];
  const picked = rows.find((project) => project.id === selected) ?? null;
  const parts = (project: any) => (project.project_components ?? []).length;
  const actions = (project: any) =>
    project.live ? (
      <RowAction disabled={removing} onClick={() => setRemovingProject(project)}>
        Remove
      </RowAction>
    ) : (
      <>
        <RowAction disabled={approving} onClick={() => onApprove(project.id)}>
          Approve
        </RowAction>
        <RowAction disabled={rejecting} onClick={() => onReject(project.id)}>
          Reject
        </RowAction>
      </>
    );
  return (
    <AdminSection fact={loading ? "Projects" : `${countOf(pending?.length ?? 0, "pending project")} · ${approved?.length ?? 0} live`} label="Projects">
      {loading ? (
        <AdminRowsLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty>No pending projects.</AdminEmpty>
      ) : (
        <AdminTable
          label="Projects"
          rows={rows}
          rowKey={(project) => project.id}
          selected={selected}
          onSelect={setSelected}
          name={{ head: "Project", cell: (project) => project.title, label: (project) => project.title }}
          columns={[
            { head: "Creator", meta: (project) => handle(project.profiles), cell: (project) => handle(project.profiles) },
            { head: "Parts", numeric: true, meta: (project) => countOf(parts(project), "component"), cell: (project) => parts(project) },
            { head: "Views", numeric: true, meta: (project) => (project.live ? countOf(project.view_count ?? 0, "view") : ""), cell: (project) => (project.live ? (project.view_count ?? 0) : "") },
            { head: "Status", meta: (project) => (project.live ? "Live" : "Pending"), cell: (project) => (project.live ? "Live" : "Pending") },
            { head: "When", meta: (project) => day(project.live ? project.approved_at : project.created_at), cell: (project) => day(project.live ? project.approved_at : project.created_at) },
          ]}
          actions={actions}
        />
      )}
      {picked ? (
        <AdminDetail fact={picked.title} onClose={() => setSelected(null)}>
          <DetailFact label="Creator">{`${who(picked.profiles)} · ${day(picked.created_at)}`}</DetailFact>
          <DetailFact label="Status">{picked.live ? `Live since ${day(picked.approved_at)}` : "Pending"}</DetailFact>
          {picked.description ? <DetailFact label="Description">{picked.description}</DetailFact> : null}
          {!picked.live && parts(picked) > 0 ? (
            <DetailFact label={countOf(parts(picked), "component")}>
              {(picked.project_components ?? [])
                .map((component: any, index: number) => {
                  const id = component.linked_content_id || component.inline_content_id;
                  const item = content?.find((entry: any) => entry.id === id);
                  return `${index + 1}. ${item?.title ?? "Unknown"} · ${item?.content_type ?? ""} (${item?.monetisation_type ?? "free"})`;
                })
                .join("\n")}
            </DetailFact>
          ) : null}
          {!picked.live && picked.cover_image_url ? (
            <div>
              <button type="button" onClick={() => window.open(`/project/${picked.id}`, "_blank")} style={{ ...linkStyle, background: "transparent", border: 0, padding: 0, cursor: "pointer" }}>
                View cover image
              </button>
            </div>
          ) : null}
          <DetailActions>{actions(picked)}</DetailActions>
        </AdminDetail>
      ) : null}
      <AdminConfirm
        open={removingProject !== null}
        onOpenChange={(open) => (!open ? setRemovingProject(null) : undefined)}
        title={`Remove "${removingProject?.title ?? ""}"?`}
        description="This will set the project back to pending. It will no longer be visible on the site."
        confirmLabel="Remove"
        busy={removing}
        testId="remove-project-dialog"
        onConfirm={() => {
          if (removingProject) onRemove(removingProject.id);
          setRemovingProject(null);
        }}
      />
    </AdminSection>
  );
}

/* ── Learning paths ── */

function PathsTab({
  paths,
  loading,
  onApprove,
  onReject,
  approving,
  rejecting,
}: {
  paths: any[] | undefined;
  loading: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  approving: boolean;
  rejecting: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const picked = paths?.find((path) => path.id === selected) ?? null;
  const actions = (path: any) => (
    <>
      <RowAction disabled={approving} onClick={() => onApprove(path.id)}>
        Approve
      </RowAction>
      <RowAction disabled={rejecting} onClick={() => onReject(path.id)}>
        Reject
      </RowAction>
    </>
  );
  return (
    <AdminSection fact={loading ? "Learning paths" : countOf(paths?.length ?? 0, "pending learning path")} label="Learning paths">
      {loading ? (
        <AdminRowsLoading />
      ) : !paths || paths.length === 0 ? (
        <AdminEmpty>No pending learning paths.</AdminEmpty>
      ) : (
        <AdminTable
          label="Pending learning paths"
          rows={paths}
          rowKey={(path) => path.id}
          selected={selected}
          onSelect={setSelected}
          name={{ head: "Path", cell: (path) => path.title, label: (path) => path.title }}
          columns={[
            { head: "Creator", meta: (path) => who(path.profiles), cell: (path) => who(path.profiles) },
            { head: "Difficulty", meta: (path) => path.difficulty_range ?? "", cell: (path) => path.difficulty_range },
          ]}
          actions={actions}
        />
      )}
      {picked ? (
        <AdminDetail fact={picked.title} onClose={() => setSelected(null)}>
          <DetailFact label="Creator">{who(picked.profiles)}</DetailFact>
          {picked.difficulty_range ? <DetailFact label="Difficulty">{picked.difficulty_range}</DetailFact> : null}
          {picked.description ? <DetailFact label="Description">{picked.description}</DetailFact> : null}
          <DetailActions>{actions(picked)}</DetailActions>
        </AdminDetail>
      ) : null}
    </AdminSection>
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
      await adminSetCurator(app.user_id, true);
      insertNotification({
        recipient_id: app.user_id,
        actor_id: null,
        notification_type: "curator_approved",
        metadata: { message: `You are now a ${SITE_NAME} Curator. Start recommending content.` },
      });
    },
    onSuccess: (_d, app) => {
      queryClient.invalidateQueries({ queryKey: ["admin_curator_apps_pending"] });
      queryClient.invalidateQueries({ queryKey: ["admin_active_curators"] });
      toast({ title: `Approved. ${app.profiles?.display_name || app.profiles?.username} is now a Curator.` });
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
      await adminSetCurator(curator.user_id, false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_active_curators"] });
      toast({ title: "Curator deactivated." });
    },
  });

  const [selected, setSelected] = useState<string | null>(null);
  const rows = [
    ...(pendingApps ?? []).map((app: any) => ({ key: `app-${app.id}`, kind: "application" as const, app, profile: app.profiles })),
    ...(activeCurators ?? []).map((curator: any) => ({ key: `curator-${curator.id}`, kind: "curator" as const, curator, profile: curator.profiles })),
  ];
  type CuratorRow = (typeof rows)[number];
  const picked = rows.find((row) => row.key === selected) ?? null;
  const loading = appsLoading || curatorsLoading;
  const actions = (row: CuratorRow) =>
    row.kind === "application" ? (
      <>
        <RowAction disabled={approveMutation.isPending} onClick={() => approveMutation.mutate(row.app)}>
          Approve
        </RowAction>
        <RowAction disabled={rejectMutation.isPending} onClick={() => rejectMutation.mutate(row.app)}>
          Reject
        </RowAction>
      </>
    ) : (
      <RowAction disabled={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(row.curator)}>
        Deactivate
      </RowAction>
    );
  const when = (row: CuratorRow) => (row.kind === "application" ? `Applied ${day(row.app.applied_at)}` : `Joined ${day(row.curator.approved_at)}`);
  const fact = loading ? "Curators" : `${countOf(pendingApps?.length ?? 0, "pending application")} · ${countOf(activeCurators?.length ?? 0, "active curator")}`;

  return (
    <AdminSection fact={fact} label="Curators">
      {loading ? (
        <AdminRowsLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty>No pending curator applications.</AdminEmpty>
      ) : (
        <AdminTable<CuratorRow>
          label="Curators"
          rows={rows}
          rowKey={(row) => row.key}
          selected={selected}
          onSelect={setSelected}
          name={{ head: "Name", cell: (row) => who(row.profile), label: (row) => who(row.profile) }}
          columns={[
            { head: "Handle", meta: (row) => handle(row.profile), cell: (row) => handle(row.profile) },
            { head: "Followers", numeric: true, meta: (row) => countOf(row.profile?.follower_count ?? 0, "follower"), cell: (row) => row.profile?.follower_count ?? 0 },
            {
              head: "Recommendations",
              numeric: true,
              meta: (row) => (row.kind === "curator" ? countOf(recCounts?.[row.curator.id] ?? 0, "recommendation") : ""),
              cell: (row) => (row.kind === "curator" ? (recCounts?.[row.curator.id] ?? 0) : ""),
            },
            { head: "Status", meta: when, cell: when },
          ]}
          actions={actions}
        />
      )}
      {picked ? (
        <AdminDetail fact={picked.kind === "application" ? `${who(picked.profile)} applied` : `${who(picked.profile)} is a curator`} onClose={() => setSelected(null)}>
          <DetailFact label="Handle">{`${handle(picked.profile)} · ${countOf(picked.profile?.follower_count ?? 0, "follower")}`}</DetailFact>
          <DetailFact label={picked.kind === "application" ? "Applied" : "Joined"}>{picked.kind === "application" ? day(picked.app.applied_at) : day(picked.curator.approved_at)}</DetailFact>
          {picked.kind === "application" && picked.app.reason ? <DetailFact label="Reason">{picked.app.reason}</DetailFact> : null}
          {picked.kind === "curator" ? <DetailFact label="Recommendations" mono>{recCounts?.[picked.curator.id] ?? 0}</DetailFact> : null}
          <DetailActions>{actions(picked)}</DetailActions>
        </AdminDetail>
      ) : null}
    </AdminSection>
  );
}

export default Admin;
