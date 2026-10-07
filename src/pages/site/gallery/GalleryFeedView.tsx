/* UI-P49 — Gallery, the feed: one build per row, organised by the exact model
   version people reproduced it on.

   PURE. Props in, markup out: no fetching, no `useAuth()`, no router hooks but
   `Link`. `GalleryPage` supplies live data; the dev compare page
   (/dev/kit/pages/gallery-feed) supplies the fixture. The viewport is read here
   (the 768px breakpoint) so both agree.

   DESKTOP: one column, max-width 680, centred, gap 16 — the heading row (the
   title and the count line, the Feed | Dashboard switch), the controls (search,
   Model, Made for, Sort), the active filters, then the list: one, or with a
   model two sections, `reproducedOn` then `notYet`, each paging on its own.
   PHONE: the heading at 36 with no switch, the search full width, three chips
   in a scroll row that open bottom sheets, then the same list.

   THE ADDRESS IS THE STATE, and it is not held here: every control is a
   callback the page answers by writing the address. The view owns only what is
   in flight: the search text before its 300ms debounce, and which sheet is open.

   EVERY COLOUR IS A TOKEN. The cards are `GalleryCard layout="row"`. */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

import { Button } from "@/components/brand/Button";
import { ErrorState } from "@/components/brand/ErrorState";
import { FilterChip } from "@/components/brand/FilterChip";
import type { PlaqueBuild } from "@/components/brand/Plaque";
import { Segmented } from "@/components/brand/Segmented";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { GalleryCard } from "@/components/gallery/GalleryCard";
import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { ScrollRow } from "@/components/shell/ScrollRow";
import type { PageFit } from "@/components/shell/siteFrameFit";
import { useIsPhone } from "@/components/shell/useMinWidth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GalleryFeedCounts, GalleryFeedRow, GalleryFeedSort } from "@/lib/build/gallery";
import type { GalleryViewMode } from "@/lib/build/galleryParams";
import { LABS, MODEL_VERSIONS, type ModelVersion } from "@/lib/models/registry";
import { MENU_ITEM_CLASS } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, display } from "@/lib/theme/type";

import { Shortfall } from "./GalleryExtras";
import { FEED_SORT_ITEMS, feedCountLine, formatCount, sortItemLabel, sortLabel } from "./galleryModel";

/* ── the view's props ── */

/** One row: the build, and the record its plaque reads (its own figures, or one model's). */
export interface FeedRowView {
  build: GalleryFeedRow;
  plaque: PlaqueBuild;
}

/** One list that pages on its own. */
export interface FeedSectionView {
  rows: readonly FeedRowView[];
  /** How many builds the section holds; null if unknown. */
  total: number | null;
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
}

export type FeedListView =
  | { kind: "all"; list: FeedSectionView }
  | { kind: "model"; reproducedOn: FeedSectionView; notYet: FeedSectionView };

export interface FeedAudience {
  value: string;
  label: string;
  count: number;
}

export interface GalleryFeedViewProps {
  fit?: PageFit;
  /** The clock the plaques read. The compare page freezes it. */
  now?: number;
  view: GalleryViewMode;
  onViewChange: (view: GalleryViewMode) => void;
  /** The tidied search, or null. */
  query: string | null;
  /** Called 300ms after the reader stops typing; null clears it. */
  onSearch: (query: string | null) => void;
  /** The chosen version; null is "Any model". */
  model: ModelVersion | null;
  onModelChange: (id: string | null) => void;
  audience: string | null;
  onAudienceChange: (audience: string | null) => void;
  /** "Made for" options, with counts. */
  audiences: readonly FeedAudience[];
  sort: GalleryFeedSort;
  onSortChange: (sort: GalleryFeedSort) => void;
  /** The Model menu's numbers; null until known. */
  counts: GalleryFeedCounts | null;
  status: "loading" | "error" | "ready";
  /** `permission`: the read was refused, which is not an empty gallery. */
  errorKind?: "error" | "permission";
  error?: unknown;
  onRetry: () => void;
  list: FeedListView;
  /** Signed once for the page. */
  srcByPath: MediaSrcMap;
  /** The signed-in reader, for the creator's own shortfall line. */
  viewerId?: string | null;
  /** Above the list: the makers a search names. */
  aboveList?: ReactNode;
  /** Search, model and audience cleared; the sort stays. */
  onClearAll: () => void;
  /** Navigation from a button (links are links). */
  onNavigate: (to: string) => void;
  /** Arrived as /gallery?focus=search: the search field takes focus on mount. */
  autoFocusSearch?: boolean;
}

