/* CA-05 P8 — How it was run, and Where, under a model: for a model run on the maker's own computer (Ollama, LM Studio)
   or one whose weights are open. Two Fields marked Optional, each a menu; Other takes a quant type up to 20 characters.
   SV-27 P4: the first field is Precision ("Full precision"); Where offers the build's Host tiles by name; a quiet "More about
   how it was served" opens Weights format, Parameter count, Context length, Inference engine, Draft model and, for a host with
   two or more GPUs, Split across GPUs. PURE: the run in, the run out. Nothing is shown for a model that is not either. */

import { useState } from "react";

import { type GpuSplit, type ModelRun, type RunHost, type WeightsFormat, CONTEXT_LENGTH_MAX, DRAFT_MODEL_MAX, ENGINE_MAX, PARAMETERS_MAX, PRECISION_OTHER_MAX, PRECISIONS, RUN_COPY, SPLITS, WEIGHTS_FORMATS, showsSplit } from "@/lib/build/modelRun";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";

import { Field, TextButton } from "./composeControls";
import { PickMenu } from "./PickMenu";
import { typedField } from "./refinedStyles";

type HowChoice = (typeof PRECISIONS)[number] | "other" | "none";

/** A Host tile the build has, offered under Where by name (SV-27 P4). */
export interface RunHostChoice extends RunHost {
  id: string;
}

const HOW_OPTIONS = [
  { value: "full", label: RUN_COPY.full },
  { value: "8-bit", label: RUN_COPY.eight },
  { value: "4-bit", label: RUN_COPY.four },
  { value: "other", label: RUN_COPY.other },
  { value: "none", label: RUN_COPY.none },
] as const;

const MORE_COPY = { open: "More about how it was served", close: "Fewer details" } as const;

function TypedValue({ label, value, max, placeholder, phone, numeric = false, onCommit }: { label: string; value: string; max: number; placeholder: string; phone: boolean; numeric?: boolean; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const { state, handlers } = useInteractive<HTMLInputElement>({ onBlur: () => draft.trim() !== value.trim() && onCommit(draft.trim()) });
  return (
    <input
      type="text"
      inputMode={numeric ? "numeric" : undefined}
      aria-label={label}
      maxLength={max}
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(numeric ? event.target.value.replace(/[^\d]/g, "") : event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          if (draft.trim() !== value.trim()) onCommit(draft.trim());
        }
      }}
      {...handlers}
      style={typedField(phone, ring(state.focusVisible))}
    />
  );
}

const hasMore = (run: ModelRun | null): boolean => Boolean(run && (run.weights_format || run.parameters || run.context_length || run.engine || run.draft_model || run.split || run.batch));

