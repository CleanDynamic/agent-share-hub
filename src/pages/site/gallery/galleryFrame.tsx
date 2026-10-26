/* SV-04 P5: the Builds page's frame, in a small module of its own: its heading, its search, the default filter row and the
   list's loading shape. GalleryFeedView draws its page from these, and `GalleryLoadingView` is the page as it stands
   while its first list loads, so the route table's Placeholder is the page's own loading state without the page's code
   (its cards, menus and boards) in the first download.

   The filter menus' contents come with the page: until it arrives each menu is its button, with the value the address
   gives it by default, and pressing it does nothing. The view switch and the search change the address, which the page
   reads when it arrives. */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";

import { FilterChip } from "@/components/brand/FilterChip";
import { MenuButton } from "@/components/brand/MenuButton";
import { SearchField } from "@/components/brand/SearchField";
import { Segmented } from "@/components/brand/Segmented";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { ScrollRow } from "@/components/shell/ScrollRow";
import { useIsPhone } from "@/components/shell/useMinWidth";
import type { GalleryViewMode } from "@/lib/build/galleryParams";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export const SEARCH_DEBOUNCE_MS = 300;

export const PLACEHOLDER = "Search builds, makers, models";

export const text = (px: number, weight: 400 | 500, color: string, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: px,
  fontWeight: weight,
  lineHeight: "normal",
  color,
  ...extra,
});

export const tnum: CSSProperties = { fontVariantNumeric: "tabular-nums" };

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

/* ── the heading ── */

export function FeedHeading({
  line,
  view,
  onViewChange,
  phone,
}: {
  line: string | null;
  view: GalleryViewMode;
  onViewChange: (view: GalleryViewMode) => void;
  phone: boolean;
}) {
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
          value={view}
          onChange={onViewChange}
          items={[
            { value: "feed", label: "Feed" },
            { value: "dashboard", label: "Dashboard" },
          ]}
        />
      )}
    </div>
  );
}

/* ── the list, loading ── */

export function ListSkeleton() {
  return (
    <LoadingRegion what="the gallery" data-testid="gallery-loading" style={{ display: "flex", flexDirection: "column" }}>
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", columnGap: 12, padding: "20px 0 16px", borderBottom: `1px solid ${t.hairline}` }}
        >
          <Skeleton width={40} height={40} radius={999} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            <Skeleton width="40%" height={16} />
            <Skeleton width="90%" height={24} />
            <Skeleton width="70%" height={16} />
            <Skeleton width="100%" height={180} radius={6} />
          </div>
        </div>
      ))}
    </LoadingRegion>
  );
}

/** The filter row's menus before the page has said what is in them: their labels and the default values. */
const DEFAULT_MENUS = [
  { key: "model", label: "Model", value: "Any" },
  { key: "tool", label: "Made with", value: "Any" },
  { key: "for", label: "Made for", value: "Anything" },
  { key: "sort", label: "Sort", value: "Most reproduced" },
] as const;

const inert = () => undefined;

/** /builds before its first list has arrived: the route table's Placeholder. */
export function GalleryLoadingView() {
  const phone = useIsPhone();
  const [params, setParams] = useSearchParams();
  const view: GalleryViewMode = params.get("view") === "dashboard" ? "dashboard" : "feed";
  const write = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };
  const heading = <FeedHeading line={null} view={view} onViewChange={(next) => write("view", next === "dashboard" ? next : null)} phone={phone} />;
  const search = <RefinedSearchField query={params.get("q")} onSearch={(query) => write("q", query)} phone={phone} />;
  if (phone) {
    return (
      <div data-testid="gallery-view" data-viewport="mobile" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        {heading}
        {search}
        <ScrollRow gap={6} label="Filter the gallery">
          {DEFAULT_MENUS.map((menu) => (
            <FilterChip key={menu.key} data-testid={`feed-menu-${menu.key}`} label={`${menu.label} · ${menu.value}`} on={false} aria-haspopup="dialog" onClick={inert} />
          ))}
        </ScrollRow>
        <ListSkeleton />
      </div>
    );
  }
  return (
    <div data-testid="gallery-view" data-viewport="desktop" style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 680, minWidth: 0 }}>
        {heading}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {search}
          {DEFAULT_MENUS.map((menu) => (
            <MenuButton key={menu.key} label={menu.label} value={menu.value} data-testid={`feed-menu-${menu.key}`} onClick={inert} />
          ))}
        </div>
        <ListSkeleton />
      </div>
    </div>
  );
}
