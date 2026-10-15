// The shadcn bridge (BG-P28).
//
// shadcn/ui names its colours in its own vocabulary — `--foreground`,
// `--muted`, `--border`, `--destructive` — and `tailwind.config.ts` exposes
// each as a utility (`text-muted-foreground`, `bg-card`, `border-border`).
// The legacy pages this prompt repaints are written almost entirely in those
// utilities, so until now a page could be converted to `var(--token)` in every
// inline style it had and STILL show the old dark-shell palette through its
// class names. The values were fixed, too: one set, declared once, identical
// in Noon and Dusk. `--foreground: 0 0% 95%` put near-white type on the
// Noon ground and `--muted-foreground: 0 0% 60%` measured 2.3:1 on it.
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
     ring  →  --focus-ring, which is what the theme's focus ring is made of:
              the ink on Noon, the lamp gold on Dusk (UI-P04)

   Measured, both themes: foreground/background 13.41 and 14.51,
   muted-foreground/background 5.96 and 7.83, muted-foreground/muted 5.11 and
   5.73, foreground/card 11.48 and 10.62, primary-foreground/primary 7.07 and
   6.35, destructive-foreground/destructive 6.08 and 5.76. */

/** Noon. */
export const noonShadcn: Record<ShadcnName, string> = {
  background: "0 0% 91%",
  foreground: "0 0% 11%",
  card: "0 0% 98%",
  "card-foreground": "0 0% 11%",
  popover: "0 0% 98%",
  "popover-foreground": "0 0% 11%",
  primary: "0 0% 11%",
  "primary-foreground": "0 0% 100%",
  secondary: "0 0% 93%",
  "secondary-foreground": "0 0% 11%",
  muted: "0 0% 93%",
  "muted-foreground": "0 0% 34%",
  accent: "0 0% 93%",
  "accent-foreground": "0 0% 11%",
  destructive: "6 75% 44%",
  "destructive-foreground": "0 0% 100%",
  border: "0 0% 88%",
  input: "0 0% 88%",
  ring: "221 83% 53%",
  "sidebar-background": "0 0% 91%",
  "sidebar-foreground": "0 0% 11%",
  "sidebar-primary": "0 0% 11%",
  "sidebar-primary-foreground": "0 0% 100%",
  "sidebar-accent": "0 0% 93%",
  "sidebar-accent-foreground": "0 0% 11%",
  "sidebar-border": "0 0% 88%",
  "sidebar-ring": "221 83% 53%",
};

/** Dusk. */
export const duskShadcn: Record<ShadcnName, string> = {
  background: "240 3% 6%",
  foreground: "240 6% 93%",
  card: "240 5% 12%",
  "card-foreground": "240 6% 93%",
  popover: "240 5% 12%",
  "popover-foreground": "240 6% 93%",
  primary: "240 6% 93%",
  "primary-foreground": "240 5% 7%",
  secondary: "240 5% 8%",
  "secondary-foreground": "240 6% 93%",
  muted: "240 5% 8%",
  "muted-foreground": "240 3% 64%",
  accent: "240 5% 8%",
  "accent-foreground": "240 6% 93%",
  destructive: "1 66% 70%",
  "destructive-foreground": "240 5% 7%",
  border: "240 5% 16%",
  input: "240 5% 16%",
  ring: "217 77% 75%",
  "sidebar-background": "240 3% 6%",
  "sidebar-foreground": "240 6% 93%",
  "sidebar-primary": "240 6% 93%",
  "sidebar-primary-foreground": "240 5% 7%",
  "sidebar-accent": "240 5% 8%",
  "sidebar-accent-foreground": "240 6% 93%",
  "sidebar-border": "240 5% 16%",
  "sidebar-ring": "217 77% 75%",
};

export const shadcnThemes = {
  noon: noonShadcn,
  dusk: duskShadcn,
} as const;

