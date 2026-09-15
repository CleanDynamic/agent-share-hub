import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, ArrowLeft, Info, X, ChevronDown, Repeat2 } from "lucide-react";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { motion, PanInfo } from "framer-motion";
import { MessageInputBar } from "./MessageInputBar";
import { displayContentType } from "@/lib/content-types";
import { useIsMobile } from "@/hooks/use-mobile";
import { ContentShareBubble, type ContentShareValue, type ReadState } from "@/components/messages/ContentShareBubble";
import { markContentViewed } from "@/lib/messaging";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { r } from "@/lib/theme/radius";
import { data as dataType, tabular } from "@/lib/theme/type";
import { prefersReducedMotion, uiTransition } from "@/lib/theme/controls";
import { TypingIndicator } from "@/components/dm/TypingIndicator";
import { Skeleton } from "@/components/ui/skeleton";
import { scrollBehavior, feedback } from "@/lib/theme/motion";

const initials = (name: string) => (name || "?").slice(0, 2).toUpperCase();

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "🔥"];

/* ═══════ Notification sound via Web Audio API ═══════ */
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // Audio not available
  }
}

function haptic(ms: number) {
  try { navigator?.vibrate?.(ms); } catch {}
}

/* ═══════ Date helpers ═══════ */
function formatMessageTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function dateSeparatorLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-GB", { weekday: "long" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function presenceLabel(isOnline: boolean | null, lastSeenAt: string | null): string {
  if (isOnline) return "Active now";
  if (!lastSeenAt) return "";
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 7) return ""; // Don't show old presence
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Active ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Active ${hrs}h ago`;
  return `Active ${days}d ago`;
}

/* ═══════ URL Linkifier ═══════ */
function linkifyText(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-secondary underline break-all">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

/* ═══════ Voice Waveform ═══════ */
function VoiceMessage({ url, duration }: { url: string; duration: number }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.addEventListener("timeupdate", () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    });
    audio.addEventListener("ended", () => { setPlaying(false); setProgress(0); });
    return () => { audio.pause(); audio.src = ""; };
  }, [url]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const bars = Array.from({ length: 20 }, (_, i) => {
    const h = [12, 18, 8, 22, 14, 20, 10, 24, 16, 19, 11, 21, 13, 17, 9, 23, 15, 20, 12, 18][i];
    const filled = i / 20 <= progress;
    return (
      <div
        key={i}
        className="rounded-full"
        style={{
          width: 3,
          height: h,
          // BG-P26. `--evidence` is the token for a live state, and a played
          // bar is exactly that. The bars are graphics rather than type, so
          // they answer to the 3.0:1 UI floor: measured 4.23:1 on `--recess`
          // and 3.83:1 on the own-message wash on Exhibition, 6.14 and 6.09 on
          // Dusk. The unplayed bars drop to 30% of the same hue so the track
          // reads as one object at two states, not as two colours.
          backgroundColor: filled ? t.evidence : tokenAlpha("evidence", 0.3),
          transition: feedback("background-color"),
        }}
      />
    );
  });

  const fmtDur = `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-2" style={{ width: 220, height: 48 }} onClick={toggle}>
      <button className="shrink-0" style={{ color: t.text }}>
        {playing ? "⏸" : "▶"}
      </button>
      <div className="flex items-end gap-[2px] flex-1 h-6">{bars}</div>
      <span
        className="text-[11px] shrink-0"
        style={{ fontFamily: dataType.fontFamily, ...tabular, color: t.text2 }}
      >
        {fmtDur}
      </span>
    </div>
  );
}

/* ═══════ Post Share Card ═══════ */
function PostShareCard({ contentId }: { contentId: string }) {
  const navigate = useNavigate();
  const { data: content } = useQuery({
    queryKey: ["shared_content", contentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_items")
        .select("id, title, content_type, cover_image_url, profiles!content_items_creator_id_fkey(username)")
        .eq("id", contentId)
        .maybeSingle();
      return data;
    },
    enabled: !!contentId,
  });

  if (!content) return <div className="text-xs text-muted-foreground italic">Shared post</div>;

  return (
    <div
      className="overflow-hidden cursor-pointer"
      style={{ borderRadius: r["r-media"], border: `1px solid ${t.line}` }}
      style={{ maxWidth: 260 }}
      onClick={(e) => { e.stopPropagation(); navigate(`/content/${content.id}`); }}
    >
      {content.cover_image_url && (
        <img src={content.cover_image_url} alt="" className="w-full object-cover" style={{ height: 120 }} />
      )}
      <div className="p-2.5">
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent text-accent-foreground">
          {displayContentType(content.content_type)}
        </span>
        <p className="text-[13px] font-bold text-foreground mt-1 line-clamp-2">{content.title}</p>
        {(content as any).profiles?.username && (
          <p className="text-[11px] text-muted-foreground mt-0.5">@{(content as any).profiles.username}</p>
        )}
        <p className="text-xs text-secondary mt-1.5">View post →</p>
      </div>
    </div>
  );
}

