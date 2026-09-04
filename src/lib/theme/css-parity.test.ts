import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TOKEN_NAMES, exhibition, dusk } from "./semantics";

const css = readFileSync("src/index.css", "utf-8");
const block = (sel: string) => {
  const i = css.indexOf(sel);
  const open = css.indexOf("{", i);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
};
const parse = (sel: string) => {
  const out: Record<string, string> = {};
  for (const line of block(sel).split("\n")) {
    const m = /^\s*--([a-z0-9-]+):\s*(.+);\s*$/.exec(line);
    if (m) out[m[1]] = m[2];
  }
  return out;
};

describe("index.css mirrors semantics.ts", () => {
  it("exhibition (bare :root and [data-theme=exhibition])", () => {
    const got = parse(':root,\n:root[data-theme="exhibition"]');
    expect(Object.keys(got).sort()).toEqual([...TOKEN_NAMES].sort());
    for (const n of TOKEN_NAMES) expect([n, got[n]]).toEqual([n, exhibition[n]]);
  });
  it("dusk", () => {
    const got = parse(':root[data-theme="dusk"]');
    expect(Object.keys(got).sort()).toEqual([...TOKEN_NAMES].sort());
    for (const n of TOKEN_NAMES) expect([n, got[n]]).toEqual([n, dusk[n]]);
  });
});
