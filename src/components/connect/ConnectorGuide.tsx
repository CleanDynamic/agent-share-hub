// UI-P45 — the connector guide: three steps to connect an AI tool.
//
// PURE. It reads nothing and owns no step or tool: the dialog and the /connect
// page each hold that state and pass it in, so the same guide renders in both.
// The one thing it keeps to itself is "Copied", which is a two-second echo of a
// click and nobody else's business. It reads the 768px breakpoint for itself
// (the phone view is the same content with bigger targets), as the page views do.
//
// The head ("Connector", the h2, Close) is the dialog's, not the guide's: on
// /connect the page's own h1 does that job.
//
// DENSER SINCE UI-P58. No board draws the guide, so every size it sets is its
// old value through the density table (design/prompts/README-density.md); the
// brand pieces (Button, Segmented, FilterChip) take the drawn size and map it.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/brand/Button";
import { MobileIcon } from "@/components/brand/MobileIcon";
import { BigButton } from "@/components/phone/BigButton";
import { PhoneModule } from "@/components/phone/PhoneModule";
import { PhonePills } from "@/components/phone/PhonePills";
import { PHONE_MARGIN } from "@/components/shell/chromeSize";
import { DONE } from "@/lib/copy/copy";
import { TOUCH_MIN } from "@/lib/theme/density";
import { FilterChip } from "@/components/brand/FilterChip";
import { Segmented } from "@/components/brand/Segmented";
import { VisuallyHidden } from "@/components/brand/VisuallyHidden";
import { FrameLink } from "@/components/shell/FrameLink";
import { ScrollRow } from "@/components/shell/ScrollRow";
import { useIsPhone } from "@/components/shell/useMinWidth";
import {
  CLAUDE_CODE_COMMAND,
  CONNECTOR_TOOLS,
  CONNECTOR_URL,
  GUIDE_LINKS,
  type ConnectorTool,
} from "@/lib/connect/connector";
import { copyText } from "@/lib/connect/copyText";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";
import { SITE_NAME } from "@/lib/site";

export type GuideStep = 1 | 2 | 3;

export interface ConnectorGuideProps {
  step: GuideStep;
  onStep: (step: GuideStep) => void;
  tool: ConnectorTool;
  onTool: (tool: ConnectorTool) => void;
  onDone: () => void;
  /** What the last step's primary says: "Done" in the dialog, "Go to Drafts" on the page. */
  doneLabel: string;
  /** Side padding in px. 17 by default (12 on a phone; 24 and 16 before UI-P58's density table); 0 inside a sheet that pads itself. */
  gutter?: number;
}

/** How long "Copied" stays on the button. */
const COPIED_MS = 2000;

const STEP_LABELS = ["Add the connector", "Send a session", "Use it in a build"] as const;

const PHRASES = [
  {
    say: `put this conversation on ${SITE_NAME}`,
    line: "Sends the whole conversation to Sessions on your Drafts page.",
  },
  {
    say: `what drafts do I have on ${SITE_NAME}?`,
    line: "Lists your drafts, most recently worked on first.",
  },
  {
    say: "add this conversation to my [title] draft",
    line: "Put your draft's name in place of [title]. It arrives marked for that draft; add it from Drafts in one tap.",
  },
  {
    say: "did my last session arrive?",
    line: `Checks whether your most recent session reached ${SITE_NAME}.`,
  },
] as const;

interface ToolCopy {
  before: readonly string[];
  code: string;
  codeLabel: string;
  after: readonly string[];
}

const ADDRESS_LABEL = "Copy the connector address";

