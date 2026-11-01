// SV-30: the Session window's new fields.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
