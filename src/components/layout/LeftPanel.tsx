import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home, LayoutGrid, Upload, Library, User, MoreHorizontal, LogOut, Bell, MessageCircle, BarChart3, FilePenLine, Target,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavBadges } from "@/hooks/useNavBadges";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

import { useDraftCount } from "@/hooks/useDraftCount";


interface NavItem {
  icon: React.ElementType;
  label: string;
  to: string;
  authOnly?: boolean;
  badge?: string | null;
  divider?: boolean;
}

export function LeftPanel({ collapsed = false }: { collapsed?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, profile, signOut } = useAuth();
  const { hasUnseenSaves } = useNavBadges();
  const { display: notifBadge } = useUnreadNotifications();
  const { display: msgBadge } = useUnreadMessages();

  const { display: draftBadge } = useDraftCount();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const navItems: NavItem[] = [
    // Discovery
    { icon: Home, label: "Home", to: "/" },
    { icon: LayoutGrid, label: "Discover", to: "/discover" },
    { icon: Library, label: "Library", to: "/library", authOnly: true },
    // Creation
    { icon: Upload, label: "Upload", to: "/upload", divider: true },
    { icon: Target, label: "Bounties", to: "/browse?bounties=open" },
    { icon: FilePenLine, label: "Drafts", to: "/drafts", authOnly: true, badge: draftBadge },
    // Communication
    { icon: MessageCircle, label: "Messages", to: "/messages", authOnly: true, badge: msgBadge, divider: true },
    { icon: Bell, label: "Notifications", to: "/notifications", authOnly: true, badge: notifBadge },
    // Identity + Account
    { icon: User, label: "My Profile", to: "/profile", authOnly: true, divider: true },
    ...(isLoggedIn && profile?.is_creator ? [{ icon: BarChart3, label: "Analytics", to: "/analytics", authOnly: true }] : []),
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
    <div className="flex flex-col">
      {/* Wordmark */}
      <div className={`px-6 pt-7 pb-5 ${collapsed ? "flex justify-center" : ""}`}>
        <Link to="/" className={collapsed ? "text-xl font-light text-[#8B4513]" : "block"}>
          {collapsed ? (
            "N"
          ) : (
            <>
              <span className="text-2xl font-light text-[#8B4513] tracking-tighter uppercase">NeoScale AI</span>
              <p className="text-[10px] text-slate-500 tracking-[0.2em] mt-0.5 uppercase">The Digital Alchemist</p>
            </>
          )}
        </Link>
      </div>

      {/* Nav items */}
      <nav className="px-2">
        {visibleItems.map((item, idx) => {
          const isActive = location.pathname === item.to;
          return (
            <div key={item.to}>
              {item.divider && idx > 0 && (
                <div className="my-2 border-t" style={{ borderColor: "#1E1E2A" }} />
              )}
              <Link
                to={item.to}
                className={`relative flex items-center gap-3 rounded-lg ${
                  collapsed ? "justify-center px-0" : "px-4"
                } h-12 text-sm`}
                style={isActive
                  ? { color: 'var(--orange)', borderLeft: '2px solid var(--orange)', background: 'rgba(139,69,19,0.08)' }
                  : { color: 'var(--text-muted)' }
                }
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <item.icon className="h-[22px] w-[22px] shrink-0 transition-colors" />
                {!collapsed && <span>{item.label}</span>}
                {item.badge && item.to === "/messages" && (
                  <span
                    className={`${collapsed ? "absolute -top-0.5 -right-0.5" : "ml-auto"} flex items-center justify-center rounded-full text-white`}
                    style={{
                      height: 16, minWidth: 16, padding: '0 4px',
                      background: '#E8571A',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      fontSize: 9, fontWeight: 600, lineHeight: 1,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
                {item.badge && item.to !== "/messages" && (
                  <span className={`${collapsed ? "absolute -top-0.5 -right-0.5" : "ml-auto"} flex h-5 min-w-[20px] items-center justify-center rounded-full ${item.to === "/drafts" ? "bg-[#353439] text-slate-400" : "bg-[#8B4513] text-white"} px-1.5 text-[11px] font-bold`}>
                    {item.badge}
                  </span>
                )}
                {item.to === "/library" && hasUnseenSaves && !item.badge && (
                  <span className={`${collapsed ? "absolute top-1 right-1" : "ml-auto"} h-2 w-2 rounded-full bg-primary`} />
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Bottom user section */}
      <div className="mt-3 px-4 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        {isLoggedIn ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`flex w-full items-center gap-3 rounded-xl p-2 text-sm text-slate-400 transition-colors ${collapsed ? "justify-center" : ""}`}
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
              <div className="absolute bottom-full left-0 mb-1 w-full rounded-xl border border-white/5 p-1 shadow-lg" style={{ background: "rgba(8,8,12,0.95)" }}>
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400"
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
                <Button variant="outline" className="w-full border-white/10 text-slate-300" size="sm" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button
                  className="w-full"
                  size="sm"
                  asChild
                  data-visual-slot="btn-primary"
                  style={{
                    background: '#111',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: 'var(--radius-btn)',
                    color: '#fff',
                    fontWeight: 600,
                  }}
                >
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
