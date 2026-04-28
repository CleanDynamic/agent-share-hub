import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SlidersHorizontal, Search } from "lucide-react";

type DiscoverMode = "blueprints" | "stages" | "blocks";
const MODES: DiscoverMode[] = ["blueprints", "stages", "blocks"];

// Filter param keys we accept from the URL (canonical state).
const FILTER_KEYS = [
  "domain",
  "difficulty",
  "blockTypes",
  "models",
  "tools",
  "tags",
  "length",
  "time",
  "postType",
  "bountyStatus",
  "sort",
] as const;

export interface DiscoverFilters {
  domain: string[];
  difficulty: string[];
  blockTypes: string[];
  models: string[];
  tools: string[];
  tags: string[];
  length: string | null;
  time: string | null;
  postType: string | null;
  bountyStatus: string | null;
  sort: string | null;
}

const MULTI_KEYS = new Set(["domain", "difficulty", "blockTypes", "models", "tools", "tags"]);

function parseFilters(sp: URLSearchParams): DiscoverFilters {
  const getMulti = (k: string) => {
    const raw = sp.get(k);
    if (!raw) return [];
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  };
  return {
    domain: getMulti("domain"),
    difficulty: getMulti("difficulty"),
    blockTypes: getMulti("blockTypes"),
    models: getMulti("models"),
    tools: getMulti("tools"),
    tags: getMulti("tags"),
    length: sp.get("length"),
    time: sp.get("time"),
    postType: sp.get("postType"),
    bountyStatus: sp.get("bountyStatus"),
    sort: sp.get("sort"),
  };
}

const Discover = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const modeParam = searchParams.get("mode") as DiscoverMode | null;
  const mode: DiscoverMode = MODES.includes(modeParam as DiscoverMode)
    ? (modeParam as DiscoverMode)
    : "blueprints";
  const q = searchParams.get("q") ?? "";
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  // Canonical updater — patches URL params, preserving everything else.
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

  const setMode = (m: DiscoverMode) => updateParams({ mode: m });
  const setQuery = (val: string) => updateParams({ q: val || null });

  return (
    <>
      <SeoHead
        title="Discover · NeoScale"
        description="Search and discover Blueprints, Stages, and Blocks."
      />
      <div
        className="mx-auto w-full px-4 py-6"
        style={{ maxWidth: 920 }}
      >
        {/* DiscoverSearchHeader placeholder — wired in 3.2 */}
        <div
          className="rounded-xl border p-4 mb-6"
          style={{
            background: "rgba(255,255,255,0.03)",
            borderColor: "rgba(255,255,255,0.08)",
          }}
          aria-label="Discover search header (placeholder)"
        >
          <div className="flex items-center gap-2 mb-3">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors"
                style={{
                  background:
                    mode === m
                      ? "rgba(232,87,26,0.15)"
                      : "rgba(255,255,255,0.04)",
                  color:
                    mode === m ? "#E8571A" : "rgba(255,255,255,0.65)",
                  border:
                    mode === m
                      ? "1px solid rgba(232,87,26,0.40)"
                      : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <Search size={14} style={{ color: "rgba(255,255,255,0.45)" }} />
              <input
                value={q}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${mode}…`}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "rgba(255,255,255,0.92)" }}
              />
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.75)",
              }}
            >
              <SlidersHorizontal size={14} />
              Filters
            </button>
          </div>
        </div>

        {/* Results placeholder */}
        <div
          className="rounded-xl border p-10 text-center"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderColor: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          <p className="text-sm">Results coming in 3.3</p>
          <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.30)" }}>
            mode=<code>{mode}</code>
            {q && <> · q=<code>{q}</code></>}
            {Object.entries(filters).some(([, v]) =>
              Array.isArray(v) ? v.length > 0 : Boolean(v),
            ) && <> · {FILTER_KEYS.filter((k) => searchParams.get(k)).length} filter(s)</>}
          </p>
        </div>
      </div>

      {/* Filter sheet placeholder — wired in 3.2 */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="right" className="w-[360px] sm:max-w-[360px]">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="mt-6 text-sm text-muted-foreground">
            Filter UI coming in 3.2.
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default Discover;
