import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Loader2, Search, X, Pin, BellOff, LogOut, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ThreadView } from "@/components/dm/ThreadView";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { MessagesThreadList } from "@/components/messages/MessagesThreadList";
import { ConversationHeader, type ConversationHeaderThread } from "@/components/messages/ConversationHeader";
import { getThreads } from "@/lib/messaging/getThreads";
import { useThreadListUpdates } from "@/lib/messaging/realtime";
import type { ThreadSummary } from "@/lib/messaging/types";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

const initials = (n: string) => (n || "?").slice(0, 2).toUpperCase();

/* ───── Compose modal ───── */
function ComposeModal({
  open,
  onClose,
  userId,
  onPickUser,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  onPickUser: (recipientId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!open) { setQ(""); setResults([]); }
  }, [open]);

  const search = useCallback(async (val: string) => {
    if (val.length < 2) { setResults([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .or(`display_name.ilike.%${val}%,username.ilike.%${val}%`)
      .neq("id", userId)
      .limit(10);
    setResults(data ?? []);
    setLoading(false);
  }, [userId]);

  const handleChange = (val: string) => {
    setQ(val);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(val), 250);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md" data-visual-slot="modal-surface" style={{ background: '#0E0E16', border: '1px solid var(--border)' }}>
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground">New message</DialogTitle>
        </DialogHeader>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search people..."
            className="pl-9 h-9 rounded-full bg-background border-border text-sm"
            autoFocus
          />
        </div>
        <div className="max-h-72 overflow-y-auto mt-2 space-y-0.5">
          {loading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && q.length >= 2 && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No results for "{q}"</p>
          )}
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => { onPickUser(p.id); onClose(); }}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-accent/40 transition-colors text-left"
            >
              <Avatar className="h-10 w-10 shrink-0">
                {p.avatar_url && <AvatarImage src={p.avatar_url} />}
                <AvatarFallback className="bg-accent text-muted-foreground text-xs">
                  {initials(p.display_name || p.username)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{p.display_name || p.username}</p>
                {p.username && <p className="text-xs text-muted-foreground">@{p.username}</p>}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ───── Page ───── */
export default function MessagesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { threadId: routeThreadId } = useParams<{ threadId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { count: totalUnread } = useUnreadMessages();

  const tabParam = (searchParams.get("tab") as "primary" | "requests" | null) ?? "primary";
  const [activeTab, setActiveTab] = useState<"primary" | "requests">(tabParam);
  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounce search query (200ms)
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(rawQuery.trim()), 200);
    return () => clearTimeout(debounceRef.current);
  }, [rawQuery]);

  // Browser tab title
  useEffect(() => {
    const title = totalUnread > 0 ? `(${totalUnread > 9 ? "9+" : totalUnread}) Messages — NeoScale AI` : "Messages — NeoScale AI";
    document.title = title;
    return () => { document.title = "NeoScale AI"; };
  }, [totalUnread]);

  // Fetch threads for the active tab
  const { data: tabData, isLoading } = useQuery({
    queryKey: ["messaging_threads", user?.id, activeTab, debouncedQuery],
    queryFn: () => getThreads({
      userId: user!.id,
      tab: activeTab,
      query: debouncedQuery,
      limit: 100,
      offset: 0,
    }),
    enabled: !!user,
  });

  // Fetch the OTHER tab's count badge
  const { data: otherTabData } = useQuery({
    queryKey: ["messaging_threads_count", user?.id, activeTab === "primary" ? "requests" : "primary"],
    queryFn: () => getThreads({
      userId: user!.id,
      tab: activeTab === "primary" ? "requests" : "primary",
      query: "",
      limit: 1,
      offset: 0,
    }),
    enabled: !!user,
  });

  // Realtime: any new message refetches the thread list
  const refetchAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["messaging_threads"] });
    queryClient.invalidateQueries({ queryKey: ["messaging_threads_count"] });
  }, [queryClient]);
  useThreadListUpdates(refetchAll);

  // Switch tab handler
  const handleTabChange = (tab: "primary" | "requests") => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  // Sync URL on initial mount when tab param changes externally
  useEffect(() => { setActiveTab(tabParam); }, [tabParam]);

  // Resolve active thread metadata: full thread row + other-user profile +
  // pinned content lookup. Powers ConversationHeader.
  const activeThreadId = routeThreadId ?? null;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchInThreadOpen, setSearchInThreadOpen] = useState(false);
  const [inThreadQuery, setInThreadQuery] = useState("");

  const { data: activeThreadInfo } = useQuery({
    queryKey: ["active_thread_meta", activeThreadId, user?.id],
    queryFn: async () => {
      if (!activeThreadId || !user) return null;
      const { data: t } = await supabase
        .from("dm_threads")
        .select("id, type, title, participant_a, participant_b, pinned_content_id, pinned_content_type, is_pinned_a, is_pinned_b, is_muted_a, is_muted_b")
        .eq("id", activeThreadId)
        .maybeSingle();
      if (!t) return null;
      const tt = t as any;

      // Other user profile (for direct threads + ThreadView)
      const otherId = tt.participant_a === user.id ? tt.participant_b : tt.participant_a;
      let otherUser: any = { id: otherId, display_name: "User", username: "", avatar_url: null };
      if (otherId) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .eq("id", otherId)
          .maybeSingle();
        if (prof) otherUser = prof;
      }

      // Member list (for groups) + their avatars
      let memberAvatars: string[] = [];
      let memberCount = 2;
      if (tt.type !== "direct") {
        const { data: members } = await supabase
          .from("dm_thread_members")
          .select("user_id")
          .eq("thread_id", activeThreadId);
        const ids = (members ?? []).map((m: any) => m.user_id);
        memberCount = ids.length || 2;
        if (ids.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, avatar_url")
            .in("id", ids);
          memberAvatars = (profs ?? [])
            .map((p: any) => p.avatar_url)
            .filter((u: string | null): u is string => !!u)
            .slice(0, 4);
        }
      }

      // Pinned content lookup
      let pinnedContent: ConversationHeaderThread["pinnedContent"] = null;
      if (tt.pinned_content_id) {
        const { data: ci } = await supabase
          .from("content_items")
          .select("id, title, slug, post_type, bounty_reward_amount, bounty_reward_currency, bounty_reward_type, bounty_status")
          .eq("id", tt.pinned_content_id)
          .maybeSingle();
        if (ci) {
          const c = ci as any;
          let rewardLabel: string | null = null;
          if (tt.type === "bounty" && c.bounty_reward_amount) {
            const cur = c.bounty_reward_currency || c.bounty_reward_type || "";
            const symbol = cur === "GBP" ? "£" : cur === "USD" ? "$" : cur === "EUR" ? "€" : "";
            rewardLabel = symbol
              ? `${symbol}${c.bounty_reward_amount}`
              : `${c.bounty_reward_amount} ${cur}`.trim();
          }
          let statusLabel: string | null = null;
          if (tt.type === "bounty" && c.bounty_status) {
            statusLabel =
              c.bounty_status === "open"
                ? "Open"
                : c.bounty_status === "in_progress"
                  ? "In progress"
                  : c.bounty_status === "closed"
                    ? "Closed"
                    : c.bounty_status;
          }
          pinnedContent = {
            id: c.id,
            type: (tt.pinned_content_type as string) || c.post_type || "blueprint",
            title: c.title,
            slug: c.slug ?? null,
            rewardLabel,
            statusLabel,
          };
        }
      }

      const headerThread: ConversationHeaderThread = {
        id: tt.id,
        type: (tt.type ?? "direct") as ConversationHeaderThread["type"],
        title:
          tt.title ||
          otherUser.display_name ||
          otherUser.username ||
          "Conversation",
        subtitle: otherUser.username ? `@${otherUser.username}` : null,
        avatarUrls:
          tt.type === "direct"
            ? otherUser.avatar_url
              ? [otherUser.avatar_url]
              : []
            : memberAvatars,
        memberCount,
        pinnedContent,
      };

      const isA = tt.participant_a === user.id;
      return {
        otherUser,
        headerThread,
        isPinnedForMe: isA ? !!tt.is_pinned_a : !!tt.is_pinned_b,
        isMutedForMe: isA ? !!tt.is_muted_a : !!tt.is_muted_b,
        isA,
        type: tt.type,
      };
    },
    enabled: !!activeThreadId && !!user,
  });

  // Reset in-thread search when switching threads
  useEffect(() => {
    setSearchInThreadOpen(false);
    setInThreadQuery("");
    setSettingsOpen(false);
  }, [activeThreadId]);

  // Settings actions
  const togglePin = useCallback(async () => {
    if (!activeThreadId || !activeThreadInfo || !user) return;
    const field = activeThreadInfo.isA ? "is_pinned_a" : "is_pinned_b";
    await supabase
      .from("dm_threads")
      .update({ [field]: !activeThreadInfo.isPinnedForMe } as any)
      .eq("id", activeThreadId);
    queryClient.invalidateQueries({ queryKey: ["active_thread_meta"] });
    queryClient.invalidateQueries({ queryKey: ["messaging_threads"] });
  }, [activeThreadId, activeThreadInfo, user, queryClient]);

  const toggleMute = useCallback(async () => {
    if (!activeThreadId || !activeThreadInfo || !user) return;
    const field = activeThreadInfo.isA ? "is_muted_a" : "is_muted_b";
    await supabase
      .from("dm_threads")
      .update({ [field]: !activeThreadInfo.isMutedForMe } as any)
      .eq("id", activeThreadId);
    queryClient.invalidateQueries({ queryKey: ["active_thread_meta"] });
  }, [activeThreadId, activeThreadInfo, user, queryClient]);

  const leaveThread = useCallback(async () => {
    if (!activeThreadId || !user) return;
    if (!confirm("Leave this conversation?")) return;
    await supabase
      .from("dm_thread_members")
      .delete()
      .eq("thread_id", activeThreadId)
      .eq("user_id", user.id);
    setSettingsOpen(false);
    queryClient.invalidateQueries({ queryKey: ["messaging_threads"] });
    navigate("/messages");
  }, [activeThreadId, user, queryClient, navigate]);

  const openPinnedContent = useCallback(() => {
    const pinned = activeThreadInfo?.headerThread.pinnedContent;
    if (!pinned) return;
    if (pinned.slug) navigate(`/b/${pinned.slug}`);
    else navigate(`/content/${pinned.id}`);
  }, [activeThreadInfo, navigate]);


  // Map ThreadSummary → list-item shape expected by MessagesThreadList
  const threadItems = useMemo(() => {
    const items = (tabData?.threads ?? []) as ThreadSummary[];
    return items.map((t) => ({
      id: t.id,
      type: t.type,
      title: t.title || "Conversation",
      avatarUrls: t.avatarUrls,
      lastMessage: {
        kind: (t.lastMessage?.kind === "content-share" ? "content-share" : "text") as "text" | "content-share",
        preview: t.lastMessage?.preview ?? "",
        contentType: (t.lastMessage?.contentType ?? undefined) as "blueprint" | "stage" | "block" | undefined,
        isFromCurrentUser: t.lastMessage?.isFromCurrentUser ?? false,
        timestamp: timeAgo(t.lastMessage?.timestamp ?? null),
      },
      unreadCount: t.unreadCount,
      isPinned: t.isPinned,
    }));
  }, [tabData]);

  const counts = {
    primary: activeTab === "primary" ? (tabData?.total ?? 0) : (otherTabData?.total ?? 0),
    requests: activeTab === "requests" ? (tabData?.total ?? 0) : (otherTabData?.total ?? 0),
  };

  // Compose: pick a user → find/create a direct thread
  const handlePickUser = useCallback(async (recipientId: string) => {
    if (!user) return;
    const [pA, pB] = user.id < recipientId ? [user.id, recipientId] : [recipientId, user.id];
    const { data: existing } = await supabase
      .from("dm_threads")
      .select("id")
      .eq("participant_a", pA)
      .eq("participant_b", pB)
      .eq("type", "direct")
      .maybeSingle();
    let threadId = (existing as any)?.id as string | undefined;
    if (!threadId) {
      const { data: created, error } = await supabase
        .from("dm_threads")
        .insert({
          participant_a: pA,
          participant_b: pB,
          type: "direct",
          created_by: user.id,
          request_status: "accepted",
        } as any)
        .select("id")
        .single();
      if (error) { console.error(error); return; }
      threadId = (created as any).id as string;
    }
    refetchAll();
    navigate(`/messages/${threadId}`);
  }, [user, navigate, refetchAll]);

  if (!user) return null;

  return (
    <>
      <SeoHead title="Messages" description="Your conversations on NeoScale AI." path="/messages" />
      <div
        className="flex"
        style={{
          height: "100%",
          width: "100%",
          position: "relative",
          overflow: "hidden",
          background: "transparent",
        }}
      >
        <MessagesThreadList
          threads={threadItems}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          query={rawQuery}
          onQueryChange={setRawQuery}
          activeThreadId={activeThreadId}
          onThreadClick={(id) => navigate(`/messages/${id}`)}
          onCompose={() => setComposeOpen(true)}
          counts={counts}
          width={220}
        />

        <div className="flex-1 min-w-0 h-full flex flex-col">
          {activeThreadId && activeThreadInfo ? (
            <>
              <ConversationHeader
                thread={activeThreadInfo.headerThread}
                onBack={() => navigate("/messages")}
                onSearchInThread={() => setSearchInThreadOpen((v) => !v)}
                onSettings={() => setSettingsOpen(true)}
                onOpenPinnedContent={openPinnedContent}
              />
              {searchInThreadOpen && (
                <div
                  className="flex items-center gap-2 flex-shrink-0"
                  style={{
                    padding: "8px 14px",
                    borderBottom: "0.5px solid rgba(255, 255, 255, 0.14)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <Search size={12} style={{ color: "rgba(255,255,255,0.40)" }} />
                  <input
                    autoFocus
                    type="text"
                    value={inThreadQuery}
                    onChange={(e) => setInThreadQuery(e.target.value)}
                    placeholder="Search in conversation..."
                    className="flex-1 bg-transparent outline-none placeholder:text-white/40"
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 12,
                      color: "rgba(255,255,255,0.85)",
                    }}
                  />
                  <button
                    onClick={() => { setSearchInThreadOpen(false); setInThreadQuery(""); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="flex-1 min-h-0">
                <ThreadView
                  key={activeThreadId}
                  threadId={activeThreadId}
                  otherUser={activeThreadInfo.otherUser as any}
                  onBack={() => navigate("/messages")}
                  hideHeader
                />
              </div>
            </>
          ) : activeThreadId && !activeThreadInfo ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-6">
              <div
                className="flex items-center justify-center rounded-full"
                style={{ width: 72, height: 72, background: "rgba(255, 255, 255, 0.12)" }}
              >
                <MessageSquare size={28} style={{ color: "rgba(255,255,255,0.40)" }} />
              </div>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
                Select a conversation
              </p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.50)", maxWidth: 280 }}>
                Pick a thread from the list, or start a new one.
              </p>
              <button
                onClick={() => setComposeOpen(true)}
                className="mt-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                style={{
                  color: "rgba(255,255,255,0.92)",
                  background: "rgba(232,87,26,0.12)",
                  border: "0.5px solid rgba(232,87,26,0.30)",
                }}
              >
                Start a new conversation
              </button>
            </div>
          )}
          {isLoading && !tabData && (
            <div className="absolute inset-0 pointer-events-none" />
          )}
        </div>
      </div>

      {/* Settings drawer */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-[340px] sm:w-[380px] bg-[#0E0E16] border-l border-border">
          <SheetHeader>
            <SheetTitle className="text-base">Conversation settings</SheetTitle>
          </SheetHeader>
          {activeThreadInfo && (
            <div className="mt-4 space-y-1">
              {/* Members */}
              <div className="px-1 pb-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  Members ({activeThreadInfo.headerThread.memberCount})
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {activeThreadInfo.headerThread.avatarUrls.map((url, i) => (
                    <Avatar key={i} className="h-7 w-7">
                      <AvatarImage src={url} />
                      <AvatarFallback className="text-[9px] bg-accent text-muted-foreground">??</AvatarFallback>
                    </Avatar>
                  ))}
                  {activeThreadInfo.type === "direct" && (
                    <span className="text-xs text-muted-foreground">
                      You & {activeThreadInfo.otherUser?.display_name || activeThreadInfo.otherUser?.username || "User"}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={togglePin}
                className="flex items-center gap-2 w-full px-2 py-2 rounded-md text-sm hover:bg-white/5 transition-colors"
              >
                <Pin size={14} className="text-muted-foreground" />
                {activeThreadInfo.isPinnedForMe ? "Unpin thread" : "Pin thread"}
              </button>
              <button
                onClick={toggleMute}
                className="flex items-center gap-2 w-full px-2 py-2 rounded-md text-sm hover:bg-white/5 transition-colors"
              >
                <BellOff size={14} className="text-muted-foreground" />
                {activeThreadInfo.isMutedForMe ? "Unmute" : "Mute notifications"}
              </button>
              {activeThreadInfo.headerThread.pinnedContent && (
                <button
                  onClick={() => { setSettingsOpen(false); openPinnedContent(); }}
                  className="flex items-center gap-2 w-full px-2 py-2 rounded-md text-sm hover:bg-white/5 transition-colors"
                >
                  <ExternalLink size={14} className="text-muted-foreground" />
                  Open pinned {activeThreadInfo.headerThread.pinnedContent.type}
                </button>
              )}
              {activeThreadInfo.type !== "direct" && (
                <button
                  onClick={leaveThread}
                  className="flex items-center gap-2 w-full px-2 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut size={14} />
                  Leave thread
                </button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        userId={user.id}
        onPickUser={handlePickUser}
      />
    </>
  );
}
