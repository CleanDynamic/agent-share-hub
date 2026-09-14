/* BG-P29 — the guard that stops the sweep from silently undoing itself.
 *
 * This prompt moved 1016 raw colour literals across 152 files onto the token
 * layer, so that ONE place decides every colour in the product: the two theme
 * blocks in `src/index.css`, generated from `semantics.ts` and spent through
 * `tokens.ts`. That property is worth exactly as much as the thing defending
 * it. Without an assertion, the next surface prompt reaches for a hex because
 * a hex is what its reference screenshot gave it, nobody notices in review,
 * and the theme switch quietly stops reaching part of the page — which is the
 * failure the whole two-theme system exists to prevent, and the one BG-P28
 * spent a prompt undoing on the legacy pages.
 *
 * WHAT COUNTS AS A VIOLATION. A hex literal (`#RGB`, `#RRGGBB`, `#RRGGBBAA`)
 * or an `rgb()`/`rgba()` with hardcoded channels, in a `.ts`, `.tsx` or `.css`
 * file under `src/`, outside the allowlist below.
 *
 * `rgba(var(--x), …)` and `color-mix(in srgb, var(--x) …)` are NOT violations:
 * both defer the value to the browser, which is the only place the theme's
 * current answer for `--x` is known. `color-mix` is how this codebase expresses
 * a token at an alpha, and `tokenAlpha`/`colourAlpha` in `tokens.ts` are how it
 * is built.
 *
 * COMMENTS ARE STRIPPED BEFORE SCANNING, and that is deliberate rather than
 * lenient. Most of the repointed modules document what each value USED to be —
 * "Was `rgba(52,52,66,0.55)`", "#E8571A → --action" — and that provenance is
 * the most useful thing in them: it is how a reader checks the mapping was
 * right, and how a future prompt knows what it is looking at. A hex in a
 * comment is documentation; a hex in a declaration is a colour the browser
 * paints. Only the second is a defect, so only the second is scanned.
 *
 * HOW TO FIX A FAILURE, in the order the theme's own rules put them:
 *   1. Spend the semantic token that names the JOB — `t.text2` for quiet ink,
 *      `t.recess` for an inset surface, `t.line` for a hairline, `t.catData`
 *      for a data part. `src/lib/theme/tokens.ts` is the only module a
 *      component imports.
 *   2. Need it at an alpha? `tokenAlpha("action", 0.12)`, never a hand-written
 *      rgba() and never a `${colour}1f` suffix — see the note in
 *      `src/pages/Notifications.tsx` for why the suffix cannot work.
 *   3. Need a shadow? `--elev-raised` or `--elev-overlay`. They are defined
 *      per theme because a shadow on a light ground and a shadow on a dark
 *      ground are not the same object.
 *   4. No token names what you need? ADD ONE — to `TOKEN_NAMES`, to both theme
 *      objects in `semantics.ts`, and to all three `:root` blocks in
 *      `index.css`, which `css-parity.test.ts` then holds you to. Do not
 *      borrow a token whose value happens to be right today, and do not
 *      borrow one of the nine `--cat-*` hues for anything that is not a part
 *      category.
 *   5. Only if it is genuinely none of the above, add it below WITH A REASON.
 *      "It is a one-off" is not a reason. "It is a provider's brand mark in
 *      their own logo SVG and changing it would misrepresent them" is.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const EXTS = [".ts", ".tsx", ".css"];

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g;
/** `rgb()`/`rgba()` whose first argument is a NUMBER, i.e. hardcoded channels. */
const RAW_RGBA = /\brgba?\(\s*[0-9.]/g;

/* ────────────────────────────────────────────────────────────────────────────
   THE ALLOWLIST.

   Two shapes. A CATEGORY covers a whole class of file by path and carries one
   reason for the class — used where the justification is genuinely the same
   for every member and the set is expected to grow (a new test asserting a
   token value is fine; each one does not need its own entry). A CAPPED FILE
   names one file, its reason, and the number of literals it is allowed to
   hold — used for the one-offs, which must not grow: the cap is a ratchet, so
   a new raw value in one of these files fails even though the file is
   allowlisted.
   ──────────────────────────────────────────────────────────────────────────── */

type Category = { match: (path: string) => boolean; why: string };

const CATEGORIES: Category[] = [
  {
    why:
      "THE THEME LAYER ITSELF — tier one of two, and the one place a value is " +
      "allowed to be a value. primitives.ts names the raw colours and is " +
      "referenced by nothing but semantics.ts; elevation.ts holds the two " +
      "per-theme shadows; index.css declares the token blocks those two " +
      "generate. A sweep that emptied these would have nowhere left to put " +
      "the palette. css-parity.test.ts holds index.css to the modules.",
    match: (p) =>
      p === "src/lib/theme/primitives.ts" ||
      p === "src/lib/theme/elevation.ts" ||
      p === "src/index.css",
  },
  {
    why:
      "TESTS THAT ASSERT EXACT TOKEN VALUES. A test proving --action is " +
      "#9E4B2C on Exhibition has to spell out #9E4B2C or it is not proving " +
      "anything; the same goes for the contrast measurements, the category " +
      "table, and the fixtures that carry a stored `node_types.colour`. These " +
      "are the assertions that make the token layer checkable, so forbidding " +
      "literals here would forbid checking it.",
    match: (p) => /\.test\.[cm]?tsx?$/.test(p) || p.startsWith("src/test/"),
  },
  {
    why:
      "THE THREE UNMOUNTED GAMIFICATION FOLDERS — guilds, reputation and " +
      "leaderboards. Nothing renders them: no route reaches a component in " +
      "any of the three and nothing outside each folder imports one. BG-P29 " +
      "skipped them on purpose rather than recolouring them mechanically, " +
      "because a surface nobody has designed yet should be designed AGAINST " +
      "the two-theme system rather than retrofitted into it, and a mechanical " +
      "pass would look finished while carrying decisions nobody made. The " +
      "reasoning and the instructions for whoever mounts them are at the head " +
      "of each folder's tokens.ts. DELETE THESE THREE ENTRIES when that " +
      "happens — they are the only allowlist lines expected to disappear.",
    match: (p) =>
      p.startsWith("src/components/guilds/") ||
      p.startsWith("src/components/reputation/") ||
      p.startsWith("src/components/leaderboards/"),
  },
];

const CAPPED: Record<string, { max: number; why: string }> = {
  "src/components/auth/OAuthButtons.tsx": {
    max: 3,
    why:
      "GOOGLE'S BRAND MARK, inside its own logo SVG: #4285F4, #34A853, " +
      "#EA4335 and the red. A provider's logo is their trademark and is not " +
      "ours to theme — recolouring it would misrepresent them, and every " +
      "OAuth button on the web shows the mark as issued. The button AROUND " +
      "it is on tokens.",
  },
  "src/components/article/blocks/CodeBlock.tsx": {
    max: 5,
    why:
      "A MONACO EDITOR THEME, passed to monaco.editor.defineTheme() through " +
      "the library's JS API. Monaco resolves these into its own generated " +
      "stylesheet and cannot read a CSS custom property, so a var() here " +
      "resolves to nothing. This is the syntax-highlighting exemption the " +
      "prompt names. If the editor ever needs to follow the theme, the fix is " +
      "to define two Monaco themes and switch them from ThemeProvider — not " +
      "to put a token in this object.",
  },
  "src/components/ui/chart.tsx": {
    max: 5,
    why:
      "RECHARTS ATTRIBUTE SELECTORS, not colour declarations. These are " +
      "shadcn's own chart wrapper matching the values Recharts hardcodes into " +
      "the SVG it emits — `[&_.recharts-dot[stroke='#fff']]:stroke-transparent` " +
      "overrides that stroke precisely BECAUSE the library wrote #fff. The hex " +
      "is the selector's left-hand side; changing it stops the rule matching " +
      "and the override it exists to apply disappears.",
  },
  "src/components/article/TopToolbar.tsx": {
    max: 2,
    why:
      "THE AUTHOR'S TEXT-COLOUR PALETTE — the swatches a writer picks from to " +
      "colour a word in their own article. This is CONTENT, not chrome: the " +
      "colour is stored in the document and has to mean the same thing to " +
      "every reader, so it must NOT follow the reader's theme. A token here " +
      "would change what an author wrote when someone else flips to Dusk.",
  },
  "src/pages/dev/Kit.tsx": {
    max: 3,
    why:
      "AN INLINE SVG PLACEHOLDER, built as a data: URI. A data: URI is a " +
      "separate document and inherits nothing from the page, so a custom " +
      "property in it resolves to nothing at all. Dev-only route.",
  },
  "src/components/content-detail/AIPdfPreview.tsx": {
    max: 1,
    why:
      "BLACK INK ON A PRINTED PAGE. The note above the declaration is the " +
      "argument and it predates this prompt: a PDF preview is a printed " +
      "artefact, it renders white with black ink in both rooms, and theming " +
      "it would put Dusk's palette on paper. NOTE FOR BG-P30: the page " +
      "GROUND beside this ink is `var(--chrome-hi)`, which is #FFFFFF on " +
      "Exhibition but #CBC6E4 on Dusk — so the page does drift lavender in " +
      "the dark room, which contradicts the note. Worth settling.",
  },
  "src/components/progress/xp-kit/xp-bar.tsx": {
    max: 1,
    why:
      "A LEGIBILITY SCRIM behind text that sits over a filled progress bar. " +
      "See the note on the scrims below.",
  },
  "src/components/challenges/quest/claim-button.tsx": {
    max: 1,
    why:
      "A LEGIBILITY SCRIM behind the label on a claim button that carries an " +
      "amber glow underneath it. Same unresolved question as the other two " +
      "scrims — see the note below them.",
  },
  "src/components/ambient/ActionXpHintInner.tsx": {
    max: 1,
    why:
      "A LEGIBILITY SCRIM behind an XP hint that floats over whatever surface " +
      "raised it, which may be any route in either theme. Same unresolved " +
      "question as the other two scrims — see the note below them.",
  },
};

/* THE THREE SCRIMS, together, because they are one unresolved question rather
   than three separate exemptions.

   Each is a `text-shadow` struck from black behind text that sits over
   something the theme does not control: a filled bar, an amber glow, arbitrary
   user imagery. A scrim like that has to stay dark in BOTH rooms — it is
   propping up the text against whatever is behind it, not participating in the
   room's palette — and the token set publishes nothing for it. --porthole is
   the closest thing and is the wrong thing: it names a media WELL, and the
   theme says in as many words not to invent decorative uses for it.

   So they stay as they are, and the question goes to BG-P30, which owns
   contrast: either a scrim token joins the set, or these three sites lose the
   shadow and earn their contrast from the fill underneath. Three literals is
   the right size of debt to carry until someone measures it; guessing a token
   now would be the "borrowed because its value happens to be right today"
   mistake the semantic layer's own header warns about. */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTS.some((e) => name.endsWith(e))) out.push(full);
  }
  return out;
}

