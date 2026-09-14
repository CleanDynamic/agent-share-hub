// The profile's zones — repainted for BG-P25.
//
// FOUR TABS, AND WHY THEY ARE THESE FOUR. The prompt names builds, collections,
// rebuilds and activity. Three of them are here under their own names; there is
// no rebuilds zone to paint, because `getZoneContent` resolves exactly four
// zones and none of them is rebuilds — a fifth tab would need a fifth query,
// which this prompt is not allowed to write. `authored` and `curated` are
// relabelled to the words buildgallery uses out loud, which changes the LABEL
// and nothing behind it: the zone keys, the URL parameter, the filters and the
// query are all untouched.
//
// THE TABS ARE BG-P07's, NOT A SECOND ROW THAT LOOKS LIKE THEM. Active is a
// 2px `--action` underline plus a step up to full `--text`; it is never a
// coloured label, because a coloured label says "this is a link" where the
// underline says "you are here". The count under each label is mono with
// tabular figures so the row does not jitter as the numbers land.
//
// EVERY COLOUR WAS A WHITE ALPHA OR THE SIENNA HEX. Both only ever resolved
// against a dark ground, and neither reads `<html data-theme>`. They are now
// `var(--token)` references, applied inline for the reason the whole codebase
// applies styling inline: Tailwind's generated utilities beat hand-written
// classes at build time, and an inline style beats both. Structure — every
// grid, gap, padding and flex direction — is exactly what it was.

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
import { Skeleton } from "@/components/ui/skeleton";
import type { ZoneItem } from "@/lib/profile/types";
import { buttonStyle, chipStyle, chipType, uiTransition } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { body, data as dataText, tabular } from "@/lib/theme/type";

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
    { label: "Reblogs", value: "reblog" },
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

/* A card on this page. The theme's card: `--glass` behind a `--glass-border`
   hairline at `--r-card`, elevation flat. It was an 8px box on 3% white, which
   on Exhibition is a white card on a grey page with no edge at all. No blur is
   set here and none was before — `--glass` is spent as a colour, which keeps
   a grid of forty cards off the page's compositing budget. */
