import { useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { gapEdge } from "@/components/brand/GapMarker";
import { FacetRail, type FacetGroup, type SelectedFacet } from "@/components/gallery/FacetRail";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import {
  OPEN_BOUNTIES_PAGE_SIZE,
  bountyFacetsMadeWith,
  listOpenBountyCards,
  type OpenBountyCard,
} from "@/lib/bounty";
import { isPermissionError } from "@/lib/errors/permission";
import { skeletonStyle } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, body, bodyLarge, tabular } from "@/lib/theme/type";

/* ────────────────────────────────────────────────────────────────────────────
   RC-P12 — /bounties, the open bounties board: help where something is stuck
   (CONTRACT §14).

   EVERY OPEN ASK ON EVERY BUILD, NEWEST FIRST, and the order is stated in the
   sentence under the title rather than offered as a control ⟦hicks-law ›
   Readers table: time⟧. One facet group, Made with, folded to six options and
   More exactly as the gallery's is (FacetRail), so both boards filter alike.
   No lens row and no sort.

   A LIST, NOT A GRID ⟦layout-grid⟧, as RC-P09b drew it: an ask is read across —
   reward, then the ask and whose build it is on, then how many have answered
   and the way in — and a list keeps those three at one column each. Max 960
   wide, on the title's leading edge ⟦better-layout › Align to shared edges⟧.

   THE WEAKEST CONTAINER ⟦law-of-common-region⟧: rows are flat, parted by a
   --line hairline. A bounty is a gap in a list, so each row wears STATES.md
   row 13's dashed breakage edge on its leading side and nothing else
   ⟦buildgallery-theme › Gap / bounty⟧: an invitation, not a defect.

   ONE WAY IN PER ROW ⟦von-restorff-effect⟧: the row is not a link, its outline
   "Open the build" is. Nothing on the page is filled while it has rows.

   THREE REQUESTS A PAGE (listOpenBountyCards) plus the facets, cached; "Show
   more" asks for the next keyset page. No infinite scroll.
   ──────────────────────────────────────────────────────────────────────────── */

/** The facet options change slowly; one answer serves a visit. */
const FACETS_STALE_MS = 5 * 60 * 1000;

/** How many placeholder rows stand in for the first page. */
const LOADING_ROWS = 4;

/** The reward, as money: "£50" for whole pounds, "£49.50" otherwise. */
const wholePounds = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});
const poundsAndPence = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function rewardLabel(reward: number | string | null): string | null {
  if (reward === null || reward === undefined || reward === "") return null;
  const amount = Number(reward);
  if (!Number.isFinite(amount)) return null;
  return (Number.isInteger(amount) ? wholePounds : poundsAndPence).format(amount);
}

/**
 * The row's three columns. THE LIST HOLDS THEM AND EVERY ROW USES THEM through
 * `subgrid`, so the reward, the ask and the way in line up down the whole
 * board ⟦law-of-continuity › Alignment⟧ rather than each row sizing its own
 * reward column to its own label ("No reward" is wider than "£50").
 */
const ROW_COLUMNS = "minmax(72px, auto) minmax(0, 1fr) auto";

