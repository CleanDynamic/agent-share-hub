// Mobile 28 G: every empty list on a phone. Centred in the space between the content's top and the dock, padding 0 16 140: a
// 358 by 220 canvas with one drop on still water (dropField.ts), then the list's own line at 20/24 600, an optional second line
// at 15 Text 2 (at most 300 wide), and its action as a BigButton: main when it makes something ("New build", "Post here"),
// secondary otherwise. Nothing else on the screen moves. Under reduced motion the water is one still frame. The field draws
// at 30 frames a second, and stops while it is off screen or the tab is in the background.

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

import { PHONE_DOCK } from "@/components/shell/chromeSize";
import { DROP_CYCLE_S, STILL_T, drawDropField } from "@/lib/dots/dropField";
import { DotBatch, dotPalette, sizeCanvas, startLoop } from "@/lib/dots/engine";
import { PageLink } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { prefersReducedMotion } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { BigButton, BIG_BUTTON_HEIGHT } from "./BigButton";

export const PHONE_EMPTY_CANVAS = { width: 358, height: 220 } as const;
/** The space kept under the block, so it sits optically centred above the dock. */
export const PHONE_EMPTY_BOTTOM = 140;
const FRAME_S = 1 / 30;

/** The one way on: an address (drawn as a link) or a handler (a button). `main` overrides the guess from the label. */
export interface PhoneEmptyAction {
  label: string;
  href?: string;
  onClick?: () => void;
  main?: boolean;
}

export interface PhoneEmptyProps {
  /** The list's own line: "All caught up.", "No builds yet.". */
  line: string;
  /** An optional second line. */
  detail?: string;
  action?: PhoneEmptyAction | null;
  /** The line is the list's heading (the Library's "Nothing saved yet"). Absent: a paragraph. */
  headingLevel?: 2 | 3;
  /** A quiet control under the action that the list already had ("How saving works"). */
  extra?: ReactNode;
  "data-testid"?: string;
  style?: CSSProperties;
}

/** The labels that make something: their empty state's button is the main one. */
export const CREATING_ACTIONS: ReadonlySet<string> = new Set(["New build", "Post here", "New post", "Start a build"]);

/** The water: one canvas, as wide as the column allows up to 358, 220 tall. */
function DropCanvas() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext?.("2d") ?? null;
    if (!el || !ctx) return;
    const batch = new DotBatch();
    let width = 0;
    const size = () => {
      width = Math.min(PHONE_EMPTY_CANVAS.width, el.parentElement?.clientWidth ?? PHONE_EMPTY_CANVAS.width);
      return sizeCanvas(el, width, PHONE_EMPTY_CANVAS.height);
    };
    let ratio = size();
    const still = () => drawDropField(ctx, width, PHONE_EMPTY_CANVAS.height, ratio, STILL_T, dotPalette(), batch);
    const resize = new ResizeObserver(() => {
      ratio = size();
      if (prefersReducedMotion()) still();
    });
    if (el.parentElement) resize.observe(el.parentElement);
    /* The theme changes the dot colours; a still frame is drawn again for it. */
    const theme = new MutationObserver(() => (prefersReducedMotion() ? still() : undefined));
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    if (prefersReducedMotion()) {
      still();
      return () => {
        resize.disconnect();
        theme.disconnect();
      };
    }
    let visible = true;
    const seen = typeof IntersectionObserver === "function" ? new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)) : null;
    seen?.observe(el);
    let last = -1;
    const begin = performance.now() / 1000;
    const stop = startLoop((now) => {
      if (!visible || now - last < FRAME_S) return;
      last = now;
      /* Starts just before a drop falls, so the first frame already has rings on it. */
      drawDropField(ctx, width, PHONE_EMPTY_CANVAS.height, ratio, now - begin + DROP_CYCLE_S * 0.9, dotPalette(), batch);
    });
    return () => {
      stop();
      seen?.disconnect();
      resize.disconnect();
      theme.disconnect();
    };
  }, []);
  return (
    <div style={{ width: "100%", maxWidth: PHONE_EMPTY_CANVAS.width, height: PHONE_EMPTY_CANVAS.height, display: "flex", justifyContent: "center" }}>
      <canvas ref={canvas} aria-hidden="true" data-testid="phone-empty-water" width={PHONE_EMPTY_CANVAS.width} height={PHONE_EMPTY_CANVAS.height} style={{ display: "block", height: PHONE_EMPTY_CANVAS.height }} />
    </div>
  );
}

function ActionLink({ action, main }: { action: { label: string; href: string }; main: boolean }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <PageLink
      to={action.href}
      data-ui="big-button"
      data-variant={main ? "main" : "raised"}
      {...handlers}
      style={{
        boxSizing: "border-box",
        height: BIG_BUTTON_HEIGHT,
        padding: "0 24px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 24,
        fontFamily: FIGTREE,
        fontSize: 15,
        fontWeight: 600,
        lineHeight: "20px",
        textDecoration: "none",
        whiteSpace: "nowrap",
        ...(main ? { background: t.brandAccent, color: t.onBrandAccent } : { background: t.control, color: t.text }),
        ...ring(state.focusVisible),
      }}
    >
      {action.label}
    </PageLink>
  );
}

export function PhoneEmpty({ line, detail, action, headingLevel, extra, style, ...rest }: PhoneEmptyProps) {
  const Line: ElementType = headingLevel ? `h${headingLevel}` : "p";
  const box = useRef<HTMLDivElement>(null);
  /* The block centres itself in what is left between where it starts and the dock. */
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const top = box.current?.getBoundingClientRect().top ?? 0;
      const room = Math.round(window.innerHeight - Math.max(0, top) - PHONE_DOCK);
      setHeight(room > 0 ? room : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const main = action ? (action.main ?? CREATING_ACTIONS.has(action.label)) : false;
  return (
    <div
      ref={box}
      data-ui="phone-empty"
      data-testid={rest["data-testid"]}
      style={{
        boxSizing: "border-box",
        minHeight: height ?? undefined,
        padding: `0 16px ${PHONE_EMPTY_BOTTOM}px`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        fontFamily: FIGTREE,
        ...style,
      }}
    >
      <DropCanvas />
      <Line style={{ margin: "8px 0 0", fontSize: 20, lineHeight: "24px", fontWeight: 600, letterSpacing: "-0.01em", color: t.text }}>{line}</Line>
      {detail ? <p style={{ margin: "8px 0 0", maxWidth: 300, fontSize: 15, lineHeight: "20px", color: t.text2 }}>{detail}</p> : null}
      {action ? (
        <div style={{ marginTop: 20 }}>
          {action.href ? (
            <ActionLink action={{ label: action.label, href: action.href }} main={main} />
          ) : (
            <BigButton main={main} onClick={() => action.onClick?.()}>
              {action.label}
            </BigButton>
          )}
        </div>
      ) : null}
      {extra ? <div style={{ marginTop: 8 }}>{extra}</div> : null}
    </div>
  );
}

export default PhoneEmpty;
