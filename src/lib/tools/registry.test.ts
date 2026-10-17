import { describe, expect, it } from "vitest";

import { LOGO_KEYS, cleanProjectLink, SUGGESTED_TOOLS, TOOLS, TOOL_GROUPS, toolFor, toolName, toolsInGroup } from "./registry";

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
