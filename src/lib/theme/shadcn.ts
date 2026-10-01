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

/** Noon — the light room. */
export const noonShadcn: Record<ShadcnName, string> = {
  background: "90 9% 91%",
  foreground: "160 15% 12%",
  card: "100 8% 85%",
  "card-foreground": "160 15% 12%",
  popover: "100 8% 85%",
  "popover-foreground": "160 15% 12%",
  primary: "3 44% 38%",
  "primary-foreground": "60 12% 97%",
  secondary: "100 8% 85%",
  "secondary-foreground": "160 15% 12%",
  muted: "100 8% 85%",
  "muted-foreground": "150 6% 33%",
  accent: "100 8% 85%",
  "accent-foreground": "160 15% 12%",
  destructive: "0 74% 42%",
  "destructive-foreground": "60 12% 97%",
  border: "105 4% 80%",
  input: "105 4% 80%",
  ring: "160 15% 12%",
  "sidebar-background": "90 9% 91%",
  "sidebar-foreground": "160 15% 12%",
  "sidebar-primary": "3 44% 38%",
  "sidebar-primary-foreground": "60 12% 97%",
  "sidebar-accent": "100 8% 85%",
  "sidebar-accent-foreground": "160 15% 12%",
  "sidebar-border": "105 4% 80%",
  "sidebar-ring": "160 15% 12%",
};

/** Dusk — the dark room. */
export const duskShadcn: Record<ShadcnName, string> = {
  background: "265 26% 13%",
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
  border: "266 13% 24%",
  input: "266 13% 24%",
  ring: "39 67% 55%",
  "sidebar-background": "265 26% 13%",
  "sidebar-foreground": "264 31% 94%",
  "sidebar-primary": "18 59% 64%",
  "sidebar-primary-foreground": "6 16% 12%",
  "sidebar-accent": "258 22% 24%",
  "sidebar-accent-foreground": "264 31% 94%",
  "sidebar-border": "266 13% 24%",
  "sidebar-ring": "39 67% 55%",
};

export const shadcnThemes = {
  noon: noonShadcn,
  dusk: duskShadcn,
} as const;
