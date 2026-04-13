import { ContentCard } from "@/components/ContentCard";
import { LibraryEmptyState } from "./LibraryEmptyState";

interface LibraryGridProps {
  items: any[];
  isLoading: boolean;
  isSearching: boolean;
  viewMode: "grid" | "list";
}

function SkeletonCard() {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div className="space-y-3 animate-pulse">
        <div
          className="rounded-md"
          style={{
            height: 14,
            width: 80,
            background: "rgba(255,255,255,0.06)",
          }}
        />
        <div
          className="rounded-md"
          style={{
            height: 12,
            width: "75%",
            background: "rgba(255,255,255,0.04)",
          }}
        />
        <div
          className="rounded-md"
          style={{
            height: 10,
            width: "100%",
            background: "rgba(255,255,255,0.03)",
          }}
        />
        <div className="flex items-center gap-2 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div
            className="rounded-full"
            style={{
              height: 10,
              width: 48,
              background: "rgba(255,255,255,0.05)",
            }}
          />
          <div
            className="rounded-full"
            style={{
              height: 10,
              width: 36,
              background: "rgba(255,255,255,0.04)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function LibraryGrid({
  items,
  isLoading,
  isSearching,
  viewMode,
}: LibraryGridProps) {
  if (isLoading) {
    return (
      <div
        className={
          viewMode === "list"
            ? "flex flex-col gap-3"
            : "grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
        }
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <LibraryEmptyState isSearching={isSearching} />;
  }

  return (
    <div
      className={
        viewMode === "list"
          ? "flex flex-col gap-3"
          : "grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      }
    >
      {items.map((lib: any) => {
        const item = lib.content_items;
        if (!item) return null;
        return (
          <div
            key={lib.id}
            className="relative group"
            style={{
              background: "rgba(255,255,255,0.015)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 14,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.border =
                "1px solid rgba(255,255,255,0.12)";
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow =
                "0 8px 32px rgba(0,0,0,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.border =
                "1px solid rgba(255,255,255,0.05)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {lib.has_update && (
              <div
                className="absolute -top-1.5 -right-1.5 z-10 h-3 w-3 rounded-full"
                style={{
                  background: "#8B4513",
                  boxShadow: "0 0 8px rgba(139,69,19,0.5)",
                }}
              />
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
              libraryMode
            />
            {lib.has_update && (
              <p
                className="px-5 pb-3 -mt-1"
                style={{
                  fontSize: 11,
                  color: "#8B4513",
                  fontWeight: 500,
                }}
              >
                Updated since you saved this
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
