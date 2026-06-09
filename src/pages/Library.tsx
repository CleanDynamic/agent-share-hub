import * as React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { ShellHeader } from "@/components/shell/ShellHeader";
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
import { useToast } from "@/hooks/use-toast";
import {
  LibraryShell,
  type SortOption,
  type TypeFilter,
  type ViewMode,
} from "@/components/library/LibraryShell";
import {
  CollectionFormModal,
  type CollectionFormValues,
} from "@/components/library/CollectionFormModal";
import {
  getCollections,
  getAllSavedItems,
  createCollection,
  updateCollection,
  saveToCollection,
  removeFromCollection,
} from "@/lib/library";
import type {
  CollectionItemKind,
  CollectionPreview,
  SavedItem,
} from "@/lib/library/types";
import type { CollectionMenuAction } from "@/components/library/CollectionCard";

function deleteCollectionFn(id: string) {
  return import("@/lib/library/updateCollection").then((m) =>
    m.deleteCollection(id)
  );
}

const TYPE_TO_KIND: Record<TypeFilter, CollectionItemKind | "all"> = {
  all: "all",
  blueprints: "blueprint",
  blogs: "blog",
  bounties: "bounty",
  stages: "stage",
  blocks: "block",
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

export default function LibraryPage() {
  const navigate = useNavigate();
  const params = useParams<{ handle?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Resolve target user (own library vs visitor view).
  const visitorHandle = params.handle;
  const ownerQuery = useQuery({
    queryKey: ["library_owner", visitorHandle ?? "self", profile?.id],
    queryFn: async () => {
      if (!visitorHandle) {
        return profile
          ? {
              id: profile.id,
              username: (profile as any).username ?? null,
              display_name: (profile as any).display_name ?? null,
            }
          : null;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .eq("username", visitorHandle)
        .maybeSingle();
      return data as any;
    },
    enabled: visitorHandle ? true : !!profile?.id,
  });

  const owner = ownerQuery.data;
  const isOwnLibrary = !!owner && !!profile && owner.id === profile.id;

  // URL state
  const view: ViewMode =
    searchParams.get("view") === "all" ? "all" : "collections";
  const typeFilter = (searchParams.get("type") as TypeFilter) || "all";
  const sort = (searchParams.get("sort") as SortOption) ||
    (view === "collections" ? "recent" : "recently-saved");
  const queryParam = searchParams.get("q") || "";

  // Live search debounce (200ms)
  const [searchInput, setSearchInput] = React.useState(queryParam);
  React.useEffect(() => setSearchInput(queryParam), [queryParam]);
  const debounceRef = React.useRef<number | null>(null);
  const handleQueryChange = (q: string) => {
    setSearchInput(q);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (q) next.set("q", q);
      else next.delete("q");
      setSearchParams(next, { replace: true });
    }, 200);
  };

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  // Data: collections
  const collectionsQuery = useQuery({
    queryKey: [
      "library_collections",
      owner?.id,
      profile?.id,
      view === "collections" ? queryParam : "",
      view === "collections" ? sort : "recent",
    ],
    queryFn: async () => {
      if (!owner) return { collections: [], total: 0 };
      const sortMap: Record<string, "recent" | "alphabetical" | "items"> = {
        recent: "recent",
        "most-items": "items",
        "a-z": "alphabetical",
      };
      return getCollections({
        userId: owner.id,
        viewerId: profile?.id ?? null,
        query: view === "collections" ? queryParam : undefined,
        sort: sortMap[sort] ?? "recent",
        limit: 50,
      });
    },
    enabled: !!owner,
  });

  // Data: all saved items (own library only)
  const savedItemsQuery = useQuery({
    queryKey: ["library_all_items", owner?.id, typeFilter, sort],
    queryFn: async () => {
      if (!owner) return { items: [], total: 0 };
      const sortMap: Record<string, "recent" | "oldest" | "alphabetical"> = {
        "recently-saved": "recent",
        "recently-updated": "recent",
        "a-z": "alphabetical",
      };
      return getAllSavedItems({
        userId: owner.id,
        typeFilter: TYPE_TO_KIND[typeFilter],
        sort: sortMap[sort] ?? "recent",
        limit: 50,
      });
    },
    enabled: !!owner && isOwnLibrary,
  });

  const collections: CollectionPreview[] = collectionsQuery.data?.collections ?? [];
  const savedItems: SavedItem[] = savedItemsQuery.data?.items ?? [];

  // Modal state
  const [modal, setModal] = React.useState<
    | { mode: "create" }
    | { mode: "edit"; collection: CollectionPreview }
    | null
  >(null);
  const [saving, setSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<CollectionPreview | null>(
    null
  );

  const handleSubmit = async (values: CollectionFormValues) => {
    if (!profile) return;
    setSaving(true);
    try {
      if (modal?.mode === "create") {
        await createCollection({
          ownerId: profile.id,
          name: values.name,
          description: values.description || null,
          accentColor: values.accentColor,
          isPrivate: values.isPrivate,
        });
        toast({ title: `Collection "${values.name}" created` });
      } else if (modal?.mode === "edit") {
        await updateCollection(modal.collection.id, {
          name: values.name,
          description: values.description || null,
          accentColor: values.accentColor,
          isPrivate: values.isPrivate,
        });
        toast({ title: "Collection updated" });
      }
      qc.invalidateQueries({ queryKey: ["library_collections"] });
      setModal(null);
    } catch (e: any) {
      toast({
        title: "Couldn't save collection",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleMenuAction = async (
    id: string,
    action: CollectionMenuAction
  ) => {
    const c = collections.find((x) => x.id === id);
    if (!c) return;
    if (action === "edit") {
      setModal({ mode: "edit", collection: c });
      return;
    }
    if (action === "toggle-privacy") {
      try {
        await updateCollection(id, { isPrivate: !c.isPrivate });
        qc.invalidateQueries({ queryKey: ["library_collections"] });
        toast({
          title: `Collection is now ${c.isPrivate ? "public" : "private"}`,
        });
      } catch (e: any) {
        toast({
          title: "Couldn't update privacy",
          description: e?.message,
          variant: "destructive",
        });
      }
      return;
    }
    if (action === "duplicate") {
      if (!profile) return;
      try {
        const copy = await createCollection({
          ownerId: profile.id,
          name: `${c.name} (copy)`,
          accentColor: c.accentColor,
          isPrivate: c.isPrivate,
        });
        // Copy items (look them up from raw rows)
        const { data: items } = await supabase
          .from("collection_items")
          .select("item_kind, item_id, content_id")
          .eq("collection_id", id);
        for (const it of (items ?? []) as any[]) {
          const kind = (it.item_kind ?? "blueprint") as CollectionItemKind;
          const itemId = it.item_id ?? it.content_id;
          if (!itemId) continue;
          try {
            await saveToCollection(copy.id, kind, itemId);
          } catch {
            /* swallow per-item errors */
          }
        }
        qc.invalidateQueries({ queryKey: ["library_collections"] });
        toast({ title: `Duplicated to "${copy.name}"` });
      } catch (e: any) {
        toast({
          title: "Couldn't duplicate",
          description: e?.message,
          variant: "destructive",
        });
      }
      return;
    }
    if (action === "delete") {
      if (c.isDefault) {
        toast({
          title: "Can't delete the default Saved items collection",
          variant: "destructive",
        });
        return;
      }
      setDeleteTarget(c);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCollectionFn(deleteTarget.id);
      qc.invalidateQueries({ queryKey: ["library_collections"] });
      toast({ title: `"${deleteTarget.name}" deleted` });
    } catch (e: any) {
      toast({
        title: "Couldn't delete",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleSavedItemRemove = async (item: SavedItem) => {
    try {
      // Remove from ALL collections containing this item (the "all items" view).
      for (const c of item.inCollections) {
        await removeFromCollection(c.id, item.kind, item.id);
      }
      qc.invalidateQueries({ queryKey: ["library_all_items"] });
      qc.invalidateQueries({ queryKey: ["library_collections"] });
      toast({ title: "Removed from library" });
    } catch (e: any) {
      toast({
        title: "Couldn't remove",
        description: e?.message,
        variant: "destructive",
      });
    }
  };

  const counts = {
    collections: collectionsQuery.data?.total ?? collections.length,
    allItems: savedItemsQuery.data?.total ?? savedItems.length,
  };

  const ownerLabel =
    owner?.display_name || owner?.username || (visitorHandle ?? "");
  const pageTitle = isOwnLibrary
    ? "Library"
    : ownerLabel
      ? `${ownerLabel}'s Library`
      : "Library";

  return (
    <>
      <SeoHead
        title={`${pageTitle} — NeoScale AI`}
        description="Saved collections of blueprints, blogs, stages, and blocks."
        path={visitorHandle ? `/library/${visitorHandle}` : "/library"}
        noIndex
      />
      <ShellHeader
        onBack={() => navigate(-1)}
        primaryAction={
          isOwnLibrary
            ? { label: "New collection", icon: Plus, onClick: () => setModal({ mode: "create" }) }
            : undefined
        }
        tabs={[
          { id: "collections", label: "Collections", count: counts.collections },
          { id: "all", label: "All saved items", count: counts.allItems },
        ]}
        activeTab={view}
        onTabChange={(id) => updateParam("view", id === "all" ? "all" : null)}
      />
      <LibraryShell
        activeView={view}
        onViewChange={(v) => updateParam("view", v === "all" ? "all" : null)}
        collections={collections}
        savedItems={savedItems}
        query={searchInput}
        onQueryChange={handleQueryChange}
        typeFilter={typeFilter}
        onTypeFilterChange={(f) => updateParam("type", f === "all" ? null : f)}
        sort={sort}
        onSortChange={(s) => updateParam("sort", s)}
        onCreateCollection={() => setModal({ mode: "create" })}
        onCollectionClick={(id) => navigate(`/library/collections/${id}`)}
        onCollectionMenuAction={handleMenuAction}
        onSavedItemClick={(item) => navigate(deepLinkForItem(item))}
        onSavedItemRemove={handleSavedItemRemove}
        counts={counts}
        isOwnLibrary={isOwnLibrary}
        pageTitle={pageTitle}
        pageSubtitle={
          isOwnLibrary
            ? "Your saved blueprints, blogs, stages, and blocks"
            : `Public collections by ${ownerLabel}`
        }
      />

      <CollectionFormModal
        open={!!modal}
        mode={modal?.mode ?? "create"}
        initial={
          modal?.mode === "edit"
            ? {
                name: modal.collection.name,
                accentColor: modal.collection.accentColor,
                isPrivate: modal.collection.isPrivate,
              }
            : undefined
        }
        saving={saving}
        onSubmit={handleSubmit}
        onClose={() => setModal(null)}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this collection?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" and its {deleteTarget?.itemCount ?? 0} item
              {deleteTarget?.itemCount === 1 ? "" : "s"} will be removed from
              your library. The original blueprints, blogs, and blocks aren't
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
