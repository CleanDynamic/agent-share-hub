// /import — the Build File kit, presented as three steps.
//
// THE PROBLEM THIS SOLVES. The thing that stops a build being published is not
// the form, it is the writing up. Someone spent an evening in a chat window
// getting something to work; asking them to now retell it in fields is asking
// for the evening again. So this page does not ask them to write anything. It
// hands them a document to paste into the chat they already have open, and the
// AI that helped them build it writes the record instead.
//
// THREE STEPS. Copy the Extractor, save what comes back, drop the file here.
// The third step was a labelled placeholder until NS-P34; it is now the real
// target, and the whole page is a drop surface behind it — someone dragging a
// file at this page is aiming at the page, not at a rectangle on it.
//
// THE DROP REPLACES THE PAGE, it does not sit under it. Once a file is being
// read the steps are gone and the review is what is on screen: a creator who
// has dropped their file is finished with the instructions, and leaving them
// above a proposal would be asking them to scroll past work they have done.
//
// THE DOCUMENTS ARE STATIC ASSETS, not strings in this bundle. They are read by
// a chatbot, not by this application, so what a person needs is text they can
// copy and a file they can download — a URL does both, and keeps ~7 kB of prose
// out of every bundle that is not this page. The fetch lives here rather than in
// src/lib/build/, which is read-only in this prompt and is for Supabase access
// in any case; this is a static file over HTTP, with no query and no policy.
//
// PREFETCHED ON MOUNT, deliberately. The Extractor is fetched when the page
// mounts rather than when Copy is clicked, because a clipboard write that
// happens after an awaited network round trip has lost its user activation in
// Safari and is silently refused. Copying the whole point of the page must not
// depend on which browser someone opened it in. The Compiler is behind a fold
// and is fetched when that fold opens, for the same reason and no earlier.
//
// BG-P15 — INSIDE THE APPLICATION FRAME NOW, like /gallery, and listed in
// src/components/shell/wideRoutes.ts so it renders in wide mode. NO RIGHT
// RAIL: this is a task with one path through it, and the rail's whole job is
// to offer somewhere else to go. Wide rather than standard because the two
// documents it hands over are code blocks, and a 600px reading column wraps
// them into noise.
//
// Still lazy-loaded: the prose here is only read by someone who came to import
// a build.

import { useCallback, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { BuildFileIntake } from "@/components/compose/BuildFileIntake";
import {
  BUILD_FILE_EXTENSIONS,
  useBuildFileDrop,
} from "@/components/compose/useBuildFileDrop";
import {
  FONT_STACK,
  HAIRLINE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  VOID,
  bodyText,
  cardGlass,
  hexToRgba,
  labelText,
  pageHeadingText,
  titleText,
} from "@/components/build/tokens";
import { SPACE } from "@/lib/theme/space";
import { measure } from "@/lib/theme/type";

/** Served from public/buildfile/. Both are plain Markdown, ~5 kB and ~2 kB. */
const EXTRACTOR_URL = "/buildfile/NEOSCALE_EXTRACTOR.md";
const COMPILER_URL = "/buildfile/NEOSCALE_COMPILER.md";

const EXTRACTOR_FILENAME = "NEOSCALE_EXTRACTOR.md";
const COMPILER_FILENAME = "NEOSCALE_COMPILER.md";

/** Long enough to read, short enough not to look stuck. */
const COPIED_MS = 2200;

/**
 * One kit document, fetched at most once.
 *
 * `load` is safe to call repeatedly: the resolved text short-circuits it and a
 * request already in flight is shared rather than duplicated, so a double click
 * on Copy is one request.
 */
function useKitDocument(url: string, enabled: boolean) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const inflight = useRef<Promise<string> | null>(null);

  const load = useCallback((): Promise<string> => {
    if (text !== null) return Promise.resolve(text);
    if (inflight.current) return inflight.current;

    const request = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`The server answered ${response.status}.`);
        return response.text();
      })
      .then((body) => {
        setText(body);
        setFailed(false);
        return body;
      })
      .catch((cause) => {
        // Cleared so a retry is a real retry rather than the same rejection.
        inflight.current = null;
        setFailed(true);
        throw cause;
      });

    inflight.current = request;
    return request;
  }, [text, url]);

  useEffect(() => {
    if (!enabled) return;
    // Rejection is already recorded as `failed`; the button reports it.
    void load().catch(() => undefined);
  }, [enabled, load]);

  return { text, failed, load };
}

