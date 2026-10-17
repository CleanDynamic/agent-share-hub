// TF-12 — the project link on an app builder's Made with chip.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MadeWithChip } from "./composeModel";
import { MadeWithLine } from "./MadeWithLine";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(cleanup);

const lovable: MadeWithChip = { key: "entry:lovable", tool: null, model: null, label: "Lovable", on: true, kind: "entry" };
const claude: MadeWithChip = { key: "session:Claude Code", tool: "Claude Code", model: null, label: "Claude Code", on: true, kind: "tool" };

function mount(over: Partial<React.ComponentProps<typeof MadeWithLine>> = {}) {
  const props = { phone: false, chips: [lovable, claude], hasSessions: true, onToggle: vi.fn(), onAdd: vi.fn(), onSetProjectLink: vi.fn(), ...over };
  render(<MadeWithLine {...props} />);
  return props;
}

describe("project link on Made with", () => {
  it("offers it on an app builder's chip only", () => {
    mount();
    expect(screen.getAllByRole("button", { name: /project link|Change link/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Add project link for Lovable" })).toBeTruthy();
  });

  it("offers nothing without a way to save", () => {
    mount({ onSetProjectLink: undefined });
    expect(screen.queryByText("Add project link")).toBeNull();
  });

  it("saves an https link, and holds Save back for anything else", () => {
    const props = mount();
    fireEvent.click(screen.getByRole("button", { name: "Add project link for Lovable" }));
    const field = screen.getByLabelText("Paste the link to the project");
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    fireEvent.change(field, { target: { value: "http://lovable.dev/p/1" } });
    expect(save.disabled).toBe(true);
    expect(screen.getByText("The link must start with https://")).toBeTruthy();
    fireEvent.change(field, { target: { value: "https://lovable.dev/p/1" } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(props.onSetProjectLink).toHaveBeenCalledWith("lovable", "https://lovable.dev/p/1");
  });

  it("reads Change link once set, shows the link, and Remove takes it away", () => {
    const props = mount({ projectLinks: { lovable: "https://lovable.dev/p/1" } });
    fireEvent.click(screen.getByRole("button", { name: "Change link for Lovable" }));
    expect((screen.getByLabelText("Paste the link to the project") as HTMLInputElement).value).toBe("https://lovable.dev/p/1");
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(props.onSetProjectLink).toHaveBeenCalledWith("lovable", null);
  });
});
