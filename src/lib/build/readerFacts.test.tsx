// CA-15 P12: what a reader is told of a tile beyond its body.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ReaderFacts } from "@/components/build/tileBodies";
import { AGENT_DIALOG_COPY } from "@/pages/site/compose/AddAgentDialog";
import { CHECK_DIALOG_COPY } from "@/pages/site/compose/AddCheckDialog";
import { CODE_DIALOG_COPY } from "@/pages/site/compose/AddCodeDialog";
import { DATASET_DIALOG_COPY } from "@/pages/site/compose/AddDatasetDialog";
import { REPO_DIALOG_COPY } from "@/pages/site/compose/AddRepoDialog";
import { SYSTEM_PROMPT_DIALOG_COPY } from "@/pages/site/compose/AddSystemPromptDialog";
import { TOOL_DIALOG_COPY } from "@/pages/site/compose/AddToolDialog";

import { readerFacts, repoRetrievedLines } from "./readerFacts";

afterEach(cleanup);

const labels = (kind: Parameters<typeof readerFacts>[0]["kind"], payload: Record<string, unknown>, text = "") => readerFacts({ kind, text }, payload).map((fact) => fact.label);

describe("readerFacts", () => {
  it("is empty for every kind when the maker gave nothing", () => {
    for (const kind of ["prompt", "agent", "team", "check", "tool", "code", "system_prompt", "dataset", "repo", "file", "manual", "decision"] as const) {
      // SV-30 P8: a Check with no evidence says so: `Stated, no artefact`.
      const none = kind === "check" ? [{ label: "Evidence", text: "Stated, no artefact" }] : [];
      expect(readerFacts({ kind, text: "x" }, {}), kind).toEqual(none);
      expect(readerFacts({ kind, text: "x" }, undefined), kind).toEqual(none);
    }
  });

  it("leaves out a detail that is blank, a list with only blank lines, and a key it does not know", () => {
    expect(readerFacts({ kind: "agent", text: "" }, { limits: [" ", ""], output: "   ", sample: "", extra: "ignored" })).toEqual([]);
  });

  it("uses the same names as the modals' Optional rows", () => {
    expect(labels("agent", { limits: ["a"], output: "b", sample: "c" })).toEqual([AGENT_DIALOG_COPY.limits, AGENT_DIALOG_COPY.output, "Sample run"]);
    expect(AGENT_DIALOG_COPY.sample).toBe("Sample run");
    expect(labels("team", { pattern: "lead" })).toEqual([AGENT_DIALOG_COPY.pattern]);
    expect(labels("check", { method: "manual", reviewer: "you", scoring: { how: "pass_fail" }, model_tested: { model: "m" }, evidence: { url: "https://example.com" } })).toEqual([CHECK_DIALOG_COPY.method, CHECK_DIALOG_COPY.reviewer, CHECK_DIALOG_COPY.scoring, CHECK_DIALOG_COPY.modelTested, CHECK_DIALOG_COPY.evidence]);
    expect(labels("tool", { permissions: "read", plan: "Pro", setup: ["a"], alternatives: ["b"] })).toEqual([TOOL_DIALOG_COPY.permissions, TOOL_DIALOG_COPY.plan, TOOL_DIALOG_COPY.setup, TOOL_DIALOG_COPY.alternatives]);
    expect(labels("code", { filename: "a.ts", tool: "cursor" })).toEqual([CODE_DIALOG_COPY.filename, CODE_DIALOG_COPY.writtenWith]);
    expect(labels("system_prompt", { text: "Use {a}", model: "m", version: "v", variables: [{ name: "a", description: "x" }] }, "Use {a}")).toEqual([SYSTEM_PROMPT_DIALOG_COPY.model, SYSTEM_PROMPT_DIALOG_COPY.version, SYSTEM_PROMPT_DIALOG_COPY.variables]);
    expect(labels("dataset", { description: "d", use: "retrieval", format: "CSV", record_count: 2, columns: ["a"], source: "s", sample: ["x"], licence: "l", chunk_size: 1 })).toEqual([DATASET_DIALOG_COPY.format, DATASET_DIALOG_COPY.records, DATASET_DIALOG_COPY.columns, DATASET_DIALOG_COPY.source, DATASET_DIALOG_COPY.sample, DATASET_DIALOG_COPY.licence, DATASET_DIALOG_COPY.chunking]);
    expect(labels("repo", { url: "github.com/a/b", ownership: "third_party", pin: { kind: "tag", value: "v1" }, path: "p", modifications: "m", key_files: ["k"], run: ["r"] })).toEqual([REPO_DIALOG_COPY.pinned, REPO_DIALOG_COPY.path, REPO_DIALOG_COPY.modifications, REPO_DIALOG_COPY.keyFiles, REPO_DIALOG_COPY.run]);
  });

  it("tells a variable only when it has a line about it", () => {
    expect(readerFacts({ kind: "prompt", text: "Hi {a} and {b}" }, { variables: [{ name: "a", description: "First name" }] })).toEqual([{ label: "Variables", lines: ["{a}: First name"] }]);
    expect(readerFacts({ kind: "prompt", text: "Hi {a}" }, { variables: [{ name: "gone", description: "x" }] })).toEqual([]);
  });

  it("says a repository's modifications only for a third party's, and never a run line as anything but what was written", () => {
    expect(labels("repo", { url: "github.com/a/b", ownership: "owned", modifications: "m" })).toEqual([]);
    expect(readerFacts({ kind: "repo", text: "" }, { url: "github.com/a/b", ownership: "owned", run: ["export TOKEN=$TOKEN"] })[0]).toEqual({ label: "Run instructions", lines: ["export TOKEN=$TOKEN"], mono: true });
  });

  it("says what GitHub told us only once it was retrieved", () => {
    expect(repoRetrievedLines({ url: "github.com/a/b" })).toEqual([]);
    expect(repoRetrievedLines({ url: "github.com/a/b", language: "Go", licence_spdx: "MIT", pushed_at: "2026-09-01T00:00:00Z", fetched_at: "2026-10-07T09:00:00Z" })).toEqual([
      { label: "Primary language", text: "Go" },
      { label: "Licence", text: "MIT · reuse permitted" },
      { label: "Last commit", text: "1 Sep 2026" },
    ]);
    expect(repoRetrievedLines({ url: "github.com/a/b", fetched_at: "2026-10-07T09:00:00Z" })).toEqual([{ label: "Licence", text: "No licence · reuse not granted" }]);
  });
});

describe("ReaderFacts", () => {
  it("draws nothing at all for nothing", () => {
    const { container } = render(<ReaderFacts facts={[]} indent={36} />);
    expect(container.innerHTML).toBe("");
  });

  it("draws a label over its value, a list as lines, and a mono value in the data font", () => {
    render(<ReaderFacts facts={[{ label: "Limits", lines: ["Never deploys", "Never emails"] }, { label: "File path", text: "src/app.ts", mono: true }]} />);
    const rows = screen.getAllByTestId("reader-fact");
    expect(rows.map((row) => row.querySelector("dt")?.textContent)).toEqual(["Limits", "File path"]);
    expect(Array.from(rows[0].querySelectorAll("li")).map((li) => li.textContent)).toEqual(["Never deploys", "Never emails"]);
    expect((rows[1].querySelector("dd") as HTMLElement).style.fontFamily).toContain("--font-data");
  });
});
