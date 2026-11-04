// UX-02 P7: one way to add at each level. The Build header's Add (`data-testid="sandbox-add"`) is gone from the composer: no source
// file of the composer draws it. (The view is rendered without it in SandboxView.test.tsx, on a computer and a phone.)

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const DIR = path.resolve(__dirname);

describe("UX-02 P7 · no header Add in the composer", () => {
  it("no composer source file draws sandbox-add", () => {
    const sources = fs.readdirSync(DIR).filter((name) => /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !/TestSupport|Harness/.test(name));
    expect(sources.length).toBeGreaterThan(50);
    const drawing = sources.filter((name) => fs.readFileSync(path.join(DIR, name), "utf8").includes('"sandbox-add"'));
    expect(drawing).toEqual([]);
  });
});
