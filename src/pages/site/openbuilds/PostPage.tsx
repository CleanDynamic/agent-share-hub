/* UX-06: /openbuilds/topics/:id, the container. (UX-05 made that the post's address; /openbuilds/posts/:id redirects to it.)

   Round 1 is `getPost` (the route table's prefetch, the same key and function). Round 2, which needs the post's ids, is
   `readPostExtras`: the work and pictures its replies name, the Wall's build facts, the reader's likes and the space. A branch
   opened from `View 3 more replies` (`?reply=<id>`) is one more `getPost`, of that reply.

   WHERE THE READER IS lives in the address: `?view=wall`, `?step=<node id>`, `?reply=<id>`, `?lineup=1`. Changing them is the same
   page with new parameters: what is drawn stays until the new arrives, and nothing fades.

   Likes, pins and hides change the page at once and ask the database after; a refusal puts the page back and says so. */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { SeoHead } from "@/components/SeoHead";
import { centre } from "@/components/build/partNav";
import { PageArrival } from "@/components/shell/PageArrival";
import { PostControl } from "@/components/post/postControls";
import { splitBody, toCardData } from "@/components/post/postCardModel";
import type { StripTileData } from "@/components/vision/StepStripTiles";
import { useMinWidth } from "@/components/shell/useMinWidth";
import { useAuth } from "@/contexts/AuthContext";
import { engagementFor, useEngagement } from "@/hooks/useEngagement";
import { reportError } from "@/lib/errors/report";
import { getPost, hidePost, joinSpace, leaveSpace, likePost, pinPost, unlikePost, unpinPost, type PostThread } from "@/lib/openbuilds";
import type { StepToCopy } from "@/lib/openbuilds/addToDraft";
import { readPostExtras, type PostPageExtras } from "@/lib/openbuilds/postPage";
import { usePageReady } from "@/lib/routing/pageReady";

import { AddToDraftButton, AddToDraftSub } from "./AddToDraft";
import { EmptyLine, LoadError } from "./OpenBuildsFeedParts";
import { PostLoadingView } from "./PostFrame";
import { PostStepMenu } from "./PostStepMenu";
import { ReplyBox } from "./ReplyBox";
import type { ReplyDraft } from "./sendReply";
import { PostView, type PostSideRow } from "./PostView";
import { PostWall } from "./PostWall";
import { LineUpTable, LineUpToggle } from "./LineUpSteps";
import {
  buildReplies,
  peopleReplying,
  postBuildOf,
  postExtrasKey,
  postPageKey,
  postSearch,
  readPostAddress,
  repliesByStep,
  replyDraftTitle,
  lineUpOf,
  lineUpOffered,
  rebuildsInReplies,
  wallCards,
  replyItem,
  threadItems,
  type PostTab,
  type ReplyItem,
  type ThreadContext,
} from "./postModel";

const EMPTY_EXTRAS: PostPageExtras = { work: { builds: new Map(), nodes: new Map() }, signed: new Map(), facts: new Map(), steps: new Map(), liked: new Set(), crowd: null };

/** A post in the thread with this change, at whatever depth it is. */
function patchThread(thread: PostThread, id: string, change: (post: PostThread) => PostThread): PostThread {
  if (thread.id === id) return change(thread);
  return { ...thread, replies: thread.replies.map((reply) => patchThread(reply, id, change)) };
}

/** The replies the Thread draws, at both levels. */
const drawnIds = (items: readonly ReplyItem[]): string[] => items.flatMap((item) => [item.id, ...drawnIds(item.children)]);

/** Replies a moderator hid are kept out of the Thread. */
const withoutHidden = (thread: PostThread): PostThread => ({ ...thread, replies: thread.replies.filter((reply) => reply.hiddenBy === null).map(withoutHidden) });

