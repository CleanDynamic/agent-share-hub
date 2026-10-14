/* UI-P94 — the full prompt window in the refined look, as `design/reference/refined/{dusk,noon}/prompt-window.html`
   draws it. Used by the composer and by the build page under `useLook() === "refined"`.

   A FORK, NOT AN EDIT. `FullPromptWindow` stays the current look; this takes its props (imported, not copied) and its
   logic (`windowPrompts`, `neighbours`, `promptContext`, `copyText`), and keeps its behaviour: a Radix Dialog, focus on
   the text box when it opens, ← and → between prompts but never while a field has focus, the title saved on blur, Enter
   and Esc, and the same accessible names.

   THE WINDOW: the window recipe, 760 wide, radius 12, padding `20px 24px`, gap 16, over `--scrim`, no blur. The eyebrow
   "Prompt n of m · full prompt" with a boxed 28 close; the title as a well 44 high (16/500, a `pencil` glyph in
   `--label`) and its hint 12 `--label`; the model as a `ModelTag`, the rest of the facts as quiet tags; the text in a
   well 320 high, padding 16, 14.5/25, its edge `--selected-edge` while it has focus; the words and Copy prompt
   (secondary 28, no icon); the Uses chips; a footer under `--hairline-module`: ghost ← previous and next →, the hint
   centred 12 `--label`, and Done (primary 30). A phone fills the screen and keeps today's order. */

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@/components/brand/Button";
import { Glyph } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { LiveRegion, useAnnouncer } from "@/components/brand/LiveRegion";
import { ModelTag } from "@/components/brand/ModelTag";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { stepTitle, TITLE_MAX, type Step } from "@/lib/build/graph";
import { WELL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { copyText, FULL_PROMPT_COPY, isInstructions, neighbours, promptContext, windowPrompts, type FullPromptWindowProps } from "./FullPromptWindow";

const text = (px: number, weight: 400 | 500, color: string): CSSProperties => ({ fontFamily: FIGTREE, fontSize: px, fontWeight: weight, lineHeight: "normal", color });

const eyebrow: CSSProperties = { ...text(10.5, 500, t.label), letterSpacing: "0.06em", textTransform: "uppercase" };

/** A quiet tag: 22 high, radius 4, `--tag-fill`, 11.5 `--on-tag`. */
const tag: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 22,
  padding: "0 8px",
  boxSizing: "border-box",
  borderRadius: 4,
  background: t.tagFill,
  ...text(11.5, 500, t.onTag),
  whiteSpace: "nowrap",
};

/** A reference: 22 high, the tile's fill, radius 4, 11.5 `--text`. */
const chip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 22,
  padding: "0 8px",
  boxSizing: "border-box",
  borderRadius: 4,
  background: t.tile,
  border: `1px solid ${t.tileBorder}`,
  ...text(11.5, 400, t.text),
  whiteSpace: "nowrap",
};

/** The field draws no fill or border of its own: the well around it does. `index.css` marks the field rule important, so
    only an important inline declaration, written through a ref, outranks it (as `bareField` does in the composer). */
function bare(element: HTMLInputElement | null) {
  if (!element) return;
  element.style.setProperty("background", "transparent", "important");
  element.style.setProperty("border-width", "0", "important");
  element.style.setProperty("box-shadow", "none", "important");
}

/** The title as a field in the well: saved on blur and on Enter, and on Esc before the window unmounts it. */
function TitleField({ step, onTitle, phone }: { step: Step; onTitle: (id: string, title: string) => void; phone: boolean }) {
  const [draft, setDraft] = useState(step.title ?? "");
  const [focused, setFocused] = useState(false);
  const save = () => {
    if (draft.trim() !== (step.title ?? "")) onTitle(step.id, draft);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          ...WELL,
          ...(focused ? { borderColor: t.selectedEdge } : null),
          height: phone ? 48 : 44,
          boxSizing: "border-box",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 8px 0 16px",
        }}
      >
        <input
          ref={bare}
          type="text"
          aria-label="Title"
          value={draft}
          maxLength={TITLE_MAX}
          placeholder={step.defaultTitle}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            save();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") save();
            if (event.key === "Enter") {
              event.preventDefault();
              save();
            }
          }}
          style={{ ...text(16, 500, t.text), letterSpacing: "-0.01em", flexGrow: 1, minWidth: 0, height: "100%", padding: 0, outline: "none" }}
        />
        <span aria-hidden="true" style={{ width: 32, height: 32, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", color: t.label }}>
          <Glyph name="pencil" />
        </span>
      </div>
      <p style={{ ...text(12, 400, t.label), margin: 0 }}>Title · starts as "{step.defaultTitle}" · only you can change it</p>
    </div>
  );
}

