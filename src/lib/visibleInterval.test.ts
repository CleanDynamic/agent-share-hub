import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { visibleInterval } from "./visibleInterval";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
}

describe("visibleInterval", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    setVisibility("visible");
  });

  it("ticks while visible and not at all while hidden", () => {
    const tick = vi.fn();
    const stop = visibleInterval(tick, 1000);
    vi.advanceTimersByTime(3000);
    expect(tick).toHaveBeenCalledTimes(3);
    setVisibility("hidden");
    vi.advanceTimersByTime(10_000);
    expect(tick).toHaveBeenCalledTimes(3);
    setVisibility("visible");
    vi.advanceTimersByTime(1000);
    expect(tick).toHaveBeenCalledTimes(4);
    stop();
    vi.advanceTimersByTime(5000);
    expect(tick).toHaveBeenCalledTimes(4);
  });
});

describe("every refetchInterval", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) files.push(path);
    }
  };
  walk(join(process.cwd(), "src"));

  it("says it does not run in a background tab", () => {
    const offenders = files.filter((file) => {
      const text = readFileSync(file, "utf8");
      return /refetchInterval:/.test(text) && !/refetchIntervalInBackground:\s*false/.test(text);
    });
    expect(offenders).toEqual([]);
  });
});
