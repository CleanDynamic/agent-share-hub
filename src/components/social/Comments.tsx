// The comments on a build, and on its parts (RC-P17).
//
// ONE SECTION UNDER THE TAB PANEL, id="comments". The header's Comment action
// scrolls here and focuses the box (RC-P16); a part's marker in the Anatomy
// does the same with that part attached; /b2/<slug>#comments lands here.
//
// WHAT A COMMENT IS DRAWN AS. The avatar (the existing component, 32px), the
// name linking to the maker's profile, when it was written in DM Mono 12, an
// "on part …" chip when it is about one part, the words as plain text with
// their line breaks kept — never as HTML — and then its text actions. Top-level
// comments are oldest first, 24 apart; a reply sits under its comment, 24 in,
// behind a 1px --line on its leading side, and cannot itself be answered
// ⟦law-of-continuity⟧. No comment is boxed ⟦law-of-common-region › When
// Containment Is Counterproductive⟧: a conversation is a column of voices, not
// a stack of cards.
//
// AT MOST THREE ACTIONS ON A COMMENT ⟦hicks-law › Budgets⟧: somebody else's
// comment offers Reply; your own offers Reply, Edit and, 16 further along,
// Delete — tertiary, last, and confirmed in a dialog whose primary button says
// what it does, "Delete comment" (STATES.md rows 16 and 17). All of them are
// visible at rest; none waits for a hover ⟦critique-affordance › Action
// Discoverability⟧. "Post" is secondary (row 2): the page's one filled button
// is in its header ⟦von-restorff-effect⟧.
//
// TWO REQUESTS, NEAR THE VIEWPORT ⟦neoscale-performance⟧: nothing is asked
// until the section is within 400px of the screen, or at once when the address
// ends #comments. Then the first page of comments and the parts' counts, one
// request each (useBuildComments). "Show more comments" asks for the next 50.
//
// A COMMENT'S WORDS NEVER REACH AN ERROR OR A LOG ⟦neoscale-error-monitoring
// › Privacy⟧: a refusal is reported by the data layer with ids and a code, and
// this section says only "Something went wrong." or "You don't have access to
// this." (row 21) — and keeps what the reader typed in its box.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { updateEngagement } from "@/hooks/useEngagement";
import { ReportDialog } from "@/components/moderation/ReportDialog";
import {
  appendComment,
  bumpPartCount,
  removeComment,
  replaceComment,
  useCommentPages,
  usePartCommentCounts,
} from "@/hooks/useBuildComments";
import { isPermissionError } from "@/lib/errors/permission";
import {
  COMMENT_MAX,
  addComment,
  commentTime,
  deleteComment,
  editComment,
  nestComments,
  type BuildComment,
  type CommentThread,
  type PartLabel,
} from "@/lib/social";
import { buttonStyle, chipStyle, fieldStyle, ring, skeletonStyle } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { scrollBehavior } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, body, data as dataText, eyebrow, label as labelType, measure } from "@/lib/theme/type";

/** How far below the screen the section starts asking for its comments. */
const NEAR_MARGIN = "400px 0px";

/** The secondary treatment: transparent, a --line border (STATES.md row 2). */
const SECONDARY: CSSProperties = { background: "transparent", borderRadius: r.control, minHeight: 44 };

export interface CommentsProps {
  build: { id: string; slug: string };
  /** The build's parts, numbered as the Anatomy draws them. */
  parts: Map<string, PartLabel>;
  /** A part to attach, from its marker in the Anatomy; `at` makes a repeat press new. */
  attachRequest: { nodeId: string; at: number } | null;
  /** Show a part in the Anatomy: the chip on a comment about it. */
  onOpenPart: (nodeId: string) => void;
}

