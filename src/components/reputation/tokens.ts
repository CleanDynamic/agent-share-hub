// ─────────────────────────────────────────────────────────────────────────────
// DELIBERATELY NOT REPOINTED — BG-P29. THIS SURFACE IS NOT MOUNTED.
//
// Every value below is a literal struck for one dark room, and it stays that
// way. BG-P29 swept the rest of the codebase onto `var(--token)` references and
// skipped this folder on purpose, because nothing renders it: no route reaches
// any component here, and no file outside this folder imports one. The sweep's
// compliance guard — `src/lib/theme/compliance.test.ts` — allowlists this file
// by path for exactly that reason, and names this note as the justification.
//
// WHY SKIPPED RATHER THAN REPOINTED. A mechanical recolour of a surface nobody
// has designed yet is a liability, not an asset: it would look finished, it
// would carry BG-P25's gamification mapping into decisions nobody has made, and
// the next session would have to unpick it before it could think. The two-theme
// system is what this surface should be designed AGAINST, from the tokens
// outward — not something it should be retrofitted into after the fact.
//
// WHY SKIPPED RATHER THAN DELETED. The components are complete and coherent;
// what is missing is a route and a decision about where this belongs. Deleting
// working code to satisfy a lint count is the wrong trade.
//
// SO: IF YOU ARE THE SESSION THAT MOUNTS THIS, START FROM `buildgallery-theme`
// AND `src/lib/theme/tokens.ts`. Do not repoint the values below one by one —
// read the surface, decide what each element MEANS, and spend the semantic
// token that names that job. Then delete this note and this file's entry in the
// compliance allowlist. The four gamification surfaces that ARE live
// (`profile-game`, `progress/gamification`, `progress/xp-kit`,
// `challenges/quest`) share one mapping, documented at the head of
// `src/components/profile-game/tokens.ts`; agree with it or argue with it, but
// do not invent a fifth answer.
// ─────────────────────────────────────────────────────────────────────────────

// Shared design tokens for the Reputation UI.
// Teal is the reputation colour language; orange is XP/level.

export const tokens = {
  // surface tiers
  shell: "rgba(52,52,66,0.55)",
  card: "rgba(68,68,84,0.60)",
  input: "rgba(82,82,100,0.60)",

  // borders
  borderSoft: "0.5px solid rgba(255,255,255,0.10)",
  borderStrong: "0.5px solid rgba(255,255,255,0.14)",

  // text
  text: "rgba(255,255,255,0.92)",
  textMuted: "rgba(255,255,255,0.55)",
  textFaint: "rgba(255,255,255,0.32)",
  locked: "rgba(255,255,255,0.25)",

  // brand / semantic
  orange: "#E8571A",
  orangeGradient: "linear-gradient(135deg, #E8571A 0%, #C44514 100%)",
  teal: "#2EC4B6",
  amber: "#F59E0B",
  green: "#22C55E",

  // teal shades for stacked contribution bars
  tealShades: ["#2EC4B6", "#27A89C", "#1F8C82", "#176F68"],

  // radii
  radiusPanel: 14,
  radiusCard: 10,
  radiusPill: 100,

  // glass
  glass: {
    backdropFilter: "blur(16px) saturate(160%)",
    WebkitBackdropFilter: "blur(16px) saturate(160%)",
  },
} as const

export const fontSans =
  "'Figtree', system-ui, sans-serif"
export const fontMono =
  "var(--font-jetbrains-mono), 'JetBrains Mono Fallback', monospace"
