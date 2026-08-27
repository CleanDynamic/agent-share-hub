// Acceptance cover for the Build File parser (NS-P32).
//
// The claim under test is a TOLERANCE claim with a hard edge on either side of
// it, and the file is organised around proving both edges rather than only the
// comfortable one:
//
//   What gets in. A file this parser accepts must survive the trip — every
//   node, every event, and every payload key, including the keys the registry
//   has never heard of. Several tests below assert on what ended up in a node's
//   NOTE rather than on what parsed, because the note is where the parser puts
//   what it could not type, and a test that only checked the payload would pass
//   just as happily against a parser that deleted the rest.
//
//   What stays out. The four refusals are asserted as refusals, not as empty
//   proposals. A file over the node cap, a version this code cannot read and a
//   file that is not JSON must come back `ok: false`, because a creator told
//   "imported, 0 nodes" has been misled about a file that is actually fine.
//
// The last test is the round trip: a record goes through toPortable and comes
// back through parseBuildFile, and the counts have to match with NO warnings at
// all. That is the one case where a warning is itself a defect — the site
// wrote the file, so anything the parser wants to complain about is a
// disagreement between two modules in this repository rather than a fault in
// the creator's input.

import { describe, expect, it } from "vitest";

import {
  MAX_BUILDFILE_NODES,
  buildFileRefused,
  extractEnvelope,
  parseBuildFile,
  scanForSecrets,
  type BuildFileEventPayload,
  type BuildFileResult,
  type BuildFileSuccess,
} from "@/lib/build/buildfile";
import { PORTABLE_FORMAT_VERSION, toPortable } from "@/lib/build/portable";
import type {
  Build,
  BuildEvent,
  BuildRecord,
  FieldDef,
  NodeTree,
  NodeType,
} from "@/lib/build/types";

// --- the registry ------------------------------------------------------------
//
// Four of the twenty-six seeded types, with the schemas the NS-P02 seed gives
// them. Transcribed rather than read out of the SQL because the point here is
// the parser's behaviour against A registry, not the contents of the real one.

function nodeType(key: string, fields: FieldDef[]): NodeType {
  return {
    key,
    label: key,
    category: "instruction",
    colour: "#E8571A",
    icon: "Square",
    renderer: "default",
    copyable: false,
    is_active: true,
    sort: 1,
    schema: { fields },
  } as NodeType;
}

const REGISTRY: NodeType[] = [
  nodeType("prompt", [
    { key: "text", label: "Prompt text", type: "text", required: true },
    {
      key: "variables",
      label: "Variables",
      type: "list",
      of: [
        { key: "name", label: "Name", type: "string" },
        { key: "example", label: "Example", type: "string" },
      ],
    },
    { key: "model", label: "Model", type: "string" },
  ]),
  nodeType("model_params", [
    { key: "model", label: "Model", type: "string", required: true },
    { key: "temperature", label: "Temperature", type: "number" },
    { key: "max_tokens", label: "Max tokens", type: "number" },
  ]),
  nodeType("code", [
    {
      key: "language",
      label: "Language",
      type: "enum",
      options: ["ts", "python", "sql", "other"],
    },
    { key: "source", label: "Source", type: "text", required: true },
    { key: "entrypoint", label: "Entrypoint", type: "boolean" },
  ]),
  nodeType("note", [{ key: "body", label: "Note", type: "text", required: true }]),
];

// --- helpers -----------------------------------------------------------------

function envelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    neoscale_build: PORTABLE_FORMAT_VERSION,
    exported_at: "2026-08-27T09:00:00.000Z",
    source_url: "https://neoscaleai.com/b2/a-build",
    build: { title: "A build", outcome: "It works" },
    nodes: [],
    events: [],
    ...overrides,
  };
}

function parse(
  value: Record<string, unknown> | string,
  registry: NodeType[] = REGISTRY
): BuildFileResult {
  return parseBuildFile(
    typeof value === "string" ? value : JSON.stringify(value, null, 2),
    registry,
    { sessionId: "session-under-test" }
  );
}

/**
 * Narrows, and fails with the parser's own errors rather than "undefined".
 *
 * Goes through buildFileRefused rather than `result.ok` because this project
 * compiles without strictNullChecks, where a boolean discriminant does not
 * narrow. Every consumer of this module has the same constraint, so the tests
 * exercise the same route NS-P34 will have to take.
 */
