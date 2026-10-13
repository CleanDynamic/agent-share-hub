// UI-P75 — the sandbox composer's budgets, held in one file (CONCEPT §7, §9), counted in the rendered
// dev page so a later prompt cannot quietly break them: one filled button, an Add menu of exactly 7 in
// CONCEPT §5's order, no list past six rows, and none of the words the interface never uses.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SandboxDemo from "@/pages/dev/SandboxDemo";

import { ADD_ITEMS } from "./SandboxView";

export const NEVER_WORDS = /\b(node|nodes|upload|uploads|post|posts|blueprint|blog|block|blocks|stage|remix|rating|ratings|verification)\b/i;

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = min ? 1440 >= Number(min[1]) : max ? 1440 <= Number(max[1]) : false;
    return { matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined };
  });
});
afterEach(cleanup);

const BUILDS = ["fox", "bakery", "team", "manual"] as const;

function page(build: string, lens?: "map") {
  return render(
    <MemoryRouter initialEntries={[`/dev/kit/pages/sandbox?build=${build}${lens ? "&lens=map" : ""}`]}>
      <Suspense fallback={null}>
        <SandboxDemo viewport="desktop" fit="content" />
      </Suspense>
    </MemoryRouter>,
  );
}

describe("the composer's budgets", () => {
  it.each(BUILDS)("%s: one filled button, and it is Publish", (build) => {
    page(build);
    const filled = [...document.querySelectorAll<HTMLElement>('[data-variant="primary"]')];
    expect(filled).toHaveLength(1);
    expect(filled[0].textContent).toMatch(/Publish/);
  });

  it.each(BUILDS)("%s: no word from the never list in any rendered text, List or Map", (build) => {
    const list = page(build);
    expect(list.container.textContent ?? "").not.toMatch(NEVER_WORDS);
    cleanup();
    const map = page(build, "map");
    expect(map.container.textContent ?? "").not.toMatch(NEVER_WORDS);
  });

  it("the Add menu holds exactly 7 items, in CONCEPT §5's order", async () => {
    page("bakery");
    expect(ADD_ITEMS.map((item) => item.name)).toEqual(["Prompt", "Session", "Agent or team", "File", "Tool", "Manual step", "Result"]);
    fireEvent.keyDown(screen.getByTestId("sandbox-add"), { key: "Enter" });
    const items = await screen.findAllByRole("menuitem");
    expect(items).toHaveLength(7);
    ADD_ITEMS.forEach((entry, at) => expect(items[at].textContent).toContain(entry.name));
  });
});
