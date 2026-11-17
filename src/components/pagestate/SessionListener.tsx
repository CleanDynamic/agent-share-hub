/* G13: the one place that decides the server has ended this member's session. Mounted once, inside the router and the
   query client (App.tsx).

   HOW. The client's fetch reports a member's data request answered 401 (lib/query/sessionSignal.ts). The first such
   report while the session is live moves the phase to "checking" and asks the auth server, once:
     - the client already holds a different token (it refreshed meanwhile): the refusal was for the old one; back to live.
     - the auth server refuses the token (401 or 403): the session is over. The phase is "ended", the session is cleared on
       this device only (`signOut({ scope: "local" })`, nothing else), and the sign-in dialog opens over the same page:
       the same address with `?signin=login`, its query and hash kept, one push deep, marked `signedOut` so it says why.
     - the auth server cannot be asked (the network): nothing is decided; back to live, and the page shows its own state.
   Reports that come in while checking or after the end are ignored, so it all happens once.

   The editor (/compose) gets no dialog: it keeps its work on the device and says so in its own banner (Part D). */

import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { listenForRefusals, sessionPhase, setSessionPhase } from "@/lib/query/sessionSignal";
import { deeper, viewOf, withView } from "@/pages/site/signin/signinUrl";

/** The auth server's answer to the confirming check: is this the session being refused, rather than the check failing? */
function refusedByAuth(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { status, code } = error as { status?: unknown; code?: unknown };
  return status === 401 || status === 403 || code === "bad_jwt" || code === "session_not_found" || code === "user_not_found";
}

/** Where the editor lives: no dialog there. */
const EDITOR = /^\/compose(\/|$)/;

export function SessionListener() {
  const navigate = useNavigate();
  const location = useLocation();
  const here = useRef(location);
  here.current = location;
  const go = useRef(navigate);
  go.current = navigate;

  useEffect(() => {
    let alive = true;

    const askToSignIn = () => {
      const { pathname, search, hash, state } = here.current;
      if (EDITOR.test(pathname)) return;
      const open = viewOf(search) !== null;
      go.current(`${pathname}${withView(search, "login")}${hash}`, {
        replace: open,
        state: { ...(open ? (state as Record<string, unknown> | null) : deeper(state)), signedOut: true },
      });
    };

    const confirm = async (token: string) => {
      const { data } = await supabase.auth.getSession();
      const current = data.session?.access_token ?? null;
      if (current !== token) return "live";
      const { error } = await supabase.auth.getUser(token);
      return refusedByAuth(error) ? "ended" : "live";
    };

    listenForRefusals((token) => {
      if (sessionPhase() !== "live") return;
      setSessionPhase("checking");
      void confirm(token)
        .catch(() => "live" as const)
        .then(async (outcome) => {
          if (outcome !== "ended") {
            setSessionPhase("live");
            return;
          }
          setSessionPhase("ended");
          await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
          if (alive) askToSignIn();
        });
    });

    return () => {
      alive = false;
      listenForRefusals(null);
    };
  }, []);

  return null;
}

export default SessionListener;
