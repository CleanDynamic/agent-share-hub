import { describe, expect, it } from "vitest";

import { offeredTextModels } from "@/lib/models/registry";

import { DEFAULT_ROLES, SUGGESTED, fitsStep, hiddenModelName, modelMenu, modelRoles, nextModelAfterToolChange, pairCheck, type PairCheck } from "./modelRules";
import type { StepKey } from "./registry";

const ids = (menu: ReturnType<typeof modelMenu>) => (menu.state === "options" ? menu.groups.flatMap((group) => group.models.map((m) => m.id)) : []);

describe("modelMenu", () => {
  it("asks for a tool first", () => {
    expect(modelMenu(null)).toEqual({ state: "pick-tool" });
    expect(modelMenu("  ")).toEqual({ state: "pick-tool" });
  });

  it("offers a fixed tool's own models, grouped by lab in the tool's order", () => {
    const menu = modelMenu("claude");
    expect(menu.state).toBe("options");
    if (menu.state !== "options") return;
    expect(menu.other).toBe(false);
    expect(menu.groups.map((group) => group.lab)).toEqual(["Anthropic"]);
    expect(ids(menu)).toEqual(["fable-5-1", "opus-5-5", "sonnet-5-5", "haiku-5-5", "opus-5", "sonnet-5", "fable-5", "opus-4-7", "opus-4-6", "sonnet-4-6"]);

    const copilot = modelMenu("GitHub Copilot");
    if (copilot.state !== "options") throw new Error("expected options");
    expect(copilot.groups.map((group) => group.lab)).toEqual(["OpenAI", "Anthropic", "Google", "xAI", "Moonshot", "Microsoft"]);
    expect(modelMenu("claude-code")).toMatchObject({ state: "options", other: true });
  });

  it("offers an any-model tool its suggestions, then every current text model, and Other", () => {
    const menu = modelMenu("hermes-agent");
    if (menu.state !== "options") throw new Error("expected options");
    expect(menu.other).toBe(true);
    expect(menu.groups[0].lab).toBe(SUGGESTED);
    expect(menu.groups[0].models.map((m) => m.id)).toEqual(["opus-5-5", "sonnet-5-5", "gpt-6-1-sol", "gemini-3-8-flash", "grok-4-7", "deepseek-v4-pro", "kimi-k3", "glm-5-3"]);
    const all = ids(menu);
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all)).toEqual(new Set(offeredTextModels().map((m) => m.id)));
  });

  it("offers a typed tool every current text model and Other, because it cannot be checked", () => {
    const menu = modelMenu("My own script");
    expect(menu).toMatchObject({ state: "options", other: true });
    expect(ids(menu)).toEqual(offeredTextModels().map((m) => m.id));
  });

  it("offers tiers, a note, or nothing", () => {
    expect(modelMenu("v0")).toEqual({ state: "tiers", tiers: ["v0 Mini", "v0 Pro", "v0 Max"] });
    expect(modelMenu("bolt.new")).toEqual({ state: "tiers", tiers: ["Standard", "Max"] });
    expect(modelMenu("manus")).toEqual({ state: "hidden", note: "Manus picks its own model" });
    expect(modelMenu("gmail")).toEqual({ state: "none" });
    expect(modelMenu("Vercel")).toEqual({ state: "none" });
  });
});

