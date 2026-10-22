/* CA-12 P9, CA-15 P3: Add › "Result": the output this prompt produced.

   The shared modal frame (`ModalShell`, `ModalForm`), 520 wide (a `BottomSheet` below 768). It asks the output type first, a
   grid of twelve plain buttons, then the fields that type requires:

   - Link: a URL. Image or video: one or more files, up to 12. File: one file. Model: a base model or a training method.
   - Text: the text. Audio: one audio file. Deployed app or website: a URL. Data table: a CSV file, or pasted CSV.
   - Sent message: its channel (Email, Slack, Text message, Other) and the message. Change in an external app: the application
     and what changed. Metric: a value and a label. Offline outcome: a description.

   Under them the Optional section: a one-line caption for every type, a metric's unit and value before, an offline outcome's
   one photo. "Add" is the one primary and waits until the required fields are complete. A file over 25 MB, or of a kind the
   type does not take, is refused where it is chosen. Nothing here reads a file's content except a CSV's first line, for its
   column count. */

import { useId, useRef, useState } from "react";

import { Segmented } from "@/components/brand/Segmented";
import { useIsPhone } from "@/components/shell/useMinWidth";
import {
  BASE_MODEL_MAX,
  METRIC_LABEL_MAX,
  METRIC_UNIT_MAX,
  METRIC_VALUE_MAX,
  MESSAGE_CHANNELS,
  MESSAGE_CHANNEL_LABEL,
  RESULT_CAPTION_MAX,
  RESULT_CSV_MAX,
  RESULT_LINE_MAX,
  RESULT_MEDIA_MAX,
  RESULT_TEXT_MAX,
  RESULT_TYPE_LABEL,
  TRAINED_METHOD_MAX,
  resultLinkOf,
  type MessageChannel,
} from "@/lib/build/graph";
import { MEDIA_MAX_BYTES, mediaKindFor } from "@/lib/build/media";
import { csvColumns } from "@/lib/build/tileExtras";
import { toolName } from "@/lib/tools/registry";
import { t } from "@/lib/theme/tokens";

import { ChoiceGrid } from "./ChoiceGrid";
import { Field, TextButton } from "./composeControls";
import { ModalForm, ModalShell, FieldRow, FieldRows, firstMissing } from "./ModalFrame";
import { OptionalField, OptionalSection, summaryOf } from "./OptionalSection";
import { text, tnum, typedArea, typedField } from "./refinedStyles";
import { ToolPicker } from "./ToolPicker";

export const RESULT_DIALOG_COPY = {
  title: "Add a result",
  subtitle: "The output this prompt produced",
  outputType: "Output type",
  url: "URL",
  urlPlaceholder: "e.g. example.com/page",
  choosePictures: "Choose image or video",
  chooseFile: "Choose a file",
  chooseAudio: "Choose an audio file",
  chooseTable: "Choose a CSV file",
  choosePhoto: "Choose a photo",
  remove: "Remove",
  baseModel: "Base model",
  basePlaceholder: "e.g. Muse Spark Open",
  method: "Training method",
  methodPlaceholder: "e.g. Fine-tuned on 1,200 rated examples",
  text: "Text",
  textPlaceholder: "e.g. The text the prompt produced",
  audio: "Audio file",
  table: "Data table",
  tableFile: "CSV file",
  pastedCsv: "Pasted CSV",
  pastedCsvPlaceholder: "e.g. name,price\nsourdough,4.50",
  channel: "Channel",
  message: "Message",
  messagePlaceholder: "e.g. The message as it was sent",
  application: "Application",
  selectApplication: "Select an application",
  change: "What changed",
  changePlaceholder: "e.g. Opened a pull request and moved the card to Review",
  value: "Value",
  valuePlaceholder: "e.g. 42",
  label: "Label",
  labelPlaceholder: "e.g. Orders per week",
  description: "Description",
  descriptionPlaceholder: "e.g. Delivered the loaves to the market stall by hand",
  caption: "Caption",
  captionLine: "One line under the result",
  captionPlaceholder: "e.g. The launch page, live on Friday",
  unit: "Unit",
  unitLine: "What the value is counted in",
  unitPlaceholder: "e.g. %",
  before: "Value before",
  beforeLine: "The figure before the change",
  beforePlaceholder: "e.g. 31",
  photo: "Photo",
  photoLine: "One photo of the outcome",
  add: "Add",
  cancel: "Cancel",
} as const;

