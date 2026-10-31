/* SV-14: /openbuilds, the container.

   Loads through `src/lib/bounty` only, maps the results to `OpenBuildsView`'s props, and runs Me too. Round 1 starts
   together: the step requests, the reader's requests and record, and the top contributors. The step requests' own second
   round (their counts, makers, strips and the reader's Me too marks) is inside `listStepRequests`, one request each. So
   the first screen takes two rounds.

   WHERE THE READER IS lives in the address (`?type=`, `?sort=`). Changing either is the same page with new parameters:
   the old requests stay until the new arrive, with no fade.

   REQUEST SIZES: a bounty naming a gap node is a Step request; one naming none is a Whole build request, drawn with one row
   for its build (title, maker, step count). All lists both; Steps lists steps only (read on the server). Whole build gets
   its own tab when SV-21 adds request sizes.

   ME TOO is shown at once: the count and the pressed state change in the cache, the write follows, and a refusal puts
   both back and says so.

   CLAIMS (SV-21): a request's claim comes with its second round (one more request in it, none of its own), and Your claims is
   the reader's active claims. Both read nothing until the migration is applied. A request opened from a run says so in its meta.

   BRIEFS (SV-22): the Briefs tab reads `listBriefs` (a published build marked a brief; its answers are its rebuilds) in place
   of the bounties, only while the tab is open. Marking a brief is `setBrief`; its control is placed by SV-25's build page.

   MODEL TESTS AND THE RELEASE CHECK (SV-22): Model tests reads `listModelTests` (reproduced builds not yet run on a recent
   release) in place of the bounties; the release check is `getReleaseCheck`, one request in round 1, drawn above the requests
   once the migration has a release in it.

   REVIEWS AND THE WEEK'S GOAL (SV-22): Reviews reads `listReviews` (published builds their maker holds out of Builds); the goal is
   `getWeekGoal`, one more request of round 1, drawn in the contributors' tile once a goal is set.

   GROUPS (SV-24): the public filter sets, the reader's own first and then by members (`listGroups`, one request of round 1; a Group is
   a public filter set with members, not a guild). A row opens Builds with that set's filters. The section is drawn once there is a
   group to show, and the page waits for the read so it does not appear after the rest.

   NOT LIVE YET (drawn on the dev page only): Builds contributed to (SV-16); a request's failed runs and comments. */

