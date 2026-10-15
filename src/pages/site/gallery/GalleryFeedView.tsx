/* UI-P89 — the Gallery feed in the refined look. No board draws it.

   UI-P99: THIS WAS THE REFINED FORK. The current view it forked is deleted and this took its name; what follows was written when both existed, so "the current look" below means the look that has been retired. `GalleryFeedView` stays the current look; this is the same page with the same props (imported
   from it, not copied), the same menus (`menusFor`), handlers, copy, accessible names and order of parts. Only the
   controls change to the refined ones from UI-P84 to UI-P86: `Segmented`, the search field on the well recipe,
   `MenuButton`s that open the same menus, `FilterChip`s and sheets on a phone, and the build card's own refined look.
   `GalleryPage` and the dev page choose between the two with `useLook()`.

   THE SEARCH FIELD, THE MENU'S PANEL AND ITS OPTIONS are exported: the refined dashboard (`GalleryDashboardView`)
   uses the same three. */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { Button } from "@/components/brand/Button";
import { EmptyState } from "@/components/brand/EmptyState";
import { ErrorState } from "@/components/brand/ErrorState";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { FilterChip } from "@/components/brand/FilterChip";
import { Glyph } from "@/components/brand/Glyph";
import { MenuButton } from "@/components/brand/MenuButton";
import { SearchField } from "@/components/brand/SearchField";
import { Segmented } from "@/components/brand/Segmented";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { GalleryCard } from "@/components/gallery/GalleryCard";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { ScrollRow } from "@/components/shell/ScrollRow";
import { useIsPhone } from "@/components/shell/useMinWidth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GalleryViewMode } from "@/lib/build/galleryParams";
import { MENU_ITEM_CLASS } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { Shortfall } from "./GalleryExtras";
import { formatCount, FEED_SORT_ITEMS, feedCountLine, sortItemLabel, sortLabel } from "./galleryModel";
import type { PlaqueBuild } from "@/components/brand/Plaque";
import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import type { PageFit } from "@/components/shell/siteFrameFit";
import type { GalleryFeedCounts, GalleryFeedRow, GalleryFeedSort } from "@/lib/build/gallery";
import { LABS, MODEL_VERSIONS, type ModelVersion } from "@/lib/models/registry";
import { r } from "@/lib/theme/radius";

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

export const mono = (px: number, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: DM_MONO,
  fontSize: px,
  lineHeight: "normal",
  ...extra,
});

export const SEARCH_DEBOUNCE_MS = 300;

/**
 * The field is the form around the input, so the input itself is bare. The app
 * stylesheet gives every input a border and a `--recess` ground with
 * `!important`, which a style object cannot outrank; an inline declaration
 * marked important can, and only on this one element.
 */
export const bareInput = (node: HTMLInputElement | null) => {
  if (!node) return;
  node.style.setProperty("background", "transparent", "important");
  node.style.setProperty("border-width", "0", "important");
};

export const PLACEHOLDER = "Search builds, makers, models";

export interface MenuOption {
  key: string;
  label: string;
  count?: number;
  isNew?: boolean;
  selected: boolean;
  onSelect: () => void;
}

export interface MenuGroup {
  heading?: string;
  options: MenuOption[];
}

export interface FeedMenu {
  key: "model" | "for" | "sort";
  label: string;
  value: string;
  groups: MenuGroup[];
}

export function menusFor(props: GalleryFeedViewProps): FeedMenu[] {
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

export const groupHeading: CSSProperties = mono(11, {
  color: t.label,
  textTransform: "uppercase",
  letterSpacing: ".08em",
  padding: "7px 7px 4px",
});

export const menuContent: CSSProperties = {
  width: 260,
  maxHeight: "min(70vh, 520px)",
  overflowY: "auto",
  padding: 4,
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
  gap: 6,
  height: 31,
  padding: "0 7px",
  borderRadius: 10,
  fontFamily: FIGTREE,
  fontSize: 13,
  cursor: "pointer",
  outline: "none",
};

export function countLineOf(props: GalleryFeedViewProps): string | null {
  const { list, model, sort, status } = props;
  if (status !== "ready") return null;
  if (list.kind === "all") return feedCountLine(sort, list.list.total, null);
  const reproduced = list.reproducedOn.total;
  const rest = list.notYet.total;
  if (reproduced === null || rest === null || !model) return null;
  return feedCountLine(sort, reproduced + rest, { name: model.name, reproduced });
}

const text = (px: number, weight: 400 | 500, color: string, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: px,
  fontWeight: weight,
  lineHeight: "normal",
  color,
  ...extra,
});

const tnum: CSSProperties = { fontVariantNumeric: "tabular-nums" };

/* ── the search ── */

/* index.css gives every <input> a fill, a border and a focus outline, all `!important`; the field is a transparent
   input inside the drawn well, so those are switched off with Tailwind's important utilities, as the header's is. */
const INPUT_CLASS =
  "placeholder:text-[color:var(--label)] !bg-transparent !border-0 focus-visible:!outline-none focus-visible:!border-0";