function ReblogShareCard({ reblogId, meta }: { reblogId: string | null; meta: any }) {
  const navigate = useNavigate();
  const slug = meta?.slug ?? null;
  const rebloggerHandle = meta?.reblogger_handle ?? null;
  const rebloggerName = meta?.reblogger_display_name ?? rebloggerHandle ?? "Someone";
  const originalTitle = meta?.original_title ?? "Original post";
  const preview = (meta?.preview ?? "") as string;

  return (
    <div
      className="overflow-hidden cursor-pointer"
      style={{ borderRadius: r["r-media"], border: `1px solid ${t.line}` }}
      style={{ maxWidth: 260 }}
      onClick={(e) => {
        e.stopPropagation();
        if (slug) navigate(`/b/${slug}`);
        else if (reblogId) navigate(`/b/${reblogId}`);
      }}
    >
      <div className="p-2.5">
        <span
          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider rounded-full"
          style={{
            padding: "2px 8px",
            borderRadius: r["r-chip"],
            color: t.evidence,
            background: tokenAlpha("evidence", 0.12),
          }}
        >
          <Repeat2 size={10} /> Reblog
        </span>
        <p className="text-[13px] font-bold text-foreground mt-1.5 line-clamp-2">
          {rebloggerName} reblogged
        </p>
        {originalTitle && (
          <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-1">
            “{originalTitle}”
          </p>
        )}
        {preview && (
          <p className="text-[12px] text-foreground/80 mt-1.5 line-clamp-2 italic">{preview}</p>
        )}
        <p className="text-xs text-secondary mt-1.5">View reblog →</p>
      </div>
    </div>
  );
}

