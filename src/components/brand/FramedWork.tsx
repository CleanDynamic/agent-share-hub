// The framed work, the picture light and the result window (UI-P86, refined look).
//
// FRAMED WORK. A picture is hung in a raised frame: radius 4, padding 4 (3 under 40px high), the picture inside on
// `--paper` at radius 2. The frame is an object, not a surface, so its paint is ARTWORK: the constants below, one set
// per room, are the "artwork constants" RULES §2 allows, written here rather than as tokens. Dusk's frame is shaded
// (the one gradient a raised object may carry in Dusk); Noon's is flat white.
//
// LIT. `lit` hangs the lamp: a bar centred 8px above the frame, `max(12, width/4)` wide, and a wash over the top 60% of
// the picture, amber to nothing. The lamp is data (RULES §5): the caller passes what `plaqueState()` or the visit
// record says, never a constant. A lit frame never takes an amber edge.
//
// PICTURE LIGHT. Over a hero picture: the 40×3 lamp bar and a cone below it, clipped to a trapezoid, amber to nothing.
//
// RESULT WINDOW. The build hero's picture: a 304×176 window raised as the frame is, with a 20px chrome row of three
// 4px dots, and the picture inset on `--paper`.

import type { CSSProperties, ReactNode } from "react";

import { useResolvedTheme } from "@/contexts/ThemeContext";
import { t } from "@/lib/theme/tokens";

import { LampBar } from "./LampDot";

type Room = "dusk" | "noon";

/** The raised frame, per room. Artwork constants (RULES §2). */
export const FRAME_ARTWORK: Record<Room, CSSProperties> = {
  dusk: {
    background: "linear-gradient(#2A2A2E, #1F1F22)",
    border: "1px solid #333338",
    borderTopColor: "#3C3C42",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.04), 0 1px 1px rgba(0,0,0,.55), 0 6px 12px -4px rgba(0,0,0,.45)",
  },
  noon: {
    background: "#FFFFFF",
    border: "1px solid #D9D9D9",
    boxShadow: "0 1px 1px rgba(20,20,18,.06), 0 6px 12px -6px rgba(20,20,18,.18)",
  },
};

/** The result window's deeper drop: it hangs alone on the hero wall. Artwork constants, from `build-list.html`. */
export const WINDOW_SHADOW: Record<Room, string> = {
  dusk: "inset 0 1px 0 rgba(255,255,255,.04), 0 1px 1px rgba(0,0,0,.55), 0 16px 32px -12px rgba(0,0,0,.7)",
  noon: "0 1px 2px rgba(20,20,18,.06), 0 16px 32px -14px rgba(20,20,18,.22)",
};

/** The chrome row's dots. */
const WINDOW_DOT: Record<Room, string> = { dusk: "rgba(255,255,255,.16)", noon: "rgba(20,20,18,.14)" };

/** The wash a lit frame throws over its picture. */
export const FRAME_WASH: Record<Room, string> = {
  dusk: "linear-gradient(rgba(245,203,76,.10), rgba(245,203,76,0))",
  noon: "linear-gradient(rgba(245,203,76,.14), rgba(245,203,76,0))",
};

/** The cone of a picture light. */
export const PICTURE_LIGHT_CONE: Record<Room, string> = {
  dusk: "linear-gradient(rgba(245,203,76,.10), rgba(245,203,76,0))",
  noon: "linear-gradient(rgba(245,203,76,.18), rgba(245,203,76,0))",
};

const CONE_CLIP = "polygon(44.8% 0, 55.2% 0, 100% 100%, 0 100%)";

export interface FramedWorkProps {
  /** Lamp on: from data only. */
  lit?: boolean;
  /** Lit but gone stale: the lamp takes the dim filter. */
  dim?: boolean;
  /** The frame's width, when fixed. Absent, it fills its box. */
  width?: number | string;
  /** The frame's height. Under 40px the frame's padding is 3. */
  height?: number | string;
  /** The picture: an `<img>` filling its box, or a `CoverFallback`. */
  children: ReactNode;
  style?: CSSProperties;
}

