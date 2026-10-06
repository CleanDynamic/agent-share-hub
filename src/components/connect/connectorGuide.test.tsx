// UI-P45 — the connector guide: each tool's code, the stepper, the footer.

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { CLAUDE_CODE_COMMAND, CONNECTOR_URL, GUIDE_LINKS, type ConnectorTool } from "@/lib/connect/connector";

import { ConnectorGuide, type GuideStep } from "./ConnectorGuide";

const guide = (step: GuideStep, tool: ConnectorTool = "Claude", over: Partial<Parameters<typeof ConnectorGuide>[0]> = {}) =>
  render(
    <MemoryRouter>
      <ConnectorGuide step={step} onStep={vi.fn()} tool={tool} onTool={vi.fn()} onDone={vi.fn()} doneLabel="Done" {...over} />
    </MemoryRouter>,
  );

describe("ConnectorGuide step 1", () => {
  it("is the address in the code well for Claude, ChatGPT and Cursor", () => {
    for (const tool of ["Claude", "ChatGPT", "Cursor"] as const) {
      const { container, unmount } = guide(1, tool);
      expect(container.querySelector("code")?.textContent).toBe(CONNECTOR_URL);
      unmount();
    }
  });

  it("is the whole command for Claude Code, and it has no guide link", () => {
    const { container } = guide(1, "Claude Code");
    expect(container.querySelector("code")?.textContent).toBe(CLAUDE_CODE_COMMAND);
    expect(CLAUDE_CODE_COMMAND).toBe(`claude mcp add --transport http buildgallery ${CONNECTOR_URL}`);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links the other tools' own guides in a new tab", () => {
    guide(1, "Cursor");
    const link = screen.getByRole("link", { name: /Cursor's MCP documentation/ });
    expect(link.getAttribute("href")).toBe(GUIDE_LINKS.Cursor?.href);
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("changes tool from the tabs", () => {
    const onTool = vi.fn();
    guide(1, "Claude", { onTool });
    fireEvent.click(screen.getByRole("button", { name: "ChatGPT" }));
    expect(onTool).toHaveBeenCalledWith("ChatGPT");
  });
});

describe("ConnectorGuide stepper and footer", () => {
  it("marks only the current step with aria-current", () => {
    for (const step of [1, 2, 3] as const) {
      const { unmount } = guide(step);
      const buttons = screen.getAllByRole("button", { name: /Add the connector|Send a session|Use it in a build/ });
      expect(buttons.map((b) => b.getAttribute("aria-current"))).toEqual(
        [1, 2, 3].map((n) => (n === step ? "step" : null)),
      );
      unmount();
    }
  });

  it("disables Back on step 1 and Next goes on", () => {
    const onStep = vi.fn();
    guide(1, "Claude", { onStep });
    expect((screen.getByRole("button", { name: "Back" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onStep).toHaveBeenCalledWith(2);
  });

  it("uses doneLabel on step 3 and calls onDone", () => {
    const onDone = vi.fn();
    guide(3, "Claude", { onDone, doneLabel: "Go to Drafts" });
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Go to Drafts" }));
    expect(onDone).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Import page" }).getAttribute("href")).toBe("/import");
  });

  it("step 2 offers the four phrases", () => {
    guide(2);
    expect(screen.getAllByRole("button", { name: /^Copy “/ })).toHaveLength(4);
  });
});
