import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { displayContentType } from "@/lib/content-types";

export interface ExistingBlueprintItem {
  id: string;
  title: string;
  content_type: string;
  description: string | null;
  difficulty: string;
  ai_tools: string[] | null;
  other_tool_name: string | null;
  monetisation_type: string;
  price_gbp: number | null;
  cover_image_url: string | null;
}

function diffBadgeClass(d: string) {
  switch (d) {
    case "Beginner": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "Intermediate": return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "Advanced": return "bg-red-500/15 text-red-400 border-red-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export function ExistingBlueprintSearch({
  excludeIds,
  onSelect,
  onClose,
}: {
  excludeIds: string[];
  onSelect: (item: ExistingBlueprintItem) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const { data: results, isLoading } = useQuery({
    queryKey: ["creator_blueprints_search", query, excludeIds.join(",")],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let q = supabase
        .from("content_items")
        .select("id, title, content_type, description, difficulty, ai_tools, other_tool_name, monetisation_type, price_gbp, cover_image_url")
        .eq("creator_id", user.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(20);

      if (query.trim()) {
        q = q.ilike("title", `%${query.trim()}%`);
      }

      const { data } = await q;
      return (data ?? []).filter((item) => !excludeIds.includes(item.id));
    },
    enabled: true,
  });

  return (
    <div className="rounded-xl border border-border p-4 space-y-3" style={{ backgroundColor: "#111118" }}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-foreground">Your published blueprints</h4>
        <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your posts..."
          className="pl-9 bg-background border-border rounded-xl text-sm h-9"
          autoFocus
        />
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1.5">
        {isLoading ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Searching…</p>
        ) : results && results.length > 0 ? (
          results.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors group">
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                {displayContentType(item.content_type).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground truncate">{item.title}</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  <Badge variant="outline" className="text-[9px]">{displayContentType(item.content_type)}</Badge>
                  <Badge variant="outline" className={`text-[9px] ${diffBadgeClass(item.difficulty)}`}>{item.difficulty}</Badge>
                  {item.monetisation_type === "paid" ? (
                    <Badge variant="outline" className="text-[9px] bg-primary/15 text-primary border-primary/30">£{Number(item.price_gbp ?? 0).toFixed(2)}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] bg-secondary/15 text-secondary border-secondary/30">Free</Badge>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs border-primary text-primary hover:bg-primary/10 shrink-0"
                onClick={() => onSelect(item)}
              >
                Add
              </Button>
            </div>
          ))
        ) : query.trim() ? (
          <div className="py-6 text-center">
            <p className="text-xs text-muted-foreground">No posts matching '{query}'. Try a different search or add a new blueprint above.</p>
          </div>
        ) : (
          <div className="py-6 text-center space-y-2">
            <p className="text-xs text-muted-foreground">No published blueprints found. Upload a blueprint first, then return to create your project.</p>
            <a href="/upload" className="text-xs text-primary hover:underline">Upload a blueprint</a>
          </div>
        )}
      </div>
    </div>
  );
}
