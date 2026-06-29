import { useEffect, useRef, useState, useCallback } from "react";
import {
  Home, Compass, Library, Upload, FileText, MessageCircle, Bell,
  BarChart3, Info, LogOut, ChevronRight, X,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import NavProgressChip from "@/components/ambient/NavProgressChip";
import { useProgress } from "@/hooks/useProgress";


export interface DrawerUser {
  name: string;
  handle: string;
  avatarUrl?: string;
  initials: string;
  followersCount: number;
  followingCount: number;
}

export type DrawerRoute =
  | "home" | "discover" | "library" | "upload" | "drafts"
  | "messages" | "notifications" | "analytics" | "about";

export interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: DrawerUser | null;
  currentRoute: DrawerRoute | null;
  onNavigate: (route: DrawerRoute) => void;
  onSignOut: () => void;
}

const BRAND_ORANGE = "#E8571A";

const NAV: { route: DrawerRoute; label: string; Icon: React.ElementType }[] = [
  { route: "home", label: "Home", Icon: Home },
  { route: "discover", label: "Discover", Icon: Compass },
  { route: "library", label: "Library", Icon: Library },
  { route: "upload", label: "Upload", Icon: Upload },
  { route: "drafts", label: "Drafts", Icon: FileText },
  { route: "messages", label: "Messages", Icon: MessageCircle },
  { route: "notifications", label: "Notifications", Icon: Bell },
  { route: "analytics", label: "Analytics", Icon: BarChart3 },
  { route: "about", label: "About", Icon: Info },
];

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ProfileDrawer({
  isOpen, onClose, currentUser, currentRoute, onNavigate, onSignOut,
}: ProfileDrawerProps) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setDragging(true);
  }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging) return;
    const diff = e.touches[0].clientX - startX.current;
    if (diff < 0) setDragX(diff);
  }, [dragging]);
  const onTouchEnd = useCallback(() => {
    setDragging(false);
    if (dragX < -100) onClose();
    setDragX(0);
  }, [dragX, onClose]);

  useEffect(() => { if (!isOpen) setDragX(0); }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && isOpen) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen && dragX === 0) return null;

  const user = currentUser;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 1100,
          opacity: isOpen ? 1 : 0,
          transition: "opacity 200ms ease-out",
        }}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Profile menu"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          width: "min(320px, 88vw)",
          background: "#0F0F14",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          zIndex: 1101,
          display: "flex",
          flexDirection: "column",
          transform: `translateX(${isOpen ? dragX : -360}px)`,
          transition: dragging ? "none" : "transform 220ms ease-out",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Close */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 12px 0" }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            style={{
              width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
              background: "transparent", border: "none", color: "rgba(255,255,255,0.65)", cursor: "pointer",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Header */}
        <div style={{ padding: "8px 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <Avatar className="h-16 w-16">
            {user?.avatarUrl && <AvatarImage src={user.avatarUrl} />}
            <AvatarFallback style={{ background: "#8B4513", color: "#fff", fontSize: 22 }}>
              {user?.initials || "?"}
            </AvatarFallback>
          </Avatar>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>
              {user?.name || "Guest"}
            </div>
            {user?.handle && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>@{user.handle}</div>
            )}
          </div>
          {user && (
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
              <span>
                <strong style={{ color: "#fff", fontWeight: 600 }}>{formatCount(user.followersCount)}</strong> followers
              </span>
              <span>
                <strong style={{ color: "#fff", fontWeight: 600 }}>{formatCount(user.followingCount)}</strong> following
              </span>
            </div>
          )}
          {user && <DrawerProgressChip onClick={() => { onNavigate("analytics"); onClose(); }} />}
        </div>


        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto" }}>
          {NAV.map((item) => {
            const active = currentRoute === item.route;
            const Icon = item.Icon;
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => { onNavigate(item.route); onClose(); }}
                className="w-full flex items-center justify-between"
                style={{
                  height: 48,
                  padding: "12px 20px",
                  borderBottom: "0.5px solid rgba(255,255,255,0.06)",
                  background: active ? "rgba(232,87,26,0.12)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: active ? BRAND_ORANGE : "rgba(255,255,255,0.85)",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <Icon size={18} />
                  <span style={{ fontSize: 14, fontWeight: active ? 600 : 400 }}>{item.label}</span>
                </span>
                <ChevronRight size={16} style={{ opacity: 0.4 }} />
              </button>
            );
          })}
        </nav>

        {/* Sign out */}
        {user && (
          <button
            type="button"
            onClick={() => { onSignOut(); onClose(); }}
            className="w-full flex items-center justify-between"
            style={{
              height: 48, padding: "12px 20px",
              borderTop: "0.5px solid rgba(255,255,255,0.14)",
              background: "transparent", border: "none", cursor: "pointer",
              color: "#e74c3c",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <LogOut size={18} />
              <span style={{ fontSize: 14 }}>Sign out</span>
            </span>
            <ChevronRight size={16} style={{ opacity: 0.4 }} />
          </button>
        )}
      </aside>
    </>
  );
}