function expectOk(result: BuildFileResult): BuildFileSuccess {
  if (buildFileRefused(result)) {
    throw new Error(
      `Expected the file to parse. Errors: ${result.errors
        .map((error) => `${error.code} — ${error.message}`)
        .join("; ")}`
    );
  }
  return result;
}

/** The errors of a file that must NOT have parsed. */
function expectRefused(result: BuildFileResult) {
  if (!buildFileRefused(result)) {
    throw new Error("Expected this file to be refused, but it parsed.");
  }
  return result.errors;
}

/** Event payloads carry keys ProposedEvent does not declare. See the module. */
function payloadOf(result: BuildFileSuccess, index: number): BuildFileEventPayload {
  return result.proposal.events[index].payload as BuildFileEventPayload;
}

function codes(result: BuildFileResult): string[] {
  return result.ok ? result.meta.warnings.map((warning) => warning.code) : [];
}

// =============================================================================

describe("extractEnvelope", () => {
  it("reads a bare JSON object", () => {
    expect(extractEnvelope('{"neoscale_build": 1}')).toEqual({ neoscale_build: 1 });
  });

  it("reads the object out of a fenced block with prose on both sides", () => {
    const file = [
      "Here is the build I pulled out of that session. It has two steps and",
      "one breakage, and I have left the API key out of it.",
      "",
      "```json",
      '{ "neoscale_build": 1, "build": { "title": "Fenced" } }',
      "```",
      "",
      "Paste that into NeoScale's import page.",
    ].join("\n");

    expect(extractEnvelope(file)).toEqual({
      neoscale_build: 1,
      build: { title: "Fenced" },
    });
  });

  it("takes the first fence whose content parses, not the first fence", () => {
    const file = [
      "```text",
      "not json at all",
      "```",
      "```json",
      '{ "neoscale_build": 1, "picked": "second" }',
      "```",
    ].join("\n");

    expect(extractEnvelope(file)).toMatchObject({ picked: "second" });
  });

  it("refuses a file past the character cap before parsing it", () => {
    const huge = `{"neoscale_build":1,"pad":"${"x".repeat(2_000_001)}"}`;
    expect(() => extractEnvelope(huge)).toThrow(/limit is 2,000,000/);
  });

  it("refuses text that holds no JSON object", () => {
    expect(() => extractEnvelope("I forgot to paste the file.")).toThrow(/one JSON object/);
  });
});

describe("parseBuildFile — input repair", () => {
  it("strips trailing commas and reports the repair", () => {
    const file = `{
      "neoscale_build": 1,
      "build": { "title": "Sloppy", "outcome": "Still works", },
      "nodes": [
        { "type": "prompt", "title": "Ask", "payload": { "text": "Do the thing", }, },
      ],
      "events": [],
    }`;

    const result = expectOk(parse(file));
    expect(result.proposal.nodes).toHaveLength(1);
    expect(result.proposal.nodes[0].payload.text).toBe("Do the thing");
    expect(result.meta.header.title).toBe("Sloppy");
    expect(codes(result)).toEqual(["INPUT_REPAIRED"]);
  });

  it("normalises smart quotes outside strings but not the prose inside them", () => {
    // The keys and the first value are curly because a model wrote them that
    // way. The apostrophe in the second value is content and must survive.
    const file =
      '{ “neoscale_build”: 1, “build”: { “title”: “Curly” },' +
      ' "nodes": [ { "type": "note", "payload": { "body": "it doesn’t break" } } ] }';

    const result = expectOk(parse(file));
    expect(result.meta.header.title).toBe("Curly");
    expect(result.proposal.nodes[0].payload.body).toBe("it doesn’t break");
    expect(codes(result)).toContain("INPUT_REPAIRED");
  });
});

