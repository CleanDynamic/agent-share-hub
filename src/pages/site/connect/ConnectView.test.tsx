// Synth 10 Part E: the Connect page lays the three steps out together, with the tool switch as pills.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { CONNECTOR_URL } from "@/lib/connect/connector";

import { ConnectView } from "./ConnectView";

const draw = (over: Partial<Parameters<typeof ConnectView>[0]> = {}) => {
  const props = { tool: "Claude" as const, onTool: vi.fn(), onDone: vi.fn(), ...over };
  render(
    <MemoryRouter>
      <ConnectView {...props} />
    </MemoryRouter>,
  );
  return props;
};

describe("ConnectView", () => {
  it("heads the page 'Connect a tool' and lists the three steps as headings", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Connect a tool" })).toBeInTheDocument();
    for (const step of ["Add the connector", "Send a session", "Use it in a build"]) {
      expect(screen.getByRole("heading", { level: 2, name: step })).toBeInTheDocument();
    }
  });

  it("words the Claude step without arrow characters, and shows the address in a Card with its copy button", () => {
    draw();
    expect(screen.getByText("In Claude, open Customize, Connectors, choose +, then Add custom connector.")).toBeInTheDocument();
    expect(screen.getByTestId("connector-address").textContent).toBe(CONNECTOR_URL);
    expect(screen.getByRole("button", { name: "Copy the connector address" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[→↗—]/);
  });

  it("switches tool from the pills, which are text only", () => {
    const { onTool } = draw();
    const group = screen.getByRole("group", { name: "AI tool" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["Claude", "Claude Code", "ChatGPT", "Cursor"]);
    fireEvent.click(within(group).getByRole("button", { name: "Cursor" }));
    expect(onTool).toHaveBeenCalledWith("Cursor");
  });

  it("sends a session with one line, and Go to Drafts leaves for Drafts", () => {
    const { onDone } = draw();
    expect(screen.getByText("Sends the whole conversation to Sessions on your Drafts page.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Go to Drafts" }));
    expect(onDone).toHaveBeenCalled();
  });
});
