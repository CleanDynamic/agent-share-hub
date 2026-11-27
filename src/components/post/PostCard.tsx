/* UX-05 Part 1: the post card, used by every list of posts.

   Pure: typed props (`PostCardData` from postCardModel), no fetching, no `useAuth()`, no router hooks but `Link`. Its head and
   body values are FeedPost's, copied (FeedPost's head is not a component of its own): a 40px author column and the content 12
   apart, padding 20 0 16; the name 15/600 and `@handle · age` 14 `--label`; the heading at the card title size, 13/500. Only the heading and the replies strip are links to the post. */

import { useState, type CSSProperties, type ReactNode } from "react";

import { Avatar } from "@/components/brand/Avatar";
import { X_FEED, X_ROW_GAP, xGrid, xMeta, xName, type XSize } from "@/components/gallery/xFeed";
import { MobileIcon } from "@/components/brand/MobileIcon";
import { PhoneNameLink } from "@/components/phone/PhoneNameLink";
import { MoreSheet } from "@/components/shell/MoreSheet";
import { siteUrl } from "@/lib/site";
import type { GalleryMedia } from "@/lib/build";
import { MediaViewerProvider } from "@/components/post/media/MediaViewer";
import { PostMediaGrid } from "@/components/post/media/PostMediaGrid";
import { EngagementRow, TopicEngagementRow, type RowEngagement, type TopicEngagementRowProps } from "@/components/social/EngagementRow";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DashedSlot } from "@/components/vision/DashedSlot";
import { StepStripTiles, tileBox, type StripTileData } from "@/components/vision/StepStripTiles";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { radiusVar } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { PostControl } from "./postControls";
import { repliesWords, sessionsWords, type CardAttachment, type PostCardData } from "./postCardModel";

/** What a moderator can do to a post, from its `···` menu. */
export interface CardModeration {
  onPin: () => void;
  onUnpin: () => void;
  onHide: (reason: string) => void;
  onUnhide: () => void;
}

export interface PostCardProps {
  card: PostCardData;
  /** A list clamps the text to three lines; the post's own page does not. */
  clamp?: boolean;
  /** UX-06: the post's own page: the heading is the page's `h1`, 20/600, and not a link; the text is never clamped. */
  page?: boolean;
  /** G12: the heading's level in a feed: 3 under a section's h2 (the default), 2 where the feed sits right under the page's h1 (a profile). */
  headingLevel?: 2 | 3;
  /** UX-06: what each step of an attached build is drawn inside (the post page's step menu). */
  renderTile?: (tile: StripTileData, inner: ReactNode) => ReactNode;
  moderation?: CardModeration;
  engagement?: RowEngagement;
  /** UX-07: the topic's own Like, Reply and Save, drawn in the engagement row's place (Home, profiles). */
  topic?: TopicEngagementRowProps;
  /** UX-07 P4: the Library's compact card: the head, the heading and the first attachment, nothing else. */
  compact?: boolean;
  /** UX-07 P7: the reactions the topic's spaces switched on, a row under the engagement row. Absent: nothing. */
  reactions?: ReactNode;
  /** UX-09 P8: Report in the `···` menu, for everyone but the author. Absent: not offered. */
  onReport?: () => void;
  /** UX-09 Q4: "Message @maya" in the `···` menu: the reader's one direct thread with the author, the topic handed to it. */
  onMessage?: { label: string; onSelect: () => void };
  /** UX-15 P5: "Block @maya" in the `···` menu, for everyone but the author. Asks once (the page's BlockDialog). Absent: not offered. */
  onBlock?: { label: string; onSelect: () => void };
  /** Prompt 20: the phone's post. "home": text in Text, six lines. "list": a space's or the feed's topic, text in Text 2, six lines. Both: the item frame holds the padding, meta at 15, More is a content sheet, the actions are the phone feed's. Absent: desktop, unchanged. */
  phone?: "home" | "list";
  /** Prompt 29a: Home's topic at X's proportions: the post's grid and sizes, the lead line at the post text size in 600, the text in Text 2, Like, Reply and Save at X's places. */
  x?: XSize;
}

