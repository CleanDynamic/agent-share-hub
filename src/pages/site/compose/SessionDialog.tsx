/* CA-18 P2: a session's own window, on the same frame as the tile windows.

   A session is not a tile, but it is changed the same way: opened by Edit in its Details, by a double click on its head, and by
   "Edit session…" in its menu. Its sections, in this order: App and model, Date, Worked until, Cost and tokens (with Background),
   Started with and Own copy, At the same time as, Setup, and Prompts shared. Every save goes through the handler Details used
   for it (`onSessionTool`, `onSessionMeta`, `onSessionGoal`, `onSessionExtras`, `onSessionTogether`, `onNotShared`,
   `onToggleSessionPrompt`), held back until Save (`WriteBuffer`); Cancel and Escape write nothing. Its title and colour stay where
   CA-14 and CA-06 put them. "Add to setup" opens the file picker at once, as it always did: it adds files, it is not a draft.

   Built from `modalRecipes` (lookRules holds this file to it); the fields that are not the recipes' own (the cost fields, the
   command it started with, the menu of sessions it ran beside) are the ones Details had, drawn as they always were. */

import { LoadingRegion } from "@/components/brand/Skeleton";
import { LoadingBlocks } from "./LoadingBlocks";
import { SESSION_PROMPT_ROWS } from "./loadingBlocks";
import { useMemo, useState } from "react";

import { Checkbox } from "@/components/brand/Checkbox";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { GOAL_CONDITION_MAX, GOAL_TURNS_MAX, GOAL_TURNS_MIN, type SessionGoal } from "@/lib/build/making";
import { isIsoDay } from "@/lib/build/graph";
import type { SessionExtras } from "@/lib/build/sessionFacts";
import { modelLabel } from "@/lib/models/registry";

import type { DetailsHandlers, SessionView } from "./DetailsPanel";
import { WriteBuffer } from "./editBuffer";
import { bufferedHandlers } from "./editHandlers";
import { useBuildHistoryContext } from "./useBuildHistory";
import { MODAL_COPY, ModalForm, ModalShell } from "./ModalFrame";
import { BODY_TEXT, Block, BlockHead, FieldArea, FieldInput, Hint, Inline, LabelText, MODAL_WIDTH, NARROW, PANEL_LIST, RecipeButton, Row, SegmentedField, TextLink } from "./modalRecipes";
import { SessionFactsFields, StartedWithField, TogetherFields } from "./SessionExtrasFields";
import { ToolPicker } from "./ToolPicker";

export const SESSION_DIALOG_COPY = {
  title: (n: number, tool: string) => `Session ${n}${tool ? ` · ${tool}` : ""}`,
  subtitle: "App, date, cost and setup",
  appAndModel: "App and model",
  app: "App",
  noApp: "No app chosen",
  model: "Model",
  notNamed: "Not named",
  date: "Date",
  dateHint: "2026-10-12",
  badDate: "Format: 2026-10-12",
  notDated: "Not dated",
  goal: "Worked until",
  condition: "The condition",
  conditionHint: "the tests pass and the page loads",
  atMost: "At most",
  turns: "turns",
  reached: "Outcome",
  tookTurns: "Reached in",
  removeGoal: "Remove goal",
  badTurns: `Turns: whole number, ${GOAL_TURNS_MIN} to ${GOAL_TURNS_MAX}`,
  costAndTokens: "Cost and tokens",
  together: "At the same time as",
  setup: "Setup",
  addToSetup: "Add to setup",
  notShared: "Not shared",
  keepToMyself: "Keep private",
  prompts: "Prompts shared",
  promptsIn: (inBuild: number, total: number | null) => (total === null ? `${inBuild}` : `${inBuild} of ${total}`),
} as const;

const REACHED = [
  { value: "reached", label: "Reached" },
  { value: "limit", label: "Stopped at the limit" },
  { value: "me", label: "Stopped by the maker" },
] as const;

