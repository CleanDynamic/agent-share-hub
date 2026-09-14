import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  MoreHorizontal,
  Lock,
  Globe,
  GripVertical,
  X,
  FolderOpen,
  ChevronDown,
  Share2,
  ExternalLink,
  FolderInput,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { type } from "@/lib/theme/type";
import { categoryFill } from "@/lib/theme/category";
import { buttonStyle, chipStyle, chipType, fieldStyle, uiTransition } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { body, data as dataText, measure, tabular } from "@/lib/theme/type";

export type ItemKind = "blueprint" | "blog" | "bounty" | "stage" | "block";

export interface DetailCollection {
  id: string;
  name: string;
  description?: string | null;
  accentColor: string;
  isPrivate: boolean;
  itemCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface DetailItem {
  id: string; // collection_items.id (used for dnd)
  itemId: string; // underlying content/stage/block id
  kind: ItemKind;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
}

export type TypeFilter = "all" | ItemKind;
export type SortOption = "recently-added" | "a-z" | "by-type";

interface CollectionDetailPageProps {
  collection: DetailCollection;
  items: DetailItem[];
  typeFilter: TypeFilter;
  onTypeFilterChange: (f: TypeFilter) => void;
  sort: SortOption;
  onSortChange: (s: SortOption) => void;
  onBack: () => void;
  onAddItem: () => void;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
  onItemClick: (item: DetailItem) => void;
  onItemRemove: (item: DetailItem) => void;
  onItemReorder: (itemIds: string[]) => void;
  onItemMove?: (item: DetailItem) => void;
  onItemOpenNewTab?: (item: DetailItem) => void;
  isOwnCollection: boolean;
}

/**
 * An item's kind, as a label plus one of the nine part categories.
 *
 * The five hues here were a private palette — a sixth in the codebase, and one
 * that disagreed with `LibraryShell`'s about what colour a blueprint is. Both
 * now resolve through `categoryFill`, so a saved item looks the same in the
 * list it came from and in the collection it was added to.
 */
const KIND_STYLES: Record<ItemKind, { label: string; category: string }> = {
  blueprint: { label: "Blueprint", category: "configuration" },
  blog: { label: "Blog", category: "narrative" },
  bounty: { label: "Bounty", category: "breakage" },
  stage: { label: "Stage", category: "narrative" },
  block: { label: "Block", category: "instruction" },
};

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getTypeCounts(items: DetailItem[]): Record<TypeFilter, number> {
  const counts: Record<TypeFilter, number> = {
    all: items.length,
    blueprint: 0,
    blog: 0,
    bounty: 0,
    stage: 0,
    block: 0,
  };
  for (const it of items) counts[it.kind]++;
  return counts;
}

function ItemCard({
  item,
  onClick,
}: {
  item: DetailItem;
  onClick: () => void;
}) {
  const { label, category } = KIND_STYLES[item.kind];
  const kind = categoryFill(category);
  return (
    <button
      onClick={onClick}
      className="text-left w-full"
      style={{
        background: t.glass,
        border: `1px solid ${t.glassBorder}`,
        borderRadius: r.card,
        overflow: "hidden",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        transition: uiTransition(),
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = t.line;
        e.currentTarget.style.background = t.glassHi;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = t.glassBorder;
        e.currentTarget.style.background = t.glass;
      }}
    >
      {item.imageUrl ? (
        <div
          style={{
            width: "100%",
            aspectRatio: "16 / 10",
            background: t.porthole,
            overflow: "hidden",
          }}
        >
          <img
            src={item.imageUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            aspectRatio: "16 / 10",
            /* The measured ground for this kind, flat. */
            backgroundColor: kind.background,
          }}
        />
      )}
      <div style={{ padding: "10px 12px 12px" }}>
        <span
          style={{
            display: "inline-block",
            ...chipType,
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            padding: "2px 6px",
            borderRadius: r.chip,
            /* Both halves of the pair, never one of them on another ground. */
            backgroundColor: kind.background,
            color: kind.color,
            marginBottom: 6,
          }}
        >
          {label}
        </span>
        <div
          style={{
            ...body,
            fontSize: 13,
            fontWeight: 600,
            color: t.text,
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.title || "Untitled"}
        </div>
        {item.description && (
          <div
            style={{
              ...body,
              fontSize: 11,
              color: t.text2,
              marginTop: 4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.description}
          </div>
        )}
      </div>
    </button>
  );
}

function SortableItemCard({
  item,
  onItemClick,
  onItemRemove,
  onItemMove,
  onItemOpenNewTab,
  isOwnCollection,
}: {
  item: DetailItem;
  onItemClick: (item: DetailItem) => void;
  onItemRemove: (item: DetailItem) => void;
  onItemMove?: (item: DetailItem) => void;
  onItemOpenNewTab?: (item: DetailItem) => void;
  isOwnCollection: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style} className="group">
      {isOwnCollection && (
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="opacity-0 group-hover:opacity-100"
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 10,
            /* THE REORDERING AFFORDANCE. It has to read as a grip against
               whatever is behind it — a cover photograph, a tinted well, a
               glass card — in both rooms, so it takes the glass highlight and
               a `--line` hairline rather than a fixed black wash that
               disappeared over a dark image and shouted over a light one. */
            background: t.glassHi,
            border: `1px solid ${t.line}`,
            borderRadius: r.chip,
            padding: 4,
            cursor: "grab",
            color: t.text,
            display: "inline-flex",
            transition: uiTransition(),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={14} />
        </button>
      )}

      <div
        className="opacity-0 group-hover:opacity-100"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 10,
          transition: "opacity 0.15s",
        }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              style={{
                background: t.glassHi,
                border: `1px solid ${t.line}`,
                borderRadius: r.chip,
                padding: 4,
                cursor: "pointer",
                color: t.text,
                display: "inline-flex",
              }}
            >
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onItemOpenNewTab?.(item);
              }}
            >
              <ExternalLink size={14} className="mr-2" />
              Open in new tab
            </DropdownMenuItem>
            {isOwnCollection && (
              <>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onItemMove?.(item);
                  }}
                >
                  <FolderInput size={14} className="mr-2" />
                  Move to another collection
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onItemRemove(item);
                  }}
                  style={{ color: t.catBreakage }}
                >
                  <Trash2 size={14} className="mr-2" />
                  Remove from collection
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ItemCard item={item} onClick={() => onItemClick(item)} />
    </div>
  );
}

