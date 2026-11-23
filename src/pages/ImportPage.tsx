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
// to offer somewhere else to go.
//
// IT UNDER-FILLS THE WIDE CENTRE, which is recorded rather than fixed. The
// steps below were authored against the 720px column this page used to cap
// itself at; in a ~1090px centre the step cards stretch to the full width
// while their contents keep that measure, so every step has a band of empty
// card to its right. Nothing overflows and nothing is illegible. BG-P15 moves
// all three routes into wide mode as one change and forbids re-laying out the
// pages it moves, so the fix — a measure on the step list, or this route
// going back to standard — belongs to whoever owns this page next.
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
import { DropField } from "@/components/brand/DropField";
import { Button } from "@/components/ui/button";

import { r } from "@/lib/theme/radius";
import { SPACE_COMPACT } from "@/lib/theme/space";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { body as bodyText, data as dataText, hero, label as labelText, measure } from "@/lib/theme/type";
import { ChevronDown, ChevronRight } from "lucide-react";
import { fade, feedback } from "@/lib/theme/motion";
import { SITE_NAME } from "@/lib/site";

/*  THE TWO KIT DOCUMENTS (BG-P24, renamed by UX-14).
 *
 *  Served from public/buildfile/. Both are plain Markdown, ~5 kB and ~2 kB.
 *
 *  THEY ARE CALLED OPENBUILDS NOW, AND ONLY THAT NAME SERVES. UX-14 renamed the
 *  site to OpenBuilds.ai and the Build File with it: the documents are
 *  OPENBUILDS_EXTRACTOR.md and OPENBUILDS_COMPILER.md, the key inside the format
 *  is `openbuilds_build` and a saved file ends `.openbuilds.md`. The earlier
 *  BUILDGALLERY_* and NEOSCALE_* files were deleted; only Miles had used them.
 *  The importer still reads the older `neoscale_build` key (buildfile.ts), so his
 *  earlier exports import. buildfileDocuments.test.ts holds all of this. */
const EXTRACTOR_URL = "/buildfile/OPENBUILDS_EXTRACTOR.md";
const COMPILER_URL = "/buildfile/OPENBUILDS_COMPILER.md";

const EXTRACTOR_FILENAME = "OPENBUILDS_EXTRACTOR.md";
const COMPILER_FILENAME = "OPENBUILDS_COMPILER.md";

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
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      {/* BG-P24 — THE KIT'S SECONDARY BUTTON.
          Copying the Extractor is the page's own first step, but the page's
          one PRIMARY is the drop target below: this is how you get the file,
          that is where the file lands, and only one of the two can be the
          thing the eye goes to first. So both controls in this row are
          secondary — glass over a `--line` border at `--r-control` — rather
          than the 999px teal-outlined capsule this was. */}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        data-testid={testId}
        onClick={() => void copy()}
        style={{ whiteSpace: "nowrap" }}
      >
        {label}
      </Button>

      <span
        role="status"
        aria-live="polite"
        style={{
          ...labelText,
          /* A failure names the way out and must be readable; a success is a
             confirmation and can be quiet. Neither is amber, which the theme
             forbids as type on a light ground. */
          color: state === "failed" ? t.catBreakage : t.evidence,
          opacity: state === "idle" ? 0 : 1,
          transition: fade(),
        }}
      >
        {state === "copied"
          ? "Copied"
          : state === "failed"
            ? "Could not copy. Use the download."
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
    /* The same secondary treatment as Copy beside it: the two are alternatives
       to each other — clipboard or file — and an underlined text link next to
       a button reads as the lesser of two things rather than as the other one.
       `asChild` keeps it a real anchor, so `download` still works and the
       browser still offers it to a right-click. */
    <Button asChild variant="outline" size="sm">
      <a
        {...(testId ? { "data-testid": testId } : {})}
        href={href}
        download={filename}
        style={{ whiteSpace: "nowrap" }}
      >
        Download
      </a>
    </Button>
  );
}