/** Trimmed, empty entries dropped, first occurrence kept. */
function cleanValues(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export default function Bounties() {
  const breakpoint = useBreakpoint();
  const phone = breakpoint === "mobile";
  const [searchParams, setSearchParams] = useSearchParams();

  const madeWith = useMemo(() => cleanValues(searchParams.getAll("with")), [searchParams]);

  const setMadeWith = (next: string[]) => {
    const params = new URLSearchParams();
    for (const value of cleanValues(next)) params.append("with", value);
    setSearchParams(params);
  };

  const facets = useQuery({
    queryKey: ["bounty-facets"],
    queryFn: bountyFacetsMadeWith,
    staleTime: FACETS_STALE_MS,
  });

  const board = useInfiniteQuery({
    queryKey: ["bounty-board", madeWith],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      listOpenBountyCards({ before: pageParam, madeWith, limit: OPEN_BOUNTIES_PAGE_SIZE }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const cards = useMemo(() => board.data?.pages.flatMap((page) => page.cards) ?? [], [board.data]);

  const toggled = (value: string) =>
    madeWith.includes(value) ? madeWith.filter((entry) => entry !== value) : [...madeWith, value];

  const groups: FacetGroup[] = [
    {
      key: "made-with",
      label: "Made with",
      loading: facets.isLoading,
      emptyText: "No tools named yet.",
      options: (facets.data ?? []).map((option) => ({
        value: option.value,
        label: option.value,
        count: option.count,
        selected: madeWith.includes(option.value),
        onToggle: () => setMadeWith(toggled(option.value)),
      })),
    },
  ];

  const selected: SelectedFacet[] = madeWith.map((value) => ({
    id: `made-with-${value}`,
    label: value,
    onRemove: () => setMadeWith(toggled(value)),
  }));

  return (
    /* 24 around the page on the wide frame, which has no inset of its own
       there. On a phone the frame's own 16 is the page margin the full-width
       buttons sit inside ⟦better-layout › Inset buttons⟧, so the page adds
       only the 16 above its title. */
    <div
      data-visual-slot="bounties-frame"
      style={phone ? { paddingTop: SPACE.sm } : { padding: SPACE.md }}
    >
      <Helmet>
        <title>Bounties — buildgallery</title>
      </Helmet>

      <PageHeader title="Bounties" description="Open asks on real builds. Newest first." />

      <FacetRail groups={groups} selected={selected} onClearAll={() => setMadeWith([])} />

      <div data-visual-slot="bounty-board-column" style={{ maxWidth: 960, paddingTop: SPACE.md }}>
        <BoardBody
          cards={cards}
          phone={phone}
          filtered={madeWith.length > 0}
          isLoading={board.isLoading}
          error={(board.error as Error | null) ?? null}
          onRetry={() => void board.refetch()}
        />

        {board.hasNextPage ? (
          <div style={{ paddingTop: SPACE.md }}>
            <Button
              type="button"
              variant="outline"
              data-testid="bounties-show-more"
              disabled={board.isFetchingNextPage}
              onClick={() => void board.fetchNextPage()}
              style={{ background: "transparent", borderRadius: r.control, minHeight: 44 }}
            >
              Show more
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   The board's states
   ──────────────────────────────────────────────────────────────────────────── */

function BoardBody({
  cards,
  phone,
  filtered,
  isLoading,
  error,
  onRetry,
}: {
  cards: OpenBountyCard[];
  phone: boolean;
  filtered: boolean;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  /* STATES.md row 21: a refusal is its own sentence, never an empty board. */
  if (error) {
    return (
      <StateLine
        testId="bounties-error"
        sentence={isPermissionError(error) ? "You don't have access to this." : "Something went wrong."}
        action={
          <Button type="button" variant="outline" onClick={onRetry} style={{ background: "transparent" }}>
            Try again
          </Button>
        }
      />
    );
  }

  if (isLoading) return <LoadingRows phone={phone} />;

  /* STATES.md row 19: one sentence and one action, secondary (row 2), because
     the frame's own controls spend the primary on the phone and signed out.
     With a filter on, "none right now" would not be true, so it says what is. */
  if (cards.length === 0) {
    return filtered ? (
      <StateLine
        testId="bounties-empty-filtered"
        sentence="No open bounties are made with that."
        action={
          <Button asChild variant="outline" style={{ background: "transparent" }}>
            <Link to="/bounties">Clear filters</Link>
          </Button>
        }
      />
    ) : (
      <StateLine
        testId="bounties-empty"
        sentence="No open bounties right now."
        action={
          <Button asChild variant="outline" style={{ background: "transparent" }}>
            <Link to="/gallery">Browse the gallery</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ol
      data-testid="bounty-board"
      aria-label="Open bounties, newest first"
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        ...(phone ? {} : { display: "grid", gridTemplateColumns: ROW_COLUMNS }),
      }}
    >
      {cards.map((card, index) => (
        <BountyRow key={card.bounty.id} card={card} phone={phone} first={index === 0} />
      ))}
    </ol>
  );
}

function StateLine({
  testId,
  sentence,
  action,
}: {
  testId: string;
  sentence: string;
  action: React.ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: SPACE.sm,
        paddingTop: SPACE.md,
        paddingBottom: SPACE.lg,
      }}
    >
      <p style={{ ...body, margin: 0, color: t.text2 }}>{sentence}</p>
      {action}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   One ask
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * One open ask: reward | the ask and whose build it is on | answers and the
 * way in ⟦law-of-proximity⟧. A NEW element, so its grid is its own.
 *
 * THE EDGE IS LOGICAL. gapEdge("row") names the physical left edge; the row
 * spends the same width, style and token on its inline start, so the dashes
 * stay on the leading side in a right-to-left layout ⟦better-layout › Align to
 * shared edges⟧.
 *
 * BELOW 768 IT REFLOWS ⟦responsive-design › Reflow⟧: one column, 8 between the
 * three parts, and the button full width with a 44px hit area ⟦better-layout ›
 * Inset buttons⟧.
 */
function BountyRow({
  card,
  phone,
  first,
}: {
  card: OpenBountyCard;
  phone: boolean;
  first: boolean;
}) {
  const edge = gapEdge("row");
  const reward = rewardLabel(card.bounty.reward_gbp);
  const ask = card.gapTitle ?? card.build.title;
  const maker =
    card.author.display_name?.trim() ||
    (card.author.username ? `@${card.author.username}` : "a maker");
  const answers = `${card.solutions} ${card.solutions === 1 ? "solution" : "solutions"}`;

  return (
    <li
      data-testid="bounty-row"
      style={{
        display: "grid",
        ...(phone
          ? { gridTemplateColumns: "1fr" }
          : { gridTemplateColumns: "subgrid", gridColumn: "1 / -1" }),
        columnGap: SPACE.md,
        rowGap: phone ? SPACE.xs : 0,
        alignItems: phone ? "start" : "center",
        paddingBlock: SPACE.sm,
        paddingInlineStart: SPACE.sm,
        borderInlineStartWidth: edge.borderLeftWidth,
        borderInlineStartStyle: edge.borderLeftStyle,
        borderInlineStartColor: edge.borderLeftColor,
        ...(first ? {} : { borderTop: `1px solid ${t.line}` }),
      }}
    >
      <span
        data-testid="bounty-reward"
        style={{
          fontFamily: DM_MONO,
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1.4,
          ...tabular,
          color: reward ? t.text : t.text2,
          whiteSpace: "nowrap",
        }}
      >
        {reward ?? "No reward"}
      </span>

      <div style={{ minWidth: 0 }}>
        <p data-testid="bounty-ask" style={{ ...bodyLarge, margin: 0, color: t.text }}>
          {ask}
        </p>
        <p style={{ ...body, margin: 0, color: t.text2 }}>
          on {card.build.title} · by {maker}
        </p>
      </div>

      {/* Right-aligned across the board, so every "Open the build" sits on one
          edge and every count ends against its button. */}
      <div
        style={{
          display: "flex",
          flexDirection: phone ? "column" : "row",
          alignItems: phone ? "stretch" : "center",
          justifyContent: phone ? "flex-start" : "flex-end",
          gap: phone ? SPACE.xs : SPACE.sm,
        }}
      >
        <span
          data-testid="bounty-solutions"
          style={{
            fontFamily: DM_MONO,
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.3,
            ...tabular,
            color: t.text2,
            whiteSpace: "nowrap",
          }}
        >
          {answers}
        </span>
        <Button
          asChild
          variant="outline"
          style={{
            background: "transparent",
            borderRadius: r.control,
            minHeight: 44,
            ...(phone ? { width: "100%" } : {}),
          }}
        >
          <Link to={`/b2/${card.build.slug}`}>Open the build</Link>
        </Button>
      </div>
    </li>
  );
}

/** STATES.md row 20: the rows' shape before the rows, in --recess. */
function LoadingRows({ phone }: { phone: boolean }) {
  return (
    <div data-testid="bounties-loading" aria-hidden>
      {Array.from({ length: LOADING_ROWS }, (_, index) => (
        <div
          key={index}
          style={{
            display: "grid",
            gridTemplateColumns: phone ? "1fr" : "72px minmax(0, 1fr) 200px",
            columnGap: SPACE.md,
            rowGap: SPACE.xs,
            paddingBlock: SPACE.sm,
            borderTop: index === 0 ? undefined : `1px solid ${t.line}`,
          }}
        >
          <div style={{ ...skeletonStyle(), height: 20 }} />
          <div style={{ ...skeletonStyle(), height: 44 }} />
          <div style={{ ...skeletonStyle(), height: 44 }} />
        </div>
      ))}
    </div>
  );
}
