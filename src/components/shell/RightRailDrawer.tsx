import { useEffect, useRef, useState } from "react";
import { X, Search, ChevronRight } from "lucide-react";
import { useRightRailData } from "@/hooks/useRightRailData";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { type } from "@/lib/theme/type";

export interface RightRailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

export function RightRailDrawer({ isOpen, onClose, onNavigate }: RightRailDrawerProps) {
  const [query, setQuery] = useState("");
  const [translateY, setTranslateY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const { browseItems, trendingItems, curatorPicks, collections, whoToFollow } =
    useRightRailData(isOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && isOpen) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    setDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0) setTranslateY(diff);
  };
  const onTouchEnd = () => {
    setDragging(false);
    if (translateY > 100) onClose();
    setTranslateY(0);
  };

  const go = (path: string) => { onNavigate(path); onClose(); };

  const q = query.trim().toLowerCase();
  const filterText = (s: string) => !q || s.toLowerCase().includes(q);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1100,
          animation: "rr-fade 200ms ease-out",
        }}
      />
      <aside
        role="dialog"
        aria-label="Explore"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: "fixed",
          left: 0, right: 0, bottom: 0,
          height: "85vh",
          background: "#0F0F14",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "20px 20px 0 0",
          zIndex: 1101,
          display: "flex", flexDirection: "column",
          transform: `translateY(${translateY}px)`,
          transition: dragging ? "none" : "transform 220ms ease-out",
          animation: dragging ? "none" : "rr-slide 280ms ease-out",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 6px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.18)" }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px 12px" }}>
          <h2 style={{ margin: 0, ...type.cardTitle,   color: "#fff" }}>
            Explore
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
              background: "transparent", border: "none", color: "rgba(255,255,255,0.65)", cursor: "pointer",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scroll */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 24px" }}>
          {/* Search */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", marginBottom: 18,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 24,
            }}
          >
            <Search size={16} color="rgba(255,255,255,0.45)" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search across NeoScale"
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                fontFamily: "Figtree, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.95)",
              }}
            />
          </div>

          <Section title="Browse">
            {browseItems.filter((i) => filterText(i.label)).map((i, idx, arr) => (
              <Row key={i.path} isLast={idx === arr.length - 1} onClick={() => go(`/discover?filter=${i.path}`)}>
                <span style={rowTitle}>{i.label}</span>
              </Row>
            ))}
          </Section>

          <Section title="Trending">
            {trendingItems.filter((i) => filterText(i.title)).map((i, idx, arr) => (
              <Row key={i.id} isLast={idx === arr.length - 1} onClick={() => go(`/content/${i.id}`)}>
                <span style={rowTitle}>{i.title}</span>
                <span style={rowSub}>{i.author} · {i.referenceCount} refs</span>
              </Row>
            ))}
            {trendingItems.length === 0 && <EmptyHint />}
          </Section>

          <Section title="Curator picks">
            {curatorPicks.filter((i) => filterText(i.title)).map((i, idx, arr) => (
              <Row key={i.id} isLast={idx === arr.length - 1} onClick={() => go(`/content/${i.id}`)}>
                <span style={rowTitle}>{i.title}</span>
                <span style={rowSub}>by {i.author}</span>
              </Row>
            ))}
            {curatorPicks.length === 0 && <EmptyHint />}
          </Section>

          <Section title="Collections">
            {collections.filter((i) => filterText(i.title)).map((i, idx, arr) => (
              <Row key={i.id} isLast={idx === arr.length - 1} onClick={() => go(`/collections/${i.id}`)}>
                <span style={rowTitle}>{i.title}</span>
                <span style={rowSub}>{i.itemCount} items</span>
              </Row>
            ))}
            {collections.length === 0 && <EmptyHint />}
          </Section>

          <Section title="Who to follow">
            {whoToFollow.filter((u) => filterText(u.name) || filterText(u.username)).map((u, idx, arr) => (
              <Row key={u.id} isLast={idx === arr.length - 1} onClick={() => go(`/profile/${u.username}`)}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar className="h-8 w-8">
                    {u.avatar && <AvatarImage src={u.avatar} />}
                    <AvatarFallback style={{ background: "#8B4513", color: "#fff", fontSize: 11 }}>
                      {u.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={rowTitle}>{u.name}</span>
                    <span style={rowSub}>@{u.username}</span>
                  </div>
                </div>
              </Row>
            ))}
            {whoToFollow.length === 0 && <EmptyHint />}
          </Section>

          <div style={{ height: 24 }} />
        </div>

        <style>{`
          @keyframes rr-fade { from { opacity: 0 } to { opacity: 1 } }
          @keyframes rr-slide { from { transform: translateY(100%) } to { transform: translateY(0) } }
        `}</style>
      </aside>
    </>
  );
}

const rowTitle: React.CSSProperties = {
  fontFamily: "Figtree, sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.92)",
};
const rowSub: React.CSSProperties = {
  fontFamily: "Figtree, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.50)", marginTop: 2,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <div
        style={{
          fontFamily: "Figtree, sans-serif",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "rgba(255,255,255,0.35)",
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function Row({ children, onClick, isLast }: { children: React.ReactNode; onClick: () => void; isLast: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between"
      style={{
        padding: "12px 4px",
        background: "transparent", border: "none", cursor: "pointer",
        borderBottom: isLast ? "none" : "0.5px solid rgba(255,255,255,0.06)",
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        {children}
      </div>
      <ChevronRight size={16} color="rgba(255,255,255,0.30)" />
    </button>
  );
}

function EmptyHint() {
  return (
    <div style={{ padding: "8px 4px", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
      Nothing here yet.
    </div>
  );
}
