/* UI-P67 — the full prompt window: one prompt, whole.

   For the maker (the title is a field) and, from UI-P73, for readers (the
   title is the heading and nothing can be changed). It is a Radix Dialog, so
   focus is trapped, Escape closes and the page behind is inert; opening puts
   focus on the text box, and closing returns it to whatever opened the window.

   PURE. Steps in, intentions out: the page owns which prompt is open
   (`openId`) and what a title write does (`onTitle`, `setStepTitle`). The
   window moves between prompts with ← and → through `onNavigate`, but never
   while a field has focus, so the arrows still move the cursor in the title.

   A title the maker did not type stays the default: an empty field saves as
   "" and the page puts the default back (DATA §1). Nothing here names a
   prompt for the maker. */

import * as Dialog from "@radix-ui/react-dialog";
import { Copy, Pencil, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@/components/brand/Button";
import { IconButton } from "@/components/brand/IconButton";
import { LiveRegion, useAnnouncer } from "@/components/brand/LiveRegion";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { stepTitle, TITLE_MAX, type SessionGroup, type Step } from "@/lib/build/graph";
import { modelLabel } from "@/lib/models/registry";
import { tokenAlpha, t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, display } from "@/lib/theme/type";

export type FullPromptMode = "maker" | "reader";

export interface FullPromptWindowProps {
  steps: readonly Step[];
  /** The step that is open; null or an id that is not a prompt keeps the window closed. */
  openId: string | null;
  mode: FullPromptMode;
  /** Maker mode: save a title; "" puts the default back. */
  onTitle?: (id: string, title: string) => void;
  onClose: () => void;
  /** Move to another prompt (← →). Absent, the arrows and the two buttons are left out. */
  onNavigate?: (id: string) => void;
  /** The build's sessions, for the "Session {n} · {tool}" chips. */
  groups?: readonly SessionGroup[];
  /** File and tool names, by node id, for the Uses chips. */
  names?: Readonly<Record<string, string>>;
}

export const FULL_PROMPT_COPY = {
  hint: "Esc closes · ← → move between prompts",
  copied: "Copied",
  copy: "Copy prompt",
  done: "Done",
  before: "Before you send it",
} as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "" : `${at.getDate()} ${MONTHS[at.getMonth()]}`;
}

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children)]);

const isInstructions = (step: Pick<Step, "id">): boolean => step.id.endsWith(":instructions");

/** The prompts the window moves between: every step with a text of its own, in order. */
export function windowPrompts(steps: readonly Step[]): Step[] {
  return flatten(steps).filter((step) => step.kind === "prompt");
}

/** The prompts either side of `id`: null at either end. */
export function neighbours(prompts: readonly Step[], id: string): { previous: Step | null; next: Step | null } {
  const at = prompts.findIndex((step) => step.id === id);
  if (at < 0) return { previous: null, next: null };
  return { previous: prompts[at - 1] ?? null, next: prompts[at + 1] ?? null };
}

const mono = (size: 11.5 | 12): CSSProperties => ({ fontFamily: DM_MONO, fontSize: size, color: t.text2 });

const chipStyle = (height: number, size: 11.5 | 12): CSSProperties => ({
  height,
  padding: "0 8px",
  boxSizing: "border-box",
  borderRadius: 8,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: tokenAlpha("action", 0.12),
  color: t.text,
  fontFamily: DM_MONO,
  fontSize: size,
  whiteSpace: "nowrap",
});

function Chip({ children }: { children: ReactNode }) {
  return <span style={chipStyle(26, 12)}>{children}</span>;
}

/** The title as a field: saved on blur and on Enter, put back on Esc. */
function TitleField({ step, onTitle, phone }: { step: Step; onTitle: (id: string, title: string) => void; phone: boolean }) {
  const [draft, setDraft] = useState(step.title ?? "");
  const save = () => {
    if (draft.trim() !== (step.title ?? "")) onTitle(step.id, draft);
  };
  return (
    <div>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          aria-label="Title"
          value={draft}
          maxLength={TITLE_MAX}
          placeholder={step.defaultTitle}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            // Esc closes the window and unmounts the field before it can blur, so it saves here too.
            if (event.key === "Escape") save();
            if (event.key === "Enter") {
              event.preventDefault();
              save();
            }
          }}
          style={{
            ...display(27),
            width: "100%",
            height: 50,
            boxSizing: "border-box",
            padding: "0 40px 0 14px",
            borderRadius: 12,
            border: `1px solid ${t.line}`,
            background: t.field,
            color: t.text,
            fontSize: phone ? 22 : undefined,
          }}
        />
        <Pencil size={16} strokeWidth={1.6} aria-hidden="true" color="var(--text2)" style={{ position: "absolute", right: 14, top: 17, pointerEvents: "none" }} />
      </div>
      <p style={{ ...mono(11.5), margin: "6px 0 0" }}>Title · starts as "{step.defaultTitle}" · only you can change it</p>
    </div>
  );
}

