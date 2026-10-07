// The avatar (UI-P07): a circle, a person.
//
// A profile image fills the circle when there is one; otherwise it is initials
// on one of six hues, picked by a stable hash of the user id so a person keeps
// their colour on every surface. The hues are artwork — identical in both
// themes, like the cover skies — so they are named constants here and not
// tokens. The initials are Figtree 600 at `trunc(size × .38)`px in near-white.
// The circle is one of the places `--r-full` is for.
//
// `size` is the reference's drawn size (22, 28, 34, 78…), and since UI-P54 the
// circle renders it through the density table (22 → 18, 34 → 28; 78 is over the
// table's band and stays), with the initials at their drawn size through the
// table too. The 22px avatar's 8px initials become 10, the floor the rest of
// the system keeps.

import type { CSSProperties } from "react";

import { denseFont, denseHeight } from "@/lib/theme/density";
import { r } from "@/lib/theme/radius";
import { FIGTREE } from "@/lib/theme/type";

import { hashSeed } from "./hash";

/** The six hues, the same in both themes. */
export const AVATAR_HUES = ["#5C5480", "#3F7A8C", "#9A5B4A", "#4B3F8C", "#3E6B55", "#8C4A6A"] as const;

/** The initials' ink, on every hue. */
const AVATAR_INK = "#F7F8F9";

export interface AvatarProps {
  /** Diameter in px, 18 to 110. */
  size: number;
  /** Stable: the user id. Chooses the hue. */
  userId: string;
  /** Used for the initials and, when there is no image, the accessible name. */
  name: string;
  /** Force a hue, 0 to 5. The dev fixtures pass `avatar_hue`. */
  hue?: number;
  /** A profile image. It replaces the initials and fills the circle. */
  src?: string | null;
  style?: CSSProperties;
}

/** Up to two initials: the first letters of the first and last words. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = Array.from(words[0])[0] ?? "";
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? "") : (Array.from(words[0])[1] ?? "");
  return (first + last).toUpperCase();
}

export function avatarHue(userId: string, hue?: number): string {
  if (hue !== undefined && Number.isInteger(hue) && hue >= 0 && hue < AVATAR_HUES.length) {
    return AVATAR_HUES[hue];
  }
  return AVATAR_HUES[hashSeed(userId) % AVATAR_HUES.length];
}

export function Avatar({ size, userId, name, hue, src, style }: AvatarProps) {
  const box = denseHeight(size);
  const circle: CSSProperties = {
    width: box,
    height: box,
    borderRadius: r.full,
    flexShrink: 0,
    ...style,
  };

  if (src) {
    return (
      <img
        data-ui="avatar"
        src={src}
        alt={name}
        width={box}
        height={box}
        style={{ ...circle, display: "block", objectFit: "cover" }}
      />
    );
  }

  return (
    <span
      data-ui="avatar"
      role="img"
      aria-label={name}
      style={{
        ...circle,
        background: avatarHue(userId, hue),
        color: AVATAR_INK,
        fontFamily: FIGTREE,
        fontSize: denseFont(Math.trunc(size * 0.38)),
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span aria-hidden="true">{initialsOf(name)}</span>
    </span>
  );
}

export default Avatar;