export type ResultKind = "link" | "pictures" | "file" | "model" | "text" | "audio" | "deployed" | "table" | "message" | "external_change" | "metric" | "offline";

export type AddResultInput = (
  | { kind: "link"; url: string }
  | { kind: "pictures"; files: File[] }
  | { kind: "file"; file: File }
  | { kind: "model"; baseModel: string; method: string }
  | { kind: "text"; text: string }
  | { kind: "audio"; file: File }
  | { kind: "deployed"; url: string }
  | { kind: "table"; file: File | null; csv: string; columns: number | null }
  | { kind: "message"; channel: MessageChannel; message: string }
  | { kind: "external_change"; application: string; change: string }
  | { kind: "metric"; value: string; label: string; unit: string; before: string }
  | { kind: "offline"; description: string; photo: File | null }
) & { caption: string };

export interface AddResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: AddResultInput) => void;
  /** The tools the build already uses, first in the application picker. */
  inBuild?: readonly string[];
}

/** The twelve output types, in the order the grid draws them. */
export const RESULT_CHOICES: readonly { value: ResultKind; label: string }[] = (["link", "pictures", "file", "model", "text", "audio", "deployed", "table", "message", "external_change", "metric", "offline"] as const).map((value) => ({ value, label: RESULT_TYPE_LABEL[value] }));

/** The first line of a file's text, for a CSV's column count; "" when it cannot be read. */
function readHead(file: File): Promise<string> {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => resolve("");
      reader.readAsText(file.slice(0, 4096));
    } catch {
      resolve("");
    }
  });
}

const ACCEPT: Partial<Record<ResultKind, string>> = { pictures: "image/*,video/*", audio: "audio/*", table: ".csv,.tsv,text/csv", offline: "image/*" };

