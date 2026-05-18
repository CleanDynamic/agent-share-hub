import { useState, useEffect } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUploadPicker } from "@/contexts/UploadPickerContext";
import { SeoHead } from "@/components/SeoHead";
import { ContentBlockViewer } from "@/components/ContentBlockViewer";
import { BookmarkButton } from "@/components/BookmarkButton";
import { AccountGateModal } from "@/components/AccountGateModal";
import { CommentsSection } from "@/components/CommentsSection";
import { ChangelogTab } from "@/components/ChangelogTab";
import { PortfolioCard } from "@/components/PortfolioCard";
import { ExistingBlueprintSearch, type ExistingBlueprintItem } from "@/components/ExistingBlueprintSearch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Eye, User, Lock, ChevronDown, ChevronUp, CheckCircle2, Calendar, Plus,
} from "lucide-react";
import { TYPE_COLORS, displayContentType } from "@/lib/content-types";

function difficultyColor(level: string) {
  switch (level) {
    case "Beginner": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "Intermediate": return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "Advanced": return "bg-red-500/15 text-red-400 border-red-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function computeDifficulty(items: any[]): string {
  const diffs = items.map((i) => i.difficulty).filter(Boolean);
  if (diffs.length === 0) return "Any";
  if (diffs.some((d: string) => d === "Advanced")) return "Advanced";
  if (diffs.every((d: string) => d === "Beginner")) return "Beginner";
  return "Intermediate";
}

/* ── What to Expect Section ─────────────────────────────── */
function WhatToExpectSection({ blocks, fallbackText }: { blocks: any[] | null; fallbackText: string | null }) {
  if (!blocks?.length && !fallbackText) return null;
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-foreground mb-2.5">What to Expect</h2>
      <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "rgba(46,196,182,0.04)", borderLeft: "2px solid rgba(46,196,182,0.3)" }}>
        {blocks && blocks.length > 0 ? (
          blocks.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)).map((block: any, idx: number) => (
            <WteBlock key={block.id || idx} block={block} />
          ))
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed">{fallbackText}</p>
        )}
      </div>
    </div>
  );
}

function WteBlock({ block }: { block: any }) {
  const fmt = block.formatting_type || "paragraph";
  const text = block.text_content || "";

  if (block.block_type === "image" && block.image_url) {
    return (
      <div>
        <img src={block.image_url} alt={block.image_description || ""} className="w-full rounded-lg" />
        {block.image_description && <p className="text-xs text-muted-foreground mt-1">{block.image_description}</p>}
      </div>
    );
  }

  if (fmt === "sublist" || fmt === "sub_list") {
    const subBlocks = (block.sub_blocks as string[]) || [];
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{text}</p>
        {subBlocks.map((sub: string, i: number) => (
          <p key={i} className="text-sm text-muted-foreground" style={{ paddingLeft: 24 }}>
            <span className="text-muted-foreground/60">↳</span> {sub}
          </p>
        ))}
      </div>
    );
  }

  const lines = text.split("\n").filter((l: string) => l.trim());
  if (fmt === "bullets") {
    return (
      <ul className="space-y-1">
        {lines.map((line: string, i: number) => (
          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--secondary))] shrink-0" /> {line}
          </li>
        ))}
      </ul>
    );
  }
  if (fmt === "numbered") {
    return (
      <ol className="space-y-1">
        {lines.map((line: string, i: number) => (
          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
            <span className="text-muted-foreground/60 shrink-0 font-medium">{i + 1}.</span> {line}
          </li>
        ))}
      </ol>
    );
  }
  return <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{text}</p>;
}

