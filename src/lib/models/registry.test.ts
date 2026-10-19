import { describe, expect, it } from "vitest";
import { LABS, MODEL_VERSIONS, TEXT_LABS, isOfferedText, modelById, modelLabel, normaliseModel, offeredTextModels } from "./registry";

/** Every spelling of the sixteen versions listed before CA-02, and the id each resolved to then (read at 87e2636). */
const BEFORE_CA02: readonly [string, string][] = [
  ["sonnet-5-5", "sonnet-5-5"],
  ["Sonnet 5.5", "sonnet-5-5"],
  ["claude-sonnet-5-5", "sonnet-5-5"],
  ["claude-sonnet-5.5", "sonnet-5-5"],
  ["sonnet-5.5", "sonnet-5-5"],
  ["claude sonnet 5.5", "sonnet-5-5"],
  ["opus-5-5", "opus-5-5"],
  ["Opus 5.5", "opus-5-5"],
  ["claude-opus-5-5", "opus-5-5"],
  ["claude-opus-5.5", "opus-5-5"],
  ["opus-5.5", "opus-5-5"],
  ["claude opus 5.5", "opus-5-5"],
  ["fable-5-1", "fable-5-1"],
  ["Fable 5.1", "fable-5-1"],
  ["claude-fable-5-1", "fable-5-1"],
  ["claude-fable-5.1", "fable-5-1"],
  ["fable-5.1", "fable-5-1"],
  ["claude fable 5.1", "fable-5-1"],
  ["haiku-5-5", "haiku-5-5"],
  ["Haiku 5.5", "haiku-5-5"],
  ["claude-haiku-5-5", "haiku-5-5"],
  ["claude-haiku-5.5", "haiku-5-5"],
  ["haiku-5.5", "haiku-5-5"],
  ["claude haiku 5.5", "haiku-5-5"],
  ["opus-5", "opus-5"],
  ["Opus 5", "opus-5"],
  ["claude-opus-5", "opus-5"],
  ["claude opus 5", "opus-5"],
  ["gpt-6-astra", "gpt-6-astra"],
  ["GPT-6 Astra", "gpt-6-astra"],
  ["gpt6-astra", "gpt-6-astra"],
  ["gpt 6 astra", "gpt-6-astra"],
  ["astra", "gpt-6-astra"],
  ["gpt-6-1-sol", "gpt-6-1-sol"],
  ["GPT-6.1 Sol", "gpt-6-1-sol"],
  ["gpt-6.1-sol", "gpt-6-1-sol"],
  ["gpt_6_1_sol", "gpt-6-1-sol"],
  ["gpt 6.1 sol", "gpt-6-1-sol"],
  ["sol", "gpt-6-1-sol"],
  ["gpt-6-luna", "gpt-6-luna"],
  ["GPT-6 Luna", "gpt-6-luna"],
  ["gpt 6 luna", "gpt-6-luna"],
  ["luna", "gpt-6-luna"],
  ["gpt-5-6", "gpt-5-6"],
  ["GPT-5.6", "gpt-5-6"],
  ["gpt-5.6", "gpt-5-6"],
  ["gpt_5_6", "gpt-5-6"],
  ["gpt 5.6", "gpt-5-6"],
  ["gemini-4-argon", "gemini-4-argon"],
  ["Gemini 4 Argon", "gemini-4-argon"],
  ["gemini 4 argon", "gemini-4-argon"],
  ["argon", "gemini-4-argon"],
  ["gemini-3-8-flash", "gemini-3-8-flash"],
  ["Gemini 3.8 Flash", "gemini-3-8-flash"],
  ["gemini-3.8-flash", "gemini-3-8-flash"],
  ["gemini_3_8_flash", "gemini-3-8-flash"],
  ["gemini 3.8 flash", "gemini-3-8-flash"],
  ["grok-4-7", "grok-4-7"],
  ["Grok 4.7", "grok-4-7"],
  ["grok-4.7", "grok-4-7"],
  ["grok_4_7", "grok-4-7"],
  ["grok 4.7", "grok-4-7"],
  ["deepseek-v4-pro", "deepseek-v4-pro"],
  ["DeepSeek V4 Pro", "deepseek-v4-pro"],
  ["deepseek_v4_pro", "deepseek-v4-pro"],
  ["deepseek v4 pro", "deepseek-v4-pro"],
  ["deepseek-v4.pro", "deepseek-v4-pro"],
  ["muse-wonder", "muse-wonder"],
  ["Muse Wonder", "muse-wonder"],
  ["muse-wonder-1.0", "muse-wonder"],
  ["meta muse wonder", "muse-wonder"],
  ["muse-spark-1-3", "muse-spark-1-3"],
  ["Muse Spark 1.3", "muse-spark-1-3"],
  ["muse-spark-1.3", "muse-spark-1-3"],
  ["muse spark 1.3", "muse-spark-1-3"],
  ["muse spark", "muse-spark-1-3"],
  ["jev", "jev"],
  ["Jev", "jev"],
  ["typesafe jev", "jev"],
];

const OLD_IDS = [
  "sonnet-5-5", "opus-5-5", "fable-5-1", "haiku-5-5", "opus-5",
  "gpt-6-astra", "gpt-6-1-sol", "gpt-6-luna", "gpt-5-6",
  "gemini-4-argon", "gemini-3-8-flash", "grok-4-7", "deepseek-v4-pro",
  "muse-wonder", "muse-spark-1-3", "jev",
];

