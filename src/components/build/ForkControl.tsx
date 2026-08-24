// Forking, from the reader's side.
//
// Two entry points, one behaviour: the control in the header takes the whole
// build, and "Fork from here" in the replay takes it as it stood at that step.
// Both land the forker in their own compose workspace on a new draft.
//
// The hook holds the in-flight state so the header control and the replay's
// control cannot both be clicked into two forks: one build page, one fork at a
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

/** The header control: forks the whole build. */
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
            ? "Start your own draft from this build, with the source credited"
            : "Sign in to start your own draft from this build"
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
        {state.pending ? "Forking…" : state.signedIn ? "Fork" : "Sign in to fork"}
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
