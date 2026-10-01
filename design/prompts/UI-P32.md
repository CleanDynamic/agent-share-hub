# UI-P32 — Page: Import and compose (the workspace)

Follow `design/RULES.md` (§7).

**Goal.** `/import` as the reference — a working surface: **flat panels, no glass**, inside the normal header and footer. Compose routes adopt the same grammar.

**Read first.** `pages/ImportPage.tsx` (`/import`), `ComposeNew.tsx` (`/compose/new`), `Compose.tsx` (`/compose/:buildId`), `src/components/compose/*`, `src/lib/build/intake.ts` and `imports.ts` (the proposal type, the secret finding, keep-all, and the function that turns a proposal into a draft — use their real names, §8), the `import_sessions` table, HANDOFF §5.5.

**Reference.** `desktop/{noon,dusk}/import.html`, `mobile/{noon,dusk}/import.html`.

**Desktop.** Grid `360px minmax(0, 1fr) 330px`, filling. Every panel is `Panel variant="flat"`.
- **Transcript** (padding 14px 16px): `PanelHead` "Transcript" / "{source} · {n} turns · via connector" (drop "via connector" when not), right `Eyebrow` "Source". Turns 12px below, a column with gap 8: each bubble max-width 82%, padding 9px 12px, radius 12, 1px `--line`, Figtree 12px, line-height 1.45, `--text`; the viewer's turns aligned right on `--recess`, the assistant's aligned left on `--turn`. A `SecretFinding` is shown only in redacted form (never the secret) as an inline mark: `--secret-fill`, `--cat-breakage`, DM Mono 11px, padding 0 4px, radius 4.
- **What we found** (padding 14px 16px): `PanelHead` "What we found" / "Keep what belongs in the record", right a secondary 30/12 "Keep everything" → `keepEverything()`. When secrets were found, a banner 12px above and below: padding 12px 14px, radius 12, 1.5px dashed `--cat-breakage`, a row with gap 10: `ShieldAlert` 18 `--cat-breakage`; "A live API key was found in turn {n}" (Figtree 13px 600) over "It has been removed from every part. Nothing with it will be saved." (Figtree 12px `--text2`). Then `Eyebrow` "Parts · {kept} of {n} kept" and one `<label>` per `ProposedNode`: height 38, padding 0 10px, 1px bottom `--hairline`, gap 10: a checkbox (`accent-color: var(--action)`), its `CategoryChip`, the name (Figtree 13px; `--text` when kept, `--text2` when not). Then, 12px below, `Eyebrow` "Events · {kept} kept" and one row per `ProposedEvent`: height 34, checkbox, the kind (DM Mono 10px, 70px wide, colour by `EventKind` as in `Timeline`, caps), the text (Figtree 12px).
- **Right column**, gap 12:
  1. "How it will hang" (padding 14px 16px): `Eyebrow`; a `--recess` well 6px below (padding 10, radius 12) holding a live build card preview (cover 96, title 18) with the lamp spacer and no lamp — nothing is reproduced yet.
  2. Completeness (fills; padding 14px 16px): a row `Eyebrow` "Completeness" / DM Mono 20px score; `StripedBar` `--lit` 12 with the 60 and gallery ticks (margin 10px 0 4px); DM Mono 10px `--label` "PUBLISH 60 ✓" (✓ once ≥ 60) / "GALLERY {t}"; the `MissingItem.copy` checklist: rows 26px, gap 9, Figtree 12px (`--text` done, `--text2` not), each with a 16×16 box, radius 5 — done: `--evidence` fill with a `Check` 11px in `--on-evidence` (stroke 2.6); not done: 1.5px `--line` border; then 12px below the primary "Create the draft" with `ArrowRight` → `materialiseProposal()` / `claimImport()`.
- `/compose/new` and `/compose/:buildId` move into the site frame with the same flat grammar (flat panels, hairlines, `--recess` wells, the same completeness panel). They stay `React.lazy` and out of the initial bundle.

**Mobile** (390×1360), gap 12 — flat, no glass:
1. Step chips in a `ScrollRow` (gap 6): height 34, padding 0 12px, radius 10, Figtree 13px 500: done `--evidence` / `--on-evidence`; current `--text` / `--on-text`; later 1px `--line`, `--text2`. "1 · Source", "2 · Keep", "3 · Check", "4 · Hang".
2. Heading: `Eyebrow` "Import · from a chat", `h1` `type.display(32)` "What we found", Figtree 14px "{n} turns from {source}, via the connector."
3. The secret banner (when found): padding 14, radius 14, dashed breakage, background `--flat`, `ShieldAlert` 20, title Figtree 14px 600, text 13px.
4. Parts (flat, padding 14px): `PanelHead` "Parts · {kept} of {n} kept", right ghost 32/12 "Keep all"; rows min-height 48, padding 0 4px, gap 12: a 20×20 checkbox, the name (Figtree 15px, grows), the chip on the right.
5. Events (flat): rows min-height 46.
6. Completeness (flat, padding 14px 16px): score DM Mono 22px; the bar; labels 10px; checklist rows min-height 32, Figtree 14px, 18×18 boxes (radius 6, check 12).
7. A sticky action bar, `bottom: calc(92px + env(safe-area-inset-bottom))` (above the dock): padding 10, radius 16, `--solid`, 1px `--line`, `--shadow-card`, gap 8: ghost 48/14 "Discard" and a full-width 48/15 primary "Create the draft".
Phones do not show the transcript (as drawn).

**Done when.** The four Import boards compare within 0.04; an import can be reviewed and turned into a draft end to end on both viewports; no panel on these routes has `--glass` or a blur; compose and import stay out of the main bundle (check the build output).

**Commit.** `UI-P32: Import and compose in the site frame`
