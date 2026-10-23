// CA-17 P4 — the map of sessions as it is drawn: head, boxes, lines, strip, legend, selection and the panel.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sessionMapModel, type MapSession, type SessionLink, type SessionMapModel } from "@/lib/build/sessionMap";

import { MAP_COPY, NoMap, SessionMapColumn, mapTitle, type MapControls } from "./SessionMap";
import { PANEL_COPY, SessionMapPanel } from "./SessionMapPanel";

function width(px: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    return { matches: min ? px >= Number(min[1]) : max ? px <= Number(max[1]) : false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined };
  });
}
beforeEach(() => width(1280));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const session = (number: number, part: string, over: Partial<MapSession> = {}): MapSession => ({ key: `s${number}`, number, app: "Claude", part, tiles: 1, ...over });
const link = (from: number, to: number, what = "src/portal/api.ts"): SessionLink => ({
  id: `s${from}>s${to}`,
  session: `s${to}`,
  from: `s${from}`,
  tiles: [{ to: `t${to}`, from: `t${from}`, verb: "reads", sentence: `Agent ${to} reads Code ${from}`, what }],
});

/** The board's build: Part A (S1 to S4) and Part B (S5, S6), five stages. */
function twoParts(over: Partial<Parameters<typeof sessionMapModel>[0]> = {}): SessionMapModel {
  return sessionMapModel({
    sessions: [
      session(1, "a", { title: "Plan the portal", day: "2026-10-07" }),
      session(2, "a", { app: "Claude Code", title: "Build the portal", colour: "#7FA7D9", day: "2026-10-08" }),
      session(3, "a", { app: "Lovable", title: "Landing page", day: "2026-10-08" }),
      session(4, "a", { app: "Claude Code", title: "Support inbox", colour: "#7FB88A", day: "2026-10-12" }),
      session(5, "b", { title: "Triage agent", colour: "#B79AD6", day: "2026-10-09" }),
      session(6, "b", { app: "n8n", day: "2026-10-10" }),
    ],
    tiles: { s5: [{ id: "t5", number: "9", title: "Triage prompt", kind: "Prompt" }, { id: "t6", number: "4", title: "api.ts", kind: "Code" }] },
    parts: [
      { key: "a", index: 0, name: "Tenant portal", colour: "#8FBFB8", sessions: ["s1", "s2", "s3", "s4"] },
      { key: "b", index: 1, name: "Support agent", colour: "#D98C8C", sessions: ["s5", "s6"], startsAfter: "s2", startsAfterLine: "Part A · Session 2" },
    ],
    links: [link(1, 2), link(1, 3), link(2, 5), link(5, 6), link(3, 4), link(6, 4)],
    meta: { s3: { withAbove: true, date: "" } },
    labels: "letters",
    ...over,
  });
}

function onePart(): SessionMapModel {
  return sessionMapModel({ sessions: [session(1, "a"), session(2, "a")], parts: [{ key: "a", index: 0, sessions: ["s1", "s2"] }], links: [link(1, 2)], meta: {}, labels: "numbers" });
}

const controls = (over: Partial<MapControls> = {}): MapControls => ({ onDirection: vi.fn(), onBuildPage: true, onToggleBuildPage: vi.fn(), onRemove: vi.fn(), ...over });

function Harness({ model, direction = "horizontal", start = null, maker = true, extra }: { model: SessionMapModel; direction?: "horizontal" | "vertical"; start?: string | null; maker?: boolean; extra?: Partial<MapControls> }) {
  const [selected, setSelected] = useState<string | null>(start);
  return (
    <div>
      <SessionMapColumn model={model} direction={direction} selected={selected} onSelect={setSelected} controls={maker ? controls(extra) : undefined} shownLine={maker ? "Shown on build page" : undefined} />
      <SessionMapPanel model={model} selected={selected} onOpenInBuild={maker ? vi.fn() : undefined} />
    </div>
  );
}

