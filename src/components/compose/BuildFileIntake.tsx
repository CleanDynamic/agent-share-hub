// The review a dropped Build File gets, and the write that follows it.
//
// One component rather than one per page, because /import and /compose/new ask
// the same question about the same file and any second copy of this would be
// free to drift from the first. Each page mounts useBuildFileDrop and hands the
// state here; everything from "the file parsed" to "the workspace is open" is
// below.
//
// NOTHING IS WRITTEN BEFORE THE CONFIRM. The parse is local and synchronous, so
// there is no server call needing a build to exist first. A creator who drops
// the wrong file and backs out leaves nothing behind — no draft, no rows.
//
// AND NOTHING PUBLISHES. The build is created as a draft and stays one; the
// PublishSheet is still the only way out of that state.

import { useCallback, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  keepEverything,
  type IntakeArrival,
  type IntakeSelectionState,
} from "@/lib/build/intake";
import { importBuildFile } from "@/lib/build/buildFileImport";
import type { BuildFileSuccess } from "@/lib/build/buildfile";
import { IntakeProposal } from "@/components/compose/IntakeProposal";
import { IntakeProgress } from "@/components/compose/IntakeProgress";
import {
  plainLanguageRefusal,
  type BuildFileDropState,
} from "@/components/compose/useBuildFileDrop";
import {
  GAP_RED,
  HAIRLINE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  bodyText,
  hexToRgba,
  labelText,
  pageHeadingText,
} from "@/components/build/tokens";

/**
 * What the router carries from a drop to the workspace.
 *
 * `intake` is the existing contract (NS-P14) and is unchanged, so /compose
 * renders the arrival notice for a Build File exactly as it does for a paste.
 * `justArrived` is added alongside it rather than folded into IntakeArrival:
 * the notice is a sentence and the tray banner is a count, they are read by two
 * different components, and neither should have to parse the other's shape.
 */
