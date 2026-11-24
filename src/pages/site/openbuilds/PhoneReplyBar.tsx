/* Prompt 21: the reply bar on a phone's topic. Pinned to the bottom on Panel, padding 10 16 plus the bottom inset, riding above
   the keyboard: a 44 round plus ("Attach work", a half sheet listing the reader's drafts and published builds), the field
   (40 tall, growing to 5 lines, radius 20, Card fill, 16px text) and Reply (main, small). ONLY THE CONTAINER IS NEW: `ReplyBox`
   keeps the logic (what is sent, refused, attached, uploaded) and hands this its state and its handlers. */

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { MobileIcon } from "@/components/brand/MobileIcon";
import { VisuallyHidden } from "@/components/brand/VisuallyHidden";
import { PhoneBottomSheet } from "@/components/phone/BottomSheet";
import { PhoneRow } from "@/components/phone/PhoneRow";
import { useKeyboardInset } from "@/components/phone/useKeyboardInset";
import type { CardAttachment } from "@/components/post/postCardModel";
import { PostPrimary } from "@/components/post/postControls";
import { PHONE_MARGIN } from "@/components/shell/chromeSize";
import { groupAttachable, labelAttachable, listAttachableWork, type LabelledWork } from "@/lib/openbuilds";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { attachableKey } from "./AttachPicker";

/** The bar's own height, published for the page so the last reply is never hidden behind it. */
export const REPLY_BAR_VAR = "--reply-bar-h";

const FIELD_MIN = 40;
const FIELD_MAX_LINES = 5;
const LINE = 20;

/** What a card says about the one attachment: its name, in one line. */
export function attachmentLabel(attachment: CardAttachment): string {
  switch (attachment.kind) {
    case "build":
      return attachment.title;
    case "step":
      return attachment.head;
    case "picture":
      return "Picture";
    case "file":
      return attachment.name;
    default:
      return attachment.text;
  }
}

/** "4 drafts", "2 published builds": each group states what it holds. */
const heading = (origin: string, count: number): string =>
  origin === "Your drafts" ? `${count} ${count === 1 ? "draft" : "drafts"}` : `${count} published ${count === 1 ? "build" : "builds"}`;

