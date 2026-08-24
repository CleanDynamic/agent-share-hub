// Lovable session export intake: recognising one, unpacking one, parsing one.
//
// NS-P20's client half. It sits beside intake.ts rather than inside it because
// the proposal contract is shared and unchanged: parse-lovable returns exactly
// the envelope parse-transcript returns, so everything downstream of the parse
// — IntakeProposal, keepEverything, materialiseProposal — is reused verbatim
// and needs no source-specific branch. The only thing that differs between the
// two sources is WHICH function is called, and that decision lives here.
//
// WHAT A "LOVABLE EXPORT" ACTUALLY IS. Lovable has no native session export.
// Its own ZIP download and GitHub sync carry source code only — no prompts, no
// timestamps, no ordering. The two shapes that do carry a session both come
// from third-party tooling. supabase/functions/parse-lovable/README.md records
// both, with provenance and samples.
//
// DETECTION READS THE CONTENT, NEVER THE FILENAME. A creator drops what they
// have; working out what it is, is the system's job. A .json extension proves
// nothing (a transcript can be saved as .json) and a .txt extension disproves
// nothing (a Lovable export saved from a browser often loses its extension).

import { supabase } from "@/integrations/supabase/client";
import { buildLayerError } from "./types";
import type { TranscriptProposal } from "./intake";

/** What a file turned out to be, once its content was read. */
export type ExportSource = "lovable" | "transcript" | "ambiguous";

/**
 * Total text pulled out of an archive. Past this a zip is a whole project
 * rather than a session, and the parser's own 413 would reject it anyway.
 */
const MAX_ARCHIVE_TEXT_CHARS = 400_000;

/** Entry names worth extracting, cheapest signal first. */
const SESSION_ENTRY = /(^|\/)(chat-history\/)?(raw\/[^/]+\.json|index\.json|.*lovable[^/]*\.json|messages\.json)$/i;
const MANIFEST_ENTRY = /(^|\/)(package\.json|tsconfig\.json)$/i;

// -----------------------------------------------------------------------------
// Detection
// -----------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** The fields each real shape's own writer emits. Mirrored from parse.ts. */
function looksLikeLovableMessage(item: unknown): boolean {
  if (!isRecord(item)) return false;
  return (
    "contentText" in item || "contentHtml" in item || "timestampText" in item ||
    "topPx" in item || "createdAt" in item || "createTime" in item || "patch" in item
  );
}

/**
 * Work out where a dropped file should go.
 *
 * Deliberately mirrors parse-lovable's server-side `detect` rather than
 * guessing differently: a file this says is Lovable must be a file the function
 * agrees is Lovable, or the creator gets routed somewhere that cannot read it.
 *
 * Returns "ambiguous" only for genuinely undecidable input — valid JSON with no
 * Lovable marker anywhere in it, which could as easily be another tool's chat
 * export destined for parse-transcript as a Lovable shape we have not seen.
 */
export function detectExportSource(rawText: string): ExportSource {
  const trimmed = rawText.trim();
  // Cheap gate before a 400,000 character JSON.parse: no JSON document starts
  // with anything else, and a transcript almost never starts with either.
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return "transcript";

  let root: unknown;
  try {
    root = JSON.parse(trimmed);
  } catch {
    // Opens like JSON, is not JSON. It is text, and text is a transcript.
    return "transcript";
  }

  const container = isRecord(root) ? root : null;
  const list: unknown[] = Array.isArray(root)
    ? root
    : Array.isArray(container?.messages)
      ? (container.messages as unknown[])
      : [];

  if (list.some(looksLikeLovableMessage)) return "lovable";

  // A Lovable code download. Routed to parse-lovable on purpose: it recognises
  // this and explains it, and that explanation belongs in one place.
  if (
    container &&
    ("dependencies" in container || "devDependencies" in container || "compilerOptions" in container)
  ) {
    return "lovable";
  }

  return "ambiguous";
}

// -----------------------------------------------------------------------------
// Archives
// -----------------------------------------------------------------------------
// A minimal ZIP reader over DecompressionStream, which is native to every
// browser this app supports. No library: constraint 4 of this rebuild exists
// because a prior dependency install destroyed the layout, and the compose
// route is already the heaviest page in the application.

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const STORED = 0;
const DEFLATE = 8;

interface ZipEntry {
  name: string;
  method: number;
  offset: number;
  compressedSize: number;
}

/** Walk the central directory backwards from the end-of-central-directory record. */
function readCentralDirectory(view: DataView): ZipEntry[] {
  // The EOCD is last, but a trailing comment can push it back by up to 64KB.
  const limit = Math.min(view.byteLength, 65_557);
  let eocd = -1;
  for (let back = 22; back <= limit; back += 1) {
    const at = view.byteLength - back;
    if (at < 0) break;
    if (view.getUint32(at, true) === EOCD_SIGNATURE) {
      eocd = at;
      break;
    }
  }
  if (eocd === -1) throw new Error("this is not a zip archive");

  const count = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > view.byteLength) break;
    if (view.getUint32(cursor, true) !== CENTRAL_SIGNATURE) break;

    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const offset = view.getUint32(cursor + 42, true);

    const name = new TextDecoder().decode(
      new Uint8Array(view.buffer, view.byteOffset + cursor + 46, nameLength),
    );

    entries.push({ name, method, offset, compressedSize });
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