const TOOL_COPY: Record<ConnectorTool, ToolCopy> = {
  Claude: {
    before: [
      "In Claude, open Customize, Connectors, choose +, then Add custom connector.",
      "Paste this address and choose Add:",
    ],
    code: CONNECTOR_URL,
    codeLabel: ADDRESS_LABEL,
    after: [
      `Claude sends you to ${SITE_NAME}'s consent page. Sign in if it asks, then choose Allow.`,
      "On a Team or Enterprise plan, an owner has to add the connector for your organisation before members can connect to it.",
    ],
  },
  "Claude Code": {
    before: ["Run this in your terminal:"],
    code: CLAUDE_CODE_COMMAND,
    codeLabel: "Copy the Claude Code command",
    after: ["Then open Claude Code and type /mcp to sign in."],
  },
  ChatGPT: {
    before: [
      "ChatGPT needs Developer Mode switched on before it can add this connector. OpenAI's guide has the steps. When it asks for the connector's address, use:",
    ],
    code: CONNECTOR_URL,
    codeLabel: ADDRESS_LABEL,
    after: [`When ChatGPT connects, it sends you to ${SITE_NAME} to sign in and choose Allow.`],
  },
  Cursor: {
    before: ["Add it in Cursor's MCP settings as a server with this address:"],
    code: CONNECTOR_URL,
    codeLabel: ADDRESS_LABEL,
    after: [`When Cursor connects, it sends you to ${SITE_NAME} to sign in and choose Allow.`],
  },
};

/** Copy, which says "Copied" for two seconds. 30px, or 44 on a phone. */
function CopyButton({
  value,
  label,
  phone,
  onInverse = false,
  showLabel = false,
}: {
  value: string;
  label: string;
  phone: boolean;
  /** The page draws the whole label ("Copy the connector address"); the dialog keeps "Copy". */
  showLabel?: boolean;
  /** Drawn on the code well (`--inverse`), where the secondary's own paint would vanish in Dusk. */
  onInverse?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    if (!(await copyText(value))) return;
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <>
      <Button
        variant="secondary"
        size={phone ? 44 : 30}
        fontSize={12}
        aria-label={copied ? "Copied" : label}
        onClick={() => void copy()}
        style={onInverse ? { background: "transparent", color: t.onInverse, borderColor: t.onInverse2 } : undefined}
      >
        {copied ? "Copied" : showLabel ? label : "Copy"}
      </Button>
      <span role="status">{copied ? <VisuallyHidden>Copied</VisuallyHidden> : null}</span>
    </>
  );
}