describe("the head", () => {
  it("says how many sessions in how many parts, and the stages, the days and where it shows", () => {
    render(<Harness model={twoParts()} />);
    expect(screen.getByTestId("map-title").textContent).toBe("6 sessions in 2 parts");
    expect(screen.getByTestId("map-sub").textContent).toBe("5 stages · 7 to 12 Oct · Shown on build page");
  });
  it("says just the sessions with one part", () => {
    expect(mapTitle(onePart())).toBe("2 sessions");
    expect(mapTitle(twoParts())).toBe("6 sessions in 2 parts");
  });
  it("has Horizontal and Vertical, Fit to screen and Map options for the maker, and only Fit to screen for a reader", () => {
    const onDirection = vi.fn();
    render(<Harness model={twoParts()} extra={{ onDirection }} />);
    const group = screen.getByRole("group", { name: MAP_COPY.directionLabel });
    expect(within(group).getByRole("button", { name: "Horizontal" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(group).getByRole("button", { name: "Vertical" }));
    expect(onDirection).toHaveBeenCalledWith("vertical");
    expect(screen.getByRole("button", { name: MAP_COPY.fit })).toBeTruthy();
    expect(screen.getByRole("button", { name: MAP_COPY.options })).toBeTruthy();
    cleanup();
    render(<Harness model={twoParts()} maker={false} />);
    expect(screen.queryByRole("group", { name: MAP_COPY.directionLabel })).toBeNull();
    expect(screen.queryByRole("button", { name: MAP_COPY.options })).toBeNull();
    expect(screen.getByRole("button", { name: MAP_COPY.fit })).toBeTruthy();
  });
  it("opens Map options: Show on build page (checkable), then Remove map in the danger colour", async () => {
    const extra = { onToggleBuildPage: vi.fn(), onRemove: vi.fn() };
    render(<Harness model={twoParts()} extra={extra} />);
    const trigger = screen.getByRole("button", { name: MAP_COPY.options });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.keyDown(trigger, { key: "Enter" });
    const show = await screen.findByRole("menuitemcheckbox", { name: MAP_COPY.showOnBuildPage });
    expect(show.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("menuitem", { name: MAP_COPY.remove }).getAttribute("data-tone")).toBe("danger");
    fireEvent.click(show);
    expect(extra.onToggleBuildPage).toHaveBeenCalledWith(false);
    cleanup();
    const again = { onToggleBuildPage: vi.fn(), onRemove: vi.fn() };
    render(<Harness model={twoParts()} extra={again} />);
    const second = screen.getByRole("button", { name: MAP_COPY.options });
    fireEvent.pointerDown(second, { button: 0, ctrlKey: false });
    fireEvent.keyDown(second, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: MAP_COPY.remove }));
    expect(again.onRemove).toHaveBeenCalled();
  });
});

