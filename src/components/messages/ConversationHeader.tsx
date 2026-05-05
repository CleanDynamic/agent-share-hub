import * as React from "react";
import { ArrowLeft, Search, Settings, ChevronDown, ChevronUp, FileText, Coins, Users, Pin } from "lucide-react";

export type ConversationThreadType = "direct" | "group" | "bounty" | "blueprint";

export interface ConversationHeaderThread {
  id: string;
  type: ConversationThreadType;
  title: string;
  subtitle?: string | null;
  avatarUrls: string[];
  memberCount: number;
  pinnedContent?: {
    id: string;
    type: "bounty" | "blueprint" | string;
    title: string;
    slug: string | null;
    /** Bounty reward summary, e.g. "£250" or "100 credits" */
    rewardLabel?: string | null;
    /** Bounty status badge, e.g. "Open", "In progress" */
    statusLabel?: string | null;
  } | null;
}

interface ConversationHeaderProps {
  thread: ConversationHeaderThread;
  onBack: () => void;
  onSearchInThread: () => void;
  onSettings: () => void;
  onOpenPinnedContent: () => void;
}

const initials = (n: string) => (n || "?").slice(0, 2).toUpperCase();

function HeaderAvatar({ urls, fallback }: { urls: string[]; fallback: string }) {
  if (urls.length <= 1) {
    return (
      <div
        className="relative flex-shrink-0 overflow-hidden rounded-full flex items-center justify-center"
        style={{
          width: 36,
          height: 36,
          background: "rgba(255, 255, 255, 0.14)",
          color: "rgba(255,255,255,0.55)",
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {urls[0] ? (
          <img src={urls[0]} alt="" className="h-full w-full object-cover" />
        ) : (
          <span>{initials(fallback)}</span>
        )}
      </div>
    );
  }
  const display = urls.slice(0, 3);
  return (
    <div className="relative flex-shrink-0" style={{ width: 36, height: 36 }}>
      {display.map((url, i) => (
        <div
          key={i}
          className="absolute overflow-hidden rounded-full"
          style={{
            width: 22,
            height: 22,
            left: i * 7,
            top: i * 3,
            zIndex: display.length - i,
            border: "1.5px solid #25252F",
          }}
        >
          <img src={url} alt="" className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}

function PinnedContextStrip({
  thread,
  collapsed,
  onToggleCollapsed,
  onOpenPinnedContent,
}: {
  thread: ConversationHeaderThread;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenPinnedContent: () => void;
}) {
  const pinned = thread.pinnedContent;
  if (!pinned) return null;

  const isBounty = thread.type === "bounty";
  const accent = isBounty ? "#F59E0B" : "#E8571A";
  const accentBg = isBounty ? "rgba(245,158,11,0.06)" : "rgba(232,87,26,0.06)";
  const accentBorder = isBounty ? "rgba(245,158,11,0.20)" : "rgba(232,87,26,0.20)";
  const Icon = isBounty ? Coins : FileText;

  return (
    <div
      className="flex flex-col"
      style={{
        background: accentBg,
        borderBottom: "0.5px solid rgba(255, 255, 255, 0.14)",
      }}
    >
      <button
        onClick={onToggleCollapsed}
        className="flex items-center justify-between w-full text-left transition-colors hover:bg-white/[0.02]"
        style={{
          padding: "8px 14px",
          height: 36,
          borderBottom: collapsed ? "none" : `0.5px solid ${accentBorder}`,
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Pin size={11} style={{ color: accent, flexShrink: 0 }} />
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: accent,
            }}
          >
            {isBounty ? "Pinned bounty" : "Pinned blueprint"}
          </span>
        </div>
        {collapsed ? (
          <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.55)" }} />
        ) : (
          <ChevronUp size={14} style={{ color: "rgba(255,255,255,0.55)" }} />
        )}
      </button>

      {!collapsed && (
        <div style={{ padding: "10px 14px 12px" }}>
          <div className="flex items-start gap-3">
            <div
              className="flex items-center justify-center rounded-md flex-shrink-0"
              style={{
                width: 36,
                height: 36,
                background: "rgba(255, 255, 255, 0.12)",
                border: `0.5px solid ${accentBorder}`,
              }}
            >
              <Icon size={16} style={{ color: accent }} />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="truncate"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                {pinned.title}
              </p>
              {(pinned.rewardLabel || pinned.statusLabel) && (
                <div className="flex items-center gap-2 mt-0.5">
                  {pinned.rewardLabel && (
                    <span
                      style={{
                        fontFamily: "Inter, sans-serif",
                        fontSize: 11,
                        fontWeight: 600,
                        color: accent,
                      }}
                    >
                      {pinned.rewardLabel}
                    </span>
                  )}
                  {pinned.statusLabel && (
                    <span
                      style={{
                        fontFamily: "Inter, sans-serif",
                        fontSize: 10,
                        fontWeight: 500,
                        color: "rgba(255,255,255,0.55)",
                        padding: "1px 6px",
                        borderRadius: 100,
                        background: "rgba(255, 255, 255, 0.14)",
                      }}
                    >
                      {pinned.statusLabel}
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={onOpenPinnedContent}
              className="flex-shrink-0 transition-colors hover:bg-white/5"
              style={{
                padding: "5px 10px",
                borderRadius: 6,
                border: `0.5px solid ${accentBorder}`,
                color: accent,
                fontFamily: "Inter, sans-serif",
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              View {isBounty ? "bounty" : "blueprint"} →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ConversationHeader({
  thread,
  onBack,
  onSearchInThread,
  onSettings,
  onOpenPinnedContent,
}: ConversationHeaderProps) {
  const showPinned = thread.type === "bounty" || thread.type === "blueprint";
  const storageKey = `pinned-context-collapsed:${thread.id}`;

  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(storageKey) === "1";
  });

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [storageKey]);

  const memberSubtitle =
    thread.type === "direct"
      ? thread.subtitle ?? null
      : `${thread.memberCount} member${thread.memberCount === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-col flex-shrink-0">
      {/* Top bar */}
      <div
        className="flex items-center gap-3"
        style={{
          height: 56,
          padding: "0 14px",
          borderBottom: "0.5px solid rgba(255, 255, 255, 0.14)",
          background: "rgba(8,8,12,0.85)",
          backdropFilter: "blur(8px)",
        }}
      >
        <button
          onClick={onBack}
          className="lg:hidden flex items-center justify-center transition-colors hover:bg-white/5 flex-shrink-0"
          style={{ width: 28, height: 28, borderRadius: 6, color: "rgba(255,255,255,0.70)" }}
          title="Back"
        >
          <ArrowLeft size={16} />
        </button>

        <HeaderAvatar urls={thread.avatarUrls} fallback={thread.title} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="truncate"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 14,
                fontWeight: 700,
                color: "rgba(255,255,255,0.95)",
              }}
            >
              {thread.title}
            </span>
            {thread.type !== "direct" && (
              <span
                className="flex items-center gap-1 flex-shrink-0"
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.55)",
                  padding: "1px 6px",
                  borderRadius: 100,
                  background: "rgba(255, 255, 255, 0.14)",
                }}
              >
                <Users size={9} />
                {thread.memberCount}
              </span>
            )}
          </div>
          {memberSubtitle && (
            <p
              className="truncate"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 11,
                fontWeight: 400,
                color: "rgba(255,255,255,0.50)",
                marginTop: 1,
              }}
            >
              {memberSubtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onSearchInThread}
            className="flex items-center justify-center transition-colors hover:bg-white/5"
            style={{ width: 28, height: 28, borderRadius: 6, color: "rgba(255,255,255,0.70)" }}
            title="Search in conversation"
          >
            <Search size={14} />
          </button>
          <button
            onClick={onSettings}
            className="flex items-center justify-center transition-colors hover:bg-white/5"
            style={{ width: 28, height: 28, borderRadius: 6, color: "rgba(255,255,255,0.70)" }}
            title="Conversation settings"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Pinned context strip */}
      {showPinned && thread.pinnedContent && (
        <PinnedContextStrip
          thread={thread}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          onOpenPinnedContent={onOpenPinnedContent}
        />
      )}
    </div>
  );
}
