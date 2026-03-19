import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { SeoHead } from "@/components/SeoHead";
import { Link, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, X, Clock, Users, Star, Eye } from "lucide-react";
import { FeedItem } from "@/components/FeedItem";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectCard } from "@/components/ProjectCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useApprovedToolNames, useGroupedApprovedTools } from "@/hooks/useApprovedTools";
import { useMicrotagDefinitions } from "@/hooks/useMicrotags";
import { SubmitToolModal } from "@/components/SubmitToolModal";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";

import { ORDERED_CONTENT_TYPES, SLUG_TO_TYPE, displayContentType } from "@/lib/content-types";

const ALL = "all";
const CONTENT_TYPES = ORDERED_CONTENT_TYPES;
const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced", "Any"];
const USE_CASES = ["Social Media", "Research", "Business", "Productivity", "Content", "Learning", "Email", "Finance", "Hobby", "Other"];

type BrowseTab = "blueprints" | "projects" | "collections";
type BlueprintSort = "recent" | "most-stars" | "rising";
type ProjectSort = "recent" | "most-stars" | "rising";
type CollectionSort = "recent" | "most-stars" | "largest";
type AnySort = BlueprintSort | ProjectSort | CollectionSort;

type TimePeriod = "1h" | "24h" | "7d" | "1m" | "3m" | "";
const TIME_PERIOD_OPTIONS: { value: TimePeriod; label: string }[] = [
  { value: "1h", label: "1 hour" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "1m", label: "1 month" },
  { value: "3m", label: "3 months" },
  { value: "", label: "Any time" },
];
const PERIOD_MS: Record<string, number> = {
  "1h": 3600000,
  "24h": 86400000,
  "7d": 7 * 86400000,
  "1m": 30 * 86400000,
  "3m": 90 * 86400000,
};
const PERIOD_LABELS: Record<string, string> = {
  "1h": "1 hour", "24h": "24 hours", "7d": "7 days", "1m": "1 month", "3m": "3 months",
};

function isWithinPeriod(dateStr: string | null, period: string): boolean {
  if (!period || !dateStr) return true;
  const ms = PERIOD_MS[period];
  if (!ms) return true;
  return Date.now() - new Date(dateStr).getTime() <= ms;
}

// Slug helpers
const TYPE_TO_SLUG: Record<string, string> = {};
Object.entries(SLUG_TO_TYPE).forEach(([slug, type]) => { TYPE_TO_SLUG[type] = slug; });

// ─── Data fetchers ───────────────────────────────────────────

async function fetchApprovedContent() {
  const { data, error } = await supabase
    .from("content_items")
    .select("*, profiles!content_items_creator_id_fkey(display_name, username)")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// ─── Skeletons ───────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="border border-border rounded-xl p-5 bg-card space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-24 rounded-md" />
        <Skeleton className="h-5 w-12 rounded-md" />
      </div>
      <Skeleton className="h-4 w-3/4 rounded-md" />
      <Skeleton className="h-3 w-full rounded-md" />
      <Skeleton className="h-3 w-5/6 rounded-md" />
    </div>
  );
}

