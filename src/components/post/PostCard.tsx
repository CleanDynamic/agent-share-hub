/* UX-05 Part 1: the post card, used by every list of posts.

   Pure: typed props (`PostCardData` from postCardModel), no fetching, no `useAuth()`, no router hooks but `Link`. Its head and
   body values are FeedPost's, copied (FeedPost's head is not a component of its own): a 40px author column and the content 12
   apart, padding 20 0 16; the name 15/600 and `@handle · age` 14 `--label`; the heading at the card title size, 13/500. Only the heading and the replies strip are links to the post. */

import { useState, type CSSProperties, type ReactNode } from "react";

import { Avatar } from "@/components/brand/Avatar";
import type { GalleryMedia } from "@/lib/build";
import { MediaViewerProvider } from "@/components/post/media/MediaViewer";
import { PostMediaGrid } from "@/components/post/media/PostMediaGrid";
import { Plaque } from "@/components/brand/Plaque";
import { EngagementRow, TopicEngagementRow, type RowEngagement, type TopicEngagementRowProps } from "@/components/social/EngagementRow";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DashedSlot } from "@/components/vision/DashedSlot";
import { StepStripTiles, tileBox, type StripTileData } from "@/components/vision/StepStripTiles";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { radiusVar } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { PostControl } from "./postControls";
import { repliesWords, type CardAttachment, type PostCardData } from "./postCardModel";

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
  /** UX-06: the post's own page: the heading is the page's `h1`, 20/500, and not a link; the text is never clamped. */
  page?: boolean;
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
}

const plain: CSSProperties = { fontFamily: FIGTREE, margin: 0 };

/** The post's heading at FeedPost's card title size, 13/500 (a topic and a build sit side by side as equals): underlined at once under hover (a fine pointer only). */
function HeadingLink({ to, children }: { to: string; children: string }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link to={to} data-testid="post-card-heading-link" {...handlers} style={{ color: t.text, textDecoration: state.hovered ? "underline" : "none", textUnderlineOffset: 3, borderRadius: 4, ...ring(state.focusVisible) }}>
      <h3 style={{ ...plain, display: "inline", fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{children}</h3>
    </Link>
  );
}

/** A link inside the head: a space's name in `--text2`, underlined under hover. */
function SpaceLink({ to, children }: { to: string; children: string }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link to={to} {...handlers} style={{ color: t.text2, textDecoration: state.hovered ? "underline" : "none", textUnderlineOffset: 3, borderRadius: 4, ...ring(state.focusVisible) }}>
      {children}
    </Link>
  );
}

function BuildAttachment({ attachment, onPickTile, renderTile }: { attachment: Extract<CardAttachment, { kind: "build" }>; onPickTile?: (id: string) => void; renderTile?: PostCardProps["renderTile"] }) {
  return (
    <div>
      <div style={{ background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: radiusVar("r-card"), padding: 16, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...plain, fontSize: 13, fontWeight: 500, overflowWrap: "anywhere" }}>{attachment.title}</div>
          <div style={{ ...plain, fontSize: 12, color: t.label }}>{[attachment.harness ?? "Harness", attachment.steps > 0 ? `${attachment.steps} ${attachment.steps === 1 ? "step" : "steps"}` : null].filter(Boolean).join(" · ")}</div>
        </div>
        {attachment.plaque ? <Plaque build={attachment.plaque} size="row" /> : null}
      </div>
      <StepStripTiles tiles={attachment.tiles} openLabel="Still open" margin="8px 0 0" onPick={onPickTile} renderTile={renderTile} />
    </div>
  );
}

