import { ChevronLeft, type LucideIcon } from "lucide-react";
import type { ReactNode, CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { feedback } from "@/lib/theme/motion";

/**
 * ShellHeader
 *
 * Shared header for the centre column of every page. Guarantees identical
 * positioning of: Back button, optional title, optional primary action,
 * optional tabs, optional search/controls, optional toggle, and an optional
 * secondary action (e.g. "Mark all as read") rendered at the right of the
 * tabs row.
 *
 * Fixed vertical rhythm — see plan.md for the exact diagram. Every size in it
 * went through the density table in UI-P55 (the top row 56 → 46, the buttons
 * 32 → 26, the tabs row 44 → 36, type 13 → 12 and 18 → 15, the gaps ×0.72);
 * on a phone the tabs row keeps 44, because its tabs are that tall and are
 * touch targets.
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

const FONT = "'Figtree', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const ORANGE = "var(--action)";
const ORANGE_GRADIENT = "var(--action)";

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
  const phone = breakpoint === "mobile";
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
    <div style={{ padding: "0 14px", paddingTop: 9 }}>
      {/* ROW 1 — top bar */}
      <div style={{ ...row, height: 46, justifyContent: "space-between", gap: 9 }}>
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
                height: 26,
                padding: "6px 9px",
                borderRadius: 8,
                background: "var(--recess)",
                border: "none",
                color: "var(--text2)",
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                transition: feedback("color", "background-color"),
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text)";
                e.currentTarget.style.background = "var(--recess)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text2)";
                e.currentTarget.style.background = "var(--recess)";
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
                gap: 4,
                height: 26,
                padding: "6px 12px",
                borderRadius: 8,
                background: ORANGE_GRADIENT,
                border: "none",
                /* BG-P29. Was `var(--text)`, which is the ROOM's ink and not
                   the ink for a filled control: --text on --action measures
                   2.73:1 on Noon and 2.24:1 on Dusk, both well under the
                   4.5:1 text floor, on the one primary CTA in the header.
                   --on-action is the measured pairing the theme publishes for
                   exactly this — 5.65:1 and 6.35:1 — and it inverts with the
                   room, which --text does in the wrong direction here. Found
                   by the screenshot diff, which flagged this button when its
                   gradient flattened and made the label worth re-measuring. */
                color: "var(--on-action)",
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 600,
                cursor: primaryAction.disabled ? "not-allowed" : "pointer",
                opacity: primaryAction.disabled ? 0.5 : 1,
                transition: feedback("transform", "opacity"),
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
            height: 26,
            marginTop: 6,
            display: "flex",
            alignItems: "center",
            fontFamily: FONT,
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text)",
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
            height: phone ? 44 : 36,
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 17, height: "100%" }}>
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
                      gap: 4,
                      height: "100%",
                      padding: "7px 0",
                      background: "transparent",
                      border: "none",
                      fontFamily: FONT,
                      fontSize: 12,
                      fontWeight: 500,
                      /* BG-P30. The resting tab was painted `--recess`, which
                         is a SURFACE token: 1.16:1 on Noon's ground and
                         1.33:1 on Dusk's, at 13px/500. An inactive tab is
                         still a label somebody has to read to choose it.
                         `--text2` is what the system names quiet ink and is
                         the pairing the contract publishes — 5.26:1 and
                         7.65:1 — so this reuses a legal pairing rather than
                         striking a value. */
                      color: isActive ? ORANGE : "var(--text2)",
                      cursor: "pointer",
                      transition: feedback("color"),
                    }}
                  >
                    {t.label}
                    {typeof t.count === "number" && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "1px 4px",
                          borderRadius: 999,
                          background: "var(--recess)",
                          color: "var(--text)",
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
                  ? "var(--text2)"
                  : "var(--text2)",
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 500,
                cursor: secondaryAction.disabled ? "default" : "pointer",
                padding: "4px 4px",
              }}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}

      {/* ROW 4 — search / controls */}
      {hasSearch && <div style={{ marginTop: 9 }}>{searchSlot}</div>}

      {/* Constant content offset */}
      <div style={{ height: 16 }} />
    </div>
  );
}

export default ShellHeader;
