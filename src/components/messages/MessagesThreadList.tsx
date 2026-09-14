// BG-P26. The thread list, repainted onto the two-theme token set.
//
// WHAT WAS HERE. Forty-three hard-coded colours, every one of them assuming a
// dark ground: white at nine different alphas for text and hairlines, #E8571A
// for the active edge and the unread badge, and #F59E0B / #22C55E / #14B8A6 for
// the type pills. On Exhibition that renders white-on-light — the list was
// legible in one room only.
//
// WHAT CHANGED, AND WHAT DID NOT. Colour, radius and type only. Every height,
// width, padding and flex rule in this file is untouched: the 72px row, the
// 52px header, the 40px tab strip and the 28px search field are all structural
// and BG-P26 has no business moving them.
//
// THE UNREAD COUNT IS `--text`, NOT `--action`. "Mono on --action at low alpha"
// reads at first like action-coloured ink, and that pairing is illegal: the hue
// on its own 14% ground measures 3.97:1 on Exhibition, under the 4.5 text floor.
// `--text` on the same ground is 10.85:1 there and 11.29:1 on Dusk, and it is
// the pairing BG-P26 names for the message bubble, which is the same ground.
//
// A pill was off-brand as of the radius scale, so the type pills and the unread
// badge take `--r-chip`; the avatar stack keeps `--r-full`, which is what that
// token is for.

import * as React from "react";
import {
  MessageSquare,
  Inbox,
  Search,
  PenSquare,
  FileText,
  LayoutGrid,
  Box,
  Pin,
  MessageCircleOff,
} from "lucide-react";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { r } from "@/lib/theme/radius";
import { categoryFill } from "@/lib/theme/category";
import { data as dataType, label as labelType, tabular } from "@/lib/theme/type";
import { uiTransition } from "@/lib/theme/controls";
import { Skeleton } from "@/components/ui/skeleton";

