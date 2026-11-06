/* UX-10 P5b: /profile/:handle/followers and /profile/:handle/following, the container.

   Two reads, started together: the profile (for the count and whether it is private) and the list's first page, which carries
   the reader's follow state for every person on it. One round. Show more reads the next 30. Follow and Unfollow change the row
   at once and go back if the write is refused. */

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import { PageArrival } from "@/components/shell/PageArrival";
import { useCrumbTitle } from "@/components/shell/useBreadcrumb";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { followMaker, unfollowMaker } from "@/lib/profile/follow";
import { listProfileFollows, type FollowList, type FollowPage } from "@/lib/profile/followLists";
import { getProfileSummary } from "@/lib/profile/getProfileSummary";
import { ProfilePlaceholder } from "@/lib/routing/placeholders";
import { usePageReady } from "@/lib/routing/pageReady";

import { FollowListView, followTitle } from "./FollowListView";

const STALE_MS = 60_000;

export const followsKey = (handle: string, which: FollowList, viewerId: string | null) => ["profile", "listProfileFollows", handle, which, viewerId] as const;

export function FollowListPage({ which }: { which: FollowList }) {
  const { handle = "" } = useParams<{ handle: string }>();
  const { user, loading: authLoading } = useAuth();
  const viewerId = user?.id ?? null;
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const summary = useQuery({
    queryKey: ["profile", "getProfileSummary", handle, viewerId],
    queryFn: () => getProfileSummary(handle, viewerId),
    enabled: !authLoading && Boolean(handle),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });
  const key = followsKey(handle, which, viewerId);
  const list = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => listProfileFollows(handle, which, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last: FollowPage) => last.next ?? undefined,
    enabled: !authLoading && Boolean(handle),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });

  useCrumbTitle(`@${handle}`);
  const ready = !authLoading && !summary.isPending && !list.isPending;
  usePageReady(which, ready);

  const profile = summary.data;
  const locked = Boolean(profile?.isPrivate && !profile.isOwnProfile && !profile.isFollowing);
  const people = (list.data?.pages ?? []).flatMap((page) => page.people);

  const patch = (id: string, follow: boolean) =>
    qc.setQueryData(key, (prev: typeof list.data) =>
      prev ? { ...prev, pages: prev.pages.map((page) => ({ ...page, people: page.people.map((person) => (person.id === id ? { ...person, readerFollows: follow } : person)) })) } : prev,
    );

  const onFollow = async (id: string, follow: boolean) => {
    if (!viewerId) {
      navigate("/login");
      return;
    }
    patch(id, follow);
    try {
      await (follow ? followMaker(viewerId, id) : unfollowMaker(viewerId, id));
    } catch {
      patch(id, !follow);
      toast({ title: follow ? "Could not follow" : "Could not unfollow", variant: "destructive" });
    }
  };

  return (
    <PageArrival loading={!ready} placeholder={<ProfilePlaceholder />}>
      <SeoHead title={followTitle(which, handle)} description={followTitle(which, handle)} path={`/profile/${handle}/${which}`} noIndex />
      <FollowListView
        handle={handle}
        which={which}
        total={profile ? (which === "followers" ? profile.counts.followers : profile.counts.following) : null}
        status={locked ? "private" : list.isError && people.length === 0 ? "error" : list.isPending ? "loading" : "ready"}
        people={people.map((person) => ({ ...person, isReader: person.id === viewerId }))}
        hasMore={Boolean(list.hasNextPage)}
        loadingMore={list.isFetchingNextPage}
        onMore={() => void list.fetchNextPage()}
        onFollow={(id, follow) => void onFollow(id, follow)}
        onRetry={() => void list.refetch()}
      />
    </PageArrival>
  );
}

export const FollowersPage = () => <FollowListPage which="followers" />;
export const FollowingPage = () => <FollowListPage which="following" />;

export default FollowersPage;