export default function PostPage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const viewerId = user?.id ?? null;
  const now = Date.now();

  /* ── round 1, then round 2 ── */

  const post = useQuery({ queryKey: postPageKey(id), queryFn: () => getPost(id), enabled: id.length > 0 });
  const thread = post.data ?? null;
  const extras = useQuery({ queryKey: postExtrasKey(id, viewerId), queryFn: () => readPostExtras(thread!, viewerId), enabled: thread !== null && !authLoading, placeholderData: keepPreviousData });
  const data = extras.data ?? EMPTY_EXTRAS;
  const crowd = data.crowd;
  const defaultView: PostTab = crowd?.space.defaultView === "wall" ? "wall" : "thread";
  const address = readPostAddress(params, defaultView);
  const branch = useQuery({ queryKey: postPageKey(address.reply ?? ""), queryFn: () => getPost(address.reply!), enabled: address.reply !== null, placeholderData: keepPreviousData });

  const arriving = post.isPending || (thread !== null && extras.isPending);
  useEffect(() => {
    if (post.error) reportError(post.error, { source: "openbuilds", context: "post" });
    if (extras.error) reportError(extras.error, { source: "openbuilds", context: "post-extras" });
  }, [post.error, extras.error]);
  usePageReady("post", !arriving && thread !== null);

  /* UX-07 P5: `#reply-<id>` (a notification, a reply group on Home, a profile) brings that reply to the middle on arrival, once,
     with the page's own scroll helper, as `#node-<id>` does on a build page. */
  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (arriving || !hash.startsWith("reply-") || scrolledTo.current === hash) return;
    const element = document.getElementById(hash);
    if (!element) return;
    scrolledTo.current = hash;
    centre(element);
  });

  /* ── the one reply box: at the foot, or under the reply it answers; about a step or not ── */

  const [replyAt, setReplyAt] = useState<"foot" | string>("foot");
  const [about, setAbout] = useState<ReplyDraft["about"]>(null);
  // Part 5: the Wall's Reply with a build opens a box of its own at the Wall's foot (the Thread is not drawn meanwhile).
  const [wallBox, setWallBox] = useState(false);
  // Part 6: Line up steps is drawn only 760 wide and up.
  const wide = useMinWidth(760);

  const signInTo = `/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`;
  const signIn = () => navigate(signInTo);
  const move = (change: Parameters<typeof postSearch>[1]) => setParams(postSearch(params, change, defaultView), { replace: true });

  /* ── changes shown at once ── */

  const patch = (postId: string, change: (entry: PostThread) => PostThread) => {
    const before = qc.getQueryData<PostThread | null>(postPageKey(id));
    if (before) qc.setQueryData(postPageKey(id), patchThread(before, postId, change));
    return () => qc.setQueryData(postPageKey(id), before);
  };
  const refused = (error: unknown, context: string, words: string) => {
    reportError(error, { source: "openbuilds", context });
    toast.error(error instanceof Error && error.message ? error.message : words);
  };

  const like = async (postId: string, on: boolean) => {
    if (!viewerId) return signIn();
    const key = postExtrasKey(id, viewerId);
    const was = qc.getQueryData<PostPageExtras>(key);
    const undo = patch(postId, (entry) => ({ ...entry, likeCount: Math.max(0, entry.likeCount + (on ? 1 : -1)) }));
    if (was) {
      const liked = new Set(was.liked);
      if (on) liked.add(postId);
      else liked.delete(postId);
      qc.setQueryData(key, { ...was, liked });
    }
    try {
      await (on ? likePost(postId) : unlikePost(postId));
    } catch (error) {
      undo();
      if (was) qc.setQueryData(key, was);
      refused(error, "likePost", "That didn't save. Try again.");
    }
  };

  const moderate = async (postId: string, change: (entry: PostThread) => PostThread, write: () => Promise<void>) => {
    const undo = patch(postId, change);
    try {
      await write();
    } catch (error) {
      undo();
      refused(error, "moderateReply", "That didn't save. Try again.");
    }
  };

  const join = async (on: boolean) => {
    if (!viewerId) return signIn();
    if (!crowd) return;
    try {
      await (on ? joinSpace(crowd.space.id) : leaveSpace(crowd.space.id));
      void qc.invalidateQueries({ queryKey: postExtrasKey(id, viewerId) });
    } catch (error) {
      refused(error, "joinSpace", "Couldn't join. Try again.");
    }
  };

  const shown = thread ? withoutHidden(thread) : null;
  const card = shown ? toCardData(shown, { work: data.work, signed: data.signed, digests: new Map(), now, hrefOf: () => location.pathname, strip: false }) : null;
  const engagement = useEngagement(card?.engagementBuild ? [card.engagementBuild.id] : []);

  /* ── states ── */

  if (post.isError) {
    return <LoadError what="This post didn't load." onRetry={() => void post.refetch()} />;
  }
  if (!post.isPending && (thread === null || (thread.hiddenBy !== null && crowd?.role !== "moderator" && !extras.isPending))) {
    return (
      <EmptyLine line="This post isn't available.">
        <PostControl to="/openbuilds">Back to OpenBuilds</PostControl>
      </EmptyLine>
    );
  }

  /* ── the view's props ── */

  const postBuild = shown ? postBuildOf(shown, data.work) : { buildId: null, steps: [] };
  const stepLabels = new Map(postBuild.steps.map((step) => [step.id, step.label]));
  const handles = new Map((crowd?.moderators ?? []).map((person) => [person.id, person.handle]));
  const moderator = crowd?.role === "moderator";
  const context: ThreadContext = {
    work: data.work,
    signed: data.signed,
    liked: data.liked,
    now,
    stepLabels,
    handleOf: (userId) => handles.get(userId) ?? (thread && userId === thread.authorId ? thread.author?.handle ?? null : null),
    canPin: viewerId !== null && (moderator || thread?.authorId === viewerId),
    canHide: viewerId !== null && moderator,
  };
  const byStep = shown ? repliesByStep(shown) : new Map<string, number>();
  let items = shown ? threadItems(shown, context, address.step) : [];
  let filter: { label: string; onShowAll: () => void } | null = address.step ? { label: `Replies on ${stepLabels.get(address.step) ?? "this step"}`, onShowAll: () => move({ step: null }) } : null;
  if (address.reply && branch.data) {
    const root = withoutHidden(branch.data);
    items = [replyItem(root, 0, context)];
    filter = { label: `Replies to ${root.author?.handle ? `@${root.author.handle}` : "this reply"}`, onShowAll: () => move({ reply: null }) };
  }

  const builds = shown ? buildReplies(shown).length : 0;
  const sideRows: PostSideRow[] = shown
    ? [
        { label: "People replying", value: peopleReplying(shown) },
        ...(builds > 0 ? [{ label: "Builds in replies", value: builds, to: `?${postSearch(params, { tab: "wall" }, defaultView).toString()}` }] : []),
        ...postBuild.steps.flatMap((step) => (byStep.get(step.id) ? [{ label: `Replies on Step ${step.number}`, value: byStep.get(step.id) ?? 0 }] : [])),
      ]
    : [];

  // A step of the post's build, to copy: read again from a published build, or taken from the copy a draft's build carries.
  const copiedBuild = shown?.attachments.find((attachment) => attachment.kind === "build" && attachment.snapshot)?.snapshot ?? null;
  const stepToCopy = (nodeId: string): StepToCopy | null => {
    if (postBuild.buildId) return { kind: "published", buildId: postBuild.buildId, nodeId };
    const children = Array.isArray(copiedBuild?.children) ? (copiedBuild.children as { id: string }[]) : [];
    const child = children.find((entry) => entry.id === nodeId);
    return child ? { kind: "copy", snapshot: { ...child, source: { ...((copiedBuild?.source as Record<string, unknown> | undefined) ?? {}), nodeId } } } : null;
  };

  const renderTile = (tile: StripTileData, inner: ReactNode) => (
    <PostStepMenu
      tile={tile}
      inner={inner}
      replies={byStep.get(tile.id) ?? 0}
      onReplyOn={() => {
        setAbout({ buildId: postBuild.buildId, nodeId: tile.id, label: stepLabels.get(tile.id) ?? `${tile.number} · ${tile.kind}` });
        setReplyAt("foot");
        move({ tab: "thread" });
      }}
      onShowReplies={() => move({ step: tile.id, reply: null })}
      addToDraft={stepToCopy(tile.id) ? <AddToDraftSub step={stepToCopy(tile.id)!} /> : null}
    />
  );

  // Part 6: offered only with two or more rebuilds of the post's build in replies, and only wide enough to read.
  const lineUpShown = wide && shown !== null && lineUpOffered(rebuildsInReplies(shown, postBuild.buildId, data.facts).length);

  const heading = shown ? splitBody(shown.body).heading : "";
  // The box stands where it was asked for; under a reply that is no longer drawn, it goes back to the foot.
  const at = replyAt !== "foot" && drawnIds(items).includes(replyAt) ? replyAt : "foot";
  const replyBox = shown
    ? {
        at,
        node: (
          <ReplyBox
            key={at}
            pageId={id}
            rootId={shown.rootId}
            parentId={at === "foot" ? shown.id : at}
            about={at === "foot" ? about : null}
            onRemoveAbout={() => setAbout(null)}
            signInTo={signInTo}
            draftTitle={replyDraftTitle(shown)}
            onSent={() => {
              setReplyAt("foot");
              setAbout(null);
            }}
          />
        ),
      }
    : undefined;
  const space = crowd
    ? {
        name: crowd.space.name,
        to: `/openbuilds/spaces/${crowd.space.slug}`,
        meta: [crowd.creator.handle ? `Made by @${crowd.creator.handle}` : null, `${crowd.members} ${crowd.members === 1 ? "member" : "members"}`].filter(Boolean).join(" · "),
        description: crowd.space.description,
        joined: crowd.role !== "none" ? true : crowd.space.whoCanPost === "invite" ? null : false,
        onJoin: () => void join(true),
        onLeave: () => void join(false),
      }
    : null;

  return (
    <>
      <SeoHead title={`${heading || "Post"} · OpenBuilds`} description={shown ? splitBody(shown.body).text.slice(0, 160) || heading : "A post on OpenBuilds."} path={`/openbuilds/topics/${id}`} />
      <PageArrival loading={arriving} placeholder={<PostLoadingView />}>
        {arriving || !shown || !card ? (
          <PostLoadingView />
        ) : (
          <PostView
            crumbs={[{ label: "OpenBuilds", to: "/openbuilds" }, ...(crowd ? [{ label: crowd.space.name, to: `/openbuilds/spaces/${crowd.space.slug}` }] : [])]}
            card={card}
            engagement={card.engagementBuild ? engagementFor(engagement, card.engagementBuild.id) : undefined}
            renderTile={renderTile}
            tab={address.tab}
            onTab={(tab) => move({ tab })}
            replies={shown.replyCount}
            builds={builds}
            thread={{ items, filter }}
            replyBox={replyBox}
            wallRow={lineUpShown ? <LineUpToggle on={address.lineUp} onChange={(on) => move({ lineUp: on })} /> : undefined}
            wall={
              <PostWall
                lineUp={lineUpShown && address.lineUp ? <LineUpTable lineUp={lineUpOf(shown, postBuild.buildId, data)} /> : undefined}
                cards={wallCards(shown, data, now)}
                onReply={(replyId) => {
                  setReplyAt(replyId);
                  setAbout(null);
                  move({ tab: "thread" });
                }}
                onReplyWithBuild={() => (viewerId ? setWallBox(true) : signIn())}
                box={
                  wallBox ? (
                    <ReplyBox pageId={id} rootId={shown.rootId} parentId={shown.id} about={null} onRemoveAbout={() => undefined} signInTo={signInTo} draftTitle={replyDraftTitle(shown)} pick="build" onSent={() => setWallBox(false)} />
                  ) : undefined
                }
              />
            }
            actions={{
              onReply: (replyId) => {
                setReplyAt(replyId);
                setAbout(null);
              },
              onLike: (replyId, on) => void like(replyId, on),
              onPin: (replyId) => void moderate(replyId, (entry) => ({ ...entry, pinnedBy: viewerId, pinnedAt: new Date().toISOString() }), () => pinPost(replyId)),
              onUnpin: (replyId) => void moderate(replyId, (entry) => ({ ...entry, pinnedBy: null, pinnedAt: null }), () => unpinPost(replyId)),
              onHide: (replyId, reason) => void moderate(replyId, (entry) => ({ ...entry, hiddenBy: viewerId, hiddenReason: reason || null }), () => hidePost(replyId, reason || undefined)),
              renderAddToDraft: (step) => <AddToDraftButton step={step} />,
              branchHref: (replyId) => `?${postSearch(params, { reply: replyId, step: null }, defaultView).toString()}`,
            }}
            side={{ space, rows: sideRows }}
          />
        )}
      </PageArrival>
    </>
  );
}
