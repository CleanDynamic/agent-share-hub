/* SV-13: the Classification view of Builds, pure: each build's classification as a card, every value saying where it came
   from and linking to the Table filtered by it. The board is `design/reference/vision/dusk/builds-classification.html`.

   Like Maps, the board has no filter column, so this draws the whole page: the head with its sentence and the view
   switch, one row (Filters with the active count, "Facets shown n of 15", and the key on the right) and the grid. Filters
   opens the Table's own panel, given as `panel`. Facets shown opens a checklist of the 15 facets; the choice is the
   page's (`facets`, `onFacets`), and the last facet cannot be unchecked.

   A card is a module: title, "@maker · Shape", the reproductions and the lamp, then one row per facet shown: its name and
   source in a 112 column and the values as links. A value is a real link, underlined on hover with no fade. Cards past
   the first screen are skipped by the browser until they come near (`content-visibility`). */

import { useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Checkbox } from "@/components/brand/Checkbox";
import { LampBar } from "@/components/brand/LampDot";
import { VisuallyHidden } from "@/components/brand/VisuallyHidden";
import type { GalleryViewMode } from "@/lib/build/galleryParams";
import { FACET_LABEL, type Facet } from "@/lib/classify/taxonomy";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { BuildsControl, ClassificationHead, ViewSwitch, ellipsis, text, useCardColumns } from "./BuildsFrame";
import { ALL_FACETS, type ClassCardView, type ClassRowView, type ClassValueView } from "./classificationModel";

export interface BuildsClassificationViewProps {
  view: GalleryViewMode;
  hrefFor: (view: GalleryViewMode) => string;
  onViewIntent?: (view: GalleryViewMode) => void;
  /** "18 builds". */
  buildsLabel: string;
  activeCount: number;
  /** The Table's filter panel, drawn under the row when Filters is open. */
  panel?: ReactNode;
  /** The facets shown, and a change to them. */
  facets: readonly Facet[];
  onFacets: (facets: readonly Facet[]) => void;
  cards: readonly ClassCardView[];
  /** The rest of the matching builds are one press away. */
  onMore?: () => void;
  loadingMore?: boolean;
  empty?: ReactNode;
}

const ROOT: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", color: t.text, fontVariantNumeric: "tabular-nums" };

/** Cards past the first screen (two rows of three) are not drawn until they come near. */
const FIRST_SCREEN_CARDS = 6;
/** A card's height: its head and padding, and a row with its source line is 55 (54 and a hairline). */
const cardHeight = (rows: number): number => 32 + 38 + 16 + rows * 55;

/** A value: `--text`, underlined on hover with no fade; the maker's own words are plain text. */
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
        textDecoration: state.hovered ? "underline" : "none",
        textDecorationColor: t.label,
        textUnderlineOffset: 3,
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
        {row.source ? <span style={{ display: "block", ...text(11, 400, t.label), lineHeight: "16px" }}>{row.source}</span> : null}
      </dt>
      <dd style={{ margin: 0, ...text(12.5, 400, t.text), lineHeight: "18px" }}>
        {row.values.length === 0 ? (
          <span style={{ color: t.label }}>None</span>
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
  return (
    <article
      data-testid="classification-card"
      style={{
        background: t.module,
        border: `1px solid ${t.moduleBorder}`,
        borderRadius: r.card,
        padding: 16,
        ...(index >= FIRST_SCREEN_CARDS ? { contentVisibility: "auto", containIntrinsicSize: `auto ${cardHeight(card.rows.length)}px` } : null),
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <Link to={card.href} style={{ display: "block", ...ellipsis, ...text(14, 500, t.text), lineHeight: 1.3, textDecoration: "none", borderRadius: r.chip }}>
            {card.title}
          </Link>
          <div style={{ marginTop: 2, ...text(12, 400, t.label), lineHeight: "normal" }}>{card.subtitle}</div>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flex: "none", ...text(12.5, 400, t.text) }}>
          <span>
            {card.reproductions}
            <VisuallyHidden> reproduced</VisuallyHidden>
          </span>
          <LampBar dim={!card.lit} />
        </span>
      </div>
      <dl style={{ margin: "16px 0 0" }}>
        {card.rows.map((row) => (
          <FacetRow key={row.facet} row={row} />
        ))}
      </dl>
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
          <label key={facet} style={{ display: "grid", gridTemplateColumns: "14px 1fr", columnGap: 10, alignItems: "center", minHeight: 30, cursor: "pointer", ...text(12.5, 400, on ? t.text : t.text2) }}>
            <Checkbox checked={on} disabled={on && facets.length === 1} onChange={() => toggle(facet)} style={{ width: 14, height: 14 }} />
            <span>{FACET_LABEL[facet]}</span>
          </label>
        );
      })}
    </div>
  );
}

export default function BuildsClassificationView(props: BuildsClassificationViewProps) {
  const { view, hrefFor, onViewIntent, buildsLabel, activeCount, panel, facets, onFacets, cards, onMore, loadingMore, empty } = props;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [facetsOpen, setFacetsOpen] = useState(false);
  const columns = useCardColumns();
  return (
    <div data-testid="builds-classification" style={ROOT}>
      <ClassificationHead figure={buildsLabel} switcher={<ViewSwitch view={view} hrefFor={hrefFor} onIntent={onViewIntent} />} />

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 16px", marginTop: 24 }}>
        <BuildsControl aria-expanded={panel ? filtersOpen : undefined} disabled={!panel} onClick={() => setFiltersOpen((value) => !value)}>
          <span style={{ color: t.label }}>Filters</span>
          {activeCount > 0 ? <span>{activeCount}</span> : null}
        </BuildsControl>
        <BuildsControl aria-expanded={facetsOpen} onClick={() => setFacetsOpen((value) => !value)}>
          <span style={{ color: t.label }}>Facets shown</span>
          <span>{`${facets.length} of ${ALL_FACETS.length}`}</span>
        </BuildsControl>
        <span style={{ flex: 1 }} />
        <span style={text(12, 400, t.label)}>
          Under each facet: <span style={{ color: t.text2 }}>from n tiles</span>, <span style={{ color: t.text2 }}>stated</span> by the maker, or <span style={{ color: t.text2 }}>corrected</span> by the maker
        </span>
      </div>

      {filtersOpen && panel ? <div style={{ marginTop: 24, maxWidth: 256 }}>{panel}</div> : null}
      {facetsOpen ? (
        <div style={{ marginTop: 16 }}>
          <FacetChooser facets={facets} onFacets={onFacets} />
        </div>
      ) : null}

      {cards.length === 0 && empty ? (
        <div style={{ marginTop: 32 }}>{empty}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 24, alignItems: "start", marginTop: 32, paddingBottom: onMore ? 24 : 64 }}>
          {cards.map((card, index) => (
            <ClassificationCard key={card.id} card={card} index={index} />
          ))}
        </div>
      )}
      {onMore ? (
        <div style={{ paddingBottom: 64 }}>
          <BuildsControl onClick={onMore} disabled={loadingMore}>
            {loadingMore ? "Loading" : "Show more builds"}
          </BuildsControl>
        </div>
      ) : null}
    </div>
  );
}
