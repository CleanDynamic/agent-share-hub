/* CA-18 P2: the blocks a tile's window has in edit mode that its Add dialog never had: what it uses, what it makes, where its
   work goes, and the runtime side of it.

   Built from `modalRecipes` like the dialogs: no colour, size or radius of its own (`lookRules.test.ts` holds it to that). Each
   block calls the handlers Details used for the same thing (`onAddUse`, `onRemoveUse`, `onAddMade`, `onRemoveMade`, `onFields`,
   `onRuntime`...); the window gives it the handlers queued in a `WriteBuffer`, so nothing is written until Save. */

import { useState } from "react";

import { MADE_FILE_NAME_MAX, TITLE_MAX, type RuntimePatch } from "@/lib/build/graph";

import type { DetailsHandlers, DetailsView } from "./DetailsPanel";
import type { GoesRow, InputOption, MakesRow, UseRow } from "./detailsModel";
import { Block, BlockHead, FieldInput, FileButton, FileLine, Hint, Inline, LabelText, PANEL_LIST, RecipeButton, Row, SegmentedField, Tag, TagList, TextLink } from "./modalRecipes";
import { harnessTool, modelMenu } from "@/lib/tools/modelRules";

import { ModelPicker } from "./ModelPicker";
import { ModelRunFields } from "./ModelRunFields";
import { PairNote } from "./PairNote";
import { PickMenu } from "./PickMenu";
import { RunsWhenField } from "./RunsWhenField";
import { RuntimeFields } from "./RuntimeFields";
import { withRuntimePatch } from "./runtimeView";

