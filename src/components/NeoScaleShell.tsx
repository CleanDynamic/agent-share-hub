import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
import { MobileNav } from "@/components/layout/MobileNav";
import { FollowButton } from "@/components/FollowButton";
import { displayContentType } from "@/lib/content-types";

/* ────────────────────────────────────────────────
   CSS — injected into document.head on mount
──────────────────────────────────────────────── */
const NEOSCALE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@400;500;600;700&display=swap');

.ns-root *, .ns-root *::before, .ns-root *::after { margin: 0; padding: 0; box-sizing: border-box; }

/* ── Middle panel design tokens ── */
.ns-middle-front, .ns-middle-back {
  --mp-text: rgba(255,255,255,0.92);
  --mp-text-secondary: rgba(255,255,255,0.45);
  --mp-text-muted: rgba(255,255,255,0.25);
  --mp-border: rgba(255,255,255,0.06);
  --mp-surface: rgba(255,255,255,0.03);
  --mp-orange: #E8571A;
  --mp-teal: #2EC4B6;
  --mp-font: 'Playfair Display', Georgia, serif;
  font-family: 'Inter', sans-serif;
  color: rgba(255,255,255,0.90);
}

.ns-root {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #08080C;
  font-family: 'Inter', sans-serif;
  overflow: hidden;
  position: fixed;
  inset: 0;
  z-index: 10;
}

.ns-grid-bg {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
.ns-grid-bg canvas { width: 100%; height: 100%; display: block; }

.ns-scale-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  position: relative;
  z-index: 1;
}

.ns-app-container {
  display: flex;
  align-items: center;
  gap: 24px;
  transform-origin: center center;
  position: relative;
  z-index: 1;
}

/* ── Shared panel glass ── */
.ns-panel {
  border-radius: 20px;
  background: linear-gradient(165deg,
    rgba(255,255,255,0.06) 0%,
    rgba(255,255,255,0.02) 50%,
    rgba(255,255,255,0.04) 100%);
  border: 1px solid rgba(255,255,255,0.06);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  box-shadow: 0 30px 80px rgba(0,0,0,0.5),
    0 0 0 1px rgba(255,255,255,0.03) inset,
    0 1px 0 rgba(255,255,255,0.05) inset;
  position: relative;
  overflow: hidden;
}
.ns-panel::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
}

/* ── Left panel ── */
.ns-left-panel {
  width: 200px;
  height: 775px;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.ns-logo {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: #E8571A;
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
.ns-nav-item:hover { background: rgba(255,255,255,0.04); }
.ns-nav-item.active { background: rgba(232,87,26,0.1); }
.ns-nav-icon {
  width: 18px; height: 18px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
  color: rgba(255,255,255,0.35);
  transition: color 0.25s;
}
.ns-nav-item.active .ns-nav-icon { color: #E8571A; }
.ns-nav-label {
  font-size: 13px;
  font-weight: 400;
  color: rgba(255,255,255,0.4);
  transition: color 0.25s;
  letter-spacing: 0.1px;
  flex: 1;
}
.ns-nav-item.active .ns-nav-label { color: rgba(255,255,255,0.9); font-weight: 500; }
.ns-nav-item:hover .ns-nav-label { color: rgba(255,255,255,0.6); }
.ns-nav-spacer { flex: 1; }
.ns-nav-divider { height: 1px; background: rgba(255,255,255,0.05); margin: 8px 4px; }
.ns-nav-badge {
  display: flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 9px; font-size: 10px; font-weight: 700;
  background: #E8571A; color: #fff;
}
.ns-nav-badge.muted { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.4); }

/* pulse connector */
.ns-left-panel::after {
  content: '';
  position: absolute;
  right: -1px; top: 50%;
  transform: translateY(-50%);
  width: 3px; height: 0;
  background: #E8571A;
  border-radius: 2px;
  opacity: 0;
  filter: blur(1px);
  box-shadow: 0 0 12px #E8571A;
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
  border-top: 1px solid rgba(255,255,255,0.05);
  margin-top: 8px;
}
.ns-user-btn {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 8px; border-radius: 10px;
  cursor: pointer; transition: background 0.2s;
  border: none; background: none; text-align: left;
}
.ns-user-btn:hover { background: rgba(255,255,255,0.04); }
.ns-user-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: #E8571A; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; flex-shrink: 0;
  overflow: hidden;
}
.ns-user-avatar img { width: 100%; height: 100%; object-fit: cover; }
.ns-user-name {
  font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.6);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
}
.ns-user-dots { color: rgba(255,255,255,0.2); font-size: 16px; }
.ns-user-menu {
  position: absolute; bottom: 56px; left: 8px; right: 8px;
  background: rgba(8,8,12,0.95); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; padding: 4px; z-index: 10;
}
.ns-user-menu button {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 8px 10px; border: none; background: none;
  border-radius: 8px; cursor: pointer; font-size: 12px; color: #e74c3c;
  transition: background 0.15s;
}
.ns-user-menu button:hover { background: rgba(255,255,255,0.04); }
.ns-auth-btns { display: flex; flex-direction: column; gap: 6px; padding: 8px; }
.ns-auth-btn {
  display: flex; align-items: center; justify-content: center;
  height: 32px; border-radius: 8px; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all 0.2s; border: none;
}
.ns-auth-btn.signin {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.6);
}
.ns-auth-btn.signin:hover { background: rgba(255,255,255,0.08); }
.ns-auth-btn.join {
  background: #111; border: 1px solid rgba(255,255,255,0.1); color: #fff;
}
.ns-auth-btn.join:hover { background: #1a1a1a; }

/* ── Middle panel ── */
.ns-middle-wrapper { width: 600px; height: 775px; perspective: 1400px; flex-shrink: 0; }
.ns-middle-flipper {
  width: 100%; height: 100%;
  position: relative;
  transform-style: preserve-3d;
}
.ns-middle-front, .ns-middle-back {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 100%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 20px;
  background: linear-gradient(165deg,
    rgba(255,255,255,0.06) 0%,
    rgba(255,255,255,0.02) 50%,
    rgba(255,255,255,0.04) 100%);
  border: 1px solid rgba(255,255,255,0.06);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  box-shadow: 0 30px 80px rgba(0,0,0,0.5),
    0 0 0 1px rgba(255,255,255,0.03) inset,
    0 1px 0 rgba(255,255,255,0.05) inset;
  overflow: hidden;
  padding: 0;
}
.ns-middle-front::before, .ns-middle-back::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
}
.ns-middle-back { transform: rotateY(180deg); }
.ns-middle-back.rtl { transform: rotateY(-180deg); }

