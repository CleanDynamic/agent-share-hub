/* SV-29 P2: Add › "Retrieval": finds candidates by similarity search.

   Built from `modalRecipes` as the Dataset window is (rows, blocks, Optional on demand), 560 wide (a `BottomSheet` below 768). Its own
   chunk: the composer loads it when it first opens. Visible: What's indexed, Embedding model and Vector index. Optional: Items
   indexed, Query built from, Results returned (top-k), Recall@k (up to 6 figures, each from the run or the maker's), Also keyword
   search. It never runs anything. */

import { useId, useState } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { TITLE_MAX, type RetrievalInput } from "@/lib/build/graph";
import type { FigureSource } from "@/lib/build/pipelineFields";
import { CORPUS_MAX, EMBEDDING_MODEL_MAX, INDEX_MAX, QUERY_MAX, RECALL_MAX, RETRIEVAL_COPY, RETRIEVAL_K_MAX, RETRIEVAL_K_MIN, retrievalRefusal } from "@/lib/build/retrieval";
import { toolFor } from "@/lib/tools/registry";

import { MODAL_COPY, ModalForm, ModalShell, missingLabels, type EditMode } from "./ModalFrame";
import { FieldInput, Hint, Inline, LabelText, MODAL_WIDTH, NARROW, RecipeButton, Row, SegmentedField, TextLink } from "./modalRecipes";
import { OptionalField, OptionalSection, summaryOf } from "./OptionalSection";

export const RETRIEVAL_DIALOG_COPY = {
  title: RETRIEVAL_COPY.title,
  subtitle: RETRIEVAL_COPY.subtitle,
  name: "Name",
  namePlaceholder: "Search the categories",
  corpusPlaceholder: "categories",
  embeddingPlaceholder: "text-embedding-3-small",
  indexPlaceholder: "pgvector",
  queryPlaceholder: "The product's title and description",
  addRecall: "Add a Recall@k figure",
  recallK: "k",
  recallValue: "Recall, percent",
  add: "Add",
} as const;

export type AddRetrievalInput = Omit<RetrievalInput, "session">;

/** What the form starts with on a tile that is there (counts as typed). */
export interface RetrievalCurrent {
  name: string;
  embeddingModel: string;
  index: string;
  corpus: string;
  corpusSize: string;
  query: string;
  k: string;
  recall: { k: string; percent: string; source: FigureSource }[];
  hybrid: boolean;
}

export interface AddRetrievalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd?: (input: AddRetrievalInput) => void;
  current?: RetrievalCurrent | null;
  edit?: EditMode<AddRetrievalInput>;
}

const digits = (raw: string): string => raw.replace(/[^0-9]/g, "");
const decimal = (raw: string): string => raw.replace(/[^0-9.]/g, "");