type ThreadType = "direct" | "group" | "bounty" | "blueprint";
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
  width?: number;
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
          style={{ height: 72, padding: "10px 14px" }}
        >
          <Skeleton style={{ width: 32, height: 32, borderRadius: "50%" }} />
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
  // hue already measured against each other in both rooms: a bounty is a gap,
  // a blueprint is instructions, and a group is not a part category at all, so
  // it takes the fallback pair.
  const config = {
    group: { label: "Group", ...categoryFill("narrative") },
    bounty: { label: "Bounty", ...categoryFill("breakage") },
    blueprint: { label: "Blueprint", ...categoryFill("instruction") },
  }[type];

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
        style={{ width: 32, height: 32, background: t.recess }}
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
    <div className="relative flex-shrink-0" style={{ width: 32, height: 32 }}>
      {displayUrls.map((url, i) => (
        <div
          key={i}
          className="absolute overflow-hidden rounded-full"
          style={{
            width: 20,
            height: 20,
            left: i * 6,
            top: i * 2,
            zIndex: displayUrls.length - i,
            // The ring that separates overlapping avatars was `border-black/50`,
            // which is invisible on Dusk and a smear on Exhibition. The page
            // ground is the correct colour for a cut-out against the list.
            border: `1px solid ${t.bg}`,
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

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex w-full flex-col gap-1 text-left"
      style={{
        height: 72,
        padding: "10px 14px",
        // Rows sit on the page ground, lift to `--recess` on hover, and the
        // active thread carries an `--action` left edge over a faint wash of the
        // same hue. The edge stays 2px in both states so the row's content does
        // not shift by two pixels when it becomes active.
        background: isActive
          ? tokenAlpha("action", 0.08)
          : isHovered
            ? t.recess
            : t.bg,
        borderLeft: `2px solid ${isActive ? t.action : "transparent"}`,
      }}
    >
      <div className="flex items-center gap-2" style={{ height: 24 }}>
        <AvatarStack urls={thread.avatarUrls} />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="truncate"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: t.text,
            }}
          >
            {thread.title}
          </span>
          <TypePill type={thread.type} />
          {thread.isPinned && (
            <Pin size={10} style={{ color: t.text2, flexShrink: 0 }} />
          )}
        </div>
        {/* A timestamp is data, so it takes the mono face and tabular digits —
            a column of them lines up instead of jittering. 10px is below the
            role's own size, which is why the family is taken rather than the
            whole role: the row's height is structural and 13px mono would not
            fit it. */}
        <span
          className="flex-shrink-0"
          style={{
            fontFamily: dataType.fontFamily,
            ...tabular,
            fontSize: "10px",
            fontWeight: 400,
            color: t.text2,
          }}
        >
          {thread.lastMessage.timestamp}
        </span>
      </div>

      <div
        className="flex items-center gap-2"
        style={{ height: 24, paddingLeft: 40 }}
      >
        <div
          className="min-w-0 flex-1 truncate"
          style={{
            fontSize: "11px",
            fontWeight: 400,
            color: t.text2,
          }}
        >
          {thread.lastMessage.kind === "content-share" ? (
            <ContentSharePreview
              contentType={thread.lastMessage.contentType}
              preview={thread.lastMessage.preview}
            />
          ) : (
            <span>
              {thread.lastMessage.isFromCurrentUser ? "You: " : ""}
              {thread.lastMessage.preview}
            </span>
          )}
        </div>
        {thread.unreadCount > 0 && (
          <>
            {thread.unreadCount === 1 ? (
              // A single unread is a dot, and a dot is a mark rather than type,
              // so solid `--action` is legal here at the 3.0:1 UI floor.
              <span
                className="flex-shrink-0 rounded-full"
                style={{ width: 6, height: 6, background: t.action }}
              />
            ) : (
              <span
                className="flex flex-shrink-0 items-center justify-center"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: r["r-chip"],
                  fontFamily: dataType.fontFamily,
                  ...tabular,
                  fontSize: "9px",
                  fontWeight: 500,
                  color: t.text,
                  background: tokenAlpha("action", 0.14),
                }}
              >
                {thread.unreadCount > 9 ? "9+" : thread.unreadCount}
              </span>
            )}
          </>
        )}
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
        height: "100%",
        background: t.bg,
        borderRight: `0.5px solid ${t.line}`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{
          height: 52,
          padding: "12px 14px",
          borderBottom: `0.5px solid ${t.line}`,
        }}
      >
        <span
          style={{
            fontFamily: labelType.fontFamily,
            fontSize: "18px",
            fontWeight: 700,
            color: t.text,
          }}
        >
          Messages
        </span>
        <button
          onClick={onCompose}
          className="flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: r["r-control"],
            color: t.text2,
            transition: uiTransition(),
          }}
          title="Compose new message"
        >
          <PenSquare size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div
        className="flex"
        style={{
          height: 40,
          borderBottom: `0.5px solid ${t.line}`,
        }}
      >
        <button
          onClick={() => onTabChange("primary")}
          className="flex flex-1 items-center justify-center gap-1.5"
          style={{
            fontFamily: labelType.fontFamily,
            fontSize: "12px",
            fontWeight: 500,
            color: activeTab === "primary" ? t.text : t.text2,
            borderBottom: `2px solid ${activeTab === "primary" ? t.action : "transparent"}`,
          }}
        >
          <MessageSquare size={14} />
          Primary
        </button>
        <button
          onClick={() => onTabChange("requests")}
          className="flex flex-1 items-center justify-center gap-1.5"
          style={{
            fontFamily: labelType.fontFamily,
            fontSize: "12px",
            fontWeight: 500,
            color: activeTab === "requests" ? t.text : t.text2,
            borderBottom: `2px solid ${activeTab === "requests" ? t.action : "transparent"}`,
          }}
        >
          <Inbox size={14} />
          Requests
          {counts.requests > 0 && (
            <span
              className="flex items-center justify-center"
              style={{
                minWidth: 16,
                height: 16,
                padding: "0 4px",
                borderRadius: r["r-chip"],
                fontFamily: dataType.fontFamily,
                ...tabular,
                fontSize: "9px",
                fontWeight: 500,
                color: t.text,
                background: tokenAlpha("action", 0.14),
              }}
            >
              {counts.requests > 99 ? "99+" : counts.requests}
            </span>
          )}
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: "6px 14px" }}>
        <div
          className="flex items-center gap-2"
          style={{
            height: 28,
            padding: "0 10px",
            background: t.recess,
            border: `0.5px solid ${t.line}`,
            borderRadius: r["r-control"],
          }}
        >
          <Search size={12} style={{ color: t.text2 }} />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search conversations..."
            className="flex-1 bg-transparent outline-none placeholder:text-[var(--text2)]"
            style={{
              fontFamily: labelType.fontFamily,
              fontSize: "12px",
              fontWeight: 400,
              color: t.text,
            }}
          />
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {loading && sortedThreads.length === 0 ? (
          <ThreadListSkeleton />
        ) : sortedThreads.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            {threads.length === 0 && !query ? (
              <>
                <MessageCircleOff size={64} style={{ color: t.line }} />
                <span
                  style={{
                    fontFamily: labelType.fontFamily,
                    fontSize: "13px",
                    fontWeight: 500,
                    color: t.text,
                  }}
                >
                  No conversations yet
                </span>
                <span
                  style={{
                    fontFamily: labelType.fontFamily,
                    fontSize: "12px",
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
                  fontSize: "12px",
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
