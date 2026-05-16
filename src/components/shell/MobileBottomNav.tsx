import { useState } from "react";
import { Home, Search, PlusCircle, MessageCircle } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export type MobileRoute = "home" | "discover" | "upload" | "messages" | "profile";

export interface MobileBottomNavProps {
  currentRoute: MobileRoute;
  currentUserAvatarUrl?: string;
  currentUserInitials: string;
  unreadMessageCount: number;
  unreadNotificationCount: number;
  onNavigate: (route: MobileRoute) => void;
}

const ACTIVE = "#E8571A";
const INACTIVE = "rgba(255,255,255,0.55)";

function BarItem({
  active,
  label,
  onClick,
  showDot,
  isUpload,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  showDot?: boolean;
  isUpload?: boolean;
  children: React.ReactNode;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className="relative flex flex-1 flex-col items-center justify-center gap-1 cursor-pointer"
      style={{
        minWidth: 44,
        minHeight: 44,
        padding: "6px 0",
        background: isUpload
          ? "rgba(232,87,26,0.10)"
          : pressed
          ? "rgba(255,255,255,0.04)"
          : "transparent",
        border: isUpload ? "1px solid rgba(232,87,26,0.40)" : "none",
        borderRadius: isUpload ? 12 : 0,
        margin: isUpload ? "0 4px" : 0,
        transform: pressed ? "scale(0.95)" : "scale(1)",
        transition: "transform 100ms ease-out, background-color 100ms ease-out",
        color: active ? ACTIVE : INACTIVE,
      }}
    >
      {active && !isUpload && (
        <span
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: 24,
            height: 2,
            background: ACTIVE,
            borderRadius: 2,
          }}
        />
      )}
      <span style={{ position: "relative", display: "flex" }}>
        {children}
        {showDot && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -4,
              width: 8,
              height: 8,
              background: ACTIVE,
              borderRadius: "50%",
              border: "1.5px solid #0F0F14",
            }}
          />
        )}
      </span>
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 10,
          fontWeight: 500,
          color: active ? ACTIVE : INACTIVE,
        }}
      >
        {label}
      </span>
    </button>
  );
}

export function MobileBottomNav({
  currentRoute,
  currentUserAvatarUrl,
  currentUserInitials,
  unreadMessageCount,
  unreadNotificationCount,
  onNavigate,
}: MobileBottomNavProps) {
  return (
    <nav
      role="navigation"
      aria-label="Primary"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: "calc(64px + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        background: "rgba(15,15,20,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        zIndex: 1000,
      }}
    >
      <BarItem active={currentRoute === "home"} label="Home" onClick={() => onNavigate("home")}>
        <Home size={22} />
      </BarItem>
      <BarItem active={currentRoute === "discover"} label="Discover" onClick={() => onNavigate("discover")}>
        <Search size={22} />
      </BarItem>
      <BarItem active={currentRoute === "upload"} label="Upload" isUpload onClick={() => onNavigate("upload")}>
        <PlusCircle size={22} color={ACTIVE} />
      </BarItem>
      <BarItem
        active={currentRoute === "messages"}
        label="Messages"
        showDot={unreadMessageCount > 0}
        onClick={() => onNavigate("messages")}
      >
        <MessageCircle size={22} />
      </BarItem>
      <BarItem
        active={currentRoute === "profile"}
        label="Profile"
        showDot={unreadNotificationCount > 0}
        onClick={() => onNavigate("profile")}
      >
        <Avatar
          className="h-6 w-6"
          style={{
            border: currentRoute === "profile" ? `1.5px solid ${ACTIVE}` : "1px solid rgba(255,255,255,0.14)",
          }}
        >
          {currentUserAvatarUrl && <AvatarImage src={currentUserAvatarUrl} />}
          <AvatarFallback className="text-[10px]" style={{ background: "#8B4513", color: "#fff" }}>
            {currentUserInitials}
          </AvatarFallback>
        </Avatar>
      </BarItem>
    </nav>
  );
}
