// CA-05 P8 — how a model was run: when it is asked, what is kept, and the model line.

import { describe, expect, it } from "vitest";

import { asksHowRun, modelRunLine, modelRunOf, modelRunRefusal, placeWord, precisionWord } from "./modelRun";

describe("when it is asked", () => {
  it("asks for Ollama and LM Studio, whatever the model", () => {
    expect(asksHowRun("Ollama", "llama-3")).toBe(true);
    expect(asksHowRun("lm-studio", null)).toBe(true);
  });
  it("asks for a model whose weights are open, in any tool", () => {
    expect(asksHowRun("OpenClaw", "Muse Spark Open")).toBe(true);
    expect(asksHowRun(null, "gpt-oss-120b")).toBe(true);
    expect(asksHowRun("ChatGPT", "GPT-OSS-120b")).toBe(true);
  });
  it("does not ask for any other tool or model", () => {
    expect(asksHowRun("Claude", "Opus 5.5")).toBe(false);
    expect(asksHowRun("ChatGPT", null)).toBe(false);
    expect(asksHowRun(null, "Muse Spark 1.3")).toBe(false);
    expect(asksHowRun(undefined, undefined)).toBe(false);
  });
});

describe("what is kept", () => {
  it("reads defensively", () => {
    expect(modelRunOf({ precision: "4-bit", where: "computer" })).toEqual({ precision: "4-bit", where: "computer" });
    expect(modelRunOf({ precision: "  ", where: "moon" })).toBeNull();
    expect(modelRunOf({ where: "server" })).toEqual({ where: "server" });
    expect(modelRunOf({ precision: "x".repeat(40) })?.precision).toHaveLength(20);
    expect(modelRunOf(null)).toBeNull();
    expect(modelRunOf([])).toBeNull();
  });
  it("refuses a size longer than 20 characters", () => {
    expect(modelRunRefusal({ precision: "x".repeat(21) })).toMatch(/20/);
    expect(modelRunRefusal({ precision: "Q5_K_M", where: "server" })).toBeNull();
  });
});

describe("the model line", () => {
  it("reads 'Muse Spark Open · 4-bit · on my own computer'", () => {
    expect(modelRunLine("Muse Spark Open", { precision: "4-bit", where: "computer" })).toBe("Muse Spark Open · 4-bit · on my own computer");
    expect(modelRunLine("Muse Spark Open", { precision: "full", where: "server" })).toBe("Muse Spark Open · full size · on a server");
    expect(modelRunLine("Llama", { where: "computer" })).toBe("Llama · on my own computer");
    expect(modelRunLine("Llama", { precision: "Q5_K_M" })).toBe("Llama · Q5_K_M");
  });
  it("is the model alone when nothing was said", () => {
    expect(modelRunLine("Opus 5.5", null)).toBe("Opus 5.5");
    expect(modelRunLine("Opus 5.5", undefined)).toBe("Opus 5.5");
  });
  it("has its words", () => {
    expect([precisionWord("full"), precisionWord("8-bit"), placeWord("server")]).toEqual(["full size", "8-bit", "on a server"]);
  });
});
