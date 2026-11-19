/* The tutorial's drawing kit: the editor in miniature, piece by piece.

   EACH CHAPTER'S STAGE IS DRAWN, NOT RECORDED. A stage is 592 by 248, built from the site's own tokens, so it is right in both
   themes, weighs almost nothing and never shows a screen that has since changed shape. It scales down as one piece where the
   window is narrower (a phone's sheet). The chapters themselves are in tutorialTasks.tsx; this file holds what they share:
   placing a piece, a step tile, a session's head, a small button, and the one helper every move in the tutorial goes through.

   ONLY OPACITY AND TRANSFORM EVER MOVE, through `play`, which does nothing under reduced motion or where the browser cannot
   animate: the stage is then simply as it should be. */

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { STANDARD, prefersReducedMotion } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";

import { tagStyle, text, tnum } from "./refinedStyles";

export const STAGE = { width: 592, height: 248 } as const;

/** Where a piece stands on the stage. */
export const at = (left: number, top: number, width?: number, height?: number): CSSProperties => ({ position: "absolute", left, top, width, height, boxSizing: "border-box" });

export const words = (px: 11 | 12 | 13 | 14 | 16, weight: 400 | 500, color: string): CSSProperties => ({ ...text(px, weight, color), whiteSpace: "nowrap" });

export const MODULE: CSSProperties = { background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: 8, boxShadow: t.moduleShadow };
export const WINDOW: CSSProperties = { background: t.window, border: `1px solid ${t.windowBorder}`, borderRadius: 8, boxShadow: t.windowShadow };
export const ROW: CSSProperties = { display: "flex", alignItems: "center", gap: 8 };

/** A step's number, in its box: "4", or "6.1" for a step inside an agent. */
export function StepNumber({ now }: { now: string | number }) {
  return (
    <span style={{ minWidth: 20, height: 20, padding: "0 4px", flexShrink: 0, boxSizing: "border-box", borderRadius: 4, background: t.inset, border: `1px solid ${t.tileBorder}`, display: "inline-flex", alignItems: "center", justifyContent: "center", ...words(11, 500, t.text2), ...tnum }}>
      {now}
    </span>
  );
}

/** One step tile: its number, its kind, and its name or a bar for its words. */
export function StepTile({ number, kind, name, bar = 180, end }: { number: string | number; kind: string; name?: string; bar?: number; end?: ReactNode }) {
  return (
    <div style={{ ...MODULE, ...ROW, width: "100%", height: "100%", boxSizing: "border-box", padding: "0 12px" }}>
      <StepNumber now={number} />
      <span style={words(11, 400, t.label)}>{kind}</span>
      {name ? <span style={words(12, 500, t.text)}>{name}</span> : <span style={{ width: bar, height: 6, borderRadius: 2, background: t.line }} />}
      {end ? <span style={{ marginLeft: "auto", display: "inline-flex" }}>{end}</span> : null}
    </div>
  );
}

/** A session's head: its number and the app it was made in. */
export function SessionHead({ number = 1, app = "Claude", style }: { number?: number; app?: string; style?: CSSProperties }) {
  return (
    <div style={{ ...ROW, ...style }}>
      <Glyph name="layers" size={16} color={t.text2} />
      <span style={words(13, 500, t.text)}>{`Session ${number}`}</span>
      <span style={tagStyle}>{app}</span>
    </div>
  );
}

/** A small button, as the title row and a window's footer draw them. */
export function MiniButton({ children, primary = false, quiet = false, style }: { children: ReactNode; primary?: boolean; quiet?: boolean; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 24,
        padding: "0 8px",
        boxSizing: "border-box",
        borderRadius: 6,
        ...(primary ? { background: t.action, border: `1px solid ${t.action}`, boxShadow: t.actionShadow } : { background: t.control, border: `1px solid ${t.controlBorder}` }),
        ...words(11, 500, primary ? t.onAction : quiet ? t.textDisabled : t.text),
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** One short move on one piece (something arriving, a wrong press shaking the stage). Nothing under reduced motion. */
export function play(el: HTMLElement | null, frames: Keyframe[], options: KeyframeAnimationOptions): Animation | null {
  if (!el || prefersReducedMotion() || typeof el.animate !== "function") return null;
  return el.animate(frames, { easing: STANDARD, ...options });
}

/** The stage's width where it stands, so the stage can be scaled to it as one piece. */
export function useFit(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const width = el.clientWidth;
      if (width > 0) setScale(Math.min(1, width / STAGE.width));
    };
    fit();
    if (typeof ResizeObserver !== "function") return;
    const watch = new ResizeObserver(fit);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  return [ref, scale];
}

export const stageStyle = (scale: number): CSSProperties => ({
  position: "relative",
  display: "block",
  width: "100%",
  height: Math.round(STAGE.height * scale),
  padding: 0,
  overflow: "hidden",
  boxSizing: "border-box",
  borderRadius: 8,
  background: t.well,
  border: `1px solid ${t.wellBorder}`,
  boxShadow: t.wellShadow,
  textAlign: "left",
});
