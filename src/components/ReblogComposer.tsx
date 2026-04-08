/**
 * ReblogComposer — full-screen modal for creating a reblog post.
 *
 * Triggered by clicking the ↺ reblog icon on any feed card or content detail page.
 * Creates a new content_item with is_reblog=true + content_blocks for the thread.
 */

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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Eye, Download, Repeat2, X, ChevronDown, ChevronUp } from "lucide-react";
import { ContentBlockBuilder, emptyBlock, type ContentBlock } from "@/components/ContentBlockBuilder";
import {
  BLUEPRINT_CONTENT_TYPES, BOUNTY_CONTENT_TYPES, DIFFICULTIES,
  TYPE_COLORS, displayContentType, TOPICS,
} from "@/lib/content-types";
import { insertNotification } from "@/lib/notifications";
import { formatNum } from "@/components/FeedItem";

// ── Types ────────────────────────────────────────────────────

export interface ReblogComposerOriginal {
  id: string;
  title: string;
  creatorId: string;
  creatorUsername: string;
  creatorDisplayName?: string;
  contentType?: string;
  viewCount?: number;
  downloadCount?: number;
}

interface ReblogComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  original: ReblogComposerOriginal;
  onSuccess?: (newId: string) => void;
}

// ── Quoted post card (Section B) ──────────────────────────────

