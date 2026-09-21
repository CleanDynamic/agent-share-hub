// Provenance: how a build arrived, recorded on the build and read by its page.
//
// EX-P14. One JSONB column, builds.created_via, written once when a creator
// confirms an import and read once when a reader opens the build. It exists so
// the page can say a true sentence about its own origin — a conversation was
// extracted, and a person reviewed it before any of it was written.
//
// IT IS A LABEL AND NOTHING ELSE. No signal reads it, completeness does not
// count it, and the gallery neither ranks nor admits on it. That is deliberate
// rather than incidental: a provenance mark that moved a build up a list would
// be a reason to game how work arrived instead of what it is. The migration
// says the same thing in its own header, and grepping signals.ts and gallery.ts
// for `created_via` is the check that it stayed true.
//
// THE COLUMN IS NEWER THAN THE GENERATED TYPES. src/integrations/supabase/
// types.ts is generated from the live database and does not yet carry
// created_via, so the two calls below go through ONE cast declared here rather
// than an `as any` at each site — the same shape src/lib/build/imports.ts uses
// for import_sessions, and src/lib/bounty/meToo.ts before it. If the two ever
// disagree, the migration (supabase/migrations/20260921130000_builds_
// created_via.sql) is right.
//
// THE READ IS NARROW ON PURPOSE. `created_via` is deliberately NOT in
// BUILD_COLUMNS. Every header read in the application spends that list — the
// gallery, the drafts list, a profile's fifty builds — and none of them has
// anything to say about provenance. One build's page asks for one build's
// column, and nothing else pays for it.
//
// NOTHING HERE READS THE CONVERSATION. Every value written is an id, a client
// name from the connector's fixed list of six, or a reader id from the intake
// registry. Text from a creator's conversation is data, never instruction, and
// none of it reaches this column or is acted on by anything that reads it.

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "./types";

/** The column, named once. */
const CREATED_VIA = "created_via";

/**
 * Where a build came from.
 *
 * `connector` — it was made by claiming an import, so every part of its record
 * arrived through the connector and was reviewed before it was written.
 * `mixed` — the creator had already started this draft by some other route and
 * an import joined it. Calling that `connector` would overstate what the
 * connector did.
 */
export type CreatedViaSource = "connector" | "mixed";

/**
 * The stored object, as anything reading it should treat it.
 *
 * `client` and `reader_id` are present on the connector case and absent on the
 * mixed one, because on the mixed case they would describe only the last
 * arrival rather than the build.
 */
export interface CreatedVia {
  source: CreatedViaSource;
  client?: string | null;
  reader_id?: string | null;
  /** The import_sessions ids that contributed, in the order they arrived. */
  imports: string[];
}

/** One arrival, as claimImport knows it at the moment the creator confirms. */
export interface ImportArrival {
  /** A build made now by this claim, or a draft the creator already had. */
  destination: "new" | "existing";
  importId: string;
  /** From import_sessions.client — one of the connector's six, or null. */
  client?: string | null;
  /** From import_sessions.reader_id — which intake reader read it, or null. */
  readerId?: string | null;
}

/** The object as it is stored: the known keys, plus anything a later step adds. */
type StoredCreatedVia = Record<string, Json>;

// -----------------------------------------------------------------------------
// The shape
// -----------------------------------------------------------------------------

/**
 * What should be stored, given what is already stored.
 *
 * Pure, and separated from the write so the three cases can be proved without
 * a database:
 *
 *   NEW BUILD — the full connector record. A build created by this very claim
 *   has nothing to preserve, and `client` and `reader_id` describe the whole of
 *   it because the whole of it arrived at once.
 *
 *   EXISTING DRAFT WITH NOTHING RECORDED — `mixed`, carrying this import alone.
 *   The creator started the draft some other way; the honest source word is the
 *   one that says both things happened.
 *
 *   EXISTING DRAFT WITH SOMETHING RECORDED — the stored object exactly as it
 *   stands, with this import's id appended to `imports`. NOTHING ELSE CHANGES:
 *   not `source`, not `client`, not `reader_id`, not a key this code has never
 *   heard of. A build that arrived through the connector and then took a second
 *   import is still a build that arrived through the connector.
 *
 * An id already present is not appended twice. Every write tool in this
 * connector earns `idempotentHint` with a mechanism rather than an intention
 * (the contract's second design commitment), and a retry of this write is the
 * one case that would otherwise put the same conversation in the list twice.
 */
export function nextCreatedVia(current: unknown, arrival: ImportArrival): StoredCreatedVia {
  if (arrival.destination === "new") {
    return {
      source: "connector",
      client: arrival.client ?? null,
      reader_id: arrival.readerId ?? null,
      imports: [arrival.importId],
    };
  }

  const stored = asStored(current);
  if (!stored) {
    return { source: "mixed", imports: [arrival.importId] };
  }

  const imports = asImports(stored.imports);
  if (imports.includes(arrival.importId)) return stored;

  return { ...stored, imports: [...imports, arrival.importId] };
}