import { Suspense, lazy, useEffect, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { SeoHead } from "@/components/SeoHead";
import { PageArrival } from "@/components/shell/PageArrival";
import { useAuth } from "@/contexts/AuthContext";
import { listBriefs } from "@/lib/bounty/briefs";
import { getReleaseCheck, listModelTests } from "@/lib/bounty/modelChecks";
import { getWeekGoal, listReviews } from "@/lib/bounty/reviews";
import { filterSetHref, listGroups } from "@/lib/build/filterSets";
import { getMyRecord, listMyClaims, listMyOpenRequests, listStepRequests, listTopSolvers, toggleMeToo, type StepRequestsPage } from "@/lib/bounty";
import { reportError } from "@/lib/errors/report";
import { usePageReady } from "@/lib/routing/pageReady";

import { useLibrarySessions } from "@/hooks/useLibrarySessions";

import { OpenBuildsLoadingView } from "./OpenBuildsFrame";
import { OpenBuildsView, type PanelStatus, type RequestItem } from "./OpenBuildsView";
import {
  CONTRIBUTORS_DAYS,
  CONTRIBUTORS_SHOWN,
  LIVE_TABS,
  briefWords,
  briefsKey,
  modelTestWords,
  modelTestsKey,
  releaseCheckKey,
  releaseCheckWords,
  reviewWords,
  reviewsKey,
  weekGoalKey,
  weekGoalWords,
  isBuildKindTab,
  OPEN_BUILDS_SORTS,
  OPEN_BUILDS_TABS,
  addressSearch,
  answersWords,
  claimRow,
  offerChoice,
  offerLine,
  SESSION_OFFER_NOTE,
  sessionRequestWords,
  contributorsKey,
  readAddress,
  rowsByBuild,
  sizeOfTab,
  stepCountOf,
  stepRequestWords,
  stepRequestsKey,
  stepsWords,
  stripsFor,
  toReviewWords,
} from "./openBuildsModel";

const statusOf = (query: { isPending: boolean; isError: boolean }): PanelStatus => (query.isPending ? "loading" : query.isError ? "error" : "ready");

/** A failed read is told about once, by its panel's name. */
function useReported(error: unknown, context: string) {
  useEffect(() => {
    if (error) reportError(error, { source: "openbuilds", context });
  }, [error, context]);
}

/** Opened only by "Offer a session", so the page's first download does not carry it. */
const OfferSessionDialog = lazy(() => import("./OfferSessionDialog").then((module) => ({ default: module.OfferSessionDialog })));

const TABS = OPEN_BUILDS_TABS.filter((tab) => LIVE_TABS.includes(tab.value));

export default function OpenBuildsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const viewerId = user?.id ?? null;
  const address = readAddress(params);
  const now = Date.now();

  /* ── round 1: everything that needs nothing else ── */

  const kind = isBuildKindTab(address.tab) ? address.tab : null;
  const size = sizeOfTab(address.tab);
  const key = stepRequestsKey(address.sort, size, viewerId);
  const requests = useInfiniteQuery({
    queryKey: key,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listStepRequests({ sort: address.sort, size, offset: pageParam, viewerId }),
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    placeholderData: keepPreviousData,
    // The key carries the reader (their Me too marks): asked once the session is known, never once as nobody first.
    enabled: !authLoading && !kind,
  });
  // SV-22: a tab whose requests are not bounties reads its own table, started only on that tab; the old content stays across tabs.
  const briefs = useInfiniteQuery({
    queryKey: briefsKey,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listBriefs({ offset: pageParam }),
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    placeholderData: keepPreviousData,
    enabled: kind === "briefs",
  });
  const modelTests = useInfiniteQuery({
    queryKey: modelTestsKey,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listModelTests({ offset: pageParam }),
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    placeholderData: keepPreviousData,
    enabled: kind === "model-tests",
  });
  const reviews = useInfiniteQuery({
    queryKey: reviewsKey,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listReviews({ offset: pageParam }),
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    placeholderData: keepPreviousData,
    enabled: kind === "reviews",
  });
  const listing = kind === "briefs" ? briefs : kind === "model-tests" ? modelTests : kind === "reviews" ? reviews : requests;
  const mine = useQuery({ queryKey: ["bounty", "listMyOpenRequests", viewerId], queryFn: () => listMyOpenRequests(viewerId as string), enabled: viewerId !== null });
  const claims = useQuery({ queryKey: ["bounty", "listMyClaims", viewerId], queryFn: () => listMyClaims(viewerId as string), enabled: viewerId !== null });
  const record = useQuery({ queryKey: ["bounty", "getMyRecord", viewerId], queryFn: () => getMyRecord(viewerId as string), enabled: viewerId !== null });
  // The release check is one request, started with the rest of round 1; the page waits for it so the figure above the requests does not push them down when it arrives.
  const release = useQuery({ queryKey: releaseCheckKey, queryFn: getReleaseCheck });
  const week = useQuery({ queryKey: weekGoalKey, queryFn: () => getWeekGoal() });
  const groups = useQuery({ queryKey: ["build", "listGroups"], queryFn: () => listGroups() });
  const contributors = useQuery({ queryKey: contributorsKey, queryFn: () => listTopSolvers({ limit: CONTRIBUTORS_SHOWN, sinceDays: CONTRIBUTORS_DAYS }) });

  // The page shows its placeholder only while neither list has ever arrived: moving between tabs keeps what is drawn until the new tab's arrives.
  const arriving = (requests.isPending && briefs.isPending && modelTests.isPending && reviews.isPending) || release.isPending || week.isPending || groups.isPending;
  useReported(requests.error, "openbuilds-requests");
  useReported(briefs.error, "openbuilds-briefs");
  useReported(modelTests.error, "openbuilds-model-tests");
  useReported(release.error, "openbuilds-release-check");
  useReported(reviews.error, "openbuilds-reviews");
  useReported(week.error, "openbuilds-week-goal");
  useReported(mine.error, "openbuilds-your-requests");
  useReported(claims.error, "openbuilds-claims");
  useReported(record.error, "openbuilds-record");
  useReported(contributors.error, "openbuilds-contributors");
  useReported(groups.error, "openbuilds-groups");
  usePageReady("openbuilds", !arriving);

  /* ── me too: shown at once, put back if refused ── */

  const setMeToo = (bountyId: string, pressed: boolean, count: number) =>
    qc.setQueryData<InfiniteData<StepRequestsPage, number>>(key, (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          requests: page.requests.map((request) => (request.bounty.id === bountyId ? { ...request, meToo: pressed, bounty: { ...request.bounty, me_too_count: count } } : request)),
        })),
      },
    );

  const onMeToo = (bountyId: string, pressed: boolean, count: number) => {
    if (!viewerId) {
      navigate(`/login?redirect=${encodeURIComponent(`/openbuilds?${params.toString()}`)}`);
      return;
    }
    setMeToo(bountyId, !pressed, Math.max(0, count + (pressed ? -1 : 1)));
    toggleMeToo({ bountyId, userId: viewerId }).then(
      (saved) => setMeToo(bountyId, saved.marked, saved.count),
      (error: unknown) => {
        setMeToo(bountyId, pressed, count);
        reportError(error, { source: "openbuilds", context: "toggleMeToo" });
        toast.error("Me too didn't save. Try again.");
      },
    );
  };

  /* ── offering a session, and answering an offer (SV-21) ── */

  const [offering, setOffering] = useState<string | null>(null);
  const library = useLibrarySessions({ active: false, withUnfinished: false, enabled: offering !== null && viewerId !== null });
  const refreshRequests = () => qc.invalidateQueries({ queryKey: ["bounty", "listStepRequests"] });

  const onOffer = (requestId: string) => {
    if (!viewerId) {
      navigate(`/login?redirect=${encodeURIComponent(`/openbuilds?${params.toString()}`)}`);
      return;
    }
    setOffering(requestId);
  };

  const offerSelected = async (importId: string) => {
    if (!offering || !viewerId) return;
    try {
      const { offerSession } = await import("@/lib/bounty/sessionOffers");
      await offerSession({ requestId: offering, importId, userId: viewerId });
    } catch (error) {
      reportError(error, { source: "openbuilds", context: "offerSession" });
      throw error;
    }
    toast("Session offered. Your copy of the build is in Drafts.", { action: { label: "Open Drafts", onClick: () => navigate("/drafts") } });
    void refreshRequests();
    void qc.invalidateQueries({ queryKey: ["bounty", "listMyClaims"] });
  };

  const decide = async (kind: "accept" | "decline", offerId: string) => {
    if (!viewerId) return;
    try {
      const { acceptOffer, declineOffer } = await import("@/lib/bounty/sessionOffers");
      if (kind === "decline") await declineOffer(offerId);
      else {
        const buildId = await acceptOffer({ offerId, makerId: viewerId });
        toast("Session added to your build.", { action: { label: "Open build", onClick: () => navigate(`/compose/${buildId}`) } });
      }
      void refreshRequests();
    } catch (error) {
      reportError(error, { source: "openbuilds", context: `${kind}Offer` });
      toast.error(error instanceof Error && error.message ? error.message : "Couldn't save that. Try again.");
    }
  };

  /* ── the view's props ── */

  const pages = requests.data?.pages ?? [];
  const records = pages.flatMap((page) => page.requests);
  const stripRows = pages.flatMap((page) => page.strips);
  const byBuild = rowsByBuild(stripRows);
  const strips = stripsFor(
    stripRows,
    records.map((request) => ({ key: request.bounty.id, buildId: request.build.id, gapId: request.bounty.gap_node_id, gapTitle: request.gapTitle })),
  );
  const items: RequestItem[] = records.map((request) => {
    const strip = strips.get(request.bounty.id) ?? { number: null, tiles: [] };
    const words = stepRequestWords(request, strip, now);
    const count = request.bounty.me_too_count ?? 0;
    const shared = {
      id: words.id,
      title: words.title,
      reward: words.reward,
      meta: words.meta,
      facts: [...(words.claim ? [{ parts: words.claim }] : []), ...words.facts.map((text) => ({ parts: [{ text }] })), { meToo: true as const }],
      meToo: { count, pressed: request.meToo, onToggle: () => onMeToo(request.bounty.id, request.meToo, count) },
      action: { label: "Answer", to: words.answerTo },
    };
    const session = sessionRequestWords(request);
    if (session) {
      return {
        ...shared,
        kind: "session",
        title: session.title,
        reward: { text: "No reward", muted: true },
        sessions: session.sessions,
        offers: request.offers.map((offer) => ({
          id: offer.id,
          line: offerLine(offer, viewerId),
          ...(request.bounty.author_id === viewerId ? { onAccept: () => void decide("accept", offer.id), onDecline: () => void decide("decline", offer.id) } : null),
        })),
        facts: [
          { parts: words.claim ?? [{ text: "Unclaimed" }] },
          { parts: [{ text: SESSION_OFFER_NOTE }] },
          { meToo: true as const },
        ],
        action: { label: "Offer a session", onPress: () => onOffer(request.bounty.id) },
      };
    }
    return request.bounty.gap_node_id === null
      ? {
          ...shared,
          kind: "build",
          build: { title: request.build.title, maker: request.maker?.username ? `@${request.maker.username}` : null, steps: stepsWords(stepCountOf(byBuild.get(request.build.id) ?? [])) },
        }
      : { ...shared, kind: "step", problem: words.problem, strip: strip.tiles };
  });

  const briefItems: RequestItem[] = (briefs.data?.pages ?? [])
    .flatMap((page) => page.briefs)
    .map((brief) => ({
      ...briefWords(brief, now),
      action: { label: "Answer this brief", to: `/b2/${brief.slug}` },
    }));

  const modelTestItems: RequestItem[] = (modelTests.data?.pages ?? [])
    .flatMap((page) => page.tests)
    .map((test) => ({ ...modelTestWords(test, now), action: { label: `Reproduce on ${test.target}`, to: `/b2/${test.slug}` } }));

  const reviewItems: RequestItem[] = (reviews.data?.pages ?? [])
    .flatMap((page) => page.reviews)
    .map((review) => ({ ...reviewWords(review, now), action: { label: "Reproduce to review", to: `/b2/${review.slug}` } }));

  const move = (next: Parameters<typeof addressSearch>[1]) => setParams(addressSearch(params, next), { replace: true });
  const mineRows = mine.data ?? [];
  const waiting = mineRows.reduce((sum, row) => sum + row.answers, 0);

  return (
    <>
      <SeoHead title="OpenBuilds · buildgallery" description="Published builds that take contributions: open steps to answer, with rewards." path="/openbuilds" />
      {/* Until the requests arrive the page draws the route's Placeholder itself, so the two are one shape whoever reads. */}
      <PageArrival loading={arriving} placeholder={<OpenBuildsLoadingView />}>
        {arriving ? <OpenBuildsLoadingView /> : <OpenBuildsView
          release={release.data ? releaseCheckWords(release.data, now) : undefined}
          week={week.data ? weekGoalWords(week.data) : undefined}
          requests={{
            tabs: TABS,
            tab: address.tab,
            onTab: (tab) => move({ tab }),
            sorts: OPEN_BUILDS_SORTS,
            sort: address.sort,
            onSort: (sort) => move({ sort }),
            status: statusOf(listing),
            onRetry: () => void listing.refetch(),
            items: kind === "briefs" ? briefItems : kind === "model-tests" ? modelTestItems : kind === "reviews" ? reviewItems : items,
            more: listing.hasNextPage ? { loading: listing.isFetchingNextPage, onMore: () => void listing.fetchNextPage() } : undefined,
          }}
          yourRequests={
            viewerId
              ? {
                  status: statusOf(mine),
                  onRetry: () => void mine.refetch(),
                  meta: toReviewWords(waiting),
                  rows: mineRows.map((row) => ({
                    id: row.bountyId,
                    label: `${row.build.title} · ${row.gapTitle ?? "Open request"}`,
                    detail: row.answers === 1 && row.latestSolver ? `@${row.latestSolver}` : answersWords(row.answers),
                    to: `/openbuilds/${row.bountyId}/solve`,
                  })),
                }
              : undefined
          }
          yourClaims={
            viewerId
              ? {
                  status: statusOf(claims),
                  onRetry: () => void claims.refetch(),
                  meta: "Expire after 3 days without a change",
                  rows: (claims.data ?? []).map((claim) => claimRow(claim, now)),
                }
              : undefined
          }
          record={
            viewerId
              ? {
                  status: statusOf(record),
                  onRetry: () => void record.refetch(),
                  meta: "From runs and accepted contributions",
                  to: "/profile",
                  rows: [
                    { label: "Builds reproduced", value: String(record.data?.reproduced ?? 0) },
                    ...((record.data?.tried ?? 0) > 0 ? [{ label: "Tried, didn't work", value: String(record.data?.tried) }] : []),
                    { label: "Answers accepted", value: String(record.data?.accepted ?? 0) },
                    ...(record.data?.contributed === undefined ? [] : [{ label: "Builds contributed to", value: String(record.data.contributed) }]),
                  ],
                }
              : undefined
          }
          groups={
            groups.isError || (groups.data?.length ?? 0) > 0
              ? {
                  status: statusOf(groups),
                  onRetry: () => void groups.refetch(),
                  meta: "Public filter sets, by members",
                  to: "/builds",
                  rows: (groups.data ?? []).map((group) => ({
                    id: group.id,
                    label: group.name,
                    detail: `${group.members} ${group.members === 1 ? "member" : "members"}${group.mine ? " · yours" : group.member ? " · joined" : ""}`,
                    to: filterSetHref(group),
                  })),
                }
              : undefined
          }
          contributors={{
            status: statusOf(contributors),
            onRetry: () => void contributors.refetch(),
            meta: `Accepted answers, last ${CONTRIBUTORS_DAYS} days`,
            to: "/openbuilds/solvers",
            rows: (contributors.data ?? []).map((solver) => ({
              id: solver.id,
              handle: solver.username ? `@${solver.username}` : "someone",
              count: solver.solved,
              avatarUrl: solver.avatar_url,
              to: solver.username ? `/profile/${solver.username}` : "/openbuilds/solvers",
            })),
          }}
        />}
      </PageArrival>
      {offering ? (
        <Suspense fallback={null}>
          <OfferSessionDialog
            open
            onOpenChange={(next) => (next ? undefined : setOffering(null))}
            status={library.isLoadingError || library.isError ? "error" : library.data === undefined ? "loading" : "ready"}
            onRetry={() => void library.refetch()}
            choices={(library.data ?? []).map(offerChoice)}
            onOffer={offerSelected}
          />
        </Suspense>
      ) : null}
    </>
  );
}
