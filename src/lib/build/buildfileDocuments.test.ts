// The two public kit documents, and the two promises made about them (BG-P24).
//
// WHY A TEST OVER FILES ON DISK RATHER THAN OVER CODE. Neither of these
// documents is imported by anything: they are static assets under public/,
// fetched over HTTP by /import and read by a chatbot rather than by this
// application. Nothing in a normal build or test run would notice if one of
// them were edited, renamed or deleted — which is exactly why the two things
// that must stay true about them are asserted here.
//
// PROMISE ONE — BOTH NAMES SERVE, AND THEY SERVE THE SAME BYTES.
//
// The documents were called NEOSCALE_EXTRACTOR.md and NEOSCALE_COMPILER.md.
// BG-P24 renames the product's visible name to buildgallery, so the canonical
// files are BUILDGALLERY_*.md — but a creator who downloaded one, bookmarked
// one, or pasted one into a chat months ago is holding the old URL, and this
// page is not the only place those URLs exist. A renamed static asset turns
// every one of them into a 404 for no benefit anyone can see. So all four
// files exist and each pair is byte-identical: editing one half of a pair and
// not the other fails here rather than silently shipping two Extractors that
// tell people different things.
//
// PROMISE TWO — `neoscale_build` DOES NOT MOVE.
//
// A filename is a WORD: something a person reads, and therefore something a
// rebrand may change. `neoscale_build` is an IDENTIFIER: the parser matches on
// it to decide whether a dropped file is a Build File at all
// (src/lib/build/buildfile.ts), and EVERY Build File any creator has ever been
// handed carries it — including every one these documents have already told
// people to produce. Renaming it would refuse all of them. The distinction is
// the whole reason this file exists, and it is asserted from both directions:
// the key is present in the document, and no visible mention of the old
// product name survives anywhere else in either one.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PORTABLE_FORMAT_VERSION } from "@/lib/build/portable";

const DIR = join(process.cwd(), "public", "buildfile");
const SRC = join(process.cwd(), "src", "lib", "build");

/**
 * The key, spelled out here rather than imported.
 *
 * The parser exports no constant for it, and this prompt may not add one:
 * `buildfile.ts` reads `envelope.neoscale_build` as a property access, and
 * introducing a named constant would be a change to the parser, which BG-P24
 * is forbidden to make. So the spelling is written here and then checked
 * against the parser's and the serialiser's own source below — which proves
 * the same thing an imported constant would, without touching either file.
 */
const FORMAT_KEY = "neoscale_build";

const read = (name: string) => readFileSync(join(DIR, name), "utf8");

/** Canonical name → the retired name that must keep serving it. */
const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["BUILDGALLERY_EXTRACTOR.md", "NEOSCALE_EXTRACTOR.md"],
  ["BUILDGALLERY_COMPILER.md", "NEOSCALE_COMPILER.md"],
];

describe("the public Build File documents", () => {
  it.each(PAIRS)("serves %s and keeps %s serving the same bytes", (current, retired) => {
    const canonical = read(current);
    expect(canonical.length).toBeGreaterThan(0);
    // Byte-for-byte, not "roughly the same": two Extractors that have drifted
    // apart are two sets of instructions producing two shapes of file.
    expect(read(retired)).toBe(canonical);
  });

  it("calls the product buildgallery everywhere a person reads it", () => {
    for (const [current] of PAIRS) {
      const body = read(current);
      expect(body).toContain("buildgallery");

      // Every remaining mention of the old name must be the format key and
      // nothing else — not a heading, not a filename in an example, not a
      // sentence. Lines carrying the key are removed before the check so the
      // one legitimate occurrence cannot mask an illegitimate one.
      const prose = body
        .split("\n")
        .filter((line) => !line.includes(FORMAT_KEY))
        .join("\n");
      expect(prose.toLowerCase()).not.toContain("neoscale");
    }
  });

  it("leaves the format key exactly as every file in the wild carries it", () => {
    // The document tells a chatbot to emit it...
    expect(read("BUILDGALLERY_EXTRACTOR.md")).toContain(
      `"${FORMAT_KEY}": ${PORTABLE_FORMAT_VERSION}`,
    );
    // ...and so does the copy the old URL serves, which is the same assertion
    // made from the other side of the pair.
    expect(read("NEOSCALE_EXTRACTOR.md")).toContain(
      `"${FORMAT_KEY}": ${PORTABLE_FORMAT_VERSION}`,
    );

    // ...the parser still reads that key to decide what it has been handed...
    const parser = readFileSync(join(SRC, "buildfile.ts"), "utf8");
    expect(parser).toContain(`envelope.${FORMAT_KEY}`);

    // ...and the exporter still writes it, so a file this product produces is
    // a file this product can read back. If a later prompt renames the key, it
    // has to come through here and say so deliberately — which is the point.
    const exporter = readFileSync(join(SRC, "portable.ts"), "utf8");
    expect(exporter).toContain(`${FORMAT_KEY}: PORTABLE_FORMAT_VERSION`);
  });
});
