// /gallery — the platform surface where the new path becomes visible to
// readers who did not come looking for any one build.
//
// TWO REQUESTS ON LOAD, and the whole page is arranged around that number.
//
//   1. listGallery       one page of cards, with the nodes and media each card
//                        body reads embedded, and the total count on the same
//                        response
//   2. getGalleryFacets  the roles and tools worth offering as filters, counted
//                        over the same set of builds
//
// Changing a filter refetches the first and nothing else: the facets are the
// options, not the results, so they are cached across filter changes and a
// filter click costs exactly one request. Nothing on this page reads a build's
// nodes, media or reproductions with a query of its own — that is the home
// feed's fifteen-query pattern, and it is what this page exists not to repeat.
//
// Media is signed in one further batched call, and only for the rows the cards
// will actually render. See cardMedia.ts for why that call cannot carry a
// transform, and why loading="lazy" is what makes it affordable.
//
// FILTERS IN THE PRIMARY POSITION. Made for and Made with are the answer to a
// sparse launch: they turn one broad platform into many dense ones — twelve
// builds is thin, but four builds made for lawyers is a section. So they sit at
// the top of the page, open, not behind a menu.
//
// Outside NeoScaleShell, like /b2/:slug and /compose. Lazy-loaded, and it adds
// no navigation entry anywhere: reachable directly and from the publish
// confirmation.

import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  GALLERY_PAGE_SIZE,
  getGalleryFacets,
  listGallery,
  type GalleryBuild,
  type GalleryFacet,
  type GalleryPage,
} from "@/lib/build";
import { GalleryCard } from "@/components/gallery/GalleryCard";
import { cardMedia, useSignedMedia } from "@/components/gallery/cardMedia";
import {
  FONT_STACK,
  HAIRLINE,
  ORANGE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  VOID,
  bodyText,
  hexToRgba,
  labelText,
  pageHeadingText,
  panelGlass,
} from "@/components/build/tokens";

/** Facets change far more slowly than the builds they describe. */
const FACETS_STALE_MS = 5 * 60 * 1000;

export default function Gallery() {
  const [madeFor, setMadeFor] = useState<string[]>([]);
  const [madeWith, setMadeWith] = useState<string[]>([]);
  const [page, setPage] = useState(0);

  const offset = page * GALLERY_PAGE_SIZE;

  const builds = useQuery<GalleryPage>({
    // The filters are IN THE KEY, which is what makes a filter change one
    // request rather than a client-side pass over everything already loaded.
    queryKey: ["gallery", { madeFor, madeWith, offset }],
    queryFn: () => listGallery({ madeFor, madeWith, offset, limit: GALLERY_PAGE_SIZE }),
    // The previous page stays on screen while the next one loads, so changing
    // a filter does not blank the grid and drop the reader's scroll position.
    placeholderData: keepPreviousData,
  });

  const facets = useQuery({
    queryKey: ["gallery-facets"],
    queryFn: getGalleryFacets,
    staleTime: FACETS_STALE_MS,
  });

  const rows = builds.data?.builds ?? EMPTY_BUILDS;
  const total = builds.data?.total ?? null;

  // Every media row the visible cards may render, collected before any card
  // renders so they can be signed together rather than one request per card.
  const mediaRows = useMemo(() => rows.flatMap(cardMedia), [rows]);
  const srcByPath = useSignedMedia(mediaRows);

  const toggle = (
    value: string,
    current: string[],
    set: (next: string[]) => void
  ) => {
    set(
      current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value]
    );
    setPage(0);
  };

  const filtered = madeFor.length > 0 || madeWith.length > 0;

  return (
    <div
      data-visual-slot="gallery-frame"
      style={{
        minHeight: "100vh",
        background: VOID,
        color: TEXT_PRIMARY,
        fontFamily: FONT_STACK,
        isolation: "isolate",
      }}
    >
      <Helmet>
        <title>Gallery — NeoScale</title>
        <meta
          name="description"
          content="Builds other people have run: the prompts, configs and evidence, structured so you can run them too."
        />
      </Helmet>

      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: "28px 20px 64px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <Link to="/" style={{ ...labelText, color: TEXT_SECONDARY, textDecoration: "none" }}>
              ← NeoScale
            </Link>
            <h1 style={{ ...pageHeadingText, margin: 0 }}>Gallery</h1>
          </div>
          <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY, maxWidth: 620 }}>
            Builds written down completely enough to follow, ordered by how many
            people other than their creator have run them and said what
            happened.
          </p>
        </header>

        <section
          data-visual-slot="gallery-filters"
          style={{
            ...panelGlass,
            borderRadius: 12,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <FacetRow
            label="Made for"
            accent={ORANGE}
            options={facets.data?.roles ?? []}
            selected={madeFor}
            loading={facets.isLoading}
            emptyText="No roles named yet."
            onToggle={(value) => toggle(value, madeFor, setMadeFor)}
          />
          <div style={{ height: 1, background: HAIRLINE }} />
          <FacetRow
            label="Made with"
            accent={TEAL}
            options={facets.data?.tools ?? []}
            selected={madeWith}
            loading={facets.isLoading}
            emptyText="No tools named yet."
            onToggle={(value) => toggle(value, madeWith, setMadeWith)}
          />
          {filtered ? (
            <div>
              <button
                type="button"
                onClick={() => {
                  setMadeFor([]);
                  setMadeWith([]);
                  setPage(0);
                }}
                style={{
                  ...labelText,
                  fontFamily: "inherit",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  color: TEXT_SECONDARY,
                  cursor: "pointer",
                }}
              >
                Clear filters
              </button>
            </div>
          ) : null}
        </section>

        <Results
          builds={rows}
          srcByPath={srcByPath}
          total={total}
          isLoading={builds.isLoading}
          error={(builds.error as Error | null) ?? null}
          filtered={filtered}
        />

        <Pagination
          page={page}
          total={total}
          shown={rows.length}
          onPage={setPage}
          busy={builds.isFetching}
        />
      </div>
    </div>
  );
}

