import { useEffect, useRef, useState, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FeedItem } from "@/components/FeedItem";
import { CollectionFeedCard } from "@/components/CollectionFeedCard";
import { ProjectFeedCard } from "@/components/ProjectFeedCard";
import { ReblogCard } from "@/components/ReblogCard";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { useDraftCount } from "@/hooks/useDraftCount";
import { useNavBadges } from "@/hooks/useNavBadges";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBreakpoint } from "@/hooks/useBreakpoint";
// MobileNav is integrated in step 14.2; mobile currently uses the scaled shell.
// import { MobileNav } from "@/components/layout/MobileNav";

/* ────────────────────────────────────────────────
   Shell structure (Step 14.1 — responsive chrome)
   ────────────────────────────────────────────────
   Current desktop chrome (≥768px):
     .ns-root
       └─ .ns-scale-wrapper            (centres + scales the app)
            └─ .ns-app-container       (transform: scale(N), N computed from viewport)
                 ├─ LEFT  PANEL  (200px, LiquidGlassPanel + .ns-left-panel)
                 ├─ MIDDLE WRAPPER (600px, 3D flipper: front feed / back outlet)
                 └─ RIGHT PANEL (220px, LiquidGlassPanel + .ns-right-panel)

   Responsive tiers (via useBreakpoint):
     xl     ≥1280px  three-column, scale formula uses native 1068×775
     lg     1024–1279 right rail hidden (drawer in 14.2), native 824×775
     md     768–1023  left rail collapsed (icon-only 72px), right hidden, native 696×775
     mobile <768px    desktop chrome replaced by <MobileNav/> top+bottom bars,
                      centre column flows naturally (NO transform scaling).
*/
import { FollowButton } from "@/components/FollowButton";
import LiquidGlassPanel from "./LiquidGlassPanel";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { displayContentType, POST_TYPES, resolvePostType } from "@/lib/content-types";
import { FeedCard, type FeedPost } from "@/components/feed-card";
import { ReblogFeedCard, type ReblogPost } from "@/components/ReblogFeedCard";
import { FeedTabs } from "@/components/feed-tabs";

/* ────────────────────────────────────────────────
   CSS — injected into document.head on mount
──────────────────────────────────────────────── */
const NEOSCALE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@400;500;600;700&display=swap');

.ns-middle-front *,
.ns-middle-front ::before,
.ns-middle-front ::after,
.ns-middle-back *,
.ns-middle-back ::before,
.ns-middle-back ::after {
  box-sizing: border-box;
  min-width: 0;
}

/* ── Middle panel design tokens ── */
.ns-middle-front, .ns-middle-back {
  --mp-text: rgba(255,255,255,0.85);
  --mp-text-secondary: rgba(255,255,255,0.45);
  --mp-text-muted: rgba(255,255,255,0.25);
  --mp-border: rgba(255,255,255,0.08);
  --mp-surface: rgba(255,255,255,0.03);
  --mp-orange: #8B4513;
  --mp-teal: #1F7A6D;
  --mp-font: 'Playfair Display', Georgia, serif;
  font-family: 'Inter', sans-serif;
  color: rgba(255,255,255,0.85);
}

.ns-root {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.14) 1px, transparent 1px),
    radial-gradient(ellipse 60% 50% at 20% 40%, rgba(46,196,182,0.07) 0%, transparent 70%),
    radial-gradient(ellipse 50% 40% at 80% 30%, rgba(232,87,26,0.05) 0%, transparent 70%),
    radial-gradient(ellipse 70% 60% at 50% 80%, rgba(46,196,182,0.04) 0%, transparent 70%),
    #25252F;
  background-size: 20px 20px, 100% 100%, 100% 100%, 100% 100%, 100% 100%;
  font-family: 'Inter', sans-serif;
  overflow: hidden;
  position: fixed;
  inset: 0;
  z-index: 10;
}


.ns-scale-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  position: relative;
  z-index: 1;
}
/* Mobile: scaled centre column may exceed viewport at the floor — allow scroll. */
@media (max-width: 767px) {
  .ns-scale-wrapper {
    overflow-x: auto;
    overflow-y: auto;
    align-items: flex-start;
    justify-content: flex-start;
    padding-top: calc(56px + env(safe-area-inset-top));
    padding-bottom: calc(80px + env(safe-area-inset-bottom));
    padding-left: 16px;
    padding-right: 16px;
    box-sizing: border-box;
  }
}

.ns-app-container {
  display: flex;
  align-items: center;
  gap: 24px;
  transform-origin: center center;
  position: relative;
  z-index: 1;
}


/* ── Left panel ── */
.ns-left-panel {
  width: 200px;
  height: 775px;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  scrollbar-width: none;
  transition: width 0.18s ease;
}
.ns-left-panel::-webkit-scrollbar { display: none; }

/* ── Collapsed (icon-only) variant — md breakpoint ── */
.ns-left-panel.collapsed { width: 72px; padding: 24px 8px; }
.ns-left-panel.collapsed .ns-logo { font-size: 0; padding: 0; text-align: center; margin-bottom: 28px; }
.ns-left-panel.collapsed .ns-logo::before {
  content: 'N'; font-size: 20px; font-weight: 700; color: #8B4513;
}
.ns-left-panel.collapsed .ns-nav-item { justify-content: center; padding: 10px 0; }
.ns-left-panel.collapsed .ns-nav-label { display: none; }
.ns-left-panel.collapsed .ns-nav-badge {
  position: absolute; top: 2px; right: 6px; min-width: 14px; height: 14px;
  font-size: 9px; padding: 0 3px;
}
.ns-left-panel.collapsed .ns-user-name,
.ns-left-panel.collapsed .ns-user-dots { display: none; }
.ns-left-panel.collapsed .ns-user-btn { justify-content: center; padding: 8px 0; }
.ns-left-panel.collapsed .ns-auth-btn { font-size: 0; padding: 0; height: 32px; width: 32px; margin: 0 auto; border-radius: 50%; }
.ns-left-panel.collapsed .ns-auth-btn::before { font-size: 11px; }
.ns-left-panel.collapsed .ns-auth-btn.signin::before { content: '→'; }
.ns-left-panel.collapsed .ns-auth-btn.join::before { content: '+'; }
.ns-logo {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: #8B4513;
  padding: 0 8px;
  margin-bottom: 28px;
  cursor: pointer;
}
.ns-nav-list { list-style: none; display: flex; flex-direction: column; gap: 2px; flex: 1; }
.ns-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
}
.ns-nav-item:hover { background: rgba(255, 255, 255, 0.12); }
.ns-nav-item.active { background: rgba(139,69,19,0.1); }
.ns-nav-icon {
  width: 18px; height: 18px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
  color: rgba(255,255,255,0.35);
  transition: color 0.25s;
}
.ns-nav-item.active .ns-nav-icon { color: #8B4513; }
.ns-nav-label {
  font-size: 13px;
  font-weight: 400;
  color: rgba(255,255,255,0.45);
  transition: color 0.25s;
  letter-spacing: 0.1px;
  flex: 1;
}
.ns-nav-item.active .ns-nav-label { color: rgba(255,255,255,0.85); font-weight: 500; }
.ns-nav-item:hover .ns-nav-label { color: rgba(255,255,255,0.65); }
.ns-nav-spacer { flex: 1; }
.ns-nav-divider { height: 1px; background: rgba(255, 255, 255, 0.14); margin: 8px 4px; }
.ns-nav-badge {
  display: flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 9px; font-size: 10px; font-weight: 700;
  background: #8B4513; color: #fff;
}
.ns-nav-badge.muted { background: rgba(255, 255, 255, 0.14); color: rgba(255,255,255,0.45); }

/* pulse connector */
.ns-left-panel::after {
  content: '';
  position: absolute;
  right: -1px; top: 50%;
  transform: translateY(-50%);
  width: 3px; height: 0;
  background: #8B4513;
  border-radius: 2px;
  opacity: 0;
  filter: blur(1px);
  box-shadow: 0 0 12px #8B4513;
}
.ns-left-panel.pulse::after { animation: nsConnectorPulse 0.5s ease-out forwards; }
@keyframes nsConnectorPulse {
  0%   { height: 0; opacity: 0.9; top: 50%; }
  30%  { height: 60px; opacity: 0.8; }
  100% { height: 0; opacity: 0; top: 40%; }
}

/* ── User section at bottom of left panel ── */
.ns-user-section {
  padding: 12px 8px 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
  margin-top: 8px;
}
.ns-user-btn {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 8px; border-radius: 10px;
  cursor: pointer; transition: background 0.2s;
  border: none; background: none; text-align: left;
}
.ns-user-btn:hover { background: rgba(255, 255, 255, 0.12); }
.ns-user-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: #8B4513; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; flex-shrink: 0;
  overflow: hidden;
}
.ns-user-avatar img { width: 100%; height: 100%; object-fit: cover; }
.ns-user-name {
  font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.6);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
}
.ns-user-dots { color: rgba(255,255,255,0.25); font-size: 16px; }
.ns-user-menu {
  position: absolute; bottom: 56px; left: 8px; right: 8px;
  background: rgba(8,8,12,0.95); border: 1px solid rgba(255,255,255,0.10);
  border-radius: 10px; padding: 4px; z-index: 10;
  box-shadow: 0 8px 24px rgba(0,0,0,0.40);
}
.ns-user-menu button {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 8px 10px; border: none; background: none;
  border-radius: 8px; cursor: pointer; font-size: 12px; color: #e74c3c;
  transition: background 0.15s;
}
.ns-user-menu button:hover { background: rgba(255,255,255,0.05); }
.ns-auth-btns { display: flex; flex-direction: column; gap: 6px; padding: 8px; }
.ns-auth-btn {
  display: flex; align-items: center; justify-content: center;
  height: 32px; border-radius: 8px; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all 0.2s; border: none;
}
.ns-auth-btn.signin {
  background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255,255,255,0.10);
  color: rgba(255,255,255,0.6);
}
.ns-auth-btn.signin:hover { background: rgba(255,255,255,0.08); }
.ns-auth-btn.join {
  background: #111; border: 1px solid rgba(255,255,255,0.15); color: #fff;
}
.ns-auth-btn.join:hover { background: #333; }

/* ── Middle panel ── */
.ns-middle-wrapper { width: 600px; height: 775px; perspective: 1400px; flex-shrink: 0; }
.ns-middle-flipper {
  width: 100%; height: 100%;
  position: relative;
  transform-style: preserve-3d;
}
.ns-middle-face {
  position: absolute;
  inset: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  overflow: hidden;
  background: transparent;
}
.ns-middle-front {
  border-radius: 20px;
  padding: 0;
}
.ns-middle-back {
  transform: rotateY(180deg);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  padding: 0;
}
.ns-middle-back::-webkit-scrollbar { display: none; }
.ns-middle-front::before, .ns-middle-back::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.14), transparent);
}
.ns-middle-back.rtl {
  transform: rotateY(-180deg);
}

