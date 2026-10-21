/* CA-12 P9 — Add › "Result": what is the result?

   A Radix dialog, 420 wide (a `BottomSheet` below 768). It asks what the result is, then the matching field:
   - A link: a web address.
   - Pictures or video: one or more files, up to 12.
   - A file: one file.
   - A model: what it is based on, and how it was trained.
   "Add" is the one primary and waits until the field is filled. A file over 25 MB, or of a kind that is not a picture or
   video for the first, is refused where it is chosen. */

import * as Dialog from "@radix-ui/react-dialog";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/brand/Button";
import { Segmented } from "@/components/brand/Segmented";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { BASE_MODEL_MAX, RESULT_MEDIA_MAX, TRAINED_METHOD_MAX, resultLinkOf } from "@/lib/build/graph";
import { MEDIA_MAX_BYTES, mediaKindFor } from "@/lib/build/media";
import { t } from "@/lib/theme/tokens";

import { Field, TextButton } from "./composeControls";
import { dialogTitle, text, tnum, typedField, windowStyle } from "./refinedStyles";

export const RESULT_DIALOG_COPY = {
  title: "Add a result",
  what: "What is the result?",
  link: "A link",
  pictures: "Pictures or video",
  file: "A file",
  model: "A model",
  address: "Web address",
  addressPlaceholder: "example.com/page",
  choosePictures: "Choose pictures or video",
  chooseFile: "Choose a file",
  remove: "Remove",
  base: "Based on",
  basePlaceholder: "Muse Spark Open",
  method: "How it was trained",
  methodPlaceholder: "Fine-tuned on 1,200 rated examples",
  add: "Add",
  cancel: "Cancel",
} as const;

export type ResultKind = "link" | "pictures" | "file" | "model";

export type AddResultInput =
  | { kind: "link"; url: string }
  | { kind: "pictures"; files: File[] }
  | { kind: "file"; file: File }
  | { kind: "model"; baseModel: string; method: string };

export interface AddResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: AddResultInput) => void;
}

const CHOICES: readonly { value: ResultKind; label: string }[] = [
  { value: "link", label: RESULT_DIALOG_COPY.link },
  { value: "pictures", label: RESULT_DIALOG_COPY.pictures },
  { value: "file", label: RESULT_DIALOG_COPY.file },
  { value: "model", label: RESULT_DIALOG_COPY.model },
];

