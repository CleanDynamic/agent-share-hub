// SV-29 P8: the setup prompt for the pipeline and the eval harness.

import { describe, expect, it } from "vitest";

import { productCategoriesTree } from "@/dev/fixtures/pipeline/product-categories";
import { supportBotEvalsTree } from "@/dev/fixtures/pipeline/support-bot-evals";

import { setupPromptOf, setupPromptRefusal } from "./setupPrompt";

describe("the product categories pipeline", () => {
  const prompt = setupPromptOf("pc-d1", { tree: productCategoriesTree, showCost: true }).text;

  it("names the Retrieval and the Decision as the prompt words them", () => {
    expect(prompt).toContain("Build a vector index of categories with text-embedding-3-small; return the top 30.");
    expect(prompt).toContain("Ask Jev 1.13 to choose one label from those candidates; return a confidence.");
    expect(prompt).toContain("When confidence is below 0.6, don't trust the answer.");
    expect(prompt).toContain("Known limit: Sequential narrowing over large label sets degrades accuracy.");
  });

  it("lists the chosen row and every rejected row with its reason, under Results to beat", () => {
    expect(prompt).toContain("Results to beat:");
    expect(prompt).toContain("Chosen: Retrieval, then the decision model picks: Accuracy 0.972, about $0.0005 per product.");
    expect(prompt).toContain("Rejected: Retrieval, then Gemma picks (Accuracy 0.819): Lower accuracy than the decision model for the same cost.");
    expect(prompt).toContain("Rejected: Beam search (Accuracy 0.923): Correct root scored 0.03 against 0.44; the path was pruned at depth 0.");
    expect(prompt).toContain("Rejected: Exhaustive (Accuracy 0.98): Over 2,000 times the cost.");
  });

  it("leaves money out unless readers see it", () => {
    const reader = setupPromptOf("pc-d1", { tree: productCategoriesTree }).text;
    expect(reader).toContain("Chosen: Retrieval, then the decision model picks: Accuracy 0.972.");
    expect(reader).not.toContain("$");
  });

  it("is the same text twice, and asks a person for nothing private", () => {
    expect(setupPromptOf("pipeline", { tree: productCategoriesTree, showCost: true }).text).toBe(prompt);
    expect(setupPromptRefusal("pc-d1", { tree: productCategoriesTree })).toBeNull();
  });
});

describe("the support bot's eval harness", () => {
  const prompt = setupPromptOf("sb-a1", { tree: supportBotEvalsTree }).text;
  const lines = prompt.split("\n");

  it("collects test cases, reads the failures first and runs each case three times", () => {
    expect(prompt).toContain("Collect test cases from real users' questions (tag customer) into harness/goldens.json, each with the expected answer and the rule behind it.");
    expect(prompt).toContain("Read the failures first. The maker found: Wrong policy decision (5 of 20), Made-up answers (6 of 20).");
    expect(prompt).toContain("Ask a person to decide: No help-centre page covers damaged items.");
    expect(prompt).toContain("Run each case 3 times. Treat mixed results as flaky and read them before trusting a score.");
  });

  it("gives a grader line for each grader, with what it is given", () => {
    expect(prompt).toContain('Grade with "Policy correct", an LLM judge (claude-sonnet-5-5): Does the answer apply the policy the help centre states for this case? Give it the question, the answer, the expected answer and the full reference. Pass at 0.7.');
    expect(prompt).toContain('Grade with "Stays in sources", an LLM judge (claude-sonnet-5-5)');
    expect(prompt).toContain("Give it the answer, what the app retrieved and the tool results. Pass at 0.7.");
    expect(prompt).toContain('Grade with "Faithfulness", a built-in metric from DeepEval.');
  });

  it("adds the CI gate and the rule it dropped, in that order", () => {
    const gate = lines.findIndex((line) => line.startsWith("Add a CI gate in GitHub Actions on every pull request that fails when a case goes from always pass to always fail over 3 runs."));
    expect(gate).toBeGreaterThan(-1);
    expect(lines[gate]).toContain("Treat a missing result as a failure.");
    expect(lines[gate + 1]).toBe("Don't fail on any regression from one run: a correct answer failed on judge noise.");
  });

  it("puts the newest run in Results to beat, and the lines in their order", () => {
    expect(prompt).toContain("Newest run: main-embedding-search, 54 of 60 runs (20 cases × 3) (search by meaning).");
    const order = ["Collect test cases", "Read the failures first", "Grade with", "Run each case", "Add a CI gate", "Results to beat"].map((word) => prompt.indexOf(word));
    expect(order.every((at, i) => at > -1 && (i === 0 || at > order[i - 1]))).toBe(true);
  });

  it("holds nothing private", () => {
    expect(prompt).not.toMatch(/sk-|api[_-]?key/i);
  });
});
