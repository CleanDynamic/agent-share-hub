// Synth 12 Part D: the list is a panel (Panel fill, radius 12): "Messages" as the h1 (20/600) with a round "Compose new
// message" button, the Primary and Requests pills, a search pill ("Search conversations"), then the threads: avatar 40,
// name 15/600, the time 13 Text 3 at the right, the last line 15 (Text when unread, Text 2 otherwise) and an 8px Mint square
// for unread. The open thread's row is Card-filled. What follows below is the BG-P26 history.
//
// BG-P26. The thread list, repainted onto the two-theme token set.
//
// WHAT WAS HERE. Forty-three hard-coded colours, every one of them assuming a
// dark ground: white at nine different alphas for text and hairlines, #E8571A
// for the active edge and the unread badge, and #F59E0B / #22C55E / #14B8A6 for
// the type pills. On Noon that renders white-on-light — the list was
// legible in one room only.
//
// WHAT CHANGED, AND WHAT DID NOT. Colour, radius and type only. Every height,
// width, padding and flex rule in this file is untouched: the 72px row, the
// 52px header, the 40px tab strip and the 28px search field are all structural
// and BG-P26 has no business moving them.
//
// THE UNREAD COUNT IS `--text`, NOT `--action`. "Mono on --action at low alpha"
// reads at first like action-coloured ink, and that pairing is illegal: the hue
// on its own 14% ground measures 3.97:1 on Noon, under the 4.5 text floor.
// `--text` on the same ground is 10.85:1 there and 11.29:1 on Dusk, and it is
// the pairing BG-P26 names for the message bubble, which is the same ground.
//
// A pill was off-brand as of the radius scale, so the type pills and the unread
// badge take `--r-chip`; the avatar stack keeps `--r-full`, which is what that
// token is for.

import * as React from "react";
import {
  Search,
  PenSquare,
  FileText,
  LayoutGrid,
  Box,
  Pin,
  MessageCircleOff,
} from "lucide-react";
import { t } from "@/lib/theme/tokens";
import { r } from "@/lib/theme/radius";
import { categoryFill } from "@/lib/theme/category";
import { label as labelType, tabular } from "@/lib/theme/type";
import { uiTransition } from "@/lib/theme/controls";
import { Skeleton } from "@/components/ui/skeleton";

type ThreadType = "direct" | "group" | "blueprint";
type ContentType = "blueprint" | "stage" | "block";

interface LastMessage {
  kind: "text" | "content-share";
  preview: string;
  contentType?: ContentType;
  isFromCurrentUser: boolean;
  timestamp: string;
}

interface Thread {
  id: string;
  type: ThreadType;
  title: string;
  avatarUrls: string[];
  lastMessage: LastMessage;
  unreadCount: number;
  isPinned: boolean;
}

interface MessagesThreadListProps {
  threads: Thread[];
  activeTab: "primary" | "requests";
  onTabChange: (tab: "primary" | "requests") => void;
  query: string;
  onQueryChange: (query: string) => void;
  activeThreadId: string | null;
  onThreadClick: (id: string) => void;
  onCompose: () => void;
  counts: { primary: number; requests: number };
  width?: number | string;
  /**
   * BG-P26. True while the first page of threads is still in flight.
   *
   * Without it the list showed "No conversations yet" during the load, which is
   * a different claim from "still loading" and the wrong one: a visitor with
   * twenty threads was told they had none, for as long as the query took.
   */
  loading?: boolean;
}

/**
 * The loading state: five rows at the real row height, so the list does not
 * jump when the threads land. A skeleton rather than a spinner — a spinner says
 * "wait", a skeleton says what is coming.
 */
