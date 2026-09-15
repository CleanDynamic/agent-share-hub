import type { Config } from "tailwindcss";

/* BG-P32 — Tailwind spends the motion module, it does not restate it.
   Importing the constants rather than copying them is what makes "every
   transition in the product comes from the motion module" true of the ~200
   Tailwind transition utilities as well as of the style objects. Change FAST in
   motion.ts and every `transition-*` class in the product moves with it.

   Safe to import here: motion.ts's only import is a type-only one, and it
   touches `window` exclusively from inside function bodies, so evaluating it in
   the config process does nothing. */
import { BASE, FAST, LINEAR, REVEAL, STANDARD, THEME_SWITCH } from "./src/lib/theme/motion";

export default {
  darkMode: ["class"],

  /* BG-P32 — every `hover:` utility behind a fine pointer.
     The theme gates hover motion on `(hover: hover) and (pointer: fine)`,
     because on a touch screen `:hover` sticks after a tap and leaves the
     control looking permanently pressed until something else is touched. This
     codebase carries 563 `hover:` utilities across 278 files; gating them one
     at a time would be 563 hand-written media queries to keep in step, and the
     first one anybody forgot would be invisible.

     This flag compiles every one of them into exactly that query — Tailwind
     emits `@media (hover: hover) and (pointer: fine) { &:hover }`, the same
     string `HOVER_QUERY` in src/lib/theme/motion.ts holds — so the gate is one
     decision rather than 563. motion.test.ts asserts the flag is on and that
     the two strings agree; the hand-written `:hover` rules in the four
     stylesheets are gated in place, and hover carried in a style object goes
     through `hoverIsFine()`, which reads the same query. */
  future: {
    hoverOnlyWhenSupported: true,
  },

  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      /* BG-P32 — the motion vocabulary as utilities.

         DEFAULT is the point of this block. Tailwind's core transition plugin
         reads `transitionDuration.DEFAULT` and `transitionTimingFunction.DEFAULT`
         for every `transition-*` utility, so setting them here moves every
         transition class already written in the product — `transition-colors`,
         `transition-opacity`, `transition-transform`, all of them — onto the
         module's 150ms and the module's curve, without touching the call sites.
         Tailwind's own defaults are 150ms and cubic-bezier(0.4, 0, 0.2, 1);
         the duration happens to agree, the curve does not.

         The three named properties mirror the module's three transition
         builders, so a className and a style object express the same decision:
         `transition-feedback` is `feedback()`, `transition-fade` is `fade()`,
         `transition-move` is `move()`, `transition-enter` is `enter()`. There
         is deliberately no `all`. */
      transitionProperty: {
        feedback: "background-color, border-color, color, opacity, transform",
        fade: "opacity",
        move: "transform",
        enter: "opacity, transform",
      },
      transitionDuration: {
        DEFAULT: `${FAST}ms`,
        fast: `${FAST}ms`,
        base: `${BASE}ms`,
        reveal: `${REVEAL}ms`,
        theme: `${THEME_SWITCH}ms`,
      },
      transitionTimingFunction: {
        DEFAULT: STANDARD,
        standard: STANDARD,
        linear: LINEAR,
      },

      colors: {
        /* --- Semantic tokens (shadcn) --- */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },

        /* --- M3-inspired surface system --- */
        "surface-dim": "#131317",
        "surface": "#131317",
        "surface-container-lowest": "#0e0e12",
        "surface-container-low": "#1b1b20",
        "surface-container": "#1f1f24",
        "surface-container-high": "#2a292e",
        "surface-container-highest": "#353439",
        "surface-bright": "#39393e",
        "surface-variant": "#353439",
        "surface-tint": "#3A9E8F",

        /* --- On-surface text --- */
        "on-surface": "#e4e1e8",
        "on-surface-variant": "#bbcac6",
        "on-background": "#e4e1e8",

        /* --- Brand --- */
        "brand-orange": "#8B4513",

        /* --- Accent containers --- */
        "primary-container": "#1F7A6D",
        "primary-fixed": "#3A9E8F",
        "primary-fixed-dim": "#2D8A7C",
        "secondary-container": "#8B4513",
        "secondary-fixed": "#C4A080",
        "secondary-fixed-dim": "#B87A4A",
        "tertiary": "#8A8A8A",
        "tertiary-container": "#6A6A6A",
        "tertiary-fixed": "#A0A0A0",

        /* --- On containers --- */
        "on-primary": "#003732",
        "on-primary-container": "#004c46",
        "on-primary-fixed": "#00201d",
        "on-primary-fixed-variant": "#005049",
        "on-secondary": "#5c1a00",
        "on-secondary-container": "#fff7f4",
        "on-secondary-fixed": "#380c00",
        "on-secondary-fixed-variant": "#822800",
        "on-tertiary": "#2f3131",
        "on-tertiary-container": "#424343",
        "on-tertiary-fixed": "#1a1c1c",
        "on-tertiary-fixed-variant": "#464747",

        /* --- Utility --- */
        "outline": "#859491",
        "outline-variant": "#3c4947",
        "inverse-surface": "#e4e1e8",
        "inverse-on-surface": "#303035",
        "inverse-primary": "#006a62",
        "error": "#ffb4ab",
        "error-container": "#93000a",
        "on-error": "#690005",
        "on-error-container": "#ffdad6",
      },
      fontFamily: {
        headline: ["Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        label: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
