/* SV-09: the Library, as `design/reference/vision/dusk/library.html` draws it. Pure: typed props, no fetching, no
   router hooks but `Link`.

   Left: "Library" and its counts, the kinds (each with its count), the collections. Main: the changes since the last
   visit, then the kind's tabs, its filters and its table. Right: the selected item in a module, then a collection's
   preview. Each section is its own component and is drawn only when its prop is given, so the live page draws what has
   a source and the dev page draws the whole board. */

import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { Link } from "react-router-dom";

import { Plaque, PlaqueLamp, type PlaqueBuild } from "@/components/brand/Plaque";
import { VisuallyHidden } from "@/components/brand/VisuallyHidden";
import { ActiveFilterChip } from "@/components/vision/ActiveFilterChip";
import { PageFigure, type FigurePart } from "@/components/vision/PageFigure";
import { PlainRow } from "@/components/vision/PlainRow";
import { SectionChevron, SectionHead } from "@/components/vision/SectionHead";
import { TextTabs } from "@/components/vision/TextTabs";
import { TypeChip, type ChipTone } from "@/components/vision/TypeChip";
import { ring } from "@/lib/theme/controls";
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
  TABLE_ROW,
  TableRowSkeletons,
  useLibraryLayout,
} from "./LibraryFrame";
import { STATE_WORD, type ChangeTag, type CollectionEntry, type ItemState, type LibraryChange, type LibraryKind, type LibraryRow } from "./libraryModel";

/* ── props ── */

export type PanelStatus = "loading" | "error" | "ready";

export interface LibraryKindsProps {
  items: readonly { value: LibraryKind; label: string; count: number; href: string }[];
  value: LibraryKind | null;
  onChange: (kind: LibraryKind) => void;
}

export interface LibraryCollectionsProps {
  status: PanelStatus;
  items: readonly CollectionEntry[];
  /** The open collection. */
  current: string | null;
  hrefFor: (id: string) => string;
  /** Your own library: the head's New. */
  onNew?: () => void;
  onRetry: () => void;
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

export type LibraryEmpty = { line: string; action: { label: string; href: string } | { label: string; onClick: () => void } };

export interface LibraryItemsProps {
  heading?: LibraryCollectionHeading;
  tabs: readonly { value: string; label: string }[];
  tab: string;
  onTab: (tab: string) => void;
  /** The Filters and Sort controls (SV-24). */
  controls?: { filters: number; sort: string; onFilters: () => void; onSort: () => void };
  chips?: readonly { name: string; value: string; onRemove: () => void }[];
  sameAsBuilds?: boolean;
  status: PanelStatus;
  /** For the error line: "Builds didn't load." */
  what: string;
  onRetry: () => void;
  empty: LibraryEmpty;
  /** The first column's name: "Step", "Build". */
  itemColumn: string;
  rows: readonly LibraryRow[];
  selected: string | null;
  onSelect: (id: string) => void;
  more?: { loading: boolean; onMore: () => void };
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
  rows: readonly { label: string; value: ReactNode; lamp?: boolean }[];
  onCopy: () => void;
  copyLabel?: string;
  openHref?: string;
}

/** A step, a prompt or a part: its saved and current versions (SV-19), its note (SV-17). */
export interface SelectedStep extends SelectedBase {
  kind: "step";
  versions?: { value: "saved" | "current"; onChange: (value: "saved" | "current") => void; saved: readonly DiffLine[]; current: readonly DiffLine[]; changed: string };
  note?: { value: string; onChange: (value: string) => void };
  onUse?: () => void;
}

/** A saved build: its Plaque, and Open as the one primary. */
export interface SelectedBuild extends SelectedBase {
  kind: "build";
  build: PlaqueBuild;
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
  status: PanelStatus;
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
}

/* ── shared ── */

const small: CSSProperties = { fontFamily: FIGTREE, fontSize: 11.5, lineHeight: "20px", color: t.label };
const ellipsis: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

/** One sentence and Retry (CA-28's wording). */
function PanelError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, paddingBlock: 16 }}>
      <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, color: t.text }}>{what}</p>
      <LibraryControl size={28} onClick={onRetry}>
        Retry
      </LibraryControl>
    </div>
  );
}

/** One line and one action. */
function PanelEmpty({ empty, testId }: { empty: LibraryEmpty; testId: string }) {
  const { action } = empty;
  return (
    <div data-testid={testId} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, paddingBlock: 16 }}>
      <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, color: t.text2 }}>{empty.line}</p>
      {"href" in action ? (
        <LibraryControl size={28} href={action.href}>
          {action.label}
        </LibraryControl>
      ) : (
        <LibraryControl size={28} onClick={action.onClick}>
          {action.label}
        </LibraryControl>
      )}
    </div>
  );
}

