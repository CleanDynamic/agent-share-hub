// The authoring workspace's chrome — one bar, four routes (BG-P16).
//
// WHY THE WORKSPACE KEEPS ITS OWN CHROME INSTEAD OF ENTERING THE FRAME.
// /compose/new, /compose/:buildId, /rebuild/:slug and /convert/:contentItemId
// render OUTSIDE `<Route element={<Layout />}>` and stay there. That is not an
// oversight carried forward: an authoring surface drops navigation the way
// Figma and Docs do, because a tray, a tree and an inspector cannot share a
// viewport with a left rail, a right rail and a mobile bottom bar, and because
// a creator who is building should not be offered somewhere else to go.
//
// WHAT WAS ACTUALLY WRONG was never that these routes left the frame. It was
// that leaving happened abruptly and looked like a different product: four
// routes, four bespoke outer containers, four different ways out — a
// "← buildgallery" text link on compose, "← Back to the build" on rebuild,
// "← Back to the post" on convert, and nothing at all on intake. This file is
// the one answer to all four, so the workspace reads as the same product in a
// different mode rather than as somewhere else entirely.
//
// ── THE WORKSPACE GROUND RULE ────────────────────────────────────────────────
//
//   READING SURFACES HAVE GLASS. WORKING SURFACES DO NOT.
//
//   The gallery, the build page, the feed and the auth cards are read, so they
//   carry `--glass`, a blur and depth. The authoring workspace — compose,
//   rebuild, convert — has NO GLASS AT ALL: ground `--bg`, panels `--recess`,
//   hairlines `--line`, and not one `backdrop-filter` anywhere in the chrome.
//
//   This is a deliberate distinction and not an oversight or a saving. In a
//   workspace the CONTENT is figure and the chrome is ground, so the chrome has
//   to recede further than it does on a surface that is only being looked at
//   (law-of-figure-ground). Depth competes with the work; flatness lets the
//   work carry. It is also the theme's own rule — buildgallery-theme, Glass:
//   "the authoring workspace has none at all: flat --recess and hairlines, so
//   the content carries."
//
//   So: no `backdropFilter`, no `panelGlass`, no `--glass*` token below this
//   line, and none in anything the four routes mount as chrome. A blurred
//   surface in here is a bug, not a taste.
//
// ── THE EXIT ─────────────────────────────────────────────────────────────────
//
// The exit is the reason this prompt exists, so it is a CONTROL and not a text
// link: a bordered box on `--recess`, the wordmark in the display face, a
// chevron, hover, keyboard focus and a tooltip naming the destination. A
// creator who cannot find their way out of a full-screen editor panics, and a
// four-word link in a crowded bar is not findable. Its border is `--text2`
// rather than the `--line` every other control here takes — 5.26:1 on
// Exhibition and 7.65:1 on Dusk, clearing the 3.0 floor for UI state, where
// `--line` on `--bg` measures 1.30 and 1.82 and would leave the one control
// nobody may miss reading as a label. It is also the tallest thing in the bar,
// which is the whole of its emphasis (von-restorff): one element differing from
// its neighbours, not a second primary action competing with Publish.
//
// Styled inline like every other surface on this path, because Tailwind's
// generated utilities beat hand-written classes at build time (neoscale-ui
// RULE 1).

import type { CSSProperties, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  fieldStyle,
  ring,
  uiTransition,
  type ControlState,
} from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { BODONI, FIGTREE, eyebrow, label as labelType } from "@/lib/theme/type";

/**
 * The bar's height, in pixels.
 *
 * FIFTY-TWO, WHICH IS THE NUMBER ComposeTopBar HAS CARRIED SINCE NS-P07 AND
 * MUST KEEP. The compose workspace is a flex column whose panel row is `flex:1`,
 * so every pixel this bar gains is a pixel the tray, the tree and the inspector
 * lose. BG-P16 repaints the bar and must not resize it — `WorkspaceBar.test.tsx`
 * asserts the number and the e2e spec measures the rendered box.
 */
export const WORKSPACE_BAR_HEIGHT = 52;

/** Which room of the workspace this is. Named in the bar's mono eyebrow. */
export type WorkspaceMode = "compose" | "rebuild" | "convert";

const MODE_LABEL: Record<WorkspaceMode, string> = {
  compose: "COMPOSE",
  rebuild: "REBUILD",
  convert: "CONVERT",
};

/**
 * The workspace ground: `--bg`, the body face, and the live theme's ink.
 *
 * Spread onto each route's outer container. It carries no `position`, `inset`,
 * `display` or `padding` — those belong to the route, which knows whether it is
 * a fixed three-panel workspace or a document that scrolls.
 */
