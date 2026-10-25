/* CA-16 P5: the Classification Card.

   WHAT IT IS. The sheet where a build is described and filed in the Gallery. It was "Card" (UI-P94: Cover, Title, one-line
   summary, Who it's for, Made with, More details). The internal names stay (`SandboxCard`, `data-testid="sandbox-card"`,
   `CARD_FIELD_ID`), so a link or a test that finds it still does; what the maker reads is "Classification Card".

   THE SHEET AND ITS MANNERS ARE AS THEY WERE: the Radix Dialog (focus trapped, Esc closes, the page behind inert), the
   window recipe with `--sheet-shadow`, 472 wide and inset 6 from the top, right and bottom, radius 12, over `--scrim`; a
   phone keeps the full-height sheet and 44-high targets.

   TOP TO BOTTOM. The header (the title, "How this build is described and filed in the Gallery", the square close). The
   preview: the gallery card as the Gallery draws it, with no cover. The Title, the only required field. Then the Optional
   section, every row closed: Summary, Field, Task, Setting, Tools and stack, Data handled, Age suitability, Read from your
   build, Build details. The footer says "Required: a title" or "Required fields complete", then Cancel and Save.

   A DRAFT, SAVED ONCE. The Card edits a draft of everything on it (the title, the summary, the classification, the build
   details) and writes it with Save; Cancel drops it. Save writes the title, the summary and the details through the
   page's own handlers, and the classification through `classification.onSave`, which also sets `shape` from What was
   built. Until the CA-16 migration is applied, the classification cannot be stored: the Card says so in one line and
   saves everything else.

   THE COVER AND "WHO IT'S FOR" ARE NOT ON THE CARD. The cover is the first picture in the post (PT-05) and is edited
   there; Setting replaces "Who it's for", and `made_for` is no longer written. Made with stays, inside Tools and stack:
   it is how a maker takes a model out of the list the sessions gave. */

import { useEffect, useMemo, useState, type ReactNode } from "react";

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
import { DESCRIPTION_MAX } from "./composeModel";
import { MadeWithLine } from "./MadeWithLine";
import { ModalShell } from "./ModalFrame";
import { OptionalRow, OptionalRows } from "./OptionalRows";
import { ChosenValue } from "./classificationPieces";
import { BlockHead, Block, FOOT_NOTE, FieldArea, FieldInput, RecipeButton, SegmentedField, footerStyle, useModalInset } from "./modalRecipes";
import { ReadFromBuild } from "./ReadFromBuild";
import { text } from "./refinedStyles";
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

export const CLASSIFICATION_CARD = "Classification";
export const CARD_SUBTITLE = "How this build is described and filed in the Gallery";
export const NOT_LIVE_LINE = "Not available yet";

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** A field: the recipe's block head (the label, and what sits on its right) over the control, 8 apart. */
function RefinedField({ id, label, right, children }: { id: string; label: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <BlockHead label={label} htmlFor={id} count={right} />
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
  return (
    <RefinedField id={id} label={label}>
      <FieldInput id={id} phone={phone} type="number" inputMode={whole ? "numeric" : "decimal"} min={0} step={whole ? 1 : "any"} value={value} onChange={(event) => onChange(event.target.value)} />
    </RefinedField>
  );
}

function BuildDetails({ phone, details, onChange, onGap }: { phone: boolean; details: ComposeDetails; onChange: (key: ComposeDetailKey, value: string) => void; onGap: (on: boolean) => void }) {
  const money = (value: string) => (value.trim() ? `£${value}` : "");
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <OptionalRow phone={phone} filledText name="Known issue" description="What broke and how it was fixed" summary={details.symptom}>
        <RefinedField id="card-problem" label="Problem">
          <FieldArea id="card-problem" phone={phone} rows={2} value={details.symptom} placeholder="exiftool: command not found" onChange={(event) => onChange("symptom", event.target.value)} />
        </RefinedField>
        <RefinedField id="card-fix" label="Fix">
          <FieldArea id="card-fix" phone={phone} rows={2} value={details.resolution} placeholder="Install it first with brew install exiftool." onChange={(event) => onChange("resolution", event.target.value)} />
        </RefinedField>
      </OptionalRow>
      <OptionalRow phone={phone} filledText name="Build cost (£)" description="What it cost to make" summary={money(details.costSetup)}>
        <NumberInput id="card-build-cost-input" label="Build cost (£)" value={details.costSetup} phone={phone} onChange={(value) => onChange("costSetup", value)} />
      </OptionalRow>
      <OptionalRow phone={phone} filledText name="Running cost per month (£)" description="What it costs to keep running" summary={money(details.costMonthly)}>
        <NumberInput id="card-running-cost-input" label="Running cost per month (£)" value={details.costMonthly} phone={phone} onChange={(value) => onChange("costMonthly", value)} />
      </OptionalRow>
      <OptionalRow phone={phone} filledText name="Time to first result (minutes)" description="How soon someone sees it work" summary={details.firstResult.trim() ? `${details.firstResult} min` : ""}>
        <NumberInput id="card-first-result-input" label="Time to first result (minutes)" value={details.firstResult} whole phone={phone} onChange={(value) => onChange("firstResult", value)} />
      </OptionalRow>
      <OptionalRow phone={phone} filledText name="Open a bounty" description="Leave one part open for someone else to solve" summary={details.gapOn ? (details.gapProblem.trim() ? details.gapProblem : "On") : ""}>
        <BountySwitch on={details.gapOn} onChange={onGap} phone={phone} />
        {details.gapOn ? (
          <>
            <RefinedField id="card-left-open" label="What is left open">
              <FieldInput id="card-left-open" phone={phone} type="text" autoComplete="off" value={details.gapProblem} onChange={(event) => onChange("gapProblem", event.target.value)} />
            </RefinedField>
            <p style={{ margin: 0, ...text(12, 400, t.text2) }}>Readers will see it as one part left open. You can add a reward on Bounties after publishing.</p>
          </>
        ) : null}
      </OptionalRow>
    </div>
  );
}

