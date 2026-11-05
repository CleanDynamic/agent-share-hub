/* UX-06 Part 2: the reply box. One is open at a time, at the foot of the Thread or under the reply it answers, and it carries the
   view's one primary, Reply.

   `Avatar` 24, then the box: `On Step 4 · Prompt` with a Remove link when the reply is about a step, a textarea (16 on a phone)
   saying `Reply with words, work, or both`, the one attachment with Remove, then Attach work (UX-05's picker in reply mode: someone
   else's work offers Mention instead), Add image or file, Make a step tile (Part 3: a small editor in the box; on Reply the build layer
   makes one draft, `Reply: <heading>`, with one session and the tile, and the reply attaches that step), and Reply. Text or one
   attachment is enough.

   Reply empties the box and the reply is in the Thread at once (`sendReply`); a refusal puts the content back and shows the
   database's words under the box, unchanged. Signed out, Reply goes to sign in and back. */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Avatar } from "@/components/brand/Avatar";
import { VisuallyHidden } from "@/components/brand/VisuallyHidden";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { AttachmentView, PicturesBlock } from "@/components/post/PostCard";
import { PostControl, PostPrimary } from "@/components/post/postControls";
import { cardAttachment, type CardAttachment } from "@/components/post/postCardModel";
import { useAuth } from "@/contexts/AuthContext";
import { fileKindFor, MEDIA_MAX_BYTES } from "@/lib/build/media";
import { reportError } from "@/lib/errors/report";
import { readNamedWork, uploadEntryMedia, type AttachmentInput, type LabelledWork, type WorkSize } from "@/lib/openbuilds";
import { NO_CARD_WORK, workNamedBy, type CardWork } from "@/lib/openbuilds/cardWork";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { AttachPicker } from "./AttachPicker";
import { makeReplyDraft, replyTileInput, type ReplyStepTile } from "@/lib/openbuilds/replyDraft";

import { EMPTY_REPLY, replyHasContent, sendReply, type ReplyDraft } from "./sendReply";
import { StepTileEditor } from "./StepTileEditor";
import { attachmentOf, inputOf } from "./sendPost";

export const REPLY_PLACEHOLDER = "Reply with words, work, or both";
export const EMPTY_REPLY_SEND = "Write something or attach work.";
/** UX-09 P1: the open reply box's id, so `#reply-box` opens it from another page. */
export const REPLY_BOX_ID = "reply-box";

export interface ReplyBoxProps {
  /** The post whose page this is. */
  pageId: string;
  rootId: string;
  /** The post or reply this answers. */
  parentId: string;
  /** The step the reply is about, from Reply on this step. */
  about: ReplyDraft["about"];
  onRemoveAbout: () => void;
  /** Where Reply goes signed out. */
  signInTo: string;
  /** Part 3: what a step tile's draft is named: `Reply: <heading>`. */
  draftTitle: string;
  /** Part 5: open with the picker showing builds (the Wall's Reply with a build). */
  pick?: WorkSize;
  /** After a reply is in the Thread (the box goes back to the foot). */
  onSent?: () => void;
}

const textLine = (size: number, color: string): CSSProperties => ({ fontFamily: FIGTREE, fontSize: size, lineHeight: "16px", color, margin: 0 });

function RemoveLink({ onClick, label }: { onClick: () => void; label: string }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" aria-label={label} onClick={onClick} {...handlers} style={{ ...textLine(12, t.text2), padding: 0, background: "none", border: 0, borderRadius: r.control, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, ...(state.hovered ? { color: t.text } : null), ...ring(state.focusVisible) }}>
      Remove
    </button>
  );
}

const EMPTY_TILE: ReplyStepTile = { kind: "prompt", text: "", tool: null, model: null };

