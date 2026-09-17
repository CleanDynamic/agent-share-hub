// =============================================================================
// buildgallery — mcp constants (EX-P02)
// =============================================================================
// The connector's numbers live here and nowhere else. A number typed twice is
// a bug waiting: the ceiling a tool reports to a caller and the ceiling the
// code enforces have to be the same number, read from the same line.
//
// The ceilings below are declared here in EX-P02 because this is the file the
// contract names as their single home. They are consumed from EX-P05 onward,
// when the import tables and the write tools exist to enforce them.
//
// EX-P06 adds the strings and sizes the pipe needs beside them: the verbatim
// instruction, the bucket name, the storage listing page size, and the one
// web address the error table carries. Same rule — one home, imported.
//
// EX-P08 adds the same address with its scheme, for the finish summary, and
// the shortfall ratio finish_import warns at. Same rule again.
// =============================================================================

/** Server name. Lowercase with hyphens, no version number. */
export const SERVER_NAME = "buildgallery-mcp-server";

/** Server version, bumped when the tool surface changes. */
export const SERVER_VERSION = "0.4.0";

/**
 * What this connector is, in one line, for a caller deciding whether to use it.
 *
 * It restates the principle — a pipe, not an editor — and the three things the
 * connector cannot do, so a client reading only this knows the shape of the
 * thing before it calls anything.
 */
export const CONNECTOR_STATEMENT =
  "This connector carries a conversation verbatim into a waiting import for " +
  "you to review on buildgallery; it never publishes, never edits or deletes " +
  "anything you already have, and never reads the content of a build.";

/**
 * The verbatim instruction. Word for word from the contract; it appears in the
 * server instructions and at the head of every tool description, and is not
 * paraphrased anywhere.
 */
export const VERBATIM_INSTRUCTION =
  "Send the conversation verbatim and complete, in order, every user and " +
  "assistant turn, including code blocks and errors. Do not summarise, " +
  "shorten, tidy or omit anything. If you can read the conversation from a " +
  "file or transcript on disk, send that rather than reproducing it from memory.";

/**
 * The upload page, as the error table names it. The manual writes
 * buildgallery.ai here; until the custom domain is connected the address is
 * the Lovable one, and this constant is the only place the substitution lives.
 */
export const COMPOSE_NEW_URL = "agent-share-hub.lovable.app/compose/new";

/**
 * The same page as a full address, for the finish_import summary, which tells
 * the caller where the import is waiting. Derived, not retyped, so the domain
 * substitution above stays the one place to change.
 */
export const COMPOSE_NEW_HTTPS_URL = `https://${COMPOSE_NEW_URL}`;

/** The private bucket the numbered chunks land in. Created by EX-P05. */
export const IMPORTS_BUCKET = "imports";

/**
 * Page size when listing one import's folder in the bucket. The listing is
 * paged until a page comes back short, so this bounds one request, not the
 * number of chunks an import may hold.
 */
export const STORAGE_LIST_PAGE_SIZE = 1_000;

/** The chunk size `buildgallery_begin_import` recommends, in characters. */
export const CHUNK_SIZE_CHARS = 24_000;

/** Hard rejection above this many characters in a single chunk. */
export const MAX_CHUNK_CHARS = 40_000;

/** Ceiling on one import's assembled text. Matches MAX_RAW_TEXT_CHARS. */
export const MAX_TOTAL_CHARS = 400_000;

/** Imports one creator may open per day. Enforced in the database. */
export const MAX_IMPORTS_PER_DAY = 20;

/** Imports one creator may hold open at once. Enforced in the database. */
export const MAX_OPEN_IMPORTS = 5;

/** How long a waiting import survives before it expires. */
export const IMPORT_TTL_DAYS = 7;

/**
 * finish_import warns when what arrived is more than this fraction short of
 * what the caller declared — characters against declared_chars, turns against
 * declared_turns. 0.05 is 5%: a few dozen characters of whitespace drift is
 * not a shortfall; a client that regenerated the conversation and lost a
 * tenth of it is.
 */
export const SHORTFALL_WARNING_RATIO = 0.05;

/** Default page size for both list tools. */
export const DEFAULT_PAGE_SIZE = 20;

/** Maximum page size for both list tools. */
export const MAX_PAGE_SIZE = 50;