function StepButton({
  index,
  current,
  done,
  onSelect,
}: {
  index: number;
  current: boolean;
  done: boolean;
  onSelect: () => void;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-current={current ? "step" : undefined}
      onClick={onSelect}
      {...handlers}
      style={{
        flex: 1,
        minWidth: 0,
        padding: "6px 0 7px",
        background: "transparent",
        border: 0,
        borderTop: `3px solid ${current ? t.action : done ? t.evidence : t.line}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        textAlign: "left",
        cursor: "pointer",
        color: current || done ? t.text : t.text2,
        ...ring(state.focusVisible),
      }}
    >
      <span style={{ fontFamily: DM_MONO, fontSize: 11 }}>{String(index + 1).padStart(2, "0")}</span>
      <span style={{ fontFamily: FIGTREE, fontSize: 12, fontWeight: 600 }}>{STEP_LABELS[index]}</span>
    </button>
  );
}

const text14: CSSProperties = { fontFamily: FIGTREE, fontSize: 14, lineHeight: 1.5, margin: 0 };

const box: CSSProperties = {
  borderRadius: r.control,
  border: `1px solid ${t.hairline}`,
  background: t.cell,
  boxSizing: "border-box",
};

function ToolBox({ tool, phone, plain = false }: { tool: ConnectorTool; phone: boolean; plain?: boolean }) {
  const copy = TOOL_COPY[tool];
  const link = GUIDE_LINKS[tool];
  if (plain) {
    /* The page's version: the lines in plain text, the address in a Card in mono 15 with its copy button under it. */
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
        {copy.before.map((line) => (
          <p key={line} style={{ ...text14, fontSize: 15, lineHeight: "20px", color: t.text2 }}>
            {line}
          </p>
        ))}
        <code
          tabIndex={0}
          data-testid="connector-address"
          style={{
            alignSelf: "stretch",
            boxSizing: "border-box",
            padding: "12px 16px",
            borderRadius: r.card,
            background: t.module,
            color: t.text,
            fontFamily: DM_MONO,
            fontSize: 15,
            lineHeight: "20px",
            whiteSpace: "nowrap",
            overflowX: "auto",
          }}
        >
          {copy.code}
        </code>
        <CopyButton value={copy.code} label={copy.codeLabel} phone={phone} showLabel />
        {copy.after.map((line) => (
          <p key={line} style={{ ...text14, fontSize: 13, lineHeight: "16px", color: t.label }}>
            {line}
          </p>
        ))}
        {link ? (
          <a href={link.href} target="_blank" rel="noopener noreferrer" style={{ fontFamily: FIGTREE, fontSize: 13, color: t.text2, textDecoration: "underline", textUnderlineOffset: 3 }}>
            {link.label}
          </a>
        ) : null}
      </div>
    );
  }
  return (
    <div style={{ ...box, padding: 12, display: "flex", flexDirection: "column", gap: 7 }}>
      {copy.before.map((line) => (
        <p key={line} style={{ ...text14, color: t.text }}>
          {line}
        </p>
      ))}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 4px 4px 9px",
          borderRadius: r.media,
          background: t.inverse,
          color: t.onInverse,
        }}
      >
        <code
          tabIndex={0}
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: FIGTREE,
            fontSize: 12,
            whiteSpace: "nowrap",
            overflowX: "auto",
          }}
        >
          {copy.code}
        </code>
        <CopyButton value={copy.code} label={copy.codeLabel} phone={phone} onInverse />
      </div>
      {copy.after.map((line) => (
        <p key={line} style={{ ...text14, fontSize: 13, color: t.text2 }}>
          {line}
        </p>
      ))}
      {link ? (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            alignSelf: "flex-start",
            fontFamily: FIGTREE,
            fontSize: 12,
            color: t.text2,
            textDecoration: "underline",
          }}
        >
          {link.label}
        </a>
      ) : null}
    </div>
  );
}

function StepOne({ tool, onTool, phone }: { tool: ConnectorTool; onTool: (tool: ConnectorTool) => void; phone: boolean }) {
  return (
    <>
      <p style={{ ...text14, color: t.text2 }}>
        Add the connector once. After that, any chat where you built something can send itself to Sessions on your
        Drafts page.
      </p>
      {phone ? (
        <ScrollRow label="AI tool">
          {CONNECTOR_TOOLS.map((name) => (
            <FilterChip key={name} label={name} on={name === tool} onClick={() => onTool(name)} />
          ))}
        </ScrollRow>
      ) : (
        <div>
          <Segmented
            label="AI tool"
            size={34}
            fontSize={13}
            items={CONNECTOR_TOOLS.map((name) => ({ value: name, label: name }))}
            value={tool}
            onChange={onTool}
          />
        </div>
      )}
      <ToolBox tool={tool} phone={phone} />
    </>
  );
}

function StepTwo({ phone }: { phone: boolean }) {
  return (
    <>
      <p style={{ ...text14, color: t.text2 }}>
        In the chat where you built it, type one of these. Your AI tool does the rest.
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: phone ? 6 : 7 }}>
        {PHRASES.map(({ say, line }) => (
          <li
            key={say}
            style={{
              ...box,
              padding: "9px 10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 9,
            }}
          >
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontFamily: FIGTREE, fontSize: 14, fontWeight: 600, color: t.text }}>“{say}”</span>
              <span style={{ fontFamily: FIGTREE, fontSize: 12, color: t.text2 }}>{line}</span>
            </div>
            <CopyButton value={say} label={`Copy “${say}”`} phone={phone} />
          </li>
        ))}
      </ul>
      <div
        style={{
          padding: "9px 10px",
          borderRadius: r.control,
          border: `1px dashed ${t.line}`,
          fontFamily: FIGTREE,
          fontSize: 12,
          lineHeight: 1.5,
          color: t.text2,
        }}
      >
        <strong style={{ fontWeight: 600 }}>What gets sent.</strong> The whole conversation, word for word. Anything that
        looks like an API key or other secret is removed before it is saved. Nothing is published unless you publish it,
        and the connector cannot change or delete anything you have made.
      </div>
    </>
  );
}

const strong: CSSProperties = { fontWeight: 600 };

function StepThree() {
  return (
    <>
      <div
        aria-hidden="true"
        style={{ ...box, padding: 12, display: "flex", alignItems: "center", gap: 9, overflow: "hidden" }}
      >
        <div
          style={{
            minWidth: 0,
            padding: "7px 9px",
            border: `1px solid ${t.line}`,
            background: t.field,
            borderRadius: r.media,
          }}
        >
          <div style={{ fontFamily: FIGTREE, fontSize: 12, color: t.text }}>Build me a script that renames photos…</div>
          <div style={{ fontFamily: DM_MONO, fontSize: 11, color: t.text2 }}>Sonnet 5.5 · Today</div>
        </div>
        <ArrowRight size={20} strokeWidth={1.6} style={{ flexShrink: 0, color: t.text2 }} />
        <div
          style={{
            minWidth: 0,
            padding: "7px 9px",
            border: `1.5px dashed ${t.evidence}`,
            borderRadius: r.media,
          }}
        >
          <div style={{ fontFamily: FIGTREE, fontSize: 12, fontWeight: 600, color: t.text }}>
            Photo renamer by date taken
          </div>
          <div style={{ fontFamily: DM_MONO, fontSize: 11, color: t.text2 }}>2 sessions</div>
        </div>
      </div>
      <ol
        style={{
          ...text14,
          color: t.text,
          paddingLeft: "1.25em",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <li>
          Sessions land under <span style={strong}>Sessions</span> on your Drafts page, and stay until you delete them.
        </li>
        <li>
          Drag one onto a draft, or onto <span style={strong}>Start a new build</span>. Built it over several chats? Add
          each one to the same draft.
        </li>
        <li>
          In the composer, pick the prompts that matter. You write the build; each prompt links back to its session.
        </li>
        <li>
          No connector? Use the Extractor on the{" "}
          <FrameLink to="/import" style={{ color: t.action, textDecoration: "underline" }}>
            Import page
          </FrameLink>
          .
        </li>
      </ol>
    </>
  );
}

export function ConnectorGuide({ step, onStep, tool, onTool, onDone, doneLabel, gutter }: ConnectorGuideProps) {
  const phone = useIsPhone();
  const side = gutter ?? (phone ? 12 : 17);
  const last = step === 3;

  return (
    <div data-ui="connector-guide" style={{ display: "flex", flexDirection: "column", color: t.text, fontFamily: FIGTREE }}>
      <nav aria-label="Steps" style={{ display: "flex", gap: 6, padding: `12px ${side}px 0` }}>
        {STEP_LABELS.map((_, index) => (
          <StepButton
            key={index}
            index={index}
            current={step === index + 1}
            done={step > index + 1}
            onSelect={() => onStep((index + 1) as GuideStep)}
          />
        ))}
      </nav>

      <div style={{ padding: `6px ${side}px 14px`, display: "flex", flexDirection: "column", gap: phone ? 9 : 10 }}>
        {step === 1 ? <StepOne tool={tool} onTool={onTool} phone={phone} /> : null}
        {step === 2 ? <StepTwo phone={phone} /> : null}
        {step === 3 ? <StepThree /> : null}
      </div>

      <div
        style={{
          padding: phone ? `10px ${side}px 0` : `10px ${side}px`,
          borderTop: `1px solid ${t.hairline}`,
          display: "flex",
          justifyContent: "space-between",
          gap: 9,
        }}
      >
        <Button
          variant="ghost"
          size={phone ? 48 : 42}
          fontSize={phone ? 15 : 14}
          style={phone ? { flex: "1 1 0", minWidth: 0 } : undefined}
          disabled={step === 1}
          onClick={() => onStep((step - 1) as GuideStep)}
        >
          Back
        </Button>
        <Button
          variant="primary"
          size={phone ? 48 : 42}
          fontSize={phone ? 15 : 14}
          style={phone ? { flex: "1 1 0", minWidth: 0 } : undefined}
          onClick={last ? onDone : () => onStep((step + 1) as GuideStep)}
        >
          {last ? doneLabel : "Next"}
        </Button>
      </div>
    </div>
  );
}

/* ── the page's version: three numbered steps, all showing ──
   The dialog steps through the guide; /connect lays the same three out as a list, each with a 28 box holding its number
   and a 17/600 heading. The AI tool switch is a row of pills (text only). */

export interface ConnectStepsProps {
  tool: ConnectorTool;
  onTool: (tool: ConnectorTool) => void;
  onDone: () => void;
  /** What the last step's primary says. */
  doneLabel: string;
}

function NumberedStep({ ordinal, title, children }: { ordinal: number; title: string; children: ReactNode }) {
  return (
    <li style={{ display: "grid", gridTemplateColumns: "28px minmax(0, 1fr)", columnGap: 12, alignItems: "start", listStyle: "none" }}>
      <span
        aria-hidden
        data-testid={`connect-step-${ordinal}`}
        style={{ width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: r.card, background: t.module, color: t.text, fontFamily: DM_MONO, fontSize: 13 }}
      >
        {ordinal}
      </span>
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
        <h2 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 17, fontWeight: 600, lineHeight: "22px", color: t.text }}>{title}</h2>
        {children}
      </div>
    </li>
  );
}

/** Copy with a two-second "Copied" and the repo's words announced. */
function useCopied(value: string) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const copy = async () => {
    if (!(await copyText(value))) return;
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };
  return { copied, copy };
}

/** A 44 round copy button for the Card rows. */
function RowCopy({ value, label }: { value: string; label: string }) {
  const { copied, copy } = useCopied(value);
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <>
      <button
        type="button"
        aria-label={copied ? "Copied" : label}
        onClick={() => void copy()}
        {...handlers}
        style={{ boxSizing: "border-box", width: TOUCH_MIN, height: TOUCH_MIN, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", border: 0, borderRadius: TOUCH_MIN / 2, background: "transparent", color: copied ? t.text : t.text2, cursor: "pointer", ...ring(state.focusVisible) }}
      >
        <MobileIcon name={copied ? "check" : "copy"} size={20} />
      </button>
      <span role="status">{copied ? <VisuallyHidden>{DONE.copied}</VisuallyHidden> : null}</span>
    </>
  );
}

const cardRow: CSSProperties = { boxSizing: "border-box", minHeight: 48, borderRadius: 12, background: t.module, display: "flex", alignItems: "center", gap: 4, paddingLeft: 12, minWidth: 0, alignSelf: "stretch" };

function PhoneStep({ ordinal, title, children }: { ordinal: number; title: string; children: ReactNode }) {
  return (
    <li style={{ listStyle: "none" }}>
      <PhoneModule>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span aria-hidden data-testid={`connect-step-${ordinal}`} style={{ width: 28, height: 28, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: t.control, color: t.text, fontFamily: DM_MONO, fontSize: 13 }}>
            {ordinal}
          </span>
          <h2 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 17, fontWeight: 600, lineHeight: "22px", color: t.text }}>{title}</h2>
        </div>
        {children}
      </PhoneModule>
    </li>
  );
}

const line15: CSSProperties = { margin: 0, fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px", color: t.text2 };
const line13: CSSProperties = { margin: 0, fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label };

/** The page on a phone (mobile prompt 25, Part E): the tool as pills, three numbered Panel modules, the address in a Card row,
    and the main action pinned in a footer under the bottom inset. */
function ConnectStepsPhone({ tool, onTool, onDone, doneLabel }: ConnectStepsProps) {
  const copy = TOOL_COPY[tool];
  const link = GUIDE_LINKS[tool];
  const phrase = PHRASES[0];
  const main = useCopied(copy.code);
  return (
    <div data-ui="connector-guide" style={{ color: t.text, fontFamily: FIGTREE }}>
      <PhonePills<ConnectorTool> label="AI tool" value={tool} onChange={onTool} pills={CONNECTOR_TOOLS.map((name) => ({ value: name, label: name }))} />
      <ol style={{ margin: 0, padding: 0 }}>
        <PhoneStep ordinal={1} title={STEP_LABELS[0]}>
          {copy.before.map((text) => (
            <p key={text} style={line15}>
              {text}
            </p>
          ))}
          <div style={cardRow}>
            <code tabIndex={0} data-testid="connector-address" style={{ flex: 1, minWidth: 0, fontFamily: DM_MONO, fontSize: 15, lineHeight: "20px", whiteSpace: "nowrap", overflowX: "auto", color: t.text }}>
              {copy.code}
            </code>
            <RowCopy value={copy.code} label={copy.code === CONNECTOR_URL ? "Copy address" : "Copy command"} />
          </div>
          {copy.after.map((text) => (
            <p key={text} style={line13}>
              {text}
            </p>
          ))}
          {link ? (
            <a href={link.href} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", minHeight: TOUCH_MIN, fontFamily: FIGTREE, fontSize: 15, color: t.text2, textDecoration: "underline", textUnderlineOffset: 3 }}>
              {link.label}
            </a>
          ) : null}
        </PhoneStep>

        <PhoneStep ordinal={2} title={STEP_LABELS[1]}>
          <p style={line15}>{phrase.line}</p>
          <div style={cardRow}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: "20px", color: t.text, padding: "8px 0" }}>“{phrase.say}”</span>
            <RowCopy value={phrase.say} label={`Copy “${phrase.say}”`} />
          </div>
          <p style={line13}>
            The whole conversation is sent, word for word. Anything that looks like an API key or other secret is removed before it is saved. Nothing is published unless you publish it.
          </p>
        </PhoneStep>

        <PhoneStep ordinal={3} title={STEP_LABELS[2]}>
          <p style={line15}>Add a session to a draft, then pick the prompts that matter.</p>
          <div>
            <BigButton onClick={onDone}>{doneLabel}</BigButton>
          </div>
          <p style={line13}>
            No connector? Use the Extractor on the{" "}
            <FrameLink to="/import" style={{ color: t.text2, textDecoration: "underline", textUnderlineOffset: 3 }}>
              Import page
            </FrameLink>
            .
          </p>
        </PhoneStep>
      </ol>

      <div
        data-testid="connect-footer"
        style={{ position: "sticky", bottom: 0, zIndex: 10, boxSizing: "border-box", background: t.bg, padding: `12px ${PHONE_MARGIN}px calc(12px + env(safe-area-inset-bottom))` }}
      >
        <BigButton main full aria-label={main.copied ? "Copied" : copy.codeLabel} onClick={() => void main.copy()}>
          {main.copied ? "Copied" : copy.codeLabel}
        </BigButton>
        <span role="status">{main.copied ? <VisuallyHidden>{DONE.copied}</VisuallyHidden> : null}</span>
      </div>
    </div>
  );
}

export function ConnectSteps({ tool, onTool, onDone, doneLabel }: ConnectStepsProps) {
  const phone = useIsPhone();
  const phrase = PHRASES[0];
  if (phone) return <ConnectStepsPhone tool={tool} onTool={onTool} onDone={onDone} doneLabel={doneLabel} />;
  return (
    <ol data-ui="connector-guide" style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 24, color: t.text, fontFamily: FIGTREE }}>
      <NumberedStep ordinal={1} title={STEP_LABELS[0]}>
        <div role="group" aria-label="AI tool" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CONNECTOR_TOOLS.map((name) => (
            <FilterChip key={name} label={name} on={name === tool} onClick={() => onTool(name)} />
          ))}
        </div>
        <div style={{ alignSelf: "stretch" }}>
          <ToolBox tool={tool} phone={phone} plain />
        </div>
      </NumberedStep>

      <NumberedStep ordinal={2} title={STEP_LABELS[1]}>
        <p style={{ ...text14, fontSize: 15, lineHeight: "20px", color: t.text2 }}>{phrase.line}</p>
        <div style={{ alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderRadius: r.card, background: t.module }}>
          <span style={{ fontSize: 15, lineHeight: "20px", color: t.text }}>“{phrase.say}”</span>
          <span style={{ display: "inline-flex", flexShrink: 0 }}>
            <CopyButton value={phrase.say} label={`Copy “${phrase.say}”`} phone={phone} />
          </span>
        </div>
        <p style={{ ...text14, fontSize: 13, lineHeight: "16px", color: t.label }}>
          The whole conversation is sent, word for word. Anything that looks like an API key or other secret is removed before it is saved. Nothing is published unless you publish it.
        </p>
      </NumberedStep>

      <NumberedStep ordinal={3} title={STEP_LABELS[2]}>
        <p style={{ ...text14, fontSize: 15, lineHeight: "20px", color: t.text2 }}>Drag a session into a draft, then pick the prompts that matter.</p>
        <Button variant="primary" size={phone ? 44 : 32} onClick={onDone}>
          {doneLabel}
        </Button>
        <p style={{ ...text14, fontSize: 13, lineHeight: "16px", color: t.label }}>
          No connector? Use the Extractor on the{" "}
          <FrameLink to="/import" style={{ color: t.text2, textDecoration: "underline", textUnderlineOffset: 3 }}>
            Import page
          </FrameLink>
          .
        </p>
      </NumberedStep>
    </ol>
  );
}

export default ConnectorGuide;
