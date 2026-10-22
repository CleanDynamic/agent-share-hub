/* CA-16 P5 — the Classification Card.

   WHAT IT IS. The sheet where a build is described and filed in the Gallery. It was "Card" (UI-P94: Cover, Title, one-line
   summary, Who it's for, Made with, More details). The internal names stay (`SandboxCard`, `data-testid="sandbox-card"`,
   `CARD_FIELD_ID`), so a link or a test that finds it still does; what the maker reads is "Classification Card".

   THE SHEET AND ITS MANNERS ARE AS THEY WERE: the Radix Dialog (focus trapped, Esc closes, the page behind inert), the
   window recipe with `--sheet-shadow`, 472 wide and inset 6 from the top, right and bottom, radius 12, over `--scrim`; a
   phone keeps the full-height sheet and 44-high targets.

   TOP TO BOTTOM. The header (the title, "How this build is described and filed in the Gallery", the square close). The
   preview: the gallery card as the Gallery draws it, with no cover. The Title, the only required field. Then the Optional
   section, every row closed: Summary, Field, Task, Setting, Tools and stack, Data handled, Age suitability, Read from your
   build, Build details. The footer says "Required: a title" or "All required fields complete", then Cancel and Save.

   A DRAFT, SAVED ONCE. The Card edits a draft of everything on it (the title, the summary, the classification, the build
   details) and writes it with Save; Cancel drops it. Save writes the title, the summary and the details through the
   page's own handlers, and the classification through `classification.onSave`, which also sets `shape` from What was
   built. Until the CA-16 migration is applied, the classification cannot be stored: the Card says so in one line and
   saves everything else.

   THE COVER AND "WHO IT'S FOR" ARE NOT ON THE CARD. The cover is the first picture in the post (PT-05) and is edited
   there; Setting replaces "Who it's for", and `made_for` is no longer written. Made with stays, inside Tools and stack:
   it is how a maker takes a model out of the list the sessions gave. */

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { Button } from "@/components/brand/Button";
import { IconButton } from "@/components/brand/IconButton";
import { Segmented } from "@/components/brand/Segmented";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { emptyClassification, shownValues } from "@/lib/classify/facets";
import { labelFor, stackValuesOf } from "@/lib/classify/lines";
import { suggestFor, type SuggestFacet } from "@/lib/classify/suggest";
import { AGE_VALUES, FIELD_MAX, SETTING_MAX, TASK_MAX, pathOf, type Facet } from "@/lib/classify/taxonomy";
import { isCustomEntry, type Dispute, type Entry } from "@/lib/classify/types";

import { CardPreview } from "./CardPreview";
import { ClassificationPicker } from "./ClassificationPicker";
import { applyDraft, draftOf, type ClassificationCardData, type ClassificationDraft } from "./classificationCardModel";
import { useRing } from "./composeFields";
import { DESCRIPTION_MAX } from "./composeModel";
import { MadeWithLine } from "./MadeWithLine";
import { OptionalRow, OptionalSection } from "./OptionalSection";
import { ReadFromBuild } from "./ReadFromBuild";
import { text, tnum, typedArea, typedField, wellField } from "./refinedStyles";
import { type ComposeViewProps } from "./ComposeView";
import { type ComposeDetailKey, type ComposeDetails } from "./MoreDetails";

/** Where the Card opens: the field a missing item names. */
export type CardField = "cover" | "title" | "summary" | "audience";

/** The element ids focus lands on, one per field. The cover and the audience are no longer on the Card, so those two find nothing. */
export const CARD_FIELD_ID: Record<CardField, string> = {
  cover: "card-cover",
  title: "card-title",
  summary: "card-summary",
  audience: "card-audience",
};

export type CardProps = Pick<
  ComposeViewProps,
  | "title"
  | "onTitle"
  | "description"
  | "onDescription"
  | "audience"
  | "onAudience"
  | "audienceOptions"
  | "cover"
  | "adding"
  | "mediaError"
  | "accept"
  | "onFiles"
  | "onRemoveCover"
  | "madeWith"
  | "onToggleMadeWith"
  | "onAddMadeWith"
  | "details"
  | "onDetail"
  | "onGapSwitch"
> & {
  /** CA-16: the classification, from the page. Absent: the Card shows only the title, the summary and the build details. */
  classification?: ClassificationCardData;
};

