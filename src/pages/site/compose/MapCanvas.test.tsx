import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { mapSandboxFixture, type MapSandboxName } from "@/dev/fixtures/mapSandbox";
import { mapLayoutOf, type MapLayout } from "@/lib/build/mapLayout";
import { startFromBuild } from "@/lib/build/mapStart";

import { MAP_CANVAS_COPY, MapCanvas } from "./MapCanvas";

function draw(name: MapSandboxName, mode: "maker" | "reader" = "maker", over: Partial<MapLayout> = {}) {
  const fixture = mapSandboxFixture(name);
  const layout = { ...(mapLayoutOf(fixture.making) ?? startFromBuild(fixture.steps, fixture.groups, fixture.making, fixture.results)), ...over };
  return render(<MapCanvas layout={layout} steps={fixture.steps} groups={fixture.groups} files={fixture.files} making={fixture.making} results={fixture.results} mode={mode} />);
}

const tileIds = () => screen.getAllByTestId("map-tile").map((tile) => tile.dataset.tileId);

describe("MapCanvas", () => {
  it("support inbox: 9 tiles in reading order, boxes as named groups holding their tiles as list items", () => {
    draw("supportInbox");
    const canvas = screen.getByRole("list", { name: MAP_CANVAS_COPY.canvas });
    const groups = within(canvas).getAllByRole("group").filter((group) => group.tagName === "SECTION");
    expect(groups.map((group) => group.getAttribute("aria-label"))).toEqual(["Classify, Session 1", "Refund rules, Session 2", "Draft and send, Session 3", "Result, Session 3"]);
    expect(tileIds()).toEqual(["p1", "f2", "p3", "p4", "c5", "k6", "a7", "t8", "r9"]);
    expect(within(groups[1]).getAllByRole("listitem")).toHaveLength(3);
  });

  it("a tile's description says what it uses and what uses it; lines and frames are hidden", () => {
    draw("supportInbox");
    const p3 = screen.getAllByTestId("map-tile").find((tile) => tile.dataset.tileId === "p3") as HTMLElement;
    const description = document.getElementById(p3.getAttribute("aria-describedby") as string);
    expect(description?.textContent).toBe("Prompt 3 reads File 2. Prompt 3 uses Prompt 4. Agent 7 uses Prompt 3.");
    expect(screen.getAllByTestId("map-line").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("map-line")[0].closest("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getAllByTestId("map-part-frame")[0].parentElement?.getAttribute("aria-hidden")).toBe("true");
  });

  it("6 to 5 is drawn dashed, 1 to 2 solid", () => {
    draw("supportInbox");
    const line = (id: string) => screen.getAllByTestId("map-line").find((each) => each.dataset.lineId === id) as Element;
    expect(line("c5>k6:tests").getAttribute("stroke-dasharray")).toBeTruthy();
    expect(line("p1>f2:uses").getAttribute("stroke-dasharray")).toBeNull();
  });

  it("a removed tile shows for the maker only", () => {
    const { unmount } = draw("removedTile");
    expect(screen.getByTestId("map-removed-tile")).toHaveTextContent(MAP_CANVAS_COPY.removed);
    unmount();
    draw("removedTile", "reader");
    expect(screen.queryByTestId("map-removed-tile")).toBeNull();
    expect(tileIds()).toEqual(["q1", "q2", "q3", "q4"]);
  });

  it("the number schemes change the badges", () => {
    const badge = (id: string) => within(screen.getAllByTestId("map-tile").find((tile) => tile.dataset.tileId === id) as HTMLElement).getByTestId("step-card").textContent ?? "";
    const { unmount } = draw("supportInbox");
    expect(badge("p4").startsWith("4")).toBe(true);
    unmount();
    const session = draw("supportInbox", "maker", { numbers: "session" });
    expect(badge("p4").startsWith("S2·1")).toBe(true);
    expect(badge("k6").startsWith("S2·3")).toBe(true);
    session.unmount();
    draw("supportInbox", "maker", { numbers: "part" });
    expect(badge("a7").startsWith("B·S3·1")).toBe(true);
  });

  it("the canvas wears its background's ink in either theme", () => {
    const { unmount } = draw("supportInbox");
    const canvas = screen.getByTestId("map-canvas");
    expect(canvas.style.getPropertyValue("--text")).toBe("#EDEFEC");
    unmount();
    draw("supportInbox", "maker", { background: "paper" });
    expect(screen.getByTestId("map-canvas").style.getPropertyValue("--text")).toBe("#0B120D");
  });
});