function Form({ onAdd, onCancel, phone }: Pick<AddResultDialogProps, "onAdd"> & { onCancel: () => void; phone: boolean }) {
  const [kind, setKind] = useState<ResultKind>("link");
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [base, setBase] = useState("");
  const [method, setMethod] = useState("");
  const [wrong, setWrong] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const uid = useId();

  const choose = (list: FileList | null) => {
    const given = Array.from(list ?? []);
    if (given.length === 0) return;
    const bad = given.find((file) => (kind === "pictures" && !["image", "video"].includes(mediaKindFor(file.type) ?? "")) || file.size > MEDIA_MAX_BYTES);
    if (bad) {
      setWrong(bad.size > MEDIA_MAX_BYTES ? `${bad.name} is too big. The most is 25 MB.` : `${bad.name} is not a picture or a video.`);
      return;
    }
    setWrong(null);
    setFiles((now) => (kind === "file" ? given.slice(0, 1) : [...now, ...given].slice(0, RESULT_MEDIA_MAX)));
  };

  const ready = kind === "link" ? resultLinkOf(url) !== null : kind === "model" ? base.trim().length > 0 || method.trim().length > 0 : files.length > 0;
  const submit = () => {
    if (!ready) return;
    if (kind === "link") onAdd({ kind, url: url.trim() });
    else if (kind === "pictures") onAdd({ kind, files });
    else if (kind === "file") onAdd({ kind, file: files[0] });
    else onAdd({ kind, baseModel: base.trim(), method: method.trim() });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: phone ? 16 : 13 }}
    >
      <Field id={`${uid}-what`} label={RESULT_DIALOG_COPY.what} group>
        <div>
          <Segmented
            label={RESULT_DIALOG_COPY.what}
            size={phone ? 50 : 32}
            fontSize={13}
            items={CHOICES.map((choice) => ({ value: choice.value, label: choice.label }))}
            value={kind}
            onChange={(next) => {
              setKind(next);
              setFiles([]);
              setWrong(null);
            }}
          />
        </div>
      </Field>

      {kind === "link" ? (
        <Field id={`${uid}-url`} label={RESULT_DIALOG_COPY.address}>
          <input id={`${uid}-url`} type="text" inputMode="url" value={url} placeholder={RESULT_DIALOG_COPY.addressPlaceholder} onChange={(event) => setUrl(event.target.value)} style={typedField(phone)} />
        </Field>
      ) : null}

      {kind === "pictures" || kind === "file" ? (
        <Field id={`${uid}-file`} label={kind === "file" ? RESULT_DIALOG_COPY.file : RESULT_DIALOG_COPY.pictures} group>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
            <input
              ref={picker}
              data-testid="result-files"
              type="file"
              multiple={kind === "pictures"}
              accept={kind === "pictures" ? "image/*,video/*" : undefined}
              aria-label={kind === "file" ? RESULT_DIALOG_COPY.chooseFile : RESULT_DIALOG_COPY.choosePictures}
              onChange={(event) => {
                choose(event.target.files);
                event.target.value = "";
              }}
              style={{ ...text(13, 400, t.text), maxWidth: "100%" }}
            />
            {files.map((file, at) => (
              <div key={`${file.name}-${at}`} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ ...text(13, 400, t.text), overflowWrap: "anywhere" }}>{file.name}</span>
                <TextButton target={phone} onClick={() => setFiles((now) => now.filter((_, i) => i !== at))} style={text(12, 500, t.text2)}>
                  {`${RESULT_DIALOG_COPY.remove} ${file.name}`}
                </TextButton>
              </div>
            ))}
            {wrong ? (
              <span role="alert" style={text(12.5, 400, t.text2)}>
                {wrong}
              </span>
            ) : null}
          </div>
        </Field>
      ) : null}

      {kind === "model" ? (
        <>
          <Field id={`${uid}-base`} label={RESULT_DIALOG_COPY.base}>
            <input id={`${uid}-base`} type="text" maxLength={BASE_MODEL_MAX} value={base} placeholder={RESULT_DIALOG_COPY.basePlaceholder} onChange={(event) => setBase(event.target.value)} style={typedField(phone)} />
          </Field>
          <Field id={`${uid}-method`} label={RESULT_DIALOG_COPY.method} hint="Optional">
            <input id={`${uid}-method`} type="text" maxLength={TRAINED_METHOD_MAX} value={method} placeholder={RESULT_DIALOG_COPY.methodPlaceholder} onChange={(event) => setMethod(event.target.value)} style={typedField(phone)} />
            <span style={{ ...text(11.5, 400, t.text2), ...tnum, alignSelf: "flex-end" }}>
              {method.length} / {TRAINED_METHOD_MAX}
            </span>
          </Field>
        </>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="secondary" size={phone ? 44 : 36} onClick={onCancel}>
          {RESULT_DIALOG_COPY.cancel}
        </Button>
        <Button variant="primary" size={phone ? 44 : 36} type="submit" disabled={!ready}>
          {RESULT_DIALOG_COPY.add}
        </Button>
      </div>
    </form>
  );
}

export function AddResultDialog({ open, onOpenChange, onAdd }: AddResultDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: AddResultInput) => {
    onAdd(input);
    close();
  };

  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title={RESULT_DIALOG_COPY.title}>
        {open ? <Form onAdd={add} onCancel={close} phone /> : null}
      </BottomSheet>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 50 }} />
        <Dialog.Content aria-describedby={undefined} data-testid="add-result-dialog" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 51, ...windowStyle(420) }}>
          <Dialog.Title style={dialogTitle}>{RESULT_DIALOG_COPY.title}</Dialog.Title>
          <Form onAdd={add} onCancel={close} phone={false} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default AddResultDialog;
