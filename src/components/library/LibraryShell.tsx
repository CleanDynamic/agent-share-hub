import * as React from "react";
import {
  FolderOpen,
  Bookmark,
  BookmarkPlus,
  ChevronDown,
  Search,
  X,
} from "lucide-react";
import { CollectionCard, type CollectionMenuAction } from "./CollectionCard";
import type { CollectionPreview, SavedItem } from "@/lib/library/types";

export type ViewMode = "collections" | "all";
export type TypeFilter =
  | "all"
  | "blueprints"
  | "blogs"
  | "bounties"
  | "stages"
  | "blocks";
export type SortOption =
  | "recent"
  | "most-items"
  | "a-z"
  | "recently-saved"
  | "recently-updated";

interface LibraryShellProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  collections: CollectionPreview[];
  savedItems: SavedItem[];
  query: string;
  onQueryChange: (q: string) => void;
  typeFilter: TypeFilter;
  onTypeFilterChange: (f: TypeFilter) => void;
  sort: SortOption;
  onSortChange: (s: SortOption) => void;
  onCreateCollection: () => void;
  onCollectionClick: (id: string) => void;
  onCollectionMenuAction: (id: string, action: CollectionMenuAction) => void;
  onSavedItemClick: (item: SavedItem) => void;
  onSavedItemRemove: (item: SavedItem) => void;
  counts: { collections: number; allItems: number };
  isOwnLibrary: boolean;
  pageTitle?: string;
  pageSubtitle?: string;
}

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "blueprints", label: "Blueprints" },
  { value: "blogs", label: "Blogs" },
  { value: "bounties", label: "Bounties" },
  { value: "stages", label: "Stages" },
  { value: "blocks", label: "Blocks" },
];

const SORT_COLLECTIONS: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Recently updated" },
  { value: "most-items", label: "Most items" },
  { value: "a-z", label: "A-Z" },
];

const SORT_ALL: { value: SortOption; label: string }[] = [
  { value: "recently-saved", label: "Recently saved" },
  { value: "recently-updated", label: "Recently updated by author" },
  { value: "a-z", label: "A-Z" },
];

const TYPE_COLORS: Record<string, string> = {
  blueprint: "#3B82F6",
  blog: "#8B5CF6",
  bounty: "#10B981",
  stage: "#F59E0B",
  block: "#EC4899",
};