function StepAttachment({ attachment }: { attachment: Extract<CardAttachment, { kind: "step" }> }) {
  return (
    <div style={{ ...tileBox, padding: "8px 10px" }}>
      <div style={{ ...plain, fontSize: 11.5, color: t.label }}>{attachment.head}</div>
      <div style={{ fontFamily: DM_MONO, fontSize: 12, lineHeight: "18px", whiteSpace: "pre-wrap", overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{attachment.text}</div>
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
      <div style={{ ...tileBox, padding: "8px 10px", ...plain, fontSize: 12.5 }}>{attachment.text}</div>
    );
  }
  return (
    <div style={{ ...tileBox, padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span style={{ ...plain, fontSize: 12.5, overflowWrap: "anywhere" }}>{attachment.name}</span>
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
        style={{ flex: "1 1 200px", minWidth: 0, height: 32, boxSizing: "border-box", padding: "0 10px", borderRadius: radiusVar("r-control"), border: `1px solid ${t.controlBorder}`, background: t.well, color: t.text, fontFamily: FIGTREE, fontSize: 16 }}
      />
      <PostControl type="submit">Hide</PostControl>
      <PostControl onClick={onCancel}>Cancel</PostControl>
    </form>
  );
}

export function PostCard({ card: full, clamp = true, page = false, renderTile, moderation, engagement, topic, compact = false, reactions, onReport, onMessage, onBlock }: PostCardProps) {
  // The compact card keeps the head, the heading and the first attachment (all of a topic's pictures are one attachment there).
  const card: PostCardData = compact
    ? { ...full, text: "", attachments: full.attachments.slice(0, 1), stillOpen: false, tags: [], closes: null, replies: null }
    : full;
  const [asking, setAsking] = useState(false);
  const label = t.label;
  const name = card.author.name;
  const meta = [card.author.handle ? `@${card.author.handle}` : null, card.age || null].filter(Boolean).join(" · ");

  // A hidden post, seen by a moderator: its heading greyed, the line, and Unhide.
  if (card.hidden) {
    return (
      <article aria-label={card.heading} style={{ padding: "20px 0 16px", color: t.textDisabled }}>
        <h3 style={{ ...plain, fontSize: 13, fontWeight: 500, lineHeight: 1.4, color: t.textDisabled }}>{card.heading}</h3>
        <div style={{ ...plain, fontSize: 12, color: label, marginTop: 4 }}>{`Hidden by ${card.hidden.by} · only moderators see this`}</div>
        {card.hidden.reason ? <div style={{ ...plain, fontSize: 12, color: label }}>{card.hidden.reason}</div> : null}
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
      style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", columnGap: 12, padding: "20px 0 16px", boxSizing: "border-box", width: "100%", color: t.text, fontFamily: FIGTREE }}
    >
      <div style={{ gridColumn: 1, width: 40 }}>
        <Avatar size={40} userId={card.author.id} name={name} src={card.author.avatarUrl} />
      </div>

      <div style={{ gridColumn: 2, minWidth: 0 }}>
        {/* Head: name, @handle · age · in spaces; the reward and Pinned at the right end. */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, minHeight: 24, marginBottom: 4 }}>
          <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 6 }}>
            <span style={{ ...plain, fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>{name}</span>
            <span style={{ ...plain, fontSize: 14, lineHeight: 1.4, color: label, whiteSpace: "pre-wrap" }}>
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
          {card.pinned ? <span style={{ ...plain, flex: "none", fontSize: 12, color: label }}>Pinned</span> : null}
          {card.reward ? <span style={{ ...plain, flex: "none", fontSize: 13, fontWeight: 500 }}>{card.reward}</span> : null}
          {moderation || onReport || onMessage || onBlock ? <ModerationMenu card={card} moderation={moderation} onAsk={() => setAsking(true)} onReport={onReport} onMessage={onMessage} onBlock={onBlock} /> : null}
        </div>
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
          <h1 style={{ ...plain, fontSize: 20, fontWeight: 500, lineHeight: 1.3, letterSpacing: "-0.015em", overflowWrap: "anywhere" }}>{card.heading || "Untitled post"}</h1>
        ) : (
          <HeadingLink to={card.to}>{card.heading || "Untitled post"}</HeadingLink>
        )}

        {card.text ? (
          <p
            style={{
              ...plain,
              marginTop: 8,
              fontSize: 13,
              lineHeight: "20px",
              color: t.text2,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              ...(clamp && !page ? { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } : null),
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
              <DashedSlot style={{ height: 22, padding: "0 8px", display: "inline-flex", alignItems: "center", ...plain, fontSize: 12, color: t.text2 }}>Still open</DashedSlot>
            ) : null}
            {card.tags.length > 0 ? <span style={{ ...plain, fontSize: 12, color: label }}>{card.tags.map((tag) => `#${tag}`).join(" ")}</span> : null}
            {card.closes ? <span style={{ ...plain, fontSize: 12, color: label }}>{card.closes}</span> : null}
          </div>
        ) : null}

        {card.replies ? <RepliesStrip replies={card.replies} /> : null}

        {topic && !compact ? <TopicEngagementRow {...topic} style={{ marginTop: 12, maxWidth: 520, justifyContent: "space-between", ...topic.style }} /> : null}
        {!topic && !compact && engagement && card.engagementBuild ? <EngagementRow variant="card" build={card.engagementBuild} counts={engagement.counts} liked={engagement.liked} saved={engagement.saved} style={{ marginTop: 12, maxWidth: 520, justifyContent: "space-between" }} /> : null}
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
      style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, minWidth: 0, boxSizing: "border-box", padding: "8px 12px", background: state.hovered ? t.controlOn : t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: radiusVar("r-card"), color: t.text, textDecoration: "none", ...ring(state.focusVisible) }}
    >
      {replies.people.length > 0 ? (
        <span aria-hidden="true" style={{ display: "inline-flex", flexShrink: 0 }}>
          {replies.people.map((person, index) => (
            <Avatar key={person.id} size={20} userId={person.id} name={person.name} src={person.avatarUrl} style={{ marginLeft: index === 0 ? 0 : -6, boxShadow: `0 0 0 1px ${t.module}` }} />
          ))}
        </span>
      ) : null}
      <span style={{ ...plain, fontSize: 12.5, lineHeight: "20px", minWidth: 0 }}>
        <span style={{ fontWeight: 500 }}>{repliesWords(replies.count)}</span>
        {replies.detail ? <span style={{ color: t.text2, whiteSpace: "pre-wrap" }}>{`  · ${replies.detail} `}</span> : null}
      </span>
    </Link>
  );
}
