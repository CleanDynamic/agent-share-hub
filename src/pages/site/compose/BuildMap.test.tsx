import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxManualFixture, sandboxMapProps, sandboxTeamFixture } from "@/dev/fixtures/sandbox";
import { layoutMap } from "@/lib/build/mapLayout";

import { boxName, BuildMap, columnDate, type BuildMapProps } from "./BuildMap";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function map(over: Partial<BuildMapProps> = {}) {
  const props: BuildMapProps = { ...sandboxMapProps("bakery"), selectedId: null, onSelect: vi.fn(), onClear: vi.fn(), onConnect: vi.fn(), onOpenPrompt: vi.fn(), ...over };
  render(<BuildMap {...props} />);
  return props;
}

describe("the boxes", () => {
  it("are real buttons named 'Prompt n, title, k inputs', in lane then column order", () => {
    map();
    const boxes = screen.getAllByRole("button").filter((el) => el.getAttribute("data-testid")?.startsWith("map-box-"));
    expect(boxes.map((el) => el.getAttribute("data-testid"))[0]).toBe("map-box-p1");
    expect(screen.getByRole("button", { name: "Prompt 3, Fix the mobile layout, 2 inputs" })).toBeTruthy();
    expect(boxName({ kind: "step", stepKind: "prompt", number: "2", title: "Prompt 2", inputs: [] })).toBe("Prompt 2, Prompt 2, 0 inputs");
  });

  /* UI-P94: the refined result box has no evidence border, so the box is told by its "Result" label in either look. */
  it("draws a dashed Files and tools lane, the result with its Result label, and a suggested input", () => {
    map();
    expect(screen.getAllByTestId("map-lane").some((lane) => lane.getAttribute("data-dashed") === "true")).toBe(true);
    expect(within(screen.getByTestId("map-box-r1")).getByText("Result")).toBeTruthy();
    expect(screen.getByText("1 suggested")).toBeTruthy();
    expect(screen.getAllByTestId("map-wire").some((wire) => wire.getAttribute("data-suggested") === "true")).toBe(true);
  });

  it("names the columns by their dates", () => {
    expect(columnDate("2026-03-04")).toBe("4 MAR");
    map();
    expect(screen.getAllByTestId("map-column-date").map((el) => el.textContent)).toContain("3 MAR");
  });
});

describe("selecting", () => {
  it("selects on a click and opens the full prompt on a double-click and on Enter", () => {
    const props = map();
    const box = screen.getByTestId("map-box-p2");
    fireEvent.click(box);
    expect(props.onSelect).toHaveBeenCalledWith("p2");
    fireEvent.doubleClick(box);
    expect(props.onOpenPrompt).toHaveBeenLastCalledWith("p2");
    fireEvent.keyDown(box, { key: "Enter" });
    expect(props.onOpenPrompt).toHaveBeenCalledTimes(2);
  });
});

describe("connecting", () => {
  // jsdom has no PointerEvent: a MouseEvent of the pointer type carries the coordinates React reads.
  const pointer = (el: Element, type: string, x: number, y: number) => fireEvent(el, new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  const drag = (from: string, to: string, steps = sandboxMapProps("bakery")) => {
    const layout = layoutMap(steps.steps, steps.groups, steps.files, steps.tools, steps.results, steps.suggestions);
    const a = layout.boxes.find((box) => box.id === from)!;
    const b = layout.boxes.find((box) => box.id === to)!;
    const dot = screen.getByTestId(`map-dot-${from}`);
    pointer(dot, "pointerdown", a.x + a.w, a.y + 14);
    pointer(dot, "pointermove", b.x + 20, b.y + 20);
    const line = screen.queryByTestId("map-drag-line");
    pointer(dot, "pointerup", b.x + 20, b.y + 20);
    return line;
  };

  it("draws a line that follows the pointer, and a drop on a later step adds the input", () => {
    const props = map();
    const line = drag("p2", "p4");
    expect(line).toBeTruthy();
    expect(props.onConnect).toHaveBeenCalledWith("p4", { kind: "output", node_id: "p2" });
    expect(screen.queryByTestId("map-drag-line")).toBeNull();
  });

  it("snaps back on a drop the rules refuse, and says why", async () => {
    const props = map();
    drag("p4", "p2");
    expect(props.onConnect).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getAllByRole("status").some((el) => /repeats until a condition/.test(el.textContent ?? ""))).toBe(true));
  });

  it("refuses an input already listed", async () => {
    const props = map();
    drag("p1", "p2");
    expect(props.onConnect).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getAllByRole("status").some((el) => /already listed/.test(el.textContent ?? ""))).toBe(true));
  });

  it("does nothing when a box itself is dragged", () => {
    const props = map();
    const box = screen.getByTestId("map-box-p2");
    pointer(box, "pointerdown", 10, 10);
    pointer(box, "pointermove", 300, 300);
    pointer(box, "pointerup", 300, 300);
    expect(props.onConnect).not.toHaveBeenCalled();
    expect(props.onSelect).not.toHaveBeenCalled();
  });
});

