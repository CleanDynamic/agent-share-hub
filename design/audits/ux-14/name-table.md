# UX-14 Part 0: every name, classified

## Assumptions (checked on disk at 571c54c)

- UX-13 has merged (`src/lib/site.ts` and `supabase/functions/_shared/site.ts` exist). Branch is current with main.
- 675 matches in src, supabase/functions, public, index.html, scripts and e2e, in about 130 files (285 of them in tests).
- WRONG: `Messages.tsx` line 157 no longer has `buildgallery.ai`. UX-13 made it `openbuilds.ai` (an address, correct as it is).
- WRONG: `neoscale_last_library_visit`, `neoscale_last_fyp_visit` and `useNavBadges.ts` do not exist. The only `neoscale` browser-storage keys on disk are `neoscale_page_ad_shown_<id>` (ContentBlockViewer) and `neoscale.layer-review.declined.` (layers.ts). The `bg-…` keys are an abbreviation, not the name, and stay.
- WRONG: the repo sends no email. There is no sender name or email body in `supabase/`; auth emails are templates in the Supabase dashboard, outside the repo. Reported, not changed.
- WRONG: the extractor files are `BUILDGALLERY_EXTRACTOR.md` and `NEOSCALE_EXTRACTOR.md`, and there are two compiler files too (`BUILDGALLERY_COMPILER.md`, `NEOSCALE_COMPILER.md`). The prompt names only the extractors. The compiler pair merges the same way, into `OPENBUILDS_COMPILER.md` (same reason, same two old names).
- The connector's tests (`supabase/functions/mcp/*.test.ts`) are Deno tests and Deno is not installed here, so they are edited but not run. The tool-name check is a Vitest source scan so it does run.
- Extra names found beyond the prompt's list: the resource URI `buildgallery://node-types` and name `buildgallery_node_types`, the drag type `application/x-buildgallery-prompt`, `neoscale.ai` in the slug preview in `PublishMetadataForm.tsx`, `@neoscaleai` / `hello@neoscale.ai` in About, and `neoscaleai.com`-era handles. Rules below.

## Plan

- Part 1: `SITE_NAME` in both site.ts files -> verified by: Vitest on both values and that they agree.
- Part 2: lockup, SeoHead, index.html -> verified by: lockup, SeoHead and index.html tests, header screenshots.
- Part 3: shown copy page by page -> verified by: each area's existing tests under the new name.
- Part 4: connector tools, Build File, storage keys, PDFs -> verified by: tool-name list test, import/export tests, grep.
- Part 5: guard test `src/test/siteName.test.ts` -> verified by: passes on the branch, fails on `Welcome to buildgallery`.
- Part 6: full checks and screenshots.

## Left, unsure (identifier or an external handle, left as it is)

- `buildgallery://node-types` and `buildgallery_node_types` (connector resource URI and name): not in the prompt's tool list, and a resource id is an identifier.
- `application/x-buildgallery-prompt` (drag type): an internal identifier, never shown.
- `@neoscaleai`, `twitter.com/neoscaleai`, `hello@neoscale.ai` in About: an account and a mailbox that exist outside the repo. Miles decides.
- `bg-theme` and other `bg-…` storage keys: abbreviation, not the name.
- `src/pages/dev/*` and `src/dev/fixtures/*` (a catalogue page, a board and a fixture file name): dev-only, never shown to a visitor.

## Table

Generated from `grep -rniE "buildgallery|build gallery|neoscale"` over src, supabase/functions, public, index.html, scripts, e2e.

