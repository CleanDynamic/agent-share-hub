// CA-12 P5: adding a session to a draft.
//
// A SESSION IS A GROUP OF TILES. Adding one writes every prompt of it as a placed, top-level prompt tile, in order, at the
// end of the draft, and records the session in `build_sessions` (its place in the order, and whether it starts collapsed).
// The import is NOT marked claimed: it stays the maker's, and can be in any number of drafts, each with its own copy.
//
// NOTHING MORE OF THE CONVERSATION IS COPIED. A tile is the prompt's text and the model, with the same source_ref a prompt
// picked one at a time has (addSessionPrompt): the answers and the rest of the verbatim session stay in the import, and no
// event is written, so nothing reaches the public timeline that the maker did not choose.
//
// ONE GO. supabase-js has no transaction, so the tiles are written in batches and, if anything after them fails, taken away
// again: a failure leaves nothing half-added. The session's row is written last, once the tiles are in.
//
// IF SESSION 1 IS STILL EMPTY (a session made here, no app, no tile) the added session replaces it and becomes Session 1.

import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { modelLabel } from "@/lib/models/registry";
import { COLLAPSE_OVER, deleteBuildSession, insertBuildSession, isMissingTable, listBuildSessionRows, nextSessionPosition, type BuildSessionRow } from "./buildSessions";
import { createBuild, getBuildHeader } from "./builds";
import { creditColumn, creditFor, noteMissingContributorColumn, withoutCredit } from "./contributors";
import { REPLY_MAX } from "./composePrompts";
import { nextTopPosition } from "./composeCover";
import { loadImportProposal } from "./imports";
import type { TranscriptProposal, TranscriptSourceRef } from "./intake";
import { isTypedSession, patchMaking, refreshMakingStats, sessionsMetaOf, setSessionMeta, type SessionMeta } from "./making";
import { reorderNodes } from "./nodes";
import { planLayout } from "./sessionEdit";
import { isSessionSummary } from "./summaryTurn";
import { firstWords } from "./graph";
import { defaultWorkstream, orderWithNewSession, workstreamKeyOf } from "./workstreams";
import { storedWorkstreamsOf } from "./making";
import { getSessionOrder, setCollapsed, setSessionOrder } from "./sessionLayout";
import { getNodeTree } from "./nodes";
import { recordCreatedVia } from "./provenance";
import { buildLayerError, type BuildNodeInsert, type NodeTree } from "./types";

/** Tiles written in one request. */
export const TILE_BATCH = 100;

const UNTITLED = "Untitled build";

/** CA-17 P3: `workstream` is the part the session joins (the end of it); with two or more parts and none given, the last. */
export type AddTarget = { kind: "new" } | { kind: "existing"; buildId: string; workstream?: string };

export interface AddSessionResult {
  buildId: string;
  /** The key the session has in the draft: the import's id. */
  sessionKey: string;
  /** How many tiles were written. */
  tiles: number;
  /** The session started collapsed. */
  collapsed: boolean;
  /** The key of the empty Session 1 it replaced, when it did. */
  replaced: string | null;
}

export interface PromptTile {
  text: string;
  /** CA-12 P12: what came back, as the parser stored it on the event (`response_summary`: the first 240 characters of the next turn). */
  reply: string | null;
  sourceRef: TranscriptSourceRef;
}

/** The prompts of a proposal, in order: one per user turn. */
export function promptsOfProposal(proposal: TranscriptProposal): PromptTile[] {
  return proposal.events
    .filter((event) => event.kind === "prompt")
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((event) => ({ text: event.payload.text, reply: event.payload.response_summary?.trim() || null, sourceRef: event.source_ref }));
}

/**
 * SV-07 P7: a new draft's title: the one the parser proposed, unless that is Claude Code's summary of an earlier session, which
 * names nothing; then the first real prompt's opening words. "Untitled build" when there are none.
 */
export function draftTitleOf(proposed: string | null | undefined, prompts: readonly Pick<PromptTile, "text">[]): string {
  const given = proposed?.trim();
  if (given && !isSessionSummary(given)) return given;
  const first = prompts.find((prompt) => prompt.text.trim() && !isSessionSummary(prompt.text));
  return first ? firstWords(first.text, 8) || UNTITLED : UNTITLED;
}

/** A session with more prompts than `COLLAPSE_OVER` is added collapsed. */
export const startsCollapsed = (promptCount: number): boolean => promptCount > COLLAPSE_OVER;

