import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Star, StarHalf, RefreshCw, X } from "lucide-react";
import { PublishUpdateModal } from "@/components/PublishUpdateModal";
import { useToast } from "@/hooks/use-toast";
import { useDraftCount } from "@/hooks/useDraftCount";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { body, data as dataText, tabular, type } from "@/lib/theme/type";

function roundedStars(avg: number, count: number): number {
  if (count === 0) return 0;
  if (avg >= 4.5) return 5;
  if (avg >= 4.1) return 4.5;
  if (avg >= 3.5) return 4;
  if (avg >= 3.1) return 3.5;
  if (avg >= 2.5) return 3;
  if (avg >= 2.1) return 2.5;
  if (avg >= 1.5) return 2;
  if (avg >= 1.1) return 1.5;
  return 1;
}

function TinyStars({ value }: { value: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(value)) stars.push(<Star key={i} className="h-2.5 w-2.5 fill-primary text-primary" />);
    else if (i - 0.5 === value) stars.push(<StarHalf key={i} className="h-2.5 w-2.5 fill-primary text-primary" />);
    else stars.push(<Star key={i} className="h-2.5 w-2.5" style={{ color: t.line }} />);
  }
  return <span className="inline-flex gap-0.5">{stars}</span>;
}

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
  const [tab, setTab] = useState<"content" | "projects">("content");
  const { toast } = useToast();
  const { count: draftCount, display: draftDisplay } = useDraftCount();
  const [updateTarget, setUpdateTarget] = useState<{ id: string; title: string; version: string } | null>(null);
  const [expandedInvites, setExpandedInvites] = useState<string | null>(null);

  // Fetch pending invites for user's content
  const { data: pendingInvites, refetch: refetchInvites } = useQuery({
    queryKey: ["my_pending_invites", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("collab_invites")
        .select("id, content_id, invitee_id, status, profiles!collab_invites_invitee_id_fkey(username, display_name)")
        .eq("inviter_id", profile!.id)
        .eq("status", "pending");
      return (data as any[]) ?? [];
    },
    enabled: !!profile?.id,
  });

  async function withdrawInvite(inviteId: string) {
    await supabase.from("collab_invites").update({ status: "withdrawn" } as any).eq("id", inviteId);
    refetchInvites();
    toast({ title: "Invite withdrawn" });
  }
  useEffect(() => {
    if (!loading && !isLoggedIn) navigate("/login", { replace: true });
    if (!loading && isLoggedIn && !isCreator) navigate("/", { replace: true });
  }, [loading, isLoggedIn, isCreator, navigate]);

  const { data: items, isLoading } = useQuery({
    queryKey: ["my_uploads", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, title, content_type, status, download_count, created_at, avg_rating, rating_count, view_count, current_version")
        .eq("creator_id", profile!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["my_projects", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, status, view_count, created_at, package_price_enabled, package_price_gbp")
        .eq("creator_id", profile!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch component counts
      if (!data || data.length === 0) return [];
      const projectIds = data.map((p) => p.id);
      const { data: comps } = await supabase
        .from("project_components")
        .select("project_id")
        .in("project_id", projectIds);

      const countMap: Record<string, number> = {};
      (comps ?? []).forEach((c) => {
        countMap[c.project_id] = (countMap[c.project_id] || 0) + 1;
      });

      return data.map((p) => ({ ...p, componentCount: countMap[p.id] || 0 }));
    },
    enabled: !!profile?.id,
  });

  if (loading) return null;

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6">
      <SeoHead title="My Uploads — buildgallery.ai" description="Manage your uploaded content." path="/my-uploads" noIndex />
      <div className="mx-auto max-w-5xl">
        {/* Drafts indicator */}
        {/* Unfinished drafts are a NOTE, not a warning. The amber-on-amber
            panel this was read as an error on a page that had none; it takes
            the recess ground every other inset panel on the site uses, and
            the count goes in the data face. */}
        {draftDisplay && (
          <div className="mb-4 border px-4 py-3 flex items-center justify-between" style={{ backgroundColor: t.recess, borderColor: t.line, borderRadius: r.panel }}>
            <p style={{ ...dataText, ...tabular, fontSize: 13, color: t.text }}>
              {draftDisplay} draft{draftCount > 1 ? "s" : ""} in progress
            </p>
            <button onClick={() => navigate("/drafts")} style={{ ...body, fontSize: 12, background: "transparent", border: "none", cursor: "pointer", color: t.action, textDecoration: "underline", textUnderlineOffset: "3px" }}>
              View drafts →
            </button>
          </div>
        )}
        <div className="flex items-center justify-between mb-6">
          <h1 style={{ ...type.sectionHead, fontSize: 30, color: t.text, margin: 0 }}>My uploads</h1>
          <Button size="sm" className="min-h-[44px]" asChild>
            <Link to="/upload"><Plus className="h-4 w-4 mr-1.5" /> Upload new</Link>
          </Button>
        </div>

        {/* Tabs */}
        {/* BG-P07's tab: a 2px `--action` underline and a step up to full
            `--text`, the same mark /profile and /creator now carry. */}
        <div className="flex gap-0 mb-6" style={{ borderBottom: `1px solid ${t.line}` }}>
          {(["content", "projects"] as const).map((key) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                data-state={active ? "active" : "inactive"}
                aria-current={active ? "page" : undefined}
                className="px-4 py-2.5"
                style={{
                  ...body,
                  fontSize: 14,
                  fontWeight: 500,
                  background: "transparent",
                  border: "none",
                  borderBottom: `2px solid ${active ? t.action : "transparent"}`,
                  color: active ? t.text : t.text2,
                  cursor: "pointer",
                  transition: "color 160ms cubic-bezier(.2,.6,.35,1)",
                }}
              >
                {key === "content" ? "Content" : "Projects"}
              </button>
            );
          })}
        </div>

        {tab === "content" ? (
          isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 sm:h-12 rounded-xl" />)}
            </div>
          ) : items && items.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block border border-border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead style={{ ...dataText, color: t.text2 }}>Title</TableHead>
                      <TableHead style={{ ...dataText, color: t.text2 }}>Type</TableHead>
                      <TableHead style={{ ...dataText, color: t.text2 }}>Status</TableHead>
                      <TableHead className="text-right" style={{ ...dataText, color: t.text2 }}>Rating</TableHead>
                      <TableHead className="text-right" style={{ ...dataText, color: t.text2 }}>Views</TableHead>
                      <TableHead className="text-right" style={{ ...dataText, color: t.text2 }}>Downloads</TableHead>
                      <TableHead className="text-right" style={{ ...dataText, color: t.text2 }}>Date</TableHead>
                      <TableHead style={{ ...dataText, color: t.text2 }}>Version</TableHead>
                       <TableHead className="text-right" style={{ ...dataText, color: t.text2 }}></TableHead>
                    </TableRow>
                   </TableHeader>
                   <TableBody>
                    {items.map((item) => {
                      const rc = (item as any).rating_count ?? 0;
                      const sv = roundedStars(Number((item as any).avg_rating) || 0, rc);
                      return (
                        <TableRow key={item.id} className="border-border cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/content/${item.id}`)}>
                          <TableCell style={{ ...body, fontSize: 14, fontWeight: 500, color: t.text }}>{item.title}</TableCell>
                          <TableCell style={{ ...dataText, fontSize: 12, color: t.text2 }}>{item.content_type}</TableCell>
                          <TableCell>{statusBadge(item.status)}</TableCell>
                          <TableCell className="text-right">
                            {rc > 0 ? (
                              <div className="flex items-center justify-end gap-1">
                                <TinyStars value={sv} />
                                <span style={{ ...dataText, ...tabular, fontSize: 10, color: t.text2 }}>({rc})</span>
                              </div>
                            ) : (
                              <span style={{ ...dataText, ...tabular, fontSize: 10, color: t.text2 }}>—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right" style={{ ...dataText, ...tabular, fontSize: 13, color: t.text2 }}>{(item as any).view_count ?? 0}</TableCell>
                          <TableCell className="text-right" style={{ ...dataText, ...tabular, fontSize: 13, color: t.text2 }}>{item.download_count}</TableCell>
                          <TableCell className="text-right" style={{ ...dataText, ...tabular, fontSize: 12, color: t.text2 }}>
                            {new Date(item.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell style={{ ...dataText, fontSize: 12, color: t.text2 }}>
                            v{(item as any).current_version || "1.0"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {item.status === "approved" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setUpdateTarget({
                                      id: item.id,
                                      title: item.title,
                                      version: (item as any).current_version || "1.0",
                                    });
                                  }}
                                  className="text-[11px] text-primary hover:underline flex items-center gap-1"
                                >
                                  <RefreshCw className="h-3 w-3" /> Publish update
                                </button>
                              )}
                              {(pendingInvites ?? []).filter((inv: any) => inv.content_id === item.id).length > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedInvites(expandedInvites === item.id ? null : item.id);
                                  }}
                                  className="text-[11px] text-amber-400 hover:underline"
                                >
                                  {(pendingInvites ?? []).filter((inv: any) => inv.content_id === item.id).length} pending invite{(pendingInvites ?? []).filter((inv: any) => inv.content_id === item.id).length !== 1 ? "s" : ""}
                                </button>
                              )}
                            </div>
                            {expandedInvites === item.id && (
                              <div className="mt-2 space-y-1">
                                {(pendingInvites ?? []).filter((inv: any) => inv.content_id === item.id).map((inv: any) => (
                                  <div key={inv.id} className="flex items-center justify-end gap-2 text-[11px]">
                                    <span style={{ ...dataText, color: t.text2 }}>@{inv.profiles?.username || inv.profiles?.display_name}</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); withdrawInvite(inv.id); }}
                                      className="text-destructive hover:underline flex items-center gap-0.5"
                                    >
                                      <X className="h-3 w-3" /> Withdraw
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile card layout */}
              <div className="sm:hidden space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/content/${item.id}`)}
                    className="p-4 cursor-pointer space-y-2" style={{ border: `1px solid ${t.glassBorder}`, borderRadius: r.card, background: t.glass }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2" style={{ ...body, fontSize: 14, fontWeight: 600, color: t.text }}>{item.title}</p>
                      {statusBadge(item.status)}
                    </div>
                    <div className="flex items-center gap-4" style={{ ...dataText, ...tabular, fontSize: 12, color: t.text2 }}>
                      <span>v{(item as any).current_version || "1.0"}</span>
                      <span>{item.download_count} downloads</span>
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                    {item.status === "approved" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setUpdateTarget({ id: item.id, title: item.title, version: (item as any).current_version || "1.0" });
                        }}
                        className="flex items-center gap-1 mt-1" style={{ ...body, fontSize: 11, background: "transparent", border: "none", padding: 0, cursor: "pointer", color: t.action, textDecoration: "underline", textUnderlineOffset: "3px" }}
                      >
                        <RefreshCw className="h-3 w-3" /> Publish update
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="mb-4" style={{ ...body, fontSize: 14, color: t.text2 }}>You haven't uploaded anything yet.</p>
              <Button className="min-h-[44px]" asChild>
                <Link to="/upload">Upload your first content</Link>
              </Button>
            </div>
          )
        ) : (
          projectsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 sm:h-12 rounded-xl" />)}
            </div>
          ) : projects && projects.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block border border-border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead style={{ ...dataText, color: t.text2 }}>Title</TableHead>
                      <TableHead style={{ ...dataText, color: t.text2 }}>Components</TableHead>
                      <TableHead style={{ ...dataText, color: t.text2 }}>Pricing</TableHead>
                      <TableHead className="text-right" style={{ ...dataText, color: t.text2 }}>Views</TableHead>
                      <TableHead style={{ ...dataText, color: t.text2 }}>Status</TableHead>
                      <TableHead className="text-right" style={{ ...dataText, color: t.text2 }}>Date</TableHead>
                      <TableHead className="text-right" style={{ ...dataText, color: t.text2 }}></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((proj) => (
                      <TableRow key={proj.id} className="border-border cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/project/${proj.id}`)}>
                        <TableCell style={{ ...body, fontSize: 14, fontWeight: 500, color: t.text }}>{proj.title}</TableCell>
                        <TableCell style={{ ...dataText, ...tabular, fontSize: 13, color: t.text2 }}>{proj.componentCount}</TableCell>
                        <TableCell>
                          {(proj as any).package_price_enabled ? (
                            <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">
                              Package: £{Number((proj as any).package_price_gbp ?? 0).toFixed(2)}
                            </Badge>
                          ) : (
                            <span style={{ ...body, fontSize: 12, color: t.text2 }}>Individual only</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right" style={{ ...dataText, ...tabular, fontSize: 13, color: t.text2 }}>{proj.view_count}</TableCell>
                        <TableCell>{statusBadge(proj.status)}</TableCell>
                        <TableCell className="text-right" style={{ ...dataText, ...tabular, fontSize: 12, color: t.text2 }}>
                          {new Date(proj.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {/* TODO: build project edit page */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/project/${proj.id}/edit`);
                            }}
                            className="text-[11px] text-primary hover:underline"
                          >
                            Edit pricing
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile card layout */}
              <div className="sm:hidden space-y-3">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    onClick={() => navigate(`/project/${proj.id}`)}
                    className="p-4 cursor-pointer space-y-2" style={{ border: `1px solid ${t.glassBorder}`, borderRadius: r.card, background: t.glass }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2" style={{ ...body, fontSize: 14, fontWeight: 600, color: t.text }}>{proj.title}</p>
                      {statusBadge(proj.status)}
                    </div>
                    <div className="flex items-center gap-4" style={{ ...dataText, ...tabular, fontSize: 12, color: t.text2 }}>
                      <span>{proj.componentCount} components</span>
                      <span>
                        {(proj as any).package_price_enabled
                          ? `Package: £${Number((proj as any).package_price_gbp ?? 0).toFixed(2)}`
                          : "Individual only"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="mb-4" style={{ ...body, fontSize: 14, color: t.text2 }}>You haven't created any projects yet.</p>
              <Button className="min-h-[44px]" asChild>
                <Link to="/upload">Create your first project</Link>
              </Button>
            </div>
          )
        )}
      </div>

      {/* Publish update modal */}
      {updateTarget && profile && (
        <PublishUpdateModal
          open={!!updateTarget}
          onOpenChange={(o) => { if (!o) setUpdateTarget(null); }}
          contentId={updateTarget.id}
          contentTitle={updateTarget.title}
          currentVersion={updateTarget.version}
          creatorId={profile.id}
        />
      )}
    </div>
  );
}
