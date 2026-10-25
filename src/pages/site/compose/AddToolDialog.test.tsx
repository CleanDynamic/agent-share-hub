import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddToolDialog, CONNECTION_CHOICES, TOOL_DIALOG_COPY, type AddToolDialogProps } from "./AddToolDialog";

let phone = false;
beforeEach(() => {
  phone = false;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: phone && /max-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function open(over: Partial<AddToolDialogProps> = {}) {
  const props: AddToolDialogProps = { open: true, onOpenChange: vi.fn(), onAdd: vi.fn(), ...over };
  render(<AddToolDialog {...props} />);
  return props;
}

const toolButton = () => screen.getByRole("button", { name: "App" });
const find = () => screen.getByRole("combobox", { name: "Find an app" });
const add = () => screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;
const control = (name: string) => screen.getAllByLabelText(name).at(-1) as HTMLElement;
const row = (name: string) => screen.getAllByTestId("optional-field").find((el) => within(el).queryByText(name)) as HTMLElement;
const openRow = (name: string) => fireEvent.click(within(row(name)).getByRole("button"));

function pickGitHub() {
  fireEvent.click(toolButton());
  fireEvent.change(find(), { target: { value: "github" } });
  fireEvent.keyDown(find(), { key: "Enter" });
}

describe("Add › Tool (CA-02 P6, CA-12 P7, CA-15 P4)", () => {
  it("is the shared frame asking only for an application, with no default, and the rest in Optional", () => {
    open();
    expect(screen.getByRole("dialog", { name: TOOL_DIALOG_COPY.title })).toBeTruthy();
    expect(screen.getByTestId("modal-subtitle").textContent).toBe("External app the model used");
    expect(toolButton().textContent).toBe("Select an app");
    expect(screen.getByTestId("modal-status").textContent).toBe("Required: App");
    expect(add().disabled).toBe(true);
    expect(screen.getByTestId("optional-count").textContent).toBe("6 fields");
    expect(screen.getAllByTestId("optional-field").map((el) => within(el).getAllByRole("button")[0].getAttribute("aria-expanded"))).toEqual(Array(6).fill("false"));
    expect(screen.getAllByTestId("optional-field").map((el) => el.querySelector("button span span")?.textContent)).toEqual(["Connection method", "Actions performed", "Permissions", "Required plan", "Setup steps", "Alternatives"]);
    expect(document.body.textContent).not.toMatch(/How was it connected|What did it do|Pick an app/);
  });

  it("labels the field in sentence case, never in capitals", () => {
    open();
    expect(document.body.innerHTML).not.toMatch(/text-transform:\s*uppercase/);
  });

  it("lists apps and services, not AI tools", () => {
    open();
    fireEvent.click(toolButton());
    fireEvent.click(screen.getByRole("option", { name: /^Show all/ }));
    const names = screen.getAllByRole("option").map((option) => option.textContent);
    expect(names).toEqual(expect.arrayContaining(["GitHub", "Stripe", "Supabase", "Gmail", "Vercel", "n8n"]));
    expect(names).not.toContain("Claude");
    expect(names).not.toContain("ChatGPT");
  });

  it("says GitHub Copilot is an AI tool when GitHub is typed", () => {
    open();
    fireEvent.click(toolButton());
    fireEvent.change(find(), { target: { value: "github" } });
    expect(screen.getByText("GitHub Copilot is an AI tool. Add it to a session or a prompt.")).toBeTruthy();
  });

  it("offers nine connection methods, and the stored keys of the three it had are unchanged", () => {
    expect(CONNECTION_CHOICES.map((choice) => [choice.value, choice.label])).toEqual([
      ["mcp", "MCP server"],
      ["app", "Native integration"],
      ["code", "Custom code"],
      ["extension", "Browser extension"],
      ["api_key", "API key"],
      ["automation", "Zapier, Make or n8n"],
      ["plugin", "Plugin or skill"],
      ["cli", "Command-line interface"],
      ["manual", "Manual copy and paste"],
    ]);
    open();
    openRow("Connection method");
    expect(within(screen.getByRole("group", { name: "Connection method" })).getAllByRole("button")).toHaveLength(9);
  });

  it("hands back the application with the optional fields it was given", () => {
    const props = open();
    pickGitHub();
    expect(screen.getByTestId("modal-status").textContent).toBe("Required fields complete");
    openRow("Connection method");
    fireEvent.click(screen.getByRole("button", { name: "MCP server" }));
    openRow("Actions performed");
    fireEvent.change(control("Actions performed"), { target: { value: " read issues " } });
    openRow("Permissions");
    fireEvent.click(screen.getByRole("radio", { name: "Read and write" }));
    openRow("Required plan");
    fireEvent.change(control("Required plan"), { target: { value: " Team plan " } });
    openRow("Setup steps");
    fireEvent.change(control("Setup steps"), { target: { value: "Create a token\n\n  Add GITHUB_TOKEN to the environment  " } });
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({
      service: "GitHub",
      connection: "mcp",
      scopes: "read issues",
      permissions: "write",
      plan: "Team plan",
      setup: ["Create a token", "Add GITHUB_TOKEN to the environment"],
      alternatives: [],
    });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows what a row holds in place of its description once it is filled and closed", () => {
    open();
    openRow("Actions performed");
    fireEvent.change(control("Actions performed"), { target: { value: "read issues" } });
    openRow("Actions performed");
    expect(within(row("Actions performed")).getByTestId("optional-value").textContent).toBe("read issues");
  });

  it("with API key chosen, Setup steps says to name the key and never paste its value", () => {
    open();
    expect(screen.queryByText("Key names only, like GITHUB_TOKEN")).toBeNull();
    openRow("Connection method");
    fireEvent.click(screen.getByRole("button", { name: "API key" }));
    // CA-15b: the row's grey line is the board's; the key's warning is said inside the row.
    expect(within(row("Setup steps")).getByTestId("optional-line").textContent).toBe("");
    openRow("Setup steps");
    expect(screen.getByTestId("setup-key-hint").textContent).toBe("Key names only, like GITHUB_TOKEN");
  });

  it("takes alternatives from the application picker, once each, never the application itself", () => {
    const props = open();
    pickGitHub();
    openRow("Alternatives");
    const picker = within(screen.getByRole("region", { name: /Alternatives/ })).getByRole("button", { name: "Alternatives" });
    for (const name of ["gitlab", "gitlab", "github"]) {
      fireEvent.click(picker);
      fireEvent.change(screen.getByRole("combobox", { name: "Find an app" }), { target: { value: name } });
      fireEvent.keyDown(screen.getByRole("combobox", { name: "Find an app" }), { key: "Enter" });
    }
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["GitLab"]);
    fireEvent.click(add());
    expect((props.onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0].alternatives).toEqual(["GitLab"]);
  });

  it("takes a typed app as typed, with nothing else when nothing else is given", () => {
    const typed = open();
    fireEvent.click(toolButton());
    fireEvent.change(find(), { target: { value: "  My CRM " } });
    fireEvent.keyDown(find(), { key: "Enter" });
    fireEvent.click(add());
    expect(typed.onAdd).toHaveBeenCalledWith({ service: "My CRM", connection: null, scopes: "", permissions: null, plan: "", setup: [], alternatives: [] });
  });

  it("is a bottom sheet on a phone", () => {
    phone = true;
    open();
    expect(screen.getByTestId("bottom-sheet")).toBeTruthy();
    expect(screen.queryByTestId("add-tool-dialog")).toBeNull();
  });
});
