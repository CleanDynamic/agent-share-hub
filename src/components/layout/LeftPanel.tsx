import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home, Search, LayoutGrid, Clock, Heart, Upload, Info,
  Bookmark, User, MoreHorizontal, LogOut, Settings, Bell, MessageCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavBadges } from "@/hooks/useNavBadges";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { supabase } from "@/integrations/supabase/client";

interface NavItem {
  icon: React.ElementType;
  label: string;
  to: string;
  authOnly?: boolean;
  badge?: string | null;
}

export function LeftPanel({ collapsed = false }: { collapsed?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, profile, signOut } = useAuth();
  const { hasUnseenSaves, fypCount } = useNavBadges();
  const { display: notifBadge } = useUnreadNotifications();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const fypBadge = fypCount > 9 ? "9+" : fypCount > 0 ? String(fypCount) : null;

  const navItems: NavItem[] = [
    { icon: Home, label: "Home", to: "/" },
    { icon: LayoutGrid, label: "Browse", to: "/browse" },
    { icon: Clock, label: "Recent", to: "/recent" },
    { icon: Heart, label: "For You", to: "/fyp", authOnly: true, badge: fypBadge },
    { icon: Upload, label: "Upload", to: "/upload" },
    { icon: Info, label: "About", to: "/about" },
    { icon: Bookmark, label: "Saved", to: "/saved", authOnly: true },
    { icon: Bell, label: "Notifications", to: "/notifications", authOnly: true, badge: notifBadge },
    { icon: User, label: "My Profile", to: "/profile", authOnly: true },
  ];

  const visibleItems = navItems.filter((item) => !item.authOnly || isLoggedIn);

  const initials = profile?.display_name
    ? profile.display_name.slice(0, 2).toUpperCase()
    : profile?.username?.slice(0, 2).toUpperCase() ?? "?";

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    navigate("/");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Wordmark */}
      <div className={`px-4 pt-5 pb-4 ${collapsed ? "flex justify-center" : ""}`}>
        <Link to="/" className="text-xl font-bold text-primary">
          {collapsed ? "N" : "NeoScale AI"}
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-0.5 px-2">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex items-center gap-3 rounded-lg transition-colors ${
                collapsed ? "justify-center px-0" : "px-3"
              } h-12 text-sm ${
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              }`}
            >
              <item.icon className="h-[22px] w-[22px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {item.badge && (
                <span className={`${collapsed ? "absolute -top-0.5 -right-0.5" : "ml-auto"} flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground`}>
                  {item.badge}
                </span>
              )}
              {item.to === "/saved" && hasUnseenSaves && !item.badge && (
                <span className={`${collapsed ? "absolute top-1 right-1" : "ml-auto"} h-2 w-2 rounded-full bg-primary`} />
              )}
            </Link>
          );
        })}

        {/* Search — desktop only */}
        {!collapsed && <SearchSection />}
      </nav>

      {/* Bottom user section */}
      <div className="mt-auto border-t border-border px-3 py-3">
        {isLoggedIn ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`flex w-full items-center gap-3 rounded-lg p-2 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground ${collapsed ? "justify-center" : ""}`}
            >
              <Avatar className="h-8 w-8 shrink-0">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex-1 text-left overflow-hidden">
                    <p className="truncate font-medium text-foreground text-sm">{profile?.display_name || profile?.username}</p>
                    {profile?.username && <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>}
                  </div>
                  <MoreHorizontal className="h-4 w-4 shrink-0" />
                </>
              )}
            </button>
            {menuOpen && (
              <div className="absolute bottom-full left-0 mb-1 w-full rounded-lg border border-border bg-popover p-1 shadow-lg">
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-accent/60"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className={`space-y-2 ${collapsed ? "px-0" : ""}`}>
            {collapsed ? (
              <Button size="icon" variant="outline" className="w-full" asChild>
                <Link to="/login"><User className="h-4 w-4" /></Link>
              </Button>
            ) : (
              <>
                <Button variant="outline" className="w-full" size="sm" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button className="w-full" size="sm" asChild>
                  <Link to="/signup">Join free</Link>
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Inline Search ---- */
function SearchSection() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [content, setContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
    setOpen(val.length >= 2);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const go = (path: string) => { setOpen(false); setQuery(""); navigate(path); };

  const noResults = !loading && users.length === 0 && content.length === 0 && query.length >= 2;

  return (
    <div className="relative mt-4 px-1" ref={wrapperRef}>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground px-2">Search</p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Search users or content..."
          className="h-10 bg-card border-border pl-9 text-sm"
        />
      </div>
      {open && (
        <div className="absolute left-1 right-1 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
          {loading && <p className="p-3 text-xs text-muted-foreground">Searching…</p>}
          {noResults && <p className="p-3 text-xs text-muted-foreground">No results for "{query}"</p>}
          {users.length > 0 && (
            <div className="p-2">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Users</p>
              {users.map((u: any) => (
                <button key={u.id} onClick={() => go(`/creator/${u.username}`)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/60">
                  <Avatar className="h-6 w-6">
                    {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                    <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">{(u.display_name || u.username || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{u.display_name || u.username}</span>
                  {u.username && <span className="text-xs text-muted-foreground">@{u.username}</span>}
                </button>
              ))}
            </div>
          )}
          {content.length > 0 && (
            <div className="p-2 border-t border-border">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Content</p>
              {content.map((c: any) => (
                <button key={c.id} onClick={() => go(`/content/${c.id}`)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/60">
                  <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">{c.content_type}</span>
                  <span className="truncate">{c.title}</span>
                  {c.profiles?.username && <span className="ml-auto text-xs text-muted-foreground">@{c.profiles.username}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
