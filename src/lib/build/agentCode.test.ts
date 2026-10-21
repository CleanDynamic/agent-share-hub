import { describe, expect, it } from "vitest";

import { agentCopy, agentStartingPoint, readHelpersFromCode, STARTING_POINT_NOTE } from "./agentCode";
import { helpersOf } from "./helpers";

const helpers = helpersOf([
  { provider: "scaledown", job: "summarize", model: "openai:gpt-6-sol", trigger: { at: 0.8, keep: 0.1 } },
  { provider: "scaledown", job: "compress", tools: ["fetch_docs"] },
  { provider: "scaledown", job: "extract", fields: ["order_id", "issue_type"] },
  { provider: "scaledown", job: "classify", labels: ["progress", "looping"], stopAt: 0.8 },
]);
const spec = { name: "Kitchen agent", model: "anthropic:claude-sonnet-5-5", harness: "deep-agents", tools: ["fetch_docs", "Search"], instructions: "Cook it.", helpers };

describe("Copy the setup (CA-13 P6, rule 4)", () => {
  it("copies the maker's own code when a Code tile defines the agent, with the starting point second", () => {
    const copy = agentCopy(spec, [{ name: "kitchen_agent.py", text: "agent = create_deep_agent()" }]);
    expect(copy.code).toEqual({ label: "Copy the code", text: "agent = create_deep_agent()" });
    expect(copy.start.label).toBe("Copy as a starting point");
    expect(copy.start.note).toBe("Written from the settings on this page, not the maker's own code");
  });

  it("has only the labelled starting point when there is no code", () => {
    expect(agentCopy(spec, []).code).toBeNull();
  });

  it("writes create_deep_agent(model, tools, middleware) from the chips, naming the key and never inventing a package", () => {
    const code = agentStartingPoint(spec);
    expect(code.split("\n")[0]).toBe(`# ${STARTING_POINT_NOTE}.`);
    expect(code).toContain("SCALEDOWN_API_KEY");
    expect(code).toContain("from deepagents import create_deep_agent");
    expect(code).toContain('model="anthropic:claude-sonnet-5-5"');
    expect(code).toContain("tools=[fetch_docs, search]");
    expect(code).toContain('ScaledownSummarizationMiddleware(model="openai:gpt-6-sol", trigger=("fraction", 0.8), keep=("fraction", 0.1))');
    expect(code).toContain('ScaledownToolCompressionMiddleware(tools=["fetch_docs"])');
    expect(code).toContain('ScaledownExtractionMiddleware(fields=["order_id", "issue_type"])');
    expect(code).toContain("stop_if_looping");
    expect(code).toContain("scores 0.8 or more");
    expect(code).not.toMatch(/pip install|^\s*(?:import|from) scaledown/im);
  });

  it("copies a plain description for any provider other than ScaleDown, or another framework, instead of guessing code", () => {
    const other = agentStartingPoint({ ...spec, helpers: helpersOf([{ provider: "typesafe", job: "decide", questions: "d" }]) }, () => "team");
    expect(other).not.toContain("create_deep_agent");
    expect(other).toContain("- Decide: team (TypeSafe)");
    expect(other.startsWith(`${STARTING_POINT_NOTE}.`)).toBe(true);
    expect(agentStartingPoint({ ...spec, harness: "langgraph" })).not.toContain("create_deep_agent(");
  });
});

describe("Read the helpers from code (CA-13 P6)", () => {
  const code = `
from deepagents import create_deep_agent

LABELS = ["progress", "looping"]

@after_model
def stop_if_looping(state, runtime):
    labels = ["progress", "looping"]
    threshold = 0.8
    ...

agent = create_deep_agent(
    model="anthropic:claude-sonnet-5-5",
    tools=[fetch_docs, search],
    middleware=[
        ScaledownSummarizationMiddleware("openai:gpt-6-sol", trigger=("fraction", 0.8), keep=("fraction", 0.1)),
        ScaledownToolCompressionMiddleware(tools=["fetch_docs"]),
        ScaledownExtractionMiddleware(fields=["order_id", "issue_type"]),
        stop_if_looping,
    ],
)`;

  it("fills the agent, its tools and its helpers from literal values", () => {
    const read = readHelpersFromCode(code);
    expect(read.found).toBe(true);
    expect(read.model).toBe("anthropic:claude-sonnet-5-5");
    expect(read.tools).toEqual(["fetch_docs", "search"]);
    expect(read.helpers.map((h) => h.job)).toEqual(["summarize", "compress", "extract", "classify"]);
    expect(read.helpers[0]).toEqual({ provider: "scaledown", job: "summarize", model: "openai:gpt-6-sol", trigger: { at: 0.8, keep: 0.1 } });
    expect(read.helpers[2].fields).toEqual(["order_id", "issue_type"]);
    expect(read.helpers[3]).toMatchObject({ job: "classify", labels: ["progress", "looping"], stopAt: 0.8 });
    expect(read.setInCode).toEqual([]);
  });

  it("lists anything built from variables as 'Found, but set in code', and never evaluates it", () => {
    const variables = `agent = create_deep_agent(
      model=MODEL,
      middleware=[ScaledownExtractionMiddleware(fields=FIELDS), ScaledownSummarizationMiddleware("m", trigger=("fraction", AT)), *more],
    )`;
    const read = readHelpersFromCode(variables);
    expect(read.helpers).toEqual([]);
    expect(read.setInCode).toEqual(expect.arrayContaining(["model", "ScaledownExtractionMiddleware", "ScaledownSummarizationMiddleware", "middleware"]));
  });

  it("says nothing was found when there is no create_deep_agent call", () => {
    expect(readHelpersFromCode("print('hello')")).toEqual({ found: false, tools: [], helpers: [], setInCode: [] });
  });
});
