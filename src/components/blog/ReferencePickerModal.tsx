import React, { useEffect, useRef, useCallback } from "react";
import {
  AtSign,
  X,
  FileText,
  LayoutGrid,
  Box,
  Search,
  SearchX,
  Loader2,
} from "lucide-react";

// Types
export type ReferenceType = "blueprints" | "stages" | "blocks";

export interface BlueprintResult {
  type: "blueprint";
  id: string;
  title: string;
  useCase: string;
  authorAvatar: string;
  blockTypes: Array<{ color: string }>;
}

export interface StageResult {
  type: "stage";
  id: string;
  name: string | null;
  blueprintTitle: string;
  blueprintId: string;
  blockCount: number;
  connectionCount: number;
}

export interface BlockResult {
  type: "block";
  id: string;
  name: string | null;
  stageName: string;
  stageId?: string;
  blueprintTitle: string;
  blueprintId: string;
  blockType: string;
  blockTypeColor: string;
}

export type ResultItem = BlueprintResult | StageResult | BlockResult;

export interface ReferencePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeType: ReferenceType;
  onTypeChange: (type: ReferenceType) => void;
  query: string;
  onQueryChange: (query: string) => void;
  results: ResultItem[];
  onSelect: (item: ResultItem) => void;
  counts: { blueprints: string; stages: string; blocks: string };
  isLoading: boolean;
  /** Optional anchor coordinates (top/left in viewport px) for the modal. */
  anchor?: { top: number; left: number } | null;
}

const styles = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  modal: {
    width: 560,
    maxHeight: 540,
    backgroundColor: "rgba(16,16,24,0.96)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    border: "0.5px solid rgba(255,255,255,0.10)",
    borderRadius: 12,
    boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  },
  header: {
    height: 52,
    minHeight: 52,
    display: "flex",
    alignItems: "center",
    padding: "0 14px",
    borderBottom: "0.5px solid rgba(255,255,255,0.10)",
    gap: 8,
  },
  headerIcon: { color: "#2EC4B6", width: 14, height: 14 },
  headerTitle: {
    fontFamily: "Inter, sans-serif",
    fontSize: 14,
    fontWeight: 600,
    color: "rgba(255,255,255,0.92)",
    flex: 1,
  },
  closeButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    color: "rgba(255,255,255,0.5)",
    transition: "color 0.15s, background 0.15s",
  },
  tabsContainer: {
    height: 40,
    minHeight: 40,
    display: "flex",
    alignItems: "stretch",
    borderBottom: "0.5px solid rgba(255,255,255,0.10)",
    padding: "0 14px",
  },
  tab: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    marginBottom: -0.5,
    transition: "border-color 0.15s",
    padding: 0,
    gap: 1,
  },
  tabActive: { borderBottomColor: "#E8571A" },
  tabContent: { display: "flex", alignItems: "center", gap: 5 },
  tabIcon: { width: 12, height: 12 },
  tabLabel: {
    fontFamily: "Inter, sans-serif",
    fontSize: 12,
    fontWeight: 500,
  },
  tabCount: {
    fontFamily: "Inter, sans-serif",
    fontSize: 9,
    fontWeight: 400,
    color: "rgba(255,255,255,0.30)",
  },
  searchContainer: {
    height: 44,
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    padding: "8px 14px",
    borderBottom: "0.5px solid rgba(255,255,255,0.10)",
    gap: 10,
  },
  searchIcon: {
    width: 14,
    height: 14,
    color: "rgba(255,255,255,0.40)",
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    background: "none",
    border: "none",
    outline: "none",
    fontFamily: "Inter, sans-serif",
    fontSize: 13,
    fontWeight: 400,
    color: "rgba(255,255,255,0.92)",
  },
  resultsList: {
    flex: 1,
    overflowY: "auto" as const,
    maxHeight: 360,
    padding: 4,
  },
  resultItem: {
    display: "flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
    transition: "background 0.1s",
    gap: 10,
    borderLeft: "2px solid transparent",
    marginLeft: -2,
  },
  resultItemHover: { backgroundColor: "rgba(255,255,255,0.04)" },
  resultItemActive: {
    borderLeftColor: "#E8571A",
    backgroundColor: "rgba(232,87,26,0.06)",
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    objectFit: "cover" as const,
    flexShrink: 0,
    background: "rgba(255,255,255,0.08)",
  },
  resultCenter: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: 1,
  },
  resultTitle: {
    fontFamily: "Inter, sans-serif",
    fontSize: 12,
    fontWeight: 500,
    color: "rgba(255,255,255,0.85)",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  resultSubtitle: {
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    fontWeight: 400,
    color: "rgba(255,255,255,0.45)",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  resultRight: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  typePill: {
    fontFamily: "Inter, sans-serif",
    fontSize: 9,
    fontWeight: 500,
    color: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: "2px 6px",
    borderRadius: 4,
    textTransform: "capitalize" as const,
  },
  blockTypesStrip: { display: "flex", gap: 2 },
  blockTypeChip: { width: 14, height: 10, borderRadius: 2 },
  stageIcon: {
    width: 14,
    height: 14,
    color: "rgba(46,196,182,0.85)",
    flexShrink: 0,
  },
  statsText: {
    fontFamily: "Inter, sans-serif",
    fontSize: 10,
    fontWeight: 400,
    color: "rgba(255,255,255,0.40)",
    whiteSpace: "nowrap" as const,
  },
  blockDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    flexShrink: 0,
  },
  blockTypeLabel: {
    fontFamily: "Inter, sans-serif",
    fontSize: 9,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    color: "rgba(255,255,255,0.55)",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
    gap: 8,
  },
  emptyIcon: { width: 48, height: 48, color: "rgba(255,255,255,0.20)" },
  emptyTitle: {
    fontFamily: "Inter, sans-serif",
    fontSize: 13,
    fontWeight: 500,
    color: "rgba(255,255,255,0.60)",
  },
  emptyDescription: {
    fontFamily: "Inter, sans-serif",
    fontSize: 12,
    fontWeight: 400,
    color: "rgba(255,255,255,0.35)",
    textAlign: "center" as const,
  },
  footer: {
    height: 32,
    minHeight: 32,
    display: "flex",
    alignItems: "center",
    padding: "6px 14px",
    borderTop: "0.5px solid rgba(255,255,255,0.10)",
  },
  footerText: {
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    fontWeight: 400,
    color: "rgba(255,255,255,0.40)",
  },
  loadingContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
  },
  spinner: {
    width: 20,
    height: 20,
    color: "rgba(255,255,255,0.40)",
    animation: "spin 1s linear infinite",
  },
  untitled: { fontStyle: "italic" as const, color: "rgba(255,255,255,0.45)" },
};

