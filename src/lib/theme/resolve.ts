// A token's value with every `var(--other)` followed to the end, so a test can measure `--glass` (→ `--module` →
// `#1E1E21`) rather than a reference. The tables are the theme blocks of src/index.css, as semantics.ts and
// elevation.ts mirror them (css-parity.test.ts holds the three together).

import { elevationThemes } from "./elevation";
import { themes, TOKEN_NAMES, type TokenName } from "./semantics";

export type ThemeKey = "noon" | "dusk";

const table = (theme: ThemeKey): Readonly<Record<string, string>> => ({ ...themes[theme], ...elevationThemes[theme] });

/** The value of `--name` in `theme`, references followed. Throws on a name the theme does not declare and on a cycle. */
export function resolveToken(theme: ThemeKey, name: string): string {
  const values = table(theme);
  let current = name;
  for (let hops = 0; hops < 8; hops++) {
    const value = values[current];
    if (value === undefined) throw new Error(`--${current} is not declared by the ${theme} theme`);
    const ref = /^var\(--([a-z0-9-]+)\)$/.exec(value);
    if (!ref) return value;
    current = ref[1];
  }
  throw new Error(`--${name} does not resolve: a var() cycle in the ${theme} theme`);
}

/** One declared value, unresolved. */
export const declared = (theme: ThemeKey, name: string): string | undefined => table(theme)[name];

/** Every token of a theme with its references followed, for measuring. */
export const resolvedTheme = (theme: ThemeKey): Record<TokenName, string> =>
  Object.fromEntries(TOKEN_NAMES.map((name) => [name, resolveToken(theme, name)])) as Record<TokenName, string>;
