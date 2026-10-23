/* CA-18 P2: "How did it run?", moved out of the Details panel into the agent's own window (it is the one place it is changed).

   The same choice rows, fields and writes as Details had (CA-03 P3, CA-04 P6): `onRuns(id, runs)`, and `onAgentNotes` for
   what an agent changes each round. Nothing new is stored: `payload.runs` keeps its shape. */

import { useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

import { CodeEditorField } from "@/components/code/CodeEditorField";
import { Segmented } from "@/components/brand/Segmented";
import { AT_MOST_MAX, AT_MOST_MIN, UNTIL_DETAIL_MAX, untilDetail, untilParts, type Runs } from "@/lib/build/graph";
import { t } from "@/lib/theme/tokens";

import { ChangesEachRoundField } from "./AgentNotesFields";
import { ChoiceRows } from "./ChoiceRows";
import { FIELD_LABEL, TextButton } from "./composeControls";
import { RUNS_CHOICES, RUNS_COPY, SCHEDULE_PRESETS, atOnce, isClockTime, scheduleDetail, scheduleParts, type RunsChoice } from "./detailsModel";
import type { AgentView, DetailsHandlers } from "./DetailsPanel";
import { text, tnum, typedField } from "./refinedStyles";

const quiet = (extra: CSSProperties = {}): CSSProperties => text(11.5, 400, t.label, extra);

/** A small label over a control that is not one input: the field label's look, in a group. */
function GroupLabel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span id={id} style={FIELD_LABEL}>
      {children}
    </span>
  );
}

/** A field label over its control: the label wraps the control it names. */
function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={FIELD_LABEL}>{label}</span>
      {children}
    </label>
  );
}

/** The content of the group, without a title of its own: the window's section names it. */
function Section({ children }: { title?: string; children: ReactNode }) {
  return <section style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>{children}</section>;
}

/**
 * CA-03 P3: How did it run? Choice rows, the first three always shown and the other two under "More ways it ran"
 * (shown straight away when one of them is chosen). A schedule offers three presets and a time, written into its
 * detail as text ("Weekdays 07:30"); typing in the field still works and wins. "Again until" takes an optional "At
 * most" count, written into the same detail ("until the review has no changes · at most 3 times"). Nothing new is
 * stored: `payload.runs` keeps its shape.
 */
