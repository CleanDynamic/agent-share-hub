/**
 * PublishCollectionModal — publish a library folder as a public Collection,
 * or sync an already-published folder to its collection.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { TYPE_COLORS, TYPE_COLOR_FALLBACK, displayContentType } from "@/lib/content-types";

// ── Types ─────────────────────────────────────────────────────

interface FolderItem {
  id: string;          // user_library row id
  content_id: string;
  position?: number;
  content_items: {
    id: string;
    title: string;
    content_type: string;
    cover_image_url?: string | null;
  } | null;
}

export interface PublishCollectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: {
    id: string;
    name: string;
    emoji?: string | null;
    published_collection_id?: string | null;
  };
  /** Items currently in the folder (from user_library, joined with content_items) */
  items: FolderItem[];
  /** Called after successful publish/sync */
  onSuccess?: () => void;
}

type Visibility = "public" | "unlisted" | "private";

// ── Slug helper ───────────────────────────────────────────────

function slugify(title: string, username: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${username}-${base}-${suffix}`;
}

// ── Publish (new) modal ───────────────────────────────────────

function PublishForm({
  folder,
  items,
  onSuccess,
  onClose,
}: {
  folder: PublishCollectionModalProps["folder"];
  items: FolderItem[];
  onSuccess?: () => void;
  onClose: () => void;
}) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [title, setTitle] = useState(folder.name.slice(0, 80));
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [submitting, setSubmitting] = useState(false);

  const validItems = items.filter((i) => !!i.content_items);

  const handlePublish = async () => {
    if (!user || !profile || !title.trim()) return;
    if (validItems.length < 2) {
      toast({ title: "Need at least 2 items to publish a collection", variant: "destructive" });
      return;
    }
    setSubmitting(true);

    try {
      const slug = slugify(title.trim(), profile.username ?? "user");

      // Insert collection
      const { data: newColl, error: collErr } = await supabase
        .from("collections")
        .insert({
          owner_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          visibility,
          is_public: visibility === "public",
          slug,
          item_count: validItems.length,
        })
        .select("id, slug")
        .single();

      if (collErr || !newColl) throw collErr ?? new Error("Failed to create collection");

      // Insert collection_items
      const collectionItems = validItems.map((item, idx) => ({
        collection_id: newColl.id,
        content_id: item.content_id,
        added_by: user.id,
        position: item.position ?? idx,
      }));
      await supabase.from("collection_items").insert(collectionItems);

      // Link the folder to this collection
      await supabase
        .from("library_folders")
        .update({ published_collection_id: newColl.id } as any)
        .eq("id", folder.id);

      qc.invalidateQueries({ queryKey: ["library_folders", user.id] });

      const collSlug = newColl.slug ?? newColl.id;
      onSuccess?.();
      onClose();

      toast({
        title: "Collection published ✓",
        action: (
          <button
            className="text-xs underline text-primary"
            onClick={() => navigate(`/collections/${collSlug}`)}
          >
            View it →
          </button>
        ) as any,
      });
    } catch {
      toast({ title: "Failed to publish collection", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const visOpts: { value: Visibility; label: string }[] = [
    { value: "private", label: "Private" },
    { value: "unlisted", label: "Unlisted" },
    { value: "public", label: "Public" },
  ];

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Collection title</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 80))}
          placeholder="Title…"
          className="bg-background"
        />
        <p className="text-[11px] text-muted-foreground text-right">{title.length}/80</p>
      </div>

      {/* Items (read-only list) */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Items ({validItems.length} blueprint{validItems.length !== 1 ? "s" : ""})
        </label>
        <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-card/40 divide-y divide-border">
          {validItems.slice(0, 20).map((item) => {
            const ci = item.content_items!;
            const typeColor = TYPE_COLORS[ci.content_type] ?? TYPE_COLOR_FALLBACK;
            return (
              <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                <Badge variant="outline" className={`text-[9px] font-medium shrink-0 ${typeColor}`}>
                  {displayContentType(ci.content_type)}
                </Badge>
                <span className="text-xs text-foreground truncate">{ci.title}</span>
              </div>
            );
          })}
          {validItems.length > 20 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">+{validItems.length - 20} more</div>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">To add or remove items, edit your Library folder.</p>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 200))}
          placeholder="What is this collection about?"
          className="bg-background resize-none"
          rows={3}
        />
        <p className="text-[11px] text-muted-foreground text-right">{description.length}/200</p>
      </div>

      {/* Visibility */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Visibility</label>
        <div className="flex gap-2">
          {visOpts.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setVisibility(opt.value)}
              className={`flex-1 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                visibility === opt.value
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={handlePublish}
          disabled={submitting || !title.trim() || validItems.length < 2}
        >
          {submitting ? "Publishing…" : "Publish Collection"}
        </Button>
      </div>
    </div>
  );
}

