// The two things NS-P34 adds on top of the shared writer.
//
// THE PLACEMENT PASS is where a Build File differs from every other intake: its
// nodes arrive with a shape, and this is the code that puts them back into it.
// The failure modes are quiet ones — a tree that comes out flat, siblings in
// the wrong order, a child hanging off a parent the creator threw away — so
// each gets its own case here rather than being left to an e2e run to notice.
//
// THE HEADER MAPPING is asserted because a shape the CHECK constraint refuses
// would fail the insert, and a build that will not create is the whole import
// lost at the last step.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BuildFileHeader } from "./buildfile";

const getTray = vi.fn();
const getNodeTree = vi.fn();
const reorderNodes = vi.fn();
vi.mock("./nodes", () => ({
  getTray: (...args: unknown[]) => getTray(...args),
  getNodeTree: (...args: unknown[]) => getNodeTree(...args),
  reorderNodes: (...args: unknown[]) => reorderNodes(...args),
}));

const createBuild = vi.fn();
const updateBuild = vi.fn();
vi.mock("./builds", () => ({
  createBuild: (...args: unknown[]) => createBuild(...args),
  updateBuild: (...args: unknown[]) => updateBuild(...args),
}));

vi.mock("./intake", () => ({ materialiseProposal: vi.fn() }));

import { createBuildFromHeader, placeImportedNodes } from "./buildFileImport";

const SESSION = "session-under-test";

/** A row as materialiseProposal leaves it: written, unplaced, provenance intact. */
function trayRow(localId: string, sessionId = SESSION) {
  return {
    id: `row-${localId}`,
    position: null,
    parent_id: null,
    source_ref: { source: "extractor-v1", session_id: sessionId, index: 1, local_id: localId },
  };
}

function header(overrides: Partial<BuildFileHeader> = {}): BuildFileHeader {
  return {
    title: "Retrieval agent",
    outcome: "Answers questions over a private corpus",
    shape: "agent",
    made_for: ["founder"],
    made_with: ["Claude", "Supabase"],
    live_url: null,
    repo_url: null,
    cost: null,
    time_to_first_result: null,
    ...overrides,
  };
}

/** The moves as {path -> parent path or root, position}, which is readable. */
function movesByPath() {
  const [, moves] = reorderNodes.mock.calls[0] as [string, Array<{ id: string; parent_id: string | null; position: number }>];
  return moves.map((move) => ({
    path: move.id.replace("row-", ""),
    parent: move.parent_id === null ? "root" : move.parent_id.replace("row-", ""),
    position: move.position,
  }));
}

beforeEach(() => {
  getTray.mockReset();
  getNodeTree.mockReset().mockResolvedValue([]);
  reorderNodes.mockReset().mockResolvedValue(undefined);
  createBuild.mockReset();
  updateBuild.mockReset();
});

describe("placeImportedNodes", () => {
  it("rebuilds the tree the file described", async () => {
    getTray.mockResolvedValue([
      trayRow("1"),
      trayRow("1.1"),
      trayRow("1.2"),
      trayRow("2"),
      trayRow("2.1"),
    ]);

    const result = await placeImportedNodes("build-1", SESSION);

    expect(result).toEqual({ placed: 5, leftInTray: 0 });
    expect(movesByPath()).toEqual([
      { path: "1", parent: "root", position: 0 },
      { path: "2", parent: "root", position: 1 },
      { path: "1.1", parent: "1", position: 0 },
      { path: "1.2", parent: "1", position: 1 },
      { path: "2.1", parent: "2", position: 0 },
    ]);
  });

  it("keeps siblings in the file's order past nine of them", async () => {
    // The case a plain string sort gets wrong: "10" sorts before "9".
    const paths = Array.from({ length: 12 }, (_, i) => `${i + 1}`);
    getTray.mockResolvedValue(paths.map((path) => trayRow(path)));

    await placeImportedNodes("build-1", SESSION);

    expect(movesByPath().map((move) => move.path)).toEqual(paths);
    expect(movesByPath().map((move) => move.position)).toEqual(
      Array.from({ length: 12 }, (_, i) => i)
    );
  });

  it("leaves a child in the tray when its parent was not kept", async () => {
    // "1" was un-ticked at the review, so it was never written. "1.1" has
    // nothing to hang from and must not be silently re-parented to the root.
    getTray.mockResolvedValue([trayRow("1.1"), trayRow("2")]);

    const result = await placeImportedNodes("build-1", SESSION);

    expect(result).toEqual({ placed: 1, leftInTray: 1 });
    expect(movesByPath()).toEqual([{ path: "2", parent: "root", position: 0 }]);
  });

  it("continues after nodes the build already had placed", async () => {
    getNodeTree.mockResolvedValue([{ id: "existing-1" }, { id: "existing-2" }]);
    getTray.mockResolvedValue([trayRow("1")]);

    await placeImportedNodes("build-1", SESSION);

    expect(movesByPath()).toEqual([{ path: "1", parent: "root", position: 2 }]);
  });

  it("ignores tray rows belonging to a different intake", async () => {
    getTray.mockResolvedValue([trayRow("1"), trayRow("1", "someone-elses-session")]);

    const result = await placeImportedNodes("build-1", SESSION);

    expect(result.placed).toBe(1);
  });

  it("does not call the writer when this import wrote nothing", async () => {
    getTray.mockResolvedValue([]);

    expect(await placeImportedNodes("build-1", SESSION)).toEqual({ placed: 0, leftInTray: 0 });
    expect(reorderNodes).not.toHaveBeenCalled();
  });

  it("refuses to guess when the proposal carries no id", async () => {
    await expect(placeImportedNodes("build-1", "")).rejects.toThrow(/cannot be identified/);
  });
});

describe("createBuildFromHeader", () => {
  beforeEach(() => {
    createBuild.mockResolvedValue({ id: "build-1" });
    updateBuild.mockResolvedValue({ id: "build-1" });
  });

  it("carries the header the file stated into the draft", async () => {
    await createBuildFromHeader(header());

    expect(createBuild).toHaveBeenCalledWith({
      title: "Retrieval agent",
      outcome: "Answers questions over a private corpus",
      shape: "agent",
      made_for: ["founder"],
      made_with: ["Claude", "Supabase"],
      live_url: null,
      repo_url: null,
    });
  });

  it("falls back to other for a shape the column would refuse", async () => {
    await createBuildFromHeader(header({ shape: "a chatbot thing" }));

    expect(createBuild.mock.calls[0][0].shape).toBe("other");
  });

  it("names an untitled build rather than failing the insert", async () => {
    await createBuildFromHeader(header({ title: "   " }));

    expect(createBuild.mock.calls[0][0].title).toBe("Untitled build");
  });

  it("writes the four columns createBuild does not take", async () => {
    await createBuildFromHeader(
      header({ time_to_first_result: 45, cost: { setup: 0, monthly: 12, currency: "GBP" } })
    );

    expect(updateBuild).toHaveBeenCalledWith("build-1", {
      time_to_first_result: 45,
      cost_setup: 0,
      cost_monthly: 12,
      currency: "GBP",
    });
  });

  it("keeps the build when those extra columns fail to write", async () => {
    updateBuild.mockRejectedValue(new Error("column is being altered"));

    const build = await createBuildFromHeader(header({ time_to_first_result: 45 }));

    expect(build.id).toBe("build-1");
  });
});
