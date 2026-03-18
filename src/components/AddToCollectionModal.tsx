import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, Lock, Globe, Eye } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string;
  contentTitle?: string;
  /** Pre-populate for companion collection creation */
  prefill?: {
    title: string;
    description: string;
    visibility: "private" | "unlisted" | "public";
    contentIds: string[];
    projectId?: string;
  };
}

function slugify(title: string, username: string): string {
  return `${title}-${username}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

const VISIBILITY_OPTIONS = [
  { value: "private", label: "Private", desc: "Only you can see this", icon: Lock },
  { value: "unlisted", label: "Unlisted", desc: "Anyone with the link can view it", icon: Eye },
  { value: "public", label: "Public", desc: "Appears on your profile and in Browse", icon: Globe },
] as const;

export function AddToCollectionModal({ open, onOpenChange, contentId, contentTitle, prefill }: Props) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(!!prefill);
  const [title, setTitle] = useState(prefill?.title ?? "");
  const [desc, setDesc] = useState(prefill?.description ?? "");
  const [visibility, setVisibility] = useState<"private" | "unlisted" | "public">(prefill?.visibility ?? "private");
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const { data: collections, isLoading } = useQuery({
    queryKey: ["my_collections", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("id, title, item_count, is_public, visibility")
        .eq("owner_id", profile!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile?.id && open,
  });

  const { data: memberships } = useQuery({
    queryKey: ["collection_memberships", contentId, profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("collection_items")
        .select("collection_id")
        .eq("content_id", contentId)
        .eq("added_by", profile!.id);
      return new Set((data ?? []).map((r) => r.collection_id));
    },
    enabled: !!profile?.id && open,
  });

  async function toggleCollection(collectionId: string, inCollection: boolean) {
    if (!profile) return;
    setToggling(collectionId);
    try {
      if (inCollection) {
        await supabase
          .from("collection_items")
          .delete()
          .eq("collection_id", collectionId)
          .eq("content_id", contentId);
        await supabase
          .from("collections")
          .update({ item_count: Math.max(0, (collections?.find((c) => c.id === collectionId)?.item_count ?? 1) - 1), updated_at: new Date().toISOString() })
          .eq("id", collectionId);
      } else {
        const col = collections?.find((c) => c.id === collectionId);
        const position = (col?.item_count ?? 0) + 1;
        await supabase.from("collection_items").insert({
          collection_id: collectionId,
          content_id: contentId,
          added_by: profile.id,
          position,
        });
        await supabase
          .from("collections")
          .update({ item_count: position, updated_at: new Date().toISOString() })
          .eq("id", collectionId);

        const colVisibility = (col as any)?.visibility ?? (col?.is_public ? "public" : "private");
        if (colVisibility === "public") {
          supabase.from("user_interactions").insert({
            user_id: profile.id,
            content_id: contentId,
            interaction_type: "added_to_collection",
            interaction_meta: {
              collection_title: col?.title,
              content_title: contentTitle ?? "",
            },
          } as any);
        }
      }
      qc.invalidateQueries({ queryKey: ["collection_memberships", contentId] });
      qc.invalidateQueries({ queryKey: ["my_collections"] });
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    }
    setToggling(null);
  }

  async function handleCreate() {
    if (!profile || !title.trim()) return;
    setCreating(true);
    const slug = slugify(title.trim(), profile.username ?? profile.id.slice(0, 8));
    const itemIds = prefill?.contentIds ?? [contentId];
    const { data: col, error } = await supabase
      .from("collections")
      .insert({
        owner_id: profile.id,
        title: title.trim(),
        description: desc.trim() || null,
        is_public: visibility === "public",
        visibility,
        slug,
        item_count: itemIds.length,
        ...(prefill?.projectId ? { project_id: prefill.projectId } : {}),
      } as any)
      .select("id, title, item_count, is_public, slug")
      .single();

    if (error) {
      toast({ title: "Failed to create collection", description: error.message, variant: "destructive" });
      setCreating(false);
      return;
    }

    // Add content items
    const inserts = itemIds.map((cid, i) => ({
      collection_id: col.id,
      content_id: cid,
      added_by: profile.id,
      position: i + 1,
    }));
    await supabase.from("collection_items").insert(inserts);

    if (visibility === "public") {
      supabase.from("user_interactions").insert({
        user_id: profile.id,
        content_id: contentId,
        interaction_type: "added_to_collection",
        interaction_meta: {
          collection_title: col.title,
          content_title: contentTitle ?? "",
          ...(prefill?.projectId ? { is_project_companion: true } : {}),
        },
      } as any);
    }

    qc.invalidateQueries({ queryKey: ["my_collections"] });
    qc.invalidateQueries({ queryKey: ["collection_memberships", contentId] });
    if (prefill?.projectId) {
      qc.invalidateQueries({ queryKey: ["companion_collection", prefill.projectId] });
    }
    setTitle("");
    setDesc("");
    setVisibility("private");
    setShowCreate(false);
    setCreating(false);
    onOpenChange(false);
    toast({ title: `Created "${col.title}"` });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-base">{prefill ? "Create companion collection" : "Add to collection"}</DialogTitle>
        </DialogHeader>

        {!prefill && (
          <>
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {(collections ?? []).map((col) => {
                  const inCol = memberships?.has(col.id) ?? false;
                  const colVis = (col as any)?.visibility ?? (col.is_public ? "public" : "private");
                  return (
                    <label
                      key={col.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={inCol}
                        disabled={toggling === col.id}
                        onCheckedChange={() => toggleCollection(col.id, inCol)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{col.title}</p>
                        <p className="text-[10px] text-muted-foreground">{col.item_count} items</p>
                      </div>
                      {colVis === "public" ? (
                        <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                      ) : colVis === "unlisted" ? (
                        <Eye className="h-3 w-3 text-muted-foreground shrink-0" />
                      ) : (
                        <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                    </label>
                  );
                })}
                {(collections ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No collections yet</p>
                )}
              </div>
            )}
          </>
        )}

        {!showCreate && !prefill ? (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-2"
          >
            <Plus className="h-3.5 w-3.5" /> Create new collection
          </button>
        ) : (
          <div className="space-y-3 mt-2 pt-3 border-t border-border">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 80))}
              placeholder="Collection title"
              className="h-9 text-sm"
            />
            <Input
              value={desc}
              onChange={(e) => setDesc(e.target.value.slice(0, 200))}
              placeholder="Description (optional)"
              className="h-9 text-sm"
            />
            {/* Three-way visibility selector */}
            <div className="space-y-1.5">
              {VISIBILITY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = visibility === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setVisibility(opt.value)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors ${
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <Button
              size="sm"
              className="w-full"
              disabled={!title.trim() || creating}
              onClick={handleCreate}
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              {prefill ? "Create collection" : "Create & add"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
