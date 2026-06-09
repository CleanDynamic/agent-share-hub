import { ChevronLeft, type LucideIcon } from "lucide-react";
import type { ReactNode, CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useBreakpoint } from "@/hooks/useBreakpoint";

/**
 * ShellHeader
 *
 * Shared header for the centre column of every page. Guarantees identical
 * positioning of: Back button, optional title, optional primary action,
 * optional tabs, optional search/controls, optional toggle, and an optional
 * secondary action (e.g. "Mark all as read") rendered at the right of the
 * tabs row.
 *
 * Fixed vertical rhythm — see plan.md for the exact diagram.
 */

export type ShellHeaderTab = {
  id: string;
  label: string;
  count?: number;
};

export type ShellHeaderProps = {
  onBack?: () => void;
  primaryAction?: {
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
    disabled?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  title?: string;
  tabs?: ShellHeaderTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  searchSlot?: ReactNode;
  toggleSlot?: ReactNode;
};

const FONT = "Inter, sans-serif";
const ORANGE = "#E8571A";
const ORANGE_GRADIENT = "linear-gradient(135deg, #E8571A 0%, #C44514 100%)";

export function ShellHeader({
  onBack,
  primaryAction,
  secondaryAction,
  title,
  tabs,
  activeTab,
  onTabChange,
  searchSlot,
  toggleSlot,
}: ShellHeaderProps) {
  const navigate = useNavigate();
  const breakpoint = useBreakpoint();
  const hideBack = breakpoint === "mobile";
  const handleBack = onBack ?? (() => navigate(-1));

  const hasTitle = !!title;
  const hasTabs = !!tabs && tabs.length > 0;
  const hasSearch = !!searchSlot;

  const row: CSSProperties = {
    display: "flex",
    alignItems: "center",
    width: "100%",
  };

  return (
    <div style={{ padding: "0 20px", paddingTop: 12 }}>
      {/* ROW 1 — top bar */}
      <div style={{ ...row, height: 56, justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", flex: "0 0 auto" }}>
          {!hideBack && (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Go back"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                height: 32,
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.04)",
                border: "none",
                color: "rgba(255,255,255,0.70)",
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "color 0.15s, background 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "rgba(255,255,255,0.95)";
                e.currentTarget.style.background = "rgba(255,255,255,0.07)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgba(255,255,255,0.70)";
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              }}
            >
              <ChevronLeft size={16} />
              Back
            </button>
          )}
        </div>

        {toggleSlot && (
          <div style={{ flex: "1 1 auto", display: "flex", justifyContent: "center" }}>
            {toggleSlot}
          </div>
        )}
        {!toggleSlot && <div style={{ flex: "1 1 auto" }} />}

        <div style={{ display: "flex", alignItems: "center", flex: "0 0 auto" }}>
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 32,
                padding: "8px 16px",
                borderRadius: 8,
                background: ORANGE_GRADIENT,
                border: "none",
                color: "#fff",
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 600,
                cursor: primaryAction.disabled ? "not-allowed" : "pointer",
                opacity: primaryAction.disabled ? 0.5 : 1,
                transition: "transform 0.15s, opacity 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!primaryAction.disabled) e.currentTarget.style.transform = "scale(1.02)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {primaryAction.icon && <primaryAction.icon size={14} />}
              {primaryAction.label}
            </button>
          )}
        </div>
      </div>

      {/* ROW 2 — title */}
      {hasTitle && (
        <div
          style={{
            height: 32,
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            fontFamily: FONT,
            fontSize: 18,
            fontWeight: 600,
            color: "rgba(255,255,255,0.95)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
      )}

      {/* ROW 3 — tabs (+ secondary action) */}
      {(hasTabs || secondaryAction) && (
        <div
          style={{
            height: 44,
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 24, height: "100%" }}>
            {hasTabs &&
              tabs!.map((t) => {
                const isActive = t.id === activeTab;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onTabChange?.(t.id)}
                    style={{
                      position: "relative",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      height: "100%",
                      padding: "10px 0",
                      background: "transparent",
                      border: "none",
                      fontFamily: FONT,
                      fontSize: 13,
                      fontWeight: 500,
                      color: isActive ? ORANGE : "rgba(255,255,255,0.55)",
                      cursor: "pointer",
                      transition: "color 0.15s",
                    }}
                  >
                    {t.label}
                    {typeof t.count === "number" && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "1px 6px",
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.08)",
                          color: "rgba(255,255,255,0.75)",
                        }}
                      >
                        {t.count}
                      </span>
                    )}
                    {isActive && (
                      <span
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          bottom: -1,
                          height: 2,
                          background: ORANGE,
                          borderRadius: 2,
                        }}
                      />
                    )}
                  </button>
                );
              })}
          </div>
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
              style={{
                background: "transparent",
                border: "none",
                color: secondaryAction.disabled
                  ? "rgba(255,255,255,0.30)"
                  : "rgba(255,255,255,0.65)",
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 500,
                cursor: secondaryAction.disabled ? "default" : "pointer",
                padding: "4px 6px",
              }}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}

      {/* ROW 4 — search / controls */}
      {hasSearch && <div style={{ marginTop: 12 }}>{searchSlot}</div>}

      {/* Constant content offset */}
      <div style={{ height: 16 }} />
    </div>
  );
}

export default ShellHeader;