/** A whole number of turns, 1 to 500, undefined for blank, null for anything else. */
const turnsOf = (value: string): number | undefined | null => {
  const said = value.trim();
  if (!said) return undefined;
  const n = Number(said);
  return Number.isInteger(n) && n >= GOAL_TURNS_MIN && n <= GOAL_TURNS_MAX ? n : null;
};

export interface SessionDialogProps {
  view: SessionView | null;
  handlers: DetailsHandlers;
  inBuild?: readonly string[];
  onClose: () => void;
}

function Form({ view, handlers, inBuild, onClose }: Omit<SessionDialogProps, "view"> & { view: SessionView }) {
  const phone = useIsPhone();
  const [buffer] = useState(() => new WriteBuffer());
  const h = useMemo(() => bufferedHandlers(handlers, buffer), [handlers, buffer]);
  const key = view.key;

  const [extras, setExtras] = useState<SessionExtras>(view.extras ?? {});
  const [goal, setGoal] = useState<SessionGoal | null>(view.goal ?? null);
  const [date, setDate] = useState(view.editable?.date ?? view.date);
  const [wrongDate, setWrongDate] = useState(false);
  const [wrongTurns, setWrongTurns] = useState(false);
  const [notShared, setNotShared] = useState<ReadonlySet<string>>(new Set((view.setup ?? []).filter((row) => row.notShared).map((row) => row.id)));
  const [shared, setShared] = useState<Record<number, boolean>>(Object.fromEntries(view.checklist.map((row) => [row.ordinal, row.stepId !== null])));
  const editableMeta = Boolean(view.editable && h.onSessionMeta);

  const saveExtras = (next: SessionExtras) => {
    setExtras(next);
    h.onSessionExtras?.(key, next);
  };
  const saveGoal = (change: Partial<SessionGoal>) => {
    const next = { condition: goal?.condition ?? "", ...goal, ...change };
    setGoal(next);
    if (next.condition.trim()) h.onSessionGoal?.(key, next);
  };
  const turns = (field: "atMost" | "turns") => (value: string) => {
    const n = turnsOf(value);
    setWrongTurns(n === null);
    if (n !== null) saveGoal({ [field]: n });
  };

  const close = (open: boolean) => {
    if (open) return;
    buffer.clear();
    onClose();
  };
  const history = useBuildHistoryContext();
  const submit = () => {
    // CA-20 P5: Save is one step of the build's history, however many writes it makes.
    if (history && buffer.size > 0) {
      const writes = buffer.drain();
      void history.track(`Saved Session ${view.number}`, async () => {
        for (const run of writes) run();
      });
    } else buffer.flush();
    onClose();
  };

  return (
    <ModalShell open onOpenChange={close} title={SESSION_DIALOG_COPY.title(view.number, view.tool)} eyebrow={MODAL_COPY.edit} subtitle={SESSION_DIALOG_COPY.subtitle} width={MODAL_WIDTH.standard} testId="edit-session-dialog">
      <ModalForm phone={phone} missing={null} onCancel={() => close(false)} addLabel={MODAL_COPY.save} onSubmit={submit}>
        <Block label={SESSION_DIALOG_COPY.appAndModel} noRule>
          <BlockHead label={SESSION_DIALOG_COPY.appAndModel} />
        </Block>
        <Row id={`${key}-app`} label={SESSION_DIALOG_COPY.app} group phone={phone} noRule>
          {view.editable && h.onSessionMeta ? (
            <ToolPicker label={SESSION_DIALOG_COPY.app} value={view.editable.tool} inBuild={inBuild ?? []} allowNone noneLabel={SESSION_DIALOG_COPY.noApp} phone={phone} step="session" field onChange={(tool) => h.onSessionMeta?.(key, { tool })} />
          ) : view.pickTool && h.onSessionTool ? (
            <ToolPicker label={SESSION_DIALOG_COPY.app} value={view.pickTool.value} inBuild={inBuild ?? []} allowNone phone={phone} step="session" field onChange={(tool) => h.onSessionTool?.(key, tool)} />
          ) : (
            <span style={BODY_TEXT}>{view.tool}</span>
          )}
        </Row>
        <Row id={`${key}-model`} label={SESSION_DIALOG_COPY.model} phone={phone}>
          <span style={BODY_TEXT}>{view.model ? modelLabel(view.model) : SESSION_DIALOG_COPY.notNamed}</span>
        </Row>

        <Row id={`${key}-date`} label={SESSION_DIALOG_COPY.date} phone={phone}>
          {editableMeta ? (
            <>
              <FieldInput
                phone={phone}
                mono
                width={NARROW.date}
                id={`${key}-date`}
                value={date}
                maxLength={10}
                placeholder={SESSION_DIALOG_COPY.dateHint}
                onChange={(event) => setDate(event.target.value)}
                onBlur={() => {
                  const day = date.trim();
                  const ok = isIsoDay(day);
                  setWrongDate(day !== "" && !ok);
                  if (ok && day !== (view.editable?.date ?? "")) h.onSessionMeta?.(key, { date: day });
                }}
              />
              {wrongDate ? <Hint>{SESSION_DIALOG_COPY.badDate}</Hint> : null}
            </>
          ) : (
            <span style={BODY_TEXT}>{view.date || SESSION_DIALOG_COPY.notDated}</span>
          )}
        </Row>

        {h.onSessionGoal ? (
          <Block label={SESSION_DIALOG_COPY.goal} testId="session-goal">
            <BlockHead label={SESSION_DIALOG_COPY.goal} htmlFor={`${key}-goal`} count={`${(goal?.condition ?? "").length} / ${GOAL_CONDITION_MAX}`}>
              {goal ? (
                <TextLink
                  phone={phone}
                  onClick={() => {
                    setGoal(null);
                    h.onSessionGoal?.(key, null);
                  }}
                >
                  {SESSION_DIALOG_COPY.removeGoal}
                </TextLink>
              ) : null}
            </BlockHead>
            <FieldArea phone={phone} id={`${key}-goal`} rows={2} maxLength={GOAL_CONDITION_MAX} aria-label={SESSION_DIALOG_COPY.condition} value={goal?.condition ?? ""} placeholder={SESSION_DIALOG_COPY.conditionHint} onChange={(event) => setGoal((now) => ({ ...now, condition: event.target.value }))} onBlur={(event) => event.target.value.trim() !== (view.goal?.condition ?? "") && saveGoal({ condition: event.target.value.trim() })} />
            <Inline>
              <LabelText>{SESSION_DIALOG_COPY.atMost}</LabelText>
              <FieldInput phone={phone} mono width={NARROW.count} aria-label={SESSION_DIALOG_COPY.atMost} maxLength={3} defaultValue={goal?.atMost ? String(goal.atMost) : ""} onBlur={(event) => turns("atMost")(event.target.value)} />
              <LabelText>{SESSION_DIALOG_COPY.turns}</LabelText>
            </Inline>
            {goal ? (
              <>
                <SegmentedField<"reached" | "limit" | "me"> label={SESSION_DIALOG_COPY.reached} phone={phone} value={goal.reached ?? null} items={REACHED.map((row) => ({ ...row }))} onChange={(reached) => saveGoal({ reached, ...(reached === "reached" ? null : { turns: undefined }) })} />
                {goal.reached === "reached" ? (
                  <Inline>
                    <LabelText>{SESSION_DIALOG_COPY.tookTurns}</LabelText>
                    <FieldInput phone={phone} mono width={NARROW.count} aria-label={SESSION_DIALOG_COPY.tookTurns} maxLength={3} defaultValue={goal.turns ? String(goal.turns) : ""} onBlur={(event) => turns("turns")(event.target.value)} />
                    <LabelText>{SESSION_DIALOG_COPY.turns}</LabelText>
                  </Inline>
                ) : null}
              </>
            ) : null}
            {wrongTurns ? <Hint>{SESSION_DIALOG_COPY.badTurns}</Hint> : null}
          </Block>
        ) : null}

        {h.onSessionExtras ? (
          <>
            <Block label={SESSION_DIALOG_COPY.costAndTokens} testId="session-extras">
              <BlockHead label={SESSION_DIALOG_COPY.costAndTokens} />
              <SessionFactsFields id={key} extras={extras} phone={phone} onChange={saveExtras} />
              <StartedWithField key={`${key}:started`} id={key} extras={extras} phone={phone} onChange={saveExtras} />
              <TogetherFields id={key} extras={extras} others={[]} phone={phone} part="copy" onChange={saveExtras} />
            </Block>
            <Block label={SESSION_DIALOG_COPY.together} testId="session-together">
              <BlockHead label={SESSION_DIALOG_COPY.together} />
              <TogetherFields
                id={key}
                extras={extras}
                others={view.others ?? []}
                phone={phone}
                part="together"
                onTogether={h.onSessionTogether ? (keys) => {
                  setExtras((now) => ({ ...now, parallelWith: keys.length > 0 ? keys : undefined }));
                  h.onSessionTogether?.(key, keys);
                } : undefined}
                onChange={saveExtras}
              />
            </Block>
          </>
        ) : null}

        {(view.setup ?? []).length > 0 || h.onAddToSetup ? (
          <Block label={SESSION_DIALOG_COPY.setup} testId="session-setup">
            <BlockHead label={SESSION_DIALOG_COPY.setup} count={(view.setup ?? []).length || undefined} />
            <div style={PANEL_LIST}>
              {(view.setup ?? []).map((row) => (
                <Inline key={row.id}>
                  <LabelText>{row.kind}</LabelText>
                  <span style={BODY_TEXT}>{row.name}</span>
                  {notShared.has(row.id) ? (
                    <Hint>{SESSION_DIALOG_COPY.notShared}</Hint>
                  ) : h.onNotShared ? (
                    <TextLink
                      phone={phone}
                      aria-label={`${SESSION_DIALOG_COPY.keepToMyself}: ${row.name}`}
                      onClick={() => {
                        setNotShared((now) => new Set([...now, row.id]));
                        h.onNotShared?.(row.id);
                      }}
                    >
                      {SESSION_DIALOG_COPY.keepToMyself}
                    </TextLink>
                  ) : null}
                </Inline>
              ))}
            </div>
            {handlers.onAddToSetup ? (
              <Inline>
                <RecipeButton small phone={phone} onClick={() => handlers.onAddToSetup?.(key)}>
                  {SESSION_DIALOG_COPY.addToSetup}
                </RecipeButton>
              </Inline>
            ) : null}
          </Block>
        ) : null}

        <Block label={SESSION_DIALOG_COPY.prompts} testId="session-prompts">
          <BlockHead label={SESSION_DIALOG_COPY.prompts} count={SESSION_DIALOG_COPY.promptsIn(Object.values(shared).filter(Boolean).length, view.total)} />
          {view.status === "loading" ? (
            <LoadingRegion what="prompts" data-testid="session-prompts-loading">
              <LoadingBlocks kind="box" rows={SESSION_PROMPT_ROWS} width="fill" />
            </LoadingRegion>
          ) : null}
          {view.status === "error" ? (
            <Inline>
              <Hint>Prompts didn&apos;t load</Hint>
              {h.onRetrySessionPrompts ? (
                <TextLink onClick={() => h.onRetrySessionPrompts?.(view.key)} phone={phone}>
                  Retry
                </TextLink>
              ) : null}
            </Inline>
          ) : null}
          <div role="group" aria-label="Prompts in this session" style={PANEL_LIST}>
            {view.checklist.map((row) => (
              <label key={row.ordinal} style={BODY_TEXT}>
                <Inline>
                  <Checkbox checked={shared[row.ordinal] ?? false} onChange={(event) => {
                    setShared((now) => ({ ...now, [row.ordinal]: event.target.checked }));
                    h.onToggleSessionPrompt(view, row, event.target.checked);
                  }} />
                  {row.label}
                </Inline>
              </label>
            ))}
          </div>
        </Block>
      </ModalForm>
    </ModalShell>
  );
}

/** The window for a session, in edit mode. */
export function SessionDialog({ view, ...rest }: SessionDialogProps) {
  if (!view) return null;
  return <Form key={view.key} view={view} {...rest} />;
}

export default SessionDialog;