const mono = (px: number, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: DM_MONO,
  fontSize: px,
  lineHeight: "normal",
  ...extra,
});

const SEARCH_DEBOUNCE_MS = 300;

/**
 * The field is the form around the input, so the input itself is bare. The app
 * stylesheet gives every input a border and a `--recess` ground with
 * `!important`, which a style object cannot outrank; an inline declaration
 * marked important can, and only on this one element.
 */
const bareInput = (node: HTMLInputElement | null) => {
  if (!node) return;
  node.style.setProperty("background", "transparent", "important");
  node.style.setProperty("border-width", "0", "important");
};
const PLACEHOLDER = "Search builds, makers, models";

/* ── the menus' options, shared by the dropdowns and the sheets ── */

interface MenuOption {
  key: string;
  label: string;
  count?: number;
  isNew?: boolean;
  selected: boolean;
  onSelect: () => void;
}

interface MenuGroup {
  heading?: string;
  options: MenuOption[];
}

interface FeedMenu {
  key: "model" | "for" | "sort";
  label: string;
  value: string;
  groups: MenuGroup[];
}

function menusFor(props: GalleryFeedViewProps): FeedMenu[] {
  const { model, onModelChange, audience, onAudienceChange, audiences, sort, onSortChange, counts } = props;

  const modelGroups: MenuGroup[] = [
    {
      options: [
        { key: "any", label: "Any model", count: counts?.all, selected: model === null, onSelect: () => onModelChange(null) },
      ],
    },
    ...LABS.map((lab) => ({
      heading: lab,
      options: MODEL_VERSIONS.filter((version) => version.lab === lab).map((version) => ({
        key: version.id,
        label: version.name,
        count: counts ? (counts.byModel[version.id] ?? 0) : undefined,
        isNew: version.isNew,
        selected: model?.id === version.id,
        onSelect: () => onModelChange(version.id),
      })),
    })).filter((group) => group.options.length > 0),
  ];

  const audienceOptions: MenuOption[] = [
    { key: "anything", label: "Anything", selected: audience === null, onSelect: () => onAudienceChange(null) },
    ...audiences.map((option) => ({
      key: option.value,
      label: option.label,
      count: option.count,
      selected: audience === option.value,
      onSelect: () => onAudienceChange(option.value),
    })),
  ];
  // A chosen audience the facets do not list (an old link) can still be seen and turned off.
  if (audience !== null && !audiences.some((option) => option.value === audience)) {
    audienceOptions.push({ key: audience, label: audience, selected: true, onSelect: () => onAudienceChange(audience) });
  }

  const sortOptions: MenuOption[] = FEED_SORT_ITEMS.map((item) => ({
    key: item.value,
    label: sortItemLabel(item, model?.name ?? null),
    selected: sort === item.value,
    onSelect: () => onSortChange(item.value),
  }));

  const audienceLabel = audience === null ? "Anything" : (audiences.find((option) => option.value === audience)?.label ?? audience);

  return [
    { key: "model", label: "Model", value: model ? model.name : "Any", groups: modelGroups },
    { key: "for", label: "Made for", value: audienceLabel, groups: [{ options: audienceOptions }] },
    { key: "sort", label: "Sort", value: sortLabel(sort), groups: [{ options: sortOptions }] },
  ];
}

/** The "new" badge: DM Mono 11, `--lit` fill, `--on-lit` text. */
function NewBadge() {
  return (
    <span
      data-testid="model-new"
      style={mono(11, { padding: "0 6px", borderRadius: 6, background: t.lit, color: t.onLit, flexShrink: 0 })}
    >
      new
    </span>
  );
}

function OptionBody({ option }: { option: MenuOption }) {
  return (
    <>
      <span
        style={{
          flexGrow: 1,
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontWeight: option.selected ? 600 : 500,
          color: option.selected ? t.text : undefined,
        }}
      >
        {option.label}
      </span>
      {option.isNew ? <NewBadge /> : null}
      {option.selected ? <Check size={14} strokeWidth={1.8} aria-hidden="true" style={{ flexShrink: 0 }} /> : null}
      {option.count !== undefined ? (
        <span style={mono(12, { color: t.label, flexShrink: 0, minWidth: 24, textAlign: "right" })}>{formatCount(option.count)}</span>
      ) : null}
    </>
  );
}

export const groupHeading: CSSProperties = mono(11, {
  color: t.label,
  textTransform: "uppercase",
  letterSpacing: ".08em",
  padding: "10px 10px 4px",
});

