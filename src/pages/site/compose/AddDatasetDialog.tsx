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
import { ModalForm, ModalShell, firstMissing } from "./ModalFrame";
import { Block, BlockHead, FieldArea, FieldInput, Hint, Inline, MODAL_WIDTH, NARROW, Row } from "./modalRecipes";
import { OptionalField, OptionalSection, summaryOf } from "./OptionalSection";

export const DATASET_DIALOG_COPY = {
  title: "Add a dataset",
  subtitle: "Data used for training, evaluation or retrieval",
  name: "Name",
  namePlaceholder: "e.g. Customer support tickets",
  description: "Description",
  descriptionPlaceholder: "e.g. 1,200 anonymised support tickets from 2025, labelled by team",
  use: "Use",
  format: "Format",
  formatLine: "The file or data format",
  formatPlaceholder: "e.g. CSV",
  records: "Record count",
  recordsLine: "How many records it holds",
  recordsPlaceholder: "e.g. 1200",
  columns: "Columns",
  columnsLine: "One column name per line",
  columnsPlaceholder: "e.g. ticket_id\nsubject\nteam",
  source: "Source",
  sourceLine: "Where the data came from",
  sourcePlaceholder: "e.g. Exported from the helpdesk",
  sample: "Sample records",
  sampleLine: "Up to five records, one per line",
  samplePlaceholder: "e.g. 4821, Charged twice, billing",
  licence: "Licence",
  licenceLine: "The terms it may be used under",
  licencePlaceholder: "e.g. CC BY 4.0",
  chunking: "Chunking",
  chunkingLine: "How it was split for retrieval, and the embedding model",
  strategy: "Chunk strategy",
  strategyPlaceholder: "e.g. By paragraph",
  size: "Chunk size",
  overlap: "Chunk overlap",
  embedding: "Embedding model",
  embeddingPlaceholder: "e.g. text-embedding-3-small",
  add: "Add",
  cancel: "Cancel",
} as const;

export type AddDatasetInput = Omit<DatasetInput, "session">;

export interface AddDatasetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: AddDatasetInput) => void;
}

/** A count as typed: digits only. */
const digits = (raw: string): string => raw.replace(/[^0-9]/g, "");

