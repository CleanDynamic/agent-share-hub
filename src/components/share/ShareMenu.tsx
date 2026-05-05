import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
} from "@floating-ui/react";
import {
  Link2,
  MessageCircle,
  Bookmark,
  Check,
  ArrowLeft,
  Search,
  Plus,
} from "lucide-react";

export interface ShareCollection {
  id: string;
  name: string;
  accentColor: string;
  itemCount: number;
  containsThisItem: boolean;
}

export interface ShareThread {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ShareContentMeta {
  title: string;
  slug?: string;
  parentSlug?: string;
  parentStageId?: string;
}

export interface ShareMenuProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | { getBoundingClientRect: () => DOMRect } | null;
  contentType: "blueprint" | "stage" | "block" | "blog" | "bounty";
  contentId: string;
  contentMeta: ShareContentMeta;
  userCollections: ShareCollection[];
  recentThreads: ShareThread[];
  onCopyLink: () => void;
  onSendToThread: (threadId: string) => void;
  onSaveToCollection: (collectionId: string, isAlreadyIn: boolean) => void;
  onCreateCollection: (name: string) => void;
  onComposeNewThread: () => void;
}

type View = "main" | "message" | "library";

const TEAL = "#2EC4B6";

const menuItemStyle: React.CSSProperties = {
  height: 36,
  padding: "8px 12px",
  borderRadius: 6,
  display: "flex",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
  transition: "background 0.15s ease",
};
const iconStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  color: "rgba(255,255,255,0.65)",
  flexShrink: 0,
};
const labelStyle: React.CSSProperties = {
  fontFamily: "Inter, sans-serif",
  fontSize: 13,
  fontWeight: 500,
  color: "rgba(255,255,255,0.92)",
  flex: 1,
};
const hintStyle: React.CSSProperties = {
  fontFamily: "Inter, sans-serif",
  fontSize: 10,
  fontWeight: 500,
  color: "rgba(255,255,255,0.30)",
};
const searchInputStyle: React.CSSProperties = {
  height: 28,
  width: "100%",
  background: "rgba(255, 255, 255, 0.12)",
  border: "0.5px solid rgba(255,255,255,0.10)",
  borderRadius: 6,
  padding: "0 10px 0 32px",
  fontFamily: "Inter, sans-serif",
  fontSize: 12,
  color: "rgba(255,255,255,0.92)",
  outline: "none",
};

function rowBg(active: boolean) {
  return active ? "rgba(255, 255, 255, 0.14)" : "transparent";
}

