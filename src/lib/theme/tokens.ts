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
