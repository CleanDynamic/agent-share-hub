// CA-18 P5: Details in a smaller window: the overlay panel, the phone sheet, and nothing where it fits beside the build.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sandboxViewProps } from "@/dev/fixtures/sandbox";

import { SandboxView, type SandboxViewProps } from "./SandboxView";

function stubWidth(px: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = min ? px >= Number(min[1]) : max ? px <= Number(max[1]) : false;
    return { matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined };
  });
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: px });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
}

function view(width: number, over: Partial<SandboxViewProps> = {}) {
  stubWidth(width);
  const onEditSelected = vi.fn();
  const props = {
    ...sandboxViewProps("bakery"),
    selectedKey: "p1",
    onEditSelected,
    selection: (
      <div>
        <h3>Prompt 1</h3>
        <p>The text of it</p>
        <button type="button">Copy</button>
        <a href="/elsewhere">A link</a>
      </div>
    ),
    ...over,
  };
  render(
    <MemoryRouter>
      <SandboxView {...props} />
    </MemoryRouter>,
  );
  return onEditSelected;
}

afterEach(cleanup);

describe("a window from 768 to where Details fits", () => {
  it("opens a 360 panel on a selection, with the foot Click to edit", () => {
    view(1100);
    const panel = screen.getByTestId("details-overlay");
    expect(panel.style.width).toBe("360px");
    expect(within(panel).getByTestId("details-foot").textContent).toBe("Click to edit");
  });

  it("opens the window from a click on the content, but not on Copy, a link or the close button", () => {
    const onEdit = view(1100);
    const panel = screen.getByTestId("details-overlay");
    fireEvent.click(within(panel).getByRole("button", { name: "Copy" }));
    fireEvent.click(within(panel).getByRole("link", { name: "A link" }));
    fireEvent.click(within(panel).getByRole("button", { name: "Close details" }));
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("opens the window from a click on the text, and from Enter on the content", () => {
    const onEdit = view(1100);
    const panel = screen.getByTestId("details-overlay");
    fireEvent.click(within(panel).getByText("The text of it"));
    expect(onEdit).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(within(panel).getByTestId("details-clickable"), { key: "Enter" });
    expect(onEdit).toHaveBeenCalledTimes(2);
  });

  it("closes with its button and with Escape, and is not modal", () => {
    view(1100);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(screen.queryByTestId("details-overlay")).toBeNull();
    cleanup();
    view(1100);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("details-overlay")).toBeNull();
  });

  it("draws no panel with nothing selected", () => {
    view(1100, { selectedKey: null });
    expect(screen.queryByTestId("details-overlay")).toBeNull();
  });
});

describe("a phone", () => {
  it("shows Details in its sheet with the foot Tap to edit", () => {
    const onEdit = view(390);
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByTestId("details-foot").textContent).toBe("Tap to edit");
    fireEvent.click(screen.getByText("The text of it"));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

describe("a window where Details fits beside the build", () => {
  it("has no panel, no foot, and a click on the content does nothing", () => {
    const onEdit = view(1440);
    expect(screen.queryByTestId("details-overlay")).toBeNull();
    expect(screen.queryByTestId("details-foot")).toBeNull();
    fireEvent.click(screen.getByText("The text of it"));
    expect(onEdit).not.toHaveBeenCalled();
  });
});