/** The text, whole: scrolls, keeps its line breaks, and fades while there is more below. */
function TextBox({ text, boxRef, phone }: { text: string; boxRef: React.RefObject<HTMLDivElement | null>; phone: boolean }) {
  const [more, setMore] = useState(false);
  const measure = () => {
    const box = boxRef.current;
    if (box) setMore(box.scrollHeight - box.scrollTop - box.clientHeight > 1);
  };
  useLayoutEffect(measure);
  return (
    <div style={{ position: "relative" }}>
      <div
        ref={boxRef}
        tabIndex={0}
        role="region"
        aria-label="Full prompt text"
        data-testid="full-prompt-text"
        onScroll={measure}
        style={{
          height: phone ? "42dvh" : 372,
          overflowY: "auto",
          boxSizing: "border-box",
          padding: "16px 26px 16px 18px",
          borderRadius: 12,
          border: `1px solid ${t.hairline}`,
          background: t.recess,
          color: t.text,
          fontFamily: FIGTREE,
          fontSize: 15,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }}
      >
        {text}
      </div>
      {more ? (
        <span
          aria-hidden="true"
          data-testid="full-prompt-fade"
          style={{ position: "absolute", left: 1, right: 1, bottom: 1, height: 48, borderRadius: "0 0 11px 11px", pointerEvents: "none", background: `linear-gradient(to bottom, transparent, ${t.recess})` }}
        />
      ) : null}
    </div>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function Body({ props, step, prompts, phone }: { props: FullPromptWindowProps; step: Step; prompts: readonly Step[]; phone: boolean }) {
  const { mode, steps, groups = [], names = {}, onTitle, onClose, onNavigate } = props;
  const [said, say] = useAnnouncer();
  const textRef = useRef<HTMLDivElement>(null);
  const { previous, next } = neighbours(prompts, step.id);
  const place = prompts.findIndex((candidate) => candidate.id === step.id) + 1;
  const instructions = isInstructions(step);

  // Opening puts focus on the text box.
  useEffect(() => {
    textRef.current?.focus();
  }, []);

  const group = step.sessionId
    ? groups.find((candidate) => candidate.sessionId === step.sessionId)
    : groups.find((candidate) => candidate.sessionId === null && candidate.stepNumbers.includes(step.number));
  const inSession = group ? group.stepNumbers.indexOf(step.number) + 1 : 0;
  const tool = group?.tool ?? step.tool;
  const model = step.model ? modelLabel(step.model) : group?.model ?? null;
  const when = group?.sessionId ? shortDate(group.startedAt) : "";
  const facts = [
    group || tool ? `${group?.sessionId ? `Session ${group.number}` : "Typed here"}${tool ? ` · ${tool}` : ""}` : null,
    model,
    when || null,
    group && inSession > 0 ? `prompt ${inSession} of ${group.stepNumbers.length} in the session` : null,
  ].filter((fact): fact is string => Boolean(fact));

  const all = flatten(steps);
  const uses = step.uses.flatMap((use) => {
    if (use.kind === "output") {
      const from = all.find((candidate) => candidate.id === use.node_id);
      return from ? [{ key: `${use.kind}:${use.node_id}`, label: `Output of ${from.number} · ${stepTitle(from)}`, paste: `Paste in: what step ${from.number} gave you` }] : [];
    }
    const name = names[use.node_id];
    return name ? [{ key: `${use.kind}:${use.node_id}`, label: name, paste: use.kind === "file" ? `Attach ${name}` : null }] : [];
  });
  const goesInto = all.filter((candidate) => candidate.id !== step.id && candidate.uses.some((use) => use.kind === "output" && use.node_id === step.id));
  const before = uses.flatMap((use) => (use.paste ? [use.paste] : []));

  const copy = async () => {
    say((await copyText(step.text)) ? FULL_PROMPT_COPY.copied : "Couldn't copy. Select the text and copy it.");
  };

  const rowHeight = phone ? 48 : 30;
  const head = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <Dialog.Title style={{ ...mono(11.5), margin: 0, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Prompt {step.number} of {prompts.length} · full prompt
      </Dialog.Title>
      <Dialog.Close asChild>
        <IconButton icon={X} label="Close" size={30} />
      </Dialog.Close>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: phone ? "100%" : undefined }}>
      <LiveRegion message={said} />
      {head}
      {mode === "maker" && onTitle && !instructions ? (
        <TitleField key={step.id} step={step} onTitle={onTitle} phone={phone} />
      ) : (
        <h2 style={{ ...display(27), margin: 0, color: step.title ? t.text : t.text2, overflowWrap: "anywhere" }} data-default-title={step.title ? undefined : "true"}>
          {stepTitle(step)}
        </h2>
      )}
      {facts.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {facts.map((fact) => (
            <Chip key={fact}>{fact}</Chip>
          ))}
        </div>
      ) : null}
      <TextBox key={step.id} text={step.text} boxRef={textRef} phone={phone} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={mono(12)}>{step.words} words</span>
        <Button variant="secondary" size={phone ? 48 : 30} fontSize={12} icon={Copy} onClick={() => void copy()}>
          {FULL_PROMPT_COPY.copy}
        </Button>
      </div>
      {uses.length > 0 || goesInto.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          {uses.length > 0 ? <span style={mono(12)}>Uses</span> : null}
          {uses.map((use) => (
            <span key={use.key} style={chipStyle(24, 11.5)}>
              {use.label}
            </span>
          ))}
          {goesInto.length > 0 ? <span style={{ ...mono(12), marginLeft: uses.length > 0 ? 8 : 0 }}>Goes into</span> : null}
          {goesInto.map((to) => (
            <span key={to.id} style={chipStyle(24, 11.5)}>
              {to.number} · {stepTitle(to)}
            </span>
          ))}
        </div>
      ) : null}
      {mode === "reader" && before.length > 0 ? (
        <section style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h3 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, fontWeight: 600, color: t.text }}>{FULL_PROMPT_COPY.before}</h3>
          {before.map((line) => (
            <span key={line} style={{ fontFamily: FIGTREE, fontSize: 13.5, color: t.text }}>
              {line}
            </span>
          ))}
        </section>
      ) : null}
      <div
        style={{
          marginTop: 4,
          paddingTop: 18,
          borderTop: `1px solid ${t.hairline}`,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          ...(phone ? { position: "sticky", bottom: 0, background: t.flat, paddingBottom: "calc(12px + env(safe-area-inset-bottom))", marginTop: "auto" } : null),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          {onNavigate && previous ? (
            <Button variant="ghost" size={phone ? 48 : 30} fontSize={12} onClick={() => onNavigate(previous.id)} aria-label={`Previous prompt: ${stepTitle(previous)}`}>
              <span style={{ maxWidth: phone ? 110 : 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>← {stepTitle(previous)}</span>
            </Button>
          ) : null}
          {onNavigate && next ? (
            <Button variant="ghost" size={phone ? 48 : 30} fontSize={12} onClick={() => onNavigate(next.id)} aria-label={`Next prompt: ${stepTitle(next)}`}>
              <span style={{ maxWidth: phone ? 110 : 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stepTitle(next)} →</span>
            </Button>
          ) : null}
        </div>
        {!phone ? <span style={mono(12)}>{FULL_PROMPT_COPY.hint}</span> : null}
        <Button size={phone ? 48 : 30} fontSize={13} onClick={onClose}>
          {FULL_PROMPT_COPY.done}
        </Button>
      </div>
      <span hidden data-testid="full-prompt-place">{place}</span>
    </div>
  );
}

export function FullPromptWindow(props: FullPromptWindowProps) {
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
          aria-describedby={undefined}
          // Focus goes to the text box (Body does it), not the first control.
          onOpenAutoFocus={(event) => event.preventDefault()}
          onKeyDown={onKeyDown}
          style={{
            position: "fixed",
            zIndex: 61,
            boxSizing: "border-box",
            overflowY: "auto",
            background: t.flat,
            color: t.text,
            fontFamily: FIGTREE,
            ...(phone
              ? { inset: 0, padding: "14px 14px 0" }
              : {
                  top: 104,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "min(780px, calc(100vw - 32px))",
                  maxHeight: "calc(100dvh - 128px)",
                  padding: "22px 24px 20px",
                  border: `1px solid ${t.line}`,
                  borderRadius: 16,
                  boxShadow: t.shadowFloat,
                }),
          }}
        >
          {step ? <Body key={step.id} props={props} step={step} prompts={prompts} phone={phone} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default FullPromptWindow;