/**
 * Put a string on the clipboard, or say it could not.
 *
 * The textarea path is the fallback for an insecure context and for browsers
 * without the async clipboard API. It appends its own throwaway element and
 * removes it again — nothing on the page is touched.
 */
async function writeToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Refused (permissions, no activation). The fallback below may still work.
  }

  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}

type CopyState = "idle" | "copied" | "failed";

function CopyDocumentButton({
  testId,
  label,
  document: kit,
}: {
  testId: string;
  label: string;
  document: ReturnType<typeof useKitDocument>;
}) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const settle = useCallback((next: CopyState) => {
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), COPIED_MS);
  }, []);

  const copy = useCallback(async () => {
    try {
      // Resolved already in the common case — the document was prefetched, so
      // this does not await the network and the user activation survives.
      const body = kit.text ?? (await kit.load());
      settle((await writeToClipboard(body)) ? "copied" : "failed");
    } catch {
      settle("failed");
    }
  }, [kit, settle]);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {/* VISUAL SLOT — the primary button surface is supplied externally.
          Structure only here: pill geometry, no surface. */}
      <span data-visual-slot="btn-primary" style={{ display: "inline-flex" }}>
        <button
          type="button"
          data-testid={testId}
          onClick={() => void copy()}
          style={{
            fontFamily: FONT_STACK,
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.04em",
            height: 34,
            padding: "0 18px",
            borderRadius: 100,
            background: "rgba(255,255,255,0.025)",
            border: `1px solid ${hexToRgba(TEAL, 0.32)}`,
            color: TEAL,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </button>
      </span>

      <span
        role="status"
        aria-live="polite"
        style={{
          ...labelText,
          color: state === "failed" ? TEXT_PRIMARY : TEAL,
          opacity: state === "idle" ? 0 : 1,
          transition: "opacity 120ms ease",
        }}
      >
        {state === "copied"
          ? "Copied"
          : state === "failed"
            ? "Could not copy — use the download"
            : ""}
      </span>
    </span>
  );
}

function DownloadLink({
  testId,
  href,
  filename,
}: {
  testId?: string;
  href: string;
  filename: string;
}) {
  return (
    <a
      {...(testId ? { "data-testid": testId } : {})}
      href={href}
      download={filename}
      style={{
        ...labelText,
        color: TEXT_SECONDARY,
        textDecoration: "underline",
        textUnderlineOffset: 3,
        whiteSpace: "nowrap",
      }}
    >
      Download the .md
    </a>
  );
}

/** One step: a numeral, a title, and whatever the step asks of the reader. */
function Step({
  ordinal,
  title,
  children,
}: {
  ordinal: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li
      data-visual-slot="import-step"
      style={{
        ...cardGlass,
        padding: 16,
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
      }}
    >
      <span
        aria-hidden
        style={{
          flex: "0 0 auto",
          width: 26,
          height: 26,
          borderRadius: 100,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 600,
          color: TEAL,
          background: hexToRgba(TEAL, 0.1),
          border: `1px solid ${hexToRgba(TEAL, 0.28)}`,
        }}
      >
        {ordinal}
      </span>

      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 style={{ ...titleText, margin: 0 }}>{title}</h2>
        {children}
      </div>
    </li>
  );
}

/**
 * Step three, live.
 *
 * A button rather than a styled div: the whole page already answers a drag, so
 * what this element adds is the other way in — clicking to choose a file — and
 * that has to work from a keyboard. The hidden input is the file picker; the
 * button is what a person sees and focuses.
 */
function DropTarget({
  isDragging,
  onFile,
}: {
  isDragging: boolean;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <button
        type="button"
        data-testid="import-drop"
        data-visual-slot="import-drop"
        onClick={() => inputRef.current?.click()}
        style={{
          fontFamily: "inherit",
          width: "100%",
          padding: "18px 14px",
          borderRadius: 12,
          border: `1px dashed ${isDragging ? hexToRgba(TEAL, 0.55) : HAIRLINE}`,
          background: isDragging ? hexToRgba(TEAL, 0.07) : "rgba(255,255,255,0.02)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          textAlign: "center",
          cursor: "pointer",
          transition: "background 120ms ease, border-color 120ms ease",
        }}
      >
        <span style={{ ...bodyText, color: isDragging ? TEAL : TEXT_SECONDARY }}>
          {isDragging ? "Let go to read it" : "Drag your Build File anywhere on this page"}
        </span>
        <span style={{ ...labelText, color: TEXT_MUTED }}>
          {`or click to choose one — ${BUILD_FILE_EXTENSIONS.join(", ")}, up to 2 MB`}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        data-testid="import-file-input"
        accept={BUILD_FILE_EXTENSIONS.join(",")}
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared so choosing the same file twice fires change both times.
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
    </>
  );
}

