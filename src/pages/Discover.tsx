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
import { BlueprintResultCard } from "@/components/discover/BlueprintResultCard";
import { StageResultCard } from "@/components/discover/StageResultCard";
import { BlockResultCard } from "@/components/discover/BlockResultCard";
import { DiscoverLoadingSkeleton } from "@/components/discover/DiscoverLoadingSkeleton";
import { DiscoverEmptyState } from "@/components/discover/DiscoverEmptyState";
import { DiscoverNoResultsState } from "@/components/discover/DiscoverNoResultsState";
import { MOCK_BLUEPRINTS, MOCK_STAGES, MOCK_BLOCKS } from "@/components/discover/mockDiscoverData";

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

  // Mock filtering — real queries land in 3.4/3.5.
  const isLoading = false;
  const hasActiveFilters = activeFilters.length > 0;
  const hasQuery = urlQ.trim().length > 0;
  const qLower = urlQ.trim().toLowerCase();

  const filteredBlueprints = useMemo(() => {
    if (!hasQuery) return MOCK_BLUEPRINTS;
    return MOCK_BLUEPRINTS.filter(
      (b) =>
        b.title.toLowerCase().includes(qLower) ||
        b.description.toLowerCase().includes(qLower) ||
        (b.tools || []).some((t) => t.toLowerCase().includes(qLower)),
    );
  }, [hasQuery, qLower]);

  const filteredStages = useMemo(() => {
    if (!hasQuery) return MOCK_STAGES;
    return MOCK_STAGES.filter(
      (s) =>
        (s.stage.name || "").toLowerCase().includes(qLower) ||
        s.parent.blueprintTitle.toLowerCase().includes(qLower),
    );
  }, [hasQuery, qLower]);

  const filteredBlocks = useMemo(() => {
    if (!hasQuery) return MOCK_BLOCKS;
    return MOCK_BLOCKS.filter(
      (b) =>
        (b.block.name || "").toLowerCase().includes(qLower) ||
        (b.block.content || "").toLowerCase().includes(qLower) ||
        b.block.type.toLowerCase().includes(qLower),
    );
  }, [hasQuery, qLower]);

  const currentResultsCount =
    mode === "blueprints"
      ? filteredBlueprints.length
      : mode === "stages"
        ? filteredStages.length
        : filteredBlocks.length;

  const renderResults = () => {
    if (isLoading) return <DiscoverLoadingSkeleton count={6} />;

    if (!hasQuery && !hasActiveFilters && currentResultsCount === 0) {
      return (
        <DiscoverEmptyState
          onSuggestionClick={(s) => {
            setQueryInput(s);
            updateParams({ q: s });
          }}
        />
      );
    }

    if (currentResultsCount === 0) {
      return (
        <DiscoverNoResultsState
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearAllFilters}
          onSubmitRequest={() => {
            /* TODO: open submit modal */
          }}
        />
      );
    }

    if (mode === "blueprints") {
      return (
        <div className="flex flex-col gap-3">
          {filteredBlueprints.map((bp) => (
            <BlueprintResultCard key={bp.id} blueprint={bp} />
          ))}
        </div>
      );
    }

    if (mode === "stages") {
      return (
        <div className="flex flex-col gap-3">
          {filteredStages.map(({ stage, parent, author }) => (
            <StageResultCard key={stage.id} stage={stage} parent={parent} author={author} />
          ))}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        {filteredBlocks.map(({ block, parent, author, referenceCount }) => (
          <BlockResultCard
            key={block.id}
            block={block}
            parent={parent}
            author={author}
            referenceCount={referenceCount}
          />
        ))}
      </div>
    );
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

        <div className="mt-6">{renderResults()}</div>
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
