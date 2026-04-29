import * as React from "react";
import {
  Heart,
  MessageSquare,
  Repeat2,
  ChevronDown,
  Loader2,
  MoreHorizontal,
  Bookmark,
  Share2,
  Pencil,
  EyeOff,
  Trash2,
  Plus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ZoneItem } from "@/lib/profile/types";

export type Zone = "authored" | "curated" | "activity" | "network";

export interface ZoneCounts {
  authored: number;
  curated: number;
  activity: number;
  network: number;
}

export interface ProfileContentZonesProps {
  activeZone: Zone;
  onZoneChange: (zone: Zone) => void;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  sort: string;
  onSortChange: (sort: string) => void;
  counts: ZoneCounts;
  items: ZoneItem[];
  isLoading: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onItemClick: (item: ZoneItem) => void;
  isOwnProfile: boolean;
  // Affordances
  onMakeCollection?: () => void;
  onCreateBlueprint?: () => void;
  // Item-level menu actions
  onEditItem?: (item: ZoneItem) => void;
  onUnpublishItem?: (item: ZoneItem) => void;
  onDeleteItem?: (item: ZoneItem) => void;
  onBookmarkItem?: (item: ZoneItem) => void;
  onRepostItem?: (item: ZoneItem) => void;
  onShareItem?: (item: ZoneItem) => void;
}

const ZONE_FILTERS: Record<Zone, { label: string; value: string }[]> = {
  authored: [
    { label: "All", value: "all" },
    { label: "Blueprints", value: "blueprint" },
    { label: "Blogs", value: "blog" },
    { label: "Bounties", value: "bounty" },
    { label: "Solutions accepted", value: "solution" },
  ],
  curated: [
    { label: "All", value: "all" },
    { label: "Bookmarks", value: "save" },
    { label: "Collections", value: "collection" },
  ],
  activity: [
    { label: "All", value: "all" },
    { label: "Ratings", value: "rating" },
    { label: "Comments", value: "comment" },
    { label: "Verifications", value: "verification" },
  ],
  network: [
    { label: "Followers", value: "follower" },
    { label: "Following", value: "following" },
    { label: "Collaborators", value: "collaborator" },
  ],
};

const ZONE_SORTS: Record<Zone, { label: string; value: string }[]> = {
  authored: [
    { label: "Recent", value: "recent" },
    { label: "Most viewed", value: "popular" },
  ],
  curated: [
    { label: "Recently added", value: "recent" },
    { label: "A-Z", value: "alpha" },
  ],
  activity: [{ label: "Recent", value: "recent" }],
  network: [{ label: "Recently followed", value: "recent" }],
};

const ACCENT = "#E8571A"; // Sienna

const cardBaseStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "0.5px solid rgba(255,255,255,0.08)",
  borderRadius: "8px",
  padding: "14px",
  cursor: "pointer",
  transition: "background 0.15s ease, border-color 0.15s ease, transform 0.15s ease",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

function applyHover(e: React.MouseEvent<HTMLDivElement>, lift = false) {
  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
  if (lift) e.currentTarget.style.transform = "translateY(-1px)";
}
function clearHover(e: React.MouseEvent<HTMLDivElement>, lift = false) {
  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
  if (lift) e.currentTarget.style.transform = "translateY(0)";
}

// ── Card variants ─────────────────────────────────────────────────────────
function AuthoredCard({ item, onClick }: { item: ZoneItem; onClick: () => void }) {
  const views = (item.meta?.views as number | undefined) ?? undefined;
  return (
    <div
      onClick={onClick}
      style={cardBaseStyle}
      onMouseEnter={(e) => applyHover(e)}
      onMouseLeave={(e) => clearHover(e)}
    >
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        {item.kind}
      </div>
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "14px",
          fontWeight: 600,
          color: "rgba(255,255,255,0.92)",
          lineHeight: 1.3,
        }}
      >
        {item.title}
      </div>
      {item.subtitle && (
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "12px",
            color: "rgba(255,255,255,0.55)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.subtitle}
        </div>
      )}
      {views !== undefined && (
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "11px",
            color: "rgba(255,255,255,0.45)",
            marginTop: "auto",
          }}
        >
          {views.toLocaleString()} views
        </div>
      )}
    </div>
  );
}

