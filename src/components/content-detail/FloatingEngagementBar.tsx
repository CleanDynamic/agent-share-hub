import * as React from "react";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Share2,
  Download,
  Target,
  PenSquare,
} from "lucide-react";

interface Post {
  id: string;
  postType: string;
  slug: string;
  hasLiked: boolean;
  hasBookmarked: boolean;
  hasReposted: boolean;
}

interface Counts {
  likes: number;
  comments: number;
  reposts: number;
}

interface FloatingEngagementBarProps {
  post: Post;
  counts: Counts;
  isOwnPost: boolean;
  isVisible: boolean;
  onLike: () => void;
  onComment: () => void;
  onRepost: () => void;
  onBookmark: (anchorEl: HTMLButtonElement) => void;
  onShare: (anchorEl: HTMLButtonElement) => void;
  onExport: (anchorEl: HTMLButtonElement) => void;
  onSubmitSolution?: () => void;
  onEdit?: () => void;
}

function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

function Separator() {
  return (
    <div
      style={{
        width: 1,
        height: 16,
        background: "rgba(255,255,255,0.10)",
        margin: "0 4px",
      }}
    />
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  count?: number;
  label?: string;
  isActive?: boolean;
  activeColor?: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  tooltip?: string;
  customBackground?: string;
  customTextColor?: string;
  buttonRef?: React.Ref<HTMLButtonElement>;
}

function ActionButton({
  icon,
  count,
  label,
  isActive = false,
  activeColor = "#E8571A",
  onClick,
  tooltip,
  customBackground,
  customTextColor,
  buttonRef,
}: ActionButtonProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const textColor = customTextColor
    ? customTextColor
    : isActive
    ? activeColor
    : "rgba(255,255,255,0.65)";

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={tooltip}
      style={{
        height: 40,
        padding: "8px 14px",
        borderRadius: 100,
        display: "flex",
        alignItems: "center",
        gap: 6,
        border: "none",
        cursor: "pointer",
        background: customBackground
          ? customBackground
          : isHovered
          ? "rgba(255,255,255,0.04)"
          : "transparent",
        color: textColor,
        transition: "background 150ms ease",
      }}
    >
      {icon}
      {count !== undefined && (
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
            fontWeight: 500,
            color: textColor,
          }}
        >
          {formatCount(count)}
        </span>
      )}
      {label && (
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
            fontWeight: 500,
            color: textColor,
          }}
        >
          {label}
        </span>
      )}
    </button>
  );
}

export function FloatingEngagementBar({
  post,
  counts,
  isOwnPost,
  isVisible,
  onLike,
  onComment,
  onRepost,
  onBookmark,
  onShare,
  onExport,
  onSubmitSolution,
  onEdit,
}: FloatingEngagementBarProps) {
  const bookmarkRef = React.useRef<HTMLButtonElement>(null);
  const shareRef = React.useRef<HTMLButtonElement>(null);
  const exportRef = React.useRef<HTMLButtonElement>(null);
  const [isHoveringBar, setIsHoveringBar] = React.useState(false);

  // Keyboard shortcuts
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      switch (e.key.toLowerCase()) {
        case "l":
          onLike();
          break;
        case "c":
          onComment();
          break;
        case "b":
          if (bookmarkRef.current) onBookmark(bookmarkRef.current);
          break;
        case "e":
          if (exportRef.current) onExport(exportRef.current);
          break;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onLike, onComment, onBookmark, onExport]);

  const isBountyPost = post.postType === "bounty";
  const effectivelyVisible = isVisible || isHoveringBar;

  return (
    <div
      onMouseEnter={() => setIsHoveringBar(true)}
      onMouseLeave={() => setIsHoveringBar(false)}
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: effectivelyVisible
          ? "translateX(-50%) translateY(0)"
          : "translateX(-50%) translateY(8px)",
        width: "auto",
        height: 48,
        background: "rgba(16,16,24,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "0.5px solid rgba(255,255,255,0.10)",
        borderRadius: 100,
        boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
        padding: "4px 12px",
        display: "flex",
        flexDirection: "row",
        gap: 4,
        alignItems: "center",
        opacity: effectivelyVisible ? 1 : 0,
        pointerEvents: effectivelyVisible ? "auto" : "none",
        transition: "all 240ms cubic-bezier(0.4, 0, 0.2, 1)",
        zIndex: 40,
      }}
    >
      <ActionButton
        icon={
          <Heart
            size={16}
            fill={post.hasLiked ? "#E8571A" : "none"}
            stroke={post.hasLiked ? "#E8571A" : "currentColor"}
          />
        }
        count={counts.likes}
        isActive={post.hasLiked}
        activeColor="#E8571A"
        onClick={onLike}
        tooltip="Like (L)"
      />
      <ActionButton
        icon={<MessageCircle size={16} />}
        count={counts.comments}
        onClick={onComment}
        tooltip="Comment (C)"
      />
      <ActionButton
        icon={
          <Repeat2
            size={16}
            stroke={post.hasReposted ? "#E8571A" : "currentColor"}
          />
        }
        count={counts.reposts}
        isActive={post.hasReposted}
        activeColor="#E8571A"
        onClick={onRepost}
      />
      <Separator />
      <ActionButton
        buttonRef={bookmarkRef}
        icon={
          <Bookmark
            size={16}
            fill={post.hasBookmarked ? "#2EC4B6" : "none"}
            stroke={post.hasBookmarked ? "#2EC4B6" : "currentColor"}
          />
        }
        isActive={post.hasBookmarked}
        activeColor="#2EC4B6"
        onClick={(e) => onBookmark(e.currentTarget)}
        tooltip="Save to Library (B)"
      />
      <ActionButton
        buttonRef={shareRef}
        icon={<Share2 size={16} />}
        onClick={(e) => onShare(e.currentTarget)}
        tooltip="Share"
      />
      <ActionButton
        buttonRef={exportRef}
        icon={<Download size={16} />}
        onClick={(e) => onExport(e.currentTarget)}
        tooltip="Download or copy as data (E)"
      />
      {isBountyPost && onSubmitSolution && (
        <>
          <Separator />
          <ActionButton
            icon={<Target size={16} />}
            label="Submit"
            customBackground="rgba(245,158,11,0.10)"
            customTextColor="#F59E0B"
            onClick={onSubmitSolution}
          />
        </>
      )}
      {isOwnPost && onEdit && (
        <>
          <Separator />
          <ActionButton
            icon={<PenSquare size={16} />}
            label="Edit"
            onClick={onEdit}
          />
        </>
      )}
    </div>
  );
}

export default FloatingEngagementBar;
