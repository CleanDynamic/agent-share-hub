// CA-05 P3 — Started with on screen: Session Details saves the command and reads it; the build page shows it with Copy.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readerSteps, stepsMarkdown } from "@/lib/build/readerSteps";
import type { NodeTree } from "@/lib/build/types";
import { StepsList } from "@/pages/site/build/BuildSteps";
import type { BuildStepsView } from "@/pages/site/build/buildModel";

import type { SessionView } from "./DetailsPanel";
import { SessionDialog } from "./SessionDialog";
import { openOptional } from "./optionalKit";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
const save = () => fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const COMMAND = "claude --model opus --permission-mode plan --worktree fix-totals --max-turns 8 --verbose";
const tree = [{ id: "p", build_id: "b", contributor_id: null, parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: { text: "Build it.", session: "typed-a" }, source_ref: null, event_id: null, is_gap: false, created_at: "", updated_at: "", children: [] } as NodeTree];
const session = (over: Partial<SessionView> = {}): SessionView => ({ kind: "session", key: "typed-a", number: 1, tool: "Claude Code", model: "", date: "12 Oct", inBuild: 1, total: 1, status: "ready", checklist: [], ...over });

function mount(view: SessionView, onSessionExtras = vi.fn()) {
  render(<SessionDialog view={view} onClose={vi.fn()} handlers={{ onSessionExtras: onSessionExtras, onRename: vi.fn(), onModel: vi.fn(), onAddUse: vi.fn(), onRemoveUse: vi.fn(), onRuns: vi.fn(), onRemoveInside: vi.fn(), onToggleSessionPrompt: vi.fn(), onDownload: vi.fn(), onFields: vi.fn(), onAddPicture: vi.fn(), onUseAsCover: vi.fn() }} />);
  return onSessionExtras;
}

describe("Session window › Started with", () => {
  it("shows the settings in plain words under the command, and leaves the unknown flag in the command", () => {
    mount(session());
    openOptional();
    const well = screen.getByRole("textbox", { name: "Started with" });
    fireEvent.change(well, { target: { value: COMMAND } });
    expect(screen.getAllByTestId("started-with-settings")[0].textContent).toBe("Model: opusAllowed to: plan onlyOwn copy of the code: fix-totalsAt most 8 turns");
    expect((well as HTMLTextAreaElement).value).toContain("--verbose");
  });

  it("saves the command as pasted, and the worktree as the session's own copy", () => {
    const onSessionExtras = mount(session());
    openOptional();
    const well = screen.getByRole("textbox", { name: "Started with" });
    fireEvent.change(well, { target: { value: COMMAND } });
    fireEvent.blur(well);
    save();
    expect(onSessionExtras).toHaveBeenCalledWith("typed-a", { startedWith: COMMAND, ownCopy: "fix-totals" });
  });

  it("keeps an own copy the maker already named", () => {
    const onSessionExtras = mount(session({ extras: { ownCopy: "my-branch" } }));
    openOptional();
    const well = screen.getByRole("textbox", { name: "Started with" });
    fireEvent.change(well, { target: { value: COMMAND } });
    fireEvent.blur(well);
    save();
    expect(onSessionExtras).toHaveBeenCalledWith("typed-a", { startedWith: COMMAND, ownCopy: "my-branch" });
  });
});

describe("the build page", () => {
  const meta = { "typed-a": { tool: "claude-code", date: "2026-10-12", startedWith: COMMAND } };
  const steps = readerSteps(tree, { sessions: [], excluded_models: [], sessions_meta: meta });
  const onCopy = vi.fn(async () => true);
  const view = { steps, results: [], need: [], counts: "", map: { groups: [], files: [], tools: [], results: [] }, mapAvailable: false, onCopy, resolveMedia: () => undefined, otherBody: () => null, focus: null } as unknown as BuildStepsView;

  it("lists Started with in the session's Setup, with Copy", () => {
    render(
      <MemoryRouter>
        <StepsList view={view} phone={false} announce={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId("started-with")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Setup" }));
    const row = screen.getByTestId("started-with");
    expect(row.textContent).toContain("Started with");
    expect(row.textContent).toContain(COMMAND);
    expect(row.textContent).toContain("At most 8 turns");
    fireEvent.click(screen.getByRole("button", { name: "Copy the command" }));
    expect(onCopy).toHaveBeenCalledWith(COMMAND);
  });

  it("says nothing for a session without one, and Copy for AI carries the command", () => {
    expect(readerSteps(tree, { sessions: [], excluded_models: [], sessions_meta: { "typed-a": { tool: "claude-code", date: "2026-10-12" } } })[0].chat).not.toHaveProperty("startedWith");
    expect(stepsMarkdown({ title: "T" }, steps)).toContain(`Started with:\n\`\`\`\n${COMMAND}\n\`\`\``);
  });
});