export function LibraryShell({
  activeView,
  onViewChange,
  collections,
  savedItems,
  query,
  onQueryChange,
  typeFilter,
  onTypeFilterChange,
  sort,
  onSortChange,
  onCreateCollection,
  onCollectionClick,
  onCollectionMenuAction,
  onSavedItemClick,
  onSavedItemRemove,
  counts,
  isOwnLibrary,
  pageTitle = "Library",
  pageSubtitle = "Your saved blueprints, blogs, stages, and blocks",
}: LibraryShellProps) {
  const hasCollections =
    collections.length > 1 ||
    (collections.length === 1 && collections[0].itemCount > 0);
  const hasSavedItems = savedItems.length > 0;

  const sortOptions = activeView === "collections" ? SORT_COLLECTIONS : SORT_ALL;

  return (
    <div style={{ padding: "28px 24px 40px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div />

        {isOwnLibrary && (
          <button
            onClick={onCreateCollection}
            style={{
              background: "rgba(232, 87, 26, 0.15)",
              border: "1px solid rgba(232, 87, 26, 0.4)",
              color: "#E8571A",
              borderRadius: 8,
              padding: "8px 14px",
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            + New collection
          </button>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 16,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <TabButton
          icon={<FolderOpen size={14} />}
          label="Collections"
          count={counts.collections}
          isActive={activeView === "collections"}
          onClick={() => onViewChange("collections")}
        />
        <TabButton
          icon={<Bookmark size={14} />}
          label="All saved items"
          count={counts.allItems}
          isActive={activeView === "all"}
          onClick={() => onViewChange("all")}
        />
      </div>

      {/* Filter strip — collections */}
      {activeView === "collections" && hasCollections && (
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "rgba(255,255,255,0.4)",
              }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search collections…"
              style={{
                width: "100%",
                height: 32,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                padding: "0 28px 0 32px",
                fontFamily: "Inter, sans-serif",
                fontSize: 12,
                color: "rgba(255,255,255,0.9)",
                outline: "none",
              }}
            />
            {query && (
              <button
                onClick={() => onQueryChange("")}
                style={{
                  position: "absolute",
                  right: 6,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                  padding: 2,
                  display: "flex",
                }}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <SortDropdown value={sort} options={sortOptions} onChange={onSortChange} />
        </div>
      )}

      {/* Filter strip — all items */}
      {activeView === "all" && hasSavedItems && (
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginBottom: 16,
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 11,
                color: "rgba(255,255,255,0.45)",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginRight: 4,
              }}
            >
              Type:
            </span>
            {TYPE_FILTERS.map((f) => {
              const active = typeFilter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => onTypeFilterChange(f.value)}
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 11,
                    fontWeight: 500,
                    padding: "4px 10px",
                    borderRadius: 12,
                    border: "none",
                    cursor: "pointer",
                    background: active ? "rgba(232, 87, 26, 0.2)" : "rgba(255,255,255,0.05)",
                    color: active ? "#E8571A" : "rgba(255,255,255,0.6)",
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          <SortDropdown value={sort} options={sortOptions} onChange={onSortChange} />
        </div>
      )}

      {/* Main content */}
      <div>
        {activeView === "collections" ? (
          hasCollections ? (
            <CollectionsGrid
              collections={collections}
              onCollectionClick={onCollectionClick}
              onMenuAction={onCollectionMenuAction}
              showMenu={isOwnLibrary}
            />
          ) : (
            <EmptyState
              icon={<BookmarkPlus size={28} />}
              title="Build your library"
              description="Save blueprints, stages, and blocks you find via the share-to menu, or create your first collection."
              ctaLabel="+ Create your first collection"
              onCtaClick={onCreateCollection}
              showCta={isOwnLibrary}
            />
          )
        ) : hasSavedItems ? (
          <SavedItemsList
            items={savedItems}
            onItemClick={onSavedItemClick}
            onItemRemove={onSavedItemRemove}
            isOwnLibrary={isOwnLibrary}
          />
        ) : (
          <EmptyState
            icon={<Bookmark size={28} />}
            title="Nothing saved yet"
            description="Items you save will appear here. Use the share-to menu on any blueprint, stage, or block to add it to your library."
            showCta={false}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({
  icon,
  label,
  count,
  isActive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)",
        fontFamily: "Inter, sans-serif",
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      <span style={{ display: "inline-flex" }}>{icon}</span>
      <span>{label}</span>
      <span
        style={{
          fontSize: 10,
          padding: "2px 6px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.6)",
        }}
      >
        {count}
      </span>
      {isActive && (
        <span
          style={{
            position: "absolute",
            bottom: -1,
            left: 8,
            right: 8,
            height: 2,
            background: "#E8571A",
            borderRadius: 2,
          }}
        />
      )}
    </button>
  );
}

function SortDropdown({
  value,
  options,
  onChange,
}: {
  value: SortOption;
  options: { value: SortOption; label: string }[];
  onChange: (v: SortOption) => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        style={{
          appearance: "none",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 6,
          padding: "6px 28px 6px 10px",
          fontFamily: "Inter, sans-serif",
          fontSize: 12,
          color: "rgba(255,255,255,0.7)",
          cursor: "pointer",
          outline: "none",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: "#0F0F14", color: "#fff" }}>
            Sort: {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          color: "rgba(255,255,255,0.5)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function CollectionsGrid({
  collections,
  onCollectionClick,
  onMenuAction,
  showMenu,
}: {
  collections: CollectionPreview[];
  onCollectionClick: (id: string) => void;
  onMenuAction: (id: string, action: CollectionMenuAction) => void;
  showMenu: boolean;
}) {
  const sorted = [...collections].sort((a, b) => {
    if (a.isDefault) return -1;
    if (b.isDefault) return 1;
    return 0;
  });

  return (
    <>
      <style>{`
        .ns-collections-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 720px) {
          .ns-collections-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .ns-collections-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div className="ns-collections-grid">
        {sorted.map((c) => (
          <CollectionCard
            key={c.id}
            collection={{
              id: c.id,
              name: c.isDefault ? "Saved items" : c.name,
              accentColor: c.accentColor,
              isPrivate: c.isPrivate,
              isDefault: c.isDefault,
              itemCount: c.itemCount,
              lastUpdatedAt: c.lastUpdatedAt,
              coverItems: (c.coverItems ?? []).map((ci: any) => ({
                kind: ci.kind,
                coverUrl: ci.cover_image_url,
              })),
            }}
            showMenu={showMenu && !c.isDefault}
            onClick={() => onCollectionClick(c.id)}
            onMenuAction={(action) => onMenuAction(c.id, action)}
          />
        ))}
      </div>
    </>
  );
}

function SavedItemsList({
  items,
  onItemClick,
  onItemRemove,
  isOwnLibrary,
}: {
  items: SavedItem[];
  onItemClick: (item: SavedItem) => void;
  onItemRemove: (item: SavedItem) => void;
  isOwnLibrary: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item) => (
        <SavedItemCard
          key={item.collectionItemId}
          item={item}
          onClick={() => onItemClick(item)}
          onRemove={() => onItemRemove(item)}
          isOwnLibrary={isOwnLibrary}
        />
      ))}
    </div>
  );
}

function SavedItemCard({
  item,
  onClick,
  onRemove,
  isOwnLibrary,
}: {
  item: SavedItem;
  onClick: () => void;
  onRemove: () => void;
  isOwnLibrary: boolean;
}) {
  const color = TYPE_COLORS[item.kind] || "#94A3B8";
  return (
    <div
      className="group"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)";
        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 8,
          background: `${color}22`,
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, sans-serif",
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          flexShrink: 0,
        }}
      >
        {item.kind.slice(0, 3)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            fontWeight: 500,
            color: "rgba(255,255,255,0.92)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.title || "Untitled"}
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginTop: 3,
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          {item.inCollections.map((c) => (
            <span
              key={c.id}
              style={{
                padding: "2px 6px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.05)",
              }}
            >
              in {c.name}
            </span>
          ))}
        </div>
      </div>
      {isOwnLibrary && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-0 group-hover:opacity-100"
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "none",
            borderRadius: 6,
            padding: "6px 10px",
            cursor: "pointer",
            color: "rgba(255,255,255,0.85)",
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            transition: "opacity 0.15s, background 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.1)";
          }}
        >
          <X size={12} />
          Remove
        </button>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  ctaLabel,
  onCtaClick,
  showCta = true,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  showCta?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "64px 24px",
        color: "rgba(255,255,255,0.55)",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: "rgba(255, 255, 255, 0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.4)",
          marginBottom: 14,
        }}
      >
        {icon}
      </div>
      <h2
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 20,
          color: "rgba(255,255,255,0.92)",
          margin: 0,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 13,
          margin: "8px 0 0",
          maxWidth: 420,
        }}
      >
        {description}
      </p>
      {showCta && ctaLabel && onCtaClick && (
        <button
          onClick={onCtaClick}
          style={{
            marginTop: 20,
            background: "rgba(232, 87, 26, 0.15)",
            border: "1px solid rgba(232, 87, 26, 0.4)",
            color: "#E8571A",
            borderRadius: 8,
            padding: "8px 14px",
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
