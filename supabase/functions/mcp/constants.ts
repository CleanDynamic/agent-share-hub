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
// =============================================================================

/** Server name. Lowercase with hyphens, no version number. */
export const SERVER_NAME = "buildgallery-mcp-server";

/** Server version, bumped when the tool surface changes. */
export const SERVER_VERSION = "0.1.0";

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

/** Default page size for both list tools. */
export const DEFAULT_PAGE_SIZE = 20;

/** Maximum page size for both list tools. */
export const MAX_PAGE_SIZE = 50;