/* ── Feed scroll container ── */
.ns-feed-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 16px;
  box-sizing: border-box;
}
.ns-feed-scroll::-webkit-scrollbar { width: 3px; }
.ns-feed-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }

.ns-feed-loading {
  display: flex; flex-direction: column; gap: 12px; padding: 4px 0;
}
.ns-feed-skeleton {
  height: 80px; border-radius: 12px;
  background: rgba(255, 255, 255, 0.12);
  animation: nsPulse 1.5s ease-in-out infinite;
}
@keyframes nsPulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }

/* ── Page shell (outlet pages) ── */
.ns-page-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.ns-page-header {
  padding: 20px 24px 16px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
}
.ns-page-title {
  font-family: 'Playfair Display', serif;
  font-size: 22px;
  font-weight: 700;
  color: rgba(255,255,255,0.90);
  margin-bottom: 4px;
}
.ns-page-subtitle {
  font-size: 13px;
  color: rgba(255,255,255,0.40);
  font-family: 'Inter', sans-serif;
}
.ns-page-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0;
  box-sizing: border-box;
}

/* ── Back button ── */
.ns-back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 24px;
  font-size: 13px;
  color: rgba(255,255,255,0.40);
  background: none; border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  transition: color 0.15s;
  width: 100%;
  text-align: left;
}
.ns-back-btn:hover { color: rgba(255,255,255,0.85); }

/* ── Back face — outlet ── */
.ns-outlet-wrap {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  background: transparent;
  padding: 0;
  box-sizing: border-box;
  color: rgba(255,255,255,0.85);
  font-family: 'Inter', sans-serif;
}
.ns-outlet-wrap::-webkit-scrollbar { width: 3px; }
.ns-outlet-wrap::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }

/* ── Glass input (forms, search) ── */
.ns-glass-input {
  width: 100%;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 12px;
  padding: 10px 16px;
  color: rgba(255,255,255,0.85);
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.ns-glass-input:focus {
  border-color: rgba(139,69,19,0.50);
  box-shadow: 0 0 0 3px rgba(139,69,19,0.08);
}
.ns-glass-input::placeholder { color: rgba(255,255,255,0.30); }

/* ── Glass card (reusable smaller card) ── */
.ns-glass-card {
  background: rgba(255,255,255,0.03);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border: 1px solid rgba(255,255,255,0.08);
  border-top: 1px solid rgba(255, 255, 255, 0.14);
  border-left: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  padding: 20px;
  transition: border-color 0.2s;
}
.ns-glass-card:hover { border-color: rgba(255,255,255,0.15); }

/* ── Orange button (primary CTA) ── */
.ns-btn-orange {
  background: linear-gradient(135deg, #8B4513, #a05a2a);
  color: #fff;
  padding: 10px 24px;
  border-radius: 9999px;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(139,69,19,0.20);
  transition: transform 0.15s;
}
.ns-btn-orange:hover  { transform: scale(1.05); }
.ns-btn-orange:active { transform: scale(0.95); }

/* ── Ghost button ── */
.ns-btn-ghost {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255,255,255,0.65);
  padding: 8px 20px;
  border-radius: 9999px;
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid rgba(255,255,255,0.10);
  cursor: pointer;
  transition: all 0.15s;
}
.ns-btn-ghost:hover {
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.85);
}

/* ── Section label (trending, categories etc) ── */
.ns-section-label {
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.35);
  margin-bottom: 16px;
}

/* ── Override Lovable outlet styles ── */
.ns-page-body .bg-background,
.ns-page-body [class*="bg-background"] {
  background: transparent !important;
}
.ns-page-body .text-foreground,
.ns-page-body [class*="text-foreground"] {
  color: rgba(255,255,255,0.85) !important;
  font-family: 'Inter', sans-serif !important;
}
.ns-page-body .text-muted-foreground,
.ns-page-body [class*="text-muted-foreground"] {
  color: rgba(255,255,255,0.45) !important;
}
.ns-page-body .border-border,
.ns-page-body [class*="border-border"] {
  border-color: rgba(255,255,255,0.08) !important;
}
.ns-page-body .sticky {
  background: rgba(7,7,13,0.90) !important;
  backdrop-filter: blur(20px) !important;
}

/* ── Right panel ── */
.ns-right-panel {
  width: 220px; height: 775px;
  padding: 20px 14px;
  display: flex; flex-direction: column;
  flex-shrink: 0;
  transition: transform 0.15s ease-out;
  transform-style: preserve-3d;
  will-change: transform;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
}
.ns-right-panel::-webkit-scrollbar { display: none; }

