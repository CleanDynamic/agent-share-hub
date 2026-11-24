// Mobile prompt 25, Part E: /connect below 768.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONNECTOR_URL } from "@/lib/connect/connector";
import { copyText } from "@/lib/connect/copyText";

import { ConnectView } from "./ConnectView";

vi.mock("@/lib/connect/copyText", () => ({ copyText: vi.fn(async () => true) }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("max-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => vi.unstubAllGlobals());

const draw = () => {
  const props = { tool: "Claude" as const, onTool: vi.fn(), onDone: vi.fn() };
  render(
    <MemoryRouter>
      <ConnectView {...props} />
    </MemoryRouter>,
  );
  return props;
};

describe("ConnectView on a phone", () => {
  it("keeps the h1 for screen readers and draws the three steps as modules", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Connect a tool" }).className).toContain("sr-only");
    expect(document.querySelectorAll('[data-ui="phone-module"]')).toHaveLength(3);
  });

  it("switches tool from pills", () => {
    const { onTool } = draw();
    fireEvent.click(within(screen.getByRole("group", { name: "AI tool" })).getByRole("button", { name: "Cursor" }));
    expect(onTool).toHaveBeenCalledWith("Cursor");
  });

  it("pins 'Copy the connector address' in a footer; it reads Copied after copying and goes to Drafts from step three", async () => {
    const { onDone } = draw();
    expect(screen.getByTestId("connector-address").textContent).toBe(CONNECTOR_URL);
    const footer = screen.getByTestId("connect-footer");
    fireEvent.click(within(footer).getByRole("button", { name: "Copy the connector address" }));
    expect(await within(footer).findByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(copyText).toHaveBeenCalledWith(CONNECTOR_URL);
    fireEvent.click(screen.getByRole("button", { name: "Go to Drafts" }));
    expect(onDone).toHaveBeenCalled();
  });
});
