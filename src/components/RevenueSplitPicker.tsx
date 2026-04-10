import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X } from "lucide-react";

export interface RevenueSplit {
  recipientId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  percentage: number;
}

interface Props {
  splits: RevenueSplit[];
  onChange: (splits: RevenueSplit[]) => void;
  forkCreator?: { id: string; username: string; displayName: string } | null;
}

export function RevenueSplitPicker({ splits, onChange, forkCreator }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Suggest fork creator on mount
  useEffect(() => {
    if (forkCreator && splits.length === 0) {
      onChange([{
        recipientId: forkCreator.id,
        username: forkCreator.username,
        displayName: forkCreator.displayName,
        avatarUrl: null,
        percentage: 10,
      }]);
    }
  }, [forkCreator]);

  async function search(q: string) {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const { data: user } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .ilike("username", `%${q}%`)
      .neq("id", user?.user?.id ?? "")
      .limit(5);
    setResults((data ?? []).filter((p: any) => !splits.some((s) => s.recipientId === p.id)));
    setSearching(false);
  }

  function handleInput(val: string) {
    setQuery(val);
    setOpen(val.length >= 2);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  }

  function addSplit(profile: any) {
    if (splits.length >= 3) return;
    onChange([...splits, {
      recipientId: profile.id,
      username: profile.username,
      displayName: profile.display_name || profile.username,
      avatarUrl: profile.avatar_url,
      percentage: 10,
    }]);
    setQuery("");
    setOpen(false);
  }

  function removeSplit(id: string) {
    onChange(splits.filter((s) => s.recipientId !== id));
  }

  function updatePercentage(id: string, pct: number) {
    onChange(splits.map((s) => s.recipientId === id ? { ...s, percentage: pct } : s));
  }

  const totalAllocated = splits.reduce((sum, s) => sum + (s.percentage || 0), 0);
  const keepPercentage = 100 - totalAllocated;
  const hasError = totalAllocated > 90;
  const hasIndividualError = splits.some((s) => s.percentage < 1 || s.percentage > 89);

  return (
    <div className="border border-border rounded-xl p-5 bg-card space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Revenue sharing (optional)</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Split your earnings with a co-creator, or credit the creator whose work you forked.
        </p>
      </div>

      {forkCreator && splits.some((s) => s.recipientId === forkCreator.id) && (
        <p className="text-xs text-muted-foreground bg-accent/50 rounded-lg px-3 py-2">
          You forked this from @{forkCreator.username}. Consider sharing a percentage.
        </p>
      )}

      {/* Existing splits */}
      {splits.map((s) => (
        <div key={s.recipientId} className="flex items-center gap-3">
          <Avatar className="h-7 w-7 shrink-0">
            {s.avatarUrl && <AvatarImage src={s.avatarUrl} />}
            <AvatarFallback className="text-[10px] bg-accent text-muted-foreground">
              {(s.displayName || s.username).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-foreground min-w-0 truncate">@{s.username}</span>
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <Input
              type="number"
              min={1}
              max={89}
              value={s.percentage}
              onChange={(e) => updatePercentage(s.recipientId, Number(e.target.value) || 0)}
              className="w-16 h-8 text-sm bg-background border-border"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
          <button type="button" onClick={() => removeSplit(s.recipientId)} className="text-muted-foreground hover:text-foreground p-1">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {/* Validation */}
      {splits.length > 0 && (
        <div className="space-y-1">
          <p className={`text-xs ${hasError ? "text-destructive" : "text-muted-foreground"}`}>
            You keep {keepPercentage}% of your share
          </p>
          {hasError && <p className="text-xs text-destructive">You must keep at least 10%</p>}
          {hasIndividualError && <p className="text-xs text-destructive">Each split must be 1–89%</p>}
        </div>
      )}

      {/* Search input */}
      {splits.length < 3 && (
        <div className="relative" ref={wrapperRef}>
          <Input
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => query.length >= 2 && setOpen(true)}
            placeholder="Add a co-creator by @username..."
            className="bg-background border-border text-sm h-9"
          />
          {open && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
              {searching && <p className="p-3 text-xs text-muted-foreground">Searching…</p>}
              {!searching && results.length === 0 && query.length >= 2 && (
                <p className="p-3 text-xs text-muted-foreground">No users found</p>
              )}
              {results.map((p: any) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addSplit(p)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/60"
                >
                  <Avatar className="h-6 w-6">
                    {p.avatar_url && <AvatarImage src={p.avatar_url} />}
                    <AvatarFallback className="text-[10px] bg-accent">{(p.display_name || p.username || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span>{p.display_name || p.username}</span>
                  <span className="text-xs text-muted-foreground">@{p.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
