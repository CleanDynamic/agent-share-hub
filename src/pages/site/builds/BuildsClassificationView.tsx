/* SV-13: the Classification view of Builds, pure: each build's classification as a card, every value saying where it came
   from and linking to this view filtered by it. The board is `design/reference/vision/dusk/builds-classification.html`.

   Like Maps, the board has no filter column, so this draws the whole page: the head with its sentence and the view
   switch, one row (Filters with the active count, "Facets shown n of 15"), the Table's chip row (BF-04), the key to the small labels (BF-04: its own line, directly above the grid) and the grid. Filters
   opens the one Filters dialog (BF-06) with the Table's own panel, given as `filters`. Facets shown opens a checklist of the 15 facets; the choice is the
   page's (`facets`, `onFacets`), and the last facet cannot be unchecked.

   A card is a module: title, "@maker · Shape", the reproductions and the lamp, then one row per facet shown: its name and
   source in a 112 column and the values as links. A value is a real link, underlined dotted at rest and solid on hover with no fade. Cards past
   the first screen are skipped by the browser until they come near (`content-visibility`). */

import { useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Checkbox } from "@/components/brand/Checkbox";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { Empty } from "@/components/vision/Empty";
import type { GalleryViewMode } from "@/lib/build/galleryParams";
import { FACET_LABEL, type Facet } from "@/lib/classify/taxonomy";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { BUILDS_PANEL, BuildsControl, panelFor, BuildsHead, FiltersButton, UpdatingStatus, ViewSwitch, ellipsis, hitArea, text, useCardColumns } from "./BuildsFrame";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { BuildsFilters, type BuildsFiltersViewProps } from "./BuildsFiltersView";
import { ActiveFilters, type TableChip } from "./BuildsTableView";
import { CheckSheet, PHONE_CARD, PhoneShowMore, phoneText } from "./BuildsPhone";
import { ALL_FACETS, type ClassCardView, type ClassRowView, type ClassValueView } from "./classificationModel";

export interface BuildsClassificationViewProps {
  view: GalleryViewMode;
  hrefFor: (view: GalleryViewMode) => string;
  onViewIntent?: (view: GalleryViewMode) => void;
  /** "18 builds". */
  /** G25: "n builds", drawn under the title only once the list has answered with builds; null before. */
  buildsLabel: string | null;
  activeCount: number;
  /** BF-04 (X3): every active filter, drawn as the Table draws them, under the toolbar. */
  chips: readonly TableChip[];
  onRemoveChip: (key: string) => void;
  onClearAll: () => void;
  /** BF-09 (A8): the open saved set's name, on the Filters button. */
  setName?: string;
  /** The Table's filters, drawn in the Filters dialog (BF-06). BF-07: the props, not a drawn panel, since the dialog holds the
      name search the panel reads. Absent: Filters is disabled. */
  filters?: BuildsFiltersViewProps;
  /** The facets shown, and a change to them. */
  facets: readonly Facet[];
  onFacets: (facets: readonly Facet[]) => void;
  cards: readonly ClassCardView[];
  /** The rest of the matching builds are one press away. */
  onMore?: () => void;
  loadingMore?: boolean;
  empty?: ReactNode;
  /** BF-02 (C2): the cards are the last address's, kept until the new page lands. */
  updating?: boolean;
}

const ROOT: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", color: t.text, fontVariantNumeric: "tabular-nums" };

/** Cards past the first screen (two rows of three) are not drawn until they come near. */
const FIRST_SCREEN_CARDS = 6;
/** A card's height: its head and padding, and a row with its source line is 55 (54 and a hairline). */
const cardHeight = (rows: number): number => 32 + 38 + 16 + rows * 55;

