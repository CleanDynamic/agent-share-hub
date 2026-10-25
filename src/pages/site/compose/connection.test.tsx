// CA-04 P5 — how a tool was connected: what is saved, what Details shows, and what a reader is told.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upsertNode = vi.fn();
vi.mock("@/lib/build/nodes", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build/nodes")>()), upsertNode: (...a: unknown[]) => upsertNode(...a) }));

import { setToolConnection, toolConnectionOf, toolsUsedOf } from "@/lib/build/graph";
import { readerSteps, whatYouNeed } from "@/lib/build/readerSteps";
import type { BuildNode, NodeTree } from "@/lib/build/types";
import { NeedPanel } from "@/pages/site/build/BuildSteps";
import type { BuildStepsView } from "@/pages/site/build/buildModel";

import { DetailsPanel, type ToolView } from "./DetailsPanel";
import { TileEditDialog } from "./TileEditDialog";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  upsertNode.mockReset();
  upsertNode.mockImplementation(async (row: unknown) => row);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const node = (id: string, type: string, payload: Record<string, unknown>, position: number): NodeTree =>
  ({ id, build_id: "b", parent_id: null, position, type, title: null, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [] }) as NodeTree;

const row = (tree: NodeTree): BuildNode => {
  const { children: _children, ...rest } = tree;
  return rest;
};

describe("the saved keys", () => {
  it("saves connection and runs_at on the integration payload, and drops runs_at for anything but an MCP server", async () => {
    const tool = node("t", "integration", { service: "GitHub", scopes: "read" }, 1);
    const mcp = (await setToolConnection(row(tool), "mcp", "web")) as BuildNode;
    expect(mcp.payload).toEqual({ service: "GitHub", scopes: "read", connection: "mcp", runs_at: "web" });
    expect(toolConnectionOf(mcp)).toEqual({ connection: "mcp", runsAt: "web" });
    const app = (await setToolConnection(mcp, "app", "web")) as BuildNode;
    expect(app.payload).toEqual({ service: "GitHub", scopes: "read", connection: "app" });
    const none = (await setToolConnection(app, null)) as BuildNode;
    expect(none.payload).toEqual({ service: "GitHub", scopes: "read" });
    await expect(setToolConnection(row(node("p", "prompt", { text: "x" }, 2)), "mcp")).rejects.toThrow(/Only a tool/);
  });
});

describe("Tool window (CA-18: the connection is chosen there, and Details only reads it)", () => {
  const view = (over: Partial<ToolView> = {}): ToolView => ({ kind: "tool", id: "t", service: "github", scopes: "", usedBy: [], connection: null, runsAt: null, toolsUsed: [], ...over });
  const handlers = (onToolConnection = vi.fn()) => ({ onToolConnection, onRename: vi.fn(), onModel: vi.fn(), onAddUse: vi.fn(), onRemoveUse: vi.fn(), onRuns: vi.fn(), onRemoveInside: vi.fn(), onToggleSessionPrompt: vi.fn(), onDownload: vi.fn(), onFields: vi.fn(), onAddPicture: vi.fn(), onUseAsCover: vi.fn() });
  const mount = (tool: ToolView, onToolConnection = vi.fn()) => {
    render(<TileEditDialog view={tool} handlers={handlers(onToolConnection)} onClose={vi.fn()} />);
    return onToolConnection;
  };
  const save = () => fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }));

  it("offers the nine connection methods, and where an MCP server ran, saving them through onToolConnection", () => {
    const onToolConnection = mount(view());
    const row = screen.getAllByTestId("optional-field").find((el) => within(el).queryByText("Connection method")) as HTMLElement;
    fireEvent.click(within(row).getAllByRole("button")[0]);
    const group = screen.getByRole("group", { name: "Connection method" });
    expect(within(group).getAllByRole("button").map((button) => button.textContent)).toEqual(["MCP server", "Native integration", "Custom code", "Browser extension", "API key", "Zapier, Make or n8n", "Plugin or skill", "Command-line interface", "Manual copy and paste"]);
    expect(screen.queryByRole("group", { name: "Where it ran" })).toBeNull();
    fireEvent.click(within(group).getByRole("button", { name: "MCP server" }));
    expect(onToolConnection).not.toHaveBeenCalled();
    save();
    expect(onToolConnection).toHaveBeenCalledWith("t", "mcp", null);
    cleanup();
    const again = mount(view({ connection: "mcp" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Where it ran" })).getByRole("radio", { name: "Web" }));
    save();
    expect(again).toHaveBeenCalledWith("t", "mcp", "web");
  });

  it("shows the tools it used with their counts, read from what was saved, never typed", () => {
    expect(toolsUsedOf(node("t", "integration", { service: "github", tools_used: { create_issue: 3, get_file: 7, bad: "x" } }, 1))).toEqual([
      { name: "get_file", count: 7 },
      { name: "create_issue", count: 3 },
    ]);
    mount(view({ toolsUsed: [{ name: "get_file", count: 7 }] }));
    expect(within(screen.getByRole("group", { name: "Tools it used" })).getByText("get_file 7")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Tools it used" })).toBeNull();
    cleanup();
    render(<DetailsPanel phone={false} view={view({ toolsUsed: [{ name: "get_file", count: 7 }] })} {...handlers()} />);
    const used = screen.getByRole("region", { name: "Tools it used" });
    expect(used.textContent).toContain("get_file");
    expect(used.textContent).toContain("7");
  });
});

describe("What you need", () => {
  const making = { sessions: [], excluded_models: [], sessions_meta: { "typed-a": { tool: "claude-code", date: "2026-10-14" } } };
  const need = (tree: NodeTree[]) => {
    const steps = readerSteps(tree, making);
    return whatYouNeed(steps, tree, making);
  };
  const prompt = node("p", "prompt", { text: "x", session: "typed-a" }, 1);

  it("gives an MCP server's row one more line, signing in when its setup kept a placeholder, and says Before you connect", () => {
    const server = node("s", "integration", { service: "GitHub", connection: "mcp", runs_at: "web", setup: { session: "typed-a", kind: "server" }, server: { url: "https://x", headers: { Authorization: "${Authorization}" } } }, 2);
    const [tools] = need([prompt, server]);
    expect(tools.rows.find((entry) => entry.title === "GitHub")?.extra).toBe("MCP server · at a web address · sign in with your GitHub account");
    expect(tools.note).toEqual({ title: "Before you connect", line: "This build uses an MCP server. Read its tool descriptions before you connect it. It was used on 14 Oct." });
    const view = { need: [tools], steps: readerSteps([prompt, server], making) } as unknown as BuildStepsView;
    render(
      <MemoryRouter>
        <NeedPanel view={view} onOpenOther={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("need-extra").textContent).toBe("MCP server · at a web address · sign in with your GitHub account");
    expect(screen.getByTestId("need-note").textContent).toContain("Before you connect");
  });

  it("says nothing of MCP for a tool that is not one", () => {
    const [tools] = need([prompt, node("s", "integration", { service: "Gmail", connection: "app" }, 2)]);
    expect(tools.rows.find((entry) => entry.title === "Gmail")?.extra).toBeUndefined();
    expect(tools.note).toBeUndefined();
  });
});
