import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { FeedCard, type FeedPost } from "@/components/feed-card";
import { StageResultCard } from "@/components/discover/StageResultCard";
import { BlockResultCard } from "@/components/discover/BlockResultCard";
import { DiscoverLoadingSkeleton } from "@/components/discover/DiscoverLoadingSkeleton";
import { DiscoverEmptyState } from "@/components/discover/DiscoverEmptyState";
import { DiscoverNoResultsState } from "@/components/discover/DiscoverNoResultsState";
import { MOCK_STAGES, MOCK_BLOCKS } from "@/components/discover/mockDiscoverData";
import { queryBlueprints, type QueryBlueprintsParams } from "@/lib/discover/queryBlueprints";

const PAGE_SIZE = 20;

const SORT_LABEL_TO_KEY: Record<string, QueryBlueprintsParams["sort"]> = {
  "Most recent": "recent",
  "Most engaged": "engaged",
  "Most referenced": "referenced",
  "Newest": "newest",
};

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

  const hasActiveFilters = activeFilters.length > 0;
  const hasQuery = urlQ.trim().length > 0;
  const qLower = urlQ.trim().toLowerCase();

  // ---- Real Blueprints query (Phase 3.4) ----
  const blueprintParams: QueryBlueprintsParams = useMemo(() => {
    const postType = filters.postTypes[0] as QueryBlueprintsParams["postType"] | undefined;
    return {
      query: urlQ,
      postType: postType && ["blueprint", "blog", "bounty"].includes(postType) ? postType : undefined,
      blockTypes: filters.blockTypes.length ? filters.blockTypes : undefined,
      models: filters.models.length ? filters.models : undefined,
      tools: filters.tools.length ? filters.tools : undefined,
      tags: filters.tags.length ? filters.tags : undefined,
      domain: filters.domain ?? undefined,
      difficulty: filters.difficulty ?? undefined,
      length: (filters.length as QueryBlueprintsParams["length"]) ?? undefined,
      bountyStatus: (filters.bountyStatus as QueryBlueprintsParams["bountyStatus"]) ?? undefined,
      timeRange: (filters.timeRange as QueryBlueprintsParams["timeRange"]) ?? undefined,
      sort: SORT_LABEL_TO_KEY[sort] ?? "recent",
    };
  }, [urlQ, filters, sort]);

  const [blueprintRows, setBlueprintRows] = useState<FeedPost[]>([]);
  const [blueprintTotal, setBlueprintTotal] = useState(0);
  const [blueprintsLoading, setBlueprintsLoading] = useState(false);
  const [blueprintsLoadingMore, setBlueprintsLoadingMore] = useState(false);
  const [blueprintsError, setBlueprintsError] = useState<string | null>(null);
  const blueprintReqIdRef = useRef(0);

  // Initial / param-changed fetch.
  useEffect(() => {
    if (mode !== "blueprints") return;
    const reqId = ++blueprintReqIdRef.current;
    setBlueprintsLoading(true);
    setBlueprintsError(null);
    queryBlueprints({ ...blueprintParams, limit: PAGE_SIZE, offset: 0 })
      .then((res) => {
        if (reqId !== blueprintReqIdRef.current) return;
        setBlueprintRows(res.rows);
        setBlueprintTotal(res.total);
      })
      .catch((err) => {
        if (reqId !== blueprintReqIdRef.current) return;
        setBlueprintsError(err?.message ?? "Failed to load blueprints");
        setBlueprintRows([]);
        setBlueprintTotal(0);
      })
      .finally(() => {
        if (reqId !== blueprintReqIdRef.current) return;
        setBlueprintsLoading(false);
      });
  }, [mode, blueprintParams]);

  const loadMoreBlueprints = useCallback(async () => {
    if (blueprintsLoading || blueprintsLoadingMore) return;
    if (blueprintRows.length >= blueprintTotal) return;
    const reqId = blueprintReqIdRef.current;
    setBlueprintsLoadingMore(true);
    try {
      const res = await queryBlueprints({
        ...blueprintParams,
        limit: PAGE_SIZE,
        offset: blueprintRows.length,
      });
      if (reqId !== blueprintReqIdRef.current) return;
      setBlueprintRows((prev) => [...prev, ...res.rows]);
      setBlueprintTotal(res.total);
    } catch (err: any) {
      if (reqId !== blueprintReqIdRef.current) return;
      setBlueprintsError(err?.message ?? "Failed to load more");
    } finally {
      if (reqId === blueprintReqIdRef.current) setBlueprintsLoadingMore(false);
    }
  }, [blueprintParams, blueprintRows.length, blueprintTotal, blueprintsLoading, blueprintsLoadingMore]);

  // IntersectionObserver sentinel for infinite scroll.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (mode !== "blueprints") return;
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreBlueprints();
      },
      { rootMargin: "400px 0px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [mode, loadMoreBlueprints]);

  // ---- Stages / Blocks (still mock, replaced in 3.5) ----
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
      ? blueprintRows.length
      : mode === "stages"
        ? filteredStages.length
        : filteredBlocks.length;

  const isLoading = mode === "blueprints" ? blueprintsLoading : false;

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
        <div className="flex flex-col">
          {filteredBlueprints.map((bp) => (
            <FeedCard key={bp.id} post={bp} />
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
