// Acceptance cover for the node type help copy (NS-P30 part three).
//
// The inspector renders whatever `help` a node_types row carries and invents
// nothing, which means the quality of the panel's language is a property of the
// migrations rather than of any component. This file reads both migrations —
// the NS-P02 seed for the schema shapes, the NS-P30 pass for the copy — and
// holds the copy to the standard the prompt set for it.
//
// Reading the SQL rather than a transcription of it is deliberate, and matches
// what Inspector.test.tsx already does with the seed: a help string edited in
// the migration without being edited here fails in CI rather than in a
// creator's panel.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SEED_SQL = "supabase/migrations/20260823130000_node_type_registry_seed.sql";
const HELP_SQL = "supabase/migrations/20260827130000_node_type_help_copy.sql";

/** The twelve the prompt named, in its order. */
const COVERED_TYPES = [
  "prompt",
  "system_prompt",
  "model_params",
  "agent_config",
  "code",
  "result",
  "screenshot",
  "recording",
  "note",
  "decision",
  "breakage",
  "gap",
];

interface SeedField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  help?: string;
}

/**
 * Every seeded type's field list, read out of the NS-P02 insert.
 *
 * Each row's schema is the single-quoted JSON literal at the end of its VALUES
 * tuple, so the parse looks for `('<key>', ... '{ ... }'::jsonb)` and reads the
 * JSON with JSON.parse rather than with more regex.
 */
function readSeedSchemas(): Map<string, SeedField[]> {
  const sql = readFileSync(SEED_SQL, "utf8");
  const schemas = new Map<string, SeedField[]>();
  const row = /\('([a-z_]+)',[^\n]*?'(\{[\s\S]*?\})'::jsonb\)/g;
  let match: RegExpExecArray | null;
  while ((match = row.exec(sql)) !== null) {
    const [, key, json] = match;
    schemas.set(key, (JSON.parse(json) as { fields: SeedField[] }).fields);
  }
  return schemas;
}

/** The (type, field) -> sentence pairs from the NS-P30 VALUES list. */
function readHelpCopy(): { typeKey: string; fieldKey: string; help: string }[] {
  const sql = readFileSync(HELP_SQL, "utf8");
  // Only the CTE. The verification block below it repeats the pairs without
  // the copy, and must not be read as a second, shorter set.
  const start = sql.indexOf("WITH help_copy");
  const end = sql.indexOf("UPDATE public.node_types");
  expect(start, "the help copy CTE is where this test expects it").toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);

  const cte = sql.slice(start, end);
  const pair = /\('([a-z_]+)',\s*'([a-z_]+)',\s*'((?:[^']|'')*)'\)/g;
  const pairs: { typeKey: string; fieldKey: string; help: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = pair.exec(cte)) !== null) {
    pairs.push({ typeKey: match[1], fieldKey: match[2], help: match[3].replace(/''/g, "'") });
  }
  return pairs;
}

const SEED = readSeedSchemas();
const COPY = readHelpCopy();

describe("the node type help copy", () => {
  it("reads the seed and the copy pass out of their migrations", () => {
    expect(SEED.size).toBe(26);
    expect(COPY.length).toBeGreaterThan(0);
  });

  it("covers every required field of the twelve most-used types", () => {
    const written = new Set(COPY.map((entry) => `${entry.typeKey}.${entry.fieldKey}`));

    for (const typeKey of COVERED_TYPES) {
      const fields = SEED.get(typeKey);
      expect(fields, `${typeKey} is not in the seed migration`).toBeDefined();

      const required = (fields ?? []).filter((field) => field.required === true);
      // Every one of these types has at least one field a creator cannot skip.
      expect(required.length, `${typeKey} declares no required field`).toBeGreaterThan(0);

      for (const field of required) {
        expect(
          written.has(`${typeKey}.${field.key}`),
          `${typeKey}.${field.key} is required and has no plain-language help`
        ).toBe(true);
      }
    }
  });

  it("names only fields that exist and are required", () => {
    for (const { typeKey, fieldKey } of COPY) {
      const field = SEED.get(typeKey)?.find((candidate) => candidate.key === fieldKey);
      expect(field, `${typeKey}.${fieldKey} is not a field in the seed`).toBeDefined();
      // Optional fields keep whatever the seed gave them; this pass is for the
      // fields a creator is stopped by.
      expect(field?.required, `${typeKey}.${fieldKey} is not required`).toBe(true);
    }
  });

  describe("the register it is written in", () => {
    it("is one sentence, addressed to the creator", () => {
      for (const { typeKey, fieldKey, help } of COPY) {
        const where = `${typeKey}.${fieldKey}`;
        expect(help.length, `${where} is too long to read at a glance`).toBeLessThanOrEqual(90);
        expect(help[0], `${where} does not start with a capital`).toBe(help[0].toUpperCase());
        expect(help, `${where} does not end in a full stop or a question mark`).toMatch(/[.?]$/);
      }
    });

    it("never echoes the field's own label back at the creator", () => {
      for (const { typeKey, fieldKey, help } of COPY) {
        const label = SEED.get(typeKey)?.find((field) => field.key === fieldKey)?.label ?? "";
        // "What you decided" under a field called Decision tells nobody
        // anything they could not already read.
        expect(
          help.toLowerCase().includes(label.toLowerCase()),
          `${typeKey}.${fieldKey} repeats its label "${label}"`
        ).toBe(false);
      }
    });

    it("uses no jargon a non-technical creator would have to look up", () => {
      // Words this series has already decided a creator should never meet in
      // the compose panel. The point of the pass is that the copy explains the
      // field instead of naming it in the vocabulary of the schema.
      const jargon = [
        "payload",
        "schema",
        "json",
        "uuid",
        "node_id",
        "media_id",
        "string",
        "boolean",
        "enum",
        "field",
        "parameter",
        "config",
        "system prompt",
        "token",
      ];
      for (const { typeKey, fieldKey, help } of COPY) {
        for (const word of jargon) {
          expect(
            help.toLowerCase().includes(word),
            `${typeKey}.${fieldKey} uses "${word}"`
          ).toBe(false);
        }
      }
    });
  });

  it("changes no key, type or required flag — the migration only sets help", () => {
    const sql = readFileSync(HELP_SQL, "utf8");
    // The one write in this file is a jsonb_set onto '{help}'. Anything setting
    // another path, or replacing the schema wholesale, is a shape change.
    const setPaths = [...sql.matchAll(/jsonb_set\(\s*[^,]+,\s*'(\{[^}]*\})'/g)].map((m) => m[1]);
    expect(setPaths).toContain("{help}");
    expect(setPaths.every((path) => path === "{fields}" || path === "{help}")).toBe(true);
    expect(sql).not.toMatch(/\bALTER TABLE\b|\bDELETE\b|\bINSERT\b|\bDROP\b/i);
  });
});
