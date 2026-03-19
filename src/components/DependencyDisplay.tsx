import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { BookmarkButton } from "@/components/BookmarkButton";
import { CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";

import { TYPE_COLORS } from "@/lib/content-types";

interface Props {
  contentId: string;
}

export function DependencyDisplay({ contentId }: Props) {
  const { user } = useAuth();

  const { data: deps } = useQuery({
    queryKey: ["content_dependencies", contentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_dependencies")
        .select("id, requires_content_id, dependency_note, content_items!content_dependencies_requires_content_id_fkey(id, title, content_type, current_version)")
        .eq("content_id", contentId);
      return (data as any[]) ?? [];
    },
    enabled: !!contentId,
  });

  const { data: libraryIds } = useQuery({
    queryKey: ["user_library_ids", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_library")
        .select("content_id")
        .eq("user_id", user!.id);
      return new Set((data ?? []).map((r: any) => r.content_id));
    },
    enabled: !!user?.id,
  });

  if (!deps || deps.length === 0) return null;

  return (
    <div className="mb-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Requires</h3>
      <div className="space-y-2">
        {deps.map((dep: any) => {
          const item = dep.content_items;
          if (!item) return null;
          const inLibrary = libraryIds?.has(item.id);
          return (
            <div key={dep.id} className="flex items-center gap-2 p-3 border border-border rounded-lg bg-card">
              <Badge variant="outline" className={`text-[9px] shrink-0 ${TYPE_COLORS[item.content_type] ?? ""}`}>{item.content_type}</Badge>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                {dep.dependency_note && <p className="text-[10px] text-muted-foreground italic truncate">{dep.dependency_note}</p>}
              </div>
              {user && (
                <div className="shrink-0 flex items-center gap-1">
                  {inLibrary ? (
                    <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> In your library
                    </span>
                  ) : (
                    <>
                      <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                        <AlertTriangle className="h-3 w-3" /> Not saved
                      </span>
                      <BookmarkButton contentId={item.id} />
                    </>
                  )}
                </div>
              )}
              <Link to={`/content/${item.id}`} className="text-[10px] text-primary hover:underline shrink-0 flex items-center gap-0.5">
                View <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
