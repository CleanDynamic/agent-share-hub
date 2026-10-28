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

   NOT LIVE YET (drawn on the dev page only): the model release check and the week's goal (SV-22); session, part and claim
   requests and Your claims (SV-21); briefs, model tests and reviews (SV-22); Builds contributed to (SV-16); Groups (SV-24);
   a request's origin, claim, failed runs and comments (SV-21). */

import { useEffect } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { SeoHead } from "@/components/SeoHead";
import { PageArrival } from "@/components/shell/PageArrival";
import { useAuth } from "@/contexts/AuthContext";
import { getMyRecord, listMyOpenRequests, listStepRequests, listTopSolvers, toggleMeToo, type StepRequestsPage } from "@/lib/bounty";
import { reportError } from "@/lib/errors/report";
import { usePageReady } from "@/lib/routing/pageReady";

import { OpenBuildsLoadingView } from "./OpenBuildsFrame";
import { OpenBuildsView, type PanelStatus, type RequestItem } from "./OpenBuildsView";
import {
  CONTRIBUTORS_DAYS,
  CONTRIBUTORS_SHOWN,
  LIVE_TABS,
  OPEN_BUILDS_SORTS,
  OPEN_BUILDS_TABS,
  addressSearch,
  answersWords,
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

  const size = sizeOfTab(address.tab);
  const key = stepRequestsKey(address.sort, size, viewerId);
  const requests = useInfiniteQuery({
    queryKey: key,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listStepRequests({ sort: address.sort, size, offset: pageParam, viewerId }),
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    placeholderData: keepPreviousData,
    // The key carries the reader (their Me too marks): asked once the session is known, never once as nobody first.
    enabled: !authLoading,
  });
  const mine = useQuery({ queryKey: ["bounty", "listMyOpenRequests", viewerId], queryFn: () => listMyOpenRequests(viewerId as string), enabled: viewerId !== null });
  const record = useQuery({ queryKey: ["bounty", "getMyRecord", viewerId], queryFn: () => getMyRecord(viewerId as string), enabled: viewerId !== null });
  const contributors = useQuery({ queryKey: contributorsKey, queryFn: () => listTopSolvers({ limit: CONTRIBUTORS_SHOWN, sinceDays: CONTRIBUTORS_DAYS }) });

  useReported(requests.error, "openbuilds-requests");
  useReported(mine.error, "openbuilds-your-requests");
  useReported(record.error, "openbuilds-record");
  useReported(contributors.error, "openbuilds-contributors");
  usePageReady("openbuilds", !requests.isPending);

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
      facts: [...words.facts.map((text) => ({ parts: [{ text }] })), { meToo: true as const }],
      meToo: { count, pressed: request.meToo, onToggle: () => onMeToo(request.bounty.id, request.meToo, count) },
      action: { label: "Answer", to: words.answerTo },
    };
    return request.bounty.gap_node_id === null
      ? {
          ...shared,
          kind: "build",
          build: { title: request.build.title, maker: request.maker?.username ? `@${request.maker.username}` : null, steps: stepsWords(stepCountOf(byBuild.get(request.build.id) ?? [])) },
        }
      : { ...shared, kind: "step", problem: words.problem, strip: strip.tiles };
  });

  const move = (next: Parameters<typeof addressSearch>[1]) => setParams(addressSearch(params, next), { replace: true });
  const mineRows = mine.data ?? [];
  const waiting = mineRows.reduce((sum, row) => sum + row.answers, 0);

  return (
    <>
      <SeoHead title="OpenBuilds · buildgallery" description="Published builds that take contributions: open steps to answer, with rewards." path="/openbuilds" />
      {/* Until the requests arrive the page draws the route's Placeholder itself, so the two are one shape whoever reads. */}
      <PageArrival loading={requests.isPending} placeholder={<OpenBuildsLoadingView />}>
        {requests.isPending ? <OpenBuildsLoadingView /> : <OpenBuildsView
          requests={{
            tabs: TABS,
            tab: address.tab,
            onTab: (tab) => move({ tab }),
            sorts: OPEN_BUILDS_SORTS,
            sort: address.sort,
            onSort: (sort) => move({ sort }),
            status: statusOf(requests),
            onRetry: () => void requests.refetch(),
            items,
            more: requests.hasNextPage ? { loading: requests.isFetchingNextPage, onMore: () => void requests.fetchNextPage() } : undefined,
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
    </>
  );
}
