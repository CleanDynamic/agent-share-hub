// The right rail, on a phone and a tablet.
//
// THE SAME CONTENT AS THE DESKTOP RAIL, IN A SHEET. Below 1024 the frame drops
// `.fs-right` and this is where trending, curator picks, collections and who to
// follow go; `useRightRailData` is the one data layer both surfaces read, so the
// two cannot disagree about what the rail contains.
//
// BG-P18 REPAINTED IT, AND IT WAS THE LAST SURFACE ON THE HOME ROUTE STILL
// PAINTED FOR A DARK PAGE. `RightRailExplore`, its desktop twin, went onto the
// tokens at BG-P13 — rows at `--r-control`, mono section labels in `--text2`,
// the BG-P07 field — and this one kept #0F0F14, seven alphas of white and a
// 24px capsule search box. On Exhibition that is a black sheet sliding up over
// a light gallery, which is the one thing the theme says never to do.
//
// Everything below is the kit's own: `sheetPanelStyle("bottom")` for the panel,
// `scrimStyle` for what it dims, `fieldStyle` for the search, and rows at
// `--r-control` with the same `--bg` press the desktop rail's rows take. No
// measurement moved: the 85vh height, the 20px gutters, the row padding and the
// drag gesture are exactly what they were.
//
// Styled with inline style objects, like every other surface on the new path:
// Tailwind's generated utilities win over hand-written classes at build time.
// The two keyframes this needs live in `index.css`, which is where the theme
// puts the one thing an inline style cannot express.

import { useEffect, useRef, useState } from "react";
import { X, Search, ChevronRight } from "lucide-react";
import { useRightRailData } from "@/hooks/useRightRailData";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  FOCUS_RING_CLASS,
  fieldStyle,
  prefersReducedMotion,
  scrimStyle,
  sheetPanelStyle,
  uiTransition,
} from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { useInteractive } from "@/lib/theme/interactive";
import {
  body as bodyText,
  data as dataText,
  eyebrow as eyebrowText,
  label as labelText,
  type as typeRoles,
} from "@/lib/theme/type";

export interface RightRailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

