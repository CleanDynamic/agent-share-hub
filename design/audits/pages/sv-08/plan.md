# SV-08 · Drafts: assumptions and plan

Branch: `claude/eager-einstein-3mpoa9` (the session's designated branch; the prompt names `sv-08-drafts`).

## Assumptions (checked on disk at d7c61c4, after SV-07)

- Board `design/reference/vision/dusk/drafts.html`, sample in `source/Drafts.dc.html`. Present.
- SV-02 shared pieces exist in `src/components/vision/`: `SectionHead`, `InnerTile`, `DashedSlot`, `PlainRow`, `TypeChip`, `PageFigure`. The compare harness (`e2e/audit/design-compare.spec.ts`) reads `vision/index.json`. `KitPages.tsx` has `vision-drafts` pointing at `VisionNotBuilt`; there is no `src/dev/fixtures/vision/` yet, so this prompt creates it.
- SV-03: `listDraftsWithSessions` is one request (`DRAFT_LIST_COLUMNS`, limit 50); `listEmptyDraftIds` and `removeEmptyDrafts` exist; `usePageReady("drafts", ...)` is on the page; the route table `drafts` entry has `load`, `prefetch` and `Placeholder = DraftsLoadingView` (`DraftsFrame.tsx`).
- SV-04: `PageLink`/`IntentLink` on rows, `PageArrival` swaps the Placeholder for the page.
- SV-05/SV-07: `listLibrarySessions` already names a session by `second_prompt` when the first turn is a Claude Code summary (`isSessionSummary`), so `promptLine` is right as it is. `sessionMeta` gives `<model or app> · <date>`; it lacks the tool/model split and the `in n drafts` wording (today `In n drafts`, at the end after `for <draft>`).
- Connected tools: `import_sessions` rows carry `client` and `created_at` (`SessionSummary.client`, `.createdAt`). The tile is built from the sessions the page already loads (newest first): the last import per tool. A tool that appears only on a page not yet loaded is absent until Show more; reported.
- Drafts list: the board draws 12 rows and `Show 16 more`; today all drafts (up to 50) are drawn. The view will show the first 12 and reveal the rest at once.

## Plan

- Part 1: behaviour tests against the new view (open a draft, start a new build, drop on Start, `+` on a session, drag into a draft, Show more, Remove empty drafts) -> verified by: `DraftsView.behaviour.test.tsx`, failing on the old view where the new names/structure differ.
- Part 2: restyle `DraftsView` and `DraftsFrame` to the board with the SV-02 pieces; model naming; Connected tools tile; fixture `src/dev/fixtures/vision/drafts.ts`; dev page `vision-drafts`; Placeholder = new loading state -> verified by: view tests, `routeTable`/placeholder match test, `npm run audit:pages`.
- Part 3: `npm run audit:design -- --grep "vision/dusk/drafts"` within 4%, then the checks.

## Report (Part 3)

SV-08 · Drafts: PARTIAL
- Compared boards: `vision/dusk/drafts` 3% (35,419 px) against the 4% limit. Header masked. Remaining differences: session detail lines lead with the tool (`Claude · Haiku 4.5 · 10 Oct`, the series decision, the board omits it); the grip is the app's `grip` glyph; model marks are the real marks, not letter tiles; the app header is 48 high, the board's 56.
- Tests: full suite 59 failed / 9335 passed. The same 13 files and 59 failures fail on main at d7c61c4 (AppShell, flat-shell.wide, noRail, siteFrame, onePrompt snapshot, retiredSurfaces, compliance, motion, ns-classes, rcStates, BuildPage, sv07.parts, sv03Migration). None come from SV-08. `tsc` clean, `npm run build` passes, lint clean on changed files.
- Not run: `audit:pages` (timed out in this container), `audit:perf`, `audit:themes`, `audit:contrast`, e2e tier1, phone layout check. Request rounds unchanged in code (one drafts read plus sessions alongside), not measured.
- Built beyond the board: `board` option on `SiteFrame` and the route table `frame`; `DashedSlot` passes through props.
- Behaviour change: drafts show 12 then `Show n more`.
- Connected tools is read from the loaded sessions only (first page of 100).
- Branch: `claude/eager-einstein-3mpoa9`, not `sv-08-drafts`.
- Lovable messages: none. Dead code seen: none.

What Miles needs to do: merge the pull request, Publish > Publish changes. No migration.
