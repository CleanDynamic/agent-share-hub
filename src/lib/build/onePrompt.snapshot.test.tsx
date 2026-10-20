// CA-04 P7 — a one-prompt build reads as it did before CA-04.
//
// The markup of the one-prompt shape's List and Details, and of the one-prompt build page sample's The build and
// What you need, was saved at the start of CA-04 Part 1 (the files beside this test). Every part of CA-04 adds
// something that shows only once a build uses it, so these are compared as they stand. Where a part of the prompt
// asks for a visible change to every build (P1: a build with one session shows no session head), the snapshot was
// updated in that part's commit, and the change is named there.

import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { buildStepsFixture } from "@/dev/fixtures/buildSteps";
import { shapeDetailsProps, shapeListProps } from "@/dev/fixtures/shapes";
import { NeedPanel, StepsList } from "@/pages/site/build/BuildSteps";
import { BuildList } from "@/pages/site/compose/BuildList";
import { DetailsPanel } from "@/pages/site/compose/DetailsPanel";

vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ["/dev/kit/pages/sandbox"] }, element))
    // React's generated ids differ from run to run; nothing else does.
    .replace(/(id|for|aria-labelledby|aria-controls|aria-describedby)="[^"]*:[^"]*"/g, '$1="(id)"')
    .replace(/_R_[A-Za-z0-9]+_/g, "(id)")
    .replace(/></g, ">\n<");

describe("the one-prompt build", () => {
  it("draws the List as before", async () => {
    await expect(html(createElement(BuildList, shapeListProps("alone")))).toMatchFileSnapshot("__snapshots__/one-prompt.list.html");
  });

  it("draws Details as before", async () => {
    await expect(html(createElement(DetailsPanel, shapeDetailsProps("alone")))).toMatchFileSnapshot("__snapshots__/one-prompt.details.html");
  });

  it("draws the build page as before", async () => {
    const { title: _title, outcome: _outcome, ...view } = buildStepsFixture("one");
    const page = createElement("div", null, createElement(StepsList, { view, phone: false, announce: () => undefined }), createElement(NeedPanel, { view, onOpenOther: () => undefined }));
    await expect(html(page)).toMatchFileSnapshot("__snapshots__/one-prompt.build-page.html");
  });
});