/* ── desktop: the dropdowns ── */

export const menuContent: CSSProperties = {
  width: 260,
  maxHeight: "min(70vh, 520px)",
  overflowY: "auto",
  padding: 6,
  boxSizing: "border-box",
  borderRadius: r.panel,
  background: t.solid,
  border: `1px solid ${t.line}`,
  boxShadow: t.shadowFloat,
  color: t.text,
  zIndex: 50,
};

export const menuItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  height: 38,
  padding: "0 10px",
  borderRadius: 10,
  fontFamily: FIGTREE,
  fontSize: 14,
  cursor: "pointer",
  outline: "none",
};

function MenuTriggerLabel({ menu }: { menu: FeedMenu }) {
  return (
    <>
      <span style={{ color: t.text2, fontWeight: 500 }}>{menu.label}</span>
      <span style={{ fontWeight: 600, color: t.text }}>{menu.value}</span>
      <ChevronDown size={12} strokeWidth={1.8} aria-hidden="true" />
    </>
  );
}

function DesktopMenu({ menu }: { menu: FeedMenu }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size={42} fontSize={14} data-testid={`feed-menu-${menu.key}`}>
          <MenuTriggerLabel menu={menu} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} style={menuContent} aria-label={menu.label}>
        {menu.groups.map((group, index) => (
          <div key={group.heading ?? index} role="group" aria-label={group.heading}>
            {group.heading ? <div style={groupHeading}>{group.heading}</div> : null}
            {group.options.map((option) => (
              <DropdownMenuItem
                key={option.key}
                role="menuitemradio"
                aria-checked={option.selected}
                className={MENU_ITEM_CLASS}
                style={menuItem}
                onSelect={option.onSelect}
              >
                <OptionBody option={option} />
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── phone: the sheets ── */

function SheetMenu({ menu, open, onOpenChange }: { menu: FeedMenu; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={menu.label}>
      <div role="group" aria-label={menu.label} style={{ display: "flex", flexDirection: "column" }}>
        {menu.groups.map((group, index) => (
          <div key={group.heading ?? index} style={{ display: "flex", flexDirection: "column" }}>
            {group.heading ? <div style={groupHeading}>{group.heading}</div> : null}
            {group.options.map((option) => (
              <button
                key={option.key}
                type="button"
                role="menuitemradio"
                aria-checked={option.selected}
                className={MENU_ITEM_CLASS}
                onClick={() => {
                  option.onSelect();
                  onOpenChange(false);
                }}
                style={{
                  ...menuItem,
                  height: 48,
                  width: "100%",
                  border: 0,
                  background: "transparent",
                  textAlign: "left",
                  fontSize: 16,
                }}
              >
                <OptionBody option={option} />
              </button>
            ))}
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}

/* ── the search ── */

export function SearchField({
  query,
  onSearch,
  phone,
  autoFocus = false,
  size,
}: {
  query: string | null;
  onSearch: (query: string | null) => void;
  phone: boolean;
  autoFocus?: boolean;
  /** UI-P50: the dashboard's field is a fixed 260 × 38 instead of filling its row. */
  size?: { width: number; height: number };
}) {
  const [text, setText] = useState(query ?? "");
  /** The last value this field sent, so the address echoing it back does not rewrite what is being typed. */
  const sent = useRef<string | null>(query);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query !== sent.current) {
      sent.current = query;
      setText(query ?? "");
    }
  }, [query]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const send = (value: string) => {
    const next = value.trim() === "" ? null : value.trim();
    sent.current = next;
    onSearch(next);
  };

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        send(text);
      }}
      style={{
        flex: size ? "0 0 auto" : phone ? "1 1 auto" : "1 1 200px",
        width: size?.width,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: size?.height ?? (phone ? 44 : 40),
        padding: "0 12px",
        boxSizing: "border-box",
        borderRadius: r.control,
        background: t.field,
        border: `1px solid ${t.line}`,
        color: t.text2,
      }}
    >
      <Search size={15} strokeWidth={1.6} aria-hidden="true" style={{ flexShrink: 0 }} />
      <input
        ref={bareInput}
        type="search"
        name="q"
        aria-label="Search the gallery"
        placeholder={PLACEHOLDER}
        autoFocus={autoFocus}
        value={text}
        onChange={(event) => {
          const value = event.target.value;
          setText(value);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => send(value), SEARCH_DEBOUNCE_MS);
        }}
        style={{
          background: "transparent",
          border: 0,
          outline: "none",
          WebkitAppearance: "none",
          appearance: "none",
          flexGrow: 1,
          minWidth: 0,
          height: "100%",
          fontFamily: FIGTREE,
          /* 16 on a phone, the iOS minimum: anything smaller zooms the page on focus. */
          fontSize: phone ? 16 : 14,
          color: t.text,
        }}
      />
    </form>
  );
}

/* ── the active filters ── */

function ActiveFilters(props: GalleryFeedViewProps) {
  const { query, onSearch, model, onModelChange, audience, onAudienceChange, audiences, onClearAll } = props;
  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (query) chips.push({ key: "q", label: `“${query}”`, onRemove: () => onSearch(null) });
  if (model) chips.push({ key: "model", label: `Proof on ${model.name}`, onRemove: () => onModelChange(null) });
  if (audience) {
    const label = audiences.find((option) => option.value === audience)?.label ?? audience;
    chips.push({ key: "for", label: `Made for ${label}`, onRemove: () => onAudienceChange(null) });
  }
  if (chips.length === 0) return null;

  return (
    <div data-testid="feed-active-filters" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      {chips.map((chip) => (
        <Button key={chip.key} variant="secondary" size={30} fontSize={12} aria-label={`Remove ${chip.label}`} onClick={chip.onRemove}>
          {chip.label}
          <X size={12} strokeWidth={1.8} aria-hidden="true" />
        </Button>
      ))}
      <Button variant="ghost" size={30} fontSize={12} onClick={onClearAll}>
        Clear all
      </Button>
    </div>
  );
}

/* ── the list ── */

function Rows({ section, srcByPath, viewerId, now }: { section: FeedSectionView; srcByPath: MediaSrcMap; viewerId: string | null; now?: number }) {
  return (
    <>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        {section.rows.map(({ build, plaque }) => (
          <li key={build.id} style={{ minWidth: 0 }}>
            <GalleryCard
              build={build}
              srcByPath={srcByPath}
              layout="row"
              makerHandle={build.creatorHandle}
              modelsUsed={build.models_used}
              plaqueBuild={plaque}
              now={now}
            />
            <Shortfall build={build} viewerId={viewerId} />
          </li>
        ))}
      </ol>
      {section.hasMore ? (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Button variant="secondary" size={42} fontSize={14} disabled={section.loadingMore} onClick={section.onMore}>
            {section.loadingMore ? "Loading…" : "Show more"}
          </Button>
        </div>
      ) : null}
    </>
  );
}

function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} style={mono(12, { margin: "16px 0 0", color: t.label, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 400 })}>
      {children}
    </h2>
  );
}

function ListSkeleton() {
  return (
    <LoadingRegion what="the gallery" data-testid="gallery-loading" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} style={{ paddingTop: 18 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              padding: "12px 12px 18px",
              borderRadius: r.card,
              background: t.glass,
              border: `1px solid ${t.glassBorder}`,
            }}
          >
            <Skeleton height="auto" radius={r.media} style={{ aspectRatio: "2 / 1" }} />
            <Skeleton width="60%" height={26} />
            <Skeleton width="90%" height={16} />
            <Skeleton width="45%" height={14} />
          </div>
        </div>
      ))}
    </LoadingRegion>
  );
}

