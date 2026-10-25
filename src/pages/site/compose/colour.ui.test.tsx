// CA-06 P4 — where a maker's colour shows: a tile's border and a session's line in the List, the Map's box, the dot in
// Sources and Details, the build page; that nested tiles never take their parent's; and the colour buttons' names.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LINKS_COLOURS, LINKS_S1, LINKS_S2, linksBuild } from "@/dev/fixtures/postLinks";
import { buildStepsFixture } from "@/dev/fixtures/buildSteps";
import { shapeDetailsProps, shapeListProps, shapeMapProps, type ShapeSource } from "@/dev/fixtures/shapes";
import { StepsList } from "@/pages/site/build/BuildSteps";

import { BuildList, partName } from "./BuildList";
import { sessionMapFor } from "@/lib/build/sessionMap";
import { SessionMapColumn } from "./SessionMap";
import { DetailsPanel } from "./DetailsPanel";
import { SourcesPanel } from "./SourcesPanel";
import { sourceSessions } from "./sourcesModel";

vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));

afterEach(cleanup);

const build = linksBuild();
const source: ShapeSource = { tree: build.tree, making: build.making, selected: "o-p2" };
const inRouter = (element: ReturnType<typeof createElement>) => render(createElement(MemoryRouter, null, element));

/** A colour as jsdom writes it back in a style. */
const rgb = (hex: string) => hex.toLowerCase();

describe("the List", () => {
  it("draws a coloured tile's border in its colour, and a nested tile keeps its own, never its parent's", () => {
    inRouter(createElement(BuildList, shapeListProps("one-sitting", source)));
    const prompt = screen.getByRole("group", { name: /^Prompt 2:/ });
    expect(prompt.style.borderColor).toBe(rgb(LINKS_COLOURS.prompt));
    const [code, file] = within(prompt).getAllByTestId("sent-with-tile");
    expect(code.getAttribute("data-kind")).toBe("code");
    expect(code.style.borderColor).toBe(rgb(LINKS_COLOURS.code));
    expect(file.getAttribute("data-kind")).toBe("file");
    expect(file.style.borderColor).not.toBe(rgb(LINKS_COLOURS.code));
    expect(screen.getByRole("group", { name: /^Prompt 1:/ }).style.borderColor).toBe("");
  });

  it("draws a coloured session's line round its head and tiles, with room inside it only then", () => {
    const { container } = inRouter(createElement(BuildList, shapeListProps("one-sitting", source)));
    const coloured = container.querySelector(`[data-session-colour="${LINKS_COLOURS.session}"]`) as HTMLElement;
    expect(coloured.style.border).toBe(`1px solid ${rgb(LINKS_COLOURS.session)}`);
    expect(coloured.style.borderRadius).toBe("12px");
    expect(coloured.style.padding).toBe("12px");
    expect(within(coloured).getByRole("group", { name: /^Session 2/ })).toBeTruthy();
    expect(container.querySelectorAll("[data-session-colour]")).toHaveLength(1);
  });

  it("draws a colour button only on a part that has a colour; the others give one from their ⋯ menu (CA-14 P2)", async () => {
    const onColour = vi.fn();
    const sessionOps = { onTitle: vi.fn(), onMove: vi.fn(), onRemove: vi.fn() };
    inRouter(createElement(BuildList, { ...shapeListProps("one-sitting", source), onColour, sessionOps }));
    expect(screen.getByRole("button", { name: `Prompt 2 colour` })).toBeTruthy();
    expect(screen.getByRole("button", { name: `Session 2 colour` })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Prompt 1 colour" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Session 1 colour" })).toBeNull();
    const code = screen.getByRole("button", { name: `Code order-form.tsx colour` });
    fireEvent.click(code);
    expect(onColour).toHaveBeenCalledWith("node:o-c1", code, "Code order-form.tsx", LINKS_COLOURS.code);

    fireEvent.keyDown(screen.getByRole("button", { name: "Prompt 1 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Colour…" }));
    expect(onColour).toHaveBeenLastCalledWith("node:o-p1", expect.anything(), "Prompt 1", null);

    fireEvent.keyDown(screen.getByRole("button", { name: "Session 1 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Colour…" }));
    expect(onColour).toHaveBeenLastCalledWith(`session:${LINKS_S1}`, expect.anything(), "Session 1", null);
    cleanup();
    inRouter(createElement(BuildList, shapeListProps("one-sitting", source)));
    expect(screen.queryAllByTestId("colour-button")).toHaveLength(0);
  });

  it("draws a set colour as a filled circle, and no circle at all for none", () => {
    inRouter(createElement(BuildList, { ...shapeListProps("one-sitting", source), onColour: vi.fn() }));
    expect(document.querySelectorAll('[data-colour-dot="none"]')).toHaveLength(0);
    const set = screen.getByRole("button", { name: `Prompt 2 colour` }).querySelector("[data-colour-dot]") as HTMLElement;
    expect(set.style.background).toBe("rgb(201, 168, 107)");
  });

  it("names a part by its kind and number, or its title when it has none", () => {
    const [, two] = build.steps;
    expect(partName(two)).toBe("Prompt 2");
    expect(partName(two.sentWith?.[0] as never)).toBe("Code order-form.tsx");
  });
});

