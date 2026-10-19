import { describe, expect, it } from "vitest";

import { CONNECTOR_TOOLS } from "@/lib/connect/connector";
import { markFor } from "./marks";
import { LABS, MODEL_VERSIONS, type Lab } from "./registry";

/** The labs the site has a logo for; the rest show their name alone. */
const LABS_WITH_MARKS: readonly Lab[] = ["Anthropic", "OpenAI", "Google", "xAI", "DeepSeek", "Meta", "Perplexity", "Cursor", "Cognition", "Midjourney", "Kuaishou", "Suno", "ElevenLabs", "Higgsfield"];

describe("markFor", () => {
  it("names each tool by its own mark", () => {
    expect(markFor({ tool: "Claude" })).toBe("claude-color");
    expect(markFor({ tool: "Claude Code" })).toBe("claudecode-color");
    expect(markFor({ tool: "ChatGPT" })).toBe("openai");
    expect(markFor({ tool: "Cursor" })).toBe("cursor");
    expect(markFor({ tool: "Gemini" })).toBe("gemini-color");
    expect(markFor({ tool: "Grok" })).toBe("grok");
    expect(markFor({ tool: "Vercel" })).toBe("vercel");
    expect(markFor({ tool: "Gmail" })).toBe("mail");
  });

  it("has a mark for every connector tool", () => {
    for (const tool of CONNECTOR_TOOLS) expect(markFor({ tool }), tool).not.toBeNull();
  });

  it("marks a model by its lab's product", () => {
    expect(markFor({ model: "Opus 5.5" })).toBe("claude-color");
    expect(markFor({ model: "GPT-6 Astra" })).toBe("openai");
    expect(markFor({ model: "Gemini 4 Argon" })).toBe("gemini-color");
    expect(markFor({ model: "Grok 4.7" })).toBe("grok");
    expect(markFor({ model: "DeepSeek V4 Pro" })).toBe("deepseek-color");
  });

  it("marks every named model", () => {
    for (const m of MODEL_VERSIONS.filter((v) => LABS_WITH_MARKS.includes(v.lab))) expect(markFor({ model: m.name }), m.name).not.toBeNull();
    for (const m of MODEL_VERSIONS.filter((v) => !LABS_WITH_MARKS.includes(v.lab))) expect(markFor({ model: m.name }), m.name).toBeNull();
  });

  it("resolves an alias to the same mark as the name", () => {
    expect(markFor({ model: "claude-sonnet-5-5" })).toBe("claude-color");
    expect(markFor({ model: "claude-sonnet-5-5-20261001" })).toBe("claude-color");
    expect(markFor({ model: "gpt_6_1_sol" })).toBe("openai");
    expect(markFor({ model: "gemini-3.8-flash" })).toBe("gemini-color");
  });

  it("marks a lab on its own", () => {
    expect(markFor({ lab: "Anthropic" })).toBe("anthropic");
    expect(markFor({ lab: "OpenAI" })).toBe("openai");
    expect(markFor({ lab: "Google" })).toBe("google-color");
    expect(markFor({ lab: "xAI" })).toBe("xai");
    expect(markFor({ lab: "DeepSeek" })).toBe("deepseek-color");
    for (const lab of LABS_WITH_MARKS) expect(markFor({ lab }), lab).not.toBeNull();
    for (const lab of LABS.filter((l) => !LABS_WITH_MARKS.includes(l))) expect(markFor({ lab }), lab).toBeNull();
  });

  it("puts the tool before the model and the model before the lab", () => {
    expect(markFor({ tool: "Claude Code", model: "Opus 5.5", lab: "Anthropic" })).toBe("claudecode-color");
    expect(markFor({ tool: "Mystery", model: "Opus 5.5", lab: "OpenAI" })).toBe("claude-color");
    expect(markFor({ model: "not a model", lab: "Anthropic" })).toBe("anthropic");
  });

  it("ignores case and padding", () => {
    expect(markFor({ tool: "  chatgpt " })).toBe("openai");
    expect(markFor({ tool: "CLAUDE   CODE" })).toBe("claudecode-color");
    expect(markFor({ tool: "claude-code" })).toBe("claudecode-color");
    expect(markFor({ lab: " XAI " })).toBe("xai");
  });

  it("returns null for anything else", () => {
    expect(markFor({})).toBeNull();
    expect(markFor({ tool: null, model: undefined, lab: "" })).toBeNull();
    expect(markFor({ tool: "Notepad", model: "llama-9", lab: "Mistral" })).toBeNull();
  });

  it("reads the tool list for the newer tools", () => {
    expect(markFor({ tool: "Lovable" })).toBe("lovable-color");
    expect(markFor({ tool: "bolt.new" })).toBe("bolt-color");
    expect(markFor({ tool: "Higgsfield" })).toBe("higgsfield");
    expect(markFor({ tool: "Windsurf" })).toBe("devin-color");
    expect(markFor({ tool: "Gamma" })).toBeNull();
    expect(markFor({ tool: "Muse" })).toBeNull();
  });

  it("marks Meta, TypeSafe and the new models", () => {
    expect(markFor({ lab: "Meta" })).toBe("meta-color");
    expect(markFor({ model: "Muse Wonder" })).toBe("meta-color");
    expect(markFor({ model: "claude-fable-5-1" })).toBe("claude-color");
    expect(markFor({ lab: "TypeSafe" })).toBeNull();
    expect(markFor({ model: "Jev" })).toBeNull();
  });
});