/** A value: `--text`, underlined dotted at rest and solid on hover with no fade (BF-04 E2); the maker's own words are plain text. */
function ValueLink({ value }: { value: ClassValueView }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  if (value.href === null) return <span>{value.label}</span>;
  return (
    <Link
      to={value.href}
      preventScrollReset
      {...handlers}
      style={{
        color: t.text,
        textDecorationLine: "underline",
        textDecorationStyle: state.hovered ? "solid" : "dotted",
        textDecorationColor: t.label,
        textUnderlineOffset: 3,
        // BF-05 (G3): an inline link, so the padding grows its hit area and leaves the line alone.
        padding: "4px 0",
        borderRadius: r.chip,
        ...ring(state.focusVisible),
      }}
    >
      {value.label}
    </Link>
  );
}

function FacetRow({ row }: { row: ClassRowView }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "112px minmax(0, 1fr)", columnGap: 12, padding: "10px 0", borderTop: `1px solid ${t.hairline}` }}>
      <dt style={{ ...text(12, 400, t.text2), lineHeight: "18px" }}>
        {row.name}
        {row.source ? <span style={{ display: "block", ...text(12, 400, t.label), lineHeight: "16px" }}>{row.source}</span> : null}
      </dt>
      <dd style={{ margin: 0, ...text(12, 400, t.text), lineHeight: "18px" }}>
        {row.values.length === 0 ? (
          <Empty />
        ) : (
          row.values.map((value, index) => (
            <span key={`${value.label}-${index}`}>
              {index > 0 ? <span style={{ color: t.label }}>, </span> : null}
              <ValueLink value={value} />
            </span>
          ))
        )}
      </dd>
    </div>
  );
}

export function ClassificationCard({ card, index }: { card: ClassCardView; index: number }) {
  /* BF-04 (E4): a build with nothing in any shown facet is one sentence, not rows that each say nothing. */
  const blank = card.rows.every((row) => row.values.length === 0);
  return (
    <article
      data-testid="classification-card"
      style={{
        background: t.module,
        border: `1px solid ${t.moduleBorder}`,
        borderRadius: r.card,
        padding: 16,
        ...(index >= FIRST_SCREEN_CARDS ? { contentVisibility: "auto", containIntrinsicSize: `auto ${cardHeight(blank ? 1 : card.rows.length)}px` } : null),
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <Link to={card.href} style={{ display: "block", ...ellipsis, ...hitArea(4), ...text(14, 500, t.text), lineHeight: 1.3, textDecoration: "none", borderRadius: r.chip }}>
            {card.title}
          </Link>
          <div style={{ marginTop: 2, ...text(12, 400, t.label), lineHeight: "normal" }}>{card.subtitle}</div>
        </div>
      </div>
      {blank ? (
        <p style={{ ...text(12, 400, t.label), margin: "16px 0 0" }}>Not classified yet</p>
      ) : (
        <dl style={{ margin: "16px 0 0" }}>
          {card.rows.map((row) => (
            <FacetRow key={row.facet} row={row} />
          ))}
        </dl>
      )}
    </article>
  );
}

/* ── on a phone (prompt 21): a Panel card per build; one row per facet with no lines: a 112 column with the facet's name and its
   source under it, then the values as links (13 Text, dotted underline at offset 3), 4 by 10 apart. ── */

function PhoneValue({ value }: { value: ClassValueView }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  if (value.href === null) return <span>{value.label}</span>;
  return (
    <Link
      to={value.href}
      preventScrollReset
      {...handlers}
      style={{ color: t.text, textDecorationLine: "underline", textDecorationStyle: "dotted", textDecorationColor: t.label, textUnderlineOffset: 3, display: "inline-block", minHeight: 24, borderRadius: r.chip, ...ring(state.focusVisible) }}
    >
      {value.label}
    </Link>
  );
}

function PhoneFacetRow({ row }: { row: ClassRowView }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "112px minmax(0, 1fr)", columnGap: 12 }}>
      <dt style={{ ...phoneText(13, 400, t.text) }}>
        {row.name}
        {row.source ? <span style={{ display: "block", ...phoneText(12, 400, t.label), lineHeight: "16px" }}>{row.source}</span> : null}
      </dt>
      <dd style={{ margin: 0, display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "4px 10px", ...phoneText(13, 400, t.text) }}>
        {row.values.length === 0 ? <span style={{ color: t.label }}>Not stated</span> : row.values.map((value, index) => <PhoneValue key={`${value.label}-${index}`} value={value} />)}
      </dd>
    </div>
  );
}