/**
 * Blank out comments and leave everything else at its original offset.
 *
 * Hand-written rather than regex-based because a regex cannot tell a `//`
 * inside a string from one that starts a comment, and `"https://…"` appears
 * all over this codebase. Tracks string literals — including template literals
 * and escapes — so a comment marker inside one is left alone, and a comment
 * containing a quote does not open a phantom string.
 */
export function stripComments(src: string, isCss: boolean): string {
  let out = "";
  let i = 0;
  let inLine = false;
  let inBlock = false;
  let quote: string | null = null;

  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1] ?? "";

    if (inLine) {
      if (c === "\n") {
        inLine = false;
        out += c;
      } else out += " ";
      i += 1;
    } else if (inBlock) {
      if (c === "*" && next === "/") {
        inBlock = false;
        out += "  ";
        i += 2;
      } else {
        out += c === "\n" ? "\n" : " ";
        i += 1;
      }
    } else if (quote) {
      out += c;
      if (c === "\\") {
        if (i + 1 < src.length) {
          out += src[i + 1];
          i += 2;
        } else i += 1;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
    } else if (c === "/" && next === "/" && !isCss) {
      inLine = true;
      out += "  ";
      i += 2;
    } else if (c === "/" && next === "*") {
      inBlock = true;
      out += "  ";
      i += 2;
    } else if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i += 1;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

type Finding = { path: string; line: number; value: string; text: string };

function scan(): Map<string, Finding[]> {
  const byFile = new Map<string, Finding[]>();
  for (const full of walk(SRC)) {
    const path = relative(ROOT, full).split(sep).join("/");
    const raw = readFileSync(full, "utf8");
    const code = stripComments(raw, path.endsWith(".css"));
    const rawLines = raw.split("\n");
    const found: Finding[] = [];
    code.split("\n").forEach((line, idx) => {
      for (const re of [HEX, RAW_RGBA]) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(line)) !== null) {
          found.push({
            path,
            line: idx + 1,
            value: m[0],
            text: (rawLines[idx] ?? "").trim().slice(0, 100),
          });
        }
      }
    });
    if (found.length) byFile.set(path, found);
  }
  return byFile;
}