/* ── Package Pricing Banner ─────────────────────────────── */
function PackageBanner({ project, paidCount, totalPrice, hasPackage, onUnlock, unlocking }: {
  project: any; paidCount: number; totalPrice: number; hasPackage: boolean; onUnlock: () => void; unlocking: boolean;
}) {
  const pkgPrice = Number(project.package_price_gbp ?? 0);
  const saving = totalPrice - pkgPrice;

  if (hasPackage) {
    return (
      <div className="rounded-xl border border-emerald-500/40 bg-card p-5 mb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-400">You own this project ✓</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">All blueprints unlocked</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary bg-card p-5 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Lock className="h-6 w-6 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-base font-semibold text-foreground">Unlock everything — £{pkgPrice.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Get instant access to all {paidCount} paid blueprint{paidCount !== 1 ? "s" : ""}.
              {saving > 0 && <> Save <span className="text-emerald-400 font-medium">£{saving.toFixed(2)}</span> vs buying individually.</>}
            </p>
          </div>
        </div>
        <Button onClick={onUnlock} disabled={unlocking} className="ns-btn-primary shrink-0">
          {unlocking ? "Redirecting…" : "Unlock full project"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { isLoggedIn, profile } = useAuth();
  const { toast } = useToast();
  const [expandedComponents, setExpandedComponents] = useState<Record<string, boolean>>({});
  const [accountGateOpen, setAccountGateOpen] = useState(false);
  const [accountGateContentId, setAccountGateContentId] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "blueprints" | "changelog" | "comments">("overview");
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [showAddExistingSearch, setShowAddExistingSearch] = useState(false);

  // Fetch project
  const { data: project, isLoading, error } = useQuery({
    queryKey: ["project_detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, profiles(id, username, display_name)")
        .eq("id", id!)
        .eq("status", "approved")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (project?.id) {
      supabase.rpc("increment_project_view_count", { _project_id: project.id });
    }
  }, [project?.id]);

  // Fetch components
  const { data: components } = useQuery({
    queryKey: ["project_components", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_components")
        .select("*")
        .eq("project_id", id!)
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const contentIds = (components ?? []).map((c) => c.linked_content_id || c.inline_content_id).filter(Boolean) as string[];

  const { data: contentItems } = useQuery({
    queryKey: ["project_content_items", contentIds.join(",")],
    queryFn: async () => {
      if (contentIds.length === 0) return [];
      const { data, error } = await supabase.from("content_items").select("*").in("id", contentIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: contentIds.length > 0,
  });

  // Package purchase check
  const { data: packagePurchase, refetch: refetchPurchase } = useQuery({
    queryKey: ["project_package_purchase", id, profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from("project_package_purchases").select("id").eq("project_id", id!).eq("user_id", profile!.id).maybeSingle();
      return data;
    },
    enabled: !!id && !!profile?.id,
  });
  const hasPackage = !!packagePurchase;

  // Verify payment
  useEffect(() => {
    const pkgStatus = searchParams.get("package");
    const sessionId = searchParams.get("session_id");
    if (pkgStatus === "success" && id && profile?.id) {
      supabase.functions.invoke("verify-project-package", { body: { session_id: sessionId, project_id: id } })
        .then(() => { refetchPurchase(); toast({ title: "Purchase complete!", description: "All blueprints are now unlocked." }); });
    }
  }, [searchParams, id, profile?.id]);

  // Cover image signed URL
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  useEffect(() => {
    if (project?.cover_image_url) {
      supabase.storage.from("content-files").createSignedUrl(project.cover_image_url, 600)
        .then(({ data }) => { if (data?.signedUrl) setCoverUrl(data.signedUrl); });
    }
  }, [project?.cover_image_url]);

  const creator = project?.profiles as { id: string; username: string; display_name: string | null } | null;
  const isProjectOwner = !!profile?.id && project?.creator_id === profile.id;
  const paidComponents = (contentItems ?? []).filter((c) => c.monetisation_type === "paid");
  const totalIndividualPrice = paidComponents.reduce((sum, c) => sum + Number(c.price_gbp ?? 0), 0);
  const projectDifficulty = computeDifficulty(contentItems ?? []);
  const existingLinkedIds = contentIds;

  const toggleExpand = (compId: string) => setExpandedComponents((p) => ({ ...p, [compId]: !p[compId] }));

  const handleAddExistingBlueprint = async (item: ExistingBlueprintItem) => {
    if (!id) return;
    const nextPosition = (components ?? []).length + 1;
    const { error } = await supabase.from("project_components").insert({
      project_id: id,
      position: nextPosition,
      component_type: "linked",
      linked_content_id: item.id,
      show_on_browse: false,
      component_label: null,
      component_note: null,
    });
    if (error) {
      toast({ title: "Failed to add blueprint", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["project_components", id] });
    queryClient.invalidateQueries({ queryKey: ["project_content_items"] });
    setShowAddExistingSearch(false);
    setShowAddDropdown(false);
    toast({ title: "Blueprint added to project" });
  };

  const handlePaywall = (contentId: string) => {
    if (!isLoggedIn) { setAccountGateContentId(contentId); setAccountGateOpen(true); return; }
    window.location.href = `/content/${contentId}`;
  };

  const handleUnlockPackage = async () => {
    if (!isLoggedIn) { window.location.href = `/signup?after_purchase=project:${id}`; return; }
    setUnlocking(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-project-package-session", {
        body: { project_id: id, success_url: `${window.location.origin}/project/${id}?package=success`, cancel_url: `${window.location.origin}/project/${id}` },
      });
      if (error || data?.error) throw new Error(data?.error || "Failed");
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setUnlocking(false); }
  };

  if (isLoading) {
    return (
      <div className="py-8 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!project || error) {
    return (
      <div className="py-20 px-6 flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">Project not found.</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/browse"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Browse</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="py-6 sm:py-10 px-4 sm:px-6">
      <SeoHead title={`${project.title} — NeoScale AI`} description={project.description} path={`/project/${project.id}`} />
      <div className="mx-auto max-w-4xl">
        {/* 1. Back button */}
        <button onClick={() => navigate(-1)} className="inline-flex items-center text-[13px] text-muted-foreground hover:text-foreground mb-3 transition-colors cursor-pointer">
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
        </button>

        {/* 2. Cover image */}
        {coverUrl && (
          <img src={coverUrl} alt={project.title} loading="eager" className="w-full object-cover rounded-xl mb-4" style={{ maxHeight: 360 }} />
        )}

        {/* 3. Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-2.5">
          <Badge variant="outline" className="text-[10px] font-medium bg-blue-500/15 text-blue-400 border-blue-500/30">Project</Badge>
          <Badge variant="outline" className={`text-[10px] font-medium ${difficultyColor(projectDifficulty)}`}>{projectDifficulty}</Badge>
          {(project as any).package_price_enabled && (
            <Badge variant="outline" className="text-[10px] font-medium bg-primary/15 text-primary border-primary/30">
              £{Number((project as any).package_price_gbp ?? 0).toFixed(2)} package
            </Badge>
          )}
        </div>

        {/* 4. Title */}
        <h1 className="text-[26px] font-bold text-foreground leading-[1.25] mb-2">{project.title}</h1>

        {/* 5. Description */}
        <p className="text-[15px] text-muted-foreground leading-relaxed mb-3">{project.description}</p>

        {/* 6. Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 text-[13px] text-muted-foreground">
          {creator && (
            <>
              <Link to={`/creator/${creator.username}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                <User className="h-3 w-3" />
                <span>By {creator.display_name || creator.username}</span>
              </Link>
              <span className="text-muted-foreground/40">·</span>
            </>
          )}
          <span>{(components ?? []).length} blueprint{(components ?? []).length !== 1 ? "s" : ""}</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{project.view_count} views</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(project.approved_at ?? project.created_at)}</span>
        </div>

        {/* 7. What to Expect */}
        <WhatToExpectSection blocks={(project as any).what_to_expect_blocks} fallbackText={null} />

        {/* 8. Action box — package CTA */}
        {(project as any).package_price_enabled && paidComponents.length > 0 && (
          <PackageBanner
            project={project}
            paidCount={paidComponents.length}
            totalPrice={totalIndividualPrice}
            hasPackage={hasPackage}
            onUnlock={handleUnlockPackage}
            unlocking={unlocking}
          />
        )}

        {/* 9. Created By card */}
        {creator && (
          <div className="flex items-center gap-3 py-3.5 mb-4 border-t border-b border-border">
            <Link to={`/creator/${creator.username}`} className="shrink-0">
              <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground overflow-hidden">
                {(creator.display_name || creator.username || "?")[0].toUpperCase()}
              </div>
            </Link>
            <div className="flex-1 min-w-0">
              <Link to={`/creator/${creator.username}`} className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
                {creator.display_name || creator.username}
              </Link>
              <p className="text-xs text-muted-foreground">@{creator.username}</p>
            </div>
          </div>
        )}

        {/* 10. Tab strip */}
        <div className="flex gap-0 border-b border-border sticky top-0 bg-background z-20 mb-0">
          {(["overview", "blueprints", "changelog", "comments"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === tab ? "text-foreground border-b-2 border-primary -mb-px" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "overview" && "Overview"}
              {tab === "blueprints" && "Blueprints"}
              {tab === "changelog" && "Changelog"}
              {tab === "comments" && "Comments"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="mt-0">
          {/* Overview tab */}
          {activeTab === "overview" && (
            <div className="py-4">
              {/* Blueprint timeline */}
              <h3 className="text-base font-semibold text-foreground mb-4">Blueprint Steps</h3>
              <div className="relative pl-8">
                {(components ?? []).length > 0 && (
                  <div className="absolute left-[15px] top-4 bottom-4 w-[2px]" style={{ backgroundColor: "hsl(var(--secondary))" }} />
                )}
                <div className="space-y-4">
                  {(components ?? []).map((comp) => {
                    const contentId = comp.linked_content_id || comp.inline_content_id;
                    const content = contentItems?.find((c) => c.id === contentId);
                    if (!content) return null;

                    const isPaid = content.monetisation_type === "paid";
                    const isFree = content.monetisation_type === "free" || content.monetisation_type === "donation";
                    const isExpanded = !!expandedComponents[comp.id];
                    const unlockedViaPackage = isPaid && hasPackage;

                    return (
                      <div key={comp.id} className="relative">
                        <div className="absolute -left-8 top-4 w-[30px] h-[30px] rounded-full flex items-center justify-center text-xs font-bold text-white z-10" style={{ backgroundColor: "hsl(var(--primary))" }}>
                          {comp.position}
                        </div>

                        <div className="border border-border rounded-xl bg-card overflow-hidden">
                          {/* Clickable header */}
                          <button
                            type="button"
                            onClick={() => toggleExpand(comp.id)}
                            className="w-full text-left p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              {comp.component_label && <p className="text-xs text-muted-foreground mb-0.5">{comp.component_label}</p>}
                              <p className="text-sm font-semibold text-foreground">{content.title}</p>
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                <Badge variant="outline" className={`text-[10px] ${difficultyColor(content.difficulty)}`}>{content.difficulty}</Badge>
                                {isPaid && !unlockedViaPackage && (
                                  <Badge variant="outline" className="text-[10px] bg-primary/15 text-primary border-primary/30">£{Number(content.price_gbp ?? 0).toFixed(2)}</Badge>
                                )}
                                {(isFree || unlockedViaPackage) && (
                                  <Badge variant="outline" className="text-[10px] bg-secondary/15 text-secondary border-secondary/30">{unlockedViaPackage ? "Unlocked" : "Free"}</Badge>
                                )}
                              </div>
                            </div>
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                          </button>

                          {/* Expanded inline */}
                          {isExpanded && (
                            <div className="border-t border-border p-5 space-y-4">
                              {content.description && <p className="text-xs text-muted-foreground">{content.description}</p>}

                              {/* Blueprint's What to Expect */}
                              {(content as any).what_to_expect_blocks && (
                                <WhatToExpectSection blocks={(content as any).what_to_expect_blocks} fallbackText={(content as any).what_to_expect} />
                              )}

                              {/* Content blocks (blurred/reveal as normal) */}
                              {(isFree || unlockedViaPackage) ? (
                                <ContentBlockViewer
                                  contentId={content.id}
                                  monetisationType={unlockedViaPackage ? "free" : content.monetisation_type}
                                  creatorId={content.creator_id}
                                  useInstructions={content.use_instructions}
                                  onTriggerPaywall={() => handlePaywall(content.id)}
                                />
                              ) : isPaid ? (
                                <div className="text-center py-6">
                                  <Lock className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                                  <p className="text-sm text-muted-foreground mb-3">This blueprint requires payment to unlock.</p>
                                  <Button size="sm" className="ns-btn-primary" onClick={() => handlePaywall(content.id)}>
                                    Unlock — £{Number(content.price_gbp ?? 0).toFixed(2)}
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Creator: Add blueprint */}
                {isProjectOwner && (
                  <div className="mt-6 relative">
                    {showAddExistingSearch ? (
                      <ExistingBlueprintSearch
                        excludeIds={existingLinkedIds}
                        onSelect={handleAddExistingBlueprint}
                        onClose={() => { setShowAddExistingSearch(false); setShowAddDropdown(false); }}
                      />
                    ) : showAddDropdown ? (
                      <div className="flex gap-3">
                        <Button type="button" variant="outline" size="sm"
                          className="flex-1 gap-1.5 border-secondary text-secondary hover:bg-secondary/10"
                          onClick={() => openUploadTypePicker()}>
                          <Plus className="h-3.5 w-3.5" /> New blueprint
                        </Button>
                        <Button type="button" variant="outline" size="sm"
                          className="flex-1 gap-1.5 border-secondary text-secondary hover:bg-secondary/10"
                          onClick={() => setShowAddExistingSearch(true)}>
                          <Plus className="h-3.5 w-3.5" /> Add existing
                        </Button>
                      </div>
                    ) : (
                      <Button type="button" variant="outline" size="sm"
                        className="gap-1.5 border-secondary text-secondary hover:bg-secondary/10"
                        onClick={() => setShowAddDropdown(true)}>
                        <Plus className="h-3.5 w-3.5" /> Add blueprint
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Blueprints tab — grid */}
          {activeTab === "blueprints" && (
            <div className="py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(contentItems ?? []).map((item) => (
                  <PortfolioCard key={item.id} item={item as any} />
                ))}
              </div>
              {(!contentItems || contentItems.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-8">No blueprints yet.</p>
              )}
            </div>
          )}

          {/* Changelog tab */}
          {activeTab === "changelog" && (
            <div className="py-4">
              {contentIds.length > 0 ? (
                <ChangelogTab contentId={contentIds[0]} contentTitle={project.title} creatorId={project.creator_id} currentVersion="1.0" />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No changelog entries.</p>
              )}
            </div>
          )}

          {/* Comments tab */}
          {activeTab === "comments" && (
            <div className="py-4">
              {contentIds.length > 0 ? (
                <CommentsSection contentId={contentIds[0]} contentTitle={project.title} commentCount={0} isEligible={isLoggedIn} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No comments yet.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <AccountGateModal open={accountGateOpen} onOpenChange={setAccountGateOpen} contentId={accountGateContentId} mode="purchase" />
    </div>
  );
};

export default ProjectDetail;