describe("the boxes", () => {
  it("are 164 by 38 buttons holding the mark, the title (or the app's name) and the number", () => {
    render(<Harness model={twoParts()} />);
    const boxes = screen.getAllByTestId("map-box");
    expect(boxes).toHaveLength(6);
    const five = boxes.find((box) => box.getAttribute("data-session-key") === "s5") as HTMLElement;
    expect(five.style.width).toBe("164px");
    expect(five.style.height).toBe("38px");
    expect(five.textContent).toContain("Triage agent");
    expect(five.textContent).toContain("S5");
    expect(five.getAttribute("aria-label")).toBe("Session 5, Triage agent, Claude");
    const six = boxes.find((box) => box.getAttribute("data-session-key") === "s6") as HTMLElement;
    expect(six.textContent).toContain("n8n");
    expect(six.textContent).toContain("S6");
  });
  it("outline a coloured session in its colour and leave the rest alone", () => {
    render(<Harness model={twoParts()} />);
    const coloured = document.querySelector('[data-session-key="s2"]') as HTMLElement;
    expect(coloured.style.borderColor).toBe("#7fa7d9");
    expect((document.querySelector('[data-session-key="s1"]') as HTMLElement).style.borderColor).not.toBe("#7fa7d9");
    expect(coloured.style.boxShadow).toContain("inset");
  });
  it("are buttons in reading order: by stage, then by part", () => {
    render(<Harness model={twoParts()} />);
    expect(screen.getAllByTestId("map-box").map((box) => box.getAttribute("data-session-key"))).toEqual(["s1", "s2", "s3", "s5", "s6", "s4"]);
  });
  it("select on click and on Enter, ring the selected box, dim the ones not joined to it, and clear on Escape", () => {
    render(<Harness model={twoParts()} />);
    const box = (key: string) => document.querySelector(`[data-session-key="${key}"]`) as HTMLElement;
    fireEvent.click(box("s5"));
    expect(box("s5").getAttribute("aria-pressed")).toBe("true");
    expect(box("s5").style.boxShadow).toContain("0 0 0 3px var(--surface), 0 0 0 4.5px var(--text2)");
    // S5 is joined to S2 and S6.
    expect(box("s2").getAttribute("data-dimmed")).toBeNull();
    expect(box("s6").getAttribute("data-dimmed")).toBeNull();
    expect(box("s1").getAttribute("data-dimmed")).toBe("true");
    expect(box("s4").getAttribute("data-dimmed")).toBe("true");
    fireEvent.keyDown(screen.getByTestId("session-map"), { key: "Escape" });
    expect(box("s5").getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelectorAll('[data-dimmed="true"]')).toHaveLength(0);
    // Enter on a button is a click.
    box("s1").focus();
    fireEvent.keyDown(box("s1"), { key: "Enter" });
    fireEvent.click(box("s1"));
    expect(box("s1").getAttribute("aria-pressed")).toBe("true");
  });
  it("keep a selected box that is also coloured: the inset stays under the ring", () => {
    render(<Harness model={twoParts()} start="s2" />);
    const shadow = (document.querySelector('[data-session-key="s2"]') as HTMLElement).style.boxShadow;
    expect(shadow.indexOf("inset")).toBeLessThan(shadow.indexOf("4.5px"));
  });
});

describe("the lines", () => {
  it("draw a clear band first: a 9px stroke in the surface's colour, then the line, 2.5px with round caps", () => {
    render(<Harness model={twoParts()} />);
    const group = screen.getAllByTestId("map-line")[0];
    const [halo, stroke] = [...group.children] as SVGPathElement[];
    expect(halo.getAttribute("data-testid")).toBe("map-line-halo");
    expect(stroke.getAttribute("data-testid")).toBe("map-line-stroke");
    expect(halo.getAttribute("stroke-width")).toBe("9");
    expect(stroke.getAttribute("stroke-width")).toBe("2.5");
    expect(stroke.getAttribute("stroke-linecap")).toBe("round");
    expect(halo.style.stroke).toBe("var(--surface)");
    expect(stroke.getAttribute("stroke-dasharray")).toBeNull();
    expect(group.outerHTML).not.toContain("marker");
  });
  it("sit under the boxes", () => {
    render(<Harness model={twoParts()} />);
    const drawing = screen.getByTestId("session-map-drawing");
    const children = [...drawing.children];
    expect(children.findIndex((child) => child.tagName === "svg")).toBeLessThan(children.findIndex((child) => child.getAttribute("data-testid") === "map-box"));
  });
  it("are --label with nothing selected, and --text on the selected session's with the rest dimmed", () => {
    render(<Harness model={twoParts()} />);
    for (const stroke of screen.getAllByTestId("map-line-stroke")) expect((stroke as unknown as SVGElement).style.stroke).toBe("var(--label)");
    fireEvent.click(document.querySelector('[data-session-key="s5"]') as HTMLElement);
    const touching = screen.getAllByTestId("map-line").filter((line) => line.getAttribute("data-touching"));
    expect(touching.map((line) => `${line.getAttribute("data-from")}>${line.getAttribute("data-to")}`).sort()).toEqual(["s2>s5", "s5>s6"]);
    for (const line of touching) expect((line.querySelector('[data-testid="map-line-stroke"]') as unknown as SVGElement).style.stroke).toBe("var(--text)");
    const others = screen.getAllByTestId("map-line").filter((line) => !line.getAttribute("data-touching"));
    expect(others.length).toBe(4);
    for (const line of others) expect(line.getAttribute("data-dimmed")).toBe("true");
  });
});

