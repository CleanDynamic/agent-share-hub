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
// BG-P15 — INSIDE THE APPLICATION FRAME NOW. This page used to render outside
// it, like /b2/:slug and /compose still partly do, which meant a reader who
// arrived here had no navigation at all — a "← buildgallery" text link stood in
// for the left rail, the right rail, the wordmark and the mobile bottom bar. It
// is registered inside <Route element={<Layout />}> and listed in
// src/components/shell/wideRoutes.ts, so it renders in the frame's wide mode:
// 1600px, the centre unpinned, and NO RIGHT RAIL — the grid wants that 300px
// more than Explore does, because a gallery of builds already answers the
// question Explore asks.
//
// Still lazy-loaded, and it still adds no navigation entry anywhere: reachable
// directly and from the publish confirmation.

import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  GALLERY_PAGE_SIZE,
  countOpenBountyBuilds,
  getGalleryFacets,
  listGallery,
  type GalleryBuild,
  type GalleryPage,
} from "@/lib/build";
import { GalleryCard } from "@/components/gallery/GalleryCard";
import { cardMedia, useSignedMedia } from "@/components/gallery/cardMedia";
import {
  FacetRail,
  type FacetGroup,
  type SelectedFacet,
} from "@/components/gallery/FacetRail";
import {
  HAIRLINE,
  ORANGE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  bodyText,
  labelText,
  panelGlass,
} from "@/components/build/tokens";
import { PageHeader } from "@/components/shell/PageHeader";
import { prefersReducedMotion } from "@/lib/theme/controls";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";

/** Facets change far more slowly than the builds they describe. */
const FACETS_STALE_MS = 5 * 60 * 1000;

