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
// ── THE EDITOR BAR (Synth 05) ─────────────────────────────────────────────────
//
// A three-part grid `1fr auto 1fr`, 88 tall, on the Page shade: at the left a 44px round back button (a chevron and no
// text; its name says where it goes, "Back to Drafts", or "Back to <source build>" on a rebuild), in the centre the beaver
// on its own, at the right the account's avatar. Under it, in the same header, is the toolbar the workspace always had:
// the mode, the build's title, the save line and the route's own controls, and the theme control.
//
// The back button is a CONTROL and not a text link, because a creator who cannot find their way out of a full-screen
// editor panics. It is the only way out: the beaver and the avatar are pictures, not links, because a creator who is
// building should not be offered somewhere else to go.
//
// Styled inline like every other surface on this path, because Tailwind's generated utilities beat hand-written classes at
// build time (neoscale-ui RULE 1).

import type { CSSProperties, ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar } from "@/components/brand/Avatar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { useResolvedTheme } from "@/contexts/ThemeContext";
import {
  fieldStyle,
  ring,
  uiTransition,
  type ControlState,
} from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, eyebrow, label as labelType } from "@/lib/theme/type";
import { AVATAR_RADIUS } from "./AccountButton";
import { BeaverLogo } from "./BeaverLogo";
import { EDITOR_BACK_SIZE, EDITOR_BAR_HEIGHT, LOGO_WIDTH } from "./chromeSize";

/** The toolbar under the editor bar: the mode, the title, the save line, the route's controls and the theme control. */
export const WORKSPACE_TOOLBAR_HEIGHT = 43;

/**
 * The whole header's height, in pixels: the 88px editor bar and the 43px toolbar. The compose workspace is a flex column
 * whose panel row is `flex:1`, so nothing else may resize it — `WorkspaceBar.test.tsx` asserts the number and the e2e spec
 * measures the rendered box.
 */
export const WORKSPACE_BAR_HEIGHT = EDITOR_BAR_HEIGHT + WORKSPACE_TOOLBAR_HEIGHT;

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
 * denser than the ground on Noon, lighter than it on Dusk — so a panel
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
 * A card, a row, an inset group standing INSIDE a workspace panel.
 *
 * The flat counterpart to `cardGlass` (src/components/build/tokens.ts), which is
 * `--glass-2` over a `--glass-border` and is therefore glass — forbidden on a
 * working surface by the rule at the top of this file, whether or not it carries
 * a blur of its own. `--bg` inside a `--recess` panel steps the opposite way
 * from the panel's own step off the ground, so a card reads as an object ON the
 * panel in both rooms, and one `--line` hairline draws its edge.
 *
 * It lives here beside `workspacePanel` because this file is where the
 * workspace's flat vocabulary is kept, and five surfaces across compose needed
 * the same three declarations.
 */
