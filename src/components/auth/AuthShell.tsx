import { useEffect, useState, type ReactNode } from "react";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useTheme } from "@/contexts/ThemeContext";
import { GLASS_BLUR, prefersReducedMotion } from "@/lib/theme/controls";
import { elevation } from "@/lib/theme/elevation";
import { r } from "@/lib/theme/radius";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { BODONI, FIGTREE } from "@/lib/theme/type";

interface AuthShellProps {
  children: ReactNode;
}

/* ────────────────────────────────────────────────────────────────────────────
   AuthShell — the ground every auth route stands on.

   Rendered WITHOUT the app shell: `Layout` hands `/login`, `/signup`, `/auth/`,
   `/verify-email` and `/reset-password` straight through to their route, so
   there is no left rail, no right rail and no mobile chrome to carry the brand.
   This file is the brand, and for most visitors it is the first buildgallery
   surface they ever see.

   THE GROUND IS `--bg` AND THE WORDMARK IS THE ROOM'S ONLY FURNITURE. What
   stood here was `#25252F` under a 24px dot grid in both themes — the legacy
   dark paint, which drew a patterned near-black field behind an Exhibition
   card. Both are gone. The ground is the token, the way BG-P18b settled it for
   the framed pages.

   THE ONE ATMOSPHERIC TOUCH, AND WHY IT IS ALLOWED HERE. Every other surface in
   this series gets a flat ground. This one gets a soft radial wash because it
   is the only screen with nothing else on it: a gallery's entrance is lit, and
   an unlit one reads as a maintenance page. It is a BACKGROUND-IMAGE on the
   element that was already painting one, not a new positioned layer — no blur,
   no animation, no decorative shape, and no change to `position` or `overflow`.

   The wash is `--lit` on Exhibition and `--action` on Dusk, and that swap is
   deliberate rather than symmetric. Amber is the light in this system and it
   reads as daylight falling into the grey room; on the lavender stone at dusk
   the same amber reads as a lamp someone left on, where salmon reads as the
   horizon the room is named for. Both sit near 9% alpha, far below anything
   that could carry meaning — `aesthetic-usability` is what this buys, not
   information.

   WHY `resolved` AND NOT A TOKEN. The two washes are different TOKENS, not two
   values of one token, so there is nothing for `<html data-theme>` to flip. A
   new semantic token for one gradient on one screen would be a permanent
   addition to the system for a temporary need; reading the resolved theme here
   costs one re-render on a switch, on a screen with one card on it.
   ──────────────────────────────────────────────────────────────────────────── */

/** Alpha for the wash, per room. Low enough to be light and never a surface. */
const WASH_ALPHA = { exhibition: 0.09, dusk: 0.1 } as const;

export function AuthShell({ children }: AuthShellProps) {
  const { resolved } = useTheme();
  const [mounted, setMounted] = useState(false);

  /* Read once at mount rather than per render: the entrance either runs or it
     does not, and a visitor who changes the setting mid-animation is not a case
     worth a listener. The CSS half of the rule is in index.css. */
  const [still] = useState(prefersReducedMotion);

  useEffect(() => {
    setMounted(true);
  }, []);

  const wash =
    resolved === "dusk"
      ? tokenAlpha("action", WASH_ALPHA.dusk)
      : tokenAlpha("lit", WASH_ALPHA.exhibition);

  const shown = still || mounted;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{
        padding: "40px 16px",
        backgroundColor: t.bg,
        /* Anchored high rather than centred on the card: the light comes from
           above in both rooms, and a wash peaking behind the card's middle
           would tint the one place a reader's eye rests. */
        backgroundImage: `radial-gradient(68% 54% at 50% 26%, ${wash} 0%, transparent 72%)`,
        backgroundRepeat: "no-repeat",
        color: t.text,
      }}
    >
      <div className="flex flex-col items-center" style={{ gap: "24px" }}>
        {/* The wordmark. Bodoni at 28 — display, and well clear of the face's
            20px floor, which is what lets the entrance carry the brand with one
            word instead of a logo. */}
        <div
          className="flex flex-col items-center"
          style={{ height: "80px", justifyContent: "center" }}
        >
          <span
            style={{
              fontFamily: BODONI,
              fontSize: "28px",
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
              color: t.text,
            }}
          >
            buildgallery
          </span>
          <span
            style={{
              fontFamily: FIGTREE,
              fontSize: "13px",
              fontWeight: 400,
              letterSpacing: "0.01em",
              color: t.text2,
              marginTop: "6px",
            }}
          >
            Community knowledge base for AI workflows
          </span>
        </div>

        {/* The card. Glass is correct here and wrong in the workspace: this is a
            reading surface, and `elevation.raised` is what lifts it off a ground
            that is now the same family of colour rather than a dark field. */}
        <div
          className="w-full"
          style={{
            width: "420px",
            maxWidth: "92vw",
            background: t.glass,
            backdropFilter: GLASS_BLUR,
            WebkitBackdropFilter: GLASS_BLUR,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: t.glassBorder,
            borderRadius: r.panel,
            ...elevation.raised,
            padding: "28px",
            opacity: shown ? 1 : 0,
            transform: shown ? "scale(1)" : "scale(0.96)",
            transition: still
              ? undefined
              : "opacity 240ms ease-out, transform 240ms ease-out",
          }}
        >
          {children}
        </div>

        {/* The room, chosen before signing in. The rail variant rather than the
            kit's: the kit fills the current segment `--action`, which would put
            a second accent mark on a screen whose one primary action is the
            submit button eight pixels above it. Small, quiet, and still a
            labelled radio group for a screen reader. */}
        <div style={{ width: "260px", maxWidth: "92vw" }}>
          <ThemeToggle variant="rail" />
        </div>
      </div>
    </div>
  );
}
