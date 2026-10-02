/* UI-P30 — "Run it yourself" and "Understand it", inside the part viewer.

   RUN: the same sequence RunView walks (collectRunSequence: the registry's
   copyable parts as numbered steps, the prerequisites as a checklist above
   them, no notes anywhere), in the site frame's grammar — the number in the
   display face in `--label`, as the anatomy rows number their parts; the step's
   prompt or code in a `--recess` well (radius 12, 12px 14px, DM Mono 12) with
   its own secondary 30/12 Copy; "Copy all steps" for the whole sequence as
   RunView writes it. Prose at Figtree 14, line-height 1.65.

   WHERE A CREATOR APPROVED A RUN LAYER it is offered beside the sequence as "In
   words", never instead of it: the sequence stays the default, as RunItPanel
   has it.

   UNDERSTAND: `LayerSteps`, the approved layer's steps in the same numbered
   grammar. THE ATTRIBUTION LINE COMES FIRST AND CANNOT BE LEFT OUT — it is
   rendered here, not by a caller, which is LayerView's rule carried over: a
   reader must never mistake generated words for the creator's.

   PURE. Copying goes through the page's `onCopy`, which resolves true when the
   clipboard took it. */

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/brand/Button";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { Segmented, type SegmentedItem } from "@/components/brand/Segmented";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, display } from "@/lib/theme/type";

import type { LayerStepsView, RunBodyView, RunStepView } from "./buildModel";

/** A step's text is shown in full up to this many lines, then on request. */
export const WELL_LINES = 20;
/** How long a Copy button says it worked. */
const COPIED_MS = 1500;

const VISUALLY_HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

const pad2 = (n: number) => String(n).padStart(2, "0");

/** The numbered grammar both bodies share: the number in the display face, the rest beside it. */
const stepGrid = (phone: boolean): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: phone ? "30px minmax(0, 1fr)" : "28px minmax(0, 1fr)",
  gap: 8,
  alignItems: "start",
});

const numberStyle: CSSProperties = { ...display(20), color: t.label };

/** A polite live region of its own: the bodies sit outside the view's announcer. */
function useCopied(onCopy: (text: string) => Promise<boolean>) {
  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (key: string, text: string) => {
      if (!(await onCopy(text))) return;
      setCopied(key);
      setMessage("Copied");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setCopied(null);
        setMessage("");
      }, COPIED_MS);
    },
    [onCopy],
  );

  const region = (
    <div role="status" aria-live="polite" style={VISUALLY_HIDDEN}>
      {message}
    </div>
  );
  return { copied, copy, region };
}

/* ── the well ── */

function Well({ text, phone }: { text: string; phone: boolean }) {
  const [open, setOpen] = useState(false);
  const lines = text.split("\n");
  const long = lines.length > WELL_LINES;
  const shown = long && !open ? lines.slice(0, WELL_LINES).join("\n") : text;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <pre
        data-testid="build-run-well"
        style={{
          margin: 0,
          padding: "12px 14px",
          borderRadius: r.control,
          background: t.recess,
          fontFamily: DM_MONO,
          fontSize: 12,
          lineHeight: 1.55,
          color: t.text,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          minWidth: 0,
        }}
      >
        {shown}
      </pre>
      {long ? (
        <TextButton onClick={() => setOpen((value) => !value)} phone={phone} expanded={open}>
          {open ? "Show fewer lines" : `Show all ${lines.length.toLocaleString("en-GB")} lines`}
        </TextButton>
      ) : null}
    </div>
  );
}

/** A quiet text control in `--action`: 44 tall, the line where the text sits. */
function TextButton({
  children,
  onClick,
  phone,
  expanded,
}: {
  children: string;
  onClick: () => void;
  phone: boolean;
  expanded?: boolean;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      {...handlers}
      style={{
        alignSelf: "flex-start",
        /* A 44px target around a 13px line: the padding is the target, the negative margins keep the line in place. */
        margin: "-14px 0",
        padding: "14px 0",
        border: 0,
        background: "transparent",
        fontFamily: FIGTREE,
        fontSize: phone ? 14 : 13,
        color: t.action,
        textDecoration: "underline",
        textUnderlineOffset: 3,
        cursor: "pointer",
        borderRadius: r.chip,
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </button>
  );
}

/* ── run it yourself ── */

function Step({
  step,
  number,
  phone,
  copied,
  onCopy,
}: {
  step: RunStepView;
  number: number;
  phone: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <li data-testid="build-run-step" data-node-id={step.id} style={stepGrid(phone)}>
      <span aria-hidden="true" style={numberStyle}>
        {pad2(number)}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 30 }}>
          <h3 style={{ margin: 0, fontFamily: FIGTREE, fontSize: phone ? 15 : 14, fontWeight: 600, lineHeight: 1.4, color: t.text, minWidth: 0, flexGrow: 1 }}>
            <span style={VISUALLY_HIDDEN}>{`Step ${number}: `}</span>
            {step.title}
            <span style={{ fontFamily: DM_MONO, fontSize: 10, fontWeight: 400, color: t.text2, marginLeft: 8, whiteSpace: "nowrap" }}>
              {step.kind}
            </span>
          </h3>
          {step.copyText ? (
            <Button
              variant="secondary"
              size={30}
              fontSize={12}
              icon={copied ? Check : Copy}
              onClick={onCopy}
              aria-label={`Copy step ${number}: ${step.title}`}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          ) : null}
        </div>
        {step.copyText ? (
          <Well text={step.copyText} phone={phone} />
        ) : (
          <p style={{ margin: 0, color: t.text2 }}>This step carries nothing to copy yet.</p>
        )}
      </div>
    </li>
  );
}

