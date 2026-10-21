import { describe, expect, it } from "vitest";

import { MODEL_VERSIONS } from "@/lib/models/registry";

import { AI_TOOLS, APPS, LOGO_KEYS, SUGGESTED_TOOLS, TOOLS, TOOL_GROUPS, isPickable, projectFileOf, toolFor, toolName, toolsInGroup } from "./registry";

const squash = (raw: string) => raw.toLowerCase().replace(/[\s._-]+/g, "");

describe("tool registry", () => {
  it("has 43 AI tools and 24 apps (6 are both), 61 entries with unique ids (CA-12 P13)", () => {
    expect(AI_TOOLS).toHaveLength(43);
    expect(APPS).toHaveLength(24);
    expect(TOOLS).toHaveLength(61);
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length);
  });

  it("gives no spelling to two tools", () => {
    const owner = new Map<string, string>();
    for (const tool of TOOLS) {
      for (const spelling of new Set([tool.id, tool.name, ...tool.aliases].map(squash))) {
        expect(owner.get(spelling), spelling).toBeUndefined();
        owner.set(spelling, tool.id);
      }
    }
  });

  it("uses only exported logo keys, and only known groups", () => {
    for (const tool of TOOLS) {
      if (tool.logo !== null) expect(LOGO_KEYS, tool.id).toContain(tool.logo);
      expect([...TOOL_GROUPS.map((g) => g.key), "services"], tool.id).toContain(tool.group);
    }
  });

  it("names the suggested tools", () => {
    for (const id of SUGGESTED_TOOLS) expect(toolFor(id)?.id).toBe(id);
  });

  it("finds a tool by id, name or another spelling", () => {
    expect(toolFor("Claude-Code")?.id).toBe("claude-code");
    expect(toolFor("lovable.dev")?.id).toBe("lovable");
    expect(toolFor("Chat GPT")?.id).toBe("chatgpt");
    expect(toolFor("v0 by Vercel")?.id).toBe("v0");
    expect(toolFor("Windsurf")?.id).toBe("devin-desktop");
    expect(toolFor("NotebookLM")?.id).toBe("gemini-notebook");
  });

  it("returns null for an unknown name", () => {
    expect(toolFor("Notepad")).toBeNull();
    expect(toolFor("")).toBeNull();
    expect(toolFor(null)).toBeNull();
    expect(toolName("Notepad")).toBeNull();
  });

  it("names a tool and lists a group in order", () => {
    expect(toolName("claude-code")).toBe("Claude Code");
    expect(toolsInGroup("video").map((t) => t.id)).toEqual(["kling", "sora", "higgsfield", "veo"]);
  });

  it("marks the coding tools' project files and the tools that import a workflow", () => {
    expect(toolFor("claude-code")?.projectFiles).toEqual(["CLAUDE.md", "SKILL.md"]);
    expect(toolFor("codex")?.projectFiles).toEqual(["AGENTS.md"]);
    expect(toolFor("cursor")?.projectFiles).toEqual([".cursor/rules/"]);
    expect(toolFor("github-copilot")?.projectFiles).toEqual([".github/copilot-instructions.md"]);
    expect(TOOLS.filter((t) => t.importsFile).map((t) => t.id)).toEqual(["n8n", "comfyui"]);
  });
});