export const workspaceCard: CSSProperties = {
  backgroundColor: t.bg,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: t.line,
  borderRadius: r.card,
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
   * Defaults to "Back to Drafts", which is true on compose and rebuild when the source build is not known.
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

/* ── The back button ──────────────────────────────────────────────────────── */

/**
 * The back button's paint, in every state.
 *
 * EXPORTED, AND TESTED AS AN OBJECT RATHER THAN THROUGH THE DOM. jsdom's CSS parser drops any colour-valued property whose
 * value is a bare `var()`, so `background-color: var(--control)` never reaches the rendered style attribute in a unit test
 * even though a browser paints it. Asserting the builder is how `controls.ts` handles the same problem.
 */
export function exitControlStyle(state: ControlState = {}): CSSProperties {
  const hot = Boolean(state.hovered);

  return {
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: EDITOR_BACK_SIZE,
    height: EDITOR_BACK_SIZE,
    padding: 0,
    borderRadius: r.full,
    /* Flat: the control's fill, and its edge, which is the one the hover darkens toward the text. No blur. */
    backgroundColor: t.control,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: hot ? t.text : t.controlBorder,
    color: t.text,
    textDecoration: "none",
    transition: uiTransition(),
    ...ring(state.focusVisible),
  };
}

function ExitControl({ exit }: { exit: WorkspaceExit }) {
  const navigate = useNavigate();
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  const hint = exit.hint ?? "Back to Drafts";

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
          <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
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
        /* BG-P23 — THE TITLE OUTRANKS BODY, because it is the one thing on the
           screen that names the work. 18 against a 16–17 body is one clear step
           up rather than the half-step 17 would be, and 600 weight clears the
           scale's floor for anything under 18. The height below is unchanged, so
           the bar is still WORKSPACE_BAR_HEIGHT — measured by the tier-3 spec at
           every width, which is what stops a type change from resizing the
           chrome the tray, tree and inspector share their pixels with. */
        fontSize: 15,
        fontWeight: 600,
        fontFamily: "inherit",
        flex: 1,
        /* Shrinks to nothing rather than holding 80px open: at a crowded width
           a narrower title field costs less than a clipped control. */
        minWidth: 0,
        /* 15, 26 and 0 7px since the UI-P55 density pass (18, 32, 0 10px). */
        height: 26,
        padding: "0 7px",
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

/** The signed-in reader's avatar, a picture and not a link. Nothing where there is no reader. */
function EditorAvatar() {
  const auth = useAuth();
  const user = auth?.user ?? null;
  if (!user) return null;
  const name = auth?.profile?.display_name || auth?.profile?.username || "User";
  return <Avatar size={32} userId={user.id} name={name} src={auth?.profile?.avatar_url} style={{ borderRadius: AVATAR_RADIUS }} />;
}

export function WorkspaceBar({ mode, exit, context, right }: WorkspaceBarProps) {
  const theme = useResolvedTheme();
  return (
    <header
      data-visual-slot="workspace-bar"
      data-testid="workspace-bar"
      data-workspace-mode={mode}
      style={{ backgroundColor: t.bg, flexShrink: 0, height: WORKSPACE_BAR_HEIGHT, display: "flex", flexDirection: "column" }}
    >
      <div
        data-testid="editor-bar"
        style={{ height: EDITOR_BAR_HEIGHT, flexShrink: 0, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "0 24px", boxSizing: "border-box" }}
      >
        <div style={{ justifySelf: "start" }}>
          <ExitControl exit={exit} />
        </div>
        <BeaverLogo theme={theme} size={LOGO_WIDTH} />
        <div style={{ justifySelf: "end", display: "flex" }}>
          <EditorAvatar />
        </div>
      </div>

      <div
        data-testid="workspace-toolbar"
        style={{
          ...workspaceHairline,
          height: WORKSPACE_TOOLBAR_HEIGHT,
          flexShrink: 0,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "0 10px",
          /* NOTHING IN THE BAR IS EVER UNREACHABLE, WHICH IS NOT THE SAME AS EVERYTHING FITTING. The toolbar's contents fit down
             to about 1000px and then run over: the workspace frame is `overflow: hidden`, so without this the controls at the
             right end, Publish among them, would be clipped off-screen rather than merely cramped. `overflow-x: auto` with
             `overflow-y: hidden` keeps the row exactly its height and makes the overrun scrollable instead of lost. */
          overflowX: "auto",
          overflowY: "hidden",
        }}
      >
        {/* Mode identity. Mono, because an eyebrow is data about the surface rather than prose on it. */}
        <span data-testid="workspace-mode" style={{ ...eyebrow, color: t.text2, flexShrink: 0 }}>
          {MODE_LABEL[mode]}
        </span>

        <Context context={context} />

        {right}

        {/* A creator may work in here for an hour. Changing rooms should not mean leaving the workspace to do it. */}
        <span style={{ flexShrink: 0, display: "inline-flex" }}>
          <ThemeToggle />
        </span>
      </div>
    </header>
  );
}

export default WorkspaceBar;