// ─── Pill component ──────────────────────────────────────────

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-accent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Multi-select pill for filters ───────────────────────────

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors ${
        active
          ? "bg-primary/15 text-primary border-primary/30"
          : "bg-accent text-muted-foreground border-border hover:border-muted-foreground/40"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Learning Paths sub-tab ──────────────────────────────────

const DIFF_COLORS: Record<string, string> = {
  "Beginner only": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Beginner to Intermediate": "bg-secondary/15 text-secondary border-secondary/30",
  "Intermediate to Advanced": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "Beginner to Advanced": "bg-primary/15 text-primary border-primary/30",
};

// ─── Main component ─────────────────────────────────────────

const Browse = () => {
  const { isLoggedIn, profile } = useAuth();
  const { data: AI_TOOLS } = useApprovedToolNames();
  const { groups: toolGroups } = useGroupedApprovedTools();
  const { data: microtagDefs } = useMicrotagDefinitions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [submitToolOpen, setSubmitToolOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // ─── URL-driven state ────────────────────────────────────

  const readParam = useCallback((key: string, fallback: string) => searchParams.get(key) ?? fallback, [searchParams]);
  const readParamList = useCallback((key: string): string[] => {
    const v = searchParams.get(key);
    return v ? v.split(",").filter(Boolean) : [];
  }, [searchParams]);

  const browseTab = (readParam("tab", "blueprints") as BrowseTab);
  const sortMode = readParam("sort", "recent") as AnySort;
  const search = readParam("q", "");
  const matchInterests = readParam("for", "") === "me";

  // Blueprint filters
  const typeFilters = readParamList("type");
  const difficultyFilter = readParam("difficulty", "");
  const toolFilters = readParamList("tool");
  const useCaseFilters = readParamList("usecase");
  const microtagFilters = readParamList("tags");

  // Project/Collection filters
  const sizeFilter = readParam("size", "");
  const containsFilters = readParamList("contains");

  // Time period (all tabs)
  const timePeriod = readParam("period", "") as TimePeriod;

  // Setter that updates URL params
  const setParam = useCallback((key: string, value: string) => {
    const sp = new URLSearchParams(searchParams);
    if (!value || value === "all") { sp.delete(key); } else { sp.set(key, value); }
    setSearchParams(sp, { replace: true });
  }, [searchParams, setSearchParams]);

  const setParamList = useCallback((key: string, values: string[]) => {
    const sp = new URLSearchParams(searchParams);
    if (values.length === 0) { sp.delete(key); } else { sp.set(key, values.join(",")); }
    setSearchParams(sp, { replace: true });
  }, [searchParams, setSearchParams]);

  const toggleListParam = useCallback((key: string, value: string) => {
    const current = readParamList(key);
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    setParamList(key, next);
  }, [readParamList, setParamList]);

  const setTab = useCallback((tab: BrowseTab) => {
    const sp = new URLSearchParams();
    sp.set("tab", tab);
    setSearchParams(sp, { replace: true });
  }, [setSearchParams]);

  const setSort = useCallback((sort: string) => setParam("sort", sort), [setParam]);
  const setSearch = useCallback((q: string) => setParam("q", q), [setParam]);
  const setForMe = useCallback((v: boolean) => setParam("for", v ? "me" : ""), [setParam]);

  // ─── Active filter count ─────────────────────────────────

  const activeFilterCount = useMemo(() => {
    const tp = timePeriod ? 1 : 0;
    if (browseTab === "blueprints") {
      return typeFilters.length + (difficultyFilter ? 1 : 0) + toolFilters.length + useCaseFilters.length + microtagFilters.length + tp;
    }
    if (browseTab === "projects") {
      return containsFilters.length + (sizeFilter ? 1 : 0) + (difficultyFilter ? 1 : 0) + tp;
    }
    // collections
    return containsFilters.length + (sizeFilter ? 1 : 0) + tp;
  }, [browseTab, typeFilters, difficultyFilter, toolFilters, useCaseFilters, microtagFilters, containsFilters, sizeFilter, timePeriod]);

  // Active filter chips
  const activeChips = useMemo(() => {
    const chips: { label: string; key: string; value: string }[] = [];
    if (timePeriod) chips.push({ label: PERIOD_LABELS[timePeriod] || timePeriod, key: "period", value: timePeriod });
    if (browseTab === "blueprints") {
      typeFilters.forEach((t) => chips.push({ label: displayContentType(SLUG_TO_TYPE[t] || t), key: "type", value: t }));
      if (difficultyFilter) chips.push({ label: difficultyFilter, key: "difficulty", value: difficultyFilter });
      toolFilters.forEach((t) => chips.push({ label: t, key: "tool", value: t }));
      useCaseFilters.forEach((u) => chips.push({ label: u, key: "usecase", value: u }));
      microtagFilters.forEach((m) => chips.push({ label: m, key: "tags", value: m }));
    } else if (browseTab === "projects") {
      if (difficultyFilter) chips.push({ label: difficultyFilter, key: "difficulty", value: difficultyFilter });
      containsFilters.forEach((c) => chips.push({ label: displayContentType(SLUG_TO_TYPE[c] || c), key: "contains", value: c }));
      if (sizeFilter) chips.push({ label: sizeFilter, key: "size", value: sizeFilter });
    } else {
      containsFilters.forEach((c) => chips.push({ label: displayContentType(SLUG_TO_TYPE[c] || c), key: "contains", value: c }));
      if (sizeFilter) chips.push({ label: sizeFilter, key: "size", value: sizeFilter });
    }
    return chips;
  }, [browseTab, typeFilters, difficultyFilter, toolFilters, useCaseFilters, microtagFilters, containsFilters, sizeFilter, timePeriod]);

  const removeChip = useCallback((chip: { key: string; value: string }) => {
    if (chip.key === "difficulty" || chip.key === "size" || chip.key === "period") {
      setParam(chip.key, "");
    } else {
      toggleListParam(chip.key, chip.value);
    }
  }, [setParam, toggleListParam]);

  const clearAllFilters = useCallback(() => {
    const sp = new URLSearchParams(searchParams);
    ["type", "difficulty", "tool", "usecase", "tags", "size", "contains", "period"].forEach((k) => sp.delete(k));
    setSearchParams(sp, { replace: true });
  }, [searchParams, setSearchParams]);

  // ─── Profile data for "For me" ───────────────────────────

  const { data: fullProfile } = useQuery({
    queryKey: ["browse_profile", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_interests, user_ai_tools")
        .eq("id", profile!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.id && isLoggedIn,
  });

  const hasInterests = isLoggedIn && fullProfile && (
    ((fullProfile as any).user_interests ?? []).length > 0 ||
    ((fullProfile as any).user_ai_tools ?? []).length > 0
  );

  // ─── BLUEPRINTS data ─────────────────────────────────────

  const { data: items, isLoading: blueprintsLoading, error: blueprintsError } = useQuery({
    queryKey: ["content_items_approved"],
    queryFn: fetchApprovedContent,
  });

  const itemIds = (items ?? []).map((i) => i.id);
  const { data: allMicrotagsMap } = useQuery({
    queryKey: ["browse_microtags", itemIds.length],
    queryFn: async () => {
      if (itemIds.length === 0) return new Map<string, string[]>();
      const { data } = await supabase
        .from("content_microtags")
        .select("content_id, tag")
        .in("content_id", itemIds.slice(0, 500));
      const map = new Map<string, string[]>();
      (data ?? []).forEach((r: any) => {
        const arr = map.get(r.content_id) ?? [];
        arr.push(r.tag);
        map.set(r.content_id, arr);
      });
      return map;
    },
    enabled: itemIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const filteredBlueprints = useMemo(() => {
    if (!items) return [];
    const now = Date.now();

    let base = items.filter((item) => {
      const q = search.toLowerCase();
      if (q) {
        const fields = [item.title, item.description ?? "", item.content_type, ((item as any).what_to_expect ?? ""), ((item as any).custom_use_case_description ?? "")];
        const inFields = fields.some((f) => f.toLowerCase().includes(q));
        const inTools = (item.ai_tools ?? []).some((t: string) => t.toLowerCase().includes(q));
        const inUseCases = (item.use_cases ?? []).some((u) => u.toLowerCase().includes(q));
        if (!inFields && !inTools && !inUseCases) return false;
      }
      if (typeFilters.length > 0) {
        const dbTypes = typeFilters.map((slug) => SLUG_TO_TYPE[slug] || slug);
        if (!dbTypes.includes(item.content_type)) return false;
      }
      if (difficultyFilter && item.difficulty !== difficultyFilter) return false;
      if (toolFilters.length > 0 && !toolFilters.some((t) => (item.ai_tools ?? []).includes(t))) return false;
      if (useCaseFilters.length > 0 && !useCaseFilters.some((u) => (item.use_cases ?? []).includes(u))) return false;
      if (matchInterests && fullProfile) {
        const interests = (fullProfile as any).user_interests ?? [];
        const tools = (fullProfile as any).user_ai_tools ?? [];
        const matchesInterest = (item.use_cases ?? []).some((u: string) => interests.includes(u));
        const matchesTool = (item.ai_tools ?? []).some((t: string) => tools.includes(t));
        if (!matchesInterest && !matchesTool) return false;
      }
      if (microtagFilters.length > 0 && allMicrotagsMap) {
        const itemTags = allMicrotagsMap.get(item.id) ?? [];
        if (!microtagFilters.every((mt) => itemTags.includes(mt))) return false;
      }
      return true;
    });

    // Sort
    if (sortMode === "most-stars") {
      const rated = base.filter((i) => i.rating_count > 0).sort((a, b) => {
        if (b.avg_rating !== a.avg_rating) return Number(b.avg_rating) - Number(a.avg_rating);
        return b.rating_count - a.rating_count;
      });
      const unrated = base.filter((i) => i.rating_count === 0).sort((a, b) =>
        new Date(b.approved_at || b.created_at).getTime() - new Date(a.approved_at || a.created_at).getTime()
      );
      return [...rated, ...unrated];
    }
    if (sortMode === "rising") {
      const sevenDaysAgo = now - 7 * 86400000;
      const thirtyDaysAgo = now - 30 * 86400000;
      let risingItems = base.filter((i) => new Date(i.approved_at || i.created_at).getTime() > sevenDaysAgo);
      if (risingItems.length < 10) {
        risingItems = base.filter((i) => new Date(i.approved_at || i.created_at).getTime() > thirtyDaysAgo);
      }
      return risingItems.map((item) => {
        const hoursOld = (now - new Date(item.approved_at || item.created_at).getTime()) / 3600000;
        const score = (item.download_count + item.view_count + item.rating_count + item.comment_count) / Math.pow(hoursOld + 1, 0.8);
        return { ...item, _score: score };
      }).sort((a, b) => b._score - a._score);
    }
    // recent
    return base.sort((a, b) => new Date(b.approved_at || b.created_at).getTime() - new Date(a.approved_at || a.created_at).getTime());
  }, [items, search, typeFilters, difficultyFilter, toolFilters, useCaseFilters, matchInterests, fullProfile, microtagFilters, allMicrotagsMap, sortMode, timePeriod]);

  // ─── PROJECTS data ────────────────────────────────────────

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects_approved"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, profiles(id, username, display_name), project_components(id, component_type, linked_content_id, inline_content_id)")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: browseTab === "projects",
  });

  const projectContentIds = (projects ?? []).flatMap((p: any) =>
    (p.project_components ?? []).map((c: any) => c.linked_content_id || c.inline_content_id).filter(Boolean)
  );
  const { data: projectContentItems } = useQuery({
    queryKey: ["project_content_types", projectContentIds.join(",")],
    queryFn: async () => {
      if (projectContentIds.length === 0) return [];
      const { data } = await supabase
        .from("content_items")
        .select("id, content_type, avg_rating, rating_count")
        .in("id", projectContentIds);
      return data ?? [];
    },
    enabled: projectContentIds.length > 0,
  });

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    const now = Date.now();

    let base = projects.filter((p: any) => {
      const q = search.toLowerCase();
      if (q && !p.title.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;

      // Size filter
      const compCount = (p.project_components ?? []).length;
      if (sizeFilter === "small" && (compCount < 1 || compCount > 3)) return false;
      if (sizeFilter === "medium" && (compCount < 4 || compCount > 7)) return false;
      if (sizeFilter === "large" && compCount < 8) return false;

      // Contains filter
      if (containsFilters.length > 0 && projectContentItems) {
        const compIds = (p.project_components ?? []).map((c: any) => c.linked_content_id || c.inline_content_id).filter(Boolean);
        const types = compIds.map((cid: string) => projectContentItems.find((ci: any) => ci.id === cid)?.content_type).filter(Boolean);
        const dbTypes = containsFilters.map((slug) => SLUG_TO_TYPE[slug] || slug);
        if (!dbTypes.some((dt) => types.includes(dt))) return false;
      }

      if (timePeriod && !isWithinPeriod(p.created_at, timePeriod)) return false;

      return true;
    });

    if (sortMode === "most-stars" && projectContentItems) {
      return base.map((p: any) => {
        const compIds = (p.project_components ?? []).map((c: any) => c.linked_content_id || c.inline_content_id).filter(Boolean);
        const ratedItems = compIds.map((cid: string) => projectContentItems.find((ci: any) => ci.id === cid)).filter((ci: any) => ci && ci.rating_count > 0);
        const accRating = ratedItems.length > 0 ? ratedItems.reduce((sum: number, ci: any) => sum + Number(ci.avg_rating), 0) / ratedItems.length : 0;
        return { ...p, _accRating: accRating, _ratedCount: ratedItems.length };
      }).sort((a: any, b: any) => {
        if (b._accRating !== a._accRating) return b._accRating - a._accRating;
        if (b._ratedCount !== a._ratedCount) return b._ratedCount - a._ratedCount;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    if (sortMode === "rising") {
      const sevenDaysAgo = now - 7 * 86400000;
      let rising = base.filter((p: any) => new Date(p.created_at).getTime() > sevenDaysAgo);
      if (rising.length < 10) rising = base;
      return rising.map((p: any) => {
        const hoursOld = (now - new Date(p.created_at).getTime()) / 3600000;
        return { ...p, _score: (p.view_count ?? 0) / Math.pow(hoursOld + 1, 0.8) };
      }).sort((a: any, b: any) => b._score - a._score);
    }
    // recent
    return base.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [projects, search, sizeFilter, containsFilters, projectContentItems, sortMode]);

  // ─── COLLECTIONS data ─────────────────────────────────────

  const { data: collections, isLoading: collectionsLoading } = useQuery({
    queryKey: ["browse_collections_unified"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("*, profiles!collections_owner_id_fkey(display_name, username)")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: browseTab === "collections",
  });

  // Fetch collection items content types for contains filter
  const collectionIds = (collections ?? []).map((c) => c.id);
  const { data: collectionItemsData } = useQuery({
    queryKey: ["browse_collection_items_types", collectionIds.join(",")],
    queryFn: async () => {
      if (collectionIds.length === 0) return [];
      const { data: ciData } = await supabase
        .from("collection_items")
        .select("collection_id, content_id")
        .in("collection_id", collectionIds);
      if (!ciData || ciData.length === 0) return [];
      const contentIds = [...new Set(ciData.map((r) => r.content_id))];
      const { data: contentData } = await supabase
        .from("content_items")
        .select("id, content_type, avg_rating, rating_count")
        .in("id", contentIds.slice(0, 500));
      return ciData.map((ci) => ({
        ...ci,
        content: contentData?.find((cd) => cd.id === ci.content_id),
      }));
    },
    enabled: collectionIds.length > 0,
  });

  const filteredCollections = useMemo(() => {
    if (!collections) return [];

    let base = collections.filter((col: any) => {
      const q = search.toLowerCase();
      if (q && !col.title.toLowerCase().includes(q) && !(col.description ?? "").toLowerCase().includes(q)) return false;

      // Size filter
      const count = col.item_count ?? 0;
      if (sizeFilter === "small" && (count < 1 || count > 3)) return false;
      if (sizeFilter === "medium" && (count < 4 || count > 9)) return false;
      if (sizeFilter === "large" && count < 10) return false;

      // Contains filter
      if (containsFilters.length > 0 && collectionItemsData) {
        const colItems = collectionItemsData.filter((ci: any) => ci.collection_id === col.id);
        const types = colItems.map((ci: any) => ci.content?.content_type).filter(Boolean);
        const dbTypes = containsFilters.map((slug) => SLUG_TO_TYPE[slug] || slug);
        if (!dbTypes.some((dt) => types.includes(dt))) return false;
      }

      return true;
    });

    if (sortMode === "most-stars" && collectionItemsData) {
      return base.map((col: any) => {
        const colItems = collectionItemsData.filter((ci: any) => ci.collection_id === col.id);
        const rated = colItems.filter((ci: any) => ci.content && ci.content.rating_count > 0);
        const accRating = rated.length > 0 ? rated.reduce((sum: number, ci: any) => sum + Number(ci.content.avg_rating), 0) / rated.length : 0;
        return { ...col, _accRating: accRating, _ratedCount: rated.length };
      }).sort((a: any, b: any) => {
        if (b._accRating !== a._accRating) return b._accRating - a._accRating;
        if (b._ratedCount !== a._ratedCount) return b._ratedCount - a._ratedCount;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    if (sortMode === "largest") {
      return base.sort((a: any, b: any) => {
        if (b.item_count !== a.item_count) return b.item_count - a.item_count;
        return b.follower_count - a.follower_count;
      });
    }
    // recent
    return base.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [collections, search, sizeFilter, containsFilters, collectionItemsData, sortMode]);

  // ─── Sort options per tab ─────────────────────────────────

  const sortOptions: { value: string; label: string }[] = useMemo(() => {
    if (browseTab === "collections") {
      return [
        { value: "recent", label: "Recent" },
        { value: "most-stars", label: "Most ⭐" },
        { value: "largest", label: "Largest" },
      ];
    }
    return [
      { value: "recent", label: "Recent" },
      { value: "most-stars", label: "Most ⭐" },
      { value: "rising", label: "Rising" },
    ];
  }, [browseTab]);

  // Result count
  const resultCount = browseTab === "blueprints" ? filteredBlueprints.length
    : browseTab === "projects" ? filteredProjects.length
    : filteredCollections.length;

  const isLoading = browseTab === "blueprints" ? blueprintsLoading
    : browseTab === "projects" ? projectsLoading
    : collectionsLoading;

  // Search placeholder per tab
  const searchPlaceholder = browseTab === "blueprints" ? "Search blueprints..."
    : browseTab === "projects" ? "Search projects..."
    : "Search collections...";

  // ─── Filter Drawer Content ────────────────────────────────

  function FilterDrawerBody() {
    if (browseTab === "blueprints") {
      return (
        <div className="space-y-5 pb-4">
          {/* Type */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Type</p>
            <div className="flex flex-wrap gap-1.5">
              {CONTENT_TYPES.map((t) => {
                const slug = TYPE_TO_SLUG[t] || t;
                return (
                  <FilterPill key={t} active={typeFilters.includes(slug)} onClick={() => toggleListParam("type", slug)}>
                    {displayContentType(t)}
                  </FilterPill>
                );
              })}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Difficulty</p>
            <div className="flex flex-wrap gap-1.5">
              {DIFFICULTIES.map((d) => (
                <FilterPill key={d} active={difficultyFilter === d} onClick={() => setParam("difficulty", difficultyFilter === d ? "" : d)}>
                  {d}
                </FilterPill>
              ))}
            </div>
          </div>

          {/* AI Tools */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Works with</p>
            {toolGroups.map((group) => (
              <div key={group.category} className="mb-2">
                <p className="text-[10px] text-muted-foreground mb-1">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.tools.map((tool) => (
                    <FilterPill key={tool.name} active={toolFilters.includes(tool.name)} onClick={() => toggleListParam("tool", tool.name)}>
                      {tool.name}
                    </FilterPill>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={() => setSubmitToolOpen(true)} className="text-[11px] text-primary/80 hover:underline mt-1">
              Don't see your AI tool? Submit it →
            </button>
          </div>

          {/* Use Cases */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Use case</p>
            <div className="flex flex-wrap gap-1.5">
              {USE_CASES.map((u) => (
                <FilterPill key={u} active={useCaseFilters.includes(u)} onClick={() => toggleListParam("usecase", u)}>
                  {u}
                </FilterPill>
              ))}
            </div>
          </div>

          {/* Tags */}
          {(microtagDefs ?? []).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {(microtagDefs ?? []).map((mt) => (
                  <FilterPill key={mt.tag} active={microtagFilters.includes(mt.tag)} onClick={() => toggleListParam("tags", mt.tag)}>
                    {mt.tag}
                  </FilterPill>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (browseTab === "projects") {
      return (
        <div className="space-y-5 pb-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Project difficulty</p>
            <div className="flex flex-wrap gap-1.5">
              {["Beginner", "Intermediate", "Advanced"].map((d) => (
                <FilterPill key={d} active={difficultyFilter === d} onClick={() => setParam("difficulty", difficultyFilter === d ? "" : d)}>
                  {d}
                </FilterPill>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Contains blueprint type</p>
            <div className="flex flex-wrap gap-1.5">
              {CONTENT_TYPES.map((t) => {
                const slug = TYPE_TO_SLUG[t] || t;
                return (
                  <FilterPill key={t} active={containsFilters.includes(slug)} onClick={() => toggleListParam("contains", slug)}>
                    {displayContentType(t)}
                  </FilterPill>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Size</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: "small", label: "Small (1-3)" },
                { value: "medium", label: "Medium (4-7)" },
                { value: "large", label: "Large (8+)" },
              ].map((s) => (
                <FilterPill key={s.value} active={sizeFilter === s.value} onClick={() => setParam("size", sizeFilter === s.value ? "" : s.value)}>
                  {s.label}
                </FilterPill>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Collections
    return (
      <div className="space-y-5 pb-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Collection size</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { value: "small", label: "Small (1-3)" },
              { value: "medium", label: "Medium (4-9)" },
              { value: "large", label: "Large (10+)" },
            ].map((s) => (
              <FilterPill key={s.value} active={sizeFilter === s.value} onClick={() => setParam("size", sizeFilter === s.value ? "" : s.value)}>
                {s.label}
              </FilterPill>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Contains blueprint type</p>
          <div className="flex flex-wrap gap-1.5">
            {CONTENT_TYPES.map((t) => {
              const slug = TYPE_TO_SLUG[t] || t;
              return (
                <FilterPill key={t} active={containsFilters.includes(slug)} onClick={() => toggleListParam("contains", slug)}>
                  {displayContentType(t)}
                </FilterPill>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER ───────────────────────────────────────────────

  return (
    <div className="py-10 px-4 sm:px-6">
      <SeoHead
        title="Discover AI Blueprints — NeoScale AI"
        description="Find ready-made AI setups for any task. Filter by type, difficulty, and the AI tools you already use. Free to download."
        path="/browse"
      />
      <div className="mx-auto max-w-5xl">
        {/* Tab bar */}
        <div className="flex gap-1 mb-4">
          {([
            { value: "blueprints" as BrowseTab, label: "Blueprints" },
            { value: "projects" as BrowseTab, label: "Projects" },
            { value: "collections" as BrowseTab, label: "Collections" },
          ]).map((tab) => (
            <button
              key={tab.value}
              onClick={() => setTab(tab.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                browseTab === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── UNIFIED CONTROL BAR ─────────────────────────── */}

        {/* ROW 1: Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 bg-card border-border text-foreground placeholder:text-muted-foreground rounded-full"
          />
        </div>

        {/* ROW 2: Interest toggle + Sort pills */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex gap-1">
            {hasInterests && (
              <>
                <Pill active={!matchInterests} onClick={() => setForMe(false)}>All</Pill>
                <Pill active={matchInterests} onClick={() => setForMe(true)}>For me</Pill>
              </>
            )}
          </div>
          <div className="flex gap-1">
            {sortOptions.map((opt) => (
              <Pill key={opt.value} active={sortMode === opt.value} onClick={() => setSort(opt.value)}>
                {opt.label}
              </Pill>
            ))}
          </div>
        </div>

        {/* ROW 3: Filters button + result count */}
        <div className="flex items-center justify-between mb-2">
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="border-border text-muted-foreground hover:text-foreground"
              onClick={() => setFilterDrawerOpen(true)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </Button>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-medium">
                {activeFilterCount}
              </span>
            )}
          </div>
          {!isLoading && (
            <p className="text-[12px] text-muted-foreground">
              Showing {resultCount} result{resultCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3 overflow-x-auto scrollbar-hide">
            {activeChips.map((chip, i) => (
              <span
                key={`${chip.key}-${chip.value}-${i}`}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-xl bg-accent text-muted-foreground border border-border"
              >
                {chip.label}
                <button onClick={() => removeChip(chip)} className="hover:text-foreground"><X className="h-3 w-3" /></button>
              </span>
            ))}
            {activeChips.length >= 2 && (
              <button
                onClick={clearAllFilters}
                className="text-[11px] px-2 py-1 rounded-xl text-primary hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* ─── FILTER DRAWER ───────────────────────────────── */}
        <Drawer open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
          <DrawerContent className="bg-card border-border max-h-[70vh]">
            <DrawerHeader className="flex items-center justify-between px-4 py-3">
              <DrawerTitle className="text-base font-bold text-foreground">Filters</DrawerTitle>
              <div className="flex items-center gap-3">
                {activeFilterCount > 0 && (
                  <button onClick={clearAllFilters} className="text-[13px] text-primary hover:underline">Clear all</button>
                )}
                <DrawerClose asChild>
                  <button className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </DrawerClose>
              </div>
            </DrawerHeader>
            <ScrollArea className="px-4 flex-1 overflow-y-auto">
              <FilterDrawerBody />
            </ScrollArea>
            <div className="p-4 border-t border-border">
              <Button className="w-full h-10" onClick={() => setFilterDrawerOpen(false)}>
                Show {resultCount} result{resultCount !== 1 ? "s" : ""}
              </Button>
            </div>
          </DrawerContent>
        </Drawer>

        {/* ─── TAB CONTENT ─────────────────────────────────── */}

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        )}

        {/* BLUEPRINTS TAB */}
        {browseTab === "blueprints" && !blueprintsLoading && !blueprintsError && (
          <>
            {filteredBlueprints.length > 0 ? (
              <div className="border-t border-border">
                {filteredBlueprints.map((item) => {
                  const toolsArr = (item.ai_tools ?? []) as string[];
                  const useCasesArr = (item.use_cases ?? []) as string[];
                  return (
                    <div key={item.id}>
                      <FeedItem item={item} context="browse" />
                      {(toolsArr.length > 0 || useCasesArr.length > 0) && (
                        <div className="px-4 pb-2 -mt-1 border-b border-border">
                          {toolsArr.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-[2px]">
                              {toolsArr.slice(0, 4).map((t) => (
                                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{t}</span>
                              ))}
                              {toolsArr.length > 4 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">+{toolsArr.length - 4} more</span>}
                            </div>
                          )}
                          {useCasesArr.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {useCasesArr.slice(0, 3).map((u, i) => {
                                const label = u === "Other" && (item as any).custom_use_case_description ? (item as any).custom_use_case_description : u;
                                return <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{label}</span>;
                              })}
                              {useCasesArr.length > 3 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">+{useCasesArr.length - 3} more</span>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState search={search} hasFilters={activeFilterCount > 0 || matchInterests} onClear={clearAllFilters} />
            )}
          </>
        )}

        {blueprintsError && browseTab === "blueprints" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-sm text-muted-foreground text-center">Something went wrong loading content.</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Reload</Button>
          </div>
        )}

        {/* PROJECTS TAB */}
        {browseTab === "projects" && !projectsLoading && (
          <>
            {filteredProjects.length > 0 ? (
              <div className="space-y-3">
                {filteredProjects.map((proj: any) => {
                  const creator = proj.profiles as { id: string; username: string; display_name: string | null } | null;
                  const compIds = (proj.project_components ?? []).map((c: any) => c.linked_content_id || c.inline_content_id).filter(Boolean);
                  const types = [...new Set(
                    compIds.map((cid: string) => projectContentItems?.find((ci: any) => ci.id === cid)?.content_type).filter(Boolean)
                  )] as string[];

                  return (
                    <ProjectCard
                      key={proj.id}
                      id={proj.id}
                      title={proj.title}
                      description={proj.description}
                      coverImageUrl={null}
                      creatorDisplayName={creator?.display_name || creator?.username || "Unknown"}
                      creatorUsername={creator?.username || ""}
                      componentTypes={types}
                      componentCount={(proj.project_components ?? []).length}
                      viewCount={proj.view_count}
                    />
                  );
                })}
              </div>
            ) : (
              <EmptyState search={search} hasFilters={activeFilterCount > 0} onClear={clearAllFilters} />
            )}
          </>
        )}

        {/* COLLECTIONS TAB */}
        {browseTab === "collections" && !collectionsLoading && (
          <>
            {filteredCollections.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCollections.map((col: any) => {
                  const owner = col.profiles as any;
                  return (
                    <Link
                      key={col.id}
                      to={`/collections/${col.slug}`}
                      className="border border-border rounded-xl p-5 bg-card hover:border-primary/40 transition-colors block"
                    >
                      <h3 className="text-sm font-semibold text-foreground mb-0.5 truncate">{col.title}</h3>
                      {owner && (
                        <p className="text-[10px] text-muted-foreground mb-1">
                          by {owner.display_name || owner.username}
                        </p>
                      )}
                      {col.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{col.description}</p>
                      )}
                      <div className="flex gap-3 text-[10px] text-muted-foreground pt-2 border-t border-border">
                        <span>{col.item_count} items</span>
                        <span>{col.follower_count} followers</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyState search={search} hasFilters={activeFilterCount > 0} onClear={clearAllFilters} />
            )}
          </>
        )}
      </div>

      <SubmitToolModal open={submitToolOpen} onOpenChange={setSubmitToolOpen} />
    </div>
  );
};

function EmptyState({ search, hasFilters, onClear }: { search: string; hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      {hasFilters || search ? (
        <>
          <p className="text-sm text-muted-foreground text-center max-w-md">Nothing matches those filters.</p>
          <Button variant="outline" size="sm" onClick={onClear}>Clear all filters</Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground text-center max-w-md">Nothing here yet — be the first to share something.</p>
          <Button size="sm" asChild><Link to="/upload">Upload your work</Link></Button>
        </>
      )}
    </div>
  );
}

export default Browse;