/**
 * The gallery's search on the refined `SearchField` (the well, 28 high, no key hint). The same form, name, label,
 * placeholder and 300ms debounce as the current field.
 */
export function RefinedSearchField({
  query,
  onSearch,
  phone,
  autoFocus = false,
  width,
}: {
  query: string | null;
  onSearch: (query: string | null) => void;
  phone: boolean;
  autoFocus?: boolean;
  /** A fixed width (the dashboard's 240); absent, the field fills its row. */
  width?: number;
}) {
  const [value, setValue] = useState(query ?? "");
  /** The last value this field sent, so the address echoing it back does not rewrite what is being typed. */
  const sent = useRef<string | null>(query);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query !== sent.current) {
      sent.current = query;
      setValue(query ?? "");
    }
  }, [query]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const send = (next: string) => {
    const tidy = next.trim() === "" ? null : next.trim();
    sent.current = tidy;
    onSearch(tidy);
  };

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        send(value);
      }}
      style={{
        margin: 0,
        display: "flex",
        minWidth: 0,
        flex: width !== undefined ? "0 1 auto" : phone ? "1 1 auto" : "1 1 200px",
      }}
    >
      <SearchField
        label="Search the gallery"
        name="q"
        placeholder={PLACEHOLDER}
        className={INPUT_CLASS}
        autoFocus={autoFocus}
        value={value}
        width={width ?? "100%"}
        style={{ height: phone ? 44 : 28 }}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => send(next), SEARCH_DEBOUNCE_MS);
        }}
      />
    </form>
  );
}

/* ── the menus ── */

/** A menu's panel: the window recipe. */
export const refinedMenuContent: CSSProperties = {
  width: 260,
  maxHeight: "min(70vh, 520px)",
  overflowY: "auto",
  padding: 4,
  boxSizing: "border-box",
  borderRadius: 12,
  background: t.window,
  border: `1px solid ${t.windowBorder}`,
  boxShadow: t.windowShadow,
  color: t.text,
  zIndex: 50,
};

/** One option: 32 high, radius 6, Geist 12.5. */
export const refinedMenuItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  height: 32,
  padding: "0 8px",
  borderRadius: 6,
  fontFamily: FIGTREE,
  fontSize: 12.5,
  cursor: "pointer",
  outline: "none",
};

export function RefinedGroupHeading({ children }: { children: ReactNode }) {
  return <Eyebrow style={{ padding: "8px 8px 4px" }}>{children}</Eyebrow>;
}

/** An option's body: the label, "new" as a mono tag, a check when chosen, the note or count in `--label`. */
export function RefinedOptionBody({ label, selected, note, isNew }: { label: string; selected: boolean; note?: string; isNew?: boolean }) {
  return (
    <>
      <span
        style={{
          flexGrow: 1,
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontWeight: 500,
          color: selected ? t.text : t.text2,
        }}
      >
        {label}
      </span>
      {isNew ? (
        <span
          data-testid="model-new"
          style={{ fontFamily: DM_MONO, fontSize: 10.5, lineHeight: "18px", padding: "0 6px", borderRadius: 4, background: t.pill, color: t.litInk }}
        >
          new
        </span>
      ) : null}
      {selected ? <Glyph name="check" size={14} /> : null}
      {note !== undefined ? <span style={text(11.5, 400, t.label, { ...tnum, flexShrink: 0, minWidth: 24, textAlign: "right" })}>{note}</span> : null}
    </>
  );
}

function DesktopMenu({ menu }: { menu: FeedMenu }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuButton label={menu.label} value={menu.value} data-testid={`feed-menu-${menu.key}`} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} style={refinedMenuContent} aria-label={menu.label}>
        {menu.groups.map((group, index) => (
          <div key={group.heading ?? index} role="group" aria-label={group.heading}>
            {group.heading ? <RefinedGroupHeading>{group.heading}</RefinedGroupHeading> : null}
            {group.options.map((option) => (
              <DropdownMenuItem
                key={option.key}
                role="menuitemradio"
                aria-checked={option.selected}
                className={MENU_ITEM_CLASS}
                style={refinedMenuItem}
                onSelect={option.onSelect}
              >
                <RefinedOptionBody
                  label={option.label}
                  selected={option.selected}
                  isNew={option.isNew}
                  note={option.count !== undefined ? formatCount(option.count) : undefined}
                />
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SheetMenu({ menu, open, onOpenChange }: { menu: FeedMenu; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={menu.label}>
      <div role="group" aria-label={menu.label} style={{ display: "flex", flexDirection: "column" }}>
        {menu.groups.map((group, index) => (
          <div key={group.heading ?? index} style={{ display: "flex", flexDirection: "column" }}>
            {group.heading ? <RefinedGroupHeading>{group.heading}</RefinedGroupHeading> : null}
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
                  ...refinedMenuItem,
                  /* The touch target. */
                  height: 44,
                  width: "100%",
                  border: 0,
                  background: "transparent",
                  textAlign: "left",
                  fontSize: 15,
                }}
              >
                <RefinedOptionBody
                  label={option.label}
                  selected={option.selected}
                  isNew={option.isNew}
                  note={option.count !== undefined ? formatCount(option.count) : undefined}
                />
              </button>
            ))}
          </div>
        ))}
      </div>
    </BottomSheet>
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

  /* A labelled button draws no icon under refined: each chip is named "Remove …", as before. */
  return (
    <div data-testid="feed-active-filters" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      {chips.map((chip) => (
        <Button key={chip.key} variant="secondary" size={28} fontSize={12} aria-label={`Remove ${chip.label}`} onClick={chip.onRemove}>
          {chip.label}
        </Button>
      ))}
      <Button variant="ghost" size={28} fontSize={12} onClick={onClearAll}>
        Clear all
      </Button>
    </div>
  );
}

/* ── the list ── */

function Rows({ section, srcByPath, viewerId, now }: { section: FeedSectionView; srcByPath: GalleryFeedViewProps["srcByPath"]; viewerId: string | null; now?: number }) {
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
          <Button variant="secondary" size={32} fontSize={13} disabled={section.loadingMore} onClick={section.onMore}>
            {section.loadingMore ? "Loading…" : "Show more"}
          </Button>
        </div>
      ) : null}
    </>
  );
}

