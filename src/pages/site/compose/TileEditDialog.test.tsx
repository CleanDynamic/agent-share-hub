// CA-18 P2: every tile's window, opened on a tile that is there.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tileView } from "@/dev/fixtures/detailsKinds";

import type { DetailsHandlers, DetailsView } from "./DetailsPanel";
import { TileEditDialog, opensEditDialog } from "./TileEditDialog";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const HANDLER_NAMES = [
  "onExtras", "onDecision", "onRunsWhen", "onRuntime", "onReadHelpers", "onRename", "onOpenPrompt", "onModel", "onAddUse", "onAttach", "onRemoveUse", "onAddMade", "onRemoveMade", "onRuns", "onManual", "onManualPicture", "onInstructions", "onAgentSetup", "onRemoveInside", "onToggleSessionPrompt", "onSessionTool", "onSessionMeta", "onSessionGoal", "onSessionExtras", "onTrainedOn", "onAgentNotes", "onModelRun", "onCheckRuns", "onCheckCases", "onCheckText", "onCodeSource", "onSessionTogether", "onToolConnection", "onAddToSetup", "onNotShared", "onDownload", "onFields", "onAddPicture", "onUseAsCover", "onSelect",
] as const;

function handlers(): DetailsHandlers & Record<(typeof HANDLER_NAMES)[number], ReturnType<typeof vi.fn>> {
  return Object.fromEntries(HANDLER_NAMES.map((name) => [name, vi.fn()])) as never;
}

function open(view: DetailsView, h = handlers()) {
  const onClose = vi.fn();
  render(<TileEditDialog view={view} handlers={h} inBuild={[]} onClose={onClose} />);
  return { h, onClose };
}

const KINDS = ["manual", "code", "check", "decision", "tool", "agent", "team", "result", "system_prompt", "dataset", "repo"] as const;

describe("every kind opens in edit mode, filled in", () => {
  it.each(KINDS)("%s: Edit above its own line, Save as its primary", (kind) => {
    open(tileView(kind, "full"));
    expect(screen.getByTestId("modal-eyebrow").textContent).toBe("Edit");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: "Add" })).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(dialog.querySelector('[role="dialog"], h2')?.textContent ?? dialog.textContent).toBeTruthy();
  });

  it("names a tile by its own line", () => {
    open(tileView("tool", "full"));
    expect(screen.getByRole("dialog", { name: "Tool · Gmail" })).toBeTruthy();
  });

  it("takes a prompt and a file out: a prompt has its own window and a file has none", () => {
    expect(opensEditDialog(tileView("prompt"))).toBe(false);
    expect(opensEditDialog(tileView("file"))).toBe(false);
    for (const kind of [...KINDS, "session"] as const) expect(opensEditDialog(tileView(kind)), kind).toBe(true);
  });
});

const dialog = () => screen.getByRole("dialog");
const save = () => fireEvent.click(within(dialog()).getByRole("button", { name: "Save" }));
const optional = (name: string) => within(dialog()).getAllByTestId("optional-field").find((el) => within(el).queryByText(name)) as HTMLElement;
const openRow = (name: string) => fireEvent.click(within(optional(name)).getAllByRole("button")[0]);
const callsOf = (h: ReturnType<typeof handlers>) => HANDLER_NAMES.flatMap((name) => h[name].mock.calls.map((args) => [name, ...args]));