/** The text, whole, in the well: scrolls and keeps its line breaks. */
function TextBox({ value, boxRef, phone }: { value: string; boxRef: React.RefObject<HTMLDivElement | null>; phone: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      ref={boxRef}
      tabIndex={0}
      role="region"
      aria-label="Full prompt text"
      data-testid="full-prompt-text"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...WELL,
        ...(focused ? { borderColor: t.selectedEdge } : null),
        height: phone ? "42dvh" : 320,
        overflowY: "auto",
        boxSizing: "border-box",
        padding: 16,
        borderRadius: 6,
        outline: "none",
        ...text(14.5, 400, t.text),
        lineHeight: "25px",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
      }}
    >
      {value}
    </div>
  );
}

function Body({ props, step, prompts, phone }: { props: FullPromptWindowProps; step: Step; prompts: readonly Step[]; phone: boolean }) {
  const { mode, onTitle, onClose, onNavigate } = props;
  const [said, say] = useAnnouncer();
  const textRef = useRef<HTMLDivElement>(null);
  const { previous, next } = neighbours(prompts, step.id);
  const place = prompts.findIndex((candidate) => candidate.id === step.id) + 1;
  const instructions = isInstructions(step);
  const { group, tool, model, when, inSession, uses, goesInto, before } = promptContext(props, step);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  /* The facts in today's order; the model is a ModelTag with its real mark, the rest quiet tags. */
  const facts: { key: string; node: ReactNode }[] = [];
  if (group || tool) {
    const where = `${group?.sessionId ? `Session ${group.number}` : "Typed here"}${tool ? ` · ${tool}` : ""}`;
    facts.push({ key: where, node: <span style={tag}>{where}</span> });
  }
  if (model) {
    facts.push({
      key: model,
      node: (
        <ModelTag tool={tool} model={step.model ?? group?.model ?? model}>
          {model}
        </ModelTag>
      ),
    });
  }
  if (when) facts.push({ key: when, node: <span style={tag}>{when}</span> });
  if (group && inSession > 0) {
    const at = `prompt ${inSession} of ${group.stepNumbers.length} in the session`;
    facts.push({ key: at, node: <span style={tag}>{at}</span> });
  }

  const copy = async () => {
    say((await copyText(step.text)) ? FULL_PROMPT_COPY.copied : "Couldn't copy. Select the text and copy it.");
  };

  const quiet = text(11.5, 400, t.label);
  const navLabel: CSSProperties = { maxWidth: phone ? 110 : 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: phone ? "100%" : undefined }}>
      <LiveRegion message={said} />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Dialog.Title style={{ ...eyebrow, margin: 0, flexGrow: 1 }}>
          Prompt {step.number} of {prompts.length} · full prompt
        </Dialog.Title>
        <Dialog.Close asChild>
          <IconButton icon={X} glyph="x" label="Close" size={28} />
        </Dialog.Close>
      </div>
      {mode === "maker" && onTitle && !instructions ? (
        <TitleField key={step.id} step={step} onTitle={onTitle} phone={phone} />
      ) : (
        <h2 style={{ ...text(20, 500, step.title ? t.text : t.text2), letterSpacing: "-0.015em", margin: 0, overflowWrap: "anywhere" }} data-default-title={step.title ? undefined : "true"}>
          {stepTitle(step)}
        </h2>
      )}
      {facts.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {facts.map((fact) => (
            <span key={fact.key} style={{ display: "inline-flex" }}>
              {fact.node}
            </span>
          ))}
        </div>
      ) : null}
      <TextBox key={step.id} value={step.text} boxRef={textRef} phone={phone} />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ ...quiet, flexGrow: 1, fontVariantNumeric: "tabular-nums" }}>{step.words} words</span>
        <Button variant="secondary" size={phone ? 48 : 28} fontSize={12} onClick={() => void copy()}>
          {FULL_PROMPT_COPY.copy}
        </Button>
      </div>
      {uses.length > 0 || goesInto.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {uses.length > 0 ? <span style={quiet}>Uses</span> : null}
          {uses.map((use) => (
            <span key={use.key} style={chip}>
              {use.label}
            </span>
          ))}
          {goesInto.length > 0 ? <span style={{ ...quiet, marginLeft: uses.length > 0 ? 8 : 0 }}>Goes into</span> : null}
          {goesInto.map((to) => (
            <span key={to.id} style={chip}>
              {to.number} · {stepTitle(to)}
            </span>
          ))}
        </div>
      ) : null}
      {mode === "reader" && props.renderBefore ? props.renderBefore(step) : null}
      {mode === "reader" && !props.renderBefore && before.length > 0 ? (
        <section style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h3 style={{ ...text(13, 500, t.text), margin: 0 }}>{FULL_PROMPT_COPY.before}</h3>
          {before.map((line) => (
            <span key={line} style={text(13.5, 400, t.text)}>
              {line}
            </span>
          ))}
        </section>
      ) : null}
      <div
        style={{
          paddingTop: 16,
          borderTop: `1px solid ${t.hairlineModule}`,
          display: "flex",
          flexWrap: phone ? "wrap" : undefined,
          alignItems: "center",
          gap: 4,
          ...(phone ? { position: "sticky", bottom: 0, background: t.window, paddingBottom: "calc(12px + env(safe-area-inset-bottom))", marginTop: "auto" } : null),
        }}
      >
        {onNavigate && previous ? (
          <Button variant="ghost" size={phone ? 48 : 28} fontSize={12} onClick={() => onNavigate(previous.id)} aria-label={`Previous prompt: ${stepTitle(previous)}`}>
            <span style={navLabel}>← {stepTitle(previous)}</span>
          </Button>
        ) : null}
        {onNavigate && next ? (
          <Button variant="ghost" size={phone ? 48 : 28} fontSize={12} onClick={() => onNavigate(next.id)} aria-label={`Next prompt: ${stepTitle(next)}`}>
            <span style={navLabel}>{stepTitle(next)} →</span>
          </Button>
        ) : null}
        <span style={{ ...text(12, 400, t.label), flexGrow: 1, textAlign: "center" }}>{phone ? null : FULL_PROMPT_COPY.hint}</span>
        <Button size={phone ? 48 : 32} fontSize={13} onClick={onClose} style={phone ? undefined : { height: 30 }}>
          {FULL_PROMPT_COPY.done}
        </Button>
      </div>
      <span hidden data-testid="full-prompt-place">{place}</span>
    </div>
  );
}