describe("parseBuildFile — refusals", () => {
  it("refuses a version this code cannot read, naming the value", () => {
    const errors = expectRefused(parse(envelope({ neoscale_build: 2 })));
    expect(errors[0].code).toBe("UNSUPPORTED_VERSION");
    expect(errors[0].message).toContain("2");
  });

  it("refuses a file with no version at all", () => {
    const errors = expectRefused(
      parse({ build: { title: "No version" }, nodes: [], events: [] })
    );
    expect(errors[0].code).toBe("UNSUPPORTED_VERSION");
  });

  it("accepts 2,000 nodes and refuses 2,001", () => {
    const node = (index: number) => ({
      type: "note",
      title: `Node ${index}`,
      payload: { body: "text" },
    });

    const atCap = parse(
      envelope({ nodes: Array.from({ length: MAX_BUILDFILE_NODES }, (_, i) => node(i)) })
    );
    expect(expectOk(atCap).meta.counts.nodes).toBe(MAX_BUILDFILE_NODES);

    const errors = expectRefused(
      parse(
        envelope({ nodes: Array.from({ length: MAX_BUILDFILE_NODES + 1 }, (_, i) => node(i)) })
      )
    );
    expect(errors[0].code).toBe("TOO_MANY_NODES");
    expect(errors[0].message).toContain("2,001");
  });

  it("survives a file nested far deeper than any real build", () => {
    // Built as raw text rather than with JSON.stringify, which overflows its
    // own stack around 3,000 levels. JSON.parse does not — V8 reads nesting
    // iteratively — so a file like this genuinely reaches the node count, and
    // the count has to reach the cap without recursing to get there.
    const head = '{"type":"note","payload":{},"children":[';
    const leaf = '{"type":"note","payload":{}}';
    const deep = head.repeat(20_000) + leaf + "]}".repeat(20_000);
    const file = `{"neoscale_build":1,"build":{"title":"Deep"},"nodes":[${deep}],"events":[]}`;

    const errors = expectRefused(parse(file));
    expect(errors[0].code).toBe("TOO_MANY_NODES");
  });

  it("survives one node holding a very wide list of children", () => {
    const children = Array.from({ length: 40_000 }, () => ({
      type: "note",
      payload: {},
    }));
    // Compact, so the file stays well under the character cap and it is the
    // NODE cap that refuses it rather than the size one.
    const file = JSON.stringify(
      envelope({ nodes: [{ type: "note", payload: {}, children }] })
    );
    expect(file.length).toBeLessThan(2_000_000);

    const errors = expectRefused(parse(file));
    expect(errors[0].code).toBe("TOO_MANY_NODES");
  });

  it("flattens a deep chain that is under the node cap rather than refusing it", () => {
    const head = '{"type":"note","payload":{},"children":[';
    const leaf = '{"type":"note","payload":{}}';
    const depth = 1_500;
    const deep = head.repeat(depth) + leaf + "]}".repeat(depth);
    const file = `{"neoscale_build":1,"build":{"title":"Deep"},"nodes":[${deep}],"events":[]}`;

    const result = expectOk(parse(file));
    expect(result.meta.counts.nodes).toBe(depth + 1);
    // Every node lands at or above the third level, and nothing was dropped
    // to get there.
    const depths = result.proposal.nodes.map((node) => node.local_id.split(".").length);
    expect(Math.max(...depths)).toBe(3);
    expect(result.meta.warnings.some((warning) => warning.code === "DEPTH_FLATTENED")).toBe(
      true
    );
  });

  it("refuses more than 5,000 events", () => {
    const event = { kind: "note", payload: { text: "tick" } };
    const errors = expectRefused(
      parse(envelope({ events: Array.from({ length: 5_001 }, () => event) }))
    );
    expect(errors[0].code).toBe("TOO_MANY_EVENTS");
    expect(errors[0].message).toContain("5,001");
  });

  it("counts children towards the node cap", () => {
    // Two roots, each with a child: four nodes, not two.
    const nodes = [
      { type: "note", payload: {}, children: [{ type: "note", payload: {} }] },
      { type: "note", payload: {}, children: [{ type: "note", payload: {} }] },
    ];
    expect(expectOk(parse(envelope({ nodes }))).meta.counts.nodes).toBe(4);
  });
});

