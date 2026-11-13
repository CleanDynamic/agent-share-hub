# Control heights: the lists behind the report

The first three sections were written at `a9bfb97`, before the parked questions were answered; the later sections record the second round. Where the two differ, the later section is current: the PostCard heading link, the brand chips, the Build reader's tabs and its View switch, the Account button and the rows listed under Q6 have since moved.

## G9 exceptions (literal heights in the edit area other than 20, 24, 32, 48)

Scan: `height:` / `minHeight:` with a number, over src/pages/site (not compose, signin, builds), src/components/shell, Button.tsx, Segmented.tsx. Hairlines, dots, media, skeleton bars, `0`, `100%` and vh values are left out as not controls.

**Phone touch targets (44, allowed by G8)**
- shell/HeaderSearch.tsx:146, shell/MobileHeader.tsx:56, :117, build/BuildSteps.tsx:479, :558, build/BuildView.tsx:723, :911, :953 (phone half), build/RebuildsBody.tsx:48, build/ReplayBody.tsx:216 (phone half), rebuild/LineageView.tsx:79, rebuild/FamilyPanel.tsx:281 (phone half), drafts/DraftsView.tsx:244 (phone-only sheet row), legal/LegalView.tsx:109 (disclosure summary), openbuilds/SpaceWindow.tsx:56, :219, library/LibraryFrame.tsx:106, :132 (TOUCH_MIN)

**Outside this prompt by rule**
- shell/ShellHeader.tsx:84, :95, :139, :179, :200: the legacy shell header (used by /upload, Messages, Analytics), not the site frame
- shell/WorkspaceBar.tsx:270, :384: the build editor's bar
- openbuilds/OpenBuildsFrame.tsx:70, :90, :106, :143, :169: controls and skeletons with no callers (dead before this work, left)