export interface SandboxCardProps extends CardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The field to land on, or null to leave focus where the sheet puts it. */
  field: CardField | null;
  /** A result's picture can be the cover: present only when a result has one. */
  onUseResultPicture?: () => void;
  phone: boolean;
  /** PT-05: closes the sheet and opens the Post tab. The Card no longer carries the cover line, so nothing here uses it. */
  onEditPost?: () => void;
}

export const CLASSIFICATION_CARD = "Classification Card";
export const CARD_SUBTITLE = "How this build is described and filed in the Gallery";
export const NOT_LIVE_LINE = "Classification will save once the database update is applied";

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** A field: the label 12.5/500 (and what sits on its right) over the control, 8 apart. */
function RefinedField({ id, label, right, children }: { id: string; label: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <label htmlFor={id} style={text(12.5, 500, t.text)}>
          {label}
        </label>
        {right ? <span style={{ marginLeft: "auto" }}>{right}</span> : null}
      </div>
      {children}
    </div>
  );
}

function BountySwitch({ on, onChange, phone }: { on: boolean; onChange: (on: boolean) => void; phone: boolean }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      {...handlers}
      style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 8, minHeight: phone ? 44 : 32, padding: "0 4px", margin: "0 -4px", border: 0, borderRadius: 6, background: "transparent", cursor: "pointer", ...text(13, 400, t.text), ...ring(state.focusVisible) }}
    >
      <span aria-hidden="true" style={{ position: "relative", width: 36, height: 22, borderRadius: 12, background: on ? t.evidence : t.line, flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 3, left: 3, width: 16, height: 16, borderRadius: 8, background: t.field, transform: on ? "translateX(14px)" : "none" }} />
      </span>
      Open a bounty
    </button>
  );
}

function NumberInput({ id, label, value, whole, phone, onChange }: { id: string; label: string; value: string; whole?: boolean; phone: boolean; onChange: (value: string) => void }) {
  const focus = useRing<HTMLInputElement>();
  return (
    <RefinedField id={id} label={label}>
      <input
        id={id}
        type="number"
        inputMode={whole ? "numeric" : "decimal"}
        min={0}
        step={whole ? 1 : "any"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...focus.handlers}
        style={{ ...typedField(phone), ...focus.style }}
      />
    </RefinedField>
  );
}

function BuildDetails({ phone, details, onChange, onGap }: { phone: boolean; details: ComposeDetails; onChange: (key: ComposeDetailKey, value: string) => void; onGap: (on: boolean) => void }) {
  const brokeRing = useRing<HTMLTextAreaElement>();
  const fixRing = useRing<HTMLTextAreaElement>();
  const gapRing = useRing<HTMLInputElement>();
  const money = (value: string) => (value.trim() ? `£${value}` : "");
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <OptionalRow rowId="card-known-issue" label="Known issue" value={details.symptom.trim() ? details.symptom : ""} phone={phone}>
        <RefinedField id="card-problem" label="Problem">
          <textarea id="card-problem" rows={2} value={details.symptom} placeholder="e.g. exiftool: command not found" onChange={(event) => onChange("symptom", event.target.value)} {...brokeRing.handlers} style={{ ...typedArea(phone), ...brokeRing.style }} />
        </RefinedField>
        <RefinedField id="card-fix" label="Fix">
          <textarea id="card-fix" rows={2} value={details.resolution} placeholder="e.g. Install it first with brew install exiftool." onChange={(event) => onChange("resolution", event.target.value)} {...fixRing.handlers} style={{ ...typedArea(phone), ...fixRing.style }} />
        </RefinedField>
      </OptionalRow>
      <OptionalRow rowId="card-build-cost" label="Build cost (£)" value={money(details.costSetup)} phone={phone}>
        <NumberInput id="card-build-cost-input" label="Build cost (£)" value={details.costSetup} phone={phone} onChange={(value) => onChange("costSetup", value)} />
      </OptionalRow>
      <OptionalRow rowId="card-running-cost" label="Running cost per month (£)" value={money(details.costMonthly)} phone={phone}>
        <NumberInput id="card-running-cost-input" label="Running cost per month (£)" value={details.costMonthly} phone={phone} onChange={(value) => onChange("costMonthly", value)} />
      </OptionalRow>
      <OptionalRow rowId="card-first-result" label="Time to first result (minutes)" value={details.firstResult.trim() ? `${details.firstResult} min` : ""} phone={phone}>
        <NumberInput id="card-first-result-input" label="Time to first result (minutes)" value={details.firstResult} whole phone={phone} onChange={(value) => onChange("firstResult", value)} />
      </OptionalRow>
      <OptionalRow rowId="card-bounty" label="Open a bounty" value={details.gapOn ? (details.gapProblem.trim() ? details.gapProblem : "On") : ""} phone={phone}>
        <BountySwitch on={details.gapOn} onChange={onGap} phone={phone} />
        {details.gapOn ? (
          <>
            <RefinedField id="card-left-open" label="What is left open">
              <input id="card-left-open" type="text" autoComplete="off" value={details.gapProblem} onChange={(event) => onChange("gapProblem", event.target.value)} {...gapRing.handlers} style={{ ...typedField(phone), ...gapRing.style }} />
            </RefinedField>
            <p style={{ margin: 0, ...text(12, 400, t.text2) }}>Readers will see it as one part left open. You can add a reward on Bounties after publishing.</p>
          </>
        ) : null}
      </OptionalRow>
    </div>
  );
}