export const EDIT_COPY = {
  uses: "Uses",
  addInput: "Add input",
  attach: "File from computer",
  makes: "Makes",
  nameFile: "Add file name",
  filePlaceholder: "brand-guide.md",
  taken: "Name already used by this tile",
  goesInto: "Used by",
  runtime: "Runtime",
  count: (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`,
} as const;

const ATTACH = "__attach__";

/** Uses: the inputs it takes in, each with Remove, and a menu of what it may take (a file from the computer too). */
export function UsesBlock({ id, rows: initial, options: initialOptions, phone, handlers }: { id: string; rows: readonly UseRow[]; options: readonly InputOption[]; phone: boolean; handlers: Pick<DetailsHandlers, "onAddUse" | "onRemoveUse" | "onAttach"> }) {
  const [rows, setRows] = useState<UseRow[]>([...initial]);
  const [options, setOptions] = useState<InputOption[]>([...initialOptions]);
  const nameOf = (row: UseRow) => (row.sub ? `${row.label} · ${row.sub}` : row.label);
  const keyOf = (row: UseRow) => `${row.use.kind}:${row.use.node_id}`;

  const remove = (row: UseRow) => {
    setRows((now) => now.filter((entry) => entry !== row));
    setOptions((now) => [...now, { key: keyOf(row), use: row.use, label: row.label, sub: row.sub }]);
    handlers.onRemoveUse(id, row.use);
  };
  const add = (key: string) => {
    if (key === ATTACH) {
      handlers.onAttach?.(id);
      return;
    }
    const option = options.find((entry) => entry.key === key);
    if (!option) return;
    setOptions((now) => now.filter((entry) => entry.key !== key));
    setRows((now) => [...now, { use: option.use, label: option.label, sub: option.sub }]);
    handlers.onAddUse(id, option.use);
  };

  return (
    <Block label={EDIT_COPY.uses} testId="edit-uses">
      <BlockHead label={EDIT_COPY.uses} count={EDIT_COPY.count(rows.length, "tile", "tiles")} />
      <div style={PANEL_LIST}>
        {rows.map((row) => (
          <FileLine key={keyOf(row)} name={nameOf(row)} removeLabel={`Remove ${row.label}`} onRemove={() => remove(row)} phone={phone} />
        ))}
      </div>
      <PickMenu<string>
        label={EDIT_COPY.addInput}
        placeholder={EDIT_COPY.addInput}
        value={null}
        phone={phone}
        field
        onChange={add}
        options={[...(handlers.onAttach ? [{ value: ATTACH, label: EDIT_COPY.attach }] : []), ...options.map((option) => ({ value: option.key, label: option.sub ? `${option.label} · ${option.sub}` : option.label }))]}
      />
    </Block>
  );
}

interface MadeRow {
  id: string;
  name: string;
  isNew: boolean;
}

/** Makes: the files it makes, each renamed in place and removed with Remove, and "Add file name". */
export function MakesBlock({ id, rows: initial, phone, handlers }: { id: string; rows: readonly MakesRow[]; phone: boolean; handlers: Pick<DetailsHandlers, "onAddMade" | "onRemoveMade" | "onFields"> }) {
  const [rows, setRows] = useState<MadeRow[]>(initial.map((row) => ({ ...row, isNew: false })));
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [taken, setTaken] = useState(false);
  if (!handlers.onAddMade) return null;

  const submit = () => {
    const name = draft.trim();
    if (!name) return;
    if (rows.some((row) => row.name.trim().toLowerCase() === name.toLowerCase())) {
      setTaken(true);
      return;
    }
    handlers.onAddMade?.(id, name);
    setRows((now) => [...now, { id: `new:${name}`, name, isNew: true }]);
    setAdding(false);
    setDraft("");
    setTaken(false);
  };
  const rename = (row: MadeRow, value: string) => {
    const next = value.trim();
    if (!next || next === row.name) return;
    setRows((now) => now.map((entry) => (entry.id === row.id ? { ...entry, name: next } : entry)));
    handlers.onFields(row.id, { title: next });
  };

  return (
    <Block label={EDIT_COPY.makes} testId="edit-makes">
      <BlockHead label={EDIT_COPY.makes} count={EDIT_COPY.count(rows.length, "file", "files")} />
      <div style={PANEL_LIST}>
        {rows.map((row) =>
          row.isNew ? (
            <FileLine
              key={row.id}
              name={row.name}
              removeLabel={`Remove ${row.name}`}
              phone={phone}
              onRemove={() => {
                setRows((now) => now.filter((entry) => entry.id !== row.id));
                handlers.onRemoveMade?.(row.id);
              }}
            />
          ) : (
            <Inline key={row.id}>
              <FieldInput phone={phone} aria-label={`Name of ${row.name}`} defaultValue={row.name} maxLength={MADE_FILE_NAME_MAX} onBlur={(event) => rename(row, event.target.value)} />
              <TextLink
                phone={phone}
                aria-label={`Remove ${row.name}`}
                onClick={() => {
                  setRows((now) => now.filter((entry) => entry.id !== row.id));
                  handlers.onRemoveMade?.(row.id);
                }}
              >
                Remove
              </TextLink>
            </Inline>
          ),
        )}
      </div>
      {adding ? (
        <>
          <FieldInput
            phone={phone}
            autoFocus
            aria-label={EDIT_COPY.nameFile}
            placeholder={EDIT_COPY.filePlaceholder}
            value={draft}
            maxLength={MADE_FILE_NAME_MAX}
            onChange={(event) => {
              setDraft(event.target.value);
              setTaken(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
          />
          <Inline>
            <RecipeButton small phone={phone} onClick={submit}>
              Add
            </RecipeButton>
            <TextLink phone={phone} onClick={() => setAdding(false)}>
              Cancel
            </TextLink>
          </Inline>
          {taken ? <Hint>{EDIT_COPY.taken}</Hint> : null}
        </>
      ) : (
        <TextLink phone={phone} onClick={() => setAdding(true)}>
          {EDIT_COPY.nameFile}
        </TextLink>
      )}
    </Block>
  );
}

/** Goes into: where its work goes. Derived from the build, so it is read here, never changed. */
export function GoesBlock({ rows, label = EDIT_COPY.goesInto }: { rows: readonly GoesRow[]; label?: string }) {
  if (rows.length === 0) return null;
  return (
    <Block label={label} testId="edit-goes-into">
      <BlockHead label={label} count={EDIT_COPY.count(rows.length, "tile", "tiles")} />
      <TagList label={label}>
        {rows.map((row) => (
          <Tag key={row.id}>{row.label}</Tag>
        ))}
      </TagList>
    </Block>
  );
}

/** The runtime side of a tile (helpers, where it is defined, trace link, install line, answer shape, costs) and "Runs when". */
export function RuntimeBlocks({ view, phone, handlers }: { view: DetailsView; phone: boolean; handlers: Pick<DetailsHandlers, "onRuntime" | "onReadHelpers" | "onRunsWhen"> }) {
  const id = view.kind === "session" ? view.key : view.id;
  // What was changed is laid over what the tile holds, so a second change builds on the first.
  const [runtime, setRuntime] = useState(view.runtime);
  if (!runtime) return null;
  const onRuntime = handlers.onRuntime
    ? (to: string, patch: RuntimePatch) => {
        setRuntime((now) => (now ? withRuntimePatch(now, patch) : now));
        handlers.onRuntime?.(to, patch);
      }
    : undefined;
  return (
    <>
      {onRuntime && view.kind !== "session" ? (
        <Block label={EDIT_COPY.runtime} testId="edit-runtime">
          <RuntimeFields key={`${id}:runtime`} id={id} runtime={runtime} phone={phone} onRuntime={onRuntime} onReadHelpers={handlers.onReadHelpers} />
        </Block>
      ) : null}
      {runtime.runsWhen && handlers.onRunsWhen && view.kind !== "prompt" ? (
        <Block label="Runs when" testId="edit-runs-when">
          <RunsWhenField key={`${id}:when:${runtime.runsWhen.currentLabel ?? ""}`} view={runtime.runsWhen} phone={phone} onChange={(next) => handlers.onRunsWhen?.(id, next)} />
        </Block>
      ) : null}
    </>
  );
}

/* ── a title, what an agent holds, and a result's pictures ── */

export const EDIT_BLOCK_COPY = {
  title: "Title",
  inside: "Inside",
  pictures: "Images and videos",
  useAsCover: "Use as cover",
  addPicture: "Add a picture",
  trainedOn: "Trained on",
  trainedOnLine: "Ratings or examples",
  addFile: "Add the file",
  replaceFile: "Replace the file",
  removeFile: "Remove the file",
  summary: "Summary",
  whereRan: "Where it ran",
  web: "Web",
  local: "Local",
  toolsUsed: "Tools it used",
} as const;

/** A tile's own title, renamed through `onRename`: a blank title puts the default back. */
export function TitleRow({ id, title, defaultTitle, phone, handlers }: { id: string; title: string | null; defaultTitle: string; phone: boolean; handlers: Pick<DetailsHandlers, "onRename"> }) {
  return (
    <Row id={`${id}-title`} label={EDIT_BLOCK_COPY.title} phone={phone} noRule>
      <FieldInput phone={phone} id={`${id}-title`} defaultValue={title ?? ""} maxLength={TITLE_MAX} placeholder={defaultTitle} onBlur={(event) => event.target.value.trim() !== (title ?? "") && handlers.onRename(id, event.target.value)} />
    </Row>
  );
}

/** What an agent or a team holds, each with Remove (`onRemoveInside`). */
export function InsideBlock({ label, rows: initial, phone, handlers }: { label: string; rows: readonly { id: string; label: string }[]; phone: boolean; handlers: Pick<DetailsHandlers, "onRemoveInside"> }) {
  const [rows, setRows] = useState([...initial]);
  if (rows.length === 0) return null;
  return (
    <Block label={EDIT_BLOCK_COPY.inside} testId="edit-inside">
      <BlockHead label={EDIT_BLOCK_COPY.inside} count={label} />
      <div style={PANEL_LIST}>
        {rows.map((row) => (
          <FileLine
            key={row.id}
            name={row.label}
            removeLabel={`Remove ${row.label}`}
            phone={phone}
            onRemove={() => {
              setRows((now) => now.filter((entry) => entry.id !== row.id));
              handlers.onRemoveInside(row.id);
            }}
          />
        ))}
      </div>
    </Block>
  );
}

/** A result's summary: one field (`onFields(id, { summary })`). */
export function SummaryRow({ id, value, phone, handlers }: { id: string; value: string; phone: boolean; handlers: Pick<DetailsHandlers, "onFields"> }) {
  return (
    <Row id={`${id}-summary`} label={EDIT_BLOCK_COPY.summary} phone={phone} noRule>
      <FieldInput phone={phone} id={`${id}-summary`} defaultValue={value} maxLength={200} onBlur={(event) => event.target.value.trim() !== value && handlers.onFields(id, { summary: event.target.value })} />
    </Row>
  );
}

/** A result's pictures: each "Use as cover", and Add a picture (`onAddPicture`, `onUseAsCover`). */
export function PicturesBlock({ id, pictures, phone, handlers }: { id: string; pictures: readonly { id: string; name: string }[]; phone: boolean; handlers: Pick<DetailsHandlers, "onAddPicture" | "onUseAsCover"> }) {
  const [added, setAdded] = useState<string[]>([]);
  return (
    <Block label={EDIT_BLOCK_COPY.pictures} testId="edit-pictures">
      <BlockHead label={EDIT_BLOCK_COPY.pictures} count={EDIT_COPY.count(pictures.length + added.length, "file", "files")} />
      <div style={PANEL_LIST}>
        {pictures.map((picture) => (
          <Inline key={picture.id}>
            <LabelText>{picture.name}</LabelText>
            <TextLink phone={phone} aria-label={`${EDIT_BLOCK_COPY.useAsCover}: ${picture.name}`} onClick={() => handlers.onUseAsCover(picture.id)}>
              {EDIT_BLOCK_COPY.useAsCover}
            </TextLink>
          </Inline>
        ))}
        {added.map((name) => (
          <Hint key={name}>{`${name} will be added`}</Hint>
        ))}
      </div>
      <Inline>
        <FileButton
          phone={phone}
          accept="image/*"
          testId="edit-picture"
          inputLabel={EDIT_BLOCK_COPY.addPicture}
          onFiles={(list) => {
            const file = list?.[0];
            if (!file) return;
            handlers.onAddPicture(id, file);
            setAdded((now) => [...now, file.name]);
          }}
        >
          {EDIT_BLOCK_COPY.addPicture}
        </FileButton>
      </Inline>
    </Block>
  );
}

/** A trained model's file: what it was trained on, with Add or Replace the file (`onTrainedOn`) and Remove (`onRemoveInside`). */
export function TrainedBlock({ id, trainedOn, phone, handlers }: { id: string; trainedOn: { id: string; name: string; rows: number | null } | null; phone: boolean; handlers: Pick<DetailsHandlers, "onTrainedOn" | "onRemoveInside"> }) {
  const [file, setFile] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const held = removed ? null : trainedOn;
  return (
    <Block label={EDIT_BLOCK_COPY.trainedOn} testId="edit-trained-on">
      <BlockHead label={EDIT_BLOCK_COPY.trainedOn} />
      {file ? (
        <Hint>{`${file} will be added`}</Hint>
      ) : held ? (
        <FileLine
          name={`${held.name}${held.rows ? ` · ${held.rows.toLocaleString("en-GB")} rows` : ""}`}
          removeLabel={EDIT_BLOCK_COPY.removeFile}
          phone={phone}
          onRemove={() => {
            setRemoved(true);
            handlers.onRemoveInside(held.id);
          }}
        />
      ) : (
        <Hint>{EDIT_BLOCK_COPY.trainedOnLine}</Hint>
      )}
      {handlers.onTrainedOn ? (
        <Inline>
          <FileButton
            phone={phone}
            testId="edit-trained-on-file"
            inputLabel={held ? EDIT_BLOCK_COPY.replaceFile : EDIT_BLOCK_COPY.addFile}
            onFiles={(list) => {
              const picked = list?.[0];
              if (!picked) return;
              handlers.onTrainedOn?.(id, picked);
              setFile(picked.name);
            }}
          >
            {held ? EDIT_BLOCK_COPY.replaceFile : EDIT_BLOCK_COPY.addFile}
          </FileButton>
        </Inline>
      ) : null}
    </Block>
  );
}

/** Where an MCP server ran (`onToolConnection`). */
export function WhereRanBlock({ runsAt, onChange, phone }: { runsAt: "web" | "local" | null; onChange: (next: "web" | "local") => void; phone: boolean }) {
  return (
    <Block label={EDIT_BLOCK_COPY.whereRan} testId="edit-where-ran">
      <BlockHead label={EDIT_BLOCK_COPY.whereRan} />
      <SegmentedField<"web" | "local"> label={EDIT_BLOCK_COPY.whereRan} phone={phone} value={runsAt} onChange={onChange} items={[{ value: "web", label: EDIT_BLOCK_COPY.web }, { value: "local", label: EDIT_BLOCK_COPY.local }]} />
    </Block>
  );
}

/** The tools it was seen calling, with how many times: read from what was saved, never typed. */
export function ToolsUsedBlock({ toolsUsed }: { toolsUsed: readonly { name: string; count: number }[] }) {
  if (toolsUsed.length === 0) return null;
  return (
    <Block label={EDIT_BLOCK_COPY.toolsUsed} testId="edit-tools-used">
      <BlockHead label={EDIT_BLOCK_COPY.toolsUsed} count={EDIT_COPY.count(toolsUsed.length, "tool", "tools")} />
      <TagList label={EDIT_BLOCK_COPY.toolsUsed}>
        {toolsUsed.map((tool) => (
          <Tag key={tool.name}>{`${tool.name} ${tool.count}`}</Tag>
        ))}
      </TagList>
    </Block>
  );
}

/* ── a prompt's own sections: its model, how it was run, what it uses and what it makes ── */

export type PromptEditHandlers = Pick<DetailsHandlers, "onModel" | "onModelRun" | "onAddUse" | "onAttach" | "onRemoveUse" | "onAddMade" | "onRemoveMade" | "onFields">;

export const PROMPT_EDIT_COPY = {
  model: "Model",
  noSession: "No session to read the model from",
} as const;

/**
 * What the prompt window adds for a prompt the maker can change (CA-18 P2): Model (a prompt typed here names its own), How it
 * was run (a model on the maker's own computer, or with open weights), Uses, Makes and Goes into. The window saves as it goes, so
 * these call their handlers as they are used, as Details did.
 */
export function PromptEdits({ view, handlers, phone }: { view: Extract<DetailsView, { kind: "prompt" }>; handlers: PromptEditHandlers; phone: boolean }) {
  const [openModel, setOpenModel] = useState(0);
  return (
    <>
      {view.typed ? (
        <Row id={`${view.id}-model`} label={PROMPT_EDIT_COPY.model} group phone={phone}>
          <ModelPicker tool={view.tool ?? null} value={view.model} onChange={(model) => handlers.onModel(view.id, model)} phone={phone} name="Model" openSignal={openModel} anyWithoutTool field />
          {!view.model && modelMenu(harnessTool(view.tool)).state !== "hidden" && modelMenu(harnessTool(view.tool)).state !== "none" ? <Hint>{PROMPT_EDIT_COPY.noSession}</Hint> : null}
          <PairNote tool={view.tool} model={view.model} phone={phone} onChange={() => setOpenModel((n) => n + 1)} onRemove={() => handlers.onModel(view.id, null)} />
        </Row>
      ) : null}
      {view.modelRun && handlers.onModelRun ? (
        <Block label="How it was run" testId="edit-model-run">
          <ModelRunFields id={view.id} run={view.modelRun.run} hosts={view.modelRun.hosts} phone={phone} onChange={(run) => handlers.onModelRun?.(view.id, run)} />
        </Block>
      ) : null}
      <UsesBlock id={view.id} rows={view.uses} options={view.options} phone={phone} handlers={handlers} />
      <MakesBlock id={view.id} rows={view.makes} phone={phone} handlers={handlers} />
      <GoesBlock rows={view.goesInto} />
    </>
  );
}