/* ── left: the kinds ── */

function KindRow({ item, current }: { item: LibraryKindsProps["items"][number]; current: boolean }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={item.href}
      aria-current={current ? "page" : undefined}
      {...handlers}
      style={{
        boxSizing: "border-box",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        minHeight: 34,
        padding: "0 8px",
        margin: "0 -8px",
        borderRadius: r.control,
        background: current ? t.selectedFill : "transparent",
        fontFamily: FIGTREE,
        fontSize: 12.5,
        fontWeight: current ? 500 : 400,
        color: current || state.hovered ? t.text : t.text2,
        textDecoration: "none",
        ...ring(state.focusVisible),
      }}
    >
      <span>{item.label}</span>
      <span style={{ fontSize: 12, fontWeight: 400, color: t.label, fontVariantNumeric: "tabular-nums" }}>{item.count}</span>
    </Link>
  );
}

export function LibraryKinds({ items, value }: LibraryKindsProps) {
  return (
    <nav aria-label="Kinds" style={{ marginTop: 28 }}>
      {items.map((item) => (
        <KindRow key={item.value} item={item} current={item.value === value} />
      ))}
    </nav>
  );
}

/** On a phone the kinds are a row of tabs. */
export function LibraryKindTabs({ items, value, onChange }: LibraryKindsProps) {
  return (
    <div style={{ marginTop: 24, overflowX: "auto" }}>
      <TextTabs label="Kinds" tabs={items.map((item) => ({ value: item.value, label: item.label, count: item.count }))} value={value ?? "all"} onChange={onChange} />
    </div>
  );
}

/* ── left: the collections ── */

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
        minHeight: 40,
        borderBottom: `1px solid ${t.hairline}`,
        background: current ? t.selectedFill : "transparent",
        fontFamily: FIGTREE,
        color: state.hovered ? t.text2 : t.text,
        textDecoration: "none",
        ...ring(state.focusVisible),
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12.5, ...ellipsis }}>{item.name}</span>
        <span style={small}>{item.meta}</span>
      </span>
      <span style={{ fontSize: 12, color: t.label, fontVariantNumeric: "tabular-nums" }}>{item.count}</span>
    </Link>
  );
}

export function LibraryCollections({ status, items, current, hrefFor, onNew, onRetry, emptyLine }: LibraryCollectionsProps) {
  return (
    <section aria-label="Collections" style={{ marginTop: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 8, borderBottom: `1px solid ${t.hairline}` }}>
        <h2 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 12.5, fontWeight: 500, lineHeight: "20px", color: t.text }}>Collections</h2>
        {onNew ? (
          <LibraryTextButton onClick={onNew} aria-label="New collection">
            New
          </LibraryTextButton>
        ) : null}
      </div>
      {status === "loading" ? (
        <CollectionSkeletons />
      ) : status === "error" ? (
        <PanelError what="Collections didn't load." onRetry={onRetry} />
      ) : items.length === 0 ? (
        <p data-testid="library-collections-empty" style={{ ...small, margin: "12px 0 0" }}>
          {emptyLine}
        </p>
      ) : (
        <>
          <div data-testid="library-collections">
            {items.map((item) => (
              <CollectionRow key={item.id} item={item} current={item.id === current} href={hrefFor(item.id)} />
            ))}
          </div>
          <p style={{ ...small, margin: "10px 0 0" }}>Ordered by your last use</p>
        </>
      )}
    </section>
  );
}

/* ── main: the changes ── */

const CHANGE_TONE: Record<ChangeTag, ChipTone> = { EDITED: "lit", REMOVED: "breakage", RUN: "evidence", ANSWER: "text" };

