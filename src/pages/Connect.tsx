// EX-P17 — /connect, how to add the buildgallery connector to each AI tool.
//
// WHY THIS PAGE EXISTS. The connector is an MCP server at one address, and an
// address on its own tells nobody what to do with it. Every AI tool adds a
// connector somewhere different, so this page is one panel per tool with the
// steps for that tool, four things worth saying once it is connected, and one
// paragraph that is plain about what the connector does with a conversation.
//
// OUTSIDE THE APPLICATION FRAME, LAZY, LIKE /oauth/consent. It is registered in
// App.tsx after `<Route element={<Layout />}>` closes, beside the consent screen
// the AI tool sends a visitor on to, so there is no left rail, no right rail and
// no mobile bottom bar. These are instructions for a job done inside somebody
// else's product, read alongside it; the wordmark at the top is the way home.
// It is its own chunk, so a reader who never connects a tool never pays for it.
//
// EVERY PANEL STARTS CLOSED. A creator uses one tool, and four sets of steps
// open at once are three sets to read past. Each panel is a heading wrapping a
// button — the WAI-ARIA disclosure — so a screen reader can move through the
// tools by heading and hear which one is open.
//
// GLASS PANELS, AND THE REASON IS MEASURED. This is a reading surface, which the
// theme gives glass, and the panels carry links and a "Copied" confirmation. On
// `--recess` those fail the 4.5:1 text floor in Exhibition — `--action` measures
// 4.15:1 and `--evidence` 4.23:1 — while on `--glass` over `--bg` every colour
// this page spends clears it in both rooms (the lowest is `--cat-breakage` on
// Dusk, 4.66:1). The address and the command sit in `--recess` wells inside the
// panels, which is that token's job, and nothing but `--text` is set on them
// (11.33:1 and 10.62:1). Eight blurred surfaces, none nested: the Copy button's
// `--glass` fill carries no backdrop filter.
//
// THE STEPS ARE THE TOOLS' OWN, AS THEY READ ON 23 SEP 2026. Claude's follow
// Anthropic's help page (last updated 11 Aug 2026), which moved custom
// connectors from Settings to Customize. No step says what a plan does or does
// not include — that page is linked for it. ChatGPT and Cursor are linked
// rather than restated, because their settings move and a copy of their steps
// here would be the first thing on the page to go stale.
//
// EVERYTHING HERE IS PUBLIC. The page reads nothing and needs no sign-in: the
// sign-in happens later, on the consent screen, when the AI tool asks for it.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { GLASS_BLUR } from "@/lib/theme/controls";
import { elevation } from "@/lib/theme/elevation";
import { focusRing } from "@/lib/theme/focus";
import { useInteractive } from "@/lib/theme/interactive";
import { fade } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import {
  BODONI,
  body as bodyText,
  bodyLarge,
  cardTitle,
  data as dataText,
  label as labelText,
  measure,
} from "@/lib/theme/type";

/**
 * The connector's address: the live project's `mcp` edge function.
 *
 * Written out rather than derived from the Supabase client's URL, because this
 * is the string a creator pastes into another product and it has to be the live
 * project's in every build of the site, including a local one pointed elsewhere.
 * `public/ai.txt` carries the same string; the tier-3 spec holds the two
 * together.
 */
const CONNECTOR_URL = "https://zybdotagjwektucfdkri.supabase.co/functions/v1/mcp";

/** The one line Claude Code needs. Built from the address, never retyped. */
const CLAUDE_CODE_COMMAND = `claude mcp add --transport http buildgallery ${CONNECTOR_URL}`;

/* Each tool's own help, linked rather than restated. */
const ANTHROPIC_CONNECTORS_HELP =
  "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp";
const OPENAI_DEVELOPER_MODE_HELP =
  "https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt";
const CURSOR_MCP_DOCS = "https://cursor.com/docs/mcp";

/**
 * Four sentences a creator can copy, each with what it does.
 *
 * THE SECOND LINE IS A PROMISE AND IS WRITTEN TO THE TOOLS. Each says what the
 * connector's own tool does when a model hears the sentence — begin, append and
 * finish; list_drafts; begin_import with a target_build_id; list_imports and
 * get_import_status — and no more than that. In particular the third says the
 * draft is CHOSEN, not that the conversation is added to it: the creator still
 * confirms, and can change the destination, on the upload page.
 */