const entriesLine = (facet: Facet, entries: readonly Entry[]): string =>
  entries.map((entry) => (isCustomEntry(entry) ? entry.custom : facet === "field" ? pathOf(entry.id, facet) : labelFor(facet, entry.id))).join(", ");

function CardBody(props: SandboxCardProps) {
  const { phone, classification: data } = props;
  const [title, setTitle] = useState(props.title);
  const [summary, setSummary] = useState(props.description);
  const [details, setDetails] = useState<ComposeDetails>(props.details);
  const [draft, setDraft] = useState<ClassificationDraft>(() => draftOf(data?.stored ?? emptyClassification()));
  const [saving, setSaving] = useState(false);
  const titleRing = useRing<HTMLInputElement>();
  const summaryRing = useRing<HTMLTextAreaElement>();
  const fieldText = phone ? 16 : 13.5;

  const stored = data?.stored ?? null;
  const candidate = useMemo(() => (data ? applyDraft(stored, data.derived, draft) : null), [data, stored, draft]);
  const questions = useMemo(() => (data ? data.questions.filter((question) => !draft.dismissed.includes(question.id)) : []), [data, draft.dismissed]);

  /* Suggestions read the title, the summary and the prompts as the maker is typing them. */
  const texts = useMemo(() => [title, summary, ...(data?.texts ?? [])], [title, summary, data?.texts]);
  const suggestions = useMemo(() => {
    const out = {} as Record<SuggestFacet, ReturnType<typeof suggestFor>>;
    for (const facet of ["field", "task", "setting", "data", "stack"] as const) {
      const chosen = facet === "stack" ? [...draft.stack, ...(data?.derived.stack?.values ?? []).map((id) => ({ id }))] : draft[facet];
      out[facet] = data ? suggestFor(facet, { texts, derived: data.derived, chosen }) : [];
    }
    return out;
  }, [data, texts, draft]);

  const set = <K extends keyof ClassificationDraft>(key: K, value: ClassificationDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const titleOk = title.trim() !== "";

  const onSave = async () => {
    if (!titleOk || saving) return;
    setSaving(true);
    try {
      if (title !== props.title) props.onTitle(title);
      if (summary !== props.description) props.onDescription(summary);
      for (const key of ["symptom", "resolution", "costMonthly", "costSetup", "firstResult", "gapProblem"] as const) {
        if (details[key] !== props.details[key]) props.onDetail(key, details[key]);
      }
      if (details.gapOn !== props.details.gapOn) props.onGapSwitch(details.gapOn);
      if (data) await data.onSave(draft);
      props.onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const derivedStack = data?.derived.stack?.values ?? [];
  const stackLine = candidate ? stackValuesOf(candidate).join(", ") : "";
  const builtLine = candidate ? [...shownValues(candidate, "built").values, ...shownValues(candidate, "role").values].map((id, index) => labelFor(index < shownValues(candidate, "built").values.length ? "built" : "role", id)).join(", ") : "";
  const open = (field: CardField) => props.field === field;

  const suggestionCount = (facet: SuggestFacet) => (suggestions[facet].length > 0 ? plural(suggestions[facet].length, "suggestion", "suggestions") : undefined);

  return (
    <>
      <div style={{ flexGrow: 1, overflowY: "auto", padding: phone ? 16 : 24, display: "flex", flexDirection: "column", gap: 24 }}>
        <CardPreview title={title} classification={candidate} />

        {data && !data.live ? (
          <p role="status" data-testid="classification-not-live" style={{ margin: 0, ...text(12.5, 400, t.text2) }}>
            {NOT_LIVE_LINE}
          </p>
        ) : null}

        <RefinedField id={CARD_FIELD_ID.title} label="Title">
          <input
            id={CARD_FIELD_ID.title}
            type="text"
            value={title}
            placeholder="Name your build"
            autoComplete="off"
            onChange={(event) => setTitle(event.target.value)}
            {...titleRing.handlers}
            style={{ ...wellField, height: phone ? 44 : 36, padding: "0 12px", ...text(fieldText, 500, t.text), ...titleRing.style }}
          />
        </RefinedField>

        <OptionalSection>
          <OptionalRow rowId="card-row-summary" label="Summary" value={summary} phone={phone} defaultOpen={open("summary")}>
            <RefinedField
              id={CARD_FIELD_ID.summary}
              label="Summary"
              right={
                <span style={{ ...text(11.5, 400, t.label), ...tnum }}>
                  {summary.length} / {DESCRIPTION_MAX}
                </span>
              }
            >
              <textarea
                id={CARD_FIELD_ID.summary}
                rows={3}
                value={summary}
                maxLength={DESCRIPTION_MAX}
                placeholder="e.g. Turns a folder of receipts into a spreadsheet of expenses."
                onChange={(event) => setSummary(event.target.value)}
                {...summaryRing.handlers}
                style={{ ...wellField, display: "block", height: 80, padding: "8px 12px", ...text(fieldText, 400, t.text), lineHeight: "21px", resize: "vertical", ...summaryRing.style }}
              />
            </RefinedField>
          </OptionalRow>

          {data ? (
            <>
              <OptionalRow rowId="card-row-field" label="Field" value={entriesLine("field", draft.field)} count={suggestionCount("field")} phone={phone}>
                <ClassificationPicker id="card-field" facet="field" label="Field" entries={draft.field} max={FIELD_MAX} suggestions={suggestions.field} phone={phone} placeholder="e.g. Retrieval or Dentistry" onChange={(next) => set("field", next)} />
              </OptionalRow>

              <OptionalRow rowId="card-row-task" label="Task" value={entriesLine("task", draft.task)} count={suggestionCount("task")} phone={phone}>
                <ClassificationPicker id="card-task" facet="task" label="Task" entries={draft.task} max={TASK_MAX} primary suggestions={suggestions.task} phone={phone} placeholder="e.g. Summarising or Marking" onChange={(next) => set("task", next)} />
              </OptionalRow>

              <OptionalRow rowId="card-row-setting" label="Setting" value={entriesLine("setting", draft.setting)} count={suggestionCount("setting")} phone={phone}>
                <ClassificationPicker id="card-setting" facet="setting" label="Setting" entries={draft.setting} max={SETTING_MAX} suggestions={suggestions.setting} phone={phone} placeholder="e.g. School teacher or Small business" onChange={(next) => set("setting", next)} />
              </OptionalRow>

              <OptionalRow
                rowId="card-row-stack"
                label="Tools and stack"
                value={stackLine}
                count={suggestions.stack.length > 0 ? suggestionCount("stack") : derivedStack.length > 0 ? "Read from your build" : undefined}
                phone={phone}
              >
                {derivedStack.length > 0 ? (
                  <ul aria-label="Tools and stack, read from your build" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {derivedStack.map((id) => (
                      <li key={id} style={{ display: "inline-flex", alignItems: "center", minHeight: phone ? 44 : 28, padding: "0 10px", boxSizing: "border-box", borderRadius: 6, background: t.tile, border: `1px solid ${t.tileBorder}`, ...text(12.5, 400, t.text) }}>
                        {labelFor("stack", id)}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <ClassificationPicker id="card-stack" facet="stack" label="Tools and stack" entries={draft.stack} suggestions={suggestions.stack} phone={phone} placeholder="e.g. Python or Supabase" onChange={(next) => set("stack", next)} />
                <MadeWithLine phone={phone} chips={props.madeWith} hasSessions={props.madeWith.some((chip) => chip.kind !== "entry")} onToggle={props.onToggleMadeWith} onAdd={props.onAddMadeWith} />
              </OptionalRow>

              <OptionalRow rowId="card-row-data" label="Data handled" value={entriesLine("data", draft.data)} count={suggestionCount("data")} phone={phone}>
                <ClassificationPicker id="card-data" facet="data" label="Data handled" entries={draft.data} suggestions={suggestions.data} phone={phone} placeholder="e.g. Health data" onChange={(next) => set("data", next)} />
              </OptionalRow>

              <OptionalRow rowId="card-row-age" label="Age suitability" value={draft.age ? labelFor("age", draft.age) : ""} phone={phone}>
                <Segmented
                  label="Age suitability"
                  items={AGE_VALUES.map((value) => ({ value: value.id, label: value.label }))}
                  value={draft.age ?? ""}
                  size={phone ? 50 : 32}
                  fontSize={phone ? 13 : 12}
                  fullWidth
                  onChange={(value) => set("age", value)}
                />
                {draft.age ? (
                  <button type="button" onClick={() => set("age", null)} style={{ alignSelf: "flex-start", border: 0, background: "none", cursor: "pointer", minHeight: phone ? 44 : 24, ...text(12, 400, t.text2), textDecoration: "underline" }}>
                    Clear age suitability
                  </button>
                ) : null}
              </OptionalRow>

              <OptionalRow rowId="card-row-read" label="Read from your build" value={builtLine} count={questions.length > 0 ? plural(questions.length, "question", "questions") : "Read from your build"} phone={phone}>
                {candidate ? (
                  <ReadFromBuild
                    classification={candidate}
                    questions={questions}
                    phone={phone}
                    onDispute={(facet, dispute: Dispute | null) =>
                      setDraft((current) => {
                        const disputes = { ...current.disputes };
                        if (dispute) disputes[facet] = dispute;
                        else delete disputes[facet];
                        return { ...current, disputes };
                      })
                    }
                    onDismiss={(id) => setDraft((current) => ({ ...current, dismissed: [...current.dismissed, id] }))}
                    onSource={(id) => {
                      data.onSelectSource?.(id);
                      props.onOpenChange(false);
                    }}
                    onAction={(action, question) => {
                      data.onAction?.(action, question);
                      props.onOpenChange(false);
                    }}
                  />
                ) : null}
              </OptionalRow>
            </>
          ) : null}

          <OptionalRow rowId="card-row-details" label="Build details" phone={phone}>
            <BuildDetails phone={phone} details={details} onChange={(key, value) => setDetails((current) => ({ ...current, [key]: value }))} onGap={(on) => setDetails((current) => ({ ...current, gapOn: on }))} />
          </OptionalRow>
        </OptionalSection>
      </div>

      <div style={{ flexShrink: 0, minHeight: 64, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 12, padding: phone ? "8px 16px" : "0 24px", borderTop: `1px solid ${t.hairlineModule}` }}>
        <span data-testid="card-required" style={{ ...text(12.5, 400, titleOk ? t.text2 : t.text), flexGrow: 1 }}>
          {titleOk ? "All required fields complete" : "Required: a title"}
        </span>
        <Button variant="ghost" size={phone ? 44 : 32} fontSize={13} onClick={() => props.onOpenChange(false)}>
          Cancel
        </Button>
        <Button size={phone ? 44 : 32} fontSize={13} disabled={!titleOk || saving} onClick={() => void onSave()}>
          Save
        </Button>
      </div>
    </>
  );
}

export function SandboxCard(props: SandboxCardProps) {
  const { open, onOpenChange, field, phone } = props;

  const content: CSSProperties = {
    position: "fixed",
    zIndex: 51,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    background: t.window,
    border: `1px solid ${t.windowBorder}`,
    boxShadow: t.sheetShadow,
    color: t.text,
    outline: "none",
    ...(phone ? { top: 0, right: 0, bottom: 0, width: "100%", borderRadius: 0 } : { top: 6, right: 6, bottom: 6, width: 472, maxWidth: "calc(100vw - 12px)", borderRadius: 12 }),
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, zIndex: 50, background: t.scrim }} />
        <Dialog.Content
          data-testid="sandbox-card"
          onOpenAutoFocus={(event) => {
            if (!field) return;
            const target = document.getElementById(CARD_FIELD_ID[field]);
            if (!target) return;
            event.preventDefault();
            target.focus();
          }}
          style={content}
        >
          <div style={{ minHeight: 56, flexShrink: 0, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 12, padding: "8px 16px 8px 24px", borderBottom: `1px solid ${t.hairlineModule}` }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 }}>
              <Dialog.Title style={{ ...text(15, 500, t.text), margin: 0 }}>{CLASSIFICATION_CARD}</Dialog.Title>
              <Dialog.Description style={{ ...text(12, 400, t.text2), margin: 0 }}>{CARD_SUBTITLE}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton icon={X} glyph="x" label="Close" size={30} />
            </Dialog.Close>
          </div>
          <CardBody {...props} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default SandboxCard;
