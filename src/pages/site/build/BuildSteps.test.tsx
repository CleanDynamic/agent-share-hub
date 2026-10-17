// UI-P90 — The build and What you need in the refined look, rendered with the dev fixture: the same steps, words,
// names and handlers as `StepsList` and `NeedPanel`, on modules, tiles and rows with the tools' real marks.

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildStepsFixture, type BuildStepsSample } from "@/dev/fixtures/buildSteps";
import { readerSteps, whatYouNeed, type ReaderFile } from "@/lib/build/readerSteps";
import type { NodeTree } from "@/lib/build/types";

import type { BuildStepsView } from "./buildModel";
import { NeedPanel, StepsList } from "./BuildSteps";

const REFINED = "/dev/kit/pages/build-steps";

function view(which: BuildStepsSample = "list", over: Partial<BuildStepsView> = {}): BuildStepsView {
  const { title, outcome, ...steps } = buildStepsFixture(which);
  void title;
  void outcome;
  return { ...steps, ...over };
}

function mountList(steps: BuildStepsView, announce = vi.fn(), phone = false) {
  render(
    <MemoryRouter initialEntries={[REFINED]}>
      <StepsList view={steps} phone={phone} announce={announce} />
    </MemoryRouter>,
  );
  return announce;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("StepsList", () => {
  it("draws the list sample's five steps under four chat heads, each led by its tool's real mark", () => {
    mountList(view("list"));
    const list = screen.getByTestId("build-steps");
    expect(screen.getAllByTestId("step-card")).toHaveLength(5);
    expect(screen.getAllByText(/^New chat/)).toHaveLength(4);
    const head = screen.getByText("New chat in ChatGPT").parentElement as HTMLElement;
    expect(head.querySelector('[data-mark="openai"]')).not.toBeNull();
    expect(screen.getByText("New chat in Claude Code").parentElement?.querySelector('[data-mark="claudecode-color"]')).not.toBeNull();
    // No initial in a tile: the mark is the logo alone.
    expect(list.querySelector('[data-mark] span')).toBeNull();
    expect(screen.getByText("4 sessions · 5 prompts · 1 file · 3–6 Oct")).toBeTruthy();
    expect(screen.getByText("copy each step into the chat it names")).toBeTruthy();
    expect(screen.getByText("Send in the same chat as step 4")).toBeTruthy();
    expect(screen.getByRole("group", { name: "How to look at the build" })).toBeTruthy();
  });

  it("a step is a module with Copy (no icon) that copies its text and says so", async () => {
    vi.useFakeTimers();
    const onCopy = vi.fn().mockResolvedValue(true);
    const steps = view("list", { onCopy });
    const announce = mountList(steps);
    const copy = screen.getByRole("button", { name: "Copy step 1" });
    expect(copy.querySelector("svg")).toBeNull();
    await act(async () => {
      fireEvent.click(copy);
    });
    expect(onCopy).toHaveBeenCalledWith(steps.steps[0].step.text);
    expect(announce).toHaveBeenCalledWith("Copied");
  });

  it("a paste-in scrolls to its step and rings it with the selected recipe", () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    mountList(view("list"));
    const paste = screen.getByRole("button", { name: "what step 1 gave you Brand brief" });
    fireEvent.click(paste);
    expect(scroll).toHaveBeenCalled();
    const target = document.getElementById("step-p1") as HTMLElement;
    expect(scroll.mock.contexts[0]).toBe(target);
    expect(target.style.boxShadow).toBe("var(--selected-ring)");
  });

  it("a project file of a coding tool in the build reads as one to put in the project, with its Download", () => {
    mountList(view("list"));
    expect(screen.getByText("Put CLAUDE.md in your project")).toBeTruthy();
    expect(screen.queryByText("attach")).toBeNull();
    expect(screen.getAllByRole("link", { name: "Download CLAUDE.md" }).length).toBeGreaterThan(0);
  });

  it("any other file is still attached, and a workflow reads as one to import", () => {
    const steps = view("list");
    const [first, ...rest] = steps.steps;
    const file = (name: string, setup: NonNullable<ReaderFile["setup"]> | null): ReaderFile => ({ id: name, name, mediaId: null, bytes: null, size: null, download: `https://x.test/${name}`, madeBy: null, madeIn: null, setup });
    mountList({ ...steps, steps: [{ ...first, attach: [file("menu.pdf", null), file("workflow.json", { kind: "import", tool: "n8n" })] }, ...rest] });
    expect(screen.getByText("attach")).toBeTruthy();
    expect(screen.getByText("Import workflow.json into n8n")).toBeTruthy();
  });

  it("Read all of it opens the full prompt window, with the refined Before you send it", () => {
    mountList(view("list"));
    fireEvent.click(screen.getByRole("button", { name: "Read all of it" }));
    const window = screen.getByTestId("full-prompt-window");
    expect(window.textContent).toContain("Follow CLAUDE.md");
    const before = within(window).getByTestId("before-you-send");
    expect(within(before).getAllByTestId("before-row").length).toBeGreaterThan(0);
    expect(before.querySelector("svg.lucide")).toBeNull();
  });

  it("the result sits under its own head: the evidence check, the host and where it came from", () => {
    mountList(view("list"));
    const result = screen.getByTestId("result-card");
    expect(within(result).getByText("crumb-bakery.vercel.app")).toBeTruthy();
    expect(within(result).getByText("from step 5")).toBeTruthy();
    expect(result.querySelector('[data-ui="glyph"], svg')).not.toBeNull();
  });

  it("a team reads Uses, never Paste in, and keeps Copy the team", () => {
    mountList(view("team"));
    expect(screen.getByText("The team these made")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Copy the team/ })).toBeTruthy();
    expect(screen.getAllByTestId("inner-card")).toHaveLength(4);
    expect(screen.getAllByText("Uses").length).toBeGreaterThan(0);
    const team = screen.getByTestId("build-steps").textContent ?? "";
    expect(team.slice(team.indexOf("The team these made"))).not.toContain("Paste in");
  });

  it("a single prompt has no List and Map switch", () => {
    mountList(view("one"));
    expect(screen.getAllByTestId("step-card")).toHaveLength(1);
    expect(screen.queryByRole("group", { name: "How to look at the build" })).toBeNull();
  });
});

