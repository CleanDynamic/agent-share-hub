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
