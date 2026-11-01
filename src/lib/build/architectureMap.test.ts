// SV-27 Part 10: the architecture map, laid out from the three fixtures.

import { describe, expect, it } from "vitest";

import { agentTeamTree } from "@/dev/fixtures/deployment/agent-team";
import { assistantTree } from "@/dev/fixtures/deployment/assistant";
import { selfHostedTree } from "@/dev/fixtures/deployment/self-hosted";

import { layoutArchitecture } from "./architectureMap";
import { mapViewOf } from "./making";

const decimals = (value: number) => (String(value).split(".")[1] ?? "").length;

describe("the architecture map", () => {
  it("lays the assistant out in four columns inside the Mac Mini frame", () => {
    const map = layoutArchitecture(assistantTree);
    const columns = [...new Set(map.boxes.map((box) => box.column))].sort();
    expect(columns).toEqual([1, 2, 3, 4]);
    expect(map.frames).toHaveLength(1);
    const [frame] = map.frames;
    expect(frame.label).toBe("Mac Mini");
    for (const box of map.boxes) {
      expect(box.x).toBeGreaterThanOrEqual(frame.x);
      expect(box.x + box.w).toBeLessThanOrEqual(frame.x + frame.w);
      expect(box.y).toBeGreaterThanOrEqual(frame.y);
      expect(box.y + box.h).toBeLessThanOrEqual(frame.y + frame.h);
    }
    expect(map.boxes.find((box) => box.column === 1 && box.kind === "trigger")?.title).toBe("All the time");
    expect(map.boxes.filter((box) => box.kind === "channel").map((box) => box.title)).toEqual(["Telegram", "WhatsApp"]);
  });

  it("puts the self-hosted inference server between the team and the GPU host frame, with Grafana under them", () => {
    const map = layoutArchitecture(selfHostedTree);
    const team = map.boxes.find((box) => box.kind === "team");
    const server = map.boxes.find((box) => box.kind === "inference_server");
    const grafana = map.boxes.find((box) => box.kind === "monitoring");
    expect(team && server && grafana).toBeTruthy();
    expect((server?.x ?? 0) > (team?.x ?? 0)).toBe(true);
    expect(map.frames[0].label).toBe("Workstation · 2 × RTX 5090");
    expect(server?.x).toBeLessThan(map.frames[0].x + map.frames[0].w);
    expect(grafana?.y).toBeGreaterThan(map.frames[0].y + map.frames[0].h);
    expect(server?.lines).toEqual(["Qwen 32B · Q4_K_M"]);
    expect(map.lines.filter((line) => line.label === "watches").map((line) => line.to)).toEqual(["sh-t1"]);
  });

  it("draws implied lines once", () => {
    const map = layoutArchitecture(selfHostedTree);
    const keys = map.lines.map((line) => `${line.from}>${line.to}>${line.label}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("sh-a1>sh-s1>calls");
  });

  it("draws the agent team's relay beside its three agents (SV-28), and the knowledge base reading to all three", () => {
    const map = layoutArchitecture(agentTeamTree);
    const order = map.boxes.filter((box) => box.column === 2).map((box) => box.id);
    expect(order).toEqual(["at-t1", "at-a1", "at-a2", "at-a3"]);
    expect(map.boxes.filter((box) => box.column === 3)[0].id).toBe("at-r1");
    expect(map.boxes.find((box) => box.id === "at-r1")?.lines).toEqual(["Tailscale"]);
    expect(map.lines.filter((line) => line.from === "at-r1" && line.label === "relays").map((line) => line.to)).toEqual(["at-a1", "at-a2", "at-a3"]);
    expect(map.lines.filter((line) => line.from === "at-kb" && line.label === "reads").map((line) => line.to)).toEqual(["at-a1", "at-a2", "at-a3"]);
    expect(map.boxes.find((box) => box.id === "at-a1")?.lines[0]).toBe("Researcher");
  });

  it("keeps every coordinate to one decimal, horizontal and vertical", () => {
    for (const tree of [assistantTree, selfHostedTree, agentTeamTree]) {
      for (const direction of ["horizontal", "vertical"] as const) {
        const map = layoutArchitecture(tree, direction);
        for (const box of map.boxes) for (const value of [box.x, box.y, box.w, box.h]) expect(decimals(value)).toBeLessThanOrEqual(1);
        for (const line of map.lines) for (const value of [line.x1, line.y1, line.x2, line.y2]) expect(decimals(value)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("turns the columns into rows when vertical, with no two boxes overlapping", () => {
    const map = layoutArchitecture(assistantTree, "vertical");
    const rows = [...new Set(map.boxes.filter((box) => box.column <= 4).map((box) => box.y))];
    expect(rows).toHaveLength(4);
    for (const a of map.boxes) for (const b of map.boxes) if (a !== b) expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
  });
});

describe("the Map's view", () => {
  it("defaults to Sessions, or Architecture for a build with deployment tiles and one session; a stored view wins", () => {
    expect(mapViewOf({}, false, 1)).toBe("sessions");
    expect(mapViewOf({}, true, 1)).toBe("architecture");
    expect(mapViewOf({}, true, 3)).toBe("sessions");
    expect(mapViewOf({ map: { on: true, direction: "horizontal", onBuildPage: true, view: "sessions" } }, true, 1)).toBe("sessions");
  });
});

describe("SV-28: the relay and the handoff lines", () => {
  /** Whether a segment passes through a box (Liang-Barsky clipping, the box shrunk by a pixel so touching an edge does not count). */
  const crosses = (line: { x1: number; y1: number; x2: number; y2: number }, box: { x: number; y: number; w: number; h: number }): boolean => {
    const [minX, minY, maxX, maxY] = [box.x + 1, box.y + 1, box.x + box.w - 1, box.y + box.h - 1];
    let t0 = 0;
    let t1 = 1;
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    for (const [p, q] of [[-dx, line.x1 - minX], [dx, maxX - line.x1], [-dy, line.y1 - minY], [dy, maxY - line.y1]] as const) {
      if (p === 0) {
        if (q < 0) return false;
        continue;
      }
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 > t1) return false;
    }
    return true;
  };

  for (const direction of ["horizontal", "vertical"] as const) {
    it(`no handoff line crosses the relay box (${direction})`, () => {
      const map = layoutArchitecture(agentTeamTree, direction);
      const relay = map.boxes.find((box) => box.kind === "relay");
      const handoffs = map.lines.filter((line) => line.label === "hands off to");
      expect(relay).toBeTruthy();
      expect(handoffs).toHaveLength(3);
      for (const line of handoffs) expect(crosses(line, relay as NonNullable<typeof relay>)).toBe(false);
      // The relay keeps one line to each agent it joins.
      expect(map.lines.filter((line) => line.from === relay?.id && line.label === "relays")).toHaveLength(3);
    });
  }
});