export const hasSession = (tree: readonly NodeTree[], key: string): boolean =>
  tree.some((node) => {
    const payload = (node.payload ?? {}) as { session?: unknown };
    const ref = (node.source_ref ?? {}) as { import_session_id?: unknown };
    return payload.session === key || ref.import_session_id === key || hasSession(node.children ?? [], key);
  });

/**
 * The empty Session 1 a session replaces: the first of the draft's sessions, when it was made here, has no app and holds no
 * tile. Null otherwise (including a draft with no rows: an old draft is never touched).
 */
export function emptyFirstSession(
  rows: readonly Pick<BuildSessionRow, "sessionKey" | "position">[],
  making: unknown,
  tree: readonly NodeTree[],
): string | null {
  const first = [...rows].sort((a, b) => a.position - b.position)[0];
  if (!first || !isTypedSession(first.sessionKey)) return null;
  const meta = sessionsMetaOf(making)[first.sessionKey];
  if (meta?.tool || hasSession(tree, first.sessionKey)) return null;
  return first.sessionKey;
}

/** Where the added session goes: the replaced one's place, else the end. */
export function placeSession(rows: readonly Pick<BuildSessionRow, "sessionKey" | "position">[], replaced: string | null): number {
  const old = replaced ? rows.find((row) => row.sessionKey === replaced) : undefined;
  return old ? old.position : nextSessionPosition(rows);
}

/** The tiles' rows: a prompt per row, placed one after another from `from`. */
export function tileRows(buildId: string, importId: string, model: string | null, prompts: readonly PromptTile[], from: number, credit: string | null = null): BuildNodeInsert[] {
  return prompts.map((prompt, at) => ({
    ...creditColumn(credit),
    build_id: buildId,
    parent_id: null,
    position: from + at,
    type: "prompt",
    title: null,
    payload: { text: prompt.text, ...(model ? { model } : null), ...(prompt.reply ? { reply: prompt.reply.slice(0, REPLY_MAX) } : null) } as Json,
    source_ref: { ...prompt.sourceRef, import_session_id: importId } as unknown as Json,
  }));
}

interface ImportRow {
  id: string;
  status: string;
  client: string | null;
  model: string | null;
}

async function readImport(importId: string): Promise<ImportRow | null> {
  const { data, error } = await (supabase as unknown as {
    from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<{ data: ImportRow | null; error: unknown }> } } };
  })
    .from("import_sessions")
    .select("id, status, client, model")
    .eq("id", importId)
    .maybeSingle();
  if (error) throw buildLayerError("addSessionToBuild", error);
  return data;
}

/** The draft an add is about to write into: it must exist, be the signed-in maker's own, and still be a draft. */
async function verifyDraft(buildId: string): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const maker = data.session?.user?.id;
  const build = await getBuildHeader(buildId);
  if (!build || !maker || build.creator_id !== maker) throw buildLayerError("addSessionToBuild", new Error("That draft isn't available."));
  if (build.status !== "draft") throw buildLayerError("addSessionToBuild", new Error("That build is already published."));
  return build.id;
}

const isUniqueViolation = (error: unknown): boolean => Boolean(error) && typeof error === "object" && (error as { code?: unknown }).code === "23505";

/** SV-05 P4: how many of a session's tiles are written so far, after each batch. */
export type TileProgress = (progress: { done: number; total: number }) => void;

async function insertTiles(rows: BuildNodeInsert[], onProgress?: TileProgress): Promise<string[]> {
  const ids: string[] = [];
  for (let at = 0; at < rows.length; at += TILE_BATCH) {
    const batch = rows.slice(at, at + TILE_BATCH);
    let { data, error } = await supabase.from("build_nodes").insert(batch).select("id");
    // SV-21: a tile credited to someone, before SV-16's column is applied, is written without the credit.
    if (error && noteMissingContributorColumn(error)) ({ data, error } = await supabase.from("build_nodes").insert(withoutCredit(batch)).select("id"));
    if (error) {
      await removeTiles(ids);
      throw error;
    }
    for (const row of data ?? []) ids.push(row.id);
    onProgress?.({ done: ids.length, total: rows.length });
  }
  return ids;
}

async function removeTiles(ids: readonly string[]): Promise<void> {
  for (let at = 0; at < ids.length; at += TILE_BATCH) {
    const { error } = await supabase.from("build_nodes").delete().in("id", ids.slice(at, at + TILE_BATCH));
    // eslint-disable-next-line no-console -- a deliberate, structured log that its tests assert (SV-26)
    if (error) console.error("[addSession] tiles not taken back", error);
  }
}

