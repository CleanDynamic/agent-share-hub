// buildgallery.ai — the token accessor.
//
// THIS IS THE ONLY THEME MODULE A COMPONENT IMPORTS. `primitives.ts` and
// `semantics.ts` describe the system; this describes how to spend it.
//
// Styling in this codebase is applied inline, because Tailwind's generated
// utilities override hand-written classes at build time. So every member of `t`
// is a `var(--token)` string, ready to drop into a style object:
//
//   import { t } from "@/lib/theme/tokens";
//
//   <article style={{
//     background: t.glass,
//     border: `1px solid ${t.glassBorder}`,
//     color: t.text,
//   }}>
//     <span style={{ color: t.text2 }}>confirmed 3 days ago</span>
//   </article>
//
// Because the value is a `var()` reference rather than a resolved colour, a
// surface written this way follows the theme with no re-render: the switch is
// one attribute on <html data-theme="…"> and nothing else changes.
//
// NAMING. CSS custom properties are kebab-case and JavaScript members cannot
// be, so each name is camel-cased and nothing else: `--glass-2` is `t.glass2`,
// `--on-action` is `t.onAction`, `--cat-breakage` is `t.catBreakage`. The
// mapping is mechanical, so if you know the token you know the member.
//
// The shape of `t` is derived from TOKEN_NAMES, so it cannot drift from the
// semantic layer: add a token there and it appears here, typed, or the build
// fails. Reaching past `t` into `semantics.ts` or `primitives.ts` from a
// component defeats the theme switch — a resolved hex does not follow the
// attribute. Don't.

import { TOKEN_NAMES, type TokenName } from "./semantics";

export type { TokenName };
export { TOKEN_NAMES };

/** `"on-action"` → `"onAction"`. Mirrors the runtime transform below. */
type CamelCase<S extends string> = S extends `${infer Head}-${infer Rest}`
  ? `${Head}${Capitalize<CamelCase<Rest>>}`
  : S;

/** Every token, camel-cased, valued as the `var()` reference to itself. */
export type TokenAccessor = {
  readonly [K in TokenName as CamelCase<K>]: `var(--${K})`;
};

const camel = (name: string) => name.replace(/-(.)/g, (_, c: string) => c.toUpperCase());

export const t = Object.fromEntries(
  TOKEN_NAMES.map((name) => [camel(name), `var(--${name})`]),
) as TokenAccessor;

/**
 * The same reference, looked up by its CSS name. For the cases where the token
 * is decided at runtime rather than written down — a part chip picking
 * `cat-${category}`, say — where `t.catInstruction` cannot be spelled out.
 */
export const tokenVar = (name: TokenName): `var(--${TokenName})` => `var(--${name})`;

/**
 * One token at a fraction of its opacity, as a ground.
 *
 * WHY color-mix RATHER THAN AN rgba() STRING. A semantic token is a
 * `var(--name)` reference, not a hex, so there are no channels to take apart at
 * author time — and the whole point of the reference is that its value changes
 * with `<html data-theme>`. `color-mix` defers the blend to the browser, which
 * is the only place both facts are known at once.
 *
 * It exists because THREE surfaces need the same low-alpha `--action` ground for
 * a selected row — the compose tray, the node tree and the inspector — and three
 * hand-written `color-mix` strings are three chances to pick a different
 * percentage for one state. The deprecated `hexToRgba` in
 * `src/components/build/tokens.ts` emits exactly this for a token input; this is
 * that behaviour under a name new code may import.
 *
 * Clamped and rounded to a tenth of a percent: `color-mix` rejects a negative or
 * >100 percentage outright, and an unrounded float prints sixteen digits into
 * the style attribute for no gain.
 */
export function tokenAlpha(name: TokenName, alpha: number): string {
  const percent = Math.round(Math.min(Math.max(alpha, 0), 1) * 1000) / 10;
  return `color-mix(in srgb, var(--${name}) ${percent}%, transparent)`;
}

/**
 * The same blend for a colour that arrives as a STRING rather than as a token
 * name — a `var(--x)` reference already pulled out of a constant, or a hex from
 * a column the database still stores.
 *
 * WHY THIS EXISTS (BG-P28b). Six gamification token modules each shipped their
 * own `withAlpha(hex, alpha)` that parsed the hex by hand. Repointing those
 * modules turned every one of their constants into a `var(--token)` string, at
 * which point a hand-rolled hex parser produces `rgba(NaN, NaN, NaN, a)` and
 * the tint disappears — or, with the usual `return hex` fallback, hands the
 * caller the hue AT FULL STRENGTH, so a 6% wash becomes a solid panel with
 * unreadable text on it. Every one of those six now delegates here.
 *
 * `color-mix` defers the blend to the browser, which is the only place both the
 * alpha and the theme's current value for the token are known at once. The hex
 * branch stays because `node_types.colour` still holds hexes; anything that is
 * neither a token reference nor a hex returns unchanged.
 */
export function colourAlpha(colour: string, alpha: number): string {
  const input = (colour ?? "").trim();

  const hex = /^#?([0-9a-f]{6})$/i.exec(input);
  if (hex) {
    const int = parseInt(hex[1], 16);
    return `rgba(${(int >> 16) & 255},${(int >> 8) & 255},${int & 255},${alpha})`;
  }

  if (/^var\(--[a-z0-9-]+\)$/i.test(input)) {
    const percent = Math.round(Math.min(Math.max(alpha, 0), 1) * 1000) / 10;
    return `color-mix(in srgb, ${input} ${percent}%, transparent)`;
  }

  return colour;
}