it("the Map draws a coloured session's box with its border, and no other", () => {
  const map = shapeMapProps("one-sitting", source);
  const model = sessionMapFor({ groups: map.groups, steps: map.steps, files: map.files, making: build.making });
  render(createElement(SessionMapColumn, { model, direction: "horizontal", selected: null, onSelect: vi.fn() }));
  const coloured = document.querySelector(`[data-testid="map-box"][data-session-colour="${LINKS_COLOURS.session}"]`) as HTMLElement;
  expect(coloured.style.borderColor).toBe(rgb(LINKS_COLOURS.session));
  const plain = screen.getAllByTestId("map-box").find((box) => !box.getAttribute("data-session-colour"));
  expect(plain?.style.borderColor ?? "").not.toBe(rgb(LINKS_COLOURS.session));
});

it("Sources puts a 7px dot before a coloured session's name", () => {
  const sessions = sourceSessions(build.groups, build.steps);
  render(createElement(SourcesPanel, { phone: false, fine: true, status: "ready", onRetry: vi.fn(), sessions, files: [], library: [], reminders: [], selectedId: null, onSelect: vi.fn(), onAddSession: vi.fn(), onDropFiles: vi.fn(), onPick: vi.fn() } as never));
  const dot = document.querySelector(`[data-colour-dot="${LINKS_COLOURS.session}"]`) as HTMLElement;
  expect(dot.style.width).toBe("7px");
  expect(sessions.find((row) => row.key === LINKS_S1)?.colour).toBeUndefined();
});

it("Details puts an 8px dot before its line, and has no colour button (CA-18: the colour is set from the tile's menu)", () => {
  const onPick = vi.fn();
  render(createElement(DetailsPanel, { ...shapeDetailsProps("one-sitting", "o-p2", source), colour: { what: "Prompt 2", colour: LINKS_COLOURS.prompt, onPick } }));
  const line = screen.getByTestId("details-line");
  expect((line.querySelector("[data-colour-dot]") as HTMLElement).style.width).toBe("8px");
  expect(screen.queryByRole("button", { name: / colour$/ })).toBeNull();
  expect(onPick).not.toHaveBeenCalled();
});

it("the build page draws the same tiles and session line, and no colour button", () => {
  const { title: _t, outcome: _o, ...view } = buildStepsFixture("links");
  const { container } = render(createElement(StepsList, { view, phone: false, announce: () => undefined }));
  const card = container.querySelector('[data-testid="step-card"][data-step="2"]') as HTMLElement;
  expect(card.style.borderColor).toBe(rgb(LINKS_COLOURS.prompt));
  const session = container.querySelector(`[data-session-colour="${LINKS_COLOURS.session}"]`) as HTMLElement;
  expect(session.style.border).toBe(`1px solid ${rgb(LINKS_COLOURS.session)}`);
  expect(container.querySelector('[data-testid="colour-button"]')).toBeNull();
  expect(LINKS_S2).toBeTruthy();
});
