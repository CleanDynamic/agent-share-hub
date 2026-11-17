// G2: a loading page's title. A visually hidden h1 with the page's kind ("Build", "Profile", "Space"), drawn beside the
// page's skeleton (not inside its live loading region, which would say it twice), so a page always has an h1 for focus to
// go to after a page change. `data-h1-placeholder` tells ScrollKeeper to hand focus on to the real h1 when it replaces it.

import type { ReactNode } from "react";

import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { H1_PLACEHOLDER } from "@/lib/routing/ScrollKeeper";

export function PlaceholderTitle({ children }: { children: ReactNode }) {
  return (
    <h1 {...{ [H1_PLACEHOLDER]: "" }} style={VISUALLY_HIDDEN}>
      {children}
    </h1>
  );
}

export default PlaceholderTitle;
