// RefLinks: how a link to a part looks, and the card that opens over it (CA-06 P3).
//
// A LINK IS A HIGHLIGHT, NEVER AN UNDERLINE: the words on a fill (radius 4, padding 1px 4px, cloned across a line
// break), then the part's number in the data face. A coloured part fills it with its colour at the alpha
// `highlightFor` measured; any other with `--row-highlight`. Hover and focus are one step stronger, and keyboard
// focus is ringed. A part that is no longer in the build leaves plain words in `--text2`, not focusable.
//
// The reader's links are React (`RefLink`, drawn by PostBody inside a `PostRefsProvider`); the editor's are
// ProseMirror's, painted by `paintRef` with the same numbers. Without a provider (the Gallery) PostBody draws the
// words plain: nothing there to go to.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/brand/Button";
import type { RefEntry } from "@/lib/build/postRefs";
import { useResolvedTheme } from "@/contexts/ThemeContext";
import { focusRing } from "@/lib/theme/focus";
import { highlightFor } from "@/lib/theme/partColour";
import type { ThemeKey } from "@/lib/theme/resolve";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";
import { TextButton } from "@/pages/site/compose/composeControls";
import { EYEBROW, moduleStyle, text } from "@/pages/site/compose/refinedStyles";

export const REF_COPY = {
  gone: "This part is no longer in the build",
  goTo: "Go to it",
  change: "Change",
  remove: "Remove the link",
  fromPost: "Opened from the post",
  backToPost: "Back to the post",
  mentioned: "Mentioned in the post",
} as const;

/** How long a pointer rests on a link before its card opens. */
export const CARD_DELAY_MS = 350;
/** How long a part, or the words, stay outlined after a link or Back to the post brings them in. */
export const OUTLINE_MS = 1600;

/** What a link is painted with. */
export interface RefPaint {
  fill: string;
  hover: string;
  /** "3", "S2"; empty when the part is gone. */
  number: string;
  gone: boolean;
}

/** A link's paint: its part's colour, the plain fill, or none when the part is gone. */
export function refPaint(entry: Pick<RefEntry, "colour" | "number"> | undefined, theme: ThemeKey): RefPaint {
  if (!entry) return { fill: "transparent", hover: "transparent", number: "", gone: true };
  if (entry.colour) {
    const { fill, hover } = highlightFor(entry.colour, theme);
    return { fill, hover, number: entry.number, gone: false };
  }
  return { fill: t.rowHighlight, hover: t.tagFill, number: entry.number, gone: false };
}

/** The words' style. */
export function refWordsStyle(paint: RefPaint, strong = false): CSSProperties {
  if (paint.gone) return { color: t.text2 };
  return {
    background: strong ? paint.hover : paint.fill,
    borderRadius: 4,
    padding: "1px 4px",
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
    color: "inherit",
    cursor: "pointer",
  };
}

/** The number after the words: 10.5 in the data face, `--label`, 4px off. */
export const refNumberStyle: CSSProperties = {
  fontFamily: DM_MONO,
  fontSize: 10.5,
  fontWeight: 400,
  lineHeight: "normal",
  color: t.label,
  marginLeft: 4,
  fontVariantNumeric: "tabular-nums",
  userSelect: "none",
};

/** The outline an element had before a flash, and the flash's timer, while one is on. */
const flashing = new WeakMap<HTMLElement, { before: { width: string; style: string; colour: string; offset: string }; timer: number }>();

/** The ring, put on an element the page did not draw (the editor's words, a tile found by its link) for a moment. */
export function flashOutline(el: HTMLElement, ms = OUTLINE_MS): void {
  const running = flashing.get(el);
  if (running) window.clearTimeout(running.timer);
  const before = running?.before ?? { width: el.style.outlineWidth, style: el.style.outlineStyle, colour: el.style.outlineColor, offset: el.style.outlineOffset };
  el.style.outlineWidth = `${focusRing.outlineWidth}px`;
  el.style.outlineStyle = focusRing.outlineStyle;
  el.style.outlineColor = focusRing.outlineColor;
  el.style.outlineOffset = `${focusRing.outlineOffset}px`;
  el.setAttribute("data-outlined", "true");
  const timer = window.setTimeout(() => {
    flashing.delete(el);
    el.style.outlineWidth = before.width;
    el.style.outlineStyle = before.style;
    el.style.outlineColor = before.colour;
    el.style.outlineOffset = before.offset;
    el.removeAttribute("data-outlined");
  }, ms);
  flashing.set(el, { before, timer });
}

/** Whether an element's focus came from the keyboard. jsdom does not know the selector; there it counts as yes. */
export function focusVisible(el: Element): boolean {
  try {
    return el.matches(":focus-visible");
  } catch {
    return true;
  }
}

/* ── the provider ── */

export interface PostRefsValue {
  lookup: ReadonlyMap<string, RefEntry>;
  /** The link was clicked, or Go to it pressed: bring the part in. `el` is the words, for Back to the post. */
  onGo: (to: string, el: HTMLElement) => void;
  /** The maker's card: Change opens the picker on the link, Remove the link takes it off. Absent for readers. */
  maker?: { onChange: (to: string, el: HTMLElement) => void; onRemove: (to: string, el: HTMLElement) => void };
}

const PostRefsContext = createContext<(PostRefsValue & { card: CardControl; theme: ThemeKey }) | null>(null);

/** Whether this pointer can hover: the card is for those only. */
function canHover(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(hover: hover)").matches;
}