/**
 * Add a session to a draft (or to a new one), every prompt a tile. Refuses a session that is already in the draft and one
 * that never finished arriving. Resolves with where it went.
 */
export async function addSessionToBuild(importId: string, target: AddTarget, onProgress?: TileProgress): Promise<AddSessionResult> {
  const row = await readImport(importId);
  if (!row) throw buildLayerError("addSessionToBuild", new Error("That session is no longer available."));
  if (!["parsed", "claimed", "expired"].includes(row.status)) throw buildLayerError("addSessionToBuild", new Error("That session hasn't finished arriving."));

  const proposal = await loadImportProposal(importId);
  const prompts = promptsOfProposal(proposal);
  const model = row.model?.trim() ? modelLabel(row.model) : null;

  const isNew = target.kind === "new";
  const buildId = isNew
    ? (await createBuild({ title: draftTitleOf(proposal.summary.proposed_title?.value, prompts) })).id
    : await verifyDraft(target.buildId);

  return writeSession({
    buildId,
    sessionKey: importId,
    model,
    prompts,
    isNew,
    workstream: target.kind === "existing" ? target.workstream : undefined,
    run: runFactsOf(proposal.summary.turn_count || (proposal.summary.user_turn_count ?? 0) + (proposal.summary.assistant_turn_count ?? 0), prompts),
    onProgress,
    beforeStats: isNew ? () => recordCreatedVia(buildId, { destination: "new", importId, client: row.client, readerId: null }) : undefined,
  });
}

/** SV-21: a finished session of the reader's, as an offer carries it: its prompts and its model. Refused as `addSessionToBuild` refuses. */
export async function loadOfferedSession(importId: string): Promise<OfferedSession> {
  const row = await readImport(importId);
  if (!row) throw buildLayerError("loadOfferedSession", new Error("That session is no longer available."));
  if (!["parsed", "claimed", "expired"].includes(row.status)) throw buildLayerError("loadOfferedSession", new Error("That session hasn't finished arriving."));
  const prompts = promptsOfProposal(await loadImportProposal(importId));
  if (prompts.length === 0) throw buildLayerError("loadOfferedSession", new Error("That session has no prompts to offer."));
  return { key: importId, model: row.model?.trim() ? modelLabel(row.model) : null, prompts };
}

/** SV-21: a session offered to a request, as it is kept with the offer: the prompts and the model, and nothing else of the session. */
export interface OfferedSession {
  /** The key the session has in the build it is accepted into: the offering person's import. */
  key: string;
  model: string | null;
  prompts: PromptTile[];
}

/**
 * SV-21: accept an offered session into the maker's own build, draft or live. It is written as `addSessionToBuild` writes a
 * session (prompt text, model and source only, in one go, undone as a whole if any of it fails), at the end of the part the
 * request was for, with every tile and the session credited to the person who offered it (SV-16).
 */
export async function addOfferedSession(buildId: string, offered: OfferedSession, contributorId: string, workstream?: string, onProgress?: TileProgress): Promise<AddSessionResult> {
  const { data } = await supabase.auth.getSession();
  const maker = data.session?.user?.id;
  const build = await getBuildHeader(buildId);
  if (!build || !maker || build.creator_id !== maker) throw buildLayerError("addOfferedSession", new Error("That build isn't available."));
  return writeSession({
    buildId,
    sessionKey: offered.key,
    model: offered.model,
    prompts: offered.prompts,
    isNew: false,
    workstream,
    credit: creditFor(contributorId, maker),
    onProgress,
  });
}

interface WriteSessionInput {
  buildId: string;
  /** The session's key in the build: the import's id, or (SV-21, an accepted offer) the offered session's. */
  sessionKey: string;
  model: string | null;
  prompts: readonly PromptTile[];
  /** A build made a moment ago for this session: it has no sessions or tiles to read. */
  isNew: boolean;
  /** CA-17 P3: the part the session joins, when the build has parts. */
  workstream?: string;
  /** SV-21: the person whose work the tiles and the session are, when not the build's maker (SV-16's credit). */
  credit?: string | null;
  onProgress?: TileProgress;
  /** SV-30 P6: what the import showed of the session: its turns and its compaction summaries. Written with the session's entry, as From the run. */
  run?: { messages?: number; compactions?: number };
  /** Run inside the guard, once the session is in place: a failure takes the session out again. */
  beforeStats?: () => Promise<void>;
}

