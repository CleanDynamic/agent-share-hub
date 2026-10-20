// The contrast maths the theme tests measure with (moved here from contrast.test.ts for CA-06 P4, which needs it at
// run time to choose how strongly a maker's colour fills a link). Pure: colours in, numbers out.

/** Red, green, blue (0 to 255) and alpha (0 to 1). */
export type Rgba = [number, number, number, number];

/** `#RRGGBB`, `rgb(…)` or `rgba(…)`. Throws on anything else. */
export function parse(colour: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour.trim());
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgb = /^rgba?\(([\d.]+),([\d.]+),([\d.]+)(?:,([\d.]*))?\)$/.exec(colour.replace(/\s/g, ""));
  if (!rgb) throw new Error(`unparseable colour: ${colour}`);
  return [+rgb[1], +rgb[2], +rgb[3], rgb[4] === undefined ? 1 : +rgb[4]];
}

/** Source-over composite. A translucent token has no ratio until it has a ground. */
export function over(fg: string, bg: string): string {
  const f = parse(fg);
  const b = parse(bg);
  const [r, g, bl] = [0, 1, 2].map((i) => Math.round(f[i] * f[3] + b[i] * (1 - f[3])));
  return `rgb(${r},${g},${bl})`;
}

/** WCAG 2.x relative luminance. Throws on a translucent input: composite first. */
export function luminance(colour: string): number {
  const [r, g, b, a] = parse(colour);
  if (a !== 1) throw new Error(`luminance needs an opaque colour, got ${colour}`);
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** The WCAG contrast ratio of two opaque colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
