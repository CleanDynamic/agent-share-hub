/* The code style's sprite sheet (Reference D): the five characters, pre-rendered once per theme and devicePixelRatio,
   so each frame only copies whole-pixel boxes.

   Geist Mono, weight 500, 20px, with the plain zero (OpenType ss09, glyph zero.ss09). A canvas cannot switch an
   OpenType feature on, so the sheet is drawn from an SVG image that embeds the self-hosted variable woff2 and sets
   `font-feature-settings: "ss09"` on its text (D9); the image is then copied to a canvas. It waits for
   `document.fonts.load` first. If the font cannot be had (blocked, or the image fails), the sheet is drawn with canvas
   text in the system monospace instead: the same characters, the zero as that face draws it. */

/** The characters, sparsest to densest. */
export const CODE_CHARS = [".", "o", "0", "1", "8"] as const;
export type CodeChar = (typeof CODE_CHARS)[number];

/** Reference D's colours by character. */
export const CODE_COLOURS = {
  dusk: { ".": "#3C8333", o: "#58BA71", "0": "#6BE2A0", "1": "#4FA862", "8": "#C9F6DD" },
  noon: { ".": "#7FE85C", o: "#56C93A", "0": "#3F9230", "1": "#2C6B22", "8": "#000000" },
} as const satisfies Record<"dusk" | "noon", Record<CodeChar, string>>;

/** 20px type; columns 0.6 of it (12) apart, lines 1.17 of it (23.5) apart. */
export const CODE_SIZE = 20;
export const CODE_COLUMN = 12;
export const CODE_LINE = 23.5;

const FONT_URL = "/fonts/GeistMono-Variable.woff2";
const FAMILY = "Geist Mono";
const FALLBACK = "ui-monospace, SFMono-Regular, Menlo, monospace";

export interface CodeSprites {
  sheet: HTMLCanvasElement;
  /** One cell's size in device pixels. */
  width: number;
  height: number;
  /** Which face drew the sheet. */
  face: "geist-mono" | "fallback";
}

let fontData: Promise<string | null> | null = null;

/** The woff2 as a data URL, fetched once; null when it cannot be had. */
function fontDataUrl(): Promise<string | null> {
  fontData ??= fetch(FONT_URL)
    .then((response) => (response.ok ? response.arrayBuffer() : null))
    .then((buffer) => {
      if (!buffer) return null;
      let binary = "";
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return `data:font/woff2;base64,${btoa(binary)}`;
    })
    .catch(() => null);
  return fontData;
}

function blankSheet(width: number, height: number) {
  const sheet = document.createElement("canvas");
  sheet.width = width * CODE_CHARS.length;
  sheet.height = height;
  return sheet;
}

function fallbackSheet(room: "dusk" | "noon", ratio: number, width: number, height: number): CodeSprites {
  const sheet = blankSheet(width, height);
  const ctx = sheet.getContext("2d")!;
  ctx.font = `500 ${CODE_SIZE * ratio}px ${FALLBACK}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  CODE_CHARS.forEach((char, i) => {
    ctx.fillStyle = CODE_COLOURS[room][char];
    ctx.fillText(char, i * width + width / 2, height / 2);
  });
  return { sheet, width, height, face: "fallback" };
}

/** Build the sheet for a theme at a device pixel ratio. */
export async function buildCodeSprites(room: "dusk" | "noon", ratio: number): Promise<CodeSprites> {
  const width = Math.ceil(CODE_COLUMN * ratio);
  const height = Math.ceil(CODE_LINE * ratio);
  let loaded = false;
  try {
    loaded = (await document.fonts.load(`500 ${CODE_SIZE}px "${FAMILY}"`)).length > 0;
  } catch {
    loaded = false;
  }
  const data = loaded ? await fontDataUrl() : null;
  if (!data) return fallbackSheet(room, ratio, width, height);

  const texts = CODE_CHARS.map(
    (char, i) =>
      `<text x="${i * width + width / 2}" y="${height / 2}" fill="${CODE_COLOURS[room][char]}">${char}</text>`,
  ).join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width * CODE_CHARS.length}" height="${height}">` +
    `<style>@font-face{font-family:"CodeFace";src:url(${data}) format("woff2");font-weight:100 900}` +
    `text{font-family:"CodeFace";font-weight:500;font-size:${CODE_SIZE * ratio}px;font-feature-settings:"ss09";` +
    `text-anchor:middle;dominant-baseline:central}</style>${texts}</svg>`;
  try {
    const image = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    image.src = url;
    await image.decode();
    // The embedded face can settle a moment after the image decodes: give it two frames before the copy.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    URL.revokeObjectURL(url);
    const sheet = blankSheet(width, height);
    sheet.getContext("2d")!.drawImage(image, 0, 0);
    return { sheet, width, height, face: "geist-mono" };
  } catch {
    return fallbackSheet(room, ratio, width, height);
  }
}