describe("Save writes through the same handlers with the same arguments", () => {
  it("a tool: Actions performed is onFields, Permissions is onExtras, the connection is onToolConnection", () => {
    const { h } = open(tileView("tool", "full"));
    openRow("Actions performed");
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Actions performed" }), { target: { value: "read, send" } });
    openRow("Permissions");
    fireEvent.click(within(dialog()).getByRole("radio", { name: "Read only" }));
    save();
    expect(callsOf(h)).toHaveLength(2);
    expect(callsOf(h)).toEqual(expect.arrayContaining([["onFields", "t1", { scopes: "read, send" }], ["onExtras", "t1", { permissions: "read" }]]));
  });

  it("a tool: choosing a connection other than MCP drops where it ran", () => {
    const { h } = open(tileView("tool", "full"));
    openRow("Connection method");
    fireEvent.click(within(dialog()).getByRole("button", { name: "API key" }));
    save();
    expect(h.onToolConnection).toHaveBeenCalledWith("t1", "api_key", null);
  });

  it("a tool: where an MCP server ran is written with the connection", () => {
    const { h } = open(tileView("tool", "full"));
    fireEvent.click(within(dialog()).getByRole("radio", { name: "Local" }));
    save();
    expect(h.onToolConnection).toHaveBeenCalledWith("t1", "mcp", "local");
  });

  it("writes nothing when nothing changed", () => {
    for (const kind of KINDS) {
      cleanup();
      const view = tileView(kind, "full");
      if (kind === "decision") continue;
      const { h } = open(view);
      const button = within(dialog()).getByRole("button", { name: "Save" }) as HTMLButtonElement;
      if (button.disabled) continue;
      fireEvent.click(button);
      expect(JSON.stringify(callsOf(h)), kind).toBe("[]");
    }
  });

  it("Cancel and Escape write nothing, and close", () => {
    const { h, onClose } = open(tileView("tool", "full"));
    openRow("Actions performed");
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Actions performed" }), { target: { value: "changed" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    expect(callsOf(h)).toEqual([]);
    expect(onClose).toHaveBeenCalled();
  });

  it("Escape discards too", () => {
    const { h, onClose } = open(tileView("tool", "full"));
    openRow("Actions performed");
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Actions performed" }), { target: { value: "changed" } });
    fireEvent.keyDown(dialog(), { key: "Escape" });
    expect(callsOf(h)).toEqual([]);
    expect(onClose).toHaveBeenCalled();
  });

  it("a manual step: its title, its lines, its picture and its inputs", () => {
    const view = tileView("manual", "full");
    const { h } = open(view);
    fireEvent.blur(within(dialog()).getByRole("textbox", { name: "Title" }), { target: { value: "Export the logo" } });
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Line 2" }), { target: { value: "Exported the mark" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Remove the picture" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Remove menu.pdf" }));
    save();
    expect(callsOf(h)).toEqual(
      expect.arrayContaining([
        ["onRename", "m1", "Export the logo"],
        ["onManual", "m1", { text: "Opened the file\nExported the mark" }],
        ["onManual", "m1", { media_id: null }],
        ["onRemoveUse", "m1", { kind: "file", node_id: "f1" }],
      ]),
    );
  });

  it("a code tile: its file path is onExtras, as Details wrote it", () => {
    const { h } = open(tileView("code", "full"));
    openRow("File path");
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "File path" }), { target: { value: "src/other.ts" } });
    save();
    expect(callsOf(h)).toEqual([["onExtras", "c1", { filename: "src/other.ts" }]]);
  });

  it("a check: its method is onExtras", () => {
    const { h } = open(tileView("check", "full"));
    openRow("Test method");
    fireEvent.click(within(dialog()).getByRole("radio", { name: "Manual" }));
    save();
    expect(callsOf(h)).toEqual([["onExtras", "k1", { method: "manual" }]]);
  });

  it("an agent: its name is onRename and its instructions onInstructions", () => {
    const { h } = open(tileView("agent", "full"));
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Name" }), { target: { value: "Price checker" } });
    openRow("System instructions");
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "System instructions" }), { target: { value: "Check prices." } });
    save();
    expect(callsOf(h)).toEqual(expect.arrayContaining([["onRename", "a5", "Price checker"], ["onInstructions", "a5", "Check prices."]]));
  });

  it("an agent: how it runs is onRuns", () => {
    const { h } = open(tileView("agent", "full"));
    openRow("Trigger");
    fireEvent.click(within(dialog()).getByRole("radio", { name: "On a schedule" }));
    save();
    expect(h.onRuns).toHaveBeenCalledWith("a5", { how: "schedule", detail: "" });
  });

  it("an agent's inside rows and a team's: Remove is onRemoveInside", () => {
    const { h } = open(tileView("agent", "full"));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Remove 5.2 · Prompt 5.2" }));
    save();
    expect(h.onRemoveInside).toHaveBeenCalledWith("a5:p");
  });

  it("a result: its summary is onFields, its caption onExtras, a picture can be the cover", () => {
    const { h } = open(tileView("result", "full"));
    fireEvent.blur(within(dialog()).getByRole("textbox", { name: "Summary" }), { target: { value: "The new homepage" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Use as cover: home.png" }));
    openRow("Caption");
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Caption" }), { target: { value: "Shipped" } });
    save();
    expect(callsOf(h)).toEqual(expect.arrayContaining([["onFields", "r1", { summary: "The new homepage" }], ["onUseAsCover", "pic"], ["onExtras", "r1", { caption: "Shipped" }]]));
  });

  it("a system prompt: its text and its name", () => {
    const { h } = open(tileView("system_prompt", "full"));
    fireEvent.change(within(dialog()).getByRole("textbox", { name: "Name" }), { target: { value: "House voice" } });
    save();
    expect(callsOf(h)).toEqual([["onRename", "sp1", "House voice"]]);
  });

  it("a dataset: its description is onExtras", () => {
    const { h } = open(tileView("dataset", "full"));
    fireEvent.change(within(dialog()).getByRole("textbox", { name: /^Description/ }), { target: { value: "2,000 tickets" } });
    save();
    expect(callsOf(h)).toEqual([["onExtras", "ds1", { description: "2,000 tickets" }]]);
  });

  it("a repository: its description is onExtras", () => {
    const { h } = open(tileView("repo", "full"));
    fireEvent.change(within(dialog()).getByRole("textbox", { name: /^Description/ }), { target: { value: "A rich text editor" } });
    save();
    expect(callsOf(h)).toEqual([["onExtras", "rp1", { description: "A rich text editor" }]]);
  });

  it("an input put in and taken out again is never written", () => {
    const view = tileView("code", "full");
    const { h } = open(view);
    fireEvent.click(within(dialog()).getByRole("button", { name: "Remove menu.pdf" }));
    // Put back from the menu of what it may take.
    fireEvent.keyDown(within(dialog()).getByRole("button", { name: "Add input" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: /menu\.pdf/ }));
    save();
    expect(callsOf(h)).toEqual([]);
  });
});

describe("CA-18: the fields that were shown and locked are editable", () => {
  const field = (name: string) => within(dialog()).getByRole("textbox", { name }) as HTMLTextAreaElement | HTMLInputElement;

  it("a check opens with its test description, pass criteria, failure notes and last run filled in, and none read only", () => {
    open(tileView("check", "full"));
    expect(field("Test description").value).toBe("Places a test order");
    expect(field("Pass criteria").value).toBe("The total shows £9.00");
    openRow("Failure notes");
    expect((field("Failure notes") as HTMLTextAreaElement).value).toBe("The total showed 0.00");
    openRow("Last run date");
    expect(field("Last run date").value).toBe("2026-10-12");
    for (const name of ["Test description", "Pass criteria", "Failure notes", "Last run date"]) expect(field(name).hasAttribute("readonly"), name).toBe(false);
  });

  it("a check: Save writes each changed field through onCheckText, and only those", () => {
    const { h } = open(tileView("check", "full"));
    fireEvent.change(field("Test description"), { target: { value: "Places a delivery order" } });
    fireEvent.change(field("Pass criteria"), { target: { value: "The total shows £12.00" } });
    openRow("Failure notes");
    fireEvent.change(field("Failure notes"), { target: { value: "Showed £0" } });
    openRow("Last run date");
    fireEvent.change(field("Last run date"), { target: { value: "2026-10-20" } });
    save();
    expect(callsOf(h)).toEqual([["onCheckText", "k1", { tested: "Places a delivery order", passing: "The total shows £12.00", onFail: "Showed £0", runAt: "2026-10-20" }]]);
  });

  it("a check: one changed field writes one key", () => {
    const { h } = open(tileView("check", "full"));
    fireEvent.change(field("Pass criteria"), { target: { value: "Shows £10.00" } });
    save();
    expect(callsOf(h)).toEqual([["onCheckText", "k1", { passing: "Shows £10.00" }]]);
  });

  it("a check: an emptied failure note is written as empty, so the key comes off", () => {
    const { h } = open(tileView("check", "full"));
    openRow("Failure notes");
    fireEvent.change(field("Failure notes"), { target: { value: "" } });
    save();
    expect(callsOf(h)).toEqual([["onCheckText", "k1", { onFail: "" }]]);
  });

  it("a check: a blank test description or a date that is not a day is refused and nothing is written", () => {
    const { h } = open(tileView("check", "full"));
    fireEvent.change(field("Test description"), { target: { value: "  " } });
    save();
    expect(within(dialog()).getByRole("alert").textContent).toContain("Test description");
    expect(callsOf(h)).toEqual([]);
    fireEvent.change(field("Test description"), { target: { value: "Places a test order" } });
    openRow("Last run date");
    fireEvent.change(field("Last run date"), { target: { value: "2026-13-45" } });
    save();
    expect(within(dialog()).getByRole("alert").textContent).toContain("Format: 2026-10-12");
    expect(callsOf(h)).toEqual([]);
  });

  it("a check: Cancel writes nothing", () => {
    const { h, onClose } = open(tileView("check", "full"));
    fireEvent.change(field("Test description"), { target: { value: "Changed" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    expect(callsOf(h)).toEqual([]);
    expect(onClose).toHaveBeenCalled();
  });

  it("a code tile opens with its code and language filled in, in a field that can be typed in", () => {
    open(tileView("code", "full"));
    const code = screen.getByTestId("edit-code") as HTMLTextAreaElement;
    expect(code.value).toBe("export const menu = [];\nexport const price = 4;");
    expect(code.hasAttribute("readonly")).toBe(false);
    expect(screen.getByTestId("edit-code-dialog")).toBeTruthy();
  });

  it("a code tile: Save writes the new lines through onCodeSource, and only them", () => {
    const { h } = open(tileView("code", "full"));
    fireEvent.change(screen.getByTestId("edit-code"), { target: { value: "export const menu = [1];" } });
    save();
    expect(callsOf(h)).toEqual([["onCodeSource", "c1", { source: "export const menu = [1];" }]]);
  });

  it("a code tile: the language can be changed and is written with Save", () => {
    const { h } = open(tileView("code", "full"));
    fireEvent.keyDown(within(dialog()).getByRole("button", { name: /Language/ }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Python" }));
    save();
    expect(callsOf(h)).toEqual([["onCodeSource", "c1", { language: "python" }]]);
  });

  it("a code tile: emptied code cannot be saved, and Cancel writes nothing", () => {
    const { h, onClose } = open(tileView("code", "full"));
    fireEvent.change(screen.getByTestId("edit-code"), { target: { value: "" } });
    const button = within(dialog()).getByRole("button", { name: "Save" }) as HTMLButtonElement;
    fireEvent.click(button);
    expect(callsOf(h)).toEqual([]);
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    expect(callsOf(h)).toEqual([]);
    expect(onClose).toHaveBeenCalled();
  });
});
