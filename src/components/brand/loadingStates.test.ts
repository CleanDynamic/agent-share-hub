// G26: in the site area (src/pages/site, the shell, brand) no loading state is a shimmer gradient, an opacity pulse on a
// whole block or a Loader2 spinner, and the keyframes only they used are gone from index.css.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const AREA = ["src/pages/site", "src/components/shell", "src/components/brand"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

/** Source without comments, which may name what was removed. */
const code = (file: string) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("loading states in the site area", () => {
  const files = AREA.flatMap(walk);

  it.each([
    ["a Loader2 spinner", /\bLoader2\b/],
    ["a spinning class", /animate-spin/],
    ["the shimmer", /skeletonStyle|bgShimmer|SHIMMER_MS/],
    ["a pulse on a whole block", /skeletonPulse|animate-pulse/],
    ["the character cycle", /bgLoad(Dot|Open|Small|Full|Rise)/],
  ])("use no %s", (_, pattern) => {
    expect(files.filter((file) => pattern.test(code(file)))).toEqual([]);
  });

  it("leave no keyframe in index.css that only they used", () => {
    const css = readFileSync("src/index.css", "utf8");
    for (const name of ["skeletonPulse", "bgLoadDot", "bgLoadOpen", "bgLoadSmall", "bgLoadFull", "bgLoadRise"]) expect(css).not.toContain(`@keyframes ${name}`);
  });
});
