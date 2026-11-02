// SV-30 P5: a plugin in a session's setup.

import { describe, expect, it, vi } from "vitest";

const placed: unknown[] = [];
vi.mock("./composeCover", () => ({
  placeTopNode: vi.fn(async (_b: string, _t: unknown, row: unknown) => {
    placed.push(row);
    return { id: "n1", ...(row as object) };
  }),
  placeChildNode: vi.fn(),
}));
vi.mock("./nodes", () => ({ upsertNode: vi.fn(), reorderNodes: vi.fn(), getNodeTree: vi.fn(), deleteNode: vi.fn() }));

import { addSetupPlugin, pluginInstallLine, pluginRefusal, setupItemsOf, SETUP_KINDS, SETUP_KIND_LABEL } from "./setup";
import { pluginsToInstall, setupFolder } from "./setupFolder";
import type { ReaderSetupItem } from "./readerSteps";
import type { NodeTree } from "./types";

const plugin = { name: "review-kit", source: "acme marketplace", contains: ["commands", "hooks"] as ("commands" | "hooks")[], install: "/plugin install review-kit@acme" };

describe("SV-30 P5: plugins", () => {
  it("is a setup kind with its own label", () => {
    expect(SETUP_KINDS).toContain("plugin");
    expect(SETUP_KIND_LABEL.plugin).toBe("Plugin");
  });
  it("saves, reads back, and keeps the install line exactly as given", async () => {
    const node = (await addSetupPlugin("b", [], "typed-1", { ...plugin, install: "  /plugin install review-kit@acme --scope user " })) as unknown as NodeTree;
    const [item] = setupItemsOf([{ ...node, parent_id: null, position: 1, children: [] } as NodeTree]);
    expect(item).toMatchObject({ kind: "plugin", name: "review-kit", plugin: { source: "acme marketplace", contains: ["commands", "hooks"], install: "  /plugin install review-kit@acme --scope user " } });
  });
  it("refuses a plugin with no name or install line, or past a limit", () => {
    expect(pluginRefusal({ ...plugin, name: " " })).toBe("A plugin needs its name.");
    expect(pluginRefusal({ ...plugin, install: "" })).toBe("A plugin needs its install line.");
    expect(pluginRefusal({ ...plugin, name: "n".repeat(81) })).toBe("Plugin name: 80 characters max");
    expect(pluginRefusal({ ...plugin, source: "s".repeat(201) })).toBe("Source: 200 characters max");
    expect(pluginRefusal(plugin)).toBeNull();
  });
  it("exports the install line and no plugin files", async () => {
    const item = { id: "p", kind: "plugin", kindLabel: "Plugin", name: "review-kit", description: null, notShared: false, download: null, files: [], server: null, rule: null, workflow: null, path: null, plugin } as unknown as ReaderSetupItem;
    expect(pluginsToInstall([item])).toBe("Install the plugin review-kit from acme marketplace: /plugin install review-kit@acme\n");
    const { entries } = await setupFolder([item], async () => null);
    expect(entries.map((entry) => entry.path)).toEqual(["PLUGINS-TO-INSTALL.md"]);
    expect(pluginInstallLine("x", { source: "", install: "npm i x" })).toBe("Install the plugin x: npm i x");
  });
  it("leaves a plugin the maker keeps to themselves out of the folder", async () => {
    const item = { id: "p", kind: "plugin", kindLabel: "Plugin", name: "k", description: null, notShared: true, download: null, files: [], server: null, rule: null, workflow: null, path: null, plugin } as unknown as ReaderSetupItem;
    expect(pluginsToInstall([item])).toBeNull();
  });
});
