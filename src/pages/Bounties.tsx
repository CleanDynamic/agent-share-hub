/* UI-P33 / UI-P37 — /bounties: the container.

   Loads the open asks (a keyset page at a time, "Show more" for the next) and the top solvers through `src/lib/bounty`,
   maps them to `BountiesView`'s props and renders it. The view is pure, in `pages/site/bounties`; this file owns the
   queries, the sort (over what is loaded) and the chosen ask in the address (`?bounty=`).

   ME TOO IS OPTIMISTIC. The count and the button show the new state at once; the write follows; if it fails both go
   back and the solve panel says so, with a retry. */

import { useCallback, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import { CoverFallback } from "@/components/brand/CoverFallback";
import { useAuth } from "@/contexts/AuthContext";
import {
  OPEN_BOUNTIES_PAGE_SIZE,
  listOpenBountyCards,
  listTopSolvers,
  myMeToo,
  toggleMeToo,
  type OpenBountyCard,
} from "@/lib/bounty";
import { isPermissionError } from "@/lib/errors/permission";
import {
  BountiesView,
  type BountySort,
  type FrameView,
  type Load,
  type SolverView,
} from "@/pages/site/bounties/BountiesView";

const SORTS: readonly BountySort[] = ["newest", "reward", "closing"];

const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

/** "9 days", "today", or null with no deadline or one that has passed. */
function closesIn(closesAt: string | null, now: number): string | null {
  if (!closesAt) return null;
  const days = Math.ceil((new Date(closesAt).getTime() - now) / 86_400_000);
  if (days < 0) return null;
  return days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
}

const closesOn = (closesAt: string | null): string | null =>
  closesAt ? new Date(closesAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null;

export function frameOf(card: OpenBountyCard, now: number): FrameView {
  const reward = card.bounty.reward_gbp;
  return {
    id: card.bounty.id,
    title: card.build.title,
    part: card.gapTitle || "Part",
    reward: reward ? money.format(reward) : null,
    solutions: card.solutions,
    meToo: card.bounty.me_too_count ?? 0,
    to: `/bounties/${card.bounty.id}/solve`,
    cover: <CoverFallback seed={card.build.id} radius={0} />,
    closesIn: closesIn(card.bounty.closes_at, now),
    closes: closesOn(card.bounty.closes_at),
    problem: null,
  };
}

/** The loaded cards in the sort asked for: Newest is the order they arrive in; Reward is dearest first; Closing soon is nearest deadline first, unbounded asks last. */
export function sortCards(cards: readonly OpenBountyCard[], sort: BountySort): OpenBountyCard[] {
  const out = [...cards];
  if (sort === "reward") out.sort((a, b) => (b.bounty.reward_gbp ?? 0) - (a.bounty.reward_gbp ?? 0));
  if (sort === "closing") {
    const at = (card: OpenBountyCard) => (card.bounty.closes_at ? new Date(card.bounty.closes_at).getTime() : Infinity);
    out.sort((a, b) => at(a) - at(b));
  }
  return out;
}

export default function Bounties() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const asked = params.get("sort") as BountySort | null;
  const sort: BountySort = asked && SORTS.includes(asked) ? asked : "newest";
  const selectedId = params.get("bounty");

  const board = useInfiniteQuery({
    queryKey: ["bounty-board"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => listOpenBountyCards({ limit: OPEN_BOUNTIES_PAGE_SIZE, before: pageParam }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const solversQuery = useQuery({ queryKey: ["top-solvers"], queryFn: () => listTopSolvers({ limit: 3 }) });

  const cards = useMemo(() => sortCards((board.data?.pages ?? []).flatMap((page) => page.cards), sort), [board.data, sort]);
  const now = Date.now();
  const frameViews = useMemo(() => cards.map((card) => frameOf(card, now)), [cards, now]);
  const chosen = frameViews.find((frame) => frame.id === selectedId) ?? frameViews[0] ?? null;

  const frames: BountiesPropsFrames =
    board.isError && cards.length === 0
      ? {
          status: "error",
          refused: isPermissionError(board.error),
          onRetry: () => void board.refetch(),
          error: board.error,
        }
      : board.isPending
        ? { status: "loading" }
        : {
            status: "ready",
            data: frameViews,
            hasMore: Boolean(board.hasNextPage),
            loadingMore: board.isFetchingNextPage,
            onMore: () => void board.fetchNextPage(),
          };

  const solvers: Load<readonly SolverView[]> = solversQuery.isError
    ? { status: "error", onRetry: () => void solversQuery.refetch(), error: solversQuery.error }
    : solversQuery.data
      ? {
          status: "ready",
          data: solversQuery.data.map((solver) => ({
            id: solver.id,
            handle: solver.username ?? "someone",
            solved: solver.solved,
            avatarUrl: solver.avatar_url,
          })),
        }
      : { status: "loading" };

  /* ── me too ── */

  const bountyId = chosen?.id ?? null;
  const meTooKey = useMemo(() => ["bounty", "myMeToo", bountyId, user?.id ?? null] as const, [bountyId, user?.id]);
  const mine = useQuery({
    queryKey: meTooKey,
    enabled: Boolean(bountyId && user),
    queryFn: async () => (await myMeToo([bountyId as string], user!.id)).has(bountyId as string),
  });
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);

  const onMeToo = useCallback(() => {
    if (!bountyId || !chosen) return;
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent("/bounties")}`);
      return;
    }
    const was = Boolean(mine.data);
    const wasCount = chosen.meToo;
    setFailure(null);
    // Shown at once …
    qc.setQueryData(meTooKey, !was);
    qc.setQueryData<typeof board.data>(["bounty-board"], (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          cards: page.cards.map((card) =>
            card.bounty.id === bountyId
              ? { ...card, bounty: { ...card.bounty, me_too_count: Math.max(0, wasCount + (was ? -1 : 1)) } }
              : card,
          ),
        })),
      },
    );
    // … and put back if the write is refused.
    toggleMeToo({ bountyId, userId: user.id }).catch((error: unknown) => {
      qc.setQueryData(meTooKey, was);
      void qc.invalidateQueries({ queryKey: ["bounty-board"] });
      setFailure({ error });
    });
  }, [bountyId, chosen, user, mine.data, qc, meTooKey, navigate, setFailure, board.data]);

  return (
    <>
      <SeoHead title="Bounties — buildgallery" description="Open asks on real builds, with rewards for solutions." path="/bounties" />
      <BountiesView
        frames={frames}
        solvers={solvers}
        selectedId={chosen?.id ?? null}
        onSelect={(id) => {
          const next = new URLSearchParams(params);
          next.set("bounty", id);
          setParams(next, { replace: true });
        }}
        sort={sort}
        onSortChange={(next) => {
          const nextParams = new URLSearchParams(params);
          if (next === "newest") nextParams.delete("sort");
          else nextParams.set("sort", next);
          setParams(nextParams, { replace: true });
        }}
        meToo={
          chosen
            ? {
                pressed: Boolean(mine.data),
                count: chosen.meToo,
                onToggle: onMeToo,
                failure: failure ? { onRetry: onMeToo, error: failure.error } : undefined,
              }
            : undefined
        }
        onNavigate={navigate}
      />
    </>
  );
}

type BountiesPropsFrames = React.ComponentProps<typeof BountiesView>["frames"];
