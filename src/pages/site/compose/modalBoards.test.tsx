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

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: /min-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mount = (element: ReactElement) => render(<MemoryRouter>{element}</MemoryRouter>);

/** The Optional rows, each as [title, hint]. */
const optionalRows = () =>
  screen.getAllByTestId("optional-field").map((row) => [within(row).getByTestId("optional-title").textContent, within(row).getByTestId("optional-line").textContent]);

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
    header("Add a result", "The output this prompt produced");
    const body = screen.getByTestId("modal-body").textContent ?? "";
    expect(inOrder(body, ["Output type", "12 types", "Link", "Image or video", "File", "Model", "Text", "Audio", "Deployed app or website", "Data table", "Sent message", "Change in an external app", "Metric", "Offline outcome", "Images and videos", "0 files", "Drop images or videos here", "Choose files", "Optional", "1 field"])).toEqual([]);
    expect(optionalRows()).toEqual([["Caption", "One line describing what the output shows"]]);
    footer("Required: at least one image or video");
  });

  it("Add a tool", () => {
    mount(<AddToolDialog open onOpenChange={() => {}} onAdd={() => {}} />);
    header("Add a tool", "An external application the model used during the build");
    expect(screen.getByRole("button", { name: "Application" }).textContent).toBe("Select an application");
    expect(inOrder(screen.getByTestId("modal-body").textContent ?? "", ["Application", "Select an application", "Optional", "6 fields"])).toEqual([]);
    expect(optionalRows()).toEqual([
      ["Connection method", "MCP server, native integration, custom code and 6 more"],
      ["Actions performed", "What the application did in this build"],
      ["Permissions", "Read only, read and write, or acting on your behalf"],
      ["Required plan", "Free, or the name of the paid plan"],
      ["Setup steps", "The steps required to connect it"],
      ["Alternatives", "Other applications that perform the same function"],
    ]);
    footer("Required: an application");
  });

  it("Add a check", () => {
    mount(<AddCheckDialog open onOpenChange={() => {}} onAdd={() => {}} />);
    header("Add a check", "A test that verifies this part of the build");
    expect(inOrder(screen.getByTestId("modal-body").textContent ?? "", ["Test description", "0 / 280", "Pass criteria", "Runs", "Or add test cases below", "passed out of", "Optional", "8 fields"])).toEqual([]);
    expect(optionalRows()).toEqual([
      ["Test cases", "Inputs, expected outputs and actual outputs"],
      ["Failure notes", "What failed, and what was changed before the next run"],
      ["Last run date", "When the test last ran"],
      ["Test method", "Manual, automated, test suite, peer review or comparison"],
      ["Reviewer", "You, a user or a client"],
      ["Scoring method", "Pass or fail, a metric against a target, a rating, or an A/B comparison"],
      ["Model tested", "The model and version the test ran against"],
      ["Evidence", "A log, a screenshot, or a link to the test run"],
    ]);
    footer("Required: a test description");
  });

  it("Add code", () => {
    mount(<AddCodeDialog open onOpenChange={() => {}} onAdd={() => {}} seed={"const a = 1;\nconst b = 2;"} />);
    header("Add code", "Source code produced in this step, as it was used");
    expect(inOrder(screen.getByTestId("modal-body").textContent ?? "", ["Code", "2 lines", "Upload files", "Or upload text files. Each file is added as a separate step.", "Language", "Optional", "2 fields"])).toEqual([]);
    // The language field shows the language's name, guessed from the code until it is chosen.
    expect(screen.getByRole("button", { name: "Language" }).textContent).toMatch(/^(TypeScript|JavaScript)$/);
    expect(optionalRows()).toEqual([
      ["File path", "Where the file lives in the project"],
      ["Generated with", "The tool and model that wrote it"],
    ]);
    footer("All required fields complete");
  });

  it("Add an agent", () => {
    mount(<AddAgentDialog open onOpenChange={() => {}} onAdd={() => {}} nextNumber={4} teamsAvailable />);
    header("Add an agent", "A model that runs on its own, with instructions and tools");
    expect(within(screen.getByRole("radiogroup", { name: "What to add" })).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Single agent", "Multi-agent team"]);
    expect(inOrder(screen.getByTestId("modal-body").textContent ?? "", ["Name", "Models", "Primary", "Optional", "9 fields"])).toEqual([]);
    expect(optionalRows()).toEqual([
      ["System instructions", "What the agent is told to do"],
      ["Available tools", "Applications the agent can call"],
      ["Trigger", "Manual, scheduled, or started by an event"],
      ["Host platform", "Where the agent runs"],
      ["Memory", "What the agent keeps between runs, and where"],
      ["Supporting models", "Models that summarise history or extract fields for the agent"],
      ["Limits", "Maximum steps, budget or run time, approvals and prohibited actions"],
      ["Output and destination", "A file, a message or a pull request, and where it is delivered"],
      ["Sample run", "A transcript or trace of one real run"],
    ]);
    fireEvent.click(screen.getByRole("radio", { name: "Multi-agent team" }));
    expect(optionalRows().at(-1)).toEqual(["Orchestration pattern", "Sequential, lead with delegates, parallel then merged, or writer and reviewer"]);
    expect(screen.getByTestId("optional-title-count").textContent).toBe("Multi-agent only");
    footer("All required fields complete");
  });

  it("Add a decision", () => {
    mount(<AddDecisionDialog open onOpenChange={() => {}} onAdd={() => {}} codeTiles={[]} stepChoices={[]} />);
    header("Add a decision", "A structured classification your application requests from a model");
    expect(
      inOrder(screen.getByTestId("modal-body").textContent ?? "", ["Model", "Model or service", "Version", "Invocation", "Direct", "Through an adapter", "Questions", "1 question", "Question 1", "Key", "Type", "Single choice", "Multiple choice", "Score", "Ranking", "Yes or no", "Extraction", "Instructions", "Options", "Add an option", "Add a question", "Optional", "7 fields"]),
    ).toEqual([]);
    expect(optionalRows()).toEqual([
      ["Import from a logged request and response", "Populates the fields above from JSON, a curl command or Python"],
      ["Calling code", "The code that sends the request, added as a Code tile"],
      ["Input", "The output of another step, or sample text"],
      ["Recorded answer", "One real answer the model returned"],
      ["Installation command", "Exactly as you typed it"],
      ["Examples", "Real inputs with the output returned for each"],
      ["Low-confidence handling", "A confidence threshold, or escalation to a person"],
    ]);
    expect(within(screen.getByTestId("modal-footer")).getAllByRole("button").map((button) => button.textContent)).toEqual(["Cancel", "Add"]);
  });

  it("Add a GitHub repository", () => {
    mount(<AddRepoDialog open onOpenChange={() => {}} onAdd={() => {}} fetchRepo={() => Promise.resolve(null)} />);
    header("Add a GitHub repository", "A repository used in this build, owned by you or by a third party");
    fireEvent.click(screen.getByRole("radio", { name: "Third-party repository" }));
    expect(
      inOrder(screen.getByTestId("modal-body").textContent ?? "", [
        "Repository URL",
        "Retrieved from GitHub when the URL is entered. Repositories with no recent commits are flagged as possibly unmaintained.",
        "Ownership",
        "Created in this build",
        "Your existing repository",
        "Third-party repository",
        "Description",
        "0 / 500",
        "Third-party repository",
        "Author",
        "Credited on the build page",
        "Usage",
        "Select all that apply",
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
      ["Pinned version", "A branch, tag or commit, so copies stay identical"],
      ["Path", "A folder or file, when only part of the repository was used"],
      ["Modifications", "What was changed from the original"],
      ["Key files", "README, CLAUDE.md, agent configuration, skills folder"],
      ["Run instructions", "Clone command, dependencies, start command, and environment variable names only"],
    ]);
    footer("Required: a repository URL");
  });

  it("the prompt window", () => {
    const node = { id: "p1", build_id: "b", parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: { text: "Create ten prompts" }, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [] } as unknown as NodeTree;
    mount(<FullPromptWindow steps={buildSteps([node])} openId="p1" mode="maker" onTitle={() => {}} onReply={() => {}} onExtras={() => {}} onText={() => {}} onClose={() => {}} />);
    const window = screen.getByTestId("full-prompt-window");
    expect(within(window).getByRole("button", { name: "Rename prompt" })).toBeTruthy();
    expect(within(window).getByRole("button", { name: /^Close/ })).toBeTruthy();
    expect(inOrder(window.textContent ?? "", ["Prompt", "3 words", "Copy prompt", "Response", "0 of 4,000 characters", "Optional", "2 fields", "Esc Close · ← → Previous or next prompt", "Done"])).toEqual([]);
    expect(optionalRows()).toEqual([
      ["Model settings", "Model, reasoning effort, custom instructions and project knowledge"],
      ["Variables", "Words a copier replaces, such as {company name}"],
    ]);
    fireEvent.click(within(screen.getAllByTestId("optional-field")[0]).getByRole("button"));
    expect(within(screen.getByRole("radiogroup", { name: "Reasoning effort" })).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Default", "Low", "High"]);
    expect((screen.getByLabelText("Custom instructions or project knowledge that applied") as HTMLTextAreaElement).placeholder).toBe("Custom instructions or project knowledge that applied");
    fireEvent.click(within(screen.getAllByTestId("optional-field")[1]).getByRole("button"));
    expect(screen.getByText("Select words in the prompt, then mark them as a variable.")).toBeTruthy();
    expect(screen.getByText("No variables yet")).toBeTruthy();
  });
});