function FilterChip({
  label,
  count,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 10px",
        ...chipStyle("outline", { selectable: true }),
        fontSize: 11,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        ...(isActive ? { borderColor: t.action, color: t.text } : {}),
      }}
    >
      <span>{label}</span>
      <span
        style={{
          ...tabular,
          fontSize: 10,
          padding: "1px 5px",
          borderRadius: r.chip,
          background: t.recess,
          color: t.text2,
        }}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyState({ isOwn }: { isOwn: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
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
        <FolderOpen size={26} />
      </div>
      <h2
        style={{
          ...type.cardTitle,
          color: t.text,
          margin: 0,
        }}
      >
        This collection is empty
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
        {isOwn
          ? "Add blueprints, stages, or blocks via the share-to menu, or click + Add item above."
          : "The owner hasn't added anything to this collection yet."}
      </p>
    </div>
  );
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recently-added", label: "Recently added" },
  { value: "a-z", label: "A-Z" },
  { value: "by-type", label: "By type" },
];

const FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "blueprint", label: "Blueprints" },
  { value: "blog", label: "Blogs" },
  { value: "bounty", label: "Bounties" },
  { value: "stage", label: "Stages" },
  { value: "block", label: "Blocks" },
];

export function CollectionDetailPage({
  collection,
  items,
  typeFilter,
  onTypeFilterChange,
  sort,
  onSortChange,
  onBack,
  onAddItem,
  onEdit,
  onShare,
  onDelete,
  onItemClick,
  onItemRemove,
  onItemReorder,
  onItemMove,
  onItemOpenNewTab,
  isOwnCollection,
}: CollectionDetailPageProps) {
  const [localItems, setLocalItems] = React.useState<DetailItem[]>(items);

  // Sync local items when parent data changes (filter/sort/refetch).
  React.useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const typeCounts = getTypeCounts(items);

  const filteredItems =
    typeFilter === "all"
      ? localItems
      : localItems.filter((it) => it.kind === typeFilter);

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sort === "a-z") return (a.title ?? "").localeCompare(b.title ?? "");
    if (sort === "by-type") return a.kind.localeCompare(b.kind);
    return 0;
  });

  const dndDisabled = sort !== "recently-added" || typeFilter !== "all" || !isOwnCollection;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localItems.findIndex((it) => it.id === active.id);
    const newIndex = localItems.findIndex((it) => it.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(localItems, oldIndex, newIndex);
    setLocalItems(next);
    onItemReorder(next.map((it) => it.id));
  }

  return (
    <div style={{ padding: "20px 24px 40px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <button
            onClick={onBack}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              ...body,
              fontSize: 12,
              color: t.text2,
              padding: 0,
            }}
          >
            <ArrowLeft size={14} />
            Library
          </button>

          {isOwnCollection && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  style={{
                    ...buttonStyle("secondary"),
                    padding: 6,
                    color: t.text2,
                    display: "inline-flex",
                  }}
                  aria-label="More actions"
                >
                  <MoreHorizontal size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>Edit collection</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  style={{ color: t.catBreakage }}
                >
                  Delete collection
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: r.full,
                background: collection.accentColor || t.text2,
                flexShrink: 0,
              }}
            />
            <h1
              style={{
                ...type.sectionHead,
                color: t.text,
                margin: 0,
              }}
            >
              {collection.name}
            </h1>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 8px",
                borderRadius: r.chip,
                background: t.recess,
                ...chipType,
                fontSize: 11,
                color: t.text2,
              }}
            >
              {collection.isPrivate ? <Lock size={11} /> : <Globe size={11} />}
              {collection.isPrivate ? "Private" : "Public"}
            </span>
          </div>

          {collection.description && (
            <p
              /* The description, capped at the theme's 68-character measure
                 rather than at 720px: measure is a count of characters, and a
                 pixel cap lets a 13px line run past it on a wide screen. */
              style={{
                ...body,
                ...measure,
                fontSize: 13,
                color: t.text,
                margin: 0,
                textWrap: "pretty",
              }}
            >
              {collection.description}
            </p>
          )}

          <div
            style={{
              ...dataText,
              ...tabular,
              fontSize: 11,
              color: t.text2,
            }}
          >
            {collection.itemCount} item{collection.itemCount === 1 ? "" : "s"} · Created{" "}
            {formatDate(collection.createdAt)} · Last updated {formatDate(collection.updatedAt)}
          </div>
        </div>

        {isOwnCollection && (
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            {!collection.isPrivate && (
              <Button variant="outline" size="sm" onClick={onShare}>
                <Share2 size={14} className="mr-1.5" />
                Share collection
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button size="sm" onClick={onAddItem}>
              + Add item
            </Button>
          </div>
        )}
      </div>

      {/* Filter + Sort strip */}
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {FILTER_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.value}
              label={opt.label}
              count={typeCounts[opt.value]}
              isActive={typeFilter === opt.value}
              onClick={() => onTypeFilterChange(opt.value)}
            />
          ))}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              style={{
                ...buttonStyle("outline"),
                padding: "6px 10px",
                ...body,
                fontSize: 12,
                color: t.text2,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Sort: {SORT_OPTIONS.find((o) => o.value === sort)?.label}
              <ChevronDown size={12} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {SORT_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => onSortChange(opt.value)}
                className={cn(sort === opt.value && "bg-accent")}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Items grid or empty state */}
      {sortedItems.length === 0 ? (
        <EmptyState isOwn={isOwnCollection} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={dndDisabled ? undefined : handleDragEnd}
        >
          <SortableContext
            items={sortedItems.map((it) => it.id)}
            strategy={rectSortingStrategy}
          >
            <style>{`
              .ns-detail-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 14px;
              }
              @media (max-width: 720px) {
                .ns-detail-grid { grid-template-columns: repeat(2, 1fr); }
              }
              @media (max-width: 480px) {
                .ns-detail-grid { grid-template-columns: 1fr; }
              }
            `}</style>
            <div className="ns-detail-grid">
              {sortedItems.map((item) => (
                <SortableItemCard
                  key={item.id}
                  item={item}
                  onItemClick={onItemClick}
                  onItemRemove={onItemRemove}
                  onItemMove={onItemMove}
                  onItemOpenNewTab={onItemOpenNewTab}
                  isOwnCollection={isOwnCollection && !dndDisabled}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
