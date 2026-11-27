/* MS-00 — the map sandbox's builds, as the composer holds them: steps, session groups, files, `making` and the Result.

   DEV ONLY. Built the way `sandbox.ts` builds its maps (its `step` helper, the same `Step` and `SessionGroup` shapes), so
   every MS prompt and `/dev/map-sandbox` draw from the same builds:

   - `supportInbox`: the build on `design/reference/sandbox/01-finished-map.png` and in
     `examples/support-inbox-triage.for-chat.md`. 9 tiles in 3 sessions and 2 parts; S1 and S2 ran side by side.
   - `fiftyTiles`: 50 tiles in 8 sessions and 3 parts, uses across sessions, two pairs of sessions side by side, an agent
     with 3 children, and a Result.
   - `oneSession`, `noUses`, `removedTile`, `legacy`: the edge cases.

   A Result is not a `Step` (`StepKind` has none): the List draws it from `results` (`ListResult`), so each fixture keeps it
   there, and its id is what a box would hold. */

import type { MapFixture } from "@/dev/fixtures/sandbox";
import { step } from "@/dev/fixtures/sandbox";
import type { SessionGroup, Step, StepKind, Use } from "@/lib/build/graph";
import type { ListResult } from "@/pages/site/compose/buildListModel";

export type MapSandboxName = "supportInbox" | "fiftyTiles" | "oneSession" | "noUses" | "removedTile" | "legacy";

export interface MapSandboxFixture extends MapFixture {
  name: MapSandboxName;
  /** What the dev page's picker says. */
  label: string;
  /** `builds.making`: parts, sessions' titles and stages, and a `map_layout` only where a fixture is about one. */
  making: Record<string, unknown>;
  /** The Result tiles, as the List draws them. */
  results: ListResult[];
}

/* ── helpers ── */

const out = (id: string): Use => ({ kind: "output", node_id: id });
const file = (id: string): Use => ({ kind: "file", node_id: id });
const tool = (id: string): Use => ({ kind: "tool", node_id: id });

const NOUN: Partial<Record<StepKind, string>> = { prompt: "Prompt", file: "File", code: "Code", check: "Check", agent: "Agent", tool: "Tool", manual: "Manual step" };

/** A top-level tile of one session. `title` is the maker's; files and code also take it as their file name. */
function tile(id: string, number: string, kind: StepKind, title: string, session: string, over: Partial<Step> = {}): Step {
  const named = kind === "file" || kind === "code";
  return step({
    id,
    number,
    kind,
    title,
    defaultTitle: `${NOUN[kind] ?? "Step"} ${number}`,
    text: kind === "prompt" ? `${title}.` : "",
    session,
    ...(named ? { filename: title } : null),
    ...(kind === "code" ? { language: "ts", text: "export const refundRules = [\n  { within: 30, refund: true },\n];" } : null),
    ...over,
  });
}

/** A session group as `sessionGroups` gives it: a session made in the composer, keyed `typed-…`. */
function group(key: string, number: number, harness: string, steps: readonly Step[], day: string): SessionGroup {
  return {
    key,
    kind: "typed",
    sessionId: null,
    number,
    tool: harness,
    model: "Opus 5.5",
    startedAt: day,
    stepNumbers: steps.filter((candidate) => candidate.session === key).map((candidate) => candidate.number),
    marked: true,
  };
}

const result = (id: string, title: string, from: string): ListResult => ({
  id,
  title,
  holds: "a link",
  facts: { link: { url: `https://${title.toLowerCase().replace(/\s+/g, "-")}.example/`, site: `${title}.example`, path: "", host: `${title}.example` }, mediaIds: [], file: null, model: null },
  from,
});

/* ── the support inbox triage build ── */

const S1 = "typed-s1";
const S2 = "typed-s2";
const S3 = "typed-s3";

