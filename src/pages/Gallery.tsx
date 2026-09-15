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
// ── BG-P19 — THE REPAINT, AND THE FOUR DECISIONS IT RESTS ON ────────────────
//
// 1. THE FILTERS ARE ON THE GROUND, NOT IN A PANEL. They were a glass card
//    with a border and a radius directly under the page's <h1>: the heaviest
//    object on a page whose entry point has to be the work. The band is now
//    mono labels and outline chips with one hairline under it. FacetRail.tsx
//    owns that, and the collapse below 1024.
//
// 2. THE GRID IS UNIFORM ON PURPOSE. See the note on GalleryGrid below. It is
//    the decision most likely to be "fixed" by a later session, so it is
//    written where the grid is rather than only in a commit message.
//
// 3. THE ORDER IS STATED RATHER THAN OFFERED. There is no sort control on this
//    page and this prompt does not add one: the ordering lives in listGallery's
//    ORDER BY, and a control would mean a new option on the query, which the
//    first hard constraint on this page forbids. What a reader gets instead is
//    the ordering said out loud above the grid — the information a sort control
//    conveys, minus a control that could not change anything.
//
// 4. STALENESS IS THE CARD'S, ONCE. `isStale` already dims the plaque's lamp
//    and drops its text to --text2 inside GalleryCard. A second treatment at
//    the grid level — a dimmed card, a badge, a filter — would say the same
//    thing twice, and at grid scale would read as a fault rather than an age.
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
  galleryShortfall,
  galleryThreshold,
  getGalleryFacets,
  listGallery,
  requirementCopy,
  type GalleryBuild,
  type GalleryPage,
  type MissingItem,
} from "@/lib/build";
import { GalleryCard, GalleryCardSkeleton } from "@/components/gallery/GalleryCard";
import { cardMedia, useSignedMedia } from "@/components/gallery/cardMedia";
import {
  FacetRail,
  type FacetGroup,
  type SelectedFacet,
} from "@/components/gallery/FacetRail";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useReveal } from "@/lib/theme/useReveal";
import { r } from "@/lib/theme/radius";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
/* `data` imported under a name, because this file also binds `data` off a
   query result and the scale module's own note says to rename rather than
   shadow. */
import { body, cardTitle, data as dataText, measure, tabular } from "@/lib/theme/type";

/** Facets change far more slowly than the builds they describe. */
const FACETS_STALE_MS = 5 * 60 * 1000;

/**
 * How many card shapes the loading state puts up.
 *
 * Six, not GALLERY_PAGE_SIZE. A skeleton's job is to hold the shape of the
 * first screen so the swap does not move the page, and six is two rows of
 * three at the widths where three columns fit. Twenty-four would be eighteen
 * placeholder cards laid out below the fold for the few hundred milliseconds
 * before the real ones replace them.
 */
const LOADING_CARDS = 6;