/** SV-30 P6: the import's turn count, and how many of its prompts are Claude Code's compaction summaries. Nothing is inferred beyond that. */
export function runFactsOf(turns: number | null | undefined, prompts: readonly Pick<PromptTile, "text">[]): { messages?: number; compactions?: number } {
  const compactions = prompts.filter((prompt) => isSessionSummary(prompt.text)).length;
  return { ...(typeof turns === "number" && turns > 0 ? { messages: turns } : null), ...(compactions > 0 ? { compactions } : null) };
}

/** The keys a session's entry takes from the run, each marked From the run. */
const runExtras = (run: { messages?: number; compactions?: number } | undefined) => {
  const from = (["messages", "compactions"] as const).filter((key) => run?.[key] !== undefined);
  return from.length > 0 ? { ...run, from_run: from } : null;
};

/** The writes of one session into a build, whoever it comes from; undone as a whole if any of them fails. */
async function writeSession({ buildId, sessionKey: importId, model, prompts, isNew, workstream, credit = null, run, onProgress, beforeStats }: WriteSessionInput): Promise<AddSessionResult> {
  const written: string[] = [];
  let oldRow: BuildSessionRow | undefined;
  let oldMeta: ReturnType<typeof sessionsMetaOf>[string] | undefined;
  let marked = false;
  try {
    const [rows, tree, making] = await Promise.all([
      listBuildSessionRows(buildId),
      isNew ? Promise.resolve([] as NodeTree[]) : getNodeTree(buildId),
      isNew ? Promise.resolve({}) : readMaking(buildId),
    ]);
    if (rows.some((existing) => existing.sessionKey === importId) || hasSession(tree, importId)) {
      throw buildLayerError("addSessionToBuild", new Error("That session is already in this draft."));
    }
    // CA-17 P3: the part it joins, when the build has parts. An empty Session 1 in another part is left alone.
    const part = isNew ? undefined : defaultWorkstream(making, workstream);
    let replaced = emptyFirstSession(rows, making, tree);
    if (replaced && part && workstreamKeyOf(sessionsMetaOf(making)[replaced], storedWorkstreamsOf(making)) !== part) replaced = null;
    const place = placeSession(rows, replaced);

    // The tiles, at the end of the draft. A second writer taking the position first is read again and tried once more.
    let ids: string[];
    try {
      onProgress?.({ done: 0, total: prompts.length });
      ids = await insertTiles(tileRows(buildId, importId, model, prompts, nextTopPosition(tree), credit), onProgress);
    } catch (cause) {
      if (!isUniqueViolation(cause)) throw buildLayerError("addSessionToBuild (tiles)", cause);
      ids = await insertTiles(tileRows(buildId, importId, model, prompts, nextTopPosition(await getNodeTree(buildId)), credit), onProgress).catch((again) => {
        throw buildLayerError("addSessionToBuild (tiles)", again);
      });
    }
    written.push(...ids);

    // Session 1 is replaced, not kept beside it.
    if (replaced) {
      oldRow = rows.find((existing) => existing.sessionKey === replaced);
      oldMeta = sessionsMetaOf(making)[replaced];
      await deleteBuildSession(buildId, replaced);
      await setSessionMeta(buildId, replaced, null);
    }
    // CA-12: an entry in sessions_meta marks a session added this way, so its head is drawn even when it is the only one.
    if (!sessionsMetaOf(making)[importId]) {
      await setSessionMeta(buildId, importId, { tool: null, date: "", ...(part ? { workstream: part } : null), ...(credit ? { contributor_id: credit } : null), ...runExtras(run) });
      marked = true;
    }
    const collapsed = startsCollapsed(prompts.length);
    try {
      await insertBuildSession({ buildId, sessionKey: importId, importId, position: place, collapsed });
    } catch (cause) {
      // The table is not applied yet: the tiles alone make the session (the group is read from them), without an order.
      if (!isMissingTable((cause as { cause?: unknown } | null)?.cause ?? cause)) throw cause;
      // eslint-disable-next-line no-console -- a deliberate, structured log that its tests assert (SV-26)
      console.warn("[addSession] build_sessions is not applied; the session is in the draft by its tiles");
    }

    // CA-14 P1: the order and the fold are also kept in `making`, so a draft without the table still has them. SV-07 P1: the
    // order is worked out from the draft as it stands when it is written, not as it was read before the tiles went in, so a
    // session added meanwhile keeps its place and its part.
    const replacedAt = replaced ? Math.max(0, getSessionOrder(making, rows).indexOf(replaced)) : -1;
    const orderNow = (made: unknown, rowsNow: readonly BuildSessionRow[]): string[] => {
      const kept = getSessionOrder(made, rowsNow).filter((key) => key !== replaced && key !== importId);
      kept.splice(Math.min(replacedAt < 0 ? kept.length : replacedAt, kept.length), 0, importId);
      // CA-17 P3: in a part, the session stands at the end of it in the one order, and the tiles are put with their session.
      return part ? orderWithNewSession(made, kept.filter((key) => key !== importId), importId, part) : kept;
    };
    if (part) {
      const grouped = await setSessionOrder(buildId, orderNow);
      const [afterTree, afterMaking] = await Promise.all([getNodeTree(buildId), readMaking(buildId)]);
      const moves = planLayout(afterTree, afterMaking, sessionsMetaOf(afterMaking), grouped).moves;
      if (moves.length > 0) await reorderNodes(buildId, moves);
    // eslint-disable-next-line no-console -- a deliberate, structured log that its tests assert (SV-26)
    } else await patchMaking(buildId, (made) => ({ session_order: orderNow(made, rows) })).catch((cause) => console.warn("[addSession] order not kept in making", cause));
    // eslint-disable-next-line no-console -- a deliberate, structured log that its tests assert (SV-26)
    if (collapsed) await setCollapsed(buildId, importId, true).catch((cause) => console.warn("[addSession] fold not kept in making", cause));

    await beforeStats?.();
    // eslint-disable-next-line no-console -- a deliberate, structured log that its tests assert (SV-26)
    await refreshMakingStats(buildId).catch((cause) => console.warn("[addSession] making stats not refreshed", cause));
    return { buildId, sessionKey: importId, tiles: prompts.length, collapsed, replaced };
  } catch (cause) {
    // Leave nothing half-added: the tiles go, and an empty Session 1 that was taken down comes back.
    await removeTiles(written);
    if (marked) await setSessionMeta(buildId, importId, null).catch(() => undefined);
    if (oldRow) {
      await insertBuildSession({ ...oldRow, collapsed: oldRow.collapsed }).catch(() => undefined);
      if (oldMeta) await setSessionMeta(buildId, oldRow.sessionKey, oldMeta).catch(() => undefined);
    }
    throw cause;
  }
}

