// SV-29 P9: a shoe shop's support bot and the eval harness that tests it. Sample content written for this prompt: no text is copied
// from any article.
//
// An agent (instructions, a Retrieval tile over the help centre, an order-status tool); a Monitoring tile on Confident AI, measuring
// traces tagged `customer` and `harness`; a Check holding 20 test cases from real users' questions, three failure types, four graders,
// three runs per case, a three-run history and a CI gate in GitHub Actions with the rules it dropped.

import type { NodeTree } from "@/lib/build/types";

import { fixtureNode as node } from "../deployment/node";

const S = "fx-evals-s1";

const CASES = [
  { input: "Bought running shoes 5 weeks ago, can I return them?", expected: "No", rule: "Returns within 30 days of purchase", failure_type: "Wrong policy decision", example: true },
  { input: "Do you ship to Ireland?", expected: "Yes, in 3 to 5 days" },
  { input: "My order 4411 has not arrived", expected: "Look up the order and give its status" },
  { input: "Can I swap size 9 for size 10?", expected: "Yes, within 30 days", rule: "Exchanges within 30 days of purchase" },
  { input: "Do you sell gift cards?", expected: "Yes, from the gift card page" },
  { input: "What is your returns address?", expected: "The warehouse address in the returns policy" },
  { input: "Is there a student discount?", expected: "No student discount is listed", failure_type: "Made-up answers" },
  { input: "My boots arrived with a split sole", expected: "Offer a photo upload and a refund", failure_type: "No page for damaged items" },
  { input: "How long is a week in your policy?", expected: "7 days", failure_type: "Wrong policy decision" },
  { input: "Can I change my delivery address?", expected: "Only before dispatch" },
];

const cases = Array.from({ length: 20 }, (_, i) => {
  const base = CASES[i % CASES.length];
  const passed = i < 14;
  const stability = i < 11 ? "always_pass" : i < 15 ? "always_fail" : i < 19 ? "flaky" : "error";
  return {
    input: i < CASES.length ? base.input : `${base.input} (variation ${i - CASES.length + 1})`,
    expected: base.expected,
    actual: passed ? base.expected : "",
    passed,
    ...(i < CASES.length && base.rule ? { rule: base.rule } : null),
    ...(i < CASES.length && base.failure_type ? { failure_type: base.failure_type } : null),
    ...(i === 0 ? { example: true } : null),
    stability,
    ...(stability === "flaky" ? { flaky_cause: i < 18 ? "app" : "judge" } : null),
  };
});

const grader = (name: string, kind: string, sees: string[], covers: string[], extra: Record<string, unknown> = {}) => ({ name, kind, sees, covers, ...extra });

export const supportBotEvalsTree: NodeTree[] = [
  node("sb-a1", 0, "agent_config", {
    session: S,
    model: "qwen2-5",
    system_prompt: "You answer questions for a shoe shop's customers. Answer only from the help centre. A week is 7 days. If the help centre does not say, say so and offer to pass the question to a person.",
    tools: [{ tool_ref: "sb-t1" }],
    uses: [{ kind: "output", node_id: "sb-r1" }],
  }, "Shoe shop support bot"),
  node("sb-r1", 1, "retrieval_config", {
    session: S,
    step: true,
    embedding_model: "text-embedding-3-small",
    index: "pgvector",
    corpus: "help-centre pages",
    corpus_size: 84,
    query: "The customer's question",
    k: 5,
    recall: [{ k: 5, value: 0.9, source: "maker" }],
  }, "Search the help centre"),
  node("sb-t1", 2, "integration", { session: S, step: true, service: "order-status", scopes: "read order status by order number" }, "Order status"),
  node("sb-g1", 3, "monitoring", { provider: "Confident AI", measures: ["traces", "answer relevancy"], tags: ["customer", "harness"], test_traffic_tagged: true, agent: "sb-a1", connects: [] }),
  node("sb-k1", 4, "eval_run", {
    session: S,
    tested: "Twenty real customer questions, each run three times",
    passing: "Every case passes on every run",
    method: "automated",
    scoring: { how: "pass_fail" },
    uses: [{ kind: "output", node_id: "sb-a1" }],
    test_set: { size: 20, labelled_by: "maker", drawn_from: "real_traffic", trace_tag: "customer", file: "harness/goldens.json" },
    cases,
    runs_per_case: 3,
    passed: 54,
    total: 60,
    run_at: "2026-10-28",
    failure_types: [
      { name: "Wrong policy decision", count: 5, read: 20, fix_in: "retrieval" },
      { name: "Made-up answers", count: 6, read: 20, fix_in: "prompt" },
      { name: "No page for damaged items", count: 1, read: 20, fix_in: "people", note: "No help-centre page covers damaged items" },
    ],
    framework: "DeepEval",
    judge_model: "claude-sonnet-5-5",
    graders: [
      grader("Answer relevancy", "built_in", [], []),
      grader("Faithfulness", "built_in", [], ["Made-up answers"]),
      grader("Policy correct", "llm_judge", ["question", "answer", "expected", "reference"], ["Wrong policy decision"], { criteria: "Does the answer apply the policy the help centre states for this case?", threshold: 0.7 }),
      grader("Stays in sources", "llm_judge", ["answer", "retrieved", "tool_results"], ["Made-up answers"], { criteria: "Is every claim in the answer in what the app retrieved or the order tool returned?", threshold: 0.7, validated: { good: 3, bad: 3, correct: true } }),
    ],
    runs: [
      { at: "2026-10-28", passed: 54, total: 60, id: "main-embedding-search", changed: "Search by meaning", vs: "main-prompt-v3", compare: { fixed: 4, regressions: 0, now_flaky: 1, still_failing: 4 }, cost: { cost: 1.4, currency: "USD", source: "maker" } },
      { at: "2026-10-24", passed: 41, total: 60, id: "main-prompt-v3", changed: "Answer only from the docs; a week is 7 days", vs: "main-prompt-v2", compare: { fixed: 7, regressions: 0, now_flaky: 3, still_failing: 4 } },
      { at: "2026-10-20", passed: 33, total: 60, id: "main-prompt-v2" },
    ],
    gate: {
      runs_in: "GitHub Actions",
      on: "pull_request",
      rule: { kind: "pass_to_fail" },
      runs: 3,
      missing_result_fails: true,
      minutes: { value: 8, source: "maker" },
      rejected: [
        { rule: "Fail on any regression, one run", why: "A correct answer failed on judge noise." },
        { rule: "A correct answer failed on judge noise", why: "A single flaky judge score should not block a change." },
      ],
    },
  }),
];

export const supportBotEvalsMaking = { session_order: [S], sessions_meta: { [S]: { tool: "claude-code", date: "2026-10-28" } } };
