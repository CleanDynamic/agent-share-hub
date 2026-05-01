// Shared types for the library/collections data layer.

export type CollectionItemKind = "blueprint" | "blog" | "bounty" | "stage" | "block";

export interface CollectionRow {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  accent_color: string;
  is_default: boolean;
  is_public: boolean;
  visibility: string | null;
  slug: string | null;
  follower_count: number;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface Collection {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  accentColor: string;
  isPrivate: boolean;
  isDefault: boolean;
  itemCount: number;
  followerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionItemRow {
  id: string;
  collection_id: string;
  content_id: string | null;
  item_kind: CollectionItemKind | null;
  item_id: string | null;
  position: number;
  note: string | null;
  added_by: string;
  added_at: string;
  cached_meta: Record<string, any> | null;
}

export interface CoverItem {
  kind: CollectionItemKind;
  id: string;
  title: string | null;
  cover_image_url: string | null;
}

export interface CollectionPreview {
  id: string;
  name: string;
  accentColor: string;
  isPrivate: boolean;
  isDefault: boolean;
  itemCount: number;
  lastUpdatedAt: string;
  coverItems: CoverItem[];
}

export interface SavedItem {
  collectionItemId: string;
  kind: CollectionItemKind;
  id: string;
  title: string | null;
  slug: string | null;
  cover_image_url: string | null;
  author: {
    id: string | null;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  stats: {
    avgRating: number;
    viewCount: number;
    commentCount: number;
  } | null;
  addedAt: string;
  position: number;
  // Collections (id + name) this item belongs to for the current viewer.
  inCollections: { id: string; name: string }[];
  cached_meta: Record<string, any> | null;
}

export type CollectionSort = "recent" | "alphabetical" | "items";
export type SavedItemSort = "recent" | "oldest" | "alphabetical";

export function rowToCollection(r: CollectionRow): Collection {
  return {
    id: r.id,
    ownerId: r.owner_id,
    name: r.title,
    description: r.description,
    accentColor: r.accent_color,
    isPrivate: !r.is_public,
    isDefault: r.is_default,
    itemCount: r.item_count,
    followerCount: r.follower_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