async function readMaking(buildId: string): Promise<unknown> {
  const { data, error } = await (supabase as unknown as {
    from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<{ data: { making: unknown } | null; error: unknown }> } } };
  })
    .from("builds")
    .select("making")
    .eq("id", buildId)
    .maybeSingle();
  if (error) throw buildLayerError("addSessionToBuild", error);
  return data?.making ?? {};
}

/** SV-05 P3: the prompts of a session that have no tile in the draft yet, read by where they stand in the session. */
export function missingPrompts(tree: readonly NodeTree[], importId: string, prompts: readonly PromptTile[]): PromptTile[] {
  const have = new Set<number>();
  const read = (nodes: readonly NodeTree[]) => {
    for (const node of nodes) {
      const ref = (node.source_ref ?? {}) as { import_session_id?: unknown; index?: unknown };
      if (ref.import_session_id === importId && typeof ref.index === "number") have.add(ref.index);
      read(node.children ?? []);
    }
  };
  read(tree);
  return prompts.filter((prompt) => !have.has(prompt.sourceRef.index));
}

/**
 * SV-05 P3: Retry, for a session that came in short: its missing prompts are written as tiles and stacked with the rest of
 * the session, in the build's order. Resolves how many were written.
 */
export async function fillMissingTiles(importId: string, buildId: string): Promise<number> {
  await verifyDraft(buildId);
  const [row, proposal, tree, making, rows] = await Promise.all([readImport(importId), loadImportProposal(importId), getNodeTree(buildId), readMaking(buildId), listBuildSessionRows(buildId)]);
  const missing = missingPrompts(tree, importId, promptsOfProposal(proposal));
  if (missing.length === 0) return 0;
  const model = row?.model?.trim() ? modelLabel(row.model) : null;
  try {
    await insertTiles(tileRows(buildId, importId, model, missing, nextTopPosition(tree)));
  } catch (cause) {
    throw buildLayerError("fillMissingTiles", cause);
  }
  const moves = planLayout(await getNodeTree(buildId), making, sessionsMetaOf(making), getSessionOrder(making, rows)).moves;
  if (moves.length > 0) await reorderNodes(buildId, moves);
  // eslint-disable-next-line no-console -- a deliberate, structured log that its tests assert (SV-26)
  await refreshMakingStats(buildId).catch((cause) => console.warn("[addSession] making stats not refreshed", cause));
  return missing.length;
}