function supportInbox(): MapSandboxFixture {
  const steps: Step[] = [
    tile("p1", "1", "prompt", "Label the last 200 emails", S1),
    tile("f2", "2", "file", "labels.json", S1, { uses: [out("p1")] }),
    tile("p3", "3", "prompt", "Merge the refund rules", S1, { uses: [file("f2"), out("p4")] }),
    tile("p4", "4", "prompt", "Write the refund rules", S2),
    tile("c5", "5", "code", "refundRules.ts", S2, { uses: [out("p4")] }),
    tile("k6", "6", "check", "Rules pass 30 cases", S2, {
      uses: [out("c5")],
      check: { tested: "refundRules.ts", passing: "Every case gets the refund the policy gives.", onFail: null, passed: 30, total: 30, runAt: "2026-11-20" },
    }),
    tile("a7", "7", "agent", "Reply drafter", S3, { text: "Draft a reply to each labelled email.", uses: [out("p3"), tool("t8")] }),
    tile("t8", "8", "tool", "Gmail", S3, { tool: "Gmail" }),
  ];
  const groups = [group(S1, 1, "Claude Code", steps, "2026-11-18"), group(S2, 2, "Cursor", steps, "2026-11-18"), group(S3, 3, "Claude Code", steps, "2026-11-20")];
  return {
    name: "supportInbox",
    label: "Support inbox triage",
    steps,
    groups,
    files: [],
    results: [result("r9", "Support inbox", "7")],
    selectedId: "p3",
    making: {
      workstreams: [{ key: "ws-a", name: "Classify and rules" }, { key: "ws-b", name: "Draft and send" }],
      part_labels: "letters",
      session_order: [S1, S2, S3],
      sessions_meta: {
        [S1]: { tool: "claude-code", date: "2026-11-18", title: "Classify", workstream: "ws-a" },
        [S2]: { tool: "cursor", date: "2026-11-18", title: "Refund rules", workstream: "ws-a", withAbove: true },
        [S3]: { tool: "claude-code", date: "2026-11-20", title: "Draft and send", workstream: "ws-b" },
      },
    },
  };
}

/* ── fifty tiles ── */

/** Tiles per session; with the Result, 50. */
const FIFTY_SIZES = [7, 6, 6, 7, 6, 6, 6, 5];
/** Parts by session index: A holds S1 to S3, B holds S4 and S5, C holds S6 to S8. */
const FIFTY_PARTS = ["ws-a", "ws-a", "ws-a", "ws-b", "ws-b", "ws-c", "ws-c", "ws-c"];
/** Sessions that ran beside the one above them: S2 beside S1, S5 beside S4. */
const FIFTY_BESIDE = new Set([1, 4]);
const KINDS: StepKind[] = ["prompt", "file", "prompt", "code", "check", "prompt", "tool"];

function fiftyTiles(): MapSandboxFixture {
  const steps: Step[] = [];
  const keys = FIFTY_SIZES.map((_, at) => `typed-f${at + 1}`);
  let number = 0;
  FIFTY_SIZES.forEach((count, at) => {
    const session = keys[at];
    const first = steps.length;
    for (let place = 0; place < count; place += 1) {
      number += 1;
      const last = at === FIFTY_SIZES.length - 1 && place === count - 1;
      const kind: StepKind = last ? "agent" : KINDS[place % KINDS.length];
      const id = `n${number}`;
      const uses: Use[] = [];
      // Each tile uses the one before it in its session; a check tests it.
      if (place > 0) uses.push(out(steps[steps.length - 1].id));
      // The first tile of a session that ran after another uses that session's last tile: a use across sessions.
      if (place === 0 && at > 0 && !FIFTY_BESIDE.has(at)) uses.push(out(steps[first - 1].id));
      const title = kind === "file" ? `notes-${number}.md` : kind === "code" ? `step${number}.ts` : kind === "tool" ? "GitHub" : `Tile ${number}`;
      const extra: Partial<Step> = kind === "tool" ? { tool: "GitHub" } : {};
      if (last) {
        extra.children = [1, 2, 3].map((inner) => step({ id: `${id}.${inner}`, number: `${number}.${inner}`, defaultTitle: `Prompt ${number}.${inner}`, text: `Part ${inner} of the agent's job.` }));
        extra.text = "Put the parts together.";
      }
      steps.push(tile(id, String(number), kind, title, session, { uses, ...extra }));
    }
  });
  // Two uses that reach further across: S6's third tile uses S2's last, and S8's second uses S4's fourth.
  steps[FIFTY_SIZES.slice(0, 5).reduce((a, b) => a + b, 0) + 2].uses.push(out(steps[FIFTY_SIZES[0] + FIFTY_SIZES[1] - 1].id));
  steps[FIFTY_SIZES.slice(0, 7).reduce((a, b) => a + b, 0) + 1].uses.push(out(steps[FIFTY_SIZES.slice(0, 3).reduce((a, b) => a + b, 0) + 3].id));
  const groups = keys.map((key, at) => group(key, at + 1, at % 2 ? "Cursor" : "Claude Code", steps, `2026-11-${String(10 + at).padStart(2, "0")}`));
  const agent = steps[steps.length - 1];
  return {
    name: "fiftyTiles",
    label: "50 tiles",
    steps,
    groups,
    files: [],
    results: [result("r50", "Release notes", agent.number)],
    selectedId: agent.id,
    making: {
      workstreams: [{ key: "ws-a", name: "Research" }, { key: "ws-b", name: "Build" }, { key: "ws-c", name: "Ship" }],
      session_order: keys,
      sessions_meta: Object.fromEntries(
        keys.map((key, at) => [key, { tool: at % 2 ? "cursor" : "claude-code", date: `2026-11-${String(10 + at).padStart(2, "0")}`, title: `Session ${at + 1}`, workstream: FIFTY_PARTS[at], ...(FIFTY_BESIDE.has(at) ? { withAbove: true } : null) }]),
      ),
    },
  };
}

