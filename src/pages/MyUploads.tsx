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
import { Plus, Star, StarHalf, RefreshCw } from "lucide-react";
import { PublishUpdateModal } from "@/components/PublishUpdateModal";

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
    else stars.push(<Star key={i} className="h-2.5 w-2.5 text-muted-foreground/30" />);
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
  const [updateTarget, setUpdateTarget] = useState<{ id: string; title: string; version: string } | null>(null);
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
      <SeoHead title="My Uploads — NeoScale AI" description="Manage your uploaded content." path="/my-uploads" noIndex />
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">My uploads</h1>
          <Button size="sm" className="min-h-[44px]" asChild>
            <Link to="/upload"><Plus className="h-4 w-4 mr-1.5" /> Upload new</Link>
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border mb-6">
          {(["content", "projects"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? "text-foreground border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              {t === "content" ? "Content" : "Projects"}
            </button>
          ))}
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
                      <TableHead className="text-muted-foreground">Title</TableHead>
                      <TableHead className="text-muted-foreground">Type</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                      <TableHead className="text-muted-foreground text-right">Rating</TableHead>
                      <TableHead className="text-muted-foreground text-right">Views</TableHead>
                      <TableHead className="text-muted-foreground text-right">Downloads</TableHead>
                      <TableHead className="text-muted-foreground text-right">Date</TableHead>
                      <TableHead className="text-muted-foreground">Version</TableHead>
                       <TableHead className="text-muted-foreground text-right"></TableHead>
                    </TableRow>
                   </TableHeader>
                   <TableBody>
                    {items.map((item) => {
                      const rc = (item as any).rating_count ?? 0;
                      const sv = roundedStars(Number((item as any).avg_rating) || 0, rc);
                      return (
                        <TableRow key={item.id} className="border-border cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/content/${item.id}`)}>
                          <TableCell className="text-foreground font-medium text-sm">{item.title}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{item.content_type}</TableCell>
                          <TableCell>{statusBadge(item.status)}</TableCell>
                          <TableCell className="text-right">
                            {rc > 0 ? (
                              <div className="flex items-center justify-end gap-1">
                                <TinyStars value={sv} />
                                <span className="text-[10px] text-muted-foreground">({rc})</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm text-right">{(item as any).view_count ?? 0}</TableCell>
                          <TableCell className="text-muted-foreground text-sm text-right">{item.download_count}</TableCell>
                          <TableCell className="text-muted-foreground text-xs text-right">
                            {new Date(item.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            v{(item as any).current_version || "1.0"}
                          </TableCell>
                          <TableCell className="text-right">
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
                          </TableCell>
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
                    className="border border-border rounded-xl p-4 bg-card cursor-pointer hover:border-primary/30 transition-colors space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground line-clamp-2">{item.title}</p>
                      {statusBadge(item.status)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{item.download_count} downloads</span>
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm text-muted-foreground mb-4">You haven't uploaded anything yet.</p>
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
                      <TableHead className="text-muted-foreground">Title</TableHead>
                      <TableHead className="text-muted-foreground">Components</TableHead>
                      <TableHead className="text-muted-foreground">Pricing</TableHead>
                      <TableHead className="text-muted-foreground text-right">Views</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                      <TableHead className="text-muted-foreground text-right">Date</TableHead>
                      <TableHead className="text-muted-foreground text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((proj) => (
                      <TableRow key={proj.id} className="border-border cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/project/${proj.id}`)}>
                        <TableCell className="text-foreground font-medium text-sm">{proj.title}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{proj.componentCount}</TableCell>
                        <TableCell>
                          {(proj as any).package_price_enabled ? (
                            <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">
                              Package: £{Number((proj as any).package_price_gbp ?? 0).toFixed(2)}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Individual only</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm text-right">{proj.view_count}</TableCell>
                        <TableCell>{statusBadge(proj.status)}</TableCell>
                        <TableCell className="text-muted-foreground text-xs text-right">
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
                    className="border border-border rounded-xl p-4 bg-card cursor-pointer hover:border-primary/30 transition-colors space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground line-clamp-2">{proj.title}</p>
                      {statusBadge(proj.status)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
              <p className="text-sm text-muted-foreground mb-4">You haven't created any projects yet.</p>
              <Button className="min-h-[44px]" asChild>
                <Link to="/upload">Create your first project</Link>
              </Button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