function EmptyFeed({ query, onClearAll, onNavigate }: Pick<GalleryFeedViewProps, "query" | "onClearAll" | "onNavigate">) {
  return (
    <div data-testid="gallery-empty" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14, padding: "24px 0" }}>
      <p style={{ ...display(22), margin: 0, color: t.text }}>
        {query ? `Nobody has hung a build for “${query}” yet.` : "No builds match these filters yet."}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button variant="secondary" size={42} fontSize={14} onClick={() => onNavigate("/bounties")}>
          Ask for it on Bounties
        </Button>
        <Button variant="ghost" size={42} fontSize={14} onClick={onClearAll}>
          Clear filters
        </Button>
      </div>
    </div>
  );
}

function FeedList(props: GalleryFeedViewProps & { phone: boolean }) {
  const { status, errorKind, error, onRetry, list, model, srcByPath, viewerId = null, now, aboveList } = props;

  if (status === "loading") return <ListSkeleton />;
  if (status === "error") {
    return (
      <div data-testid="gallery-notice" style={{ padding: "16px 0" }}>
        <ErrorState
          line={errorKind === "permission" ? "You don't have access to this." : undefined}
          panel="The gallery"
          onRetry={onRetry}
          error={error}
        />
      </div>
    );
  }

  const empty =
    list.kind === "all" ? list.list.rows.length === 0 : list.reproducedOn.rows.length === 0 && list.notYet.rows.length === 0;
  if (empty) return <EmptyFeed query={props.query} onClearAll={props.onClearAll} onNavigate={props.onNavigate} />;

  const rowProps = { srcByPath, viewerId, now };

  return (
    <div data-testid="gallery-feed" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {aboveList}
      {list.kind === "all" ? (
        <section aria-label="Builds" data-testid="feed-section-all" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Rows section={list.list} {...rowProps} />
        </section>
      ) : (
        <>
          <section aria-labelledby="feed-reproduced-on" data-testid="feed-section-reproduced" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <SectionHeading id="feed-reproduced-on">
              Reproduced on {model?.name ?? ""} · {formatCount(list.reproducedOn.total ?? list.reproducedOn.rows.length)}
            </SectionHeading>
            <Rows section={list.reproducedOn} {...rowProps} />
          </section>
          <section aria-labelledby="feed-not-yet" data-testid="feed-section-not-yet" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <SectionHeading id="feed-not-yet">
              Not yet reproduced on {model?.name ?? ""} · {formatCount(list.notYet.total ?? list.notYet.rows.length)}
            </SectionHeading>
            <Rows section={list.notYet} {...rowProps} />
          </section>
        </>
      )}
    </div>
  );
}

