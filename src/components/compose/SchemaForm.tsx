// The schema-driven form: walk node_types.schema.fields, render each field's
// widget, and write the whole payload back.
//
// Nothing in this file knows what a prompt or a result is. It knows the six
// field types exist and that the registry maps each to a component; the node
// type decides what appears, and the node type is a database row.
//
// THE WRITE
// ---------
// Every edit lands in the React Query cache immediately and is written to the
// row 600ms later. The debounced write does NOT carry the value that triggered
// it. It re-reads the node from the cache at flush time and sends the columns
// this writer owns as they stand right then, which is what makes the merge
// structural rather than careful: a field the creator did not touch is still on
// the row being sent, because the row being sent is the current one.
//
// Two writers are open on the same node — this one for `payload`, the Inspector
// for `title` and `note`. They own disjoint column sets and PostgREST's
// ON CONFLICT DO UPDATE only touches the columns present in the body, so
// neither can clobber the other however their debounces interleave. Neither
// touches `parent_id` or `position`, so neither can fight a drag either.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import {
  upsertNode,
  type BuildNode,
  type BuildNodeInsert,
  type BuildRecord,
  type FieldDef,
  type NodePayload,
  type NodeTree,
} from "@/lib/build";
import { composeBuildQueryKey } from "@/hooks/useComposeBuild";
import { ORANGE, TEXT_MUTED } from "@/components/build/tokens";
import {
  fieldLabelStyle,
  helpStyle,
  resolveWidget,
  secondaryTextColour,
} from "./fields";

/** Long enough that a typed word is one write, short enough that the creator
 *  has not moved on before it lands. */
export const PAYLOAD_DEBOUNCE_MS = 600;

// --- cache helpers -----------------------------------------------------------
//
// Exported because the Inspector's title and note writer needs exactly the same
// two operations against exactly the same cache entry. They live here rather
// than in the Inspector so the module that owns node writes owns them.

/**
 * One node from the loaded record, placed or in the tray.
 *
 * Takes the two collections rather than the whole record, so the Inspector can
 * pass the hook's `tree` and `tray` straight in without rebuilding a record.
 */
export function findNodeInRecord(
  record: Pick<BuildRecord, "tree" | "tray"> | null | undefined,
  nodeId: string
): BuildNode | null {
  if (!record) return null;
  const walk = (nodes: NodeTree[]): BuildNode | null => {
    for (const node of nodes) {
      if (node.id === nodeId) return node;
      const hit = walk(node.children);
      if (hit) return hit;
    }
    return null;
  };
  return walk(record.tree) ?? record.tray.find((node) => node.id === nodeId) ?? null;
}

/**
 * Apply a column patch to one node, wherever it sits, without copying the rest.
 *
 * Arrays off the path to the patched node come back by reference, so a keyed
 * list of siblings does not remount because a cousin was edited.
 */
export function patchNodeInRecord(
  record: BuildRecord | null | undefined,
  nodeId: string,
  patch: Partial<BuildNode>
): BuildRecord | null | undefined {
  // Undefined is passed straight back rather than turned into null: React Query
  // reads an updater returning undefined as "leave it alone", which is the right
  // answer for a query that has not loaded.
  if (!record) return record;

  const mapTree = (nodes: NodeTree[]): NodeTree[] => {
    let touched = false;
    const next = nodes.map((node) => {
      if (node.id === nodeId) {
        touched = true;
        return { ...node, ...patch, children: node.children };
      }
      const children = mapTree(node.children);
      if (children !== node.children) {
        touched = true;
        return { ...node, children };
      }
      return node;
    });
    return touched ? next : nodes;
  };

  const tree = mapTree(record.tree);
  if (tree !== record.tree) return { ...record, tree };

  const index = record.tray.findIndex((node) => node.id === nodeId);
  if (index === -1) return record;
  const tray = record.tray.slice();
  tray[index] = { ...tray[index], ...patch };
  return { ...record, tray };
}

/** Read a stored payload as an object. Anything else is treated as empty. */
export function asPayload(value: Json | undefined | null): NodePayload {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as NodePayload)
    : {};
}

