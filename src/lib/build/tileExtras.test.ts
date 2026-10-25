import { describe, expect, it } from "vitest";

import { agentExtrasOf, cleanExtras, markVariable, patternOf, settingsOf, variableNamesIn, variablesFor, variablesOf } from "./tileExtras";

describe("a prompt's settings and variables (CA-15 P2)", () => {
  it("reads settings as given, and nothing when none of the three was", () => {
    expect(settingsOf(undefined)).toBeNull();
    expect(settingsOf({ model: "", effort: "default", instructions: "" })).toBeNull();
    expect(settingsOf({ model: " Opus 5.5 ", effort: "low", instructions: "x" })).toEqual({ model: "Opus 5.5", effort: "low", instructions: "x" });
    expect(settingsOf({ effort: "extreme", instructions: "x" })).toEqual({ model: "", effort: "default", instructions: "x" });
  });

  it("finds each {variable} once, in order, and leaves JSON alone", () => {
    expect(variableNamesIn("Hi {name}, welcome to {shop name}. {name} again")).toEqual(["name", "shop name"]);
    expect(variableNamesIn('Reply as {"a": 1} and { }')).toEqual([]);
  });

  it("pairs the names found with their saved descriptions", () => {
    const saved = variablesOf([{ name: "name", description: " First name " }, { name: "gone", description: "x" }, "nope"]);
    expect(variablesFor("Hi {name} at {shop}", saved)).toEqual([
      { name: "name", description: "First name" },
      { name: "shop", description: "" },
    ]);
  });

  it("wraps a selection in braces, trimming the spaces either side, and refuses an empty one", () => {
    expect(markVariable("Hello Ada, hi", 6, 9)).toBe("Hello {Ada}, hi");
    expect(markVariable("Hello Ada, hi", 5, 9)).toBe("Hello {Ada}, hi");
    expect(markVariable("Hello Ada", 5, 6)).toBeNull();
    expect(markVariable("Hello Ada", 3, 3)).toBeNull();
  });

  it("cleans a patch, takes empty keys off, and refuses a key the type does not take", () => {
    expect(cleanExtras("prompt", { settings: { model: "", effort: "default", instructions: "" }, variables: [{ name: "a", description: "" }] })).toEqual({ settings: null, variables: null });
    expect(cleanExtras("prompt", { variables: [{ name: "a", description: " one " }] })).toEqual({ variables: [{ name: "a", description: "one" }] });
    expect(() => cleanExtras("prompt", { colour: "red" })).toThrow(/not a field/);
    expect(() => cleanExtras("nope", { a: 1 })).toThrow(/no more fields/);
  });
});

describe("an agent's limits, output and sample, and a team's pattern (CA-15 P7)", () => {
  it("reads each only when given, trimmed, and nothing from the wrong shape", () => {
    expect(agentExtrasOf({})).toEqual({});
    expect(agentExtrasOf({ limits: [" a ", "", 3, "b"], output: " Slack ", sample: " User: hi " })).toEqual({ limits: ["a", "b"], output: "Slack", sample: "User: hi" });
    expect(agentExtrasOf({ limits: "a, b", output: 7 })).toEqual({});
  });

  it("knows four patterns and no other", () => {
    expect(["sequential", "lead", "parallel", "review"].map(patternOf)).toEqual(["sequential", "lead", "parallel", "review"]);
    expect(patternOf("swarm")).toBeNull();
    expect(patternOf(undefined)).toBeNull();
  });

  it("cleans limits from lines, refuses too many or too long, and takes empty ones off", () => {
    expect(cleanExtras("agent_config", { limits: "one\n\n two ", output: " Slack ", sample: "" })).toEqual({ limits: ["one", "two"], output: "Slack", sample: null });
    expect(() => cleanExtras("agent_config", { limits: Array.from({ length: 13 }, (_, i) => `l${i}`) })).toThrow(/Limits: 12 max/);
    expect(() => cleanExtras("agent_config", { limits: ["x".repeat(201)] })).toThrow(/Each limit: 200 characters max/);
    expect(() => cleanExtras("agent_config", { output: "x".repeat(281) })).toThrow(/280 characters max/);
    expect(cleanExtras("team", { pattern: "lead" })).toEqual({ pattern: "lead" });
    expect(cleanExtras("team", { pattern: "swarm" })).toEqual({ pattern: null });
  });
});
