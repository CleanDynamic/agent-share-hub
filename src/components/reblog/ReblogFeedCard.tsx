"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Share2,
  MoreHorizontal,
  Play,
} from "lucide-react";
import {
  EmbeddedOriginalCard,
  type EmbeddedOriginalCardPost,
} from "@/components/reblog/EmbeddedOriginalCard";
import {
  EmbeddedExcerptCard,
  type Excerpt,
  type SourcePost,
} from "@/components/reblog/EmbeddedExcerptCard";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ReblogMedia {
  kind: "image" | "video";
  url: string;
  thumbnailUrl?: string;
}

export interface Reblog {
  id: string;
  slug: string;
  text: string;
  media?: ReblogMedia;
  rebloggerDisplayName: string;
  rebloggerHandle: string;
  rebloggerAvatarUrl: string;
  publishedAt: string;
  viaReblogTag?: boolean;
}

export interface Engagement {
  likeCount: number;
  hasLiked: boolean;
  commentCount: number;
  reblogCount: number;
  hasReblogged: boolean;
  bookmarkCount: number;
  hasBookmarked: boolean;
}

export interface ReblogFeedCardProps {
  reblog: Reblog;
  engagement: Engagement;
  embeddedOriginal: EmbeddedOriginalCardPost | null;
  variant: "feed" | "profile-zone";
  onReblogClick: () => void;
  onLikeClick: () => void;
  onCommentClick: () => void;
  onBookmarkClick: () => void;
  onShareClick: () => void;
  onRebloggerClick: () => void;
  onOriginalClick: () => void;
  onMore: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

/* ------------------------------------------------------------------ */
/*  Engagement row sub-component                                       */
/* ------------------------------------------------------------------ */

interface EngagementRowProps {
  engagement: Engagement;
  onLikeClick: () => void;
  onCommentClick: () => void;
  onReblogClick: () => void;
  onBookmarkClick: () => void;
  onShareClick: () => void;
}

function EngagementRow({
  engagement,
  onLikeClick,
  onCommentClick,
  onReblogClick,
  onBookmarkClick,
  onShareClick,
}: EngagementRowProps) {
  const iconBtn =
    "flex items-center gap-1.5 text-[13px] font-medium text-white/55 hover:text-white transition-colors";
  const stop =
    (fn: () => void) => (e: React.MouseEvent) => {
      e.stopPropagation();
      fn();
    };

  return (
    <div
      data-engagement-row
      className="flex items-center justify-between"
      style={{ marginTop: 12 }}
    >
      <div className="flex items-center gap-5">
        {/* Like */}
        <button
          onClick={stop(onLikeClick)}
          className={iconBtn}
          aria-label="Like"
        >
          <Heart
            size={16}
            className={engagement.hasLiked ? "fill-rose-500 text-rose-500" : ""}
          />
          {engagement.likeCount > 0 && (
            <span>{formatCount(engagement.likeCount)}</span>
          )}
        </button>

        {/* Comment */}
        <button
          onClick={stop(onCommentClick)}
          className={iconBtn}
          aria-label="Comment"
        >
          <MessageCircle size={16} />
          {engagement.commentCount > 0 && (
            <span>{formatCount(engagement.commentCount)}</span>
          )}
        </button>

        {/* Reblog */}
        <button
          onClick={stop(onReblogClick)}
          className={iconBtn}
          aria-label="Reblog"
        >
          <Repeat2
            size={16}
            className={engagement.hasReblogged ? "text-emerald-400" : ""}
          />
          {engagement.reblogCount > 0 && (
            <span>{formatCount(engagement.reblogCount)}</span>
          )}
        </button>

        {/* Bookmark */}
        <button
          onClick={stop(onBookmarkClick)}
          className={iconBtn}
          aria-label="Bookmark"
        >
          <Bookmark
            size={16}
            className={
              engagement.hasBookmarked ? "fill-white text-white" : ""
            }
          />
        </button>
      </div>

      {/* Share — right aligned */}
      <button
        onClick={stop(onShareClick)}
        className={iconBtn}
        aria-label="Share"
      >
        <Share2 size={16} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function ReblogFeedCard({
  reblog,
  engagement,
  embeddedOriginal,
  variant,
  onReblogClick,
  onLikeClick,
  onCommentClick,
  onBookmarkClick,
  onShareClick,
  onRebloggerClick,
  onOriginalClick,
  onMore,
}: ReblogFeedCardProps) {
  const [isClamped, setIsClamped] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const textRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    const el = textRef.current;
    if (el) {
      setIsClamped(el.scrollHeight > el.clientHeight + 1);
    }
  }, [reblog.text]);

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("[data-engagement-row]") ||
      target.closest("button") ||
      target.closest("a")
    ) {
      return;
    }
    window.location.href = `/b/${reblog.slug}`;
  };

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <article
      onClick={handleCardClick}
      className="cursor-pointer rounded-2xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
      style={{ padding: 16 }}
    >
      {/* TOP ROW */}
      <div className="flex items-center gap-2.5">
        {/* Avatar */}
        <button
          onClick={stop(onRebloggerClick)}
          className="shrink-0 cursor-pointer"
          aria-label={`View ${reblog.rebloggerDisplayName}'s profile`}
        >
          <img
            src={reblog.rebloggerAvatarUrl}
            alt=""
            className="rounded-full object-cover"
            style={{ width: 36, height: 36 }}
          />
        </button>

        {/* Name + Handle */}
        <button
          onClick={stop(onRebloggerClick)}
          className="flex items-baseline gap-1.5 min-w-0 cursor-pointer text-left"
        >
          <span
            className="font-semibold text-white truncate"
            style={{ fontSize: 14 }}
          >
            {reblog.rebloggerDisplayName}
          </span>
          <span
            className="text-white/50 truncate"
            style={{ fontSize: 13 }}
          >
            @{reblog.rebloggerHandle}
          </span>
        </button>

        {/* Reblog Pill */}
        <span
          className="shrink-0 inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wider"
          style={{
            fontSize: 10,
            padding: "2px 8px",
            color: "#34d399",
            background: "rgba(52, 211, 153, 0.12)",
            letterSpacing: "0.08em",
          }}
        >
          <Repeat2 size={10} />
          Reblog
        </span>

        <div className="flex-1" />

        {/* Profile-zone variant tag */}
        {variant === "profile-zone" && reblog.viaReblogTag && (
          <span
            className="shrink-0 text-white/40"
            style={{ fontSize: 11 }}
          >
            via reblog
          </span>
        )}

        {/* Timestamp */}
        <span
          className="shrink-0 text-white/40"
          style={{ fontSize: 12 }}
        >
          {timeAgo(reblog.publishedAt)}
        </span>

        {/* More menu */}
        <button
          onClick={stop(onMore)}
          className="shrink-0 flex items-center justify-center rounded-md transition-colors hover:bg-white/[0.06] text-white/55 hover:text-white"
          style={{ width: 28, height: 28 }}
          aria-label="More options"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* REBLOGGER TEXT */}
      {reblog.text && (
        <div style={{ marginTop: 10 }}>
          <p
            ref={textRef}
            className="text-white/90 whitespace-pre-wrap break-words"
            style={{
              fontSize: 15,
              lineHeight: 1.5,
              display: isExpanded ? "block" : "-webkit-box",
              WebkitLineClamp: isExpanded ? "unset" : 6,
              WebkitBoxOrient: "vertical",
              overflow: isExpanded ? "visible" : "hidden",
            }}
          >
            {reblog.text}
          </p>

          {isClamped && !isExpanded && (
            <button
              onClick={stop(() => setIsExpanded(true))}
              className="font-sans cursor-pointer text-white/55 hover:text-white transition-colors"
              style={{
                fontSize: 13,
                fontWeight: 500,
                marginTop: 4,
                background: "none",
                border: "none",
                padding: 0,
              }}
            >
              Read more
            </button>
          )}
        </div>
      )}

      {/* OPTIONAL MEDIA */}
      {reblog.media && (
        <div
          className="overflow-hidden rounded-xl border border-white/8"
          style={{ marginTop: 12 }}
        >
          {reblog.media.kind === "image" ? (
            <img
              src={reblog.media.url}
              alt=""
              className="w-full h-auto object-cover block"
              style={{ maxHeight: 480 }}
            />
          ) : (
            <div className="relative">
              <video
                src={reblog.media.url}
                poster={reblog.media.thumbnailUrl}
                className="w-full h-auto block"
                style={{ maxHeight: 480 }}
                controls={false}
                preload="metadata"
              />
              {/* Play overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: 56,
                    height: 56,
                    background: "rgba(0,0,0,0.55)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <Play
                    size={24}
                    className="text-white fill-white"
                    style={{ marginLeft: 3 }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* EMBEDDED ORIGINAL CARD */}
      <div style={{ marginTop: 12 }}>
        {embeddedOriginal ? (
          <EmbeddedOriginalCard
            variant="feed"
            post={embeddedOriginal}
            onClick={onOriginalClick}
          />
        ) : (
          <div
            className="flex items-center justify-center rounded-xl"
            style={{
              minHeight: 80,
              background: "rgba(255,255,255,0.04)",
              border: "0.5px solid rgba(255,255,255,0.08)",
              padding: 16,
              color: "rgba(255,255,255,0.4)",
              fontSize: 13,
            }}
          >
            Original post is no longer available
          </div>
        )}
      </div>

      {/* ENGAGEMENT ROW */}
      <EngagementRow
        engagement={engagement}
        onLikeClick={onLikeClick}
        onCommentClick={onCommentClick}
        onReblogClick={onReblogClick}
        onBookmarkClick={onBookmarkClick}
        onShareClick={onShareClick}
      />
    </article>
  );
}