export function RightRailDrawer({ isOpen, onClose, onNavigate }: RightRailDrawerProps) {
  const [query, setQuery] = useState("");
  const [translateY, setTranslateY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
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

  const still = prefersReducedMotion();

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
          position: "fixed", inset: 0, zIndex: 1100,
          // The kit's scrim, struck from `--porthole` so the page dims into its
          // own room rather than under a sheet of ink. It carried 55% black,
          // which on Exhibition is a black wash over a luminous grey gallery.
          ...scrimStyle,
          animation: still ? undefined : "rrFade 200ms ease-out",
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
          zIndex: 1101,
          display: "flex", flexDirection: "column",
          // BG-P07's bottom sheet: `--glass` with the system's one blur, the
          // `overlay` elevation, and the radius on the two corners that are
          // actually on screen. A sheet is a reading surface, which the theme
          // says gets glass; the never-blur rule is about the frame's permanent
          // full-height rails, not about a panel a reader opened.
          ...sheetPanelStyle("bottom"),
          borderTopWidth: 1,
          borderTopStyle: "solid",
          transform: `translateY(${translateY}px)`,
          transition: dragging || still ? "none" : "transform 220ms ease-out",
          animation: dragging || still ? "none" : "rrSlide 280ms ease-out",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 6px" }}>
          <div style={{ width: 40, height: 4, borderRadius: r.chip, background: t.line }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px 12px" }}>
          <h2 style={{ margin: 0, ...typeRoles.cardTitle, color: t.text }}>Explore</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={FOCUS_RING_CLASS}
            style={{
              width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
              background: "transparent", border: "none", color: t.text2, cursor: "pointer",
              borderRadius: r.control,
              transition: uiTransition(),
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scroll */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 24px" }}>
          {/* Search. The WRAPPER is the field — it carries the ground, the
              border and the radius, with the icon inside it — so the ring goes
              here rather than on the transparent input, exactly as the desktop
              rail does it. */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", marginBottom: 18,
              ...fieldStyle({ focusVisible: searchFocused }),
              color: t.text2,
            }}
          >
            <Search size={16} color="var(--text2)" />
            <input
              /* THE WRAPPER ABOVE IS THE FIELD; this is a bare text run inside
                 it. BG-P07's global `input` rule in `index.css` paints every
                 raw input with `--recess`, a border and a radius, and does it
                 with `!important` — so without these the inner input draws a
                 second bordered well inside the first, and the global
                 focus-visible rule draws a second ring inside the wrapper's.
                 Tailwind's own `!` utilities are what can outrank an
                 `!important` element rule; an inline style cannot. The desktop
                 rail solves the same collision the same way, in the three
                 `!important` declarations in `right-rail-explore.css`. */
              className="!bg-transparent !border-none !outline-none focus-visible:!outline-none"
              value={query}
              onFocus={(e) => setSearchFocused(e.currentTarget.matches(":focus-visible"))}
              onBlur={() => setSearchFocused(false)}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search across buildgallery"
              /* The placeholder's own colour needs `::placeholder`, which an
                 inline style cannot reach and which no rule in `index.css`
                 covers. It inherits `--text2` from the wrapper instead: the
                 input sets no colour of its own until there is a value, and a
                 browser's default placeholder is this text at reduced alpha,
                 which is the right relationship either way. */
              style={{
                flex: 1, background: "transparent", border: "none",
                ...bodyText, fontSize: 13, color: t.text,
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
                    <AvatarFallback style={{ background: t.action, color: t.onAction, fontSize: 11 }}>
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
      </aside>
    </>
  );
}

const rowTitle: React.CSSProperties = { ...labelText, color: t.text };

/** The second line of a row: an author, a count, a handle. Data, so mono. */
const rowSub: React.CSSProperties = { ...dataText, fontSize: 11, color: t.text2, marginTop: 2 };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 20 }}>
      {/* The mono eyebrow the desktop rail's headings wear, so the two surfaces
          label their sections the same way. It was 10px Figtree at weight 700
          with 0.12em of tracking, which is a fourth type treatment for a job
          the scale already has a role for. */}
      <div style={{ ...eyebrowText, color: t.text2, marginBottom: 10 }}>{title}</div>
      {children}
    </section>
  );
}

/**
 * One row of the rail.
 *
 * `--r-control` IS THE SHAPE OF A LIST ROW in this system, and the row takes a
 * `--bg` fill when it is pressed or hovered — the same pair the desktop rail's
 * trending, curator and collection rows take, and for the reason stated there:
 * `--recess` is a rail's own ground, and `--bg` is the one step from it that
 * moves the right way in both themes, so every label on a touched row gains
 * contrast rather than losing it.
 *
 * The hairline between rows stays. It is what groups five rows into a list
 * while they are at rest, and on a touch surface "at rest" is nearly all of the
 * time — a radius that only appears under a finger cannot do that job alone.
 */
function Row({ children, onClick, isLast }: { children: React.ReactNode; onClick: () => void; isLast: boolean }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({});
  const lit = state.hovered || state.pressed;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between ${FOCUS_RING_CLASS}`}
      style={{
        padding: "12px 4px",
        background: lit ? t.bg : "transparent",
        border: "none",
        borderRadius: r.control,
        borderBottom: isLast ? "none" : `1px solid ${t.line}`,
        cursor: "pointer",
        textAlign: "left",
        transition: uiTransition(),
      }}
      {...handlers}
    >
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        {children}
      </div>
      <ChevronRight size={16} color="var(--text2)" />
    </button>
  );
}

function EmptyHint() {
  return (
    <div style={{ padding: "8px 4px", ...bodyText, fontSize: 12, color: t.text2 }}>
      Nothing here yet.
    </div>
  );
}