export function RefinedFullPromptWindow(props: FullPromptWindowProps) {
  const phone = useIsPhone();
  const prompts = windowPrompts(props.steps);
  const step = props.openId ? prompts.find((candidate) => candidate.id === props.openId) : undefined;
  const { onNavigate } = props;

  /** ← and → move between prompts, but not while a field has focus: there they move the cursor. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!step || !onNavigate || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    if ((event.target as HTMLElement).matches("input, textarea, select, [contenteditable]")) return;
    const { previous, next } = neighbours(prompts, step.id);
    const to = event.key === "ArrowLeft" ? previous : next;
    if (!to) return;
    event.preventDefault();
    onNavigate(to.id);
  };

  return (
    <Dialog.Root open={Boolean(step)} onOpenChange={(open) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 60 }} />
        <Dialog.Content
          data-testid="full-prompt-window"
          data-look="refined"
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onKeyDown={onKeyDown}
          style={{
            position: "fixed",
            zIndex: 61,
            boxSizing: "border-box",
            overflowY: "auto",
            background: t.window,
            color: t.text,
            fontFamily: FIGTREE,
            ...(phone
              ? { inset: 0, padding: "16px 16px 0" }
              : {
                  top: 96,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "min(760px, calc(100vw - 32px))",
                  maxHeight: "calc(100dvh - 120px)",
                  padding: "20px 24px",
                  border: `1px solid ${t.windowBorder}`,
                  borderRadius: 12,
                  boxShadow: t.windowShadow,
                }),
          }}
        >
          {step ? <Body key={step.id} props={props} step={step} prompts={prompts} phone={phone} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default RefinedFullPromptWindow;
