import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Candidate {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface StartDiscussionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTitle: string;
  onSubmit: (args: {
    memberIds: string[];
    title: string;
    firstMessage: string;
  }) => Promise<void> | void;
  submitting?: boolean;
  /** When true, hides the member picker (single-recipient flow, e.g. "Ask the author"). */
  singleRecipientId?: string;
  singleRecipientLabel?: string;
}

/**
 * Pick members from your followers/following + a title + an optional first
 * message. Used by both blueprint group threads and (in single-recipient mode)
 * the "Ask the author a question" flow on bounties.
 */
export function StartDiscussionModal({
  open, onOpenChange, defaultTitle, onSubmit, submitting,
  singleRecipientId, singleRecipientLabel,
}: StartDiscussionModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState(defaultTitle);
  const [firstMessage, setFirstMessage] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setFirstMessage("");
      setPicked(singleRecipientId ? new Set([singleRecipientId]) : new Set());
    }
  }, [open, defaultTitle, singleRecipientId]);

  // Load followers + following
  useEffect(() => {
    if (!open || !user?.id || singleRecipientId) return;
    (async () => {
      const [{ data: following }, { data: followers }] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", user.id),
        supabase.from("follows").select("follower_id").eq("following_id", user.id),
      ]);
      const ids = new Set<string>();
      (following ?? []).forEach((r: any) => r.following_id && ids.add(r.following_id));
      (followers ?? []).forEach((r: any) => r.follower_id && ids.add(r.follower_id));
      ids.delete(user.id);
      if (ids.size === 0) { setCandidates([]); return; }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", Array.from(ids));
      setCandidates((profs ?? []) as Candidate[]);
    })();
  }, [open, user?.id, singleRecipientId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) =>
      (c.username ?? "").toLowerCase().includes(q) ||
      (c.display_name ?? "").toLowerCase().includes(q)
    );
  }, [candidates, search]);

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    const memberIds = Array.from(picked);
    if (memberIds.length === 0) return;
    await onSubmit({
      memberIds,
      title: title.trim() || defaultTitle,
      firstMessage: firstMessage.trim(),
    });
  };

  const canSubmit = picked.size > 0 && !submitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {singleRecipientId ? "Send a message" : "Start a discussion"}
          </DialogTitle>
          <DialogDescription>
            {singleRecipientId
              ? `Opens a thread with ${singleRecipientLabel ?? "this user"} pinned to this content.`
              : "Pick members from your followers and following, then start the thread."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!singleRecipientId && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Group title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={defaultTitle}
                disabled={submitting}
              />
            </div>
          )}

          {!singleRecipientId && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Members ({picked.size})
              </label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search followers / following…"
                disabled={submitting}
              />
              <div className="max-h-56 overflow-y-auto rounded-md border border-border/40 divide-y divide-border/20">
                {filtered.length === 0 && (
                  <div className="p-3 text-xs text-muted-foreground">
                    No people found. Follow some users first.
                  </div>
                )}
                {filtered.map((c) => {
                  const checked = picked.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggle(c.id)}
                      className="w-full flex items-center gap-3 p-2 hover:bg-accent/30 text-left"
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggle(c.id)} />
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={c.avatar_url ?? undefined} />
                        <AvatarFallback>
                          {(c.display_name ?? c.username ?? "?")[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">
                          {c.display_name ?? c.username ?? "Unknown"}
                        </div>
                        {c.username && (
                          <div className="text-[11px] text-muted-foreground truncate">
                            @{c.username}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              First message (optional)
            </label>
            <Textarea
              rows={3}
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              placeholder="Kick things off…"
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Creating…" : "Create thread"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