describe("the stages and the parts", () => {
  it("label the stage strip, and the selected session's stage in --text", () => {
    render(<Harness model={twoParts()} start="s5" />);
    const labels = screen.getAllByTestId("map-stage-label");
    expect(labels.map((label) => label.textContent)).toEqual(["STAGE 1 · 7 OCT", "STAGE 2 · 8 OCT", "STAGE 3 · 9 OCT", "STAGE 4 · 10 OCT", "STAGE 5 · 12 OCT"]);
    expect(labels.filter((label) => label.getAttribute("data-selected")).map((label) => label.getAttribute("data-stage"))).toEqual(["3"]);
    expect(screen.getByTestId("map-strip").style.height).toBe("22px");
  });
  it("draw part labels, their notes and a dashed line between parts, only with two or more parts", () => {
    render(<Harness model={twoParts()} />);
    const labels = screen.getAllByTestId("map-part-label");
    expect(labels.map((label) => label.textContent)).toEqual(["Part A4 sessions", "Part BStarts after Part A · Session 2"]);
    expect(document.querySelectorAll('[data-kind="part"]')).toHaveLength(1);
    cleanup();
    render(<Harness model={onePart()} />);
    expect(screen.queryAllByTestId("map-part-label")).toHaveLength(0);
    expect(document.querySelectorAll('[data-kind="part"]')).toHaveLength(0);
  });
  it("is vertical below 768 wide whatever the maker chose, and horizontal above", () => {
    render(<Harness model={twoParts()} direction="horizontal" />);
    expect(screen.getByTestId("session-map-drawing").getAttribute("data-direction")).toBe("horizontal");
    cleanup();
    width(600);
    render(<Harness model={twoParts()} direction="horizontal" />);
    expect(screen.getByTestId("session-map-drawing").getAttribute("data-direction")).toBe("vertical");
    expect(screen.queryByRole("group", { name: MAP_COPY.directionLabel })).toBeNull();
  });
  it("draws the strip as a column with two-line labels when vertical", () => {
    render(<Harness model={twoParts()} direction="vertical" />);
    const label = screen.getAllByTestId("map-stage-label")[1];
    expect([...label.children].map((line) => line.textContent)).toEqual(["STAGE 2", "8 OCT"]);
    expect(screen.getByTestId("map-strip").style.width).toBe("72px");
  });
});

describe("the legend", () => {
  it("has the sentence on the left and the parts on the right with nothing selected", () => {
    render(<Harness model={twoParts()} />);
    const legend = screen.getByTestId("map-legend");
    expect(within(legend).getByTestId("map-legend-note").textContent).toBe(MAP_COPY.legend);
    expect(within(legend).queryByTestId("map-legend-selected")).toBeNull();
    expect(within(legend).getAllByTestId("map-legend-part").map((part) => part.textContent)).toEqual(["Part A", "Part B"]);
    expect(within(legend).queryByTestId("map-legend-path")).toBeNull();
  });
  it("names the selected session's reach on the left and adds Selected path, with the sentence 16 under", () => {
    render(<Harness model={twoParts()} start="s5" />);
    const legend = screen.getByTestId("map-legend");
    expect(within(legend).getByTestId("map-legend-selected").textContent).toBe("Session 5 · Triage agent uses 1 session and is used by 1");
    expect(within(legend).getByTestId("map-legend-path").textContent).toBe(MAP_COPY.selectedPath);
    expect(within(legend).getByTestId("map-legend-note").getAttribute("style")).toContain("margin: 16px 0px 0px");
  });
  it("leaves the part keys out with one part", () => {
    render(<Harness model={onePart()} start="s1" />);
    expect(screen.queryAllByTestId("map-legend-part")).toHaveLength(0);
    expect(screen.getByTestId("map-legend-path")).toBeTruthy();
  });
});

