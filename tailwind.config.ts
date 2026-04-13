import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
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
