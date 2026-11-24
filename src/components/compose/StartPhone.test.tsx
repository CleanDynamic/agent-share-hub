// Mobile prompt 25, Part C: the phone's offer on Start a build.

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { StartPhone, type StartPhoneProps } from "./StartPhone";

function draw(over: Partial<StartPhoneProps> = {}) {
  const props: StartPhoneProps = {
    waiting: null,
    busy: false,
    isStarting: false,
    text: "",
    onText: vi.fn(),
    onReadPasted: vi.fn(),
    repoUrl: "",
    onRepoUrl: vi.fn(),
    onReadRepo: vi.fn(),
    onFile: vi.fn(),
    onBuildFile: vi.fn(),
    onStartEmpty: vi.fn(),
    error: null,
    ...over,
  };
  render(
    <MemoryRouter>
      <StartPhone {...props} />
    </MemoryRouter>,
  );
  return props;
}

describe("StartPhone", () => {
  it("stacks the five ways in, in the desktop's order, with no drop wording", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Start a build" })).toBeInTheDocument();
    const heads = ["Paste a transcript", "Drop a file", "Or paste a repository URL", "Or drop a Build File"].map((name) => screen.getByText(name));
    heads.slice(1).forEach((head, i) => expect(heads[i].compareDocumentPosition(head) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy());
    expect(document.querySelectorAll('[data-ui="phone-module"]')).toHaveLength(4);
    expect(screen.getByText("A chat export, .json or .zip")).toBeInTheDocument();
    expect(screen.queryByText(/drop it|let go|drag/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Start empty instead" })).toBeInTheDocument();
  });

  it("each way hands back what was chosen", () => {
    const p = draw({ text: "You said: hi" });
    fireEvent.click(screen.getByRole("button", { name: "Read it" }));
    expect(p.onReadPasted).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Read it, repository URL" }));
    expect(p.onReadRepo).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Start empty instead" }));
    expect(p.onStartEmpty).toHaveBeenCalled();
    const file = new File(["x"], "chat.json", { type: "application/json" });
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
    fireEvent.change(inputs[0], { target: { files: [file] } });
    expect(p.onFile).toHaveBeenCalledWith(file);
    fireEvent.change(inputs[1], { target: { files: [file] } });
    expect(p.onBuildFile).toHaveBeenCalledWith(file);
  });

  it("disables the ways in while busy and shows an error as an alert", () => {
    draw({ busy: true, error: "Nothing to read." });
    expect((screen.getByRole("button", { name: "Choose a file" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe("Nothing to read.");
  });
});
