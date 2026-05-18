import React, { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  PlusCircle,
  Trophy,
  Sparkles,
  Users,
  TrendingUp,
  Clock,
  ChevronUp,
} from "lucide-react";

export type FeedTabKey = "foryou" | "following" | "trending" | "recent" | "bounties";

export interface BountyPreview {
  id: string;
  slug?: string | null;
  title: string;
  reward: string;
  endsIn: string;
}

export interface FeedCurrentUser {
  displayName: string;
  handle: string;
  avatarUrl?: string;
  initials: string;
}

interface FeedShellProps {
  currentUser: FeedCurrentUser | null;
  activeTab: FeedTabKey;
  onTabChange: (tab: FeedTabKey) => void;
  activeBounties: BountyPreview[];
  onBountySeeAll?: () => void;
  onBountyClick?: (b: BountyPreview) => void;
  feedCards: React.ReactNode[];
  isLoading: boolean;
  hasNewPosts: boolean;
  newPostCount: number;
  onLoadNewPosts: () => void;
  onComposeClick: () => void;
  isEmpty: boolean;
  onEmptyCTAClick: () => void;
  liveActive: boolean;
}

const TABS: { key: FeedTabKey; label: string }[] = [
  { key: "foryou", label: "For You" },
  { key: "following", label: "Following" },
  { key: "trending", label: "Trending" },
  { key: "recent", label: "Recent" },
  { key: "bounties", label: "Bounties" },
];

const EMPTY_STATES: Record<
  FeedTabKey,
  { icon: React.ElementType; headline: string; body: string; cta?: string }
> = {
  foryou: {
    icon: Sparkles,
    headline: "Your feed is waiting",
    body: "Follow a few creators or open Discover to start filling this with content worth your attention.",
    cta: "Open Discover",
  },
  following: {
    icon: Users,
    headline: "No recent activity from people you follow",
    body: "When the creators you follow publish, share, or comment, it appears here. Try Discover to find more.",
    cta: "Open Discover",
  },
  trending: {
    icon: TrendingUp,
    headline: "Nothing trending right now",
    body: "Trending posts update throughout the day. Check back in an hour or two.",
  },
  recent: {
    icon: Clock,
    headline: "No recent posts",
    body: "When new content is published, it appears here first.",
  },
  bounties: {
    icon: Trophy,
    headline: "No active bounties",
    body: "When community challenges open, they appear here. You can also start your own.",
    cta: "Start a bounty",
  },
};

