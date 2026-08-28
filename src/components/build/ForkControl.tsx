// Rebuilding, from the reader's side.
//
// Two entry points, one act: the control in the header takes the whole build,
// and "Rebuild from here" in the replay takes it as it stood at that step. Both
// land the rebuilder in their own compose workspace on a new draft.
//
// WHAT NS-P38 CHANGED, AND WHAT IT DID NOT. The words: a fork with the source
// credited is a REBUILD, and the reader-facing surfaces say so. The whole-build
// action's destination: /rebuild/:slug, which forks and seeds compose, so the
// intention survives as an address a signed-out reader can be sent back to.
// Nothing else. The mechanics are untouched — the route calls startRebuild,
// which calls the same forkBuild this hook calls below for the moment variant.
//
// The replay's variant still forks here rather than through the route, because
// it carries an ordinal and the route has nowhere to put one: /rebuild/:slug
// names a build, not a moment in it.
//
// The hook holds the in-flight state so the header control and the replay's
// control cannot both be clicked into two drafts: one build page, one fork at a
// time. A reader who is not signed in is sent to sign in and back, rather than
// being offered a button that fails.

import { useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { forkBuild, type Build } from "@/lib/build";
import { useAuth } from "@/contexts/AuthContext";
import {
  GAP_RED,
  HAIRLINE,
  ORANGE,
  TEXT_MUTED,
  TEXT_SECONDARY,
  bodyText,
  hexToRgba,
  labelText,
} from "./tokens";

export interface ForkState {
  /** Fork the build, optionally at an ordinal. */
  fork: (atEventOrdinal?: number) => void;
  pending: boolean;
  error: string | null;
  signedIn: boolean;
}

export function useForkBuild(build: Build | undefined): ForkState {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fork = useCallback(
    (atEventOrdinal?: number) => {
      if (!build || pending) return;

      // The whole build: hand it to the route, which owns the fork, the sign-in
      // round trip and the seeded workspace. It is sent to even when the reader
      // is signed out — /rebuild/:slug asks for a session itself and returns to
      // the flow afterwards, which is one round trip rather than two.
      if (atEventOrdinal === undefined) {
        navigate(`/rebuild/${build.slug}`);
        return;
      }

      if (!isLoggedIn) {
        // Same round trip ProtectedRoute uses, so the reader comes back to the
        // build they were looking at rather than to the home page.
        navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
        return;
      }

      setPending(true);
      setError(null);
      forkBuild({ sourceBuildId: build.id, atEventOrdinal })
        .then((draft) => navigate(`/compose/${draft.id}`))
        .catch((cause: unknown) => {
          setError(
            cause instanceof Error
              ? cause.message
              : "The fork could not be created. Try again in a moment."
          );
          setPending(false);
        });
    },
    [build, pending, isLoggedIn, navigate, location.pathname]
  );

  return { fork, pending, error, signedIn: isLoggedIn };
}

/** The header control: rebuilds the whole build, through /rebuild/:slug. */
export function ForkControl({ state }: { state: ForkState }) {
  return (
    <div
      data-visual-slot="build-fork-control"
      style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
    >
      <button
        type="button"
        onClick={() => state.fork()}
        disabled={state.pending}
        title={
          state.signedIn
            ? "Start your own rebuild of this build, with the source credited"
            : "Sign in to start your own rebuild of this build"
        }
        style={{
          ...labelText,
          padding: "6px 12px",
          borderRadius: 8,
          fontSize: 11,
          whiteSpace: "nowrap",
          cursor: state.pending ? "progress" : "pointer",
          color: state.pending ? TEXT_MUTED : ORANGE,
          background: hexToRgba(ORANGE, 0.1),
          border: `1px solid ${state.pending ? HAIRLINE : hexToRgba(ORANGE, 0.35)}`,
          transition: "color 120ms ease, border-color 120ms ease",
        }}
      >
        {state.pending
          ? "Rebuilding…"
          : state.signedIn
            ? "Rebuild this"
            : "Sign in to rebuild"}
      </button>
      {state.error ? (
        <span role="alert" style={{ ...bodyText, fontSize: 12, color: GAP_RED }}>
          {state.error}
        </span>
      ) : (
        <span style={{ ...bodyText, fontSize: 12, color: TEXT_SECONDARY }} />
      )}
    </div>
  );
}

export default ForkControl;
