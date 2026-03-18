import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

export interface Dependency {
  content_id: string;
  title: string;
  content_type: string;
  note: string;
}

interface Props {
  dependencies: Dependency[];
  onChange: (deps: Dependency[]) => void;
}

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

export function DependencyPicker({ dependencies, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("content_items")
      .select("id, title, content_type")
      .eq("status", "approved")
      .ilike("title", `%${q.trim()}%`)
      .limit(8);
    setResults((data ?? []).filter(r => !dependencies.some(d => d.content_id === r.id)));
    setSearching(false);
  }

  function addDep(item: any) {
    if (dependencies.length >= 5) return;
    onChange([...dependencies, { content_id: item.id, title: item.title, content_type: item.content_type, note: "" }]);
    setQuery("");
    setResults([]);
  }

  function removeDep(id: string) {
    onChange(dependencies.filter(d => d.content_id !== id));
  }

  function updateNote(id: string, note: string) {
    onChange(dependencies.map(d => d.content_id === id ? { ...d, note: note.slice(0, 120) } : d));
  }

  return (
    <div className="border border-border rounded-xl p-5 bg-card space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Dependencies (optional)</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Does this content require another post to work? Link it here.</p>
      </div>

      {dependencies.length < 5 && (
        <div className="relative">
          <Input
            placeholder="Search your posts or any approved post..."
            value={query}
            onChange={e => handleSearch(e.target.value)}
            className="bg-background border-border rounded-xl"
          />
          {results.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
              {results.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => addDep(r)}
                  className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2 text-sm"
                >
                  <Badge variant="outline" className={`text-[9px] shrink-0 ${TYPE_COLORS[r.content_type] ?? ""}`}>{r.content_type}</Badge>
                  <span className="text-foreground truncate">{r.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {dependencies.length > 0 && (
        <div className="space-y-2">
          {dependencies.map(dep => (
            <div key={dep.content_id} className="flex items-start gap-2 p-2 border border-border rounded-lg bg-background">
              <Badge variant="outline" className={`text-[9px] shrink-0 mt-1 ${TYPE_COLORS[dep.content_type] ?? ""}`}>{dep.content_type}</Badge>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{dep.title}</p>
                <Input
                  placeholder="Why is this needed?"
                  value={dep.note}
                  onChange={e => updateNote(dep.content_id, e.target.value)}
                  maxLength={120}
                  className="mt-1 h-7 text-xs bg-card border-border rounded-md"
                />
              </div>
              <button type="button" onClick={() => removeDep(dep.content_id)} className="text-muted-foreground hover:text-foreground mt-1">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground">{dependencies.length}/5 dependencies</p>
        </div>
      )}
    </div>
  );
}