export const workspaceGround: CSSProperties = {
  backgroundColor: t.bg,
  color: t.text,
  fontFamily: FIGTREE,
};

/**
 * A panel standing on the workspace ground: `--recess` with a `--line` hairline.
 *
 * The step from `--bg` to `--recess` goes the same direction in both rooms —
 * denser than the ground on Exhibition, lighter than it on Dusk — so a panel
 * reads as one object in both. No blur, by the rule at the top of this file.
 */
export const workspacePanel: CSSProperties = {
  backgroundColor: t.recess,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: t.line,
  borderRadius: r.panel,
};

/**
 * The hairline the workspace separates anything with.
 *
 * LONGHANDS RATHER THAN THE `border: 1px solid var(--line)` SHORTHAND, here and
 * throughout this file. A CSS shorthand whose value contains a `var()` is
 * dropped wholesale by jsdom's parser, so a shorthand written that way is
 * invisible to every unit test in this project even though a browser paints it
 * — which is how an untested repaint slips through. `controls.ts` takes the
 * same position for the same reason.
 */
export const workspaceHairline: CSSProperties = {
  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: t.line,
};

export interface WorkspaceExit {
  /** Where "buildgallery" goes. */
  to: string;
  /**
   * The tooltip, which must name the ACTUAL destination.
   *
   * Defaults to "Back to the gallery", which is true on compose and rebuild.
   * Convert overrides it, because convert's exit goes to the post being
   * converted rather than to /gallery — see ConvertPrompt. A tooltip that named
   * a page the control does not open would be worse than no tooltip at all.
   */
  hint?: string;
  /**
   * A route's own unsaved-changes guard. Return false to cancel the exit.
   *
   * NO ROUTE SUPPLIES ONE TODAY, and BG-P16 deliberately did not invent one.
   * The compose workspace autosaves — `useComposeBuild` owns `isSaving` and
   * `lastSavedAt`, and the bar reports both — so there is no unsaved state for a
   * guard to protect; rebuild and convert write nothing until their one button
   * is pressed. The hook is here so that the prompt which DOES add a guard adds
   * it in one place rather than four.
   */
  confirm?: () => boolean;
}

/**
 * The context: which build this is.
 *
 * Editable on compose, where the title is the creator's to set and the bar is
 * where they set it. Read-only everywhere else, because rebuild and convert are
 * naming a record that already exists and is not theirs to rename here.
 */
/*
 * A STRING DISCRIMINANT RATHER THAN `editable: true | false`, and that is a
 * compiler constraint rather than a preference: this project compiles with
 * `strict: false`, so `strictNullChecks` is off and TypeScript will not narrow a
 * union on a boolean literal discriminant. `kind` narrows either way.
 */
export type WorkspaceContext =
  | {
      kind: "editable";
      value: string;
      onChange: (next: string) => void;
      /** The accessible name for the field. */
      label: string;
      placeholder?: string;
    }
  | { kind: "readonly"; text: string | null };

export interface WorkspaceBarProps {
  mode: WorkspaceMode;
  exit: WorkspaceExit;
  /** Omitted where the route has no record to name yet. */
  context?: WorkspaceContext;
  /**
   * The mode-specific right side. The theme toggle is appended after it by this
   * component, so a caller never supplies one.
   */
  right?: ReactNode;
}

/* ── The exit ──────────────────────────────────────────────────────────────── */

/** The chevron. Inline rather than an icon import, so the bar adds no bytes to
 *  the four lazy chunks that mount it. `currentColor`, so it follows the label
 *  through every state without a second colour decision. */
function Chevron() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

/**
 * The exit's paint, in every state.
 *
 * EXPORTED, AND TESTED AS AN OBJECT RATHER THAN THROUGH THE DOM. jsdom's CSS
 * parser drops any colour-valued property whose value is a bare `var()`, so
 * `background-color: var(--recess)` never reaches the rendered style attribute
 * in a unit test even though a browser paints it. Asserting the builder is how
 * `controls.ts` handles the same problem; the e2e spec then measures the
 * computed values in a real browser, which is the half jsdom cannot do.
 */
export function exitControlStyle(state: ControlState = {}): CSSProperties {
  const hot = Boolean(state.hovered);

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    flexShrink: 0,
    /* Taller than every other control in the bar (30–32px), which is the whole
       of its emphasis: one element differing from its neighbours, not a second
       primary action competing with Publish. */
    height: 36,
    padding: "0 13px 0 10px",
    borderRadius: r.control,
    /* Flat. --recess on --bg, no blur — the ground rule at the top. */
    backgroundColor: hot ? t.line : t.recess,
    /* --text2 rather than --line: the one control here that must read as a
       control at a glance. 5.26:1 Exhibition, 7.65:1 Dusk, against --line's
       1.30 and 1.82 which are under the 3.0 floor for UI state. */
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: hot ? t.text : t.text2,
    color: t.text,
    textDecoration: "none",
    transition: uiTransition(),
    ...ring(state.focusVisible),
  };
}