**Rows already 48 or more, at 52 or 56 (G5 is met; the literal is off G9's list)**
- activity/ActivityView.tsx:277, :287 (56), home/HomeView.tsx:304 (52), :909 (56), drafts/DraftsFrame.tsx:125 (52, the dashed Start slot; parked), profile/CustomiseProfile.tsx:211 (56), openbuilds/OpenBuildsFeedView.tsx:133 (52)

**Rows under 48 that G5 does not name (parked question Q6)**
- library/LibraryView.tsx:221 (kinds nav, 34), :274 (collections, 40), :338 (changes, 40), :569 (detail rows, 36), :659 (preview, 40)
- home/HomeView.tsx:426 (drafts line, 44), :830 (latest runs, 36), :962 (published, 44)
- openbuilds/OpenBuildsFeedView.tsx:79 (40), compare/CompareView.tsx:39, :45 (40), openbuilds/LineUpSteps.tsx:47, :52 (40)
- rebuild/FamilyPanel.tsx:281 (43), rebuild/ChangesPanel.tsx:86 (25), build/BuildView.tsx:226 (anatomy part rows, 33)
- profile/CustomiseProfile.tsx:252, :284, profile/ProfileSide.tsx:284 (44)
- settings/SettingsFrame.tsx:77 (settings nav, 36)
- build/ReplayBody.tsx:216 (replay steps, 28 on desktop)

**Not controls (containers, text areas, media, skeletons)**
- build/BuildSteps.tsx:873 and build/BuildView.tsx:953 (row heads at 28 that hold a 24 button), build/RunBody.tsx:197 (25 line), profile/ProfileFeed.tsx:149, activity/ActivityView.tsx:685
- build/RunDialog.tsx:169 (72), openbuilds/StepTileEditor.tsx:83 (88), openbuilds/ReplyBox.tsx:202 (64): textareas
- build/BuildView.tsx:246, :545 (variable), :704 (280 media), rebuild/FamilyPanel.tsx:180, :264, :294, profile/CustomiseProfile.tsx:219, profile/ProfileSide.tsx:129: media and drawing
- home/HomeFrame.tsx:184, openbuilds/OpenBuildsFeedFrame.tsx:11 (41), library/LibraryFrame.tsx:191 (40): skeletons
- brand/Segmented.tsx:121: computed (`height + 2`)
- openbuilds/AttachPicker.tsx:33: picker row box

## G8b, report only: text links, tags and in-row small buttons under 44 on a phone (390)

- brand/Lockup.tsx: the header lockup link, 18 high, every page
- home/HomeView.tsx: feed item build links (17–18), :692 "More builds" (16), :825 latest-runs rows (36); gallery/FeedPost.tsx heading link (31)
- drafts/DraftsFrame.tsx:247 "How they get here" (24), vision/InnerTile "Manage" (24), DraftsView add buttons (24 icon, in row)
- library/LibraryView.tsx:298 "New collection" (24), :266 collection rows (41)
- profile/ProfileHead.tsx:214, :244, :258 (stat and website links, 17), profile/ProfileFeed.tsx:142 replied-to (16), feed topic links (18), post/PostCard.tsx heading link (21)
- activity/ActivityView.tsx:781 "Notification settings" (16)
- build/BuildSteps.tsx fold toggles (24 icon, in row), "Read all" (24), :1604/:1665 need rows (18)
- builds/BuildsMapsView map card link (24) — Builds, skipped

## Controls outside the edit area that changed size

### Through Button.tsx (approved reach; editor and shared components)
- src/components/post/editor/GridView.tsx:279 — drawn phone ? 44 : 30
- src/components/post/editor/FormatBar.tsx:277 — drawn 30
- src/components/post/editor/FormatBar.tsx:281 — drawn 30
- src/components/post/media/EditMediaDialog.tsx:239 — drawn phone ? 44 : 32
- src/components/post/media/EditMediaDialog.tsx:322 — drawn phone ? 44 : 32
- src/components/post/media/EditMediaDialog.tsx:334 — drawn phone ? 44 : 32
- src/components/post/RefLinks.tsx:228 — drawn 28
- src/components/connect/ConnectorGuide.tsx:155 — drawn phone ? 44 : 30
- src/components/connect/ConnectorGuide.tsx:460 — drawn phone ? 48 : 42
- src/components/connect/ConnectorGuide.tsx:470 — drawn phone ? 48 : 42
- src/components/block/BlockDialog.tsx:60 — drawn 32
- src/components/block/BlockDialog.tsx:63 — drawn 32
- src/components/build/PartWindow.tsx:225 — drawn 32
- src/components/build/PartWindow.tsx:303 — drawn 32
- src/components/build/PartWindow.tsx:368 — drawn 32
- src/components/build/PartWindow.tsx:378 — drawn 32
- src/components/build/PartWindow.tsx:382 — drawn 32
- src/components/build/PartWindow.tsx:482 — drawn 32
- src/components/build/PartWindow.tsx:486 — drawn 32
- src/components/build/PartWindow.tsx:616 — drawn phone ? 48 : 32
- src/components/build/FullPromptWindow.tsx:350 — drawn 32
- src/pages/dev/catalogue/ControlsSection.tsx:48 — drawn default(36)
- src/pages/dev/catalogue/ControlsSection.tsx:53 — drawn default(36)
- src/pages/dev/catalogue/ControlsSection.tsx:58 — drawn default(36)
- src/pages/site/compose/DetailsPanel.tsx:552 — drawn 32
- src/pages/site/compose/DetailsPanel.tsx:699 — drawn 32
- src/pages/site/compose/DetailsPanel.tsx:730 — drawn 32
- src/pages/site/compose/MadeWithLine.tsx:184 — drawn phone ? 44 : 32
- src/pages/site/compose/SandboxView.tsx:1494 — drawn 32
- src/pages/site/compose/SandboxView.tsx:1513 — drawn 32
- src/pages/site/compose/BuildList.tsx:782 — drawn phone ? 44 : 32
- src/pages/site/compose/BuildList.tsx:800 — drawn phone ? 44 : 32
- src/pages/site/compose/BuildList.tsx:1488 — drawn props.phone ? 44 : 32
- src/pages/site/compose/BuildList.tsx:2192 — drawn phone ? 44 : 32
- src/pages/site/compose/BuildList.tsx:2203 — drawn phone ? 44 : 32
- src/pages/site/compose/BuildList.tsx:2210 — drawn phone ? 44 : 32
- src/pages/site/compose/RuntimeFields.tsx:67 — drawn phone ? 44 : 32
- src/pages/site/compose/RuntimeFields.tsx:68 — drawn phone ? 44 : 32
- src/pages/site/compose/RuntimeFields.tsx:98 — drawn phone ? 44 : 32
- src/pages/site/compose/RuntimeFields.tsx:105 — drawn phone ? 44 : 32
- src/pages/site/compose/SessionsPanel.tsx:204 — drawn phone ? 44 : 32
- src/pages/site/compose/ReadFromBuild.tsx:95 — drawn phone ? 44 : 32
- src/pages/site/compose/ReadFromBuild.tsx:98 — drawn phone ? 44 : 32
- src/pages/site/compose/ReadFromBuild.tsx:119 — drawn phone ? 44 : 32
- src/pages/site/compose/ReadFromBuild.tsx:122 — drawn phone ? 44 : 32
- src/pages/site/compose/HelpersField.tsx:109 — drawn phone ? 44 : 32
- src/pages/site/compose/HelpersField.tsx:239 — drawn size
- src/pages/site/compose/HelpersField.tsx:240 — drawn size
- src/pages/site/compose/HelpersField.tsx:245 — drawn size
- src/pages/site/compose/DetailsReferences.tsx:145 — drawn 32
- src/pages/site/compose/DetailsReferences.tsx:158 — drawn 32
- src/pages/site/compose/CostFields.tsx:125 — drawn size
- src/pages/site/compose/CostFields.tsx:126 — drawn size
- src/pages/site/compose/ComposeView.tsx:674 — drawn 42

Drawn 28 → 24; drawn 30–42 → 32 with 12 padding (32 callers: padding 16 → 12); drawn 44/48 on desktop stays 36/16 (sign-in's provider and primary buttons are unchanged). On a phone every Button now keeps a 44 minimum height.

### Through Segmented.tsx
Drawn 28 now renders a 32 track with 24 items: compose/SessionMap.tsx:376, compose/SandboxView.tsx:747 (desktop), compose/ArchitectureMap.tsx:88, compose/RunsFields.tsx:158 (desktop), plus the in-area OpenBuilds callers. `alignItems: center` is now on every track (no visible change where items fill the track).

### Through controls.ts (the kit commit, 34bd633)
Every importer of ui/button, input, select, tabs, switch or dropdown-menu, or of menuItemStyle:
- src/components/AccountGateModal.tsx
- src/components/ChangelogTab.tsx
- src/components/CollabInvitePicker.tsx
- src/components/CommentsSection.tsx
- src/components/ContentBlockBuilder.tsx
- src/components/ContentBlockViewer.tsx
- src/components/DependencyPicker.tsx
- src/components/ErrorBoundary.tsx
- src/components/ExistingBlueprintSearch.tsx
- src/components/ProjectUploadForm.tsx
- src/components/SubmitToolModal.tsx
- src/components/WhatToExpectBuilder.tsx
- src/components/analytics/BuildAnalytics.tsx
- src/components/brand/GapMarker.tsx
- src/components/canvas/BlockContextMenu.tsx
- src/components/compose/AddNodeMenu.tsx
- src/components/compose/ImportDestination.tsx
- src/components/compose/IntakeProposal.tsx
- src/components/compose/PublishSheet.tsx
- src/components/compose/TreeNode.tsx
- src/components/content-detail/PrimitiveCommentDrawer.tsx
- src/components/dm/ShareToDMModal.tsx
- src/components/library/AddToCollectionDialog.tsx
- src/components/library/CollectionDialogs.tsx
- src/components/messages/MessageComposeModal.tsx
- src/components/messages/ThreadReferencePicker.tsx
- src/components/moderation/ReportDialog.tsx
- src/components/moderation/ReportsQueue.tsx
- src/components/post/PostCard.tsx
- src/components/profile/MakerFigures.tsx
- src/components/progress/ResetNote.tsx
- src/components/progress/SectionRefusal.tsx
- src/components/routing/RouteBoundary.tsx
- src/components/share/ShareMenu.tsx
- src/components/social/Comments.tsx
- src/pages/About.tsx
- src/pages/Admin.tsx
- src/pages/AdminLogin.tsx
- src/pages/ContentEdit.tsx
- src/pages/ImportPage.tsx
- src/pages/Messages.tsx
- src/pages/Onboarding.tsx
- src/pages/OnboardingProfile.tsx
- src/pages/PostPreview.tsx
- src/pages/ProjectDetail.tsx
- src/pages/PublishMetadata.tsx
- src/pages/Upload.tsx
- src/pages/dev/Kit.tsx
- src/pages/site/builds/BuildsFiltersView.tsx
- src/pages/site/builds/BuildsTableView.tsx
- src/pages/site/compose/StillOpenSpaces.tsx
- src/pages/site/drafts/DraftsView.tsx
- src/pages/site/openbuilds/AddToDraft.tsx
- src/pages/site/openbuilds/NewPostWindow.tsx
- src/pages/site/openbuilds/OpenBuildsFeedView.tsx
- src/pages/site/openbuilds/PostReplies.tsx
- src/pages/site/openbuilds/PostStepMenu.tsx
- src/pages/site/openbuilds/SpaceWindow.tsx
- src/pages/site/openbuilds/StepTileEditor.tsx
- src/pages/site/profile/ProfileFeed.tsx
- src/pages/site/profile/ProfileHead.tsx
- src/pages/site/settings/NotificationsView.tsx
- src/pages/site/settings/PrivacyView.tsx

## Q6: rows G5 does not name, the rule applied (written before the change)

Rule: a two-line row gets a 48 minimum; a one-line row is 32. Nothing on a Builds page. A phone value that already holds the 44 touch floor is kept.

**Two lines → minimum 48**
- library/LibraryView.tsx:274 collections (name over Public/Private): 40 → 48; its skeleton, library/LibraryFrame.tsx CollectionSkeletons, 40 → 48
- rebuild/FamilyPanel.tsx:281 family tree (title over maker · reproduced): 43 (44 on a phone) → 48

**One line → 32**
- library/LibraryView.tsx:221 kinds list: 34 → 32
- library/LibraryView.tsx:338 changes rows (tag, item · detail, age): 40 → 32
- library/LibraryView.tsx:569 detail rows (label, value): 36 → 32
- library/LibraryView.tsx:659 collection preview rows: 40 → 32
- home/HomeView.tsx:426 the one-column drafts line: 44 → 32
- home/HomeView.tsx:830 latest runs (chip, title · handle, age): 36 → 32; its loading rows in HomeFrame RightBones 36 → 32
- home/HomeView.tsx:962 published rows (title, date): 44 → 32
- openbuilds/OpenBuildsFeedView.tsx:79 the feed's side links: 40 → 32
- openbuilds/AttachPicker.tsx:33 picker rows: 36 → 32
- rebuild/ChangesPanel.tsx:86 change rows: 25 (30 on a phone) → 32
- build/BuildView.tsx:226 anatomy part rows: 33 → 32 (a phone keeps 44)
- build/ReplayBody.tsx:216 replay steps: 28 → 32 (a phone keeps 44)
- profile/CustomiseProfile.tsx:252, :284 pin and side-section rows: 44 → 32
- settings/SettingsFrame.tsx:77 settings nav links: 36 (line height 36) → 32

**Unchanged**
- Already 48 or more: home/HomeView.tsx:304 (52), :909 (56), activity/ActivityView.tsx:277, :287 (56), openbuilds/OpenBuildsFeedView.tsx:133 (52), profile/CustomiseProfile.tsx:211 (56)
- Tiles, not list rows: compare/CompareView.tsx:39, :45, openbuilds/LineUpSteps.tsx:47, :52
- A phone-only disclosure button, not a row: profile/ProfileSide.tsx:284 (44)

## Second round (the answers to the parked questions)

### Q1: Segmented callers that keep their own size (not drawn 28 on desktop)
Left as they are, as asked: sign-in changes in prompt 5, the Builds map waits on the BF spec.
- src/components/post/PostPreview.tsx:133 size=22
- src/components/connect/ConnectorGuide.tsx:297 size=34
- src/components/theme/ThemeSegmented.tsx:32 size=size
- src/pages/dev/catalogue/ControlsSection.tsx:75 size=34
- src/pages/dev/catalogue/ControlsSection.tsx:87 size=36
- src/pages/dev/catalogue/ControlsSection.tsx:101 size=32
- src/pages/site/builds/BuildsMapsView.tsx:242 size=30
- src/pages/site/compose/HelpersField.tsx:179 size=phone ? 50 : 32
- src/pages/site/compose/HelpersField.tsx:228 size=phone ? 50 : 32
- src/pages/site/compose/HelpersField.tsx:234 size=phone ? 50 : 32
- src/pages/site/compose/CostFields.tsx:103 size=phone ? 50 : 32
- src/pages/site/compose/CostFields.tsx:113 size=phone ? 50 : 32
- src/pages/site/compose/CostFields.tsx:121 size=phone ? 50 : 32
- src/pages/site/compose/CostFields.tsx:122 size=phone ? 50 : 32
- src/pages/site/compose/AddFromLibraryWindow.tsx:146 size=phone ? 40 : 32
- src/pages/site/signin/SignInView.tsx:175 size=size
- src/pages/site/compare/CompareView.tsx:88 size=50

### Q2
- PartViewer's View switch: drawn 28 on desktop, a 32 track with 24 items.
- UnderlineTabs: 40 → 32 (the build page's section tabs and the part viewer's tabs).
- Pill 18/6 → 20/8, TypeChip's 18 line box → 20 with 8 either side, CategoryChip 20/6 → 20/8. They render on no Builds page: none appears on the three Builds kit pages or the live /builds views, and no file under src/pages/site/builds imports them or a component that does. lookRules' two TypeChip entries quote the changed line, so their text follows it.
- PostCard's heading link: inline-block on a 24px line; the next line moves 0px. FeedPost's heading link is unchanged: its 28px title already gives a 36 high link, and a 24 line box would shrink that and make a wrapped title overlap itself by 4px a line.
- TextTabs: on a phone a 32 high tab keeps a 44 high hit area. The Builds table's tabs (the default 36) do not move.

### Q5: Button href
Button takes `href` and draws the same element as an anchor: a router link for a path on the site, a plain anchor for any other address and for anything that carries `download` (the router would take the click). On it now: Home's Sign in, Library's Open, Open source and the empty state's action, and the build's Download link (`download` rides on the anchor).

### Q7
Library's Version switch stays hand-built: Segmented's radio group moves with the arrow keys but has no Home and End.

### Noticed in the second round, left alone
- `npx tsc --noEmit -p tsconfig.app.json` ran out of the default Node heap once; it passes with `NODE_OPTIONS=--max-old-space-size=6144`.
- src/pages/site/build/BuildSteps.tsx imports `CONTROL` and does not use it (unused before this work).
- A gap part in the build's anatomy list is 35 high, not 32: its 1.5px dashed edge sits outside a content-box height by design.
- Home's drafts line, Library's rows and the other one-line rows now 32 high keep no 44 phone minimum; G8a covers controls, not rows.