const EMPTY_BUILDS: GalleryBuild[] = [];

/**
 * One filter, as a row of chips.
 *
 * Several chips in a row are an OR — a reader picking "lawyer" and "designer"
 * wants either, not both, and a build is rarely made for two roles at once.
 * The two rows are an AND with each other, which is the useful combination:
 * made for lawyers, made with Claude.
 */
function FacetRow({
  label,
  accent,
  options,
  selected,
  loading,
  emptyText,
  onToggle,
}: {
  label: string;
  accent: string;
  options: GalleryFacet[];
  selected: string[];
  loading: boolean;
  emptyText: string;
  onToggle: (value: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
      <span
        style={{
          ...labelText,
          textTransform: "uppercase",
          color: TEXT_MUTED,
          minWidth: 78,
          paddingTop: 5,
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {loading ? (
          <span style={{ ...bodyText, color: TEXT_MUTED }}>Loading…</span>
        ) : options.length === 0 ? (
          <span style={{ ...bodyText, color: TEXT_MUTED }}>{emptyText}</span>
        ) : (
          options.map((option) => {
            const active = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(option.value)}
                style={{
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: "0.04em",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 28,
                  padding: "0 10px",
                  borderRadius: 100,
                  cursor: "pointer",
                  color: active ? accent : TEXT_SECONDARY,
                  background: active
                    ? hexToRgba(accent, 0.12)
                    : "rgba(255,255,255,0.025)",
                  border: `1px solid ${active ? hexToRgba(accent, 0.4) : "rgba(255,255,255,0.06)"}`,
                }}
              >
                {/* The registry's name where one matched, the creator's own
                    spelling where it did not — the filter still works either
                    way, because the query filters on what was stored. */}
                {option.label ?? option.value}
                <span style={{ color: TEXT_MUTED, fontVariantNumeric: "tabular-nums" }}>
                  {option.count}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function Results({
  builds,
  srcByPath,
  total,
  isLoading,
  error,
  filtered,
}: {
  builds: GalleryBuild[];
  srcByPath: ReturnType<typeof useSignedMedia>;
  total: number | null;
  isLoading: boolean;
  error: Error | null;
  filtered: boolean;
}) {
  if (error) {
    return (
      <Notice
        heading="The gallery could not be loaded"
        detail={error.message}
        accent={ORANGE}
      />
    );
  }

  if (isLoading) {
    return <Notice heading="Loading the gallery…" detail="" accent={TEAL} />;
  }

  if (builds.length === 0) {
    return filtered ? (
      <Notice
        heading="Nothing matches those filters yet"
        detail="Clear one of them, or look at everything. The gallery grows as builds are written down more completely."
        accent={TEAL}
      />
    ) : (
      <Notice
        heading="Nothing here yet"
        detail="A build reaches the gallery once its record carries enough to follow — the outcome, the thing to run, the evidence, and who it is for."
        accent={TEAL}
      >
        <Link to="/compose/new" style={{ ...labelText, color: TEAL, textDecoration: "none" }}>
          Write one up →
        </Link>
      </Notice>
    );
  }

  return (
    <>
      <p style={{ ...labelText, margin: 0, color: TEXT_MUTED }}>
        {total === null
          ? `${builds.length} shown`
          : `${total} build${total === 1 ? "" : "s"}`}
      </p>
      <div
        data-visual-slot="gallery-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(272px, 1fr))",
          gap: 14,
          alignItems: "start",
        }}
      >
        {builds.map((build) => (
          <GalleryCard key={build.id} build={build} srcByPath={srcByPath} />
        ))}
      </div>
    </>
  );
}

function Pagination({
  page,
  total,
  shown,
  onPage,
  busy,
}: {
  page: number;
  total: number | null;
  shown: number;
  onPage: (next: number) => void;
  busy: boolean;
}) {
  const hasMore =
    total === null ? shown === GALLERY_PAGE_SIZE : (page + 1) * GALLERY_PAGE_SIZE < total;
  if (page === 0 && !hasMore) return null;

  const button = (label: string, next: number, enabled: boolean) => (
    <button
      type="button"
      disabled={!enabled || busy}
      onClick={() => {
        onPage(next);
        window.scrollTo({ top: 0 });
      }}
      style={{
        ...labelText,
        fontFamily: "inherit",
        height: 30,
        padding: "0 14px",
        borderRadius: 100,
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${HAIRLINE}`,
        color: enabled && !busy ? TEXT_SECONDARY : TEXT_MUTED,
        cursor: enabled && !busy ? "pointer" : "not-allowed",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {button("← Previous", page - 1, page > 0)}
      {button("Next →", page + 1, hasMore)}
      <span style={{ ...labelText, color: TEXT_MUTED }}>Page {page + 1}</span>
    </div>
  );
}

function Notice({
  heading,
  detail,
  accent,
  children,
}: {
  heading: string;
  detail: string;
  accent: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        ...panelGlass,
        borderRadius: 12,
        borderLeft: `2px solid ${accent}`,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT_PRIMARY }}>
        {heading}
      </h2>
      {detail ? (
        <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY, maxWidth: 560 }}>
          {detail}
        </p>
      ) : null}
      {children}
    </div>
  );
}