function ThreadListSkeleton() {
  return (
    <div aria-busy="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex w-full items-center gap-2"
          style={{ height: 72, padding: "12px 16px" }}
        >
          <Skeleton style={{ width: 40, height: 40, borderRadius: "50%" }} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton
              style={{
                // Varying widths, so five rows do not read as a striped block.
                width: `${["62%", "48%", "70%", "54%", "44%"][i]}`,
                height: 11,
                borderRadius: r["r-chip"],
              }}
            />
            <Skeleton style={{ width: "84%", height: 9, borderRadius: r["r-chip"] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TypePill({ type }: { type: ThreadType }) {
  if (type === "direct") return null;

  // The three legacy badge hues are retired. Each type resolves into a part
  // category instead, through `categoryFill`, which hands back a ground and a
  // hue already measured against each other in both rooms: a blueprint is
  // instructions, and a group is not a part category at all, so it takes the
  // fallback pair. A thread of a retired type (an old request thread) is drawn as a group.
  const config = {
    group: { label: "Group", ...categoryFill("narrative") },
    blueprint: { label: "Blueprint", ...categoryFill("instruction") },
  }[type] ?? { label: "Group", ...categoryFill("narrative") };

  return (
    <span
      style={{
        fontSize: "9px",
        fontWeight: 500,
        letterSpacing: "0.04em",
        color: config.color,
        background: config.background,
        padding: "1px 6px",
        borderRadius: r["r-chip"],
      }}
    >
      {config.label}
    </span>
  );
}

function ContentSharePreview({
  contentType,
  preview,
}: {
  contentType?: ContentType;
  preview: string;
}) {
  // Same retirement as the type pills: the shared content types resolve into
  // part categories rather than carrying three invented hues.
  const config = {
    blueprint: { Icon: FileText, color: categoryFill("instruction").color },
    stage: { Icon: LayoutGrid, color: categoryFill("configuration").color },
    block: { Icon: Box, color: categoryFill("artefact").color },
  };

  const { Icon, color } = config[contentType || "blueprint"];

  return (
    <span className="flex items-center gap-1">
      <Icon size={10} style={{ color, flexShrink: 0 }} />
      <span style={{ color }}>{preview}</span>
    </span>
  );
}

function AvatarStack({ urls }: { urls: string[] }) {
  const displayUrls = urls.slice(0, 3);
  const extra = urls.length - 3;

  if (displayUrls.length <= 1) {
    return (
      <div
        className="relative flex-shrink-0 overflow-hidden rounded-full"
        style={{ width: 40, height: 40, background: t.control }}
      >
        {displayUrls[0] && (
          <img
            src={displayUrls[0]}
            alt=""
            className="h-full w-full object-cover"
            crossOrigin="anonymous"
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative flex-shrink-0" style={{ width: 40, height: 40 }}>
      {displayUrls.map((url, i) => (
        <div
          key={i}
          className="absolute overflow-hidden rounded-full"
          style={{
            width: 26,
            height: 26,
            left: i * 7,
            top: i * 3,
            zIndex: displayUrls.length - i,
            // The ring that separates overlapping avatars was `border-black/50`,
            // which is invisible on Dusk and a smear on Noon. The page
            // ground is the correct colour for a cut-out against the list.
            border: `1px solid ${t.surface}`,
          }}
        >
          <img
            src={url}
            alt=""
            className="h-full w-full object-cover"
            crossOrigin="anonymous"
          />
        </div>
      ))}
      {extra > 0 && (
        <span
          className="absolute flex items-center justify-center rounded-full"
          style={{
            width: 14,
            height: 14,
            right: 0,
            bottom: 0,
            fontSize: "8px",
            fontWeight: 600,
            color: t.text2,
            background: t.recess,
          }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

function ThreadItem({
  thread,
  isActive,
  onClick,
}: {
  thread: Thread;
  isActive: boolean;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = React.useState(false);
  const unread = thread.unreadCount > 0;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-current={isActive ? "true" : undefined}
      data-testid="thread-row"
      className="flex w-full items-start text-left"
      style={{
        gap: 12,
        minHeight: 72,
        padding: "12px",
        borderRadius: 12,
        boxSizing: "border-box",
        background: isActive || isHovered ? t.module : "transparent",
        transition: uiTransition(),
      }}
    >
      <AvatarStack urls={thread.avatarUrls} />
      <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 2 }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          <span className="truncate" style={{ fontSize: 15, lineHeight: "20px", fontWeight: 600, color: t.text }}>
            {thread.title}
          </span>
          <TypePill type={thread.type} />
          {thread.isPinned && <Pin size={12} aria-label="Pinned" style={{ color: t.label, flexShrink: 0 }} />}
          <span className="flex-shrink-0" style={{ marginLeft: "auto", fontSize: 13, lineHeight: "16px", fontWeight: 400, color: t.label, ...tabular }}>
            {thread.lastMessage.timestamp}
          </span>
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          <div className="min-w-0 flex-1 truncate" style={{ fontSize: 15, lineHeight: "20px", fontWeight: 400, color: unread ? t.text : t.text2 }}>
            {thread.lastMessage.kind === "content-share" ? (
              <ContentSharePreview contentType={thread.lastMessage.contentType} preview={thread.lastMessage.preview} />
            ) : (
              <span>
                {thread.lastMessage.isFromCurrentUser ? "You: " : ""}
                {thread.lastMessage.preview}
              </span>
            )}
          </div>
          {unread ? (
            <span data-testid="thread-unread" className="flex-shrink-0" style={{ width: 8, height: 8, borderRadius: 2, background: t.brandAccent }}>
              <span className="sr-only">{`${thread.unreadCount} unread`}</span>
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export function MessagesThreadList({
  threads,
  activeTab,
  onTabChange,
  query,
  onQueryChange,
  activeThreadId,
  onThreadClick,
  onCompose,
  counts,
  width = 320,
  loading = false,
}: MessagesThreadListProps) {
  // Pinned-first sort (parent already filtered/searched server-side)
  const sortedThreads = React.useMemo(() => {
    return [...threads].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });
  }, [threads]);

  return (
    <div
      className="flex flex-col flex-shrink-0"
      style={{
        width,
        maxWidth: "100%",
        height: "100%",
        background: t.surface,
        borderRadius: 12,
        overflow: "hidden",
        fontFamily: labelType.fontFamily,
      }}
    >
      {/* Head: the page's h1 and the round compose button. */}
      <div className="flex items-center justify-between" style={{ minHeight: 56, padding: "16px 16px 8px" }}>
        <h1 style={{ margin: 0, fontSize: 20, lineHeight: "24px", fontWeight: 600, color: t.text }}>Messages</h1>
        <button
          onClick={onCompose}
          className="flex items-center justify-center"
          aria-label="Compose new message"
          title="Compose new message"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: t.control,
            color: t.text,
            transition: uiTransition(),
          }}
        >
          <PenSquare size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex" style={{ gap: 8, padding: "0 16px 8px" }}>
        {(["primary", "requests"] as const).map((tab) => {
          const on = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              aria-pressed={on}
              className="flex items-center justify-center"
              style={{
                gap: 6,
                height: 32,
                padding: "0 14px",
                borderRadius: 16,
                fontSize: 13,
                fontWeight: on ? 600 : 500,
                color: on ? t.onInverse : t.text,
                background: on ? t.inverse : t.module,
              }}
            >
              {tab === "primary" ? "Primary" : "Requests"}
              {tab === "requests" && counts.requests > 0 ? <span style={{ ...tabular, fontWeight: 400 }}>{counts.requests > 99 ? "99+" : counts.requests}</span> : null}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ padding: "0 16px 8px" }}>
        <div
          className="flex items-center gap-2"
          style={{
            height: 40,
            padding: "0 14px",
            background: t.module,
            borderRadius: 20,
          }}
        >
          <Search size={16} style={{ color: t.label }} />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="flex-1 bg-transparent outline-none placeholder:text-[var(--label)]"
            style={{
              fontFamily: labelType.fontFamily,
              fontSize: 15,
              fontWeight: 400,
              color: t.text,
            }}
          />
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "0 4px 8px" }}>
        {loading && sortedThreads.length === 0 ? (
          <ThreadListSkeleton />
        ) : sortedThreads.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            {threads.length === 0 && !query ? (
              <>
                <MessageCircleOff size={48} style={{ color: t.label }} />
                <span
                  style={{
                    fontFamily: labelType.fontFamily,
                    fontSize: 15,
                    fontWeight: 600,
                    color: t.text,
                  }}
                >
                  No conversations yet
                </span>
                <span
                  style={{
                    fontFamily: labelType.fontFamily,
                    fontSize: 15,
                    fontWeight: 400,
                    color: t.text2,
                  }}
                >
                  Start one from any creator&apos;s profile
                </span>
              </>
            ) : (
              <span
                style={{
                  fontFamily: labelType.fontFamily,
                  fontSize: 15,
                  fontWeight: 400,
                  color: t.text2,
                }}
              >
                No conversations match
              </span>
            )}
          </div>
        ) : (
          sortedThreads.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              isActive={thread.id === activeThreadId}
              onClick={() => onThreadClick(thread.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
