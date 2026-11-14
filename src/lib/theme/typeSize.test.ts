// The seven sizes: every font size the site sets is one of these.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { typeSize } from "./type";

describe("typeSize: the seven sizes", () => {
  it("holds exactly 11, 12, 13, 14, 16, 20 and 32", () => {
    expect(Object.values(typeSize).sort((a, b) => a - b)).toEqual([11, 12, 13, 14, 16, 20, 32]);
  });

  it("names each size for its job", () => {
    expect(typeSize).toEqual({ tagline: 32, title: 20, cardTitle: 16, section: 14, body: 13, meta: 12, micro: 11 });
  });
});

/* G10: the area the type prompt set (the site's pages but the composer, the shell, the skeleton, About, API docs, and the
   shared components whose sizes it moved) sets no font size outside the seven, no weight of 600 or 700 and no hex colour.
   Each exception is named with its reason. */

const AREA = [
  "src/pages/site",
  "src/components/shell",
  "src/components/brand/Skeleton.tsx",
  "src/pages/About.tsx",
  "src/pages/ApiDocs.tsx",
  "src/components/brand/Pill.tsx",
  "src/components/brand/Plaque.tsx",
  "src/components/brand/SearchField.tsx",
  "src/components/brand/Eyebrow.tsx",
  "src/components/brand/CategoryChip.tsx",
  "src/components/brand/CardHead.tsx",
  "src/components/brand/Figure.tsx",
  "src/components/brand/Timeline.tsx",
  "src/components/brand/PartViewer.tsx",
  "src/components/brand/Row.tsx",
  "src/components/vision/TypeChip.tsx",
  "src/components/vision/InnerTile.tsx",
  "src/components/post/postControls.tsx",
  "src/components/post/PostCard.tsx",
  "src/components/gallery/FeedPost.tsx",
  "src/components/classify/ClassificationBits.tsx",
  "src/components/post/postType.ts",
  "src/components/post/PostBody.tsx",
  "src/components/brand/UnderlineTabs.tsx",
];

/** Lines allowed off the scale, by file and the text on the line, each with its reason. */
const EXCEPTIONS: readonly { file: string; has: string; why: string }[] = [
  { file: "src/components/shell/WorkspaceBar.tsx", has: "fontSize: 17,", why: "the build editor's bar: the lockup word, a logo (and the build editor is outside the type prompt)" },
  { file: "src/components/shell/WorkspaceBar.tsx", has: "fontSize: 15,", why: "the build editor's bar: its title, outside the type prompt" },
  { file: "src/components/shell/WorkspaceBar.tsx", has: "fontWeight: 600,", why: "the build editor's bar: its title and context line, outside the type prompt" },
];

/** The sign-in dialog is the one design with its own greens, its own 22px tagline and its own mono labels (design/RULES.md, "The sign-in dialog"). */
const SIGN_IN_DIALOG = new Set([
  "src/pages/site/signin/SignInDialogFrame.tsx",
  "src/pages/site/signin/codeSprites.ts",
  "src/pages/site/signin/halftoneField.ts",
  "src/pages/site/signin/signinColours.ts",
]);

function filesOf(path: string): string[] {
  const full = join(process.cwd(), path);
  if (statSync(full).isFile()) return [path];
  return readdirSync(full).flatMap((name) => filesOf(join(path, name)));
}

const SEVEN = new Set(Object.values(typeSize) as number[]);

function offences(): string[] {
  const found: string[] = [];
  const files = AREA.flatMap(filesOf).filter((file) => /\.tsx?$/.test(file) && !/\.test\./.test(file) && !file.includes("/compose/") && !SIGN_IN_DIALOG.has(file));
  for (const file of files) {
    readFileSync(join(process.cwd(), file), "utf8").split("\n").forEach((line, index) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if (EXCEPTIONS.some((e) => e.file === file && line.includes(e.has))) return;
      for (const m of line.matchAll(/fontSize["']?\s*[:=]\s*\{?([^,;}\n]+)/g)) {
        const sizes = [...m[1].matchAll(/(?<![\w.])(\d+(?:\.\d+)?)(?:px)?(?![\w.%])/g)].map((v) => Number(v[1]));
        if (sizes.some((size) => !SEVEN.has(size))) found.push(`${file}:${index + 1} size: ${line.trim()}`);
      }
      if (/fontWeight\s*:\s*["']?(600|700)\b|font-(semibold|bold)\b/.test(line)) found.push(`${file}:${index + 1} weight: ${line.trim()}`);
      if (/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F-])/.test(line)) found.push(`${file}:${index + 1} hex: ${line.trim()}`);
    });
  }
  return found;
}

describe("G10: the type prompt's area keeps to the seven sizes, 400 and 500, and tokens", () => {
  it("finds no size off the seven, no 600 or 700, and no hex, outside the named exceptions", () => {
    expect(offences()).toEqual([]);
  });

  it("catches each kind of offence, so the sweep is not passing by never looking", () => {
    const line = (text: string) => /fontSize["']?\s*[:=]\s*\{?([^,;}\n]+)/.exec(text)?.[1] ?? "";
    expect([...line("fontSize: 12.5,").matchAll(/(?<![\w.])(\d+(?:\.\d+)?)(?:px)?(?![\w.%])/g)].map((v) => Number(v[1]))).toEqual([12.5]);
    expect(/fontWeight\s*:\s*["']?(600|700)\b/.test("fontWeight: 600,")).toBe(true);
    expect(/#[0-9a-fA-F]{6}\b/.test("color: #1D1D20")).toBe(true);
  });
});