export function Comments({ build, parts, attachRequest, onOpenPart }: CommentsProps) {
  const { user, isLoggedIn } = useAuth();
  const viewerId = user?.id ?? null;
  const location = useLocation();
  const queryClient = useQueryClient();

  const sectionRef = useRef<HTMLElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const signInRef = useRef<HTMLAnchorElement | null>(null);

  /* ── When to ask ─────────────────────────────────────────────────────────── */

  const wantsComments = location.hash === "#comments";
  const [near, setNear] = useState(wantsComments);

  useEffect(() => {
    if (near) return;
    const element = sectionRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: NEAR_MARGIN },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near]);

  const pages = useCommentPages(build.id, near);
  // The second request, issued with the first: every part's count.
  usePartCommentCounts(build.id, near);

  /* ── Arriving here on purpose ─────────────────────────────────────────────── */

  const [attached, setAttached] = useState<string | null>(null);

  const bringIntoView = () => {
    const element = sectionRef.current;
    if (element && typeof element.scrollIntoView === "function") {
      element.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    }
    const target: HTMLElement | null = composerRef.current ?? signInRef.current;
    target?.focus({ preventScroll: true });
  };

  // /b2/<slug>#comments: into view, and the box focused.
  useEffect(() => {
    if (!wantsComments) return;
    setNear(true);
    const frame = window.requestAnimationFrame(bringIntoView);
    return () => window.cancelAnimationFrame(frame);
    // bringIntoView reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsComments]);

  // A part's marker was pressed: attach it (signed in) and bring the box here.
  useEffect(() => {
    if (!attachRequest) return;
    setNear(true);
    if (isLoggedIn) setAttached(attachRequest.nodeId);
    const frame = window.requestAnimationFrame(bringIntoView);
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachRequest]);

  /* ── The list ─────────────────────────────────────────────────────────────── */

  const rows = useMemo(() => pages.data?.pages.flatMap((page) => page.rows) ?? [], [pages.data]);
  const threads = useMemo(() => nestComments(rows), [rows]);

  /* ── Writing ──────────────────────────────────────────────────────────────── */

  const refused = (error: unknown) =>
    toast(isPermissionError(error) ? "You don't have access to this." : "Something went wrong.");

  const posted = (comment: BuildComment) => {
    appendComment(queryClient, build.id, comment);
    if (!comment.isHidden) updateEngagement(queryClient, build.id, { comments: 1 });
    if (comment.nodeId) bumpPartCount(queryClient, build.id, comment.nodeId, 1);
  };

  const removed = (gone: BuildComment[]) => {
    const visible = gone.filter((row) => !row.isHidden).length;
    if (visible > 0) updateEngagement(queryClient, build.id, { comments: -visible });
    for (const row of gone) if (row.nodeId) bumpPartCount(queryClient, build.id, row.nodeId, -1);
  };

  const [confirming, setConfirming] = useState<CommentThread | BuildComment | null>(null);
  const [deleting, setDeleting] = useState(false);
  // RC-P17b: somebody else's comment, being reported.
  const [reporting, setReporting] = useState<{ type: "comment"; id: string } | null>(null);

  const confirmDelete = async () => {
    if (!confirming) return;
    setDeleting(true);
    try {
      await deleteComment(confirming.id);
      removed(removeComment(queryClient, build.id, confirming.id));
      setConfirming(null);
    } catch (error) {
      refused(error);
    } finally {
      setDeleting(false);
    }
  };

  const signInHref = `/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}#comments`)}`;

  return (
    <section
      id="comments"
      ref={sectionRef}
      aria-labelledby="comments-heading"
      data-testid="comments"
      style={{ display: "flex", flexDirection: "column", gap: SPACE.md, scrollMarginTop: SPACE.md }}
    >
      <h2 id="comments-heading" style={{ ...eyebrow, color: t.text2, margin: 0 }}>
        Comments
      </h2>

      {isLoggedIn ? (
        <Composer
          boxRef={composerRef}
          attached={attached ? { id: attached, label: parts.get(attached) ?? null } : null}
          onDetach={() => setAttached(null)}
          onSubmit={async (text) => {
            const comment = await addComment({ buildId: build.id, nodeId: attached, body: text });
            posted(comment);
            setAttached(null);
          }}
          onRefused={refused}
        />
      ) : (
        <Link
          ref={signInRef}
          to={signInHref}
          data-testid="comments-sign-in"
          style={{ ...buttonStyle("link"), ...body, alignSelf: "flex-start", display: "inline-flex", alignItems: "center", minHeight: 44 }}
        >
          Sign in to comment
        </Link>
      )}

      <CommentList
        loading={!near || pages.isLoading}
        error={pages.isError ? pages.error : null}
        onRetry={() => void pages.refetch()}
        threads={threads}
        parts={parts}
        viewerId={viewerId}
        canWrite={isLoggedIn}
        onOpenPart={onOpenPart}
        onReply={async (parent, text) => posted(await addComment({ buildId: build.id, parentId: parent.id, body: text }))}
        onEdit={async (comment, text) => replaceComment(queryClient, build.id, await editComment(comment.id, text))}
        onDelete={(comment) => setConfirming(comment)}
        onReport={(comment) => setReporting({ type: "comment", id: comment.id })}
        onRefused={refused}
      />

      {pages.hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          data-testid="comments-show-more"
          disabled={pages.isFetchingNextPage}
          onClick={() => void pages.fetchNextPage()}
          style={{ ...SECONDARY, alignSelf: "flex-start" }}
        >
          Show more comments
        </Button>
      ) : null}

      <ReportDialog target={reporting} onClose={() => setReporting(null)} />

      <Dialog open={confirming !== null} onOpenChange={(open) => (!open && !deleting ? setConfirming(null) : undefined)}>
        <DialogContent style={{ maxWidth: 440 }}>
          <DialogTitle style={{ ...body, fontWeight: 600, fontSize: 18 }}>Delete this comment?</DialogTitle>
          <DialogDescription style={{ ...body, color: t.text2 }}>
            {confirming && "replies" in confirming && confirming.replies.length > 0
              ? "Its replies go with it. This cannot be undone."
              : "This cannot be undone."}
          </DialogDescription>
          <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: SPACE.xs }}>
            <Button type="button" variant="ghost" onClick={() => setConfirming(null)} disabled={deleting} style={{ minHeight: 44 }}>
              Cancel
            </Button>
            <Button type="button" variant="default" onClick={() => void confirmDelete()} disabled={deleting} style={{ minHeight: 44 }}>
              Delete comment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   The composer
   ──────────────────────────────────────────────────────────────────────────── */

function Composer({
  boxRef,
  attached,
  onDetach,
  onSubmit,
  onRefused,
}: {
  boxRef: React.MutableRefObject<HTMLTextAreaElement | null>;
  attached: { id: string; label: PartLabel | null } | null;
  onDetach: () => void;
  onSubmit: (text: string) => Promise<void>;
  onRefused: (error: unknown) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const empty = text.trim().length === 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (empty || sending) return;
    setSending(true);
    try {
      await onSubmit(text);
      setText("");
    } catch (error) {
      onRefused(error);
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      data-testid="comments-composer"
      style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}
    >
      {attached ? (
        <span style={{ display: "inline-flex", alignItems: "center", alignSelf: "flex-start", gap: 0 }}>
          <span data-testid="comments-attached-part" style={{ ...chipStyle("outline"), padding: "2px 8px" }}>
            {partText(attached.label)}
          </span>
          <IconAction label="Remove the part" onPress={onDetach}>
            <X size={14} strokeWidth={1.5} aria-hidden />
          </IconAction>
        </span>
      ) : null}
      <div style={{ display: "flex", alignItems: "flex-end", gap: SPACE.xs }}>
        <TextBox
          boxRef={boxRef}
          label="Add a comment"
          value={text}
          onChange={setText}
          placeholder="Add a comment"
        />
        <Button type="submit" variant="outline" disabled={empty || sending} style={SECONDARY}>
          Post
        </Button>
      </div>
    </form>
  );
}

/** The one text field treatment: --recess, --line, --r-control, 16px text. */
function TextBox({
  boxRef,
  label,
  value,
  onChange,
  placeholder,
}: {
  boxRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const { state, handlers } = useInteractive<HTMLTextAreaElement>();
  return (
    <textarea
      ref={boxRef}
      aria-label={label}
      placeholder={placeholder}
      value={value}
      maxLength={COMMENT_MAX}
      rows={2}
      onChange={(event) => onChange(event.target.value)}
      {...handlers}
      style={{
        ...fieldStyle(state),
        ...body,
        flex: 1,
        minWidth: 0,
        width: "100%",
        minHeight: 44,
        padding: "10px 12px",
        resize: "vertical",
      }}
    />
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   The list
   ──────────────────────────────────────────────────────────────────────────── */

interface ListProps {
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  threads: CommentThread[];
  parts: Map<string, PartLabel>;
  viewerId: string | null;
  canWrite: boolean;
  onOpenPart: (nodeId: string) => void;
  onReply: (parent: CommentThread, text: string) => Promise<void>;
  onEdit: (comment: BuildComment, text: string) => Promise<void>;
  onDelete: (comment: CommentThread | BuildComment) => void;
  /** RC-P17b: report somebody else's comment. */
  onReport: (comment: BuildComment) => void;
  onRefused: (error: unknown) => void;
}

function CommentList(props: ListProps) {
  const { loading, error, onRetry, threads } = props;

  if (error) {
    // STATES.md row 21: one sentence and one way back.
    return (
      <div data-testid="comments-error" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: SPACE.xs }}>
        <p style={{ ...body, color: t.text, margin: 0 }}>
          {isPermissionError(error) ? "You don't have access to this." : "Something went wrong."}
        </p>
        <Button type="button" variant="outline" onClick={onRetry} style={SECONDARY}>
          Try again
        </Button>
      </div>
    );
  }

  if (loading) {
    // STATES.md row 20: the rows' shape before the rows.
    return (
      <div data-testid="comments-loading" aria-hidden style={{ display: "flex", flexDirection: "column", gap: SPACE.md }}>
        {[0, 1].map((index) => (
          <div key={index} style={{ display: "flex", gap: SPACE.xs }}>
            <div style={{ ...skeletonStyle(), width: 32, height: 32, borderRadius: r.full, flexShrink: 0 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs, flex: 1 }}>
              <div style={{ ...skeletonStyle(), height: 16, width: "40%" }} />
              <div style={{ ...skeletonStyle(), height: 16, width: "80%" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    // STATES.md row 19: the composer above is the one action.
    return (
      <p data-testid="comments-empty" style={{ ...body, color: t.text2, margin: 0 }}>
        No comments yet.
      </p>
    );
  }

  return (
    <ol
      data-testid="comments-list"
      style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: SPACE.md }}
    >
      {threads.map((thread) => (
        <li key={thread.id}>
          <Thread thread={thread} {...props} />
        </li>
      ))}
    </ol>
  );
}

function Thread({ thread, ...props }: { thread: CommentThread } & ListProps) {
  const [replying, setReplying] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
      <CommentItem
        comment={thread}
        {...props}
        onReplyPress={props.canWrite ? () => setReplying(true) : undefined}
        onDelete={() => props.onDelete(thread)}
      />
      {thread.replies.length > 0 || replying ? (
        <ol
          data-testid="comment-replies"
          style={{
            listStyle: "none",
            margin: 0,
            // 24 in: the 1px hairline and 23 of padding.
            paddingInlineStart: SPACE.md - 1,
            borderInlineStart: `1px solid ${t.line}`,
            display: "flex",
            flexDirection: "column",
            gap: SPACE.sm,
          }}
        >
          {thread.replies.map((reply) => (
            <li key={reply.id}>
              <CommentItem comment={reply} {...props} onDelete={() => props.onDelete(reply)} />
            </li>
          ))}
          {replying ? (
            <li>
              <InlineBox
                label={`Reply to ${nameOf(thread)}`}
                submitLabel="Post reply"
                onCancel={() => setReplying(false)}
                onSubmit={async (text) => {
                  await props.onReply(thread, text);
                  setReplying(false);
                }}
                onRefused={props.onRefused}
              />
            </li>
          ) : null}
        </ol>
      ) : null}
    </div>
  );
}

function nameOf(comment: BuildComment): string {
  return comment.author?.displayName?.trim() || (comment.author?.username ? `@${comment.author.username}` : "Someone");
}

function partText(label: PartLabel | null): string {
  return label ? `on part ${label.position} · ${label.title}` : "on a part";
}

function CommentItem({
  comment,
  parts,
  viewerId,
  canWrite,
  onOpenPart,
  onEdit,
  onDelete,
  onReport,
  onRefused,
  onReplyPress,
}: {
  comment: BuildComment;
  onReplyPress?: () => void;
  onDelete: () => void;
} & Pick<ListProps, "parts" | "viewerId" | "canWrite" | "onOpenPart" | "onEdit" | "onReport" | "onRefused">) {
  const [editing, setEditing] = useState(false);
  const own = viewerId !== null && viewerId === comment.authorId;
  // RC-P17b: a signed-in reader may report somebody else's comment, unless an
  // admin has already hidden it.
  const canReport = canWrite && !own && !comment.isHidden;
  const name = nameOf(comment);
  const username = comment.author?.username ?? null;
  const part = comment.nodeId ? parts.get(comment.nodeId) ?? null : null;

  return (
    <article
      data-testid="comment"
      data-comment-id={comment.id}
      aria-label={`Comment by ${name}`}
      style={{ display: "flex", gap: SPACE.xs, alignItems: "flex-start" }}
    >
      <Avatar style={{ width: 32, height: 32, flexShrink: 0 }}>
        {comment.author?.avatarUrl ? <AvatarImage src={comment.author.avatarUrl} alt="" /> : null}
        <AvatarFallback style={{ background: t.recess, color: t.text2, ...dataText }}>
          {name.replace(/^@/, "").slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs, flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", columnGap: SPACE.xs }}>
          {username ? (
            <NameLink to={`/profile/${encodeURIComponent(username)}`}>{name}</NameLink>
          ) : (
            <span style={{ ...body, fontWeight: 600, color: t.text }}>{name}</span>
          )}
          <time
            dateTime={comment.createdAt}
            style={{ fontFamily: DM_MONO, fontSize: 12, fontWeight: 400, lineHeight: 1.3, color: t.text2 }}
          >
            {commentTime(comment.createdAt)}
            {comment.editedAt ? " · edited" : ""}
            {/* RC-P17b: only its author and admins still read a hidden comment. */}
            {comment.isHidden ? " · hidden by an admin" : ""}
          </time>
        </div>

        {comment.nodeId ? (
          <button
            type="button"
            data-testid="comment-part"
            onClick={() => onOpenPart(comment.nodeId as string)}
            style={{
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              minHeight: 44,
              padding: 0,
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            <span style={{ ...chipStyle("outline"), padding: "2px 8px" }}>{partText(part)}</span>
          </button>
        ) : null}

        {editing ? (
          <InlineBox
            label="Edit your comment"
            submitLabel="Save"
            initial={comment.body}
            onCancel={() => setEditing(false)}
            onSubmit={async (text) => {
              await onEdit(comment, text);
              setEditing(false);
            }}
            onRefused={onRefused}
          />
        ) : (
          // Plain text, line breaks kept. Never HTML.
          <p
            data-testid="comment-body"
            style={{ ...body, ...measure, color: t.text, margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {comment.body}
          </p>
        )}

        {!editing && (onReplyPress || own || canReport) ? (
          <div
            data-testid="comment-actions"
            style={{ display: "flex", alignItems: "center", flexWrap: "wrap", marginInlineStart: -SPACE.xs }}
          >
            {onReplyPress && comment.parentId === null ? <TextAction label="Reply" onPress={onReplyPress} /> : null}
            {/* RC-P17b: somebody else's comment can be reported, after Reply. */}
            {canReport ? <TextAction label="Report" onPress={() => onReport(comment)} /> : null}
            {own ? <TextAction label="Edit" onPress={() => setEditing(true)} /> : null}
            {own ? (
              // Destructive, last, and 16 further along (STATES.md row 16).
              <span style={{ marginInlineStart: SPACE.sm }}>
                <TextAction label="Delete" onPress={onDelete} />
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** A reply or an edit, in place: a box, a secondary submit, a tertiary Cancel. */
function InlineBox({
  label,
  submitLabel,
  initial = "",
  onCancel,
  onSubmit,
  onRefused,
}: {
  label: string;
  submitLabel: string;
  initial?: string;
  onCancel: () => void;
  onSubmit: (text: string) => Promise<void>;
  onRefused: (error: unknown) => void;
}) {
  const [text, setText] = useState(initial);
  const [sending, setSending] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement | null>(null);
  const empty = text.trim().length === 0;

  useEffect(() => {
    boxRef.current?.focus();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (empty || sending) return;
    setSending(true);
    try {
      await onSubmit(text);
    } catch (error) {
      onRefused(error);
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
      <TextBox boxRef={boxRef} label={label} value={text} onChange={setText} />
      <div style={{ display: "flex", alignItems: "center", gap: SPACE.xs }}>
        <Button type="submit" variant="outline" disabled={empty || sending} style={SECONDARY}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} style={{ minHeight: 44 }}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** A tertiary text action on a comment: --text2, no fill, 44 tall. */
function TextAction({ label, onPress }: { label: string; onPress: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onPress}
      {...handlers}
      style={{
        ...buttonStyle("ghost", state),
        ...labelType,
        minHeight: 44,
        padding: `0 ${SPACE.xs}px`,
      }}
    >
      {label}
    </button>
  );
}

/** A tertiary icon-only action, 44 by 44. */
function IconAction({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onPress}
      {...handlers}
      style={{
        ...buttonStyle("ghost", state),
        minWidth: 44,
        minHeight: 44,
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
}

/** The author's name, to their profile, with the theme's one focus ring. */
function NameLink({ to, children }: { to: string; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={to}
      {...handlers}
      style={{
        ...body,
        fontWeight: 600,
        color: t.text,
        textDecoration: "none",
        borderRadius: r.chip,
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </Link>
  );
}

export default Comments;