function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Eyebrow as="h2" style={{ margin: "8px 0 0" }}>
      <span id={id}>{children}</span>
    </Eyebrow>
  );
}

function ListSkeleton() {
  return (
    <LoadingRegion what="the gallery" data-testid="gallery-loading" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: 16,
            borderRadius: 8,
            background: t.module,
            border: `1px solid ${t.moduleBorder}`,
          }}
        >
          <Skeleton height="auto" radius={4} style={{ aspectRatio: "2 / 1" }} />
          <Skeleton width="60%" height={16} />
          <Skeleton width="90%" height={13} />
          <Skeleton width="45%" height={13} />
        </div>
      ))}
    </LoadingRegion>
  );
}

function EmptyFeed({ query, onNavigate }: Pick<GalleryFeedViewProps, "query" | "onClearAll" | "onNavigate">) {
  /* UI-P97: one line and one action. "Clear filters" is not repeated here: the filter row above this line already
     carries "Clear all" whenever a filter or a query is set, so the way out of the empty list is one tap away. */
  return (
    <EmptyState
      data-testid="gallery-empty"
      line={query ? `Nobody has hung a build for “${query}” yet.` : "No builds match these filters yet."}
      action={{ label: "Ask for it on Bounties", onClick: () => onNavigate("/bounties") }}
    />
  );
}

function FeedList(props: GalleryFeedViewProps) {
  const { status, errorKind, error, onRetry, list, model, srcByPath, viewerId = null, now, aboveList } = props;

  if (status === "loading") return <ListSkeleton />;
  if (status === "error") {
    return (
      <div data-testid="gallery-notice" style={{ padding: "12px 0" }}>
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
  const column: CSSProperties = { display: "flex", flexDirection: "column", gap: 16 };

  return (
    <div data-testid="gallery-feed" style={column}>
      {aboveList}
      {list.kind === "all" ? (
        <section aria-label="Builds" data-testid="feed-section-all" style={column}>
          <Rows section={list.list} {...rowProps} />
        </section>
      ) : (
        <>
          <section aria-labelledby="feed-reproduced-on" data-testid="feed-section-reproduced" style={column}>
            <SectionHeading id="feed-reproduced-on">
              Reproduced on {model?.name ?? ""} · {formatCount(list.reproducedOn.total ?? list.reproducedOn.rows.length)}
            </SectionHeading>
            <Rows section={list.reproducedOn} {...rowProps} />
          </section>
          <section aria-labelledby="feed-not-yet" data-testid="feed-section-not-yet" style={column}>
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

function Heading({ props, phone }: { props: GalleryFeedViewProps; phone: boolean }) {
  const line = countLineOf(props);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <h1 style={text(20, 500, t.text, { margin: 0, letterSpacing: "-0.015em" })}>Gallery</h1>
        <p data-testid="feed-count" style={text(12.5, 400, t.text2, { margin: 0, minHeight: 16, ...tnum })}>
          {line ?? " "}
        </p>
      </div>
      {phone ? null : (
        <Segmented<GalleryViewMode>
          label="Gallery view"
          size={28}
          fontSize={12}
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
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <RefinedSearchField query={props.query} onSearch={props.onSearch} phone={false} autoFocus={props.autoFocusSearch} />
          {menus.map((menu) => (
            <DesktopMenu key={menu.key} menu={menu} />
          ))}
        </div>
        <ActiveFilters {...props} />
        <FeedList {...props} />
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
      <RefinedSearchField query={props.query} onSearch={props.onSearch} phone autoFocus={props.autoFocusSearch} />
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
      <FeedList {...props} />
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
