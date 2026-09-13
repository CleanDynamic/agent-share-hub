import * as React from "react";
import {
  FileStack,
  PenTool,
  Target,
  Lock,
  Globe,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Layers,
  Box,
  Zap,
  Database,
  Code,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { categoryColour, categoryFill } from "@/lib/theme/category";
import { chipType, uiTransition } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { body, data as dataText, tabular } from "@/lib/theme/type";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const BLOCK_TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  logic: Zap,
  data: Database,
  code: Code,
  settings: Settings,
  default: Box,
};

/**
 * A block type's hue, as one of the nine part categories rather than as a
 * private five-hex palette. `categoryColour` falls back to the measured
 * `--cat-fallback` for anything the registry does not know.
 */
const BLOCK_TYPE_CATEGORY: Record<string, string> = {
  logic: "instruction",
  data: "data",
  code: "artefact",
  settings: "configuration",
  default: "",
};

export interface CoverItem {
  kind: "blueprint" | "blog" | "bounty" | "stage" | "block";
  coverUrl?: string | null;
  blockType?: string;
  blockColor?: string;
  stagePreview?: {
    blocks: Array<{ x: number; y: number; color?: string }>;
    connections: Array<{ from: number; to: number }>;
  };
}

export interface Collection {
  id: string;
  name: string;
  accentColor?: string;
  isPrivate: boolean;
  isDefault?: boolean;
  itemCount: number;
  lastUpdatedAt: Date | string;
  coverItems: CoverItem[];
}

export type CollectionMenuAction =
  | "edit"
  | "toggle-privacy"
  | "duplicate"
  | "delete";

interface CollectionCardProps {
  collection: Collection;
  onClick?: () => void;
  onMenuAction?: (action: CollectionMenuAction) => void;
  showMenu?: boolean;
  className?: string;
}

function formatTimeAgo(date: Date | string): string {
  const then = new Date(date);
  const diffMs = Date.now() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return `${diffMonths}mo ago`;
}

function StageMiniMap({
  blocks,
  connections,
}: {
  blocks: Array<{ x: number; y: number; color?: string }>;
  connections: Array<{ from: number; to: number }>;
}) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {connections.map((conn, i) => {
        const fromBlock = blocks[conn.from];
        const toBlock = blocks[conn.to];
        if (!fromBlock || !toBlock) return null;
        return (
          <line
            key={`c-${i}`}
            x1={fromBlock.x}
            y1={fromBlock.y}
            x2={toBlock.x}
            y2={toBlock.y}
            stroke={t.line}
            strokeWidth={0.8}
          />
        );
      })}
      {blocks.map((b, i) => (
        <circle
          key={`b-${i}`}
          cx={b.x}
          cy={b.y}
          r={3}
          fill={b.color || t.evidence}
        />
      ))}
    </svg>
  );
}

function CoverTile({ item }: { item: CoverItem }) {
  const tileStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    /* A media well, and the token named for one. */
    background: t.porthole,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  };

  switch (item.kind) {
    case "blueprint":
      if (item.coverUrl) {
        return (
          <div style={tileStyle}>
            <img
              src={item.coverUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        );
      }
      return (
        <div style={tileStyle}>
          <FileStack size={24} color={t.chromeLo} />
        </div>
      );
    case "blog":
      return (
        <div style={tileStyle}>
          <PenTool size={22} color={t.chromeLo} />
        </div>
      );
    case "bounty":
      return (
        <div style={tileStyle}>
          <Target size={22} color={t.chromeLo} />
        </div>
      );
    case "stage":
      return (
        <div style={{ ...tileStyle, padding: 8 }}>
          {item.stagePreview ? (
            <StageMiniMap
              blocks={item.stagePreview.blocks}
              connections={item.stagePreview.connections}
            />
          ) : (
            <Layers size={22} color={t.chromeLo} />
          )}
        </div>
      );
    case "block": {
      const blockCategory = BLOCK_TYPE_CATEGORY[item.blockType || "default"] ?? "";
      const blockFill = categoryFill(blockCategory);
      const blockColor = item.blockColor || categoryColour(blockCategory);
      const BlockIcon =
        BLOCK_TYPE_ICONS[item.blockType || "default"] ||
        BLOCK_TYPE_ICONS.default;
      return (
        <div
          style={{
            ...tileStyle,
            /* The measured ground for this hue, flat. A gradient between a
               category tint and a white alpha had no second stop that was
               legal on the Exhibition ground. */
            backgroundColor: blockFill.background,
          }}
        >
          <BlockIcon size={22} color={blockColor} />
          {item.blockType && (
            <span
              style={{
                position: "absolute",
                bottom: 4,
                right: 4,
                ...chipType,
                fontSize: 8,
                color: t.text2,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {item.blockType}
            </span>
          )}
        </div>
      );
    }
    default:
      return <div style={tileStyle} />;
  }
}

function EmptyTile() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: t.recess,
      }}
    />
  );
}

