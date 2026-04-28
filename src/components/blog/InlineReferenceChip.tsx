import * as React from "react";
import { FileText, LayoutGrid, ArrowUpRight, AlertCircle, Lock } from "lucide-react";

export interface InlineReferenceChipProps {
  type: "blueprint" | "stage" | "block";
  label: string;
  /** For block chips: the type colour shown as the dot. */
  subColor?: string;
  href: string;
  isAccessible?: boolean;
  isBroken?: boolean;
  /** When provided, called instead of opening href. */
  onClick?: (e: React.MouseEvent) => void;
}

export function InlineReferenceChip({
  type,
  label,
  subColor,
  href,
  isAccessible = true,
  isBroken = false,
  onClick,
}: InlineReferenceChipProps) {
  const truncatedLabel = label.length > 40 ? `${label.slice(0, 40)}…` : label;
  const [hovered, setHovered] = React.useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isBroken) return;
    if (!isAccessible) return; // parent surfaces a toast
    if (onClick) {
      onClick(e);
    } else if (href) {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  };

  // Broken reference state
  if (isBroken) {
    return (
      <span
        className="inline-flex items-center gap-1 align-baseline rounded cursor-default"
        style={{
          padding: "1px 7px 1px 6px",
          backgroundColor: "rgba(239,68,68,0.06)",
          border: "0.5px solid rgba(239,68,68,0.20)",
        }}
        title="Original content was deleted"
      >
        <AlertCircle size={11} style={{ color: "#ef4444", flexShrink: 0 }} />
        <span
          className="font-medium line-through"
          style={{ fontSize: "13px", color: "rgba(255,255,255,0.50)" }}
        >
          [Reference unavailable]
        </span>
      </span>
    );
  }

  const variantStyles = (() => {
    switch (type) {
      case "blueprint":
        return {
          background: "rgba(232,87,26,0.10)",
          border: "rgba(232,87,26,0.20)",
          iconColor: "#E8571A",
        };
      case "stage":
        return {
          background: "rgba(46,196,182,0.10)",
          border: "rgba(46,196,182,0.20)",
          iconColor: "#2EC4B6",
        };
      case "block":
        return {
          background: "rgba(255,255,255,0.05)",
          border: "rgba(255,255,255,0.10)",
          iconColor: subColor || "#ffffff",
        };
    }
  })();

  const renderIcon = () => {
    switch (type) {
      case "blueprint":
        return (
          <FileText size={11} style={{ color: variantStyles.iconColor, flexShrink: 0 }} />
        );
      case "stage":
        return (
          <LayoutGrid size={11} style={{ color: variantStyles.iconColor, flexShrink: 0 }} />
        );
      case "block":
        return (
          <span
            className="rounded-full flex-shrink-0"
            style={{
              width: 6,
              height: 6,
              backgroundColor: variantStyles.iconColor,
            }}
          />
        );
    }
  };

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleClick(e as unknown as React.MouseEvent);
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group inline-flex items-center gap-1 align-baseline rounded cursor-pointer transition-colors"
      style={{
        padding: "1px 7px 1px 6px",
        backgroundColor: variantStyles.background,
        border: `0.5px solid ${variantStyles.border}`,
      }}
    >
      {renderIcon()}
      <span
        className="font-medium group-hover:underline"
        style={{ fontSize: "13px", color: "rgba(255,255,255,0.92)" }}
      >
        {truncatedLabel}
      </span>
      {!isAccessible && (
        <Lock size={9} style={{ color: "rgba(255,255,255,0.40)", flexShrink: 0 }} />
      )}
      <ArrowUpRight
        size={9}
        className="transition-colors flex-shrink-0"
        style={{
          color: hovered ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.40)",
        }}
      />
    </span>
  );
}
