import { useState } from "react";
import { Home, LayoutGrid, Plus, Target, User } from "lucide-react";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { feedback } from "@/lib/theme/motion";

/* RC-P05. hicks-law's phone budget: exactly five, in this order — Home,
   Gallery, New build, Bounties, Profile. Messages moved into the Profile
   drawer with the reader's other things, so the Profile item carries the
   unread dot for both messages and notifications. The glyphs are the desktop
   nav's, at the same 2px stroke (better-ui › Match icon stroke to text
   weight), each one SVG recoloured per state through currentColor. */
export type MobileRoute = "home" | "gallery" | "upload" | "bounties" | "profile";

export interface MobileBottomNavProps {
  currentRoute: MobileRoute;
  unreadMessageCount: number;
  unreadNotificationCount: number;
  onNavigate: (route: MobileRoute) => void;
}

const ACTIVE = t.action;
const INACTIVE = t.text2;

/* 64px of fixed chrome, not a full-height panel, so the theme still allows a
   blur here — at its single 16px value, not the 20px this carried. */
const BAR_BLUR = "blur(16px) saturate(1.15)";

/* The press wash. A neutral scrim mixed from --text reads on either ground in
   either theme, where a fixed rgba only ever reads on one of them. */
const PRESSED = "color-mix(in oklch, var(--text) 6%, transparent)";

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
        /* The one primary action on mobile: a solid --action fill with an
           --on-action label, so it is the element that differs from its four
           neighbours rather than a tinted version of them. */
        background: isUpload ? ACTIVE : pressed ? PRESSED : "transparent",
        border: isUpload ? `1px solid ${ACTIVE}` : "none",
        borderRadius: isUpload ? r.control : 0,
        margin: isUpload ? "0 4px" : 0,
        transform: pressed ? "scale(0.95)" : "scale(1)",
        transition: feedback("transform", "background-color"),
        color: isUpload ? t.onAction : active ? ACTIVE : INACTIVE,
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
              border: `1.5px solid ${t.bg}`,
            }}
          />
        )}
      </span>
      <span
        style={{
          fontFamily: FIGTREE,
          fontSize: 10,
          fontWeight: 500,
          color: isUpload ? t.onAction : active ? ACTIVE : INACTIVE,
        }}
      >
        {label}
      </span>
    </button>
  );
}

export function MobileBottomNav({
  currentRoute,
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
        background: t.glass,
        backdropFilter: BAR_BLUR,
        WebkitBackdropFilter: BAR_BLUR,
        borderTop: `1px solid ${t.line}`,
        zIndex: 1000,
      }}
    >
      <BarItem active={currentRoute === "home"} label="Home" onClick={() => onNavigate("home")}>
        <Home size={22} strokeWidth={2} />
      </BarItem>
      <BarItem active={currentRoute === "gallery"} label="Gallery" onClick={() => onNavigate("gallery")}>
        <LayoutGrid size={22} strokeWidth={2} />
      </BarItem>
      <BarItem active={currentRoute === "upload"} label="New build" isUpload onClick={() => onNavigate("upload")}>
        <Plus size={22} strokeWidth={2} />
      </BarItem>
      <BarItem active={currentRoute === "bounties"} label="Bounties" onClick={() => onNavigate("bounties")}>
        <Target size={22} strokeWidth={2} />
      </BarItem>
      <BarItem
        active={currentRoute === "profile"}
        label="Profile"
        showDot={unreadMessageCount + unreadNotificationCount > 0}
        onClick={() => onNavigate("profile")}
      >
        <User size={22} strokeWidth={2} />
      </BarItem>
    </nav>
  );
}
