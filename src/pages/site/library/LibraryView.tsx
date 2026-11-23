/* SV-09: the Library, as `design/reference/vision/dusk/library.html` draws it. Pure: typed props, no fetching, no
   router hooks but `Link`.

   Left: "Library" and its counts, the kinds (each with its count), the collections. Main: the changes since the last
   visit, then the kind's tabs, its filters and its table. Right: the selected item in a module, then a collection's
   preview. Each section is its own component and is drawn only when its prop is given, so the live page draws what has
   a source and the dev page draws the whole board. */

import type { EmptyStateAction } from "@/components/pagestate/PageState";
import { PageState } from "@/components/pagestate/PageState";
import { shownState, type ReadLike } from "@/components/pagestate/pageStateModel";
import type { Thing } from "@/lib/copy/copy";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { Link } from "react-router-dom";

import { WaterField } from "@/components/brand/FluidField";
import { PostCard } from "@/components/post/PostCard";
import type { PostCardData } from "@/components/post/postCardModel";
import { VisuallyHidden } from "@/components/brand/VisuallyHidden";
import { ActiveFilterChip } from "@/components/vision/ActiveFilterChip";
import type { FigurePart } from "@/components/vision/PageFigure";
import { SectionChevron } from "@/components/vision/SectionHead";
import { TextTabs } from "@/components/vision/TextTabs";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { PANEL_PAD } from "@/components/shell/chromeSize";
import { ring, touchArea } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { WELL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import {
  CollectionSkeletons,
  LibraryColumns,
  LibraryControl,
  LibraryHead,
  LibraryPrimary,
  LibraryTextButton,
  ROW_HEIGHT,
  TableRowSkeletons,
  useLibraryLayout,
} from "./LibraryFrame";
import { STATE_WORD, type ChangeTag, type CollectionEntry, type ItemState, type LibraryChange, type LibraryKind, type LibraryRow } from "./libraryModel";

/* ── props ── */

/** G4: a panel's reads, as PageState takes them. */
export type PanelRead = ReadLike | readonly ReadLike[];

export interface LibraryKindsProps {
  items: readonly { value: LibraryKind; label: string; count: number; href: string }[];
  value: LibraryKind | null;
  onChange: (kind: LibraryKind) => void;
}

export interface LibraryCollectionsProps {
  read: PanelRead;
  items: readonly CollectionEntry[];
  /** The open collection. */
  current: string | null;
  hrefFor: (id: string) => string;
  /** Your own library: the head's New. */
  onNew?: () => void;
  /** The one line when there are none. */
  emptyLine: string;
}

export interface LibraryChangesProps {
  figure: string;
  parts: readonly FigurePart[];
  to?: string;
  rows: readonly LibraryChange[];
}

/** An open collection, over the table: its name, what it is, and (your own) its actions. */
export interface LibraryCollectionHeading {
  name: string;
  meta: string;
  actions?: readonly { label: string; onClick: () => void; disabled?: boolean }[];
}

/** `title` makes it the page's own empty state (a head, the line, two actions and a field of dots); without it, one line and an action. */
export type LibraryEmpty = { title?: string; line: string; action: { label: string; href: string } | { label: string; onClick: () => void } };

export interface LibraryItemsProps {
  heading?: LibraryCollectionHeading;
  tabs: readonly { value: string; label: string }[];
  tab: string;
  onTab: (tab: string) => void;
  /** The Filters and Sort controls (SV-24). */
  controls?: { filters: number; sort: string; onFilters: () => void; onSort: () => void };
  chips?: readonly { name: string; value: string; onRemove: () => void }[];
  sameAsBuilds?: boolean;
  read: PanelRead;
  /** What failed, for "Couldn't load <thing>. Try again." */
  thing: Thing;
  empty: LibraryEmpty;
  /** The first column's name: "Step", "Build". */
  itemColumn: string;
  rows: readonly LibraryRow[];
  /** UX-07 P4: the Topics kind lists its saved topics as compact post cards, in place of the table. */
  topics?: readonly LibraryTopic[];
  selected: string | null;
  onSelect: (id: string) => void;
  more?: { loading: boolean; onMore: () => void };
}

/** UX-07 P4: a saved topic: its compact card, or (once hidden or gone) the heading it was saved with. */
export interface LibraryTopic {
  id: string;
  card: PostCardData | null;
  title: string;
  onUnsave: () => void;
}

export interface DiffLine {
  text: string;
  change?: "added" | "removed";
}

interface SelectedBase {
  id: string;
  chip: string;
  state?: { text: string; tone?: "lit" | "breakage" | "label" };
  title: string;
  source?: string | null;
  rows: readonly { label: string; value: ReactNode }[];
  onCopy: () => void;
  copyLabel?: string;
  openHref?: string;
}

/** A step, a prompt or a part: its saved and current versions (SV-19), its note (SV-17). */
export interface SelectedStep extends SelectedBase {
  kind: "step";
  versions?: { value: "saved" | "current"; onChange: (value: "saved" | "current") => void; saved: readonly DiffLine[]; current: readonly DiffLine[]; changed: string };
  note?: { value: string; onChange: (value: string) => void; /** The reader left the field: save it. */ onCommit?: () => void };
  onUse?: () => void;
  /** Take it out of the Library. */
  onRemove?: () => void;
}

/** A saved build: Open as the one primary. */
export interface SelectedBuild extends SelectedBase {
  kind: "build";
  openHref: string;
  onAddToCollection?: () => void;
  onRemoveFromCollection?: { name: string; onRemove: () => void };
}

export type LibrarySelected = SelectedStep | SelectedBuild;

export interface LibraryPreviewProps {
  name: string;
  meta: string;
  to: string;
  rows: readonly { id: string; title: string; type: string }[];
  read: PanelRead;
  onStart?: () => void;
}

export interface LibraryViewProps {
  head: { title: string; meta: ReactNode };
  kinds?: LibraryKindsProps;
  collections: LibraryCollectionsProps;
  changes?: LibraryChangesProps;
  items: LibraryItemsProps;
  selected: LibrarySelected | null;
  preview?: LibraryPreviewProps;
  /** Topics the reader may follow, as side rows. Absent or empty: the section is not drawn. */
  topicsToFollow?: readonly { id: string; title: string; href: string }[];
}

/* ── shared ── */

const small: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", color: t.label };
const ellipsis: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };


/* ── the kinds, as pills ── */

function KindPill({ item, current }: { item: LibraryKindsProps["items"][number]; current: boolean }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  const phone = useIsPhone();
  return (
    <Link
      to={item.href}
      aria-current={current ? "page" : undefined}
      {...handlers}
      style={{
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: phone ? 44 : 32,
        padding: "0 16px",
        borderRadius: 16,
        background: current ? t.module : state.hovered ? t.module : "transparent",
        border: `1px solid ${current ? t.selectedEdge : t.controlBorder}`,
        fontFamily: FIGTREE,
        fontSize: 13,
        fontWeight: current ? 600 : 500,
        whiteSpace: "nowrap",
        color: current || state.hovered ? t.text : t.text2,
        textDecoration: "none",
        ...ring(state.focusVisible),
      }}
    >
      <span>{item.label}</span>
      <span style={{ fontWeight: 400, color: t.label, fontVariantNumeric: "tabular-nums" }}>{item.count}</span>
    </Link>
  );
}

export function LibraryKinds({ items, value }: LibraryKindsProps) {
  return (
    <nav aria-label="Kinds" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
      {items.map((item) => (
        <KindPill key={item.value} item={item} current={item.value === value} />
      ))}
    </nav>
  );
}

/** On a phone the kinds are a row of tabs. */
export function LibraryKindTabs({ items, value, onChange }: LibraryKindsProps) {
  return (
    <div style={{ marginBottom: 12, overflowX: "auto" }}>
      <TextTabs label="Kinds" height={32} tabs={items.map((item) => ({ value: item.value, label: item.label, count: item.count }))} value={value ?? "all"} onChange={onChange} />
    </div>
  );
}

/* ── the side: the collections, as Cards ── */

const SIDE_HEAD: CSSProperties = { margin: 0, fontFamily: FIGTREE, fontSize: 20, fontWeight: 600, lineHeight: "24px", color: t.text };