export function LibraryChanges({ figure, parts, to, rows }: LibraryChangesProps) {
  return (
    <section aria-label="Changes" data-testid="library-changes">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <PageFigure figure={figure} parts={parts} />
        {to ? <SectionChevron to={to} name="all changes" /> : null}
      </div>
      <div style={{ marginTop: 16 }}>
        {rows.map((row) => (
          <div key={row.id} style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto", columnGap: 12, alignItems: "center", minHeight: 40, borderBottom: `1px solid ${t.hairline}`, fontFamily: FIGTREE, fontSize: 13 }}>
            <TypeChip tone={CHANGE_TONE[row.tag]}>{row.tag}</TypeChip>
            <span style={{ minWidth: 0, ...ellipsis }}>
              <span style={{ fontWeight: 500, color: t.text }}>{row.item}</span>
              <span style={{ color: t.label }}> · {row.detail}</span>
            </span>
            <span style={{ fontSize: 12, color: t.label, fontVariantNumeric: "tabular-nums" }}>{row.age}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── main: the table ── */

const STATE_COLOUR: Record<ItemState, string> = { same: t.text2, edited: t.lit, removed: t.catBreakage, stale: t.label };

const th: CSSProperties = { fontWeight: 400, padding: "0 12px 10px 0", borderBottom: `1px solid ${t.hairline}`, textAlign: "left", whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "0 12px 0 0", color: t.text2, whiteSpace: "nowrap" };

function ItemRow({ row, selected, usedIn, onSelect }: { row: LibraryRow; selected: boolean; usedIn: boolean; onSelect: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <tr data-testid="library-row" aria-selected={selected} onClick={onSelect} style={{ borderBottom: `1px solid ${t.hairline}`, background: selected ? t.selectedFill : "transparent", cursor: "pointer" }}>
      <td style={{ padding: "0 12px 0 0", height: TABLE_ROW }}>
        <button
          type="button"
          aria-pressed={selected}
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          {...handlers}
          style={{ display: "block", maxWidth: "100%", minWidth: 0, padding: 0, background: "none", border: 0, borderRadius: r.chip, textAlign: "left", fontFamily: FIGTREE, color: t.text, cursor: "pointer", ...ring(state.focusVisible) }}
        >
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 500, lineHeight: "20px", maxWidth: 300, ...ellipsis, textDecoration: state.hovered ? "underline" : "none", textDecorationColor: t.line, textUnderlineOffset: 3 }}>{row.title}</span>
          {row.detail ? <span style={{ ...small, display: "block", lineHeight: "20px", ...ellipsis }}>{row.detail}</span> : null}
        </button>
      </td>
      <td style={td}>{row.type}</td>
      <td style={td}>
        <span style={{ color: STATE_COLOUR[row.state] }}>{STATE_WORD[row.state]}</span>
      </td>
      {usedIn ? <td style={{ ...td, textAlign: "right" }}>{row.usedIn ?? ""}</td> : null}
      <td style={{ ...td, padding: 0, textAlign: "right" }}>{row.lastUsed}</td>
    </tr>
  );
}

function CollectionHeading({ heading }: { heading: LibraryCollectionHeading }) {
  return (
    <div data-testid="library-collection-open" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 32 }}>
      <PageFigure figure={heading.name} parts={[{ text: heading.meta }]} />
      {heading.actions?.length ? (
        <div data-testid="library-collection-actions" style={{ display: "flex", gap: 6 }}>
          {heading.actions.map((action) => (
            <LibraryControl key={action.label} size={28} onClick={action.onClick} disabled={action.disabled}>
              {action.label}
            </LibraryControl>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function LibraryItems(props: LibraryItemsProps) {
  const { heading, tabs, tab, onTab, controls, chips, sameAsBuilds, status, what, onRetry, empty, itemColumn, rows, selected, onSelect, more } = props;
  const usedIn = rows.some((row) => row.usedIn !== undefined);
  let body: ReactNode;
  if (status === "loading") body = <TableRowSkeletons count={7} />;
  else if (status === "error") body = <PanelError what={what} onRetry={onRetry} />;
  else if (rows.length === 0) body = <PanelEmpty empty={empty} testId="library-empty" />;
  else {
    body = (
      <table data-testid="library-table" style={{ width: "100%", marginTop: chips?.length || sameAsBuilds ? 16 : 0, borderCollapse: "collapse", fontFamily: FIGTREE, fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
        <thead>
          <tr style={{ fontSize: 11.5, color: t.label }}>
            <th scope="col" style={th}>{itemColumn}</th>
            <th scope="col" style={th}>Type</th>
            <th scope="col" style={th}>State</th>
            {usedIn ? <th scope="col" style={{ ...th, textAlign: "right" }}>Used in</th> : null}
            <th scope="col" aria-sort="descending" style={{ ...th, padding: "0 0 10px", textAlign: "right", color: t.text }}>
              Last used <span aria-hidden="true">↓</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <ItemRow key={row.id} row={row} selected={row.id === selected} usedIn={usedIn} onSelect={() => onSelect(row.id)} />
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <section aria-label={itemColumn === "Build" ? "Saved builds" : "Saved items"} data-testid="library-items">
      {heading ? <CollectionHeading heading={heading} /> : null}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12, borderBottom: `1px solid ${t.hairline}` }}>
        <TabsOnRule tabs={tabs} tab={tab} onTab={onTab} />
        {controls ? (
          <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
            <LibraryControl size={28} onClick={controls.onFilters}>
              <span style={{ color: t.label }}>Filters</span> {controls.filters}
            </LibraryControl>
            <LibraryControl size={28} onClick={controls.onSort}>
              <span style={{ color: t.label }}>Sort</span> {controls.sort}
            </LibraryControl>
          </div>
        ) : null}
      </div>
      {chips?.length || sameAsBuilds ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {chips?.map((chip) => <ActiveFilterChip key={chip.name} name={chip.name} value={chip.value} onRemove={chip.onRemove} />)}
          {sameAsBuilds ? <span style={{ fontFamily: FIGTREE, fontSize: 12, color: t.label, alignSelf: "center", marginLeft: 6 }}>Same filters as Builds</span> : null}
        </div>
      ) : null}
      {body}
      {more && status === "ready" ? (
        <div style={{ marginTop: 16 }}>
          <LibraryControl size={28} onClick={more.onMore} disabled={more.loading}>
            Show more
          </LibraryControl>
        </div>
      ) : null}
    </section>
  );
}

/** TextTabs draws its own hairline; the row with the controls carries one too, so the tabs sit on it. */
function TabsOnRule({ tabs, tab, onTab }: { tabs: LibraryItemsProps["tabs"]; tab: string; onTab: (tab: string) => void }) {
  return (
    <div style={{ marginBottom: -1 }}>
      <TextTabs label="State" tabs={tabs} value={tab} onChange={onTab} />
    </div>
  );
}

/* ── right: the selected item ── */

const STATE_TONE = { lit: t.lit, breakage: t.catBreakage, label: t.label } as const;

function VersionSwitch({ value, onChange }: { value: "saved" | "current"; onChange: (value: "saved" | "current") => void }) {
  const options = [
    { value: "saved" as const, label: "Your saved version" },
    { value: "current" as const, label: "Current version" },
  ];
  const move = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "saved" : event.key === "End" ? "current" : value === "saved" ? "current" : "saved";
    onChange(next);
    (event.currentTarget.parentElement?.querySelector(`[data-value="${next}"]`) as HTMLButtonElement | null)?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Version" style={{ display: "flex", gap: 2, marginTop: 16, padding: 2, ...WELL, boxShadow: "none", borderRadius: r.control }}>
      {options.map((option) => (
        <VersionOption key={option.value} label={option.label} value={option.value} on={option.value === value} onChoose={() => onChange(option.value)} onKeyDown={move} />
      ))}
    </div>
  );
}

function VersionOption({ label, value, on, onChoose, onKeyDown }: { label: string; value: string; on: boolean; onChoose: () => void; onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void }) {
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
        height: 26,
        background: on ? t.control : "none",
        border: on ? `1px solid ${t.controlBorder}` : "1px solid transparent",
        borderRadius: r.chip,
        fontFamily: FIGTREE,
        fontSize: 12,
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
    <div style={{ marginTop: 12, padding: 12, ...WELL, boxShadow: "none", borderRadius: r.control, fontFamily: DM_MONO, fontSize: 11.5, lineHeight: "18px", color: t.text2, whiteSpace: "pre-wrap" }}>
      {lines.map((line, index) => (
        <span key={index} style={{ display: "block", color: line.change === "removed" ? t.catBreakage : line.change === "added" ? t.evidence : undefined, textDecoration: line.change === "removed" ? "line-through" : undefined }}>
          {line.change ? <VisuallyHidden>{line.change === "removed" ? "Removed: " : "Added: "}</VisuallyHidden> : null}
          {line.text}
        </span>
      ))}
    </div>
  );
}

function SelectedRows({ rows }: { rows: SelectedBase["rows"] }) {
  return (
    <div style={{ marginTop: 16 }}>
      {rows.map((row) => (
        <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, minHeight: 36, borderTop: `1px solid ${t.hairline}`, fontFamily: FIGTREE, fontSize: 13 }}>
          <span style={{ color: t.text2 }}>{row.label}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: t.text, textAlign: "right" }}>
            {row.value}
            {row.lamp ? <PlaqueLamp dim={false} /> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

export function LibrarySelectedItem({ item }: { item: LibrarySelected }) {
  return (
    <section aria-label={`Selected: ${item.title}`} data-testid="library-selected" style={{ padding: 16, background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: r.card }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <TypeChip>{item.chip}</TypeChip>
        <span style={{ flex: 1 }} />
        {item.state ? <span style={{ fontFamily: FIGTREE, fontSize: 12, color: STATE_TONE[item.state.tone ?? "label"] }}>{item.state.text}</span> : null}
      </div>
      <h2 style={{ margin: "10px 0 0", fontFamily: FIGTREE, fontSize: 14, fontWeight: 500, lineHeight: 1.3, color: t.text, overflowWrap: "anywhere" }}>{item.title}</h2>
      {item.source ? <p style={{ margin: "2px 0 0", fontFamily: FIGTREE, fontSize: 12, color: t.label }}>{item.source}</p> : null}

      {item.kind === "step" && item.versions ? (
        <>
          <VersionSwitch value={item.versions.value} onChange={item.versions.onChange} />
          <Content lines={item.versions.value === "saved" ? item.versions.saved : item.versions.current} />
          <p style={{ ...small, margin: "8px 0 0" }}>{item.versions.changed}</p>
        </>
      ) : null}
      {item.kind === "build" ? (
        <div style={{ marginTop: 12 }}>
          <Plaque build={item.build} size="row" />
        </div>
      ) : null}

      {item.rows.length ? <SelectedRows rows={item.rows} /> : null}

      {item.kind === "step" && item.note ? (
        <label style={{ display: "block", marginTop: 12, fontFamily: FIGTREE, fontSize: 12, color: t.label }}>
          Your note
          <NoteField value={item.note.value} onChange={item.note.onChange} />
        </label>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
        {item.kind === "step" && item.onUse ? <LibraryPrimary onClick={item.onUse}>Use in a build</LibraryPrimary> : null}
        {item.kind === "build" ? <LibraryPrimary href={item.openHref}>Open</LibraryPrimary> : null}
        <LibraryControl onClick={item.onCopy}>{item.copyLabel ?? "Copy"}</LibraryControl>
        {item.kind === "step" && item.openHref ? <LibraryControl href={item.openHref}>Open source</LibraryControl> : null}
        {item.kind === "build" && item.onAddToCollection ? <LibraryControl onClick={item.onAddToCollection}>Add to a collection</LibraryControl> : null}
      </div>
      {item.kind === "build" && item.onRemoveFromCollection ? (
        <div style={{ marginTop: 12 }}>
          <LibraryTextButton onClick={item.onRemoveFromCollection.onRemove}>Remove from {item.onRemoveFromCollection.name}</LibraryTextButton>
        </div>
      ) : null}
    </section>
  );
}

function NoteField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { state, handlers } = useInteractive<HTMLTextAreaElement>();
  return (
    <textarea
      rows={2}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      {...handlers}
      style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, padding: "8px 10px", ...WELL, boxShadow: "none", borderRadius: r.control, color: t.text, fontFamily: FIGTREE, fontSize: 12.5, lineHeight: "20px", resize: "vertical", ...ring(state.focusVisible) }}
    />
  );
}

/* ── right: a collection's preview ── */

export function LibraryPreview({ name, meta, to, rows, status, onStart }: LibraryPreviewProps) {
  return (
    <section aria-label={`Collection: ${name}`} data-testid="library-preview" style={{ marginTop: 32 }}>
      <SectionHead title={name} meta={meta} to={to} headingLevel={2} />
      <div style={{ marginTop: 12 }}>
        {status === "loading" ? (
          <CollectionSkeletons />
        ) : (
          rows.slice(0, 3).map((row, index, shown) => (
            <div key={row.id} style={{ display: "grid", gridTemplateColumns: "16px 1fr auto", columnGap: 10, alignItems: "center", minHeight: 40, borderBottom: index < shown.length - 1 ? `1px solid ${t.hairline}` : "none", fontFamily: FIGTREE, fontSize: 13 }}>
              <span style={{ ...small, fontVariantNumeric: "tabular-nums" }}>{index + 1}</span>
              <span style={{ minWidth: 0, color: t.text, ...ellipsis }}>{row.title}</span>
              <span style={small}>{row.type}</span>
            </div>
          ))
        )}
      </div>
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

/* ── the page ── */

export function LibraryView({ head, kinds, collections, changes, items, selected, preview }: LibraryViewProps) {
  const layout = useLibraryLayout();
  return (
    <LibraryColumns
      layout={layout}
      head={
        <>
          <LibraryHead title={head.title} meta={head.meta} />
          {kinds ? layout === "one" ? <LibraryKindTabs {...kinds} /> : <LibraryKinds {...kinds} /> : null}
        </>
      }
      left={<LibraryCollections {...collections} />}
      main={
        <>
          {changes ? (
            <div style={{ marginBottom: 48 }}>
              <LibraryChanges {...changes} />
            </div>
          ) : null}
          <LibraryItems {...items} />
        </>
      }
      detail={
        <>
          {selected ? <LibrarySelectedItem item={selected} /> : null}
          {preview ? <LibraryPreview {...preview} /> : null}
        </>
      }
    />
  );
}
