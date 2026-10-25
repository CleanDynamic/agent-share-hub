// CA-15 P12: the words the reader-facing surfaces use, in the terms the modals use.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PART_WINDOW_COPY } from "@/components/build/PartWindow";
import { HelperChips } from "@/components/build/RuntimeChips";
import { buildSteps } from "@/lib/build/graph";
import { sessionMapFor } from "@/lib/build/sessionMap";
import { REF_KIND } from "@/lib/build/postRefs";
import type { NodeTree } from "@/lib/build/types";

import { SessionMapPanel } from "./SessionMapPanel";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

let seq = 0;
const node = (id: string, type: string, payload: Record<string, unknown>): NodeTree =>
  ({ id, build_id: "b", parent_id: null, position: ++seq, type, title: null, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [] }) as NodeTree;

describe("the part window's words", () => {
  it("uses the modals' terms", () => {
    expect(PART_WINDOW_COPY).toMatchObject({ instructions: "System instructions", tools: "Available tools", tested: "Test description", passing: "Pass criteria", onFail: "Failure notes", starts: "Trigger", cases: "Test cases", calledFrom: "Calling code", reads: "Input", answer: "Recorded answer" });
  });

  it("names the helpers Supporting models", () => {
    render(<HelperChips helpers={[{ provider: "scaledown", job: "compress" }]} />);
    expect(screen.getByRole("list", { name: "Helpers" })).toBeTruthy();
  });
});

describe("references to the three new tiles", () => {
  it("say what they are, never Prompt", () => {
    expect(REF_KIND.system_prompt).toBe("System prompt");
    expect(REF_KIND.dataset).toBe("Dataset");
    expect(REF_KIND.repo).toBe("GitHub repository");
  });
});

describe("the map's panel for the three new tiles", () => {
  it("names each by what it is in place of a word count, and never '0 words'", () => {
    const steps = buildSteps([
      node("sp", "system_prompt", { step: true, text: "Be brief" }),
      node("ds", "dataset", { step: true, description: "Support tickets" }),
      node("rp", "repo", { step: true, url: "github.com/acme/shop" }),
    ]);
    const groups = [{ key: "s1", kind: "typed" as const, sessionId: null, number: 1, tool: "Claude", model: null, startedAt: "2026-10-09", stepNumbers: steps.map((step) => step.number) }];
    const model = sessionMapFor({ groups, steps, files: [], making: {} });
    render(<SessionMapPanel model={model} selected="s1" />);
    const kinds = screen.getAllByTestId("panel-tile-row").map((row) => row.lastElementChild?.textContent);
    expect(kinds).toEqual(["System prompt", "Dataset", "GitHub repository"]);
    expect(document.body.textContent).not.toMatch(/\b0 words\b/);
  });
});
