// =============================================================================
// NeoScale — the registered readers (NS-P20a)
// =============================================================================
// The one list. Registering a reader is adding a line to it.
//
//   1. Write the reader beside these two, exporting an IntakeReader with a
//      READER_VERSION and a SCHEMA_PROVENANCE recording where each schema it
//      reads was read from and when.
//   2. Import it here and add it to the array below.
//
// That is the whole registration. There is no side-effecting self-registration
// by import, deliberately: a registry you assemble by importing modules for
// their side effects is a registry whose contents depend on import order, and
// this one is read in confidence order with ties broken by position.
//
// ORDER MATTERS. Readers with a schema come first; the transcript reader is
// last because it is the fallback — text is what is left when nothing else
// claims a file. Ties go to the earlier entry, so the fallback is never reached
// while a more specific reader has an equal claim.
// =============================================================================

import { createReaderRegistry, ReaderRegistry } from "../registry.ts";
import { lovableReader } from "./lovable.ts";
import { transcriptReader } from "./transcript.ts";

export { lovableReader } from "./lovable.ts";
export { transcriptReader } from "./transcript.ts";

/** Every reader NeoScale reads intake with, most specific first. */
export const INTAKE_READERS = [lovableReader, transcriptReader];

/**
 * The registry the platform routes with.
 *
 * A fresh one, rather than a module-level singleton mutated by whoever imports
 * it: a caller wanting a different set — a test, or a surface that offers only
 * one reader — builds its own with createReaderRegistry.
 */
export function intakeRegistry(): ReaderRegistry {
  return createReaderRegistry(INTAKE_READERS);
}