/* ── the heading ── */

function countLineOf(props: GalleryFeedViewProps): string | null {
  const { list, model, sort, status } = props;
  if (status !== "ready") return null;
  if (list.kind === "all") return feedCountLine(sort, list.list.total, null);
  const reproduced = list.reproducedOn.total;
  const rest = list.notYet.total;
  if (reproduced === null || rest === null || !model) return null;
  return feedCountLine(sort, reproduced + rest, { name: model.name, reproduced });
}

function Heading({ props, phone }: { props: GalleryFeedViewProps; phone: boolean }) {
  const line = countLineOf(props);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <h1 style={{ ...display(phone ? 36 : 44, { mobilePageHeading: phone }), margin: 0, color: t.text }}>Gallery</h1>
        <p data-testid="feed-count" style={{ margin: 0, minHeight: 22, fontFamily: FIGTREE, fontSize: 15, lineHeight: 1.45, color: t.text2 }}>
          {line ?? " "}
        </p>
      </div>
      {phone ? null : (
        <Segmented<GalleryViewMode>
          label="Gallery view"
          size={34}
          fontSize={13}
          semantics="radio"
          value={props.view}
          onChange={props.onViewChange}
          items={[
            { value: "feed", label: "Feed" },
            { value: "dashboard", label: "Dashboard" },
          ]}
        />
      )}
    </div>
  );
}

/* ── the page ── */

function DesktopFeed(props: GalleryFeedViewProps) {
  const menus = menusFor(props);
  return (
    <div data-testid="gallery-view" data-viewport="desktop" style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 680, minWidth: 0 }}>
        <Heading props={props} phone={false} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <SearchField query={props.query} onSearch={props.onSearch} phone={false} autoFocus={props.autoFocusSearch} />
          {menus.map((menu) => (
            <DesktopMenu key={menu.key} menu={menu} />
          ))}
        </div>
        <ActiveFilters {...props} />
        <FeedList {...props} phone={false} />
      </div>
    </div>
  );
}

function PhoneFeed(props: GalleryFeedViewProps) {
  const menus = menusFor(props);
  const [open, setOpen] = useState<FeedMenu["key"] | null>(null);
  return (
    <div data-testid="gallery-view" data-viewport="mobile" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <Heading props={props} phone />
      <SearchField query={props.query} onSearch={props.onSearch} phone autoFocus={props.autoFocusSearch} />
      <ScrollRow gap={6} label="Filter the gallery">
        {menus.map((menu) => (
          <FilterChip
            key={menu.key}
            data-testid={`feed-menu-${menu.key}`}
            label={`${menu.label} · ${menu.value}`}
            on={open === menu.key}
            aria-haspopup="dialog"
            onClick={() => setOpen(menu.key)}
          />
        ))}
      </ScrollRow>
      <ActiveFilters {...props} />
      <FeedList {...props} phone />
      {menus.map((menu) => (
        <SheetMenu key={menu.key} menu={menu} open={open === menu.key} onOpenChange={(next) => setOpen(next ? menu.key : null)} />
      ))}
    </div>
  );
}

export function GalleryFeedView(props: GalleryFeedViewProps) {
  const phone = useIsPhone();
  return phone ? <PhoneFeed {...props} /> : <DesktopFeed {...props} />;
}

export default GalleryFeedView;
