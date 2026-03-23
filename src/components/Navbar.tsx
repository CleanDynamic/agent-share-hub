import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Upload, Bookmark as BookmarkIcon } from "lucide-react";
import { Menu, X, LogOut, User, Bookmark, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavBadges } from "@/hooks/useNavBadges";

function getNavLinks(isLoggedIn: boolean) {
  const links = [{ label: "Browse", to: "/browse" }];
  links.push({ label: "Recent", to: "/recent" });
  if (isLoggedIn) {
    links.push({ label: "For You", to: "/fyp" });
    links.push({ label: "Feed", to: "/feed" });
  }
  links.push({ label: "Upload", to: "/upload" });
  if (!isLoggedIn) links.push({ label: "About", to: "/about" });
  return links;
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, profile, signOut } = useAuth();
  const { hasUnseenSaves, fypCount } = useNavBadges();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };
  const NAV_LINKS = getNavLinks(isLoggedIn);
  const panelRef = useRef<HTMLDivElement>(null);

  const initials = profile?.display_name
    ? profile.display_name.slice(0, 2).toUpperCase()
    : profile?.username?.slice(0, 2).toUpperCase() ?? "?";

  const fypBadgeLabel = fypCount > 9 ? "9+" : fypCount > 0 ? String(fypCount) : null;

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close mobile panel on outside click
  useEffect(() => {
    if (!mobileOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mobileOpen]);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="text-lg font-bold tracking-tight text-primary">
            NeoScale AI
          </Link>

          {/* Desktop */}
          <div className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`relative text-sm transition-colors ${
                  location.pathname === link.to
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
                {link.to === "/fyp" && fypBadgeLabel && (
                  <span className="absolute -top-2 -right-4 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {fypBadgeLabel}
                  </span>
                )}
              </Link>
            ))}

            {isLoggedIn && (
              <>
                {/* Bookmark quick-access */}
                <button
                  onClick={() => navigate("/saved")}
                  className="relative rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
                  aria-label="Saved items"
                >
                  <BookmarkIcon className="h-4 w-4" />
                  {hasUnseenSaves && (
                    <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-primary" />
                  )}
                </button>

                <Link to="/profile" className="rounded-full outline-none ring-ring focus-visible:ring-2">
                  <Avatar className="h-8 w-8 cursor-pointer">
                    {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              </>
            )}

            {!isLoggedIn && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button size="sm" className="ns-btn-primary" asChild>
                  <Link to="/signup">Join free</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile slide-in panel */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          {/* Panel */}
          <div
            ref={panelRef}
            className="absolute top-16 right-0 bottom-0 w-full max-w-xs bg-background border-l border-border overflow-y-auto animate-in slide-in-from-right duration-200"
          >
            <div className="p-6 space-y-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center min-h-[44px] text-sm transition-colors rounded-lg px-3 ${
                    location.pathname === link.to
                      ? "text-foreground font-medium bg-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  {link.label}
                  {link.to === "/fyp" && fypBadgeLabel && (
                    <span className="ml-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {fypBadgeLabel}
                    </span>
                  )}
                </Link>
              ))}

              <div className="border-t border-border my-3" />

              {isLoggedIn ? (
                <>
                  <Link to="/fyp" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 min-h-[44px] text-sm text-muted-foreground hover:text-foreground px-3 rounded-lg hover:bg-accent/50">
                    <Heart className="h-4 w-4" /> For You
                    {fypBadgeLabel && (
                      <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                        {fypBadgeLabel}
                      </span>
                    )}
                  </Link>
                  <Link to="/my-uploads" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 min-h-[44px] text-sm text-muted-foreground hover:text-foreground px-3 rounded-lg hover:bg-accent/50">
                    <Upload className="h-4 w-4" /> My Uploads
                  </Link>
                  <Link to="/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 min-h-[44px] text-sm text-muted-foreground hover:text-foreground px-3 rounded-lg hover:bg-accent/50">
                    <User className="h-4 w-4" /> My Profile
                  </Link>
                  <Link to="/saved" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 min-h-[44px] text-sm text-muted-foreground hover:text-foreground px-3 rounded-lg hover:bg-accent/50">
                    <Bookmark className="h-4 w-4" /> Saved
                    {hasUnseenSaves && (
                      <span className="ml-auto h-2 w-2 rounded-full bg-primary" />
                    )}
                  </Link>
                  <div className="border-t border-border my-3" />
                  <button
                    onClick={() => { handleSignOut(); setMobileOpen(false); }}
                    className="flex items-center gap-3 min-h-[44px] text-sm text-destructive px-3 rounded-lg hover:bg-accent/50 w-full"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </>
              ) : (
                <div className="space-y-2 pt-2">
                  <Button variant="outline" className="w-full min-h-[44px]" asChild>
                    <Link to="/login" onClick={() => setMobileOpen(false)}>Sign in</Link>
                  </Button>
                  <Button className="ns-btn-primary w-full min-h-[44px]" asChild>
                    <Link to="/signup" onClick={() => setMobileOpen(false)}>Join free</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