/* ── edge cases ── */

const ONE = "typed-one";

function oneSessionSteps(): Step[] {
  return [
    tile("q1", "1", "prompt", "Sketch the landing page", ONE),
    tile("q2", "2", "prompt", "Write the copy", ONE, { uses: [out("q1")] }),
    tile("q3", "3", "code", "Landing.tsx", ONE, { uses: [out("q2")] }),
    tile("q4", "4", "check", "Looks right on a phone", ONE, { uses: [out("q3")] }),
  ];
}

function oneSession(): MapSandboxFixture {
  const steps = oneSessionSteps();
  return {
    name: "oneSession",
    label: "One session",
    steps,
    groups: [group(ONE, 1, "Claude Code", steps, "2026-11-02")],
    files: [],
    results: [],
    making: { session_order: [ONE], sessions_meta: { [ONE]: { tool: "claude-code", date: "2026-11-02" } } },
  };
}

function noUses(): MapSandboxFixture {
  const keys = ["typed-u1", "typed-u2", "typed-u3"];
  const steps = keys.map((key, at) => tile(`u${at + 1}`, String(at + 1), "prompt", `Draft idea ${at + 1}`, key));
  return {
    name: "noUses",
    label: "No uses",
    steps,
    groups: keys.map((key, at) => group(key, at + 1, "Claude Code", steps, "2026-11-03")),
    files: [],
    results: [],
    making: {
      session_order: keys,
      sessions_meta: Object.fromEntries(keys.map((key, at) => [key, { tool: "claude-code", date: "2026-11-03", ...(at > 0 ? { withAbove: true } : null) }])),
    },
  };
}

/** The tile id `removedTile`'s layout still names, which the build no longer has. */
export const REMOVED_TILE_ID = "q-gone";

function removedTile(): MapSandboxFixture {
  const base = oneSession();
  return {
    ...base,
    name: "removedTile",
    label: "A removed tile",
    making: {
      ...base.making,
      map_layout: {
        v: 1,
        width: 960,
        background: "grey",
        dotGrid: true,
        numbers: "build",
        root: {
          kind: "split",
          id: "m-root",
          dir: "down",
          sizes: [0, 0],
          children: [
            { kind: "box", id: "m-top", tiles: ["q1", REMOVED_TILE_ID, "q2"], layout: "stack", indent: {}, show: {}, notes: { [REMOVED_TILE_ID]: "This one was cut." } },
            { kind: "box", id: "m-bottom", tiles: ["q3", "q4"], layout: "across", indent: {}, show: {}, notes: {} },
          ],
        },
        outlines: [],
        twoWay: [],
        twoWayDismissed: [],
        hiddenLinks: [],
        linkGutters: {},
      },
    },
  };
}

/** An old build: its prompts were typed by hand before sessions were stored, so `sessionGroups` reads one session per run. */
function legacy(): MapSandboxFixture {
  const steps: Step[] = [
    step({ id: "l1", number: "1", text: "Outline a short story about a lighthouse keeper." }),
    step({ id: "l2", number: "2", text: "Write the first scene.", uses: [out("l1")] }),
    step({ id: "l3", number: "3", text: "Make the ending quieter.", uses: [out("l2")] }),
  ];
  const run = (n: number, numbers: string[]): SessionGroup => ({ key: `typed-legacy-${n}`, kind: "legacy", sessionId: null, number: n, tool: null, model: null, startedAt: "typed here", stepNumbers: numbers });
  return {
    name: "legacy",
    label: "An old build",
    steps,
    groups: [run(1, ["1", "2"]), run(2, ["3"])],
    files: [],
    results: [],
    making: {},
  };
}

/* ── the list ── */

const MAKERS: Record<MapSandboxName, () => MapSandboxFixture> = { supportInbox, fiftyTiles, oneSession, noUses, removedTile, legacy };

export const MAP_SANDBOX_NAMES = Object.keys(MAKERS) as MapSandboxName[];

/** One fixture, made fresh, so a page or a test can change it without touching the next. */
export function mapSandboxFixture(name: MapSandboxName = "supportInbox"): MapSandboxFixture {
  return MAKERS[name]();
}