function ExitControl({ exit }: { exit: WorkspaceExit }) {
  const navigate = useNavigate();
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  const hint = exit.hint ?? "Back to the gallery";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={exit.to}
          data-testid="workspace-exit"
          data-visual-slot="workspace-exit"
          aria-label={hint}
          onClick={(event) => {
            // Only a route that supplied a guard can cancel. Nothing does yet.
            if (!exit.confirm || exit.confirm()) return;
            event.preventDefault();
          }}
          onKeyDown={(event) => {
            // A Link is an anchor, so Enter already navigates; Space does not,
            // and a control this size reads as a button to anyone who presses it.
            if (event.key !== " ") return;
            event.preventDefault();
            if (exit.confirm && !exit.confirm()) return;
            navigate(exit.to);
          }}
          {...handlers}
          style={exitControlStyle(state)}
        >
          <Chevron />
          {/* The wordmark, in the display face. Twenty is the theme's display
              floor and the smallest Bodoni Moda may ever be set — below it the
              hairlines break up, worst on Dusk. The rails set it at 22; a
              control inside a 52px bar takes the floor instead. */}
          <span
            style={{
              fontFamily: BODONI,
              fontSize: 20,
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
            }}
          >
            buildgallery
          </span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom">{hint}</TooltipContent>
    </Tooltip>
  );
}

/* ── The context ───────────────────────────────────────────────────────────── */

function EditableContext({
  context,
}: {
  context: Extract<WorkspaceContext, { kind: "editable" }>;
}) {
  const { state, handlers } = useInteractive<HTMLInputElement>();

  return (
    <input
      data-testid="workspace-context"
      aria-label={context.label}
      value={context.value}
      onChange={(event) => context.onChange(event.target.value)}
      placeholder={context.placeholder}
      spellCheck={false}
      {...handlers}
      style={{
        ...fieldStyle(state),
        ...labelType,
        fontSize: 15,
        fontWeight: 600,
        fontFamily: "inherit",
        flex: 1,
        minWidth: 80,
        height: 32,
        padding: "0 10px",
        outline: state.focusVisible ? undefined : "none",
      }}
    />
  );
}

function ReadOnlyContext({ text }: { text: string | null }) {
  if (!text) return null;

  return (
    <span
      data-testid="workspace-context"
      title={text}
      style={{
        ...labelType,
        fontSize: 15,
        fontWeight: 600,
        color: t.text,
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

/**
 * Whichever context the route supplied, or a spacer.
 *
 * A separate component rather than a ternary in the bar so that TypeScript
 * narrows the union once, on a parameter, instead of on an optional property
 * access that does not discriminate.
 */
function Context({ context }: { context?: WorkspaceContext }) {
  if (!context) return <span style={{ flex: 1 }} />;
  if (context.kind === "editable") return <EditableContext context={context} />;
  return <ReadOnlyContext text={context.text} />;
}

/* ── The bar ───────────────────────────────────────────────────────────────── */

export function WorkspaceBar({ mode, exit, context, right }: WorkspaceBarProps) {
  return (
    <header
      data-visual-slot="workspace-bar"
      data-testid="workspace-bar"
      data-workspace-mode={mode}
      style={{
        /* The bar IS the ground, separated from the work by one hairline. That
           is the most a chrome band may assert in a workspace. */
        backgroundColor: t.bg,
        ...workspaceHairline,
        height: WORKSPACE_BAR_HEIGHT,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 14px",
      }}
    >
      <ExitControl exit={exit} />

      <span
        aria-hidden
        style={{ width: 1, height: 20, backgroundColor: t.line, flexShrink: 0 }}
      />

      {/* Mode identity. Mono, because an eyebrow is data about the surface
          rather than prose on it. --text2 on --bg: 5.26 Exhibition, 7.65 Dusk. */}
      <span
        data-testid="workspace-mode"
        style={{ ...eyebrow, color: t.text2, flexShrink: 0 }}
      >
        {MODE_LABEL[mode]}
      </span>

      <Context context={context} />

      {right}

      {/* A creator may work in here for an hour. Changing rooms should not mean
          leaving the workspace to do it. */}
      <span style={{ flexShrink: 0, display: "inline-flex" }}>
        <ThemeToggle />
      </span>
    </header>
  );
}

export default WorkspaceBar;
