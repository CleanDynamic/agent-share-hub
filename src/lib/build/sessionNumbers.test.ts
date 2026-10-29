// SV-05 P1: the one session numbering, and the checks that nothing else works a number out.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it, vi } from "vitest";

import * as numbering from "./sessionNumbers";

vi.mock("./sessionNumbers", async (actual) => {
  const real = await actual<typeof import("./sessionNumbers")>();
  return { ...real, numberSessions: vi.fn(real.numberSessions) };
});

const { nextSessionNumber, numberSessions } = numbering;

const ROOT = process.cwd();
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const SHIPPED = walk(join(ROOT, "src")).map((path) => ({ rel: relative(ROOT, path).split(sep).join("/"), code: stripComments(readFileSync(path, "utf8")) }));

describe("numberSessions", () => {
  const at = (key: string, firstTile: number | null) => ({ key, firstTile });

  it("numbers from the order, a session it does not hold where its first tile stands, one with no tiles counted too", () => {
    const numbers = numberSessions([at("a", 0), at("b", 1), at("loose", 2), at("c", 3), at("empty", null)], ["c", "b", "a", "empty"]);
    expect(numbers.keys).toEqual(["c", "b", "loose", "a", "empty"]);
    expect([...numbers.numberOf.values()]).toEqual([1, 2, 3, 4, 5]);
  });

  it("puts the parts in their order, each part's sessions in the order", () => {
    const parts = { meta: { a: { workstream: "ws-2" }, b: { workstream: "ws-1" }, c: { workstream: "ws-2" } }, workstreams: [{ key: "ws-1" }, { key: "ws-2" }] };
    const numbers = numberSessions([at("a", 0), at("b", 1), at("c", null)], ["a", "b", "c"], parts);
    expect(numbers.keys).toEqual(["b", "a", "c"]);
    expect(numbers.partOf.get("c")).toBe("ws-2");
  });

  it("gives a new session the next place at the end of its part, never a number already held", () => {
    const parts = { meta: { a: { workstream: "ws-1" }, b: { workstream: "ws-2" }, c: { workstream: "ws-2" } }, workstreams: [{ key: "ws-1" }, { key: "ws-2" }] };
    expect(nextSessionNumber(["a", "b", "c"], parts)).toBe(4);
    expect(nextSessionNumber(["a", "b", "c"], parts, "ws-1")).toBe(2);
    expect(nextSessionNumber(["a", "b"], { meta: {}, workstreams: [] })).toBe(3);
  });

  it("is built once per change of the order: one call for every group the page builds", async () => {
    vi.resetModules();
    const fresh = { graph: await import("./graph"), numbering: await import("./sessionNumbers") };
    const node = (id: string, position: number, session: string) => ({ id, build_id: "b", parent_id: null, position, type: "prompt", title: null, note: null, payload: { text: id, session }, source_ref: null, is_gap: false, event_id: null, created_at: "" });
    const steps = fresh.graph.buildSteps([node("n1", 0, "typed-a"), node("n2", 1, "typed-b"), node("n3", 2, "typed-c")] as never[]);
    const meta = { "typed-a": { tool: "claude", date: "2026-10-01" }, "typed-b": { tool: "claude", date: "2026-10-02" }, "typed-c": { tool: "claude", date: "2026-10-03" } };
    const spy = vi.mocked(fresh.numbering.numberSessions);
    spy.mockClear();
    fresh.graph.sessionGroups(steps, [], {}, meta, ["typed-c", "typed-a", "typed-b"]);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("no other numbering (source checks)", () => {
  it("is pure: no React, no Supabase", () => {
    const code = readFileSync(join(ROOT, "src/lib/build/sessionNumbers.ts"), "utf8");
    expect(code).not.toMatch(/from "react"|supabase/);
  });

  it("only the one function hands out session numbers", () => {
    const callers = SHIPPED.filter((file) => /\bnumberSessions\(/.test(file.code) && file.rel !== "src/lib/build/sessionNumbers.ts").map((file) => file.rel);
    // SV-21: OpenBuilds names a requested session by this same function, from the build's `making` (sessionNumbers.ts says it may).
    expect(callers.sort()).toEqual(["src/lib/build/graph.ts", "src/pages/site/compose/composeModel.ts", "src/pages/site/openbuilds/openBuildsModel.ts"]);
    const graph = SHIPPED.find((file) => file.rel === "src/lib/build/graph.ts")?.code ?? "";
    expect(graph).not.toMatch(/\+\+numbered|numberedAgain/);
    // A number worked out from a place in a list, or as the largest so far plus one.
    // Demo data (`src/dev/fixtures/`) names sessions in titles; it shows no number.
    const offenders = SHIPPED.filter((file) => !file.rel.startsWith("src/dev/fixtures/")).filter((file) => /Session \$\{\s*\w+ \+ 1\s*\}|Math\.max\(0, \.\.\.groups[^)]*\.number\)\s*\)\s*\+ 1/.test(file.code)).map((file) => file.rel);
    expect(offenders).toEqual([]);
  });

  it("no effect copies a session number or count into state", () => {
    const effects = SHIPPED.filter((file) => file.rel.startsWith("src/pages/site/compose/")).flatMap((file) =>
      [...file.code.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n {2,4}\}, \[/g)].filter((match) => /\bset\w*(Number|Count)s?\(/.test(match[1])).map(() => file.rel),
    );
    expect(effects).toEqual([]);
  });
});
