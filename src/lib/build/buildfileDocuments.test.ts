// The two public kit documents, and what must stay true about them (BG-P24, rewritten by UX-14).
//
// WHY A TEST OVER FILES ON DISK RATHER THAN OVER CODE. Neither document is imported by anything: they are static assets under
// public/, fetched over HTTP by /import and read by a chatbot rather than by this application. Nothing in a normal build or test
// run would notice if one were edited, renamed or deleted, which is why what must stay true is asserted here.
//
// UX-14 renamed the site to OpenBuilds.ai and, with it, the Build File: the documents are OPENBUILDS_EXTRACTOR.md and
// OPENBUILDS_COMPILER.md, the key inside the format is `openbuilds_build`, and the four older files (BUILDGALLERY_* and
// NEOSCALE_*) are gone. Only Miles had used them. The importer still reads the older `neoscale_build` key, so his earlier exports
// import (one line in buildfile.ts, tested in buildfile.test.ts).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PORTABLE_FORMAT_VERSION } from "@/lib/build/portable";

const DIR = join(process.cwd(), "public", "buildfile");
const SRC = join(process.cwd(), "src", "lib", "build");

/** The key, spelled out here and checked against the parser's and the serialiser's own source below. */
const FORMAT_KEY = "openbuilds_build";

const read = (name: string) => readFileSync(join(DIR, name), "utf8");

const DOCUMENTS = ["OPENBUILDS_EXTRACTOR.md", "OPENBUILDS_COMPILER.md"] as const;
const RETIRED = ["BUILDGALLERY_EXTRACTOR.md", "BUILDGALLERY_COMPILER.md", "NEOSCALE_EXTRACTOR.md", "NEOSCALE_COMPILER.md"] as const;

describe("the public Build File documents", () => {
  it.each(DOCUMENTS)("serves %s", (name) => {
    expect(read(name).length).toBeGreaterThan(0);
  });

  it.each(RETIRED)("no longer serves %s", (name) => {
    expect(existsSync(join(DIR, name))).toBe(false);
  });

  it("calls the product OpenBuilds.ai everywhere a person reads it, and never the older names", () => {
    for (const name of DOCUMENTS) {
      const body = read(name);
      expect(body).toContain("OpenBuilds.ai");
      expect(body.toLowerCase()).not.toMatch(/neoscale|buildgallery/);
    }
  });

  it("tells a chatbot to write the key and the extension the exporter writes", () => {
    const extractor = read("OPENBUILDS_EXTRACTOR.md");
    expect(extractor).toContain(`"${FORMAT_KEY}": ${PORTABLE_FORMAT_VERSION}`);
    expect(extractor).toContain(".openbuilds.md");

    // The parser reads the key by name, and the exporter writes it, so a file this product produces is a file it can read back.
    expect(readFileSync(join(SRC, "buildfile.ts"), "utf8")).toContain(`envelope.${FORMAT_KEY}`);
    expect(readFileSync(join(SRC, "portable.ts"), "utf8")).toContain(`${FORMAT_KEY}: PORTABLE_FORMAT_VERSION`);
  });
});
