import * as React from "react";
import {
  Download,
  X,
  FileText,
  File,
  AlignLeft,
  Sparkles,
  Braces,
  ClipboardCopy,
  Loader2,
} from "lucide-react";

export type ExportFormat =
  | "markdown"
  | "pdf"
  | "plain"
  | "ai-pdf"
  | "json"
  | "copy-json";

interface Post {
  id: string;
  slug: string;
  postType: string;
  title: string;
}

interface AIExportMenuProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  post: Post;
  onExport: (format: ExportFormat) => void | Promise<void>;
  /** Format currently in flight (shows spinner). */
  busyFormat?: ExportFormat | null;
}

interface MenuItem {
  format: ExportFormat;
  icon: React.ReactNode;
  label: string;
  helper: string;
  isTeal?: boolean;
  isNew?: boolean;
  isEmphasized?: boolean;
}

const humanFormats: MenuItem[] = [
  { format: "markdown", icon: <FileText size={14} />, label: "Markdown", helper: "For Notion, Obsidian, GitHub" },
  { format: "pdf", icon: <File size={14} />, label: "PDF", helper: "Print or share visually" },
  { format: "plain", icon: <AlignLeft size={14} />, label: "Plain text", helper: "" },
];

const aiFormats: MenuItem[] = [
  {
    format: "ai-pdf",
    icon: <Sparkles size={14} style={{ color: "#2EC4B6" }} />,
    label: "AI-PDF",
    helper: "Upload to ChatGPT, Claude, or any AI agent. Includes structured component list.",
    isTeal: true,
    isNew: true,
  },
  { format: "json", icon: <Braces size={14} style={{ color: "#2EC4B6" }} />, label: "JSON", helper: "Full schema, machine-readable", isTeal: true },
  {
    format: "copy-json",
    icon: <ClipboardCopy size={14} style={{ color: "#2EC4B6" }} />,
    label: "Copy as JSON",
    helper: "To clipboard for ChatGPT or Claude",
    isTeal: true,
    isEmphasized: true,
  },
];

export function AIExportMenu({ isOpen, onClose, anchorEl, post: _post, onExport, busyFormat }: AIExportMenuProps) {
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (anchorEl && isOpen) {
      const rect = anchorEl.getBoundingClientRect();
      const menuWidth = 320;
      const menuHeight = 360;
      let left = rect.left + rect.width / 2 - menuWidth / 2;
      // Anchor floats from the bottom bar; prefer opening above it.
      let top = rect.top - menuHeight - 8;
      if (top < 8) top = rect.bottom + 8;
      if (left < 8) left = 8;
      if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
      setPosition({ top, left });
    }
  }, [anchorEl, isOpen]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && !anchorEl?.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose, anchorEl]);

  const handleItemClick = async (format: ExportFormat) => {
    if (busyFormat) return;
    await onExport(format);
    // Close after instant ones; busy formats close themselves once done.
    if (format === "copy-json" || format === "plain" || format === "json" || format === "markdown") {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: 320,
        background: "rgba(16, 16, 24, 0.96)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "0.5px solid rgba(255, 255, 255, 0.10)",
        borderRadius: 10,
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.7)",
        padding: 4,
        zIndex: 9999,
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ height: 44, padding: "12px 14px", borderBottom: "0.5px solid rgba(255, 255, 255, 0.10)" }}
      >
        <div className="flex items-center gap-2">
          <Download size={14} style={{ color: "rgba(255, 255, 255, 0.92)" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255, 255, 255, 0.92)" }}>Download or copy</span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center"
          style={{ width: 20, height: 20, borderRadius: 4, background: "transparent", border: "none", cursor: "pointer", color: "rgba(255, 255, 255, 0.40)" }}
          aria-label="Close export menu"
        >
          <X size={12} />
        </button>
      </div>

      <div style={{ padding: "4px 0" }}>
        <div style={{ padding: "8px 14px 4px", fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255, 255, 255, 0.40)" }}>
          FOR HUMANS
        </div>
        {humanFormats.map((item) => (
          <MenuItemRow key={item.format} item={item} onClick={handleItemClick} busy={busyFormat === item.format} disabled={!!busyFormat} />
        ))}
      </div>

      <div style={{ borderTop: "0.5px solid rgba(255, 255, 255, 0.10)", padding: "8px 14px" }}>
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(46, 196, 182, 0.65)" }}>
          FOR AI AGENTS & CHATBOTS
        </span>
      </div>

      <div style={{ padding: "0 0 4px" }}>
        {aiFormats.map((item) => (
          <MenuItemRow key={item.format} item={item} onClick={handleItemClick} busy={busyFormat === item.format} disabled={!!busyFormat} />
        ))}
      </div>

      <div style={{ height: 32, borderTop: "0.5px solid rgba(255, 255, 255, 0.10)", padding: "8px 14px", display: "flex", alignItems: "center" }}>
        <span style={{ fontSize: 10, fontWeight: 400, fontStyle: "italic", color: "rgba(255, 255, 255, 0.40)" }}>
          All formats include attribution to the author.
        </span>
      </div>
    </div>
  );
}

function MenuItemRow({
  item,
  onClick,
  busy,
  disabled,
}: {
  item: MenuItem;
  onClick: (format: ExportFormat) => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      onClick={() => onClick(item.format)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={disabled}
      className="flex items-center w-full text-left"
      style={{
        height: 36,
        padding: "8px 12px",
        margin: "0 4px",
        width: "calc(100% - 8px)",
        borderRadius: 6,
        background: isHovered && !disabled ? "rgba(255, 255, 255, 0.12)" : "transparent",
        border: item.isEmphasized ? "0.5px solid rgba(46, 196, 182, 0.20)" : "0.5px solid transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled && !busy ? 0.5 : 1,
        transition: "background 0.15s ease",
      }}
    >
      <span className="flex items-center justify-center shrink-0" style={{ width: 20, color: item.isTeal ? "#2EC4B6" : "rgba(255, 255, 255, 0.60)" }}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : item.icon}
      </span>
      <div className="flex items-center gap-2 min-w-0 ml-2">
        <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255, 255, 255, 0.92)", whiteSpace: "nowrap" }}>{item.label}</span>
        {item.isNew && (
          <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 5px", borderRadius: 4, background: "#2EC4B6", color: "#000", letterSpacing: "0.02em" }}>
            NEW
          </span>
        )}
        {item.helper && (
          <span className="truncate" style={{ fontSize: 10, fontWeight: 400, color: "rgba(255, 255, 255, 0.40)" }}>
            {item.helper}
          </span>
        )}
      </div>
    </button>
  );
}

export default AIExportMenu;
