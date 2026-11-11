// UX-02 P10: a prompt step tile in the composer does not show its word count; its other facts stay. The published page's footer is
// unchanged: it is the same function, without the composer's option.

import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";
import type { Step } from "@/lib/build/graph";
import { footerFactsOf } from "@/lib/build/tileLines";

import { BuildList, type BuildListProps } from "./BuildList";
import { dividers } from "./buildListModel";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const prompt: Step = { id: "p1", number: "1", kind: "prompt", text: "Write the {{dish}} for {{day}}", title: null, defaultTitle: "Prompt 1", words: 5, model: null, sessionId: "s1", tool: null, runs: null, uses: [], children: [] };

describe("UX-02 P10 · no word count on prompt step tiles", () => {
  it("draws a prompt tile without its word count, with its other facts", () => {
    const props: BuildListProps = { ...sandboxListProps("bakery"), steps: [prompt], dividers: dividers([prompt], []), results: [], intoResult: new Set(), onSelect: vi.fn(), onOpenPrompt: vi.fn() };
    render(
      <MemoryRouter>
        <BuildList {...props} />
      </MemoryRouter>,
    );
    const footer = within(screen.getAllByTestId("step-card")[0]).getByTestId("tile-footer");
    expect(footer.textContent).not.toMatch(/\bwords?\b/);
    expect(footer.textContent).toContain("2 variables");
    // F17: no Open prompt link on a prompt tile.
    expect(within(footer).queryByRole("button", { name: "Open prompt" })).toBeNull();
  });

  it("the published page still counts words: the shared footer is unchanged", () => {
    expect(footerFactsOf(prompt)).toEqual(["5 words", "2 variables"]);
    expect(footerFactsOf(prompt, undefined, { words: false })).toEqual(["2 variables"]);
  });
});