// --- the writer --------------------------------------------------------------

export interface NodeWriter {
  /** Merge columns into the cache now; write them to the row after the debounce. */
  patch: (columns: Partial<BuildNode>) => void;
  /** Merge fields into the node's payload, never replacing the whole object. */
  patchPayload: (fields: NodePayload) => void;
  /** Send anything pending immediately. Called when the selection moves off. */
  flush: () => void;
}

/**
 * A debounced writer for one node's columns.
 *
 * `nodeId` may change while a write is pending. The pending set carries the id
 * it was accumulated against, and a change of node flushes the old one before
 * the new one starts collecting, so a column is never read off the wrong row.
 */
export function useNodeWrite(buildId: string, nodeId: string | null): NodeWriter {
  const queryClient = useQueryClient();
  // Memoised: the flush effect below depends on this identity, and a fresh
  // array every render would flush on every render.
  const queryKey = useMemo(() => composeBuildQueryKey(buildId), [buildId]);

  const pendingRef = useRef<{ nodeId: string; columns: Set<string> } | null>(null);
  const timerRef = useRef<number | null>(null);
  /** Writes go out one at a time; two upserts on one row would race. */
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const nodeIdRef = useRef(nodeId);
  nodeIdRef.current = nodeId;

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;

    const record = queryClient.getQueryData<BuildRecord | null>(queryKey);
    const node = findNodeInRecord(record, pending.nodeId);
    // The node went away — deleted, or the build was reloaded out from under
    // the panel. There is nothing left to write the columns onto.
    if (!node) return;

    // build_id and type are NOT NULL without a default, so PostgREST needs them
    // present to build the INSERT half of the upsert even though the row exists
    // and only the DO UPDATE half will ever run.
    const row: BuildNodeInsert = {
      id: node.id,
      build_id: node.build_id,
      type: node.type,
    };
    for (const column of pending.columns) {
      (row as Record<string, unknown>)[column] = (node as Record<string, unknown>)[column];
    }

    // The response row is deliberately not merged back on success. It is the row
    // that was just sent, and anything typed since is newer than it —
    // reconciling would take the creator's cursor back to where it was 600ms ago.
    chainRef.current = chainRef.current
      .then(async () => {
        await upsertNode(row);
      })
      .then(undefined, (cause: unknown) => {
        toast.error("That edit could not be saved", {
          description: cause instanceof Error ? cause.message : String(cause),
        });
        // The cache is now a claim the server has not accepted. Refetch so the
        // panel shows what is actually stored rather than what was typed.
        void queryClient.invalidateQueries({ queryKey });
      });
  }, [queryClient, queryKey]);

  const patch = useCallback(
    (columns: Partial<BuildNode>) => {
      const id = nodeIdRef.current;
      if (!id) return;
      const keys = Object.keys(columns);
      if (keys.length === 0) return;

      queryClient.setQueryData<BuildRecord | null>(queryKey, (record) =>
        patchNodeInRecord(record, id, columns)
      );

      if (pendingRef.current && pendingRef.current.nodeId !== id) flush();
      const pending = pendingRef.current ?? { nodeId: id, columns: new Set<string>() };
      for (const key of keys) pending.columns.add(key);
      pendingRef.current = pending;

      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        flush();
      }, PAYLOAD_DEBOUNCE_MS);
    },
    [flush, queryClient, queryKey]
  );

  const patchPayload = useCallback(
    (fields: NodePayload) => {
      const id = nodeIdRef.current;
      if (!id) return;
      // The merge base is the payload as it stands in the cache this instant,
      // not the one this component last rendered with. Two edits inside one
      // frame therefore still compose instead of the second dropping the first.
      const record = queryClient.getQueryData<BuildRecord | null>(queryKey);
      const current = asPayload(findNodeInRecord(record, id)?.payload);
      patch({ payload: { ...current, ...fields } as Json });
    },
    [patch, queryClient, queryKey]
  );

  // Selecting a different node, or leaving the workspace, must not lose the
  // last 600ms of typing. The cleanup runs with the previous node still in the
  // pending set, which is exactly the row the columns belong to.
  useEffect(() => () => flush(), [flush, nodeId]);

  return { patch, patchPayload, flush };
}