/**
 * One step (Synth 10): a 28 box holding the number in mono, then the step's heading (17/600) and whatever the step asks
 * of the reader. No panel and no lines: the steps are a list on the page, 24 apart.
 */
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
        display: "grid",
        gridTemplateColumns: "28px minmax(0, 1fr)",
        columnGap: 12,
        alignItems: "start",
      }}
    >
      <span
        aria-hidden
        data-testid={`import-step-${ordinal}`}
        style={{
          ...dataText,
          width: 28,
          height: 28,
          borderRadius: r.card,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: t.text,
          backgroundColor: t.module,
        }}
      >
        {ordinal}
      </span>

      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 style={{ margin: 0, fontFamily: bodyText.fontFamily, fontSize: 17, fontWeight: 600, lineHeight: "22px", color: t.text }}>{title}</h2>
        {children}
      </div>
    </li>
  );
}

/**
 * Step three, live — and the visual anchor of the whole page.
 *
 * A button rather than a styled div: the whole page already answers a drag, so
 * what this element adds is the other way in — clicking to choose a file — and
 * that has to work from a keyboard. The hidden input is the file picker; the
 * button is what a person sees and focuses.
 *
 * BG-P24 — IT HAS TO READ AS DROPPABLE BEFORE ANYTHING IS DRAGGED AT IT.
 *
 * `critique-affordance` asks what on a screen looks like it will accept an
 * action. A dashed edge is the one border style that says "something goes
 * here" rather than "this is a thing" — it is the same grammar the gap marker
 * spends on a part deliberately left unsolved — so the resting state is a
 * DASHED `--line` edge over a `--recess` ground. Recess is the token for a
 * surface the page is cut into, which is what a well you drop something into
 * is, and it steps the target away from the `--recess` panel around it by
 * sitting on `--bg` when idle: a well inside a well is not a well.
 *
 * THREE STATES, AND THE LAST TWO ARE THE SAME COLOUR ON PURPOSE. Resting is
 * quiet. HOVER brightens the edge to `--action` and washes the ground with it,
 * so a pointer discovers the target before it commits. DRAG-OVER is the same
 * accent at full strength with a 1.5px edge and the copy changing to "Let go
 * to read it" — the same signal, turned up, rather than a different one, so
 * the thing a creator learned on hover is the thing they see when it matters.
 *
 * The accent rather than `--evidence`: this is where the page wants you to go.
 * `--lit` would have been the obvious "highlight" choice and is forbidden —
 * amber is light on this system, never a border that carries state on a light
 * ground.
 */