const entriesLine = (facet: Facet, entries: readonly Entry[]): string =>
  entries
    .map((entry) => (isCustomEntry(entry) ? entry.custom : facet === "field" ? pathOf(entry.id, facet).split(" \u203A ").slice(-2).join(" \u203A ") : labelFor(facet, entry.id)))
    .join(", ");

function CardBody(props: SandboxCardProps) {
  const { phone, classification: data } = props;
  const [title, setTitle] = useState(props.title);
  const [summary, setSummary] = useState(props.description);
  const [details, setDetails] = useState<ComposeDetails>(props.details);
  const [draft, setDraft] = useState<ClassificationDraft>(() => draftOf(data?.stored ?? emptyClassification()));
  const [saving, setSaving] = useState(false);
  const pad = useModalInset();

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
  const readLine = candidate
    ? (["built", "role", "technique", "skill"] as const)
        .flatMap((facet) => {
          const first = shownValues(candidate, facet).values[0];
          return first ? [labelFor(facet, first)] : [];
        })
        .join(" \u00B7 ")
    : "";
  const open = (field: CardField) => props.field === field;

  const suggestionCount = (facet: SuggestFacet) => plural(suggestions[facet].length, "suggestion", "suggestions");

  /* Landing on a field a missing item names: the row opens itself, then the field takes focus. */
  useEffect(() => {
    if (!props.field) return;
    let tries = 0;
    const land = () => {
      const target = document.getElementById(CARD_FIELD_ID[props.field as CardField]);
      if (target) target.focus();
      else if (tries < 10) {
        tries += 1;
        window.setTimeout(land, 30);
      }
    };
    land();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const row = (name: string, description: string, summaryText: string, count: string | undefined, body: ReactNode, extra: { forceOpen?: boolean } = {}) => (
    <OptionalRow key={name} name={name} description={description} summary={summaryText} count={count} phone={phone} filledText forceOpen={extra.forceOpen}>
      {body}
    </OptionalRow>
  );

  return (
    <>
      <div data-testid="card-body" style={{ flex: "1 1 auto", minHeight: 0, overflowY: phone ? "visible" : "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: `0 ${pad}px 16px` }}>
          <CardPreview title={title} classification={candidate} maker={data?.maker} />
          {data && !data.live ? (
            <p role="status" data-testid="classification-not-live" style={{ margin: "12px 0 0", ...text(12.5, 400, t.text2) }}>
              {NOT_LIVE_LINE}
            </p>
          ) : null}
        </div>

        <Block testId="card-title-block">
          <RefinedField id={CARD_FIELD_ID.title} label="Title" right="Required">
            <FieldInput id={CARD_FIELD_ID.title} phone={phone} type="text" value={title} autoComplete="off" onChange={(event) => setTitle(event.target.value)} />
          </RefinedField>
        </Block>

        <div style={{ padding: `0 ${pad}px`, borderTop: `1px solid ${t.hairlineModule}` }}>
          <OptionalRows hint="Suggestions from the build" bleed={pad}>
            {row(
              "Summary",
              "One sentence on what the build does",
              summary,
              undefined,
              <RefinedField id={CARD_FIELD_ID.summary} label="Summary" right={`${summary.length} / ${DESCRIPTION_MAX}`}>
                <FieldArea
                  id={CARD_FIELD_ID.summary}
                  phone={phone}
                  rows={2}
                  value={summary}
                  maxLength={DESCRIPTION_MAX}
                  placeholder="Answers customer questions from the help centre using keyword and vector search together"
                  onChange={(event) => setSummary(event.target.value)}
                />
              </RefinedField>,
              { forceOpen: open("summary") },
            )}
            {data
              ? [
                  row("Field", "Not set", entriesLine("field", draft.field), suggestionCount("field"), <ClassificationPicker id="card-field" facet="field" label="Field" entries={draft.field} max={FIELD_MAX} suggestions={suggestions.field} phone={phone} placeholder="Search fields" onChange={(next) => set("field", next)} />),
                  row("Task", "Not set", entriesLine("task", draft.task), suggestionCount("task"), <ClassificationPicker id="card-task" facet="task" label="Task" entries={draft.task} max={TASK_MAX} primary suggestions={suggestions.task} phone={phone} placeholder="Search tasks" onChange={(next) => set("task", next)} />),
                  row("Setting", "Not set", entriesLine("setting", draft.setting), suggestionCount("setting"), <ClassificationPicker id="card-setting" facet="setting" label="Setting" entries={draft.setting} max={SETTING_MAX} suggestions={suggestions.setting} phone={phone} placeholder="Search settings" onChange={(next) => set("setting", next)} />),
                  row(
                    "Tools and stack",
                    "Not set",
                    stackLine,
                    suggestions.stack.length === 0 && derivedStack.length > 0 ? "From the build" : suggestionCount("stack"),
                    <>
                      {derivedStack.length > 0 ? (
                        <ul aria-label="Tools and stack, from the build" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {derivedStack.map((id) => (
                            <ChosenValue key={id} label={labelFor("stack", id)} phone={phone} removeLabel={`From the build: ${labelFor("stack", id)}`} onRemove={() => undefined} readOnly />
                          ))}
                        </ul>
                      ) : null}
                      <ClassificationPicker id="card-stack" facet="stack" label="Tools and stack" entries={draft.stack} suggestions={suggestions.stack} phone={phone} placeholder="Add a tool, language or framework" onChange={(next) => set("stack", next)} />
                      <MadeWithLine phone={phone} chips={props.madeWith} hasSessions={props.madeWith.some((chip) => chip.kind !== "entry")} onToggle={props.onToggleMadeWith} onAdd={props.onAddMadeWith} />
                    </>,
                  ),
                  row("Data handled", "Not set", entriesLine("data", draft.data), undefined, <ClassificationPicker id="card-data" facet="data" label="Data handled" entries={draft.data} suggestions={suggestions.data} phone={phone} placeholder="Search data types" onChange={(next) => set("data", next)} />),
                  row(
                    "Age suitability",
                    "Not set",
                    draft.age ? labelFor("age", draft.age) : "",
                    undefined,
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <SegmentedField label="Age suitability" items={AGE_VALUES.map((value) => ({ value: value.id, label: value.label }))} value={draft.age} phone={phone} onChange={(value) => set("age", value)} />
                      {draft.age ? (
                        <button type="button" onClick={() => set("age", null)} style={{ border: 0, background: "none", cursor: "pointer", minHeight: phone ? 44 : 24, ...text(12, 400, t.text2), textDecoration: "underline" }}>
                          Clear age suitability
                        </button>
                      ) : null}
                    </div>,
                  ),
                  row(
                    "From the build",
                    "Not set",
                    readLine,
                    questions.length > 0 ? plural(questions.length, "question", "questions") : "From the build",
                    candidate ? (
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
                    ) : null,
                  ),
                ]
              : null}
            {row(
              "Build details",
              "Known issue, Build cost, Running cost per month, Time to first result, Open a bounty",
              "",
              undefined,
              <BuildDetails phone={phone} details={details} onChange={(key, value) => setDetails((current) => ({ ...current, [key]: value }))} onGap={(on) => setDetails((current) => ({ ...current, gapOn: on }))} />,
            )}
          </OptionalRows>
        </div>
      </div>

      <div data-testid="card-footer" style={footerStyle(phone)}>
        <span data-testid="card-required" style={FOOT_NOTE}>
          {titleOk ? "Required fields complete" : "Required: a title"}
        </span>
        <RecipeButton phone={phone} onClick={() => props.onOpenChange(false)}>
          Cancel
        </RecipeButton>
        <RecipeButton variant="primary" phone={phone} disabled={!titleOk || saving} onClick={() => void onSave()}>
          Save
        </RecipeButton>
      </div>
    </>
  );
}

export function SandboxCard(props: SandboxCardProps) {
  return (
    <ModalShell open={props.open} onOpenChange={props.onOpenChange} title={CLASSIFICATION_CARD} subtitle={CARD_SUBTITLE} width={560} testId="sandbox-card">
      <CardBody {...props} />
    </ModalShell>
  );
}

export default SandboxCard;
