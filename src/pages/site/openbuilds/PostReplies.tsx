/* UX-06 Part 1: the Thread's replies. PURE: typed props, no fetching, no `useAuth()`, no router hooks but `Link`.

   A reply has no box: `Avatar` 24, the name in 13 at the card's weight (600), the age in `--label`, the body in 13, attachments as
   the post card draws them, then a row of text buttons (12 `--text2`, 16 apart). A `--hairline` between replies, none after the
   last. Replies to a reply sit 38 in, over a 1px `--hairline` rule on their left; two levels are drawn, and a deeper branch is
   `View 3 more replies`. A pinned reply is the same reply inside the module box, with `Pinned by @maya` at the right of its head. */

import { forwardRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Avatar } from "@/components/brand/Avatar";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { AttachmentView, PicturesBlock } from "@/components/post/PostCard";
import { PostControl } from "@/components/post/postControls";
import type { CardAttachment } from "@/components/post/postCardModel";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DashedSlot } from "@/components/vision/DashedSlot";
import { PageLink } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { BLOCK_COPY, isCollapsed } from "@/lib/settings/blocks";

import type { ReplyItem, StepSource } from "./postModel";

/** UX-07 P5: a reply's element id, the address's `#reply-<id>` (replyHref). */
export const replyAnchor = (replyId: string): string => `reply-${replyId}`;

/** A menu opened from the page stands above the page's own layers. */
export const MENU_Z = 80;

const plain: CSSProperties = { fontFamily: FIGTREE, margin: 0 };

/** What the Thread can do to a reply. */
export interface ReplyActions {
  onReply: (replyId: string) => void;
  onLike: (replyId: string, on: boolean) => void;
  onPin: (replyId: string) => void;
  onUnpin: (replyId: string) => void;
  onHide: (replyId: string, reason: string) => void;
  /** The address of a deeper branch: `View 3 more replies`. */
  branchHref: (replyId: string) => string;
  /** Part 4: `Add to a draft` for an attached step. Absent: not offered. */
  renderAddToDraft?: (step: StepSource) => ReactNode;
  /** UX-07 P7: a reply's reaction row, under its actions. Absent or null: nothing. */
  renderReactions?: (replyId: string) => ReactNode;
  /** UX-09 P8: Report a reply (everyone but its author). Absent: not offered. */
  onReport?: (replyId: string) => void;
  /** UX-15 P5: "Block @maya" in a reply's `···` (everyone but its author). Absent: not offered. */
  onBlock?: (replyId: string) => void;
  /** UX-15 P5: the people the reader blocked. Their replies collapse to one row; the thread around them reads as before. */
  blockedAuthors?: ReadonlySet<string>;
}

/** A text button: 12 `--text2`, no box, underlined at once under a fine pointer's hover. On a phone its hit area is 44 high. */
export const TextButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function TextButton({ children, style, type = "button", ...rest }, ref) {
  const phone = useIsPhone();
  const { state, handlers } = useInteractive<HTMLButtonElement>({
    onMouseEnter: rest.onMouseEnter as never,
    onMouseLeave: rest.onMouseLeave as never,
    onFocus: rest.onFocus as never,
    onBlur: rest.onBlur as never,
    onPointerDown: rest.onPointerDown as never,
    onPointerUp: rest.onPointerUp as never,
  });
  const reach = phone ? (TOUCH_MIN - 16) / 2 : 0;
  return (
    <button
      ref={ref}
      type={type}
      {...rest}
      {...handlers}
      style={{
        ...plain,
        /* A text link button: 24 high with 4 either side; on a phone the padding reaches 44 and the margin keeps the line. */
        ...(phone ? { padding: `${reach}px 0`, margin: `${-reach}px 0` } : { display: "inline-flex", alignItems: "center", height: 24, padding: "0 4px" }),
        background: "none",
        border: 0,
        borderRadius: r.control,
        fontSize: 12,
        lineHeight: "16px",
        color: t.text2,
        cursor: "pointer",
        whiteSpace: "nowrap",
        textDecoration: state.hovered ? "underline" : "none",
        textUnderlineOffset: 3,
        ...ring(state.focusVisible),
        ...style,
      }}
    >
      {children}
    </button>
  );
});