describe("parseBuildFile — the happy path", () => {
  it("turns a valid extractor file into a proposal with the counts it declares", () => {
    const file = JSON.stringify({
      neoscale_build: 1,
      generated_by: "extractor-v1",
      exported_at: "2026-08-27T09:00:00.000Z",
      origin: { tool: "extractor-v1", session_hint: "Claude, 27 Aug" },
      build: {
        title: "Retrieval agent",
        outcome: "Answers questions over a private corpus",
        shape: "agent",
        made_with: ["Claude", "Supabase"],
      },
      nodes: [
        {
          path: "1",
          type: "prompt",
          title: "The ask",
          note: null,
          payload: {
            text: "Summarise the corpus",
            model: "claude-opus-4",
            variables: [{ name: "corpus", example: "the handbook" }],
          },
          children: [
            {
              path: "1.1",
              type: "model_params",
              title: "Settings",
              note: null,
              payload: { model: "claude-opus-4", temperature: 0.2 },
              children: [],
            },
          ],
        },
        {
          path: "2",
          type: "code",
          title: "The loader",
          note: "Runs nightly.",
          payload: { language: "python", source: "def load():\n    return []" },
          children: [],
        },
      ],
      events: [
        { ordinal: 1, kind: "prompt", payload: { text: "Asked for a summary" } },
        { ordinal: 2, kind: "milestone", payload: { text: "First good answer" } },
      ],
    });

    const result = expectOk(parse(file));

    expect(result.meta.counts).toEqual({ nodes: 3, events: 2, inferred: 0 });
    expect(result.meta.generated_by).toBe("extractor-v1");
    expect(result.meta.warnings).toEqual([]);

    // The proposal is the shape the intake review already renders.
    expect(result.proposal.nodes.map((node) => node.local_id)).toEqual(["1", "1.1", "2"]);
    expect(result.proposal.nodes.map((node) => node.type)).toEqual([
      "prompt",
      "model_params",
      "code",
    ]);
    expect(result.proposal.nodes[0].payload.variables).toEqual([
      { name: "corpus", example: "the handbook" },
    ]);
    expect(result.proposal.nodes[1].payload.temperature).toBe(0.2);
    expect(result.proposal.nodes[2].note).toBe("Runs nightly.");
    expect(result.proposal.events.map((event) => event.ordinal)).toEqual([1, 2]);
    expect(result.proposal.summary.node_count).toBe(3);
    expect(result.proposal.summary.event_count).toBe(2);
    expect(result.proposal.summary.proposed_title?.value).toBe("Retrieval agent");
    expect(result.meta.header.made_with).toEqual(["Claude", "Supabase"]);
  });
});