| file:line (at 571c54c) | match | verb | outcome |
|---|---|---|---|
| src/components/SeoHead.tsx:6 | buildgallery | Rename (shown to a person) | changed |
| src/components/SeoHead.tsx:22 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| src/components/ContentBlockViewer.tsx:1431 | neoscale | Rename (identifier only Miles used) | changed |
| src/components/ui/button.tsx:116 | neoscale | Keep (history: names a skill) | left as it was |
| src/components/ui/input.tsx:38 | neoscale | Keep (history: names a skill) | left as it was |
| src/components/routing/RouteBoundary.tsx:15 | neoscale | Keep (history: names a skill) | left as it was |
| src/components/auth/AuthShell.tsx:21 | buildgallery | History / comment (left) | left as it was |
| src/components/auth/AuthShell.tsx:107 | buildgallery | Rename (shown to a person) | changed |
| src/components/auth/AuthEmailSuccessCard.tsx:66 | buildgallery | Rename (shown to a person) | changed |
| src/components/auth/AuthEmailSuccessCard.tsx:71 | buildgallery | Rename (shown to a person) | changed |
| src/components/auth/OAuthButtons.tsx:13 | buildgallery | History / comment (left) | left as it was |
| src/components/auth/AuthButton.tsx:31 | neoscale | Keep (history: names a skill) | left as it was |
| src/components/auth/AuthCallbackCard.tsx:60 | buildgallery | Rename (shown to a person) | changed |
| src/components/auth/authPaint.test.tsx:72 | buildgallery | Test: follows the code it asserts | changed |
| src/components/social/Comments.tsx:30 | neoscale | Keep (history: names a skill) | left as it was |
| src/components/social/Comments.tsx:35 | neoscale | Keep (history: names a skill) | left as it was |
| src/components/social/EngagementRow.tsx:7 | buildgallery | Keep (history: names a skill) | left as it was |
| src/components/social/EngagementRow.tsx:33 | buildgallery | Keep (history: names a skill) | left as it was |
| src/components/social/EngagementRow.tsx:42 | neoscale | Keep (history: names a skill) | left as it was |
| src/components/moderation/ReportDialog.tsx:13 | neoscale | Keep (history: names a skill) | left as it was |
| src/components/brand/Lockup.tsx:16 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| src/components/brand/Lockup.tsx:17 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| src/components/brand/Lockup.tsx:46 | buildgallery | Rename (shown to a person) | changed |
| src/components/brand/Lockup.tsx:52 | buildgallery | Rename (shown to a person) | changed |
| src/components/brand/identity.test.tsx:61 | buildgallery | Test: follows the code it asserts | changed |
| src/components/brand/identity.test.tsx:67 | buildgallery | Test: follows the code it asserts | changed |
| src/components/library/AddToCollectionDialog.tsx:12 | neoscale | Keep (history: names a skill) | left as it was |
| src/components/profile/MakerFigures.tsx:13 | buildgallery | Keep (history: names a skill) | left as it was |
| src/components/trophies/BadgeMark.test.tsx:3 | buildgallery | Keep (history: names a skill) | left as it was |
| src/components/trophies/BadgeMark.tsx:3 | buildgallery | Keep (history: names a skill) | left as it was |
| src/components/trophies/badgeCatalogue.test.ts:183 | neoscale | Test: follows the code it asserts | left as it was |
| src/components/publish/PublishMetadataForm.tsx:400 | neoscale | Rename (shown to a person) | changed |
| src/components/publish/PublishMetadataForm.tsx:401 | neoscale | Rename (shown to a person) | changed |
| src/components/compose/CoverStrip.test.tsx:219 | buildgallery | Test: follows the code it asserts | changed |
| src/components/compose/CoverStrip.tsx:97 | buildgallery | Rename (shown to a person) | changed |
| src/components/compose/PublishControl.tsx:24 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/components/compose/ComposeFrame.tsx:4 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/components/compose/useBuildFileDrop.ts:137 | neoscale | Rename (identifier only Miles used) | changed |
| src/components/compose/LayerReview.tsx:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/components/compose/LayerReview.tsx:475 | buildgallery | Rename (shown to a person) | changed |
| src/components/compose/LayerReview.tsx:503 | buildgallery | Rename (shown to a person) | changed |
| src/components/compose/WaitingImports.tsx:3 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/components/compose/WaitingImports.tsx:222 | buildgallery | Rename (shown to a person) | changed |
| src/components/compose/fields/ListField.tsx:106 | NeoScale | Rename (shown to a person) | changed |
| src/components/compose/LayerReview.test.tsx:180 | buildgallery | Test: follows the code it asserts | changed |
| src/components/compose/LayerReview.test.tsx:221 | buildgallery | Test: follows the code it asserts | changed |
| src/components/compose/LayerReview.test.tsx:235 | buildgallery | Test: follows the code it asserts | changed |
| src/components/compose/LayerReview.test.tsx:280 | buildgallery | Test: follows the code it asserts | changed |
| src/components/compose/LayerReview.test.tsx:393 | buildgallery | Test: follows the code it asserts | changed |
| src/components/compose/ComposeTopBar.tsx:35 | neoscale | Keep (history: names a skill) | left as it was |
| src/components/progress/LitBar.tsx:3 | buildgallery | Keep (history: names a skill) | left as it was |
| src/components/progress/ResetNote.tsx:10 | buildgallery | Keep (history: names a skill) | left as it was |
| src/components/progress/ResetNote.tsx:34 | buildgallery | Rename (shown to a person) | changed |
| src/components/progress/ResetNote.test.tsx:126 | neoscale | Test: follows the code it asserts | left as it was |
| src/components/progress/BadgesSection.tsx:6 | buildgallery | Keep (history: names a skill) | left as it was |
| src/components/progress/ProgressSection.tsx:9 | buildgallery | Keep (history: names a skill) | left as it was |
| src/components/progress/ProgressSection.tsx:15 | buildgallery | Keep (history: names a skill) | left as it was |
| src/components/connect/ConnectorGuide.tsx:61 | buildgallery | Rename (shown to a person) | changed |
| src/components/connect/ConnectorGuide.tsx:65 | buildgallery | Rename (shown to a person) | changed |
| src/components/connect/ConnectorGuide.tsx:74 | buildgallery | Rename (shown to a person) | changed |
| src/components/connect/ConnectorGuide.tsx:96 | buildgallery | Rename (shown to a person) | changed |
| src/components/connect/ConnectorGuide.tsx:112 | buildgallery | Rename (shown to a person) | changed |
| src/components/connect/ConnectorGuide.tsx:118 | buildgallery | Rename (shown to a person) | changed |
| src/components/connect/connectorGuide.test.tsx:30 | buildgallery | Test: follows the code it asserts | changed |
| src/components/connect/ConnectorDialogView.tsx:93 | buildgallery | Rename (shown to a person) | changed |
| src/components/shell/WorkspaceBar.test.tsx:80 | buildgallery | Test: follows the code it asserts | changed |
| src/components/shell/WorkspaceBar.tsx:14 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/components/shell/WorkspaceBar.tsx:32 | buildgallery | Keep (history: names a skill) | left as it was |
| src/components/shell/WorkspaceBar.tsx:55 | neoscale | Keep (history: names a skill) | left as it was |
| src/components/shell/WorkspaceBar.tsx:162 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/components/shell/WorkspaceBar.tsx:338 | buildgallery | Rename (shown to a person) | changed |
| src/components/shell/breadcrumbFooter.test.tsx:96 | buildgallery | Test: follows the code it asserts | changed |
| src/components/shell/breadcrumbFooter.test.tsx:174 | buildgallery | Test: follows the code it asserts | changed |
| src/components/shell/breadcrumbFooter.test.tsx:178 | buildgallery | Test: follows the code it asserts | changed |
| src/components/shell/mobileChrome.test.tsx:65 | buildgallery | Test: follows the code it asserts | changed |
| src/components/shell/mobileChrome.test.tsx:147 | buildgallery | Test: follows the code it asserts | changed |
| src/components/shell/siteHeader.test.tsx:120 | buildgallery | Test: follows the code it asserts | changed |
| src/components/shell/SiteFooter.tsx:38 | buildgallery | History / comment (left) | left as it was |
| src/components/shell/SiteFooter.tsx:76 | buildgallery | Rename (shown to a person) | changed |
| src/components/gallery/CardThread.tsx:11 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/components/feed-card.tsx:270 | neoscale | Keep (history: names a skill) | left as it was |
| src/components/messages/BuildShareCard.tsx:6 | buildgallery | Keep (history: names a skill) | left as it was |
| src/components/content-detail/ContentDetailShell.tsx:693 | buildgallery | Rename (shown to a person) | changed |
| src/components/analytics/BuildAnalytics.tsx:12 | buildgallery | Keep (history: names a skill) | left as it was |
| src/components/analytics/BuildAnalytics.tsx:15 | buildgallery | Keep (history: names a skill) | left as it was |
| src/hooks/useBuildComments.ts:3 | neoscale | Keep (history: names a skill) | left as it was |
| src/hooks/useEngagement.ts:6 | neoscale | Keep (history: names a skill) | left as it was |
| src/App.tsx:426 | buildgallery | History / comment (left) | left as it was |
| src/index.css:80 | buildgallery | Keep (infrastructure: CSS / env variable) | left as it was |
| src/index.css:97 | neoscale | Keep (history: names a skill) | left as it was |
| src/index.css:130 | buildgallery | Keep (infrastructure: CSS / env variable) | left as it was |
| src/index.css:340 | buildgallery | Keep (infrastructure: CSS / env variable) | left as it was |
| src/index.css:730 | buildgallery | Keep (infrastructure: CSS / env variable) | left as it was |
| src/dev/fixtures/vision/drafts.ts:71 | buildgallery | Left, unsure (dev-only fixture, never shown to a visitor) | left as it was |
| src/test/signals.test.ts:233 | neoscale | Test: follows the code it asserts | left as it was |
| src/test/initialBundle.test.ts:6 | neoscale | Keep (history: names a skill) | left as it was |
| src/test/portable.test.ts:12 | neoscale | Test: follows the code it asserts | left as it was |
| src/test/portable.test.ts:113 | neoscale | Test: follows the code it asserts | left as it was |
| src/test/portable.test.ts:180 | buildgallery | Test: follows the code it asserts | left as it was |
| src/test/portable.test.ts:189 | neoscale | Test: follows the code it asserts | changed |
| src/test/portable.test.ts:190 | neoscale | Test: follows the code it asserts | changed |
| src/test/portable.test.ts:203 | neoscale | Test: follows the code it asserts | left as it was |
| src/test/portable.test.ts:273 | neoscale | Test: follows the code it asserts | changed |
| src/test/security/checkout.test.ts:92 | buildgallery | Test: follows the code it asserts | left as it was |
| src/test/security/checkout.test.ts:93 | buildgallery | Test: follows the code it asserts | left as it was |
| src/test/security/checkout.test.ts:94 | neoscale | Test: follows the code it asserts | left as it was |
| src/test/security/cors.test.ts:34 | buildgallery | Test: follows the code it asserts | left as it was |
| src/test/security/cors.test.ts:35 | buildgallery | Test: follows the code it asserts | left as it was |
| src/test/security/cors.test.ts:36 | neoscale | Test: follows the code it asserts | left as it was |
| src/test/security/cors.test.ts:43 | buildgallery | Test: follows the code it asserts | left as it was |
| src/content/legal/legalLinks.test.tsx:39 | buildgallery | Test: follows the code it asserts | changed |
| src/content/legal/legalContent.test.ts:56 | buildgallery | Test: follows the code it asserts | left as it was |
| src/content/legal/legalContent.test.ts:57 | buildgallery | Test: follows the code it asserts | left as it was |
| src/styles/shared-ns.css:20 | NeoScale | Keep (infrastructure: CSS / env variable) | left as it was |
| src/styles/shared-ns.css:30 | NeoScale | Keep (infrastructure: CSS / env variable) | left as it was |
| src/contexts/ThemeContext.tsx:19 | buildgallery | History / comment (left) | left as it was |
| src/lib/auth/oauthConsent.ts:4 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/lib/auth/oauthConsent.ts:5 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/lib/social/likes.ts:9 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/social/comments.ts:21 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/social/counts.ts:6 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/social/types.ts:15 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/bounty/solvers.ts:9 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/moderation/siteHidden.ts:11 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/moderation/reports.ts:9 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/rcGuards.test.ts:122 | buildgallery | Test: follows the code it asserts | changed |
| src/lib/rcGuards.test.ts:123 | buildgallery | Test: follows the code it asserts | changed |
| src/lib/rcGuards.test.ts:127 | neoscale | Test: follows the code it asserts | left as it was |
| src/lib/rcGuards.test.ts:129 | buildgallery | Test: follows the code it asserts | changed |
| src/lib/rcGuards.test.ts:132 | buildgallery | Test: follows the code it asserts | changed |
| src/lib/library/savedItems.ts:15 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/library/resolveItems.ts:14 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/library/builds.ts:13 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/library/builds.ts:17 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/profile/makerStats.ts:7 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/profile/makerStats.ts:11 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/progress/errors.ts:3 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/connect/connector.ts:19 | buildgallery | Rename (shown to a person) | changed |
| src/lib/theme/controls.test.ts:285 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/theme/motion.test.ts:364 | buildgallery | Test: follows the code it asserts | left as it was |
| src/lib/theme/focus.ts:1 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/lib/theme/interactive.ts:1 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/lib/theme/interactive.ts:9 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/theme/motion.ts:1 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/lib/theme/motion.ts:16 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/lib/theme/motion.ts:268 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/lib/theme/contrast.test.ts:1 | buildgallery | Test: follows the code it asserts | left as it was |
| src/lib/theme/tokens.ts:1 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/lib/theme/category.test.ts:1 | buildgallery | Test: follows the code it asserts | left as it was |
| src/lib/theme/category.test.ts:258 | NeoScale | Test: follows the code it asserts | left as it was |
| src/lib/theme/category.test.ts:261 | NeoScale | Test: follows the code it asserts | left as it was |
| src/lib/theme/elevation.ts:1 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/lib/theme/elevation.ts:46 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/theme/radius.ts:1 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/lib/theme/state-contrast.test.ts:3 | buildgallery | Keep (history: names a skill) | left as it was |
| src/lib/theme/shadcn.ts:13 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/lib/theme/ns-classes.test.ts:3 | NeoScale | Test: follows the code it asserts | left as it was |
| src/lib/theme/ns-classes.test.ts:59 | NeoScale | Test: follows the code it asserts | left as it was |
| src/lib/theme/ns-classes.test.ts:73 | NeoScale | Test: follows the code it asserts | left as it was |
| src/lib/theme/ns-classes.test.ts:78 | NeoScale | Test: follows the code it asserts | left as it was |
| src/lib/theme/ns-classes.test.ts:81 | NeoScale | Test: follows the code it asserts | left as it was |
| src/lib/theme/controls.ts:1 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/lib/theme/controls.ts:10 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/theme/controls.ts:19 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/theme/controls.ts:151 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/theme/controls.ts:652 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/theme/type.ts:1 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/lib/theme/space.ts:1 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/lib/theme/space.ts:30 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/theme/lookRules.test.ts:2328 | buildgallery | Test: follows the code it asserts | left as it was |
| src/lib/theme/lookRules.test.ts:2329 | buildgallery | Test: follows the code it asserts | left as it was |
| src/lib/theme/radius.test.ts:176 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/theme/density.ts:1 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/lib/theme/semantics.ts:1 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/lib/theme/category.ts:1 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/lib/theme/category.ts:33 | buildgallery | Keep (history: names a skill) | left as it was |
| src/lib/notifications/resolveTarget.ts:19 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/messaging/topics.ts:11 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/messaging/builds.ts:13 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/errors/permission.ts:6 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/errors/report.ts:13 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/build/layers.ts:84 | buildgallery | Rename (shown to a person) | changed |
| src/lib/build/layers.ts:529 | neoscale | Rename (identifier only Miles used) | changed |
| src/lib/build/buildfile.test.ts:105 | neoscale | Test: follows the code it asserts | changed |
| src/lib/build/buildfile.test.ts:166 | neoscale | Test: follows the code it asserts | changed |
| src/lib/build/buildfile.test.ts:175 | neoscale | Test: follows the code it asserts | changed |
| src/lib/build/buildfile.test.ts:178 | buildgallery | Test: follows the code it asserts | left as it was |
| src/lib/build/buildfile.test.ts:182 | neoscale | Test: follows the code it asserts | changed |
| src/lib/build/buildfile.test.ts:193 | neoscale | Test: follows the code it asserts | changed |
| src/lib/build/buildfile.test.ts:201 | neoscale | Test: follows the code it asserts | changed |
| src/lib/build/buildfile.test.ts:213 | neoscale | Test: follows the code it asserts | changed |
| src/lib/build/buildfile.test.ts:232 | neoscale | Test: follows the code it asserts | changed |
| src/lib/build/buildfile.test.ts:244 | neoscale | Test: follows the code it asserts | changed |
| src/lib/build/buildfile.test.ts:285 | neoscale | Test: follows the code it asserts | changed |
| src/lib/build/buildfile.test.ts:312 | neoscale | Test: follows the code it asserts | changed |
| src/lib/build/buildfile.test.ts:347 | neoscale | Test: follows the code it asserts | changed |
| src/lib/build/imports.test.ts:414 | buildgallery | Test: follows the code it asserts | changed |
| src/lib/build/buildfileDocuments.test.ts:12 | NEOSCALE | Test: follows the code it asserts | changed |
| src/lib/build/buildfileDocuments.test.ts:13 | buildgallery | Test: follows the code it asserts | changed |
| src/lib/build/buildfileDocuments.test.ts:14 | BUILDGALLERY | Test: follows the code it asserts | changed |
| src/lib/build/buildfileDocuments.test.ts:22 | neoscale | Test: follows the code it asserts | changed |
| src/lib/build/buildfileDocuments.test.ts:25 | neoscale | Test: follows the code it asserts | changed |
| src/lib/build/buildfileDocuments.test.ts:47 | neoscale | Test: follows the code it asserts | changed |
| src/lib/build/buildfileDocuments.test.ts:53 | neoscale | Test: follows the code it asserts | changed |
| src/lib/build/buildfileDocuments.test.ts:59 | BUILDGALLERY | Test: follows the code it asserts | changed |
| src/lib/build/buildfileDocuments.test.ts:60 | BUILDGALLERY | Test: follows the code it asserts | changed |
| src/lib/build/buildfileDocuments.test.ts:72 | buildgallery | Test: follows the code it asserts | changed |
| src/lib/build/buildfileDocuments.test.ts:75 | buildgallery | Test: follows the code it asserts | changed |
| src/lib/build/buildfileDocuments.test.ts:85 | neoscale | Test: follows the code it asserts | changed |
| src/lib/build/buildfileDocuments.test.ts:91 | BUILDGALLERY | Test: follows the code it asserts | changed |
| src/lib/build/buildfileDocuments.test.ts:96 | NEOSCALE | Test: follows the code it asserts | changed |
| src/lib/build/portable.ts:4 | NeoScale | History / comment (left, or updated once if it states what the site is) | changed |
| src/lib/build/portable.ts:81 | neoscale | Rename (identifier only Miles used) | changed |
| src/lib/build/portable.ts:322 | neoscale | Rename (identifier only Miles used) | changed |
| src/lib/build/search.ts:15 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/build/buildfile.ts:781 | buildgallery | Rename (shown to a person) | changed |
| src/lib/build/buildfile.ts:925 | buildgallery | Rename (shown to a person) | changed |
| src/lib/build/buildfile.ts:940 | buildgallery | Rename (shown to a person) | changed |
| src/lib/build/buildfile.ts:1040 | neoscale | Rename (identifier only Miles used) | changed |
| src/lib/build/buildfile.ts:1050 | neoscale | Rename (identifier only Miles used) | changed |
| src/lib/build/lineage.ts:9 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/build/imports.ts:79 | buildgallery | Rename (identifier only Miles used) | changed |
| src/lib/build/shareMeta.test.ts:53 | buildgallery | Test: follows the code it asserts | changed |
| src/lib/build/shareMeta.test.ts:54 | buildgallery | Test: follows the code it asserts | changed |
| src/lib/build/shareMeta.ts:5 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| src/lib/build/shareMeta.ts:44 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| src/lib/build/shareMeta.ts:47 | buildgallery | Rename (shown to a person) | changed |
| src/lib/analytics/buildStats.ts:3 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/analytics/buildStats.ts:18 | neoscale | Keep (history: names a skill) | left as it was |
| src/lib/analytics/needsYou.ts:14 | buildgallery | Keep (history: names a skill) | left as it was |
| src/lib/openbuilds/types.ts:11 | neoscale | Keep (history: names a skill) | left as it was |
| src/pages/ImportPage.tsx:78 | BUILDGALLERY | History / comment (left, or updated once if it states what the site is) | changed |
| src/pages/ImportPage.tsx:79 | NEOSCALE | History / comment (left, or updated once if it states what the site is) | changed |
| src/pages/ImportPage.tsx:85 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| src/pages/ImportPage.tsx:86 | NEOSCALE | History / comment (left, or updated once if it states what the site is) | changed |
| src/pages/ImportPage.tsx:89 | neoscale | History / comment (left, or updated once if it states what the site is) | changed |
| src/pages/ImportPage.tsx:97 | BUILDGALLERY | Rename (identifier only Miles used) | changed |
| src/pages/ImportPage.tsx:98 | BUILDGALLERY | Rename (identifier only Miles used) | changed |
| src/pages/ImportPage.tsx:100 | BUILDGALLERY | Rename (identifier only Miles used) | changed |
| src/pages/ImportPage.tsx:101 | BUILDGALLERY | Rename (identifier only Miles used) | changed |
| src/pages/ImportPage.tsx:531 | buildgallery | Rename (shown to a person) | changed |
| src/pages/ImportPage.tsx:545 | buildgallery | Rename (shown to a person) | changed |
| src/pages/Analytics.tsx:21 | buildgallery | Keep (history: names a skill) | left as it was |
| src/pages/ImportPage.test.tsx:88 | neoscale | Test: follows the code it asserts | changed |
| src/pages/ImportPage.test.tsx:108 | NEOSCALE | Test: follows the code it asserts | changed |
| src/pages/ImportPage.test.tsx:141 | buildgallery | Test: follows the code it asserts | changed |
| src/pages/ImportPage.test.tsx:142 | buildgallery | Test: follows the code it asserts | changed |
| src/pages/ImportPage.test.tsx:147 | BUILDGALLERY | Test: follows the code it asserts | changed |
| src/pages/ImportPage.test.tsx:148 | BUILDGALLERY | Test: follows the code it asserts | changed |
| src/pages/ImportPage.test.tsx:225 | buildgallery | Test: follows the code it asserts | changed |
| src/pages/ImportPage.test.tsx:226 | NEOSCALE | Test: follows the code it asserts | changed |
| src/pages/ImportPage.test.tsx:228 | BUILDGALLERY | Test: follows the code it asserts | changed |
| src/pages/ImportPage.test.tsx:229 | BUILDGALLERY | Test: follows the code it asserts | changed |
| src/pages/ImportPage.test.tsx:360 | neoscale | Test: follows the code it asserts | changed |
| src/pages/Compose.tsx:8 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/pages/Admin.tsx:771 | buildgallery | Rename (shown to a person) | changed |
| src/pages/ComposeNew.tsx:39 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/pages/ComposeNew.tsx:288 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/pages/dev/KitComponents.tsx:46 | buildgallery | Left, unsure (dev-only page, never shown to a visitor) | left as it was |
| src/pages/dev/VisionComposerAddFromLibrary.tsx:23 | buildgallery | Left, unsure (dev-only page, never shown to a visitor) | left as it was |
| src/pages/dev/ClassificationDemo.tsx:52 | neoscale | Left, unsure (identifier or external handle) | left as it was |
| src/pages/OnboardingProfile.tsx:153 | buildgallery | History / comment (left) | left as it was |
| src/pages/OnboardingProfile.tsx:167 | buildgallery | Rename (shown to a person) | changed |
| src/pages/OnboardingProfile.tsx:168 | buildgallery | Rename (shown to a person) | changed |
| src/pages/AuthCallback.tsx:56 | buildgallery | Rename (shown to a person) | changed |
| src/pages/PublishMetadata.tsx:338 | buildgallery | Rename (shown to a person) | changed |
| src/pages/PublishMetadata.tsx:339 | buildgallery | Rename (shown to a person) | changed |
| src/pages/site/builds/BuildsPage.tsx:443 | buildgallery | Rename (shown to a person) | changed |
| src/pages/site/activity/ActivityPage.tsx:264 | buildgallery | Rename (shown to a person) | changed |
| src/pages/site/library/LibraryPage.tsx:633 | buildgallery | Rename (shown to a person) | changed |
| src/pages/site/compose/SandboxPage.tsx:2698 | buildgallery | Rename (shown to a person) | changed |
| src/pages/site/compose/PromptsPanel.tsx:30 | buildgallery | Left, unsure (identifier or external handle) | left as it was |
| src/pages/site/compose/ComposePage.tsx:442 | buildgallery | Rename (shown to a person) | changed |
| src/pages/site/connect/ConnectPage.tsx:21 | buildgallery | Rename (shown to a person) | changed |
| src/pages/site/connect/ConnectPage.tsx:22 | buildgallery | Rename (shown to a person) | changed |
| src/pages/site/connect/ConnectView.tsx:23 | buildgallery | Rename (shown to a person) | changed |
| src/pages/site/signin/ResetPasswordPage.tsx:181 | buildgallery | Rename (shown to a person) | changed |
| src/pages/site/signin/ResetPasswordPage.tsx:182 | buildgallery | Rename (shown to a person) | changed |
| src/pages/site/signin/LoginPage.tsx:85 | buildgallery | Rename (shown to a person) | changed |
| src/pages/site/signin/LoginPage.test.tsx:59 | buildgallery | Test: follows the code it asserts | changed |
| src/pages/site/signin/LoginPage.test.tsx:61 | buildgallery | Test: follows the code it asserts | changed |
| src/pages/site/signin/VerifyEmailPage.tsx:121 | buildgallery | Rename (shown to a person) | changed |
| src/pages/site/signin/VerifyEmailPage.tsx:122 | buildgallery | Rename (shown to a person) | changed |
| src/pages/site/signin/ResetPasswordPage.test.tsx:66 | buildgallery | Test: follows the code it asserts | changed |
| src/pages/site/signin/SignupPage.test.tsx:66 | buildgallery | Test: follows the code it asserts | changed |
| src/pages/site/signin/SignupPage.tsx:225 | buildgallery | Rename (shown to a person) | changed |
| src/pages/site/signin/VerifyEmailPage.test.tsx:57 | buildgallery | Test: follows the code it asserts | changed |
| src/pages/site/signin/VerifyEmailPage.test.tsx:211 | buildgallery | Test: follows the code it asserts | changed |
| src/pages/site/signin/VerifyEmailPage.test.tsx:218 | buildgallery | Test: follows the code it asserts | changed |
| src/pages/site/signin/signinForms.test.tsx:451 | buildgallery | Test: follows the code it asserts | left as it was |
| src/pages/site/drafts/DraftsPage.tsx:153 | buildgallery | Rename (shown to a person) | changed |
| src/pages/site/build/BuildPage.tsx:191 | neoscale | Rename (identifier only Miles used) | changed |
| src/pages/site/build/buildModel.test.ts:325 | buildgallery | Test: follows the code it asserts | changed |
| src/pages/site/build/BuildPage.test.tsx:259 | neoscale | Test: follows the code it asserts | changed |
| src/pages/site/build/BuildPage.test.tsx:514 | buildgallery | Test: follows the code it asserts | changed |
| src/pages/site/rebuild/RebuildPage.tsx:264 | buildgallery | Rename (shown to a person) | changed |
| src/pages/site/rebuild/LineagePage.tsx:152 | buildgallery | Rename (shown to a person) | changed |
| src/pages/About.tsx:46 | neoscale | Left, unsure (identifier or external handle) | left as it was |
| src/pages/About.tsx:51 | neoscale | Left, unsure (identifier or external handle) | left as it was |
| src/pages/About.tsx:56 | neoscale | Left, unsure (identifier or external handle) | left as it was |
| src/pages/OAuthConsent.tsx:6 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| src/pages/OAuthConsent.tsx:114 | buildgallery | Rename (shown to a person) | changed |
| src/pages/OAuthConsent.tsx:227 | buildgallery | Rename (shown to a person) | changed |
| src/pages/OAuthConsent.tsx:228 | buildgallery | Rename (shown to a person) | changed |
| src/pages/OAuthConsent.tsx:250 | buildgallery | Rename (shown to a person) | changed |
| src/pages/OAuthConsent.tsx:337 | buildgallery | Rename (shown to a person) | changed |
| src/pages/ContentDetail.tsx:787 | buildgallery | Rename (shown to a person) | changed |
| src/pages/ContentDetail.tsx:804 | buildgallery | Rename (shown to a person) | changed |
| src/pages/ApiDocs.tsx:39 | buildgallery | Rename (shown to a person) | changed |
| src/pages/ApiDocs.tsx:41 | buildgallery | Rename (shown to a person) | changed |
| src/pages/ApiDocs.tsx:43 | buildgallery | Rename (shown to a person) | changed |
| supabase/functions/parse-lovable/index.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/parse-lovable/README.md:3 | NeoScale | History / comment (left) | left as it was |
| supabase/functions/parse-transcript/index.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/parse-transcript/README.md:4 | NeoScale | History / comment (left) | left as it was |
| supabase/functions/generate-ai-pdf/index.ts:234 | NeoScale | Rename (shown to a person) | changed |
| supabase/functions/generate-ai-pdf/index.ts:235 | NeoScale | Rename (shown to a person) | changed |
| supabase/functions/generate-ai-pdf/index.ts:236 | NeoScale | Rename (shown to a person) | changed |
| supabase/functions/generate-ai-pdf/index.ts:247 | NEOSCALE | Rename (shown to a person) | changed |
| supabase/functions/generate-ai-pdf/index.ts:261 | NeoScale | Rename (shown to a person) | changed |
| supabase/functions/generate-ai-pdf/index.ts:397 | NeoScale | Rename (shown to a person) | changed |
| supabase/functions/generate-ai-pdf/index.ts:407 | NeoScale | Rename (shown to a person) | changed |
| supabase/functions/generate-ai-pdf/index.ts:416 | NEOSCALE | Rename (shown to a person) | changed |
| supabase/functions/generate-ai-pdf/index.ts:428 | NeoScale | Rename (shown to a person) | changed |
| supabase/functions/generate-ai-pdf/index.ts:469 | NeoScale | Rename (shown to a person) | changed |
| supabase/functions/generate-build-layers/index.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/generate-build-layers/describe.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/generate-build-layers/model.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/generate-build-layers/model.ts:99 | NeoScale | Rename (shown to a person) | changed |
| supabase/functions/generate-build-layers/hash.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/generate-build-layers/types.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/create-project-package-session/index.ts:72 | NeoScale | Rename (shown to a person) | changed |
| supabase/functions/create-donation-session/handler.ts:44 | NeoScale | Rename (shown to a person) | changed |
| supabase/functions/parse-repo/index.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/parse-repo/parse.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/parse-repo/github.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/parse-repo/github.ts:136 | NeoScale | Left, unsure (identifier or external handle) | changed |
| supabase/functions/parse-repo/snapshot.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/_shared/redact/index.ts:2 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/_shared/redact/index.ts:6 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/_shared/redact/index.test.ts:2 | buildgallery | Test: follows the code it asserts | left as it was |
| supabase/functions/_shared/origins.ts:5 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/_shared/intake/index.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/_shared/intake/parsers/transcript.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/_shared/intake/parsers/lovable.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/_shared/intake/inferred.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/_shared/intake/ordinals.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/_shared/intake/readers/claude.test.ts:2 | buildgallery | Test: follows the code it asserts | left as it was |
| supabase/functions/_shared/intake/readers/index.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/_shared/intake/readers/index.ts:31 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/_shared/intake/readers/transcript.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/_shared/intake/readers/claude.ts:2 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/_shared/intake/readers/lovable.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/_shared/intake/readers/hostile.test.ts:2 | buildgallery | Test: follows the code it asserts | left as it was |
| supabase/functions/_shared/intake/local-id.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/_shared/intake/reader.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/_shared/intake/registry.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/_shared/intake/source-ref.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/_shared/intake/envelope.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/_shared/intake/timestamps.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/mcp/vocabulary.ts:2 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/mcp/vocabulary.ts:4 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/mcp/vocabulary.ts:144 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/vocabulary.ts:150 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/monitor.ts:2 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/mcp/monitor.ts:152 | buildgallery | History / comment (left) | changed |
| supabase/functions/mcp/index.ts:2 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/mcp/index.ts:48 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/mcp/index.ts:85 | buildgallery | Keep (history: names a skill) | left as it was |
| supabase/functions/mcp/index.ts:111 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/mcp/index.ts:113 | BUILDGALLERY | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/mcp/index.ts:582 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:594 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:595 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:599 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:603 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:630 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:634 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:638 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:643 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:651 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/index.ts:652 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/index.ts:657 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/mcp/index.ts:680 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/index.ts:718 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/mcp/index.ts:743 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:760 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/mcp/index.ts:776 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/index.ts:803 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:832 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:833 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:863 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/mcp/index.ts:868 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:1026 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/mcp/index.ts:1031 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:1093 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:1276 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/mcp/index.ts:1281 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:1314 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:1352 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/mcp/index.ts:1406 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/mcp/index.ts:1410 | buildgallery | Left, unsure (resource name, an identifier) | left as it was |
| supabase/functions/mcp/index.ts:1413 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/index.ts:1423 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/index.ts:1534 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/mcp/index.ts:1536 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:1538 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/index.ts:1544 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:1555 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/index.ts:1568 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/mcp/index.ts:1570 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:1572 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/index.ts:1578 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:1620 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/mcp/index.ts:1622 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:1624 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/index.ts:1630 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:1740 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/mcp/index.ts:1742 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:1744 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/index.ts:1750 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:1828 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/mcp/index.ts:1830 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:1832 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/index.ts:1838 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:2099 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/mcp/index.ts:2101 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:2103 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/index.ts:2110 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:2185 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/mcp/index.ts:2187 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:2189 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/index.ts:2195 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:2229 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/index.ts:2244 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/mcp/index.ts:2254 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/index.ts:2277 | BUILDGALLERY | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/mcp/extract.ts:2 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/mcp/extract.ts:4 | BUILDGALLERY | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/mcp/extract.ts:18 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/mcp/extract.ts:20 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/mcp/extract.ts:31 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/extract.ts:34 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/extract.ts:35 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/extract.ts:36 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/extract.ts:39 | BUILDGALLERY | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/mcp/extract.ts:45 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/extract.ts:56 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/extract.ts:58 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/extract.ts:59 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/extract.ts:65 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/extract.ts:67 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/extract.ts:69 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/extract.ts:70 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/extract.ts:77 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/extract.ts:81 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/monitor.test.ts:2 | buildgallery | Test: follows the code it asserts | left as it was |
| supabase/functions/mcp/monitor.test.ts:145 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/monitor.test.ts:206 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/monitor.test.ts:438 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/monitor.test.ts:600 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/monitor.test.ts:610 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/monitor.test.ts:622 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/monitor.test.ts:623 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/monitor.test.ts:627 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/database.types.ts:2 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/mcp/index.test.ts:2 | buildgallery | Test: follows the code it asserts | left as it was |
| supabase/functions/mcp/index.test.ts:81 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:82 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:83 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:84 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:85 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:86 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:87 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:508 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:518 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:538 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:556 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:559 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:576 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:586 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:604 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:616 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:621 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:627 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:644 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:662 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:684 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:690 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:696 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:703 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:712 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:721 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:746 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:764 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:772 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:787 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:803 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:820 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:826 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:841 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:861 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:882 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:907 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:932 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:946 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:956 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:963 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:964 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:971 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:978 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:987 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:998 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1002 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1014 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1046 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1056 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1078 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1104 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1137 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1143 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1150 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1155 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1169 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1205 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1210 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1216 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1221 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1293 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1521 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1525 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1536 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1547 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1600 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1603 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1685 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1693 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1705 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1721 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1737 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1741 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1938 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1957 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:1999 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2023 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2040 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2063 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2087 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2109 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2130 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2146 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2170 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2184 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2193 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2205 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2464 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2465 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2466 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2467 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2468 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2482 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2495 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2504 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2518 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2527 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2549 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2561 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2642 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2693 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2705 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2714 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2718 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2723 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2745 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2753 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:2839 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:3025 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:3026 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:3027 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:3028 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:3029 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:3030 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:3038 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:3039 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:3057 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:3155 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:3220 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:3237 | buildgallery | Test: follows the code it asserts | left as it was |
| supabase/functions/mcp/index.test.ts:3241 | BUILDGALLERY | Test: follows the code it asserts | left as it was |
| supabase/functions/mcp/index.test.ts:3246 | BUILDGALLERY | Test: follows the code it asserts | left as it was |
| supabase/functions/mcp/index.test.ts:3249 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:3250 | buildgallery | Test: follows the code it asserts | left as it was |
| supabase/functions/mcp/index.test.ts:3370 | buildgallery | Test: follows the code it asserts | left as it was |
| supabase/functions/mcp/index.test.ts:3587 | buildgallery | Test: follows the code it asserts | left as it was |
| supabase/functions/mcp/index.test.ts:3591 | buildgallery | Test: follows the code it asserts | left as it was |
| supabase/functions/mcp/index.test.ts:3635 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:3636 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:3637 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:3640 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:3643 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:3675 | buildgallery | Test: follows the code it asserts | changed |
| supabase/functions/mcp/index.test.ts:3678 | BUILDGALLERY | Test: follows the code it asserts | left as it was |
| supabase/functions/mcp/index.test.ts:3688 | BUILDGALLERY | Test: follows the code it asserts | left as it was |
| supabase/functions/mcp/constants.ts:2 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| supabase/functions/mcp/constants.ts:28 | buildgallery | Rename (identifier only Miles used) | changed |
| supabase/functions/mcp/constants.ts:42 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/mcp/constants.ts:80 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| supabase/functions/mcp/constants.ts:160 | buildgallery | Left, unsure (resource URI, an identifier) | left as it was |
| supabase/functions/mcp/constants.ts:199 | buildgallery | Rename (shown to an assistant) | changed |
| supabase/functions/import-github-readme/index.ts:25 | NeoScale | Left, unsure (identifier or external handle) | changed |
| public/ai.txt:1 | buildgallery | History / comment (left, or updated once if it states what the site is) | changed |
| public/buildfile/NEOSCALE_COMPILER.md:1 | buildgallery | History / comment (left, or updated once if it states what the site is) | removed or renamed (file gone) |
| public/buildfile/NEOSCALE_COMPILER.md:3 | buildgallery | Rename (shown to a person) | removed or renamed (file gone) |
| public/buildfile/NEOSCALE_EXTRACTOR.md:1 | buildgallery | History / comment (left, or updated once if it states what the site is) | removed or renamed (file gone) |
| public/buildfile/NEOSCALE_EXTRACTOR.md:4 | buildgallery | Rename (shown to a person) | removed or renamed (file gone) |
| public/buildfile/NEOSCALE_EXTRACTOR.md:15 | buildgallery | Rename (identifier only Miles used) | removed or renamed (file gone) |
| public/buildfile/NEOSCALE_EXTRACTOR.md:35 | neoscale | Rename (identifier only Miles used) | removed or renamed (file gone) |
| public/buildfile/BUILDGALLERY_EXTRACTOR.md:1 | buildgallery | History / comment (left, or updated once if it states what the site is) | removed or renamed (file gone) |
| public/buildfile/BUILDGALLERY_EXTRACTOR.md:4 | buildgallery | Rename (shown to a person) | removed or renamed (file gone) |
| public/buildfile/BUILDGALLERY_EXTRACTOR.md:15 | buildgallery | Rename (identifier only Miles used) | removed or renamed (file gone) |
| public/buildfile/BUILDGALLERY_EXTRACTOR.md:35 | neoscale | Rename (identifier only Miles used) | removed or renamed (file gone) |
| public/buildfile/BUILDGALLERY_COMPILER.md:1 | buildgallery | History / comment (left, or updated once if it states what the site is) | removed or renamed (file gone) |
| public/buildfile/BUILDGALLERY_COMPILER.md:3 | buildgallery | Rename (shown to a person) | removed or renamed (file gone) |
| index.html:6 | buildgallery | Rename (shown to a person) | changed |
| index.html:28 | buildgallery | Rename (shown to a person) | changed |
| scripts/backfill-patterns.ts:2 | buildgallery | History / comment (left, or updated once if it states what the site is) | left as it was |
| scripts/backfill-patterns.ts:19 | NEOSCALE | Keep (infrastructure: CSS / env variable) | left as it was |
| scripts/backfill-patterns.ts:35 | NEOSCALE | Keep (infrastructure: CSS / env variable) | left as it was |
| scripts/backfill-patterns.ts:37 | NEOSCALE | Keep (infrastructure: CSS / env variable) | left as it was |
| scripts/verify-rebuild.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| scripts/verify-rebuild.ts:23 | NEOSCALE | Keep (infrastructure: CSS / env variable) | left as it was |
| scripts/verify-rebuild.ts:24 | NEOSCALE | Keep (infrastructure: env variable) | left as it was |
| scripts/verify-rebuild.ts:25 | NEOSCALE | Keep (infrastructure: env variable) | left as it was |
| scripts/verify-rebuild.ts:28 | NEOSCALE | Keep (infrastructure: CSS / env variable) | left as it was |
| scripts/verify-rebuild.ts:79 | NEOSCALE | Keep (infrastructure: env variable) | left as it was |
| scripts/verify-rebuild.ts:80 | NEOSCALE | Keep (infrastructure: env variable) | left as it was |
| scripts/verify-rebuild.ts:82 | NEOSCALE | Keep (infrastructure: CSS / env variable) | left as it was |
| scripts/verify-rebuild.ts:85 | NEOSCALE | Keep (infrastructure: CSS / env variable) | left as it was |
| scripts/verify-build-layer.ts:2 | NeoScale | History / comment (left, or updated once if it states what the site is) | left as it was |
| e2e/tier3/oauth-consent.spec.ts:76 | buildgallery | Test: follows the code it asserts | left as it was |
| e2e/tier3/waiting-imports.spec.ts:3 | buildgallery | Test: follows the code it asserts | left as it was |
| e2e/tier3/frame-no-rail.spec.ts:13 | buildgallery | Keep (history: names a skill) | left as it was |
| e2e/tier3/workspace-chrome.spec.ts:5 | buildgallery | Test: follows the code it asserts | changed |
| e2e/tier3/workspace-chrome.spec.ts:102 | buildgallery | Test: follows the code it asserts | changed |
| e2e/tier3/progress-page.spec.ts:260 | buildgallery | Test: follows the code it asserts | left as it was |
| e2e/tier3/connect-page.spec.ts:26 | buildgallery | Test: follows the code it asserts | changed |
| e2e/tier3/connect-page.spec.ts:29 | buildgallery | Test: follows the code it asserts | changed |
| e2e/tier3/connect-page.spec.ts:30 | buildgallery | Test: follows the code it asserts | changed |
| e2e/tier3/connect-page.spec.ts:139 | buildgallery | Test: follows the code it asserts | changed |
| e2e/tier3/import-repaint.spec.ts:69 | neoscale | Test: follows the code it asserts | changed |
| e2e/tier3/import-repaint.spec.ts:281 | buildgallery | Test: follows the code it asserts | changed |
| e2e/tier3/import-repaint.spec.ts:345 | buildgallery | Test: follows the code it asserts | changed |
| e2e/tier3/import-repaint.spec.ts:365 | buildgallery | Test: follows the code it asserts | changed |
| e2e/tier3/import-repaint.spec.ts:376 | BUILDGALLERY | Test: follows the code it asserts | changed |
| e2e/tier3/import-repaint.spec.ts:377 | BUILDGALLERY | Test: follows the code it asserts | changed |
| e2e/tier3/import-repaint.spec.ts:385 | buildgallery | Test: follows the code it asserts | changed |
| e2e/tier3/import-repaint.spec.ts:396 | neoscale | Test: follows the code it asserts | changed |
| e2e/tier3/import-repaint.spec.ts:400 | BUILDGALLERY | Test: follows the code it asserts | changed |
| e2e/tier3/import-repaint.spec.ts:401 | NEOSCALE | Test: follows the code it asserts | changed |
| e2e/tier3/import-repaint.spec.ts:404 | neoscale | Test: follows the code it asserts | changed |
| e2e/tier3/import-repaint.spec.ts:408 | neoscale | Test: follows the code it asserts | changed |
| e2e/tier3/import-repaint.spec.ts:410 | neoscale | Test: follows the code it asserts | changed |
| e2e/tier3/moved-routes-frame.spec.ts:6 | buildgallery | Test: follows the code it asserts | left as it was |
| e2e/tier3/moved-routes-frame.spec.ts:132 | buildgallery | Test: follows the code it asserts | left as it was |
| e2e/tier3/moved-routes-frame.spec.ts:141 | buildgallery | Test: follows the code it asserts | left as it was |
| e2e/tier3/moved-routes-frame.spec.ts:148 | buildgallery | Test: follows the code it asserts | left as it was |
| e2e/tier3/moved-routes-frame.spec.ts:264 | neoscale | Test: follows the code it asserts | changed |
| e2e/tier3/moved-routes-frame.spec.ts:268 | neoscale | Test: follows the code it asserts | changed |
| e2e/fixtures/secrets.neoscale.md:6 | neoscale | Rename (identifier only Miles used) | removed or renamed (file gone) |
| e2e/fixtures/valid.neoscale.md:6 | neoscale | Rename (identifier only Miles used) | removed or renamed (file gone) |
| e2e/fixtures/version-2.neoscale.md:5 | neoscale | Rename (identifier only Miles used) | removed or renamed (file gone) |
| e2e/audit/README.md:146 | neoscale | Keep (history: names a skill) | left as it was |
| e2e/audit/performance.spec.ts:3 | neoscale | Keep (history: names a skill) | left as it was |
| e2e/tier1/auth-entry.spec.ts:58 | buildgallery | Test: follows the code it asserts | left as it was |
| e2e/tier1/unsent-prompt.spec.ts:60 | buildgallery | Test: follows the code it asserts | left as it was |
