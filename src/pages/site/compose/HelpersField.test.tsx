import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HelpersField, helperFromDraft } from "./HelpersField";
import type { Helper } from "@/lib/build/helpers";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => cleanup());

const open = (over: Partial<Parameters<typeof HelpersField>[0]> = {}) => {
  const onChange = vi.fn();
  render(<HelpersField helpers={[]} toolNames={["fetch_docs"]} decisions={[]} phone={false} onChange={onChange} {...over} />);
  return onChange;
};

describe("Supporting models (CA-13 P6, CA-15 P7)", () => {
  it("adds a summarize helper from its few fields and shows it as a chip", () => {
    const onChange = open();
    fireEvent.click(screen.getByRole("button", { name: "Add a helper" }));
    fireEvent.change(screen.getByLabelText("When the history reaches"), { target: { value: "80" } });
    fireEvent.change(screen.getByLabelText("Keep the newest"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Add helper" }));
    expect(onChange).toHaveBeenCalledWith([{ provider: "scaledown", job: "summarize", trigger: { at: 0.8, keep: 0.1 } }]);
  });

  it("shows the helpers it has as chips with their second line, and removes one", () => {
    const helpers: Helper[] = [{ provider: "scaledown", job: "compress", tools: ["fetch_docs"], did: { before: 18402, after: 3110, unit: "characters", source: "maker" } }];
    const onChange = open({ helpers });
    expect(screen.getByText("Compress fetch_docs")).toBeTruthy();
    expect(screen.getByText("83% smaller")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove helper 1" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("will not add an extract helper with no fields, and says so", () => {
    const onChange = open();
    fireEvent.click(screen.getByRole("button", { name: "Add a helper" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Job of the helper" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Extract" }));
    fireEvent.click(screen.getByRole("button", { name: "Add helper" }));
    expect(screen.getByRole("alert").textContent).toBe("The extract helper needs the fields to pull out.");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("works the before and after into 'what it did' without a typed percentage", () => {
    const made = helperFromDraft({
      job: "compress", provider: "scaledown", typedProvider: "", model: "", at: "", keep: "", tools: ["fetch_docs"], fields: [], fieldInput: "", labels: [], labelInput: "", stopLabel: "", stopAt: "", decision: "",
      did: true, times: "", before: "18,402", after: "3,110", unit: "characters", values: "", stoppedLabel: "", stoppedScore: "", source: "run",
    });
    expect("helper" in made && made.helper.did).toEqual({ source: "run", before: 18402, after: 3110, unit: "characters" });
  });
});