/** An object we can spread. An array is not one, and neither is null. */
function asStored(value: unknown): StoredCreatedVia | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as StoredCreatedVia;
}

/** The ids, defensively: a column written by an older shape may hold anything. */
function asImports(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

/**
 * The stored object narrowed to what a reader can rely on, or null when there
 * is nothing to say.
 *
 * A row with no `imports` returns null rather than an empty record: "drafted
 * from a conversation" is a claim, and a record that names no conversation
 * cannot support it.
 */
export function parseCreatedVia(value: unknown): CreatedVia | null {
  const stored = asStored(value);
  if (!stored) return null;

  const imports = asImports(stored.imports);
  if (imports.length === 0) return null;

  const source = stored.source === "connector" ? "connector" : "mixed";
  const client = typeof stored.client === "string" ? stored.client : null;
  const readerId = typeof stored.reader_id === "string" ? stored.reader_id : null;

  return { source, client, reader_id: readerId, imports };
}

// -----------------------------------------------------------------------------
// The database
// -----------------------------------------------------------------------------

interface ProvenanceRow {
  created_via: unknown;
}

/** The two operations this module performs against builds, described by hand. */
interface BuildsProvenanceTable {
  select: (columns: string) => {
    eq: (
      column: string,
      value: string,
    ) => { maybeSingle: () => PromiseLike<{ data: ProvenanceRow | null; error: unknown }> };
  };
  update: (patch: Record<string, unknown>) => {
    eq: (column: string, value: string) => PromiseLike<{ error: unknown }>;
  };
}

function buildsProvenance(): BuildsProvenanceTable {
  return (
    supabase as unknown as { from: (table: string) => BuildsProvenanceTable }
  ).from("builds");
}

/**
 * One build's provenance, for its page.
 *
 * Returns null for a build with nothing recorded, which is every build made
 * before this step and every build made by hand — so the page's normal state is
 * no line at all, and the line is the exception.
 *
 * A failed read is null too, not a throw. This is a caption under a build
 * record; a page that failed to render because it could not read a caption
 * would be the wrong trade.
 */
export async function getCreatedVia(buildId: string): Promise<CreatedVia | null> {
  const { data, error } = await selectCreatedVia(buildId);

  if (error) {
    console.warn("[getCreatedVia] provenance unreadable", {
      code: errorCode(error),
      buildId,
    });
    return null;
  }
  return parseCreatedVia(data?.created_via);
}

/**
 * Record that an import arrived at a build.
 *
 * NEVER THROWS. It is called after the rows are written and after the import is
 * marked claimed, so by the time it runs the creator's conversation is safely
 * in their draft and the only thing at stake is a sentence on the page. The
 * codebase already makes this trade once, for applyRepoHeader on the paste path
 * — "the tray is written; the header is a nicety" — and the reasoning is the
 * same here.
 *
 * WHAT A FAILURE LOGS: a code and the build id. Not the object it tried to
 * write, not the error's message, and under no circumstances anything from the
 * conversation — the contract's ninth prohibition is sizes, counts, states and
 * ids only, and this obeys it on the browser side of the same feature.
 *
 * THE APPEND IS READ-THEN-WRITE, NOT ATOMIC. Two claims into the same draft at
 * the same moment could each read the same array and the later write win, so one
 * import id would be missing from the label. Making it atomic needs a database
 * function to do the append in SQL; for a caption, on a race a single creator
 * has to open two tabs to cause, that is more surface than the fault is worth.
 */
export async function recordCreatedVia(
  buildId: string,
  arrival: ImportArrival,
): Promise<void> {
  try {
    // A build made by this very claim has nothing stored, so the read is only
    // worth making for the destination that might.
    const current =
      arrival.destination === "existing" ? await readStored(buildId) : null;

    const { error } = await buildsProvenance()
      .update({ [CREATED_VIA]: nextCreatedVia(current, arrival) })
      .eq("id", buildId);
    if (error) throw error;
  } catch (error) {
    console.warn("[recordCreatedVia] provenance not recorded", {
      code: errorCode(error),
      buildId,
    });
  }
}

/**
 * The one read, spent by both callers.
 *
 * They differ only in what they do with a failure — the page's read answers
 * null and draws nothing, the write's read gives up and is logged — so the
 * query itself is written once and the two decide afterwards.
 */
function selectCreatedVia(buildId: string) {
  return buildsProvenance().select(CREATED_VIA).eq("id", buildId).maybeSingle();
}

/** The column as stored, unnarrowed: an append must preserve keys it cannot name. */
async function readStored(buildId: string): Promise<unknown> {
  const { data, error } = await selectCreatedVia(buildId);
  if (error) throw error;
  return data?.created_via ?? null;
}

/**
 * A code for the log, and only a code.
 *
 * The database's own error code where there is one — "42501", "PGRST116" —
 * which names the kind of failure without quoting anything. Never the message:
 * a message can carry a value, and a log line is the wrong place to find one.
 */
function errorCode(error: unknown): string {
  if (error && typeof error === "object") {
    const { code } = error as { code?: unknown };
    if (typeof code === "string" && code.length > 0) return code;
  }
  return "unknown";
}
