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

import { cropInCell } from "@/components/post/media/cropStyle";
import { cropFromUrl } from "@/lib/profile/avatarCrop";
import { avatarInk, avatarTints, t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

/* Synth 06: a rounded square, size / radius 96/20, 56/12, 40/9, 32/7, 24/6; the radius follows the size at about .22. Initials in mono 13. */
const AVATAR_RADIUS: Record<number, number> = { 96: 20, 56: 12, 40: 9, 32: 7, 24: 6 };
const avatarRadius = (size: number): number => AVATAR_RADIUS[size] ?? Math.round(size * 0.22);

import { hashSeed } from "./hash";

/* 29d, phone only: the radius and the initials' size by drawn size (32 in the bar, 40 in rows, 48 in feeds). */
const PHONE_RADIUS: Record<number, number> = { 32: 8, 40: 9, 48: 11 };
const PHONE_INITIALS: Record<number, number> = { 32: 12, 40: 13, 48: 15 };

/** The tint a phone avatar without a picture sits on: one of six, by a stable hash of the user id. */
export function avatarTint(userId: string): string {
  return avatarTints[hashSeed(userId) % avatarTints.length];
}

/** The six hues, the same in both themes. */
export const AVATAR_HUES = ["#5C5480", "#3F7A8C", "#9A5B4A", "#4B3F8C", "#3E6B55", "#8C4A6A"] as const;

export interface AvatarProps {
  /** Diameter in px, 18 to 110. */
  size: number;
  /** Stable: the user id. Chooses the hue. */
  userId: string;
  /** Used for the initials and, when there is no image, the accessible name. */
  name: string;
  /** Force a hue, 0 to 5. The dev fixtures pass `avatar_hue`. */
  hue?: number;
  /**
   * A profile image. It replaces the initials and fills the circle. UX-10 P3: a URL that carries a crop (`#crop=x,y,w,h`, as
   * saveProfileImage writes it) shows that crop, on every surface; without one the picture fills the circle centred, as before.
   */
  src?: string | null;
  /** UX-10 P3: the picture's ALT (`avatar_alt`); "" where the name sits beside it. Absent: the name, as before. */
  alt?: string;
  /** 29d: the phone's look. Without a picture, mono initials at 62% white on one of six tints (`avatarTints`). Desktop leaves it off. */
  phone?: boolean;
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

export function Avatar({ size, userId, name, src, alt, phone = false, style }: AvatarProps) {
  /* UI-P87: the refined look draws the size it is given (the header's 26); the density table is the current look's. */
  const box = size;
  const circle: CSSProperties = {
    width: box,
    height: box,
    borderRadius: phone ? (PHONE_RADIUS[size] ?? avatarRadius(size)) : avatarRadius(size),
    flexShrink: 0,
    ...style,
  };

  const crop = cropFromUrl(src);
  if (src && crop) {
    return (
      <span data-ui="avatar" data-cropped="" style={{ ...circle, position: "relative", display: "block", overflow: "hidden" }}>
        <img src={src} alt={alt ?? name} width={box} height={box} style={cropInCell(crop, 1)} />
      </span>
    );
  }

  if (src) {
    return (
      <img
        data-ui="avatar"
        src={src}
        alt={alt ?? name}
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
        /* UI-P84: initials on `--avatar-fill` in `--on-avatar`, Geist 500 at size × .38 (10 at the least). */
        boxSizing: "border-box",
        ...(phone
          ? { background: avatarTint(userId), color: avatarInk, fontFamily: DM_MONO, fontSize: PHONE_INITIALS[size] ?? 13, fontWeight: 600 }
          : {
              background: t.control,
              color: t.text2,
              /* Synth 16: initials are letters, so the UI face; mono is for numbers only. */
              fontFamily: FIGTREE,
              fontSize: 13,
              fontWeight: 400,
            }),
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
