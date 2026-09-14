import { SearchX } from "lucide-react";

interface DiscoverNoResultsStateProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onSubmitRequest: () => void;
}

export function DiscoverNoResultsState({
  hasActiveFilters,
  onClearFilters,
  onSubmitRequest,
}: DiscoverNoResultsStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <SearchX
        className="h-14 w-14"
        style={{ color: "var(--text2)" }}
        strokeWidth={1.5}
      />
      <h2
        className="mt-4 text-center text-base font-semibold"
        style={{ color: "var(--text)" }}
      >
        No matches found
      </h2>
      <p
        className="mt-2 text-center text-[13px] font-normal"
        style={{ color: "var(--text2)" }}
      >
        Try removing some filters or different keywords.
      </p>
      <div className="mt-6 flex items-center gap-3">
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="rounded-lg px-4 py-2 text-xs font-medium transition-colors"
            style={{ color: "var(--text2)", background: "transparent" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--recess)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Clear filters
          </button>
        )}
        <button
          onClick={onSubmitRequest}
          className="rounded-lg px-4 py-2 text-xs font-medium transition-colors"
          style={{ color: "var(--text)", background: "var(--recess)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--recess)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--recess)";
          }}
        >
          Submit a request
        </button>
      </div>
    </div>
  );
}
