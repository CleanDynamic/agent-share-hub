import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CollectionDetailPage,
  type DetailItem,
  type SortOption,
  type TypeFilter,
} from "@/components/library/CollectionDetailPage";
import { CollectionFormModal } from "@/components/library/CollectionFormModal";
import {
  ReferencePickerModal,
  type ReferenceType,
  type ResultItem,
} from "@/components/blog/ReferencePickerModal";
import {
  useReferenceCounts,
  useReferenceResults,
} from "@/components/blog/useReferencePicker";
import {
  getCollectionDetail,
  saveToCollection,
  removeFromCollection,
  reorderCollectionItems,
  updateCollection,
  getCollections,
  createCollection,
} from "@/lib/library";
import { Library as LibraryIcon } from "lucide-react";
import { deleteCollection } from "@/lib/library/updateCollection";
import type {
  CollectionItemKind,
  SavedItem,
} from "@/lib/library/types";

const TYPE_TO_KIND: Record<TypeFilter, CollectionItemKind | "all"> = {
  all: "all",
  blueprint: "blueprint",
  blog: "blog",
  bounty: "bounty",
  stage: "stage",
  block: "block",
};

const SORT_TO_API: Record<SortOption, "recent" | "alphabetical" | "manual"> = {
  "recently-added": "manual",
  "a-z": "alphabetical",
  "by-type": "manual",
};

function deepLinkForItem(item: SavedItem): string {
  const slug = (item.cached_meta as any)?.slug || item.slug;
  switch (item.kind) {
    case "blueprint":
    case "blog":
    case "bounty":
      if (slug) return `/${item.kind}/${slug}`;
      return `/content/${item.id}`;
    case "stage":
      return `/stage/${item.id}`;
    case "block":
      return `/block/${item.id}`;
    default:
      return `/content/${item.id}`;
  }
}

function toDetailItem(s: SavedItem): DetailItem {
  return {
    id: s.collectionItemId,
    itemId: s.id,
    kind: s.kind,
    title: s.title || "Untitled",
    description: (s.cached_meta as any)?.description ?? null,
    imageUrl: s.cover_image_url,
  };
}

