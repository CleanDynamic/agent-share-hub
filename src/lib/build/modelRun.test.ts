// CA-05 P8 — how a model was run: when it is asked, what is kept, and the model line.

import { describe, expect, it } from "vitest";

import { methodOf } from "./forkRules";
import { RUN_COPY, asksHowRun, modelRunLine, modelRunOf, modelRunRefusal, placeWord, precisionWord, showsSplit } from "./modelRun";

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
    expect(modelRunLine("Muse Spark Open", { precision: "full", where: "server" })).toBe("Muse Spark Open · full precision · on a server");
    expect(modelRunLine("Llama", { where: "computer" })).toBe("Llama · on my own computer");
    expect(modelRunLine("Llama", { precision: "Q5_K_M" })).toBe("Llama · Q5_K_M");
  });
  it("is the model alone when nothing was said", () => {
    expect(modelRunLine("Opus 5.5", null)).toBe("Opus 5.5");
    expect(modelRunLine("Opus 5.5", undefined)).toBe("Opus 5.5");
  });
  it("has its words", () => {
    expect([precisionWord("full"), precisionWord("8-bit"), placeWord("server")]).toEqual(["full precision", "8-bit", "on a server"]);
  });
});

// SV-27 Part 4: how a model was served. Every new key is optional; an old `{ precision, where }` reads as it did.
describe("SV-27 P4: the served model", () => {
  const FULL = { precision: "Q4_K_M", weights_format: "GGUF", parameters: "32B", context_length: 32768, engine: "llama-cpp", draft_model: "Qwen 0.5B", split: "by layers", server: "srv-1", host: "host-1" } as const;

  it("reads an old run exactly as it did", () => {
    expect(modelRunOf({ precision: "4-bit", where: "computer" })).toEqual({ precision: "4-bit", where: "computer" });
  });

  it("keeps each new key", () => {
    expect(modelRunOf(FULL)).toEqual(FULL);
    expect(modelRunOf({ weights_format: "MLX" })).toEqual({ weights_format: "MLX" });
    expect(modelRunOf({ context_length: 8192 })).toEqual({ context_length: 8192 });
  });

  it("drops values it does not know, and never throws", () => {
    expect(modelRunOf({ weights_format: "zip", split: "sideways", context_length: -1, parameters: "" })).toBeNull();
    expect(modelRunOf({ parameters: "x".repeat(20) })?.parameters).toHaveLength(12);
    expect(modelRunOf({ context_length: 1.5 })).toBeNull();
  });

  it("refuses what it cannot keep", () => {
    expect(modelRunRefusal({ parameters: "x".repeat(13) })).toMatch(/12/);
    expect(modelRunRefusal({ context_length: 0 })).toMatch(/whole/);
    expect(modelRunRefusal(FULL)).toBeNull();
  });

  it("writes the quiet line from the parts given", () => {
    const host = { name: "Workstation", gpus: [{ model: "RTX 5090", count: 2, vram_gb: 32 }] };
    expect(modelRunLine("Qwen", FULL, { host, engineName: "llama.cpp" })).toBe("Qwen 32B · Q4_K_M · GGUF · llama.cpp with draft model · 2 × RTX 5090");
    expect(modelRunLine("Qwen", { precision: "Q4_K_M", weights_format: "GGUF" })).toBe("Qwen · Q4_K_M · GGUF");
    expect(modelRunLine("Qwen", { engine: "vLLM" })).toBe("Qwen · vLLM");
    expect(modelRunLine("Qwen", { draft_model: "Qwen 0.5B" })).toBe("Qwen · with draft model");
    expect(modelRunLine("Qwen", { parameters: "32B", where: "server" })).toBe("Qwen 32B · on a server");
  });

  it("names the GPUs from the host, and the host instead of Where", () => {
    expect(modelRunLine("Qwen", { host: "h1" }, { host: { name: "Mac Mini", gpus: [] } })).toBe("Qwen · on Mac Mini");
  });

  it("shows Split only when the host has two or more GPUs", () => {
    expect(showsSplit({ name: "W", gpus: [{ model: "RTX 5090", count: 2, vram_gb: 32 }] })).toBe(true);
    expect(showsSplit({ name: "W", gpus: [{ model: "RTX 5090", count: 1, vram_gb: 32 }, { model: "RTX 4090", count: 1, vram_gb: 24 }] })).toBe(true);
    expect(showsSplit({ name: "W", gpus: [{ model: "RTX 5090", count: 1, vram_gb: 32 }] })).toBe(false);
    expect(showsSplit(null)).toBe(false);
  });

  it("has the new words", () => {
    expect(RUN_COPY.how).toBe("How it was run");
    expect(RUN_COPY.precision).toBe("Precision");
    expect(RUN_COPY.full).toBe("Full precision");
    expect(RUN_COPY.otherHint).toBe("Quant type, for example Q4_K_M");
  });

  it("is method: a fork keeps the whole model run", () => {
    expect(methodOf({ model: "qwen", modelRun: FULL })).toEqual({ model: "qwen", modelRun: FULL });
  });
});