describe("parseBuildFile — nodes", () => {
  it("turns an unknown type into a note and keeps the type name in the title", () => {
    const result = expectOk(
      parse(
        envelope({
          nodes: [{ type: "wizard_spell", title: "Summon the daemon", payload: {} }],
        })
      )
    );

    const node = result.proposal.nodes[0];
    expect(node.type).toBe("note");
    expect(node.title).toBe("wizard_spell: Summon the daemon");
    expect(codes(result)).toContain("UNKNOWN_TYPE");
  });

  it("moves payload keys the schema does not declare into the note", () => {
    const result = expectOk(
      parse(
        envelope({
          nodes: [
            {
              type: "prompt",
              title: "Ask",
              note: "Written before the refactor.",
              payload: { text: "Do the thing", vibe: "chaotic", retries: 3 },
            },
          ],
        })
      )
    );

    const node = result.proposal.nodes[0];
    // The declared key stays typed...
    expect(node.payload).toEqual({ text: "Do the thing" });
    // ...and the two the schema never heard of are still readable.
    expect(node.note).toBe("Written before the refactor.\n\nvibe: chaotic\nretries: 3");
    expect(codes(result)).toContain("UNKNOWN_FIELD");
  });

  it("flattens a fourth level onto the third and says so", () => {
    const result = expectOk(
      parse(
        envelope({
          nodes: [
            {
              path: "1",
              type: "note",
              title: "One",
              payload: {},
              children: [
                {
                  path: "1.1",
                  type: "note",
                  title: "Two",
                  payload: {},
                  children: [
                    {
                      path: "1.1.1",
                      type: "note",
                      title: "Three",
                      payload: {},
                      children: [
                        { path: "1.1.1.1", type: "note", title: "Four", payload: {} },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        })
      )
    );

    expect(result.proposal.nodes.map((node) => node.local_id)).toEqual([
      "1",
      "1.1",
      "1.1.1",
      // Re-parented to 1.1 — a sibling of 1.1.1 rather than its child, and
      // numbered after it, so the file's ordering survives the reshape.
      "1.1.2",
    ]);
    expect(result.proposal.nodes[3].title).toBe("Four");
    expect(codes(result)).toContain("DEPTH_FLATTENED");
  });

  it("coerces a number-like string losslessly and warns when it cannot", () => {
    const result = expectOk(
      parse(
        envelope({
          nodes: [
            {
              type: "model_params",
              title: "Params",
              payload: { model: "claude", temperature: "0.7", max_tokens: "quite a lot" },
            },
          ],
        })
      )
    );

    const node = result.proposal.nodes[0];
    expect(node.payload.temperature).toBe(0.7);
    // Not silently zeroed, not dropped: kept exactly as written, and flagged.
    expect(node.payload.max_tokens).toBe("quite a lot");
    expect(codes(result)).toContain("FIELD_COERCION");
  });

  it("passes inferred and inferred_reason through, defaulting them", () => {
    const result = expectOk(
      parse(
        envelope({
          nodes: [
            {
              type: "note",
              payload: {},
              inferred: true,
              inferred_reason: "The session never named it.",
            },
            { type: "note", payload: {} },
          ],
        })
      )
    );

    expect(result.proposal.nodes[0].inferred).toBe(true);
    expect(result.proposal.nodes[0].inferred_reason).toBe("The session never named it.");
    expect(result.proposal.nodes[1].inferred).toBe(false);
    expect(result.proposal.nodes[1].inferred_reason).toBeNull();
    expect(result.meta.counts.inferred).toBe(1);
  });
});

describe("parseBuildFile — events", () => {
  it("makes ordinals dense in arrival order and keeps phases unrenumbered", () => {
    const result = expectOk(
      parse(
        envelope({
          generated_by: "compiler-v1",
          events: [
            { ordinal: 9, kind: "prompt", payload: { text: "one" }, phase_title: "Phase A" },
            { ordinal: 4, kind: "deploy", payload: { text: "two" }, phase_title: "Phase A" },
            { ordinal: 1, kind: "prompt", payload: { text: "three" }, phase_title: "Phase B" },
          ],
        })
      )
    );

    // 1..N over the file as a whole. The phases are NOT restarted at 1 each,
    // and the arrival order is not resorted to group them.
    expect(result.proposal.events.map((event) => event.ordinal)).toEqual([1, 2, 3]);
    expect([0, 1, 2].map((index) => payloadOf(result, index).phase_title)).toEqual([
      "Phase A",
      "Phase A",
      "Phase B",
    ]);
    expect(result.meta.generated_by).toBe("compiler-v1");
  });

  it("folds an unrecognised kind to note and defaults visibility", () => {
    const result = expectOk(
      parse(envelope({ events: [{ kind: "vibe_check", payload: { text: "hmm" } }] }))
    );

    expect(result.proposal.events[0].kind).toBe("note");
    expect(result.proposal.events[0].visibility).toBe("folded");
    expect(codes(result)).toContain("UNKNOWN_EVENT_KIND");
  });

  it("keeps payload keys the proposal shape does not declare", () => {
    const result = expectOk(
      parse(
        envelope({
          events: [{ kind: "breakage", payload: { symptom: "500 on save", cause: "RLS" } }],
        })
      )
    );

    const payload = payloadOf(result, 0);
    // text is filled from the first text-bearing key so the review has
    // something to render...
    expect(payload.text).toBe("500 on save");
    // ...and `cause` is still there rather than dropped on the way in.
    expect(payload.cause).toBe("RLS");
  });
});

describe("parseBuildFile — provenance", () => {
  it("stamps one session id and an arrival index that keeps nodes clear of events", () => {
    const result = expectOk(
      parse(
        envelope({
          origin: { tool: "extractor-v1", session_hint: "a chat export" },
          nodes: [
            { type: "note", payload: {} },
            { type: "note", payload: {} },
          ],
          events: [{ kind: "prompt", payload: { text: "go" } }],
        })
      )
    );

    expect(result.proposal.nodes.map((node) => node.source_ref)).toEqual([
      { source: "extractor-v1", session_id: "session-under-test", index: 0 },
      { source: "extractor-v1", session_id: "session-under-test", index: 1 },
    ]);
    // Events are numbered ABOVE every node on purpose: materialiseProposal
    // links a node to the greatest event index at or below it, and a Build
    // File never says which event produced which node.
    expect(result.proposal.events[0].source_ref.index).toBe(2);
    expect(result.meta.origin).toEqual({
      tool: "extractor-v1",
      session_hint: "a chat export",
      exported_at: "2026-08-27T09:00:00.000Z",
      source_url: "https://neoscaleai.com/b2/a-build",
    });
  });

  it("keeps a source_ref the file carries itself", () => {
    const result = expectOk(
      parse(
        envelope({
          nodes: [
            {
              type: "note",
              payload: {},
              source_ref: { source: "claude", session_id: "theirs", index: 41 },
            },
          ],
        })
      )
    );

    expect(result.proposal.nodes[0].source_ref).toEqual({
      source: "claude",
      session_id: "theirs",
      index: 41,
    });
  });

  it("offers the header title and outcome as proposed fields", () => {
    const result = expectOk(parse(envelope()));
    expect(result.proposal.summary.proposed_title?.value).toBe("A build");
    expect(result.proposal.summary.proposed_outcome?.value).toBe("It works");
    expect(result.proposal.summary.proposed_title?.inferred).toBe(false);
  });
});

describe("scanForSecrets", () => {
  it("catches an sk- key and an .env line, and masks what it reports", () => {
    const key = "sk-live-9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c";
    const result = expectOk(
      parse(
        envelope({
          nodes: [
            { type: "prompt", title: "Ask", payload: { text: `Use ${key} to call it.` } },
            {
              type: "note",
              title: "Env",
              payload: { body: "DATABASE_URL=postgres://user:hunter2@db.internal/app" },
            },
          ],
        })
      )
    );

    const kinds = result.meta.secrets.map((secret) => secret.kind);
    expect(kinds).toContain("openai_key");
    expect(kinds).toContain("env_line");

    const apiKey = result.meta.secrets.find((secret) => secret.kind === "openai_key");
    expect(apiKey?.where).toBe("node");
    expect(apiKey?.ref).toBe("1");
    expect(apiKey?.field).toBe("text");
    // The whole point of the excerpt: it names the finding without repeating it.
    expect(apiKey?.excerpt).not.toContain(key);
    expect(apiKey?.excerpt).toContain("•");

    const envLine = result.meta.secrets.find((secret) => secret.kind === "env_line");
    // The variable name is the useful half and is kept; the value is not.
    expect(envLine?.excerpt).toContain("DATABASE_URL=");
    expect(envLine?.excerpt).not.toContain("hunter2");

    // Parsing is never blocked by a finding.
    expect(result.proposal.nodes).toHaveLength(2);
  });

  it("sweeps the note, where unrecognised payload keys were moved", () => {
    const result = expectOk(
      parse(
        envelope({
          nodes: [
            {
              type: "prompt",
              title: "Ask",
              // `credentials` is not in the prompt schema, so it lands in the
              // note. A scan that only read payloads would miss it entirely.
              payload: { text: "go", credentials: "AKIAIOSFODNN7EXAMPLE" },
            },
          ],
        })
      )
    );

    const finding = result.meta.secrets.find((secret) => secret.kind === "aws_access_key");
    expect(finding?.field).toBe("note");
  });

  it("leaves ordinary prose alone", () => {
    const result = expectOk(
      parse(
        envelope({
          nodes: [
            {
              type: "note",
              payload: {
                body: "The retrieval step reads the vector store and returns the top five rows.",
              },
            },
          ],
        })
      )
    );
    expect(result.meta.secrets).toEqual([]);
  });

  it("is callable on a proposal directly, so NS-P34 can re-run it", () => {
    const result = expectOk(
      parse(envelope({ nodes: [{ type: "note", payload: { body: "ghp_" + "a1b2c3d4e5".repeat(3) } }] }))
    );
    expect(scanForSecrets(result.proposal).map((secret) => secret.kind)).toContain(
      "github_token"
    );
  });
});

// =============================================================================
// The round trip
// =============================================================================

describe("a genuine site export", () => {
  function node(
    id: string,
    type: string,
    title: string,
    payload: Record<string, unknown>,
    children: NodeTree[] = []
  ): NodeTree {
    return {
      id,
      type,
      title,
      note: null,
      payload,
      position: 1,
      created_at: "2026-08-20T10:00:00.000Z",
      children,
    } as unknown as NodeTree;
  }

  function event(ordinal: number, kind: string, text: string): BuildEvent {
    return {
      ordinal,
      kind,
      visibility: "kept",
      payload: { text },
      phase_title: null,
    } as unknown as BuildEvent;
  }

  const RECORD: BuildRecord = {
    build: {
      slug: "the-demo-build",
      title: "The demo build",
      outcome: "A working retrieval agent",
      shape: "agent",
      made_for: ["researchers"],
      made_with: ["Claude"],
      live_url: "https://example.com/app",
      repo_url: null,
      cost_setup: 0,
      cost_monthly: 12,
      currency: "GBP",
      time_to_first_result: 45,
    } as unknown as Build,
    tree: [
      node("11111111-1111-4111-8111-111111111111", "prompt", "The ask", {
        text: "Summarise the corpus",
        model: "claude-opus-4",
      }, [
        node("22222222-2222-4222-8222-222222222222", "model_params", "Settings", {
          model: "claude-opus-4",
          temperature: 0.2,
          max_tokens: 4096,
        }),
        node("33333333-3333-4333-8333-333333333333", "code", "The loader", {
          language: "python",
          source: "def load():\n    return []",
          entrypoint: true,
        }),
      ]),
      node("44444444-4444-4444-8444-444444444444", "note", "What went wrong", {
        body: "The first index was built with the wrong embedding model.",
      }),
    ],
    tray: [],
    events: [
      event(1, "prompt", "Asked it to summarise"),
      event(2, "breakage", "Wrong embedding model"),
      event(3, "deploy", "Shipped to Netlify"),
    ],
    nodeTypes: REGISTRY,
  };

  it("round-trips through toPortable with zero warnings and matching counts", () => {
    const portable = toPortable(RECORD, {
      origin: "https://neoscaleai.com",
      exportedAt: new Date("2026-08-27T09:00:00.000Z"),
    });

    const result = expectOk(parse(JSON.stringify(portable, null, 2)));

    // The claim: the site's own file needs no tolerance at all.
    expect(result.meta.warnings).toEqual([]);
    expect(result.meta.secrets).toEqual([]);

    // Counts match the source record, children included.
    expect(result.meta.counts.nodes).toBe(4);
    expect(result.meta.counts.events).toBe(3);
    expect(result.proposal.summary.node_count).toBe(4);
    expect(result.proposal.summary.event_count).toBe(3);

    // A site export names no generating tool, so provenance falls back.
    expect(result.meta.generated_by).toBeNull();
    expect(result.proposal.nodes[0].source_ref.source).toBe("buildfile");
    expect(result.meta.origin.source_url).toBe("https://neoscaleai.com/b2/the-demo-build");

    // The tree's shape survives in the local_ids, which are the export's paths.
    expect(result.proposal.nodes.map((item) => item.local_id)).toEqual([
      "1",
      "1.1",
      "1.2",
      "2",
    ]);
    expect(result.proposal.nodes.map((item) => item.type)).toEqual([
      "prompt",
      "model_params",
      "code",
      "note",
    ]);

    // Typed values arrive typed, not stringified.
    expect(result.proposal.nodes[1].payload.temperature).toBe(0.2);
    expect(result.proposal.nodes[2].payload.entrypoint).toBe(true);
    expect(result.proposal.nodes[2].payload.language).toBe("python");

    // Nothing was moved into a note, because nothing needed to be.
    expect(result.proposal.nodes.every((item) => item.note === null)).toBe(true);

    // And the header the proposal cannot carry is held in meta rather than lost.
    expect(result.meta.header).toMatchObject({
      title: "The demo build",
      shape: "agent",
      made_with: ["Claude"],
      live_url: "https://example.com/app",
      cost: { setup: 0, monthly: 12, currency: "GBP" },
      time_to_first_result: 45,
    });
  });

  it("round-trips a fenced export the same way", () => {
    const portable = toPortable(RECORD, {
      origin: "https://neoscaleai.com",
      exportedAt: new Date("2026-08-27T09:00:00.000Z"),
    });
    const file = `Here is the build.\n\n\`\`\`json\n${JSON.stringify(portable)}\n\`\`\`\n\nEnjoy.`;

    const result = expectOk(parse(file));
    expect(result.meta.warnings).toEqual([]);
    expect(result.meta.counts.nodes).toBe(4);
  });
});
