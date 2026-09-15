import * as React from "react";
import {
  FolderOpen,
  Bookmark,
  BookmarkPlus,
  ChevronDown,
  Search,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CollectionCard, type CollectionMenuAction } from "./CollectionCard";
import type { CollectionPreview, SavedItem } from "@/lib/library/types";
import { categoryFill } from "@/lib/theme/category";
import { buttonStyle, chipStyle, chipType, fieldStyle, uiTransition } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { body, data as dataText, tabular, type } from "@/lib/theme/type";

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
  /**
   * The collections or items are still in flight.
   *
   * IT MATTERS THAT THIS EXISTS. Without it the page had two states, not
   * three: a library that had not arrived yet rendered the EMPTY state, so
   * every visit began by telling the reader they had saved nothing and
   * inviting them to start — and then replaced that with their forty saved
   * items. Saying "you have nothing" to somebody who has something is worse
   * than saying nothing at all.
   */
  isLoading?: boolean;
  pageTitle?: string;
  pageSubtitle?: string;
  hideHeader?: boolean;
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

/**
 * A saved item's kind, as one of the nine part categories.
 *
 * It was five private hexes — a sixth palette, disagreeing with the badges on
 * the same rows about what colour a blueprint is. `categoryFill` returns the
 * measured background/ink pair for each, and a kind this table does not carry
 * lands on the measured fallback rather than on an invented slate.
 */