function Form({ onAdd, onCancel, phone }: Pick<AddDatasetDialogProps, "onAdd"> & { onCancel: () => void; phone: boolean }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [use, setUse] = useState<DatasetUse | null>(null);
  const [format, setFormat] = useState("");
  const [records, setRecords] = useState("");
  const [columns, setColumns] = useState("");
  const [source, setSource] = useState("");
  const [sample, setSample] = useState("");
  const [licence, setLicence] = useState("");
  const [strategy, setStrategy] = useState("");
  const [size, setSize] = useState("");
  const [overlap, setOverlap] = useState("");
  const [embedding, setEmbedding] = useState("");
  const uid = useId();
  const retrieval = use === "retrieval";
  const columnLines = linesOf(columns);
  const sampleLines = linesOf(sample);
  const tooMany = sampleLines.length > DATASET_SAMPLE_MAX ? `Sample records are at most ${DATASET_SAMPLE_MAX}, one per line.` : columnLines.length > DATASET_COLUMNS_MAX ? `Columns are at most ${DATASET_COLUMNS_MAX}, one per line.` : null;
  const missing = firstMissing([
    [name.trim().length > 0, "a name"],
    [description.trim().length > 0, "a description"],
  ]);

  const submit = () =>
    onAdd({
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
    <ModalForm phone={phone} onSubmit={submit} onCancel={onCancel} missing={missing} blocked={Boolean(tooMany)} alert={tooMany}>
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
        <OptionalField name={DATASET_DIALOG_COPY.format} description={DATASET_DIALOG_COPY.formatLine} summary={summaryOf(format)} phone={phone}>
          <FieldInput phone={phone} width={NARROW.version} aria-label={DATASET_DIALOG_COPY.format} maxLength={DATASET_FORMAT_MAX} value={format} placeholder={DATASET_DIALOG_COPY.formatPlaceholder} onChange={(event) => setFormat(event.target.value)} />
        </OptionalField>

        <OptionalField name={DATASET_DIALOG_COPY.records} description={DATASET_DIALOG_COPY.recordsLine} summary={summaryOf(records ? Number(records).toLocaleString("en-GB") : null)} phone={phone}>
          <FieldInput phone={phone} mono width={NARROW.value} aria-label={DATASET_DIALOG_COPY.records} inputMode="numeric" maxLength={12} value={records} placeholder={DATASET_DIALOG_COPY.recordsPlaceholder} onChange={(event) => setRecords(digits(event.target.value))} />
        </OptionalField>

        <OptionalField name={DATASET_DIALOG_COPY.columns} description={DATASET_DIALOG_COPY.columnsLine} summary={summaryOf(columnLines)} phone={phone}>
          <FieldArea phone={phone} rows={4} mono aria-label={DATASET_DIALOG_COPY.columns} value={columns} placeholder={DATASET_DIALOG_COPY.columnsPlaceholder} onChange={(event) => setColumns(event.target.value)} />
        </OptionalField>

        <OptionalField name={DATASET_DIALOG_COPY.source} description={DATASET_DIALOG_COPY.sourceLine} summary={summaryOf(source)} phone={phone}>
          <FieldInput phone={phone} aria-label={DATASET_DIALOG_COPY.source} maxLength={DATASET_SOURCE_MAX} value={source} placeholder={DATASET_DIALOG_COPY.sourcePlaceholder} onChange={(event) => setSource(event.target.value)} />
        </OptionalField>

        <OptionalField name={DATASET_DIALOG_COPY.sample} description={DATASET_DIALOG_COPY.sampleLine} summary={summaryOf(sampleLines)} phone={phone}>
          <FieldArea phone={phone} rows={5} mono aria-label={DATASET_DIALOG_COPY.sample} value={sample} placeholder={DATASET_DIALOG_COPY.samplePlaceholder} onChange={(event) => setSample(event.target.value)} />
          <Hint>{`${sampleLines.length} of ${DATASET_SAMPLE_MAX} records. Each is at most ${DATASET_SAMPLE_LINE_MAX} characters.`}</Hint>
        </OptionalField>

        <OptionalField name={DATASET_DIALOG_COPY.licence} description={DATASET_DIALOG_COPY.licenceLine} summary={summaryOf(licence)} phone={phone}>
          <FieldInput phone={phone} aria-label={DATASET_DIALOG_COPY.licence} maxLength={DATASET_LICENCE_MAX} value={licence} placeholder={DATASET_DIALOG_COPY.licencePlaceholder} onChange={(event) => setLicence(event.target.value)} />
        </OptionalField>

        {retrieval ? (
          <OptionalField name={DATASET_DIALOG_COPY.chunking} description={DATASET_DIALOG_COPY.chunkingLine} summary={summaryOf(strategy, size ? `size ${size}` : null, overlap ? `overlap ${overlap}` : null, embedding)} phone={phone}>
            <FieldInput phone={phone} aria-label={DATASET_DIALOG_COPY.strategy} maxLength={DATASET_CHUNK_STRATEGY_MAX} value={strategy} placeholder={DATASET_DIALOG_COPY.strategyPlaceholder} onChange={(event) => setStrategy(event.target.value)} />
            <Inline>
              <FieldInput phone={phone} mono width={NARROW.date} aria-label={DATASET_DIALOG_COPY.size} inputMode="numeric" maxLength={7} value={size} placeholder="e.g. 512" onChange={(event) => setSize(digits(event.target.value))} />
              <FieldInput phone={phone} mono width={NARROW.date} aria-label={DATASET_DIALOG_COPY.overlap} inputMode="numeric" maxLength={7} value={overlap} placeholder="e.g. 64" onChange={(event) => setOverlap(digits(event.target.value))} />
            </Inline>
            <FieldInput phone={phone} aria-label={DATASET_DIALOG_COPY.embedding} maxLength={DATASET_EMBEDDING_MAX} value={embedding} placeholder={DATASET_DIALOG_COPY.embeddingPlaceholder} onChange={(event) => setEmbedding(event.target.value)} />
          </OptionalField>
        ) : null}
      </OptionalSection>
    </ModalForm>
  );
}

export function AddDatasetDialog({ open, onOpenChange, onAdd }: AddDatasetDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: AddDatasetInput) => {
    onAdd(input);
    close();
  };
  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title={DATASET_DIALOG_COPY.title} subtitle={DATASET_DIALOG_COPY.subtitle} width={MODAL_WIDTH.standard} testId="add-dataset-dialog">
      <Form onAdd={add} onCancel={close} phone={phone} />
    </ModalShell>
  );
}

export default AddDatasetDialog;
