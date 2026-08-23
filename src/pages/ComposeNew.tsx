// /compose/new — the intake step that used to be a redirect.
//
// The blank surface is what loses submissions. A creator arriving here has
// already done the work somewhere else, in a chat window, and the useful thing
// to do with that is take it rather than ask them to retype it as a form.
//
// Three ways in, and they are peers: paste a transcript, drop a .txt or .md
// file, or start empty. Starting empty is a plain link that is always on
// screen — it is the honest option for someone who has nothing to paste, and
// burying it would make this a toll gate rather than an offer.
//
// ORDER. On paste or drop the draft build is created FIRST, then the parser is
// called with its id. The parser needs a real build to check ownership against,
// and creating first means a parser failure leaves the creator with a usable
// empty draft rather than with nothing — which is the whole difference between
// a bad minute and a lost submission.

import { useCallback, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { createBuild } from "@/lib/build";
import {
  MAX_RAW_TEXT_CHARS,
  keepEverything,
  materialiseProposal,
  requestProposal,
  type IntakeArrival,
  type IntakeSelectionState,
  type TranscriptProposal,
} from "@/lib/build/intake";
import { IntakeProposal } from "@/components/compose/IntakeProposal";
import { IntakeProgress } from "@/components/compose/IntakeProgress";
import {
  FONT_STACK,
  GAP_RED,
  HAIRLINE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  VOID,
  bodyText,
  hexToRgba,
  labelText,
  pageHeadingText,
  panelGlass,
} from "@/components/build/tokens";

/** A build is never asked to name itself before it exists. */
const DRAFT_TITLE = "Untitled build";

/** What a creator can drop. Anything else is a paste, not a transcript file. */
const ACCEPTED_EXTENSIONS = [".txt", ".md", ".markdown", ".text"];

type Stage =
  | { name: "idle" }
  | { name: "parsing"; buildId: string; sourceLabel: string; characterCount: number }
  | { name: "review"; buildId: string; proposal: TranscriptProposal };

function looksLikeText(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith("text/") ||
    ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension))
  );
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-visual-slot="compose-intake"
      style={{
        position: "fixed",
        inset: 0,
        background: VOID,
        color: TEXT_PRIMARY,
        fontFamily: FONT_STACK,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflowY: "auto",
        padding: 24,
        isolation: "isolate",
      }}
    >
      <div
        style={{
          ...panelGlass,
          borderRadius: 16,
          width: "100%",
          maxWidth: 720,
          margin: "auto",
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function ComposeNew() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading } = useAuth();

  const [stage, setStage] = useState<Stage>({ name: "idle" });
  const [text, setText] = useState("");
  const [selection, setSelection] = useState<IntakeSelectionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWriting, setWriting] = useState(false);
  const [isDragging, setDragging] = useState(false);
  const [isStarting, setStarting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /** One build per intake, whatever the creator clicks twice. */
  const busyRef = useRef(false);

  const goToWorkspace = useCallback(
    (buildId: string, arrival: IntakeArrival) => {
      // replace: /compose/new must not sit in history, or Back re-enters it
      // and creates a second draft.
      navigate(`/compose/${buildId}`, { replace: true, state: { intake: arrival } });
    },
    [navigate]
  );

  /** Start empty. One click, one build, straight into the workspace. */
  const startEmpty = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setStarting(true);
    setError(null);

    try {
      const build = await createBuild({ title: DRAFT_TITLE });
      goToWorkspace(build.id, {
        tone: "settled",
        message: "Empty draft. Add your first node from the panel on the left.",
      });
    } catch (cause) {
      busyRef.current = false;
      setStarting(false);
      setError(`The draft could not be created: ${messageOf(cause)}`);
    }
  }, [goToWorkspace]);

  /**
   * Take a transcript: build first, parse second.
   *
   * A parser failure is not a dead end — the draft exists by then, so the
   * creator is sent to it with the reason rather than left on this screen with
   * a transcript they would have to paste again.
   */
  const takeTranscript = useCallback(
    async (rawText: string, sourceLabel: string) => {
      if (busyRef.current) return;

      const trimmed = rawText.trim();
      if (!trimmed) {
        setError("There is nothing to read yet. Paste a transcript or drop a file.");
        return;
      }
      if (rawText.length > MAX_RAW_TEXT_CHARS) {
        setError(
          `That is ${rawText.length.toLocaleString("en-GB")} characters, over the ` +
            `${MAX_RAW_TEXT_CHARS.toLocaleString("en-GB")} the parser takes. Split it and ` +
            `bring each part into the same build.`
        );
        return;
      }

      busyRef.current = true;
      setError(null);

      let buildId: string;
      try {
        const build = await createBuild({ title: DRAFT_TITLE });
        buildId = build.id;
      } catch (cause) {
        busyRef.current = false;
        setError(`The draft could not be created: ${messageOf(cause)}`);
        return;
      }

      setStage({
        name: "parsing",
        buildId,
        sourceLabel,
        characterCount: rawText.length,
      });

      try {
        const proposal = await requestProposal(buildId, rawText, sourceLabel);
        busyRef.current = false;
        setSelection(keepEverything(proposal));
        setStage({ name: "review", buildId, proposal });
      } catch (cause) {
        // The draft is already real. Hand it over with the reason attached.
        busyRef.current = false;
        goToWorkspace(buildId, {
          tone: "failed",
          message: `The transcript could not be read: ${messageOf(cause)} Your draft is here and empty.`,
        });
      }
    },
    [goToWorkspace]
  );

  const takeFile = useCallback(
    async (file: File) => {
      if (!looksLikeText(file)) {
        setError(`${file.name} is not a text file. Drop a .txt or .md, or paste the text.`);
        return;
      }
      try {
        const contents = await file.text();
        setText(contents);
        await takeTranscript(contents, file.name);
      } catch (cause) {
        setError(`${file.name} could not be read: ${messageOf(cause)}`);
      }
    },
    [takeTranscript]
  );

  const confirm = useCallback(async () => {
    if (stage.name !== "review" || !selection) return;
    setWriting(true);
    setError(null);

    try {
      const counts = await materialiseProposal(stage.buildId, stage.proposal, selection);
      const landed = counts.events + counts.nodes;
      goToWorkspace(stage.buildId, {
        tone: "settled",
        message:
          landed === 0
            ? "Nothing kept. Add your first node from the panel on the left."
            : `${counts.nodes} ${counts.nodes === 1 ? "item is" : "items are"} in your tray and ` +
              `${counts.events} ${counts.events === 1 ? "prompt is" : "prompts are"} in the sequence — ` +
              `drag from the tray into the build to place them.`,
      });
    } catch (cause) {
      setWriting(false);
      setError(`That could not be saved: ${messageOf(cause)} Nothing was lost — try again.`);
    }
  }, [goToWorkspace, selection, stage]);

  const skipProposal = useCallback(() => {
    if (stage.name !== "review") return;
    goToWorkspace(stage.buildId, {
      tone: "settled",
      message: "Empty draft. Add your first node from the panel on the left.",
    });
  }, [goToWorkspace, stage]);

  // --- gates -----------------------------------------------------------------

  if (authLoading) {
    return (
      <Shell>
        <p style={{ ...bodyText, margin: 0, color: TEXT_MUTED }}>Checking your session…</p>
      </Shell>
    );
  }

  if (!isLoggedIn) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (stage.name === "parsing") {
    return (
      <Shell>
        <IntakeProgress
          sourceLabel={stage.sourceLabel}
          characterCount={stage.characterCount}
        />
      </Shell>
    );
  }

  if (stage.name === "review" && selection) {
    return (
      <Shell>
        <IntakeProposal
          proposal={stage.proposal}
          selection={selection}
          onChange={setSelection}
          onConfirm={confirm}
          onSkip={skipProposal}
          isWriting={isWriting}
          error={error}
        />
      </Shell>
    );
  }

  // --- the offer --------------------------------------------------------------

  const busy = isStarting || busyRef.current;

  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h1 style={{ ...pageHeadingText, margin: 0 }}>Start a build</h1>
        <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>
          If you built this in a chat, bring the chat. It gets split into the
          prompts you sent and the code and settings that came back, and all of
          it lands in your tray for you to arrange.
        </p>
      </div>

      {/* The zone is both the paste target and the drop target: one surface, so
          a creator never has to work out which half takes a file. */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!isDragging) setDragging(true);
        }}
        onDragLeave={(event) => {
          // Only when the pointer leaves the zone itself, not a child of it.
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void takeFile(file);
        }}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: 14,
          borderRadius: 12,
          border: `1px dashed ${isDragging ? hexToRgba(TEAL, 0.55) : HAIRLINE}`,
          background: isDragging ? hexToRgba(TEAL, 0.06) : "rgba(255,255,255,0.02)",
          transition: "background 120ms ease, border-color 120ms ease",
        }}
      >
        <label htmlFor="intake-transcript" style={{ ...labelText, textTransform: "uppercase" }}>
          Paste the transcript
        </label>

        <textarea
          id="intake-transcript"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            if (error) setError(null);
          }}
          disabled={busy}
          spellCheck={false}
          placeholder={
            "You said:\nBuild me a script that renames photos by the date they were taken.\n\nChatGPT said:\nUse exiftool…"
          }
          style={{
            width: "100%",
            boxSizing: "border-box",
            minHeight: 210,
            resize: "vertical",
            fontFamily: FONT_STACK,
            fontSize: 13,
            fontWeight: 300,
            lineHeight: 1.6,
            color: TEXT_PRIMARY,
            background: "rgba(255,255,255,0.025)",
            border: `1px solid rgba(255,255,255,0.06)`,
            borderRadius: 10,
            padding: "10px 12px",
            outline: "none",
          }}
        />

        <span style={{ ...bodyText, fontSize: 12, color: TEXT_MUTED }}>
          {isDragging
            ? "Drop it to read it."
            : "Or drop a .txt or .md file anywhere on this box."}
        </span>

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.markdown,.text,text/plain,text/markdown"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared so choosing the same file twice fires change again.
            event.target.value = "";
            if (file) void takeFile(file);
          }}
          style={{ display: "none" }}
        />
      </div>

      {error ? (
        <p
          role="alert"
          style={{
            ...bodyText,
            margin: 0,
            padding: "10px 12px",
            borderRadius: 8,
            border: `1px solid ${hexToRgba(GAP_RED, 0.3)}`,
            background: hexToRgba(GAP_RED, 0.06),
            color: TEXT_PRIMARY,
          }}
        >
          {error}
        </p>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        {/* VISUAL SLOT — the primary button surface is supplied externally.
            Structure only here: pill geometry, disabled state, no surface. */}
        <span data-visual-slot="btn-primary" style={{ display: "inline-flex" }}>
          <button
            type="button"
            onClick={() => void takeTranscript(text, "pasted transcript")}
            disabled={busy}
            style={{
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.04em",
              height: 34,
              padding: "0 18px",
              borderRadius: 100,
              background: "rgba(255,255,255,0.025)",
              border: `1px solid ${hexToRgba(TEAL, 0.32)}`,
              color: busy ? TEXT_MUTED : TEAL,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            Read it
          </button>
        </span>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          style={{
            ...labelText,
            fontFamily: "inherit",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: busy ? "wait" : "pointer",
            color: TEXT_SECONDARY,
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Choose a file
        </button>

        <span aria-hidden style={{ width: 1, height: 16, background: HAIRLINE }} />

        {/* Always on screen, never behind a disclosure: someone with nothing to
            paste must not have to hunt for the way in. */}
        <button
          type="button"
          onClick={() => void startEmpty()}
          disabled={busy}
          style={{
            ...labelText,
            fontFamily: "inherit",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: busy ? "wait" : "pointer",
            color: TEAL,
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          {isStarting ? "Creating a draft…" : "Start empty instead"}
        </button>
      </div>
    </Shell>
  );
}
