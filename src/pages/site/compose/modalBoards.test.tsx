/* CA-15b P2: every modal says exactly what its board says, in the board's order: the header, the row and block labels,
   the Optional rows' titles and hints, the footer's note and its buttons. */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FullPromptWindow } from "@/components/build/FullPromptWindow";
import { buildSteps } from "@/lib/build/graph";
import type { NodeTree } from "@/lib/build/types";

import { AddAgentDialog } from "./AddAgentDialog";
import { AddCheckDialog } from "./AddCheckDialog";
import { AddCodeDialog } from "./AddCodeDialog";
import { AddDecisionDialog } from "./AddDecisionDialog";
import { AddRepoDialog } from "./AddRepoDialog";
import { AddResultDialog } from "./AddResultDialog";
import { AddToolDialog } from "./AddToolDialog";
import { openOptional } from "./optionalKit";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: /min-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mount = (element: ReactElement) => render(<MemoryRouter>{element}</MemoryRouter>);

/** The Optional rows, each as [title, hint]. */
const optionalRows = () => {
  openOptional();
  return screen.getAllByTestId("optional-field").map((row) => [within(row).getByTestId("optional-title").textContent, within(row).queryByTestId("optional-line")?.textContent ?? ""]);
};

/** True when each word appears in the text after the one before it. */
function inOrder(text: string, words: readonly string[]): string[] {
  const missing: string[] = [];
  let from = 0;
  for (const word of words) {
    const at = text.indexOf(word, from);
    if (at < 0) missing.push(word);
    else from = at + word.length;
  }
  return missing;
}

function header(title: string, subtitle: string) {
  expect(screen.getByRole("dialog", { name: title })).toBeTruthy();
  expect(screen.getByTestId("modal-subtitle").textContent).toBe(subtitle);
  expect(screen.getByRole("button", { name: /^Close/ })).toBeTruthy();
}

function footer(note: string) {
  const foot = screen.getByTestId("modal-footer");
  expect(screen.getByTestId("modal-status").textContent).toBe(note);
  expect(within(foot).getAllByRole("button").map((button) => button.textContent)).toEqual(["Cancel", "Add"]);
}

