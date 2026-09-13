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
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { UI_EASING, UI_MS } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { SPACE } from "@/lib/theme/space";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import {
  body as bodyText,
  cardTitle,
  data as dataText,
  label as labelText,
  measure,
} from "@/lib/theme/type";

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
          transition: `opacity ${UI_MS}ms ${UI_EASING}`,
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
        Download the .md
      </a>
    </Button>
  );
}

/**
 * One step: a numeral, a title, and whatever the step asks of the reader.
 *
 * BG-P24 — A `--recess` PANEL, NOT A GLASS CARD.
 *
 * The steps were `cardGlass`: a 2.5%-white film over a glass border, which is
 * a reading-surface treatment and which on an Exhibition ground is very nearly
 * nothing at all. `--recess` is the token for a surface the page is cut into,
 * and three panels cut into the page is exactly what three steps are. At
 * `--r-panel`, because that is the step of the scale a panel takes.
 *
 * THE NUMERAL IS MONO AND CIRCULAR. A step number is a count — the theme's own
 * list of what the data face sets — and `--r-full` is legal on it because a
 * circle is one of the two things that token is for. It carries the part-list
 * `--text2` on a `--bg` well rather than a teal tint: the numbers are a spine
 * for the eye to follow, not three accents competing with the drop target.
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
        backgroundColor: t.recess,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: t.line,
        borderRadius: r.panel,
        padding: 16,
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
      }}
    >
      <span
        aria-hidden
        data-testid={`import-step-${ordinal}`}
        style={{
          ...dataText,
          flex: "0 0 auto",
          width: 26,
          height: 26,
          borderRadius: r.full,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: t.text2,
          backgroundColor: t.bg,
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: t.line,
        }}
      >
        {ordinal}
      </span>

      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {/* The display face, at the card-title size — 22px, which clears the
            20px floor Bodoni may never render below. */}
        <h2 style={{ ...cardTitle, color: t.text, margin: 0 }}>{title}</h2>
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
      <button
        type="button"
        data-testid="import-drop"
        data-visual-slot="import-drop"
        data-drop-state={isDragging ? "over" : hovered ? "hover" : "idle"}
        onClick={() => inputRef.current?.click()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          fontFamily: "inherit",
          width: "100%",
          padding: "18px 14px",
          borderRadius: r.control,
          /* Longhands: a `border` shorthand carrying a `var()` is dropped whole
             by jsdom, taking the dashes with it. */
          borderWidth: isDragging ? 1.5 : 1,
          borderStyle: "dashed",
          borderColor: armed ? t.action : t.line,
          backgroundColor: isDragging
            ? tokenAlpha("action", 0.12)
            : hovered
              ? tokenAlpha("action", 0.06)
              : t.bg,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          textAlign: "center",
          cursor: "pointer",
          transition: `background-color ${UI_MS}ms ${UI_EASING}, border-color ${UI_MS}ms ${UI_EASING}`,
        }}
      >
        <span style={{ ...bodyText, color: armed ? t.action : t.text }}>
          {isDragging ? "Let go to read it" : "Drag your Build File anywhere on this page"}
        </span>
        {/* The formats and the cap in mono, because they are the file's facts
            rather than an instruction. */}
        <span style={{ ...dataText, color: t.text2 }}>
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
    /* ── BG-P15 put this page inside the application frame. BG-P24 finishes
       the job that note deferred.

       `minHeight: 100vh` went because the frame is 100dvh with its own scroll
       region, and a 100vh floor inside that scroller is a second screen of
       height. `fontFamily` went because `.fs-root` sets the Figtree stack
       already. The inner container's `maxWidth: 720` + `margin: "0 auto"` went
       as the doubled measure — the wide frame already caps and centres — and
       its padding is one `SPACE.md` on this div, because `.fs-page-body` has
       no horizontal inset of its own and the frame's own 24px collapses to 0
       at phone width.

       THE GROUND AND THE INK STAY EXPLICIT, AND THEY ARE TOKENS NOW. BG-P15
       left them as `VOID`/`TEXT_PRIMARY` with a note saying this page and the
       whole BuildFileIntake subtree under it were still painted from the
       legacy dark module, so a light ground would make the body of the page
       disappear. That subtree is repainted as of this prompt, and BG-P21
       repointed both constants at `--bg` and `--text` in any case. What
       remains is the reason the ground had to be stated at all, which never
       had anything to do with the legacy module: this page paints an inset
       drag ring across its WHOLE surface, so it has to BE a surface.

       `isolation: isolate` STAYS and earns its place twice over: the drag ring
       is an inset shadow on this element, and the page is a drop target for
       the whole of itself. So does the boxShadow — it is the drag affordance,
       not frame decoration, and it is `--action` now, the same accent the drop
       target arms with, so the page and the well agree about what is
       happening. ── */
    <div
      data-visual-slot="import-frame"
      style={{
        padding: SPACE.md,
        backgroundColor: t.bg,
        color: t.text,
        isolation: "isolate",
        // Visual only: an inset ring while a file is over the page, so the
        // whole surface reads as the target it is. No structural property here.
        boxShadow: drop.isDragging
          ? `inset 0 0 0 2px ${tokenAlpha("action", 0.45)}`
          : "none",
        transition: `box-shadow ${UI_MS}ms ${UI_EASING}`,
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
        {/* BG-P15 deleted the "← buildgallery" back link — the left rail
            carries the wordmark and the nav, and on a phone the bottom bar
            does — and then had to hand-roll the heading that was left,
            because PageHeader paints from the two-theme semantic tokens while
            this page and the whole BuildFileIntake subtree under it still
            painted from the legacy dark module. There was no ground that
            served both.

            BG-P24 REPAINTS THAT SUBTREE, so the header PageHeader was written
            for arrives with it. The eyebrow is what kind of page this is, the
            title is what the page is, and the description is the promise —
            capped at the reading measure by the component rather than by a
            `measure` spread written here.

            It still disappears once a file is in hand: `taking` is true from
            the moment a Build File is being read, reviewed or refused, and the
            intake gets the page to itself. */}
        {taking ? null : (
          <PageHeader
            eyebrow="Import"
            title="Post a build without writing it up."
            description={
              <>
                The chat where you built the thing already knows what you did.
                Give it the document below and it writes your build up for you —
                the prompts you sent, the settings you landed on, what worked and
                what broke. You bring the file back here.
              </>
            }
          />
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
              <p style={{ ...bodyText, ...measure, margin: 0, color: t.text2 }}>
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
                /* A refusal names the way out. Breakage red as TEXT is legal
                   on both grounds — the theme measures every category hue at
                   ≥4.83:1 on Exhibition and ≥5.75:1 on Dusk. */
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
              <p style={{ ...bodyText, ...measure, margin: 0, color: t.text2 }}>
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
              /* The same `--recess` panel the three steps take, because the
                 fold is a fourth thing of the same kind — an answer to a rarer
                 question, not a different sort of object. */
              backgroundColor: t.recess,
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: t.line,
              borderRadius: r.panel,
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
                /* The body face at label weight rather than the display face:
                   this is a control that opens a fold, and Bodoni on a button
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
                gap: 8,
              }}
            >
              <span aria-hidden style={{ ...dataText, color: t.text2 }}>
                {compilerOpen ? "▾" : "▸"}
              </span>
              Built across more than one AI?
            </button>

            {compilerOpen ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ ...bodyText, ...measure, margin: 0, color: t.text2 }}>
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
