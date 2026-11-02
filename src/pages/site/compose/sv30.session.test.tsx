// SV-30: the Session window's new fields.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { fieldNamed } from "./optionalKit";
import { AccessControl, EnvironmentControl, OutputsControl } from "./SessionExtrasFields";

describe("SV-30 P4: environment and access in the Session window", () => {
  it("proposes a system from the setup unticked, and writes only what the maker ticks", () => {
    const onChange = vi.fn();
    render(<AccessControl id="s" extras={{}} proposed={["code"]} phone={false} onChange={onChange} />);
    const write = screen.getByRole("checkbox", { name: "code: write" }) as HTMLInputElement;
    expect(write.checked).toBe(false);
    expect(screen.getByRole("checkbox", { name: "code: read" })).toHaveProperty("checked", false);
    expect(screen.getByText(/in this session's setup/)).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(write);
    expect(onChange).toHaveBeenCalledWith({ access: [{ system: "code", scope: "write" }] });
  });
  it("takes a system back off, and removes the key when none is left", () => {
    const onChange = vi.fn();
    render(<AccessControl id="s" extras={{ access: [{ system: "tests", scope: "read" }] }} phone={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "tests: read" }));
    expect(onChange).toHaveBeenCalledWith({ access: undefined });
  });
  it("saves the environment, isolation and installing", () => {
    const onChange = vi.fn();
    render(<EnvironmentControl id="s" extras={{}} phone={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Cloud sandbox" }));
    expect(onChange).toHaveBeenLastCalledWith({ environment: "cloud_sandbox" });
    fireEvent.click(screen.getByRole("radio", { name: "Git worktree" }));
    expect(onChange).toHaveBeenLastCalledWith({ isolation: "worktree" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Could install packages" }));
    expect(onChange).toHaveBeenLastCalledWith({ can_install: true });
  });
});

describe("SV-30 P7: output links in the Session window", () => {
  it("refuses a short SHA and a non-https link, saving nothing", () => {
    const onChange = vi.fn();
    render(<OutputsControl id="s" extras={{}} phone={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a link" }));
    fireEvent.change(screen.getByLabelText("Repository of output 1"), { target: { value: "https://github.com/acme/app" } });
    fireEvent.blur(screen.getByLabelText("Repository of output 1"));
    fireEvent.change(screen.getByLabelText("SHA of output 1"), { target: { value: "abc" } });
    fireEvent.blur(screen.getByLabelText("SHA of output 1"));
    expect(screen.getByText("A commit SHA is 7 to 40 hex characters.")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });
  it("saves a whole commit and offers Show readers, off until ticked", () => {
    const onChange = vi.fn();
    render(<OutputsControl id="s" extras={{ outputs: [{ kind: "commit", repo: "https://github.com/acme/app", sha: "abc1234" }] }} phone={false} onChange={onChange} />);
    const show = screen.getByRole("checkbox") as HTMLInputElement;
    expect(show.checked).toBe(false);
    fireEvent.click(show);
    expect(onChange).toHaveBeenCalledWith({ outputs: [{ kind: "commit", repo: "https://github.com/acme/app", sha: "abc1234" }], showOutputs: true });
  });
});

describe("SV-30 P8: the one evidence control", () => {
  it("is the Check window's evidence field, with every kind", async () => {
    const { AddCheckDialog } = await import("./AddCheckDialog");
    const onAdd = vi.fn();
    render(<AddCheckDialog open onOpenChange={() => undefined} onAdd={onAdd} />);
    fireEvent.change(screen.getByLabelText("Test description"), { target: { value: "Boots" } });
    fireEvent.change(screen.getByLabelText("Pass criteria"), { target: { value: "Under 60 ms" } });
    fireEvent.change(screen.getByLabelText("Passed"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Total"), { target: { value: "20" } });
    fieldNamed("Evidence");
    fireEvent.click(screen.getByRole("button", { name: "Before and after measurement" }));
    for (const [label, value] of [["What was measured", "Boot time"], ["Unit", "ms"], ["Before", "120"], ["After", "58"], ["Runs measured", "20"]]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd.mock.calls[0][0].evidence).toEqual({ kind: "measurement", measurement: { metric: "Boot time", unit: "ms", before: 120, after: 58, runs: 20 } });
  });
});

describe("SV-30 P8: a comparison row's evidence", () => {
  it("is the same control, and is saved with the row", async () => {
    const { AddCheckDialog } = await import("./AddCheckDialog");
    const onAdd = vi.fn();
    render(<AddCheckDialog open onOpenChange={() => undefined} onAdd={onAdd} />);
    fireEvent.change(screen.getByLabelText("Test description"), { target: { value: "Which is faster" } });
    fireEvent.change(screen.getByLabelText("Pass criteria"), { target: { value: "One wins" } });
    fireEvent.change(screen.getByLabelText("Passed"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Total"), { target: { value: "1" } });
    fieldNamed("Scoring method");
    fireEvent.click(screen.getByRole("radio", { name: "Comparison of approaches" }));
    fieldNamed("Approaches");
    fireEvent.change(screen.getByLabelText("Label of row 1"), { target: { value: "Old boot" } });
    fireEvent.change(screen.getByLabelText("Label of row 2"), { target: { value: "New boot" } });
    fireEvent.click(within(screen.getByRole("group", { name: "Row 2: Kind of evidence" })).getByRole("button", { name: "Test run output" }));
    fireEvent.change(screen.getByLabelText("Row 2: Pasted output"), { target: { value: "58 ms over 20 runs" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    const rows = onAdd.mock.calls[0][0].extras.rows as { label: string; evidence?: unknown }[];
    expect(rows.find((row) => row.label === "New boot")?.evidence).toEqual({ kind: "test_output", text: "58 ms over 20 runs" });
    expect(rows.find((row) => row.label === "Old boot")?.evidence).toBeUndefined();
  });
});