function CuratedCard({ item, onClick }: { item: ZoneItem; onClick: () => void }) {
  const isCollection = item.kind === "collection";
  return (
    <div
      onClick={onClick}
      style={cardBaseStyle}
      onMouseEnter={(e) => applyHover(e)}
      onMouseLeave={(e) => clearHover(e)}
    >
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: isCollection ? "rgba(46,196,182,0.85)" : "rgba(255,255,255,0.45)",
        }}
      >
        {isCollection ? "Collection" : "Bookmark"}
      </div>
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "14px",
          fontWeight: 600,
          color: "rgba(255,255,255,0.92)",
          lineHeight: 1.3,
        }}
      >
        {item.title}
      </div>
      {item.subtitle && (
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "12px",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          {item.subtitle}
        </div>
      )}
    </div>
  );
}

function NetworkCard({ item, onClick }: { item: ZoneItem; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ ...cardBaseStyle, flexDirection: "row", alignItems: "center", gap: "10px" }}
      onMouseEnter={(e) => applyHover(e, true)}
      onMouseLeave={(e) => clearHover(e, true)}
    >
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "13px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.92)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.title}
        </div>
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "11px",
            color: "rgba(255,255,255,0.45)",
            textTransform: "capitalize",
          }}
        >
          {item.kind}
        </div>
      </div>
    </div>
  );
}

function ActivityRow({ item, onClick }: { item: ZoneItem; onClick: () => void }) {
  const Icon =
    item.kind === "rating" ? Heart : item.kind === "comment" ? MessageSquare : Repeat2;
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        gap: "12px",
        padding: "10px 0",
        borderBottom: "0.5px solid rgba(255,255,255,0.06)",
        cursor: "pointer",
      }}
    >
      <Icon size={14} style={{ color: "rgba(255,255,255,0.45)", marginTop: "3px", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "13px",
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1.4,
          }}
        >
          {item.title}
        </div>
        {item.subtitle && (
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "11px",
              color: "rgba(255,255,255,0.45)",
              marginTop: "2px",
            }}
          >
            {item.subtitle}
          </div>
        )}
      </div>
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "11px",
          color: "rgba(255,255,255,0.40)",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        {new Date(item.occurredAt).toLocaleDateString()}
      </div>
    </div>
  );
}