describe("agents and teams (UI-P69)", () => {
  const teamMap = (over: Partial<BuildMapProps> = {}) => {
    const props: BuildMapProps = { ...sandboxTeamFixture().map, selectedId: null, onSelect: vi.fn(), onClear: vi.fn(), onConnect: vi.fn(), onOpenContainer: vi.fn(), onBack: vi.fn(), onLeave: vi.fn(), ...over };
    render(<BuildMap {...props} />);
    return props;
  };
  const team = () => sandboxTeamFixture().map.steps.find((step) => step.id === "t3")!;

  it("gives a team its own lane, a two-column box 112 tall, and 'Open' on its header", () => {
    teamMap();
    expect(screen.getAllByTestId("map-lane").map((lane) => lane.textContent)).toContain("Team 3runs by itself");
    const box = screen.getByTestId("map-box-t3");
    expect(box.style.height).toBe("112px");
    // CA-03: the box's name sits inside it, at the top: its number, then its title.
    expect(within(box).getByTestId("map-container-head").textContent).toBe("3Copy team");
    expect(box.textContent).toContain("4 agents · 1 file");
    expect(box.textContent).toContain("Runs once");
    expect(screen.getByRole("button", { name: "Open Team 3" })).toBeTruthy();
    expect(screen.getByText("Open shows what is inside the team")).toBeTruthy();
  });

  it("opens on Open, on a double-click and on Enter", () => {
    const props = teamMap();
    fireEvent.click(screen.getByRole("button", { name: "Open Team 3" }));
    expect(props.onOpenContainer).toHaveBeenLastCalledWith("t3");
    fireEvent.doubleClick(screen.getByTestId("map-box-t3"));
    expect(props.onOpenContainer).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(screen.getByTestId("map-box-t3"), { key: "Enter" });
    expect(props.onOpenContainer).toHaveBeenCalledTimes(3);
    // A prompt still opens the full prompt window, not a container.
    expect(props.onOpenPrompt).toBeUndefined();
  });

  it("goes back to the build with a box that was clicked outside the frame selected", () => {
    const props = teamMap({ opened: team() });
    fireEvent.click(screen.getByTestId("map-box-p4"));
    expect(props.onLeave).toHaveBeenCalledWith("p4");
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it("selects a box inside, and says which is selected", () => {
    const props = teamMap({ opened: team(), selectedId: "t3c" });
    fireEvent.click(screen.getByTestId("map-box-t3b"));
    expect(props.onSelect).toHaveBeenCalledWith("t3b");
    expect(screen.getByText("Checker selected")).toBeTruthy();
  });

  it("goes up one level on Esc", () => {
    const props = teamMap({ opened: team() });
    fireEvent.keyDown(screen.getByTestId("opened-map"), { key: "Escape" });
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it("opens an agent inside the opened team, which then replaces the view", () => {
    const props = teamMap({ opened: team() });
    fireEvent.doubleClick(screen.getByTestId("map-box-t3b"));
    expect(props.onOpenContainer).toHaveBeenCalledWith("t3b");
    cleanup();
    teamMap({ opened: team().children.find((child) => child.id === "t3b")! });
    expect(screen.getByTestId("opened-frame").textContent).toContain("Inside agent 3.2 · Writer");
    // An agent opens onto its instructions and prompts.
    expect(["t3b:instructions", "t3b-p2", "t3b-p3"].map((id) => screen.getByTestId(`map-box-${id}`))).toHaveLength(3);
  });
});

describe("a manual step (UI-P70)", () => {
  const manualMap = (over: Partial<BuildMapProps> = {}) => {
    const props: BuildMapProps = { ...sandboxManualFixture().map, selectedId: null, onSelect: vi.fn(), onClear: vi.fn(), onConnect: vi.fn(), ...over };
    render(<BuildMap {...props} />);
    return props;
  };

  it("takes a 'By hand' lane and draws as a box like any other", () => {
    manualMap();
    expect(screen.getAllByTestId("map-lane").map((lane) => lane.textContent)).toContain("By hand");
    const box = screen.getByTestId("map-box-m3");
    // The colours resolve in a browser, not here: the tier-3 spec reads them.
    expect(box.getAttribute("data-kind")).toBe("step");
    expect(screen.getByTestId("manual-header").textContent).toBe("By hand · Figma");
    expect(box.textContent).toContain("3");
    expect(box.textContent).toContain("Laid out the hero");
    expect(box.textContent).not.toMatch(/words/);
    expect(screen.getByRole("button", { name: "Manual step 3, Manual step 3, 1 input" })).toBeTruthy();
  });

  it("has an input and an output dot, and a later step uses its output", () => {
    manualMap();
    expect(screen.getByTestId("map-input-m3-0")).toBeTruthy();
    expect(screen.getByTestId("map-dot-m3")).toBeTruthy();
    expect(screen.getByTestId("map-box-p4").textContent).toContain("Output of 3");
    expect(screen.getAllByTestId("map-wire")).toHaveLength(3);
  });

  it("opens nothing on a double-click: there is no more to read", () => {
    const props = manualMap({ onOpenPrompt: vi.fn() });
    fireEvent.doubleClick(screen.getByTestId("map-box-m3"));
    expect(props.onOpenPrompt).not.toHaveBeenCalled();
  });
});

describe("the maker's Map in the refined look (UI-P94)", () => {
  function refinedMap(over: Partial<BuildMapProps> = {}) {
    const props: BuildMapProps = { ...sandboxMapProps("bakery"), selectedId: null, onSelect: vi.fn(), onClear: vi.fn(), onConnect: vi.fn(), onOpenPrompt: vi.fn(), ...over };
    render(
      <MemoryRouter initialEntries={["/dev/kit/pages/sandbox"]}>
        <BuildMap {...props} />
      </MemoryRouter>,
    );
    return props;
  }
  const markup = () =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={["/dev/kit/pages/sandbox"]}>
        <BuildMap {...sandboxMapProps("bakery")} selectedId={null} onSelect={vi.fn()} onClear={vi.fn()} onConnect={vi.fn()} onOpenPrompt={vi.fn()} />
      </MemoryRouter>,
    );

  it("keeps the names, the selection and the connecting dots", () => {
    const props = refinedMap();
    fireEvent.click(screen.getByRole("button", { name: "Prompt 3, Fix the mobile layout, 2 inputs" }));
    expect(props.onSelect).toHaveBeenCalledWith("p3");
    expect(screen.getByTestId("map-dot-p3").getAttribute("title")).toBe("Drag to connect");
    expect(screen.getByText("1 suggested")).toBeTruthy();
  });

  it("draws input rows 20 high on the 22 pitch, the state line 18, the text 36 in two lines and the foot 20", () => {
    refinedMap();
    const row = screen.getByTestId("map-input-p3-0").parentElement as HTMLElement;
    expect(row.style.height).toBe("20px");
    expect((row.parentElement as HTMLElement).style.gap).toBe("2px");
    const box = screen.getByTestId("map-box-p3");
    const state = within(box).getByText("2 of 2 inputs accepted");
    expect(state.style.height).toBe("18px");
    expect(state.style.fontSize).toBe("10.5px");
    const words = within(box).getByText("19 words");
    expect(words.style.height).toBe("20px");
    const body = words.previousElementSibling as HTMLElement;
    expect(body.style.flex).toBe("0 1 36px");
    // jsdom drops the clamp and var() colours, so they are read from the server markup.
    expect(markup()).toContain("font-size:11px;font-weight:400;line-height:1.5;color:var(--text2);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2");
  });

  it("gives the result no evidence border: its head says Result in --evidence 10.5/500", () => {
    refinedMap();
    const result = screen.getByTestId("map-box-r1");
    expect(result.getAttribute("data-evidence")).toBeNull();
    const label = within(result).getByTestId("map-result-label");
    expect(label.textContent).toBe("Result");
    expect(label.style.fontSize).toBe("10.5px");
    expect(label.style.fontWeight).toBe("500");
    expect(markup()).toMatch(/data-testid="map-result-label" style="[^"]*color:var\(--evidence\)/);
  });

  it("puts the agent's name inside its box at the top, 13/500 --text, and every other line 12 --text2 (CA-03)", () => {
    refinedMap();
    const agent = screen.getByTestId("map-box-a5");
    const title = within(agent).getByTestId("map-container-title");
    expect(title.textContent).toBe("Order checker");
    expect(title.style.fontSize).toBe("13px");
    expect(title.style.fontWeight).toBe("500");
    expect(markup()).toMatch(/data-testid="map-container-title" style="[^"]*;color:var\(--text\)[;"]/);
    // What it holds and how it runs: the two lines beside its inputs.
    const lines = within(agent).getAllByText((_, element) => element?.tagName === "SPAN" && element.children.length === 0 && (element as HTMLElement).style.fontSize === "12px" && element.parentElement !== title.parentElement);
    expect(lines.length).toBe(2);
    for (const line of lines) expect(line.style.color === "" || line.style.color === "var(--text2)").toBe(true);
    expect(markup()).not.toMatch(/data-testid="map-box-a5"[^>]*>(?:(?!<\/button>).)*color:var\(--label\)/s);
  });

  it("draws the legend's samples 1px in --text2", () => {
    expect(markup()).toContain("width:24px;height:0;border-top:1px solid var(--text2)");
  });
});

describe("code (CA-02 P7)", () => {
  it("draws a code step as a box labelled Code, named by its file, sized in lines", () => {
    const base = sandboxMapProps("bakery");
    const code = { ...base.steps[0], id: "c9", kind: "code" as const, number: String(base.steps.length + 1), title: null, defaultTitle: `Code ${base.steps.length + 1}`, text: "export const a = 1;\nexport const b = 2;\n", words: 8, model: null, sessionId: null, tool: "Cursor", uses: [], children: [], runs: null, language: "ts", filename: "app.ts" };
    map({ steps: [...base.steps, code] });
    const box = screen.getByTestId("map-box-c9");
    expect(box.getAttribute("aria-label")).toBe(`Code ${code.number}, app.ts, 0 inputs`);
    expect(within(box).getByTestId("map-code-label").textContent).toBe("Code");
    expect(box.textContent).toContain("2 lines");
    expect(box.textContent).not.toContain("words");
  });
});
