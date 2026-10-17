import { describe, expect, it } from "vitest";

import { LOGO_KEYS, SUGGESTED_TOOLS, TOOLS, TOOL_GROUPS, cleanProjectLink, projectFileOf, toolFor, toolName, toolsInGroup } from "./registry";

const squash = (raw: string) => raw.toLowerCase().replace(/[\s._-]+/g, "");

describe("tool registry", () => {
  it("has 42 tools with unique ids", () => {
    expect(TOOLS).toHaveLength(42);
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
      expect(TOOL_GROUPS.map((g) => g.key), tool.id).toContain(tool.group);
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

  it("gives the app builders, and only them, the words of a project link", () => {
    const words = Object.fromEntries(TOOLS.filter((t) => t.projectLink).map((t) => [t.id, t.projectLink]));
    expect(words).toEqual({
      lovable: "Open the project in Lovable",
      replit: "Open the project in Replit",
      v0: "Open the project in v0",
      "google-ai-studio": "Open the app in Google AI Studio",
      bolt: "Open the project in Bolt",
      base44: "Open the app in Base44",
    });
  });

  it("marks the coding tools' project files and the tools that import a workflow", () => {
    expect(toolFor("claude-code")?.projectFiles).toEqual(["CLAUDE.md", "SKILL.md"]);
    expect(toolFor("codex")?.projectFiles).toEqual(["AGENTS.md"]);
    expect(toolFor("cursor")?.projectFiles).toEqual([".cursor/rules/"]);
    expect(toolFor("github-copilot")?.projectFiles).toEqual([".github/copilot-instructions.md"]);
    expect(TOOLS.filter((t) => t.importsFile).map((t) => t.id)).toEqual(["n8n", "comfyui"]);
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

describe("cleanProjectLink", () => {
  it("keeps an https address, trimmed", () => {
    expect(cleanProjectLink("  https://lovable.dev/projects/abc ")).toBe("https://lovable.dev/projects/abc");
  });

  it("refuses http, other schemes, text, empty and more than 500 characters", () => {
    for (const bad of ["http://lovable.dev/p", "javascript:alert(1)", "lovable.dev/p", "", "   ", null, 5]) expect(cleanProjectLink(bad)).toBeNull();
    expect(cleanProjectLink(`https://x.test/${"a".repeat(486)}`)).toBeNull();
    expect(cleanProjectLink(`https://x.test/${"a".repeat(485)}`)).not.toBeNull();
  });
});
