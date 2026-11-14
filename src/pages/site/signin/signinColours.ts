/* The sign-in dialog's own colours (Reference A). Everything else in the dialog is the site's tokens; these are the values
   the approved prototype set and the site has no token for: the green primary and its hover, the black ink on it, the dark
   picture column, Noon's dark-green text link, and the two scrims. They are scoped to the dialog: no other primary changes. */

import { t } from "@/lib/theme/tokens";

import type { Room } from "@/components/brand/useRoom";

export interface SignInColours {
  primary: string;
  primaryHover: string;
  onPrimary: string;
  /** The picture column's fill, so the picture and the column meet with no seam. */
  column: string;
  /** A green text link. */
  link: string;
  scrim: string;
}

export const SIGNIN_COLOURS: Record<Room, SignInColours> = {
  dusk: {
    primary: "#6BE2A0",
    primaryHover: "#58BA71",
    onPrimary: "#000000",
    column: "#000000",
    link: t.action,
    scrim: "rgba(0,0,0,0.8)",
  },
  noon: {
    primary: "#77FC49",
    primaryHover: "#5EE832",
    onPrimary: "#000000",
    // The bottom row of beaver-light.png, where object-fit cover crops it, is #FFFFFF: Noon's --window.
    column: t.window,
    link: "#173014",
    scrim: "rgba(244,244,242,0.84)",
  },
};