/** SV-07 P2: a ready-made session to add (SV-18's Add from Library, SV-21's offered sessions): its key, its entry and its tiles. */
export interface SessionCopy {
  /** The key it will have in the draft: a session made here (`typed-…`). */
  key: string;
  meta: SessionMeta;
  /** Its top-level tiles, in order. Where they stand and which session they are in is set here. */
  tiles: readonly Pick<BuildNodeInsert, "type" | "title" | "note" | "payload" | "source_ref">[];
}

/**
 * SV-07 P2: add a ready-made session to a draft, the way an import is added: its tiles at the end, its entry (in the part it
 * joins), its row and its place in the one order, the tiles then put with it. Refuses a key that is already in the draft. A
 * failure part way takes back what was written. Resolves with where it went.
 */
export async function addSessionCopy(buildId: string, copy: SessionCopy, workstream?: string): Promise<AddSessionResult> {
  if (!isTypedSession(copy.key)) throw buildLayerError("addSessionCopy", new Error("A copied session is a session made here."));
  const [rows, tree, making] = await Promise.all([listBuildSessionRows(buildId), getNodeTree(buildId), readMaking(buildId)]);
  if (rows.some((existing) => existing.sessionKey === copy.key) || hasSession(tree, copy.key)) {
    throw buildLayerError("addSessionCopy", new Error("That session is already in this draft."));
  }
  const part = defaultWorkstream(making, workstream);
  const from = nextTopPosition(tree);
  const ids = await insertTiles(
    copy.tiles.map((tile, at) => ({
      ...tile,
      build_id: buildId,
      parent_id: null,
      position: from + at,
      payload: { ...((tile.payload ?? {}) as Record<string, Json>), session: copy.key } as Json,
    })),
  ).catch((cause) => {
    throw buildLayerError("addSessionCopy (tiles)", cause);
  });
  try {
    await setSessionMeta(buildId, copy.key, { ...copy.meta, ...(part ? { workstream: part } : null) });
    try {
      await insertBuildSession({ buildId, sessionKey: copy.key, importId: null, position: nextSessionPosition(await listBuildSessionRows(buildId)) });
    } catch (cause) {
      if (!isMissingTable((cause as { cause?: unknown } | null)?.cause ?? cause)) throw cause;
    }
    const order = await setSessionOrder(buildId, (made, rowsNow) => {
      const kept = getSessionOrder(made, rowsNow).filter((key) => key !== copy.key);
      return part ? orderWithNewSession(made, kept, copy.key, part) : [...kept, copy.key];
    });
    const [afterTree, afterMaking] = await Promise.all([getNodeTree(buildId), readMaking(buildId)]);
    const moves = planLayout(afterTree, afterMaking, sessionsMetaOf(afterMaking), order).moves;
    if (moves.length > 0) await reorderNodes(buildId, moves);
  } catch (cause) {
    await removeTiles(ids);
    await setSessionMeta(buildId, copy.key, null).catch(() => undefined);
    await deleteBuildSession(buildId, copy.key).catch(() => undefined);
    throw cause;
  }
  // eslint-disable-next-line no-console -- a deliberate, structured log that its tests assert (SV-26)
  await refreshMakingStats(buildId).catch((cause) => console.warn("[addSession] making stats not refreshed", cause));
  return { buildId, sessionKey: copy.key, tiles: ids.length, collapsed: false, replaced: null };
}

/**
 * Link a session to a draft without writing its tiles: one of its prompts was added by hand, so the session belongs here
 * from now on (its model and tool join Made with). Nothing happens when it is already linked.
 */
export async function linkSessionToBuild(importId: string, buildId: string): Promise<void> {
  const rows = await listBuildSessionRows(buildId);
  if (rows.some((existing) => existing.sessionKey === importId)) return;
  try {
    await insertBuildSession({ buildId, sessionKey: importId, importId, position: nextSessionPosition(rows) });
  } catch (cause) {
    if (!isMissingTable((cause as { cause?: unknown } | null)?.cause ?? cause)) throw cause;
  }
  await refreshMakingStats(buildId);
}
