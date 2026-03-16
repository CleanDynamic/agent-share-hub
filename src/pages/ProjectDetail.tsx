import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { ContentBlockViewer } from "@/components/ContentBlockViewer";
import { BookmarkButton } from "@/components/BookmarkButton";
import { AccountGateModal } from "@/components/AccountGateModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Eye, User, Info, Lock, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  "Prompt File": "bg-[#E8571A]/15 text-[#E8571A] border-[#E8571A]/30",
  "Prompt Tutorial": "bg-[#2EC4B6]/15 text-[#2EC4B6] border-[#2EC4B6]/30",
  "Agent Blueprint": "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "Workflow Template": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Agent Stack": "bg-red-500/15 text-red-400 border-red-500/30",
  "Model Config Guide": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Integration Guide": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "Evaluation Framework": "bg-pink-500/15 text-pink-400 border-pink-500/30",
  "Failure Library": "bg-muted text-muted-foreground border-border",
};

function difficultyColor(level: string) {
  switch (level) {
    case "Beginner": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "Intermediate": return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "Advanced": return "bg-red-500/15 text-red-400 border-red-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { isLoggedIn } = useAuth();
  const [expandedComponents, setExpandedComponents] = useState<Record<string, boolean>>({});
  const [accountGateOpen, setAccountGateOpen] = useState(false);
  const [accountGateContentId, setAccountGateContentId] = useState("");

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

  // Increment view count
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

  // Fetch content items for all components
  const contentIds = (components ?? [])
    .map((c) => c.linked_content_id || c.inline_content_id)
    .filter(Boolean) as string[];

  const { data: contentItems } = useQuery({
    queryKey: ["project_content_items", contentIds.join(",")],
    queryFn: async () => {
      if (contentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("content_items")
        .select("*")
        .in("id", contentIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: contentIds.length > 0,
  });

  // Cover image signed URL
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  useEffect(() => {
    if (project?.cover_image_url) {
      supabase.storage
        .from("content-files")
        .createSignedUrl(project.cover_image_url, 600)
        .then(({ data }) => {
          if (data?.signedUrl) setCoverUrl(data.signedUrl);
        });
    }
  }, [project?.cover_image_url]);

  const creator = project?.profiles as { id: string; username: string; display_name: string | null } | null;

  const toggleExpand = (compId: string) => {
    setExpandedComponents((p) => ({ ...p, [compId]: !p[compId] }));
  };

  const handlePaywall = (contentId: string) => {
    if (!isLoggedIn) {
      setAccountGateContentId(contentId);
      setAccountGateOpen(true);
      return;
    }
    // Redirect to content detail for payment
    window.location.href = `/content/${contentId}`;
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
    <div className="py-8 sm:py-12 px-4 sm:px-6">
      <SeoHead
        title={`${project.title} — NeoScale AI`}
        description={project.description}
        path={`/project/${project.id}`}
      />
      <div className="mx-auto max-w-4xl">
        <Link to="/browse" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to Browse
        </Link>

        {/* Cover image */}
        {coverUrl && (
          <div className="mb-6 rounded-xl overflow-hidden">
            <img src={coverUrl} alt={project.title} className="w-full max-h-[300px] object-cover" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{project.title}</h1>
          <BookmarkButton contentId={project.id} projectId={project.id} />
        </div>

        {creator && (
          <Link
            to={`/creator/${creator.username}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <User className="h-3.5 w-3.5" />
            By {creator.display_name || creator.username}
          </Link>
        )}

        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{project.description}</p>

        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-6">
          <Eye className="h-3.5 w-3.5" />
          {project.view_count} view{project.view_count !== 1 ? "s" : ""}
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#2EC4B6]/10 border border-[#2EC4B6]/20 mb-8">
          <Info className="h-4 w-4 text-[#2EC4B6] mt-0.5 shrink-0" />
          <p className="text-xs text-[#2EC4B6]">
            This project is always free to view. Some components may require payment to unlock.
          </p>
        </div>

        {/* Timeline */}
        <h2 className="text-lg font-semibold text-foreground mb-4">Project Components</h2>

        <div className="relative pl-8">
          {(components ?? []).length > 0 && (
            <div
              className="absolute left-[15px] top-4 bottom-4 w-[2px]"
              style={{ backgroundColor: "#2EC4B6" }}
            />
          )}

          <div className="space-y-4">
            {(components ?? []).map((comp, index) => {
              const contentId = comp.linked_content_id || comp.inline_content_id;
              const content = contentItems?.find((c) => c.id === contentId);
              if (!content) return null;

              const isPaid = content.monetisation_type === "paid";
              const isFree = content.monetisation_type === "free" || content.monetisation_type === "donation";
              const isExpanded = !!expandedComponents[comp.id];
              const isExclusiveInline = comp.component_type === "inline" && !comp.show_on_browse;

              return (
                <div key={comp.id} className="relative">
                  {/* Position circle */}
                  <div
                    className="absolute -left-8 top-4 w-[30px] h-[30px] rounded-full flex items-center justify-center text-xs font-bold text-white z-10"
                    style={{ backgroundColor: "#E8571A" }}
                  >
                    {comp.position}
                  </div>

                  <div className="border border-[#1E1E2A] rounded-xl bg-[#111118] overflow-hidden">
                    <div className="p-5 space-y-3">
                      {/* Label */}
                      {comp.component_label && (
                        <p className="text-sm font-semibold text-foreground">{comp.component_label}</p>
                      )}
                      {comp.component_note && (
                        <p className="text-xs text-muted-foreground">{comp.component_note}</p>
                      )}

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[content.content_type] ?? TYPE_COLORS["Failure Library"]}`}>
                          {content.content_type}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${difficultyColor(content.difficulty)}`}>
                          {content.difficulty}
                        </Badge>
                        {isPaid && (
                          <Badge variant="outline" className="text-[10px] bg-primary/15 text-primary border-primary/30">
                            £{Number(content.price_gbp ?? 0).toFixed(2)}
                          </Badge>
                        )}
                        {isFree && (
                          <Badge variant="outline" className="text-[10px] bg-secondary/15 text-secondary border-secondary/30">Free</Badge>
                        )}
                      </div>

                      {/* AI Tools */}
                      {content.ai_tools && content.ai_tools.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {content.ai_tools.map((tool: string) => (
                            <span key={tool} className="text-[10px] px-2 py-0.5 rounded-md bg-accent text-muted-foreground">{tool}</span>
                          ))}
                        </div>
                      )}

                      {/* Description */}
                      {content.description && (
                        <p className="text-xs text-muted-foreground">{content.description}</p>
                      )}

                      {/* Action area */}
                      <div className="pt-2 border-t border-border space-y-2">
                        {isFree || isPaid ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              if (isPaid) {
                                handlePaywall(content.id);
                              } else {
                                toggleExpand(comp.id);
                              }
                            }}
                            className="gap-1.5 text-xs"
                            style={isFree ? { backgroundColor: "#2EC4B6" } : undefined}
                          >
                            {isPaid ? (
                              <>
                                <Lock className="h-3.5 w-3.5" />
                                Unlock — £{Number(content.price_gbp ?? 0).toFixed(2)}
                              </>
                            ) : isExpanded ? (
                              <>
                                <ChevronUp className="h-3.5 w-3.5" />
                                Collapse
                              </>
                            ) : (
                              <>
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </>
                            )}
                          </Button>
                        ) : null}

                        {/* View full post link */}
                        {isExclusiveInline ? (
                          <p className="text-[10px] text-muted-foreground">
                            This content is exclusive to this project
                          </p>
                        ) : (
                          <Link
                            to={`/content/${content.id}`}
                            className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
                          >
                            View full post <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Expanded ContentBlockViewer */}
                    {isExpanded && isFree && (
                      <div className="border-t border-border p-5">
                        <ContentBlockViewer
                          contentId={content.id}
                          monetisationType={content.monetisation_type}
                          creatorId={content.creator_id}
                          useInstructions={content.use_instructions}
                          onTriggerPaywall={() => handlePaywall(content.id)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <AccountGateModal
        open={accountGateOpen}
        onOpenChange={setAccountGateOpen}
        contentId={accountGateContentId}
        mode="purchase"
      />
    </div>
  );
};

export default ProjectDetail;
