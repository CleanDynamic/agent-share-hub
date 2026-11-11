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

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { emptyClassification, shownValues } from "@/lib/classify/facets";
import { labelFor, stackValuesOf } from "@/lib/classify/lines";
import { suggestFor, type SuggestFacet } from "@/lib/classify/suggest";
import { AGE_VALUES, FIELD_MAX, SETTING_MAX, TASK_MAX, pathOf, type Facet } from "@/lib/classify/taxonomy";
import { isCustomEntry, type Dispute, type Entry } from "@/lib/classify/types";

import { CardPreview } from "./CardPreview";
import { ClassificationPicker, withPrimary } from "./ClassificationPicker";
import { applyDraft, draftOf, type ClassificationCardData, type ClassificationDraft } from "./classificationCardModel";
import { DESCRIPTION_MAX } from "./composeModel";
import { MadeWithLine } from "./MadeWithLine";
import { ModalShell } from "./ModalFrame";
import { OptionalRow, OptionalRows, type OptionalRowProps } from "./OptionalRows";
import { ChosenValue } from "./classificationPieces";
import { LIVE_NEEDS_TITLE, refusesLiveTitle } from "@/lib/build/publish";
import { Alert, BlockHead, Block, FOOT_NOTE, FieldRequiredLine, FieldArea, FieldInput, MODAL_PAD, ModalInset, RecipeButton, SegmentedField, footerStyle, useModalInset } from "./modalRecipes";
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
  | "titleError"
  | "titleLive"
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
  | "onTopicSourceSwitch"
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
/** SV-05 P7: the footer's status when the classification did not reach the database (CA-28's error form). */
export const NOT_SAVED_LINE = "Classification not saved";

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

/** The Card's switch (the app's one switch look): UX-07's Others can start topics from this build. */
function CardSwitch({ on, onChange, phone, label }: { on: boolean; onChange: (on: boolean) => void; phone: boolean; label: string }) {
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
      {label}
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

/** UX-07 P6: the maker's opt-out, a publish-time setting, never a checklist item. */
export const TOPIC_SOURCE_LABEL = "Others can start topics from this build";
export const TOPIC_SOURCE_NOTE = "Off removes the option for everyone else. Existing topics keep their link and credit.";

function BuildDetails({ phone, details, onChange, onTopicSource }: { phone: boolean; details: ComposeDetails; onChange: (key: ComposeDetailKey, value: string) => void; onTopicSource?: (on: boolean) => void }) {
  const money = (value: string) => (value.trim() ? `£${value}` : "");
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <OptionalRow phone={phone} filledText name="Known issue" description="What broke and how it was fixed" summary={details.symptom}>
        <RefinedField id="card-problem" label="Problem">
          <FieldArea id="card-problem" phone={phone} rows={2} value={details.symptom} placeholder="e.g. exiftool: command not found" onChange={(event) => onChange("symptom", event.target.value)} />
        </RefinedField>
        <RefinedField id="card-fix" label="Fix">
          <FieldArea id="card-fix" phone={phone} rows={2} value={details.resolution} placeholder="e.g. Install it first with brew install exiftool." onChange={(event) => onChange("resolution", event.target.value)} />
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
      {onTopicSource ? (
        <OptionalRow phone={phone} filledText name="Topics" description={TOPIC_SOURCE_LABEL} summary={details.allowAsTopicSource === false ? "Off" : ""}>
          <CardSwitch on={details.allowAsTopicSource !== false} onChange={onTopicSource} phone={phone} label={TOPIC_SOURCE_LABEL} />
          <p data-testid="topic-source-note" style={{ margin: 0, ...text(12, 400, t.label) }}>
            {TOPIC_SOURCE_NOTE}
          </p>
        </OptionalRow>
      ) : null}
    </div>
  );
}