.ns-right-title {
  font-size: 11px; font-weight: 600;
  color: rgba(255,255,255,0.45);
  letter-spacing: 1.5px; text-transform: uppercase;
  padding: 0 4px; margin-bottom: 14px;
}
.ns-right-search {
  width: 100%; height: 34px;
  border-radius: 17px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255,255,255,0.08);
  display: flex; align-items: center;
  padding: 0 12px; gap: 8px;
  margin-bottom: 16px;
  cursor: pointer;
  transition: border-color 0.2s;
}
.ns-right-search:hover { border-color: rgba(255,255,255,0.15); }
.ns-right-search svg { width: 13px; height: 13px; color: rgba(255,255,255,0.25); flex-shrink: 0; }
.ns-right-search input {
  flex: 1; background: none; border: none; outline: none;
  font-size: 11px; color: rgba(255,255,255,0.55);
  font-family: inherit;
}
.ns-right-search input::placeholder { color: rgba(255,255,255,0.25); }
.ns-right-search-results {
  position: absolute; left: 14px; right: 14px; top: 68px;
  background: rgba(8,8,12,0.97); border: 1px solid rgba(255,255,255,0.10);
  border-radius: 12px; max-height: 300px; overflow-y: auto; z-index: 20;
  padding: 6px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.40);
}
.ns-search-result {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; border-radius: 8px; cursor: pointer;
  transition: background 0.15s;
}
.ns-search-result:hover { background: rgba(255, 255, 255, 0.12); }
.ns-search-result-title { font-size: 11px; color: rgba(255,255,255,0.6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.ns-search-result-badge { font-size: 9px; padding: 1px 5px; border-radius: 4px; background: rgba(255, 255, 255, 0.14); color: rgba(255,255,255,0.45); flex-shrink: 0; }

/* ── Right panel tile grid ── */
.ns-tile-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 14px;
}

.ns-tile {
  position: relative;
  border-radius: 8px;
  padding: 10px 14px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: background 0.15s;
  background: rgba(255,255,255,0.03);
  border: none;
  overflow: hidden;
  width: 100%;
  text-align: left;
}

.ns-tile::before {
  content: '';
  position: absolute;
  left: 0; top: 20%; bottom: 20%;
  width: 2px;
  border-radius: 0 2px 2px 0;
  background: var(--tile-hover-color, rgba(255,255,255,0.15));
  opacity: 0;
  transition: opacity 0.15s;
}

.ns-tile:hover::before {
  opacity: 1;
}

.ns-tile::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 11px;
  padding: 1px;
  background: conic-gradient(
    var(--tile-hover-color, #8B4513) var(--tile-fill, 0%),
    transparent var(--tile-fill, 0%)
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  transition: opacity 0.15s ease;
  z-index: 0;
}

.ns-tile:hover {
  background: rgba(255,255,255,0.05);
}

.ns-tile:hover::after {
  opacity: 1;
  animation: ns-border-fill 0.55s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes ns-border-fill {
  from {
    background: conic-gradient(
      var(--tile-hover-color) 0%,
      transparent 0%
    );
  }
  to {
    background: conic-gradient(
      var(--tile-hover-color) 100%,
      transparent 100%
    );
  }
}

.ns-tile-label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255,255,255,0.55);
  text-transform: none;
  letter-spacing: 0;
  flex: 1;
}

.ns-tile-count {
  font-size: 11px;
  font-weight: 700;
  color: rgba(255,255,255,0.20);
  position: relative;
  z-index: 1;
}

/* Bounty strip */
.ns-bounty-strip {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 14px;
}

.ns-bounty-tile {
  position: relative;
  border-radius: 8px;
  padding: 10px 14px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  background: rgba(255,255,255,0.03);
  border: none;
  overflow: hidden;
  transition: background 0.15s;
  width: 100%;
  text-align: left;
}

.ns-bounty-tile::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 9px;
  padding: 1px;
  background: conic-gradient(
    var(--tile-hover-color, #F59E0B) var(--tile-fill, 0%),
    transparent var(--tile-fill, 0%)
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.ns-bounty-tile:hover {
  background: rgba(255,255,255,0.05);
}

.ns-bounty-tile:hover::after {
  opacity: 1;
  animation: ns-border-fill 0.55s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
.ns-right-divider { height: 1px; background: rgba(255, 255, 255, 0.14); margin: 4px 0 14px; }
.ns-trending-title {
  font-size: 10px; font-weight: 600;
  color: rgba(255,255,255,0.40);
  letter-spacing: 1.2px; text-transform: uppercase;
  padding: 0 4px; margin-bottom: 10px;
}
.ns-trending-list {
  display: flex; flex-direction: column; gap: 6px;
}
.ns-trending-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 8px; border-radius: 8px;
  cursor: pointer; transition: background 0.2s;
}
.ns-trending-item:hover { background: rgba(255, 255, 255, 0.12); }
.ns-trending-rank { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.20); width: 16px; text-align: center; }
.ns-trending-info { flex: 1; min-width: 0; }
.ns-trending-name { font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.55); margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ns-trending-badge {
  display: inline-block; padding: 2px 7px;
  border-radius: 4px; font-size: 9px; font-weight: 600; letter-spacing: 0.3px;
}
.ns-badge-beginner { background: rgba(46,204,113,0.12); color: #2ecc71; }
.ns-badge-intermediate { background: rgba(243,156,18,0.12); color: #f39c12; }
.ns-badge-advanced { background: rgba(231,76,60,0.12); color: #e74c3c; }
.ns-badge-any { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.40); }

/* ── Right panel sections ── */
.ns-section-title {
  font-size: 10px; font-weight: 600;
  color: rgba(255,255,255,0.40);
  letter-spacing: 1.2px; text-transform: uppercase;
  padding: 0 4px; margin: 14px 0 8px;
}
.ns-curator-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; border-radius: 8px;
  cursor: pointer; transition: background 0.15s;
}
.ns-curator-item:hover { background: rgba(255, 255, 255, 0.12); }
.ns-curator-avatar {
  width: 22px; height: 22px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.14); flex-shrink: 0;
  overflow: hidden;
}
.ns-curator-avatar img { width: 100%; height: 100%; object-fit: cover; }
.ns-collection-item {
  display: flex; flex-direction: column; gap: 2px;
  padding: 8px; border-radius: 8px;
  cursor: pointer; transition: background 0.15s;
}
.ns-collection-item:hover { background: rgba(255, 255, 255, 0.12); }
.ns-follow-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 4px;
}
.ns-follow-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.14); flex-shrink: 0;
  overflow: hidden;
}
.ns-follow-avatar img { width: 100%; height: 100%; object-fit: cover; }
.ns-follow-info { flex: 1; min-width: 0; }
.ns-follow-name { font-size: 12px; color: rgba(255,255,255,0.6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ns-follow-handle { font-size: 10px; color: rgba(255,255,255,0.30); }
.ns-footer-links {
  margin-top: 16px; padding: 12px 4px 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
  display: flex; flex-direction: column; gap: 4px;
}
.ns-footer-link {
  font-size: 10px; color: rgba(255,255,255,0.25);
  text-decoration: none; transition: color 0.15s;
  cursor: pointer;
}
.ns-footer-link:hover { color: rgba(255,255,255,0.55); }

/* ── Free-canvas overrides ── */
/* Prevent Tailwind from adding overflow:hidden
   to the panel faces via bg-* or other utility
   class side effects */
.ns-middle-front *,
.ns-middle-back * {
  min-width: 0;
}

/* Kill any max-width constraints from v0 layout */
.ns-middle-front .max-w-2xl,
.ns-middle-front .max-w-xl,
.ns-middle-front .max-w-lg,
.ns-middle-back .max-w-2xl,
.ns-middle-back .max-w-xl,
.ns-middle-back .max-w-lg {
  max-width: 100% !important;
}

/* Ensure mx-auto doesn't add weird margins */
.ns-middle-front .mx-auto,
.ns-middle-back .mx-auto {
  margin-left: 0 !important;
  margin-right: 0 !important;
}

`;

/* ────────────────────────────────────────────────
   Post type tile data — three primary tiles:
   Blueprint / Blog / Bounty
──────────────────────────────────────────────── */
const POST_TYPE_TILES = [
  {
    value: 'blueprint',
    label: 'Blueprints',
    emoji: '🔷',
    color: '#8B4513',
    bg: 'rgba(139,69,19,0.12)',
    border: 'rgba(139,69,19,0.20)',
  },
  {
    value: 'blog',
    label: 'Blogs',
    emoji: '📝',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.12)',
    border: 'rgba(59,130,246,0.20)',
  },
  {
    value: 'bounty',
    label: 'Bounties',
    emoji: '🎯',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.20)',
  },
];

// Random colour palette for tile hover borders
const TILE_HOVER_COLORS = [
  '#8B4513', '#1F7A6D', '#7C3AED', '#3B82F6',
  '#F59E0B', '#22C55E', '#EC4899', '#06B6D4',
  '#A78BFA', '#F97316',
];
const randomTileColor = () =>
  TILE_HOVER_COLORS[Math.floor(Math.random() * TILE_HOVER_COLORS.length)];

/* ────────────────────────────────────────────────
   Route ↔ nav-page mapping
──────────────────────────────────────────────── */
const ROUTE_TO_NAV: Record<string, string> = {
  "/":              "home",
  "/browse":        "discover",
  "/library":       "library",
  "/saved":         "library",
  "/upload":        "upload",
  "/profile":       "profile",
  "/messages":      "messages",
  "/notifications": "notifications",
  "/drafts":        "drafts",
  "/analytics":     "analytics",
};

function routeToNav(pathname: string): string {
  if (pathname.startsWith("/upload")) return "upload";
  return ROUTE_TO_NAV[pathname] ?? "other";
}

/* ────────────────────────────────────────────────
   Difficulty badge helper
──────────────────────────────────────────────── */
function diffBadgeClass(difficulty?: string): string {
  if (!difficulty) return "ns-badge-any";
  const d = difficulty.toLowerCase();
  if (d === "beginner") return "ns-badge-beginner";
  if (d === "intermediate") return "ns-badge-intermediate";
  if (d === "advanced") return "ns-badge-advanced";
  return "ns-badge-any";
}

/* ────────────────────────────────────────────────
   Time-ago helper
──────────────────────────────────────────────── */
function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

/* ────────────────────────────────────────────────
   Content-type avatar background colour
──────────────────────────────────────────────── */
function ctypeBg(contentType: string): string {
  const map: Record<string, string> = {
    "prompt-file": "#8B4513",
    "agent-blueprint": "#9B59B6",
    "workflow-template": "#3498DB",
    "ai-tools-llms": "#1ABC9C",
    "blog": "#27AE60",
    "projects": "#E67E22",
    "evaluation-framework": "#F39C12",
    "install-guide": "#2980B9",
    "model-config-guide": "#8E44AD",
    "integration-guide": "#16A085",
  };
  return map[contentType] ?? "#555";
}

function getAvatarStyle(contentType: string) {
  const map: Record<string, {bg:string, color:string, border:string}> = {
    'Prompt(s)':          {bg:'rgba(139,69,19,0.20)',   color:'#8B4513', border:'rgba(139,69,19,0.30)'},
    'Agent(s)':           {bg:'rgba(124,58,237,0.20)',  color:'#7C3AED', border:'rgba(124,58,237,0.30)'},
    'Blog':               {bg:'rgba(31,122,109,0.20)',  color:'#1F7A6D', border:'rgba(31,122,109,0.30)'},
    'Workflow Template':  {bg:'rgba(37,99,235,0.20)',   color:'#3B82F6', border:'rgba(37,99,235,0.30)'},
    'Evaluation Framework':{bg:'rgba(219,39,119,0.20)',color:'#EC4899', border:'rgba(219,39,119,0.30)'},
    'Agent Stack':        {bg:'rgba(220,38,38,0.20)',   color:'#EF4444', border:'rgba(220,38,38,0.30)'},
    'Failure Library':    {bg:'rgba(75,85,99,0.20)',    color:'#9CA3AF', border:'rgba(75,85,99,0.30)'},
    'Model Config Guide': {bg:'rgba(22,163,74,0.20)',   color:'#22C55E', border:'rgba(22,163,74,0.30)'},
    'Install Guide':      {bg:'rgba(6,182,212,0.20)',   color:'#06B6D4', border:'rgba(6,182,212,0.30)'},
    'Projects':           {bg:'rgba(245,158,11,0.20)',  color:'#F59E0B', border:'rgba(245,158,11,0.30)'},
  };
  return map[contentType] ?? {bg:'rgba(100,100,120,0.20)',color:'#9CA3AF',border:'rgba(100,100,120,0.30)'};
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function getTimeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

/* ────────────────────────────────────────────────
   Feed renderer helper
──────────────────────────────────────────────── */
function renderFeedEntry(entry: any) {
  const postProfile = Array.isArray(entry.profiles)
    ? entry.profiles[0]
    : entry.profiles;

  // REGULAR POST — route to FeedCard
  const adaptedPost: FeedPost = {
    id: entry.id,
    title: entry.title ?? '',
    description: entry.description ?? undefined,
    content_type: entry.content_type ?? 'build',
    post_type: resolvePostType(null, entry.content_type ?? null),
    cover_image_url: entry.cover_image_url ?? undefined,
    created_at: entry.created_at,
    view_count: entry.view_count ?? 0,
    comment_count: entry.comment_count ?? 0,
    download_count: entry.download_count ?? 0,
    what_to_expect: entry.what_to_expect ?? undefined,
    what_to_expect_blocks:
      entry.what_to_expect_blocks ?? undefined,
    ai_tools: entry.ai_tools ?? [],
    use_cases: entry.use_cases ?? [],
    custom_tags: entry.custom_tags ?? [],
    author: {
      display_name: postProfile?.display_name ?? 'Unknown',
      username: postProfile?.username ?? 'user',
      avatar_url: postProfile?.avatar_url ?? undefined,
      bio: postProfile?.bio ?? undefined,
      follower_count: postProfile?.follower_count ?? 0,
      following_count: postProfile?.following_count ?? 0,
      joined_date: postProfile?.joined_at ?? undefined,
    },
  };
  return <FeedCard key={entry.id} post={adaptedPost} />;
}

/* ────────────────────────────────────────────────
   SVG icons for nav
──────────────────────────────────────────────── */
const ICONS = {
  home: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  discover: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>,
  library: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
  upload: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  drafts: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
  messages: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  notifications: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  profile: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  analytics: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  signout: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

/* ═══════════════════════════════════════════════
   NeoScaleShell — main component
═══════════════════════════════════════════════ */
export function NeoScaleShell() {
  const location   = useLocation();
  const navigate   = useNavigate();
  
  const flipperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRef    = useRef<HTMLDivElement>(null);
  const rightRef   = useRef<HTMLDivElement>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isFlipping = useRef(false);
  const currentRotation = useRef(0);
  const showingFront = useRef(true);

  const [pulsing,    setPulsing]    = useState(false);
  const [activeTab,  setActiveTab]  = useState("For You");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchPeopleResults, setSearchPeopleResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [filterPostType, setFilterPostType] = useState<string | null>(null);
  const [filterLabel, setFilterLabel] = useState<string>('');
  const [filterEmoji, setFilterEmoji] = useState<string>('');
  const [filterColor, setFilterColor] = useState<string>('');

  const isMobile = useIsMobile();
  const breakpoint = useBreakpoint();
  const isUploadEditor =
    location.pathname.startsWith('/upload/blueprint') ||
    location.pathname.startsWith('/upload/blog');
  const isSmallDesktop = breakpoint === "lg" || breakpoint === "md";
  const uploadEditorSmall = isUploadEditor && isSmallDesktop;

  const showRightPanel = breakpoint === "xl" || uploadEditorSmall;
  const showLeftPanel =
    (breakpoint === "xl" || breakpoint === "lg" || breakpoint === "md") &&
    !uploadEditorSmall;
  const leftCollapsed = breakpoint === "md";
  const { isLoggedIn, profile, user, signOut, isCreator } = useAuth();
  const { display: msgBadge } = useUnreadMessages();
  const { display: notifBadge } = useUnreadNotifications();
  const { display: draftBadge } = useDraftCount();
  const { hasUnseenSaves } = useNavBadges();

  const isHome  = location.pathname === "/";
  const navPage = routeToNav(location.pathname);
  const isMessages = location.pathname === "/messages" || location.pathname.startsWith("/messages/");

  /* ── CSS injection ── */
  useEffect(() => {
    if (isMobile) return;
    const tag = document.createElement("style");
    tag.setAttribute("data-neoscale-shell", "1");
    tag.textContent = NEOSCALE_CSS;
    document.head.appendChild(tag);
    return () => { document.head.removeChild(tag); };
  }, [isMobile]);

  /* ── Snap flipper to the correct face when the route changes
        (covers cold loads of /messages, /library, etc.) ── */
  const wasMessagesRef = useRef(false);
  useEffect(() => {
    if (isMobile) return;
    if (isMessages) {
      wasMessagesRef.current = true;
      return;
    }
    const flipper = flipperRef.current;
    if (!flipper) return;
    const wantsFront = location.pathname === "/";
    const justLeftMessages = wasMessagesRef.current;
    wasMessagesRef.current = false;
    if (!justLeftMessages && wantsFront === showingFront.current) return;
    showingFront.current = wantsFront;
    currentRotation.current = wantsFront ? 0 : 180;
    flipper.style.transition = "none";
    flipper.style.transform = `rotateY(${currentRotation.current}deg)`;
    requestAnimationFrame(() => {
      if (flipper) flipper.style.transition = "transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)";
    });
  }, [location.pathname, isMobile, isMessages]);

  /* ── Fetch feed posts (infinite scroll) ── */
  const INITIAL_PAGE = 50;
  const NEXT_PAGE = 25;

  const {
    data: feedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: feedLoading,
  } = useInfiniteQuery({
    queryKey: ['shell_feed', activeTab, user?.id, filterPostType],
    queryFn: async ({ pageParam = 0 }) => {
      const pageSize = pageParam === 0 ? INITIAL_PAGE : NEXT_PAGE;

      if (activeTab === 'Bounties') return [];

      let query = supabase
        .from('content_items')
        .select(`
          id, title, description, content_type,
          difficulty, ai_tools, use_cases, custom_tags,
          download_count, view_count, comment_count,
          cover_image_url, created_at, approved_at,
          what_to_expect, what_to_expect_blocks,
          avg_rating, rating_count, creator_id,
          custom_use_case_description, other_tool_name,
          topics, estimated_read_minutes, tool_subtype,
          model_parameters,
          profiles!content_items_creator_id_fkey(
            id, display_name, username, avatar_url,
            bio, follower_count, following_count, joined_at
          )
        `)
        .eq('status', 'approved');

      if (activeTab === 'For You' || activeTab === 'Recent') {
        query = query.order('created_at', { ascending: false });
      } else if (activeTab === 'Trending') {
        query = query.order('download_count', { ascending: false });
      } else if (activeTab === 'Following') {
        if (!user) return [];
        const { data: follows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);
        const followedIds = follows?.map(f => f.following_id) ?? [];
        if (followedIds.length === 0) return [];
        query = query
          .in('creator_id', followedIds)
          .order('created_at', { ascending: false });
      }

      if (filterPostType) {
        if (filterPostType === 'bounty') {
          query = (query as any).eq('bounty_enabled', true);
        } else if (filterPostType === 'blueprint') {
          const blueprintTypes = [
            'Agent Blueprint', 'Agent Stack',
            'Workflow Template', 'AI Agent Install Guide',
            'Integration Guide', 'Model Config Guide',
            'AI Tools (LLMs)', 'Prompt File',
            'Prompt(s)', 'Agent(s)', 'Install Guide',
            'Evaluation Framework', 'Failure Library',
          ];
          query = query.in('content_type', blueprintTypes);
        } else if (filterPostType === 'discussion') {
          const blogTypes = ['Open Question', 'Challenge', 'Blog'];
          query = query.in('content_type', blogTypes);
        }
      }

      query = query.range(pageParam, pageParam + pageSize - 1);
      const { data } = await query;
      return data ?? [];
    },
    getNextPageParam: (lastPage, allPages) => {
      const totalLoaded = allPages.flat().length;
      const expectedSize = allPages.length === 1 ? INITIAL_PAGE : NEXT_PAGE;
      if (lastPage.length < expectedSize) return undefined;
      return totalLoaded;
    },
    initialPageParam: 0,
  });

  const posts = feedData?.pages.flat() ?? [];

  // IntersectionObserver for infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  function triggerPulse() {
    setPulsing(false);
    requestAnimationFrame(() => setPulsing(true));
    setTimeout(() => setPulsing(false), 600);
  }


  /* ── Responsive scale ──
     The .ns-app-container is transform-scaled (desktop) or `zoom`-scaled
     (mobile, so the scaled box affects layout/scroll) to fit the viewport.
     Native width changes per breakpoint as panels drop out:
       xl:  left(200) + gap(24) + middle(600) + gap(24) + right(220)  = 1068
       lg:  left(200) + gap(24) + middle(600)                          = 824
       md:  left(72)  + gap(24) + middle(600)                          = 696
       mobile: only centre column (600). Scale formula:
               scale = max(0.55, min(1, (vw - 32) / 600))
               Floor 0.55 keeps text legible; below it horizontal scroll
               engages on .ns-scale-wrapper. */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const nativeH = 775, pad = 48;
    const nativeW =
      breakpoint === "xl" ? 1068 :
      uploadEditorSmall
        ? 844 /* middle(600) + gap(24) + right(220) */ :
      breakpoint === "lg" ? 824 :
      breakpoint === "md" ? 696 :
      /* mobile */          600;

    let didCenter = false;
    function rescale() {
      if (breakpoint === "mobile") {
        const s = Math.max(0.55, Math.min(1, (window.innerWidth - 32) / 600));
        el!.style.transform = "none";
        (el!.style as any).zoom = String(s);
        // First-mount centring when at the floor (scaled width > viewport).
        if (!didCenter) {
          didCenter = true;
          requestAnimationFrame(() => {
            const wrapper = el!.parentElement;
            if (!wrapper) return;
            const overflow = wrapper.scrollWidth - wrapper.clientWidth;
            if (overflow > 0) wrapper.scrollLeft = overflow / 2;
          });
        }
        return;
      }
      (el!.style as any).zoom = "";
      const scale = Math.min(
        (window.innerWidth  - pad * 2) / nativeW,
        (window.innerHeight - pad * 2) / nativeH,
        1.6
      );
      el!.style.transform = `scale(${scale})`;
    }
    window.addEventListener("resize", rescale);
    rescale();
    return () => window.removeEventListener("resize", rescale);
  }, [isMobile, breakpoint, isUploadEditor, isSmallDesktop, uploadEditorSmall]);

  /* ── Supabase: recent feed ── */
  const { data: feedItems, isLoading: feedItemsLoading } = useQuery({
    queryKey: ["ns_home_recent"],
    // Home centre column also renders at mobile (scaled) — do not gate on isMobile.
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select(`
          id,
          title,
          description,
          content_type,
          difficulty,
          ai_tools,
          use_cases,
          custom_tags,
          download_count,
          view_count,
          comment_count,
          cover_image_url,
          created_at,
          what_to_expect,
          what_to_expect_blocks,
          profiles!content_items_creator_id_fkey(
            display_name,
            username,
            avatar_url,
            bio,
            follower_count,
            following_count,
            joined_at
          )
        `)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []).map((d: any) => ({ ...d, _feedType: "blueprint" as const }));
    },
  });

  /* ── Supabase: trending ── */
  const { data: trendingItems } = useQuery({
    queryKey: ["ns_trending"],
    enabled: !isMobile,
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data } = await supabase
        .from("content_items")
        .select("id, title, content_type, difficulty, download_count, view_count, rating_count, comment_count, approved_at, created_at")
        .eq("status", "approved")
        .gte("created_at", weekAgo)
        .order("download_count", { ascending: false })
        .limit(20);
      if (!data) return [];
      return data
        .map((item: any) => {
          const hoursOld = (Date.now() - new Date(item.approved_at || item.created_at).getTime()) / 3600000;
          const score = (item.download_count * 1.5 + item.view_count + item.rating_count * 2 + (item.comment_count || 0) * 1.2)
            / Math.pow(hoursOld + 2, 1.5);
          return { ...item, _score: score };
        })
        .sort((a: any, b: any) => b._score - a._score)
        .slice(0, 5);
    },
    staleTime: 60_000,
  });

  /* ── Supabase: curator picks ── */
  const { data: curatorPicks } = useQuery({
    queryKey: ["ns_curator_picks"],
    enabled: !isMobile,
    queryFn: async () => {
      const { data } = await (supabase
        .from("curator_recommendations")
        .select("id, recommendation_text, content_id, content_items!curator_recommendations_content_id_fkey(id, title, content_type), curators!curator_recommendations_curator_id_fkey(user_id, profiles:profiles!curators_user_id_fkey(avatar_url, display_name))")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(3) as any);
      return data ?? [];
    },
    staleTime: 120_000,
  });

  /* ── Supabase: featured collections ── */
  const { data: featuredCollections } = useQuery({
    queryKey: ["ns_featured_collections"],
    enabled: !isMobile,
    queryFn: async () => {
      const { data } = await supabase
        .from("collections")
        .select("id, title, item_count, slug, owner_id, profiles!collections_owner_id_fkey(display_name, username)")
        .eq("is_public", true)
        .order("follower_count", { ascending: false })
        .limit(3);
      return data ?? [];
    },
    staleTime: 120_000,
  });

  /* ── Supabase: who to follow ── */
  const { data: followSuggestions } = useQuery({
    queryKey: ["ns_who_to_follow", user?.id],
    enabled: !isMobile && isLoggedIn && !!user?.id,
    queryFn: async () => {
      const { data: followRows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user!.id);
      const followedIds = (followRows ?? []).map((r: any) => r.following_id);
      const excludeIds = [user!.id, ...followedIds];
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, follower_count")
        .eq("is_creator", true)
        .not("id", "in", `(${excludeIds.join(",")})`)
        .order("follower_count", { ascending: false })
        .limit(3);
      return data ?? [];
    },
    staleTime: 120_000,
  });

  /* ── Mobile chrome (top bar + bottom nav) is integrated in step 14.2.
     For 14.1 the mobile branch shares the desktop shell: left/right panels
     hide via showLeftPanel/showRightPanel, .ns-app-container is `zoom`-scaled
     so the centre column fits the viewport (see the rescale effect above).
     Padding for the future MobileTopBar/BottomNav is reserved in
     .ns-scale-wrapper @media (max-width: 767px). */

  /* ── Tilt effect for side panels ── */
  function initTilt(ref: React.RefObject<HTMLDivElement>) {
    return {
      onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => {
        if (!ref.current) return;
        const r = ref.current.getBoundingClientRect();
        const rx = (e.clientY - r.top)  / r.height;
        const ry = (e.clientX - r.left) / r.width;
        const rotY = (ry - 0.5) * 16;
        const rotX = (0.5 - rx) * 16;
        ref.current.style.transform = `perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.02)`;
      },
      onMouseLeave: () => {
        if (!ref.current) return;
        ref.current.style.transform = "perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)";
      },
    };
  }

  /* ── Flip helper ── */
  // showingFront moved to top with other refs

  function doFlip(target: 'front' | 'back', direction: 'left' | 'right') {
    if (isFlipping.current) return;
    const flipper = flipperRef.current;
    if (!flipper) return;
    const onTarget = (target === 'front' && showingFront.current) || (target === 'back' && !showingFront.current);
    if (onTarget) return; // Already on target face — just let navigate() swap content
    const delta = direction === 'left' ? 180 : -180;
    showingFront.current = target === 'front';
    currentRotation.current += delta;
    isFlipping.current = true;
    flipper.style.transition = 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
    flipper.style.transform = `rotateY(${currentRotation.current}deg)`;
    setTimeout(() => { isFlipping.current = false; }, 650);
  }

  function handleSearchChange(q: string) {
    setSearchQuery(q);
    setSearchOpen(q.length >= 2);
    clearTimeout(searchDebounce.current);
    if (q.length < 2) { setSearchResults([]); setSearchPeopleResults([]); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      const { data } = await supabase
        .from("content_items")
        .select("id, title, content_type")
        .ilike("title", `%${q}%`)
        .eq("status", "approved")
        .limit(6);
      setSearchResults(data ?? []);
      const { data: pData } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(2);
      if (pData) setSearchPeopleResults(pData);
      else setSearchPeopleResults([]);
      setSearchLoading(false);
    }, 300);
  }

  /* ── Build nav items ── */
  type NavEntry = { key: string; icon: React.ReactNode; label: string; route: string; badge?: string | null; authOnly?: boolean; divider?: boolean; creatorOnly?: boolean };
  const navItems: NavEntry[] = [
    { key: "home",     icon: ICONS.home,     label: "Home",      route: "/" },
    { key: "discover", icon: ICONS.discover, label: "Discover",  route: "/browse" },
    { key: "library",  icon: ICONS.library,  label: "Library",   route: "/library",  authOnly: true },
    { key: "upload",   icon: ICONS.upload,   label: "Upload",    route: "/upload",   divider: true },
    { key: "drafts",   icon: ICONS.drafts,   label: "Drafts",    route: "/drafts",   authOnly: true, badge: draftBadge },
    { key: "messages", icon: ICONS.messages, label: "Messages",  route: "/messages", authOnly: true, badge: msgBadge, divider: true },
    { key: "notifications", icon: ICONS.notifications, label: "Notifications", route: "/notifications", authOnly: true, badge: notifBadge },
    { key: "profile",  icon: ICONS.profile,  label: "My Profile", route: "/profile", authOnly: true, divider: true },
    { key: "analytics", icon: ICONS.analytics, label: "Analytics", route: "/analytics", authOnly: true, creatorOnly: true },
  ];

  const visibleNav = navItems.filter(item => {
    if (item.authOnly && !isLoggedIn) return false;
    if (item.creatorOnly && !isCreator) return false;
    return true;
  });

  const initials = profile?.display_name
    ? profile.display_name.slice(0, 2).toUpperCase()
    : profile?.username?.slice(0, 2).toUpperCase() ?? "?";

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await signOut();
    navigate("/");
  };

  /* ── Back-face flip-to-front button handler ── */
  function handleBackBtn() {
    doFlip('front', 'left');
    navigate("/");
  }

  /* ── Back face content router ── */
  function renderBackFaceContent() {
    const path = location.pathname;
    

    if (path === '/') {
      // Front face is the home feed — render nothing in back face
      return null;
    }

    /* Page title/subtitle map */
    const pageMeta: Record<string, { title: string; subtitle?: string }> = {
      '/library':       { title: 'Your Archives', subtitle: 'Everything you\'ve saved' },
      '/drafts':        { title: 'Drafts', subtitle: 'Work in progress' },
      '/notifications': { title: 'Notifications' },
      '/analytics':     { title: 'Neural Analytics', subtitle: 'Your dispatch performance' },
    };

    /* /messages and /messages/{id} → bare full-bleed surface,
       the page owns its own chrome (thread list + conversation pane). */
    if (path === '/messages' || path.startsWith('/messages/')) {
      return (
        <div style={{ height: '100%', width: '100%' }}>
          <Outlet />
        </div>
      );
    }

    /* /library, /drafts, /notifications, /analytics → page shell, no title banner.
       Pages render their own headers when needed. */
    const meta = pageMeta[path];
    if (meta) {
      return (
        <div className="ns-page-shell">
          <button className="ns-back-btn" onClick={handleBackBtn}>← Back</button>
          <div className="ns-page-body">
            <Outlet />
          </div>
        </div>
      );
    }

    /* Fallback — all other routes.
       Content detail pages and upload render their own inline back button,
       so suppress the sticky ns-back-btn there to reclaim header height. */
    return (
      <div className="ns-page-shell">
        {!path.startsWith('/upload') &&
         !path.startsWith('/content/') && (
          <button className="ns-back-btn" onClick={handleBackBtn}>← Back</button>
        )}
        <div className="ns-page-body">
          <Outlet />
        </div>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="ns-root">

      <div className="ns-scale-wrapper">
        <div className="ns-app-container" ref={containerRef}>

          {/* ═══ LEFT PANEL ═══ */}
          {showLeftPanel && (
          <LiquidGlassPanel cornerRadius={20} elasticity={0.15} style={{ width: leftCollapsed ? 72 : 200, height: 775, flexShrink: 0 }}>
          <div
            className={`ns-left-panel${pulsing ? " pulse" : ""}${leftCollapsed ? " collapsed" : ""}`}
            ref={leftRef}
            {...initTilt(leftRef)}
          >
            <div className="ns-logo" onClick={() => {
              doFlip('front', 'left');
              navigate("/");
            }}>NeoScale</div>
            <ul className="ns-nav-list">
              {visibleNav.map((item, idx) => (
                <li key={item.key}>
                  {item.divider && idx > 0 && <div className="ns-nav-divider" />}
                  <div
                    className={`ns-nav-item${navPage === item.key ? " active" : ""}`}
                    onClick={() => {
                      if (item.key === 'home') {
                        doFlip('front', 'left');
                        navigate("/");
                      } else if (item.key === 'messages') {
                        // Messages uses its own static surface — skip the 3D flip.
                        navigate(item.route);
                      } else {
                        doFlip('back', 'left');
                        navigate(item.route);
                      }
                    }}
                  >
                    <span className="ns-nav-icon">{item.icon}</span>
                    <span className="ns-nav-label">{item.label}</span>
                    {item.badge && (
                      <span className={`ns-nav-badge${item.key === "drafts" ? " muted" : ""}`}>{item.badge}</span>
                    )}
                    {item.key === "library" && hasUnseenSaves && !item.badge && (
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#8B4513", marginLeft: "auto" }} />
                    )}
                  </div>
                </li>
              ))}
              <div className="ns-nav-spacer" />
            </ul>

            {/* User section at bottom */}
            <div className="ns-user-section" style={{ position: "relative" }}>
              {isLoggedIn ? (
                <>
                  <button className="ns-user-btn" onClick={() => setUserMenuOpen(!userMenuOpen)}>
                    <div className="ns-user-avatar">
                      {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : initials}
                    </div>
                    <span className="ns-user-name">{profile?.display_name || profile?.username || "User"}</span>
                    <span className="ns-user-dots">⋯</span>
                  </button>
                  {userMenuOpen && (
                    <div className="ns-user-menu">
                      <button onClick={handleSignOut}>
                        {ICONS.signout} Sign out
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="ns-auth-btns">
                  <button className="ns-auth-btn signin" onClick={() => { doFlip('back', 'left'); navigate("/login"); }}>Sign in</button>
                  <button className="ns-auth-btn join" onClick={() => { doFlip('back', 'left'); navigate("/signup"); }}>Join free</button>
                </div>
              )}
            </div>
          </div>
          </LiquidGlassPanel>
          )}

          {/* ═══ MIDDLE PANEL ═══ */}
          <div className="ns-middle-wrapper">
            {isMessages ? (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 20,
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  background: 'rgba(14, 14, 22, 0.92)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.40)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Outlet />
              </div>
            ) : (
            <LiquidGlassPanel cornerRadius={20} elasticity={0.15} contentStyle={{ overflow: 'hidden', perspective: 1400, transformStyle: 'preserve-3d' as any }}>
            <div className="ns-middle-flipper" ref={flipperRef}>

              {/* FRONT FACE — home feed */}
              <div className="ns-middle-face ns-middle-front">

                {/* Tabs + filter banner — padded header strip */}
                <div style={{ padding: '16px 16px 0' }}>
                  {filterPostType && (() => {
                    const filterBannerLabel =
                      filterPostType === 'blueprint' ? 'Blueprints'
                      : filterPostType === 'discussion' ? 'Blogs'
                      : filterPostType === 'bounty' ? 'Bounties'
                      : '';
                    return (
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      background: `${filterColor}10`,
                      borderBottom: `1px solid ${filterColor}25`,
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <span style={{
                          fontSize: 13, fontWeight: 700,
                          color: filterColor,
                          fontFamily: "'Playfair Display', Georgia, serif",
                        }}>
                          {filterBannerLabel}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setFilterPostType(null);
                          setFilterLabel('');
                          setFilterEmoji('');
                          setFilterColor('');
                        }}
                        style={{
                          fontSize: 11, color: 'rgba(0,0,0,0.40)',
                          background: 'none', border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        ✕ Clear
                      </button>
                    </div>
                    );
                  })()}
                  <FeedTabs activeTab={activeTab} onTabChange={setActiveTab} filteredTabs={!!filterPostType} />
                </div>

                {/* Feed */}
                <div className="ns-feed-scroll">
                  {feedLoading && (
                    <div className="ns-feed-loading">
                      {[1,2,3,4,5].map(n => <div key={n} className="ns-feed-skeleton" />)}
                    </div>
                  )}
                  {!feedLoading && (posts as any[]).map(entry => renderFeedEntry(entry))}

                  {!feedLoading && posts.length === 0 && (
                    <div style={{
                      textAlign: 'center',
                      padding: '48px 16px',
                      color: 'rgba(0,0,0,0.30)',
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: 16,
                    }}>
                      Nothing dispatched yet.
                    </div>
                  )}

                  {/* Infinite scroll sentinel */}
                  <div ref={sentinelRef} style={{ height: 1 }} />
                  {isFetchingNextPage && (
                    <div style={{
                      textAlign: 'center',
                      padding: '16px',
                      color: 'rgba(0,0,0,0.35)',
                      fontSize: 11,
                    }}>
                      Loading more…
                    </div>
                  )}
                </div>
              </div>

              {/* BACK FACE — router outlet */}
              <div className="ns-middle-face ns-middle-back">
                <div className="ns-outlet-wrap">
                  {renderBackFaceContent()}
                </div>
              </div>

            </div>
            </LiquidGlassPanel>
            )}
          </div>

          {/* ═══ RIGHT PANEL ═══ (xl only — at lg/md it lives in a drawer, wired in 14.2) */}
          {showRightPanel && !location.pathname.startsWith('/publish/') && location.pathname !== '/discover' && location.pathname !== '/notifications' && (
          <LiquidGlassPanel cornerRadius={20} elasticity={0.15} style={{ width: 220, height: 775, flexShrink: 0 }}>
          <div
            className="ns-right-panel"
            ref={rightRef}
            {...initTilt(rightRef)}
          >
            {location.pathname.startsWith('/upload/blueprint') ? (
              <WorkspaceShell showNavTab={uploadEditorSmall} />
            ) : (
            <>
            <div className="ns-right-title">Explore</div>

            {/* Working search bar */}
            <div className="ns-right-search" style={{ position: "relative" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                placeholder="Quick search…"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim().length >= 1) {
                    doFlip('back', 'right');
                    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                    setSearchOpen(false);
                  }
                }}
              />
            </div>
            {searchOpen && (
              <div className="ns-right-search-results">
                {searchLoading && <div style={{ padding: 8, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Searching…</div>}
                {!searchLoading && searchResults.length === 0 && searchPeopleResults.length === 0 && <div style={{ padding: 8, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>No results</div>}

                {/* People results */}
                {searchPeopleResults && searchPeopleResults.length > 0 && (
                  <>
                    <div style={{
                      fontSize: 9, fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.10em',
                      color: 'rgba(255,255,255,0.35)',
                      padding: '4px 10px 2px 10px',
                    }}>
                      People
                    </div>
                    {searchPeopleResults.slice(0,2).map((p: any) => (
                      <div
                        key={p.id}
                        className="ns-search-result"
                        style={{ display: 'flex', alignItems: 'center',
                          gap: 8, padding: '6px 10px' }}
                        onClick={() => {
                          doFlip('back', 'right');
                          navigate(`/creator/${p.username}`);
                          setSearchOpen(false);
                          setSearchQuery('');
                        }}
                      >
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%',
                          background: 'rgba(139,69,19,0.15)',
                          border: '1px solid rgba(139,69,19,0.25)',
                          display: 'flex', alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9, fontWeight: 700, color: '#8B4513',
                          flexShrink: 0,
                        }}>
                          {(p.display_name ?? p.username)[0].toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11,
                            color: 'rgba(255,255,255,0.70)',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap' }}>
                            {p.display_name}
                          </div>
                          <div style={{ fontSize: 10,
                            color: 'rgba(255,255,255,0.35)' }}>
                            @{p.username}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div style={{
                      fontSize: 9, fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.10em',
                      color: 'rgba(255,255,255,0.35)',
                      padding: '4px 10px 2px 10px',
                      marginTop: 4,
                    }}>
                      Posts
                    </div>
                  </>
                )}

                {searchResults.map((r: any) => (
                  <div key={r.id} className="ns-search-result" onClick={() => { setSearchOpen(false); setSearchQuery(""); doFlip('back', 'right'); navigate(`/content/${r.id}`); }}>
                    <span className="ns-search-result-badge">{displayContentType(r.content_type)}</span>
                    <span className="ns-search-result-title">{r.title}</span>
                  </div>
                ))}
                {searchQuery.length >= 2 && !searchLoading && (
                  <div className="ns-search-result" onClick={() => {
                    doFlip('back', 'right');
                    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                    setSearchOpen(false);
                    setSearchQuery("");
                  }}>
                    <span style={{ fontSize: 10, color: "#55e0d2" }}>See all results →</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Section label */}
            <div style={{
              fontSize: 10, fontWeight: 700,
              color: 'rgba(255,255,255,0.35)',
              letterSpacing: '1.4px',
              textTransform: 'uppercase' as const,
              padding: '0 4px',
              marginBottom: 10,
            }}>
              Browse
            </div>

            {/* ── Post type tile grid — 3 primary tiles */}
            <div className="ns-tile-grid">
              {POST_TYPE_TILES.map(tile => (
                <div
                  key={tile.value}
                  className="ns-tile"
                  style={{
                    '--tile-hover-color': tile.color,
                  } as React.CSSProperties}
                  onMouseEnter={e => {
                    const color = randomTileColor();
                    (e.currentTarget as HTMLElement).style.setProperty(
                      '--tile-hover-color', color
                    );
                  }}
                  onClick={() => {
                    // Map tile value → filterPostType value used by fetch
                    let filterValue: string;
                    if (tile.value === 'blueprint') {
                      // Blueprint = build + technique + discovery
                      filterValue = 'blueprint';
                    } else if (tile.value === 'blog') {
                      // Blog maps to discussion content types
                      filterValue = 'discussion';
                    } else {
                      filterValue = 'bounty';
                    }
                    setFilterPostType(filterValue);
                    setFilterLabel(tile.label);
                    setFilterEmoji(tile.emoji);
                    setFilterColor(tile.color);
                    setActiveTab('For You');
                    // Flip back to front face to show the filtered feed
                    doFlip('front', 'right');
                    navigate("/");
                  }}
                >
                  <span className="ns-tile-label">{tile.label}</span>
                  <span style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.25)',
                    marginLeft: 'auto',
                    flexShrink: 0,
                  }}>→</span>
                </div>
              ))}
            </div>

            <div className="ns-right-divider" />

            {/* Trending */}
            <div className="ns-trending-title">Trending</div>
            <div className="ns-trending-list">
              {(trendingItems ?? []).map((item: any, i: number) => (
                <div
                  key={item.id}
                  className="ns-trending-item"
                  onClick={() => { doFlip('back', 'right'); navigate(`/content/${item.id}`); }}
                >
                  <span className="ns-trending-rank">{i + 1}</span>
                  <div className="ns-trending-info">
                    <div className="ns-trending-name">{item.title}</div>
                    <span className={`ns-trending-badge ${diffBadgeClass(item.difficulty)}`}>
                      {item.difficulty || "Any"}
                    </span>
                  </div>
                </div>
              ))}
              {(!trendingItems || trendingItems.length === 0) && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", padding: "8px 8px" }}>
                  Loading…
                </div>
              )}
            </div>

            {/* Curator Picks */}
            {curatorPicks && curatorPicks.length > 0 && (
              <>
                <div className="ns-section-title">Curator Picks</div>
                {curatorPicks.map((pick: any) => {
                  const content = pick.content_items;
                  const curator = pick.curators?.profiles;
                  return (
                    <div key={pick.id} className="ns-curator-item" onClick={() => { if (content) { doFlip('back', 'right'); navigate(`/content/${content.id}`); } }}>
                      <div className="ns-curator-avatar">
                        {curator?.avatar_url ? <img src={curator.avatar_url} alt="" /> : <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>✦</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{content?.title}</div>
                        <span className="ns-search-result-badge">{content?.content_type ? displayContentType(content.content_type) : ""}</span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* Featured Collections */}
            {featuredCollections && featuredCollections.length > 0 && (
              <>
                <div className="ns-section-title">Collections</div>
                {featuredCollections.map((col: any) => (
                  <div key={col.id} className="ns-collection-item" onClick={() => { doFlip('back', 'right'); navigate(`/collection/${col.slug || col.id}`); }}>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>{col.title}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.30)" }}>
                      {(col.profiles as any)?.display_name || (col.profiles as any)?.username || "Creator"} · {col.item_count} items
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Who to Follow */}
            {isLoggedIn && followSuggestions && followSuggestions.length > 0 && (
              <>
                <div className="ns-section-title">Who to Follow</div>
                {followSuggestions.map((s: any) => (
                  <div key={s.id} className="ns-follow-item">
                    <div className="ns-follow-avatar" style={{ cursor: "pointer" }} onClick={() => { doFlip('back', 'right'); navigate(`/creator/${s.username}`); }}>
                      {s.avatar_url ? <img src={s.avatar_url} alt="" /> : <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>{(s.display_name || "?")[0]}</span>}
                    </div>
                    <div className="ns-follow-info" style={{ cursor: "pointer" }} onClick={() => { doFlip('back', 'right'); navigate(`/creator/${s.username}`); }}>
                      <div className="ns-follow-name">{s.display_name || s.username}</div>
                      <div className="ns-follow-handle">@{s.username}</div>
                    </div>
                    <FollowButton creatorId={s.id} />
                  </div>
                ))}
              </>
            )}

            {/* Auth buttons for guests */}
            {!isLoggedIn && (
              <div style={{ marginTop: 16 }}>
                <div className="ns-auth-btns">
                  <button className="ns-auth-btn signin" onClick={() => { doFlip('back', 'right'); navigate("/login"); }}>Sign in</button>
                  <button className="ns-auth-btn join" onClick={() => { doFlip('back', 'right'); navigate("/signup"); }}>Join free</button>
                </div>
              </div>
            )}

            {/* Footer links */}
            <div className="ns-footer-links">
              <span className="ns-footer-link" onClick={() => { doFlip('back', 'right'); navigate("/about"); }}>About NeoScale AI →</span>
              <a className="ns-footer-link" href="https://twitter.com/neoscaleai" target="_blank" rel="noopener noreferrer">Twitter @neoscaleai →</a>
            </div>
            </>
            )}
          </div>
          </LiquidGlassPanel>
          )}


        </div>
      </div>
    </div>
  );
}