export function ReplyBox({ pageId, rootId, parentId, about, onRemoveAbout, signInTo, draftTitle, pick, onSent }: ReplyBoxProps) {
  const phone = useIsPhone();
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  const viewerId = user?.id ?? null;
  const [draft, setDraft] = useState<ReplyDraft>(EMPTY_REPLY);
  const [work, setWork] = useState<CardWork>(NO_CARD_WORK);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  // Part 3: the step tile being made, or null. It is the reply's one attachment while it is open.
  const [tile, setTile] = useState<ReplyStepTile | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const field = useInteractive<HTMLTextAreaElement>();
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  const change = (next: Partial<ReplyDraft>) => {
    setNotice(null);
    setDraft((current) => ({ ...current, ...next }));
  };

  const attach = async (picked: LabelledWork) => {
    const input = inputOf(picked);
    setTile(null);
    change({ attachment: { input } });
    try {
      const read = await readNamedWork(workNamedBy([{ attachments: [attachmentOf(input, 0)] } as unknown as Parameters<typeof workNamedBy>[0][number]]));
      setWork(read);
    } catch (error) {
      reportError(error, { source: "openbuilds", context: "readReplyWork" });
    }
  };

  const mention = (handle: string) => {
    const body = draft.body;
    change({ body: `${body}${body && !/\s$/.test(body) ? " " : ""}@${handle} ` });
    area.current?.focus();
  };

  const addFile = async (picked: File | undefined) => {
    if (!picked) return;
    const kind = fileKindFor(picked);
    if ("refused" in kind) return setNotice(kind.refused);
    if (picked.size > MEDIA_MAX_BYTES) return setNotice(`${picked.name} is over 25 MB.`);
    setUploading(true);
    try {
      const up = await uploadEntryMedia(picked);
      setPreview(up.mediaKind !== "file" ? URL.createObjectURL(picked) : null);
      setTile(null);
      change({ attachment: { input: { kind: "media", mediaPath: up.path, mediaKind: up.mediaKind }, name: picked.name } });
    } catch (error) {
      reportError(error, { source: "openbuilds", context: "uploadEntryMedia" });
      setNotice(`${picked.name} didn't upload. Try again.`);
    } finally {
      setUploading(false);
      if (file.current) file.current.value = "";
    }
  };

  const send = async () => {
    const made = tile && tile.text.trim() ? tile : null;
    // A step tile stands for the reply's one attachment until its draft is made.
    const sent: ReplyDraft = { ...draft, about, ...(made ? { attachment: { input: { kind: "step", buildId: "pending", nodeId: "pending" } } } : null) };
    if (!replyHasContent(sent)) return setNotice(EMPTY_REPLY_SEND);
    setDraft(EMPTY_REPLY);
    setTile(null);
    setNotice(null);
    const snapshot = made ? { type: made.kind, title: null, note: null, payload: made.kind === "code" ? { source: made.text } : { text: made.text }, source: { buildId: null, buildTitle: draftTitle, buildSlug: null, makerId: viewerId } } : null;
    const refused = await sendReply({
      qc,
      pageId,
      parentId,
      rootId,
      draft: sent,
      sender: { id: viewerId ?? "", handle: profile?.username ?? null, name: profile?.display_name ?? null, avatarUrl: profile?.avatar_url ?? null },
      snapshot,
      attach: made ? async () => replyTileInput(await makeReplyDraft(draftTitle, made)) : undefined,
    });
    if (refused) {
      // The content comes back as it was, with the words under the box.
      setDraft((current) => (replyHasContent(current) ? current : { ...sent, attachment: made ? null : sent.attachment, about: null }));
      if (made) setTile(made);
      setNotice(refused);
      return;
    }
    // The draft the step tile made is in Drafts like any other.
    if (made) void qc.invalidateQueries({ queryKey: ["build", "listDraftsWithSessions"] });
    onSent?.();
  };

  /* ── what is drawn ── */

  const input = draft.attachment?.input;
  const drawn: CardAttachment | null = !input
    ? null
    : input.kind === "media"
      ? input.mediaKind === "file"
        ? { kind: "file", key: "reply-file", name: draft.attachment?.name ?? "File", href: null }
        : { kind: "picture", key: "reply-picture", path: input.mediaPath, mediaKind: input.mediaKind, src: preview }
      : cardAttachment({ id: "reply", stillOpen: false, aboutNodeId: null }, attachmentOf(input, 0), work, new Map());
  const name = profile?.display_name?.trim() || profile?.username || "You";

  return (
    // UX-09 P1: `#reply-box` on a topic's address brings this box into view, with its field focused (Reply on a gap).
    <div id={REPLY_BOX_ID} data-testid="reply-box" style={{ display: "grid", gridTemplateColumns: "24px minmax(0, 1fr)", columnGap: 12 }}>
      <Avatar size={24} userId={viewerId ?? "signed-out"} name={name} src={profile?.avatar_url ?? null} />
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {about ? (
          <p style={{ ...textLine(12, t.label), display: "flex", gap: 8, alignItems: "baseline" }}>
            <span>{`On ${about.label}`}</span>
            <RemoveLink onClick={onRemoveAbout} label={`Remove ${about.label}`} />
          </p>
        ) : null}
        <label htmlFor={`reply-box-${parentId}`}>
          <VisuallyHidden>Reply</VisuallyHidden>
        </label>
        <textarea
          id={`reply-box-${parentId}`}
          ref={area}
          value={draft.body}
          rows={3}
          placeholder={REPLY_PLACEHOLDER}
          onChange={(event) => change({ body: event.target.value })}
          {...field.handlers}
          style={{ boxSizing: "border-box", width: "100%", minHeight: 64, padding: "8px 12px", borderRadius: r.control, border: `1px solid ${t.controlBorder}`, background: t.well, color: t.text, fontFamily: FIGTREE, fontSize: phone ? 16 : 13, lineHeight: "20px", resize: "vertical", outline: "none", ...ring(field.state.focusVisible) }}
        />
        {tile ? <StepTileEditor tile={tile} onChange={setTile} idPrefix={`reply-tile-${parentId}`} /> : null}
        {drawn ? (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>{drawn.kind === "picture" ? <PicturesBlock pictures={[drawn]} /> : <AttachmentView attachment={drawn} />}</div>
            <PostControl aria-label="Remove the attachment" onClick={() => change({ attachment: null })}>
              Remove
            </PostControl>
          </div>
        ) : null}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {viewerId ? (
            <>
              <AttachPicker userId={viewerId} onPick={(picked) => void attach(picked)} reply={{ onMention: mention }} open={pick !== undefined} size={pick} />
              <PostControl onClick={() => file.current?.click()} disabled={uploading}>
                Add image or file
              </PostControl>
              <input ref={file} type="file" aria-label="Choose an image or file" hidden onChange={(event) => void addFile(event.target.files?.[0])} />
              <PostControl
                aria-pressed={tile !== null}
                onClick={() => {
                  if (tile) return setTile(null);
                  change({ attachment: null });
                  setTile(EMPTY_TILE);
                }}
              >
                Make a step tile
              </PostControl>
            </>
          ) : null}
          <span style={{ flexGrow: 1 }} />
          {viewerId ? (
            <PostPrimary onClick={() => void send()} disabled={uploading}>
              Reply
            </PostPrimary>
          ) : (
            <PostPrimary to={signInTo}>Reply</PostPrimary>
          )}
        </div>
        {notice ? (
          <p role="alert" style={{ ...textLine(12.5, t.text), lineHeight: "20px" }}>
            {notice}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default ReplyBox;
