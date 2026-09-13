// /rebuild/:slug — the door into a rebuild.
//
// A rebuild starts as a fork, and a fork is a database write, not a page. So
// this route has no surface of its own worth looking at: it resolves the slug,
// checks there is somebody to own the draft, calls startRebuild and hands the
// creator to their own workspace. What a reader sees is a sentence naming the
// build they are rebuilding, for as long as the two writes take.
//
// WHY IT IS A ROUTE AT ALL, rather than a click handler on the build page.
// Three reasons, all of them about the address bar:
//
//   1. An anonymous reader can be sent to sign in and BACK, because the
//      intention survives as a URL. A handler would have to remember it.
//   2. The fork is the same act whether it starts from the build page, a feed
//      card, a shared link or a bounty — NS-P39 and NS-P40 both want to point
//      at it, and pointing at a URL costs them nothing.
//   3. It replaces itself in history. Back from the workspace goes to the
//      build, not through a door that would fork a second draft on the way.
//
// It renders OUTSIDE the application frame, beside /compose and /b2/:slug, and
// it is lazy — nothing else in the application should carry the rebuild path.
// The frame it was first written to avoid was NeoScaleShell, deleted in BG-P17;
// it stays outside because the workspace chrome BG-P16 gave it is the frame it
// wants.

import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getBuildHeaderBySlug, startRebuild, type Build } from "@/lib/build";
import {
  WorkspaceBar,
  workspaceGround,
  workspacePanel,
} from "@/components/shell/WorkspaceBar";
import { buttonStyle } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { body as bodyText, sectionHead } from "@/lib/theme/type";

/** A build's title does not change while somebody is forking it. */
const STALE_TIME = 300_000;

/**
 * The whole viewport, quiet, on the workspace ground.
 *
 * Deliberately the same chrome the compose route uses for its own waiting and
 * failure states: this page is the first half of arriving at that one, and two
 * different surfaces either side of one redirect would read as two products.
 * BG-P16 made that literally true rather than approximately — it is the same
 * WorkspaceBar component, so the exit does not move between this page and the
 * workspace it hands the creator to.
 *
 * The ground was #08080C, which is neither theme's, and went black on
 * Exhibition. It is `--bg` now, flat, with the panel on `--recess`.
 *
 * THE MODE READS "REBUILD" AND THE CONTEXT NAMES THE SOURCE, which is the one
 * thing a creator waiting on a fork wants confirmed: that it is forking the
 * build they meant.
 */
function Frame({
  sourceTitle,
  children,
}: {
  sourceTitle?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div
      data-visual-slot="rebuild-frame"
      style={{
        position: "fixed",
        inset: 0,
        ...workspaceGround,
        display: "flex",
        flexDirection: "column",
        isolation: "isolate",
      }}
    >
      {/* To /gallery, not to /b2/:slug. The build page has its own way back to
          itself and a reader who abandons a fork is leaving the act, not
          stepping one page back inside it. The failure panel below still offers
          the source specifically, because there the source is the answer. */}
      <WorkspaceBar
        mode="rebuild"
        exit={{ to: "/gallery" }}
        context={{ kind: "readonly", text: sourceTitle ?? null }}
      />
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

/** The line that holds the screen while the fork is being written. */
function Working({ title }: { title: string | null }) {
  return (
    <Frame sourceTitle={title}>
      <p
        data-testid="rebuild-working"
        role="status"
        aria-live="polite"
        style={{ ...bodyText, margin: 0, color: t.text2, textAlign: "center" }}
      >
        {title
          ? `Setting up your rebuild of “${title}”…`
          : "Setting up your rebuild…"}
      </p>
    </Frame>
  );
}

/**
 * A failure, in words, with the way back.
 *
 * The way back is always /b2/:slug: it is where the reader came from, it is
 * where the build they wanted still is, and on the one failure where it does
 * not resolve either — a slug that names nothing — that page says so in the
 * same words this one would have.
 */
function Failure({ slug, detail }: { slug: string | undefined; detail: string }) {
  return (
    <Frame>
      <div
        data-testid="rebuild-error"
        style={{
          ...workspacePanel,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxWidth: 460,
          padding: 24,
        }}
      >
        <h1 style={{ ...sectionHead, fontSize: 24, margin: 0, color: t.text }}>
          The rebuild could not be started
        </h1>
        <p style={{ ...bodyText, margin: 0, color: t.text2 }}>{detail}</p>
        {slug ? (
          <Link
            to={`/b2/${slug}`}
            style={{ ...buttonStyle("link"), alignSelf: "flex-start" }}
          >
            ← Back to the build
          </Link>
        ) : null}
      </div>
    </Frame>
  );
}

export default function RebuildRoute() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading } = useAuth();

  const [startError, setStartError] = useState<Error | null>(null);

  /**
   * One fork per visit.
   *
   * The ref is raised before the await and refs survive strict mode's
   * double-invoked effects, so the second pass finds the guard up and returns —
   * the same guard /compose/new keeps over createBuild, for the same reason.
   * A visit that forked twice would leave an orphan draft crediting a source.
   */
  const startedRef = useRef(false);

  // The header alone: this page needs an id to fork and a title to say. The
  // fork reads the whole record a moment later, so composing one here would be
  // four queries spent on a page nobody stays on.
  const {
    data: source,
    isLoading,
    error: loadError,
  } = useQuery<Build | null>({
    queryKey: ["rebuild-source-header", slug],
    queryFn: () => getBuildHeaderBySlug(slug as string),
    enabled: Boolean(slug) && !authLoading && isLoggedIn,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    if (!source || startedRef.current) return;
    startedRef.current = true;

    startRebuild({ sourceBuildId: source.id })
      .then((draft) => {
        // replace: this route must not sit in history. Back from the workspace
        // belongs to the build page, and a Back that re-entered here would fork
        // a second draft on the way.
        navigate(`/compose/${draft.id}?from=rebuild`, { replace: true });
      })
      .catch((cause: unknown) => {
        setStartError(cause instanceof Error ? cause : new Error(String(cause)));
      });
  }, [source, navigate]);

  if (authLoading) {
    return (
      <Frame>
        <p
          role="status"
          aria-live="polite"
          style={{ ...bodyText, margin: 0, color: t.text2 }}
        >
          Checking your session…
        </p>
      </Frame>
    );
  }

  // The intention survives as an address, so signing in comes back to it and
  // the fork happens without the reader having to ask twice.
  if (!isLoggedIn) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (startError) {
    return <Failure slug={slug} detail={startError.message} />;
  }

  if (loadError) {
    return (
      <Failure
        slug={slug}
        detail={
          loadError instanceof Error
            ? loadError.message
            : "The build could not be read. Try again in a moment."
        }
      />
    );
  }

  if (!isLoading && !source) {
    return (
      <Failure
        slug={slug}
        detail={`Nothing is published at /b2/${slug ?? ""}. It may have been unpublished, or the link may be wrong.`}
      />
    );
  }

  return <Working title={source?.title ?? null} />;
}