const allowedCategory = (path: string) => CATEGORIES.find((c) => c.match(path));

describe("colour compliance across src/", () => {
  const byFile = scan();

  it("has no raw colour literal outside the allowlist", () => {
    const offenders = [...byFile.entries()]
      .filter(([path]) => !allowedCategory(path) && !(path in CAPPED))
      .flatMap(([, findings]) => findings);

    const report = offenders
      .map((f) => `  ${f.path}:${f.line}  ${f.value}\n      ${f.text}`)
      .join("\n");

    expect(
      offenders,
      offenders.length
        ? `\n${offenders.length} raw colour literal(s) outside the allowlist:\n${report}\n\n` +
            "Spend a token from src/lib/theme/tokens.ts, or tokenAlpha() for an " +
            "alpha, or --elev-raised/--elev-overlay for a shadow. If none of " +
            "those fit, add the token to semantics.ts. The header of this file " +
            "has the full order, and the last resort is an allowlist entry " +
            "WITH A REASON.\n"
        : undefined,
    ).toEqual([]);
  });

  it("keeps every capped one-off at or below its cap", () => {
    /* The ratchet. A file being allowlisted does not make it a place to put
       new raw colours: each entry above says how many it may hold and why, and
       a new one fails here even though the path is listed. */
    const over: string[] = [];
    for (const [path, { max, why }] of Object.entries(CAPPED)) {
      const n = byFile.get(path)?.length ?? 0;
      if (n > max) {
        const extra = byFile
          .get(path)!
          .map((f) => `      ${f.line}: ${f.value}  ${f.text}`)
          .join("\n");
        over.push(
          `  ${path} holds ${n}, capped at ${max}.\n    Why it is capped: ${why}\n${extra}`,
        );
      }
    }
    expect(over, over.length ? `\n${over.join("\n\n")}\n` : undefined).toEqual([]);
  });

  it("has no allowlist entry that has stopped doing work", () => {
    /* The other half of the ratchet, and the half that usually rots. An
       exemption for a file that no longer needs one is a standing invitation
       to put a hex back into it, so a cap that is too high fails just as
       loudly as one that is too low. Lower it, or delete the entry. */
    const stale: string[] = [];
    for (const [path, { max }] of Object.entries(CAPPED)) {
      const n = byFile.get(path)?.length ?? 0;
      if (n < max) {
        stale.push(
          `  ${path} holds ${n} but is capped at ${max} — lower the cap${
            n === 0 ? " or delete the entry; it holds none at all" : ""
          }.`,
        );
      }
    }
    expect(stale, stale.length ? `\n${stale.join("\n")}\n` : undefined).toEqual([]);
  });

  it("gives every category and every capped file a real reason", () => {
    // An entry whose justification is a shrug is an entry nobody can review.
    for (const c of CATEGORIES) expect(c.why.length).toBeGreaterThan(80);
    for (const [path, { why }] of Object.entries(CAPPED)) {
      expect(why.length, `${path} needs a real reason`).toBeGreaterThan(80);
      expect(why, `${path}: "one-off" is not a reason`).not.toMatch(/^it is a one-off/i);
    }
  });

  it("does not accept a token-derived colour as a violation", () => {
    // The forms that ARE allowed everywhere, asserted so a future tightening
        // of the regexes cannot quietly start failing them.
    const legal = [
      "background: var(--recess)",
      "color: color-mix(in srgb, var(--action) 12%, transparent)",
      "border: 1px solid rgba(var(--line-rgb), 0.5)",
      "boxShadow: var(--elev-overlay)",
      "background: linear-gradient(to top, color-mix(in srgb, var(--porthole) 55%, transparent), transparent)",
    ].join("\n");
    HEX.lastIndex = 0;
    RAW_RGBA.lastIndex = 0;
    expect(legal.match(HEX)).toBeNull();
    expect(legal.match(RAW_RGBA)).toBeNull();
  });

  it("still catches a raw literal in every form it takes", () => {
    // The converse: the guard is only worth having if it fires.
    for (const bad of [
      "color: #E8571A",
      "color: #fff",
      "background: #ffffff80",
      "border: 1px solid rgba(255,255,255,0.14)",
      "background: rgb(30, 30, 40)",
      "background: rgba( 0 , 0 , 0 , .5 )",
    ]) {
      HEX.lastIndex = 0;
      RAW_RGBA.lastIndex = 0;
      expect(
        bad.match(HEX) !== null || bad.match(RAW_RGBA) !== null,
        `${bad} should be a violation`,
      ).toBe(true);
    }
  });

  it("reads a hex in a comment as documentation, not as a colour", () => {
    /* The repointed modules are full of "Was `rgba(52,52,66,0.55)`" and
       "#E8571A → --action", which is the provenance a reader needs to check
       the mapping. Scanning it would have forced the sweep to either delete
       its own reasoning or allowlist half the codebase. */
    const src = [
      "// Was `#E8571A`, the old brand primary.",
      "/* three greys: #111111, #222222, rgba(255,255,255,0.4) */",
      "const real = 'var(--action)';",
      "const url = 'https://example.com/#abc123';",
      "const stillReal = '#DEADBE';",
    ].join("\n");
    const code = stripComments(src, false);
    HEX.lastIndex = 0;
    expect(code.match(HEX)).toEqual(["#abc123", "#DEADBE"]);
    RAW_RGBA.lastIndex = 0;
    expect(code.match(RAW_RGBA)).toBeNull();
  });
});
