// CA-03 P5 — Add › Check: the five questions in order, the one primary, and the refusals in plain words.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AddCheckDialog, CHECK_DIALOG_COPY } from "./AddCheckDialog";

afterEach(cleanup);

function open() {
  const onAdd = vi.fn();
  const onOpenChange = vi.fn();
  render(<AddCheckDialog open onOpenChange={onOpenChange} onAdd={onAdd} />);
  return { onAdd, onOpenChange };
}

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("Add › Check", () => {
  it("asks what it tested, what counts as passing, when it failed, its runs and its last run, in that order", () => {
    open();
    const dialog = screen.getByRole("dialog", { name: "Add a check" });
    const labels = [...dialog.querySelectorAll("label, [role='group'] > div:first-child > span")].map((label) => label.textContent);
    expect(labels).toEqual(["What it tested", "What counts as passing", "When it failed", "Runs", "Last run"]);
    expect((screen.getByLabelText("What it tested") as HTMLTextAreaElement).rows).toBe(3);
    expect((screen.getByLabelText("What counts as passing") as HTMLTextAreaElement).rows).toBe(2);
    const failed = screen.getByLabelText("When it failed") as HTMLTextAreaElement;
    expect(failed.rows).toBe(3);
    expect(failed.placeholder).toBe("What went wrong, and what changed before it ran again");
    expect(within(dialog).getByText("passed of")).toBeTruthy();
    // Add is the one primary.
    expect(dialog.querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
  });

  it("waits for what it tested, what counts as passing and both counts, then hands them over", () => {
    const { onAdd, onOpenChange } = open();
    const add = screen.getByRole("button", { name: CHECK_DIALOG_COPY.add }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    type("What it tested", " Places a test order ");
    type("What counts as passing", "The total shows £9.00");
    type("Passed", "14");
    type("Total", "14");
    type("Last run", "2026-10-12");
    expect(add.disabled).toBe(false);
    fireEvent.click(add);
    expect(onAdd).toHaveBeenCalledWith({ tested: "Places a test order", passing: "The total shows £9.00", onFail: null, passed: 14, total: 14, runAt: "2026-10-12" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("says why it refuses, in plain words, and adds nothing", () => {
    const { onAdd } = open();
    type("What it tested", "Places a test order");
    type("What counts as passing", "The total shows £9.00");
    type("Passed", "15");
    type("Total", "14");
    fireEvent.click(screen.getByRole("button", { name: CHECK_DIALOG_COPY.add }));
    expect(screen.getByRole("alert").textContent).toBe("Passed can't be more than the total.");
    type("Passed", "14");
    type("Last run", "2026-13-01");
    fireEvent.click(screen.getByRole("button", { name: CHECK_DIALOG_COPY.add }));
    expect(screen.getByRole("alert").textContent).toBe("Last run is a date, written as 2026-10-12.");
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("takes only digits in the counts", () => {
    open();
    type("Passed", "1a4");
    expect((screen.getByLabelText("Passed") as HTMLInputElement).value).toBe("14");
  });
});