/* ── Compose area ── */
.ns-compose-wrap {
  background: rgba(27,27,32,0.4);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border: 1px solid rgba(255,255,255,0.05);
  border-top: 1px solid rgba(255,255,255,0.08);
  border-left: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 32px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.4);
}
.ns-compose-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.ns-compose-avatar {
  width: 48px; height: 48px; border-radius: 50%;
  background: #E8571A;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 700; color: #fff;
  flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.10);
}
.ns-compose-input {
  flex: 1;
}
.ns-compose-placeholder {
  font-family: 'Playfair Display', serif;
  font-size: 18px;
  color: rgba(255,255,255,0.30);
  cursor: pointer;
  padding-top: 4px;
  padding-bottom: 20px;
}
.ns-compose-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,0.05);
}
.ns-compose-actions {
  display: flex;
  gap: 16px;
}
.ns-compose-action-btn {
  color: rgba(255,255,255,0.35);
  cursor: pointer;
  font-size: 20px;
  background: none;
  border: none;
  transition: color 0.15s;
}
.ns-compose-action-btn:hover { color: #2EC4B6; }
.ns-compose-submit {
  background: linear-gradient(135deg, #E8571A, #f66124);
  color: #fff;
  padding: 8px 24px;
  border-radius: 9999px;
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(232,87,26,0.20);
  transition: transform 0.15s;
}
.ns-compose-submit:hover { transform: scale(1.05); }
.ns-compose-submit:active { transform: scale(0.95); }

/* ── Feed tabs ── */
.ns-tab-row {
  display: flex;
  gap: 32px;
  margin-bottom: 40px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  padding-bottom: 8px;
}
.ns-tab {
  font-family: 'Playfair Display', serif;
  font-size: 18px;
  font-weight: 400;
  color: rgba(255,255,255,0.35);
  cursor: pointer;
  padding-bottom: 12px;
  border: none;
  background: none;
  transition: color 0.15s;
}
.ns-tab:hover { color: rgba(255,255,255,0.65); }
.ns-tab.active {
  color: #fff;
  box-shadow: 0 2px 0 0 #E8571A;
}

/* ── Feed scroll container ── */
.ns-feed-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-bottom: 24px;
}
.ns-feed-scroll::-webkit-scrollbar { width: 3px; }
.ns-feed-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }

.ns-feed-loading {
  display: flex; flex-direction: column; gap: 12px; padding: 4px 0;
}
.ns-feed-skeleton {
  height: 80px; border-radius: 12px;
  background: rgba(255,255,255,0.03);
  animation: nsPulse 1.5s ease-in-out infinite;
}
@keyframes nsPulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }

/* ── Feed cards ── */
.ns-feed-card {
  background: rgba(27,27,32,0.4);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border: 1px solid rgba(255,255,255,0.05);
  border-top: 1px solid rgba(255,255,255,0.08);
  border-left: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 32px;
  cursor: pointer;
  transition: transform 0.3s ease, box-shadow 0.3s ease,
              border-color 0.3s ease;
  position: relative;
  overflow: hidden;
}
.ns-feed-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 50px rgba(0,0,0,0.6);
  border-color: rgba(255,255,255,0.10);
}

.ns-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}
.ns-card-header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}
.ns-card-avatar {
  width: 42px; height: 42px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700;
  flex-shrink: 0;
  border: 1px solid;
}
.ns-card-meta { display: flex; flex-direction: column; gap: 4px; }
.ns-card-title {
  font-family: 'Playfair Display', serif;
  font-size: 18px;
  font-weight: 400;
  color: #fff;
  line-height: 1.3;
  margin-bottom: 0;
}
.ns-card-byline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ns-card-author {
  font-size: 12px;
  color: rgba(255,255,255,0.45);
  font-family: 'Inter', sans-serif;
}
.ns-card-dot {
  color: rgba(255,255,255,0.20);
  font-size: 10px;
}
.ns-card-time {
  font-size: 12px;
  color: rgba(255,255,255,0.30);
  font-family: 'Inter', sans-serif;
}
.ns-card-type-badge {
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 1px solid;
  font-family: 'Inter', sans-serif;
}
.ns-card-menu {
  color: rgba(255,255,255,0.30);
  cursor: pointer;
  font-size: 20px;
  background: none; border: none;
  transition: color 0.15s;
  flex-shrink: 0;
}
.ns-card-menu:hover { color: #fff; }

.ns-card-body {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: rgba(255,255,255,0.45);
  line-height: 1.65;
  margin-bottom: 24px;
}
.ns-card-body.italic { font-style: italic; }

.ns-card-image-wrap {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.05);
  margin-bottom: 24px;
}
.ns-card-image {
  width: 100%;
  height: 192px;
  object-fit: cover;
  opacity: 0.8;
  transition: transform 0.7s ease;
  display: block;
}
.ns-feed-card:hover .ns-card-image {
  transform: scale(1.05);
}
.ns-card-image-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(8,8,12,0.8), transparent);
}

