/* UI-P36 — what the four sign-in containers share: the page around a card.

   It loads the two numbers the orbs say, through `src/lib/` functions only,
   works out where Back goes and what the switch carries across, and renders
   `SignInView` around whatever card body the container passes. The orbs are not
   drawn on a phone, so nothing is asked for them there.

   THE KEYS ARE THE HOME AND GALLERY PAGES' OWN, so a visitor who came from either
   already has both numbers and the orbs are filled on the first paint. A failed
   read leaves the orb as the empty disc; the page never waits on it.

   THE DATA LAYER IS LOADED WHEN A NUMBER IS WANTED, not with the page. The orbs
   are the entrance's decoration and this is the first page most visitors see, so
   the two lib modules are imported by the queries rather than into the page's
   chunk; a phone, which asks for neither, never fetches them. */

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { useIsPhone } from "@/components/shell/useMinWidth";

import { carriedSearch, type AuthMode } from "./authModel";
import { SignInView } from "./SignInView";

/** The counts are estimates; a minute is as fresh as they mean to be. */
const COUNT_STALE_MS = 60_000;

export function SignInShell({ mode, children }: { mode: AuthMode; children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const phone = useIsPhone();

  const reproduced = useQuery({
    queryKey: ["build", "countReproducedToday"],
    queryFn: () => import("@/lib/build/signals").then((signals) => signals.countReproducedToday()),
    staleTime: COUNT_STALE_MS,
    enabled: !phone,
  });
  const stats = useQuery({
    queryKey: ["gallery", "getGalleryStats"],
    queryFn: () => import("@/lib/build/gallery").then((gallery) => gallery.getGalleryStats()),
    staleTime: COUNT_STALE_MS,
    enabled: !phone,
  });

  /* The router gives the first entry of a session the key "default". Anything
     else has somewhere to go back to inside the app; the first entry has not,
     and sends Back to Home rather than out of the site. */
  const onBack = () => (location.key !== "default" ? navigate(-1) : navigate("/"));

  return (
    <SignInView
      fit="content"
      mode={mode}
      carry={carriedSearch(params)}
      onBack={onBack}
      reproducedToday={reproduced.data ?? null}
      inGallery={stats.data?.inGallery ?? null}
    >
      {children}
    </SignInView>
  );
}

export default SignInShell;
