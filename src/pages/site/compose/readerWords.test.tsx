// CA-15 P12: the words the reader-facing surfaces use, in the terms the modals use.

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PART_WINDOW_COPY } from "@/components/build/PartWindow";
import { HelperChips } from "@/components/build/RuntimeChips";
import { sandboxMapProps } from "@/dev/fixtures/sandbox";
import { buildSteps } from "@/lib/build/graph";
import { layoutMap } from "@/lib/build/mapLayout";
import { REF_KIND } from "@/lib/build/postRefs";
import type { NodeTree } from "@/lib/build/types";

import { BuildMap, type BuildMapProps } from "./BuildMap";

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
    expect(screen.getByRole("list", { name: "Supporting models" })).toBeTruthy();
  });
});

describe("references to the three new tiles", () => {
  it("say what they are, never Prompt", () => {
    expect(REF_KIND.system_prompt).toBe("System prompt");
    expect(REF_KIND.dataset).toBe("Dataset");
    expect(REF_KIND.repo).toBe("GitHub repository");
  });
});

describe("the Map's boxes for the three new tiles", () => {
  it("say what each is in place of a word count, and never '0 words'", () => {
    const steps = buildSteps([
      node("sp", "system_prompt", { step: true, text: "Be brief" }),
      node("ds", "dataset", { step: true, description: "Support tickets" }),
      node("rp", "repo", { step: true, url: "github.com/acme/shop" }),
    ]);
    const base = sandboxMapProps("bakery");
    const props: BuildMapProps = { ...base, steps, groups: [], files: [], tools: [], results: [], suggestions: [], selectedId: null, onSelect: vi.fn(), onClear: vi.fn(), onConnect: vi.fn(), onOpenPrompt: vi.fn() };
    expect(layoutMap(steps, [], [], [], []).boxes.map((box) => box.stepKind)).toEqual(["system_prompt", "dataset", "repo"]);
    render(<BuildMap {...props} />);
    expect(within(screen.getByTestId("map-box-sp")).getByText("System prompt")).toBeTruthy();
    expect(within(screen.getByTestId("map-box-ds")).getByText("Dataset")).toBeTruthy();
    expect(within(screen.getByTestId("map-box-rp")).getByText("GitHub repository")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\b0 words\b/);
  });
});
