import { Share2 } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { useShareMenu, virtualAnchorFromPoint, type ShareableType } from "./ShareMenuProvider";
import type { ShareContentMeta } from "./ShareMenu";

export interface ShareTriggerProps {
  contentType: ShareableType;
  contentId: string;
  contentMeta: ShareContentMeta;
  /** If true, clicking the wrapped child opens the share menu (instead of right-click). */
  openOnClick?: boolean;
  /** Wrap any element to enable right-click → ShareMenu. */
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Wrap any element to enable right-click → ShareMenu.
 * If no children, renders a small share icon button.
 */
export function ShareTrigger({
  contentType,
  contentId,
  contentMeta,
  openOnClick = false,
  children,
  className,
  style,
}: ShareTriggerProps) {
  const { openShareMenu } = useShareMenu();

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openShareMenu({
      contentType,
      contentId,
      contentMeta,
      anchorEl: virtualAnchorFromPoint(e.clientX, e.clientY),
    });
  };

  if (children) {
    return (
      <div
        onContextMenu={onContextMenu}
        onClick={
          openOnClick
            ? (e) => {
                e.stopPropagation();
                openShareMenu({
                  contentType,
                  contentId,
                  contentMeta,
                  anchorEl: e.currentTarget as HTMLElement,
                });
              }
            : undefined
        }
        className={className}
        style={style}
      >
        {children}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label="Share"
      title="Share"
      onClick={(e) => {
        e.stopPropagation();
        openShareMenu({
          contentType,
          contentId,
          contentMeta,
          anchorEl: e.currentTarget as HTMLElement,
        });
      }}
      onContextMenu={onContextMenu}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        padding: 0,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: "rgba(255,255,255,0.55)",
        ...style,
      }}
    >
      <Share2 size={14} />
    </button>
  );
}