/** The phone's More: three dots at 18 in Text 3, a 32 hit area with the touch target reaching 44 round it. */
function PhoneMore({ onPress }: { onPress: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-label="More"
      data-testid="post-card-more"
      onClick={onPress}
      {...handlers}
      style={{ flex: "none", position: "relative", width: 32, height: 32, margin: "-6px -8px -6px 0", padding: 0, border: 0, borderRadius: 999, background: "transparent", color: t.label, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", ...ring(state.focusVisible) }}
    >
      <MobileIcon name="more" size={18} />
      <span aria-hidden="true" style={{ position: "absolute", inset: -6 }} />
    </button>
  );
}

const plain: CSSProperties = { fontFamily: FIGTREE, margin: 0 };

/** 29g: a post's text and its lead line on a phone, 17/22 (the desktop's stay 15/20). */
const PHONE_POST = { text: 17, line: 22 } as const;

/** The post's heading at FeedPost's card title size, 13/500 (a topic and a build sit side by side as equals): underlined at once under hover (a fine pointer only). */
function HeadingLink({ to, level = 3, size, children }: { to: string; level?: 2 | 3; size?: { text: number; line: number }; children: string }) {
  const Heading = level === 2 ? "h2" : "h3";
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link to={to} data-testid="post-card-heading-link" {...handlers} style={{ display: "inline-block", lineHeight: "24px", color: t.text, textDecoration: state.hovered ? "underline" : "none", textUnderlineOffset: 3, borderRadius: 4, ...ring(state.focusVisible) }}>
      <Heading style={{ ...plain, display: "inline", fontSize: size?.text ?? 15, fontWeight: 600, lineHeight: `${size?.line ?? 20}px` }}>{children}</Heading>
    </Link>
  );
}

/** A link inside the head: a space's name in `--text2`, underlined under hover. */
function SpaceLink({ to, children }: { to: string; children: string }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    /* G11: a link inside the card's meta line is underlined at rest: colour alone does not set it apart from the words round it. */
    <Link to={to} {...handlers} style={{ color: t.text2, textDecoration: "underline", textUnderlineOffset: 3, borderRadius: 4, ...ring(state.focusVisible) }}>
      {children}
    </Link>
  );
}

/** Synth 11: attached work as a Card: "Build" in Text 3, the name 15/600, the facts in 13 Text 3 joined by " · " (its sessions and steps), then the steps. */
function BuildAttachment({ attachment, onPickTile, renderTile }: { attachment: Extract<CardAttachment, { kind: "build" }>; onPickTile?: (id: string) => void; renderTile?: PostCardProps["renderTile"] }) {
  const facts = [attachment.sessions > 0 ? sessionsWords(attachment.sessions) : null, attachment.steps > 0 ? `${attachment.steps} ${attachment.steps === 1 ? "step" : "steps"}` : null].filter(Boolean).join(" · ");
  return (
    <div data-testid="post-card-build" style={{ background: t.module, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ ...plain, fontSize: 13, lineHeight: "16px", color: t.label }}>Build</div>
      <div style={{ ...plain, marginTop: 2, fontSize: 15, fontWeight: 600, lineHeight: "20px", overflowWrap: "anywhere" }}>{attachment.title}</div>
      {facts ? <div style={{ ...plain, fontSize: 13, lineHeight: "16px", color: t.label }}>{facts}</div> : null}
      <StepStripTiles tiles={attachment.tiles} openLabel="Still open" margin="8px 0 0" onPick={onPickTile} renderTile={renderTile} />
    </div>
  );
}