/* ═══════ Reaction Display ═══════ */
function ReactionPills({
  messageId,
  reactions,
  isMine,
  userId,
}: {
  messageId: string;
  reactions: any[];
  isMine: boolean;
  userId: string;
}) {
  const queryClient = useQueryClient();
  if (!reactions || reactions.length === 0) return null;

  const emojiMap = new Map<string, { count: number; hasMe: boolean }>();
  reactions.forEach((r) => {
    const e = emojiMap.get(r.emoji) || { count: 0, hasMe: false };
    e.count++;
    if (r.user_id === userId) e.hasMe = true;
    emojiMap.set(r.emoji, e);
  });

  const toggleReaction = async (emoji: string) => {
    haptic(5);
    const entry = emojiMap.get(emoji);
    if (entry?.hasMe) {
      await supabase.from("dm_reactions").delete().eq("message_id", messageId).eq("user_id", userId);
    } else {
      await supabase.from("dm_reactions").upsert({ message_id: messageId, user_id: userId, emoji }, { onConflict: "message_id,user_id" });
    }
    queryClient.invalidateQueries({ queryKey: ["dm_reactions"] });
  };

  return (
    <div className={`flex gap-1 mt-0.5 ${isMine ? "justify-end" : "justify-start"}`}>
      {[...emojiMap.entries()].map(([emoji, { count, hasMe }]) => (
        <button
          key={emoji}
          onClick={(e) => { e.stopPropagation(); toggleReaction(emoji); }}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs"
          style={{
            // A reaction the current user is part of takes the same `--action`
            // wash the own-message bubble does, so "mine" reads the same way
            // wherever it appears; everyone else's sits on `--recess`.
            borderRadius: r["r-chip"],
            background: hasMe ? tokenAlpha("action", 0.18) : t.recess,
            color: t.text,
            transition: uiTransition(),
          }}
        >
          <span>{emoji}</span>
          {count > 1 && (
            <span
              className="text-[10px]"
              style={{ fontFamily: dataType.fontFamily, ...tabular, color: t.text2 }}
            >
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ═══════ Swipeable Message Bubble (mobile swipe-to-reply) ═══════ */
function SwipeableMessage({
  children,
  onSwipeReply,
  isMobile,
}: {
  children: React.ReactNode;
  onSwipeReply: () => void;
  isMobile: boolean;
}) {
  if (!isMobile) return <>{children}</>;

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > 40) {
      onSwipeReply();
      haptic(10);
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Reply icon behind */}
      <div className="absolute inset-y-0 left-0 flex items-center pl-2 text-muted-foreground">
        <span className="text-sm">↩</span>
      </div>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 60 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        className="relative"
      >
        {children}
      </motion.div>
    </div>
  );
}

/* ═══════ Image Lightbox ═══════ */
function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const startY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) startY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const endY = e.changedTouches[0]?.clientY ?? 0;
    if (endY - startY.current > 80) onClose(); // Swipe down to dismiss
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button className="absolute top-4 right-4 z-10" style={{ color: t.text }}>
        <X className="h-8 w-8" />
      </button>
      <img
        src={src}
        alt=""
        className="max-w-[90vw] max-h-[90vh] object-contain select-none"
        style={{ transform: `scale(${scale})`, transition: feedback("transform") }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={() => setScale(s => s === 1 ? 2 : 1)}
      />
    </div>
  );
}

/* ═══════ Thread View ═══════ */

interface ThreadViewProps {
  threadId: string;
  otherUser: {
    id: string;
    display_name?: string;
    username?: string;
    avatar_url?: string | null;
  };
  onBack: () => void;
  enquiryRef?: string | null;
  hideHeader?: boolean;
}

export function ThreadView({ threadId, otherUser, onBack, enquiryRef, hideHeader }: ThreadViewProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [showTimestampId, setShowTimestampId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [messageOffset, setMessageOffset] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const [showNewMsgButton, setShowNewMsgButton] = useState(false);
  const prevMsgCountRef = useRef(0);
  const isInitialLoadRef = useRef(true);
  const newDividerRef = useRef<HTMLDivElement | null>(null);
  const newDividerScrolledRef = useRef(false);
  const [unreadCutoff, setUnreadCutoff] = useState<Date | null>(null);
  const cutoffCapturedRef = useRef(false);
  const displayName = otherUser.display_name || otherUser.username || "User";

  // Fetch presence
  const { data: presence } = useQuery({
    queryKey: ["dm_presence", otherUser.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("dm_presence")
        .select("is_online, last_seen_at")
        .eq("user_id", otherUser.id)
        .maybeSingle();
      return data;
    },
    refetchInterval: 30000,
  });

  // Fetch messages
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["dm_messages", threadId, messageOffset],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dm_messages")
        .select("*")
        .eq("thread_id", threadId)
        .eq("is_unsent", false)
        .order("sent_at", { ascending: false })
        .range(messageOffset, messageOffset + 49);
      if (error) throw error;
      return (data ?? []).reverse();
    },
    enabled: !!threadId,
  });

  // Fetch reactions
  const messageIds = useMemo(() => (messages ?? []).map((m: any) => m.id), [messages]);

  /* ── The new-message entrance (BG-P26) ────────────────────────────────────
     A message gets the entrance only if it was not in the previous render's id
     set. The set starts as null and is filled after the first commit, so the
     initial load arrives already in place rather than animating forty bubbles
     at once — an entrance that plays on everything reads as a page transition,
     not as an arrival.

     This is presentation state and nothing else: it reads the ids the query
     already returned and opens no subscription of its own. */
  /* No transport carries a typing signal yet; see TypingIndicator's header for
     why BG-P26 could not add one. Kept as a named constant rather than an
     inline `false` so the wiring point is obvious to whoever adds the
     broadcast. */
  const isOtherTyping = false;

  const seenMsgIdsRef = useRef<Set<string> | null>(null);
  const isNewMessage = (id: string) =>
    seenMsgIdsRef.current !== null && !seenMsgIdsRef.current.has(id);
  useEffect(() => {
    seenMsgIdsRef.current = new Set(messageIds);
  }, [messageIds]);
  const { data: allReactions } = useQuery({
    queryKey: ["dm_reactions", threadId, messageIds],
    queryFn: async () => {
      if (messageIds.length === 0) return [];
      const { data } = await supabase
        .from("dm_reactions")
        .select("*")
        .in("message_id", messageIds);
      return data ?? [];
    },
    enabled: messageIds.length > 0,
  });

  const reactionsByMessage = useMemo(() => {
    const map = new Map<string, any[]>();
    (allReactions ?? []).forEach((r: any) => {
      const arr = map.get(r.message_id) || [];
      arr.push(r);
      map.set(r.message_id, arr);
    });
    return map;
  }, [allReactions]);

  // Read-receipts for content-share messages I sent
  const sentShareIds = useMemo(
    () =>
      (messages ?? [])
        .filter((m: any) => m.sender_id === user?.id && m.kind === "content-share")
        .map((m: any) => m.id),
    [messages, user]
  );
  const { data: shareViews } = useQuery({
    queryKey: ["content_share_views", threadId, sentShareIds],
    queryFn: async () => {
      if (sentShareIds.length === 0) return [];
      const { data } = await supabase
        .from("content_share_views" as any)
        .select("message_id, viewer_id, viewed_at")
        .in("message_id", sentShareIds);
      return (data ?? []) as any[];
    },
    enabled: sentShareIds.length > 0,
  });
  const viewedShareMap = useMemo(() => {
    const map = new Map<string, string>();
    (shareViews ?? []).forEach((v: any) => {
      const existing = map.get(v.message_id);
      if (!existing || new Date(v.viewed_at) < new Date(existing)) {
        map.set(v.message_id, v.viewed_at);
      }
    });
    return map;
  }, [shareViews]);

  // Realtime: content_share_views for my sent shares
  useEffect(() => {
    if (sentShareIds.length === 0) return;
    const channelName = `share-views-${threadId}-${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "content_share_views" },
        (payload: any) => {
          if (sentShareIds.includes(payload.new?.message_id)) {
            queryClient.invalidateQueries({ queryKey: ["content_share_views", threadId] });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId, sentShareIds, queryClient]);

  // Capture unread cutoff BEFORE marking as read, so the "New" divider has a stable anchor
  useEffect(() => {
    if (!threadId || !user) return;
    cutoffCapturedRef.current = false;
    setUnreadCutoff(null);
    newDividerScrolledRef.current = false;
    (async () => {
      // Prefer dm_thread_members.last_read_at (multi-thread aware)
      const { data: mem } = await supabase
        .from("dm_thread_members")
        .select("last_read_at")
        .eq("thread_id", threadId)
        .eq("user_id", user.id)
        .maybeSingle();
      let cutoff: Date | null = (mem as any)?.last_read_at ? new Date((mem as any).last_read_at) : null;
      if (!cutoff) {
        // Fallback: earliest unread message from the other user
        const { data: firstUnread } = await supabase
          .from("dm_messages")
          .select("sent_at")
          .eq("thread_id", threadId)
          .neq("sender_id", user.id)
          .is("read_at", null)
          .order("sent_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if ((firstUnread as any)?.sent_at) {
          // Anchor cutoff just before the first unread message
          cutoff = new Date(new Date((firstUnread as any).sent_at).getTime() - 1);
        }
      }
      cutoffCapturedRef.current = true;
      setUnreadCutoff(cutoff);
    })();
  }, [threadId, user]);

  // Mark as read (runs after cutoff capture effect above)
  useEffect(() => {
    if (!threadId || !user) return;
    const resetUnread = async () => {
      const { data: thread } = await supabase
        .from("dm_threads")
        .select("participant_a")
        .eq("id", threadId)
        .maybeSingle();
      if (!thread) return;
      const isA = thread.participant_a === user.id;
      await supabase
        .from("dm_threads")
        .update(isA ? { unread_count_a: 0 } : { unread_count_b: 0 })
        .eq("id", threadId);
      await supabase
        .from("dm_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("thread_id", threadId)
        .neq("sender_id", user.id)
        .is("read_at", null);
      // Update member-level last_read_at too
      await supabase
        .from("dm_thread_members")
        .update({ last_read_at: new Date().toISOString() } as any)
        .eq("thread_id", threadId)
        .eq("user_id", user.id);
      queryClient.invalidateQueries({ queryKey: ["dm_threads"] });
    };
    resetUnread();
  }, [threadId, user, queryClient]);

  // Scroll to bottom — instant on initial load, smooth on new messages
  useEffect(() => {
    if (!messages) return;
    const msgCount = messages.length;
    const isNew = msgCount > prevMsgCountRef.current && prevMsgCountRef.current > 0;
    prevMsgCountRef.current = msgCount;

    if (isInitialLoadRef.current) {
      // Instant scroll on mount
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      isInitialLoadRef.current = false;
      return;
    }

    if (messageOffset !== 0) return; // Don't auto-scroll when loading older

    const el = scrollContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;

    if (isNew && isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: scrollBehavior() });
    } else if (isNew && !isNearBottom) {
      setShowNewMsgButton(true);
    }
  }, [messages, messageOffset]);

  // Realtime — play sound on incoming messages
  useEffect(() => {
    if (!threadId || !user) return;
    const channelName = `dm-view-${threadId}-${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_messages", filter: `thread_id=eq.${threadId}` }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ["dm_messages", threadId] });
        queryClient.invalidateQueries({ queryKey: ["dm_threads"] });
        // Play sound for messages from other user
        const newMsg = payload.new as any;
        if (newMsg?.sender_id && newMsg.sender_id !== user.id) {
          playNotificationSound();
          // Mark as read immediately
          supabase.from("dm_messages").update({ read_at: new Date().toISOString() }).eq("id", newMsg.id);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_reactions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["dm_reactions"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId, user, queryClient]);

  // Load older messages on scroll to top
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || loadingOlder) return;
    // Hide new message button if near bottom
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
      setShowNewMsgButton(false);
    }
    if (el.scrollTop < 50 && messages && messages.length >= 50) {
      const prevScrollHeight = el.scrollHeight;
      setLoadingOlder(true);
      setMessageOffset((prev) => prev + 50);
      // Maintain scroll position after loading older
      requestAnimationFrame(() => {
        const newScrollHeight = el.scrollHeight;
        el.scrollTop = newScrollHeight - prevScrollHeight;
        setLoadingOlder(false);
      });
    }
  }, [loadingOlder, messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: scrollBehavior() });
    setShowNewMsgButton(false);
  };

  // Find last sent message for seen receipt
  const lastSentMsg = useMemo(() => {
    if (!messages || !user) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_id === user.id) return messages[i];
    }
    return null;
  }, [messages, user]);

  const replyToRef = useCallback((messageId: string) => {
    if (!messages) return null;
    return messages.find((m: any) => m.id === messageId) || null;
  }, [messages]);

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    haptic(5);
    const existing = (allReactions ?? []).find((r: any) => r.message_id === messageId && r.user_id === user.id);
    if (existing && existing.emoji === emoji) {
      await supabase.from("dm_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("dm_reactions").upsert(
        { message_id: messageId, user_id: user.id, emoji },
        { onConflict: "message_id,user_id" }
      );
    }
    queryClient.invalidateQueries({ queryKey: ["dm_reactions"] });
  };

  const handleUnsend = async (messageId: string) => {
    await supabase.from("dm_messages").update({ is_unsent: true }).eq("id", messageId);
    queryClient.invalidateQueries({ queryKey: ["dm_messages", threadId] });
    queryClient.invalidateQueries({ queryKey: ["dm_threads"] });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  /* ═══════ Build content-share value from meta + resolved row ═══════ */
  const buildShareValue = (msg: any, resolved: any | null): { variant: "blueprint" | "stage" | "block"; value: ContentShareValue } => {
    const meta = msg.shared_content_meta || {};
    const variant = (msg.shared_content_type === "stage" || msg.shared_content_type === "block")
      ? msg.shared_content_type
      : "blueprint";
    const author = meta.author_username || meta.author_display_name || "user";
    if (variant === "stage") {
      return {
        variant,
        value: {
          id: msg.shared_content_id,
          name: meta.title || resolved?.title || "Stage",
          blueprintTitle: (meta.parent_title as string) || resolved?.title || "Blueprint",
          blockCount: 0,
          connectionCount: 0,
          blocks: [],
          connections: [],
        },
      };
    }
    if (variant === "block") {
      return {
        variant,
        value: {
          id: msg.shared_content_id,
          name: meta.title || "Block",
          type: (meta.block_type as string) || "text",
          stageName: (meta.stage_name as string) || "Stage",
          blueprintTitle: (meta.parent_title as string) || resolved?.title || "Blueprint",
          preview: (meta.preview as string) || "",
          thumbnail: (meta.cover_image_url as string) || resolved?.cover_image_url || null,
        },
      };
    }
    return {
      variant: "blueprint",
      value: {
        id: msg.shared_content_id,
        title: meta.title || resolved?.title || "Blueprint",
        author,
        coverImage: meta.cover_image_url || resolved?.cover_image_url || null,
        useCase: (meta.use_case as string) || null,
        blockTypes: [],
        stageCount: 0,
        blockCount: 0,
        readTime: "",
      },
    };
  };

  const handleContentClick = async (msg: any, value: ContentShareValue) => {
    try { await markContentViewed(msg.id); } catch {}
    const slug = (msg.shared_content_meta as any)?.slug;
    const variant = msg.shared_content_type;
    if (!slug && !msg.shared_content_id) return;
    if (variant === "stage") {
      navigate(`/b/${slug || msg.shared_content_id}#stage-${(value as any).id}`);
    } else if (variant === "block") {
      navigate(`/b/${slug || msg.shared_content_id}#block-${(value as any).id}`);
    } else {
      navigate(`/b/${slug || msg.shared_content_id}`);
    }
  };

  /* ═══════ Render message bubble ═══════ */
  const renderMessage = (msg: any, idx: number, allMsgs: any[]) => {
    const isMine = msg.sender_id === user?.id;
    const prevMsg = idx > 0 ? allMsgs[idx - 1] : null;

    const showDate = !prevMsg || dateSeparatorLabel(msg.sent_at) !== dateSeparatorLabel(prevMsg.sent_at);
    const showAvatar = !isMine && (!prevMsg || prevMsg.sender_id !== msg.sender_id || showDate);
    const isLastSent = lastSentMsg?.id === msg.id;
    const repliedMsg = msg.reply_to_message_id ? replyToRef(msg.reply_to_message_id) : null;
    const reactions = reactionsByMessage.get(msg.id) || [];
    const showingTimestamp = showTimestampId === msg.id;

    // "New" divider: between last read message and first unread (other-user) message
    const showNewDivider =
      !isMine &&
      !!unreadCutoff &&
      cutoffCapturedRef.current &&
      new Date(msg.sent_at) > unreadCutoff &&
      (!prevMsg ||
        prevMsg.sender_id === user?.id ||
        new Date(prevMsg.sent_at) <= unreadCutoff);

    const newDivider = showNewDivider ? (
      <div
        key={`new-divider-${msg.id}`}
        ref={(el) => {
          if (el && !newDividerScrolledRef.current) {
            newDividerScrolledRef.current = true;
            requestAnimationFrame(() => el.scrollIntoView({ block: "center", behavior: "auto" }));
          }
          newDividerRef.current = el;
        }}
        className="flex items-center gap-2 my-3 px-1"
        aria-label="New messages"
      >
        {/* The divider's teal was a one-off; `--evidence` is the token for a
            live state and carries the same reading in both rooms. */}
        <span className="flex-1 h-[0.5px]" style={{ backgroundColor: tokenAlpha("evidence", 0.3) }} />
        <span
          style={{
            fontFamily: dataType.fontFamily,
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: t.evidence,
          }}
        >
          New
        </span>
        <span className="flex-1 h-[0.5px]" style={{ backgroundColor: tokenAlpha("evidence", 0.3) }} />
      </div>
    ) : null;

    // ── kind='system': centred system note ──
    if (msg.kind === "system") {
      return (
        <div key={msg.id} className="flex justify-center my-3">
          <span className="text-[11px] text-muted-foreground bg-background/60 px-3 py-1 rounded-full">
            {msg.body || msg.text_content || "—"}
          </span>
        </div>
      );
    }

    // ── kind='content-share': rich card bubble ──
    if (msg.kind === "content-share" && msg.shared_content_id && msg.shared_content_type) {
      const { variant, value } = buildShareValue(msg, null);
      const isBroken = (msg.shared_content_meta as any)?.is_broken === true;
      const viewedAt = viewedShareMap.get(msg.id) ?? null;
      let readState: ReadState = null;
      if (isMine) {
        readState = viewedAt ? "opened" : "delivered";
      }
      return (
        <div key={msg.id}>
          {showDate && (
            <div className="flex justify-center my-4">
              <span className="text-[12px] text-muted-foreground bg-background px-3 py-1 rounded-full">
                {dateSeparatorLabel(msg.sent_at)}
              </span>
            </div>
          )}
          <div className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1.5`}>
            {!isMine && (
              <div className="w-7 shrink-0 mr-1.5 self-end">
                {showAvatar && (
                  <Avatar className="h-6 w-6">
                    {otherUser.avatar_url && <AvatarImage src={otherUser.avatar_url} />}
                    <AvatarFallback className="text-[8px] bg-accent text-muted-foreground">
                      {initials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            )}
            <ContentShareBubble
              variant={variant}
              content={value}
              senderNote={msg.body || msg.text_content || null}
              isFromCurrentUser={isMine}
              timestamp={formatMessageTime(msg.sent_at)}
              readState={readState}
              viewedAt={viewedAt}
              isBroken={isBroken}
              onContentClick={() => handleContentClick(msg, value)}
              onViewed={isMine ? undefined : () => { markContentViewed(msg.id).catch(() => {}); }}
            />
          </div>
        </div>
      );
    }

    const bubbleContent = () => {
      switch (msg.message_type) {
        case "image":
          return (
            <img
              src={msg.image_url}
              alt=""
              className="rounded-xl max-w-[240px] max-h-[320px] object-cover cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setImagePreview(msg.image_url); }}
            />
          );
        case "voice":
          return <VoiceMessage url={msg.voice_url} duration={msg.voice_duration_seconds || 0} />;
        case "post_share":
          if ((msg as any).shared_content_type === "reblog") {
            return (
              <ReblogShareCard
                reblogId={(msg as any).shared_reblog_id ?? null}
                meta={(msg as any).shared_content_meta ?? {}}
              />
            );
          }
          return <PostShareCard contentId={msg.shared_content_id} />;
        case "like":
          return <span className="text-[32px] leading-none">❤️</span>;
        default:
          return (
            <p className="whitespace-pre-wrap break-words text-sm leading-[1.4]">
              {linkifyText(msg.text_content || "")}
            </p>
          );
      }
    };

    const bubbleClasses = () => {
      if (msg.message_type === "like") return "";
      if (msg.message_type === "image") return "overflow-hidden";
      if (msg.message_type === "post_share") return "p-0 overflow-hidden";
      return "";
    };

    /**
     * BG-P26. Own messages take an `--action` wash with `--text` on it; theirs
     * take `--recess`. Both carry `--text`, which is the measured pairing —
     * 10.27:1 and 11.33:1 on Exhibition, 10.54:1 and 10.62:1 on Dusk. The
     * `--action` hue itself is NOT legal as ink on its own wash (3.76:1 on
     * Exhibition), so the ink is the same in both bubbles and only the ground
     * says who spoke.
     *
     * `bg-primary` was the old fill and it is a Tailwind palette colour, not a
     * theme token, so it took neither room's action hue.
     */
    const bubbleSurface = (): React.CSSProperties => {
      if (msg.message_type === "like") return {};
      if (msg.message_type === "image" || msg.message_type === "post_share") return {};
      return {
        background: isMine ? tokenAlpha("action", 0.18) : t.recess,
        color: t.text,
      };
    };

    /**
     * `--r-control` on three corners, squared on the corner nearest the sender:
     * bottom-right for mine, bottom-left for theirs. The old shape was an 18px
     * near-pill, and a pill is off-brand under the radius scale. The squared
     * corner is what carries direction now that the fill no longer can.
     */
    const bubbleRadiusStyle: React.CSSProperties = {
      borderRadius: isMine
        ? `${r["r-control"]} ${r["r-control"]} 0 ${r["r-control"]}`
        : `${r["r-control"]} ${r["r-control"]} ${r["r-control"]} 0`,
    };

    const paddingClass = msg.message_type === "image" || msg.message_type === "post_share" || msg.message_type === "like"
      ? "" : "px-3.5 py-2.5";

    const messageContextItems = (
      <>
        <ContextMenuItem onClick={() => setReplyTo(msg)} className="text-sm gap-2">
          ↩ Reply
        </ContextMenuItem>
        {msg.message_type === "text" && msg.text_content && (
          <ContextMenuItem onClick={() => handleCopy(msg.text_content)} className="text-sm gap-2">
            📋 Copy
          </ContextMenuItem>
        )}
        {isMine && (
          <ContextMenuItem onClick={() => handleUnsend(msg.id)} className="text-sm gap-2 text-destructive">
            🗑 Unsend
          </ContextMenuItem>
        )}
      </>
    );

    const entering = isNewMessage(msg.id) && !prefersReducedMotion();

    const bubble = (
      <div
        key={msg.id}
        data-bg-animated={entering ? "" : undefined}
        style={
          entering
            ? { animation: "dmMessageIn 200ms cubic-bezier(.2,.6,.35,1) both" }
            : undefined
        }
      >
        {showDate && (
          <div className="flex justify-center my-4">
            <span className="text-[12px] text-muted-foreground bg-background px-3 py-1 rounded-full">
              {dateSeparatorLabel(msg.sent_at)}
            </span>
          </div>
        )}

        <div className={`flex ${isMine ? "justify-end" : "justify-start"} mb-0.5 group`}>
          {!isMine && (
            <div className="w-7 shrink-0 mr-1.5 self-end">
              {showAvatar && (
                <Avatar className="h-6 w-6">
                  {otherUser.avatar_url && <AvatarImage src={otherUser.avatar_url} />}
                  <AvatarFallback className="text-[8px] bg-accent text-muted-foreground">
                    {initials(displayName)}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          )}

          <div className="max-w-[75%] relative">
            {repliedMsg && (
              <div className="mb-1 pl-2 border-l-2 border-muted-foreground/30 text-[12px] text-muted-foreground truncate max-w-full">
                ↩ {repliedMsg.sender_id === user?.id ? "You" : displayName}: {repliedMsg.text_content?.slice(0, 60) || "Media"}
              </div>
            )}

            <ContextMenu>
              <ContextMenuTrigger>
                <div
                  className={`${bubbleClasses()} ${paddingClass} cursor-pointer`}
                  style={{ ...bubbleSurface(), ...bubbleRadiusStyle }}
                  onClick={() => setShowTimestampId(showingTimestamp ? null : msg.id)}
                >
                  {bubbleContent()}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="bg-card/95 backdrop-blur-md border-border">
                <div className="flex gap-1 px-2 py-1.5 border-b border-border">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReaction(msg.id, emoji)}
                      className="text-lg hover:opacity-75 transition-feedback p-0.5"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                {messageContextItems}
              </ContextMenuContent>
            </ContextMenu>

            <ReactionPills
              messageId={msg.id}
              reactions={reactions}
              isMine={isMine}
              userId={user?.id ?? ""}
            />

            {showingTimestamp && (
              <p
                className={`text-[10px] mt-0.5 ${isMine ? "text-right" : "text-left"}`}
                style={{
                  fontFamily: dataType.fontFamily,
                  ...tabular,
                  color: t.text2,
                }}
              >
                {formatMessageTime(msg.sent_at)}
              </p>
            )}

            {isLastSent && msg.read_at && (
              <div className="flex justify-end mt-0.5">
                <Avatar className="h-3.5 w-3.5">
                  {otherUser.avatar_url && <AvatarImage src={otherUser.avatar_url} />}
                  <AvatarFallback className="text-[6px] bg-accent text-muted-foreground">
                    {initials(displayName)[0]}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
          </div>
        </div>
      </div>
    );

    return (
      <SwipeableMessage
        key={msg.id}
        onSwipeReply={() => setReplyTo(msg)}
        isMobile={isMobile}
      >
        {bubble}
      </SwipeableMessage>
    );
  };

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden relative">
      {/* Header (suppressed when wrapper provides ConversationHeader) */}
      {!hideHeader && (
        <>
          <div className="flex items-center gap-3 px-4 shrink-0 border-b border-border" style={{ height: 52 }}>
            <button onClick={onBack} className="lg:hidden p-1 text-muted-foreground hover:text-foreground shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Avatar className="h-9 w-9 shrink-0">
              {otherUser.avatar_url && <AvatarImage src={otherUser.avatar_url} />}
              <AvatarFallback className="bg-accent text-muted-foreground text-xs">
                {initials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{displayName}</p>
              {presence && presenceLabel(presence.is_online, presence.last_seen_at) && (
                /* BG-P26. Online used to be carried by a green that belongs to
                   no theme; it is now a dot in `--evidence`, the token for a
                   live state, with the label itself in `--text2` so the colour
                   marks the state rather than shouting it. The dot is a mark,
                   not type, so it answers to the 3.0:1 UI floor. */
                <p
                  className="text-[12px] flex items-center gap-1.5"
                  style={{ color: t.text2 }}
                >
                  {presence.is_online && (
                    <span
                      aria-hidden="true"
                      className="inline-block rounded-full shrink-0"
                      style={{ width: 6, height: 6, background: t.evidence }}
                    />
                  )}
                  {presenceLabel(presence.is_online, presence.last_seen_at)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setInfoOpen(!infoOpen)}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Info className="h-5 w-5" />
              </button>
            </div>
          </div>

          {infoOpen && (
            <div className="border-b border-border bg-card p-4 shrink-0">
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="h-12 w-12">
                  {otherUser.avatar_url && <AvatarImage src={otherUser.avatar_url} />}
                  <AvatarFallback className="bg-accent text-muted-foreground">{initials(displayName)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-bold text-foreground">{displayName}</p>
                  {otherUser.username && <p className="text-xs text-muted-foreground">@{otherUser.username}</p>}
                </div>
              </div>
              <button
                onClick={() => navigate(`/creator/${otherUser.username}`)}
                className="text-xs text-secondary hover:underline"
              >
                View profile →
              </button>
            </div>
          )}
        </>
      )}

      {/* Message list */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 relative"
      >
        {loadingOlder && (
          <div className="flex justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: t.text2 }} />
          </div>
        )}
        {messagesLoading ? (
          /* BG-P26. Skeleton bubbles rather than a spinner, alternating sides
             and at the real radius, so the thread does not jump when the
             messages land. */
          <div className="flex flex-col justify-end gap-3 py-4" aria-busy="true">
            {[
              { mine: false, w: "58%" },
              { mine: false, w: "42%" },
              { mine: true, w: "50%" },
              { mine: false, w: "64%" },
              { mine: true, w: "36%" },
            ].map((row, i) => (
              <div
                key={i}
                className="flex"
                style={{ justifyContent: row.mine ? "flex-end" : "flex-start" }}
              >
                <Skeleton
                  style={{
                    width: row.w,
                    maxWidth: "75%",
                    height: 38,
                    borderRadius: row.mine
                      ? `${r["r-control"]} ${r["r-control"]} 0 ${r["r-control"]}`
                      : `${r["r-control"]} ${r["r-control"]} ${r["r-control"]} 0`,
                  }}
                />
              </div>
            ))}
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 text-center py-8">
            <p className="text-sm" style={{ color: t.text }}>
              {enquiryRef ? `Reply to the enquiry about "${enquiryRef}"` : "No messages yet"}
            </p>
            {!enquiryRef && (
              <p className="text-xs" style={{ color: t.text2, maxWidth: 260 }}>
                Say something to start this conversation.
              </p>
            )}
          </div>
        ) : (
          messages.map((msg: any, idx: number) => renderMessage(msg, idx, messages))
        )}
        {/* At the foot of the thread, where the next message would land. */}
        <TypingIndicator active={isOtherTyping} who={displayName} />
        <div ref={messagesEndRef} />
      </div>

      {/* New message floating button */}
      {showNewMsgButton && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium shadow-lg"
        >
          New message <ChevronDown className="h-3 w-3" />
        </button>
      )}

      {/* Reply preview bar */}
      {replyTo && (
        <div
          className="flex items-center gap-2 px-3 py-2 shrink-0"
          style={{ borderTop: `1px solid ${t.line}`, background: t.bg }}
        >
          <span className="text-xs text-muted-foreground truncate flex-1">
            ↩ Replying to {replyTo.sender_id === user?.id ? "yourself" : displayName}: {replyTo.text_content?.slice(0, 50) || "Media"}
          </span>
          <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Input bar with safe area */}
      <div style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <MessageInputBar
          threadId={threadId}
          otherDisplayName={displayName}
          replyToId={replyTo?.id || null}
          onClearReply={() => setReplyTo(null)}
          onMessageSent={() => {
            haptic(10);
            messagesEndRef.current?.scrollIntoView({ behavior: scrollBehavior() });
          }}
        />
      </div>

      {/* Image lightbox */}
      {imagePreview && (
        <ImageLightbox src={imagePreview} onClose={() => setImagePreview(null)} />
      )}
    </div>
  );
}