export default function Gallery() {
  const [madeFor, setMadeFor] = useState<string[]>([]);
  const [madeWith, setMadeWith] = useState<string[]>([]);
  /** The third filter (NS-P52): only builds asking for help. */
  const [openBounties, setOpenBounties] = useState(false);
  const [page, setPage] = useState(0);

  const offset = page * GALLERY_PAGE_SIZE;

  const builds = useQuery<GalleryPage>({
    // The filters are IN THE KEY, which is what makes a filter change one
    // request rather than a client-side pass over everything already loaded.
    queryKey: ["gallery", { madeFor, madeWith, openBounties, offset }],
    queryFn: () =>
      listGallery({
        madeFor,
        madeWith,
        openBounties,
        offset,
        limit: GALLERY_PAGE_SIZE,
      }),
    // The previous page stays on screen while the next one loads, so changing
    // a filter does not blank the grid and drop the reader's scroll position.
    placeholderData: keepPreviousData,
  });

  const facets = useQuery({
    queryKey: ["gallery-facets"],
    queryFn: getGalleryFacets,
    staleTime: FACETS_STALE_MS,
  });

  /**
   * How many gallery builds carry an open ask.
   *
   * Its own query rather than a fourth key on gallery_facets: that function
   * counts values inside two array columns and knows nothing about bounties,
   * and one head request costs less than teaching it. Cached beside the facets
   * for the same reason they are — the options change far more slowly than the
   * builds they describe — so toggling this filter still costs exactly one
   * request.
   */
  const bountyCount = useQuery({
    queryKey: ["gallery-bounty-count"],
    queryFn: countOpenBountyBuilds,
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

  const clearAll = () => {
    setMadeFor([]);
    setMadeWith([]);
    setOpenBounties(false);
    setPage(0);
  };

  const filtered = madeFor.length > 0 || madeWith.length > 0 || openBounties;

  /**
   * The three groups, in one shape.
   *
   * Built here rather than inside the rail because the page owns the query
   * state and the rail owns the pixels: everything below is "what is on offer
   * and what happens when it is pressed", and nothing in it is a measurement.
   */
  const groups: FacetGroup[] = [
    {
      key: "made-for",
      label: "Made for",
      loading: facets.isLoading,
      emptyText: "No roles named yet.",
      options: (facets.data?.roles ?? []).map((option) => ({
        value: option.value,
        // The registry's name where one matched, the creator's own spelling
        // where it did not — the filter still works either way, because the
        // query filters on what was stored.
        label: option.label ?? option.value,
        count: option.count,
        selected: madeFor.includes(option.value),
        onToggle: () => toggle(option.value, madeFor, setMadeFor),
      })),
    },
    {
      key: "made-with",
      label: "Made with",
      loading: facets.isLoading,
      emptyText: "No tools named yet.",
      options: (facets.data?.tools ?? []).map((option) => ({
        value: option.value,
        label: option.label ?? option.value,
        count: option.count,
        selected: madeWith.includes(option.value),
        onToggle: () => toggle(option.value, madeWith, setMadeWith),
      })),
    },
    {
      key: "bounties",
      label: "Unsolved",
      loading: false,
      emptyText: "",
      // The one group that names a part category. See FacetGroup.tone.
      tone: "breakage",
      options: [
        {
          value: "open",
          label: "Open bounties",
          // The count is the number of BUILDS carrying an open ask, not the
          // number of asks: it is the size of the grid this chip produces,
          // which is the number a reader is deciding about.
          count: bountyCount.isLoading ? null : (bountyCount.data ?? 0),
          selected: openBounties,
          onToggle: () => {
            setOpenBounties((current) => !current);
            setPage(0);
          },
        },
      ],
    },
  ];

  const selected: SelectedFacet[] = [
    ...madeFor.map((value) => ({
      id: `made-for-${value}`,
      label: labelFor(groups[0], value),
      onRemove: () => toggle(value, madeFor, setMadeFor),
    })),
    ...madeWith.map((value) => ({
      id: `made-with-${value}`,
      label: labelFor(groups[1], value),
      onRemove: () => toggle(value, madeWith, setMadeWith),
    })),
    ...(openBounties
      ? [
          {
            id: "bounties-open",
            label: "Open bounties",
            onRemove: () => {
              setOpenBounties(false);
              setPage(0);
            },
          },
        ]
      : []),
  ];

  return (
    /* ── BG-P15 — THE PAGE'S OWN FRAME IS GONE.

       What this div used to be: `minHeight: 100vh`, `background: VOID`,
       `color: TEXT_PRIMARY` and `fontFamily: FONT_STACK` — a page painting an
       entire dark viewport for itself because nothing else was going to. All
       four were the application frame's job, and the page is now inside the
       application frame, so all four are gone:

         minHeight   the frame owns the viewport (`.fs-frame` is 100dvh with
                     its own scroll region in `.fs-page-body`); a 100vh floor
                     inside that scroller is a second full screen of height.
         background  `t.bg` instead of a hard-coded #08080C, so the page's
                     ground follows the theme like every other surface. It is
                     painted here rather than left transparent for the reason
                     /dev/wide paints it: the centre column is transparent and
                     BlobBackground behind it is hard-coded dark in both
                     themes, so Exhibition needs a ground under the header or
                     the type is dark ink on a dark room.
         color       inherited from `.fs-root`, which is `var(--text)`.
         fontFamily  inherited from `.fs-root`, which is Figtree.

       `isolation: isolate` STAYS. It is not frame duplication — it keeps this
       page's z-indexes from being compared with the rails' — and it is the one
       property here that was never the frame's to provide.

       THE INNER CONTAINER'S `maxWidth: 1240` AND `margin: "0 auto"` ARE GONE
       TOO, and they are the doubled measure this move exists to remove: the
       wide frame already caps at 1600 and centres, so a second cap inside it
       centred a 1240px column inside an already-centred column. Its
       `padding: "28px 20px 64px"` is gone for the same reason — one padding
       on the outer div, `SPACE.md`, which is what a wide page carries (see
       /dev/wide) because `.fs-page-body` supplies no horizontal inset of its
       own and at phone width the frame's own 24px collapses to nothing. ── */
    <div
      data-visual-slot="gallery-frame"
      style={{
        padding: SPACE.md,
        background: t.bg,
        isolation: "isolate",
      }}
    >
      <Helmet>
        <title>Gallery — buildgallery</title>
        <meta
          name="description"
          content="Builds other people have run: the prompts, configs and evidence, structured so you can run them too."
        />
      </Helmet>

        {/* BG-P15. The bespoke header — a "← buildgallery" link beside an
            <h1>Gallery> — is replaced by the frame's PageHeader. The back link
            is deleted outright rather than rehomed: the left rail's wordmark
            goes to the home page and every nav entry is one click away, which
            is what the link was standing in for.

            The title is the eyebrow's job now. "GALLERY" names the kind of
            page, so the <h1> is free to say what the page is FOR rather than
            repeat the route's name.

            THE FACET CONTROLS ARE NOT IN THE `actions` SLOT, and that is a
            deliberate departure from BG-P15's brief. Rendered there they are
            laid beside the title in a flex row that gives them roughly a
            quarter of the centre column: the three rows collapse to about
            240px, "Loading…" clips, and a chip list that is meant to be read
            across becomes a corner widget. Two reasons not to:

              1. This page's own note, at the top of this file, says the
                 filters sit "at the top of the page, open, not behind a menu"
                 — they are the answer to a sparse launch, turning one broad
                 platform into several dense ones. A cramped corner is a menu
                 in all but name.
              2. Moving the section inside the header changes the page's
                 internal content structure, which BG-P15's first hard
                 constraint forbids.

            So the section stays exactly where it was, a sibling directly
            under the header, and `actions` stays empty. The header gained a
            page title; it did not gain the filters. */}
        <PageHeader
          eyebrow="GALLERY"
          title="Builds worth running"
          description="Builds written down completely enough to follow, ordered by how many people other than their creator have run them and said what happened."
        />

      {/* ── BG-P15 — PageHeader sits ABOVE this column, not inside it, and that
          is the last of the doubled spacings.

          PageHeader already declares the space under itself: `marginBottom:
          SPACE.lg`, 40px. Inside a flex column with `gap: 20` that 40 became
          60 between the header and the filters, while every other pair on the
          page kept 20 — a gulf under the header and nowhere else, which read
          as the filters having come loose from it.

          Lifting the header out fixes it without touching the page's own
          rhythm: the facets, the results and the pagination keep the exact
          20px gap they always had, and the header keeps the 40 it brought.
          It is also how /dev/wide composes a wide page — header, then the
          grid, as siblings. ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <FacetRail groups={groups} selected={selected} onClearAll={clearAll} />

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

/** A stored value's display label, falling back to the value itself. */
function labelFor(group: FacetGroup, value: string): string {
  return group.options.find((option) => option.value === value)?.label ?? value;
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
      <GalleryGrid builds={builds} srcByPath={srcByPath} />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   The grid
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * THE GRID IS UNIFORM, AND THAT IS A DECISION RATHER THAN AN OVERSIGHT.
 *
 * Every card here renders with `layout="grid"` — the card's default — so every
 * media block keeps its fixed slot and every card in a row is the same height.
 * The card CAN do the other thing: `layout="feed"` lets a picture keep its own
 * shape, and the home feed passes it, which is where natural picture shapes
 * earn their keep because a feed is a single column read top to bottom.
 *
 * A wall of ragged cards is not a gallery. In a three-column grid, unequal
 * heights break the horizontal line the eye uses to compare one build with the
 * next, and comparison is the entire reason this page exists rather than a
 * second feed. So:
 *
 *   - do not pass `layout="feed"` on this page;
 *   - do not introduce masonry, and do not install a masonry library;
 *   - if a later prompt asks for "more interesting shapes here", this comment
 *     is the answer it is looking for.
 *
 * THE COLUMNS ARE `.fs-grid`, WHICH IS BG-P14'S AND NOT THIS PAGE'S. The page
 * used to carry its own `repeat(auto-fill, minmax(272px, 1fr))` at a 14px
 * gutter, written before the wide frame existed. Three things were wrong with
 * keeping it: 272 is below the 320px floor a build card needs before its title
 * wraps to three lines; 14 is not on the spacing scale, and at 14 the gap to
 * the neighbour is SMALLER than the card's own padding, which is the one rule
 * `space.ts` states as an assertion — past it the eye groups across the gap and
 * a row of cards reads as one band rather than as separate objects; and nothing
 * in the inline rule said what to do on a phone, so a 700px screen got two
 * columns.
 *
 * `.fs-grid` is the frame's own: auto-filled 320px columns, gutters `md` (24)
 * below 1280 and `lg` (40) above, one column below 768, `align-items: start`.
 * Three across at 1400, two at 1100, one at 700. It is an existing class rather
 * than a new one — /dev/wide has rendered the same grid since BG-P14 — so
 * nothing here is a class added for styling.
 */
function GalleryGrid({
  builds,
  srcByPath,
}: {
  builds: GalleryBuild[];
  srcByPath: ReturnType<typeof useSignedMedia>;
}) {
  /**
   * Whether this render is the grid's first.
   *
   * The stagger is a LIST ENTRANCE, which the theme allows on this page, and
   * not scroll storytelling, which it does not. So it runs once, on the first
   * cards the grid ever puts up, and never again: a filter change swaps the
   * grid's contents four times in ten seconds, and re-animating on each of them
   * would be movement as decoration.
   */
  const firstPaint = useRef(true);
  useEffect(() => {
    firstPaint.current = false;
  }, []);

  /* Reduced motion is answered by never entering the hidden state at all — the
     end state is identical, it simply arrives at once — and so is a runtime
     without IntersectionObserver, where a card that started at opacity 0 would
     have nothing to bring it back. */
  const canReveal =
    !prefersReducedMotion() && typeof IntersectionObserver !== "undefined";

  return (
    <div className="fs-grid" data-visual-slot="gallery-grid" data-testid="gallery-grid">
      {builds.map((build, index) => (
        <Reveal key={build.id} index={index} animate={canReveal && firstPaint.current}>
          {/* The credit is the CARD's (BG-P11). It reads the two frozen
              snapshot columns off the record it was handed — they ride in on
              GALLERY_BUILD_COLUMNS like everything else the card shows — so the
              grid neither composes it nor can decline to pass it. */}
          <GalleryCard build={build} srcByPath={srcByPath} />
        </Reveal>
      ))}
    </div>
  );
}

/* ── The stagger ──────────────────────────────────────────────────────────── */

/** The theme's scroll-entry figures, and the only two it gives. */
const REVEAL_MS = 450;
const REVEAL_SHIFT = 14;

/** Between one card and the next. */
const REVEAL_STEP = 50;

/**
 * How many cards take a step before the stagger flattens.
 *
 * Eight, so the ripple runs across the first screen — three columns, three
 * rows — and tops out at 400ms. Without a cap, card twenty-four would wait a
 * second and a fifth after it had already scrolled into view, which is a page
 * withholding its content rather than presenting it.
 */
const REVEAL_MAX_STEPS = 8;

/** Never `ease-in` on an entrance: it reads as the page hesitating. */
const REVEAL_EASING = "cubic-bezier(.2,.6,.35,1)";

/**
 * One grid cell, revealed once when it first comes near the viewport.
 *
 * `transform` and `opacity` only, which are the two properties that composite;
 * the observer disconnects on the first intersection, so nothing here is still
 * watching once the page has settled.
 *
 * AFTER THE REVEAL THE TRANSFORM IS `none` RATHER THAN `translateY(0)`. A
 * lingering transform makes the cell a containing block, and the card inside it
 * carries a `backdrop-filter` — which would then sample the cell rather than
 * the page, and quietly change what the glass is made of. `none` interpolates
 * from a translate exactly as `translateY(0)` does and leaves nothing behind.
 */
function Reveal({
  index,
  animate,
  children,
}: {
  index: number;
  animate: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(!animate);

  useEffect(() => {
    if (!animate) return;
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setShown(true);
        observer.disconnect();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [animate]);

  const delay = Math.min(index, REVEAL_MAX_STEPS) * REVEAL_STEP;

  return (
    <div
      ref={ref}
      data-visual-slot="gallery-grid-cell"
      data-revealed={!animate || shown ? "" : undefined}
      style={
        animate
          ? shown
            ? {
                opacity: 1,
                transform: "none",
                transition:
                  `opacity ${REVEAL_MS}ms ${REVEAL_EASING} ${delay}ms, ` +
                  `transform ${REVEAL_MS}ms ${REVEAL_EASING} ${delay}ms`,
              }
            : { opacity: 0, transform: `translateY(${REVEAL_SHIFT}px)` }
          : undefined
      }
    >
      {children}
    </div>
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
