import * as React from "react";
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  useTransitionStyles,
} from "@floating-ui/react";
import { AtSign, X, Search, FileText, Layers, Box } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReferenceType = "blueprints" | "stages" | "blocks";

export interface ReferenceItem {
  id: string;
  name: string;
  subtitle?: string;
  type: ReferenceType;
  avatar?: string;
  icon?: React.ReactNode;
}

export interface ReferencePickerCounts {
  blueprints: number;
  stages: number;
  blocks: number;
}

export interface ThreadReferencePickerProps {
  isOpen: boolean;
  onClose: () => void;
  activeType: ReferenceType;
  onTypeChange: (type: ReferenceType) => void;
  query: string;
  onQueryChange: (query: string) => void;
  results: ReferenceItem[];
  isLoading?: boolean;
  counts: ReferencePickerCounts;
  onSelect: (item: ReferenceItem) => void;
  anchorEl: HTMLElement | null;
}

const typeConfig: Record<
  ReferenceType,
  { label: string; placeholder: string; icon: React.ReactNode }
> = {
  blueprints: {
    label: "Blueprints",
    placeholder: "Search blueprints…",
    icon: <FileText className="h-3 w-3" />,
  },
  stages: {
    label: "Stages",
    placeholder: "Search stages…",
    icon: <Layers className="h-3 w-3" />,
  },
  blocks: {
    label: "Blocks",
    placeholder: "Search blocks…",
    icon: <Box className="h-3 w-3" />,
  },
};

export function ThreadReferencePicker({
  isOpen,
  onClose,
  activeType,
  onTypeChange,
  query,
  onQueryChange,
  results,
  isLoading = false,
  counts,
  onSelect,
  anchorEl,
}: ThreadReferencePickerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const floating = useFloating({
    open: isOpen,
    placement: "top-start",
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    elements: { reference: anchorEl },
  });
  const { refs, floatingStyles, context } = floating;

  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, {
    duration: 150,
    initial: { opacity: 0, transform: "translateY(8px)" },
  });

  React.useEffect(() => {
    if (isOpen && inputRef.current) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const [selectedIndex, setSelectedIndex] = React.useState(0);
  React.useEffect(() => setSelectedIndex(0), [results, query, activeType]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        onSelect(results[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab") {
        e.preventDefault();
        const types: ReferenceType[] = ["blueprints", "stages", "blocks"];
        const idx = types.indexOf(activeType);
        const next = e.shiftKey
          ? (idx - 1 + types.length) % types.length
          : (idx + 1) % types.length;
        onTypeChange(types[next]);
      }
    },
    [results, selectedIndex, onSelect, onClose, activeType, onTypeChange]
  );

  if (!isMounted) return null;

  return (
    <div
      ref={refs.setFloating}
      style={{ ...floatingStyles, ...transitionStyles, zIndex: 60 }}
      className="w-[340px] rounded-xl border border-white/10 shadow-2xl backdrop-blur-xl"
    >
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: "rgba(15,15,22,0.92)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 h-9 border-b border-white/5">
          <div className="flex items-center gap-1.5">
            <AtSign className="h-3.5 w-3.5 text-white/60" />
            <span
              className="text-[11px] font-semibold text-white/80"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              Share content
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white/90 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Type tabs */}
        <div className="flex h-8 border-b border-white/5">
          {(["blueprints", "stages", "blocks"] as ReferenceType[]).map((type) => (
            <button
              key={type}
              onClick={() => onTypeChange(type)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 relative transition-colors text-[11px]",
                activeType === type ? "text-white" : "text-white/50 hover:text-white/70"
              )}
              style={{ fontFamily: "Inter, sans-serif", fontWeight: 500 }}
            >
              <span>{typeConfig[type].label}</span>
              <span className="text-white/40">{counts[type]}</span>
              {activeType === type && (
                <div
                  className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                  style={{ backgroundColor: "rgb(46,196,182)" }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-3 h-9 border-b border-white/5">
          <Search className="h-3 w-3 text-white/40" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={typeConfig[activeType].placeholder}
            className="flex-1 bg-transparent outline-none text-[12px] text-white/85 placeholder:text-white/35"
            style={{ fontFamily: "Inter, sans-serif" }}
          />
        </div>

        {/* Results */}
        <div className="max-h-[260px] overflow-y-auto py-1">
          {isLoading ? (
            <div className="px-3 py-6 flex items-center justify-center">
              <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <div
              className="px-3 py-6 text-center text-[11px] text-white/40"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              No results found
            </div>
          ) : (
            results.map((item, index) => (
              <button
                key={item.id}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => onSelect(item)}
                className={cn(
                  "w-full flex items-center gap-2.5 h-9 px-3 text-left transition-colors",
                  index === selectedIndex ? "bg-white/10" : "hover:bg-white/5"
                )}
              >
                {item.avatar ? (
                  <img
                    src={item.avatar}
                    alt=""
                    className="h-6 w-6 rounded object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="h-6 w-6 rounded flex items-center justify-center shrink-0 text-white/70"
                    style={{ backgroundColor: "rgba(255, 255, 255, 0.14)" }}
                  >
                    {item.icon || typeConfig[item.type].icon}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[12px] text-white/90 truncate"
                    style={{ fontFamily: "Inter, sans-serif", fontWeight: 500 }}
                  >
                    {item.name}
                  </div>
                  {item.subtitle && (
                    <div
                      className="text-[10px] text-white/45 truncate"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      {item.subtitle}
                    </div>
                  )}
                </div>
                <div className="text-white/30 shrink-0">
                  {typeConfig[item.type].icon}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-3 px-3 h-7 border-t border-white/5 text-[10px] text-white/40"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>Tab switch type</span>
        </div>
      </div>
    </div>
  );
}

export default ThreadReferencePicker;
