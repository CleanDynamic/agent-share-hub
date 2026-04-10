import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X } from "lucide-react";

export interface CollabInvitee {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface Props {
  invitees: CollabInvitee[];
  onChange: (invitees: CollabInvitee[]) => void;
}

export function CollabInvitePicker({ invitees, onChange }: Props) {
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
    setResults((data ?? []).filter((p: any) => !invitees.some((i) => i.id === p.id)));
    setSearching(false);
  }

  function handleInput(val: string) {
    setQuery(val);
    setOpen(val.length >= 2);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  }

  function addInvitee(profile: any) {
    if (invitees.length >= 3) return;
    onChange([...invitees, {
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name || profile.username,
      avatarUrl: profile.avatar_url,
    }]);
    setQuery("");
    setOpen(false);
  }

  function removeInvitee(id: string) {
    onChange(invitees.filter((i) => i.id !== id));
  }

  return (
    <div className="border border-border rounded-xl p-5 bg-card space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Co-authors (optional)</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Invite up to 3 creators to co-author this post. It will appear on their profiles once they accept.
        </p>
      </div>

      {invitees.map((inv) => (
        <div key={inv.id} className="flex items-center gap-3">
          <Avatar className="h-7 w-7 shrink-0">
            {inv.avatarUrl && <AvatarImage src={inv.avatarUrl} />}
            <AvatarFallback className="text-[10px] bg-accent text-muted-foreground">
              {(inv.displayName || inv.username).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-foreground">@{inv.username}</span>
          <span className="text-xs text-muted-foreground">{inv.displayName}</span>
          <button type="button" onClick={() => removeInvitee(inv.id)} className="ml-auto text-muted-foreground hover:text-foreground p-1">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {invitees.length < 3 && (
        <div className="relative" ref={wrapperRef}>
          <Input
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => query.length >= 2 && setOpen(true)}
            placeholder="Invite a co-author by @username..."
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
                  onClick={() => addInvitee(p)}
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