async function inflate(bytes: Uint8Array, method: number): Promise<string> {
  if (method === STORED) return new TextDecoder().decode(bytes);
  if (method !== DEFLATE) throw new Error(`unsupported compression method ${method}`);

  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

/** Read one entry's bytes, resolving the local header to find where data starts. */
async function readEntry(buffer: ArrayBuffer, view: DataView, entry: ZipEntry): Promise<string> {
  // The central directory's copies of the name and extra lengths can disagree
  // with the local header's, so the local header is what the data offset is
  // measured from.
  const nameLength = view.getUint16(entry.offset + 26, true);
  const extraLength = view.getUint16(entry.offset + 28, true);
  const start = entry.offset + 30 + nameLength + extraLength;
  const bytes = new Uint8Array(buffer, start, entry.compressedSize);
  return inflate(bytes, entry.method);
}

/**
 * Pull the session out of a zip, if there is one in it.
 *
 * Three outcomes, in the order they are looked for:
 *   a chat-history/raw/ directory   -> concatenated into one {messages:[...]}
 *   a single session-looking .json  -> returned as-is
 *   neither, but a manifest         -> the manifest, so parse-lovable can say
 *                                      "this is your code, not your session"
 */
export async function readArchive(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const entries = readCentralDirectory(view).filter(
    (entry) => !entry.name.endsWith("/") && entry.compressedSize > 0,
  );

  const rawMessages = entries.filter((entry) => /(^|\/)raw\/[^/]+\.json$/i.test(entry.name));
  if (rawMessages.length > 0) {
    // One file per message, and filename order is not session order — the
    // parser sorts by timestamp once it can see them all.
    rawMessages.sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
    const messages: unknown[] = [];
    let budget = MAX_ARCHIVE_TEXT_CHARS;

    for (const entry of rawMessages) {
      const text = await readEntry(buffer, view, entry);
      budget -= text.length;
      if (budget < 0) break;
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) messages.push(...parsed);
        else messages.push(parsed);
      } catch {
        // One unreadable message is not a reason to lose the rest.
      }
    }
    if (messages.length > 0) return JSON.stringify({ messages });
  }

  const session = entries.find((entry) => SESSION_ENTRY.test(entry.name));
  if (session) {
    const text = await readEntry(buffer, view, session);
    if (detectExportSource(text) === "lovable") return text;
  }

  const manifest = entries.find((entry) => MANIFEST_ENTRY.test(entry.name));
  if (manifest) return readEntry(buffer, view, manifest);

  throw new Error(
    "there is no session history in this archive. Lovable's own download is source code only — " +
      "use a chat-history exporter to capture the session itself.",
  );
}

/** True for a file whose bytes start with a local file header. */
export async function isArchive(file: File): Promise<boolean> {
  if (file.size < 4) return false;
  const slice = file.slice(0, 4);
  // Blob.arrayBuffer is universal in browsers but absent in some File-like
  // objects. Sniffing is an optimisation over reading the whole file, so a
  // missing one degrades to "not an archive" rather than failing the drop.
  if (typeof slice.arrayBuffer !== "function") return false;
  const head = new Uint8Array(await slice.arrayBuffer());
  // "PK\x03\x04". Read from the bytes, not the extension.
  return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
}

/** A dropped file's text, whether it arrived as an archive or on its own. */
export async function readDroppedFile(file: File): Promise<string> {
  return (await isArchive(file)) ? readArchive(file) : file.text();
}

// -----------------------------------------------------------------------------
// Calling the parser
// -----------------------------------------------------------------------------

/**
 * Mirrors intake.ts's readFunctionError. Restated rather than imported because
 * intake.ts keeps it private and NS-P20 does not modify that file — the
 * proposal contract it owns is shared and unchanged.
 */
async function readFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: unknown })?.context;
  const response = context as Response | undefined;

  if (response && typeof response.json === "function") {
    try {
      const body = await response.json();
      const message = (body as { error?: unknown })?.error;
      if (typeof message === "string" && message.trim()) return message;
    } catch {
      // Body already consumed, or not JSON. Fall through to the generic text.
    }
  }

  const message = (error as { message?: unknown })?.message;
  return typeof message === "string" && message.trim()
    ? message
    : "parse-lovable could not be reached.";
}

/**
 * Ask parse-lovable for a proposal against a build the caller owns.
 *
 * Returns the same TranscriptProposal parse-transcript returns — same envelope,
 * same source_ref and inferred rules — so the caller hands it to
 * materialiseProposal unchanged.
 */
export async function requestLovableProposal(
  buildId: string,
  rawText: string,
  sourceHint?: string | null,
): Promise<TranscriptProposal> {
  const { data, error } = await supabase.functions.invoke("parse-lovable", {
    body: {
      raw_text: rawText,
      build_id: buildId,
      source_hint: sourceHint ?? null,
    },
  });

  if (error) {
    throw buildLayerError("parse-lovable", new Error(await readFunctionError(error)));
  }

  const proposal = data as TranscriptProposal | null;
  if (!proposal || typeof proposal !== "object" || !proposal.summary?.session_id) {
    throw buildLayerError(
      "parse-lovable",
      new Error("The parser returned a response this version does not understand."),
    );
  }

  return {
    events: proposal.events ?? [],
    nodes: proposal.nodes ?? [],
    summary: proposal.summary,
    warnings: proposal.warnings ?? [],
  };
}
