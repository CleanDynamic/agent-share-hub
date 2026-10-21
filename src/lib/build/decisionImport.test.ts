import { describe, expect, it } from "vitest";

import { BUILT_IN_CODE_LINE, KEY_REMOVED_LINE, parseDecisionCall, removeKeys } from "./decisionImport";

const request = {
  model: "jev-1.13.0",
  state: "Customer: I was charged twice for my order.",
  questions: {
    team: { type: "choice", instructions: "Which team owns this?", options: { billing: "Money questions", support: "", kitchen: "" } },
    tone: { type: "score", instructions: "How annoyed?", levels: ["Calm", "Annoyed", "Angry"] },
    escalation: { type: "noul", instructions: "Escalate to a person?" },
  },
};
const response = {
  answers: {
    team: { answer: "billing", probabilities: { billing: 0.92, support: 0.05, kitchen: 0.03 }, confidence: 0.92 },
    tone: { answer: "Annoyed", probabilities: { Calm: 0.2, Annoyed: 0.71, Angry: 0.09 } },
    escalation: { answer: 0.18 },
  },
};

describe("parseDecisionCall", () => {
  it("reads a JSON request and its response, the most reliable way", () => {
    const result = parseDecisionCall(`${JSON.stringify(request, null, 2)}\n\n${JSON.stringify(response)}`);
    if (result.ok === false) throw new Error(result.reason);
    expect(result.value.model).toBe("jev-1.13.0");
    expect(result.value.stateSample).toBe("Customer: I was charged twice for my order.");
    expect(result.value.questions.map((q) => [q.id, q.type])).toEqual([["team", "choice"], ["tone", "score"], ["escalation", "yesno"]]);
    expect(result.value.questions[0].options).toEqual([{ key: "billing", line: "Money questions" }, { key: "support" }, { key: "kitchen" }]);
    expect(result.value.answer?.team).toEqual({ value: "billing", probabilities: { billing: 0.92, support: 0.05, kitchen: 0.03 }, confidence: 0.92 });
    expect(result.value.answer?.tone.value).toBe(1);
    expect(result.value.answer?.escalation.value).toBe(0.18);
    expect(result.value.keyRemoved).toBe(false);
  });

  it("reads a request alone, with no answer", () => {
    const result = parseDecisionCall(JSON.stringify(request));
    expect(result.ok && result.value.answer).toBeUndefined();
    expect(result.ok && result.value.questions).toHaveLength(3);
  });

  it("reads a request wrapped in a log line", () => {
    const result = parseDecisionCall(JSON.stringify({ request, response }));
    expect(result.ok).toBe(true);
  });

  it("reads a curl command's inline body and removes the key", () => {
    const curl = `curl -X POST https://example.test/decide \\\n  -H "Authorization: Bearer abcdef123456789" \\\n  -H "Content-Type: application/json" \\\n  --data '${JSON.stringify(request)}'`;
    const result = parseDecisionCall(curl);
    if (result.ok === false) throw new Error(result.reason);
    expect(result.value.keyRemoved).toBe(true);
    expect(result.value.questions).toHaveLength(3);
    expect(KEY_REMOVED_LINE).toBe("Your key was removed; it is never stored.");
  });

  it("does not call a placeholder a key", () => {
    const curl = `curl -H "Authorization: Bearer $TYPESAFE_API_KEY" --data '${JSON.stringify(request)}'`;
    const result = parseDecisionCall(curl);
    expect(result.ok && result.value.keyRemoved).toBe(false);
  });

  it("reads literal Python as a best try", () => {
    const py = `
from typesafe_sdk import Choice, Score, Noul
result = client.decide(
    model="jev-1.13.0",
    state="Where is my order?",
    questions={
        "team": Choice(instructions="Which team?", options=["billing", "support"]),
        "tone": Score(instructions="How annoyed?", levels=["Calm", "Annoyed"]),
        "escalation": Noul("Escalate?"),
    },
)`;
    const result = parseDecisionCall(py);
    if (result.ok === false) throw new Error(result.reason);
    expect(result.value.model).toBe("jev-1.13.0");
    expect(result.value.stateSample).toBe("Where is my order?");
    expect(result.value.questions.map((q) => q.type)).toEqual(["choice", "score", "yesno"]);
    expect(result.value.questions[2].instructions).toBe("Escalate?");
  });

  it("refuses Python built from variables, with its line", () => {
    const variables = `questions = {"team": Choice(instructions=PROMPT, options=TEAMS)}`;
    const result = parseDecisionCall(variables);
    expect(result).toMatchObject({ ok: false, reason: BUILT_IN_CODE_LINE });
    const built = `questions = build_questions(teams)\nx = Choice(instructions="a", options=["b", "c"])`;
    expect(parseDecisionCall(built)).toMatchObject({ ok: false, reason: BUILT_IN_CODE_LINE });
    const fstring = `questions = {"team": Choice(instructions=f"Which {x}", options=["a", "b"])}`;
    expect(parseDecisionCall(fstring)).toMatchObject({ ok: false, reason: BUILT_IN_CODE_LINE });
  });

  it("says plainly when it cannot read the text, and never runs it", () => {
    expect(parseDecisionCall("")).toMatchObject({ ok: false });
    expect(parseDecisionCall("hello world")).toMatchObject({ ok: false });
    expect(parseDecisionCall(JSON.stringify(response))).toMatchObject({ ok: false, reason: expect.stringContaining("no request") });
    // A question with no options is refused, not saved.
    expect(parseDecisionCall(JSON.stringify({ questions: { team: { type: "choice", options: ["only"] } } }))).toMatchObject({ ok: false });
  });

  it("removes a key written as a field", () => {
    expect(removeKeys('{"api_key": "sk-abcdefghijklmnopqrstuv"}').removed).toBe(true);
    expect(removeKeys('TYPESAFE_API_KEY="abcdefghij123"').text).toContain("[removed]");
    expect(removeKeys("export TYPESAFE_API_KEY=$TYPESAFE_API_KEY").removed).toBe(false);
  });
});
