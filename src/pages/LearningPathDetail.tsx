import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Users, Clock, CheckCircle2, ExternalLink } from "lucide-react";

const DIFF_COLORS: Record<string, string> = {
  "Beginner only": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Beginner to Intermediate": "bg-secondary/15 text-secondary border-secondary/30",
  "Intermediate to Advanced": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "Beginner to Advanced": "bg-primary/15 text-primary border-primary/30",
};

export default function LearningPathDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [starting, setStarting] = useState(false);

  // Path data
  const { data: path, isLoading } = useQuery({
    queryKey: ["learning_path", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_paths")
        .select("*, profiles!learning_paths_creator_id_fkey(id, username, display_name, avatar_url)")
        .eq("id", id!)
        .eq("status", "approved")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const creator = path?.profiles as any;

  // Steps
  const { data: steps } = useQuery({
    queryKey: ["learning_path_steps", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_path_steps")
        .select("*, content_items(id, title, description, content_type, difficulty, ai_tools, download_count, monetisation_type, price_gbp, avg_rating, rating_count, view_count, profiles!content_items_creator_id_fkey(display_name, username))")
        .eq("path_id", id!)
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  // Progress
  const { data: progress } = useQuery({
    queryKey: ["learning_path_progress", id, profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("learning_path_progress")
        .select("*")
        .eq("path_id", id!)
        .eq("user_id", profile!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!id && !!profile?.id,
  });

  const completedIds = new Set((progress?.completed_step_ids as string[]) ?? []);
  const totalSteps = steps?.length ?? 0;
  const completedCount = completedIds.size;
  const progressPct = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;
  const isCompleted = progress?.completed_at != null;
  const hasStarted = !!progress;

  async function startPath() {
    if (!profile || !id) return;
    setStarting(true);
    await supabase.from("learning_path_progress").insert({
      user_id: profile.id,
      path_id: id,
      completed_step_ids: [],
    });
    qc.invalidateQueries({ queryKey: ["learning_path_progress", id] });
    setStarting(false);
  }

  async function toggleStep(stepId: string) {
    if (!progress || !profile) return;
    const current = new Set((progress.completed_step_ids as string[]) ?? []);
    let newIds: string[];
    if (current.has(stepId)) {
      current.delete(stepId);
      newIds = Array.from(current);
    } else {
      current.add(stepId);
      newIds = Array.from(current);
    }

    const allDone = newIds.length === totalSteps;
    await supabase
      .from("learning_path_progress")
      .update({
        completed_step_ids: newIds,
        completed_at: allDone ? new Date().toISOString() : null,
      })
      .eq("id", progress.id);
    qc.invalidateQueries({ queryKey: ["learning_path_progress", id] });
  }

  if (isLoading) {
    return (
      <div className="py-12 px-6 mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-96" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!path) {
    return (
      <div className="py-20 px-6 text-center">
        <p className="text-sm text-muted-foreground mb-4">Learning path not found.</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/browse?tab=paths"><ArrowLeft className="mr-2 h-4 w-4" />Browse paths</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6">
      <SeoHead
        title={`${path.title} — NeoScale AI`}
        description={path.description}
        path={`/path/${id}`}
      />
      <div className="mx-auto max-w-4xl">
        <Link to="/browse?tab=paths" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to Learning Paths
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
            {path.is_platform_curated ? (
              <span>NeoScale AI curated</span>
            ) : creator ? (
              <Link to={`/creator/${creator.username}`} className="hover:text-foreground transition-colors">
                By {creator.display_name || creator.username}
              </Link>
            ) : null}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">{path.title}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">{path.description}</p>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            {path.difficulty_range && (
              <Badge variant="outline" className={`text-xs font-medium ${DIFF_COLORS[path.difficulty_range] ?? "bg-secondary/15 text-secondary border-secondary/30"}`}>
                {path.difficulty_range}
              </Badge>
            )}
            {path.estimated_time_minutes && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> ~{path.estimated_time_minutes} minutes
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> {path.follower_count} following
            </span>
            <span className="text-xs text-muted-foreground">{totalSteps} steps</span>
          </div>

          {/* Completion banner */}
          {isCompleted && (
            <div className="flex items-center gap-3 p-4 mb-4 rounded-xl bg-primary/10 border border-primary/30 text-primary">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">You completed this learning path 🎉</p>
            </div>
          )}

          {/* Progress bar */}
          {isLoggedIn && hasStarted && !isCompleted && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>{completedCount} of {totalSteps} steps completed</span>
                <span>{Math.round(progressPct)}%</span>
              </div>
              <Progress value={progressPct} className="h-2" />
            </div>
          )}

          {/* Start button */}
          {isLoggedIn && !hasStarted && (
            <Button onClick={startPath} disabled={starting} className="mb-4">
              {starting ? "Starting..." : "Start this path"}
            </Button>
          )}
        </div>

        {/* Steps timeline */}
        <div className="relative pl-8 sm:pl-12">
          {/* Vertical line */}
          <div className="absolute left-3 sm:left-5 top-0 bottom-0 w-0.5 bg-secondary/30" />

          <div className="space-y-6">
            {(steps ?? []).map((step, idx) => {
              const content = step.content_items as any;
              if (!content) return null;
              const stepCreator = content.profiles as any;
              const isDone = completedIds.has(step.id);

              return (
                <div key={step.id} className="relative">
                  {/* Number circle */}
                  <div className={`absolute -left-8 sm:-left-12 top-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold z-10 ${
                    isDone
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border-2 border-secondary text-secondary"
                  }`}>
                    {isDone ? <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : idx + 1}
                  </div>

                  <div className={`border rounded-xl p-4 bg-card transition-colors ${isDone ? "border-primary/30" : "border-border"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {step.step_label && (
                          <p className="text-xs font-semibold text-foreground mb-1">{step.step_label}</p>
                        )}
                        {step.step_note && (
                          <p className="text-xs text-muted-foreground italic mb-2">{step.step_note}</p>
                        )}

                        {/* Content info */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <Badge variant="outline" className="text-[10px]">{content.content_type}</Badge>
                          <Badge variant="outline" className="text-[10px]">{content.difficulty}</Badge>
                        </div>
                        <Link to={`/content/${content.id}`} className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
                          {content.title}
                        </Link>
                        {content.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{content.description}</p>
                        )}
                        {stepCreator && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            by {stepCreator.display_name || stepCreator.username}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isLoggedIn && hasStarted && (
                          <Checkbox
                            checked={isDone}
                            onCheckedChange={() => toggleStep(step.id)}
                            aria-label={isDone ? "Mark as incomplete" : "Mark as done"}
                          />
                        )}
                        <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                          <Link to={`/content/${content.id}`}>
                            <ExternalLink className="h-3 w-3 mr-1" /> View
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
