/* CA-13 P5 to P8 — the runtime side of a tile in Details, after its own fields: for an agent its helpers, where it is
   defined (the Code tiles, rule 4), "Read the helpers from code", its trace link and install line; for a prompt or an agent
   its answer shape; for any tile what it took to make, and for a runtime tile what it costs to run. Each change is saved as
   it is made. Nothing here runs anything. */

import { useId, useState } from "react";

import { Button } from "@/components/brand/Button";
import { Checkbox } from "@/components/brand/Checkbox";
import { SET_IN_CODE_LINE, readHelpersFromCode, type HelpersRead } from "@/lib/build/agentCode";
import { SHAPE_HOW_LABEL, SHAPE_HOWS, SHAPE_TEXT_MAX, SHAPE_WHERE_SUGGESTIONS, shapeRefusal, type OutputShape, type ShapeHow } from "@/lib/build/answerShape";
import type { RuntimePatch } from "@/lib/build/graph";
import { traceRefusal } from "@/lib/build/trace";
import { t } from "@/lib/theme/tokens";

import { Field, TextButton } from "./composeControls";
import { CostFields } from "./CostFields";
import { HelpersField } from "./HelpersField";
import { PickMenu } from "./PickMenu";
import type { RuntimeView } from "./runtimeView";
import { text, typedArea, typedField } from "./refinedStyles";