function CoverComposition({ items }: { items: CoverItem[] }) {
  if (items.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          color: t.text2,
          background: t.recess,
        }}
      >
        <FileStack size={28} />
        <span style={{ ...body, fontSize: 11 }}>
          Empty
        </span>
      </div>
    );
  }

  const display: (CoverItem | null)[] = items.slice(0, 4);
  while (display.length < 4) display.push(null);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: 2,
        width: "100%",
        height: "100%",
      }}
    >
      {display.map((it, i) => (it ? <CoverTile key={i} item={it} /> : <EmptyTile key={i} />))}
    </div>
  );
}

export function CollectionCard({
  collection,
  onClick,
  onMenuAction,
  showMenu = true,
  className,
}: CollectionCardProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  /* A collection's own accent, when its owner picked one; otherwise the
     secondary ink. The dot is 8px of colour and carries no state, so a
     user-chosen value is legal here in a way it would not be on type. */
  const accentColor = collection.accentColor || t.text2;

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-menu-trigger]")) return;
    onClick?.();
  };

  return (
    <div
      className={cn("group", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        if (!menuOpen) setIsHovered(false);
      }}
      onClick={handleCardClick}
      style={{
        background: t.glass,
        border: `1px solid ${t.glassBorder}`,
        borderRadius: r.card,
        overflow: "hidden",
        cursor: "pointer",
        transition: uiTransition(),
        display: "flex",
        flexDirection: "column",
        ...(isHovered
          ? {
              borderColor: t.line,
              background: t.glassHi,
              transform: "translateY(-1px)",
            }
          : {}),
      }}
    >
      {/* Cover */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 10" }}>
        <CoverComposition items={collection.coverItems} />

        {showMenu && (isHovered || menuOpen) && (
          <div style={{ position: "absolute", top: 8, right: 8 }}>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  data-menu-trigger
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
                  <MoreHorizontal size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onMenuAction?.("edit");
                  }}
                >
                  <Pencil size={14} className="mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onMenuAction?.("toggle-privacy");
                  }}
                >
                  {collection.isPrivate ? (
                    <>
                      <Eye size={14} className="mr-2" />
                      Make public
                    </>
                  ) : (
                    <>
                      <EyeOff size={14} className="mr-2" />
                      Make private
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onMenuAction?.("duplicate");
                  }}
                >
                  <Copy size={14} className="mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onMenuAction?.("delete");
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 size={14} className="mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              /* Circular, which is the one thing `--r-full` is for. */
              borderRadius: r.full,
              background: accentColor,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              ...body,
              fontSize: 14,
              fontWeight: 600,
              color: t.text,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {collection.name}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            ...dataText,
            ...tabular,
            fontSize: 11,
            color: t.text2,
          }}
        >
          <span>
            {collection.itemCount} item{collection.itemCount !== 1 ? "s" : ""}
          </span>
          <span>·</span>
          <span>Updated {formatTimeAgo(collection.lastUpdatedAt)}</span>
          <span>·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            {collection.isPrivate ? (
              <>
                <Lock size={10} />
                Private
              </>
            ) : (
              <>
                <Globe size={10} />
                Public
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
