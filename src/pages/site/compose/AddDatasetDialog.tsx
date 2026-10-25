/* CA-15 P9: Add › "Dataset": data used for training, evaluation or retrieval.

   CA-15b: built from `modalRecipes` in the boards' pattern (rows, blocks, Optional, footer), 560 wide (a `BottomSheet`
   below 768). Required: Name and Description. Visible: Use (Training,
   Fine-tuning, Evaluation, Retrieval, Testing), stored as `payload.use`.

   Optional, in this order: Format, Record count, Columns (one per line), Source, Sample records (at most 5, one per line),
   Licence and, only when Use is Retrieval, Chunking (strategy, size, overlap and the embedding model). */

import { useId, useState } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { TITLE_MAX, type DatasetInput } from "@/lib/build/graph";
import {
  DATASET_CHUNK_STRATEGY_MAX,
  DATASET_COLUMNS_MAX,
  DATASET_DESCRIPTION_MAX,
  DATASET_EMBEDDING_MAX,
  DATASET_FORMAT_MAX,
  DATASET_LICENCE_MAX,
  DATASET_SAMPLE_LINE_MAX,
  DATASET_SAMPLE_MAX,
  DATASET_SOURCE_MAX,
  DATASET_USES,
  DATASET_USE_LABEL,
  type DatasetUse,
} from "@/lib/build/sourceTiles";
import { linesOf } from "@/lib/build/tileExtras";

import { ChoiceGrid } from "./ChoiceGrid";
import { MODAL_COPY, ModalForm, ModalShell, missingLabels, type EditMode } from "./ModalFrame";
import { Block, BlockHead, FieldArea, FieldInput, Hint, Inline, MODAL_WIDTH, NARROW, Row } from "./modalRecipes";
import { OptionalField, OptionalSection, summaryOf } from "./OptionalSection";

export const DATASET_DIALOG_COPY = {
  title: "Add a dataset",
  subtitle: "Data for training, evaluation or retrieval",
  name: "Name",
  namePlaceholder: "Customer support tickets",
  description: "Description",
  descriptionPlaceholder: "1,200 anonymised support tickets from 2025, labelled by team",
  use: "Use",
  format: "Format",
  formatPlaceholder: "CSV",
  records: "Record count",
  recordsPlaceholder: "1200",
  columns: "Columns",
  columnsLine: "One per line",
  columnsPlaceholder: "ticket_id\nsubject\nteam",
  source: "Source",
  sourcePlaceholder: "Exported from the helpdesk",
  sample: "Sample records",
  sampleLine: "5 max, one per line",
  samplePlaceholder: "4821, Charged twice, billing",
  licence: "Licence",
  licencePlaceholder: "CC BY 4.0",
  chunking: "Chunking",
  chunkingLine: "Split method and embedding model",
  strategy: "Chunk strategy",
  strategyPlaceholder: "By paragraph",
  size: "Chunk size",
  overlap: "Chunk overlap",
  embedding: "Embedding model",
  embeddingPlaceholder: "text-embedding-3-small",
  add: "Add",
  cancel: "Cancel",
} as const;

export type AddDatasetInput = Omit<DatasetInput, "session">;

/** CA-18: what the form starts with on a dataset that is there (counts as typed). */
export interface DatasetCurrent {
  name: string;
  description: string;
  use: DatasetUse | null;
  format: string;
  records: string;
  columns: string[];
  source: string;
  sample: string[];
  licence: string;
  strategy: string;
  size: string;
  overlap: string;
  embedding: string;
}

export interface AddDatasetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd?: (input: AddDatasetInput) => void;
  current?: DatasetCurrent | null;
  edit?: EditMode<AddDatasetInput>;
}

/** A count as typed: digits only. */
const digits = (raw: string): string => raw.replace(/[^0-9]/g, "");