function CollectionRow({ item, current, href }: { item: CollectionEntry; current: boolean; href: string }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={href}
      data-testid="library-collection"
      aria-current={current ? "page" : undefined}
      {...handlers}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
        minHeight: 56,
        padding: "0 12px",
        boxSizing: "border-box",
        borderRadius: r.card,
        background: t.module,
        border: `1px solid ${current || state.hovered ? t.selectedEdge : "transparent"}`,
        fontFamily: FIGTREE,
        color: t.text,
        textDecoration: "none",
        ...ring(state.focusVisible),
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 600, lineHeight: "20px", ...ellipsis }}>{item.name}</span>
        <span style={{ ...small, display: "block", lineHeight: "16px" }}>{item.meta}</span>
      </span>
      <span style={{ fontSize: 13, color: t.label, fontVariantNumeric: "tabular-nums" }}>{item.count}</span>
    </Link>
  );
}

export function LibraryCollections({ read, items, current, hrefFor, onNew, emptyLine }: LibraryCollectionsProps) {
  const ready = shownState(Array.isArray(read) ? read : [read as ReadLike]) === "ready";
  return (
    <section aria-label="Collections">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 32, paddingBottom: 8 }}>
        {/* The fact is the heading: "3 collections". */}
        <h2 style={SIDE_HEAD}>{ready ? `${items.length} ${items.length === 1 ? "collection" : "collections"}` : "Collections"}</h2>
        {onNew ? (
          <LibraryTextButton onClick={onNew} aria-label="New collection">
            New
          </LibraryTextButton>
        ) : null}
      </div>
      <PageState
        read={read}
        thing="your collections"
        region="Collections"
        skeleton={<CollectionSkeletons />}
        empty={{ when: () => items.length === 0, line: emptyLine, testId: "library-collections-empty" }}
      >
        {() => (
          <div data-testid="library-collections" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((item) => (
              <CollectionRow key={item.id} item={item} current={item.id === current} href={hrefFor(item.id)} />
            ))}
          </div>
        )}
      </PageState>
    </section>
  );
}

/* ── main: the changes ── */

/** Run-based change kinds are gone; what is left is what happened to a saved thing. */
const CHANGE_WORD: Record<ChangeTag, string> = { EDITED: "Edited", REMOVED: "Removed", REBUILD: "Rebuilt" };