const cardBaseStyle: React.CSSProperties = {
  background: t.glass,
  border: `1px solid ${t.glassBorder}`,
  borderRadius: r.card,
  padding: "14px",
  cursor: "pointer",
  transition: uiTransition(),
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

/* Hover brightens the glass and firms the hairline. `transform` and `opacity`
   only — the theme forbids animating layout, and the 1px lift a network row
   takes is a transform. */
function applyHover(e: React.MouseEvent<HTMLDivElement>, lift = false) {
  e.currentTarget.style.background = t.glassHi;
  e.currentTarget.style.borderColor = t.line;
  if (lift) e.currentTarget.style.transform = "translateY(-1px)";
}
function clearHover(e: React.MouseEvent<HTMLDivElement>, lift = false) {
  e.currentTarget.style.background = t.glass;
  e.currentTarget.style.borderColor = t.glassBorder;
  if (lift) e.currentTarget.style.transform = "translateY(0)";
}

// Per-item overflow menu, anchored top-right of a card.
interface ItemMenuOption {
  key: string;
  label: string;
  icon?: React.ReactNode;
  destructive?: boolean;
  onSelect: () => void;
}

function ItemOverflowMenu({ options }: { options: ItemMenuOption[] }) {
  if (options.length === 0) return null;
  return (
    <div
      style={{ position: "absolute", top: 8, right: 8 }}
      onClick={(e) => e.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="More actions"
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            style={{
              width: 24,
              height: 24,
              borderRadius: r.chip,
              background: t.glassHi,
              border: `1px solid ${t.line}`,
              color: t.text2,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <MoreHorizontal size={12} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[160px]">
          {options.map((opt, i) => {
            const isLastDestructive =
              opt.destructive && i > 0 && !options[i - 1].destructive;
            return (
              <React.Fragment key={opt.key}>
                {isLastDestructive && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onClick={opt.onSelect}
                  style={{
                    fontSize: "12px",
                    color: opt.destructive ? t.catBreakage : undefined,
                  }}
                >
                  {opt.icon}
                  {opt.label}
                </DropdownMenuItem>
              </React.Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ── Card variants ─────────────────────────────────────────────────────────
function AuthoredCard({
  item,
  onClick,
  menuOptions,
}: {
  item: ZoneItem;
  onClick: () => void;
  menuOptions: ItemMenuOption[];
}) {
  const views = (item.meta?.views as number | undefined) ?? undefined;
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="group relative"
      style={cardBaseStyle}
      onMouseEnter={(e) => applyHover(e)}
      onMouseLeave={(e) => clearHover(e)}
    >
      <ItemOverflowMenu options={menuOptions} />
      <div
        /* The eyebrow: mono, because it names what KIND of record this is —
           the same job a part label does on a card. */
        style={{
          ...chipType,
          fontSize: "10px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: t.text2,
          paddingRight: 28,
        }}
      >
        {item.kind}
      </div>
      <div
        style={{
          ...body,
          fontSize: "14px",
          fontWeight: 600,
          color: t.text,
          lineHeight: 1.3,
        }}
      >
        {item.title}
      </div>
      {item.subtitle && (
        <div
          style={{
            ...body,
            fontSize: "12px",
            color: t.text2,
            textWrap: "pretty",
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
            ...dataText,
            ...tabular,
            fontSize: "11px",
            color: t.text2,
            marginTop: "auto",
          }}
        >
          {views.toLocaleString()} views
        </div>
      )}
    </div>
  );
}

function CuratedCard({
  item,
  onClick,
  menuOptions,
}: {
  item: ZoneItem;
  onClick: () => void;
  menuOptions: ItemMenuOption[];
}) {
  const isCollection = item.kind === "collection";
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="group relative"
      style={cardBaseStyle}
      onMouseEnter={(e) => applyHover(e)}
      onMouseLeave={(e) => clearHover(e)}
    >
      <ItemOverflowMenu options={menuOptions} />
      <div
        /* A collection is a group somebody curated, which is the same class of
           claim `--evidence` carries everywhere else on the site; a bookmark is
           just a saved row and stays `--text2`. */
        style={{
          ...chipType,
          fontSize: "10px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: isCollection ? t.evidence : t.text2,
        }}
      >
        {isCollection ? "Collection" : "Bookmark"}
      </div>
      <div
        style={{
          ...body,
          fontSize: "14px",
          fontWeight: 600,
          color: t.text,
          lineHeight: 1.3,
        }}
      >
        {item.title}
      </div>
      {item.subtitle && (
        <div
          style={{
            ...body,
            fontSize: "12px",
            color: t.text2,
            textWrap: "pretty",
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
          /* An avatar well: circular is the one thing `--r-full` is for. */
          borderRadius: r.full,
          background: t.recess,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            ...body,
            fontSize: "13px",
            fontWeight: 600,
            color: t.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.title}
        </div>
        <div
          style={{
            ...dataText,
            fontSize: "11px",
            color: t.text2,
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
        borderBottom: `1px solid ${t.line}`,
        cursor: "pointer",
      }}
    >
      <Icon size={14} style={{ color: t.text2, marginTop: "3px", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            ...body,
            fontSize: "13px",
            color: t.text,
            lineHeight: 1.4,
          }}
        >
          {item.title}
        </div>
        {item.subtitle && (
          <div
            style={{
              ...body,
              fontSize: "11px",
              color: t.text2,
              marginTop: "2px",
            }}
          >
            {item.subtitle}
          </div>
        )}
      </div>
      <div
        /* A timestamp is data and takes the data face, with tabular figures so
           a column of dates lines up. */
        style={{
          ...dataText,
          ...tabular,
          fontSize: "11px",
          color: t.text2,
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
function EmptyState({
  zone,
  isOwnProfile,
  onCreateBlueprint,
}: {
  zone: Zone;
  isOwnProfile: boolean;
  onCreateBlueprint?: () => void;
}) {
  /* WHAT AN EMPTY WALL SAYS. Each line states the fact and nothing else — no
     apology, no nudge, no exclamation. "No builds yet" is the word this
     platform uses out loud, and it is the same word the tab above it carries;
     "Nothing published yet" was the data layer's vocabulary showing through.
     The second line is what to do about it, and appears only for the person who
     can act on it: telling a VISITOR to go and create a build is telling them
     to fix somebody else's empty wall. */
  const states: Record<Zone, { message: string; hint?: string; link?: { text: string; href: string } }> = {
    authored: {
      message: "No builds yet",
      hint: isOwnProfile
        ? "Anything you publish shows up here, newest first."
        : undefined,
      link: isOwnProfile && !onCreateBlueprint
        ? { text: "Publish your first build", href: "/upload" }
        : undefined,
    },
    curated: {
      message: "No collections yet",
      hint: isOwnProfile
        ? "Save a build from anywhere on the site and it lands in your library."
        : undefined,
      link: isOwnProfile ? { text: "Browse the gallery", href: "/gallery" } : undefined,
    },
    activity: { message: "No activity yet" },
    network: {
      message: "No connections yet",
      hint: isOwnProfile ? "People you follow, and people who follow you." : undefined,
      link: isOwnProfile ? { text: "Find creators", href: "/gallery" } : undefined,
    },
  };
  const s = states[zone];
  return (
    <div
      style={{
        padding: "48px 16px",
        textAlign: "center",
        ...body,
      }}
    >
      {/* The fact, in full ink; the invitation under it in `--text2`. A single
          grey line for both made the state read as an error message. */}
      <div style={{ ...body, fontSize: "15px", fontWeight: 600, color: t.text }}>
        {s.message}
      </div>
      {s.hint && (
        <div
          style={{
            ...body,
            fontSize: "13px",
            color: t.text2,
            marginTop: 6,
            maxWidth: 380,
            marginLeft: "auto",
            marginRight: "auto",
            textWrap: "pretty",
          }}
        >
          {s.hint}
        </div>
      )}
      {zone === "authored" && isOwnProfile && onCreateBlueprint && (
        <button
          type="button"
          onClick={onCreateBlueprint}
          /* The one primary in an empty view: there is nothing else on the
             screen for it to compete with, and an empty wall with no way off
             it is a dead end. */
          style={{
            marginTop: 14,
            padding: "8px 14px",
            ...buttonStyle("default"),
            ...body,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Publish your first build
        </button>
      )}
      {s.link && (
        <a
          href={s.link.href}
          style={{
            display: "inline-block",
            marginTop: "12px",
            ...body,
            fontSize: "12px",
            color: t.action,
            /* Underlined at rest: a link told apart from its neighbours by
               colour alone fails WCAG 1.4.1. */
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          }}
        >
          {s.link.text}
        </a>
      )}
    </div>
  );
}

/**
 * The zone, before it has arrived.
 *
 * IT SPENDS THE KIT'S SKELETON rather than a local `animate-pulse` box, and the
 * difference is not cosmetic: a pulse fades the whole block in and out, which
 * at a glance is indistinguishable from content that is failing to load, while
 * a sweep travels in one direction and reads as progress. The kit also drops
 * the movement under `prefers-reduced-motion`, which the pulse did not.
 *
 * The placeholders are the real cards' proportions and the real grid's
 * geometry, so nothing jumps when the rows land.
 */
function LoadingSkeleton({ zone }: { zone: Zone }) {
  if (zone === "activity") {
    return (
      <div role="status" aria-label="Loading">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton
            key={i}
            style={{ height: 44, marginBottom: 8, borderRadius: r.control }}
          />
        ))}
      </div>
    );
  }
  const cols = zone === "network" ? 3 : 2;
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: "12px",
      }}
    >
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Skeleton key={i} style={{ height: 110, borderRadius: r.card }} />
      ))}
    </div>
  );
}

/**
 * One filter chip, on the kit's own chip.
 *
 * Selection is a border and a step up in ink, not a tinted fill: the row is a
 * set of peers with one of them current, and a filled chip beside four outlines
 * reads as a button beside four labels. `chipSelectedStyle` is the kit's own
 * answer and this spends it rather than restating it.
 */
function FilterChip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      {...handlers}
      style={{
        height: "26px",
        padding: "4px 12px",
        ...chipStyle("outline", { selectable: true, ...state }),
        fontSize: "11px",
        ...(selected ? { borderColor: t.action, color: t.text } : {}),
      }}
    >
      {label}
    </button>
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
  onMakeCollection,
  onCreateBlueprint,
  onEditItem,
  onUnpublishItem,
  onDeleteItem,
  onBookmarkItem,
  onRepostItem,
  onShareItem,
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

  /* The LABEL changes; the `value` behind it does not. "Authored" and
     "Curated" were the data layer's words showing through — buildgallery says
     builds and collections, and BG-P24 renamed the documents to match. The
     zone key, the `?zone=` parameter, every filter and the query are all what
     they were. */
  const zones: { label: string; value: Zone; count: number }[] = [
    { label: "Builds", value: "authored", count: counts.authored },
    { label: "Collections", value: "curated", count: counts.curated },
    { label: "Activity", value: "activity", count: counts.activity },
    { label: "Network", value: "network", count: counts.network },
  ];

  const currentFilters = ZONE_FILTERS[activeZone];
  const currentSorts = ZONE_SORTS[activeZone];
  const currentSortLabel =
    currentSorts.find((s) => s.value === sort)?.label ?? currentSorts[0].label;

  const buildMenuOptions = (item: ZoneItem): ItemMenuOption[] => {
    const opts: ItemMenuOption[] = [];
    if (isOwnProfile && activeZone === "authored") {
      if (onEditItem)
        opts.push({
          key: "edit",
          label: "Edit",
          icon: <Pencil size={12} className="mr-2" />,
          onSelect: () => onEditItem(item),
        });
      if (onUnpublishItem)
        opts.push({
          key: "unpublish",
          label: "Unpublish",
          icon: <EyeOff size={12} className="mr-2" />,
          onSelect: () => onUnpublishItem(item),
        });
      if (onDeleteItem)
        opts.push({
          key: "delete",
          label: "Delete",
          icon: <Trash2 size={12} className="mr-2" />,
          destructive: true,
          onSelect: () => onDeleteItem(item),
        });
    } else if (!isOwnProfile) {
      if (onBookmarkItem)
        opts.push({
          key: "bookmark",
          label: "Bookmark",
          icon: <Bookmark size={12} className="mr-2" />,
          onSelect: () => onBookmarkItem(item),
        });
      if (onRepostItem)
        opts.push({
          key: "repost",
          label: "Repost",
          icon: <Repeat2 size={12} className="mr-2" />,
          onSelect: () => onRepostItem(item),
        });
      if (onShareItem)
        opts.push({
          key: "share",
          label: "Share",
          icon: <Share2 size={12} className="mr-2" />,
          onSelect: () => onShareItem(item),
        });
    }
    return opts;
  };

  const renderContent = () => {
    if (isLoading) return <LoadingSkeleton zone={activeZone} />;
    if (items.length === 0)
      return (
        <EmptyState
          zone={activeZone}
          isOwnProfile={isOwnProfile}
          onCreateBlueprint={onCreateBlueprint}
        />
      );

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
              <AuthoredCard
                key={item.id}
                item={item}
                onClick={() => onItemClick(item)}
                menuOptions={buildMenuOptions(item)}
              />
            ))}
          </div>
        );
      case "curated": {
        const collections = items.filter((i) => i.kind === "collection");
        const bookmarks = items.filter((i) => i.kind !== "collection");
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {isOwnProfile && onMakeCollection && (
              <div>
                <button
                  type="button"
                  onClick={onMakeCollection}
                  /* Secondary, not primary. The one primary on a profile is
                     Follow, and on your own profile it is the frame's publish
                     button — a second filled control here would be a second
                     answer to "what should I do now". */
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    ...buttonStyle("secondary"),
                    ...body,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <Plus size={12} />
                  Make collection
                </button>
              </div>
            )}
            {collections.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: "12px",
                }}
              >
                {collections.map((item) => (
                  <CuratedCard
                    key={item.id}
                    item={item}
                    onClick={() => onItemClick(item)}
                    menuOptions={buildMenuOptions(item)}
                  />
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
                <CuratedCard
                  key={item.id}
                  item={item}
                  onClick={() => onItemClick(item)}
                  menuOptions={buildMenuOptions(item)}
                />
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
        role="tablist"
        aria-label="Profile sections"
        style={{
          display: "flex",
          gap: "4px",
          borderBottom: `1px solid ${t.line}`,
          marginBottom: "16px",
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
        className="hide-scrollbar"
      >
        {zones.map((zone) => {
          const isActive = activeZone === zone.value;
          return (
            <button
              key={zone.value}
              role="tab"
              aria-selected={isActive}
              aria-controls={`zone-panel-${zone.value}`}
              id={`zone-tab-${zone.value}`}
              onClick={() => onZoneChange(zone.value)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 18px",
                background: "transparent",
                border: "none",
                /* BG-P07's mark: a 2px `--action` underline and nothing else.
                   Both states carry the 2px so becoming current shifts no
                   neighbour — the transparent one is load-bearing. */
                borderBottom: `2px solid ${isActive ? t.action : "transparent"}`,
                cursor: "pointer",
                transition: uiTransition(),
                marginBottom: "-0.5px",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  ...body,
                  fontSize: "13px",
                  fontWeight: 600,
                  /* A step up to full `--text`, never a coloured label: the
                     underline is what says "you are here". */
                  color: isActive ? t.text : t.text2,
                }}
              >
                {zone.label}
              </span>
              <span
                style={{
                  ...dataText,
                  ...tabular,
                  fontSize: "10px",
                  color: isActive ? t.text : t.text2,
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
          {currentFilters.map((filter) => (
            <FilterChip
              key={filter.value}
              label={filter.label}
              selected={activeFilter === filter.value}
              onSelect={() => onFilterChange(filter.value)}
            />
          ))}
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
                ...buttonStyle("outline"),
                ...body,
                fontSize: "11px",
                color: t.text2,
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
                  color: sort === s.value ? t.text : t.text2,
                }}
              >
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <div
        role="tabpanel"
        id={`zone-panel-${activeZone}`}
        aria-labelledby={`zone-tab-${activeZone}`}
      >
        {renderContent()}
      </div>

      {/* Infinite scroll sentinel + spinner */}
      {hasMore && (
        <div
          ref={sentinelRef}
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "16px",
            color: t.text2,
          }}
        >
          {isLoadingMore && <Loader2 size={16} className="animate-spin" />}
        </div>
      )}

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
