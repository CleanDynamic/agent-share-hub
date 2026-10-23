/* CA-16b: the Gallery as the "Gallery with filters" board draws it. It takes the same props as the feed (`GalleryFeedViewProps`)
   and is drawn instead of it when the classification filters are live.

   TOP TO BOTTOM. The heading row ("Gallery" at 22/500/28; the two quick filters at the right). The search, 18 below: 38 tall,
   the well, a search glyph 12 from its left. The tabs and the lens on one row, 18 below: "All builds", "By field", "By task",
   "By what was built" and "By technique" over a hairline, the chosen one with a 2px line; All, Proven, Rebuilt and Unsolved
   as a segmented control. The collections, 22 below. Then the filters (248 wide, a hairline on their right) and the builds,
   28 below, side by side, 32 apart. The builds are items, not cards: each has a hairline above it and reads author, title (with
   the Regulated area tag), summary, the two classification lines and the proof line. There is no cover picture.

   NARROWER. Below 1100 the grid has two columns. Below 768 the filters sit behind a "Filters" button in a sheet, the grid has
   one column, the tabs scroll sideways and the collections stack.

   THE ORDER LINE tells the truth: the Gallery asks for builds with the most worked reproductions first and then the newest. */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Glyph } from "@/components/brand/Glyph";
import { Segmented } from "@/components/brand/Segmented";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { EmptyState } from "@/components/brand/EmptyState";
import { ErrorState } from "@/components/brand/ErrorState";
import { RegulatedTag } from "@/components/classify/ClassificationBits";
import { ClassificationFilters, QuickFilters, describeKey } from "@/components/gallery/ClassificationFilters";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone, useMinWidth } from "@/components/shell/useMinWidth";
import type { BuildTries } from "@/lib/build/gallery";
import type { GalleryFeedRow, GalleryLens } from "@/lib/build/gallery";
import type { GalleryBy } from "@/lib/build/galleryParams";
import { classificationLines } from "@/lib/classify/lines";
import type { Classification } from "@/lib/classify/types";
import { visibleCollections } from "@/lib/classify/collections";
import { keysOf } from "@/lib/classify/collections";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import type { GalleryFeedViewProps } from "./GalleryFeedView";

export const ORDER_LINE = "Proven builds first, then newest";
export const SEARCH_PLACEHOLDER = "Search builds, fields, tasks, tools. For example: NLP, Stata, marking, trading bot";

export const TABS: readonly { value: GalleryBy | null; label: string }[] = [
  { value: null, label: "All builds" },
  { value: "field", label: "By field" },
  { value: "task", label: "By task" },
  { value: "built", label: "By what was built" },
  { value: "technique", label: "By technique" },
];

const LENSES: readonly { value: GalleryLens; label: string }[] = [
  { value: "all", label: "All" },
  { value: "proven", label: "Proven" },
  { value: "rebuilt", label: "Rebuilt" },
  { value: "unsolved", label: "Unsolved" },
];

export interface GalleryBoardExtras {
  tab: GalleryBy | null;
  onTab: (tab: GalleryBy | null) => void;
  lens: GalleryLens;
  onLens: (lens: GalleryLens) => void;
  /** How many tried each build and how many got it working, by build id. */
  tries?: Readonly<Record<string, BuildTries>>;
  /** The grouped builds for a tab other than All builds, drawn by the page (it asks for them). */
  groups?: ReactNode;
}

const text = (px: number, weight: 400 | 500, color: string, extra: CSSProperties = {}): CSSProperties => ({ fontFamily: FIGTREE, fontSize: px, fontWeight: weight, lineHeight: "normal", color, ...extra });
const mono = (px: number, color: string, extra: CSSProperties = {}): CSSProperties => ({ fontFamily: DM_MONO, fontSize: px, lineHeight: "normal", color, ...extra });

/** The lens, applied to the rows that are loaded: proven (someone got it working), rebuilt, unsolved (an open bounty). */
export function lensRows(rows: readonly GalleryFeedRow[], lens: GalleryLens): GalleryFeedRow[] {
  if (lens === "proven") return rows.filter((row) => (row.reproduction_count ?? 0) > 0);
  if (lens === "rebuilt") return rows.filter((row) => (row.rebuild_count ?? 0) > 0);
  if (lens === "unsolved") return rows.filter((row) => (row.bounties ?? []).length > 0);
  return [...rows];
}

