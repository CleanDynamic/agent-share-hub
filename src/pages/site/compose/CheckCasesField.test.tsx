import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CheckCasesField, keptCases } from "./CheckCasesField";

afterEach(cleanup);

describe("the check cases field (CA-12 P12)", () => {
  it("adds a case, ticks it, and reports every change", () => {
    const onChange = vi.fn();
    render(<CheckCasesField id="c" cases={[]} phone={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a case" }));
    fireEvent.change(screen.getByLabelText("In of case 1"), { target: { value: "2 loaves" } });
    fireEvent.change(screen.getByLabelText("Expected of case 1"), { target: { value: "£9.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Passed" }));
    expect(onChange).toHaveBeenLastCalledWith([{ input: "2 loaves", expected: "£9.00", actual: "", passed: false }]);
    expect(screen.getByText("0 passed of 1")).toBeTruthy();
  });

  it("saves only on blur or tick in Details, and removes a case", () => {
    const onChange = vi.fn();
    render(<CheckCasesField id="c" cases={[{ input: "a", expected: "b", actual: "", passed: true }]} phone={false} onBlurOnly onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Got of case 1"), { target: { value: "c" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(screen.getByLabelText("Got of case 1"));
    expect(onChange).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Remove case 1" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("drops a case that says nothing in or expected", () => {
    expect(keptCases([{ input: " ", expected: "", actual: "x", passed: true }, { input: " a ", expected: "", actual: "", passed: false }])).toEqual([{ input: "a", expected: "", actual: "", passed: false }]);
  });
});