export interface CardControl {
  /** The pointer came onto a link. */
  enter: (to: string, el: HTMLElement) => void;
  /** The pointer left the link or the card. */
  leave: () => void;
  close: () => void;
}

/** The card's state: who it is for and where, opened 350ms after the pointer rests, kept while it is over the card. */
export function useRefCard(): { open: { to: string; el: HTMLElement } | null; control: CardControl; keep: () => void } {
  const [open, setOpen] = useState<{ to: string; el: HTMLElement } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const clear = () => window.clearTimeout(timer.current);
  useEffect(() => clear, []);
  const control = useMemo<CardControl>(
    () => ({
      enter: (to, el) => {
        if (!canHover()) return;
        clear();
        timer.current = window.setTimeout(() => setOpen({ to, el }), CARD_DELAY_MS);
      },
      leave: () => {
        clear();
        timer.current = window.setTimeout(() => setOpen(null), 150);
      },
      close: () => {
        clear();
        setOpen(null);
      },
    }),
    [],
  );
  return { open, control, keep: clear };
}

/** The hover card: the part's eyebrow, title and text, Go to it, and for the maker Change and Remove the link. */
export function RefCard({
  entry,
  anchor,
  onGo,
  onChange,
  onRemove,
  onEnter,
  onLeave,
}: {
  entry: RefEntry;
  anchor: HTMLElement;
  onGo: () => void;
  onChange?: () => void;
  onRemove?: () => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const rect = anchor.getBoundingClientRect();
  const width = 280;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  return createPortal(
    <div
      role="dialog"
      aria-label={entry.heading}
      data-testid="ref-card"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        ...moduleStyle(false, 12),
        position: "fixed",
        zIndex: 55,
        top: rect.bottom + 4,
        left,
        width,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        background: t.window,
        borderColor: t.windowBorder,
        boxShadow: t.windowShadow,
      }}
    >
      <span style={EYEBROW}>{entry.eyebrow}</span>
      <span style={{ ...text(13.5, 500, t.text), overflowWrap: "anywhere" }}>{entry.heading}</span>
      {entry.body ? (
        <p style={{ ...text(12.5, 400, t.text2), lineHeight: "18px", margin: 0, whiteSpace: "pre-line", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{entry.body}</p>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4 }}>
        <Button variant="secondary" size={28} fontSize={12} onClick={onGo}>
          {REF_COPY.goTo}
        </Button>
        <span style={{ flexGrow: 1 }} />
        {onChange ? (
          <TextButton style={text(12, 500, t.text2)} onClick={onChange}>
            {REF_COPY.change}
          </TextButton>
        ) : null}
        {onRemove ? (
          <TextButton style={text(12, 500, t.text2)} onClick={onRemove}>
            {REF_COPY.remove}
          </TextButton>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/** Gives PostBody its links, and draws the one card. */
export function PostRefsProvider({ value, children }: { value: PostRefsValue; children: ReactNode }) {
  const theme = useResolvedTheme();
  const { open, control, keep } = useRefCard();
  const entry = open ? value.lookup.get(open.to) : undefined;
  const context = useMemo(() => ({ ...value, card: control, theme }), [value, control, theme]);
  const go = useCallback(() => {
    if (!open) return;
    control.close();
    value.onGo(open.to, open.el);
  }, [open, control, value]);
  return (
    <PostRefsContext.Provider value={context}>
      {children}
      {open && entry ? (
        <RefCard
          entry={entry}
          anchor={open.el}
          onGo={go}
          onChange={value.maker ? () => (control.close(), value.maker?.onChange(open.to, open.el)) : undefined}
          onRemove={value.maker ? () => (control.close(), value.maker?.onRemove(open.to, open.el)) : undefined}
          onEnter={keep}
          onLeave={control.leave}
        />
      ) : null}
    </PostRefsContext.Provider>
  );
}

/** PostBody's link: the words and the number, or plain words without a provider. */
export function RefLink({ to, children }: { to: string; children: ReactNode }) {
  const context = useContext(PostRefsContext);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const self = useRef<HTMLSpanElement>(null);
  if (!context) return <>{children}</>;
  const entry = context.lookup.get(to);
  const paint = refPaint(entry, context.theme);
  if (paint.gone) {
    return (
      <span data-ref={to} data-ref-gone="" title={REF_COPY.gone} style={refWordsStyle(paint)}>
        {children}
      </span>
    );
  }
  const go = () => {
    if (self.current) {
      context.card.close();
      context.onGo(to, self.current);
    }
  };
  return (
    <span
      ref={self}
      role="link"
      tabIndex={0}
      data-ref={to}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        go();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          go();
        }
      }}
      onMouseEnter={(event) => {
        setHover(true);
        context.card.enter(to, event.currentTarget);
      }}
      onMouseLeave={() => {
        setHover(false);
        context.card.leave();
      }}
      onFocus={(event) => setFocus(focusVisible(event.currentTarget))}
      onBlur={() => setFocus(false)}
      style={{ cursor: "pointer", borderRadius: 4, ...(focus ? { ...focusRing } : null) }}
    >
      {/* The words on the fill, then the number after it, on the page: as the editor draws them. */}
      <span data-ref-words="" style={refWordsStyle(paint, hover || focus)}>
        {children}
      </span>
      <span aria-hidden="true" data-ref-number="" style={refNumberStyle}>
        {paint.number}
      </span>
    </span>
  );
}