// ── Sync (update) modal ───────────────────────────────────────

function SyncForm({
  folder,
  items,
  publishedCollectionId,
  onSuccess,
  onClose,
}: {
  folder: PublishCollectionModalProps["folder"];
  items: FolderItem[];
  publishedCollectionId: string;
  onSuccess?: () => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const validItems = items.filter((i) => !!i.content_items);

  const handleSync = async () => {
    if (!user) return;
    setSyncing(true);

    try {
      // Fetch existing collection_items to find what's new
      const { data: existing } = await supabase
        .from("collection_items")
        .select("content_id")
        .eq("collection_id", publishedCollectionId);

      const existingIds = new Set((existing ?? []).map((r: any) => r.content_id));
      const newItems = validItems.filter((i) => !existingIds.has(i.content_id));

      if (newItems.length === 0) {
        toast({ title: "Collection is already up to date" });
        onClose();
        return;
      }

      // Fetch current max position
      const { data: maxPosRow } = await supabase
        .from("collection_items")
        .select("position")
        .eq("collection_id", publishedCollectionId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const maxPos = (maxPosRow as any)?.position ?? 0;

      // Insert new items
      const inserts = newItems.map((item, idx) => ({
        collection_id: publishedCollectionId,
        content_id: item.content_id,
        added_by: user.id,
        position: maxPos + idx + 1,
      }));
      await supabase.from("collection_items").insert(inserts);

      // Update collection item_count
      await supabase
        .from("collections")
        .update({ item_count: validItems.length, updated_at: new Date().toISOString() })
        .eq("id", publishedCollectionId);

      qc.invalidateQueries({ queryKey: ["library_folders", user.id] });
      onSuccess?.();
      onClose();

      toast({ title: `Synced — ${newItems.length} new item${newItems.length !== 1 ? "s" : ""} added ✓` });
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const existingCount = validItems.length;
  const newCount = validItems.length; // rough display; exact count computed on submit

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        This will add any new items from{" "}
        <span className="font-medium text-foreground">
          {folder.emoji ? `${folder.emoji} ` : ""}{folder.name}
        </span>{" "}
        to its published collection. Items removed from the folder are <em>not</em> removed from the collection.
      </p>
      <p className="text-sm text-muted-foreground">
        The folder currently has <span className="font-medium text-foreground">{existingCount} item{existingCount !== 1 ? "s" : ""}</span>.
      </p>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? "Syncing…" : "Sync"}
        </Button>
      </div>
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────

export function PublishCollectionModal({
  open,
  onOpenChange,
  folder,
  items,
  onSuccess,
}: PublishCollectionModalProps) {
  const isUpdate = !!folder.published_collection_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md max-h-[90vh] overflow-y-auto"
        data-visual-slot="modal-surface"
        style={{ background: '#0E0E16', border: '1px solid var(--border)' }}
      >
        <DialogHeader>
          <DialogTitle>
            {isUpdate
              ? `Sync "${folder.name}" to its collection`
              : `Publish "${folder.name}" as a Collection`}
          </DialogTitle>
          {!isUpdate && (
            <DialogDescription>
              Turn this library folder into a public collection on the feed.
            </DialogDescription>
          )}
        </DialogHeader>

        {isUpdate ? (
          <SyncForm
            folder={folder}
            items={items}
            publishedCollectionId={folder.published_collection_id!}
            onSuccess={onSuccess}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <PublishForm
            folder={folder}
            items={items}
            onSuccess={onSuccess}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
