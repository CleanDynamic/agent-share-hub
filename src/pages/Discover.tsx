import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { stageDeepLink, blockDeepLink } from "@/lib/deepLink";
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
import { queryBlueprints, type QueryBlueprintsParams } from "@/lib/discover/queryBlueprints";
import { queryStages, type StageSearchResult } from "@/lib/discover/queryStages";
import { queryBlocks, type BlockSearchResult } from "@/lib/discover/queryBlocks";
import { useAuth } from "@/contexts/AuthContext";

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
const SINGLE_KEYS = [
  "domain",
  "difficulty",
  "length",
  "bountyStatus",
  "timeRange",
  "bountyRewardType",
  "bountyHasUnsolvedSlots",
  "bountyHealthScore",
] as const;
// Bool URL params ("1" / null).
const BOOL_KEYS = ["competitionsOnly"] as const;
const ALL_FILTER_KEYS = [...MULTI_KEYS, ...SINGLE_KEYS, ...BOOL_KEYS] as const;

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
    competitionsOnly: sp.get("competitionsOnly") === "1",
    bountyRewardType: sp.get("bountyRewardType"),
    bountyHasUnsolvedSlots: sp.get("bountyHasUnsolvedSlots"),
    bountyHealthScore: sp.get("bountyHealthScore"),
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
  patch.competitionsOnly = filters.competitionsOnly ? "1" : null;
  return patch;
}

