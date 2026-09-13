// The compose route: /compose/new and /compose/:buildId.
//
// /compose/new creates one draft build and replaces itself with the workspace
// for it. /compose/:buildId loads that build, checks it belongs to the session
// user, and hands it to ComposeFrame.
//
// Both render OUTSIDE the application frame, beside /b2/:slug. The frame that
// ruled this out was NeoScaleShell, whose centre column was a hardcoded 600x775
// panel; the workspace is full-bleed. That shell was deleted in BG-P17 and the
// route stays outside the frame on its own merits — see the workspace chrome
// BG-P16 gave it. It is lazy because this is the heaviest page in the
// application and no other route should pay for it.

import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { createBuild } from "@/lib/build";
import type { IntakeArrival } from "@/lib/build";
import { useComposeBuild } from "@/hooks/useComposeBuild";
import { ComposeFrame } from "@/components/compose/ComposeFrame";
import {
  WorkspaceBar,
  workspaceGround,
  workspacePanel,
} from "@/components/shell/WorkspaceBar";
import { buttonStyle } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { body as bodyText, sectionHead, data as dataText } from "@/lib/theme/type";

/** A build is never asked to name itself before it exists. */
const DRAFT_TITLE = "Untitled build";

/**
 * The workspace, before there is a workspace: the states between arriving at
 * /compose/:buildId and the frame opening.
 *
 * BG-P16 — IT CARRIES THE WORKSPACE BAR NOW, which is not decoration. Every one
 * of these states used to be a sentence centred on a black field with no way
 * out of it at all: a creator who hit "This build isn't yours" or a failed
 * session check had the browser's Back button and nothing else. The bar means
 * the exit is in the same place here as it is in the workspace itself, which is
 * the whole point of a shared chrome.
 *
 * The ground is `--bg` and the panel is `--recess`, flat, per the rule in
 * WorkspaceBar.tsx. It was #08080C, which went black on Exhibition.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-visual-slot="compose-frame"
      style={{
        position: "fixed",
        inset: 0,
        ...workspaceGround,
        display: "flex",
        flexDirection: "column",
        isolation: "isolate",
      }}
    >
      <WorkspaceBar mode="compose" exit={{ to: "/gallery" }} />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        {children}
      </div>
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
    <div
      style={{
        ...workspacePanel,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: 460,
        padding: 24,
      }}
    >
      <h1 style={{ ...sectionHead, fontSize: 24, margin: 0, color: t.text }}>{heading}</h1>
      <p style={{ ...bodyText, margin: 0, color: t.text2 }}>{detail}</p>
      {children}
    </div>
  );
}

/**
 * The one line that meets a creator arriving from intake.
 *
 * A tray with twenty things in it and no instruction is its own kind of blank
 * surface, so this names the next act. It is also where a parse that failed
 * says so: the draft was created before the parser was called, so the creator
 * lands here either way and the reason has to travel with them.
 *
 * A new fixed element rather than a band inside the workspace — the three-panel
 * layout is not asked to make room for it, and dismissing it leaves no gap.
 */
function ArrivalNotice({ arrival }: { arrival: IntakeArrival }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const failed = arrival.tone === "failed";
  /* Breakage for a parse that failed, evidence for one that worked. Both are
     measured as text on both grounds; the GAP_RED/TEAL hexes were not. */
  const accent = failed ? t.catBreakage : t.evidence;

  return (
    <div
      data-visual-slot="intake-arrival"
      role="status"
      aria-live="polite"
      style={{
        /* Flat `--recess`, like every other panel in the workspace. The tone is
           carried by the 2px left edge alone — a coloured wash behind the text
           was legible on the void and is not on either theme's ground. */
        ...workspacePanel,
        borderLeftWidth: 2,
        borderLeftColor: accent,
        position: "fixed",
        left: 18,
        bottom: 18,
        zIndex: 40,
        maxWidth: 460,
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "11px 13px",
      }}
    >
      <span style={{ ...bodyText, margin: 0, color: t.text }}>{arrival.message}</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          ...dataText,
          fontFamily: "inherit",
          flexShrink: 0,
          backgroundColor: "transparent",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: t.line,
          borderRadius: r.chip,
          padding: "1px 7px",
          cursor: "pointer",
          color: t.text2,
        }}
      >
        ✕
      </button>
    </div>
  );
}

function Waiting({ text }: { text: string }) {
  return (
    <Shell>
      <p role="status" aria-live="polite" style={{ ...bodyText, margin: 0, color: t.text2 }}>
        {text}
      </p>
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
                ...buttonStyle("link"),
                fontFamily: "inherit",
                alignSelf: "flex-start",
                padding: 0,
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
          <Link to="/compose/new" style={{ ...buttonStyle("link"), alignSelf: "flex-start" }}>
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
          <Link
            to={`/b2/${compose.build.slug}`}
            style={{ ...buttonStyle("link"), alignSelf: "flex-start" }}
          >
            View the build →
          </Link>
        </Message>
      </Shell>
    );
  }

  // Router state from /compose/new, or from a Build File dropped on /import or
  // /compose/new (NS-P34). Absent on every other way in.
  const routed = location.state as
    | { intake?: IntakeArrival; justArrived?: number }
    | null;
  const arrival = routed?.intake ?? null;

  // A query parameter rather than router state, because /rebuild/:slug replaces
  // itself in history and a reload of the workspace should still be the arrival
  // it was — state does not survive that, and the flag decides where the
  // creator's attention lands rather than anything about the record.
  const fromRebuild =
    new URLSearchParams(location.search).get("from") === "rebuild";

  return (
    <>
      <ComposeFrame
        build={compose.build}
        compose={compose}
        justArrived={routed?.justArrived}
        fromRebuild={fromRebuild}
      />
      {arrival ? <ArrivalNotice arrival={arrival} /> : null}
    </>
  );
}