export function RunsGroup({ view, phone, onRuns, onAgentNotes }: { view: AgentView; phone: boolean } & Pick<DetailsHandlers, "onRuns" | "onAgentNotes">) {
  // CA-04 P6: in a session that worked until a goal, "Until a goal was reached" is chosen for you.
  const how = view.runs?.how ?? (view.sessionGoal ? "goal" : "once");
  const choice = RUNS_CHOICES.find((entry) => entry.how === how) ?? RUNS_CHOICES[0];
  const name = `runs-${view.id}`;
  const field = choice.field;
  const saved = view.runs?.detail ?? "";
  const [count, setCount] = useState(view.runs?.count ?? 2);
  const [detail, setDetail] = useState(saved);
  const [condition, setCondition] = useState(how === "until" ? untilParts(saved).condition : "");
  const [atMost, setAtMost] = useState(how === "until" && untilParts(saved).atMost !== null ? String(untilParts(saved).atMost) : "");
  const [time, setTime] = useState(how === "schedule" ? scheduleParts(saved).time : "");
  const [moreAsked, setMoreAsked] = useState(false);
  const showMore = moreAsked || choice.more;
  const preset = how === "schedule" ? scheduleParts(detail).preset : null;
  const ids = `${name}-field`;

  const pick = (next: RunsChoice) => {
    setDetail("");
    setCondition("");
    setAtMost("");
    setTime("");
    if (next.how === "once") onRuns(view.id, null);
    else if (next.how === "parallel") onRuns(view.id, { how: "parallel", count: view.runs?.count ?? count });
    else onRuns(view.id, { how: next.how, detail: "" });
  };

  /** Write a detail when it changed. */
  const write = (next: string) => {
    if (next.trim() !== saved.trim()) onRuns(view.id, { how, detail: next.trim() });
  };

  const atMostNumber = (): number | null => {
    const n = Number(atMost);
    return atMost.trim() && Number.isFinite(n) ? Math.min(AT_MOST_MAX, Math.max(AT_MOST_MIN, Math.round(n))) : null;
  };
  const writeUntil = () => {
    const n = atMostNumber();
    setAtMost(n === null ? "" : String(n));
    write(untilDetail(condition, n));
  };
  const room = UNTIL_DETAIL_MAX - (atMost.trim() ? ` · at most ${AT_MOST_MAX} times`.length : 0);

  const enterBlurs = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === "Enter") (event.target as HTMLInputElement).blur();
  };

  return (
    <Section title={RUNS_COPY.title}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8 }}>
        <ChoiceRows
          label={RUNS_COPY.title}
          name={name}
          phone={phone}
          value={how}
          onChange={(next) => pick(RUNS_CHOICES.find((entry) => entry.how === next) ?? RUNS_CHOICES[0])}
          rows={RUNS_CHOICES.filter((entry) => !entry.more || showMore).map((entry) => ({
            value: entry.how,
            label: entry.how === "once" && view.parent ? `${entry.label} · ${RUNS_COPY.inTeam}` : entry.label,
          }))}
        />
        {showMore ? null : (
          <span>
            <TextButton target={phone} style={text(12.5, 500, t.text2)} onClick={() => setMoreAsked(true)}>
              {RUNS_COPY.more}
            </TextButton>
          </span>
        )}

        {field?.kind === "count" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="text"
              inputMode="numeric"
              aria-label={field.label}
              value={Number.isFinite(count) ? String(count) : ""}
              onChange={(event) => setCount(Number(event.target.value.replace(/[^0-9]/g, "")))}
              onBlur={() => {
                const next = Math.min(field.max, Math.max(field.min, Math.round(Number.isFinite(count) ? count : field.min)));
                setCount(next);
                if (next !== view.runs?.count) onRuns(view.id, { how: "parallel", count: next });
              }}
              onKeyDown={enterBlurs}
              style={typedField(phone, { width: 72, ...tnum })}
            />
            <span style={{ ...quiet(), ...tnum }}>{atOnce(Math.min(field.max, Math.max(field.min, Number.isFinite(count) ? count : field.min)))}</span>
          </div>
        ) : null}

        {how === "schedule" && field?.kind === "text" ? (
          <div role="group" aria-labelledby={`${ids}-when`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <GroupLabel id={`${ids}-when`}>{field.label}</GroupLabel>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <Segmented
                label={RUNS_COPY.presets}
                semantics="radio"
                size={phone ? 50 : 28}
                value={preset ?? ""}
                items={SCHEDULE_PRESETS.map((entry) => ({ value: entry, label: entry }))}
                onChange={(next) => {
                  const chosen = SCHEDULE_PRESETS.find((entry) => entry === next) ?? null;
                  const written = scheduleDetail(chosen, time);
                  setDetail(written);
                  write(written);
                }}
              />
              <input
                type="text"
                aria-label={RUNS_COPY.time}
                placeholder={RUNS_COPY.timeHint}
                maxLength={5}
                value={time}
                onChange={(event) => setTime(event.target.value.replace(/[^0-9:]/g, ""))}
                onBlur={() => {
                  if (time.trim() && !isClockTime(time)) return;
                  const written = scheduleDetail(preset, time);
                  if (!written) return;
                  setDetail(written);
                  write(written);
                }}
                onKeyDown={enterBlurs}
                style={typedField(phone, { width: 72, ...tnum })}
              />
            </div>
            <input
              type="text"
              aria-label={field.label}
              maxLength={field.max}
              placeholder={field.placeholder}
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              onBlur={() => {
                setTime(scheduleParts(detail).time);
                write(detail);
              }}
              onKeyDown={enterBlurs}
              style={typedField(phone)}
            />
            <span style={{ ...quiet(), ...tnum }}>
              {detail.length} / {field.max}
            </span>
          </div>
        ) : null}

        {how === "event" && field?.kind === "text" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <FieldBlock label={field.label}>
              <input
                type="text"
                aria-label={field.label}
                maxLength={field.max}
                placeholder={field.placeholder}
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                onBlur={() => write(detail)}
                onKeyDown={enterBlurs}
                style={typedField(phone)}
              />
            </FieldBlock>
            <span style={{ ...quiet(), ...tnum }}>
              {detail.length} / {field.max}
            </span>
          </div>
        ) : null}

        {how === "script" && field?.kind === "code" ? (
          <FieldBlock label={field.label}>
            <CodeEditorField
              ariaLabel={field.label}
              testId="details-script"
              maxLength={field.max}
              rows={{ min: 3, max: 8 }}
              placeholder={field.placeholder}
              value={detail}
              onChange={setDetail}
              onBlur={() => write(detail)}
            />
          </FieldBlock>
        ) : null}

        {how === "until" && field?.kind === "text" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <FieldBlock label={field.label}>
              <input
                type="text"
                aria-label={field.label}
                maxLength={room}
                placeholder={field.placeholder}
                value={condition}
                onChange={(event) => setCondition(event.target.value)}
                onBlur={writeUntil}
                onKeyDown={enterBlurs}
                style={typedField(phone)}
              />
            </FieldBlock>
            <span style={{ ...quiet(), ...tnum, marginTop: -2 }}>
              {condition.length} / {room}
            </span>
            <div role="group" aria-labelledby={`${ids}-most`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <GroupLabel id={`${ids}-most`}>{RUNS_COPY.atMost}</GroupLabel>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={RUNS_COPY.atMost}
                  maxLength={2}
                  value={atMost}
                  onChange={(event) => setAtMost(event.target.value.replace(/[^0-9]/g, ""))}
                  onBlur={writeUntil}
                  onKeyDown={enterBlurs}
                  style={typedField(phone, { width: 56, ...tnum })}
                />
                <span style={text(12.5, 400, t.text2)}>{RUNS_COPY.times}</span>
              </div>
            </div>
            {/* CA-05 P9: what an agent changes each round, when it runs again until a condition was met. */}
            {view.kind === "agent" && onAgentNotes ? <ChangesEachRoundField id={view.id} value={view.changesEachRound ?? ""} phone={phone} onCommit={(said) => onAgentNotes(view.id, { changesEachRound: said })} /> : null}
          </div>
        ) : null}
      </div>
    </Section>
  );
}