/** The reply's `···` menu: Pin or Unpin for the post's author and moderators, Hide for moderators, Report for everyone but its author. */
function ReplyMenu({ reply, actions, onAsk }: { reply: ReplyItem; actions: ReplyActions; onAsk: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TextButton aria-label="More for this reply">···</TextButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" style={{ zIndex: MENU_Z }}>
        {reply.canPin ? reply.pinnedBy ? <DropdownMenuItem onSelect={() => actions.onUnpin(reply.id)}>Unpin</DropdownMenuItem> : <DropdownMenuItem onSelect={() => actions.onPin(reply.id)}>Pin</DropdownMenuItem> : null}
        {reply.canHide ? <DropdownMenuItem onSelect={onAsk}>Hide</DropdownMenuItem> : null}
        {reply.canReport && actions.onReport ? <DropdownMenuItem onSelect={() => actions.onReport?.(reply.id)}>Report</DropdownMenuItem> : null}
        {reply.canReport && actions.onBlock && reply.author.handle ? <DropdownMenuItem onSelect={() => actions.onBlock?.(reply.id)}>{BLOCK_COPY.action(reply.author.handle)}</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HideReason({ onHide, onCancel }: { onHide: (reason: string) => void; onCancel: () => void }) {
  const phone = useIsPhone();
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
        style={{ flex: "1 1 200px", minWidth: 0, height: 32, boxSizing: "border-box", padding: "0 8px", borderRadius: r.control, border: `1px solid ${t.controlBorder}`, background: t.well, color: t.text, fontFamily: FIGTREE, fontSize: phone ? 16 : 13 }}
      />
      <PostControl type="submit">Hide</PostControl>
      <PostControl onClick={onCancel}>Cancel</PostControl>
    </form>
  );
}

function Attachments({ attachments }: { attachments: readonly CardAttachment[] }) {
  if (attachments.length === 0) return null;
  const pictures = attachments.filter((entry): entry is Extract<CardAttachment, { kind: "picture" }> => entry.kind === "picture");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
      {attachments.map((attachment) =>
        attachment.kind === "picture" ? (pictures[0] === attachment ? <PicturesBlock key={attachment.key} pictures={pictures} /> : null) : <AttachmentView key={attachment.key} attachment={attachment} />,
      )}
    </div>
  );
}

/** UX-07: a reply's anatomy (its author, words and attachments), with whatever sits under it: the Thread's actions, or nothing (Home's reply groups). */
export function ReplyAnatomy({ reply, children }: { reply: ReplyItem; children?: ReactNode }) {
  const pinned = reply.pinnedBy !== null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "24px minmax(0, 1fr)", columnGap: 12 }}>
      <Avatar size={24} userId={reply.author.id} name={reply.author.name} src={reply.author.avatarUrl} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, minHeight: 24 }}>
          <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 6, rowGap: 4 }}>
            <span style={{ ...plain, fontSize: 13, fontWeight: 600, lineHeight: "20px" }}>{reply.author.name}</span>
            <span style={{ ...plain, fontSize: 12, lineHeight: "20px", color: t.label }}>{[reply.author.handle ? `@${reply.author.handle}` : null, reply.age].filter(Boolean).join(" · ")}</span>
            {reply.about ? (
              <>
                <span style={{ ...plain, fontSize: 12, lineHeight: "20px", color: t.label }}>· on</span>
                <DashedSlot data-testid="reply-about" style={{ display: "inline-flex", alignItems: "center", height: 20, padding: "0 6px", ...plain, fontSize: 12, color: t.text2 }}>
                  {reply.about}
                </DashedSlot>
              </>
            ) : null}
          </div>
          {pinned ? <span style={{ ...plain, flex: "none", fontSize: 12, color: t.label }}>{`Pinned by ${reply.pinnedBy}`}</span> : null}
        </div>
        {reply.body ? <p style={{ ...plain, marginTop: 4, fontSize: 13, lineHeight: "20px", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{reply.body}</p> : null}
        <Attachments attachments={reply.attachments} />
        {children}
      </div>
    </div>
  );
}

const NO_ONE: ReadonlySet<string> = new Set();

