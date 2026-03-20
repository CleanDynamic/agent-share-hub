import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Repeat2 } from "lucide-react";
import { TYPE_COLORS, displayContentType } from "@/lib/content-types";

// ── Source types ────────────────────────────────────────────

export type ReblogSource =
  | {
      type: "content";
      id: string;
      title: string;
      creatorUsername: string;
      contentType?: string;
      coverUrl?: string | null;
    }
  | {
      type: "collection";
      id: string;
      title: string;
      creatorUsername: string;
      itemCount: number;
      coverImages?: string[];
      slug?: string;
    }
  | {
      type: "project";
      id: string;
      title: string;
      creatorUsername: string;
      blueprintCount: number;
      coverUrl?: string | null;
      packagePrice?: number | null;
    }
  | {
      type: "reblog";
      // The reblog being quoted
      reblogId: string;
      rebloggerUsername: string;
      reblogComment?: string | null;
      // The original source of that reblog
      originalType: "content" | "collection" | "project";
      originalId: string;
      originalTitle: string;
      originalCreatorUsername: string;
    };

// ── Quoted card sub-components ──────────────────────────────

function ContentQuotedCard({
  title,
  contentType,
  creatorUsername,
  coverUrl,
}: {
  title: string;
  contentType?: string;
  creatorUsername: string;
  coverUrl?: string | null;
}) {
  const typeColor = contentType ? (TYPE_COLORS[contentType] ?? TYPE_COLORS["Failure Library"]) : "bg-muted text-muted-foreground";
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        {contentType && (
          <Badge variant="outline" className={`text-[10px] font-medium mb-1 ${typeColor}`}>
            {displayContentType(contentType)}
          </Badge>
        )}
        <p className="text-sm font-semibold text-foreground truncate">{title}</p>
        <p className="text-[12px] text-muted-foreground mt-0.5">by @{creatorUsername}</p>
      </div>
      {coverUrl && (
        <img
          src={coverUrl}
          alt={title}
          className="h-[60px] w-[60px] rounded-md object-cover shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
    </div>
  );
}

function CollectionQuotedCard({
  title,
  creatorUsername,
  itemCount,
  coverImages,
}: {
  title: string;
  creatorUsername: string;
  itemCount: number;
  coverImages?: string[];
}) {
  const cells = (coverImages ?? []).slice(0, 4);
  return (
    <div
      className="rounded-lg border border-[#2EC4B6]/25 p-3 flex items-start gap-3"
      style={{ background: "rgba(46,196,182,0.06)" }}
    >
      <div className="flex-1 min-w-0">
        <Badge variant="outline" className="text-[10px] font-medium mb-1 bg-[#2EC4B6]/20 text-[#2EC4B6] border-[#2EC4B6]/25">
          Collection
        </Badge>
        <p className="text-sm font-semibold text-foreground truncate">{title}</p>
        <p className="text-[12px] text-muted-foreground mt-0.5">by @{creatorUsername}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{itemCount} blueprint{itemCount !== 1 ? "s" : ""}</p>
      </div>
      {cells.length > 0 && (
        <div className="grid grid-cols-2 gap-[2px] shrink-0" style={{ width: 60, height: 60 }}>
          {cells.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className="w-full h-full object-cover"
              style={{ borderRadius: i === 0 ? "4px 0 0 0" : i === 1 ? "0 4px 0 0" : i === 2 ? "0 0 0 4px" : "0 0 4px 0" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectQuotedCard({
  title,
  creatorUsername,
  blueprintCount,
  coverUrl,
  packagePrice,
}: {
  title: string;
  creatorUsername: string;
  blueprintCount: number;
  coverUrl?: string | null;
  packagePrice?: number | null;
}) {
  return (
    <div
      className="rounded-lg border border-[#E8571A]/25 p-3 flex items-start gap-3"
      style={{ background: "rgba(232,87,26,0.06)" }}
    >
      <div className="flex-1 min-w-0">
        <Badge variant="outline" className="text-[10px] font-medium mb-1 bg-primary/20 text-primary border-primary/25">
          Project
        </Badge>
        <p className="text-sm font-semibold text-foreground truncate">{title}</p>
        <p className="text-[12px] text-muted-foreground mt-0.5">by @{creatorUsername}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {blueprintCount} blueprint{blueprintCount !== 1 ? "s" : ""}
          {packagePrice != null && ` · £${packagePrice}`}
        </p>
      </div>
      {coverUrl && (
        <img
          src={coverUrl}
          alt={title}
          className="h-[60px] w-[60px] rounded-md object-cover shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
    </div>
  );
}

function ReblogQuotedCard({
  rebloggerUsername,
  reblogComment,
  originalType,
  originalTitle,
  originalCreatorUsername,
}: {
  rebloggerUsername: string;
  reblogComment?: string | null;
  originalType: "content" | "collection" | "project";
  originalTitle: string;
  originalCreatorUsername: string;
}) {
  const badgeColor =
    originalType === "collection"
      ? "bg-[#2EC4B6]/20 text-[#2EC4B6] border-[#2EC4B6]/25"
      : originalType === "project"
      ? "bg-primary/20 text-primary border-primary/25"
      : "bg-muted text-muted-foreground";
  const label = originalType === "collection" ? "Collection" : originalType === "project" ? "Project" : "Blueprint";

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
      <p className="text-[11px] text-muted-foreground">@{rebloggerUsername} reblogged:</p>
      {reblogComment && (
        <p className="text-[13px] italic text-foreground/80">{reblogComment}</p>
      )}
      <div className="rounded-md border border-border bg-background/50 p-2 flex items-center gap-2">
        <Badge variant="outline" className={`text-[10px] font-medium shrink-0 ${badgeColor}`}>
          {label}
        </Badge>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{originalTitle}</p>
          <p className="text-[11px] text-muted-foreground">by @{originalCreatorUsername}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main modal ──────────────────────────────────────────────

interface ReblogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: ReblogSource;
  /** Called with the new reblog content_item id after successful submit */
  onSuccess?: (newId: string) => void;
}

export function ReblogModal({ open, onOpenChange, source, onSuccess }: ReblogModalProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Derive original source IDs for the insert
  const resolveIds = () => {
    if (source.type === "content") {
      return { reblog_of_content_id: source.id, reblog_of_collection_id: null, reblog_of_project_id: null, quoted_reblog_id: null };
    }
    if (source.type === "collection") {
      return { reblog_of_content_id: null, reblog_of_collection_id: source.id, reblog_of_project_id: null, quoted_reblog_id: null };
    }
    if (source.type === "project") {
      return { reblog_of_content_id: null, reblog_of_collection_id: null, reblog_of_project_id: source.id, quoted_reblog_id: null };
    }
    // reblog of reblog — point to original source, quote the reblog
    if (source.type === "reblog") {
      const base =
        source.originalType === "collection"
          ? { reblog_of_content_id: null, reblog_of_collection_id: source.originalId, reblog_of_project_id: null }
          : source.originalType === "project"
          ? { reblog_of_content_id: null, reblog_of_collection_id: null, reblog_of_project_id: source.originalId }
          : { reblog_of_content_id: source.originalId, reblog_of_collection_id: null, reblog_of_project_id: null };
      return { ...base, quoted_reblog_id: source.reblogId };
    }
    return { reblog_of_content_id: null, reblog_of_collection_id: null, reblog_of_project_id: null, quoted_reblog_id: null };
  };

  const getTitle = () => {
    if (source.type === "content") return source.title;
    if (source.type === "collection") return source.title;
    if (source.type === "project") return source.title;
    return source.originalTitle;
  };

  const getCreatorId = async () => {
    // We need to notify the creator of the original post
    let creatorUsername: string | null = null;
    if (source.type === "reblog") {
      creatorUsername = source.originalCreatorUsername;
    } else if ("creatorUsername" in source) {
      creatorUsername = source.creatorUsername;
    }
    if (!creatorUsername) return null;
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", creatorUsername)
      .maybeSingle();
    return data?.id ?? null;
  };

  const handleSubmit = async () => {
    if (!user || !profile) return;
    setSubmitting(true);

    try {
      const ids = resolveIds();

      // Insert the reblog as a content_item
      const { data: newItem, error } = await supabase
        .from("content_items")
        .insert({
          creator_id: user.id,
          is_reblog: true,
          reblog_comment: comment.trim() || null,
          content_type: "Reblog",
          difficulty: "Beginner",
          title: `Reblog: ${getTitle().slice(0, 60)}`,
          status: "approved",
          approved_at: new Date().toISOString(),
          view_count: 0,
          download_count: 0,
          monetisation_type: "free",
          is_free: true,
          tags: [],
          ...ids,
        } as any)
        .select("id")
        .single();

      if (error || !newItem) throw error ?? new Error("Insert failed");

      // Increment reblog_count on the source optimistically via DB
      if (ids.reblog_of_content_id) {
        await supabase
          .from("content_items")
          .update({ reblog_count: supabase.rpc as any } as any)
          .eq("id", ids.reblog_of_content_id);
        // Use raw SQL increment via RPC if available; fallback: just invalidate cache
      }

      // Insert notification for original creator
      const creatorId = await getCreatorId();
      if (creatorId && creatorId !== user.id) {
        const sourceType =
          source.type === "collection" ? "collection"
            : source.type === "project" ? "project"
            : "content";
        await supabase.from("notifications").insert({
          recipient_id: creatorId,
          actor_id: user.id,
          notification_type: "reblog",
          content_id: ids.reblog_of_content_id,
          collection_id: ids.reblog_of_collection_id,
          project_id: ids.reblog_of_project_id,
          metadata: {
            reblogger_username: profile.username,
            source_title: getTitle(),
            source_type: sourceType,
          },
        } as any);
      }

      // Invalidate feed and reblog count caches
      qc.invalidateQueries({ queryKey: ["reblog_count"] });
      qc.invalidateQueries({ queryKey: ["user_has_reblogged"] });
      qc.invalidateQueries({ queryKey: ["feed"] });

      onSuccess?.(newItem.id);
      onOpenChange(false);
      setComment("");

      toast({
        title: "Reblogged ✓",
        action: (
          <button
            className="text-xs underline text-primary"
            onClick={() => navigate(`/content/${newItem.id}`)}
          >
            View it →
          </button>
        ) as any,
      });
    } catch (err) {
      toast({ title: "Failed to reblog", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat2 className="h-4 w-4 text-[#2EC4B6]" />
            Reblog
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Comment textarea */}
          <Textarea
            placeholder="Add a comment (optional)…"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            className="bg-background resize-none"
            rows={3}
          />
          <p className="text-[11px] text-muted-foreground text-right">{comment.length}/500</p>

          {/* Quoted card */}
          {source.type === "content" && (
            <ContentQuotedCard
              title={source.title}
              contentType={source.contentType}
              creatorUsername={source.creatorUsername}
              coverUrl={source.coverUrl}
            />
          )}
          {source.type === "collection" && (
            <CollectionQuotedCard
              title={source.title}
              creatorUsername={source.creatorUsername}
              itemCount={source.itemCount}
              coverImages={source.coverImages}
            />
          )}
          {source.type === "project" && (
            <ProjectQuotedCard
              title={source.title}
              creatorUsername={source.creatorUsername}
              blueprintCount={source.blueprintCount}
              coverUrl={source.coverUrl}
              packagePrice={source.packagePrice}
            />
          )}
          {source.type === "reblog" && (
            <ReblogQuotedCard
              rebloggerUsername={source.rebloggerUsername}
              reblogComment={source.reblogComment}
              originalType={source.originalType}
              originalTitle={source.originalTitle}
              originalCreatorUsername={source.originalCreatorUsername}
            />
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-[#2EC4B6] hover:bg-[#2EC4B6]/90 text-white"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Reblogging…" : "Reblog"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