const Discover = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { profile } = useAuth();
  const specialtyBoostTags = useMemo<string[] | undefined>(() => {
    const t = (profile?.user_interests ?? []).filter(Boolean) as string[];
    return t.length > 0 ? t : undefined;
  }, [profile?.user_interests]);

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
    if (filters.competitionsOnly) {
      out.push({ key: "competitionsOnly:1", label: "Competitions" });
    }
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
    const explicitPostType = filters.postTypes[0] as QueryBlueprintsParams["postType"] | undefined;
    const postType: QueryBlueprintsParams["postType"] | undefined = filters.competitionsOnly
      ? "bounty"
      : explicitPostType && ["blueprint", "blog", "bounty"].includes(explicitPostType)
        ? explicitPostType
        : undefined;
    return {
      query: urlQ,
      postType,
      blockTypes: filters.blockTypes.length ? filters.blockTypes : undefined,
      models: filters.models.length ? filters.models : undefined,
      tools: filters.tools.length ? filters.tools : undefined,
      tags: filters.tags.length ? filters.tags : undefined,
      domain: filters.domain ?? undefined,
      difficulty: filters.difficulty ?? undefined,
      length: (filters.length as QueryBlueprintsParams["length"]) ?? undefined,
      bountyStatus: (filters.bountyStatus as QueryBlueprintsParams["bountyStatus"]) ?? undefined,
      bountyRewardType: (filters.bountyRewardType as QueryBlueprintsParams["bountyRewardType"]) ?? undefined,
      bountyHasUnsolvedSlots:
        filters.bountyHasUnsolvedSlots === "Yes"
          ? true
          : filters.bountyHasUnsolvedSlots === "No"
            ? false
            : undefined,
      bountyHealthScore:
        (filters.bountyHealthScore as QueryBlueprintsParams["bountyHealthScore"]) ?? undefined,
      timeRange: (filters.timeRange as QueryBlueprintsParams["timeRange"]) ?? undefined,
      sort: SORT_LABEL_TO_KEY[sort] ?? "recent",
      specialtyBoostTags,
    };
  }, [urlQ, filters, sort, specialtyBoostTags]);

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

  // ---- Stages query (Phase 3.5) ----
  const stageBlockParams = useMemo(() => ({
    query: urlQ,
    blockTypes: filters.blockTypes.length ? filters.blockTypes : undefined,
    models: filters.models.length ? filters.models : undefined,
    tools: filters.tools.length ? filters.tools : undefined,
    tags: filters.tags.length ? filters.tags : undefined,
    domain: filters.domain ?? undefined,
    difficulty: filters.difficulty ?? undefined,
    length: (filters.length as QueryBlueprintsParams["length"]) ?? undefined,
    timeRange: (filters.timeRange as QueryBlueprintsParams["timeRange"]) ?? undefined,
    sort: SORT_LABEL_TO_KEY[sort] ?? "recent",
  }), [urlQ, filters, sort]);

  const [stageRows, setStageRows] = useState<StageSearchResult[]>([]);
  const [stagesLoading, setStagesLoading] = useState(false);
  const [stagesError, setStagesError] = useState<string | null>(null);
  const stageReqIdRef = useRef(0);
  useEffect(() => {
    if (mode !== "stages") return;
    const reqId = ++stageReqIdRef.current;
    setStagesLoading(true);
    setStagesError(null);
    queryStages({ ...stageBlockParams, limit: PAGE_SIZE, offset: 0 })
      .then((res) => {
        if (reqId !== stageReqIdRef.current) return;
        setStageRows(res.rows);
      })
      .catch((err) => {
        if (reqId !== stageReqIdRef.current) return;
        setStagesError(err?.message ?? "Failed to load stages");
        setStageRows([]);
      })
      .finally(() => {
        if (reqId === stageReqIdRef.current) setStagesLoading(false);
      });
  }, [mode, stageBlockParams]);

  const [blockRows, setBlockRows] = useState<BlockSearchResult[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [blocksError, setBlocksError] = useState<string | null>(null);
  const blockReqIdRef = useRef(0);
  useEffect(() => {
    if (mode !== "blocks") return;
    const reqId = ++blockReqIdRef.current;
    setBlocksLoading(true);
    setBlocksError(null);
    queryBlocks({ ...stageBlockParams, limit: PAGE_SIZE, offset: 0 })
      .then((res) => {
        if (reqId !== blockReqIdRef.current) return;
        setBlockRows(res.rows);
      })
      .catch((err) => {
        if (reqId !== blockReqIdRef.current) return;
        setBlocksError(err?.message ?? "Failed to load blocks");
        setBlockRows([]);
      })
      .finally(() => {
        if (reqId === blockReqIdRef.current) setBlocksLoading(false);
      });
  }, [mode, stageBlockParams]);

  const currentResultsCount =
    mode === "blueprints"
      ? blueprintRows.length
      : mode === "stages"
        ? stageRows.length
        : blockRows.length;

  const isLoading =
    mode === "blueprints" ? blueprintsLoading
    : mode === "stages" ? stagesLoading
    : blocksLoading;

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
          {blueprintRows.map((bp) => (
            <FeedCard key={bp.id} post={bp} />
          ))}
          {blueprintsError && (
            <div className="mt-4 rounded-lg p-3 text-[12px]" style={{ background: "rgba(239,68,68,0.10)", color: "#F87171", border: "1px solid rgba(239,68,68,0.25)" }}>
              {blueprintsError}
            </div>
          )}
          {/* Infinite-scroll sentinel */}
          <div ref={sentinelRef} style={{ height: 1 }} />
          {blueprintsLoadingMore && (
            <div className="mt-3">
              <DiscoverLoadingSkeleton count={2} />
            </div>
          )}
          {!blueprintsLoadingMore && blueprintRows.length >= blueprintTotal && blueprintTotal > 0 && (
            <div className="mt-4 text-center text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              End of results · {blueprintTotal} total
            </div>
          )}
        </div>
      );
    }

    if (mode === "stages") {
      return (
        <div className="flex flex-col gap-3">
          {stagesError && (
            <div className="rounded-lg p-3 text-[12px]" style={{ background: "rgba(239,68,68,0.10)", color: "#F87171", border: "1px solid rgba(239,68,68,0.25)" }}>
              {stagesError}
            </div>
          )}
          {stageRows.map((r) => (
            <StageResultCard
              key={r.stage.id}
              stage={{
                id: r.stage.id,
                name: r.stage.name,
                blocks: r.blocks.map((b) => ({
                  id: b.id,
                  type: b.type,
                  x: b.position_x,
                  y: b.position_y,
                  width: b.width,
                  height: b.height,
                })),
                connections: r.connections.map((c) => ({
                  from: c.from_block_id,
                  to: c.to_block_id,
                })),
              }}
              parent={{
                blueprintId: r.parent.blueprintId,
                blueprintTitle: r.parent.blueprintTitle,
                slug: r.parent.blueprintSlug ?? r.parent.blueprintId,
              }}
              author={{ name: r.author.name, handle: r.author.handle }}
              onClick={() => navigate(stageDeepLink(r.parent.blueprintId, r.stage.id))}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        {blocksError && (
          <div className="rounded-lg p-3 text-[12px]" style={{ background: "rgba(239,68,68,0.10)", color: "#F87171", border: "1px solid rgba(239,68,68,0.25)" }}>
            {blocksError}
          </div>
        )}
        {blockRows.map((r) => (
          <BlockResultCard
            key={r.block.id}
            block={{
              id: r.block.id,
              type: r.block.type,
              name: r.block.name,
              content: r.block.content,
              properties: r.block.properties,
            }}
            parent={{
              blueprintId: r.parent.blueprintId,
              blueprintTitle: r.parent.blueprintTitle,
              stageName: r.parent.stageName,
              slug: r.parent.blueprintSlug ?? r.parent.blueprintId,
            }}
            author={{ name: r.author.name, handle: r.author.handle }}
            referenceCount={r.referenceCount}
            onClick={() => navigate(blockDeepLink(r.parent.blueprintId, r.block.id))}
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
