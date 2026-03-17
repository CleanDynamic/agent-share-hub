import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Clock } from "lucide-react";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

interface VersionHistoryProps {
  contentId: string;
  currentVersion: string;
}

export function VersionHistory({ contentId, currentVersion }: VersionHistoryProps) {
  const [open, setOpen] = useState(false);

  const { data: versions } = useQuery({
    queryKey: ["content_versions", contentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_versions")
        .select("id, version_number, changelog, created_at")
        .eq("content_id", contentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Version History · v{currentVersion}
        </span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4 space-y-3">
          {versions && versions.length > 0 ? (
            versions.map((v, i) => (
              <div key={v.id} className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-0.5">
                  <div className={`h-2 w-2 rounded-full ${i === 0 ? "bg-[#1D9E75]" : "bg-muted-foreground/30"}`} />
                  {i < versions.length - 1 && <div className="w-px h-full bg-border mt-1" />}
                </div>
                <div className="flex-1 min-w-0 pb-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-foreground">v{v.version_number}</span>
                    {i === 0 && (
                      <Badge className="bg-[#1D9E75] text-white border-transparent text-[10px] px-1.5 py-0">Latest</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{v.changelog}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(v.created_at)}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No version history yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
