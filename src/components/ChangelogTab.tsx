import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Props {
  contentId: string;
  contentTitle: string;
  creatorId: string;
  currentVersion: string;
}

export function ChangelogTab({ contentId, contentTitle, creatorId, currentVersion }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isCreator = user?.id === creatorId;

  const { data: entries, isLoading } = useQuery({
    queryKey: ["content_changelogs", contentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_changelogs")
        .select("id, version_label, change_note, created_at, created_by, fields_changed_count")
        .eq("content_id", contentId)
        .order("created_at", { ascending: false });
      return (data as any[]) ?? [];
    },
    enabled: !!contentId,
  });

  // Check library update status for viewer
  const { data: hasLibraryUpdate } = useQuery({
    queryKey: ["library_update_changelog", contentId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_library")
        .select("has_update")
        .eq("user_id", user!.id)
        .eq("content_id", contentId)
        .maybeSingle();
      return (data as any)?.has_update === true;
    },
    enabled: !!user?.id && !!contentId,
  });

  async function dismissUpdate() {
    if (!user) return;
    await supabase
      .from("user_library")
      .update({ has_update: false } as any)
      .eq("user_id", user.id)
      .eq("content_id", contentId);
    queryClient.invalidateQueries({ queryKey: ["library_update_changelog", contentId, user.id] });
  }

  return (
    <div className="space-y-4">
      {/* Creator: Edit & Post Update button */}
      {isCreator && (
        <Button
          className="w-full h-10 rounded-full text-sm"
          onClick={() => navigate(`/content/${contentId}/edit`)}
        >
          Edit & Post Update →
        </Button>
      )}

      {/* Entries */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !entries || entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No updates posted yet.</p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry: any, index: number) => (
            <div
              key={entry.id}
              className="rounded-[10px] border border-border bg-card p-3 sm:p-3.5"
              onClick={() => {
                if (index === 0 && hasLibraryUpdate) dismissUpdate();
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  {entry.version_label && (
                    <Badge variant="outline" className="text-[10px] font-medium bg-primary/15 text-primary border-primary/30">
                      {entry.version_label}
                    </Badge>
                  )}
                  {index === 0 && (
                    <Badge variant="outline" className="text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                      Latest
                    </Badge>
                  )}
                  {index === 0 && hasLibraryUpdate && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-primary font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" /> New
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-foreground">{entry.change_note}</p>
              {entry.fields_changed_count != null && entry.fields_changed_count > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Updated {entry.fields_changed_count} field{entry.fields_changed_count !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
