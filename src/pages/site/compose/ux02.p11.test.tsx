// UX-02 P11: example values in fields read as examples. Part 0's list: every composer placeholder that shows a realistic value
// (a name, a product, a model, a path, an id, a date or a sample sentence), each written "e.g. <value>". The other placeholders
// (instructions such as "Select an agent", bare numbers, units and formats such as "3", "ms", "https://") are not checked.
// Then: where a window's footer says a field is required, that field says so too, under itself, at once.

import fs from "node:fs";
import path from "node:path";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddSystemPromptDialog } from "./AddSystemPromptDialog";

/** [file in src/pages/site/compose, the example value]. A provider() call in DeploymentDialog passes its placeholder. */
export const EXAMPLE_PLACEHOLDERS: readonly [string, string][] = [
  ["AgentRuntimeFields.tsx", "OpenRouter"],
  ["AgentRuntimeFields.tsx", "Haiku 5.5"],
  ["AgentRuntimeFields.tsx", "GPT, Gemini"],
  ["AgentRuntimeFields.tsx", "GOV.UK style guide"],
  ["ComposeView.tsx", "Fox poster"],
  ["DecisionFields.tsx", "Shopify product taxonomy"],
  ["DecisionFields.tsx", "gemma-3-4b"],
  ["DecisionFields.tsx", "team = billing"],
  ["DecisionFields.tsx", "billing"],
  ["DecisionFields.tsx", "Sept 2026"],
  ["DecisionFields.tsx", "I was charged twice"],
  ["DecisionFields.tsx", "Sequential narrowing over large label sets degrades accuracy"],
  ["DeploymentDialog.tsx", "Mac Mini"],
  ["DeploymentDialog.tsx", "Obsidian"],
  ["DeploymentDialog.tsx", "Agent Tincan"],
  ["DeploymentDialog.tsx", "Tailscale"],
  ["DeploymentDialog.tsx", "1M tokens"],
  ["DeploymentDialog.tsx", "Claude Design"],
  ["DeploymentDialog.tsx", "Facts about clients and past conversations"],
  ["DeploymentDialog.tsx", "Ollama"],
  ["DeploymentDialog.tsx", "Letta"],
  ["DeploymentDialog.tsx", "Telegram"],
  ["DeploymentDialog.tsx", "ElevenLabs"],
  ["DeploymentDialog.tsx", "Grafana"],
  ["DeploymentDialog.tsx", "Stripe"],
  ["EvalHarnessFields.tsx", "GitHub Actions"],
  ["EvalHarnessFields.tsx", "DeepEval"],
  ["EvalHarnessFields.tsx", "harness/goldens.json"],
  ["EvalHarnessFields.tsx", "src/prompts/**"],
  ["EvalHarnessFields.tsx", "customer"],
  ["EvalHarnessFields.tsx", "Tone match"],
  ["EvalHarnessFields.tsx", "Policy correct"],
  ["EvalHarnessFields.tsx", "Wrong policy decision"],
  ["EvalHarnessFields.tsx", "No help-centre page covers damaged items"],
  ["EvalHarnessFields.tsx", "Retrieval, then the decision model picks"],
  ["EvalHarnessFields.tsx", "Over 2,000 times the cost"],
  ["EvalHarnessFields.tsx", "Fails when the pass rate drops 5 points"],
  ["EvalHarnessFields.tsx", "Fail on any regression, one run"],
  ["EvalHarnessFields.tsx", "Does the answer apply the policy the reference states?"],
  ["EvalHarnessFields.tsx", "A correct answer failed on judge noise."],
  ["EvidenceControl.tsx", "Latency"],
  ["HelpersField.tsx", "openai:gpt-6-sol"],
  ["MoreDetails.tsx", "exiftool: command not found"],
  ["MoreDetails.tsx", "Install it first with brew install exiftool."],
  ["RuntimeFields.tsx", "https://smith.langchain.com/…"],
  ["SandboxCard.tsx", "Fox poster"],
  ["SandboxCard.tsx", "Answers customer questions from the help centre using keyword and vector search together"],
  ["SandboxCard.tsx", "exiftool: command not found"],
  ["SandboxCard.tsx", "Install it first with brew install exiftool."],
  ["SessionDialog.tsx", "/plugin install review-kit@acme"],
  ["SessionExtrasFields.tsx", "main-prompt-v3"],
  ["SessionExtrasFields.tsx", "main-prompt-v2"],
  ["SessionExtrasFields.tsx", "a1b2c3d"],
  ["SessionExtrasFields.tsx", "2026-10-12"],
  ["SessionExtrasFields.tsx", "Answer only from the docs"],
  ["SessionExtrasFields.tsx", "https://smith.langchain.com/…"],
  ["detailsModel.ts", "until the review has no changes"],
  ["detailsModel.ts", "messages on Telegram"],
  ["detailsModel.ts", "a new supplier email"],
  ["detailsModel.ts", "Weekdays 07:30"],
  ["detailsModel.ts", "Keep my launch on track"],
  ["detailsOptional.tsx", "daily 09:00"],
  ["detailsOptional.tsx", "a deploy finished"],
  ["detailsOptional.tsx", "The final poster, as printed"],
  ["detailsOptional.tsx", "Terminal 2, in the harness folder"],
  ["detailsOptional.tsx", "Linear\\nJira"],
];

const source = (file: string) => fs.readFileSync(path.resolve(__dirname, file), "utf8");

describe("UX-02 P11 · example placeholders start with e.g.", () => {
  it.each(EXAMPLE_PLACEHOLDERS)("%s: %s", (file, value) => {
    const text = source(file);
    const written = [`placeholder="e.g. ${value}"`, `placeholder: "e.g. ${value}"`, `provider("e.g. ${value}")`].some((form) => text.includes(form));
    expect(written).toBe(true);
    for (const bare of [`placeholder="${value}"`, `placeholder: "${value}"`, `provider("${value}")`]) expect(text.includes(bare), bare).toBe(false);
  });
});

describe("UX-02 P11 · a required field says so under itself", () => {
  beforeEach(() => vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })));
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("under each field the footer names, and gone as each is filled; the footer stays the summary", () => {
    render(<AddSystemPromptDialog open onOpenChange={vi.fn()} onAdd={vi.fn()} prompts={[]} session="s1" />);
    expect(screen.getByTestId("modal-status").textContent).toBe("Required: Name, Text");
    expect(screen.getAllByTestId("field-required")).toHaveLength(2);
    fireEvent.change(screen.getAllByLabelText("Name").at(-1) as HTMLElement, { target: { value: "Brand voice" } });
    expect(screen.getByTestId("modal-status").textContent).toBe("Required: Text");
    expect(screen.getAllByTestId("field-required")).toHaveLength(1);
    fireEvent.change(screen.getAllByLabelText("Text").at(-1) as HTMLElement, { target: { value: "Write in plain English." } });
    expect(screen.queryAllByTestId("field-required")).toHaveLength(0);
    expect(within(screen.getByTestId("modal-footer")).getByTestId("modal-status").textContent).toBe("Required fields complete");
  });
});