describe("each modal as its board (CA-15b P2)", () => {
  it("Add a result", () => {
    mount(<AddResultDialog open onOpenChange={() => {}} onAdd={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Image or video" }));
    header("Add a result", "Output of this prompt");
    const body = screen.getByTestId("modal-body").textContent ?? "";
    expect(inOrder(body, ["Output type", "12 types", "Link", "Image or video", "File", "Model", "Text", "Audio", "Deployed app or website", "Data table", "Sent message", "Change in an external app", "Metric", "Offline outcome", "Images and videos", "0 files", "Drop images or videos", "Select files", "Optional", "1 field"])).toEqual([]);
    expect(optionalRows()).toEqual([["Caption", "One line"]]);
    footer("Required: Images and videos");
  });

  it("Add a tool", () => {
    mount(<AddToolDialog open onOpenChange={() => {}} onAdd={() => {}} />);
    header("Add a tool", "External app the model used");
    expect(screen.getByRole("button", { name: "App" }).textContent).toBe("Select an app");
    expect(inOrder(screen.getByTestId("modal-body").textContent ?? "", ["App", "Select an app", "Optional", "6 fields"])).toEqual([]);
    expect(optionalRows()).toEqual([
      ["Connection method", "MCP server, native integration, custom code and 6 more"],
      ["Actions performed", ""],
      ["Permissions", "Read only, read and write, or acts as the maker"],
      ["Required plan", "Free or plan name"],
      ["Setup steps", ""],
      ["Alternatives", "Apps that do the same job"],
    ]);
    footer("Required: App");
  });

  it("Add a check", () => {
    mount(<AddCheckDialog open onOpenChange={() => {}} onAdd={() => {}} />);
    header("Add a check", "Test of part of the build");
    expect(inOrder(screen.getByTestId("modal-body").textContent ?? "", ["Test description", "0 / 280", "Pass criteria", "Runs", "passed out of", "Optional", "8 fields"])).toEqual([]);
    expect(optionalRows()).toEqual([
      ["Test cases", "Input, expected output, actual output"],
      ["Failure notes", "What failed and what changed"],
      ["Last run date", ""],
      ["Test method", "Manual, automated, test suite, peer review, comparison"],
      ["Reviewer", "Maker, user or client"],
      ["Scoring method", "Pass or fail, metric vs target, rating, A/B"],
      ["Model tested", ""],
      ["Evidence", "Log, screenshot or link"],
    ]);
    footer("Required: Test description, Pass criteria, Runs");
  });

  it("Add code", () => {
    mount(<AddCodeDialog open onOpenChange={() => {}} onAdd={() => {}} seed={"const a = 1;\nconst b = 2;"} />);
    header("Add code", "Source code as used");
    expect(inOrder(screen.getByTestId("modal-body").textContent ?? "", ["Code", "2 lines", "Upload files", "Each file becomes its own tile", "Language", "Optional", "2 fields"])).toEqual([]);
    // The language field shows the language's name, guessed from the code until it is chosen.
    expect(screen.getByRole("button", { name: "Language" }).textContent).toMatch(/^(TypeScript|JavaScript)$/);
    expect(optionalRows()).toEqual([
      ["File path", ""],
      ["Generated with", "Tool and model"],
    ]);
    footer("Required fields complete");
  });

  it("Add an agent", () => {
    mount(<AddAgentDialog open onOpenChange={() => {}} onAdd={() => {}} nextNumber={4} teamsAvailable />);
    header("Add an agent", "Autonomous model with instructions and tools");
    expect(within(screen.getByRole("radiogroup", { name: "Type" })).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Single agent", "Multi-agent team"]);
    expect(inOrder(screen.getByTestId("modal-body").textContent ?? "", ["Name", "Models", "Primary", "Optional", "9 fields"])).toEqual([]);
    expect(optionalRows()).toEqual([
      ["System instructions", ""],
      ["Available tools", "Apps the agent can call"],
      ["Trigger", ""],
      ["Host platform", ""],
      ["Memory", "Stored between runs, and where"],
      ["Helpers", "Models that summarise history or extract fields"],
      ["Limits", "Steps, budget, run time, approvals, prohibited actions"],
      ["Output and destination", "Format and destination"],
      ["Sample run", "Transcript or trace of one run"],
    ]);
    fireEvent.click(screen.getByRole("radio", { name: "Multi-agent team" }));
    expect(optionalRows().at(-1)).toEqual(["Orchestration pattern", "Sequential, lead and delegates, parallel then merge, writer and reviewer"]);
    expect(screen.getByTestId("optional-title-count").textContent).toBe("Multi-agent only");
    footer("Required fields complete");
  });

  it("Add a decision", () => {
    mount(<AddDecisionDialog open onOpenChange={() => {}} onAdd={() => {}} codeTiles={[]} stepChoices={[]} />);
    header("Add a decision", "Structured answer from a model");
    expect(
      inOrder(screen.getByTestId("modal-body").textContent ?? "", ["Model", "Model or service", "Version", "Invocation", "Direct", "Through an adapter", "Questions", "1 question", "Question 1", "Key", "Type", "Single choice", "Multiple choice", "Score", "Ranking", "Yes or no", "Extraction", "Instructions", "Options", "Add an option", "Add a question", "Optional", "8 fields"]),
    ).toEqual([]);
    expect(optionalRows()).toEqual([
      ["Option descriptions", ""],
      ["Import request and response", "From JSON, curl or Python"],
      ["Calling code", "Code tile that sends the request"],
      ["Input", "Another tile's output, or sample text"],
      ["Recorded answer", "One real answer"],
      ["Installation command", "As typed"],
      ["Examples", "Real inputs and their outputs"],
      ["Low-confidence handling", "Threshold or escalation"],
    ]);
    expect(within(screen.getByTestId("modal-footer")).getAllByRole("button").map((button) => button.textContent)).toEqual(["Cancel", "Add"]);
  });

  it("Add a GitHub repository", () => {
    mount(<AddRepoDialog open onOpenChange={() => {}} onAdd={() => {}} fetchRepo={() => Promise.resolve(null)} />);
    header("Add a GitHub repository", "Repository used in this build");
    fireEvent.click(screen.getByRole("radio", { name: "Third-party repository" }));
    expect(
      inOrder(screen.getByTestId("modal-body").textContent ?? "", [
        "Repository URL",
        "From GitHub. No recent commits: flagged as possibly unmaintained",
        "Ownership",
        "Created in this build",
        "Maker's existing repository",
        "Third-party repository",
        "Description",
        "0 / 500",
        "Third-party repository",
        "Author",
        "Usage",
        "Installed as a dependency",
        "Copied source code",
        "Followed its documentation",
        "Ran as a tool or MCP server",
        "Provided as model context",
        "Forked and modified",
        "Optional",
        "5 fields",
      ]),
    ).toEqual([]);
    expect(optionalRows()).toEqual([
      ["Pinned version", "Branch, tag or commit"],
      ["Path", "Folder or file, if only part was used"],
      ["Modifications", "Changes from the original"],
      ["Key files", "README, CLAUDE.md, agent configuration, skills folder"],
      ["Run instructions", "Clone, dependencies, start command, environment variable names"],
    ]);
    footer("Required: Repository URL");
  });

  it("the prompt window", () => {
    const node = { id: "p1", build_id: "b", parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: { text: "Create ten prompts" }, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [] } as unknown as NodeTree;
    mount(<FullPromptWindow steps={buildSteps([node])} openId="p1" mode="maker" onTitle={() => {}} onReply={() => {}} onExtras={() => {}} onText={() => {}} onClose={() => {}} />);
    const window = screen.getByTestId("full-prompt-window");
    expect(within(window).getByRole("button", { name: "Rename prompt" })).toBeTruthy();
    expect(within(window).getByRole("button", { name: /^Close/ })).toBeTruthy();
    expect(inOrder(window.textContent ?? "", ["Prompt", "3 words", "Copy prompt", "Response", "0 of 4,000 characters", "Optional", "2 fields", "Esc Close · ← → Previous or next prompt", "Done"])).toEqual([]);
    expect(optionalRows()).toEqual([
      ["Model settings", ""],
      ["Variables", "Format: {company name}"],
    ]);
    expect(within(screen.getByRole("radiogroup", { name: "Reasoning effort" })).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Default", "Low", "High"]);
    expect((screen.getByLabelText("Custom instructions or project knowledge that applied") as HTMLTextAreaElement).placeholder).toBe("Custom instructions or project knowledge that applied");
    expect(screen.getByText("No variables yet")).toBeTruthy();
  });
});