function PhoneClassificationCard({ card, index }: { card: ClassCardView; index: number }) {
  const blank = card.rows.every((row) => row.values.length === 0);
  return (
    <article data-testid="classification-card" style={{ ...PHONE_CARD, ...(index >= 4 ? { contentVisibility: "auto", containIntrinsicSize: `auto ${96 + card.rows.length * 40}px` } : null) }}>
      <span style={{ minWidth: 0 }}>
        <Link to={card.href} style={{ display: "block", ...ellipsis, ...phoneText(15, 600, t.text), textDecoration: "none" }}>
          {card.title}
        </Link>
        <span style={{ display: "block", ...phoneText(13, 400, t.label) }}>{card.subtitle}</span>
      </span>
      {blank ? (
        <p style={{ margin: 0, ...phoneText(13, 400, t.label) }}>Not classified yet</p>
      ) : (
        <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {card.rows.map((row) => (
            <PhoneFacetRow key={row.facet} row={row} />
          ))}
        </dl>
      )}
    </article>
  );
}

/** The 15 facets as checkboxes; at least one stays. */
function FacetChooser({ facets, onFacets }: Pick<BuildsClassificationViewProps, "facets" | "onFacets">) {
  const toggle = (facet: Facet) => {
    const next = facets.includes(facet) ? facets.filter((entry) => entry !== facet) : [...facets, facet];
    if (next.length > 0) onFacets(next);
  };
  return (
    <div role="group" aria-label="Facets shown" style={{ background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: r.card, padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", columnGap: 24 }}>
      {ALL_FACETS.map((facet) => {
        const on = facets.includes(facet);
        return (
          <label key={facet} style={{ display: "grid", gridTemplateColumns: "14px 1fr", columnGap: 10, alignItems: "center", minHeight: 30, cursor: "pointer", ...text(12, 400, on ? t.text : t.text2) }}>
            <Checkbox checked={on} disabled={on && facets.length === 1} onChange={() => toggle(facet)} style={{ width: 14, height: 14 }} />
            <span>{FACET_LABEL[facet]}</span>
          </label>
        );
      })}
    </div>
  );
}

export default function BuildsClassificationView(props: BuildsClassificationViewProps) {
  const { view, hrefFor, onViewIntent, buildsLabel, activeCount, chips, onRemoveChip, onClearAll, filters, setName, facets, onFacets, cards, onMore, loadingMore, empty, updating } = props;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [facetsOpen, setFacetsOpen] = useState(false);
  const columns = useCardColumns();
  const phone = useIsPhone();
  useColumnPanels(true);
  if (phone) {
    const toggle = (id: string) => {
      const facet = id as Facet;
      const next = facets.includes(facet) ? facets.filter((entry) => entry !== facet) : [...facets, facet];
      if (next.length > 0) onFacets(next);
    };
    return (
      <div data-testid="builds-classification" style={{ ...ROOT, ...panelFor(true) }}>
        <BuildsHead figure="Builds" parts={buildsLabel ? [{ text: buildsLabel }] : [{ text: "\u00a0" }]} updating={updating} switcher={<ViewSwitch view={view} hrefFor={hrefFor} onIntent={onViewIntent} />} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", overflowX: "auto", scrollbarWidth: "none" }}>
          <FiltersButton activeCount={activeCount} setName={setName} disabled={!filters} onClick={() => setFiltersOpen(true)} />
          <BuildsControl aria-haspopup="dialog" aria-expanded={facetsOpen} onClick={() => setFacetsOpen(true)}>
            <span style={{ color: t.text2 }}>Facets shown</span>
            <span>{`${facets.length} of ${ALL_FACETS.length}`}</span>
          </BuildsControl>
          <UpdatingStatus updating={updating} />
        </div>
        <ActiveFilters chips={chips} onRemove={onRemoveChip} onClearAll={onClearAll} />
        {filters ? <BuildsFilters {...filters} open={filtersOpen} onOpenChange={setFiltersOpen} /> : null}
        <CheckSheet
          open={facetsOpen}
          onOpenChange={setFacetsOpen}
          title="Facets shown"
          titleNote={`${facets.length} of ${ALL_FACETS.length}`}
          groups={[{ rows: ALL_FACETS.map((facet) => ({ id: facet, label: FACET_LABEL[facet], checked: facets.includes(facet), disabled: facets.includes(facet) && facets.length === 1 })) }]}
          onToggle={toggle}
        />
        <p data-testid="classification-key" style={{ margin: 0, padding: "12px 16px 0", ...phoneText(12, 400, t.label) }}>
          Under each facet: <span style={{ color: t.text2 }}>from n tiles</span>, <span style={{ color: t.text2 }}>derived</span> when the tiles were not kept, <span style={{ color: t.text2 }}>stated</span> by the maker, or{" "}
          <span style={{ color: t.text2 }}>corrected</span> by the maker
        </p>
        {cards.length === 0 && empty ? (
          <div style={{ margin: "20px 16px 0" }}>{empty}</div>
        ) : (
          <div data-testid="builds-cards" aria-busy={updating === true} style={{ paddingTop: 12, ...(updating ? { opacity: 0.5 } : null) }}>
            {cards.map((card, index) => (
              <PhoneClassificationCard key={card.id} card={card} index={index} />
            ))}
          </div>
        )}
        {onMore ? <PhoneShowMore onMore={onMore} loading={loadingMore} /> : null}
      </div>
    );
  }
  return (
    <div data-testid="builds-classification" style={{ ...ROOT, ...BUILDS_PANEL }}>
      <BuildsHead figure="Builds" parts={buildsLabel ? [{ text: buildsLabel }] : [{ text: "\u00a0" }]} updating={updating} switcher={<ViewSwitch view={view} hrefFor={hrefFor} onIntent={onViewIntent} />} />

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 16px", margin: "16px 20px 0" }}>
        <FiltersButton activeCount={activeCount} setName={setName} disabled={!filters} onClick={() => setFiltersOpen(true)} />
        <BuildsControl aria-expanded={facetsOpen} onClick={() => setFacetsOpen((value) => !value)}>
          <span style={{ color: t.text2 }}>Facets shown</span>
          <span>{`${facets.length} of ${ALL_FACETS.length}`}</span>
        </BuildsControl>
        <UpdatingStatus updating={updating} />
      </div>

      <ActiveFilters chips={chips} onRemove={onRemoveChip} onClearAll={onClearAll} />

      {filters ? <BuildsFilters {...filters} open={filtersOpen} onOpenChange={setFiltersOpen} /> : null}
      {facetsOpen ? (
        <div style={{ margin: "16px 20px 0" }}>
          <FacetChooser facets={facets} onFacets={onFacets} />
        </div>
      ) : null}

      <p data-testid="classification-key" style={{ ...text(12, 400, t.label), margin: "16px 20px 0" }}>
        Under each facet: <span style={{ color: t.text2 }}>from n tiles</span>, <span style={{ color: t.text2 }}>derived</span> when the tiles were not kept, <span style={{ color: t.text2 }}>stated</span> by the maker, or{" "}
        <span style={{ color: t.text2 }}>corrected</span> by the maker
      </p>

      {cards.length === 0 && empty ? (
        <div style={{ margin: "16px 20px 0" }}>{empty}</div>
      ) : (
        <div data-testid="builds-cards" aria-busy={updating === true} style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 24, alignItems: "start", margin: "16px 20px 0", paddingBottom: onMore ? 24 : 0, ...(updating ? { opacity: 0.5 } : null) }}>
          {cards.map((card, index) => (
            <ClassificationCard key={card.id} card={card} index={index} />
          ))}
        </div>
      )}
      {onMore ? (
        <div style={{ padding: "0 20px" }}>
          <BuildsControl onClick={onMore} disabled={loadingMore}>
            {loadingMore ? "Loading" : "Show more builds"}
          </BuildsControl>
        </div>
      ) : null}
    </div>
  );
}