/** Step 1 makes brand-guide.md; step 2 attaches it. */
function madeFileView(): BuildStepsView {
  const node = (id: string, position: number, type: string, payload: object): NodeTree =>
    ({ id, build_id: "b", parent_id: null, position, type, title: null, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-07T09:00:00.000Z", children: [] }) as NodeTree;
  const tree = [
    node("p1", 1, "prompt", { text: "Write a brand guide." }),
    node("p2", 2, "prompt", { text: "Use the guide.", uses: [{ kind: "file", node_id: "bg" }] }),
    node("bg", 3, "document", { title: "brand-guide.md", made_by: "p1" }),
  ];
  const steps = readerSteps(tree, null);
  return view("list", { steps, need: whatYouNeed(steps, tree, null), results: [] });
}

describe("a file a step makes", () => {
  it("the step that uses it says where it was made and goes there; there is no Download", () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    mountList(madeFileView());
    const second = screen.getAllByTestId("step-card")[1];
    expect(second.textContent).toContain("attach" + "brand-guide.md, made in step 1");
    expect(within(second).queryByRole("link", { name: /Download/ })).toBeNull();
    const link = within(second).getByRole("link", { name: "Go to step 1" });
    expect(link.getAttribute("href")).toBe("#node-p1");
    fireEvent.click(link);
    expect(scroll.mock.contexts[0]).toBe(document.getElementById("step-p1"));
  });

  it("the step that makes it says to save it, quietly, and the other step does not", () => {
    mountList(madeFileView());
    const [first, second] = screen.getAllByTestId("step-card");
    expect(within(first).getByTestId("save-line").textContent).toBe("Save what this step gives you as brand-guide.md");
    expect(within(second).queryByTestId("save-line")).toBeNull();
  });

  it("What you need reads Made in step 1 with no Download", () => {
    render(
      <MemoryRouter initialEntries={[REFINED]}>
        <NeedPanel view={madeFileView()} onOpenOther={vi.fn()} />
      </MemoryRouter>,
    );
    const need = screen.getByTestId("build-need");
    expect(within(need).getByText("Made in step 1 · used in step 2")).toBeTruthy();
    expect(within(need).queryByRole("link", { name: /Download/ })).toBeNull();
  });
});

describe("NeedPanel", () => {
  it("lists tools with their marks at 28, files with Download, time, and says what Copy for AI copies", () => {
    const onOpenOther = vi.fn();
    render(
      <MemoryRouter initialEntries={[REFINED]}>
        <NeedPanel view={view("list")} onOpenOther={onOpenOther} />
      </MemoryRouter>,
    );
    const need = screen.getByTestId("build-need");
    expect(within(need).getByRole("heading", { name: "What you need" })).toBeTruthy();
    expect(within(need).getByText("to repeat this build")).toBeTruthy();
    const tools = within(need).getByRole("region", { name: "Tools and models" });
    const marks = tools.querySelectorAll("[data-mark]");
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) expect((mark as HTMLElement).style.width).toBe("28px");
    expect(within(need).getByRole("link", { name: "Download CLAUDE.md" })).toBeTruthy();
    expect(within(need).getByText("4 sessions over 3 days")).toBeTruthy();
    expect(within(need).getByText("Copy for AI copies all 5 steps in order, with each new chat and paste-in written out.")).toBeTruthy();
  });
});