/** One reply, its actions, and (at the first level) its own replies. */
export function Reply({ reply, actions, last, box }: { reply: ReplyItem; actions: ReplyActions; last: boolean; box?: { at: string; node: ReactNode } }) {
  const [asking, setAsking] = useState(false);
  const pinned = reply.pinnedBy !== null;
  const collapsed = isCollapsed(reply.author.id, actions.blockedAuthors ?? NO_ONE);
  const content = collapsed ? (
    <p data-testid="reply-collapsed" style={{ ...plain, fontSize: 12, lineHeight: "20px", color: t.label }}>
      {BLOCK_COPY.collapsedReply}
    </p>
  ) : (
    <ReplyAnatomy reply={reply}>
        <div role="group" aria-label={`Actions for ${reply.author.name}'s reply`} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 16, rowGap: 8, marginTop: 8 }}>
          <TextButton onClick={() => actions.onReply(reply.id)}>Reply</TextButton>
          <TextButton aria-pressed={reply.liked} onClick={() => actions.onLike(reply.id, !reply.liked)} style={reply.liked ? { color: t.text } : undefined}>
            {reply.likes > 0 ? `Like ${reply.likes}` : "Like"}
          </TextButton>
          {reply.build ? (
            <>
              <LinkText to={reply.build.to}>Open build</LinkText>
              <LinkText to={reply.build.rebuildTo}>Rebuild</LinkText>
            </>
          ) : null}
          {reply.step && actions.renderAddToDraft ? actions.renderAddToDraft(reply.step) : null}
          {reply.canPin || reply.canHide || (reply.canReport && (actions.onReport || actions.onBlock)) ? <ReplyMenu reply={reply} actions={actions} onAsk={() => setAsking(true)} /> : null}
        </div>
        {actions.renderReactions?.(reply.id) ?? null}
        {asking ? (
          <HideReason
            onHide={(reason) => {
              setAsking(false);
              actions.onHide(reply.id, reason);
            }}
            onCancel={() => setAsking(false)}
          />
        ) : null}
        {reply.more > 0 ? (
          <div style={{ marginTop: 8 }}>
            <LinkText to={actions.branchHref(reply.id)} size={12} same>{`View ${reply.more} more ${reply.more === 1 ? "reply" : "replies"}`}</LinkText>
          </div>
        ) : null}
    </ReplyAnatomy>
  );

  return (
    <li id={replyAnchor(reply.id)} data-testid="reply" data-depth={reply.depth} style={{ listStyle: "none", padding: "16px 0", borderBottom: last ? "none" : `1px solid ${t.hairline}` }}>
      {pinned && !collapsed ? <div style={{ background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: r.card, padding: 16 }}>{content}</div> : content}
      {box?.at === reply.id ? <div style={{ marginTop: 16 }}>{box.node}</div> : null}
      {reply.children.length > 0 ? (
        <ol aria-label={`Replies to ${reply.author.name}`} style={{ margin: "8px 0 0 38px", padding: "0 0 0 12px", borderLeft: `1px solid ${t.hairline}` }}>
          {reply.children.map((child, index) => (
            <Reply key={child.id} reply={child} actions={actions} last={index === reply.children.length - 1} box={box} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

/** A link drawn as a text button: a reply's Open build and Rebuild (other pages, through `PageLink`), and `View 3 more replies`
    (this page with new parameters: a plain link, so nothing fades). */
function LinkText({ to, size = 12, same = false, children }: { to: string; size?: number; same?: boolean; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  const Tag = same ? Link : PageLink;
  return (
    <Tag to={to} {...handlers} style={{ ...plain, display: "inline-flex", alignItems: "center", height: 24, padding: "0 4px", fontSize: size, lineHeight: "16px", color: t.text2, textDecoration: state.hovered ? "underline" : "none", textUnderlineOffset: 3, borderRadius: r.control, whiteSpace: "nowrap", ...ring(state.focusVisible) }}>
      {children}
    </Tag>
  );
}

/** The Thread's list. */
export function ReplyList({ items, actions, box }: { items: readonly ReplyItem[]; actions: ReplyActions; box?: { at: string; node: ReactNode } }) {
  return (
    <ol aria-label="Replies" style={{ margin: 0, padding: 0 }}>
      {items.map((reply, index) => (
        <Reply key={reply.id} reply={reply} actions={actions} last={index === items.length - 1} box={box} />
      ))}
    </ol>
  );
}