export interface ComposeArrivalState {
  intake: IntakeArrival;
  /** Nodes written by this import. Drives TrayPanel's `justArrived` banner. */
  justArrived?: number;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "From Claude, 12 parts and 30 steps" — provenance, in the file's own words. */
function sourceLineFor(result: BuildFileSuccess): string {
  const { origin, counts } = result.meta;
  const parts = plural(counts.nodes, "part", "parts");
  const steps = plural(counts.events, "step", "steps");
  const tool = origin.tool?.trim();
  return tool
    ? `From ${tool}, ${parts} and ${steps}`
    : `${parts} and ${steps}`;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * The refusal, in words, with a way back to the thing that writes these files.
 *
 * A creator holding a file this could not read has one useful next act: go back
 * to the chat and ask again. So the panel says what is wrong in a sentence, and
 * the shortcut is to the Extractor rather than to a support page.
 */
function RefusalPanel({
  fileName,
  headline,
  detail,
  onRetry,
  onCopyExtractor,
}: {
  fileName: string | null;
  headline: string;
  detail: string | null;
  onRetry: () => void;
  /** Present when the Extractor is already on this page — /import. */
  onCopyExtractor?: () => void;
}) {
  return (
    <div
      data-testid="import-error"
      data-visual-slot="import-refusal"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "16px 18px",
        borderRadius: 12,
        border: `1px solid ${hexToRgba(GAP_RED, 0.3)}`,
        background: hexToRgba(GAP_RED, 0.06),
      }}
    >
      {fileName ? (
        <span style={{ ...labelText, textTransform: "uppercase", color: GAP_RED }}>
          {fileName}
        </span>
      ) : null}

      <p style={{ ...pageHeadingText, margin: 0, fontSize: 18, color: TEXT_PRIMARY }}>
        {headline}
      </p>

      {detail ? (
        <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>{detail}</p>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
          paddingTop: 4,
          borderTop: `1px solid ${HAIRLINE}`,
        }}
      >
        {onCopyExtractor ? (
          <button
            type="button"
            data-testid="import-error-extractor"
            onClick={onCopyExtractor}
            style={{
              ...labelText,
              fontFamily: "inherit",
              marginTop: 12,
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: TEAL,
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Copy the Extractor again
          </button>
        ) : (
          <Link
            to="/import"
            data-testid="import-error-extractor"
            style={{
              ...labelText,
              marginTop: 12,
              color: TEAL,
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Copy the Extractor again
          </Link>
        )}

        <button
          type="button"
          data-testid="import-error-retry"
          onClick={onRetry}
          style={{
            ...labelText,
            fontFamily: "inherit",
            marginTop: 12,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: TEXT_SECONDARY,
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Try another file
        </button>
      </div>
    </div>
  );
}

interface BuildFileIntakeProps {
  state: BuildFileDropState;
  /** Back to idle. The page shows its own surface again. */
  onReset: () => void;
  /** Present on /import, where the Extractor is one scroll away. */
  onCopyExtractor?: () => void;
}

/**
 * Renders whichever of the four states the drop is in, or nothing when idle.
 *
 * Returning null on idle is what lets a page mount this unconditionally and
 * keep its own layout decisions.
 */
export function BuildFileIntake({ state, onReset, onCopyExtractor }: BuildFileIntakeProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn } = useAuth();

  const [selection, setSelection] = useState<IntakeSelectionState | null>(null);
  /** The proposal the current `selection` belongs to. See below. */
  const [selectedFor, setSelectedFor] = useState<string | null>(null);
  const [isWriting, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = state.name === "parsed" ? state.result : null;
  const sessionId = parsed?.proposal.summary.session_id ?? null;

  /**
   * Reset the selection when a different file is parsed.
   *
   * Derived during render rather than in an effect: an effect would paint one
   * frame of the previous file's ticks against this file's rows, and on a
   * review that is a frame showing the wrong thing kept.
   */
  if (parsed && sessionId !== selectedFor) {
    setSelectedFor(sessionId);
    setSelection(keepEverything(parsed.proposal));
    setError(null);
  }

  const confirm = useCallback(async () => {
    if (!parsed || !selection || isWriting) return;

    // /import is a public route, so a signed-out visitor can read a file all
    // the way to this button. Saying so here beats letting createBuild fail
    // with "no signed-in user", and the parse is local — after signing in they
    // drop the same file again and lose nothing but the drag.
    if (!isLoggedIn) {
      const returnTo = `${location.pathname}${location.search}`;
      setError(
        `You need to be signed in to save a build. Sign in, then drop the file again — ` +
          `nothing has been written yet.`
      );
      navigate(`/login?redirect=${encodeURIComponent(returnTo)}`);
      return;
    }

    setWriting(true);
    setError(null);

    try {
      const { buildId, counts, placement } = await importBuildFile(parsed, selection);

      const landed = counts.nodes + counts.events;
      const message =
        landed === 0
          ? "Empty draft. Add your first node from the panel on the left."
          : `${plural(counts.nodes, "part", "parts")} and ` +
            `${plural(counts.events, "step", "steps")} came in from your file` +
            (placement.leftInTray > 0
              ? ` — ${placement.leftInTray} of them are in the tray, waiting for somewhere to sit.`
              : ". Check it over, then publish when you are ready.");

      const arrival: ComposeArrivalState = {
        intake: { tone: "settled", message },
        justArrived: counts.nodes,
      };

      // replace: the page that took the file must not sit in history, or Back
      // re-enters it holding a proposal that has already been written.
      navigate(`/compose/${buildId}`, { replace: true, state: arrival });
    } catch (cause) {
      setWriting(false);
      setError(`That could not be saved: ${messageOf(cause)} Nothing was lost — try again.`);
    }
  }, [isLoggedIn, isWriting, location, navigate, parsed, selection]);

  if (state.name === "idle") return null;

  if (state.name === "reading") {
    return (
      <IntakeProgress
        sourceLabel={state.fileName}
        description="Reading the Build File and checking it against the node types. Nothing is saved until you have looked at what it found."
      />
    );
  }

  if (state.name === "failed") {
    const top = state.errors[0] ?? null;
    return (
      <RefusalPanel
        fileName={state.fileName}
        headline={plainLanguageRefusal(top, state.raw)}
        detail={top?.message ?? null}
        onRetry={onReset}
        onCopyExtractor={onCopyExtractor}
      />
    );
  }

  if (!selection) return null;

  return (
    <IntakeProposal
      proposal={state.result.proposal}
      selection={selection}
      onChange={setSelection}
      onConfirm={() => void confirm()}
      onSkip={onReset}
      isWriting={isWriting}
      error={error}
      sourceLine={sourceLineFor(state.result)}
      arrivalNote="What you keep arrives already placed, in the shape the file described — anything you untick is left out."
      secrets={state.result.meta.secrets}
      testId="import-review"
      confirmTestId="import-confirm"
    />
  );
}