const KIND_CATEGORY: Record<string, string> = {
  blueprint: "configuration",
  blog: "narrative",
  bounty: "breakage",
  stage: "narrative",
  block: "instruction",
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
  isLoading = false,
  pageTitle = "Library",
  pageSubtitle = "Your saved blueprints, blogs, stages, and blocks",
  hideHeader = false,
}: LibraryShellProps) {
  const hasCollections =
    collections.length > 1 ||
    (collections.length === 1 && collections[0].itemCount > 0);
  const hasSavedItems = savedItems.length > 0;

  const sortOptions = activeView === "collections" ? SORT_COLLECTIONS : SORT_ALL;

  return (
    <div style={{ padding: "0 24px 40px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header (suppressed when the page renders a ShellHeader above) */}
      {!hideHeader && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 20,
              paddingTop: 28,
            }}
          >
            <div />
            {isOwnLibrary && (
              <button
                onClick={onCreateCollection}
                /* The one primary on the library: making a collection is what
                   this page is for, and nothing else here is filled. */
                style={{
                  ...buttonStyle("default"),
                  padding: "8px 14px",
                  ...body,
                  fontSize: 13,
                  fontWeight: 500,
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
              borderBottom: `1px solid ${t.line}`,
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
        </>
      )}

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
                color: t.text2,
              }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search collections…"
              /* The kit's field: an inset `--recess` well with a `--line`
                 hairline at `--r-control`. A field sits IN the page; a button
                 sits on it. */
              style={{
                width: "100%",
                height: 32,
                ...fieldStyle(),
                padding: "0 28px 0 32px",
                ...body,
                fontSize: 12,
                color: t.text,
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
                  color: t.text2,
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
                ...chipType,
                fontSize: 11,
                color: t.text2,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginRight: 4,
              }}
            >
              Type:
            </span>
            {TYPE_FILTERS.map((f) => (
              <FilterChip
                key={f.value}
                label={f.label}
                selected={typeFilter === f.value}
                onSelect={() => onTypeFilterChange(f.value)}
              />
            ))}
          </div>
          <SortDropdown value={sort} options={sortOptions} onChange={onSortChange} />
        </div>
      )}

      {/* Main content */}
      <div>
        {isLoading ? (
          <LoadingState view={activeView} />
        ) : activeView === "collections" ? (
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

/**
 * The library, before it has arrived.
 *
 * The real geometry of whichever view is current — the three-up collection
 * grid at the card's 16:10 proportion, or the 60px rows of the saved list — so
 * nothing jumps when the data lands. The kit's `Skeleton` paints them, which
 * means one sweep rather than a pulse, and no movement at all under
 * `prefers-reduced-motion`.
 */
function LoadingState({ view }: { view: ViewMode }) {
  if (view === "collections") {
    return (
      <div className="ns-collections-grid" role="status" aria-label="Loading collections">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Skeleton style={{ aspectRatio: "16 / 10", borderRadius: r.card }} />
            <Skeleton style={{ height: 14, width: "70%", borderRadius: r.chip }} />
            <Skeleton style={{ height: 11, width: "45%", borderRadius: r.chip }} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
      role="status"
      aria-label="Loading saved items"
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} style={{ height: 60, borderRadius: r.control }} />
      ))}
    </div>
  );
}

/** One type filter, on the kit's chip. Selection is a border and ink. */
function FilterChip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      {...handlers}
      style={{
        padding: "4px 10px",
        ...chipStyle("outline", { selectable: true, ...state }),
        fontSize: 11,
        ...(selected ? { borderColor: t.action, color: t.text } : {}),
      }}
    >
      {label}
    </button>
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
        color: isActive ? t.text : t.text2,
        ...body,
        fontSize: 13,
        fontWeight: 500,
        transition: uiTransition(),
      }}
    >
      <span style={{ display: "inline-flex" }}>{icon}</span>
      <span>{label}</span>
      <span
        style={{
          ...chipType,
          ...tabular,
          fontSize: 10,
          padding: "2px 6px",
          borderRadius: r.chip,
          background: t.recess,
          color: t.text2,
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
            background: t.action,
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
          ...fieldStyle(),
          padding: "6px 28px 6px 10px",
          ...body,
          fontSize: 12,
          color: t.text2,
          cursor: "pointer",
        }}
      >
        {/* The native option list is painted by the OS, so it takes the two
            tokens directly rather than a hex that only worked in one room. */}
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: t.bg, color: t.text }}>
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
          color: t.text2,
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
  const kind = categoryFill(KIND_CATEGORY[item.kind] ?? "");
  return (
    <div
      className="group"
      onClick={onClick}
      /* A LIST ROW, not a card: transparent at rest with a `--line` hairline,
         and `--recess` under the pointer at `--r-control`. A row that is a
         filled box at rest cannot get louder on hover, which is why a list of
         forty of them read as forty cards rather than as one list. */
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        background: "transparent",
        border: `1px solid ${t.line}`,
        borderRadius: r.control,
        cursor: "pointer",
        transition: uiTransition(),
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = t.recess;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: r.chip,
          /* Both halves of the measured pair, or neither. */
          backgroundColor: kind.background,
          color: kind.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...chipType,
          fontSize: 10,
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
            ...body,
            fontSize: 13,
            fontWeight: 500,
            color: t.text,
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
            ...chipType,
            fontSize: 11,
            color: t.text2,
          }}
        >
          {item.inCollections.map((c) => (
            <span
              key={c.id}
              style={{
                padding: "2px 6px",
                borderRadius: r.chip,
                background: t.recess,
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
          /* Removing something is destructive, so hover says so in breakage
             red rather than in a generic lift. */
          style={{
            ...buttonStyle("secondary"),
            padding: "6px 10px",
            color: t.text2,
            ...body,
            fontSize: 11,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = t.catBreakage;
            e.currentTarget.style.borderColor = t.catBreakage;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = t.text2;
            e.currentTarget.style.borderColor = t.line;
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
        color: t.text2,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: r.card,
          background: t.recess,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: t.text2,
          marginBottom: 14,
        }}
      >
        {icon}
      </div>
      <h2
        style={{
          ...type.cardTitle,
          color: t.text,
          margin: 0,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          ...body,
          fontSize: 13,
          color: t.text2,
          margin: "8px 0 0",
          maxWidth: 420,
          textWrap: "pretty",
        }}
      >
        {description}
      </p>
      {showCta && ctaLabel && onCtaClick && (
        <button
          onClick={onCtaClick}
          /* An empty view's one way out earns the primary: there is nothing
             on the screen for it to compete with. */
          style={{
            marginTop: 20,
            ...buttonStyle("default"),
            padding: "8px 14px",
            ...body,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