function AnswerShapeField({ shape, schemaFiles, phone, onChange }: { shape: OutputShape | null; schemaFiles: readonly string[]; phone: boolean; onChange: (next: OutputShape | null) => void }) {
  const uid = useId();
  const [open, setOpen] = useState(Boolean(shape));
  const [d, setD] = useState<OutputShape>(shape ?? { how: "json-schema" });
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<OutputShape>) => setD((prev) => ({ ...prev, ...patch }));
  const save = () => {
    const why = shapeRefusal(d);
    if (why) {
      setError(why);
      return;
    }
    setError(null);
    onChange({ how: d.how, ...(d.where?.trim() ? { where: d.where.trim() } : null), ...(d.schema?.trim() ? { schema: d.schema } : null), ...(d.sample?.trim() ? { sample: d.sample } : null) });
  };
  return (
    <section aria-label="Answer shape" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <TextButton target={phone} onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{ ...text(12.5, 500, t.text), alignSelf: "flex-start" }}>
        Answer shape{shape ? " · returns a fixed shape" : ""}
      </TextButton>
      {open ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Field id={`${uid}-how`} label="Constraint" group>
            <PickMenu<ShapeHow> label="Answer shape" phone={phone} value={d.how} options={SHAPE_HOWS.map((how) => ({ value: how, label: SHAPE_HOW_LABEL[how] }))} onChange={(how) => set({ how })} />
          </Field>
          <Field id={`${uid}-where`} label="Where" hint="Claude API, OpenAI, Gemini, llama.cpp, Outlines, vLLM, or typed">
            <input id={`${uid}-where`} type="text" value={d.where ?? ""} maxLength={40} onChange={(e) => set({ where: e.target.value })} style={typedField(phone)} />
            <span style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SHAPE_WHERE_SUGGESTIONS.map((name) => (
                <TextButton key={name} onClick={() => set({ where: name })} style={text(12, 400, t.text2)}>{name}</TextButton>
              ))}
            </span>
          </Field>
          <Field id={`${uid}-schema`} label="Schema" hint={`Up to ${SHAPE_TEXT_MAX.toLocaleString("en-GB")} characters`}>
            <textarea id={`${uid}-schema`} rows={5} value={d.schema ?? ""} maxLength={SHAPE_TEXT_MAX} onChange={(e) => set({ schema: e.target.value })} style={typedArea(phone, { fontFamily: "var(--font-data)", fontSize: phone ? 16 : 12 })} />
            {schemaFiles.length ? <span style={text(12, 400, t.label)}>Schema file in this build: {schemaFiles.join(", ")}</span> : null}
          </Field>
          <Field id={`${uid}-sample`} label="Sample answer" hint="Optional">
            <textarea id={`${uid}-sample`} rows={3} value={d.sample ?? ""} maxLength={SHAPE_TEXT_MAX} onChange={(e) => set({ sample: e.target.value })} style={typedArea(phone, { fontFamily: "var(--font-data)", fontSize: phone ? 16 : 12 })} />
          </Field>
          {error ? <span role="alert" style={text(12.5, 400, t.text)}>{error}</span> : null}
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" size={phone ? 44 : 28} fontSize={12} onClick={save}>Save the answer shape</Button>
            {shape ? <Button variant="secondary" size={phone ? 44 : 28} fontSize={12} onClick={() => { onChange(null); setD({ how: "json-schema" }); }}>Remove</Button> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ReadFromCode({ codeTiles, definedIn, phone, onRead }: { codeTiles: readonly { id: string; label: string; source: string }[]; definedIn: readonly string[]; phone: boolean; onRead: (read: HelpersRead) => void }) {
  const uid = useId();
  const [pasted, setPasted] = useState("");
  const [said, setSaid] = useState<string | null>(null);
  const run = (source: string) => {
    const read = readHelpersFromCode(source);
    if (!read.found) {
      setSaid("No create_deep_agent(...) call found");
      return;
    }
    onRead(read);
    const lines = [`Read ${read.helpers.length} ${read.helpers.length === 1 ? "helper" : "helpers"}${read.tools.length ? `, ${read.tools.length} ${read.tools.length === 1 ? "tool" : "tools"}` : ""}${read.model ? " and the model" : ""}.`];
    if (read.setInCode.length) lines.push(`${SET_IN_CODE_LINE}: ${read.setInCode.join(", ")}.`);
    setSaid(lines.join(" "));
    setPasted("");
  };
  const mine = codeTiles.filter((tile) => definedIn.includes(tile.id));
  return (
    <section aria-label="Read the helpers from code" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h3 style={{ ...text(12.5, 500, t.text), margin: 0 }}>Read the helpers from code</h3>
      {mine.map((tile) => (
        <div key={tile.id}>
          <Button variant="secondary" size={phone ? 44 : 28} fontSize={12} onClick={() => run(tile.source)}>Read from {tile.label}</Button>
        </div>
      ))}
      <Field id={`${uid}-paste`} label="create_deep_agent(...) call">
        <textarea id={`${uid}-paste`} rows={3} value={pasted} onChange={(e) => setPasted(e.target.value)} style={typedArea(phone, { fontFamily: "var(--font-data)", fontSize: phone ? 16 : 12 })} />
      </Field>
      <div>
        <Button variant="secondary" size={phone ? 44 : 28} fontSize={12} disabled={!pasted.trim()} onClick={() => run(pasted)}>Read</Button>
      </div>
      {said ? <span role="status" style={text(12, 400, t.text2)}>{said}</span> : null}
    </section>
  );
}

export interface RuntimeFieldsProps {
  id: string;
  runtime: RuntimeView;
  phone: boolean;
  onRuntime: (id: string, patch: RuntimePatch) => void;
  /** "Read the helpers from code": the helpers, and the model and tools, as found. */
  onReadHelpers?: (id: string, read: HelpersRead) => void;
}

export function RuntimeFields({ id, runtime, phone, onRuntime, onReadHelpers }: RuntimeFieldsProps) {
  const uid = useId();
  const agent = runtime.agent;
  const [trace, setTrace] = useState(agent?.traceUrl ?? "");
  const [traceError, setTraceError] = useState<string | null>(null);
  const [install, setInstall] = useState(agent?.install ?? runtime.install ?? "");
  return (
    <div data-testid="runtime-fields" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {agent ? (
        <>
          <HelpersField key={`${id}:helpers:${agent.helpers.length}`} helpers={agent.helpers} toolNames={agent.toolNames} decisions={agent.decisions} phone={phone} onChange={(helpers) => onRuntime(id, { helpers })} />
          <Field id={`${uid}-defined`} label="Defined in" group>
            {agent.codeTiles.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {agent.codeTiles.map((tile) => (
                  <label key={tile.id} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: phone ? 44 : 24 }}>
                    <Checkbox checked={agent.definedIn.includes(tile.id)} onChange={(e) => onRuntime(id, { definedIn: e.target.checked ? [...agent.definedIn, tile.id] : agent.definedIn.filter((x) => x !== tile.id) })} />
                    <span style={text(13, 400, t.text)}>{tile.label}</span>
                  </label>
                ))}
              </div>
            ) : (
              <span style={text(12, 400, t.label)}>No Code tile linked</span>
            )}
          </Field>
          {onReadHelpers ? <ReadFromCode codeTiles={agent.codeTiles} definedIn={agent.definedIn} phone={phone} onRead={(read) => onReadHelpers(id, read)} /> : null}
          <Field id={`${uid}-trace`} label="Trace link" hint="https only">
            <input
              id={`${uid}-trace`}
              type="url"
              inputMode="url"
              value={trace}
              placeholder="https://smith.langchain.com/…"
              onChange={(e) => setTrace(e.target.value)}
              onBlur={() => {
                const why = traceRefusal(trace);
                setTraceError(why);
                if (!why) onRuntime(id, { traceUrl: trace.trim() || null });
              }}
              style={typedField(phone)}
            />
            {traceError ? <span role="alert" style={text(12, 400, t.text)}>{traceError}</span> : null}
          </Field>
        </>
      ) : null}
      {agent || runtime.install !== undefined ? (
        <Field id={`${uid}-install`} label="How to install" hint="As typed">
          <input id={`${uid}-install`} type="text" value={install} maxLength={400} onChange={(e) => setInstall(e.target.value)} onBlur={() => onRuntime(id, { install: install.trim() || null })} style={typedField(phone)} />
        </Field>
      ) : null}
      {runtime.shape ? <AnswerShapeField key={`${id}:shape:${runtime.shape.shape ? 1 : 0}`} shape={runtime.shape.shape} schemaFiles={runtime.shape.schemaFiles} phone={phone} onChange={(outputShape) => onRuntime(id, { outputShape })} /> : null}
      {runtime.costs ? (
        <>
          <CostFields key={`${id}:build:${runtime.costs.build ? 1 : 0}`} kind="build" value={runtime.costs.build} phone={phone} onChange={(next) => onRuntime(id, { buildCost: next as RuntimePatch["buildCost"] })} />
          {runtime.costs.runtime ? <CostFields key={`${id}:run:${runtime.costs.run ? 1 : 0}`} kind="run" value={runtime.costs.run} volume={runtime.costs.volume ?? null} phone={phone} onVolume={(volume) => onRuntime(id, { volume })} onChange={(next) => onRuntime(id, { runCost: next as RuntimePatch["runCost"] })} /> : null}
        </>
      ) : null}
    </div>
  );
}