export default function Gallery() {
  const { user } = useAuth();
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

      <FacetRail groups={groups} selected={selected} onClearAll={clearAll} />

      {/* ── BG-P15 — PageHeader sits ABOVE this column, not inside it, and
          BG-P19 lifted the facet rail out of it too.

          PageHeader declares the space under itself (`marginBottom: SPACE.lg`),
          and the rail now declares the space under ITSELF: SPACE.md, then the
          hairline. So the column below holds only what the rail introduces, at
          one gap, and the boundary sits in the middle of a 24/24 pair rather
          than hard against the first card.

          `gap: 20` is gone with it. Twenty is not on the spacing scale, and the
          three things it separated — the count, the grid and the pagination —
          are sibling blocks inside one surface, which is what `md` is for. ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: SPACE.md,
          paddingTop: SPACE.md,
        }}
      >

        <Results
          builds={rows}
          srcByPath={srcByPath}
          total={total}
          isLoading={builds.isLoading}
          error={(builds.error as Error | null) ?? null}
          filtered={filtered}
          viewerId={user?.id ?? null}
          onRetry={() => void builds.refetch()}
          onClearAll={clearAll}
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

/* ────────────────────────────────────────────────────────────────────────────
   The four states
   ──────────────────────────────────────────────────────────────────────────── */

function Results({
  builds,
  srcByPath,
  total,
  isLoading,
  error,
  filtered,
  viewerId,
  onRetry,
  onClearAll,
}: {
  builds: GalleryBuild[];
  srcByPath: ReturnType<typeof useSignedMedia>;
  total: number | null;
  isLoading: boolean;
  error: Error | null;
  filtered: boolean;
  viewerId: string | null;
  onRetry: () => void;
  onClearAll: () => void;
}) {
  if (error) {
    return (
      <Notice
        testId="gallery-error"
        heading="The gallery could not be loaded"
        detail="The request for this page failed. Nothing is lost — the gallery only reads, and a retry asks again."
        /* The machine's own words, in the machine's own face. This
           application's one maintainer is not a developer, and the sentence
           they can paste into a bug report is most of this state's value. */
        said={error.message}
        action={
          <Button type="button" variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        }
      />
    );
  }

  if (isLoading) return <LoadingGrid />;

  if (builds.length === 0) {
    return filtered ? (
      <Notice
        testId="gallery-empty-filtered"
        heading="No builds match — clear a filter"
        detail="Made for and Made with have to match together. Widening either one, or dropping the open-bounty filter, is usually enough."
        action={
          <Button type="button" variant="secondary" onClick={onClearAll}>
            Clear all
          </Button>
        }
      />
    ) : (
      <Notice
        testId="gallery-empty"
        heading="Nothing in the gallery yet"
        detail="A build reaches the gallery once its record carries enough to follow — the outcome, the thing to run, the evidence, and who it is for."
        action={
          <Button type="button" variant="secondary" asChild>
            <Link to="/compose/new">Write one up</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <ResultsSummary total={total} shown={builds.length} />
      <GalleryGrid builds={builds} srcByPath={srcByPath} viewerId={viewerId} />
    </>
  );
}

/**
 * How many builds, and in what order.
 *
 * THE ORDER IS THE HALF THAT IS NEW. It is stated rather than offered as a
 * control because listGallery's ORDER BY is not a runtime option and this
 * prompt may not make it one — so a sort control would be a control that
 * cannot sort. A reader gets the information the control would have carried,
 * which is what the grid in front of them is ordered by.
 *
 * Mono, `--text2`, one line: a caption on the grid, not a heading above it.
 * `tabular` on the count and not on the sentence — aligned digits are for
 * numbers in a column, and turning the prose monospaced-numeric does nothing.
 */
function ResultsSummary({ total, shown }: { total: number | null; shown: number }) {
  return (
    <p data-testid="gallery-summary" style={{ ...dataText, margin: 0, color: t.text2 }}>
      <span style={tabular}>
        {total === null ? `${shown} shown` : `${total} build${total === 1 ? "" : "s"}`}
      </span>
      {" · most reproduced first, then most recently confirmed working"}
    </p>
  );
}

/**
 * The grid's shape before the grid exists.
 *
 * `GalleryCardSkeleton` AT THE CARD'S REAL PROPORTIONS, in the real `.fs-grid`.
 * It spends the same FRAME_PAD, CONTENT_PAD and BODY_HEIGHT the card spends, so
 * the swap when the data lands does not move the page — which is the only thing
 * a loading state is for. A spinner, or the single "Loading the gallery…" line
 * this replaces, tells a reader to wait without telling them what for.
 *
 * `aria-hidden`, because a screen reader should hear the page's content arrive
 * rather than a description of six placeholder rectangles.
 */
function LoadingGrid() {
  return (
    <div
      className="fs-grid"
      data-visual-slot="gallery-grid-loading"
      data-testid="gallery-loading"
      aria-hidden
    >
      {Array.from({ length: LOADING_CARDS }, (_, index) => (
        <GalleryCardSkeleton key={index} />
      ))}
    </div>
  );
}

/**
 * A state with nothing in it: empty, empty-under-filters, or failed.
 *
 * DESIGNED WITH THE SAME CARE AS THE POPULATED GRID, which is the whole of
 * `aesthetic-usability`'s argument about these screens — a rough error state
 * reads as broken and lowers the perceived quality of everything around it. So
 * it takes the card's own title face, the 68ch measure on its prose, and
 * exactly one action.
 *
 * THE ACTION IS SECONDARY, NEVER PRIMARY. The theme allows one primary action
 * per view and the frame's own compose control is already spending it
 * (BG-P13); a page-level primary here would be the second.
 *
 * NO GLASS, NO BORDER, NO PANEL. It was a glass card with a coloured left edge
 * — ORANGE for the error, TEAL for everything else, neither of which is a token
 * in this system. It sits on the same ground the grid sits on now, because a
 * bordered box in an empty column reads as a card that failed to load rather
 * than as the page saying there is nothing to show.
 */
function Notice({
  testId,
  heading,
  detail,
  said,
  action,
}: {
  testId: string;
  heading: string;
  detail: string;
  said?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      data-visual-slot="gallery-notice"
      data-testid={testId}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: SPACE.sm,
        paddingTop: SPACE.lg,
        paddingBottom: SPACE.lg,
      }}
    >
      <h2 style={{ ...cardTitle, margin: 0, color: t.text }}>{heading}</h2>
      <p style={{ ...body, ...measure, margin: 0, color: t.text2 }}>{detail}</p>
      {said ? (
        <p style={{ ...dataText, ...measure, margin: 0, color: t.text2 }}>{said}</p>
      ) : null}
      {action}
    </div>
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
  viewerId,
}: {
  builds: GalleryBuild[];
  srcByPath: ReturnType<typeof useSignedMedia>;
  viewerId: string | null;
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

  /* Reduced motion and a runtime without IntersectionObserver are both
     answered inside `useReveal`, by never entering the hidden state at all:
     the end state is identical, it simply arrives at once. What is decided
     here is only whether this render is the grid's first. */
  return (
    <div className="fs-grid" data-visual-slot="gallery-grid" data-testid="gallery-grid">
      {builds.map((build, index) => (
        <Reveal key={build.id} index={index} animate={firstPaint.current}>
          {/* The credit is the CARD's (BG-P11). It reads the two frozen
              snapshot columns off the record it was handed — they ride in on
              GALLERY_BUILD_COLUMNS like everything else the card shows — so the
              grid neither composes it nor can decline to pass it. */}
          <GalleryCard build={build} srcByPath={srcByPath} />
          <Shortfall build={build} viewerId={viewerId} />
        </Reveal>
      ))}
    </div>
  );
}

/* ── The stagger ──────────────────────────────────────────────────────────── */

/* BG-P32. The theme's two scroll-entry figures — 450ms and 14px — and the
   easing used to live here as three local constants. They are `REVEAL`,
   `REVEAL_SHIFT` and `STANDARD` in src/lib/theme/motion.ts now, spent through
   the `useReveal` hook this grid and the build page share. What stays local is
   the only thing that is genuinely this grid's: how far apart the cards are. */

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

/**
 * One grid cell, revealed once when it first comes near the viewport.
 *
 * BG-P32 — THE MECHANISM MOVED, THE BEHAVIOUR DID NOT. The observer, the
 * once-only disconnect, the two composited properties and the fail-towards-
 * visible defaults are all in `useReveal` now, shared with the build page's
 * section reveals. This component is what is left once that is factored out:
 * the grid cell, its slot attribute, and the stagger step that is its own.
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
  const { ref, style, shown } = useReveal({
    enabled: animate,
    delayMs: Math.min(index, REVEAL_MAX_STEPS) * REVEAL_STEP,
  });

  return (
    <div
      ref={ref}
      data-visual-slot="gallery-grid-cell"
      data-revealed={shown ? "" : undefined}
      style={style}
    >
      {children}
    </div>
  );
}

/* ── The creator's own shortfall ──────────────────────────────────────────── */

/**
 * Why this build has not earned its place, to the one person who can fix it.
 *
 * WHO SEES IT. The signed-in creator of this build, and nobody else. A visitor
 * never sees it, another creator never sees it, and a signed-out reader never
 * sees it — `viewerId` is null for the last of those and unequal for the first
 * two.
 *
 * WHEN IT APPEARS AT ALL. A below-threshold build is in this grid for exactly
 * one reason: an admin promoted it with `status = 'gallery'`, which gallery.ts
 * describes as the editorial escape hatch for the record a rule table gets
 * wrong. So this line is the honest reading of that situation — you are here
 * because somebody put you here, and this is what would keep you here on the
 * record's own merits.
 *
 * WHAT IT SAYS, AND WHAT IT REFUSES TO SAY. Plain instructions in the creator's
 * own terms, taken from the same table the compose checklist reads, joined into
 * one sentence. Never a score, never a grade, never a bar with a fill: the
 * number exists, it is not something a creator can act on, and printing it
 * turns a record into a mark. `--text2` at the data face, under the card rather
 * than on it — the card is what a reader sees, and this is a note to one person
 * beside it.
 *
 * WHY THE LIST CAN BE SHORTER THAN THE TRUTH. The gallery asks for five things
 * and a card row can only answer three of them: the outcome and the two
 * audience fields are columns on the row, while "something to run" and
 * "evidence" are properties of a node tree this page deliberately does not
 * fetch in full. So this names only what the row can PROVE is absent.
 * Under-reporting is honest. Telling a creator to add evidence they have
 * already added would not be, and neither would a second query per card on the
 * one page in this codebase built not to make them.
 */
function Shortfall({
  build,
  viewerId,
}: {
  build: GalleryBuild;
  viewerId: string | null;
}) {
  if (!viewerId || viewerId !== build.creator_id) return null;

  const score = build.completeness ?? 0;
  if (score >= galleryThreshold(build.shape)) return null;

  const outstanding = galleryShortfall(build.shape, score, provableMissing(build));
  if (outstanding.length === 0) return null;

  return (
    <p
      data-testid="gallery-shortfall"
      style={{
        ...dataText,
        margin: 0,
        padding: `${SPACE.xs}px ${SPACE.xs}px 0`,
        color: t.text2,
      }}
    >
      Only you can see this — to earn its place in the gallery,{" "}
      {sentence(outstanding)}.
    </p>
  );
}

/** The gallery requirements a card row carries enough columns to answer. */
function provableMissing(build: GalleryBuild): MissingItem[] {
  const missing: MissingItem[] = [];
  if (!hasText(build.outcome)) missing.push(item("outcome"));
  if (!hasEntries(build.made_for)) missing.push(item("made_for"));
  if (!hasEntries(build.made_with)) missing.push(item("made_with"));
  return missing;
}

const item = (key: "outcome" | "made_for" | "made_with"): MissingItem => ({
  key,
  copy: requirementCopy(key),
});

const hasText = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

const hasEntries = (value: string[] | null | undefined): boolean =>
  Array.isArray(value) && value.some((entry) => (entry ?? "").trim().length > 0);

/** "a", "a and b", "a, b and c" — one sentence, never a bulleted verdict. */
function sentence(items: MissingItem[]): string {
  const parts = items.map((entry) => entry.copy);
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/* ────────────────────────────────────────────────────────────────────────────
   Pagination
   ──────────────────────────────────────────────────────────────────────────── */

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

  /* The kit's secondary button rather than three hand-written declarations per
     control. It was a 100px capsule on an rgba(255,255,255,0.025) fill with a
     hard-coded hairline — a pill, which the theme retired, on a white alpha
     that is invisible on Exhibition. `disabled` now carries the kit's own
     treatment instead of a colour swap this file chose. */
  const step = (label: string, next: number, enabled: boolean) => (
    <Button
      type="button"
      variant="secondary"
      disabled={!enabled || busy}
      onClick={() => {
        onPage(next);
        window.scrollTo({ top: 0 });
      }}
      style={{ borderRadius: r.control }}
    >
      {label}
    </Button>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: SPACE.xs }}>
      {step("← Previous", page - 1, page > 0)}
      {step("Next →", page + 1, hasMore)}
      <span style={{ ...dataText, ...tabular, color: t.text2 }}>Page {page + 1}</span>
    </div>
  );
}