const entriesLine = (facet: Facet, entries: readonly Entry[]): string =>
  entries
    .map((entry) => (isCustomEntry(entry) ? entry.custom : facet === "field" ? pathOf(entry.id, facet).split(" \u203A ").slice(-2).join(" \u203A ") : labelFor(facet, entry.id)))
    .join(", ");

/** F10: what the card and its shell share about leaving: whether anything changed, and whether the keep-or-discard choice is showing. */
interface CloseGuard {
  dirty: { current: boolean };
  asking: boolean;
  keep: () => void;
}

export const CLOSE_COPY = {
  question: "Keep your changes?",
  keep: "Keep editing",
  discard: "Discard changes",
} as const;

function CardBody(props: SandboxCardProps & { guard: CloseGuard }) {
  const { phone, classification: data, guard } = props;
  const [title, setTitle] = useState(props.title);
  const [summary, setSummary] = useState(props.description);
  const [details, setDetails] = useState<ComposeDetails>(props.details);
  const [draft, setDraft] = useState<ClassificationDraft>(() => draftOf(data?.stored ?? emptyClassification()));
  /** SV-05 P7: the draft as the window opened, to tell whether the maker changed the classification itself. */
  const [opened] = useState(() => JSON.stringify(draft));
  const [saving, setSaving] = useState(false);
  const [notSaved, setNotSaved] = useState(false);
  /** F26: the line under Title is drawn only once a save was tried with no title. */
  const [attempted, setAttempted] = useState(false);
  /** F28 (D4): the one Optional row open, by its name; the section holds it, not the rows. */
  const [openRow, setOpenRow] = useState<string | null>(null);
  /** F22: what a row held before Accept, by the row's name, until that row opens or the window closes. */
  const [undo, setUndo] = useState<Partial<Record<string, Entry[]>>>({});
  const openOne = (name: string | null) => {
    setOpenRow(name);
    if (name) setUndo((current) => ({ ...current, [name]: undefined }));
  };
  const pad = useModalInset();
  /* F10: any field that differs from its value when the window opened. */
  const changed = title !== props.title || summary !== props.description || JSON.stringify(draft) !== opened || JSON.stringify(details) !== JSON.stringify(props.details);
  useEffect(() => {
    guard.dirty.current = changed;
    return () => {
      guard.dirty.current = false;
    };
  }, [changed, guard.dirty]);

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

  /* UX-01 P2: on a live build the title cannot be emptied or set back to "Untitled build"; Save waits, and the field says why. */
  const liveRefused = Boolean(props.titleLive) && refusesLiveTitle("published", title);
  const titleOk = title.trim() !== "" && !liveRefused;

  const onSave = async () => {
    if (!titleOk) setAttempted(true);
    if (!titleOk || saving) return;
    setSaving(true);
    try {
      if (title !== props.title) props.onTitle(title);
      if (summary !== props.description) props.onDescription(summary);
      for (const key of ["symptom", "resolution", "costMonthly", "costSetup", "firstResult"] as const) {
        if (details[key] !== props.details[key]) props.onDetail(key, details[key]);
      }
      if ((details.allowAsTopicSource ?? true) !== (props.details.allowAsTopicSource ?? true)) props.onTopicSourceSwitch?.(details.allowAsTopicSource ?? true);
      // SV-05 P7: a classification the maker changed that could not be written (its columns missing) keeps the window open
      // and says so. The title, the summary and the details are saved either way.
      const saved = data ? await data.onSave(draft) : null;
      if (saved && saved.missing && JSON.stringify(draft) !== opened) {
        setNotSaved(true);
        return;
      }
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

  /* F24: nothing where there is nothing to count. */
  const suggestionCount = (facet: SuggestFacet) => (suggestions[facet].length > 0 ? plural(suggestions[facet].length, "suggestion", "suggestions") : undefined);

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

  /* F28: opening a row closes the one that was open; a row with `forceOpen` stays open on its own. */
  const row = (name: string, description: string, summaryText: string, count: string | undefined, body: ReactNode, extra: { forceOpen?: boolean; accept?: OptionalRowProps["accept"]; undo?: OptionalRowProps["undo"] } = {}) => (
    <OptionalRow key={name} name={name} description={description} summary={summaryText} count={count} phone={phone} filledText forceOpen={extra.forceOpen} accept={extra.accept} undo={extra.undo} open={openRow === name} onOpenChange={(next) => openOne(next ? name : null)}>
      {body}
    </OptionalRow>
  );

  /* UX-03 P5: a closed row offers its first suggestion; Accept adds it exactly as choosing it in the open row's picker does.
     F22: Accept remembers what the row held, and Undo puts it back. */
  const offer = (facet: SuggestFacet, label: string): OptionalRowProps["accept"] => {
    const first = suggestions[facet][0];
    if (!first) return undefined;
    const before = draft[facet];
    const next = [...before, { id: first.id }];
    return {
      text: first.label,
      name: `Accept ${first.label} as ${label}`,
      onAccept: () => {
        setUndo((current) => ({ ...current, [label]: before }));
        set(facet, facet === "task" ? withPrimary(next) : next);
      },
    };
  };
  const undoOf = (facet: SuggestFacet, label: string): OptionalRowProps["undo"] => {
    const before = undo[label];
    if (!before) return undefined;
    return {
      name: `Undo ${label}`,
      onUndo: () => {
        set(facet, before);
        setUndo((current) => ({ ...current, [label]: undefined }));
      },
    };
  };

  return (
    <>
      <div data-testid="card-body" style={{ flex: "1 1 auto", minHeight: 0, overflowY: phone ? "visible" : "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: `0 ${pad}px 16px` }}>
          <CardPreview title={title} classification={candidate} maker={data?.maker} />
        </div>

        <Block testId="card-title-block">
          <RefinedField id={CARD_FIELD_ID.title} label="Title" right="Required">
            <FieldInput
              id={CARD_FIELD_ID.title}
              phone={phone}
              type="text"
              value={title}
              placeholder="e.g. Fox poster"
              autoComplete="off"
              onChange={(event) => setTitle(event.target.value)}
              // F26: Enter in the title is a save attempt; with no title it draws the line under the field.
              onKeyDown={(event) => {
                if (event.key === "Enter") void onSave();
              }}
            />
            {liveRefused ? <Alert>{LIVE_NEEDS_TITLE}</Alert> : attempted && !titleOk ? <FieldRequiredLine /> : null}
          </RefinedField>
        </Block>

        <div style={{ padding: `0 ${pad}px`, borderTop: `1px solid ${t.hairlineModule}` }}>
          <OptionalRows hint="Suggestions from the build" bleed={pad}>
            {row(
              "Summary",
              "One sentence",
              summary,
              undefined,
              <RefinedField id={CARD_FIELD_ID.summary} label="Summary" right={`${summary.length} / ${DESCRIPTION_MAX}`}>
                <FieldArea
                  id={CARD_FIELD_ID.summary}
                  phone={phone}
                  rows={2}
                  value={summary}
                  maxLength={DESCRIPTION_MAX}
                  placeholder="e.g. Answers customer questions from the help centre using keyword and vector search together"
                  onChange={(event) => setSummary(event.target.value)}
                />
              </RefinedField>,
              { forceOpen: open("summary") },
            )}
            {data
              ? [
                  row("Field", "Not set", entriesLine("field", draft.field), suggestionCount("field"), <ClassificationPicker id="card-field" facet="field" label="Field" entries={draft.field} max={FIELD_MAX} suggestions={suggestions.field} phone={phone} placeholder="Search fields" onChange={(next) => set("field", next)} />, { accept: offer("field", "Field"), undo: undoOf("field", "Field") }),
                  row("Task", "Not set", entriesLine("task", draft.task), suggestionCount("task"), <ClassificationPicker id="card-task" facet="task" label="Task" entries={draft.task} max={TASK_MAX} primary suggestions={suggestions.task} phone={phone} placeholder="Search tasks" onChange={(next) => set("task", next)} />, { accept: offer("task", "Task"), undo: undoOf("task", "Task") }),
                  row("Setting", "Not set", entriesLine("setting", draft.setting), suggestionCount("setting"), <ClassificationPicker id="card-setting" facet="setting" label="Setting" entries={draft.setting} max={SETTING_MAX} suggestions={suggestions.setting} phone={phone} placeholder="Search settings" onChange={(next) => set("setting", next)} />, { accept: offer("setting", "Setting"), undo: undoOf("setting", "Setting") }),
                  row(
                    "Tools and stack",
                    "Not set",
                    stackLine,
                    suggestionCount("stack"),
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
                    { accept: offer("stack", "Tools and stack"), undo: undoOf("stack", "Tools and stack") },
                  ),
                  row("Data handled", "Not set", entriesLine("data", draft.data), undefined, <ClassificationPicker id="card-data" facet="data" label="Data handled" entries={draft.data} suggestions={suggestions.data} phone={phone} placeholder="Search data types" onChange={(next) => set("data", next)} />, { accept: offer("data", "Data handled"), undo: undoOf("data", "Data handled") }),
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
                    questions.length > 0 ? plural(questions.length, "question", "questions") : undefined,
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
                        onOpenStack={() => openOne("Tools and stack")}
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
              "Known issue, Build cost, Running cost per month, Time to first result",
              "",
              undefined,
              <BuildDetails phone={phone} details={details} onChange={(key, value) => setDetails((current) => ({ ...current, [key]: value }))} onTopicSource={props.onTopicSourceSwitch ? (on) => setDetails((current) => ({ ...current, allowAsTopicSource: on })) : undefined} />,
            )}
          </OptionalRows>
        </div>
      </div>

      {guard.asking ? (
        <div data-testid="card-close-choice" role="alertdialog" aria-label={CLOSE_COPY.question} style={{ ...footerStyle(phone), borderTop: `1px solid ${t.hairlineModule}` }}>
          <span role="status" style={FOOT_NOTE}>
            {CLOSE_COPY.question}
          </span>
          <RecipeButton phone={phone} onClick={guard.keep}>
            {CLOSE_COPY.keep}
          </RecipeButton>
          <RecipeButton variant="primary" phone={phone} onClick={() => props.onOpenChange(false)}>
            {CLOSE_COPY.discard}
          </RecipeButton>
        </div>
      ) : null}
      <div data-testid="card-footer" style={footerStyle(phone)}>
        <span data-testid="card-required" role="status" style={FOOT_NOTE}>
          {notSaved ? NOT_SAVED_LINE : titleOk ? "Required fields complete" : "Required: a title"}
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
  const dirty = useRef(false);
  const [asking, setAsking] = useState(false);
  /* F10: a click outside, Escape or the close square asks first when something changed; Cancel, Discard and a finished Save close at once. */
  const request = (next: boolean) => {
    if (!next && dirty.current) {
      setAsking(true);
      return;
    }
    setAsking(false);
    props.onOpenChange(next);
  };
  useEffect(() => {
    if (!props.open) setAsking(false);
  }, [props.open]);
  const guard: CloseGuard = { dirty, asking, keep: () => setAsking(false) };
  return (
    <ModalShell open={props.open} onOpenChange={request} title={CLASSIFICATION_CARD} subtitle={CARD_SUBTITLE} width={560} testId="sandbox-card">
      {/* SV-05 P7: the same 20 inset as every other window's body, as ModalForm gives it (none on a phone). */}
      <ModalInset.Provider value={props.phone ? 0 : MODAL_PAD}>
        <CardBody {...props} guard={guard} />
      </ModalInset.Provider>
    </ModalShell>
  );
}

export default SandboxCard;