// ── Empty / loading ───────────────────────────────────────────────────────
function EmptyState({ zone, isOwnProfile }: { zone: Zone; isOwnProfile: boolean }) {
  const states: Record<Zone, { message: string; link?: { text: string; href: string } }> = {
    authored: {
      message: "Nothing published yet",
      link: isOwnProfile ? { text: "Create your first blueprint", href: "/upload" } : undefined,
    },
    curated: {
      message: "No bookmarks yet",
      link: isOwnProfile ? { text: "Browse content", href: "/discover" } : undefined,
    },
    activity: { message: "No recent activity" },
    network: {
      message: "No connections yet",
      link: isOwnProfile ? { text: "Discover creators", href: "/discover" } : undefined,
    },
  };
  const s = states[zone];
  return (
    <div
      style={{
        padding: "48px 16px",
        textAlign: "center",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)" }}>{s.message}</div>
      {s.link && (
        <a
          href={s.link.href}
          style={{
            display: "inline-block",
            marginTop: "12px",
            fontSize: "12px",
            color: ACCENT,
            textDecoration: "none",
          }}
        >
          {s.link.text}
        </a>
      )}
    </div>
  );
}

function LoadingSkeleton({ zone }: { zone: Zone }) {
  if (zone === "activity") {
    return (
      <div>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: "44px",
              marginBottom: "8px",
              background: "rgba(255,255,255,0.04)",
              borderRadius: "6px",
            }}
            className="animate-pulse"
          />
        ))}
      </div>
    );
  }
  const cols = zone === "network" ? 3 : 2;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: "12px",
      }}
    >
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          style={{
            height: "110px",
            background: "rgba(255,255,255,0.04)",
            borderRadius: "8px",
          }}
          className="animate-pulse"
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export function ProfileContentZones({
  activeZone,
  onZoneChange,
  activeFilter,
  onFilterChange,
  sort,
  onSortChange,
  counts,
  items,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  onItemClick,
  isOwnProfile,
}: ProfileContentZonesProps) {
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  // Infinite scroll observer
  React.useEffect(() => {
    if (!onLoadMore || !hasMore || isLoading || isLoadingMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: "200px" }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [onLoadMore, hasMore, isLoading, isLoadingMore, items.length]);

  const zones: { label: string; value: Zone; count: number }[] = [
    { label: "Authored", value: "authored", count: counts.authored },
    { label: "Curated", value: "curated", count: counts.curated },
    { label: "Activity", value: "activity", count: counts.activity },
    { label: "Network", value: "network", count: counts.network },
  ];

  const currentFilters = ZONE_FILTERS[activeZone];
  const currentSorts = ZONE_SORTS[activeZone];
  const currentSortLabel =
    currentSorts.find((s) => s.value === sort)?.label ?? currentSorts[0].label;

  const renderContent = () => {
    if (isLoading) return <LoadingSkeleton zone={activeZone} />;
    if (items.length === 0)
      return <EmptyState zone={activeZone} isOwnProfile={isOwnProfile} />;

    switch (activeZone) {
      case "authored":
        return (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
              gap: "12px",
            }}
          >
            {items.map((item) => (
              <AuthoredCard key={item.id} item={item} onClick={() => onItemClick(item)} />
            ))}
          </div>
        );
      case "curated": {
        const collections = items.filter((i) => i.kind === "collection");
        const bookmarks = items.filter((i) => i.kind !== "collection");
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {collections.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: "12px",
                }}
              >
                {collections.map((item) => (
                  <CuratedCard key={item.id} item={item} onClick={() => onItemClick(item)} />
                ))}
              </div>
            )}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
                gap: "12px",
              }}
            >
              {bookmarks.map((item) => (
                <CuratedCard key={item.id} item={item} onClick={() => onItemClick(item)} />
              ))}
            </div>
          </div>
        );
      }
      case "activity":
        return (
          <div>
            {items.map((item) => (
              <ActivityRow key={item.id} item={item} onClick={() => onItemClick(item)} />
            ))}
          </div>
        );
      case "network":
        return (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "12px",
            }}
          >
            {items.map((item) => (
              <NetworkCard key={item.id} item={item} onClick={() => onItemClick(item)} />
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ width: "100%", marginTop: "32px" }}>
      {/* Outer Tab Row */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          borderBottom: "0.5px solid rgba(255,255,255,0.08)",
          marginBottom: "16px",
        }}
      >
        {zones.map((zone) => {
          const isActive = activeZone === zone.value;
          return (
            <button
              key={zone.value}
              onClick={() => onZoneChange(zone.value)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 18px",
                background: "transparent",
                border: "none",
                borderBottom: isActive ? `2px solid ${ACCENT}` : "2px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s ease",
                marginBottom: "-0.5px",
              }}
            >
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)",
                }}
              >
                {zone.label}
              </span>
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "10px",
                  color: isActive ? ACCENT : "rgba(255,255,255,0.40)",
                  marginTop: "2px",
                }}
              >
                {zone.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Inner Filter Strip + Sort */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {currentFilters.map((filter) => {
            const isActive = activeFilter === filter.value;
            return (
              <button
                key={filter.value}
                onClick={() => onFilterChange(filter.value)}
                style={{
                  height: "26px",
                  padding: "4px 12px",
                  borderRadius: "4px",
                  border: isActive
                    ? "0.5px solid rgba(232,87,26,0.40)"
                    : "0.5px solid rgba(255,255,255,0.08)",
                  background: isActive ? "rgba(232,87,26,0.10)" : "transparent",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: isActive ? ACCENT : "rgba(255,255,255,0.65)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                height: "26px",
                padding: "4px 10px",
                background: "transparent",
                border: "0.5px solid rgba(255,255,255,0.08)",
                borderRadius: "4px",
                fontFamily: "Inter, sans-serif",
                fontSize: "11px",
                color: "rgba(255,255,255,0.65)",
                cursor: "pointer",
              }}
            >
              Sort: {currentSortLabel}
              <ChevronDown size={12} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {currentSorts.map((s) => (
              <DropdownMenuItem
                key={s.value}
                onClick={() => onSortChange(s.value)}
                style={{
                  fontSize: "11px",
                  color: sort === s.value ? ACCENT : undefined,
                }}
              >
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <div>{renderContent()}</div>

      {/* Infinite scroll sentinel + spinner */}
      {hasMore && (
        <div
          ref={sentinelRef}
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "16px",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          {isLoadingMore && <Loader2 size={16} className="animate-spin" />}
        </div>
      )}
    </div>
  );
}
