/* G13: the one place that decides the server has ended this member's session. Mounted once, inside the router and the
   query client (App.tsx).

   HOW. The client's fetch reports a member's data request answered 401 (lib/query/sessionSignal.ts). The first such
   report while the session is live moves the phase to "checking" and asks the auth server, once:
     - the client holds no session any more (it tried to refresh and was refused): the session is over, as below.
     - the client already holds a different token (it refreshed meanwhile): the refusal was for the old one; back to live.
     - the auth server refuses the token (401 or 403): the session is over. The phase is "ended", the session is cleared on
       this device only (`signOut({ scope: "local" })`, nothing else), and the sign-in dialog opens over the same page:
       the same address with `?signin=login`, its query and hash kept, one push deep, marked `signedOut` so it says why.
     - the auth server cannot be asked (the network): nothing is decided; back to live, and the page shows its own state.
   Reports that come in while checking or after the end are ignored, so it all happens once.

   G14: when the member signs in again, the phase is live once more and every query is read again with the new session
   (the ones that failed meanwhile from their skeleton, G18) (the dialog closes in place: LoginPanel).

   G17: the client can drop a member's session on its own (a refresh the auth server refused). That SIGNED_OUT, for a
   member who was signed in, takes the same path: phase "ended" and the dialog. A sign-out someone asked for goes
   through `supabase.auth.signOut`, which this listener wraps while mounted to know it was asked for; that opens nothing.
   (A sign-out in another tab arrives here as the client's own: this tab is asked to sign in again.)

   G15: back from a provider's sign-in, the page the member left is put back where it was scrolled (returnPlace.ts):
   now if the page is already tall enough, else as it grows, for up to five seconds, unless the member scrolls first.

   The editor (/compose) gets no dialog: it keeps its work on the device and says so in its own banner (Part D). */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { listenForRefusals, sessionPhase, setSessionPhase } from "@/lib/query/sessionSignal";
import { deeper, viewOf, withView } from "@/pages/site/signin/signinUrl";

import { takePlace } from "./returnPlace";

const PUT_BACK_FOR_MS = 5_000;

/** Scroll to `y` now, or as the page grows to reach it; stops on arrival, at the limit, or when the member scrolls. */
function putBack(y: number): () => void {
  const reached = () => {
    window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior });
    return Math.abs(window.scrollY - y) <= 4;
  };
  if (reached() || typeof ResizeObserver === "undefined") return () => undefined;
  const growing = new ResizeObserver(() => {
    if (reached()) stop();
  });
  const timer = window.setTimeout(() => stop(), PUT_BACK_FOR_MS);
  const stop = () => {
    growing.disconnect();
    window.clearTimeout(timer);
    for (const event of ["wheel", "touchstart", "keydown"]) window.removeEventListener(event, stop);
  };
  growing.observe(document.body);
  for (const event of ["wheel", "touchstart", "keydown"]) window.addEventListener(event, stop, { once: true, passive: true });
  return stop;
}

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
  const queryClient = useQueryClient();

  // G15: back from a provider, on the page that was left.
  const address = `${location.pathname}${location.search}${location.hash}`;
  useEffect(() => {
    const y = takePlace(address);
    return y === null ? undefined : putBack(y);
  }, [address]);

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
      // Gone already: the client asked for a fresh token while checking and the auth server refused it.
      if (current === null) return "ended";
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

    /* G17: who asked for a sign-out. Every caller goes through auth.signOut; while one is out, a SIGNED_OUT is theirs. */
    const auth = supabase.auth;
    const signOut = auth.signOut;
    let asked = 0;
    auth.signOut = ((...args: Parameters<typeof signOut>) => {
      asked += 1;
      return Promise.resolve(signOut.apply(auth, args)).finally(() => {
        asked -= 1;
      });
    }) as typeof signOut;

    let member = false;
    const { data: watch } = auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        const unasked = member && asked === 0 && sessionPhase() === "live";
        member = false;
        if (unasked) {
          setSessionPhase("ended");
          askToSignIn();
        }
        return;
      }
      member = Boolean(session);
      if (event === "SIGNED_IN" && session && sessionPhase() === "ended") {
        /* G18: what failed while the session was in question starts again from its skeleton; the rest is read again in
           place. */
        const failed = (query: { state: { status: string; data: unknown } }) => query.state.status === "error" && query.state.data === undefined;
        const unanswered = queryClient.getQueryCache().findAll({ predicate: failed });
        void queryClient.resetQueries({ predicate: (query) => unanswered.includes(query) });
        void queryClient.invalidateQueries({ predicate: (query) => !unanswered.includes(query) });
        setSessionPhase("live");
      }
    });

    return () => {
      alive = false;
      listenForRefusals(null);
      watch.subscription.unsubscribe();
      auth.signOut = signOut;
    };
  }, [queryClient]);

  return null;
}

export default SessionListener;