/** The half sheet: the reader's drafts and published builds, the queries the desktop picker uses (at the Build size). */
export function PhoneAttachSheet({
  open,
  onOpenChange,
  userId,
  onPick,
  extra,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onPick: (work: LabelledWork) => void;
  /** Rows above the lists: add an image or file, make a step tile. */
  extra?: ReactNode;
}) {
  const work = useQuery({
    queryKey: attachableKey(userId, "build", ""),
    queryFn: async () => labelAttachable(await listAttachableWork({ userId, size: "build", forReply: false })),
    enabled: open,
    placeholderData: keepPreviousData,
  });
  const groups = groupAttachable(work.data ?? []).filter((group) => group.title === "Your drafts" || group.title === "Your published builds");
  return (
    <PhoneBottomSheet open={open} onOpenChange={onOpenChange} title="Attach work" height="half" dirty={false}>
      <div data-testid="attach-sheet" style={{ paddingBottom: 8 }}>
        {extra}
        {work.isError ? (
          <p style={{ margin: 0, padding: PHONE_MARGIN, fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px", color: t.text2 }}>Your work did not load. Close this and try again.</p>
        ) : work.isPending ? (
          <p style={{ margin: 0, padding: PHONE_MARGIN, fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px", color: t.label }}>Loading</p>
        ) : groups.length === 0 ? (
          <p style={{ margin: 0, padding: PHONE_MARGIN, fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px", color: t.label }}>Nothing to attach.</p>
        ) : (
          groups.map((group) => (
            <section key={group.title} aria-label={group.title}>
              <h2 style={{ margin: 0, padding: `12px ${PHONE_MARGIN}px 4px`, fontFamily: FIGTREE, fontSize: 20, fontWeight: 600, lineHeight: "24px", letterSpacing: "-0.01em", color: t.text }}>{heading(group.title, group.rows.length)}</h2>
              {group.rows.map((row) => (
                <PhoneRow
                  key={[row.size, row.buildId, row.nodeId, row.partKey, row.sessionKey].join("|")}
                  title={row.label}
                  line={row.context ?? undefined}
                  trail={{ kind: "chevron" }}
                  onSelect={() => {
                    onOpenChange(false);
                    onPick(row);
                  }}
                />
              ))}
            </section>
          ))
        )}
      </div>
    </PhoneBottomSheet>
  );
}

function RoundPlus({ onPress }: { onPress: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-label="Attach work"
      aria-haspopup="dialog"
      onClick={onPress}
      {...handlers}
      style={{ flex: "none", width: TOUCH_MIN, height: TOUCH_MIN, padding: 0, border: 0, borderRadius: r.full, background: t.control, color: t.text, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", ...ring(state.focusVisible) }}
    >
      <MobileIcon name="new" size={24} />
    </button>
  );
}

export interface PhoneReplyBarProps {
  id: string;
  fieldId: string;
  placeholder: string;
  body: string;
  onBody: (body: string) => void;
  area: RefObject<HTMLTextAreaElement>;
  /** The signed-in reader; null: Reply goes to sign in. */
  viewerId: string | null;
  signInTo: string;
  hasContent: boolean;
  uploading: boolean;
  onSend: () => void;
  onPick: (work: LabelledWork) => void;
  onFile: () => void;
  onTile: () => void;
  tileOpen: boolean;
  /** "On Step 4 · Prompt" with its Remove. */
  about: { label: string } | null;
  onRemoveAbout: () => void;
  attachment: { label: string; onRemove: () => void } | null;
  /** The step tile's editor, when open. */
  tile: ReactNode;
  notice: string | null;
}

export function PhoneReplyBar(props: PhoneReplyBarProps) {
  const keyboard = useKeyboardInset();
  const [sheet, setSheet] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const remove = useInteractive<HTMLButtonElement>();
  const aboutRemove = useInteractive<HTMLButtonElement>();

  // The page's replies keep this much room under them.
  useLayoutEffect(() => {
    const node = bar.current;
    if (!node) return;
    const publish = () => document.documentElement.style.setProperty(REPLY_BAR_VAR, `${node.getBoundingClientRect().height}px`);
    publish();
    if (typeof ResizeObserver === "undefined") return () => document.documentElement.style.removeProperty(REPLY_BAR_VAR);
    const observer = new ResizeObserver(publish);
    observer.observe(node);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty(REPLY_BAR_VAR);
    };
  }, []);

  // The field grows to five lines, then scrolls.
  const grow = (node: HTMLTextAreaElement | null) => {
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(Math.max(node.scrollHeight, FIELD_MIN), FIELD_MAX_LINES * LINE + 20)}px`;
  };
  useLayoutEffect(() => grow(props.area.current), [props.body, props.area]);

  const small = (color: string) => ({ margin: 0, fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color });
  return (
    <div
      ref={bar}
      id={props.id}
      data-testid="reply-box"
      data-bar=""
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: keyboard,
        zIndex: 30,
        boxSizing: "border-box",
        padding: `10px ${PHONE_MARGIN}px ${keyboard > 0 ? 10 : "calc(10px + env(safe-area-inset-bottom))"}`,
        background: t.surface,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {props.about ? (
        <p style={{ ...small(t.label), display: "flex", alignItems: "center", gap: 8 }}>
          <span>{`On ${props.about.label}`}</span>
          <button type="button" aria-label={`Remove ${props.about.label}`} onClick={props.onRemoveAbout} {...aboutRemove.handlers} style={{ ...small(t.text2), minHeight: TOUCH_MIN, padding: "0 8px", background: "none", border: 0, cursor: "pointer", ...ring(aboutRemove.state.focusVisible) }}>
            Remove
          </button>
        </p>
      ) : null}
      {props.tile}
      {props.attachment ? (
        <div data-testid="reply-attachment" style={{ display: "flex", alignItems: "center", gap: 8, minHeight: TOUCH_MIN, padding: "0 0 0 14px", background: t.module, borderRadius: 12 }}>
          <span style={{ flex: 1, minWidth: 0, fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px", color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{props.attachment.label}</span>
          <button type="button" aria-label="Remove the attachment" onClick={props.attachment.onRemove} {...remove.handlers} style={{ flex: "none", width: TOUCH_MIN, height: TOUCH_MIN, padding: 0, border: 0, borderRadius: r.full, background: "none", color: t.text2, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", ...ring(remove.state.focusVisible) }}>
            <MobileIcon name="close" size={20} />
          </button>
        </div>
      ) : null}
      {props.notice ? (
        <p role="alert" style={{ ...small(t.text), fontSize: 15, lineHeight: "20px" }}>
          {props.notice}
        </p>
      ) : null}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        {props.viewerId ? <RoundPlus onPress={() => setSheet(true)} /> : null}
        <label htmlFor={props.fieldId} style={{ flex: 1, minWidth: 0 }}>
          <VisuallyHidden>Reply</VisuallyHidden>
          <textarea
            id={props.fieldId}
            ref={props.area}
            rows={1}
            className="!border-0 !shadow-none focus-visible:!outline-none"
            value={props.body}
            placeholder={props.placeholder}
            onChange={(event) => props.onBody(event.target.value)}
            style={{ display: "block", boxSizing: "border-box", width: "100%", minHeight: FIELD_MIN, padding: "10px 16px", border: 0, borderRadius: 20, background: t.module, color: t.text, fontFamily: FIGTREE, fontSize: 16, lineHeight: `${LINE}px`, resize: "none", outline: "none" }}
          />
        </label>
        {props.viewerId ? (
          <PostPrimary onClick={props.onSend} disabled={!props.hasContent || props.uploading}>
            Reply
          </PostPrimary>
        ) : (
          <PostPrimary to={props.signInTo}>Reply</PostPrimary>
        )}
      </div>
      {props.viewerId ? (
        <PhoneAttachSheet
          open={sheet}
          onOpenChange={setSheet}
          userId={props.viewerId}
          onPick={props.onPick}
          extra={
            <>
              <PhoneRow title="Add image or file" lead={{ kind: "icon", icon: "image" }} onSelect={() => { setSheet(false); props.onFile(); }} />
              <PhoneRow title={props.tileOpen ? "Close the step tile" : "Make a step tile"} lead={{ kind: "icon", icon: "session" }} onSelect={() => { setSheet(false); props.onTile(); }} />
            </>
          }
        />
      ) : null}
    </div>
  );
}
