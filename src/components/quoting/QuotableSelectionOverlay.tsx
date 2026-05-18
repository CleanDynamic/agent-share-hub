"use client";

import { useEffect, useRef, useCallback } from "react";
import { Repeat2, MessageSquarePlus, Copy } from "lucide-react";

export interface SelectionData {
  text: string;
  rect: DOMRect;
  sourceBlockId?: string;
  sourceBlockTypeLabel?: string;
  sourcePostId?: string;
  sourcePostSlug?: string;
}

export interface OverlayPosition {
  x: number;
  y: number;
  placement: "above" | "below";
}

interface QuotableSelectionOverlayProps {
  isOpen: boolean;
  selection: SelectionData | null;
  position: OverlayPosition | null;
  onQuoteReblog: (selection: SelectionData) => void;
  onAnnotate: (selection: SelectionData) => void;
  onCopy: (text: string) => void;
  onDismiss: () => void;
}

const ACTIONS = [
  { id: "quote-reblog", icon: Repeat2, label: "Reblog with quote" },
  { id: "annotate", icon: MessageSquarePlus, label: "Add annotation" },
  { id: "copy", icon: Copy, label: "Copy text" },
] as const;

export function QuotableSelectionOverlay({
  isOpen,
  selection,
  position,
  onQuoteReblog,
  onAnnotate,
  onCopy,
  onDismiss,
}: QuotableSelectionOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const isVisible = isOpen && !!selection && !!position;

  useEffect(() => {
    if (!isVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isVisible, onDismiss]);

  useEffect(() => {
    if (!isVisible) return;
    const onScroll = () => onDismiss();
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [isVisible, onDismiss]);

  useEffect(() => {
    if (!isVisible) return;
    const onDown = (e: PointerEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        // Only dismiss when there's no active text selection anymore
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) onDismiss();
      }
    };
    const t = setTimeout(() => {
      document.addEventListener("pointerdown", onDown);
    }, 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [isVisible, onDismiss]);

  const handleAction = useCallback(
    (id: string) => {
      if (!selection) return;
      if (id === "quote-reblog") onQuoteReblog(selection);
      else if (id === "annotate") onAnnotate(selection);
      else if (id === "copy") onCopy(selection.text);
    },
    [selection, onQuoteReblog, onAnnotate, onCopy]
  );

  if (!isVisible || !selection || !position) return null;

  const arrowSize = { w: 6, h: 4 };

  return (
    <div
      ref={overlayRef}
      role="toolbar"
      aria-label="Selection actions"
      className="fixed flex flex-row items-center gap-1"
      style={{
        left: position.x,
        top: position.y,
        transform: "translateX(-50%)",
        zIndex: 60,
        padding: "6px 8px",
        background: "rgba(40, 40, 52, 0.95)",
        backdropFilter: "blur(40px) saturate(160%)",
        WebkitBackdropFilter: "blur(40px) saturate(160%)",
        border: "0.5px solid rgba(255, 255, 255, 0.14)",
        borderRadius: "100px",
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.40)",
        animation: "overlay-in 120ms ease-out forwards",
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <svg
        width={arrowSize.w}
        height={arrowSize.h}
        viewBox={`0 0 ${arrowSize.w} ${arrowSize.h}`}
        style={{
          position: "absolute",
          left: "50%",
          ...(position.placement === "above"
            ? { bottom: -arrowSize.h + 0.5, transform: "translateX(-50%)" }
            : { top: -arrowSize.h + 0.5, transform: "translateX(-50%) rotate(180deg)" }),
        }}
      >
        <polygon
          points={`0,0 ${arrowSize.w / 2},${arrowSize.h} ${arrowSize.w},0`}
          fill="rgba(40, 40, 52, 0.95)"
        />
      </svg>

      {ACTIONS.map((a) => (
        <ActionButton
          key={a.id}
          icon={a.icon}
          label={a.label}
          onClick={() => handleAction(a.id)}
        />
      ))}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="flex items-center justify-center"
        style={{
          width: 32,
          height: 32,
          borderRadius: "100px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          transition: "background 100ms ease",
          color: "rgba(255, 255, 255, 0.9)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <Icon size={16} />
      </button>
      <span
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 transition-opacity duration-100 group-hover:opacity-100"
        style={{
          bottom: "calc(100% + 8px)",
          padding: "4px 10px",
          borderRadius: 6,
          fontSize: 12,
          lineHeight: "16px",
          color: "rgba(255, 255, 255, 0.85)",
          background: "rgba(24, 24, 32, 0.95)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
        }}
      >
        {label}
      </span>
    </div>
  );
}