/** The proof line: "3 of 4 people got it working", or "Not yet reproduced". The dot only when more than half got it working. */
export function proofLine(tries: BuildTries | undefined, worked: number): { text: string; dot: boolean } {
  const tried = Math.max(tries?.tried ?? 0, worked, 0);
  const got = tries ? tries.worked : worked;
  if (tried === 0) return { text: "Not yet reproduced", dot: false };
  return { text: `${got} of ${tried} ${tried === 1 ? "person" : "people"} got it working`, dot: got * 2 > tried };
}

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

/** One build in the grid: a hairline above it, padding 20 0 24, a column with gap 6. */
export function BoardItem({ row, classification, tries }: { row: GalleryFeedRow; classification?: Classification; tries?: BuildTries }) {
  const lines = classificationLines(classification ?? null);
  const name = (row.creatorName ?? row.creatorHandle ?? "").trim();
  const proof = proofLine(tries, row.reproduction_count ?? 0);
  const outcome = (row.outcome ?? "").trim();
  return (
    <article data-testid="board-item" aria-label={row.title} style={{ borderTop: `1px solid ${t.hairline}`, padding: "20px 0 24px", display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span aria-hidden="true" style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 13, background: t.controlOn, display: "inline-flex", alignItems: "center", justifyContent: "center", ...text(10.5, 500, t.text) }}>
          {initialsOf(name) || "?"}
        </span>
        {name ? <span style={{ ...text(13, 500, t.text), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span> : null}
        {row.creatorHandle ? <span style={{ ...text(13, 400, t.label), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{`@${row.creatorHandle}`}</span> : null}
      </div>
      <div style={{ marginTop: 6, display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 6, rowGap: 4, minWidth: 0 }}>
        <h3 style={{ ...text(15, 500, t.text), margin: 0, lineHeight: "20px", overflowWrap: "anywhere" }}>
          <Link to={`/b2/${row.slug}`} data-testid="feed-build-title" style={{ color: "inherit", textDecoration: "none" }}>
            {row.title}
          </Link>
        </h3>
        {lines.regulated ? <RegulatedTag /> : null}
      </div>
      {outcome ? <p style={{ ...text(13, 400, t.text2), margin: 0, lineHeight: "19px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{outcome}</p> : null}
      {lines.line1.length > 0 ? <p data-card-part="classification-1" style={{ ...mono(11.5, t.text), margin: "4px 0 0", lineHeight: "17px", overflowWrap: "anywhere" }}>{lines.line1.join(" · ")}</p> : null}
      {lines.line2.length > 0 ? <p data-card-part="classification-2" style={{ ...text(12, 400, t.text2), margin: 0, overflowWrap: "anywhere" }}>{lines.line2.join(" · ")}</p> : null}
      <p data-testid="board-proof" style={{ ...text(12, 400, t.label), margin: "2px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
        {proof.dot ? <span data-testid="board-proof-dot" aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 4, background: t.evidence, flexShrink: 0 }} /> : null}
        {proof.text}
      </p>
    </article>
  );
}

function BoardSearch({ query, onSearch, phone }: { query: string | null; onSearch: (query: string | null) => void; phone: boolean }) {
  const [value, setValue] = useState(query ?? "");
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
  const { state, handlers } = useInteractive<HTMLInputElement>();
  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        send(value);
      }}
      style={{ margin: 0, position: "relative" }}
    >
      <span aria-hidden="true" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "inline-flex", color: t.label }}>
        <Glyph name="search" size={16} />
      </span>
      <input
        type="search"
        name="q"
        aria-label="Search the gallery"
        placeholder={SEARCH_PLACEHOLDER}
        value={value}
        {...handlers}
        onChange={(event) => {
          setValue(event.target.value);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => send(event.target.value), 300);
        }}
        style={{ width: "100%", boxSizing: "border-box", height: phone ? 44 : 38, padding: "0 12px 0 36px", borderRadius: 9, background: t.well, border: `1px solid ${t.wellBorder}`, boxShadow: t.wellShadow, fontFamily: FIGTREE, fontSize: phone ? 16 : 13.5, color: t.text, ...ring(state.focusVisible) }}
      />
    </form>
  );
}

function Tab({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onClick}
      {...handlers}
      style={{ flexShrink: 0, padding: "10px 0", marginBottom: -1, border: 0, borderBottomWidth: 2, borderBottomStyle: "solid", borderBottomColor: on ? t.text : "transparent", background: "transparent", cursor: "pointer", whiteSpace: "nowrap", ...text(13, 400, on || state.hovered ? t.text : t.text2), ...ring(state.focusVisible) }}
    >
      {label}
    </button>
  );
}