// --- the shared field shell --------------------------------------------------

interface FieldShellProps {
  field: FieldDef;
  id: string;
  /** True once the creator has edited this field. Gates the required marker. */
  touched?: boolean;
  isEmpty: boolean;
  compact?: boolean;
  /** BooleanField: the label sits beside the control, not above it. */
  inlineLabel?: boolean;
  /** ListField: the control is a list, so the label labels nothing focusable. */
  labelAsText?: boolean;
  children: ReactNode;
}

/**
 * Label, required marker, control, help — in that order, for every widget.
 *
 * All copy comes from the field definition. Nothing here invents a label, a
 * placeholder or a description; a field with no `help` shows no help text.
 *
 * The required marker is quiet by design. It reads as muted metadata until the
 * creator has typed in the field and then emptied it, and it never turns red or
 * becomes an error — an untouched required field is a form that has not been
 * filled in yet, which is not a mistake anyone has made.
 */
export function FieldShell({
  field,
  id,
  touched,
  isEmpty,
  compact,
  inlineLabel,
  labelAsText,
  children,
}: FieldShellProps) {
  const showRequired = field.required === true;
  const isMissing = showRequired && touched === true && isEmpty;

  // The marker is a sibling of the label, never inside it: a control's
  // accessible name is its label's text, and "Prompt textrequired" is not what
  // this field is called.
  const labelRow = (
    <span
      style={{
        ...fieldLabelStyle,
        fontSize: compact ? 11 : 12,
        color: secondaryTextColour,
        // In a list row the sub-field label is carried by the placeholder, so
        // repeating it above every input would triple the row's height.
        display: compact ? "none" : "flex",
      }}
    >
      {labelAsText ? (
        // A list's control is a <ul>, which htmlFor cannot point at.
        <span>{field.label}</span>
      ) : (
        <label htmlFor={id}>{field.label}</label>
      )}
      {showRequired && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.04em",
            color: isMissing ? ORANGE : TEXT_MUTED,
          }}
        >
          required
        </span>
      )}
    </span>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: inlineLabel ? "row" : "column",
        alignItems: inlineLabel ? "center" : "stretch",
        justifyContent: inlineLabel ? "space-between" : undefined,
        gap: inlineLabel ? 12 : 5,
      }}
    >
      {labelRow}
      {children}
      {field.help && !compact && !inlineLabel && (
        <p style={helpStyle}>{field.help}</p>
      )}
    </div>
  );
}

// --- the form ----------------------------------------------------------------

interface SchemaFormProps {
  buildId: string;
  node: BuildNode;
  fields: FieldDef[];
}

export function SchemaForm({ buildId, node, fields }: SchemaFormProps) {
  const { patchPayload } = useNodeWrite(buildId, node.id);
  const payload = asPayload(node.payload);

  /** Which fields the creator has edited, so the required marker stays quiet
   *  until they have actually been somewhere and left it blank. */
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  useEffect(() => setTouched(new Set()), [node.id]);

  const markTouched = useCallback((key: string) => {
    setTouched((current) => (current.has(key) ? current : new Set(current).add(key)));
  }, []);

  if (fields.length === 0) {
    return (
      <p style={{ ...helpStyle, color: secondaryTextColour }}>
        This type stores no fields. Its note carries everything it says.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {fields.map((field) => {
        const Widget = resolveWidget(field);
        const fieldId = `field-${node.id}-${field.key}`;
        return (
          <Widget
            key={field.key}
            field={field}
            id={fieldId}
            value={payload[field.key]}
            touched={touched.has(field.key)}
            onTouch={() => markTouched(field.key)}
            onChange={(next) => {
              markTouched(field.key);
              patchPayload({ [field.key]: next });
            }}
          />
        );
      })}
    </div>
  );
}
