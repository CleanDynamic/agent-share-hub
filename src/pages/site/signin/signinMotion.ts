/* The sign-in dialog's own timings (D6), from the approved prototype (Reference A). They sit outside the site's three
   durations on purpose and live here, beside authSizes, rather than in src/lib/theme/motion.ts; everything the
   prototype gave no number for (the switch's pill, a view arriving, the error line, the tick) uses motion.ts's builders.

   They are played through the Web Animations API on the elements themselves, so there is no stylesheet transition. */

/** The scrim fades in over 300ms and out over 900ms. */
export const SCRIM_IN_MS = 300;
export const SCRIM_OUT_MS = 900;

/** The dialog's opacity on entering (and on leaving, which starts at once): 320ms, ease-out. */
export const DIALOG_FADE_MS = 320;
export const DIALOG_FADE_EASING = "ease-out";

/** The dialog's movement on entering: translateY(12px) scale(0.98) to none over 440ms on the prototype's curve. */
export const DIALOG_MOVE_MS = 440;
export const DIALOG_MOVE_EASING = "cubic-bezier(0.2,0.8,0.2,1)";
export const DIALOG_MOVE_FROM = "translateY(12px) scale(0.98)";

/** The prototype names no curve for the scrim; it shares the dialog's ease-out. */
export const SCRIM_EASING = "ease-out";

/** The pending ring turns once every 900ms, linear. */
export const RING_TURN_MS = 900;