function QuotedPostCard({ original }: { original: ReblogComposerOriginal }) {
  const typeColor = original.contentType
    ? (TYPE_COLORS[original.contentType] ?? TYPE_COLORS["Failure Library"])
    : "bg-muted text-muted-foreground";

  return (
    <div
      className="rounded-xl border border-white/10 bg-white/3 px-3.5 py-3"
      style={{ borderLeft: "3px solid rgba(255,255,255,0.15)" }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <div className="h-6 w-6 rounded-full bg-primary/30 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
          {(original.creatorDisplayName || original.creatorUsername || "?").slice(0, 2).toUpperCase()}
        </div>
        <span className="text-[13px] font-bold text-foreground">
          {original.creatorDisplayName || original.creatorUsername}
        </span>
        <span className="text-[12px] text-muted-foreground">@{original.creatorUsername}</span>
        {original.contentType && (
          <Badge variant="outline" className={`text-[9px] font-medium ml-1 ${typeColor}`}>
            {displayContentType(original.contentType)}
          </Badge>
        )}
      </div>
      <p className="text-[14px] font-semibold text-white line-clamp-2 mb-1">{original.title}</p>
      <p className="text-[12px] text-muted-foreground flex items-center gap-2">
        <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{formatNum(original.viewCount ?? 0)}</span>
        <span>·</span>
        <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" />{formatNum(original.downloadCount ?? 0)}</span>
      </p>
    </div>
  );
}

// ── Post type selector ────────────────────────────────────────

type PostCategory = "blog" | "blueprint" | "bounty";

function PostTypeCards({
  value,
  onChange,
}: {
  value: PostCategory;
  onChange: (v: PostCategory) => void;
}) {
  const types: { key: PostCategory; label: string; icon: string }[] = [
    { key: "blog", label: "Blog", icon: "📝" },
    { key: "blueprint", label: "Blueprint", icon: "🔷" },
    { key: "bounty", label: "Bounty", icon: "🎯" },
  ];

  return (
    <div className="flex gap-2">
      {types.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
            value === t.key
              ? "bg-primary/20 border-primary/50 text-primary"
              : "border-white/10 bg-white/3 text-muted-foreground hover:border-white/20"
          }`}
        >
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Main composer ─────────────────────────────────────────────

export function ReblogComposer({ open, onOpenChange, original, onSuccess }: ReblogComposerProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [postCategory, setPostCategory] = useState<PostCategory>("blog");
  const [contentType, setContentType] = useState("");
  const [reblogTitle, setReblogTitle] = useState("");
  const [blocks, setBlocks] = useState<ContentBlock[]>([emptyBlock("text")]);
  const [metaExpanded, setMetaExpanded] = useState(false);
  const [monoExpanded, setMonoExpanded] = useState(false);
  const [difficulty, setDifficulty] = useState("Beginner");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState("");
  const [monetisationType, setMonetisationType] = useState<"free" | "paid" | "donation">("free");
  const [submitting, setSubmitting] = useState(false);

  const blueprintTypes = BLUEPRINT_CONTENT_TYPES;
  const bountyTypes = BOUNTY_CONTENT_TYPES as readonly string[];

  const handleCategoryChange = (cat: PostCategory) => {
    setPostCategory(cat);
    setContentType("");
  };

  const hasContent = blocks.some(
    (b) => b.textContent?.trim() || b.file || b.imageFile || b.externalFileUrl
  );

  const handleSubmit = async (status: "approved" | "draft") => {
    if (!user || !profile) return;

    if (status === "approved" && !hasContent) {
      toast({ title: "Add at least one block of content", variant: "destructive" });
      return;
    }
    if (status === "approved" && postCategory === "blueprint" && !contentType) {
      toast({ title: "Select a content type for your Blueprint", variant: "destructive" });
      return;
    }
    if (status === "approved" && postCategory === "bounty" && !contentType) {
      toast({ title: "Select a content type for your Bounty", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      // Determine content_type
      let finalContentType: string;
      if (postCategory === "blog") {
        finalContentType = "Blog";
      } else {
        finalContentType = contentType;
      }

      const isBounty = postCategory === "bounty";

      const { data: newItem, error } = await supabase
        .from("content_items")
        .insert({
          creator_id: user.id,
          is_reblog: true,
          reblog_of_id: original.id,
          post_category: postCategory,
          content_type: finalContentType,
          title: reblogTitle.trim() || null,
          status,
          approved_at: status === "approved" ? new Date().toISOString() : null,
          difficulty: postCategory === "blog" ? "Any" : difficulty,
          ai_tools: selectedTools,
          topics: selectedTopics,
          custom_tags: tags,
          tags,
          monetisation_type: monetisationType,
          is_free: monetisationType === "free",
          bounty_enabled: isBounty,
          bounty_status: isBounty ? "open" : null,
          view_count: 0,
          download_count: 0,
        } as any)
        .select("id")
        .single();

      if (error || !newItem) throw error ?? new Error("Insert failed");

      const contentId = newItem.id;

      // Insert content blocks
      let blockCount = 0;
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const position = i + 1;

        // Skip truly empty blocks
        if (!block.textContent?.trim() && !block.file && !block.imageFile && !block.externalFileUrl) {
          continue;
        }

        let fileUrl: string | null = null;
        let fileName: string | null = null;
        let fileSizeBytes: number | null = null;
        let imageUrl: string | null = null;

        if (block.type === "file" && block.file) {
          const path = `${contentId}/${position}/${block.file.name}`;
          const { error: upErr } = await supabase.storage.from("content-files").upload(path, block.file);
          if (!upErr) {
            fileUrl = path;
            fileName = block.file.name;
            fileSizeBytes = block.file.size;
          }
        }

        if (block.type === "image" && block.imageFile) {
          const path = `${contentId}/${position}/${block.imageFile.name}`;
          const { error: upErr } = await supabase.storage.from("content-files").upload(path, block.imageFile);
          if (!upErr) {
            imageUrl = path;
          }
        }

        let subBlocksData: any = null;
        if (block.formatting === "sub_list" && block.subBlocks?.length > 0) {
          subBlocksData = block.subBlocks;
        } else if (block.type === "github") {
          subBlocksData = [{ description: block.githubDescription?.trim() || "" }];
        } else if (block.type === "large_file") {
          subBlocksData = [{
            platform: block.largeFilePlatform || "",
            custom_platform: block.largeFileCustomPlatform?.trim() || null,
            description: block.largeFileDescription?.trim() || "",
            file_size_hint: block.largeFileSizeHint?.trim() || "",
          }];
        }

        await supabase.from("content_blocks").insert({
          content_id: contentId,
          position,
          block_type: block.type,
          text_content: (block.type === "text" || block.type === "long_text" || block.type === "github" || block.type === "large_file")
            ? (block.textContent || null)
            : null,
          formatting: (block.type === "text" || block.type === "long_text") ? { type: block.formatting } : null,
          formatting_type: block.formatting || "paragraph",
          file_url: fileUrl,
          file_name: fileName,
          file_size_bytes: fileSizeBytes,
          image_url: imageUrl,
          image_description: block.imageDescription || null,
          use_instructions: block.useInstructions?.trim() || null,
          sub_blocks: subBlocksData,
          is_preview: block.isPreview || false,
          external_url: block.externalFileUrl || null,
        } as any);

        blockCount++;
      }

      // Update reblog_thread_count (blocks beyond the first)
      if (blockCount > 1) {
        await supabase
          .from("content_items")
          .update({ reblog_thread_count: blockCount - 1 } as any)
          .eq("id", contentId);
      }

      // Notify original creator
      if (original.creatorId && original.creatorId !== user.id && status === "approved") {
        await insertNotification({
          recipient_id: original.creatorId,
          actor_id: user.id,
          notification_type: "post_reblogged",
          content_id: original.id,
          metadata: {
            reblogger_username: profile.username,
            reblog_title: reblogTitle.trim() || null,
            reblog_id: contentId,
            original_title: original.title,
          },
        });
      }

      qc.invalidateQueries({ queryKey: ["home_recent_blueprints"] });
      qc.invalidateQueries({ queryKey: ["reblog_count", original.id] });

      onSuccess?.(contentId);
      onOpenChange(false);

      // Reset state
      setPostCategory("blog");
      setContentType("");
      setReblogTitle("");
      setBlocks([emptyBlock("text")]);
      setMetaExpanded(false);
      setMonoExpanded(false);
      setDifficulty("Beginner");
      setSelectedTools([]);
      setSelectedTopics([]);
      setTagsInput("");
      setMonetisationType("free");

      if (status === "approved") {
        toast({
          title: "Reblogged ✓",
          action: (
            <button
              className="text-xs underline text-primary"
              onClick={() => navigate(`/content/${contentId}`)}
            >
              View it →
            </button>
          ) as any,
        });
      } else {
        toast({ title: "Saved as draft" });
        navigate("/drafts");
      }
    } catch (err: any) {
      toast({ title: "Failed to reblog", description: err?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[680px] max-h-[92vh] overflow-y-auto p-0"
        data-visual-slot="modal-surface"
        style={{ background: '#0E0E16', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-white/8 sticky top-0 z-10"
          style={{ background: "rgba(14,14,20,0.97)" }}
        >
          <DialogTitle className="flex items-center gap-2 text-[18px] font-bold">
            <Repeat2 className="h-5 w-5 text-[#2EC4B6]" />
            Reblog
          </DialogTitle>
          <p className="text-[13px] text-muted-foreground mt-1">
            You're reblogging "{original.title.slice(0, 60)}{original.title.length > 60 ? "…" : ""}"
          </p>
        </DialogHeader>

        <div className="px-5 py-4 space-y-5">

          {/* SECTION A — Post type */}
          <div>
            <p className="text-[13px] font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Post type</p>
            <PostTypeCards value={postCategory} onChange={handleCategoryChange} />

            {/* Content type dropdown for blueprint/bounty */}
            {postCategory === "blueprint" && (
              <div className="mt-3">
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
                >
                  <option value="">Select Blueprint type…</option>
                  {blueprintTypes.map((t) => (
                    <option key={t} value={t}>{displayContentType(t)}</option>
                  ))}
                </select>
              </div>
            )}

            {postCategory === "bounty" && (
              <div className="mt-3">
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
                >
                  <option value="">Select Bounty type…</option>
                  {bountyTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* SECTION B — Quoted post (always visible) */}
          <div>
            <p className="text-[13px] font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Quoting</p>
            <QuotedPostCard original={original} />
          </div>

          {/* SECTION C — Title */}
          <div>
            <p className="text-[13px] font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Your title <span className="normal-case font-normal">(optional)</span></p>
            <Input
              value={reblogTitle}
              onChange={(e) => setReblogTitle(e.target.value.slice(0, 120))}
              placeholder="Add a title to your reblog (optional)"
              className="bg-white/5 border-white/10 focus:border-primary/50"
              maxLength={120}
            />
            <p className="text-[11px] text-muted-foreground mt-1">Shown above the quoted post in the feed. {reblogTitle.length}/120</p>
          </div>

          {/* SECTION D — Thread blocks */}
          <div>
            <p className="text-[13px] font-semibold text-foreground mb-0.5">Your thread</p>
            <p className="text-[12px] text-muted-foreground mb-3">
              Add your commentary below the quoted post. The first block is always shown in the feed. The rest expand on tap.
            </p>

            {/* Block labels overlay */}
            <div className="space-y-0">
              {blocks.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground/60 mb-1">
                    Block 1 — Always shown in feed
                  </p>
                </div>
              )}
              {blocks.length > 1 && (
                <div>
                  {blocks.slice(1).map((_, i) => (
                    <p key={i} className="text-[10px] text-muted-foreground/60 mt-2 mb-1">
                      Block {i + 2} — Thread (shown on expand)
                    </p>
                  ))}
                </div>
              )}
            </div>

            <ContentBlockBuilder
              blocks={blocks as any}
              onChange={setBlocks as any}
              contentType={contentType || (postCategory === "blog" ? "Blog" : "")}
            />
          </div>

          {/* SECTION E — Metadata (Blueprint/Bounty only) */}
          {postCategory !== "blog" && (
            <div>
              <button
                type="button"
                onClick={() => setMetaExpanded(!metaExpanded)}
                className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {metaExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Add metadata
              </button>

              {metaExpanded && (
                <div className="mt-3 space-y-4 pl-0.5">
                  {/* Difficulty */}
                  <div>
                    <p className="text-[12px] font-medium text-muted-foreground mb-2">Difficulty</p>
                    <div className="flex gap-2">
                      {DIFFICULTIES.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDifficulty(d)}
                          className={`px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors ${
                            difficulty === d
                              ? "bg-primary/20 border-primary/50 text-primary"
                              : "border-white/10 bg-white/3 text-muted-foreground hover:border-white/20"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Topics */}
                  <div>
                    <p className="text-[12px] font-medium text-muted-foreground mb-2">Topics</p>
                    <div className="flex flex-wrap gap-2">
                      {TOPICS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSelectedTopics((prev) =>
                            prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                          )}
                          className={`px-2.5 py-1 rounded-full border text-[11px] transition-colors ${
                            selectedTopics.includes(t)
                              ? "bg-[#2EC4B6]/20 border-[#2EC4B6]/40 text-[#2EC4B6]"
                              : "border-white/10 bg-white/3 text-muted-foreground hover:border-white/20"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <p className="text-[12px] font-medium text-muted-foreground mb-2">Tags</p>
                    <Input
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      placeholder="tag1, tag2, tag3"
                      className="bg-white/5 border-white/10 focus:border-primary/50 text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">Comma-separated</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION F — Monetisation (collapsed by default) */}
          <div>
            <button
              type="button"
              onClick={() => setMonoExpanded(!monoExpanded)}
              className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {monoExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Monetisation
            </button>

            {monoExpanded && (
              <div className="mt-3 flex gap-2">
                {(["free", "paid", "donation"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMonetisationType(m)}
                    className={`flex-1 py-2 rounded-lg border text-[12px] font-medium capitalize transition-colors ${
                      monetisationType === m
                        ? "bg-primary/20 border-primary/50 text-primary"
                        : "border-white/10 bg-white/3 text-muted-foreground hover:border-white/20"
                    }`}
                  >
                    {m === "free" ? "Free" : m === "paid" ? "Paid" : "Donation"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit buttons */}
        <div
          className="px-5 py-4 border-t border-white/8 flex gap-3 sticky bottom-0"
          style={{ background: "rgba(14,14,20,0.97)" }}
        >
          <Button
            variant="outline"
            className="flex-1 border-white/20 text-muted-foreground hover:text-foreground"
            disabled={submitting}
            onClick={() => handleSubmit("draft")}
          >
            Save as Draft
          </Button>
          <Button
            className="flex-1 bg-primary hover:bg-primary/90 text-white font-semibold"
            disabled={submitting || !hasContent}
            onClick={() => handleSubmit("approved")}
          >
            {submitting ? "Posting…" : "Post Reblog →"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