function Form({ onAdd, onCancel, phone, current, edit }: Pick<AddRetrievalDialogProps, "onAdd" | "current" | "edit"> & { onCancel: () => void; phone: boolean }) {
  const [name, setName] = useState(current?.name ?? "");
  const [embedding, setEmbedding] = useState(current?.embeddingModel ?? "");
  const [index, setIndex] = useState(current?.index ?? "");
  const [corpus, setCorpus] = useState(current?.corpus ?? "");
  const [size, setSize] = useState(current?.corpusSize ?? "");
  const [query, setQuery] = useState(current?.query ?? "");
  const [k, setK] = useState(current?.k ?? "");
  const [recall, setRecall] = useState(current?.recall ?? []);
  const [hybrid, setHybrid] = useState(current?.hybrid ?? false);
  const [error, setError] = useState<string | null>(null);
  const uid = useId();
  const missing = missingLabels([[corpus.trim().length > 0, RETRIEVAL_COPY.corpus]]);

  const submit = () => {
    const points = recall.filter((row) => row.k.trim() || row.percent.trim());
    const made: AddRetrievalInput = {
      ...(name.trim() ? { name: name.trim() } : null),
      ...(embedding.trim() ? { embeddingModel: embedding.trim() } : null),
      ...(index.trim() ? { index: toolFor(index.trim())?.id ?? index.trim() } : null),
      corpus: corpus.trim(),
      ...(size ? { corpusSize: Number(size) } : null),
      ...(query.trim() ? { query: query.trim() } : null),
      ...(k ? { k: Number(k) } : null),
      ...(points.length > 0 ? { recall: points.map((row) => ({ k: Number(row.k), value: Number(row.percent) / 100, source: row.source })) } : null),
      ...(hybrid ? { hybrid: true } : null),
    };
    const why = retrievalRefusal(made);
    if (why) {
      setError(why);
      return;
    }
    (edit ? edit.onSave : (onAdd ?? (() => undefined)))(made);
  };
  const setRow = (at: number, patch: Partial<RetrievalCurrent["recall"][number]>) => {
    setRecall(recall.map((row, i) => (i === at ? { ...row, ...patch } : row)));
    setError(null);
  };

  return (
    <ModalForm phone={phone} onSubmit={submit} onCancel={onCancel} missing={missing} alert={error} addLabel={edit ? MODAL_COPY.save : undefined}>
      <Row id={`${uid}-corpus`} label={RETRIEVAL_COPY.corpus} noRule phone={phone}>
        <FieldInput phone={phone} id={`${uid}-corpus`} value={corpus} maxLength={CORPUS_MAX} placeholder={RETRIEVAL_DIALOG_COPY.corpusPlaceholder} onChange={(event) => setCorpus(event.target.value)} />
      </Row>
      <Row id={`${uid}-embedding`} label={RETRIEVAL_COPY.embeddingModel} phone={phone}>
        <FieldInput phone={phone} mono id={`${uid}-embedding`} value={embedding} maxLength={EMBEDDING_MODEL_MAX} placeholder={RETRIEVAL_DIALOG_COPY.embeddingPlaceholder} onChange={(event) => setEmbedding(event.target.value)} />
      </Row>
      <Row id={`${uid}-index`} label={RETRIEVAL_COPY.index} phone={phone}>
        <FieldInput phone={phone} id={`${uid}-index`} value={index} maxLength={INDEX_MAX} placeholder={RETRIEVAL_DIALOG_COPY.indexPlaceholder} onChange={(event) => setIndex(event.target.value)} />
      </Row>

      <OptionalSection>
        <OptionalField name={RETRIEVAL_DIALOG_COPY.name} summary={summaryOf(name)} phone={phone}>
          <FieldInput phone={phone} aria-label={RETRIEVAL_DIALOG_COPY.name} maxLength={TITLE_MAX} value={name} placeholder={RETRIEVAL_DIALOG_COPY.namePlaceholder} onChange={(event) => setName(event.target.value)} />
        </OptionalField>
        <OptionalField name={RETRIEVAL_COPY.corpusSize} summary={summaryOf(size ? Number(size).toLocaleString("en-GB") : null)} phone={phone}>
          <FieldInput phone={phone} mono width={NARROW.value} aria-label={RETRIEVAL_COPY.corpusSize} inputMode="numeric" maxLength={12} value={size} placeholder="6000" onChange={(event) => setSize(digits(event.target.value))} />
        </OptionalField>
        <OptionalField name={RETRIEVAL_COPY.query} summary={summaryOf(query)} phone={phone}>
          <FieldInput phone={phone} aria-label={RETRIEVAL_COPY.query} maxLength={QUERY_MAX} value={query} placeholder={RETRIEVAL_DIALOG_COPY.queryPlaceholder} onChange={(event) => setQuery(event.target.value)} />
        </OptionalField>
        <OptionalField name={RETRIEVAL_COPY.k} description={`${RETRIEVAL_K_MIN} to ${RETRIEVAL_K_MAX.toLocaleString("en-GB")}`} summary={summaryOf(k ? `top ${k}` : null)} phone={phone}>
          <FieldInput phone={phone} mono width={NARROW.date} aria-label={RETRIEVAL_COPY.k} inputMode="numeric" maxLength={4} value={k} placeholder="30" onChange={(event) => setK(digits(event.target.value))} />
        </OptionalField>
        <OptionalField name={RETRIEVAL_COPY.recall} description={`Share of test items whose answer is in the top k. ${RECALL_MAX} figures max`} summary={summaryOf(recall.filter((row) => row.k && row.percent).map((row) => `@${row.k} ${row.percent}%`))} phone={phone}>
          {recall.map((row, at) => (
            <div key={at} role="group" aria-label={`Recall figure ${at + 1}`} data-testid="recall-row">
              <Inline>
                <LabelText>Recall@</LabelText>
                <FieldInput phone={phone} mono width={NARROW.date} aria-label={`${RETRIEVAL_DIALOG_COPY.recallK} of figure ${at + 1}`} inputMode="numeric" maxLength={4} value={row.k} placeholder="30" onChange={(event) => setRow(at, { k: digits(event.target.value) })} />
                <FieldInput phone={phone} mono width={NARROW.date} aria-label={`${RETRIEVAL_DIALOG_COPY.recallValue} of figure ${at + 1}`} inputMode="decimal" maxLength={5} value={row.percent} placeholder="99.2" onChange={(event) => setRow(at, { percent: decimal(event.target.value) })} />
                <LabelText>%</LabelText>
                <SegmentedField<"run" | "maker"> label={`Where figure ${at + 1} came from`} phone={phone} items={[{ value: "run", label: "From the run" }, { value: "maker", label: "Maker's figure" }]} value={row.source === "run" ? "run" : "maker"} onChange={(source) => setRow(at, { source })} />
                <TextLink phone={phone} aria-label={`Remove figure ${at + 1}`} onClick={() => setRecall(recall.filter((_, i) => i !== at))}>
                  Remove
                </TextLink>
              </Inline>
            </div>
          ))}
          <Inline>
            <RecipeButton small phone={phone} disabled={recall.length >= RECALL_MAX} onClick={() => setRecall([...recall, { k: "", percent: "", source: "maker" }])}>
              {RETRIEVAL_DIALOG_COPY.addRecall}
            </RecipeButton>
          </Inline>
        </OptionalField>
        <OptionalField name={RETRIEVAL_COPY.hybrid} summary={hybrid ? "Yes" : null} phone={phone}>
          <SegmentedField<"yes" | "no"> label={RETRIEVAL_COPY.hybrid} phone={phone} items={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} value={hybrid ? "yes" : "no"} onChange={(next) => setHybrid(next === "yes")} />
          <Hint>Vector search plus a keyword search over the same items</Hint>
        </OptionalField>
      </OptionalSection>
      {edit?.after ? edit.after({}) : null}
    </ModalForm>
  );
}

export function AddRetrievalDialog({ open, onOpenChange, onAdd, current, edit }: AddRetrievalDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: AddRetrievalInput) => {
    onAdd?.(input);
    close();
  };
  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title={edit ? edit.title : RETRIEVAL_DIALOG_COPY.title} eyebrow={edit ? MODAL_COPY.edit : undefined} subtitle={RETRIEVAL_DIALOG_COPY.subtitle} width={MODAL_WIDTH.standard} testId={edit ? "edit-retrieval-dialog" : "add-retrieval-dialog"}>
      <Form onAdd={add} onCancel={close} phone={phone} current={current} edit={edit && { ...edit, onSave: (input) => { edit.onSave(input); close(); } }} />
    </ModalShell>
  );
}

export default AddRetrievalDialog;