const WAYS: readonly SegmentedItem<"sequence" | "words">[] = [
  { value: "sequence", label: "The sequence" },
  { value: "words", label: "In words" },
];

export function RunBody({
  run,
  phone = false,
  onCopy,
  onOpenPart,
}: {
  run: RunBodyView;
  phone?: boolean;
  onCopy: (text: string) => Promise<boolean>;
  onOpenPart?: (id: string) => void;
}) {
  const [way, setWay] = useState<"sequence" | "words">("sequence");
  const { copied, copy, region } = useCopied(onCopy);
  const { steps, prerequisites, allText, words } = run;

  const head =
    words || steps.length > 0 ? (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        {words ? (
          <Segmented<"sequence" | "words">
            items={WAYS}
            value={way}
            onChange={(next) => setWay(next)}
            size={phone ? 34 : 30}
            fontSize={phone ? 12 : 11}
            label="How to read this build"
          />
        ) : (
          <span />
        )}
        {way === "sequence" && steps.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: DM_MONO, fontSize: 11, color: t.text2 }}>
              {steps.length === 1 ? "1 step" : `${steps.length.toLocaleString("en-GB")} steps`}
            </span>
            <Button
              variant="secondary"
              size={30}
              fontSize={12}
              icon={copied === "all" ? Check : Copy}
              onClick={() => void copy("all", allText)}
            >
              {copied === "all" ? "Copied" : "Copy all steps"}
            </Button>
          </div>
        ) : null}
      </div>
    ) : null;

  if (way === "words" && words) {
    return (
      <section data-testid="build-run" aria-label="Run it yourself" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {head}
        <LayerSteps layer={words} phone={phone} onOpenPart={onOpenPart} />
        {region}
      </section>
    );
  }

  if (steps.length === 0 && prerequisites.length === 0) {
    return (
      <section data-testid="build-run" aria-label="Run it yourself" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {head}
        <p style={{ margin: 0, color: t.text2 }}>Nothing in this build is runnable yet: none of its parts is one a reader copies and runs.</p>
      </section>
    );
  }

  return (
    <section data-testid="build-run" aria-label="Run it yourself" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {head}

      {prerequisites.length > 0 ? (
        <div data-testid="build-run-before" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Eyebrow size={10} as="h3" style={{ margin: 0 }}>
            Before you start
          </Eyebrow>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {prerequisites.map((item) => (
              <li key={item.id} data-node-id={item.id} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span
                  aria-hidden="true"
                  style={{ width: 10, height: 10, flexShrink: 0, borderRadius: r.full, border: `1.5px solid ${t.line}`, transform: "translateY(1px)" }}
                />
                <span style={{ minWidth: 0 }}>
                  {item.title}
                  {item.requirement ? <span style={{ color: t.text2 }}> — {item.requirement}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {steps.length > 0 ? (
        <ol aria-label="Steps" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          {steps.map((step, index) => (
            <Step
              key={step.id}
              step={step}
              number={index + 1}
              phone={phone}
              copied={copied === step.id}
              onCopy={() => void copy(step.id, step.copyText ?? "")}
            />
          ))}
        </ol>
      ) : null}
      {region}
    </section>
  );
}

/* ── a generated layer ── */

export function LayerSteps({
  layer,
  phone = false,
  onOpenPart,
}: {
  layer: LayerStepsView;
  phone?: boolean;
  onOpenPart?: (id: string) => void;
}) {
  return (
    <div data-testid="build-layer" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Whose words these are. First, every time, and not dismissable. */}
      <p
        data-testid="layer-attribution"
        style={{
          margin: 0,
          paddingBottom: 10,
          borderBottom: `1px solid ${t.hairline}`,
          fontFamily: DM_MONO,
          fontSize: 11,
          lineHeight: 1.5,
          color: t.text2,
        }}
      >
        {layer.attribution}
      </p>
      {layer.steps.length === 0 ? (
        <p style={{ margin: 0, color: t.text2 }}>This layer has no steps in it.</p>
      ) : (
        <ol aria-label="Steps" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          {layer.steps.map((step) => (
            <li key={step.n} data-testid="build-layer-step" style={stepGrid(phone)}>
              <span aria-hidden="true" style={numberStyle}>
                {pad2(step.n)}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                {step.title ? (
                  <h3 style={{ margin: 0, fontFamily: FIGTREE, fontSize: phone ? 15 : 14, fontWeight: 600, lineHeight: 1.4, color: t.text }}>
                    <span style={VISUALLY_HIDDEN}>{`Step ${step.n}: `}</span>
                    {step.title}
                  </h3>
                ) : null}
                {step.body ? <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{step.body}</p> : null}
                {step.part && onOpenPart ? (
                  <TextButton onClick={() => onOpenPart(step.part!.id)} phone={phone}>
                    {`${step.part.title || "This step’s part"} in the anatomy →`}
                  </TextButton>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default RunBody;
