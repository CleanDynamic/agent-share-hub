import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home, Search, Upload, User, X, LayoutGrid,
  Library, Info, UserPlus, MoreHorizontal, LogOut, Bell, MessageCircle, BarChart3, FilePenLine,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useNavBadges } from "@/hooks/useNavBadges";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { supabase } from "@/integrations/supabase/client";
import { RightPanel } from "./RightPanel";

/* ---- Badge hooks ---- */
function useRecentBadge() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const lastVisit = localStorage.getItem("last_recent_visit");
    const since = lastVisit || new Date(0).toISOString();
    supabase
      .from("content_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .gt("created_at", since)
      .then(({ count }) => setShow((count ?? 0) > 0));
  }, []);
  return show;
}

function useProfileBadge(userId?: string) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!userId) return;
    const lastVisit = localStorage.getItem("last_profile_visit");
    const since = lastVisit || new Date(0).toISOString();
    supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("following_id", userId)
      .gt("created_at", since)
      .then(({ count }) => setShow((count ?? 0) > 0));
  }, [userId]);
  return show;
}

/* ---- Search Overlay ---- */
function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [content, setContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setUsers([]); setContent([]); return; }
    setLoading(true);
    const [uRes, cRes] = await Promise.all([
      supabase.from("profiles").select("id, username, display_name, avatar_url").or(`display_name.ilike.%${q}%,username.ilike.%${q}%`).limit(5),
      supabase.from("content_items").select("id, title, content_type, creator_id, profiles!content_items_creator_id_fkey(username)").ilike("title", `%${q}%`).eq("status", "approved").limit(5),
    ]);
    setUsers(uRes.data ?? []);
    setContent(cRes.data ?? []);
    setLoading(false);
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const go = (path: string) => { onClose(); navigate(path); };
  const noResults = !loading && users.length === 0 && content.length === 0 && query.length >= 2;

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      <div className="flex items-center gap-2 px-4 h-14 border-b border-border shrink-0">
        <button onClick={onClose} className="p-2 text-muted-foreground"><X className="h-5 w-5" /></button>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim().length >= 1) {
                onClose();
                navigate(`/search?q=${encodeURIComponent(query.trim())}`);
              }
            }}
            placeholder="Search users or content..."
            className="h-10 bg-card border-border pl-9 text-sm"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {loading && <p className="text-xs text-muted-foreground">Searching…</p>}
        {noResults && <p className="text-xs text-muted-foreground">No results for "{query}"</p>}
        {users.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider mb-2">Users</p>
            {users.map((u: any) => (
              <button key={u.id} onClick={() => go(`/creator/${u.username}`)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-accent/60">
                <Avatar className="h-8 w-8">
                  {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">{(u.display_name || u.username || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="text-sm font-medium">{u.display_name || u.username}</p>
                  {u.username && <p className="text-xs text-muted-foreground">@{u.username}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
        {content.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider mb-2">Content</p>
            {content.map((c: any) => (
              <button key={c.id} onClick={() => go(`/content/${c.id}`)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2.5 hover:bg-accent/60">
                <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">{c.content_type}</span>
                <span className="truncate text-sm">{c.title}</span>
              </button>
            ))}
          </div>
        )}
        {query.length >= 2 && !loading && (
          <button
            onClick={() => { onClose(); navigate(`/search?q=${encodeURIComponent(query.trim())}`); }}
            className="w-full text-center text-xs text-primary hover:underline py-3"
          >
            See all results for "{query}"
          </button>
        )}
      </div>
    </div>
  );
}

/* ---- Slide-in Left Panel ---- */
function MobileLeftPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isLoggedIn, profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = profile?.display_name
    ? profile.display_name.slice(0, 2).toUpperCase()
    : profile?.username?.slice(0, 2).toUpperCase() ?? "?";

  const handleNav = (path: string) => { onClose(); navigate(path); };
  const handleSignOut = async () => { onClose(); await signOut(); navigate("/"); };

  // Fetch follow counts
  const [followingCount, setFollowingCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", user.id),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", user.id),
    ]).then(([fg, fr]) => {
      setFollowingCount(fg.count ?? 0);
      setFollowerCount(fr.count ?? 0);
    });
  }, [user?.id]);

  type MobileNavItem = { icon: any; label: string; to: string; authOnly?: boolean; badge?: string | null; divider?: boolean };
  const navItems: MobileNavItem[] = [
    // Identity
    { icon: User, label: "Profile", to: "/profile", authOnly: true },
    // Discovery
    { icon: Home, label: "Home", to: "/", divider: true },
    { icon: LayoutGrid, label: "Discover", to: "/browse" },
    { icon: Library, label: "Library", to: "/library", authOnly: true },
    // Creation
    { icon: Upload, label: "Upload", to: "/upload", divider: true },
    { icon: FilePenLine, label: "Drafts", to: "/drafts", authOnly: true },
    // Communication
    { icon: MessageCircle, label: "Messages", to: "/messages", authOnly: true, divider: true },
    { icon: Bell, label: "Notifications", to: "/notifications", authOnly: true },
    // Account
    ...(isLoggedIn && profile?.is_creator ? [{ icon: BarChart3, label: "Analytics", to: "/analytics", authOnly: true, divider: true } as MobileNavItem] : []),
    { icon: Info, label: "About", to: "/about", divider: !(isLoggedIn && profile?.is_creator) },
  ].filter((item) => (!item.authOnly || isLoggedIn));

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[55] transition-opacity duration-250 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className="fixed top-0 left-0 bottom-0 z-[56] overflow-y-auto bg-background border-r border-border transition-transform duration-250 ease-out"
        style={{
          width: "min(80vw, 300px)",
          transform: open ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        <div className="p-5 flex flex-col h-full">
          {/* Top section */}
          {isLoggedIn && profile ? (
            <div className="mb-5">
              <div className="flex items-start justify-between mb-2">
                <Avatar className="h-12 w-12">
                  {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex gap-1">
                  <button className="p-2 rounded-full border border-border text-muted-foreground hover:text-foreground" onClick={() => handleNav("/browse")}>
                    <UserPlus className="h-4 w-4" />
                  </button>
                  <button className="p-2 rounded-full border border-border text-muted-foreground hover:text-foreground" onClick={() => setMenuOpen(!menuOpen)}>
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="text-lg font-bold text-foreground">{profile.display_name || profile.username}</p>
              {profile.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
              <div className="flex gap-4 mt-2 text-sm">
                <span><strong className="text-foreground">{followingCount}</strong> <span className="text-muted-foreground">Following</span></span>
                <span><strong className="text-foreground">{followerCount}</strong> <span className="text-muted-foreground">Followers</span></span>
              </div>
            </div>
          ) : (
            <div className="mb-5 space-y-2">
              <Button variant="outline" className="w-full" asChild><Link to="/login" onClick={onClose}>Sign in</Link></Button>
              <Button className="w-full" asChild><Link to="/signup" onClick={onClose}>Join free</Link></Button>
            </div>
          )}

          {/* Nav items */}
          <nav className="flex-1">
            {navItems.map((item, idx) => {
              const isActive = location.pathname === item.to;
              return (
                <div key={item.to}>
                  {item.divider && idx > 0 && (
                    <div className="my-2 border-t" style={{ borderColor: "#1E1E2A" }} />
                  )}
                  <button
                    onClick={() => handleNav(item.to)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 h-12 text-sm transition-colors ${
                      isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                    }`}
                  >
                    <item.icon className="h-[22px] w-[22px] shrink-0" />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                        {item.badge}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}

            <div className="border-t border-border my-3" />
          </nav>

          {/* Sign out at bottom */}
          {isLoggedIn && (
            <div className="mt-auto pt-4 border-t border-border">
              <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-accent/60">
                <LogOut className="h-5 w-5" /> Sign out
              </button>
            </div>
          )}

          {/* Popup menu */}
          {menuOpen && (
            <div className="absolute top-20 right-5 rounded-lg border border-border bg-popover p-1 shadow-lg z-10">
              <button onClick={handleSignOut} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-accent/60 w-full">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ---- Slide-in Right Panel (Discover) ---- */
function MobileRightPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <div
        className={`fixed inset-0 z-[55] transition-opacity duration-250 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      />
      <div
        className="fixed top-0 right-0 bottom-0 z-[56] overflow-y-auto bg-background border-l border-border transition-transform duration-250 ease-out"
        style={{
          width: "min(85vw, 350px)",
          transform: open ? "translateX(0)" : "translateX(100%)",
        }}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-border">
          <p className="text-sm font-medium text-foreground">Discover</p>
          <button onClick={onClose} className="p-2 text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>
        <RightPanel />
      </div>
    </>
  );
}

/* ---- Main Mobile Nav Export ---- */
export function MobileNav() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, profile, user } = useAuth();
  const recentBadge = useRecentBadge();
  const { display: notifBadge } = useUnreadNotifications();
  const { display: msgBadge } = useUnreadMessages();
  const [showDiscover, setShowDiscover] = useState(false);

  useEffect(() => {
    setShowDiscover(window.innerWidth > 375);
    const handler = () => setShowDiscover(window.innerWidth > 375);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Track visits for badges
  useEffect(() => {
    if (location.pathname === "/recent") localStorage.setItem("last_recent_visit", new Date().toISOString());
    if (location.pathname === "/profile") localStorage.setItem("last_profile_visit", new Date().toISOString());
  }, [location.pathname]);

  // Close panels on route change
  useEffect(() => { setLeftOpen(false); setRightOpen(false); }, [location.pathname]);

  const initials = profile?.display_name
    ? profile.display_name.slice(0, 2).toUpperCase()
    : profile?.username?.slice(0, 2).toUpperCase() ?? "?";

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 bg-background border-b border-border" style={{ height: 56 }}>
        <button onClick={() => setLeftOpen(true)} className="p-1">
          {isLoggedIn && profile ? (
            <Avatar className="h-8 w-8">
              {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
            </Avatar>
          ) : (
            <User className="h-6 w-6 text-muted-foreground" />
          )}
        </button>
        <Link to="/" className="text-lg font-bold text-primary">NeoScale AI</Link>
        <button onClick={() => setSearchOpen(true)} className="p-2 text-muted-foreground hover:text-foreground">
          <Search className="h-5 w-5" />
        </button>
      </header>

      {/* Bottom Tab Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-end justify-around bg-background border-t border-border"
        style={{ height: 56, paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Tab 1: Home */}
        <button onClick={() => navigate("/")} className={`flex flex-col items-center justify-center flex-1 h-full ${isActive("/") ? "text-primary" : "text-muted-foreground"}`}>
          <Home className="h-6 w-6" />
          <span className="text-[10px] mt-0.5">Home</span>
        </button>

        {/* Tab 2: Search */}
        <button onClick={() => setSearchOpen(true)} className="flex flex-col items-center justify-center flex-1 h-full text-muted-foreground">
          <Search className="h-6 w-6" />
          <span className="text-[10px] mt-0.5">Search</span>
        </button>

        {/* Tab 3: Upload (raised) */}
        <div className="flex flex-col items-center justify-end flex-1 h-full relative">
          <button
            onClick={() => navigate("/upload")}
            className="absolute -top-3 flex items-center justify-center rounded-full bg-primary shadow-lg"
            style={{ width: 56, height: 56 }}
          >
            <Upload className="h-6 w-6 text-primary-foreground" />
          </button>
          <span className={`text-[10px] mb-1 ${isActive("/upload") ? "text-primary" : "text-muted-foreground"}`}>Upload</span>
        </div>

        {/* Tab 4: Messages */}
        <button
          onClick={() => navigate(isLoggedIn ? "/messages" : "/login")}
          className={`relative flex flex-col items-center justify-center flex-1 h-full ${isActive("/messages") ? "text-primary" : "text-muted-foreground"}`}
        >
          <MessageCircle className="h-6 w-6" />
          {msgBadge && (
            <span className="absolute top-1.5 right-1/2 translate-x-4 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {msgBadge}
            </span>
          )}
          <span className="text-[10px] mt-0.5">Messages</span>
        </button>

        {/* Tab 5: Notifications */}
        <button
          onClick={() => navigate(isLoggedIn ? "/notifications" : "/login")}
          className={`relative flex flex-col items-center justify-center flex-1 h-full ${isActive("/notifications") ? "text-primary" : "text-muted-foreground"}`}
        >
          <Bell className="h-6 w-6" />
          {notifBadge && (
            <span className="absolute top-1.5 right-1/2 translate-x-4 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {notifBadge}
            </span>
          )}
          <span className="text-[10px] mt-0.5">Alerts</span>
        </button>

        {/* Tab 6: Discover (>375px only) */}
        {showDiscover && (
          <button onClick={() => setRightOpen(true)} className="flex flex-col items-center justify-center flex-1 h-full text-muted-foreground">
            <LayoutGrid className="h-6 w-6" />
            <span className="text-[10px] mt-0.5">Discover</span>
          </button>
        )}
      </nav>

      {/* Overlays */}
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
      <MobileLeftPanel open={leftOpen} onClose={() => setLeftOpen(false)} />
      <MobileRightPanel open={rightOpen} onClose={() => setRightOpen(false)} />
    </>
  );
}
