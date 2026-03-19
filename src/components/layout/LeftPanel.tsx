import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home, LayoutGrid, Upload, Library, User, MoreHorizontal, LogOut, Bell, MessageCircle, BarChart3, FilePenLine,
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
    // Identity
    { icon: User, label: "My Profile", to: "/profile", authOnly: true },
    // Discovery
    { icon: Home, label: "Home", to: "/", divider: true },
    { icon: LayoutGrid, label: "Discover", to: "/browse" },
    { icon: Library, label: "Library", to: "/library", authOnly: true },
    // Creation
    { icon: Upload, label: "Upload", to: "/upload", divider: true },
    { icon: FilePenLine, label: "Drafts", to: "/drafts", authOnly: true, badge: draftBadge },
    // Communication
    { icon: MessageCircle, label: "Messages", to: "/messages", authOnly: true, badge: msgBadge, divider: true },
    { icon: Bell, label: "Notifications", to: "/notifications", authOnly: true, badge: notifBadge },
    // Account (creators only)
    ...(isLoggedIn && profile?.is_creator ? [{ icon: BarChart3, label: "Analytics", to: "/analytics", authOnly: true, divider: true }] : []),
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
      <nav className="flex-1 px-2">
        {visibleItems.map((item, idx) => {
          const isActive = location.pathname === item.to;
          return (
            <div key={item.to}>
              {item.divider && idx > 0 && (
                <div className="my-2 border-t" style={{ borderColor: "#1E1E2A" }} />
              )}
              <Link
                to={item.to}
                className={`relative flex items-center gap-3 rounded-lg transition-colors ${
                  collapsed ? "justify-center px-0" : "px-3"
                } h-12 text-sm ${
                  isActive
                    ? "text-primary font-semibold border-l-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                <item.icon className={`h-[22px] w-[22px] shrink-0 transition-colors ${!isActive ? "group-hover:text-primary/60" : ""}`} />
                {!collapsed && <span>{item.label}</span>}
                {item.badge && (
                  <span className={`${collapsed ? "absolute -top-0.5 -right-0.5" : "ml-auto"} flex h-5 min-w-[20px] items-center justify-center rounded-full ${item.to === "/drafts" ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"} px-1.5 text-[11px] font-bold`}>
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
      <div className="mt-auto px-3 py-3" style={{ borderTop: "1px solid #1E1E2A" }}>
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