function Collections({ counts, onApply, phone }: { counts: Readonly<Record<string, number>>; onApply: (keys: string[]) => void; phone: boolean }) {
  const shown = visibleCollections(counts);
  if (shown.length === 0) return null;
  return (
    <section aria-label="Collections" data-testid="collections" style={{ display: "grid", gridTemplateColumns: phone ? "minmax(0, 1fr)" : "repeat(3, minmax(0, 1fr))", gap: 12 }}>
      {shown.map(({ collection, count }) => (
        <button
          key={collection.id}
          type="button"
          onClick={() => onApply(keysOf(collection))}
          style={{ textAlign: "left", cursor: "pointer", padding: "14px 16px", boxSizing: "border-box", borderRadius: 10, background: t.module, border: `1px solid ${t.moduleBorder}`, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}
        >
          <span style={text(13.5, 500, t.text)}>{collection.name}</span>
          <span style={mono(11.5, t.label)}>{`${collection.line} · ${count} ${count === 1 ? "build" : "builds"}`}</span>
        </button>
      ))}
    </section>
  );
}

export function GalleryBoard(props: GalleryFeedViewProps & { board: GalleryBoardExtras; classification: NonNullable<GalleryFeedViewProps["classification"]> }) {
  const { classification, board, status, list } = props;
  const phone = useIsPhone();
  const wide = useMinWidth(1100);
  const [sheet, setSheet] = useState(false);
  const columns = phone ? 1 : wide ? 3 : 2;

  const rows = list.kind === "all" ? list.list.rows.map((entry) => entry.build) : [...list.reproducedOn.rows, ...list.notYet.rows].map((entry) => entry.build);
  const shown = lensRows(rows, board.lens);
  const section = list.kind === "all" ? list.list : list.notYet;

  const filtersPanel = <ClassificationFilters counts={classification.counts} selected={classification.selected} onToggle={classification.onToggle} phone={phone} />;
  const apply = (keys: string[]) => {
    if (classification.onApply) classification.onApply(keys);
    else for (const key of keys) if (!classification.selected.includes(key)) classification.onToggle(key);
  };

  const heading = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <h1 style={{ ...text(22, 500, t.text), margin: 0, lineHeight: "28px" }}>Gallery</h1>
      <QuickFilters selected={classification.selected} onToggle={classification.onToggle} phone={phone} />
    </div>
  );

  const lens = <Segmented<GalleryLens> label="Lens" size={28} fontSize={12} value={board.lens} onChange={board.onLens} items={LENSES.map((entry) => ({ value: entry.value, label: entry.label }))} />;

  const tabs = (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: phone ? "nowrap" : "wrap", minWidth: 0 }}>
      <div role="tablist" aria-label="Group the builds" style={{ display: "flex", gap: 22, borderBottom: `1px solid ${t.hairline}`, overflowX: "auto", minWidth: 0, flexGrow: phone ? 1 : 0 }}>
        {TABS.map((tab) => (
          <Tab key={tab.label} label={tab.label} on={board.tab === tab.value} onClick={() => board.onTab(tab.value)} />
        ))}
      </div>
      {phone ? null : lens}
    </div>
  );

  const active = classification.selected.length > 0 || props.query ? (
    <div data-testid="feed-active-filters" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      {props.query ? <ActiveChip label={`“${props.query}”`} onRemove={() => props.onSearch(null)} /> : null}
      {classification.selected.map((key) => (
        <ActiveChip key={key} label={describeKey(key)} onRemove={() => classification.onToggle(key)} />
      ))}
      <button type="button" onClick={props.onClearAll} style={{ ...text(12.5, 400, t.text2), border: 0, background: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, minHeight: phone ? 44 : undefined }}>
        Clear all
      </button>
    </div>
  ) : null;

  const builds = (): ReactNode => {
    if (board.tab !== null) return board.groups ?? null;
    if (status === "loading") {
      return (
        <LoadingRegion what="the gallery" data-testid="gallery-loading" style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, columnGap: 32 }}>
          {Array.from({ length: columns * 2 }, (_, i) => (
            <div key={i} style={{ borderTop: `1px solid ${t.hairline}`, padding: "20px 0 24px", display: "flex", flexDirection: "column", gap: 8 }}>
              <Skeleton width="50%" height={16} />
              <Skeleton width="85%" height={20} />
              <Skeleton width="100%" height={36} />
            </div>
          ))}
        </LoadingRegion>
      );
    }
    if (status === "error") {
      return <ErrorState line={props.errorKind === "permission" ? "You don't have access to this." : undefined} panel="The gallery" onRetry={props.onRetry} error={props.error} />;
    }
    if (shown.length === 0) {
      return <EmptyState data-testid="gallery-empty" line={props.query ? `Nobody has hung a build for “${props.query}” yet.` : "No builds match these filters yet."} action={{ label: "Ask for it on Bounties", onClick: () => props.onNavigate("/bounties") }} />;
    }
    return (
      <>
        <div data-testid="board-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, columnGap: 32 }}>
          {shown.map((row) => (
            <BoardItem key={row.id} row={row} classification={props.classifications?.[row.id]} tries={board.tries?.[row.id]} />
          ))}
        </div>
        {section.hasMore ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 12 }}>
            <button type="button" disabled={section.loadingMore} onClick={section.onMore} style={{ ...text(13, 500, t.text), height: phone ? 44 : 32, padding: "0 16px", borderRadius: 6, background: t.control, border: `1px solid ${t.controlBorder}`, boxShadow: t.controlShadow, cursor: "pointer" }}>
              {section.loadingMore ? "Loading…" : "Show more"}
            </button>
          </div>
        ) : null}
      </>
    );
  };

  return (
    <div data-testid="gallery-view" data-viewport={phone ? "mobile" : "desktop"} data-gallery-board="" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      {heading}
      <div style={{ marginTop: 18 }}>
        <BoardSearch query={props.query} onSearch={props.onSearch} phone={phone} />
      </div>
      <div style={{ marginTop: 18 }}>{tabs}</div>
      {phone ? <div style={{ marginTop: 12 }}>{lens}</div> : null}
      <div style={{ marginTop: 22 }}>
        <Collections counts={classification.counts} onApply={apply} phone={phone} />
      </div>
      {active ? <div style={{ marginTop: 16 }}>{active}</div> : null}
      <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: phone ? "minmax(0, 1fr)" : "248px minmax(0, 1fr)", columnGap: 32, alignItems: "start", minWidth: 0 }}>
        {phone ? null : (
          <aside aria-label="Filters" style={{ borderRight: `1px solid ${t.hairline}`, paddingRight: 24, minWidth: 0 }}>
            {filtersPanel}
          </aside>
        )}
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
          {phone ? (
            <div style={{ marginBottom: 12 }}>
              <button type="button" aria-haspopup="dialog" onClick={() => setSheet(true)} style={{ ...text(13, 500, t.text), height: 44, padding: "0 16px", borderRadius: 6, background: t.control, border: `1px solid ${t.controlBorder}`, boxShadow: t.controlShadow, cursor: "pointer" }}>
                Filters
              </button>
            </div>
          ) : null}
          <p data-testid="feed-count" style={{ ...mono(11.5, t.label), margin: "0 0 12px" }}>
            {ORDER_LINE}
          </p>
          {builds()}
        </div>
      </div>
      {phone ? (
        <BottomSheet open={sheet} onOpenChange={setSheet} title="Filters">
          {filtersPanel}
        </BottomSheet>
      ) : null}
    </div>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button type="button" aria-label={`Remove ${label}`} onClick={onRemove} style={{ ...text(12, 400, t.text), height: 26, padding: "0 10px", borderRadius: 7, background: t.controlOn, border: `1px solid var(--seg-on-border, ${t.controlBorder})`, cursor: "pointer" }}>
      {label}
    </button>
  );
}
