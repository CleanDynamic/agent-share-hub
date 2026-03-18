import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentCard } from "@/components/ContentCard";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Library, Search } from "lucide-react";
import { Link } from "react-router-dom";

import { ORDERED_CONTENT_TYPES, displayContentType } from "@/lib/content-types";
const CONTENT_TYPES = ["All", ...ORDERED_CONTENT_TYPES];

type StatusFilter = "all" | "updated" | "new";

export default function LibraryPage() {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data: libraryItems, isLoading } = useQuery({
    queryKey: ["user_library", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_library")
        .select("id, content_id, added_at, has_update, last_seen_version, content_items(*)")
        .eq("user_id", profile!.id)
        .order("added_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!profile?.id,
  });

  const sevenDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }, []);

  const filtered = useMemo(() => {
    if (!libraryItems) return [];
    return libraryItems.filter((lib) => {
      const item = lib.content_items;
      if (!item) return false;

      // Search
      if (search) {
        const q = search.toLowerCase();
        if (
          !item.title?.toLowerCase().includes(q) &&
          !item.description?.toLowerCase().includes(q)
        )
          return false;
      }

      // Type filter
      if (typeFilter !== "All" && item.content_type !== typeFilter) return false;

      // Status filter
      if (statusFilter === "updated" && !lib.has_update) return false;
      if (statusFilter === "new" && lib.added_at < sevenDaysAgo) return false;

      return true;
    });
  }, [libraryItems, search, typeFilter, statusFilter, sevenDaysAgo]);

  const updateCount = libraryItems?.filter((l) => l.has_update).length ?? 0;

  return (
    <div className="py-12 px-6">
      <SeoHead
        title="Your Library — NeoScale AI"
        description="Your personal content library on NeoScale AI."
        path="/library"
        noIndex
      />
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold text-foreground mb-1">Your Library</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {libraryItems?.length ?? 0} item{(libraryItems?.length ?? 0) !== 1 ? "s" : ""}
          {updateCount > 0 && (
            <span className="ml-2 text-primary font-medium">
              · {updateCount} updated
            </span>
          )}
        </p>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your library..."
            className="pl-9 bg-card border-border"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {(["all", "updated", "new"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "all" ? "All" : s === "updated" ? "Updated" : "New"}
            </button>
          ))}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="border border-border rounded-xl p-5 bg-card space-y-3"
              >
                <Skeleton className="h-5 w-24 rounded-md" />
                <Skeleton className="h-4 w-3/4 rounded-md" />
                <Skeleton className="h-3 w-full rounded-md" />
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((lib) => {
              const item = lib.content_items;
              if (!item) return null;
              return (
                <div key={lib.id} className="relative">
                  {lib.has_update && (
                    <div className="absolute -top-1.5 -right-1.5 z-10 h-3 w-3 rounded-full bg-primary" />
                  )}
                  <ContentCard
                    id={item.id}
                    content_type={item.content_type}
                    title={item.title}
                    description={item.description ?? ""}
                    difficulty={item.difficulty}
                    ai_tools={item.ai_tools ?? []}
                    download_count={item.download_count}
                    monetisation_type={item.monetisation_type}
                    price_gbp={item.price_gbp ?? undefined}
                    avg_rating={Number(item.avg_rating) || 0}
                    rating_count={item.rating_count ?? 0}
                    view_count={item.view_count ?? 0}
                  />
                  {lib.has_update && (
                    <p className="text-[11px] text-primary mt-1 px-1">
                      Updated since you saved this
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Library className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-sm text-foreground font-medium mb-1">
              Your library is empty.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Add content using the shelf icon on any post.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/browse">Browse content</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
