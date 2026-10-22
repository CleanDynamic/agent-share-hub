import { describe, expect, it } from "vitest";

import {
  answerLine,
  branchHead,
  checkLine,
  decisionHeadline,
  decisionLines,
  decisionOf,
  decisionRequest,
  expectedLine,
  modelShort,
  questionsRefusal,
  runsWhenLabel,
  runsWhenOf,
  runsWhenRefusal,
  sureOf,
  type DecisionQuestion,
} from "./decision";

const team: DecisionQuestion = { id: "team", type: "choice", instructions: "Which team", options: [{ key: "billing" }, { key: "support" }, { key: "kitchen" }] };
const tone: DecisionQuestion = { id: "tone", type: "score", instructions: "How annoyed", levels: ["Calm", "Annoyed", "Angry"] };
const esc: DecisionQuestion = { id: "escalation", type: "yesno", instructions: "Escalate?" };

describe("decision lines", () => {
  it("reads a choice, a score and a yes or no as the tile shows them", () => {
    expect(answerLine(team, { value: "billing", probabilities: { billing: 0.92, support: 0.08 } })).toBe("team → billing · 92% confidence");
    expect(answerLine(tone, { value: 1, probabilities: { Annoyed: 0.71 } })).toBe("tone → Annoyed (2 of 3) · 71% confidence");
    expect(answerLine(esc, { value: 0.18 })).toBe("escalation → no · 0.18");
    expect(answerLine(esc, { value: 0.9 })).toBe("escalation → yes · 0.9");
  });

  it("falls back to confidence, and to no sure at all", () => {
    expect(sureOf(team, { value: "billing", confidence: 0.5 })).toBe(0.5);
    expect(answerLine(team, { value: "billing" })).toBe("team → billing");
  });

  it("shows the questions and options when nothing was recorded", () => {
    const lines = decisionLines({ questions: [team, tone, esc] });
    expect(lines.map((l) => l.text)).toEqual(["team: billing, support, kitchen", "tone: Calm to Angry", "escalation: yes or no"]);
    expect(lines.every((l) => !l.answered)).toBe(true);
  });

  it("heads the tile with the model's short name", () => {
    expect(modelShort("typesafe-jev", "jev-1.13.0")).toBe("Jev 1.13");
    expect(decisionHeadline({ provider: "typesafe-jev", model: "jev-1.13.0" })).toBe("Decision · Jev 1.13");
    expect(decisionHeadline({ provider: "typesafe-jev", model: "" })).toBe("Decision · TypeSafe Jev");
  });

  it("words the original's answer and the copier's check", () => {
    expect(expectedLine(team, { value: "billing", probabilities: { billing: 0.92 } })).toBe("The original answered team → billing (92% confidence) on this example; check yours does too.");
    expect(checkLine(team, { value: "billing" })).toBe("On this example, your copy should answer team = billing.");
  });
});

describe("decisionOf and questionsRefusal", () => {
  it("reads defensively and returns null with no question", () => {
    expect(decisionOf(null)).toBeNull();
    expect(decisionOf({ questions: [] })).toBeNull();
    const facts = decisionOf({ provider: "typesafe-jev", model: "jev-1.13.0", called_from: ["c1", 3], questions: [team, { id: "x", type: "nope" }], answer: { team: { value: "billing", confidence: 7 } }, source: "run" });
    expect(facts?.questions).toHaveLength(1);
    expect(facts?.calledFrom).toEqual(["c1"]);
    expect(facts?.answer?.team).toEqual({ value: "billing" });
    expect(facts?.source).toBe("run");
  });

  it("refuses no questions, no options and no levels in plain words", () => {
    expect(questionsRefusal([], "team")).toBe("Decision 'team' has no questions");
    expect(questionsRefusal([{ ...team, options: [{ key: "a" }] }], "team")).toBe("Decision 'team' has no options");
    expect(questionsRefusal([{ ...tone, levels: ["a"] }], "tone")).toBe("Decision 'tone' has no levels");
    expect(questionsRefusal([team, team])).toBe("A decision asks 'team' twice");
    expect(questionsRefusal([team, tone, esc])).toBeNull();
  });
});

describe("copy as a request", () => {
  it("writes Python and curl with the key as a placeholder, never a value", () => {
    const request = decisionRequest({ provider: "typesafe-jev", model: "jev-1.13.0", questions: [team, esc], stateSample: "Where is my refund?" });
    expect(request.python).toContain('os.environ["TYPESAFE_API_URL"]');
    expect(request.python).toContain("TYPESAFE_API_KEY");
    expect(request.curl).toContain("$TYPESAFE_API_KEY");
    expect(request.curl).toContain("Where is my refund?");
    expect(request.python).toContain("Written from the settings on this page, not the maker's own code");
    expect(JSON.parse(request.json).questions.team.options.billing).toBe("");
  });
});

describe("Runs when", () => {
  it("reads and words a choice, a score and a yes or no", () => {
    const choice = runsWhenOf({ decision: "d", question: "team", is: ["billing", "support"] })!;
    expect(runsWhenLabel(choice, team)).toBe("Runs when team is billing or support");
    expect(branchHead(choice, team)).toBe("If team is billing or support");
    expect(runsWhenLabel(runsWhenOf({ decision: "d", question: "tone", is: { atLeast: 1 } })!, tone)).toBe("Runs when tone is Annoyed or more");
    expect(runsWhenLabel(runsWhenOf({ decision: "d", question: "escalation", is: { yes: true } })!, esc)).toBe("Runs when escalation is yes");
    expect(runsWhenOf({ decision: "d" })).toBeNull();
    expect(runsWhenOf({ decision: "d", question: "q", is: [] })).toBeNull();
  });

  const refs = [{ id: "d", index: 1, facts: decisionOf({ questions: [team, tone] }) }];
  const rw = { decision: "d", question: "team", is: ["billing"] };

  it("is refused on prompts, manual steps, files and results, and allowed on runtime tiles", () => {
    for (const kind of ["prompt", "manual", "file", "result", "check"]) expect(runsWhenRefusal(kind, 3, rw, refs), kind).toMatch(/Only an agent/);
    for (const kind of ["agent", "team", "code", "tool", "decision"]) expect(runsWhenRefusal(kind, 3, rw, refs), kind).toBeNull();
  });

  it("is refused above its decision, for a missing decision, question or value", () => {
    expect(runsWhenRefusal("agent", 1, rw, refs)).toMatch(/above it/);
    expect(runsWhenRefusal("agent", 3, { ...rw, decision: "gone" }, refs)).toMatch(/no longer in the build/);
    expect(runsWhenRefusal("agent", 3, { ...rw, question: "gone" }, refs)).toMatch(/no longer in the decision/);
    expect(runsWhenRefusal("agent", 3, { ...rw, is: ["nope"] }, refs)).toMatch(/not one the question can take/);
    expect(runsWhenRefusal("agent", 3, { decision: "d", question: "tone", is: { atLeast: 5 } }, refs)).toMatch(/not one the question can take/);
  });
});