function Form({ onAdd, onCancel, phone, inBuild = [] }: Pick<AddResultDialogProps, "onAdd" | "inBuild"> & { onCancel: () => void; phone: boolean }) {
  const [kind, setKind] = useState<ResultKind>("link");
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [base, setBase] = useState("");
  const [method, setMethod] = useState("");
  const [body, setBody] = useState("");
  const [csv, setCsv] = useState("");
  const [columns, setColumns] = useState<number | null>(null);
  const [channel, setChannel] = useState<MessageChannel | null>(null);
  const [application, setApplication] = useState<string | null>(null);
  const [change, setChange] = useState("");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [unit, setUnit] = useState("");
  const [before, setBefore] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [wrong, setWrong] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const uid = useId();

  const refuse = (file: File, kindWord: string, test: (file: File) => boolean): boolean => {
    if (file.size > MEDIA_MAX_BYTES) {
      setWrong(`${file.name} is too big. The most is 25 MB.`);
      return true;
    }
    if (!test(file)) {
      setWrong(`${file.name} is not ${kindWord}.`);
      return true;
    }
    return false;
  };

  const choose = (list: FileList | null) => {
    const given = Array.from(list ?? []);
    if (given.length === 0) return;
    const bad = given.some((file) =>
      kind === "pictures"
        ? refuse(file, "an image or a video", (f) => ["image", "video"].includes(mediaKindFor(f.type) ?? ""))
        : kind === "audio"
          ? refuse(file, "an audio file", (f) => mediaKindFor(f.type) === "audio")
          : refuse(file, "a file", () => true),
    );
    if (bad) return;
    setWrong(null);
    setFiles((now) => (kind === "pictures" ? [...now, ...given].slice(0, RESULT_MEDIA_MAX) : given.slice(0, 1)));
    if (kind === "table") void readHead(given[0]).then((head) => setColumns(csvColumns(head)));
  };

  const choosePhoto = (list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    if (refuse(file, "an image", (f) => mediaKindFor(f.type) === "image")) return;
    setWrong(null);
    setPhoto(file);
  };

  const pick = (next: ResultKind | null) => {
    if (!next) return;
    setKind(next);
    setFiles([]);
    setColumns(null);
    setWrong(null);
  };

  const missing = firstMissing(
    kind === "link" || kind === "deployed"
      ? [[resultLinkOf(url) !== null, "a URL"]]
      : kind === "pictures"
        ? [[files.length > 0, "an image or video"]]
        : kind === "file"
          ? [[files.length > 0, "a file"]]
          : kind === "model"
            ? [[base.trim().length > 0 || method.trim().length > 0, "a base model or a training method"]]
            : kind === "text"
              ? [[body.trim().length > 0, "the text"]]
              : kind === "audio"
                ? [[files.length > 0, "an audio file"]]
                : kind === "table"
                  ? [[files.length > 0 || csv.trim().length > 0, "a CSV file or pasted CSV"]]
                  : kind === "message"
                    ? [[channel !== null, "a channel"], [body.trim().length > 0, "the message"]]
                    : kind === "external_change"
                      ? [[Boolean(application), "an application"], [change.trim().length > 0, "what changed"]]
                      : kind === "metric"
                        ? [[value.trim().length > 0, "a value"], [label.trim().length > 0, "a label"]]
                        : [[body.trim().length > 0, "a description"]],
  );

  const submit = () => {
    const said = caption.trim();
    if (kind === "link") onAdd({ kind, url: url.trim(), caption: said });
    else if (kind === "deployed") onAdd({ kind, url: url.trim(), caption: said });
    else if (kind === "pictures") onAdd({ kind, files, caption: said });
    else if (kind === "file") onAdd({ kind, file: files[0], caption: said });
    else if (kind === "audio") onAdd({ kind, file: files[0], caption: said });
    else if (kind === "model") onAdd({ kind, baseModel: base.trim(), method: method.trim(), caption: said });
    else if (kind === "text") onAdd({ kind, text: body.trim(), caption: said });
    else if (kind === "table") onAdd({ kind, file: files[0] ?? null, csv: files.length > 0 ? "" : csv.trim(), columns: files.length > 0 ? columns : csvColumns(csv), caption: said });
    else if (kind === "message" && channel) onAdd({ kind, channel, message: body.trim(), caption: said });
    else if (kind === "external_change" && application) onAdd({ kind, application: toolName(application) ?? application.trim(), change: change.trim(), caption: said });
    else if (kind === "metric") onAdd({ kind, value: value.trim(), label: label.trim(), unit: unit.trim(), before: before.trim(), caption: said });
    else if (kind === "offline") onAdd({ kind, description: body.trim(), photo, caption: said });
  };

  const fileList = (list: File[], drop: (at: number) => void) =>
    list.map((file, at) => (
      <div key={`${file.name}-${at}`} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ ...text(13, 400, t.text), overflowWrap: "anywhere" }}>{file.name}</span>
        <TextButton target={phone} onClick={() => drop(at)} style={text(12, 500, t.text2)}>
          {`${RESULT_DIALOG_COPY.remove} ${file.name}`}
        </TextButton>
      </div>
    ));

  const fileInput = (name: string, multiple = false) => (
    <input
      ref={picker}
      data-testid="result-files"
      type="file"
      multiple={multiple}
      accept={ACCEPT[kind]}
      aria-label={name}
      onChange={(event) => {
        choose(event.target.files);
        event.target.value = "";
      }}
      style={{ ...text(13, 400, t.text), maxWidth: "100%" }}
    />
  );

  const counter = (used: number, max: number) => <span style={{ ...text(11.5, 400, t.text2), ...tnum, alignSelf: "flex-end" }}>{`${used} / ${max}`}</span>;

  const mono = { fontFamily: "var(--font-data)" };
  const area = (id: string, value: string, set: (v: string) => void, placeholder: string, max: number, rows: number, style = {}) => (
    <>
      <textarea id={id} rows={rows} maxLength={max} value={value} placeholder={placeholder} onChange={(event) => set(event.target.value)} style={typedArea(phone, style)} />
      {counter(value.length, max)}
    </>
  );

  return (
    <ModalForm phone={phone} onSubmit={submit} onCancel={onCancel} missing={missing}>
      <Field id={`${uid}-type`} label={RESULT_DIALOG_COPY.outputType} group>
        <ChoiceGrid bare label={RESULT_DIALOG_COPY.outputType} items={RESULT_CHOICES} value={kind} onChange={pick} phone={phone} />
      </Field>

      <FieldRows>
        {kind === "link" || kind === "deployed" ? (
          <FieldRow id={`${uid}-url`} label={RESULT_DIALOG_COPY.url} phone={phone}>
            <input id={`${uid}-url`} type="text" inputMode="url" value={url} placeholder={RESULT_DIALOG_COPY.urlPlaceholder} onChange={(event) => setUrl(event.target.value)} style={typedField(phone)} />
          </FieldRow>
        ) : null}

        {kind === "pictures" || kind === "file" || kind === "audio" ? (
          <FieldRow id={`${uid}-file`} label={kind === "pictures" ? RESULT_TYPE_LABEL.pictures : kind === "audio" ? RESULT_DIALOG_COPY.audio : RESULT_TYPE_LABEL.file} group phone={phone}>
            {fileInput(kind === "file" ? RESULT_DIALOG_COPY.chooseFile : kind === "audio" ? RESULT_DIALOG_COPY.chooseAudio : RESULT_DIALOG_COPY.choosePictures, kind === "pictures")}
            {fileList(files, (at) => setFiles((now) => now.filter((_, i) => i !== at)))}
          </FieldRow>
        ) : null}

        {kind === "model" ? (
          <>
            <FieldRow id={`${uid}-base`} label={RESULT_DIALOG_COPY.baseModel} phone={phone}>
              <input id={`${uid}-base`} type="text" maxLength={BASE_MODEL_MAX} value={base} placeholder={RESULT_DIALOG_COPY.basePlaceholder} onChange={(event) => setBase(event.target.value)} style={typedField(phone)} />
            </FieldRow>
            <FieldRow id={`${uid}-method`} label={RESULT_DIALOG_COPY.method} phone={phone}>
              <input id={`${uid}-method`} type="text" maxLength={TRAINED_METHOD_MAX} value={method} placeholder={RESULT_DIALOG_COPY.methodPlaceholder} onChange={(event) => setMethod(event.target.value)} style={typedField(phone)} />
              {counter(method.length, TRAINED_METHOD_MAX)}
            </FieldRow>
          </>
        ) : null}

        {kind === "table" ? (
          <FieldRow id={`${uid}-table`} label={RESULT_DIALOG_COPY.tableFile} group phone={phone}>
            {fileInput(RESULT_DIALOG_COPY.chooseTable)}
            {fileList(files, () => {
              setFiles([]);
              setColumns(null);
            })}
            {files.length > 0 && columns ? <span style={{ ...text(12, 400, t.label), ...tnum }}>{`${columns} columns`}</span> : null}
          </FieldRow>
        ) : null}

        {kind === "message" ? (
          <FieldRow id={`${uid}-channel`} label={RESULT_DIALOG_COPY.channel} group phone={phone}>
            <Segmented<MessageChannel>
              label={RESULT_DIALOG_COPY.channel}
              semantics="radio"
              size={phone ? 50 : 30}
              fontSize={13}
              fullWidth
              items={MESSAGE_CHANNELS.map((one) => ({ value: one, label: MESSAGE_CHANNEL_LABEL[one] }))}
              value={channel ?? ("" as MessageChannel)}
              onChange={setChannel}
            />
          </FieldRow>
        ) : null}

        {kind === "external_change" ? (
          <FieldRow id={`${uid}-app`} label={RESULT_DIALOG_COPY.application} group phone={phone}>
            <div>
              <ToolPicker label={RESULT_DIALOG_COPY.application} value={application} onChange={setApplication} inBuild={inBuild} phone={phone} step="tool" list="app" placeholder={RESULT_DIALOG_COPY.selectApplication} />
            </div>
          </FieldRow>
        ) : null}

        {kind === "metric" ? (
          <>
            <FieldRow id={`${uid}-value`} label={RESULT_DIALOG_COPY.value} phone={phone}>
              <input id={`${uid}-value`} type="text" maxLength={METRIC_VALUE_MAX} value={value} placeholder={RESULT_DIALOG_COPY.valuePlaceholder} onChange={(event) => setValue(event.target.value)} style={typedField(phone, { width: 160, ...mono, ...tnum })} />
            </FieldRow>
            <FieldRow id={`${uid}-label`} label={RESULT_DIALOG_COPY.label} phone={phone}>
              <input id={`${uid}-label`} type="text" maxLength={METRIC_LABEL_MAX} value={label} placeholder={RESULT_DIALOG_COPY.labelPlaceholder} onChange={(event) => setLabel(event.target.value)} style={typedField(phone)} />
            </FieldRow>
          </>
        ) : null}
      </FieldRows>

      {kind === "text" ? (
        <Field id={`${uid}-text`} label={RESULT_DIALOG_COPY.text}>
          {area(`${uid}-text`, body, setBody, RESULT_DIALOG_COPY.textPlaceholder, RESULT_TEXT_MAX, 6)}
        </Field>
      ) : null}

      {kind === "table" && files.length === 0 ? (
        <Field id={`${uid}-csv`} label={RESULT_DIALOG_COPY.pastedCsv}>
          {area(`${uid}-csv`, csv, setCsv, RESULT_DIALOG_COPY.pastedCsvPlaceholder, RESULT_CSV_MAX, 5, mono)}
        </Field>
      ) : null}

      {kind === "message" ? (
        <Field id={`${uid}-message`} label={RESULT_DIALOG_COPY.message}>
          {area(`${uid}-message`, body, setBody, RESULT_DIALOG_COPY.messagePlaceholder, RESULT_TEXT_MAX, 5)}
        </Field>
      ) : null}

      {kind === "external_change" ? (
        <Field id={`${uid}-change`} label={RESULT_DIALOG_COPY.change}>
          {area(`${uid}-change`, change, setChange, RESULT_DIALOG_COPY.changePlaceholder, RESULT_LINE_MAX, 3)}
        </Field>
      ) : null}

      {kind === "offline" ? (
        <Field id={`${uid}-desc`} label={RESULT_DIALOG_COPY.description}>
          {area(`${uid}-desc`, body, setBody, RESULT_DIALOG_COPY.descriptionPlaceholder, RESULT_TEXT_MAX, 4)}
        </Field>
      ) : null}

      {wrong ? (
        <span role="alert" style={text(12.5, 400, t.text2)}>
          {wrong}
        </span>
      ) : null}

      <OptionalSection>
        {kind === "metric" ? (
          <OptionalField name={RESULT_DIALOG_COPY.unit} description={RESULT_DIALOG_COPY.unitLine} summary={summaryOf(unit)} phone={phone}>
            <input aria-label={RESULT_DIALOG_COPY.unit} type="text" maxLength={METRIC_UNIT_MAX} value={unit} placeholder={RESULT_DIALOG_COPY.unitPlaceholder} onChange={(event) => setUnit(event.target.value)} style={typedField(phone, { width: 160 })} />
          </OptionalField>
        ) : null}
        {kind === "metric" ? (
          <OptionalField name={RESULT_DIALOG_COPY.before} description={RESULT_DIALOG_COPY.beforeLine} summary={summaryOf(before)} phone={phone}>
            <input aria-label={RESULT_DIALOG_COPY.before} type="text" maxLength={METRIC_VALUE_MAX} value={before} placeholder={RESULT_DIALOG_COPY.beforePlaceholder} onChange={(event) => setBefore(event.target.value)} style={typedField(phone, { width: 160, ...mono, ...tnum })} />
          </OptionalField>
        ) : null}
        {kind === "offline" ? (
          <OptionalField name={RESULT_DIALOG_COPY.photo} description={RESULT_DIALOG_COPY.photoLine} summary={photo ? photo.name : null} phone={phone}>
            <input
              data-testid="result-photo"
              type="file"
              accept="image/*"
              aria-label={RESULT_DIALOG_COPY.choosePhoto}
              onChange={(event) => {
                choosePhoto(event.target.files);
                event.target.value = "";
              }}
              style={{ ...text(13, 400, t.text), maxWidth: "100%" }}
            />
            {photo ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ ...text(13, 400, t.text), overflowWrap: "anywhere" }}>{photo.name}</span>
                <TextButton target={phone} onClick={() => setPhoto(null)} style={text(12, 500, t.text2)}>
                  {`${RESULT_DIALOG_COPY.remove} ${photo.name}`}
                </TextButton>
              </div>
            ) : null}
          </OptionalField>
        ) : null}
        <OptionalField name={RESULT_DIALOG_COPY.caption} description={RESULT_DIALOG_COPY.captionLine} summary={summaryOf(caption)} phone={phone}>
          <input aria-label={RESULT_DIALOG_COPY.caption} type="text" maxLength={RESULT_CAPTION_MAX} value={caption} placeholder={RESULT_DIALOG_COPY.captionPlaceholder} onChange={(event) => setCaption(event.target.value)} style={typedField(phone)} />
        </OptionalField>
      </OptionalSection>
    </ModalForm>
  );
}

export function AddResultDialog({ open, onOpenChange, onAdd, inBuild }: AddResultDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: AddResultInput) => {
    onAdd(input);
    close();
  };
  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title={RESULT_DIALOG_COPY.title} subtitle={RESULT_DIALOG_COPY.subtitle} width={520} testId="add-result-dialog">
      <Form onAdd={add} onCancel={close} phone={phone} inBuild={inBuild} />
    </ModalShell>
  );
}

export default AddResultDialog;
