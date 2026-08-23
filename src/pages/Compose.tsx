// The compose route: /compose/new and /compose/:buildId.
//
// /compose/new creates one draft build and replaces itself with the workspace
// for it. /compose/:buildId loads that build, checks it belongs to the session
// user, and hands it to ComposeFrame.
//
// Both render OUTSIDE NeoScaleShell, beside /b2/:slug. The shell's centre
// column is a hardcoded 600x775 panel; the workspace is full-bleed. The route
// is lazy because this is the heaviest page in the application and no other
// route should pay for it.

import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { createBuild } from "@/lib/build";
import { useComposeBuild } from "@/hooks/useComposeBuild";
import { ComposeFrame } from "@/components/compose/ComposeFrame";
import {
  FONT_STACK,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  VOID,
  bodyText,
  headingText,
  labelText,
} from "@/components/build/tokens";

/** A build is never asked to name itself before it exists. */
const DRAFT_TITLE = "Untitled build";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-visual-slot="compose-frame"
      style={{
        position: "fixed",
        inset: 0,
        background: VOID,
        color: TEXT_PRIMARY,
        fontFamily: FONT_STACK,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        isolation: "isolate",
      }}
    >
      {children}
    </div>
  );
}

function Message({
  heading,
  detail,
  children,
}: {
  heading: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 460 }}>
      <h1 style={{ ...headingText, margin: 0 }}>{heading}</h1>
      <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>{detail}</p>
      {children}
    </div>
  );
}

function Waiting({ text }: { text: string }) {
  return (
    <Shell>
      <p style={{ ...bodyText, margin: 0, color: TEXT_MUTED }}>{text}</p>
    </Shell>
  );
}

export default function Compose() {
  const { buildId } = useParams<{ buildId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoggedIn, loading: authLoading } = useAuth();

  // /compose/new carries no :buildId. A static segment outranks a dynamic one
  // in React Router, so "new" is never read as an id.
  const isNew = !buildId;

  const [createError, setCreateError] = useState<Error | null>(null);
  /** Bumped to retry a failed create: /compose/new is already the current
   *  location, so a link back to it would not re-run anything. */
  const [attempt, setAttempt] = useState(0);

  /**
   * One build per visit.
   *
   * The ref is set before the await, and refs survive React strict mode's
   * double-invoked effects — the second pass finds the guard already up and
   * returns, so a visit to /compose/new inserts one row rather than two.
   */
  const creatingRef = useRef(false);

  // Hooks run unconditionally, before any of the gates below. On /compose/new
  // there is no id yet, so the query underneath is disabled.
  const compose = useComposeBuild(buildId);

  useEffect(() => {
    if (!isNew || authLoading || !isLoggedIn) return;
    if (creatingRef.current) return;
    creatingRef.current = true;

    createBuild({ title: DRAFT_TITLE })
      .then((created) => {
        // replace: /compose/new must not sit in history, or Back re-enters it
        // and creates a second draft.
        navigate(`/compose/${created.id}`, { replace: true });
      })
      .catch((cause) => {
        creatingRef.current = false;
        setCreateError(cause instanceof Error ? cause : new Error(String(cause)));
      });
  }, [isNew, authLoading, isLoggedIn, navigate, attempt]);

  if (authLoading) return <Waiting text="Checking your session…" />;

  if (!isLoggedIn) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (isNew) {
    if (createError) {
      return (
        <Shell>
          <Message heading="The draft could not be created" detail={createError.message}>
            <button
              type="button"
              onClick={() => {
                setCreateError(null);
                setAttempt((n) => n + 1);
              }}
              style={{
                ...labelText,
                color: TEAL,
                fontFamily: "inherit",
                alignSelf: "flex-start",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </Message>
        </Shell>
      );
    }
    return <Waiting text="Creating a draft…" />;
  }

  if (compose.isLoading) return <Waiting text="Opening the workspace…" />;

  if (compose.loadError) {
    return (
      <Shell>
        <Message
          heading="This build could not be loaded"
          detail={compose.loadError.message}
        />
      </Shell>
    );
  }

  if (!compose.build) {
    return (
      <Shell>
        <Message
          heading="No build at this address"
          detail="Nothing here, or nothing you can open. It may have been deleted, or it may be another creator's draft."
        >
          <Link to="/compose/new" style={{ ...labelText, color: TEAL }}>
            Start a new build
          </Link>
        </Message>
      </Shell>
    );
  }

  // Ownership, not visibility: RLS already hides another creator's draft, but a
  // published build is readable by everyone and must still not open an editor.
  // Nothing is written on this path — the frame, and with it every control that
  // could call patchBuild, is never mounted.
  if (!compose.isOwner || compose.build.creator_id !== user?.id) {
    return (
      <Shell>
        <Message
          heading="This build isn't yours"
          detail="Only its creator can edit a build. You can still read it as it was published."
        >
          <Link to={`/b2/${compose.build.slug}`} style={{ ...labelText, color: TEAL }}>
            View the build →
          </Link>
        </Message>
      </Shell>
    );
  }

  return <ComposeFrame build={compose.build} compose={compose} />;
}
