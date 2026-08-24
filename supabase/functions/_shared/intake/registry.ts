// =============================================================================
// NeoScale — the reader registry (NS-P20a)
// =============================================================================
// Maps registered readers to their detect results, so a file can be routed
// without the caller knowing which readers exist.
//
// The point is the ignorance. Today the client decides between parse-transcript
// and parse-lovable with its own copy of the detection logic (src/lib/build/
// lovable.ts, `detectExportSource`), which means every reader added after this
// one is two edits in two languages that have to agree or a creator gets routed
// to a function that cannot read their file. A registry is one edit: register
// the reader, and routing follows.
//
// ROUTING IS A READING, NOT AN ERROR. Every reader answers every file, and the
// answers are ranked. A reader that says "not mine" says it with a confidence
// and a reason rather than by throwing, which is what lets the caller show a
// creator why their file went where it went.
//
// TIES GO TO REGISTRATION ORDER, deliberately. The sort is stable, so a
// registry whose last reader is a universal fallback routes to a specific
// reader whenever one bids equally — and never routes to the fallback while
// anything more specific has a claim.
// =============================================================================

import type { ParseOptions } from "./envelope.ts";
import type { Detection, IntakeFile, IntakeReader, ReaderResult } from "./reader.ts";

/** One reader's bid for a file. */
export interface Routing {
  reader: IntakeReader;
  detection: Detection;
}

/**
 * Below this a bid is not a claim. A reader that returns 0 is saying "certainly
 * not mine", and routing to it anyway would produce a proposal nobody can act
 * on. Any reader wanting to be the last resort should bid low, not zero.
 */
export const ROUTING_FLOOR = 0.05;

export class ReaderRegistry {
  readonly #readers: IntakeReader[] = [];

  constructor(readers: IntakeReader[] = []) {
    for (const reader of readers) this.register(reader);
  }

  /**
   * Add a reader. Registering the same id twice REPLACES the first, in place,
   * so a caller assembling a registry from several modules cannot end up
   * consulting two versions of the same reader and taking the better bid.
   */
  register(reader: IntakeReader): this {
    const existing = this.#readers.findIndex((candidate) => candidate.id === reader.id);
    if (existing >= 0) this.#readers[existing] = reader;
    else this.#readers.push(reader);
    return this;
  }

  /** Registered readers, in registration order. */
  readers(): IntakeReader[] {
    return [...this.#readers];
  }

  reader(id: string): IntakeReader | null {
    return this.#readers.find((candidate) => candidate.id === id) ?? null;
  }

  /**
   * Every reader's answer for this file, best bid first.
   *
   * All of them, including the refusals: a caller that wants to explain a
   * routing decision needs the losing reasons as much as the winning one.
   */
  detect(file: IntakeFile): Routing[] {
    return this.#readers
      .map((reader) => ({ reader, detection: reader.detect(file) }))
      // Stable, so equal bids stay in registration order.
      .sort((a, b) => b.detection.confidence - a.detection.confidence);
  }

  /** The reader this file belongs to, or null when nothing claimed it. */
  route(file: IntakeFile): Routing | null {
    const [best] = this.detect(file);
    return best && best.detection.confidence >= ROUTING_FLOOR ? best : null;
  }

  /**
   * Route and read, in one call.
   *
   * Null means no registered reader claimed the file, which is a real answer
   * and not an error — the caller decides what to tell the creator. It cannot
   * happen in a registry holding a universal fallback, which the one in
   * readers/index.ts does.
   */
  read(file: IntakeFile, options: ParseOptions): ReaderResult | null {
    const routing = this.route(file);
    return routing ? routing.reader.parse(file, options) : null;
  }
}

export function createReaderRegistry(readers: IntakeReader[] = []): ReaderRegistry {
  return new ReaderRegistry(readers);
}