describe("pairCheck", () => {
  const table: [string | null, string | null, PairCheck][] = [
    ["claude", "Grok 4.7", "not-offered"],
    ["claude", "Opus 5.5", "ok"],
    ["claude-code", "Fable 5.1", "ok"],
    ["claude-code", "claude-fable-5-1", "ok"],
    ["hermes-agent", "Opus 5.5", "ok"],
    ["hermes-agent", "Grok 4.7", "ok"],
    ["hermes-agent", "Kimi K3", "ok"],
    ["hermes-agent", "Nemotron 3 Ultra", "ok"],
    ["gmail", "Opus 5.5", "tool-runs-no-model"],
    ["vercel", "anything at all", "tool-runs-no-model"],
    ["manus", "Opus 5.5", "tool-hides-model"],
    ["manus", "Manus", "ok"],
    ["v0", "v0 Max", "ok"],
    ["v0", "Opus 5.5", "not-offered"],
    ["chatgpt", "Opus 5.5", "not-offered"],
    ["cursor", "Opus 5", "ok"],
    ["cursor", "GPT-6 Sol", "ok"],
    ["My own script", "Opus 5.5", "unknown"],
    ["claude", "llama-9-giant", "unknown"],
    [null, "Opus 5.5", "unknown"],
    ["claude", null, "ok"],
    ["claude", "", "ok"],
  ];
  it.each(table)("%s with %s is %s", (tool, model, expected) => {
    expect(pairCheck(tool, model)).toBe(expected);
  });
});

describe("fitsStep", () => {
  const table: [string | null, StepKey, boolean][] = [
    ["hermes-agent", "prompt", false],
    ["hermes-agent", "agent", true],
    ["manus", "prompt", false],
    ["n8n", "file", true],
    ["n8n", "prompt", true],
    ["zapier", "prompt", false],
    ["claude", "prompt", true],
    ["claude-code", "code", true],
    ["claude", "code", false],
    ["gmail", "tool", true],
    ["gmail", "prompt", false],
    ["sora", "prompt", false],
    ["sora", "manual", false],
    ["My own script", "prompt", true],
    ["My own script", "agent", true],
    ["My own script", "code", true],
    ["My own script", "manual", true],
    [null, "prompt", true],
  ];
  it.each(table)("%s on %s is %s", (tool, step, expected) => {
    expect(fitsStep(tool, step)).toBe(expected);
  });
});

describe("nextModelAfterToolChange", () => {
  it("clears a model the new tool does not offer, and keeps one it does", () => {
    expect(nextModelAfterToolChange("chatgpt", "Opus 5.5")).toEqual({ model: null, cleared: true });
    expect(nextModelAfterToolChange("cursor", "Opus 5")).toEqual({ model: "Opus 5", cleared: false });
    expect(nextModelAfterToolChange("hermes-agent", "Opus 5.5")).toEqual({ model: "Opus 5.5", cleared: false });
  });

  it("clears a model on a tool that runs none or hides it", () => {
    expect(nextModelAfterToolChange("gmail", "Opus 5.5")).toEqual({ model: null, cleared: true });
    expect(nextModelAfterToolChange("manus", "Opus 5.5")).toEqual({ model: null, cleared: true });
  });

  it("keeps a typed model, and clears a tier or a tool's name carried from the old tool", () => {
    expect(nextModelAfterToolChange("My own script", "my-local-llm")).toEqual({ model: "my-local-llm", cleared: false });
    expect(nextModelAfterToolChange("bolt", "v0 Max")).toEqual({ model: null, cleared: true });
    expect(nextModelAfterToolChange("claude", "Manus")).toEqual({ model: null, cleared: true });
  });

  it("has nothing to keep with no model, and keeps none with no tool", () => {
    expect(nextModelAfterToolChange("claude", null)).toEqual({ model: null, cleared: false });
    expect(nextModelAfterToolChange(null, "Opus 5.5")).toEqual({ model: null, cleared: false });
  });
});

describe("roles and stand-ins", () => {
  it("reads a harness's roles, else the default five", () => {
    expect(modelRoles("claude-code")).toEqual(["main", "plans", "acts"]);
    expect(modelRoles(null)).toEqual([...DEFAULT_ROLES]);
    expect(modelRoles("My own script")).toEqual([...DEFAULT_ROLES]);
  });

  it("names the model a hidden harness saves", () => {
    expect(hiddenModelName("manus")).toBe("Manus");
    expect(hiddenModelName("claude")).toBeNull();
  });
});