const tabConfig: Array<{
  type: ReferenceType;
  label: string;
  icon: typeof FileText;
}> = [
  { type: "blueprints", label: "Blueprints", icon: FileText },
  { type: "stages", label: "Stages", icon: LayoutGrid },
  { type: "blocks", label: "Blocks", icon: Box },
];

const placeholders: Record<ReferenceType, string> = {
  blueprints: "Search by title, use case, or tag...",
  stages: "Search by stage name or contents...",
  blocks: "Search by block content or name...",
};

export function ReferencePickerModal({
  isOpen,
  onClose,
  activeType,
  onTypeChange,
  query,
  onQueryChange,
  results,
  onSelect,
  counts,
  isLoading,
  anchor,
}: ReferencePickerModalProps) {
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [results, activeType]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (listRef.current && results.length > 0) {
      const items = listRef.current.querySelectorAll("[data-result-item]");
      const item = items[highlightedIndex] as HTMLElement | undefined;
      if (item) item.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, results.length]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case "Enter":
          e.preventDefault();
          if (results[highlightedIndex]) {
            onSelect(results[highlightedIndex]);
          }
          break;
        case "Tab": {
          e.preventDefault();
          const currentIndex = tabConfig.findIndex(
            (t) => t.type === activeType
          );
          const nextIndex = e.shiftKey
            ? (currentIndex - 1 + tabConfig.length) % tabConfig.length
            : (currentIndex + 1) % tabConfig.length;
          onTypeChange(tabConfig[nextIndex].type);
          break;
        }
      }
    },
    [isOpen, onClose, results, highlightedIndex, onSelect, activeType, onTypeChange]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // If anchored, position via fixed offsets near the cursor; otherwise center.
  const overlayStyle: React.CSSProperties = anchor
    ? {
        ...styles.overlay,
        backgroundColor: "transparent",
        alignItems: "flex-start",
        justifyContent: "flex-start",
      }
    : styles.overlay;

  const modalStyle: React.CSSProperties = anchor
    ? {
        ...styles.modal,
        position: "fixed",
        top: Math.min(anchor.top, window.innerHeight - 560),
        left: Math.min(anchor.left, window.innerWidth - 580),
      }
    : styles.modal;

  return (
    <div style={overlayStyle} onMouseDown={handleOverlayClick}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
        .ref-picker-scrollbar::-webkit-scrollbar { width: 6px; }
        .ref-picker-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .ref-picker-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
        .ref-picker-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
      `}</style>

      <div style={modalStyle} onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <AtSign style={styles.headerIcon} strokeWidth={2} />
          <div style={styles.headerTitle}>Add a reference</div>
          <button
            type="button"
            onClick={onClose}
            style={styles.closeButton}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Type Tabs */}
        <div style={styles.tabsContainer}>
          {tabConfig.map((tab) => {
            const isActive = activeType === tab.type;
            const Icon = tab.icon;
            return (
              <button
                key={tab.type}
                type="button"
                onClick={() => onTypeChange(tab.type)}
                style={{
                  ...styles.tab,
                  ...(isActive ? styles.tabActive : null),
                }}
              >
                <div style={styles.tabContent}>
                  <Icon
                    style={{
                      ...styles.tabIcon,
                      color: isActive
                        ? "rgba(255,255,255,0.92)"
                        : "rgba(255,255,255,0.55)",
                    }}
                    strokeWidth={2}
                  />
                  <span
                    style={{
                      ...styles.tabLabel,
                      color: isActive
                        ? "rgba(255,255,255,0.92)"
                        : "rgba(255,255,255,0.55)",
                    }}
                  >
                    {tab.label}
                  </span>
                </div>
                <span style={styles.tabCount}>{counts[tab.type]}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div style={styles.searchContainer}>
          <Search style={styles.searchIcon} strokeWidth={2} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={placeholders[activeType]}
            style={styles.searchInput}
          />
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          style={styles.resultsList}
          className="ref-picker-scrollbar"
        >
          {isLoading ? (
            <div style={styles.loadingContainer}>
              <Loader2 style={styles.spinner} />
            </div>
          ) : results.length === 0 ? (
            <div style={styles.emptyState}>
              <SearchX style={styles.emptyIcon} strokeWidth={1.5} />
              <div style={styles.emptyTitle}>No matches</div>
              <div style={styles.emptyDescription}>
                Try a different search or change the type tab
              </div>
            </div>
          ) : (
            results.map((item, index) => {
              const isHighlighted = index === highlightedIndex;
              const isHovered = index === hoveredIndex;
              return (
                <div
                  key={`${item.type}-${item.id}-${index}`}
                  data-result-item
                  style={{
                    ...styles.resultItem,
                    ...(isHovered && !isHighlighted
                      ? styles.resultItemHover
                      : null),
                    ...(isHighlighted ? styles.resultItemActive : null),
                  }}
                  onClick={() => onSelect(item)}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {item.type === "blueprint" && (
                    <BlueprintResultItem item={item} />
                  )}
                  {item.type === "stage" && <StageResultItem item={item} />}
                  {item.type === "block" && <BlockResultItem item={item} />}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <span style={styles.footerText}>
            ↑↓ to navigate · Enter to insert · Esc to close
          </span>
        </div>
      </div>
    </div>
  );
}

function BlueprintResultItem({ item }: { item: BlueprintResult }) {
  return (
    <>
      {item.authorAvatar ? (
        <img src={item.authorAvatar} alt="" style={styles.avatar} />
      ) : (
        <div style={styles.avatar} />
      )}
      <div style={styles.resultCenter}>
        <div style={styles.resultTitle}>{item.title}</div>
        <div style={styles.resultSubtitle}>{item.useCase}</div>
      </div>
      <div style={styles.resultRight}>
        <span style={styles.typePill}>Blueprint</span>
        <div style={styles.blockTypesStrip}>
          {item.blockTypes.slice(0, 4).map((bt, i) => (
            <div
              key={i}
              style={{ ...styles.blockTypeChip, background: bt.color }}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function StageResultItem({ item }: { item: StageResult }) {
  return (
    <>
      <LayoutGrid style={styles.stageIcon} strokeWidth={2} />
      <div style={styles.resultCenter}>
        <div
          style={{
            ...styles.resultTitle,
            ...(item.name ? null : styles.untitled),
          }}
        >
          {item.name || "Untitled stage"}
        </div>
        <div style={styles.resultSubtitle}>From {item.blueprintTitle}</div>
      </div>
      <div style={styles.resultRight}>
        <span style={styles.statsText}>
          {item.blockCount} blocks · {item.connectionCount} connections
        </span>
      </div>
    </>
  );
}

function BlockResultItem({ item }: { item: BlockResult }) {
  return (
    <>
      <div
        style={{ ...styles.blockDot, background: item.blockTypeColor }}
      />
      <div style={styles.resultCenter}>
        <div
          style={{
            ...styles.resultTitle,
            ...(item.name ? null : styles.untitled),
          }}
        >
          {item.name || "Untitled prompt"}
        </div>
        <div style={styles.resultSubtitle}>
          From {item.stageName} in {item.blueprintTitle}
        </div>
      </div>
      <div style={styles.resultRight}>
        <span
          style={{ ...styles.blockTypeLabel, color: item.blockTypeColor }}
        >
          {item.blockType}
        </span>
      </div>
    </>
  );
}