describe("what each tool is, offers and fits (CA-02)", () => {
  const known = new Set(MODEL_VERSIONS.map((m) => m.id));

  it("gives every tool a kind, models, steps and a status", () => {
    for (const tool of TOOLS) {
      expect(["chat", "coding", "builder", "agent", "automation", "image", "video", "audio", "notes", "design", "app"], tool.id).toContain(tool.kind);
      expect(["fixed", "any", "tiers", "hidden", "none"], tool.id).toContain(tool.models.mode);
      expect(Array.isArray(tool.steps), tool.id).toBe(true);
      expect(["current", "retired"], tool.id).toContain(tool.status);
      expect(tool.source === null || /^https:\/\//.test(tool.source), tool.id).toBe(true);
      expect(tool.checked === null || tool.checked === "2026-10-19", tool.id).toBe(true);
    }
  });

  it("names only models the model registry has", () => {
    for (const tool of TOOLS) {
      const ids = tool.models.mode === "fixed" ? tool.models.ids : tool.models.mode === "any" ? tool.models.suggested : [];
      for (const id of ids) expect(known.has(id), `${tool.id}: ${id}`).toBe(true);
    }
  });

  it("keeps a retired tool for old builds but never suggests it", () => {
    expect(toolFor("sora")?.status).toBe("retired");
    expect(toolFor("Sora")?.name).toBe("Sora");
    expect(isPickable(toolFor("sora")!)).toBe(false);
    for (const id of SUGGESTED_TOOLS) expect(toolFor(id)?.status, id).toBe("current");
    expect(toolFor("sora")?.steps).toEqual([]);
  });

  it("never lists prompt for a tool that runs no model, or for an agent", () => {
    for (const tool of TOOLS.filter((t) => t.models.mode === "none" || t.kind === "agent")) expect(tool.steps, tool.id).not.toContain("prompt");
  });

  it("lets every tool but Sora be named on a manual step", () => {
    for (const tool of TOOLS) expect(tool.steps.includes("manual"), tool.id).toBe(tool.id !== "sora");
  });

  it("adds Muse Code beside Muse, Meta's consumer agent", () => {
    expect(toolFor("muse-code")).toMatchObject({ name: "Muse Code", group: "coding", kind: "coding" });
    expect(toolFor("muse")?.kind).toBe("agent");
  });

  it("gives Claude Code its plans and acts roles", () => {
    expect(toolFor("claude-code")?.roles).toEqual(["main", "plans", "acts"]);
  });
});

describe("projectFileOf", () => {
  const all = ["claude-code", "codex", "cursor", "github-copilot"];

  it("finds the tool for each tool's project file", () => {
    expect(projectFileOf("CLAUDE.md", all)?.id).toBe("claude-code");
    expect(projectFileOf("SKILL.md", all)?.id).toBe("claude-code");
    expect(projectFileOf("AGENTS.md", all)?.id).toBe("codex");
    expect(projectFileOf(".github/copilot-instructions.md", all)?.id).toBe("github-copilot");
  });

  it("matches in any case and as the end of a path", () => {
    expect(projectFileOf("claude.MD", all)?.id).toBe("claude-code");
    expect(projectFileOf("docs/skills/pdf/SKILL.md", all)?.id).toBe("claude-code");
    expect(projectFileOf("repo\\AGENTS.md", all)?.id).toBe("codex");
    expect(projectFileOf("my-CLAUDE.md", all)).toBeNull();
  });

  it("takes any .mdc file or path under .cursor/rules/ for Cursor", () => {
    expect(projectFileOf("style.mdc", all)?.id).toBe("cursor");
    expect(projectFileOf(".cursor/rules/style.md", all)?.id).toBe("cursor");
    expect(projectFileOf("app/.cursor/rules/api/style.txt", all)?.id).toBe("cursor");
    expect(projectFileOf("rules/style.md", all)).toBeNull();
  });

  it("looks only among the tools it is given, and returns null for a non-match", () => {
    expect(projectFileOf("CLAUDE.md", ["codex"])).toBeNull();
    expect(projectFileOf("CLAUDE.md", [])).toBeNull();
    expect(projectFileOf("AGENTS.md", ["claude-code", "codex"])?.id).toBe("codex");
    expect(projectFileOf("menu.pdf", all)).toBeNull();
    expect(projectFileOf("workflow.json", ["n8n"])).toBeNull();
  });
});

describe("tools that read content their maker doesn't control (CA-03 P7)", () => {
  it("are exactly these, so a change to the list is deliberate", () => {
    expect(TOOLS.filter((tool) => tool.readsOutside).map((tool) => tool.id).sort()).toEqual(
      ["gmail", "notion", "perplexity", "chatgpt", "gemini", "claude", "grok", "manus", "openclaw", "hermes-agent", "muse", "n8n", "zapier", "make", "gemini-notebook", "github", "gitlab", "slack", "google-drive", "linear", "jira"].sort(),
    );
  });
});

describe("models run on your own computer (CA-05 P8)", () => {
  it("adds Ollama and LM Studio: chat tools that take any model, with no suggested list", () => {
    for (const id of ["ollama", "lm-studio"]) {
      const tool = toolFor(id);
      expect(tool, id).toMatchObject({ kind: "chat", group: "chat", local: true, status: "current", models: { mode: "any", suggested: [] } });
      expect(tool?.steps, id).toEqual(["prompt", "session", "agent", "result", "manual"]);
    }
    expect(toolFor("LM Studio")?.id).toBe("lm-studio");
    expect(toolFor("ollama.com")?.id).toBe("ollama");
  });
  it("marks only those two as local", () => {
    expect(TOOLS.filter((tool) => tool.local).map((tool) => tool.id)).toEqual(["ollama", "lm-studio"]);
  });
});