function UserAvatar({ avatarUrl, initials }: { avatarUrl?: string; initials: string }) {
  return (
    <div
      className="shrink-0 rounded-full overflow-hidden flex items-center justify-center"
      style={{
        width: 34,
        height: 34,
        background: "rgba(232,87,26,0.9)",
        color: "#fff",
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "Inter, sans-serif",
      }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

function ComposeStrip({
  currentUser,
  onComposeClick,
}: {
  currentUser: FeedCurrentUser;
  onComposeClick: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 mx-6 mt-7 mb-5"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 14,
        padding: "12px 16px",
      }}
    >
      <UserAvatar avatarUrl={currentUser.avatarUrl} initials={currentUser.initials} />
      <button
        onClick={onComposeClick}
        className="flex-1 text-left transition-colors"
        style={{
          fontSize: 14,
          fontWeight: 300,
          color: "rgba(255,255,255,0.45)",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: "Inter, sans-serif",
        }}
      >
        Share something…
      </button>
      <button
        onClick={onComposeClick}
        className="shrink-0 flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
        style={{
          padding: "7px 12px",
          borderRadius: 100,
          background: "rgba(232,87,26,0.9)",
          color: "#fff",
          border: "none",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <PlusCircle className="h-3.5 w-3.5" />
        New
      </button>
    </div>
  );
}

function ActiveCompetitionsStrip({
  bounties,
  onSeeAll,
  onBountyClick,
}: {
  bounties: BountyPreview[];
  onSeeAll?: () => void;
  onBountyClick?: (b: BountyPreview) => void;
}) {
  if (bounties.length === 0) return null;
  return (
    <div className="mx-6 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4" style={{ color: "#E8571A" }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(255,255,255,0.85)",
              letterSpacing: "0.04em",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Active competitions
          </span>
        </div>
        <button
          onClick={onSeeAll}
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.55)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          See all →
        </button>
      </div>
      <div
        className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1"
        style={{ scrollbarWidth: "none" }}
      >
        {bounties.map((bounty) => (
          <button
            key={bounty.id}
            onClick={() => onBountyClick?.(bounty)}
            className="shrink-0 text-left transition-colors"
            style={{
              width: 240,
              padding: 14,
              borderRadius: 12,
              background: "rgba(232,87,26,0.06)",
              border: "1px solid rgba(232,87,26,0.25)",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: "#E8571A",
                  background: "rgba(232,87,26,0.15)",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                BOUNTY
              </span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
                ends in {bounty.endsIn}
              </span>
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "rgba(255,255,255,0.92)",
                marginBottom: 8,
                lineHeight: 1.35,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {bounty.title}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#E8571A", marginBottom: 6 }}>
              {bounty.reward}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
              Submit a solution →
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function FeedTabBar({
  activeTab,
  onTabChange,
  liveActive,
}: {
  activeTab: FeedTabKey;
  onTabChange: (t: FeedTabKey) => void;
  liveActive: boolean;
}) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [underline, setUnderline] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const i = TABS.findIndex((t) => t.key === activeTab);
    const el = tabRefs.current[i];
    if (el) setUnderline({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeTab]);

  return (
    <div
      className="sticky top-0 z-10 flex items-center"
      style={{
        background: "rgba(8,8,12,0.80)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.14)",
        marginBottom: 20,
      }}
    >
      <div className="relative flex flex-1 px-2">
        {TABS.map((tab, i) => (
          <button
            key={tab.key}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            onClick={() => onTabChange(tab.key)}
            className="flex-1 cursor-pointer transition-colors"
            style={{
              padding: "12px 0",
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              fontWeight: 500,
              color: activeTab === tab.key ? "#E8571A" : "rgba(255,255,255,0.55)",
              background: "transparent",
              border: "none",
            }}
          >
            {tab.label}
          </button>
        ))}
        <motion.div
          animate={{ left: underline.left, width: underline.width }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          style={{
            position: "absolute",
            bottom: 0,
            height: 2,
            background: "#E8571A",
            borderRadius: 1,
          }}
        />
      </div>
      {liveActive && (
        <div className="flex items-center gap-1.5 px-4">
          <span className="relative flex h-[6px] w-[6px]">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-primary" />
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "rgba(232,87,26,0.85)",
              fontFamily: "Inter, sans-serif",
            }}
          >
            LIVE
          </span>
        </div>
      )}
    </div>
  );
}

function NewPostsPill({
  hasNewPosts,
  newPostCount,
  onLoadNewPosts,
}: {
  hasNewPosts: boolean;
  newPostCount: number;
  onLoadNewPosts: () => void;
}) {
  if (!hasNewPosts || newPostCount === 0) return null;
  const display = newPostCount > 20 ? "20+" : String(newPostCount);
  const noun = newPostCount === 1 ? "new post" : "new posts";
  return (
    <button
      onClick={onLoadNewPosts}
      className="fixed left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
      style={{
        top: 90,
        padding: "8px 16px",
        borderRadius: 100,
        background: "#E8571A",
        color: "#fff",
        border: "none",
        fontSize: 12,
        fontWeight: 600,
        boxShadow: "0 6px 20px rgba(232,87,26,0.4)",
        cursor: "pointer",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <ChevronUp className="h-3.5 w-3.5" />
      {display} {noun}
    </button>
  );
}

function FeedContentArea({
  activeTab,
  feedCards,
  isLoading,
  isEmpty,
  onEmptyCTAClick,
}: {
  activeTab: FeedTabKey;
  feedCards: React.ReactNode[];
  isLoading: boolean;
  isEmpty: boolean;
  onEmptyCTAClick: () => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-0">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 mx-6 mb-3 rounded-xl overflow-hidden relative"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
                animation: "ns-shimmer 1.6s infinite",
              }}
            />
          </div>
        ))}
        <style>{`@keyframes ns-shimmer { 0% { transform: translateX(-100%);} 100% { transform: translateX(100%);} }`}</style>
      </div>
    );
  }

  if (isEmpty) {
    const e = EMPTY_STATES[activeTab];
    const Icon = e.icon;
    return (
      <div className="flex flex-col items-center text-center px-6 py-16">
        <div
          className="flex items-center justify-center mb-5"
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(232,87,26,0.12)",
            border: "1px solid rgba(232,87,26,0.3)",
          }}
        >
          <Icon className="h-6 w-6" style={{ color: "#E8571A" }} />
        </div>
        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 20,
            fontWeight: 600,
            color: "rgba(255,255,255,0.92)",
            marginBottom: 8,
          }}
        >
          {e.headline}
        </div>
        <p
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.55)",
            maxWidth: 380,
            lineHeight: 1.5,
            marginBottom: e.cta ? 20 : 0,
            fontFamily: "Inter, sans-serif",
          }}
        >
          {e.body}
        </p>
        {e.cta && (
          <button
            onClick={onEmptyCTAClick}
            className="transition-transform hover:scale-105 active:scale-95"
            style={{
              padding: "9px 18px",
              borderRadius: 100,
              background: "rgba(232,87,26,0.15)",
              border: "1px solid rgba(232,87,26,0.45)",
              color: "#E8571A",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            {e.cta}
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {feedCards.map((card, i) => (
        <React.Fragment key={i}>
          {card}
          {(i + 1) % 5 === 0 && i < feedCards.length - 1 && (
            <div
              className="mx-6 my-4"
              style={{
                borderTop: "1px dotted rgba(255,255,255,0.14)",
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export function FeedShell({
  currentUser,
  activeTab,
  onTabChange,
  activeBounties,
  onBountySeeAll,
  onBountyClick,
  feedCards,
  isLoading,
  hasNewPosts,
  newPostCount,
  onLoadNewPosts,
  onComposeClick,
  isEmpty,
  onEmptyCTAClick,
  liveActive,
}: FeedShellProps) {
  return (
    <div style={{ paddingTop: 28 }}>
      <NewPostsPill
        hasNewPosts={hasNewPosts}
        newPostCount={newPostCount}
        onLoadNewPosts={onLoadNewPosts}
      />
      {currentUser && (
        <ComposeStrip currentUser={currentUser} onComposeClick={onComposeClick} />
      )}
      <ActiveCompetitionsStrip
        bounties={activeBounties}
        onSeeAll={onBountySeeAll}
        onBountyClick={onBountyClick}
      />
      <FeedTabBar activeTab={activeTab} onTabChange={onTabChange} liveActive={liveActive} />
      <FeedContentArea
        activeTab={activeTab}
        feedCards={feedCards}
        isLoading={isLoading}
        isEmpty={isEmpty}
        onEmptyCTAClick={onEmptyCTAClick}
      />
    </div>
  );
}

export default FeedShell;