function StepAttachment({ attachment }: { attachment: Extract<CardAttachment, { kind: "step" }> }) {
  return (
    <div style={{ ...tileBox, padding: "12px 14px", borderRadius: 12, border: 0, background: t.module }}>
      <div style={{ ...plain, fontSize: 13, color: t.label }}>{attachment.head}</div>
      <div style={{ fontFamily: FIGTREE, fontSize: 13, lineHeight: "18px", whiteSpace: "pre-wrap", overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{attachment.text}</div>
    </div>
  );
}

/** One attachment as the card draws it. The New post window draws the same, with a way to mark a step of a build still open. */
/** A topic's pictures and videos, exactly as a build's posts draw them: the post media grid, opening full size in the viewer. Nothing here is drawn another way. */
export function PicturesBlock({ pictures }: { pictures: readonly Extract<CardAttachment, { kind: "picture" }>[] }) {
  const nodes = pictures.map((picture) => ({ type: "postMedia", attrs: { mediaId: picture.path, w: null, h: null, alt: "", crop: null, aspect: null, zoom: null, warn: [], width: 100, caption: "" } }));
  const mediaById = new Map(
    pictures.map((picture) => [picture.path, { id: picture.path, node_id: null, bucket: "build-media", path: picture.path, kind: picture.mediaKind, width: null, height: null, poster_path: null, duration: null, post_position: null, post_text: null } as unknown as GalleryMedia]),
  );
  const srcByPath = new Map(pictures.flatMap((picture) => (picture.src ? [[picture.path, picture.src] as const] : [])));
  return (
    <MediaViewerProvider>
      <PostMediaGrid pictures={nodes} mediaById={mediaById} srcByPath={srcByPath} />
    </MediaViewerProvider>
  );
}

export function AttachmentView({ attachment, onPickTile, renderTile }: { attachment: CardAttachment; onPickTile?: (id: string) => void; renderTile?: PostCardProps["renderTile"] }) {
  if (attachment.kind === "build") return <BuildAttachment attachment={attachment} onPickTile={onPickTile} renderTile={renderTile} />;
  if (attachment.kind === "step") return <StepAttachment attachment={attachment} />;
  if (attachment.kind === "picture") return <PicturesBlock pictures={[attachment]} />;
  if (attachment.kind === "line") {
    return (
      <div style={{ ...tileBox, padding: "12px 14px", borderRadius: 12, border: 0, background: t.module, ...plain, fontSize: 13 }}>{attachment.text}</div>
    );
  }
  return (
    <div style={{ ...tileBox, padding: "12px 14px", borderRadius: 12, border: 0, background: t.module, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span style={{ ...plain, fontSize: 13, overflowWrap: "anywhere" }}>{attachment.name}</span>
      {attachment.href ? (
        <PostControl to={attachment.href} download>
          Download
        </PostControl>
      ) : null}
    </div>
  );
}

/** The `···` menu: Pin and Hide for moderators (Hide asks for its reason in one field); UX-09 P8: Report for everyone but the author. */
function ModerationMenu({ card, moderation, onAsk, onReport, onMessage, onBlock }: { card: PostCardData; moderation?: CardModeration; onAsk: () => void; onReport?: () => void; onMessage?: PostCardProps["onMessage"]; onBlock?: PostCardProps["onBlock"] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <PostControl aria-label={moderation ? "Moderate this post" : "More for this topic"}>···</PostControl>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {moderation ? (
          <>
            {card.pinned ? <DropdownMenuItem onSelect={moderation.onUnpin}>Unpin</DropdownMenuItem> : <DropdownMenuItem onSelect={moderation.onPin}>Pin</DropdownMenuItem>}
            {card.hidden ? <DropdownMenuItem onSelect={moderation.onUnhide}>Unhide</DropdownMenuItem> : <DropdownMenuItem onSelect={onAsk}>Hide</DropdownMenuItem>}
          </>
        ) : null}
        {onMessage ? <DropdownMenuItem onSelect={onMessage.onSelect}>{onMessage.label}</DropdownMenuItem> : null}
        {onReport ? <DropdownMenuItem onSelect={onReport}>Report</DropdownMenuItem> : null}
        {onBlock ? <DropdownMenuItem onSelect={onBlock.onSelect}>{onBlock.label}</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HideReason({ onHide, onCancel }: { onHide: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onHide(reason.trim());
      }}
      style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}
    >
      <input
        aria-label="Reason for hiding"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Why is it hidden?"
        style={{ flex: "1 1 200px", minWidth: 0, height: 32, boxSizing: "border-box", padding: "0 10px", borderRadius: radiusVar("r-field"), border: 0, boxShadow: `inset 0 0 0 1px ${t.fieldEdge}`, background: t.surface, color: t.text, fontFamily: FIGTREE, fontSize: 15 }}
      />
      <PostControl type="submit">Hide</PostControl>
      <PostControl onClick={onCancel}>Cancel</PostControl>
    </form>
  );
}

export function PostCard({ card: full, clamp = true, page = false, headingLevel = 3, renderTile, moderation, engagement, topic, compact = false, reactions, onReport, onMessage, onBlock, phone, x }: PostCardProps) {
  const xm = x ? X_FEED[x] : null;
  // The compact card keeps the head, the heading and the first attachment (all of a topic's pictures are one attachment there).
  const card: PostCardData = compact
    ? { ...full, text: "", attachments: full.attachments.slice(0, 1), stillOpen: false, tags: [], closes: null, replies: null }
    : full;
  const [asking, setAsking] = useState(false);
  const [more, setMore] = useState(false);
  const label = t.label;
  const name = card.author.name;
  const meta = [card.author.handle ? `@${card.author.handle}` : null, card.age || null].filter(Boolean).join(" · ");

  // A hidden post, seen by a moderator: its heading greyed, the line, and Unhide.
  if (card.hidden) {
    return (
      <article aria-label={card.heading} style={{ padding: "4px 0", color: t.textDisabled }}>
        {headingLevel === 2 ? (
          <h2 style={{ ...plain, fontSize: 13, fontWeight: 500, lineHeight: 1.4, color: t.textDisabled }}>{card.heading}</h2>
        ) : (
          <h3 style={{ ...plain, fontSize: 13, fontWeight: 500, lineHeight: 1.4, color: t.textDisabled }}>{card.heading}</h3>
        )}
        <div style={{ ...plain, fontSize: 13, color: label, marginTop: 4 }}>{`Hidden by ${card.hidden.by} · only moderators see this`}</div>
        {card.hidden.reason ? <div style={{ ...plain, fontSize: 13, color: label }}>{card.hidden.reason}</div> : null}
        {moderation ? (
          <div style={{ marginTop: 8 }}>
            <PostControl onClick={moderation.onUnhide}>Unhide</PostControl>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <article
      aria-label={card.heading}
      data-x={x}
      style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", columnGap: 12, ...(x ? xGrid(x) : null), padding: phone || x ? 0 : "4px 0", boxSizing: "border-box", width: "100%", color: t.text, fontFamily: FIGTREE }}
    >
      <div style={{ gridColumn: 1, width: xm ? xm.avatar : 40 }}>
        <Avatar size={xm ? xm.avatar : 40} userId={card.author.id} name={name} src={card.author.avatarUrl} phone={Boolean(xm)} />
      </div>

      <div style={{ gridColumn: 2, minWidth: 0 }}>
        {/* Synth 11: a pinned card says so above the author line, 13 in Text 2. */}
        {card.pinned ? <div style={{ ...plain, fontSize: 13, lineHeight: "16px", color: t.text2, marginBottom: 4 }}>Pinned</div> : null}
        {/* Head: name, @handle · age · in spaces; the reward at the right end. */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, minHeight: xm ? xm.line : phone ? 22 : 24, marginBottom: x ? X_ROW_GAP : 4 }}>
          <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexWrap: phone || x ? "nowrap" : "wrap", alignItems: "baseline", columnGap: phone || x ? 4 : 6 }}>
            {phone ? (
              <PhoneNameLink handle={card.author.handle} style={x ? xName(x) : undefined}>{name}</PhoneNameLink>
            ) : (
              <span style={{ ...plain, fontSize: 15, fontWeight: 600, lineHeight: "20px", ...(x ? { ...xName(x), whiteSpace: "nowrap" } : null) }}>{name}</span>
            )}
            <span style={{ ...plain, fontSize: phone ? 15 : 13, lineHeight: phone ? "20px" : 1.4, color: label, whiteSpace: phone ? "nowrap" : "pre-wrap", ...(phone ? { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" } : null), ...(x ? { ...xMeta(x), whiteSpace: "nowrap", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" } : null) }}>
              {meta}
              {card.spaces.length > 0 ? " · in  " : ""}
              {card.spaces.map((space, index) => (
                <span key={space.slug}>
                  {index > 0 ? ", " : ""}
                  <SpaceLink to={`/openbuilds/spaces/${space.slug}`}>{space.name}</SpaceLink>
                </span>
              ))}
            </span>
          </div>
          {card.reward ? <span style={{ ...plain, flex: "none", fontSize: 13, fontWeight: 500 }}>{card.reward}</span> : null}
          {phone ? (
            <PhoneMore onPress={() => setMore(true)} />
          ) : moderation || onReport || onMessage || onBlock ? (
            <ModerationMenu card={card} moderation={moderation} onAsk={() => setAsking(true)} onReport={onReport} onMessage={onMessage} onBlock={onBlock} />
          ) : null}
        </div>
        {phone ? (
          <MoreSheet
            open={more}
            onOpenChange={setMore}
            link={siteUrl(card.to)}
            name={card.heading}
            items={[
              ...(moderation ? [card.pinned ? { label: "Unpin", onSelect: moderation.onUnpin } : { label: "Pin", onSelect: moderation.onPin }, card.hidden ? { label: "Unhide", onSelect: moderation.onUnhide } : { label: "Hide", onSelect: () => setAsking(true) }] : []),
              ...(onMessage ? [{ label: onMessage.label, onSelect: onMessage.onSelect }] : []),
              ...(onReport ? [{ label: "Report", onSelect: onReport, tone: "danger" as const }] : []),
              ...(onBlock ? [{ label: onBlock.label, onSelect: onBlock.onSelect, tone: "danger" as const }] : []),
            ]}
          />
        ) : null}
        {asking && moderation ? (
          <HideReason
            onHide={(reason) => {
              setAsking(false);
              moderation.onHide(reason);
            }}
            onCancel={() => setAsking(false)}
          />
        ) : null}

        {page ? (
          // 29g: on a phone the post's lead line is a reading page's title, 24/28 600 at -0.02em; the desktop keeps 20/24.
          <h1 style={{ ...plain, fontSize: phone ? 24 : 20, fontWeight: 600, lineHeight: phone ? "28px" : "24px", letterSpacing: phone ? "-0.02em" : "-0.01em", overflowWrap: "anywhere" }}>{card.heading || "Untitled post"}</h1>
        ) : (
          <HeadingLink to={card.to} level={headingLevel} size={xm ?? (phone ? PHONE_POST : undefined)}>
            {card.heading || "Untitled post"}
          </HeadingLink>
        )}

        {card.text ? (
          <p
            style={{
              ...plain,
              marginTop: x ? X_ROW_GAP : 4,
              fontSize: xm ? xm.text : phone ? PHONE_POST.text : 15,
              lineHeight: `${xm ? xm.line : phone ? PHONE_POST.line : 20}px`,
              color: x ? t.text2 : phone === "home" ? t.text : t.text2,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              ...(clamp && !page ? { display: "-webkit-box", WebkitLineClamp: phone ? 6 : 3, WebkitBoxOrient: "vertical", overflow: "hidden" } : null),
            }}
          >
            {card.text}
          </p>
        ) : null}

        {card.attachments.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {card.attachments.map((attachment, index) => {
              // All of a topic's pictures are one grid, where the first of them stands.
              if (attachment.kind === "picture") {
                const pictures = card.attachments.filter((entry): entry is Extract<CardAttachment, { kind: "picture" }> => entry.kind === "picture");
                return pictures[0] === attachment ? <PicturesBlock key={attachment.key} pictures={pictures} /> : null;
              }
              return <AttachmentView key={attachment.key} attachment={attachment} renderTile={renderTile} />;
            })}
          </div>
        ) : null}

        {card.stillOpen || card.tags.length > 0 || card.closes ? (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 12px", marginTop: 12 }}>
            {card.stillOpen ? (
              <DashedSlot style={{ height: 22, padding: "0 8px", display: "inline-flex", alignItems: "center", ...plain, fontSize: 13, color: t.text2 }}>Still open</DashedSlot>
            ) : null}
            {card.tags.length > 0 ? <span style={{ ...plain, fontSize: 13, color: label }}>{card.tags.map((tag) => `#${tag}`).join(" ")}</span> : null}
            {card.closes ? <span style={{ ...plain, fontSize: 13, color: label }}>{card.closes}</span> : null}
          </div>
        ) : null}

        {card.replies ? <RepliesStrip replies={card.replies} /> : null}

        {topic && !compact ? <TopicEngagementRow {...topic} phoneFeed={Boolean(phone) && !x} x={x} style={x ? topic.style : phone ? { marginTop: 0, ...topic.style } : { marginTop: 12, maxWidth: 425, justifyContent: "space-between", ...topic.style }} /> : null}
        {!topic && !compact && engagement && card.engagementBuild ? <EngagementRow variant="card" build={card.engagementBuild} counts={engagement.counts} liked={engagement.liked} saved={engagement.saved} phoneFeed={Boolean(phone)} style={phone ? undefined : { marginTop: 12, maxWidth: 425, justifyContent: "space-between" }} /> : null}
        {!compact && reactions ? reactions : null}
      </div>
    </article>
  );
}

/** Lists only, hidden at zero replies: one link to the post. */
function RepliesStrip({ replies }: { replies: NonNullable<PostCardData["replies"]> }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={replies.to}
      data-testid="post-card-replies-strip"
      {...handlers}
      style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, minWidth: 0, boxSizing: "border-box", padding: "8px 12px", background: state.hovered ? t.control : t.module, borderRadius: 12, color: t.text, textDecoration: "none", ...ring(state.focusVisible) }}
    >
      {replies.people.length > 0 ? (
        <span aria-hidden="true" style={{ display: "inline-flex", flexShrink: 0 }}>
          {replies.people.map((person, index) => (
            <Avatar key={person.id} size={20} userId={person.id} name={person.name} src={person.avatarUrl} style={{ marginLeft: index === 0 ? 0 : -6, boxShadow: `0 0 0 1px ${t.module}` }} />
          ))}
        </span>
      ) : null}
      <span style={{ ...plain, fontSize: 13, lineHeight: "20px", minWidth: 0 }}>
        <span style={{ fontWeight: 500 }}>{repliesWords(replies.count)}</span>
        {replies.detail ? <span style={{ color: t.text2, whiteSpace: "pre-wrap" }}>{`  · ${replies.detail} `}</span> : null}
      </span>
    </Link>
  );
}
