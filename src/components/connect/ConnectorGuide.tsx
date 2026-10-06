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

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/brand/Button";
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

export type GuideStep = 1 | 2 | 3;

export interface ConnectorGuideProps {
  step: GuideStep;
  onStep: (step: GuideStep) => void;
  tool: ConnectorTool;
  onTool: (tool: ConnectorTool) => void;
  onDone: () => void;
  /** What the last step's primary says: "Done" in the dialog, "Go to Drafts" on the page. */
  doneLabel: string;
  /** Side padding in px. 24 by default (16 on a phone); 0 inside a sheet that pads itself. */
  gutter?: number;
}

/** How long "Copied" stays on the button. */
const COPIED_MS = 2000;

const STEP_LABELS = ["Add the connector", "Send a session", "Use it in a build"] as const;

const PHRASES = [
  {
    say: "put this conversation on buildgallery",
    line: "Sends the whole conversation to Sessions on your Drafts page.",
  },
  {
    say: "what drafts do I have on buildgallery?",
    line: "Lists your drafts, most recently worked on first.",
  },
  {
    say: "add this conversation to my [title] draft",
    line: "Put your draft's name in place of [title]. It arrives marked for that draft; add it from Drafts in one tap.",
  },
  {
    say: "did my last session arrive?",
    line: "Checks whether your most recent session reached buildgallery.",
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
      "In Claude, open Customize → Connectors, choose +, then Add custom connector.",
      "Paste this address and choose Add:",
    ],
    code: CONNECTOR_URL,
    codeLabel: ADDRESS_LABEL,
    after: [
      "Claude sends you to buildgallery's consent page. Sign in if it asks, then choose Allow.",
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
    after: ["When ChatGPT connects, it sends you to buildgallery to sign in and choose Allow."],
  },
  Cursor: {
    before: ["Add it in Cursor's MCP settings as a server with this address:"],
    code: CONNECTOR_URL,
    codeLabel: ADDRESS_LABEL,
    after: ["When Cursor connects, it sends you to buildgallery to sign in and choose Allow."],
  },
};

/** Copy, which says "Copied" for two seconds. 30px, or 44 on a phone. */
function CopyButton({
  value,
  label,
  phone,
  onInverse = false,
}: {
  value: string;
  label: string;
  phone: boolean;
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
        {copied ? "Copied" : "Copy"}
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
        padding: "8px 0 10px",
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
      <span style={{ fontFamily: FIGTREE, fontSize: 13, fontWeight: 600 }}>{STEP_LABELS[index]}</span>
    </button>
  );
}

const text15: CSSProperties = { fontFamily: FIGTREE, fontSize: 15, lineHeight: 1.5, margin: 0 };

const box: CSSProperties = {
  borderRadius: r.control,
  border: `1px solid ${t.hairline}`,
  background: t.cell,
  boxSizing: "border-box",
};

function ToolBox({ tool, phone }: { tool: ConnectorTool; phone: boolean }) {
  const copy = TOOL_COPY[tool];
  const link = GUIDE_LINKS[tool];
  return (
    <div style={{ ...box, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      {copy.before.map((line) => (
        <p key={line} style={{ ...text15, color: t.text }}>
          {line}
        </p>
      ))}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 6px 6px 12px",
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
            fontFamily: DM_MONO,
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
        <p key={line} style={{ ...text15, fontSize: 14, color: t.text2 }}>
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
            fontSize: 13,
            color: t.text2,
            textDecoration: "underline",
          }}
        >
          {link.label}
          <span aria-hidden> ↗</span>
        </a>
      ) : null}
    </div>
  );
}

function StepOne({ tool, onTool, phone }: { tool: ConnectorTool; onTool: (tool: ConnectorTool) => void; phone: boolean }) {
  return (
    <>
      <p style={{ ...text15, color: t.text2 }}>
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
      <p style={{ ...text15, color: t.text2 }}>
        In the chat where you built it, type one of these. Your AI tool does the rest.
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: phone ? 8 : 10 }}>
        {PHRASES.map(({ say, line }) => (
          <li
            key={say}
            style={{
              ...box,
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, color: t.text }}>“{say}”</span>
              <span style={{ fontFamily: FIGTREE, fontSize: 13, color: t.text2 }}>{line}</span>
            </div>
            <CopyButton value={say} label={`Copy “${say}”`} phone={phone} />
          </li>
        ))}
      </ul>
      <div
        style={{
          padding: "12px 14px",
          borderRadius: r.control,
          border: `1px dashed ${t.line}`,
          fontFamily: FIGTREE,
          fontSize: 13,
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
        style={{ ...box, padding: 16, display: "flex", alignItems: "center", gap: 12, overflow: "hidden" }}
      >
        <div
          style={{
            minWidth: 0,
            padding: "10px 12px",
            border: `1px solid ${t.line}`,
            background: t.field,
            borderRadius: r.media,
          }}
        >
          <div style={{ fontFamily: FIGTREE, fontSize: 13, color: t.text }}>Build me a script that renames photos…</div>
          <div style={{ fontFamily: DM_MONO, fontSize: 11, color: t.text2 }}>Sonnet 5.5 · Today</div>
        </div>
        <ArrowRight size={20} strokeWidth={1.6} style={{ flexShrink: 0, color: t.text2 }} />
        <div
          style={{
            minWidth: 0,
            padding: "10px 12px",
            border: `1.5px dashed ${t.evidence}`,
            borderRadius: r.media,
          }}
        >
          <div style={{ fontFamily: FIGTREE, fontSize: 13, fontWeight: 600, color: t.text }}>
            Photo renamer by date taken
          </div>
          <div style={{ fontFamily: DM_MONO, fontSize: 11, color: t.text2 }}>2 sessions</div>
        </div>
      </div>
      <ol
        style={{
          ...text15,
          color: t.text,
          paddingLeft: "1.25em",
          display: "flex",
          flexDirection: "column",
          gap: 8,
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
  const side = gutter ?? (phone ? 16 : 24);
  const last = step === 3;

  return (
    <div data-ui="connector-guide" style={{ display: "flex", flexDirection: "column", color: t.text, fontFamily: FIGTREE }}>
      <nav aria-label="Steps" style={{ display: "flex", gap: 8, padding: `16px ${side}px 0` }}>
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

      <div style={{ padding: `8px ${side}px 20px`, display: "flex", flexDirection: "column", gap: phone ? 12 : 14 }}>
        {step === 1 ? <StepOne tool={tool} onTool={onTool} phone={phone} /> : null}
        {step === 2 ? <StepTwo phone={phone} /> : null}
        {step === 3 ? <StepThree /> : null}
      </div>

      <div
        style={{
          padding: phone ? `14px ${side}px 0` : `14px ${side}px`,
          borderTop: `1px solid ${t.hairline}`,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
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

export default ConnectorGuide;
