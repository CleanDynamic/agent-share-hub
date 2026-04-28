import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { DiscoverSearchHeader, type SearchMode, type ActiveFilter } from "@/components/discover/DiscoverSearchHeader";
import { DiscoverFilterSheet, type FilterValue } from "@/components/discover/DiscoverFilterSheet";
import {
  useDiscoverCounts,
  useDiscoverModelOptions,
  useDiscoverToolOptions,
  useDiscoverTagSuggestions,
  useDiscoverResultCount,
} from "@/components/discover/useDiscoverQueries";

const MODES: SearchMode[] = ["blueprints", "stages", "blocks"];

// Multi-value URL params (comma-separated).
const MULTI_KEYS = ["postTypes", "blockTypes", "models", "tools", "tags"] as const;
// Single-value URL params.
const SINGLE_KEYS = ["domain", "difficulty", "length", "bountyStatus", "timeRange"] as const;
const ALL_FILTER_KEYS = [...MULTI_KEYS, ...SINGLE_KEYS] as const;

const DEFAULT_SORT = "Most recent";

function parseFilters(sp: URLSearchParams): FilterValue {
  const getMulti = (k: string): string[] => {
    const raw = sp.get(k);
    if (!raw) return [];
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  };
  return {
    postTypes: getMulti("postTypes"),
    blockTypes: getMulti("blockTypes"),
    models: getMulti("models"),
    tools: getMulti("tools"),
    tags: getMulti("tags"),
    domain: sp.get("domain"),
    difficulty: sp.get("difficulty"),
    length: sp.get("length"),
    bountyStatus: sp.get("bountyStatus"),
    timeRange: sp.get("timeRange"),
  };
}

function filtersToPatch(filters: FilterValue): Record<string, string | null> {
  const patch: Record<string, string | null> = {};
  for (const k of MULTI_KEYS) {
    const arr = filters[k];
    patch[k] = arr.length ? arr.join(",") : null;
  }
  for (const k of SINGLE_KEYS) {
    patch[k] = filters[k] || null;
  }
  return patch;
}

const Discover = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const modeParam = searchParams.get("mode") as SearchMode | null;
  const mode: SearchMode = MODES.includes(modeParam as SearchMode)
    ? (modeParam as SearchMode)
    : "blueprints";
  const urlQ = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? DEFAULT_SORT;
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  // Local q state (debounced into the URL).
  const [queryInput, setQueryInput] = useState(urlQ);
  useEffect(() => {
    setQueryInput(urlQ);
    // intentionally only when the URL value changes externally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQ]);

  // Canonical URL updater.
  const updateParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === undefined || v === "") next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Debounce q → URL (200ms).
  useEffect(() => {
    if (queryInput === urlQ) return;
    const t = setTimeout(() => {
      updateParams({ q: queryInput || null });
    }, 200);
    return () => clearTimeout(t);
  }, [queryInput, urlQ, updateParams]);

  // Tab counts.
  const { data: counts } = useDiscoverCounts();
  const tabCounts = {
    blueprints: counts?.blueprints ?? "—",
    stages: counts?.stages ?? "—",
    blocks: counts?.blocks ?? "—",
  };

  // Filter sheet option queries.
  const { data: modelOptions = [] } = useDiscoverModelOptions();
  const { data: toolOptions = [] } = useDiscoverToolOptions();
  const { data: tagSuggestions = [] } = useDiscoverTagSuggestions();

  // Live result-count preview (debounced via React Query staleTime + key).
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilters(filters), 300);
    return () => clearTimeout(t);
  }, [filters]);
  const { data: resultCountPreview = 0 } = useDiscoverResultCount({
    q: urlQ,
    postTypes: debouncedFilters.postTypes,
    blockTypes: debouncedFilters.blockTypes,
    models: debouncedFilters.models,
    tools: debouncedFilters.tools,
    domain: debouncedFilters.domain,
    tags: debouncedFilters.tags,
    difficulty: debouncedFilters.difficulty,
    timeRange: debouncedFilters.timeRange,
  });

  // Active filter chips (Row 4).
  const activeFilters: ActiveFilter[] = useMemo(() => {
    const out: ActiveFilter[] = [];
    for (const k of MULTI_KEYS) {
      for (const v of filters[k]) {
        out.push({ key: `${k}:${v}`, label: v });
      }
    }
    for (const k of SINGLE_KEYS) {
      const v = filters[k];
      if (v) out.push({ key: `${k}:${v}`, label: v });
    }
    return out;
  }, [filters]);

  const removeActiveFilter = (compoundKey: string) => {
    const sep = compoundKey.indexOf(":");
    if (sep === -1) return;
    const key = compoundKey.slice(0, sep);
    const val = compoundKey.slice(sep + 1);
    if ((MULTI_KEYS as readonly string[]).includes(key)) {
      const arr = (filters as any)[key] as string[];
      const next = arr.filter((x) => x !== val);
      updateParams({ [key]: next.length ? next.join(",") : null });
    } else {
      updateParams({ [key]: null });
    }
  };

  const clearAllFilters = () => {
    const patch: Record<string, null> = {};
    for (const k of ALL_FILTER_KEYS) patch[k] = null;
    updateParams(patch);
  };

  const handleFiltersChange = (next: FilterValue) => {
    updateParams(filtersToPatch(next));
  };

  return (
    <>
      <SeoHead
        title="Discover · NeoScale"
        description="Search and discover Blueprints, Stages, and Blocks."
        path="/discover"
      />
      <div className="mx-auto w-full px-4 py-6" style={{ maxWidth: 920 }}>
        <DiscoverSearchHeader
          activeMode={mode}
          onModeChange={(m) => updateParams({ mode: m })}
          query={queryInput}
          onQueryChange={setQueryInput}
          counts={tabCounts}
          activeFilters={activeFilters}
          onFilterRemove={removeActiveFilter}
          onClearFilters={clearAllFilters}
          onOpenFilters={() => setFiltersOpen(true)}
          resultCount={resultCountPreview}
          sort={sort}
          onSortChange={(s) => updateParams({ sort: s === DEFAULT_SORT ? null : s })}
        />

        {/* Results placeholder (3.3) */}
        <div
          className="rounded-xl border p-10 text-center mt-6"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderColor: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          <p className="text-sm">Results coming in 3.3</p>
          <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.30)" }}>
            mode=<code>{mode}</code>
            {urlQ && <> · q=<code>{urlQ}</code></>}
            {activeFilters.length > 0 && <> · {activeFilters.length} filter(s)</>}
          </p>
        </div>
      </div>

      <DiscoverFilterSheet
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        activeMode={mode}
        value={filters}
        onChange={handleFiltersChange}
        resultCountPreview={resultCountPreview}
        onApply={() => setFiltersOpen(false)}
        onReset={clearAllFilters}
        modelOptions={modelOptions}
        toolOptions={toolOptions}
        tagSuggestions={tagSuggestions}
      />
    </>
  );
};

export default Discover;
