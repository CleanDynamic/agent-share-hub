// UI-P75 — the build page's budgets, held in one file (CONCEPT §7, §9): one filled button, at most five
// tabs, no What you need group past six rows, and none of the words the interface never uses.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildFixture } from "@/dev/fixtures/build";
import { buildStepsFixture, type BuildStepsSample } from "@/dev/fixtures/buildSteps";
import type { NeedGroup } from "@/lib/build/readerSteps";

import { BuildView } from "./BuildView";
import { NeedPanel, NEED_ROWS } from "./BuildSteps";
import { stepTabs } from "./buildModel";

const NEVER_WORDS = /\b(node|nodes|upload|uploads|post|posts|blueprint|blog|block|blocks|stage|remix|rating|ratings|verification)\b/i;

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = min ? 1440 >= Number(min[1]) : max ? 1440 <= Number(max[1]) : false;
    return { matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined };
  });
});
afterEach(cleanup);

function page(which: BuildStepsSample) {
  const { title, outcome, ...steps } = buildStepsFixture(which);
  void title;
  void outcome;
  const base = buildFixture("desktop");
  return render(
    <MemoryRouter>
      <BuildView fit="content" {...base} viewer={{ ...base.viewer, tabs: stepTabs(true), tab: "anatomy" }} steps={steps} />
    </MemoryRouter>,
  );
}

const BUILDS: BuildStepsSample[] = ["list", "team", "one"];

describe("the build page's budgets", () => {
  it.each(BUILDS)("%s: one filled button, and it is 'I ran this and it worked'", (which) => {
    page(which);
    const filled = [...document.querySelectorAll<HTMLElement>('[data-variant="primary"]')];
    expect(filled).toHaveLength(1);
    expect(filled[0].textContent).toBe("I ran this and it worked");
  });

  it.each(BUILDS)("%s: at most 5 tabs, The build first", (which) => {
    page(which);
    const tabs = within(screen.getByRole("tablist", { name: "Sections of this build" })).getAllByRole("tab");
    expect(tabs.length).toBeLessThanOrEqual(5);
    expect(tabs[0].textContent).toBe("The build");
  });

  it.each(BUILDS)("%s: no word from the never list in the steps or What you need", (which) => {
    page(which);
    for (const id of ["build-steps", "build-need"]) expect(screen.getByTestId(id).textContent ?? "").not.toMatch(NEVER_WORDS);
  });

  it("What you need shows at most 6 rows in a group, then one Show more", () => {
    const { steps, results, counts, map, onCopy, resolveMedia, otherBody } = buildStepsFixture("list");
    const rows = Array.from({ length: 9 }, (_, at) => ({ title: `Tool ${at + 1}`, detail: `step ${at + 1}` }));
    const need: NeedGroup[] = [{ key: "tools", label: "Tools and models", rows }];
    render(<NeedPanel view={{ steps, results, need, counts, map, mapAvailable: true, onCopy, resolveMedia, otherBody, focus: null }} onOpenOther={() => undefined} />);
    expect(NEED_ROWS).toBe(6);
    expect(screen.getAllByTestId("need-row")).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "Show 3 more" }));
    expect(screen.getAllByTestId("need-row")).toHaveLength(9);
    expect(screen.queryByRole("button", { name: /Show \d+ more/ })).toBeNull();
  });
});
