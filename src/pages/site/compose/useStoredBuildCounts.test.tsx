// SV-23 P1: the counts are written 1.5 seconds after they stop changing, only when they differ from the row, once, and a missing
// column ends the attempts without a failure.

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateBuild = vi.fn();
vi.mock("@/lib/build/builds", () => ({ updateBuild: (...args: unknown[]) => updateBuild(...args) }));

import { DERIVED_WRITE_MS } from "./useClassificationCard";
import { resetStoredCountColumns, useStoredBuildCounts } from "./useStoredBuildCounts";

const COUNTS = { step_count: 4, part_count: 1, agent_count: 0, session_count: 2 };
const NEW_BUILD = { id: "b1", step_count: null, part_count: null, agent_count: null, session_count: 0 };

beforeEach(() => {
  vi.useFakeTimers();
  resetStoredCountColumns();
  updateBuild.mockReset().mockResolvedValue({});
});
afterEach(() => vi.useRealTimers());

const run = (props: { build?: unknown; counts?: typeof COUNTS | null; owner?: boolean }) =>
  renderHook((p: typeof props) => useStoredBuildCounts({ buildId: "b1", build: "build" in p ? p.build : NEW_BUILD, owner: p.owner ?? true, counts: p.counts === undefined ? COUNTS : p.counts }), { initialProps: props });

describe("useStoredBuildCounts", () => {
  it("writes the counts after the delay, and not before", async () => {
    run({});
    await act(async () => void vi.advanceTimersByTime(DERIVED_WRITE_MS - 1));
    expect(updateBuild).not.toHaveBeenCalled();
    await act(async () => void vi.advanceTimersByTime(1));
    expect(updateBuild).toHaveBeenCalledTimes(1);
    expect(updateBuild).toHaveBeenCalledWith("b1", COUNTS);
  });

  it("starts the wait again when the counts change, and writes the last ones once", async () => {
    const { rerender } = run({});
    await act(async () => void vi.advanceTimersByTime(1000));
    rerender({ counts: { ...COUNTS, step_count: 5 } });
    await act(async () => void vi.advanceTimersByTime(1000));
    expect(updateBuild).not.toHaveBeenCalled();
    await act(async () => void vi.advanceTimersByTime(600));
    expect(updateBuild).toHaveBeenCalledTimes(1);
    expect(updateBuild.mock.calls[0][1]).toMatchObject({ step_count: 5 });
  });

  it("writes only what differs, and nothing when the row already holds the counts", async () => {
    run({ build: { ...COUNTS, step_count: 3 } });
    await act(async () => void vi.advanceTimersByTime(DERIVED_WRITE_MS));
    expect(updateBuild).toHaveBeenCalledWith("b1", { step_count: 4 });
    updateBuild.mockClear();
    run({ build: COUNTS });
    await act(async () => void vi.advanceTimersByTime(DERIVED_WRITE_MS));
    expect(updateBuild).not.toHaveBeenCalled();
  });

  it("writes nothing for someone else's build, before the counts are known, or for a build not read yet", async () => {
    run({ owner: false });
    run({ counts: null });
    run({ build: null as unknown as object });
    await act(async () => void vi.advanceTimersByTime(DERIVED_WRITE_MS * 2));
    expect(updateBuild).not.toHaveBeenCalled();
  });

  it("stops trying once the columns are missing, and says nothing to the maker", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    updateBuild.mockRejectedValue({ code: "PGRST204" });
    const first = run({});
    await act(async () => void vi.advanceTimersByTime(DERIVED_WRITE_MS));
    expect(updateBuild).toHaveBeenCalledTimes(1);
    first.unmount();
    run({});
    await act(async () => void vi.advanceTimersByTime(DERIVED_WRITE_MS));
    expect(updateBuild).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
