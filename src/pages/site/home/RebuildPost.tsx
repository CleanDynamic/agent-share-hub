/* Prompt 29a Part A: a rebuild in Home's feed at X's proportions, one component for the phone (below 768px) and desktop (the 600
   centre column). The rebuilder's author row, their note at the post text size, then "Rebuilt from" as a Card: the label in 13
   Text 3, a row with the source's 20 avatar and its maker, the source's name in Geist Serif at the post text size. Then the build
   line and the actions at X's places. No "rebuilt" line above the author row: the Card already says it.

   The feed row carries the source's title and its maker's handle at the time of the fork, and nothing more, so the Card shows
   those: no age and no picture of the source (this prompt changes no data reads). The item frame holds the padding. */

import { useMemo, type CSSProperties, type ReactNode } from "react";

import { Avatar } from "@/components/brand/Avatar";
import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import { MoreButton } from "@/components/gallery/FeedPost";
import { useThreadRest } from "@/components/gallery/useThreadRest";
import { X_FEED, X_ROW_GAP, xConnector, xGrid, xMeta, xName, type XSize } from "@/components/gallery/xFeed";
import { PhoneNameLink } from "@/components/phone/PhoneNameLink";
import { PostThread } from "@/components/post/PostThread";
import { EngagementRow } from "@/components/social/EngagementRow";
import { splitThread, threadOf, type GalleryMedia } from "@/lib/build";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, SENTIENT } from "@/lib/theme/type";

import { atHandle, shortAgo, type HomeRebuildPost } from "./homeModel";
import { useNear } from "./useNear";

const ellipsis: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 };
const meta13: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label };

function PlainLink({ to, style, children }: { to: string; style?: CSSProperties; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link to={to} {...handlers} style={{ color: t.text, textDecoration: "none", borderRadius: 4, ...ring(state.focusVisible), ...style }}>
      {children}
    </Link>
  );
}

export function RebuildPost({ item, srcByPath, now, size, onNear, onMore }: { item: HomeRebuildPost; srcByPath: MediaSrcMap; now: number; size: XSize; onNear?: (ids: string[]) => void; onMore?: () => void }) {
  const ref = useNear<HTMLElement>(item.build.id, onNear);
  const m = X_FEED[size];
  const phone = size === "phone";
  const source = atHandle(item.source.handle);
  const line = [atHandle(item.maker.handle), shortAgo(item.at, now)].filter(Boolean).join(" · ");

  /* The rebuild's own thread, when its write-up has more than one post. The note and the Card are its first post's place, so
     the thread opens with the posts after it. */
  const doc = useMemo(() => threadOf(item.build, item.build.media), [item.build]);
  const posts = useMemo(() => (doc ? splitThread(doc) : []), [doc]);
  const threaded = posts.length > 1;
  const { phase, rest, restState, open, close, warm, retry } = useThreadRest({ buildId: item.build.id, enabled: threaded });
  const mediaById = useMemo(() => {
    const map = new Map<string, GalleryMedia>(item.build.media.map((row) => [row.id, row]));
    for (const row of rest?.rows ?? []) map.set(row.id, row);
    return map;
  }, [item.build.media, rest]);
  const srcAll = useMemo<MediaSrcMap>(() => (rest && rest.src.size > 0 ? new Map([...srcByPath, ...rest.src]) : srcByPath), [srcByPath, rest]);

  const textStyle: CSSProperties = { fontFamily: FIGTREE, fontSize: m.text, lineHeight: `${m.line}px`, color: t.text };
  const start = (
    <>
      {item.note ? <p style={{ ...textStyle, margin: 0, overflowWrap: "anywhere" }}>{item.note}</p> : null}
      <div data-testid="rebuilt-from" style={{ marginTop: item.note ? m.gap : 0, padding: m.rebuildPad, background: t.module, borderRadius: m.rebuildRadius }}>
        <span style={{ display: "block", ...meta13 }}>Rebuilt from</span>
        {source ? (
          <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, minWidth: 0 }}>
            <Avatar size={20} userId={item.source.handle ?? item.source.title} name={item.source.handle ?? item.source.title} style={{ borderRadius: 5 }} />
            <span style={{ fontFamily: FIGTREE, fontSize: phone ? 15 : 13, fontWeight: 700, lineHeight: phone ? "20px" : "16px", color: t.text, ...ellipsis }}>{source}</span>
          </span>
        ) : null}
        <span style={{ display: "block", marginTop: 4, fontFamily: SENTIENT, fontWeight: 400, fontSize: m.text, lineHeight: `${m.line}px`, color: t.text, ...ellipsis }}>{item.source.title}</span>
      </div>
    </>
  );

  return (
    <article ref={ref} aria-label={item.build.title} data-x={size} style={xGrid(size)}>
      <Avatar size={m.avatar} userId={item.maker.id} name={item.maker.name} hue={item.maker.hue} src={item.maker.avatarUrl} phone={size === "phone"} />
      <div style={{ minWidth: 0 }}>
        <div data-feed-author-row="" style={{ display: "flex", alignItems: "center", gap: 4, minHeight: m.line, marginBottom: X_ROW_GAP, whiteSpace: "nowrap", minWidth: 0 }}>
          {phone ? (
            <PhoneNameLink handle={item.maker.handle} style={xName(size)}>
              {item.maker.name}
            </PhoneNameLink>
          ) : (
            <span style={{ fontFamily: FIGTREE, ...xName(size), color: t.text, flex: "0 1 auto", maxWidth: "70%", ...ellipsis }}>{item.maker.name}</span>
          )}
          <span style={{ fontFamily: FIGTREE, ...xMeta(size), color: t.label, ...ellipsis }}>{line}</span>
          {onMore ? <span style={{ flex: 1 }} /> : null}
          {onMore ? <MoreButton onPress={onMore} box={m.moreBox} hit={m.moreHit} /> : null}
        </div>
        {threaded ? (
          <PostThread
            phone={phone}
            x={size}
            posts={posts}
            first={start}
            mediaById={mediaById}
            srcByPath={srcAll}
            mode={phase === "open" ? "open" : "closed"}
            onOpen={open}
            onClose={close}
            onIntent={warm}
            rest={restState}
            onRetry={retry}
            connector={xConnector(size)}
            resetKey={item.build.id}
          />
        ) : (
          start
        )}
        <div style={{ marginTop: m.gap }}>
          <PlainLink to={`/b2/${item.build.slug}`} style={{ fontFamily: FIGTREE, fontSize: 13, fontWeight: 500, lineHeight: "16px" }}>
            {item.build.title}
          </PlainLink>
        </div>
        {item.engagement ? (
          <EngagementRow
            x={size}
            variant="card"
            withRebuild
            build={{ id: item.build.id, slug: item.build.slug, title: item.build.title, rebuild_count: item.build.rebuild_count }}
            counts={item.engagement.counts}
            liked={item.engagement.liked}
            saved={item.engagement.saved}
          />
        ) : null}
      </div>
    </article>
  );
}

export default RebuildPost;