function DropTarget({
  isDragging,
  onFile,
}: {
  isDragging: boolean;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [hovered, setHovered] = useState(false);

  /** Drag-over outranks hover: a file in hand is the stronger fact. */
  const armed = isDragging || hovered;

  return (
    <>
      <DropField
        as="button"
        type="button"
        data-testid="import-drop"
        data-visual-slot="import-drop"
        data-drop-state={isDragging ? "over" : hovered ? "hover" : "idle"}
        armed={armed}
        over={isDragging}
        onClick={() => inputRef.current?.click()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          fontFamily: "inherit",
          width: "100%",
          padding: "24px 16px",
          backgroundColor: isDragging ? tokenAlpha("action", 0.12) : hovered ? tokenAlpha("action", 0.06) : "transparent",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          textAlign: "center",
          cursor: "pointer",
          transition: feedback("background-color", "border-color"),
        }}
      >
        <span style={{ ...bodyText, color: armed ? t.action : t.text }}>
          {isDragging ? "Let go to read it" : "Drag your Build File anywhere on this page"}
        </span>
        {/* The formats and the cap, because they are the file's facts rather than an instruction. */}
        <span style={{ ...dataText, color: t.label }}>
          {`or click to choose one. ${BUILD_FILE_EXTENSIONS.join(", ")}, up to 2 MB`}
        </span>
      </DropField>

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
    /* The page sits in the frame's one panel. This element is the whole surface: it paints the inset drag ring (the page
       is a drop target for the whole of itself), so it has to BE a surface, and isolates so the ring stays under what is
       drawn on it. The column inside is 680 wide at every desktop width, centred. */
    <div
      data-visual-slot="import-frame"
      style={{
        padding: `${SPACE_COMPACT.md}px 0`,
        color: t.text,
        isolation: "isolate",
        // Visual only: an inset ring while a file is over the page, so the whole surface reads as the target it is.
        boxShadow: drop.isDragging
          ? `inset 0 0 0 2px ${tokenAlpha("action", 0.45)}`
          : "none",
        // BG-P32: the inset ring lands at once. It answers a drag already in progress, so there is nothing for a fade to tell the reader.
        transition: undefined,
      }}
    >
      <Helmet>
        <title>{`Import a build · ${SITE_NAME}`}</title>
        <meta
          name="description"
          content="Paste one document into the chat where you built your thing. The AI writes it up as a Build File, and you drop that file here."
        />
      </Helmet>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 24,
          maxWidth: 680,
          margin: "0 auto",
          padding: `0 ${SPACE_COMPACT.md}px`,
        }}
      >
        {/* It disappears once a file is in hand: `taking` is true from the moment a Build File is being read, reviewed or
            refused, and the intake gets the page to itself. */}
        {taking ? null : (
          <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h1 style={{ ...hero, margin: 0, color: t.text }}>Import a Build File</h1>
            <p style={{ ...bodyText, ...measure, margin: 0, color: t.text2 }}>Post a build without writing it up.</p>
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
              gap: 24,
            }}
          >
            <Step ordinal={1} title="Copy the Extractor">
              <p style={{ ...bodyText, ...measure, margin: 0, color: t.text2 }}>
                Paste it into the chat where you built your thing.
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
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
                /* A refusal names the way out. Breakage red as TEXT is legal
                   on both grounds — the theme measures every category hue at
                   ≥4.83:1 on Noon and ≥5.75:1 on Dusk. */
                <p
                  role="status"
                  style={{ ...dataText, ...measure, margin: 0, color: t.catBreakage }}
                >
                  The document could not be loaded. The download link still serves
                  it, and Copy will try again.
                </p>
              ) : null}
            </Step>

            <Step ordinal={2} title="Save what it gives you">
              <p style={{ ...bodyText, ...measure, margin: 0, color: t.text2 }}>
                The AI writes your build up as one file. Save it as a .md or .json
                file.
              </p>
            </Step>

            <Step ordinal={3} title="Drop it here">
              <DropTarget
                isDragging={drop.isDragging}
                onFile={(file) => void drop.acceptFile(file)}
              />
              {/* The sentence that does the most work on this page: NOTHING
                  AUTO-PUBLISHES, and the creator stays between the file and
                  the record. It is quiet because it is a reassurance, not an
                  instruction. */}
              <p style={{ ...dataText, ...measure, margin: 0, color: t.label }}>
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
                /* The body face at label weight rather than the display face:
                   this is a control that opens a fold, and Sentient on a button
                   reads as a heading that happens to be clickable. */
                ...bodyText,
                fontWeight: 500,
                fontFamily: "inherit",
                color: t.text,
                background: "transparent",
                borderWidth: 0,
                borderStyle: "none",
                padding: 0,
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span aria-hidden style={{ display: "inline-flex", color: t.label }}>
                {compilerOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
              Built across more than one AI?
            </button>

            {compilerOpen ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <p style={{ ...bodyText, ...measure, margin: 0, color: t.text2 }}>
                  Paste the Compiler plus every Build File into one chat; it merges
                  them into one.
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
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
                  <p
                    role="status"
                    style={{ ...dataText, ...measure, margin: 0, color: t.catBreakage }}
                  >
                    The document could not be loaded. The download link still
                    serves it, and Copy will try again.
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          <p style={{ ...bodyText, margin: 0, color: t.text2 }}>
            Would rather do it by hand?{" "}
            <Link
              to="/compose/new"
              /* `--action`, like every other link out of this page: the accent
                 is where the site says "go here", and `--evidence` means
                 something else entirely — that a thing was reproduced. */
              style={{ color: t.action, textDecoration: "underline", textUnderlineOffset: 3 }}
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
