// The RC state map, kept honest (RC-P04b).
//
// docs/reconciliation/STATES.md maps every interface state the RC series adds
// to tokens, helpers and components that already exist, and every later prompt
// builds from it. Its Keys column names them. This test reads that column and
// fails if a name stops resolving, so a renamed token or a deleted helper
// breaks here, at the map, rather than in the next prompt that trusts it.
//
// A key is `a.b` (a member of an export), `name` (an export), or `name("arg")`
// (a style helper, which is called and must return a style).

import { readFileSync } from "node:fs";
import { Check } from "lucide-react";
import { describe, expect, it } from "vitest";
import { CategoryChip } from "@/components/brand/CategoryChip";
import { GapMarker, gapEdge } from "@/components/brand/GapMarker";
import { Plaque, plaqueState } from "@/components/brand/Plaque";
import { GalleryCard } from "@/components/gallery/GalleryCard";
import { MobileBottomNav } from "@/components/shell/MobileBottomNav";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import * as controlsModule from "./controls";
import * as elevationModule from "./elevation";
import * as focusModule from "./focus";
import * as motionModule from "./motion";
import * as radiusModule from "./radius";
import * as spaceModule from "./space";
import * as tokensModule from "./tokens";
import * as typeModule from "./type";

/** Every name the map may cite, spelled the way it cites it. */
const NAMES: Record<string, unknown> = {
  ...tokensModule,
  ...radiusModule,
  ...typeModule,
  ...focusModule,
  ...elevationModule,
  ...motionModule,
  ...spaceModule,
  ...controlsModule,
  Button,
  Dialog,
  DialogContent,
  DialogOverlay,
  CategoryChip,
  GapMarker,
  gapEdge,
  Plaque,
  plaqueState,
  GalleryCard,
  MobileBottomNav,
  Check,
};

interface Row {
  n: number;
  state: string;
  keys: string[];
}

/** The map's table rows: the number, the state, and the backticked names in the last cell. */
function rows(markdown: string): Row[] {
  return markdown
    .split("\n")
    .filter((line) => /^\|\s*\d+\s*\|/.test(line))
    .map((line) => {
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      const keys = [...cells[cells.length - 1].matchAll(/`([^`]+)`/g)].map((match) => match[1]);
      return { n: Number(cells[0]), state: cells[1], keys };
    });
}

/** What a key names, or undefined when it names nothing. */
function resolve(key: string): unknown {
  const call = /^(\w+)\((.*)\)$/.exec(key);
  if (call) {
    const helper = NAMES[call[1]];
    if (typeof helper !== "function") return undefined;
    const args = call[2] ? (JSON.parse(`[${call[2]}]`) as unknown[]) : [];
    return (helper as (...args: unknown[]) => unknown)(...args);
  }
  const [head, ...path] = key.split(".");
  return path.reduce<unknown>(
    (value, part) =>
      value !== null && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined,
    NAMES[head],
  );
}

const ROWS = rows(readFileSync("docs/reconciliation/STATES.md", "utf8"));
const CITATIONS = ROWS.flatMap((row) => row.keys.map((key) => ({ n: row.n, state: row.state, key })));

describe("the RC state map", () => {
  it("maps the 22 states, numbered in order", () => {
    expect(ROWS.map((row) => row.n)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1));
  });

  it("names at least one real key for every state", () => {
    expect(ROWS.filter((row) => row.keys.length === 0).map((row) => row.state)).toEqual([]);
  });

  it.each(CITATIONS)("row $n ($state) cites $key, which exists", ({ key }) => {
    expect(resolve(key), `${key} resolves to nothing`).toBeTruthy();
  });
});
