import { describe, expect, it } from "vitest";
import { LABS, MODEL_VERSIONS, modelLabel, normaliseModel } from "./registry";

describe("registry", () => {
  it("lists the five labs in order and the twelve versions in order", () => {
    expect(LABS).toEqual(["Anthropic", "OpenAI", "Google", "xAI", "DeepSeek"]);
    expect(MODEL_VERSIONS.map((m) => m.id)).toEqual([
      "sonnet-5-5", "opus-5-5", "haiku-5-5", "opus-5",
      "gpt-6-astra", "gpt-6-1-sol", "gpt-6-luna", "gpt-5-6",
      "gemini-4-argon", "gemini-3-8-flash", "grok-4-7", "deepseek-v4-pro",
    ]);
    expect(MODEL_VERSIONS.filter((m) => m.isNew).map((m) => m.id)).toEqual([
      "sonnet-5-5", "opus-5-5", "gpt-6-1-sol",
    ]);
    for (const m of MODEL_VERSIONS) expect(LABS).toContain(m.lab);
  });

  it("resolves every id, name and alias to its own version", () => {
    for (const m of MODEL_VERSIONS) {
      for (const spelling of [m.id, m.name, ...m.aliases]) {
        expect(normaliseModel(spelling)?.id, spelling).toBe(m.id);
      }
    }
  });

  it("reaches sonnet-5-5 from the three spellings in the brief", () => {
    for (const raw of ["claude-sonnet-5-5", "Sonnet 5.5", "sonnet-5.5"]) {
      expect(normaliseModel(raw)?.id).toBe("sonnet-5-5");
    }
  });

  it("treats case, separators, padding and a vendor word as noise", () => {
    expect(normaliseModel("  CLAUDE_OPUS_5.5 ")?.id).toBe("opus-5-5");
    expect(normaliseModel("GPT 6.1 Sol")?.id).toBe("gpt-6-1-sol");
    expect(normaliseModel("gpt-5.6")?.id).toBe("gpt-5-6");
    expect(normaliseModel("Gemini_3.8_Flash")?.id).toBe("gemini-3-8-flash");
    expect(normaliseModel("GROK 4.7")?.id).toBe("grok-4-7");
    expect(normaliseModel("deepseek.v4.pro")?.id).toBe("deepseek-v4-pro");
  });

  it("ignores a trailing snapshot date", () => {
    expect(normaliseModel("claude-sonnet-5-5-20261001")?.id).toBe("sonnet-5-5");
  });

  it("does not confuse opus-5 with opus-5-5", () => {
    expect(normaliseModel("claude-opus-5")?.id).toBe("opus-5");
    expect(normaliseModel("claude-opus-5-5")?.id).toBe("opus-5-5");
  });

  it("returns null for an unknown model, null, undefined and blank text", () => {
    expect(normaliseModel("llama-9-giant")).toBeNull();
    expect(normaliseModel(null)).toBeNull();
    expect(normaliseModel(undefined)).toBeNull();
    expect(normaliseModel("   ")).toBeNull();
    expect(normaliseModel("claude-")).toBeNull();
  });

  it("labels a known model by name, an unknown one by its trimmed text, and nothing by empty text", () => {
    expect(modelLabel("claude-sonnet-5-5")).toBe("Sonnet 5.5");
    expect(modelLabel("  llama-9-giant ")).toBe("llama-9-giant");
    expect(modelLabel(null)).toBe("");
    expect(modelLabel(undefined)).toBe("");
  });
});
