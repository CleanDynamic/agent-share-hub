import { ArrowLeft, Search, Bell } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export type PageContextType =
  | "home"
  | "discover"
  | "messages"
  | "notifications"
  | "content-detail"
  | "upload"
  | "profile";

export interface PageContext {
  type: PageContextType;
  title?: string;
}

export interface UnreadCounts {
  notifications?: number;
  messages?: number;
}

export interface MobileTopBarProps {
  pageContext: PageContext;
  currentUserAvatarUrl?: string;
  currentUserInitials: string;
  unreadCounts?: UnreadCounts;
  onProfileDrawerOpen: () => void;
  onRightRailDrawerOpen: () => void;
  onBack?: () => void;
  onNotificationsOpen?: () => void;
}

const BRAND_ORANGE = "#E8571A";

const TITLE_STYLE: React.CSSProperties = {
  color: "#FFFFFF",
  fontFamily: "Figtree, sans-serif",
  fontSize: 16,
  fontWeight: 600,
};

export function MobileTopBar({
  pageContext,
  currentUserAvatarUrl,
  currentUserInitials,
  unreadCounts,
  onProfileDrawerOpen,
  onRightRailDrawerOpen,
  onBack,
  onNotificationsOpen,
}: MobileTopBarProps) {
  const showBackArrow =
    pageContext.type === "content-detail" || pageContext.type === "profile";
  const showSearchIcon = pageContext.type !== "messages";
  const hasUnreadNotifs = (unreadCounts?.notifications ?? 0) > 0;

  const center = (() => {
    switch (pageContext.type) {
      case "home":
        return (
          <span
            style={{
              color: BRAND_ORANGE,
              fontFamily: "Figtree, sans-serif",
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            NeoScale
          </span>
        );
      case "discover":
        return <span style={TITLE_STYLE}>Discover</span>;
      case "messages":
        return <span style={TITLE_STYLE}>Messages</span>;
      case "notifications":
        return <span style={TITLE_STYLE}>Alerts</span>;
      case "upload":
        return <span style={TITLE_STYLE}>Upload</span>;
      case "profile":
        return <span style={TITLE_STYLE}>{pageContext.title || "@profile"}</span>;
      case "content-detail":
        return (
          <span style={{ ...TITLE_STYLE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
            {pageContext.title || "Content"}
          </span>
        );
      default:
        return null;
    }
  })();

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "calc(56px + env(safe-area-inset-top))",
        paddingTop: "env(safe-area-inset-top)",
        display: "grid",
        gridTemplateColumns: "56px 1fr 56px",
        alignItems: "center",
        background: "rgba(15,15,20,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        zIndex: 1000,
      }}
    >
      {/* Left: Avatar (opens profile drawer) */}
      <button
        type="button"
        onClick={onProfileDrawerOpen}
        aria-label="Open profile menu"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 44,
          minHeight: 44,
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        <Avatar className="h-8 w-8">
          {currentUserAvatarUrl && <AvatarImage src={currentUserAvatarUrl} />}
          <AvatarFallback style={{ background: "#8B4513", color: "#fff", fontSize: 11 }}>
            {currentUserInitials}
          </AvatarFallback>
        </Avatar>
      </button>

      {/* Center: title with optional back arrow */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {showBackArrow && onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.65)",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={20} />
          </button>
        )}
        {center}
      </div>

      {/* Right: search or bell */}
      <button
        type="button"
        onClick={showSearchIcon ? onRightRailDrawerOpen : onNotificationsOpen}
        aria-label={showSearchIcon ? "Open explore" : "Notifications"}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 44,
          minHeight: 44,
          background: "transparent",
          border: "none",
          color: "rgba(255,255,255,0.65)",
          cursor: "pointer",
        }}
      >
        {showSearchIcon ? <Search size={20} /> : <Bell size={20} />}
        {!showSearchIcon && hasUnreadNotifs && (
          <span
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 8,
              height: 8,
              background: BRAND_ORANGE,
              borderRadius: "50%",
              border: "1.5px solid #0F0F14",
            }}
          />
        )}
      </button>
    </header>
  );
}