export function ModelRunFields({ id, run, phone, hosts = [], onChange }: { id: string; run: ModelRun | null; phone: boolean; hosts?: readonly RunHostChoice[]; onChange: (run: ModelRun | null) => void }) {
  const precision = run?.precision;
  const isOther = precision !== undefined && !(PRECISIONS as readonly string[]).includes(precision);
  const [asked, setAsked] = useState(false);
  const [more, setMore] = useState(() => hasMore(run));
  const how: HowChoice = isOther || asked ? "other" : ((precision as HowChoice | undefined) ?? "none");
  const where: string = run?.host && hosts.some((host) => host.id === run.host) ? `host:${run.host}` : (run?.where ?? "none");
  const host = run?.host ? (hosts.find((entry) => entry.id === run.host) ?? null) : null;
  const whereOptions = [
    ...hosts.map((entry) => ({ value: `host:${entry.id}`, label: entry.name || RUN_COPY.where })),
    { value: "computer", label: RUN_COPY.computer },
    { value: "server", label: RUN_COPY.server },
    { value: "none", label: RUN_COPY.none },
  ];
  const save = (change: Partial<ModelRun>) => {
    const next: ModelRun = { ...run, ...change };
    for (const key of Object.keys(next) as (keyof ModelRun)[]) if (next[key] === undefined) delete next[key];
    onChange(Object.keys(next).length > 0 ? next : null);
  };
  return (
    <>
      <Field id={`${id}-how-run`} label={RUN_COPY.how} hint={RUN_COPY.precision} group>
        <PickMenu<HowChoice>
          label={RUN_COPY.precision}
          options={HOW_OPTIONS}
          value={how}
          placeholder={RUN_COPY.none}
          phone={phone}
          onChange={(choice) => {
            setAsked(choice === "other");
            if (choice === "other") return;
            save({ precision: choice === "none" ? undefined : choice });
          }}
        />
        {how === "other" ? <TypedValue key={`${id}:${precision ?? ""}`} label={`${RUN_COPY.precision}: ${RUN_COPY.other}`} value={isOther ? (precision ?? "") : ""} max={PRECISION_OTHER_MAX} placeholder={RUN_COPY.otherHint} phone={phone} onCommit={(value) => save({ precision: value || undefined })} /> : null}
      </Field>
      <Field id={`${id}-where-run`} label={RUN_COPY.where} hint={RUN_COPY.optional} group>
        <PickMenu<string>
          label={RUN_COPY.where}
          options={whereOptions}
          value={where}
          placeholder={RUN_COPY.none}
          phone={phone}
          onChange={(choice) => {
            if (choice.startsWith("host:")) save({ host: choice.slice(5), where: undefined });
            else save({ where: choice === "none" ? undefined : (choice as ModelRun["where"]), host: undefined, split: undefined });
          }}
        />
      </Field>
      <div>
        <TextButton underline aria-expanded={more} onClick={() => setMore((open) => !open)}>
          {more ? MORE_COPY.close : MORE_COPY.open}
        </TextButton>
      </div>
      {more ? (
        <>
          <Field id={`${id}-weights`} label={RUN_COPY.weightsFormat} hint={RUN_COPY.optional} group>
            <PickMenu<WeightsFormat | "none">
              label={RUN_COPY.weightsFormat}
              options={[...WEIGHTS_FORMATS.map((value) => ({ value, label: value === "other" ? RUN_COPY.other : value })), { value: "none" as const, label: RUN_COPY.none }]}
              value={run?.weights_format ?? "none"}
              placeholder={RUN_COPY.none}
              phone={phone}
              onChange={(choice) => save({ weights_format: choice === "none" ? undefined : choice })}
            />
          </Field>
          <Field id={`${id}-parameters`} label={RUN_COPY.parameters} hint={RUN_COPY.optional} group>
            <TypedValue key={`${id}:p:${run?.parameters ?? ""}`} label={RUN_COPY.parameters} value={run?.parameters ?? ""} max={PARAMETERS_MAX} placeholder={RUN_COPY.parametersHint} phone={phone} onCommit={(value) => save({ parameters: value || undefined })} />
          </Field>
          <Field id={`${id}-context`} label={RUN_COPY.contextLength} hint={RUN_COPY.optional} group>
            <TypedValue
              key={`${id}:c:${run?.context_length ?? ""}`}
              label={RUN_COPY.contextLength}
              value={run?.context_length ? String(run.context_length) : ""}
              max={String(CONTEXT_LENGTH_MAX).length}
              placeholder={RUN_COPY.contextLengthHint}
              phone={phone}
              numeric
              onCommit={(value) => save({ context_length: value ? Number(value) : undefined })}
            />
          </Field>
          <Field id={`${id}-engine`} label={RUN_COPY.engine} hint={RUN_COPY.optional} group>
            <TypedValue key={`${id}:e:${run?.engine ?? ""}`} label={RUN_COPY.engine} value={run?.engine ?? ""} max={ENGINE_MAX} placeholder={RUN_COPY.engineHint} phone={phone} onCommit={(value) => save({ engine: value || undefined })} />
          </Field>
          <Field id={`${id}-batch`} label={RUN_COPY.batch} hint={RUN_COPY.batchHint} group>
            <PickMenu<"yes" | "none">
              label={RUN_COPY.batch}
              options={[{ value: "yes" as const, label: "Yes" }, { value: "none" as const, label: RUN_COPY.none }]}
              value={run?.batch ? "yes" : "none"}
              placeholder={RUN_COPY.none}
              phone={phone}
              onChange={(choice) => save({ batch: choice === "yes" ? true : undefined })}
            />
          </Field>
          <Field id={`${id}-draft`} label={RUN_COPY.draftModel} hint={RUN_COPY.optional} group>
            <TypedValue key={`${id}:d:${run?.draft_model ?? ""}`} label={RUN_COPY.draftModel} value={run?.draft_model ?? ""} max={DRAFT_MODEL_MAX} placeholder={RUN_COPY.draftModelHint} phone={phone} onCommit={(value) => save({ draft_model: value || undefined })} />
          </Field>
          {showsSplit(host) ? (
            <Field id={`${id}-split`} label={RUN_COPY.split} hint={RUN_COPY.optional} group>
              <PickMenu<GpuSplit | "none">
                label={RUN_COPY.split}
                options={[...SPLITS.map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) })), { value: "none" as const, label: RUN_COPY.none }]}
                value={run?.split ?? "none"}
                placeholder={RUN_COPY.none}
                phone={phone}
                onChange={(choice) => save({ split: choice === "none" ? undefined : choice })}
              />
            </Field>
          ) : null}
        </>
      ) : null}
    </>
  );
}