describe("the panel", () => {
  it("with nothing selected lists the parts, then the stages, then says nothing is selected", () => {
    render(<Harness model={twoParts()} />);
    const panel = screen.getByTestId("map-panel");
    expect(within(panel).getByTestId("panel-parts-note").textContent).toBe("2 parts · labelled with letters");
    const rows = within(panel).getAllByTestId("panel-part-row");
    expect(rows.map((row) => row.textContent)).toEqual(["ATenant portal· 4 sessionsStages 1 to 5", "BSupport agent· 2 sessionsStages 3 to 4"]);
    expect(within(panel).getByTestId("panel-stages-note").textContent).toBe("7 to 12 Oct");
    expect(within(panel).getAllByTestId("panel-stage")).toHaveLength(5);
    expect(within(panel).getAllByTestId("panel-stage")[2].textContent).toContain("Stage 3");
    expect(within(panel).getAllByTestId("panel-stage")[2].textContent).toContain("9 Oct");
    expect(within(panel).getByTestId("panel-nothing").textContent).toBe(PANEL_COPY.nothing);
  });
  it("leaves the Parts section out with one part", () => {
    render(<Harness model={onePart()} />);
    expect(screen.queryByTestId("panel-parts")).toBeNull();
    expect(screen.queryByText("Parts")).toBeNull();
  });
  it("with a session selected names it, where it stands, and what it uses and what uses it", () => {
    render(<Harness model={twoParts()} start="s5" />);
    const panel = screen.getByTestId("map-panel");
    expect(within(panel).getByTestId("panel-title").textContent).toBe("Triage agent");
    expect(within(panel).getByTestId("panel-where").textContent).toBe("Session 5 · Part B · Claude · 9 Oct");
    const rows = within(panel).getAllByTestId("panel-session-row");
    expect(rows.map((row) => row.textContent)).toEqual(["S2Build the portal· Claude CodeUses from", "S6n8n· untitledUsed by"]);
    expect(within(panel).getByTestId("panel-connections").textContent).toBe("2 connections");
    const connections = within(panel).getAllByTestId("panel-connection");
    expect(connections[0].textContent).toContain("Agent 5 reads Code 2");
    expect(connections[0].textContent).toContain("Uses from");
    expect(connections[0].textContent).toContain("src/portal/api.ts · Session 2");
    expect(connections[1].textContent).toContain("Used by");
    expect(within(panel).getByTestId("panel-tiles-note").textContent).toBe("2 tiles, shown here and not on the map");
    expect(within(panel).getAllByTestId("panel-tile-row").map((row) => row.textContent)).toEqual(["9Triage promptPrompt", "4api.tsCode"]);
  });
  it("has Open in the build for the maker, which asks for the session, and not for a reader", () => {
    const onOpen = vi.fn();
    const { rerender } = render(<SessionMapPanel model={twoParts()} selected="s5" onOpenInBuild={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: PANEL_COPY.openInBuild }));
    expect(onOpen).toHaveBeenCalledWith("s5");
    rerender(<SessionMapPanel model={twoParts()} selected="s5" />);
    expect(screen.queryByRole("button", { name: PANEL_COPY.openInBuild })).toBeNull();
  });
  it("opens the build at a tile from its row", () => {
    const onOpenTile = vi.fn();
    render(<SessionMapPanel model={twoParts()} selected="s5" onOpenTile={onOpenTile} />);
    fireEvent.click(screen.getAllByTestId("panel-tile-row")[1]);
    expect(onOpenTile).toHaveBeenCalledWith("t6");
  });
  it("shows the panel for a session with no part label when the build has one part", () => {
    render(<SessionMapPanel model={onePart()} selected="s1" />);
    expect(screen.getByTestId("panel-where").textContent).toBe("Session 1 · Claude");
  });
});

describe("no map yet", () => {
  it("says so, what a map is, and has Create a map", () => {
    const onCreate = vi.fn();
    render(<NoMap onCreate={onCreate} />);
    expect(screen.getByText(MAP_COPY.noMap)).toBeTruthy();
    expect(screen.getByText(MAP_COPY.noMapBody)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: MAP_COPY.create }));
    expect(onCreate).toHaveBeenCalled();
  });
});
