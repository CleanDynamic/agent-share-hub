// UX-12 P1 and P3: the legal text is data, and these checks hold it to the rules the prompt sets.
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { privacy } from "./privacy";
import { PRIVACY_REVIEWED, TERMS_REVIEWED } from "./reviewed";
import { terms } from "./terms";
import { NEED_PATTERN, textsOf, type LegalText } from "./types";

const INVENTORY = fs.readFileSync(path.resolve(__dirname, "../../../design/legal/data-inventory.md"), "utf8");
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const BANNED = [/—/, /herein/i, /hereinafter/i, /\bthe service\b/i];

const texts: Array<[string, LegalText]> = [
  ["privacy", privacy],
  ["terms", terms],
];

/** The services the inventory lists between its markers. */
function inventoryServices(): string[] {
  const body = INVENTORY.split("<!-- services:start -->")[1]?.split("<!-- services:end -->")[0] ?? "";
  return body
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .slice(2)
    .map((line) => line.split("|")[1].trim());
}

describe.each(texts)("%s content", (_name, text) => {
  it("has the shape of a LegalText", () => {
    expect(typeof text.title).toBe("string");
    expect(text.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(text.lastUpdated))).toBe(false);
    expect(typeof text.reviewed).toBe("boolean");
    expect(text.sections.length).toBeGreaterThan(0);
    for (const section of text.sections) {
      expect(section.blocks.length, section.id).toBeGreaterThan(0);
      for (const block of section.blocks) {
        if (block.kind === "table") for (const row of block.rows) expect(row.length, section.id).toBe(block.head.length);
      }
    }
  });

  it("gives every section a unique kebab-case id", () => {
    const ids = text.sections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(KEBAB);
  });

  it("has no em dash, herein, hereinafter or 'the service'", () => {
    for (const said of textsOf(text)) for (const banned of BANNED) expect(said, said).not.toMatch(banned);
  });

  it("never names buildgallery", () => {
    for (const said of textsOf(text)) expect(said.toLowerCase(), said).not.toContain("buildgallery");
  });
});

describe("the Privacy policy and the inventory", () => {
  const sharing = privacy.sections.find((section) => section.id === "who-we-share-with");
  const table = sharing?.blocks.find((block) => block.kind === "table");
  const listed = table && table.kind === "table" ? table.rows.map((row) => row[0]) : [];

  it("lists every outside service of the inventory in the sharing table, and nothing else", () => {
    expect(inventoryServices().length).toBeGreaterThan(5);
    expect([...listed].sort()).toEqual([...inventoryServices()].sort());
  });

  it("has the twelve sections of the prompt, in order", () => {
    expect(privacy.sections.map((section) => section.id)).toEqual([
      "who-we-are",
      "the-short-version",
      "what-we-collect",
      "what-is-public",
      "ai-processing",
      "who-we-share-with",
      "data-outside-the-uk",
      "how-long-we-keep-it",
      "your-rights",
      "cookies-and-browser-storage",
      "children",
      "changes",
    ]);
  });
});

describe("the Terms", () => {
  const livePayment = /<!--\s*live-payment:\s*yes\s*-->/.test(INVENTORY);

  it("has a Payments section only if the inventory recorded a live payment", () => {
    const has = terms.sections.some((section) => /payments/i.test(section.heading));
    expect(has).toBe(livePayment);
  });
});

describe("a text marked reviewed (UX-12 P3)", () => {
  it("keeps its flag in reviewed.ts", () => {
    expect(privacy.reviewed).toBe(PRIVACY_REVIEWED);
    expect(terms.reviewed).toBe(TERMS_REVIEWED);
  });

  it.each(texts)("%s: fails the build if reviewed and a {{NEED: remains", (_name, text) => {
    if (!text.reviewed) return;
    const left = textsOf(text).flatMap((said) => said.match(NEED_PATTERN) ?? []);
    expect(left).toEqual([]);
  });

  it("would catch a placeholder in a reviewed text", () => {
    const draft: LegalText = { ...privacy, reviewed: true };
    const left = textsOf(draft).flatMap((said) => said.match(NEED_PATTERN) ?? []);
    expect(left.length).toBeGreaterThan(0);
  });
});