function Form({ onAdd, onCancel, phone, current, edit }: Pick<AddDatasetDialogProps, "onAdd" | "current" | "edit"> & { onCancel: () => void; phone: boolean }) {
  const [name, setName] = useState(current?.name ?? "");
  const [description, setDescription] = useState(current?.description ?? "");
  const [use, setUse] = useState<DatasetUse | null>(current?.use ?? null);
  const [format, setFormat] = useState(current?.format ?? "");
  const [records, setRecords] = useState(current?.records ?? "");
  const [columns, setColumns] = useState((current?.columns ?? []).join("\n"));
  const [source, setSource] = useState(current?.source ?? "");
  const [sample, setSample] = useState((current?.sample ?? []).join("\n"));
  const [licence, setLicence] = useState(current?.licence ?? "");
  const [strategy, setStrategy] = useState(current?.strategy ?? "");
  const [size, setSize] = useState(current?.size ?? "");
  const [overlap, setOverlap] = useState(current?.overlap ?? "");
  const [embedding, setEmbedding] = useState(current?.embedding ?? "");
  const uid = useId();
  const retrieval = use === "retrieval";
  const columnLines = linesOf(columns);
  const sampleLines = linesOf(sample);
  const tooMany = sampleLines.length > DATASET_SAMPLE_MAX ? `Sample records: ${DATASET_SAMPLE_MAX} max, one per line` : columnLines.length > DATASET_COLUMNS_MAX ? `Columns: ${DATASET_COLUMNS_MAX} max, one per line` : null;
  const missing = missingLabels([
    [name.trim().length > 0, "Name"],
    [description.trim().length > 0, "Description"],
  ]);

  const submit = () =>
    (edit ? edit.onSave : (onAdd ?? (() => undefined)))({
      name: name.trim(),
      description: description.trim(),
      use,
      ...(format.trim() ? { format: format.trim() } : null),
      ...(records ? { recordCount: records } : null),
      ...(columnLines.length ? { columns: columnLines } : null),
      ...(source.trim() ? { source: source.trim() } : null),
      ...(sampleLines.length ? { sample: sampleLines } : null),
      ...(licence.trim() ? { licence: licence.trim() } : null),
      ...(retrieval && strategy.trim() ? { chunkStrategy: strategy.trim() } : null),
      ...(retrieval && size ? { chunkSize: size } : null),
      ...(retrieval && overlap ? { chunkOverlap: overlap } : null),
      ...(retrieval && embedding.trim() ? { embeddingModel: embedding.trim() } : null),
    });

  return (
    <ModalForm phone={phone} onSubmit={submit} onCancel={onCancel} missing={missing} blocked={Boolean(tooMany)} alert={tooMany} addLabel={edit ? MODAL_COPY.save : undefined}>
      <Row id={`${uid}-name`} label={DATASET_DIALOG_COPY.name} noRule phone={phone}>
        <FieldInput phone={phone} id={`${uid}-name`} value={name} maxLength={TITLE_MAX} placeholder={DATASET_DIALOG_COPY.namePlaceholder} onChange={(event) => setName(event.target.value)} />
      </Row>

      <Block>
        <BlockHead label={DATASET_DIALOG_COPY.description} htmlFor={`${uid}-description`} count={`${description.length} / ${DATASET_DESCRIPTION_MAX}`} />
        <FieldArea phone={phone} id={`${uid}-description`} rows={3} maxLength={DATASET_DESCRIPTION_MAX} value={description} placeholder={DATASET_DIALOG_COPY.descriptionPlaceholder} onChange={(event) => setDescription(event.target.value)} />
      </Block>

      <Block label={DATASET_DIALOG_COPY.use}>
        <BlockHead label={DATASET_DIALOG_COPY.use} />
        <ChoiceGrid<DatasetUse> bare label={DATASET_DIALOG_COPY.use} items={DATASET_USES.map((value) => ({ value, label: DATASET_USE_LABEL[value] }))} value={use} onChange={setUse} phone={phone} allowClear />
      </Block>

      <OptionalSection>
        <OptionalField name={DATASET_DIALOG_COPY.format} summary={summaryOf(format)} phone={phone}>
          <FieldInput phone={phone} width={NARROW.version} aria-label={DATASET_DIALOG_COPY.format} maxLength={DATASET_FORMAT_MAX} value={format} placeholder={DATASET_DIALOG_COPY.formatPlaceholder} onChange={(event) => setFormat(event.target.value)} />
        </OptionalField>

        <OptionalField name={DATASET_DIALOG_COPY.records} summary={summaryOf(records ? Number(records).toLocaleString("en-GB") : null)} phone={phone}>
          <FieldInput phone={phone} mono width={NARROW.value} aria-label={DATASET_DIALOG_COPY.records} inputMode="numeric" maxLength={12} value={records} placeholder={DATASET_DIALOG_COPY.recordsPlaceholder} onChange={(event) => setRecords(digits(event.target.value))} />
        </OptionalField>

        <OptionalField name={DATASET_DIALOG_COPY.columns} description={DATASET_DIALOG_COPY.columnsLine} summary={summaryOf(columnLines)} phone={phone}>
          <FieldArea phone={phone} rows={4} mono aria-label={DATASET_DIALOG_COPY.columns} value={columns} placeholder={DATASET_DIALOG_COPY.columnsPlaceholder} onChange={(event) => setColumns(event.target.value)} />
        </OptionalField>

        <OptionalField name={DATASET_DIALOG_COPY.source} summary={summaryOf(source)} phone={phone}>
          <FieldInput phone={phone} aria-label={DATASET_DIALOG_COPY.source} maxLength={DATASET_SOURCE_MAX} value={source} placeholder={DATASET_DIALOG_COPY.sourcePlaceholder} onChange={(event) => setSource(event.target.value)} />
        </OptionalField>

        <OptionalField name={DATASET_DIALOG_COPY.sample} description={DATASET_DIALOG_COPY.sampleLine} summary={summaryOf(sampleLines)} phone={phone}>
          <FieldArea phone={phone} rows={5} mono aria-label={DATASET_DIALOG_COPY.sample} value={sample} placeholder={DATASET_DIALOG_COPY.samplePlaceholder} onChange={(event) => setSample(event.target.value)} />
          <Hint>{`Each record: ${DATASET_SAMPLE_LINE_MAX} characters max`}</Hint>
        </OptionalField>

        <OptionalField name={DATASET_DIALOG_COPY.licence} summary={summaryOf(licence)} phone={phone}>
          <FieldInput phone={phone} aria-label={DATASET_DIALOG_COPY.licence} maxLength={DATASET_LICENCE_MAX} value={licence} placeholder={DATASET_DIALOG_COPY.licencePlaceholder} onChange={(event) => setLicence(event.target.value)} />
        </OptionalField>

        {retrieval ? (
          <OptionalField name={DATASET_DIALOG_COPY.chunking} description={DATASET_DIALOG_COPY.chunkingLine} summary={summaryOf(strategy, size ? `size ${size}` : null, overlap ? `overlap ${overlap}` : null, embedding)} phone={phone}>
            <FieldInput phone={phone} aria-label={DATASET_DIALOG_COPY.strategy} maxLength={DATASET_CHUNK_STRATEGY_MAX} value={strategy} placeholder={DATASET_DIALOG_COPY.strategyPlaceholder} onChange={(event) => setStrategy(event.target.value)} />
            <Inline>
              <FieldInput phone={phone} mono width={NARROW.date} aria-label={DATASET_DIALOG_COPY.size} inputMode="numeric" maxLength={7} value={size} placeholder="512" onChange={(event) => setSize(digits(event.target.value))} />
              <FieldInput phone={phone} mono width={NARROW.date} aria-label={DATASET_DIALOG_COPY.overlap} inputMode="numeric" maxLength={7} value={overlap} placeholder="64" onChange={(event) => setOverlap(digits(event.target.value))} />
            </Inline>
            <FieldInput phone={phone} aria-label={DATASET_DIALOG_COPY.embedding} maxLength={DATASET_EMBEDDING_MAX} value={embedding} placeholder={DATASET_DIALOG_COPY.embeddingPlaceholder} onChange={(event) => setEmbedding(event.target.value)} />
          </OptionalField>
        ) : null}
      </OptionalSection>
      {edit?.after ? edit.after({ name, description, use }) : null}
    </ModalForm>
  );
}

export function AddDatasetDialog({ open, onOpenChange, onAdd, current, edit }: AddDatasetDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: AddDatasetInput) => {
    onAdd?.(input);
    close();
  };
  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title={edit ? edit.title : DATASET_DIALOG_COPY.title} eyebrow={edit ? MODAL_COPY.edit : undefined} subtitle={DATASET_DIALOG_COPY.subtitle} width={MODAL_WIDTH.standard} testId={edit ? "edit-dataset-dialog" : "add-dataset-dialog"}>
      <Form onAdd={add} onCancel={close} phone={phone} current={current} edit={edit && { ...edit, onSave: (input) => { edit.onSave(input); close(); } }} />
    </ModalShell>
  );
}

export default AddDatasetDialog;