const EXAMPLES = [
  {
    say: "put this conversation on buildgallery",
    does: "Sends the whole conversation to your upload page, where it waits for you to review it.",
  },
  {
    say: "what drafts do I have on buildgallery?",
    does: "Lists your unpublished drafts, most recently worked on first.",
  },
  {
    say: "add this conversation to my [title] draft",
    does:
      "Put your draft's name in place of [title]. The conversation arrives with that draft " +
      "already chosen; you confirm it, or pick another, on the upload page.",
  },
  {
    say: "did my last upload arrive?",
    does: "Checks whether your most recent upload arrived, and whether it is waiting for you.",
  },
] as const;

/** Long enough to read, short enough not to look stuck. The /import page's figure. */
const COPIED_MS = 2200;

/** The 720px reading column /import was authored against, plus the phone gutter. */
const COLUMN_MAX = 720 + 2 * SPACE.sm;

/**
 * A reading-surface panel: `--glass` at the one blur value, flat, with the glass
 * hairline in place of `elevation.flat`'s `--line`, as the gallery card and the
 * auth card take it.
 */
const glassSurface: CSSProperties = {
  background: t.glass,
  backdropFilter: GLASS_BLUR,
  WebkitBackdropFilter: GLASS_BLUR,
  ...elevation.flat,
  borderColor: t.glassBorder,
};

/**
 * Put a string on the clipboard, or say it could not.
 *
 * The same two paths as /import: the async clipboard API, then a throwaway
 * textarea for an insecure context or a browser without that API. The textarea
 * is appended and removed again; nothing on the page is touched. Written here
 * rather than lifted out of ImportPage.tsx, which this step does not edit.
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

/**
 * Copy, and a quiet line saying whether it worked.
 *
 * THE VISIBLE WORD IS "Copy" AND THE NAME SAYS WHAT. There are up to seven of
 * these on the page, so each carries an accessible name that starts with the
 * visible word — WCAG's label-in-name — and ends with what it copies.
 *
 * `role="status"` because the confirmation arrives in response to a click: a
 * screen-reader user otherwise hears nothing and cannot tell whether it worked.
 * Success is `--evidence`, "it worked"; failure is breakage red and names the
 * way out. Neither is amber, which the theme forbids as type on a light ground.
 */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copy = useCallback(async () => {
    const next: CopyState = (await writeToClipboard(value)) ? "copied" : "failed";
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), COPIED_MS);
  }, [value]);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: SPACE.xs }}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-label={label}
        onClick={() => void copy()}
        style={{ whiteSpace: "nowrap" }}
      >
        Copy
      </Button>
      <span
        role="status"
        aria-live="polite"
        style={{
          ...labelText,
          color: state === "failed" ? t.catBreakage : t.evidence,
          opacity: state === "idle" ? 0 : 1,
          transition: fade(),
        }}
      >
        {state === "copied"
          ? "Copied"
          : state === "failed"
            ? "Could not copy. Select the text and copy it instead."
            : ""}
      </span>
    </span>
  );
}

/**
 * A value to paste somewhere else, in a well, with Copy beside it.
 *
 * `--recess` because a well is what that token is for, with a `--line` edge
 * because on Dusk the well and the glass around it sit only 1.08:1 apart and
 * would otherwise merge. The mono face because this is a value, not prose.
 * `overflowWrap: anywhere` is what keeps the 100-character command inside a
 * 390px screen; Copy puts it on the clipboard as the one line it is.
 */
function CopyField({ value, copyLabel }: { value: string; copyLabel: string }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: SPACE.xs }}>
      <code
        style={{
          ...dataText,
          color: t.text,
          background: t.recess,
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: t.line,
          borderRadius: r.control,
          padding: "10px 12px",
          flex: "1 1 18rem",
          minWidth: 0,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </code>
      <CopyButton value={value} label={copyLabel} />
    </div>
  );
}

/** A label from another product's interface, set so it can be found on screen. */
function UiLabel({ children }: { children: ReactNode }) {
  return <strong style={{ fontWeight: 600, color: t.text }}>{children}</strong>;
}

/**
 * A link to another product's help, in a new tab so the Copy buttons here stay
 * open beside it. `--action`, like every link out of a page on this site, with
 * the underline at rest so it is not told apart by colour alone.
 */
function HelpLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        ...bodyText,
        alignSelf: "flex-start",
        color: t.action,
        textDecoration: "underline",
        textUnderlineOffset: "3px",
      }}
    >
      {children}
      <span aria-hidden> ↗</span>
    </a>
  );
}