/** The comparison key, as the registry builds it. */
const key = (raw: string) =>
  raw.trim().toLowerCase().replace(/[\s._-]+/g, "-").replace(/^-+|-+$/g, "").replace(/-\d{8}$/, "").replace(/^(?:claude|gpt|gemini)-/, "");

describe("registry", () => {
  it("keeps the sixteen versions listed before CA-02, in their order among the rest", () => {
    const ids = MODEL_VERSIONS.map((m) => m.id);
    for (const id of OLD_IDS) expect(ids, id).toContain(id);
    expect(ids.filter((id) => OLD_IDS.includes(id))).toEqual(OLD_IDS);
    expect(MODEL_VERSIONS[0].id).toBe("sonnet-5-5");
    expect(MODEL_VERSIONS.filter((m) => m.isNew).map((m) => m.id)).toEqual([
      "sonnet-5-5", "opus-5-5", "fable-5-1", "gpt-6-1-sol", "muse-wonder", "jev",
    ]);
    for (const m of MODEL_VERSIONS) expect(LABS).toContain(m.lab);
  });

  it("resolves every spelling of the old sixteen to the same id as before", () => {
    for (const [spelling, id] of BEFORE_CA02) expect(normaliseModel(spelling)?.id, spelling).toBe(id);
  });

  it("has unique ids, and no spelling shared by two versions", () => {
    expect(new Set(MODEL_VERSIONS.map((m) => m.id)).size).toBe(MODEL_VERSIONS.length);
    const owner = new Map<string, string>();
    for (const m of MODEL_VERSIONS) {
      for (const spelling of [m.id, m.name, ...m.aliases]) {
        const k = key(spelling);
        const before = owner.get(k);
        if (before !== undefined) expect(before, spelling).toBe(m.id);
        owner.set(k, m.id);
      }
    }
  });

  it("writes ids in lower case with dots and spaces as dashes", () => {
    for (const m of MODEL_VERSIONS) expect(m.id, m.name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("gives every version a modality and a status", () => {
    for (const m of MODEL_VERSIONS) {
      expect(["text", "image", "video", "audio", "music", "decision"], m.id).toContain(m.modality);
      expect(["current", "preview", "legacy", "retired"], m.id).toContain(m.status);
    }
    expect(modelById("jev")?.modality).toBe("decision");
    expect(modelById("gpt-5-6")?.status).toBe("legacy");
    expect(modelById("sora-2")?.status).toBe("retired");
    for (const id of ["gpt-5-6-sol", "gpt-5-6-terra", "gpt-5-6-luna", "fable-5", "gpt-6-sol", "gemini-3-7-flash", "gemini-3-1-pro", "grok-4-6", "deepseek-v4-1-flash", "kimi-k3", "glm-5-3", "nano-banana-2"]) {
      expect(modelById(id), id).not.toBeNull();
    }
  });

  it("resolves the API ids Appendix A gives", () => {
    expect(normaliseModel("claude-fable-5")?.id).toBe("fable-5");
    expect(normaliseModel("gpt-5.6-cyber")?.id).toBe("gpt-5-6-cyber");
    expect(normaliseModel("gpt-image-2.5-sunburst")?.id).toBe("gpt-image-2-5-sunburst");
    expect(normaliseModel("deepseek-flash")?.id).toBe("deepseek-v4-1-flash");
    expect(normaliseModel("deepseek-v4-flash")?.id).toBe("deepseek-v4-1-flash");
    expect(normaliseModel("grok-imagine-image-2.0")?.id).toBe("grok-imagine-image-2-0");
    expect(normaliseModel("muse-image-1.0")?.id).toBe("muse-image");
    expect(normaliseModel("eleven_flash_v2_5")?.id).toBe("eleven-flash-v2-5");
    expect(normaliseModel("music_v2_5")?.id).toBe("eleven-music-v2-5");
    expect(normaliseModel("Gemini 3.1 Flash Image")?.id).toBe("nano-banana-2");
  });

  it("offers text models only, and only current or preview ones", () => {
    for (const m of offeredTextModels()) {
      expect(m.modality, m.id).toBe("text");
      expect(["current", "preview"], m.id).toContain(m.status);
    }
    expect(offeredTextModels().map((m) => m.id)).not.toContain("gpt-5-6");
    expect(offeredTextModels().map((m) => m.id)).not.toContain("jev");
    expect(isOfferedText(modelById("nano-banana-2")!)).toBe(false);
  });

  it("lists in TEXT_LABS only labs with a current text model, in LABS order", () => {
    for (const lab of TEXT_LABS) {
      expect(MODEL_VERSIONS.some((m) => m.lab === lab && m.modality === "text" && m.status === "current"), lab).toBe(true);
    }
    expect(TEXT_LABS.slice(0, 6)).toEqual(["Anthropic", "OpenAI", "Google", "xAI", "DeepSeek", "Meta"]);
    expect(TEXT_LABS).not.toContain("TypeSafe");
    expect(TEXT_LABS).not.toContain("Suno");
    expect(LABS.filter((lab) => TEXT_LABS.includes(lab))).toEqual(TEXT_LABS);
  });

  it("still labels a legacy or retired model", () => {
    expect(modelLabel("gpt-5.6")).toBe("GPT-5.6");
    expect(modelLabel("Sora 2")).toBe("Sora 2");
    expect(normaliseModel("claude-opus-4-6")?.id).toBe("opus-4-6");
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