.ns-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,0.05);
}
.ns-card-actions-left { display: flex; gap: 24px; }
.ns-card-actions-right { display: flex; gap: 16px; }
.ns-card-action {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  color: rgba(255,255,255,0.35);
  background: none; border: none;
  cursor: pointer;
  transition: color 0.15s, transform 0.15s;
}
.ns-card-action:hover { transform: scale(1.1); }
.ns-card-action.like:hover  { color: #E8571A; }
.ns-card-action.reply:hover { color: #2EC4B6; }
.ns-card-action.dl:hover    { color: #22C55E; }
.ns-card-action.share:hover { color: #fff; }

/* ── Page shell (outlet pages) ── */
.ns-page-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.ns-page-header {
  padding: 20px 24px 16px 24px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.ns-page-title {
  font-family: 'Playfair Display', serif;
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4px;
}
.ns-page-subtitle {
  font-size: 13px;
  color: rgba(255,255,255,0.35);
  font-family: 'Inter', sans-serif;
}
.ns-page-body {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

/* ── Back button ── */
.ns-back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 24px;
  font-size: 13px;
  color: rgba(255,255,255,0.35);
  background: none; border: none;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  transition: color 0.15s;
  width: 100%;
  text-align: left;
}
.ns-back-btn:hover { color: #fff; }

/* ── Back face — outlet ── */
.ns-outlet-wrap {
  width: 100%; height: 100%;
  overflow-y: auto; overflow-x: hidden;
  display: flex; flex-direction: column;
  background: transparent;
  color: rgba(255,255,255,0.90);
  font-family: 'Inter', sans-serif;
}
.ns-outlet-wrap::-webkit-scrollbar { width: 3px; }
.ns-outlet-wrap::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }

/* ── Glass input (forms, search) ── */
.ns-glass-input {
  width: 100%;
  background: rgba(27,27,32,0.5);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 10px 16px;
  color: #fff;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.ns-glass-input:focus {
  border-color: rgba(232,87,26,0.50);
  box-shadow: 0 0 0 3px rgba(232,87,26,0.08);
}
.ns-glass-input::placeholder { color: rgba(255,255,255,0.25); }

/* ── Glass card (reusable smaller card) ── */
.ns-glass-card {
  background: rgba(27,27,32,0.4);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border: 1px solid rgba(255,255,255,0.05);
  border-top: 1px solid rgba(255,255,255,0.08);
  border-left: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  padding: 20px;
  transition: border-color 0.2s;
}
.ns-glass-card:hover { border-color: rgba(255,255,255,0.10); }

/* ── Orange button (primary CTA) ── */
.ns-btn-orange {
  background: linear-gradient(135deg, #E8571A, #f66124);
  color: #fff;
  padding: 10px 24px;
  border-radius: 9999px;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(232,87,26,0.20);
  transition: transform 0.15s;
}
.ns-btn-orange:hover  { transform: scale(1.05); }
.ns-btn-orange:active { transform: scale(0.95); }

/* ── Ghost button ── */
.ns-btn-ghost {
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.70);
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
  color: #fff;
}

/* ── Section label (trending, categories etc) ── */
.ns-section-label {
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.30);
  margin-bottom: 16px;
}

/* ── Override Lovable outlet styles ── */
.ns-page-body .bg-background,
.ns-page-body [class*="bg-background"] {
  background: transparent !important;
}
.ns-page-body .text-foreground,
.ns-page-body [class*="text-foreground"] {
  color: rgba(255,255,255,0.90) !important;
  font-family: 'Inter', sans-serif !important;
}
.ns-page-body .text-muted-foreground,
.ns-page-body [class*="text-muted-foreground"] {
  color: rgba(255,255,255,0.40) !important;
}
.ns-page-body .border-border,
.ns-page-body [class*="border-border"] {
  border-color: rgba(255,255,255,0.05) !important;
}
.ns-page-body .sticky {
  background: rgba(8,8,12,0.90) !important;
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
}
.ns-right-panel::-webkit-scrollbar { width: 3px; }
.ns-right-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }

.ns-right-title {
  font-size: 11px; font-weight: 600;
  color: rgba(255,255,255,0.5);
  letter-spacing: 1.5px; text-transform: uppercase;
  padding: 0 4px; margin-bottom: 14px;
}
.ns-right-search {
  width: 100%; height: 34px;
  border-radius: 17px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.05);
  display: flex; align-items: center;
  padding: 0 12px; gap: 8px;
  margin-bottom: 16px;
  cursor: pointer;
  transition: border-color 0.2s;
}
.ns-right-search:hover { border-color: rgba(255,255,255,0.12); }
.ns-right-search svg { width: 13px; height: 13px; color: rgba(255,255,255,0.2); flex-shrink: 0; }
.ns-right-search input {
  flex: 1; background: none; border: none; outline: none;
  font-size: 11px; color: rgba(255,255,255,0.5);
  font-family: inherit;
}
.ns-right-search input::placeholder { color: rgba(255,255,255,0.18); }
.ns-right-search-results {
  position: absolute; left: 14px; right: 14px; top: 68px;
  background: rgba(8,8,12,0.97); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px; max-height: 300px; overflow-y: auto; z-index: 20;
  padding: 6px;
}
.ns-search-result {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; border-radius: 8px; cursor: pointer;
  transition: background 0.15s;
}
.ns-search-result:hover { background: rgba(255,255,255,0.04); }
.ns-search-result-title { font-size: 11px; color: rgba(255,255,255,0.6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.ns-search-result-badge { font-size: 9px; padding: 1px 5px; border-radius: 4px; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.35); flex-shrink: 0; }

.ns-right-cats {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 8px; margin-bottom: 18px;
}
.ns-right-cat {
  border-radius: 10px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.04);
  padding: 12px 8px;
  display: flex; flex-direction: column;
  align-items: center; gap: 6px;
  cursor: pointer; transition: all 0.2s;
  position: relative;
}
.ns-right-cat:hover { background: rgba(255,255,255,0.06); }
.ns-right-cat:hover::after {
  content: '';
  position: absolute; inset: 0;
  border-radius: 10px;
  border: 1px solid rgba(232,87,26,0.25);
}
.ns-right-cat-emoji { font-size: 18px; }
.ns-right-cat-name { font-size: 10px; font-weight: 500; color: rgba(255,255,255,0.4); text-align: center; }
.ns-right-divider { height: 1px; background: rgba(255,255,255,0.04); margin: 4px 0 14px; }
.ns-trending-title {
  font-size: 10px; font-weight: 600;
  color: rgba(255,255,255,0.35);
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
.ns-trending-item:hover { background: rgba(255,255,255,0.05); }
.ns-trending-rank { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.15); width: 16px; text-align: center; }
.ns-trending-info { flex: 1; min-width: 0; }
.ns-trending-name { font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.55); margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ns-trending-badge {
  display: inline-block; padding: 2px 7px;
  border-radius: 4px; font-size: 9px; font-weight: 600; letter-spacing: 0.3px;
}
.ns-badge-beginner { background: rgba(46,204,113,0.12); color: #2ecc71; }
.ns-badge-intermediate { background: rgba(243,156,18,0.12); color: #f39c12; }
.ns-badge-advanced { background: rgba(231,76,60,0.12); color: #e74c3c; }
.ns-badge-any { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.35); }

/* ── Right panel sections ── */
.ns-section-title {
  font-size: 10px; font-weight: 600;
  color: rgba(255,255,255,0.35);
  letter-spacing: 1.2px; text-transform: uppercase;
  padding: 0 4px; margin: 14px 0 8px;
}
.ns-curator-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; border-radius: 8px;
  cursor: pointer; transition: background 0.15s;
}
.ns-curator-item:hover { background: rgba(255,255,255,0.04); }
.ns-curator-avatar {
  width: 22px; height: 22px; border-radius: 50%;
  background: rgba(255,255,255,0.08); flex-shrink: 0;
  overflow: hidden;
}
.ns-curator-avatar img { width: 100%; height: 100%; object-fit: cover; }
.ns-collection-item {
  display: flex; flex-direction: column; gap: 2px;
  padding: 8px; border-radius: 8px;
  cursor: pointer; transition: background 0.15s;
}
.ns-collection-item:hover { background: rgba(255,255,255,0.04); }
.ns-follow-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 4px;
}
.ns-follow-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: rgba(255,255,255,0.08); flex-shrink: 0;
  overflow: hidden;
}
.ns-follow-avatar img { width: 100%; height: 100%; object-fit: cover; }
.ns-follow-info { flex: 1; min-width: 0; }
.ns-follow-name { font-size: 12px; color: rgba(255,255,255,0.6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ns-follow-handle { font-size: 10px; color: rgba(255,255,255,0.25); }
.ns-footer-links {
  margin-top: 16px; padding: 12px 4px 4px;
  border-top: 1px solid rgba(255,255,255,0.04);
  display: flex; flex-direction: column; gap: 4px;
}
.ns-footer-link {
  font-size: 10px; color: rgba(255,255,255,0.2);
  text-decoration: none; transition: color 0.15s;
  cursor: pointer;
}
.ns-footer-link:hover { color: rgba(255,255,255,0.5); }

`;

/* ────────────────────────────────────────────────
   Category data (expanded with missing types)
──────────────────────────────────────────────── */
const CATEGORIES = [
  { name: "Prompt(s)",    emoji: "💬", slug: "prompt-file" },
  { name: "Agent(s)",     emoji: "🤖", slug: "agent-blueprint" },
  { name: "Workflow",     emoji: "🔄", slug: "workflow-template" },
  { name: "AI Tools",     emoji: "🧠", slug: "ai-tools-llms" },
  { name: "Blog",         emoji: "📝", slug: "blog" },
  { name: "Projects",     emoji: "🗂️",  slug: "projects" },
  { name: "Evaluation",   emoji: "📊", slug: "evaluation-framework" },
  { name: "Agent Stack",  emoji: "🏗️",  slug: "agent-stack" },
  { name: "Install Guide",emoji: "📥", slug: "install-guide" },
  { name: "Model Config", emoji: "⚙️",  slug: "model-config-guide" },
  { name: "Integration",  emoji: "🔗", slug: "integration-guide" },
  { name: "Bounties",     emoji: "🎯", slug: "bounties" },
];

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
    "prompt-file": "#E8571A",
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

/* ────────────────────────────────────────────────
   Feed renderer helper
──────────────────────────────────────────────── */
function renderFeedEntry(entry: any) {
  if (entry._feedType === "collection") return <CollectionFeedCard key={`col-${entry.id}`} item={entry} />;
  if (entry._feedType === "project")    return <ProjectFeedCard key={`proj-${entry.id}`} item={entry} />;
  if (entry.is_reblog)                  return <ReblogCard key={entry.id} item={entry} />;
  return <FeedItem key={entry.id} item={entry} />;
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
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const flipperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRef    = useRef<HTMLDivElement>(null);
  const rightRef   = useRef<HTMLDivElement>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout>>();
  const isFlipping = useRef(false);
  const currentRotation = useRef(0);

  const [flipDir,    setFlipDir]    = useState<1 | -1>(1);
  const [pulsing,    setPulsing]    = useState(false);
  const [activeTab,  setActiveTab]  = useState("For You");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);

  const isMobile = useIsMobile();
  const { isLoggedIn, profile, user, signOut, isCreator } = useAuth();
  const { display: msgBadge } = useUnreadMessages();
  const { display: notifBadge } = useUnreadNotifications();
  const { display: draftBadge } = useDraftCount();
  const { hasUnseenSaves } = useNavBadges();

  const isHome  = location.pathname === "/";
  const navPage = routeToNav(location.pathname);

  /* ── CSS injection ── */
  useEffect(() => {
    if (isMobile) return;
    const tag = document.createElement("style");
    tag.setAttribute("data-neoscale-shell", "1");
    tag.textContent = NEOSCALE_CSS;
    document.head.appendChild(tag);
    return () => { document.head.removeChild(tag); };
  }, [isMobile]);

  /* ── Fetch feed posts ── */
  useEffect(() => {
    const fetchPosts = async () => {
      const { data } = await supabase
        .from('content_items')
        .select(`
          id, title, description, content_type, difficulty,
          view_count, download_count, cover_image_url, created_at,
          profiles:creator_id (display_name, username, avatar_url)
        `)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setPosts(data);
    };
    fetchPosts();
  }, []);

  function triggerPulse() {
    setPulsing(false);
    requestAnimationFrame(() => setPulsing(true));
    setTimeout(() => setPulsing(false), 600);
  }

  /* ── Canvas grid background ── */
  useEffect(() => {
    if (isMobile) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let w = 0, h = 0, raf = 0;
    let t = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth; h = window.innerHeight;
      canvas!.width  = w * dpr;
      canvas!.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener("resize", resize);
    resize();

    const gs = 48;
    function draw() {
      ctx.clearRect(0, 0, w, h);
      const cols = Math.ceil(w / gs) + 1;
      const rows = Math.ceil(h / gs) + 1;
      const cx1 = w * 0.5 + Math.cos(t * 0.3) * w * 0.35;
      const cy1 = h * 0.5 + Math.sin(t * 0.4) * h * 0.3;
      const cx2 = w * 0.5 + Math.sin(t * 0.25) * w * 0.3;
      const cy2 = h * 0.5 + Math.cos(t * 0.35) * h * 0.35;
      const cx3 = w * 0.5 + Math.cos(t * 0.5 + 2) * w * 0.25;
      const cy3 = h * 0.5 + Math.sin(t * 0.45 + 1) * h * 0.25;
      const maxD = Math.sqrt(w * w + h * h) * 0.5;

      for (let i = 0; i <= cols; i++) {
        const x = i * gs, my = h * 0.5;
        const d1 = Math.hypot(x - cx1, my - cy1);
        const d2 = Math.hypot(x - cx2, my - cy2);
        const d3 = Math.hypot(x - cx3, my - cy3);
        const intensity = Math.max(0.03,
          0.14 * Math.max(0, 1 - d1 / maxD) +
          0.10 * Math.max(0, 1 - d2 / maxD) +
          0.08 * Math.max(0, 1 - d3 / maxD));
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h);
        ctx.strokeStyle = `rgba(255,255,255,${intensity})`; ctx.lineWidth = 0.5; ctx.stroke();
      }
      for (let j = 0; j <= rows; j++) {
        const y = j * gs, mx = w * 0.5;
        const d1 = Math.hypot(mx - cx1, y - cy1);
        const d2 = Math.hypot(mx - cx2, y - cy2);
        const d3 = Math.hypot(mx - cx3, y - cy3);
        const intensity = Math.max(0.03,
          0.14 * Math.max(0, 1 - d1 / maxD) +
          0.10 * Math.max(0, 1 - d2 / maxD) +
          0.08 * Math.max(0, 1 - d3 / maxD));
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y);
        ctx.strokeStyle = `rgba(255,255,255,${intensity})`; ctx.lineWidth = 0.5; ctx.stroke();
      }
      const g1 = ctx.createRadialGradient(cx1, cy1, 0, cx1, cy1, 280);
      g1.addColorStop(0, "rgba(232,87,26,0.03)"); g1.addColorStop(1, "rgba(232,87,26,0)");
      ctx.fillStyle = g1; ctx.fillRect(0, 0, w, h);
      const g2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, 250);
      g2.addColorStop(0, "rgba(88,140,255,0.02)"); g2.addColorStop(1, "rgba(88,140,255,0)");
      ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
      t += 0.008;
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(raf); };
  }, [isMobile]);

  /* ── Responsive scale ── */
  useEffect(() => {
    if (isMobile) return;
    const el = containerRef.current;
    if (!el) return;
    const nativeW = 1068, nativeH = 775, pad = 48;
    function rescale() {
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
  }, [isMobile]);

  /* ── Supabase: recent feed ── */
  const { data: feedItems, isLoading: feedLoading } = useQuery({
    queryKey: ["ns_home_recent"],
    enabled: !isMobile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, title, description, content_type, post_category, is_reblog, reblog_of_id, reblog_thread_count, reblog_count, creator_id, difficulty, ai_tools, use_cases, custom_use_case_description, avg_rating, rating_count, download_count, view_count, comment_count, cover_image_url, created_at, what_to_expect_blocks, what_to_expect, other_tool_name, tool_subtype, model_parameters, custom_tags, profiles!content_items_creator_id_fkey(display_name, username)")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
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

  /* ── Mobile fallback (after all hooks) ── */
  if (isMobile) {
    return (
      <>
        <MobileNav />
        <main style={{ paddingTop: 56, paddingBottom: 56, minHeight: "100vh" }}>
          <Outlet />
        </main>
      </>
    );
  }

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

  /* ── Directional flip ── */
  function flipMiddle(source: 'left' | 'right') {
    if (isFlipping.current) return;

    const flipper = document.querySelector(
      '.ns-middle-flipper'
    ) as HTMLElement | null;
    if (!flipper) return;

    // Direction: left source adds 180, right source subtracts 180
    const delta = source === 'left' ? 180 : -180;
    currentRotation.current += delta;

    isFlipping.current = true;
    flipper.style.transition =
      'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
    flipper.style.transform =
      `rotateY(${currentRotation.current}deg)`;

    setTimeout(() => {
      isFlipping.current = false;
    }, 650);
  }

  /* ── Nav click handler ── */
  function handleNav(route: string) {
    navigate(route);
  }

  function handleSearchChange(q: string) {
    setSearchQuery(q);
    setSearchOpen(q.length >= 2);
    clearTimeout(searchDebounce.current);
    if (q.length < 2) { setSearchResults([]); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      const { data } = await supabase
        .from("content_items")
        .select("id, title, content_type")
        .ilike("title", `%${q}%`)
        .eq("status", "approved")
        .limit(6);
      setSearchResults(data ?? []);
      setSearchLoading(false);
    }, 300);
  }

  /* ── Build nav items ── */
  type NavEntry = { key: string; icon: JSX.Element; label: string; route: string; badge?: string | null; authOnly?: boolean; divider?: boolean; creatorOnly?: boolean };
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
    if (isFlipping.current) return;
    const flipper = document.querySelector('.ns-middle-flipper') as HTMLElement | null;
    if (!flipper) return;
    const nearest360 = Math.round(currentRotation.current / 360) * 360;
    currentRotation.current = nearest360;
    isFlipping.current = true;
    flipper.style.transition = 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
    flipper.style.transform = `rotateY(${nearest360}deg)`;
    setTimeout(() => { isFlipping.current = false; }, 650);
    navigate("/");
  }

  /* ── Back face content router ── */
  function renderPageWithHeader(title: string) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <button className="ns-outlet-back-btn" onClick={handleBackBtn}>← Back</button>
        <div style={{
          padding: '16px 16px 14px 16px',
          borderBottom: '1px solid var(--mp-border)',
          fontSize: 18, fontWeight: 700,
          color: 'var(--mp-text)',
          fontFamily: 'var(--mp-font)',
          flexShrink: 0,
        }}>
          {title}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </div>
      </div>
    );
  }

  function renderBackFaceContent() {
    const path = location.pathname;
    const searchParams = new URLSearchParams(location.search);

    /* /upload without type param → compact entry */
    if (path === '/upload' && !searchParams.get('type')) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <button className="ns-outlet-back-btn" onClick={handleBackBtn}>← Back</button>
          <div style={{ padding: '20px 16px', flex: 1, overflowY: 'auto' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--mp-text)', marginBottom: 6, fontFamily: 'var(--mp-font)' }}>
              Share your work
            </div>
            <div style={{ fontSize: 13, color: 'var(--mp-text-secondary)', marginBottom: 24, fontFamily: 'var(--mp-font)' }}>
              What are you sharing today?
            </div>
            {(['Blueprint', 'Blog', 'Bounty', 'Project'] as const).map(type => (
              <button key={type}
                onClick={() => navigate(`/upload?type=${type.toLowerCase()}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                  padding: '14px 16px', marginBottom: 8,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--mp-border)',
                  borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s',
                  color: 'var(--mp-text)', fontFamily: 'var(--mp-font)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--mp-border)';
                }}
              >
                <span style={{ fontSize: 20 }}>
                  {type === 'Blueprint' ? '📐' : type === 'Blog' ? '📝' : type === 'Bounty' ? '🎯' : '🗂️'}
                </span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{type}</div>
                  <div style={{ fontSize: 12, color: 'var(--mp-text-secondary)' }}>
                    {type === 'Blueprint' ? 'Prompts, agents, workflows, configs'
                      : type === 'Blog' ? 'Write an article or tutorial'
                      : type === 'Bounty' ? 'Post a challenge for the community'
                      : 'Share a project or tool you built'}
                  </div>
                </div>
                <span style={{ marginLeft: 'auto', color: 'var(--mp-text-muted)', fontSize: 16 }}>→</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    /* /profile → compact profile header */
    if (path === '/profile') {
      const pInitials = (profile?.display_name ?? profile?.username ?? 'U').slice(0, 2).toUpperCase();
      return (
        <div style={{ height: '100%', overflowY: 'auto' }}>
          <button className="ns-outlet-back-btn" onClick={handleBackBtn}>← Back</button>
          <div style={{ padding: '20px 16px 16px 16px', borderBottom: '1px solid var(--mp-border)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--mp-orange)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 700, color: '#fff',
              }}>
                {pInitials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--mp-text)', fontFamily: 'var(--mp-font)', marginBottom: 2 }}>
                  {profile?.display_name ?? 'Your Name'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--mp-text-secondary)', marginBottom: 10 }}>
                  @{profile?.username ?? 'username'}
                </div>
                <button onClick={() => navigate('/profile/edit')} style={{
                  padding: '6px 16px',
                  border: '1px solid var(--mp-border)',
                  borderRadius: 100, background: 'transparent',
                  color: 'var(--mp-text)', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--mp-font)',
                }}>
                  Edit profile
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--mp-border)' }}>
              {[{ label: 'Posts', value: '—' }, { label: 'Downloads', value: '—' }, { label: 'Following', value: '—' }, { label: 'Followers', value: '—' }].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--mp-text)', fontFamily: 'var(--mp-font)' }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--mp-text-secondary)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: '10px 16px 6px 16px', borderBottom: '1px solid var(--mp-border)' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--mp-text)', borderBottom: '2px solid var(--mp-orange)', paddingBottom: 10, fontFamily: 'var(--mp-font)' }}>Posts</span>
          </div>
          <Outlet />
        </div>
      );
    }

    /* /messages → panel-native DM header */
    if (path === '/messages') {
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <button className="ns-outlet-back-btn" onClick={handleBackBtn}>← Back</button>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--mp-border)', fontSize: 18, fontWeight: 700, color: 'var(--mp-text)', fontFamily: 'var(--mp-font)', flexShrink: 0 }}>
            Messages
          </div>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--mp-border)', flexShrink: 0 }}>
            <input placeholder="Search messages..."
              style={{
                width: '100%', padding: '8px 14px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--mp-border)',
                borderRadius: 24, color: 'var(--mp-text)',
                fontSize: 13, outline: 'none',
                fontFamily: 'var(--mp-font)',
                boxSizing: 'border-box',
              }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <Outlet />
          </div>
        </div>
      );
    }

    /* /library, /drafts, /notifications, /analytics → titled header */
    const titledRoutes: Record<string, string> = {
      '/library': 'Your Library',
      '/drafts': 'Drafts',
      '/notifications': 'Notifications',
      '/analytics': 'Analytics',
    };
    if (titledRoutes[path]) {
      return renderPageWithHeader(titledRoutes[path]);
    }

    /* Fallback — all other routes */
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <button className="ns-outlet-back-btn" onClick={handleBackBtn}>← Back</button>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </div>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="ns-root">
      {/* Animated grid background */}
      <div className="ns-grid-bg">
        <canvas ref={canvasRef} id="nsGridCanvas" />
      </div>

      <div className="ns-scale-wrapper">
        <div className="ns-app-container" ref={containerRef}>

          {/* ═══ LEFT PANEL ═══ */}
          <div
            className={`ns-panel ns-left-panel${pulsing ? " pulse" : ""}`}
            ref={leftRef}
            {...initTilt(leftRef)}
          >
            <div className="ns-logo" onClick={() => { flipMiddle('left'); handleNav("/"); }}>NeoScale</div>
            <ul className="ns-nav-list">
              {visibleNav.map((item, idx) => (
                <li key={item.key}>
                  {item.divider && idx > 0 && <div className="ns-nav-divider" />}
                  <div
                    className={`ns-nav-item${navPage === item.key ? " active" : ""}`}
                    onClick={() => { flipMiddle('left'); handleNav(item.route); }}
                  >
                    <span className="ns-nav-icon">{item.icon}</span>
                    <span className="ns-nav-label">{item.label}</span>
                    {item.badge && (
                      <span className={`ns-nav-badge${item.key === "drafts" ? " muted" : ""}`}>{item.badge}</span>
                    )}
                    {item.key === "library" && hasUnseenSaves && !item.badge && (
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E8571A", marginLeft: "auto" }} />
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
                  <button className="ns-auth-btn signin" onClick={() => handleNav("/login")}>Sign in</button>
                  <button className="ns-auth-btn join" onClick={() => handleNav("/signup")}>Join free</button>
                </div>
              )}
            </div>
          </div>

          {/* ═══ MIDDLE PANEL ═══ */}
          <div className="ns-middle-wrapper">
            <div className="ns-middle-flipper" ref={flipperRef}>

              {/* FRONT FACE — home feed */}
              <div className="ns-middle-front" style={{ display: "flex", flexDirection: "column" }}>
                {/* Compose bar */}
                <div className="ns-compose-bar">
                  <div className="ns-compose-avatar">
                    {profile ? (profile.display_name ?? profile.username ?? "U").slice(0, 2).toUpperCase() : "U"}
                  </div>
                  <div className="ns-compose-prompt" onClick={() => navigate('/upload')}>
                    Share something...
                  </div>
                </div>

                {/* Twitter-style underline tabs */}
                <div className="ns-tab-row">
                  {["For You", "Following", "Trending", "Recent"].map(tab => (
                    <div
                      key={tab}
                      className={`ns-tab${activeTab === tab ? " active" : ""}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab}
                    </div>
                  ))}
                </div>

                {/* Feed */}
                <div className="ns-feed-scroll">
                  {posts.length === 0 ? (
                    <div className="ns-feed-loading">
                      {[1,2,3,4].map(n => <div key={n} className="ns-feed-skeleton" />)}
                    </div>
                  ) : (
                    posts.map((post: any) => {
                      const postProfile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
                      const displayName = postProfile?.display_name || postProfile?.username || "Unknown";
                      const username = postProfile?.username || "user";
                      const tags: string[] = post.ai_tools ?? post.topics ?? [];
                      return (
                        <div key={post.id} className="ns-feed-card"
                             onClick={() => navigate(`/content/${post.id}`)}>
                          <div className="ns-feed-avatar-col">
                            <div className="ns-feed-card-avatar"
                                 style={{ background: ctypeBg(post.content_type) }}>
                              {displayName.slice(0, 2).toUpperCase()}
                            </div>
                          </div>
                          <div className="ns-feed-content-col">
                            <div className="ns-feed-header">
                              <span className="ns-feed-name">{displayName}</span>
                              <span className="ns-feed-handle">@{username}</span>
                              <span className="ns-feed-sep">·</span>
                              <span className="ns-feed-time">{timeAgo(post.created_at)}</span>
                              <span className="ns-feed-menu">···</span>
                            </div>
                            <span className="ns-feed-type-badge">{displayContentType(post.content_type)}</span>
                            <div className="ns-feed-title">{post.title}</div>
                            {tags.length > 0 && (
                              <div className="ns-feed-tags">
                                {tags.slice(0, 3).map((t: string) => (
                                  <span key={t} className="ns-feed-tag">{t}</span>
                                ))}
                              </div>
                            )}
                            <div className="ns-feed-actions">
                              <button className="ns-feed-action like" onClick={e => e.stopPropagation()}>♡ {post.view_count ?? 0}</button>
                              <button className="ns-feed-action reply" onClick={e => e.stopPropagation()}>💬 0</button>
                              <button className="ns-feed-action dl" onClick={e => e.stopPropagation()}>↓ {post.download_count ?? 0}</button>
                              <button className="ns-feed-action" onClick={e => e.stopPropagation()}>↗</button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* BACK FACE — router outlet */}
              <div className={`ns-middle-back${flipDir === -1 ? " rtl" : ""}`}>
                <div className="ns-outlet-wrap">
                  {renderBackFaceContent()}
                </div>
              </div>

            </div>
          </div>

          {/* ═══ RIGHT PANEL ═══ */}
          <div
            className="ns-panel ns-right-panel"
            ref={rightRef}
            {...initTilt(rightRef)}
          >
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
                    setSearchOpen(false);
                    setSearchQuery("");
                    flipMiddle('right');
                    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                  }
                }}
              />
            </div>
            {searchOpen && (
              <div className="ns-right-search-results">
                {searchLoading && <div style={{ padding: 8, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Searching…</div>}
                {!searchLoading && searchResults.length === 0 && <div style={{ padding: 8, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>No results</div>}
                {searchResults.map((r: any) => (
                  <div key={r.id} className="ns-search-result" onClick={() => { setSearchOpen(false); setSearchQuery(""); flipMiddle('right'); navigate(`/content/${r.id}`); }}>
                    <span className="ns-search-result-badge">{displayContentType(r.content_type)}</span>
                    <span className="ns-search-result-title">{r.title}</span>
                  </div>
                ))}
                {searchQuery.length >= 2 && !searchLoading && (
                  <div className="ns-search-result" onClick={() => { setSearchOpen(false); setSearchQuery(""); flipMiddle('right'); navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`); }}>
                    <span style={{ fontSize: 10, color: "#55e0d2" }}>See all results →</span>
                  </div>
                )}
              </div>
            )}

            {/* Category grid */}
            <div className="ns-right-cats">
              {CATEGORIES.map(cat => (
                <div
                  key={cat.slug}
                  className="ns-right-cat"
                  onClick={() => {
                    flipMiddle('right');
                    if (cat.slug === "projects") navigate("/category/projects");
                    else if (cat.slug === "bounties") navigate("/browse?tab=bounties");
                    else navigate(`/category/${cat.slug}`);
                  }}
                >
                  <span className="ns-right-cat-emoji">{cat.emoji}</span>
                  <span className="ns-right-cat-name">{cat.name}</span>
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
                  onClick={() => { flipMiddle('right'); navigate(`/content/${item.id}`); }}
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
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", padding: "8px 8px" }}>
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
                    <div key={pick.id} className="ns-curator-item" onClick={() => { if (content) { flipMiddle('right'); navigate(`/content/${content.id}`); } }}>
                      <div className="ns-curator-avatar">
                        {curator?.avatar_url ? <img src={curator.avatar_url} alt="" /> : <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>✦</span>}
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
                  <div key={col.id} className="ns-collection-item" onClick={() => { flipMiddle('right'); navigate(`/collection/${col.slug || col.id}`); }}>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>{col.title}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
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
                    <div className="ns-follow-avatar" style={{ cursor: "pointer" }} onClick={() => navigate(`/creator/${s.username}`)}>
                      {s.avatar_url ? <img src={s.avatar_url} alt="" /> : <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>{(s.display_name || "?")[0]}</span>}
                    </div>
                    <div className="ns-follow-info" style={{ cursor: "pointer" }} onClick={() => navigate(`/creator/${s.username}`)}>
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
                  <button className="ns-auth-btn signin" onClick={() => handleNav("/login")}>Sign in</button>
                  <button className="ns-auth-btn join" onClick={() => handleNav("/signup")}>Join free</button>
                </div>
              </div>
            )}

            {/* Footer links */}
            <div className="ns-footer-links">
              <span className="ns-footer-link" onClick={() => navigate("/about")}>About NeoScale AI →</span>
              <a className="ns-footer-link" href="https://twitter.com/neoscaleai" target="_blank" rel="noopener noreferrer">Twitter @neoscaleai →</a>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