export function LibraryChanges({ figure, parts, to, rows }: LibraryChangesProps) {
  return (
    <section aria-label="Changes" data-testid="library-changes" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h2 style={SIDE_HEAD}>{figure}</h2>
          <p style={{ ...small, margin: 0 }}>{parts.map((part) => part.text).join(" · ")}</p>
        </div>
        {to ? <SectionChevron to={to} name="all changes" /> : null}
      </div>
      <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((row) => (
          <li key={row.id} style={{ padding: "8px 12px", borderRadius: r.card, background: t.module, fontFamily: FIGTREE }}>
            <span style={{ display: "block", fontSize: 15, fontWeight: 600, lineHeight: "20px", color: t.text, ...ellipsis }}>{row.item}</span>
            <span style={{ ...small, display: "block", lineHeight: "16px" }}>{[CHANGE_WORD[row.tag], row.detail, row.age].filter(Boolean).join(" · ")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── main: the saved things, as Cards ── */

/* G6: words, so the legible inks: --lit-ink and --breakage-ink reach 4.5:1 on Noon's rows; Dusk's read as before. */
const STATE_COLOUR: Record<ItemState, string> = { same: t.text2, edited: t.litInk, removed: t.breakageInk };

function ItemRow({ row, selected, usedIn, onSelect }: { row: LibraryRow; selected: boolean; usedIn: boolean; onSelect: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  /* Facts are plain text joined by " · ": what it is, what happened to it (only when something did), where it is used,
     when it was last used. */
  const facts = [row.type, row.state === "same" ? null : STATE_WORD[row.state], usedIn && row.usedIn ? `Used in ${row.usedIn}` : null, row.lastUsed].filter(Boolean);
  return (
    /* G21: the row is not in a grid, so its selected state is aria-pressed on its button, which fills the row. */
    <li data-testid="library-row" style={{ listStyle: "none" }}>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        {...handlers}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          width: "100%",
          minHeight: ROW_HEIGHT,
          justifyContent: "center",
          boxSizing: "border-box",
          padding: "8px 12px",
          background: t.module,
          border: `1px solid ${selected || state.hovered ? t.selectedEdge : "transparent"}`,
          borderRadius: r.card,
          textAlign: "left",
          fontFamily: FIGTREE,
          color: t.text,
          cursor: "pointer",
          ...ring(state.focusVisible),
        }}
      >
        <span style={{ display: "block", fontSize: 15, fontWeight: 600, lineHeight: "20px", ...ellipsis }}>{row.title}</span>
        {row.detail ? <span style={{ ...small, display: "block", lineHeight: "16px", ...ellipsis }}>{row.detail}</span> : null}
        <span style={{ ...small, display: "block", lineHeight: "16px" }}>
          {facts.map((fact, index) => (
            <span key={index}>
              {index > 0 ? " · " : null}
              <span style={{ color: row.state !== "same" && fact === STATE_WORD[row.state] ? STATE_COLOUR[row.state] : undefined }}>{fact}</span>
            </span>
          ))}
        </span>
      </button>
    </li>
  );
}

function CollectionHeading({ heading }: { heading: LibraryCollectionHeading }) {
  return (
    <div data-testid="library-collection-open" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
      <div>
        <h2 style={SIDE_HEAD}>{heading.name}</h2>
        <p style={{ ...small, margin: 0 }}>{heading.meta}</p>
      </div>
      {heading.actions?.length ? (
        <div data-testid="library-collection-actions" style={{ display: "flex", gap: 6 }}>
          {heading.actions.map((action) => (
            <LibraryControl key={action.label} onClick={action.onClick} disabled={action.disabled}>
              {action.label}
            </LibraryControl>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** UX-07 P4: saved topics, each the compact post card, then Remove from Library. */
function TopicCards({ topics }: { topics: readonly LibraryTopic[] }) {
  return (
    <ol data-testid="library-topics" aria-label="Saved topics" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {topics.map((topic) => (
        <li key={topic.id} data-testid="library-topic" style={{ paddingBottom: 12 }}>
          {topic.card ? <PostCard card={topic.card} compact /> : <p style={{ margin: 0, padding: "20px 0 8px", fontFamily: FIGTREE, fontSize: 13, color: t.text2 }}>{topic.title || "A topic that is no longer shown"}</p>}
          <LibraryTextButton onClick={topic.onUnsave}>Remove from Library</LibraryTextButton>
        </li>
      ))}
    </ol>
  );
}

/** The page's own empty state: a head, one line, two actions, and a field of dots that fades in from the right edge. */
function LibraryEmptyBlock({ empty, onHow }: { empty: LibraryEmpty; onHow: () => void }) {
  return (
    <div data-testid="library-empty" style={{ position: "relative", padding: "24px 4px 40px", minHeight: 200 }}>
      {/* The dots fade in from the right edge: two fields, a wide faint one under a narrow stronger one. */}
      {[
        { width: "38%", opacity: 0.2 },
        { width: "18%", opacity: 0.35 },
      ].map((layer) => (
        <div key={layer.width} aria-hidden="true" style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: layer.width, opacity: layer.opacity, pointerEvents: "none" }}>
          <WaterField />
        </div>
      ))}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
        <h2 style={SIDE_HEAD}>{empty.title}</h2>
        <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px", color: t.text2 }}>{empty.line}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {"href" in empty.action ? (
            <LibraryControl href={empty.action.href}>{empty.action.label}</LibraryControl>
          ) : (
            <LibraryControl onClick={empty.action.onClick}>{empty.action.label}</LibraryControl>
          )}
          <LibraryControl variant="ghost" onClick={onHow}>
            How saving works
          </LibraryControl>
        </div>
      </div>
    </div>
  );
}

/** "How saving works" is a side section on the same page: its button moves the reader there. */
export const HOW_SAVING_ID = "library-how-saving";

function showHowSaving() {
  const section = document.getElementById(HOW_SAVING_ID);
  if (!section) return;
  section.scrollIntoView({ block: "nearest" });
  section.focus({ preventScroll: true });
}

export function LibraryItems(props: LibraryItemsProps) {
  const { heading, tabs, tab, onTab, controls, chips, sameAsBuilds, read, thing, empty, itemColumn, rows, selected, onSelect, more } = props;
  const usedIn = rows.some((row) => row.usedIn !== undefined);
  const ready = shownState(Array.isArray(read) ? read : [read as ReadLike]) === "ready";
  const emptyAction: EmptyStateAction = "href" in empty.action ? { label: empty.action.label, href: empty.action.href } : { label: empty.action.label, onClick: empty.action.onClick };
  let list: () => ReactNode;
  if (props.topics) list = () => <TopicCards topics={props.topics ?? []} />;
  else if (empty.title && rows.length === 0) list = () => <LibraryEmptyBlock empty={empty} onHow={showHowSaving} />;
  else list = () => (
      <ul data-testid="library-list" aria-label={itemColumn === "Build" ? "Saved builds" : "Saved items"} style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((row) => (
          <ItemRow key={row.id} row={row} selected={row.id === selected} usedIn={usedIn} onSelect={() => onSelect(row.id)} />
        ))}
      </ul>
  );
  return (
    <section aria-label={itemColumn === "Build" ? "Saved builds" : "Saved items"} data-testid="library-items">
      {heading ? <CollectionHeading heading={heading} /> : null}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <TabsOnRule tabs={tabs} tab={tab} onTab={onTab} />
        {controls ? (
          <div style={{ display: "flex", gap: 6 }}>
            <LibraryControl onClick={controls.onFilters}>
              <span style={{ color: t.text2 }}>Filters</span> {controls.filters}
            </LibraryControl>
            <LibraryControl onClick={controls.onSort}>
              <span style={{ color: t.text2 }}>Sort</span> {controls.sort}
            </LibraryControl>
          </div>
        ) : null}
      </div>
      {chips?.length || sameAsBuilds ? (
        /* G17: a chip removed hands focus to the next chip (FocusRescue reads this as a list). */
        <div data-focus-list="" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4, marginBottom: 8 }}>
          {chips?.map((chip) => <ActiveFilterChip key={chip.name} name={chip.name} value={chip.value} onRemove={chip.onRemove} />)}
          {sameAsBuilds ? <span style={{ fontFamily: FIGTREE, fontSize: 13, color: t.label, alignSelf: "center", marginLeft: 6 }}>Same filters as Builds</span> : null}
        </div>
      ) : null}
      <PageState
        read={read}
        thing={thing}
        region={itemColumn === "Build" ? "Saved builds" : "Saved items"}
        skeleton={<TableRowSkeletons count={7} />}
        style={{ paddingBlock: 16 }}
        empty={empty.title ? undefined : { when: () => rows.length === 0, line: empty.line, action: emptyAction, testId: "library-empty" }}
      >
        {list}
      </PageState>
      {more && ready ? (
        <div style={{ marginTop: 16 }}>
          <LibraryControl onClick={more.onMore} disabled={more.loading}>
            Show more
          </LibraryControl>
        </div>
      ) : null}
    </section>
  );
}

/** The state tabs, on the row with the controls. */
function TabsOnRule({ tabs, tab, onTab }: { tabs: LibraryItemsProps["tabs"]; tab: string; onTab: (tab: string) => void }) {
  return (
    <div>
      <TextTabs label="State" height={32} tabs={tabs} value={tab} onChange={onTab} />
    </div>
  );
}

/* ── right: the selected item ── */

const STATE_TONE = { lit: t.litInk, breakage: t.breakageInk, label: t.label } as const;

function VersionSwitch({ value, onChange }: { value: "saved" | "current"; onChange: (value: "saved" | "current") => void }) {
  const options = [
    { value: "saved" as const, label: "Your saved version" },
    { value: "current" as const, label: "Current version" },
  ];
  const move = (event: KeyboardEvent<HTMLButtonElement>) => {
    // G18: the radio pattern takes all four arrows (two choices: any arrow switches).
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "saved" : event.key === "End" ? "current" : value === "saved" ? "current" : "saved";
    onChange(next);
    (event.currentTarget.parentElement?.querySelector(`[data-value="${next}"]`) as HTMLButtonElement | null)?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Version" style={{ display: "flex", alignItems: "center", boxSizing: "border-box", minHeight: 32, gap: 2, marginTop: 16, padding: 2, ...WELL, boxShadow: "none", borderRadius: r.control }}>
      {options.map((option) => (
        <VersionOption key={option.value} label={option.label} value={option.value} on={option.value === value} onChoose={() => onChange(option.value)} onKeyDown={move} />
      ))}
    </div>
  );
}

function VersionOption({ label, value, on, onChoose, onKeyDown }: { label: string; value: string; on: boolean; onChoose: () => void; onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void }) {
  const phone = useIsPhone();
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      data-value={value}
      tabIndex={on ? 0 : -1}
      onClick={onChoose}
      onKeyDown={onKeyDown}
      {...handlers}
      style={{
        flex: 1,
        height: 24,
        ...touchArea(phone),
        background: on ? t.control : "none",
        border: on ? `1px solid ${t.controlBorder}` : "1px solid transparent",
        borderRadius: r.chip,
        fontFamily: FIGTREE,
        fontSize: 13,
        color: on || state.hovered ? t.text : t.text2,
        cursor: "pointer",
        ...ring(state.focusVisible),
      }}
    >
      {label}
    </button>
  );
}

function Content({ lines }: { lines: readonly DiffLine[] }) {
  return (
    <div style={{ marginTop: 12, padding: 12, ...WELL, boxShadow: "none", borderRadius: r.control, fontFamily: DM_MONO, fontSize: 13, lineHeight: "18px", color: t.text2, whiteSpace: "pre-wrap" }}>
      {lines.map((line, index) => (
        <span key={index} style={{ display: "block", color: line.change === "removed" ? t.breakageInk : line.change === "added" ? t.evidence : undefined, textDecoration: line.change === "removed" ? "line-through" : undefined }}>
          {line.change ? <VisuallyHidden>{line.change === "removed" ? "Removed: " : "Added: "}</VisuallyHidden> : null}
          {line.text}
        </span>
      ))}
    </div>
  );
}

function SelectedRows({ rows }: { rows: SelectedBase["rows"] }) {
  return (
    <div style={{ marginTop: 12 }}>
      {rows.map((row) => (
        <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, minHeight: 32, fontFamily: FIGTREE, fontSize: 13 }}>
          <span style={{ color: t.label }}>{row.label}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: t.text, textAlign: "right" }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function LibrarySelectedItem({ item }: { item: LibrarySelected }) {
  return (
    <section aria-label={`Selected: ${item.title}`} data-testid="library-selected" style={{ padding: 16, background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: r.card }}>
      {/* What it is and where it stands, in one line of plain text: "Build · Saved 2d ago". */}
      <p style={{ ...small, margin: 0 }}>
        {item.chip}
        {item.state ? (
          <>
            {" · "}
            <span style={{ color: STATE_TONE[item.state.tone ?? "label"] }}>{item.state.text}</span>
          </>
        ) : null}
      </p>
      <h2 style={{ margin: "4px 0 0", fontFamily: FIGTREE, fontSize: 17, fontWeight: 600, lineHeight: "22px", color: t.text, overflowWrap: "anywhere" }}>{item.title}</h2>
      {item.source ? <p style={{ margin: "2px 0 0", fontFamily: FIGTREE, fontSize: 13, color: t.label }}>{item.source}</p> : null}

      {item.kind === "step" && item.versions ? (
        <>
          <VersionSwitch value={item.versions.value} onChange={item.versions.onChange} />
          <Content lines={item.versions.value === "saved" ? item.versions.saved : item.versions.current} />
          <p style={{ ...small, margin: "8px 0 0" }}>{item.versions.changed}</p>
        </>
      ) : null}

      {item.rows.length ? <SelectedRows rows={item.rows} /> : null}

      {item.kind === "step" && item.note ? (
        <label style={{ display: "block", marginTop: 12, fontFamily: FIGTREE, fontSize: 13, color: t.label }}>
          Your note
          <NoteField value={item.note.value} onChange={item.note.onChange} onCommit={item.note.onCommit} />
        </label>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
        {item.kind === "step" && item.onUse ? <LibraryPrimary onClick={item.onUse}>Use in a build</LibraryPrimary> : null}
        {item.kind === "build" ? <LibraryPrimary href={item.openHref}>Open</LibraryPrimary> : null}
        <LibraryControl onClick={item.onCopy}>{item.copyLabel ?? "Copy"}</LibraryControl>
        {item.kind === "step" && item.openHref ? <LibraryControl href={item.openHref}>Open source</LibraryControl> : null}
        {item.kind === "build" && item.onAddToCollection ? <LibraryControl onClick={item.onAddToCollection}>Add to a collection</LibraryControl> : null}
      </div>
      {item.kind === "step" && item.onRemove ? (
        <div style={{ marginTop: 12 }}>
          <LibraryTextButton onClick={item.onRemove}>Remove from Library</LibraryTextButton>
        </div>
      ) : null}
      {item.kind === "build" && item.onRemoveFromCollection ? (
        <div style={{ marginTop: 12 }}>
          <LibraryTextButton onClick={item.onRemoveFromCollection.onRemove}>Remove from {item.onRemoveFromCollection.name}</LibraryTextButton>
        </div>
      ) : null}
    </section>
  );
}

function NoteField({ value, onChange, onCommit }: { value: string; onChange: (value: string) => void; onCommit?: () => void }) {
  const { state, handlers } = useInteractive<HTMLTextAreaElement>({ onBlur: () => onCommit?.() });
  return (
    <textarea
      rows={2}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      {...handlers}
      style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, padding: "8px 10px", ...WELL, boxShadow: "none", borderRadius: r.control, color: t.text, fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", resize: "vertical", ...ring(state.focusVisible) }}
    />
  );
}

/* ── right: a collection's preview ── */

export function LibraryPreview({ name, meta, to, rows, read, onStart }: LibraryPreviewProps) {
  return (
    <section aria-label={`Collection: ${name}`} data-testid="library-preview">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 32, paddingBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ ...SIDE_HEAD, ...ellipsis }}>{name}</h2>
          <p style={{ ...small, margin: 0 }}>{meta}</p>
        </div>
        <SectionChevron to={to} name={name} />
      </div>
      <PageState read={read} thing="this collection" region={`Collection: ${name}`} skeleton={<CollectionSkeletons />}>
        {() =>
          rows.slice(0, 3).map((row) => (
            <div key={row.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minHeight: 32, fontFamily: FIGTREE, fontSize: 13 }}>
              <span style={{ minWidth: 0, color: t.text, ...ellipsis }}>{row.title}</span>
              <span style={small}>{row.type}</span>
            </div>
          ))
        }
      </PageState>
      {onStart ? (
        <div style={{ marginTop: 12 }}>
          <LibraryControl wide onClick={onStart}>
            Start a build from this collection
          </LibraryControl>
        </div>
      ) : null}
    </section>
  );
}

/* ── the side: how saving works, and topics to follow ── */

const HOW_SAVING = [
  "Save a build, a session or a step from where you find it.",
  "A saved step or part keeps the version you saved, and says when its source is edited or removed.",
  "Collections group saved builds, and each is private or public.",
] as const;

export function HowSavingWorks() {
  return (
    <section id={HOW_SAVING_ID} tabIndex={-1} aria-label="How saving works" style={{ outline: "none" }}>
      <h2 style={{ ...SIDE_HEAD, paddingBottom: 8 }}>How saving works</h2>
      <ul style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {HOW_SAVING.map((line) => (
          <li key={line} style={{ listStyle: "none", fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px", color: t.text2 }}>
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}

function TopicsToFollow({ topics }: { topics: NonNullable<LibraryViewProps["topicsToFollow"]> }) {
  return (
    <section aria-label="Topics to follow">
      <h2 style={{ ...SIDE_HEAD, paddingBottom: 8 }}>{`${topics.length} ${topics.length === 1 ? "topic" : "topics"} to follow`}</h2>
      <ul style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {topics.map((topic) => (
          <li key={topic.id} style={{ listStyle: "none" }}>
            <Link to={topic.href} style={{ display: "block", padding: "8px 12px", borderRadius: r.card, fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, lineHeight: "20px", color: t.text, textDecoration: "none", ...ellipsis }}>
              {topic.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── the page ── */

export function LibraryView({ head, kinds, collections, changes, items, selected, preview, topicsToFollow }: LibraryViewProps) {
  const layout = useLibraryLayout();
  return (
    <LibraryColumns
      layout={layout}
      head={<LibraryHead title={head.title} meta={head.meta} />}
      main={
        <>
          {kinds ? <LibraryKinds {...kinds} /> : null}
          {changes ? <LibraryChanges {...changes} /> : null}
          <LibraryItems {...items} />
        </>
      }
      side={
        <>
          <LibraryCollections {...collections} />
          {selected ? <LibrarySelectedItem item={selected} /> : null}
          {preview ? <LibraryPreview {...preview} /> : null}
          <HowSavingWorks />
          {topicsToFollow && topicsToFollow.length > 0 ? <TopicsToFollow topics={topicsToFollow} /> : null}
        </>
      }
    />
  );
}