export function FramedWork({ lit = false, dim = false, width, height, children, style }: FramedWorkProps) {
  const room = useResolvedTheme();
  const small = typeof height === "number" && height < 40;
  return (
    <span
      data-ui="framed-work"
      data-room={room}
      data-lit={lit ? "" : undefined}
      style={{
        position: "relative",
        display: "block",
        width,
        height,
        boxSizing: "border-box",
        borderRadius: 4,
        padding: small ? 3 : 4,
        ...FRAME_ARTWORK[room],
        ...style,
      }}
    >
      {lit ? (
        <LampBar
          dim={dim}
          style={{ position: "absolute", left: "50%", top: -8, width: "max(12px, 25%)", transform: "translateX(-50%)" }}
        />
      ) : null}
      <span
        style={{
          position: "relative",
          display: "block",
          height: "100%",
          borderRadius: 2,
          background: t.paper,
          overflow: "hidden",
        }}
      >
        {children}
        {lit ? (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: "60%",
              background: FRAME_WASH[room],
              filter: dim ? t.dimFilter : undefined,
              pointerEvents: "none",
            }}
          />
        ) : null}
      </span>
    </span>
  );
}

export interface PictureLightProps {
  /** Dimmed when the claim has gone stale. */
  dim?: boolean;
  /** The bar's top, from the top of the positioned box the light hangs in. */
  top?: number;
  /** The cone's size: the board's 384×240. */
  coneWidth?: number;
  coneHeight?: number;
}

/** The light over a hero picture: the 40×3 bar and the cone below it. Absolutely placed in a positioned box. */
export function PictureLight({ dim = false, top = 24, coneWidth = 384, coneHeight = 240 }: PictureLightProps) {
  const room = useResolvedTheme();
  return (
    <span
      data-ui="picture-light"
      data-variant={dim ? "dim" : "on"}
      aria-hidden="true"
    >
      {/* The filter goes on each piece: on the wrapper it would become the containing block and move them. */}
      <LampBar dim={dim} style={{ position: "absolute", left: "calc(50% - 20px)", top }} width={40} />
      <span
        style={{
          position: "absolute",
          left: `calc(50% - ${coneWidth / 2}px)`,
          top: top + 3,
          width: coneWidth,
          height: coneHeight,
          clipPath: CONE_CLIP,
          background: PICTURE_LIGHT_CONE[room],
          filter: dim ? t.dimFilter : undefined,
          pointerEvents: "none",
        }}
      />
    </span>
  );
}

export interface ResultWindowProps {
  /** The window's accessible name: "Bakery homepage · Result". */
  label: string;
  /** The picture: the build's result, or a `CoverFallback`. */
  children: ReactNode;
  width?: number;
  height?: number;
  style?: CSSProperties;
}

/** The build hero's result window: raised as a frame is, a 20px chrome row, the picture inset on `--paper`. */
export function ResultWindow({ label, children, width = 304, height = 176, style }: ResultWindowProps) {
  const room = useResolvedTheme();
  return (
    <div
      role="img"
      aria-label={label}
      data-ui="result-window"
      data-room={room}
      style={{
        position: "relative",
        width,
        height,
        boxSizing: "border-box",
        borderRadius: 6,
        ...FRAME_ARTWORK[room],
        boxShadow: WINDOW_SHADOW[room],
        overflow: "hidden",
        ...style,
      }}
    >
      <div aria-hidden="true" style={{ height: 20, display: "flex", gap: 4, alignItems: "center", padding: "0 8px" }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: WINDOW_DOT[room] }} />
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: 6,
          right: 6,
          top: 22,
          bottom: 6,
          borderRadius: 3,
          background: t.paper,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default FramedWork;