export default function CollectionDetailRoute() {
  const navigate = useNavigate();
  const params = useParams<{ collectionId: string }>();
  const collectionId = params.collectionId!;
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [sort, setSort] = React.useState<SortOption>("recently-added");
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerType, setPickerType] = React.useState<ReferenceType>("blueprints");
  const [pickerQuery, setPickerQuery] = React.useState("");
  const [moveTarget, setMoveTarget] = React.useState<DetailItem | null>(null);
  const [saving, setSaving] = React.useState(false);

  const detailQuery = useQuery({
    queryKey: [
      "collection_detail",
      collectionId,
      profile?.id,
      typeFilter,
      sort,
    ],
    queryFn: () =>
      getCollectionDetail({
        collectionId,
        viewerId: profile?.id ?? null,
        typeFilter: TYPE_TO_KIND[typeFilter],
        sort: SORT_TO_API[sort],
        limit: 200,
      }),
    retry: false,
  });

  const counts = useReferenceCounts(pickerOpen);
  const { results: pickerResults, isLoading: pickerLoading } =
    useReferenceResults(pickerOpen, pickerType, pickerQuery);

  const handleAddSelect = async (sel: ResultItem) => {
    try {
      const kind: CollectionItemKind =
        sel.type === "blueprint" ? "blueprint" : sel.type === "stage" ? "stage" : "block";
      await saveToCollection(collectionId, kind, sel.id);
      qc.invalidateQueries({ queryKey: ["collection_detail", collectionId] });
      qc.invalidateQueries({ queryKey: ["library_collections"] });
      qc.invalidateQueries({ queryKey: ["library_all_items"] });
      toast({ title: "Added to collection" });
      setPickerOpen(false);
    } catch (e: any) {
      toast({
        title: "Couldn't add item",
        description: e?.message,
        variant: "destructive",
      });
    }
  };

  const handleReorder = async (itemIds: string[]) => {
    try {
      await reorderCollectionItems(collectionId, itemIds);
      qc.invalidateQueries({ queryKey: ["collection_detail", collectionId] });
    } catch (e: any) {
      toast({
        title: "Couldn't save order",
        description: e?.message,
        variant: "destructive",
      });
    }
  };

  const handleRemove = async (item: DetailItem) => {
    try {
      await removeFromCollection(collectionId, item.kind, item.itemId);
      qc.invalidateQueries({ queryKey: ["collection_detail", collectionId] });
      qc.invalidateQueries({ queryKey: ["library_collections"] });
      qc.invalidateQueries({ queryKey: ["library_all_items"] });
      toast({ title: "Removed from collection" });
    } catch (e: any) {
      toast({
        title: "Couldn't remove",
        description: e?.message,
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    if (!detailQuery.data) return;
    const c = detailQuery.data.collection;
    const ownerHandle = await getOwnerHandle(c.ownerId);
    const slug = c.id; // slugs not yet generated; use id for now
    const url = ownerHandle
      ? `${window.location.origin}/library/${ownerHandle}/collections/${slug}`
      : `${window.location.origin}/library/collections/${c.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied to clipboard" });
    } catch {
      toast({ title: "Share URL", description: url });
    }
  };

  const handleEditSubmit = async (values: {
    name: string;
    description: string;
    accentColor: string;
    isPrivate: boolean;
  }) => {
    setSaving(true);
    try {
      await updateCollection(collectionId, {
        name: values.name,
        description: values.description || null,
        accentColor: values.accentColor,
        isPrivate: values.isPrivate,
      });
      qc.invalidateQueries({ queryKey: ["collection_detail", collectionId] });
      qc.invalidateQueries({ queryKey: ["library_collections"] });
      toast({ title: "Collection updated" });
      setEditOpen(false);
    } catch (e: any) {
      toast({
        title: "Couldn't save",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteCollection(collectionId);
      qc.invalidateQueries({ queryKey: ["library_collections"] });
      toast({ title: "Collection deleted" });
      navigate("/library");
    } catch (e: any) {
      toast({
        title: "Couldn't delete",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setDeleteOpen(false);
    }
  };

  // Move-to-collection: list all owner collections except this one.
  const moveCollectionsQuery = useQuery({
    queryKey: ["library_collections_for_move", profile?.id],
    queryFn: () =>
      getCollections({ userId: profile!.id, viewerId: profile!.id, limit: 50 }),
    enabled: !!moveTarget && !!profile?.id,
  });

  const handleMoveTo = async (targetCollectionId: string) => {
    if (!moveTarget) return;
    try {
      await saveToCollection(targetCollectionId, moveTarget.kind, moveTarget.itemId);
      await removeFromCollection(collectionId, moveTarget.kind, moveTarget.itemId);
      qc.invalidateQueries({ queryKey: ["collection_detail"] });
      qc.invalidateQueries({ queryKey: ["library_collections"] });
      qc.invalidateQueries({ queryKey: ["library_all_items"] });
      toast({ title: "Moved" });
    } catch (e: any) {
      toast({
        title: "Couldn't move",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setMoveTarget(null);
    }
  };

  // Loading / error states
  if (detailQuery.isLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
        Loading collection…
      </div>
    );
  }

  if (detailQuery.error || !detailQuery.data) {
    const msg = (detailQuery.error as any)?.message || "";
    const isPrivate = msg.toLowerCase().includes("private");
    return (
      <div
        style={{
          padding: 64,
          textAlign: "center",
          color: "rgba(255,255,255,0.6)",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 24,
            color: "rgba(255,255,255,0.95)",
            marginBottom: 8,
          }}
        >
          {isPrivate ? "This collection is private" : "Collection not found"}
        </h1>
        <p style={{ fontSize: 13 }}>
          {isPrivate
            ? "You don't have permission to view it."
            : "It may have been deleted or the link is broken."}
        </p>
        <Button variant="outline" onClick={() => navigate("/library")} className="mt-4">
          Back to Library
        </Button>
      </div>
    );
  }

  const { collection, items, isOwnCollection } = detailQuery.data;
  const detailItems: DetailItem[] = items.map(toDetailItem);

  return (
    <>
      <SeoHead
        title={`${collection.name} — Library`}
        description={collection.description ?? `Collection on NeoScale AI`}
        path={`/library/collections/${collection.id}`}
        noIndex={collection.isPrivate}
      />
      <CollectionDetailPage
        collection={{
          id: collection.id,
          name: collection.name,
          description: collection.description,
          accentColor: collection.accentColor,
          isPrivate: collection.isPrivate,
          itemCount: collection.itemCount,
          createdAt: collection.createdAt,
          updatedAt: collection.updatedAt,
        }}
        items={detailItems}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        sort={sort}
        onSortChange={setSort}
        onBack={() => navigate("/library")}
        onAddItem={() => setPickerOpen(true)}
        onEdit={() => setEditOpen(true)}
        onShare={handleShare}
        onDelete={() => setDeleteOpen(true)}
        onItemClick={(it) => {
          const src = items.find((x) => x.collectionItemId === it.id);
          if (src) navigate(deepLinkForItem(src));
        }}
        onItemRemove={handleRemove}
        onItemReorder={handleReorder}
        onItemMove={(it) => setMoveTarget(it)}
        onItemOpenNewTab={(it) => {
          const src = items.find((x) => x.collectionItemId === it.id);
          if (src) window.open(deepLinkForItem(src), "_blank", "noopener,noreferrer");
        }}
        isOwnCollection={isOwnCollection}
      />

      <CollectionFormModal
        open={editOpen}
        mode="edit"
        initial={{
          name: collection.name,
          description: collection.description ?? "",
          accentColor: collection.accentColor,
          isPrivate: collection.isPrivate,
        }}
        saving={saving}
        onSubmit={handleEditSubmit}
        onClose={() => setEditOpen(false)}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this collection?</AlertDialogTitle>
            <AlertDialogDescription>
              "{collection.name}" and its {collection.itemCount} item
              {collection.itemCount === 1 ? "" : "s"} will be removed from your
              library. The original blueprints, blogs, and blocks aren't deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReferencePickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        activeType={pickerType}
        onTypeChange={setPickerType}
        query={pickerQuery}
        onQueryChange={setPickerQuery}
        results={pickerResults}
        onSelect={handleAddSelect}
        counts={counts.data ?? { blueprints: "0", stages: "0", blocks: "0" }}
        isLoading={pickerLoading}
      />

      {/* Move-to dialog */}
      <Dialog open={!!moveTarget} onOpenChange={(o) => !o && setMoveTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move to another collection</DialogTitle>
            <DialogDescription>
              Pick a destination. The item will be removed from this collection.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-auto -mx-2 px-2 space-y-1">
            {(moveCollectionsQuery.data?.collections ?? [])
              .filter((c) => c.id !== collectionId)
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleMoveTo(c.id)}
                  className="w-full text-left flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: c.accentColor,
                    }}
                  />
                  <span className="flex-1">{c.isDefault ? "Saved items" : c.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {c.itemCount}
                  </span>
                </button>
              ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoveTarget(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Helper: resolve owner handle for share URL.
async function getOwnerHandle(ownerId: string): Promise<string | null> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", ownerId)
    .maybeSingle();
  return (data as any)?.username ?? null;
}
