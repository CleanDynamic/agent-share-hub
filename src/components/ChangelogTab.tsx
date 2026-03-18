import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Props {
  contentId: string;
  contentTitle: string;
  creatorId: string;
  currentVersion: string;
}

export function ChangelogTab({ contentId, contentTitle, creatorId, currentVersion }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isCreator = user?.id === creatorId;

  const [note, setNote] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [posting, setPosting] = useState(false);

  const { data: entries, isLoading } = useQuery({
    queryKey: ["content_changelogs", contentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_changelogs")
        .select("id, version_label, change_note, created_at, created_by")
        .eq("content_id", contentId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!contentId,
  });

  async function handlePost() {
    if (!note.trim() || !user) return;
    setPosting(true);
    try {
      const { error } = await supabase.from("content_changelogs").insert({
        content_id: contentId,
        change_note: note.trim().slice(0, 140),
        version_label: versionLabel.trim() || null,
        created_by: user.id,
      });
      if (error) throw error;

      // Call notify-version-update edge function
      supabase.functions.invoke("notify-version-update", {
        body: {
          content_id: contentId,
          version_number: currentVersion,
          changelog: note.trim().slice(0, 140),
          content_title: contentTitle,
          creator_id: user.id,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["content_changelogs", contentId] });
      setNote("");
      setVersionLabel("");
      toast({ title: "Update posted", description: "Your changelog entry has been added." });
    } catch {
      toast({ title: "Failed to post", description: "Please try again.", variant: "destructive" });
    }
    setPosting(false);
  }

  return (
    <div className="space-y-4">
      {/* Creator input */}
      {isCreator && (
        <div className="border border-border rounded-xl p-4 bg-card space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Post an update</p>
          <div className="space-y-2">
            <div className="relative">
              <Input
                placeholder="Write a change note..."
                value={note}
                onChange={e => setNote(e.target.value.slice(0, 140))}
                maxLength={140}
                className="bg-background border-border rounded-lg pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{note.length}/140</span>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Version label e.g. v1.2"
                value={versionLabel}
                onChange={e => setVersionLabel(e.target.value.slice(0, 20))}
                maxLength={20}
                className="bg-background border-border rounded-lg w-40 text-xs h-8"
              />
              <Button
                size="sm"
                className="h-8 text-xs bg-[#E8571A] hover:bg-[#E8571A]/90 text-white"
                onClick={handlePost}
                disabled={!note.trim() || posting}
              >
                {posting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Post update"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Entries */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !entries || entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No updates yet. Check back when the creator posts changes.</p>
      ) : (
        <div className="space-y-0 divide-y divide-border">
          {entries.map((entry: any) => (
            <div key={entry.id} className="py-3 first:pt-0">
              <div className="flex items-center gap-2 mb-1">
                {entry.version_label && (
                  <Badge variant="outline" className="text-[10px] font-medium bg-[#E8571A]/15 text-[#E8571A] border-[#E8571A]/30">
                    {entry.version_label}
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-foreground">{entry.change_note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
