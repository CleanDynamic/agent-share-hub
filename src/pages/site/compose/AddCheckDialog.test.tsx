// CA-03 P5, CA-15 P5: Add › Check: the required fields in order, the Runs panel, the Optional section and the refusals in plain words.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddCheckDialog, CHECK_DIALOG_COPY } from "./AddCheckDialog";
import { fieldNames, fieldNamed } from "./optionalKit";

let phone = false;
beforeEach(() => {
  phone = false;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: phone && /max-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(cleanup);

function open() {
  const onAdd = vi.fn();
  const onOpenChange = vi.fn();
  render(<AddCheckDialog open onOpenChange={onOpenChange} onAdd={onAdd} />);
  return { onAdd, onOpenChange };
}

const type = (label: string, value: string) => fireEvent.change(screen.getAllByLabelText(label).at(-1) as HTMLElement, { target: { value } });
const add = () => screen.getByRole("button", { name: CHECK_DIALOG_COPY.add }) as HTMLButtonElement;
const row = (name: string) => fieldNamed(name);
const openRow = (name: string) => void fieldNamed(name);
const status = () => screen.getByTestId("modal-status").textContent;

function fill() {
  type("Test description", " Places a test order ");
  type("Pass criteria", "The total shows £9.00");
  type("Passed", "14");
  type("Total", "14");
}

describe("Add › Check", () => {
  it("asks the test description, the pass criteria and the runs, then keeps fourteen optional fields closed (SV-29 adds Test set, Metric, Failure types, Graders, Runs per case and CI gate)", () => {
    open();
    const dialog = screen.getByRole("dialog", { name: "Add a check" });
    expect(screen.getByTestId("modal-subtitle").textContent).toBe("Test of part of the build");
    expect([...dialog.querySelectorAll("label")].map((label) => label.textContent).slice(0, 2)).toEqual(["Test description", "Pass criteria"]);
    expect((screen.getByLabelText("Test description") as HTMLTextAreaElement).rows).toBe(2);
    expect((screen.getByLabelText("Pass criteria") as HTMLTextAreaElement).rows).toBe(2);
    expect(within(dialog).getByText("passed out of")).toBeTruthy();
    expect(screen.getByTestId("optional-count").textContent).toBe("14 fields");
    expect(fieldNames()).toEqual([
      "Test cases",
      "Failure notes",
      "Last run date",
      "Test method",
      "Reviewer",
      "Scoring method",
      "Model tested",
      "Evidence",
      "Test set",
      "Metric",
      "Failure types",
      "Graders",
      "Runs per case",
      "CI gate",
    ]);
    // Add is the one primary.
    expect(dialog.querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/What it tested|What counts as passing|When it failed|passed of\b/);
  });

  it("says the first missing thing, in order, and Add waits", () => {
    open();
    expect(status()).toBe("Required: Test description, Pass criteria, Runs");
    type("Test description", "Places a test order");
    expect(status()).toBe("Required: Pass criteria, Runs");
    type("Pass criteria", "The total shows £9.00");
    expect(status()).toBe("Required: Runs");
    expect(add().disabled).toBe(true);
    type("Passed", "14");
    type("Total", "14");
    expect(status()).toBe("Required fields complete");
    expect(add().disabled).toBe(false);
  });

  it("draws Runs as a panel with the pass rate in mono and a 6px bar filled to it", () => {
    open();
    const panel = screen.getByTestId("check-runs").children[1] as HTMLElement;
    expect(getComputedStyle(panel).borderRadius).toBe("10px");
        expect(screen.getByTestId("check-rate").textContent).toBe("");
    type("Passed", "3");
    type("Total", "4");
    expect(screen.getByTestId("check-rate").textContent).toBe("75% pass rate");
    expect(screen.getByTestId("check-bar").style.height).toBe("6px");
    expect(screen.getByTestId("check-bar-fill").style.width).toBe("75%");
  });

  it("hands the three required answers over trimmed, with nothing else when nothing else was given", () => {
    const { onAdd, onOpenChange } = open();
    fill();
    openRow("Last run date");
    type("Last run date", "2026-10-12");
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalledWith({ tested: "Places a test order", passing: "The total shows £9.00", onFail: null, passed: 14, total: 14, runAt: "2026-10-12" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("test cases stand in for the runs, which are then worked out from them", () => {
    const { onAdd } = open();
    type("Test description", "Places a test order");
    type("Pass criteria", "The total shows £9.00");
    openRow("Test cases");
    fireEvent.click(screen.getByRole("button", { name: "Add a test case" }));
    fireEvent.change(screen.getByLabelText("In of case 1"), { target: { value: "2 loaves" } });
    fireEvent.change(screen.getByLabelText("Expected of case 1"), { target: { value: "£9.00" } });
    expect(status()).toBe("Required fields complete");
    expect((screen.getByLabelText("Passed") as HTMLInputElement).value).toBe("1");
    expect((screen.getByLabelText("Total") as HTMLInputElement).value).toBe("1");
    expect(within(row("Test cases")).queryByText("Test cases")).toBeTruthy();
    fireEvent.click(add());
    expect(onAdd.mock.calls[0][0].cases).toEqual([{ input: "2 loaves", expected: "£9.00", actual: "", passed: true }]);
  });

  it("keeps failure notes, method, reviewer, scoring, model tested and evidence for the writer", () => {
    const { onAdd } = open();
    fill();
    openRow("Failure notes");
    type("Failure notes", " It showed £8.99. ");
    openRow("Test method");
    fireEvent.click(screen.getByRole("radio", { name: "Peer review" }));
    openRow("Reviewer");
    fireEvent.click(screen.getByRole("radio", { name: "Client" }));
    openRow("Scoring method");
    fireEvent.click(screen.getByRole("radio", { name: "Metric against a target" }));
    type("Target", "95% correct");
    openRow("Model tested");
    type("Version", "2026-09-30");
    openRow("Evidence");
    type("Evidence URL", "example.com/results");
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalledWith({
      tested: "Places a test order",
      passing: "The total shows £9.00",
      onFail: "It showed £8.99.",
      passed: 14,
      total: 14,
      runAt: null,
      method: "review",
      reviewer: "client",
      scoring: { how: "metric", target: "95% correct" },
      modelTested: { model: "", version: "2026-09-30" },
      evidence: { url: "example.com/results" },
      evidenceDraft: expect.objectContaining({ kind: "", url: "example.com/results" }),
    });
  });

  it("scoring shows a target only for 'Metric against a target'", () => {
    open();
    openRow("Scoring method");
    expect(screen.queryByLabelText("Target")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Rating" }));
    expect(screen.queryByLabelText("Target")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Metric against a target" }));
    expect(screen.getByLabelText("Target")).toBeTruthy();
  });

  it("takes one evidence file, or a URL, not both", () => {
    const { onAdd } = open();
    fill();
    openRow("Evidence");
    const file = new File(["x"], "results.csv", { type: "text/csv" });
    fireEvent.change(screen.getByTestId("check-evidence-file"), { target: { files: [file] } });
    expect((screen.getByLabelText("Evidence URL") as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(add());
    expect(onAdd.mock.calls[0][0].evidenceFile).toBe(file);
    expect(onAdd.mock.calls[0][0].evidence).toBeUndefined();
  });

  it("refuses an evidence file that holds keys, by name", () => {
    open();
    openRow("Evidence");
    fireEvent.change(screen.getByTestId("check-evidence-file"), { target: { files: [new File(["x"], ".env", { type: "" })] } });
    expect(screen.getByRole("alert").textContent).toContain("can hold keys or passwords");
  });

  it("says why it refuses, in plain words, and adds nothing", () => {
    const { onAdd } = open();
    fill();
    type("Passed", "15");
    fireEvent.click(add());
    expect(screen.getByRole("alert").textContent).toBe("Passed: no more than total");
    type("Passed", "14");
    openRow("Last run date");
    type("Last run date", "2026-13-01");
    fireEvent.click(add());
    expect(screen.getByRole("alert").textContent).toBe("Format: 2026-10-12");
    type("Last run date", "");
    openRow("Evidence");
    type("Evidence URL", "not a url");
    fireEvent.click(add());
    expect(screen.getByRole("alert").textContent).toBe("Format: example.com/results");
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("takes only digits in the counts", () => {
    open();
    type("Passed", "1a4");
    expect((screen.getByLabelText("Passed") as HTMLInputElement).value).toBe("14");
  });

  it("is a bottom sheet on a phone", () => {
    phone = true;
    open();
    expect(screen.getByTestId("bottom-sheet")).toBeTruthy();
  });
});
