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
}

function TypePill({ type }: { type: ThreadType }) {
  if (type === "direct") return null;

  const config = {
    group: {
      label: "Group",
      color: "rgba(255,255,255,0.55)",
      bg: "rgba(255,255,255,0.06)",
    },
    bounty: {
      label: "Bounty",
      color: "#F59E0B",
      bg: "rgba(245,158,11,0.10)",
    },
    blueprint: {
      label: "Blueprint",
      color: "#E8571A",
      bg: "rgba(232,87,26,0.10)",
    },
  }[type];

  return (
    <span
      style={{
        fontSize: "9px",
        fontWeight: 500,
        letterSpacing: "0.04em",
        color: config.color,
        background: config.bg,
        padding: "1px 6px",
        borderRadius: "100px",
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
  const config = {
    blueprint: { Icon: FileText, color: "#E8571A" },
    stage: { Icon: LayoutGrid, color: "#14B8A6" },
    block: { Icon: Box, color: "#22C55E" },
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
        style={{ width: 32, height: 32, background: "rgba(255,255,255,0.06)" }}
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
          className="absolute overflow-hidden rounded-full border border-black/50"
          style={{
            width: 20,
            height: 20,
            left: i * 6,
            top: i * 2,
            zIndex: displayUrls.length - i,
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
            color: "rgba(255,255,255,0.70)",
            background: "rgba(255,255,255,0.10)",
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
        background: isActive
          ? "rgba(232,87,26,0.06)"
          : isHovered
            ? "rgba(255,255,255,0.03)"
            : "transparent",
        borderLeft: isActive ? "2px solid #E8571A" : "2px solid transparent",
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
              color: "rgba(255,255,255,0.92)",
            }}
          >
            {thread.title}
          </span>
          <TypePill type={thread.type} />
          {thread.isPinned && (
            <Pin
              size={10}
              style={{ color: "rgba(255,255,255,0.40)", flexShrink: 0 }}
            />
          )}
        </div>
        <span
          className="flex-shrink-0"
          style={{
            fontSize: "10px",
            fontWeight: 400,
            color: "rgba(255,255,255,0.40)",
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
            color: "rgba(255,255,255,0.55)",
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
              <span
                className="flex-shrink-0 rounded-full"
                style={{ width: 6, height: 6, background: "#E8571A" }}
              />
            ) : (
              <span
                className="flex flex-shrink-0 items-center justify-center rounded-full"
                style={{
                  width: 16,
                  height: 16,
                  fontSize: "9px",
                  fontWeight: 600,
                  color: "#fff",
                  background: "#E8571A",
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
        width: 320,
        height: "100%",
        borderRight: "0.5px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{
          height: 52,
          padding: "12px 14px",
          borderBottom: "0.5px solid rgba(255,255,255,0.06)",
        }}
      >
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "18px",
            fontWeight: 700,
            color: "rgba(255,255,255,0.95)",
          }}
        >
          Messages
        </span>
        <button
          onClick={onCompose}
          className="flex items-center justify-center transition-colors hover:bg-white/5"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            color: "rgba(255,255,255,0.70)",
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
          borderBottom: "0.5px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          onClick={() => onTabChange("primary")}
          className="flex flex-1 items-center justify-center gap-1.5"
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "12px",
            fontWeight: 500,
            color:
              activeTab === "primary"
                ? "rgba(255,255,255,0.95)"
                : "rgba(255,255,255,0.55)",
            borderBottom:
              activeTab === "primary"
                ? "2px solid #E8571A"
                : "2px solid transparent",
          }}
        >
          <MessageSquare size={14} />
          Primary
        </button>
        <button
          onClick={() => onTabChange("requests")}
          className="flex flex-1 items-center justify-center gap-1.5"
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "12px",
            fontWeight: 500,
            color:
              activeTab === "requests"
                ? "rgba(255,255,255,0.95)"
                : "rgba(255,255,255,0.55)",
            borderBottom:
              activeTab === "requests"
                ? "2px solid #E8571A"
                : "2px solid transparent",
          }}
        >
          <Inbox size={14} />
          Requests
          {counts.requests > 0 && (
            <span
              className="flex items-center justify-center rounded-full"
              style={{
                minWidth: 16,
                height: 16,
                padding: "0 4px",
                fontSize: "9px",
                fontWeight: 600,
                color: "#fff",
                background: "#E8571A",
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
            background: "rgba(30,30,40,0.50)",
            border: "0.5px solid rgba(255,255,255,0.08)",
            borderRadius: 6,
          }}
        >
          <Search size={12} style={{ color: "rgba(255,255,255,0.40)" }} />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search conversations..."
            className="flex-1 bg-transparent outline-none placeholder:text-white/40"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "12px",
              fontWeight: 400,
              color: "rgba(255,255,255,0.85)",
            }}
          />
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {sortedThreads.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            {threads.length === 0 && !query ? (
              <>
                <MessageCircleOff
                  size={64}
                  style={{ color: "rgba(255,255,255,0.20)" }}
                />
                <span
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.70)",
                  }}
                >
                  No conversations yet
                </span>
                <span
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "12px",
                    fontWeight: 400,
                    color: "rgba(255,255,255,0.40)",
                  }}
                >
                  Start one from any creator&apos;s profile
                </span>
              </>
            ) : (
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "12px",
                  fontWeight: 400,
                  color: "rgba(255,255,255,0.50)",
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
