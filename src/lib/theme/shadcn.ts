// The shadcn bridge (BG-P28).
//
// shadcn/ui names its colours in its own vocabulary — `--foreground`,
// `--muted`, `--border`, `--destructive` — and `tailwind.config.ts` exposes
// each as a utility (`text-muted-foreground`, `bg-card`, `border-border`).
// The legacy pages this prompt repaints are written almost entirely in those
// utilities, so until now a page could be converted to `var(--token)` in every
// inline style it had and STILL show the old dark-shell palette through its
// class names. The values were fixed, too: one set, declared once, identical
// in Exhibition and Dusk. `--foreground: 0 0% 95%` put near-white type on the
// Exhibition ground and `--muted-foreground: 0 0% 60%` measured 2.3:1 on it.
//
// So each name is repointed at the buildgallery token it MEANS, per theme.
// This module is the source of truth for that mapping, mirrored into the two
// theme blocks in `src/index.css` and asserted by `css-parity.test.ts` — the
// same arrangement radius and elevation already have, and for the same reason:
// a value edited in one place and not the other is the failure mode of
// mirroring anything into a stylesheet.
//
// WHY HSL TRIPLES RATHER THAN `var(--token)`. `tailwind.config.ts` wraps every
// one of these as `hsl(var(--name))`, which is what makes an opacity modifier
// — `bg-muted/50`, `border-border/60`, `text-foreground/80` — work at all:
// Tailwind splices the alpha into the `hsl()` and needs the bare channels to
// do it. A `var()` holding a finished colour would break every modifier in the
// codebase. The triples below are the token values, converted.
//
// These are declared UNLAYERED in the theme blocks, while the set they replace
// sits in `@layer base`; unlayered declarations win over layered ones, so the
// bridge takes effect without `!important` and without deleting the original,
// which stays as the pre-theme fallback.

/** The shadcn names this bridge is responsible for, in stylesheet order. */
export const SHADCN_NAMES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "sidebar-background",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
] as const;

export type ShadcnName = (typeof SHADCN_NAMES)[number];

/* The token each name resolves to, which is the part worth reading:
     background / card / popover  →  --bg, --recess, --recess
     foreground and every *-foreground on a neutral  →  --text
     muted-foreground  →  --text2
     primary / primary-foreground  →  --action / --on-action
     destructive  →  --cat-breakage, with --on-action on it
     border / input  →  --line
     ring  →  --lit, which is what the theme's focus ring is made of

   Measured, both themes: foreground/background 13.10 and 14.17,
   muted-foreground/background 5.26 and 7.65, muted-foreground/muted 4.55 and
   5.73, foreground/card 11.33 and 10.62, primary-foreground/primary 5.65 and
   6.35, destructive-foreground/destructive 6.08 and 5.76. */

/** Exhibition — the light room. */
export const exhibitionShadcn: Record<ShadcnName, string> = {
  background: "210 8% 90%",
  foreground: "213 17% 13%",
  card: "210 10% 84%",
  "card-foreground": "213 17% 13%",
  popover: "210 10% 84%",
  "popover-foreground": "213 17% 13%",
  primary: "16 56% 40%",
  "primary-foreground": "210 14% 97%",
  secondary: "210 10% 84%",
  "secondary-foreground": "213 17% 13%",
  muted: "210 10% 84%",
  "muted-foreground": "210 9% 37%",
  accent: "210 10% 84%",
  "accent-foreground": "213 17% 13%",
  destructive: "0 74% 42%",
  "destructive-foreground": "210 14% 97%",
  border: "213 11% 80%",
  input: "213 11% 80%",
  ring: "39 67% 55%",
  "sidebar-background": "210 8% 90%",
  "sidebar-foreground": "213 17% 13%",
  "sidebar-primary": "16 56% 40%",
  "sidebar-primary-foreground": "210 14% 97%",
  "sidebar-accent": "210 10% 84%",
  "sidebar-accent-foreground": "213 17% 13%",
  "sidebar-border": "213 11% 80%",
  "sidebar-ring": "39 67% 55%",
};

/** Dusk — the dark room. */
export const duskShadcn: Record<ShadcnName, string> = {
  background: "255 23% 14%",
  foreground: "264 31% 94%",
  card: "258 22% 24%",
  "card-foreground": "264 31% 94%",
  popover: "258 22% 24%",
  "popover-foreground": "264 31% 94%",
  primary: "18 59% 64%",
  "primary-foreground": "6 16% 12%",
  secondary: "258 22% 24%",
  "secondary-foreground": "264 31% 94%",
  muted: "258 22% 24%",
  "muted-foreground": "258 19% 72%",
  accent: "258 22% 24%",
  "accent-foreground": "264 31% 94%",
  destructive: "0 84% 69%",
  "destructive-foreground": "6 16% 12%",
  border: "255 19% 32%",
  input: "255 19% 32%",
  ring: "39 67% 55%",
  "sidebar-background": "255 23% 14%",
  "sidebar-foreground": "264 31% 94%",
  "sidebar-primary": "18 59% 64%",
  "sidebar-primary-foreground": "6 16% 12%",
  "sidebar-accent": "258 22% 24%",
  "sidebar-accent-foreground": "264 31% 94%",
  "sidebar-border": "255 19% 32%",
  "sidebar-ring": "39 67% 55%",
};

export const shadcnThemes = {
  exhibition: exhibitionShadcn,
  dusk: duskShadcn,
} as const;