/**
 * One tool: a heading that opens and closes its steps.
 *
 * THE WHOLE HEADER STRIP IS THE BUTTON, so the target is the panel's width and
 * a comfortable height on a phone rather than the width of the word "Cursor".
 * The steps stay in the DOM under `hidden` rather than being unmounted, so
 * `aria-controls` always names an element that exists. `hidden` works only
 * because the element carrying it sets no `display` of its own; the layout is
 * on the child, and an inline `display` on the outer element would override the
 * attribute and show the steps while announcing them as closed.
 *
 * The ring is the shared one, spent through `useInteractive` because an inline
 * style cannot say `:focus-visible`.
 */
function ClientPanel({ id, name, children }: { id: string; name: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const buttonId = `connect-${id}-toggle`;
  const stepsId = `connect-${id}-steps`;

  return (
    <section style={{ ...glassSurface, borderRadius: r.panel, color: t.text }}>
      <h3 style={{ margin: 0 }}>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={stepsId}
          onClick={() => setOpen((was) => !was)}
          {...handlers}
          style={{
            /* The body face at label weight, as /import's fold takes it: a
               control that opens a panel, not a display heading that happens
               to be clickable. */
            ...bodyLarge,
            fontWeight: 500,
            color: t.text,
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: SPACE.xs,
            padding: SPACE.sm,
            background: "transparent",
            borderWidth: 0,
            borderStyle: "none",
            borderRadius: r.panel,
            textAlign: "left",
            cursor: "pointer",
            ...(state.focusVisible ? focusRing : null),
          }}
        >
          <span aria-hidden style={{ ...dataText, color: t.text2 }}>
            {open ? "▾" : "▸"}
          </span>
          <span>{name}</span>
        </button>
      </h3>

      <div id={stepsId} role="region" aria-labelledby={buttonId} hidden={!open}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: SPACE.sm,
            padding: `0 ${SPACE.sm}px ${SPACE.sm}px`,
          }}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

/** Prose inside a panel. */
function Say({ children }: { children: ReactNode }) {
  return <p style={{ ...bodyText, ...measure, margin: 0, color: t.text }}>{children}</p>;
}

export default function Connect() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: t.bg, color: t.text }}>
      <SeoHead
        title="Connect your AI tool — buildgallery"
        description="Add the buildgallery connector to Claude, Claude Code, ChatGPT or Cursor, then send a conversation to your upload page to review."
        path="/connect"
      />

      <main
        style={{
          maxWidth: COLUMN_MAX,
          margin: "0 auto",
          padding: `${SPACE.lg}px ${SPACE.sm}px ${SPACE["2xl"]}px`,
        }}
      >
        {/* The way home, since there is no frame to carry one. The wordmark as
            AuthShell sets it — Bodoni at 28, clear of the display face's 20px
            floor. */}
        <Link
          to="/"
          style={{
            display: "inline-block",
            marginBottom: SPACE.lg,
            fontFamily: BODONI,
            fontSize: "28px",
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            color: t.text,
            textDecoration: "none",
          }}
        >
          buildgallery
        </Link>

        <PageHeader
          eyebrow="Connector"
          title="Connect your AI tool to buildgallery"
          description="Add the connector once, then ask your AI tool to put a conversation on buildgallery. It arrives on your upload page and waits there for you to review it."
        />

        <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xl }}>
          <section
            aria-labelledby="connect-tools"
            style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}
          >
            <h2 id="connect-tools" style={{ ...cardTitle, margin: 0, color: t.text }}>
              Add it to your AI tool
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
              <ClientPanel id="claude" name="Claude (web and desktop)">
                <ol
                  style={{
                    ...bodyText,
                    margin: 0,
                    paddingLeft: "1.25em",
                    listStyleType: "decimal",
                    color: t.text,
                  }}
                >
                  <li>
                    In Claude, open <UiLabel>Customize</UiLabel> → <UiLabel>Connectors</UiLabel>,
                    choose <UiLabel>+</UiLabel>, then <UiLabel>Add custom connector</UiLabel>.
                  </li>
                  <li style={{ marginTop: SPACE.xs }}>
                    Paste this address and choose <UiLabel>Add</UiLabel>:
                    <div style={{ marginTop: SPACE.xs }}>
                      <CopyField value={CONNECTOR_URL} copyLabel="Copy the connector address" />
                    </div>
                  </li>
                  <li style={{ marginTop: SPACE.xs }}>
                    Claude sends you to buildgallery's consent page. Sign in if it asks, then
                    choose <UiLabel>Allow</UiLabel>.
                  </li>
                </ol>
                <Say>
                  On a Team or Enterprise plan, an owner has to add the connector for your
                  organisation before members can connect to it.
                </Say>
                <HelpLink href={ANTHROPIC_CONNECTORS_HELP}>
                  Anthropic's guide to custom connectors
                </HelpLink>
              </ClientPanel>

              <ClientPanel id="claude-code" name="Claude Code">
                <Say>Run this in your terminal:</Say>
                <CopyField value={CLAUDE_CODE_COMMAND} copyLabel="Copy the Claude Code command" />
                <Say>
                  Then open Claude Code and type{" "}
                  <code style={{ ...dataText, color: t.text }}>/mcp</code> to sign in.
                </Say>
              </ClientPanel>

              <ClientPanel id="chatgpt" name="ChatGPT">
                <Say>
                  ChatGPT needs Developer Mode switched on before it can add this connector.
                  OpenAI's guide has the steps. When it asks for the connector's address, use:
                </Say>
                <CopyField value={CONNECTOR_URL} copyLabel="Copy the connector address" />
                <Say>
                  When ChatGPT connects, it sends you to buildgallery to sign in and choose{" "}
                  <UiLabel>Allow</UiLabel>.
                </Say>
                <HelpLink href={OPENAI_DEVELOPER_MODE_HELP}>
                  OpenAI's guide to Developer Mode and MCP apps
                </HelpLink>
              </ClientPanel>

              <ClientPanel id="cursor" name="Cursor">
                <Say>Add it in Cursor's MCP settings as a server with this address:</Say>
                <CopyField value={CONNECTOR_URL} copyLabel="Copy the connector address" />
                <Say>
                  When Cursor connects, it sends you to buildgallery to sign in and choose{" "}
                  <UiLabel>Allow</UiLabel>.
                </Say>
                <HelpLink href={CURSOR_MCP_DOCS}>Cursor's MCP documentation</HelpLink>
              </ClientPanel>
            </div>
          </section>

          <section
            aria-labelledby="connect-say"
            style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}
          >
            <h2 id="connect-say" style={{ ...cardTitle, margin: 0, color: t.text }}>
              Things you can say
            </h2>
            <p style={{ ...bodyText, ...measure, margin: 0, color: t.text2 }}>
              Once it is connected, type any of these in a chat with your AI tool.
            </p>

            {/* `sm` between rows, the same as each row's own padding: a card's
                padding is never larger than the gap to its neighbour. */}
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: SPACE.sm,
              }}
            >
              {EXAMPLES.map(({ say, does }) => (
                <li
                  key={say}
                  style={{
                    ...glassSurface,
                    borderRadius: r.control,
                    padding: SPACE.sm,
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: SPACE.sm,
                  }}
                >
                  <div
                    style={{
                      flex: "1 1 20rem",
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: SPACE.xs,
                    }}
                  >
                    <span style={{ ...bodyLarge, fontWeight: 500, color: t.text }}>“{say}”</span>
                    <span style={{ ...bodyText, color: t.text2 }}>{does}</span>
                  </div>
                  <CopyButton value={say} label={`Copy “${say}”`} />
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="connect-sent"
            style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}
          >
            <h2 id="connect-sent" style={{ ...cardTitle, margin: 0, color: t.text }}>
              What gets sent
            </h2>
            {/* ONE PLAIN PARAGRAPH, AND EVERY CLAUSE IS CHECKED AGAINST THE CODE.
                "Removed before it is saved for you to review", not "before it
                is stored": append_chunk stores each piece verbatim in the
                private imports bucket, and redaction runs once, on the
                assembled text, in finish_import — so the raw pieces are held,
                privately, until the import is finished. What is saved for
                review has had its keys removed. The export route is called
                exact, never unlimited: the upload page has the same
                400,000-character ceiling as the connector. */}
            <p style={{ ...bodyText, ...measure, margin: 0, color: t.text }}>
              When you ask, your AI tool sends the whole conversation to buildgallery, word for
              word. Anything in it that looks like an API key or other secret is removed before
              it is saved for you to review. Nothing is published unless you publish it, and the
              connector cannot change or delete anything you have already made. An import waits
              on your upload page for seven days, then expires. The connector relies on your AI
              tool reproducing the conversation faithfully, so for a very long session, exporting
              the chat as a file and dropping it on the{" "}
              <Link
                to="/compose/new"
                style={{ color: t.action, textDecoration: "underline", textUnderlineOffset: "3px" }}
              >
                upload page
              </Link>{" "}
              is the exact route.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
