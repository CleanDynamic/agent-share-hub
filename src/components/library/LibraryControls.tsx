import { Search, Grid2x2, List, Plus, ChevronDown } from "lucide-react";

interface LibraryControlsProps {
  search: string;
  onSearchChange: (value: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  sortBy: "recent" | "rating";
  onSortChange: (sort: "recent" | "rating") => void;
  onNewFolder: () => void;
}

export function LibraryControls({
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  onNewFolder,
}: LibraryControlsProps) {
  return (
    <div
      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255, 255, 255, 0.14)",
        borderRadius: 12,
        padding: "12px 16px",
      }}
    >
      {/* Left controls */}
      <div className="flex items-center gap-2">
        {/* View toggle */}
        <div
          className="flex items-center"
          style={{
            background: "rgba(255, 255, 255, 0.12)",
            borderRadius: 8,
            border: "1px solid rgba(255, 255, 255, 0.14)",
          }}
        >
          <button
            onClick={() => onViewModeChange("grid")}
            className="p-2 rounded-l-[7px] transition-colors"
            style={{
              background:
                viewMode === "grid"
                  ? "rgba(31,122,109,0.15)"
                  : "transparent",
              color:
                viewMode === "grid"
                  ? "#1F7A6D"
                  : "rgba(255,255,255,0.28)",
            }}
            aria-label="Grid view"
          >
            <Grid2x2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onViewModeChange("list")}
            className="p-2 rounded-r-[7px] transition-colors"
            style={{
              background:
                viewMode === "list"
                  ? "rgba(31,122,109,0.15)"
                  : "transparent",
              color:
                viewMode === "list"
                  ? "#1F7A6D"
                  : "rgba(255,255,255,0.28)",
            }}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1">
          {(["recent", "rating"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onSortChange(s)}
              className="px-3 py-1.5 rounded-lg transition-all"
              style={{
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.04em",
                background:
                  sortBy === s
                    ? "rgba(31,122,109,0.12)"
                    : "transparent",
                color:
                  sortBy === s
                    ? "#1F7A6D"
                    : "rgba(255,255,255,0.45)",
                border:
                  sortBy === s
                    ? "1px solid rgba(31,122,109,0.3)"
                    : "1px solid transparent",
              }}
            >
              {s === "recent" ? "Recent" : "Top Rated"}
            </button>
          ))}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 sm:ml-auto">
        {/* Search */}
        <div className="relative flex-1 sm:flex-none">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
            style={{ color: "rgba(255,255,255,0.28)" }}
          />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search your library..."
            className="w-full sm:w-52 outline-none placeholder:text-[rgba(255,255,255,0.28)]"
            style={{
              background: "rgba(255, 255, 255, 0.12)",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              borderRadius: 8,
              padding: "7px 12px 7px 32px",
              fontSize: 13,
              fontWeight: 300,
              color: "rgba(255,255,255,0.90)",
            }}
          />
        </div>

        {/* New Folder */}
        <button
          onClick={onNewFolder}
          className="flex items-center gap-1.5 shrink-0 transition-all"
          style={{
            background: "rgba(139,69,19,0.12)",
            border: "1px solid rgba(139,69,19,0.3)",
            borderRadius: 8,
            padding: "7px 14px",
            fontSize: 12,
            fontWeight: 500,
            color: "#8B4513",
            letterSpacing: "0.04em",
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          New folder
        </button>
      </div>
    </div>
  );
}