const ShareMenu: React.FC<ShareMenuProps> = ({
  isOpen,
  onClose,
  anchorEl,
  userCollections,
  recentThreads,
  onCopyLink,
  onSendToThread,
  onSaveToCollection,
  onCreateCollection,
  onComposeNewThread,
}) => {
  const [view, setView] = useState<View>("main");
  const [highlighted, setHighlighted] = useState(0);
  const [copied, setCopied] = useState(false);
  const [threadSearch, setThreadSearch] = useState("");
  const [collectionSearch, setCollectionSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const newInputRef = useRef<HTMLInputElement | null>(null);

  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    placement: "bottom-start",
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    if (anchorEl) refs.setReference(anchorEl as any);
  }, [anchorEl, refs]);

  useEffect(() => {
    if (isOpen) {
      setView("main");
      setHighlighted(0);
      setCopied(false);
      setThreadSearch("");
      setCollectionSearch("");
      setNewName("");
      setShowNewForm(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (view === "message" || view === "library") {
      const t = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [view]);

  useEffect(() => {
    if (showNewForm) {
      const t = setTimeout(() => newInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [showNewForm]);

  const filteredThreads = recentThreads
    .filter((t) =>
      t.displayName.toLowerCase().includes(threadSearch.toLowerCase())
    )
    .slice(0, 5);
  const filteredCollections = userCollections.filter((c) =>
    c.name.toLowerCase().includes(collectionSearch.toLowerCase())
  );

  const itemCount =
    view === "main"
      ? 3
      : view === "message"
      ? filteredThreads.length + 1
      : filteredCollections.length + (showNewForm ? 0 : 1);

  const handleCopy = useCallback(() => {
    onCopyLink();
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 1500);
  }, [onCopyLink, onClose]);

  const handlePickThread = useCallback(
    (id: string) => {
      onSendToThread(id);
      onClose();
    },
    [onSendToThread, onClose]
  );

  const handlePickCollection = useCallback(
    (c: ShareCollection) => {
      onSaveToCollection(c.id, c.containsThisItem);
      onClose();
    },
    [onSaveToCollection, onClose]
  );

  const handleCreate = useCallback(() => {
    const t = newName.trim();
    if (!t) return;
    onCreateCollection(t);
    setNewName("");
    setShowNewForm(false);
    onClose();
  }, [newName, onCreateCollection, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (view !== "main") {
          setView("main");
          setHighlighted(view === "message" ? 1 : 2);
        } else {
          onClose();
        }
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowDown") {
        setHighlighted((p) => Math.min(p + 1, itemCount - 1));
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        setHighlighted((p) => Math.max(p - 1, 0));
        e.preventDefault();
      } else if (e.key === "Enter") {
        if (view === "main") {
          if (highlighted === 0) handleCopy();
          else if (highlighted === 1) {
            setView("message");
            setHighlighted(0);
          } else if (highlighted === 2) {
            setView("library");
            setHighlighted(0);
          }
        } else if (view === "message") {
          if (highlighted < filteredThreads.length) {
            handlePickThread(filteredThreads[highlighted].id);
          } else {
            onComposeNewThread();
            onClose();
          }
        } else if (view === "library") {
          if (showNewForm) handleCreate();
          else if (highlighted < filteredCollections.length) {
            handlePickCollection(filteredCollections[highlighted]);
          } else {
            setShowNewForm(true);
          }
        }
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    isOpen,
    view,
    highlighted,
    itemCount,
    filteredThreads,
    filteredCollections,
    showNewForm,
    handleCopy,
    handlePickThread,
    handlePickCollection,
    handleCreate,
    onComposeNewThread,
    onClose,
  ]);

  // Click outside
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const renderMain = () => (
    <>
      <div
        role="menuitem"
        style={{ ...menuItemStyle, background: rowBg(highlighted === 0) }}
        onMouseEnter={() => setHighlighted(0)}
        onClick={handleCopy}
      >
        {copied ? (
          <Check style={{ ...iconStyle, color: TEAL }} />
        ) : (
          <Link2 style={iconStyle} />
        )}
        <span style={labelStyle}>{copied ? "Copied" : "Copy link"}</span>
        {!copied && <span style={hintStyle}>⌘L</span>}
      </div>

      <div
        role="menuitem"
        style={{ ...menuItemStyle, background: rowBg(highlighted === 1) }}
        onMouseEnter={() => setHighlighted(1)}
        onClick={() => {
          setView("message");
          setHighlighted(0);
        }}
      >
        <MessageCircle style={iconStyle} />
        <span style={labelStyle}>Send via message</span>
        <span style={hintStyle}>⌘M</span>
      </div>

      <div
        role="menuitem"
        style={{ ...menuItemStyle, background: rowBg(highlighted === 2) }}
        onMouseEnter={() => setHighlighted(2)}
        onClick={() => {
          setView("library");
          setHighlighted(0);
        }}
      >
        <Bookmark style={iconStyle} />
        <span style={labelStyle}>Save to Library</span>
        <span style={hintStyle}>⌘S</span>
      </div>
    </>
  );

  const renderHeader = (label: string, backHi: number) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px 8px",
      }}
    >
      <button
        onClick={() => {
          setView("main");
          setHighlighted(backHi);
          setShowNewForm(false);
        }}
        style={{
          background: "transparent",
          border: "none",
          padding: 4,
          cursor: "pointer",
          color: "rgba(255,255,255,0.65)",
          display: "flex",
          alignItems: "center",
        }}
      >
        <ArrowLeft size={14} />
      </button>
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        {label}
      </span>
    </div>
  );

  const renderSearch = (
    placeholder: string,
    value: string,
    onChange: (v: string) => void
  ) => (
    <div style={{ position: "relative", padding: "0 4px 6px" }}>
      <Search
        size={12}
        style={{
          position: "absolute",
          left: 14,
          top: "50%",
          transform: "translateY(-60%)",
          color: "rgba(255,255,255,0.40)",
          pointerEvents: "none",
        }}
      />
      <input
        ref={searchRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={searchInputStyle}
      />
    </div>
  );

  const renderMessage = () => (
    <>
      {renderHeader("Send to", 1)}
      {renderSearch("Search threads…", threadSearch, setThreadSearch)}
      <div style={{ maxHeight: 220, overflowY: "auto" }}>
        {filteredThreads.length === 0 && (
          <div
            style={{
              padding: "10px 12px",
              fontSize: 12,
              color: "rgba(255,255,255,0.40)",
            }}
          >
            No recent threads
          </div>
        )}
        {filteredThreads.map((t, i) => (
          <div
            key={t.id}
            style={{ ...menuItemStyle, background: rowBg(highlighted === i) }}
            onMouseEnter={() => setHighlighted(i)}
            onClick={() => handlePickThread(t.id)}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: t.avatarUrl
                  ? `url(${t.avatarUrl}) center/cover`
                  : "rgba(255,255,255,0.10)",
                flexShrink: 0,
                border: "0.5px solid rgba(255,255,255,0.10)",
              }}
            />
            <span style={labelStyle}>{t.displayName}</span>
          </div>
        ))}
      </div>
      <div
        style={{
          borderTop: "0.5px solid rgba(255,255,255,0.08)",
          marginTop: 4,
          paddingTop: 4,
        }}
      >
        <div
          style={{
            ...menuItemStyle,
            background: rowBg(highlighted === filteredThreads.length),
          }}
          onMouseEnter={() => setHighlighted(filteredThreads.length)}
          onClick={() => {
            onComposeNewThread();
            onClose();
          }}
        >
          <Plus style={iconStyle} />
          <span style={labelStyle}>New conversation</span>
        </div>
      </div>
    </>
  );

  const renderLibrary = () => (
    <>
      {renderHeader("Save to", 2)}
      {renderSearch(
        "Search collections…",
        collectionSearch,
        setCollectionSearch
      )}
      <div style={{ maxHeight: 220, overflowY: "auto" }}>
        {filteredCollections.length === 0 && (
          <div
            style={{
              padding: "10px 12px",
              fontSize: 12,
              color: "rgba(255,255,255,0.40)",
            }}
          >
            No collections yet
          </div>
        )}
        {filteredCollections.map((c, i) => (
          <div
            key={c.id}
            style={{ ...menuItemStyle, background: rowBg(highlighted === i) }}
            onMouseEnter={() => setHighlighted(i)}
            onClick={() => handlePickCollection(c)}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: c.accentColor,
                flexShrink: 0,
                border: "0.5px solid rgba(0,0,0,0.20)",
              }}
            />
            <span style={labelStyle}>{c.name}</span>
            <span style={hintStyle}>{c.itemCount}</span>
            {c.containsThisItem && (
              <Check size={14} style={{ color: TEAL, flexShrink: 0 }} />
            )}
          </div>
        ))}
      </div>
      <div
        style={{
          borderTop: "0.5px solid rgba(255,255,255,0.08)",
          marginTop: 4,
          paddingTop: 4,
        }}
      >
        {showNewForm ? (
          <div style={{ display: "flex", gap: 6, padding: "4px" }}>
            <input
              ref={newInputRef}
              type="text"
              placeholder="Collection name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              style={{ ...searchInputStyle, paddingLeft: 10, flex: 1 }}
            />
            <button
              onClick={handleCreate}
              style={{
                height: 28,
                padding: "0 10px",
                borderRadius: 6,
                background: TEAL,
                border: "none",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Create
            </button>
          </div>
        ) : (
          <div
            style={{
              ...menuItemStyle,
              background: rowBg(highlighted === filteredCollections.length),
            }}
            onMouseEnter={() => setHighlighted(filteredCollections.length)}
            onClick={() => setShowNewForm(true)}
          >
            <Plus style={iconStyle} />
            <span style={labelStyle}>New collection</span>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div
      ref={(el) => {
        menuRef.current = el;
        refs.setFloating(el);
      }}
      role="menu"
      style={{
        ...floatingStyles,
        background: "rgba(16,16,24,0.96)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "0.5px solid rgba(255,255,255,0.10)",
        borderRadius: 10,
        boxShadow: "0 12px 32px rgba(0,0,0,0.7)",
        width: 260,
        padding: 4,
        zIndex: 9999,
      }}
    >
      {view === "main" && renderMain()}
      {view === "message" && renderMessage()}
      {view === "library" && renderLibrary()}
    </div>
  );
};

export default ShareMenu;
