// CA-21 P2 - the skeleton layer: behind the components, only while something is held.

import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { done, mountList, partsOf, pickUp, press, stubLayout, stubMedia } from "./ca21Harness";

beforeEach(stubMedia);
afterEach(done);

const firstTileGrip = () => screen.getAllByTestId("drag-handle")[0];

describe("the skeleton layer", () => {
  it("is not in the page at rest", async () => {
    stubLayout();
    mountList();
    expect(screen.queryByTestId("skeleton-layer")).toBeNull();
  });

  it("stands behind the components with nothing to click: z-index below them, no pointer events", async () => {
    stubLayout();
    mountList();
    await pickUp(firstTileGrip());
    const layer = screen.getByTestId("skeleton-layer");
    expect(layer.style.zIndex).toBe("-1");
    expect(layer.style.pointerEvents).toBe("none");
    expect(layer.getAttribute("aria-hidden")).toBe("true");
    // It is inside the list, which makes its own stacking context only while it is there.
    expect(layer.parentElement?.getAttribute("data-testid")).toBe("build-list");
    expect(layer.parentElement?.style.isolation).toBe("isolate");
  });

  it("draws a socket behind every tile, a lane round every session, and the held tile's place as the target", async () => {
    stubLayout();
    mountList();
    const tiles = document.querySelectorAll('[data-skel-kind="tile"]').length;
    const sessions = document.querySelectorAll('[data-skel-kind="session"]').length;
    await pickUp(firstTileGrip());
    expect(within(screen.getByTestId("skeleton-layer")).getAllByTestId("skeleton-socket")).toHaveLength(tiles - 1);
    expect(screen.getAllByTestId("skeleton-lane")).toHaveLength(sessions);
    const target = screen.getByTestId("skeleton-target");
    // Over its own start it is a plain socket with no words.
    expect(target.textContent).toBe("");
  });

  it("numbers each session's tiles on the rail, from 1, and the numbers change as things slide", async () => {
    stubLayout();
    mountList();
    await pickUp(firstTileGrip());
    const rails = screen.getAllByTestId("skeleton-rail");
    expect(rails.length).toBeGreaterThan(0);
    const numbers = (rail: HTMLElement) => within(rail).getAllByTestId("skeleton-number").map((n) => n.textContent);
    expect(numbers(rails[0])[0]).toBe("1");
    const first = numbers(rails[0]).length;
    await press("ArrowDown");
    const after = screen.getAllByTestId("skeleton-rail");
    expect(numbers(after[0])).toHaveLength(first);
    expect(numbers(after[0]).at(-1)).toBe(String(first));
  });

  it("says where it lands, once it has moved", async () => {
    stubLayout();
    mountList();
    await pickUp(firstTileGrip());
    await press("ArrowDown");
    const target = screen.getByTestId("skeleton-target");
    expect(target.textContent).toMatch(/^Lands hereSession 1 · 2 of \d+$/);
  });

  it("leaves out the rail and the numbers where there is under 40 of room, and keeps the sockets and lanes", async () => {
    stubLayout(20);
    mountList();
    await pickUp(firstTileGrip());
    expect(screen.queryByTestId("skeleton-rail")).toBeNull();
    expect(screen.queryByTestId("skeleton-number")).toBeNull();
    expect(screen.getAllByTestId("skeleton-socket").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("skeleton-lane").length).toBeGreaterThan(0);
  });

  it("goes when it is put back", async () => {
    stubLayout();
    mountList();
    await pickUp(firstTileGrip());
    expect(screen.getByTestId("skeleton-layer")).toBeTruthy();
    await press("Escape");
    await waitFor(() => expect(screen.queryByTestId("skeleton-layer")).toBeNull(), { timeout: 3000 });
  });

  it("draws the part frames' own outline once, with rails and numbers for the sessions, when a session is held", async () => {
    stubLayout();
    mountList({ parts: partsOf() });
    await pickUp(screen.getAllByTestId("session-drag-handle")[0]);
    const layer = screen.getByTestId("skeleton-layer");
    expect(layer.getAttribute("data-kind")).toBe("session");
    // Parts have a frame already: no lane outline is drawn round them.
    expect(screen.queryAllByTestId("skeleton-lane")).toHaveLength(0);
    expect(screen.getAllByTestId("skeleton-rail")).toHaveLength(2);
  });

  it("shows an empty session as a place to drop while a tile is held, in place of 'No tiles yet'", async () => {
    stubLayout();
    const base = mountList();
    const empty = { ...[...base.props.dividers.values()][0], key: "typed-empty", number: 9 };
    base.unmount();
    mountList({ emptySessions: [empty] });
    expect(screen.getAllByText("No tiles yet").length).toBeGreaterThan(0);
    await pickUp(firstTileGrip());
    expect(screen.queryByText("No tiles yet")).toBeNull();
    expect(screen.getByTestId("skeleton-empty").textContent).toBe("Drop a tile here");
    expect(screen.getByTestId("skeleton-empty").style.height).toBe("44px");
  });
});