export default function ImportPage() {
  const [compilerOpen, setCompilerOpen] = useState(false);

  const extractor = useKitDocument(EXTRACTOR_URL, true);
  const compiler = useKitDocument(COMPILER_URL, compilerOpen);

  const drop = useBuildFileDrop();
  /** Reading, reviewing or refusing: the steps have been left behind. */
  const taking = drop.state.name !== "idle";

  return (
    /* ── BG-P15 — the page's own frame is gone.

       `minHeight: 100vh` went because the frame is 100dvh with its own scroll
       region, and a 100vh floor inside that scroller is a second screen of
       height. `fontFamily: FONT_STACK` went because `.fs-root` sets that exact
       Figtree stack already.

       The inner container's `maxWidth: 720` + `margin: "0 auto"` went as the
       doubled measure — the wide frame already caps and centres — and its
       `padding: "28px 20px 64px"` is replaced by one `SPACE.md` on this div,
       which is the padding a wide page carries because `.fs-page-body` has no
       horizontal inset of its own and the frame's own 24px collapses to 0 at
       phone width.

       `background: VOID` AND `color: TEXT_PRIMARY` STAY, as a pair, and this
       is the same answer /b2/:slug got rather than the one /gallery got. This
       page and everything under it — the steps, the drop target, the whole
       BuildFileIntake subtree in components/compose — are still painted from
       the legacy dark token module: white-alpha text with no opaque surface of
       its own under it (`cardGlass` is rgba(255,255,255,.025), a translucent
       film). Put that on an Exhibition-light ground and the page's entire body
       disappears; it was rendered and looked at, and it is not shippable. So
       the ground stays dark until the repaint, and the explicit text colour
       stays with it, because inheriting `--text` would put Exhibition's dark
       ink on that dark ground.

       VOID rather than dropping to the application's own centre ground: this
       page paints an inset drag ring across its whole surface, so it needs to
       BE a surface. See the handoff note — the repaint that retires the legacy
       module here retires both of these lines with it.

       `isolation: isolate` STAYS, and on this page it earns its place twice
       over: the drag ring is an inset shadow on this element, and the page is
       a drop target for the whole of itself. So does the boxShadow — it is the
       drag affordance, not frame decoration. ── */
    <div
      data-visual-slot="import-frame"
      style={{
        padding: SPACE.md,
        background: VOID,
        color: TEXT_PRIMARY,
        isolation: "isolate",
        // Visual only: an inset ring while a file is over the page, so the
        // whole surface reads as the target it is. No structural property here.
        boxShadow: drop.isDragging ? `inset 0 0 0 2px ${hexToRgba(TEAL, 0.4)}` : "none",
        transition: "box-shadow 120ms ease",
      }}
    >
      <Helmet>
        <title>Import a build — buildgallery</title>
        <meta
          name="description"
          content="Paste one document into the chat where you built your thing. The AI writes it up as a Build File, and you drop that file here."
        />
      </Helmet>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* BG-P15. The "← buildgallery" back link is deleted — the left rail
            carries the wordmark and the nav, and on a phone the bottom bar
            does. The <div> that held it goes with it, and the header is now
            the <h1> and its paragraph, which is all it ever was underneath.

            THIS IS NOT `PageHeader`, AND IT WAS MEANT TO BE. BG-P15 asked for
            an "IMPORT" eyebrow over "Post a build without writing it up", and
            it was built that way, rendered, and taken back out. PageHeader
            paints from the two-theme semantic tokens; this page and the whole
            BuildFileIntake subtree under it still paint from the legacy dark
            module. There is no ground that serves both: on `t.bg` the header
            is perfect and every step body vanishes into the light (verified —
            the steps sit on `cardGlass`, a 2.5%-white film, not an opaque
            surface), and on the dark ground the bodies are right and the
            header's `--text` is Exhibition ink on a dark room.

            So the page keeps the header it can paint, and PageHeader arrives
            here the day this page is repainted — which is the same day
            `VOID` and `TEXT_PRIMARY` leave the wrapper above. That repaint
            reaches into components/compose, which BG-P16 owns, so it is not
            this prompt's to do. /gallery took PageHeader because what it puts
            on a light ground is already repainted: PageHeader and GalleryCard.

            The header still disappears once a file is in hand — `taking` is
            true from the moment a Build File is being read, reviewed or
            refused, and the intake gets the page to itself. That behaviour is
            unchanged; only the back link above it is gone. */}
        {taking ? null : (
          <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h1 style={{ ...pageHeadingText, margin: 0 }}>
              Post a build without writing it up.
            </h1>
            <p style={{ ...bodyText, ...measure, margin: 0, color: TEXT_SECONDARY }}>
              The chat where you built the thing already knows what you did.
              Give it the document below and it writes your build up for you —
              the prompts you sent, the settings you landed on, what worked and
              what broke. You bring the file back here.
            </p>
          </header>
        )}

        {taking ? (
          <BuildFileIntake
            state={drop.state}
            onReset={drop.reset}
            /* The Extractor is a scroll away on this page, so the refusal
               shortcut returns to it rather than navigating to where it
               already is. */
            onCopyExtractor={drop.reset}
          />
        ) : (
          <>
          <ol
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <Step ordinal={1} title="Copy the Extractor">
              <p style={{ ...bodyText, ...measure, margin: 0, color: TEXT_SECONDARY }}>
                Paste it into the chat where you built your thing — ChatGPT,
                Claude, Lovable, Cursor, any of them.
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <CopyDocumentButton
                  testId="copy-extractor"
                  label="Copy the Extractor"
                  document={extractor}
                />
                <DownloadLink
                  testId="download-extractor"
                  href={EXTRACTOR_URL}
                  filename={EXTRACTOR_FILENAME}
                />
              </div>
              {extractor.failed ? (
                <p style={{ ...bodyText, ...measure, margin: 0, fontSize: 12, color: TEXT_MUTED }}>
                  The document could not be loaded. The download link still serves
                  it, and Copy will try again.
                </p>
              ) : null}
            </Step>

            <Step ordinal={2} title="Save what it gives you">
              <p style={{ ...bodyText, ...measure, margin: 0, color: TEXT_SECONDARY }}>
                The AI writes your build up as one file. Save it as a .md or .json
                file.
              </p>
            </Step>

            <Step ordinal={3} title="Drop it here">
              <DropTarget
                isDragging={drop.isDragging}
                onFile={(file) => void drop.acceptFile(file)}
              />
              <p style={{ ...bodyText, ...measure, margin: 0, fontSize: 12, color: TEXT_MUTED }}>
                You see what it found before anything is saved, and nothing is
                published until you say so.
              </p>
            </Step>
          </ol>

          {/* FOLDED, because it is the exception. Most builds happen in one chat,
              and a second document on the page unasked would read as a second
              required step rather than an answer to a rarer question. */}
          <section
            data-visual-slot="import-compiler"
            style={{
              ...cardGlass,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <button
              type="button"
              onClick={() => setCompilerOpen((open) => !open)}
              aria-expanded={compilerOpen}
              style={{
                ...titleText,
                fontFamily: "inherit",
                background: "transparent",
                border: "none",
                padding: 0,
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span aria-hidden style={{ color: TEXT_MUTED, fontSize: 12 }}>
                {compilerOpen ? "▾" : "▸"}
              </span>
              Built across more than one AI?
            </button>

            {compilerOpen ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ ...bodyText, ...measure, margin: 0, color: TEXT_SECONDARY }}>
                  Paste the Compiler plus every Build File into one chat; it merges
                  them into one.
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <CopyDocumentButton
                    testId="copy-compiler"
                    label="Copy the Compiler"
                    document={compiler}
                  />
                  <DownloadLink href={COMPILER_URL} filename={COMPILER_FILENAME} />
                </div>
                {compiler.failed ? (
                  <p style={{ ...bodyText, ...measure, margin: 0, fontSize: 12, color: TEXT_MUTED }}>
                    The document could not be loaded. The download link still
                    serves it, and Copy will try again.
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          <p style={{ ...bodyText, margin: 0, color: TEXT_MUTED }}>
            Would rather do it by hand?{" "}
            <Link
              to="/compose/new"
              style={{ color: TEAL, textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              Start a build from a transcript or an empty draft
            </Link>
            .
          </p>
          </>
        )}
      </div>
    </div>
  );
}
