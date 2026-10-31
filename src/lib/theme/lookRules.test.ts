// CA-03 P1 — the look's rules as a test.
//
// Every source file CA-03 adds or changes is listed in CA03_FILES and read here as text. The rules are the prompt's
// "Never do these" and "Components: one way to draw each thing", where a regular expression can see them. Each
// failure names the file and the line.
//
// WHAT IS READ. Comments are blanked first (line breaks kept, so line numbers hold): a comment that says "no
// gradients" is not a gradient. Strings, JSX text and code are read as they are.
//
// THIS FILE IS NOT IN THE LIST. It has to spell out every pattern it forbids. Nor is compliance.test.ts (CA-06 P5
// and P6 add two capped entries to it), for the same reason: its allowlist quotes the values it allows.
//
// CA-06, THE ONE EXCEPTION TO "NO COLOURED CARD EDGES": a tile or a session may carry the colour its maker chose
// (`payload.colour`, `sessions_meta[key].colour`), drawn only through `borderFor` and `outlineFor` in
// src/lib/theme/partColour.ts. Nothing is coloured by default and no colour is chosen for the maker. The rule below
// lets a border's colour come from those helpers, or a token, and from nothing else.
//
// Two readings, said once here:
//   - `outline: "none"` (or 0) is the absence of an outline, which is what keeps the browser's own ring off; any
//     other outline value must come from `ring()`.
//   - The one upper-case style is `EYEBROW` in refinedStyles.ts, the Details eyebrow; everything else that is upper
//     case on the page spends it.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SPACE_REFINED } from "./space";

/** Every source file CA-03 and CA-04 add or change, from the repository root. */
export const CA03_FILES: readonly string[] = [
  // P2
  "src/components/brand/Segmented.tsx",
  "src/lib/theme/contrast.test.ts",
  "src/pages/site/compose/AddAgentDialog.test.tsx",
  "src/pages/site/compose/AddAgentDialog.tsx",
  "src/pages/site/compose/AddCodeDialog.test.tsx",
  "src/pages/site/compose/AddCodeDialog.tsx",
  "src/pages/site/compose/AddManualStepDialog.tsx",
  "src/pages/site/compose/AgentSetupFields.tsx",
  "src/pages/site/compose/BuildList.tsx",
  "src/pages/site/compose/ChoiceRows.tsx",
  "src/pages/site/compose/composeControls.tsx",
  "src/pages/site/compose/DetailsPanel.test.tsx",
  "src/pages/site/compose/DetailsPanel.tsx",
  "src/pages/site/compose/ModelPicker.tsx",
  "src/pages/site/compose/PickMenu.tsx",
  "src/pages/site/compose/refinedStyles.ts",
  // P3
  "src/lib/build/graph.test.ts",
  "src/lib/build/graph.ts",
  "src/lib/build/readerSteps.test.ts",
  "src/lib/build/readerSteps.ts",
  "src/pages/site/build/BuildSteps.test.tsx",
  "src/pages/site/build/readerSessions.test.tsx",
  "src/pages/site/build/BuildSteps.tsx",
  "src/pages/site/compose/BuildList.test.tsx",
  "src/pages/site/compose/detailsModel.test.ts",
  "src/pages/site/compose/detailsModel.ts",
  "src/pages/site/compose/refinedPieces.tsx",
  // P4
  "src/pages/site/compose/buildListModel.ts",
  // P5
  "src/components/build/renderers/evidence.tsx",
  "src/components/build/renderers/renderers.test.tsx",
  "src/dev/fixtures/buildSteps.tsx",
  "src/pages/dev/SandboxDemo.tsx",
  "src/pages/site/build/BuildView.test.tsx",
  "src/pages/site/compose/AddCheckDialog.test.tsx",
  "src/pages/site/compose/AddCheckDialog.tsx",
  "src/pages/site/compose/detailsView.ts",
  "src/pages/site/compose/SandboxPage.tsx",
  "src/pages/site/compose/SandboxView.test.tsx",
  "src/pages/site/compose/SandboxView.tsx",
  "src/pages/site/compose/useComposePrompts.ts",
  // P6
  "src/components/build/renderers/configuration.tsx",
  // P7
  "src/lib/build/outsideContent.test.ts",
  "src/lib/build/outsideContent.ts",
  "src/lib/build/shapes.test.ts",
  "src/lib/tools/registry.test.ts",
  "src/lib/tools/registry.ts",
  "src/pages/site/compose/OutsideWarning.tsx",
  // P8
  "src/lib/build/buildSummary.test.ts",
  "src/lib/build/buildSummary.ts",
  "src/pages/site/build/buildModel.ts",
  "src/pages/site/build/BuildView.tsx",
  // P9
  "src/dev/fixtures/shapes.ts",
  // CA-04 P1
  "src/components/build/FullPromptWindow.tsx",
  "src/lib/build/composePrompts.ts",
  "src/lib/build/making.test.ts",
  "src/lib/build/making.ts",
  "src/lib/build/onePrompt.snapshot.test.tsx",
  "src/pages/site/compose/sourcesModel.ts",
  // CA-04 P2
  "src/lib/build/copyTogether.ts",
  "src/lib/build/nest.test.ts",
  "src/lib/build/sentWithSuggest.ts",
  "src/pages/site/compose/BuildList.nest.test.tsx",
  "src/pages/site/compose/composeModel.ts",
  "src/pages/site/compose/listNest.tsx",
  // CA-04 P4
  "src/lib/build/setup.test.ts",
  "src/lib/build/setup.ts",
  "src/lib/build/setupFolder.ts",
  "src/lib/build/zip.ts",
  "src/pages/site/compose/dropFolders.ts",
  "src/pages/site/compose/setup.ui.test.tsx",
  // CA-04 P5
  "src/pages/site/compose/connection.test.tsx",
  // CA-04 P6
  "src/lib/build/runsFrom.test.ts",
  "src/lib/build/runsFrom.ts",
  "src/pages/site/compose/goal.ui.test.tsx",
  // CA-04 P7
  "src/pages/dev/BuildStepsDemo.tsx",
  // CA-05 P1
  "src/components/build/ChangedText.tsx",
  "src/components/build/FullPromptWindow.changes.test.tsx",
  "src/lib/build/changes.copy.test.ts",
  "src/lib/build/changes.test.ts",
  "src/lib/build/changes.ts",
  // CA-05 P2
  "src/lib/build/sessionFacts.test.ts",
  "src/lib/build/sessionFacts.ts",
  "src/pages/site/compose/SessionExtrasFields.tsx",
  "src/pages/site/compose/facts.ui.test.tsx",
  // CA-05 P3
  "src/lib/build/startedWith.test.ts",
  "src/lib/build/startedWith.ts",
  "src/pages/site/compose/started.ui.test.tsx",
  // CA-05 P4 wrote no code. CA-05 P5
  "src/pages/site/compose/together.ui.test.tsx",
  // CA-05 P7
  "src/lib/build/testCases.test.ts",
  "src/lib/build/testCases.ts",
  "src/pages/site/compose/checkRuns.ui.test.tsx",
  // CA-05 P8
  "src/lib/build/modelRun.test.ts",
  "src/lib/build/modelRun.ts",
  "src/pages/site/compose/ModelRunFields.tsx",
  "src/pages/site/compose/modelRun.ui.test.tsx",
  // CA-05 P9
  "src/pages/site/compose/AgentNotesFields.tsx",
  "src/pages/site/compose/agentNotes.ui.test.tsx",
  // CA-05 P10
  "src/pages/site/compose/trainedModel.ui.test.tsx",
  // CA-05 P11
  "src/lib/build/everything.test.ts",
  // CA-06 P1
  "src/components/post/editor/extensions.ts",
  "src/lib/build/onePrompt.composer.snapshot.test.tsx",
  "src/lib/build/thread.ts",
  "src/lib/build/threadRefs.test.tsx",
  // CA-06 P2
  "src/components/brand/glyphs.test.tsx",
  "src/components/brand/glyphs.ts",
  "src/components/post/editor/PostToolbar.tsx",
  "src/components/post/editor/ReferencePicker.tsx",
  "src/components/post/editor/references.test.tsx",
  "src/components/post/editor/references.ts",
  "src/components/post/editor/usePostEditor.ts",
  "src/lib/build/postRefs.ts",
  "src/pages/site/compose/PostTab.tsx",
  // CA-06 P3
  "e2e/tier3/post-links.spec.ts",
  "src/components/build/PartWindow.tsx",
  "src/components/build/partNav.tsx",
  "src/components/post/PostBody.tsx",
  "src/components/post/RefLinks.test.tsx",
  "src/components/post/RefLinks.tsx",
  "src/dev/fixtures/postLinks.ts",
  "src/dev/fixtures/parts.ts",
  "src/lib/theme/luminance.ts",
  "src/lib/theme/partColour.ts",
  "src/pages/dev/LinksDemo.tsx",
  "src/pages/site/build/BuildPage.tsx",
  "src/pages/site/build/useReaderPostLinks.ts",
  "src/pages/site/compose/usePostLinks.ts",
  // CA-06 P4
  "src/components/brand/ColourButton.tsx",
  "src/components/brand/IconButton.tsx",
  "src/lib/build/colour.test.ts",
  "src/lib/theme/partColour.test.ts",
  "src/pages/site/compose/SourcesPanel.tsx",
  "src/pages/site/compose/colour.ui.test.tsx",
  // CA-06 P5
  "src/components/brand/ColourPicker.test.tsx",
  "src/components/brand/ColourPicker.tsx",
  "src/components/brand/useColourSwatches.ts",
  "src/lib/build/colourPreview.ts",
  "src/lib/theme/colourWheel.ts",
  "src/pages/site/compose/useColourPicking.tsx",
  // CA-06 P6
  "src/lib/profile/colourSwatches.test.tsx",
  "src/lib/profile/colourSwatches.ts",
  // CA-06 P7
  "e2e/audit/support/harness.ts",
  // CA-07 P1
  "src/components/post/postType.ts",
  "src/pages/site/compose/PostTab.proportions.test.tsx",
  "src/pages/site/compose/PostTab.test.tsx",
  "src/pages/site/compose/PostTab.preview.test.tsx",
  // CA-07 P2
  "src/components/post/editor/BlockHandle.tsx",
  "src/components/post/editor/GridView.tsx",
  "src/components/post/editor/SlashMenu.tsx",
  "src/components/post/editor/gridShape.test.tsx",
  "src/components/post/editor/pictures.ts",
  "src/lib/build/threadEditor.ts",
  "src/lib/build/toGrids.test.ts",
  "src/pages/site/compose/PostTab.bars.test.tsx",
  // CA-07 P3
  "src/components/post/PostBody.tsx",
  "src/components/post/post.test.tsx",
  "src/components/post/media/GridTile.tsx",
  "src/components/post/media/PostMediaGrid.test.tsx",
  "src/components/post/media/PostMediaGrid.tsx",
  "src/components/post/media/cropStyle.test.ts",
  "src/components/post/media/cropStyle.ts",
  "src/components/post/media/shade.ts",
  // CA-07 P4
  "src/pages/site/compose/PostTab.grid.test.tsx",
  // CA-07 P5
  "src/components/brand/UnderlineTabs.tsx",
  "src/components/post/media/EditMediaDialog.test.tsx",
  "src/components/post/media/EditMediaDialog.tsx",
  // CA-07 P6
  "src/components/post/media/gridLinks.test.tsx",
  "src/lib/build/gridSteps.ts",
  // CA-07 P7
  "src/components/gallery/FeedPost.tsx",
  "src/components/post/PostThread.tsx",
  "src/components/post/media/AltSheet.tsx",
  "src/components/post/media/MediaViewer.tsx",
  "src/components/post/media/readers.test.tsx",
  // CA-07 P8
  "src/lib/build/postMedia.ts",
  "src/lib/build/postMedia.test.ts",
  "src/pages/dev/PostThreadDemo.tsx",
  // CA-07 P9
  "e2e/tier1/post-thread.spec.ts",
  // CA-10 P1
  "src/App.tsx",
  "src/components/brand/ErrorState.tsx",
  "src/dev/fixtures/drafts.ts",
  // SV-18
  "src/dev/fixtures/vision/composer-add-from-library.ts",
  "src/pages/dev/VisionComposerAddFromLibrary.tsx",
  "src/pages/site/compose/AddFromLibrary.tsx",
  "src/pages/site/compose/AddFromLibraryWindow.tsx",
  "src/pages/site/compose/libraryWindowModel.ts",
  // SV-08
  "src/dev/fixtures/vision/drafts.ts",
  "src/pages/dev/VisionDrafts.tsx",
  "src/pages/site/drafts/DraftsView.behaviour.test.tsx",
  "src/pages/site/drafts/draftsModel.ts",
  "src/hooks/useLibrarySessions.ts",
  "src/hooks/useWaitingSessions.test.tsx",
  "src/hooks/useWaitingSessions.ts",
  "src/lib/build/__audit__/fakeSupabase.ts",
  "src/pages/site/compose/ComposePage.tsx",
  "src/pages/site/compose/useComposeSessions.ts",
  // CA-25 P4
  "e2e/audit/composer-ca25-shots.spec.ts",
  "src/pages/dev/Ca25Demo.tsx",
  "src/pages/dev/SandboxDemo.tsx",
  // CA-25 P3
  "src/components/compose/SequenceView.test.tsx",
  "src/components/compose/TrayDrop.test.tsx",
  "src/hooks/useComposeBuild.ts",
  "src/hooks/useComposeBuild.unpublish.test.tsx",
  "src/pages/site/compose/BuildTitleActions.tsx",
  "src/pages/site/compose/PublishedMenu.tsx",
  "src/pages/site/compose/ca25.p3.test.tsx",
  // CA-25 P2
  "e2e/tier1/post-thread.spec.ts",
  "src/pages/site/compose/PublishConfirm.tsx",
  "src/pages/site/compose/ca25.p2.test.tsx",
  // CA-25 P1
  "e2e/tier3/compose-v2.spec.ts",
  "src/lib/build/publishChecklist.test.ts",
  "src/lib/build/publishChecklist.ts",
  "src/lib/build/runtimeChecks.ts",
  "src/pages/site/compose/ComposePage.tsx",
  "src/pages/site/compose/PublishChecklist.tsx",
  "src/pages/site/compose/SandboxPage.tsx",
  "src/pages/site/compose/SandboxView.tsx",
  "src/pages/site/compose/ca25.p1.test.tsx",
  "src/pages/site/compose/composeModel.test.ts",
  "src/pages/site/compose/composeModel.ts",
  "src/pages/site/compose/useBuildSelection.ts",
  // CA-24 P5
  "e2e/audit/composer-ca24-shots.spec.ts",
  "src/pages/dev/Ca24Demo.tsx",
  "src/pages/dev/SandboxDemo.tsx",
  // CA-24 P4
  "src/pages/site/compose/ImportingPieces.test.tsx",
  "src/pages/site/compose/ImportingPieces.tsx",
  "src/pages/site/compose/SessionHead.tsx",
  "src/pages/site/compose/SourcesPanel.test.tsx",
  "src/pages/site/compose/arrival.tsx",
  "src/pages/site/compose/ca24.p4.test.tsx",
  "src/pages/site/drafts/DraftsPage.tsx",
  "src/pages/site/drafts/DraftsView.test.tsx",
  "src/pages/site/drafts/DraftsView.tsx",
  "src/pages/site/drafts/__audit__/DraftsPage.ca09.audit.test.tsx",
  "src/hooks/useOnScreen.ts",
  "src/lib/errors/code.ts",
  "src/pages/site/drafts/DraftsPage.test.tsx",
  // CA-10 P2
  "src/components/brand/MenuButton.tsx",
  "src/components/post/editor/FormatBar.tsx",
  "src/components/shell/Dock.tsx",
  "src/components/shell/MobileHeader.tsx",
  "src/components/shell/SiteFrame.tsx",
  "src/components/shell/SiteHeader.tsx",
  "src/components/brand/BottomSheet.tsx",
  "src/components/shell/chromeSize.ts",
  "src/pages/site/compose/ComposeMenu.tsx",
  "src/pages/site/compose/composeChrome.ts",
  // CA-10 P3
  "src/dev/fixtures/sandbox.ts",
  "src/pages/site/compose/SessionsPanel.tsx",
  // CA-10 P3
  "src/pages/site/compose/SandboxPage.add.test.tsx",
  "src/pages/site/compose/draftStart.ts",
  "src/pages/site/compose/useComposeDetails.ts",
  // CA-10 P4
  "src/hooks/useComposeBuild.ts",
  "src/hooks/useComposeBuild.save.test.tsx",
  "src/lib/build/builds.ts",
  "src/components/compose/SequenceView.test.tsx",
  "src/components/compose/TrayDrop.test.tsx",
  // CA-10 P4
  "src/components/compose/Publish.test.tsx",
  // CA-10 P5
  "src/hooks/usePresence.ts",
  "src/hooks/usePresence.test.tsx",
  // CA-11 (artefact.tsx and RunBody.tsx changed too, but still carry older-look values on lines CA-11 did not touch)
  "src/components/build/PartWindow.tsx",
  "src/components/code/CodeEditorField.test.tsx",
  "src/components/code/CodeEditorField.tsx",
  "src/components/code/CodeGutter.tsx",
  "src/components/code/CodeLines.test.tsx",
  "src/components/code/CodeLines.tsx",
  "src/components/code/lineModel.ts",
  "src/pages/site/compose/BuildList.nest.test.tsx",
  // CA-12 P2
  "src/pages/site/compose/SandboxView.tsx",
  "src/pages/site/compose/SourcesPanel.test.tsx",
  "src/pages/site/drafts/DraftsPage.tsx",
  // CA-12 P3
  "src/pages/site/compose/SandboxPage.tsx",
  "src/pages/site/compose/ToolPicker.tsx",
  "src/pages/site/compose/SandboxPage.sessions.test.tsx",
  // CA-12 P4, P5
  "src/pages/site/compose/AddSessionRow.tsx",
  "src/pages/site/compose/buildListModel.ts",
  "src/pages/site/compose/useComposeSessions.ts",
  "src/pages/site/compose/SandboxView.test.tsx",
  // CA-12 P6 to P13
  "src/components/build/tileBodies.tsx",
  "src/pages/site/compose/AddToolDialog.tsx",
  "src/pages/site/compose/AddToolDialog.test.tsx",
  "src/pages/site/compose/AddManualStepDialog.tsx",
  "src/pages/site/compose/AgentSetupFields.tsx",
  "src/components/build/FullPromptWindow.tsx",
  "src/pages/site/build/BuildSteps.tsx",
  "src/pages/site/compose/AddAgentDialog.tsx",
  "src/pages/site/compose/AddCheckDialog.tsx",
  "src/pages/site/compose/BuildList.tsx",
  "src/pages/site/compose/DetailsPanel.tsx",
  "src/pages/site/compose/CheckCasesField.tsx",
  "src/pages/site/compose/CheckCasesField.test.tsx",
  // CA-12 P9
  "src/pages/site/compose/AddResultDialog.tsx",
  "src/pages/site/compose/AddResultDialog.test.tsx",
  // CA-13 P1 to P4
  "src/components/build/Certainty.tsx",
  "src/components/build/BranchRows.tsx",
  "src/components/build/LinkLines.tsx",
  "src/pages/site/compose/DecisionFields.tsx",
  "src/pages/site/compose/AddDecisionDialog.tsx",
  "src/pages/site/compose/RunsWhenField.tsx",
  "src/pages/site/compose/toolPickerModel.ts",
  // CA-13 P5 to P8
  "src/components/build/RuntimeChips.tsx",
  "src/pages/site/compose/HelpersField.tsx",
  "src/pages/site/compose/CostFields.tsx",
  "src/pages/site/compose/RuntimeFields.tsx",
  "src/pages/site/compose/SessionExtrasFields.tsx",
  "src/pages/site/compose/AddAgentDialog.tsx",
  "src/pages/site/compose/AgentSetupFields.tsx",
  // CA-13 P8, P9
  "src/components/build/CostLines.tsx",
  "src/pages/site/compare/CompareView.tsx",
  "src/pages/site/compare/ComparePage.tsx",
  "src/pages/site/build/BuildView.tsx",
  "src/components/build/FullPromptWindow.tsx",
  // CA-13 P11, P12
  "src/components/gallery/PatternMarks.tsx",
  // CA-14 P5 to P8
  "src/lib/build/patternsWrite.ts",
  "src/pages/site/build/useReaderPostLinks.ts",
  "src/pages/site/compare/ComparePage.tsx",
  "src/components/build/SessionJump.tsx",
  "src/dev/fixtures/sandbox.ts",
  "src/lib/build/sessionEdit.test.ts",
  "src/pages/site/compose/AddSessionRow.test.tsx",
  "src/pages/site/compose/AddSessionRow.tsx",
  "src/pages/site/compose/SandboxView.test.tsx",
  "src/pages/site/compose/SandboxView.tsx",
  "src/pages/site/compose/SourcesPanel.budget.test.tsx",
  "src/pages/site/compose/SourcesPanel.test.tsx",
  "src/pages/site/compose/titleRepeats.test.tsx",
  "src/pages/site/drafts/draftsModel.ts",
  // CA-14 P2 to P4
  "src/lib/build/sessionEdit.ts",
  "src/pages/site/build/BuildSteps.test.tsx",
  "src/pages/site/build/readerSessions.test.tsx",
  "src/pages/site/build/BuildSteps.tsx",
  "src/pages/site/compose/BuildList.test.tsx",
  "src/pages/site/compose/BuildList.tsx",
  "src/pages/site/compose/SandboxPage.sessions.test.tsx",
  "src/pages/site/compose/SandboxPage.sessionEdits.test.tsx",
  "src/pages/site/compose/SessionHead.test.tsx",
  "src/pages/site/compose/SessionHead.tsx",
  "src/pages/site/compose/ToolPicker.tsx",
  "src/pages/site/compose/buildListModel.ts",
  "src/pages/site/compose/colour.ui.test.tsx",
  "src/pages/site/compose/listNest.tsx",
  "src/pages/site/compose/useSessionEdits.ts",
  "src/pages/site/compose/viewOptions.test.ts",
  "src/pages/site/compose/viewOptions.ts",
  "src/lib/build/shapes.test.ts",
  // CA-14 P1
  "src/lib/build/addSession.ts",
  "src/pages/site/build/buildModel.ts",
  "src/lib/build/graph.ts",
  "src/lib/build/making.ts",
  "src/lib/build/readerSteps.ts",
  "src/lib/build/sessionLayout.test.ts",
  "src/lib/build/sessionLayout.ts",
  "src/pages/site/compose/SandboxPage.tsx",
  "src/pages/site/compose/sourcesModel.ts",
  // CA-16b
  "src/components/classify/ClassificationBits.tsx",
  "src/pages/site/compose/CardPreview.tsx",
  "src/pages/site/compose/ClassificationPicker.tsx",
  "src/pages/site/compose/ReadFromBuild.tsx",
  "src/pages/site/compose/SandboxCard.tsx",
  "src/pages/site/compose/classificationPieces.tsx",
  // CA-15b P1 (the token files hold raw values by design and are held by css-parity and contrast instead)
  "src/pages/site/compose/ChoiceGrid.tsx",
  "src/pages/site/compose/ModalFrame.tsx",
  "src/pages/site/compose/modalRecipes.test.tsx",
  "src/pages/site/compose/modalRecipes.tsx",
  "src/pages/site/compose/OptionalSection.test.tsx",
  "src/pages/site/compose/OptionalSection.tsx",
  "src/components/build/FullPromptWindow.optional.test.tsx",
  "src/pages/site/compose/AddToolDialog.test.tsx",
  // CA-15b P2
  "src/pages/site/compose/AddDatasetDialog.tsx",
  "src/pages/site/compose/AddRepoDialog.tsx",
  "src/pages/site/compose/AddResultDialog.tsx",
  "src/pages/site/compose/AddSystemPromptDialog.tsx",
  "src/pages/site/compose/AddDecisionDialog.tsx",
  "src/pages/site/compose/DecisionFields.tsx",
  "src/pages/site/compose/AddSourceDialogs.test.tsx",
  "src/pages/site/compose/AddResultDialog.test.tsx",
  "src/pages/site/compose/AddDecisionDialog.test.tsx",
  "src/pages/site/compose/AddManualStepDialog.test.tsx",
  "src/pages/site/compose/modalBoards.test.tsx",
  "src/pages/site/compose/detailsOptional.test.tsx",
  "src/pages/site/compose/PickMenu.tsx",
  "src/pages/site/compose/ModelPicker.tsx",
  "src/pages/site/compose/AgentSetupFields.tsx",
  "src/components/build/FullPromptWindow.tsx",
  "src/components/build/FullPromptWindow.refined.test.tsx",
  // CA-15b P3
  "src/pages/site/compose/tileRecipes.tsx",
  "src/pages/site/compose/tileRecipes.test.tsx",
  "src/components/build/tileBodies.tsx",
  "src/lib/build/tileLines.ts",
  "src/lib/build/tileLines.test.ts",
  "src/pages/site/compose/SessionHead.tsx",
  "src/pages/site/compose/BuildList.lighter.test.tsx",
  "src/pages/site/compose/BuildList.sources.test.tsx",
  "src/pages/site/compose/BuildList.nest.test.tsx",
  "src/pages/site/compose/checkRuns.ui.test.tsx",
  "src/lib/build/onePrompt.snapshot.test.tsx",
  // CA-15b P4
  "src/pages/dev/ModalsDemo.tsx",
  // CA-17 P1
  "src/lib/build/making.ts",
  "src/lib/build/workstreams.ts",
  "src/lib/build/workstreams.test.ts",
  "src/lib/build/stages.ts",
  "src/lib/build/stages.test.ts",
  // CA-17 P2
  "src/lib/theme/partColour.ts",
  "src/pages/site/compose/WorkstreamHead.tsx",
  "src/pages/site/compose/workstreamRecipes.ts",
  "src/pages/site/compose/partsModel.ts",
  "src/pages/site/compose/BuildList.parts.test.tsx",
  "src/pages/site/compose/SandboxPage.parts.test.tsx",
  "src/pages/site/compose/SandboxPage.tsx",
  "src/pages/site/compose/SandboxView.tsx",
  "src/pages/site/compose/AddSessionRow.tsx",
  "src/pages/site/compose/listNest.tsx",
  "src/pages/site/compose/useSessionEdits.ts",
  // CA-17 P3
  "src/lib/build/addSession.ts",
  "src/components/brand/MenuButton.tsx",
  "src/pages/site/compose/SourcesPanel.tsx",
  "src/pages/site/compose/AddSessionRow.parts.test.tsx",
  // CA-17 P4
  "src/lib/build/sessionMap.ts",
  "src/lib/build/sessionMap.test.ts",
  "src/components/brand/glyphs.ts",
  "src/pages/site/compose/SessionMap.tsx",
  "src/pages/site/compose/SessionMapPanel.tsx",
  "src/pages/site/compose/mapRecipes.ts",
  "src/pages/site/compose/SessionMap.test.tsx",
  "src/pages/site/build/ReaderMap.test.tsx",
  "src/pages/dev/DevMap.tsx",
  "src/pages/site/build/ReaderMap.tsx",
  // CA-17 P5
  "src/lib/build/postRefs.parts.test.ts",
  "src/components/post/RefLinks.parts.test.tsx",
  "src/components/post/editor/ReferencePicker.parts.test.tsx",
  "src/components/brand/ColourPicker.part.test.tsx",
  "src/pages/site/compose/partsModel.test.ts",
  // CA-17 P6
  "src/pages/site/compose/tabRowRecipes.ts",
  "src/pages/site/build/readerParts.test.tsx",
  // CA-18 P1
  "src/lib/build/tileSections.ts",
  "src/lib/build/tileSections.test.ts",
  "src/dev/fixtures/detailsKinds.ts",
  // CA-18 P2
  "src/pages/site/compose/detailsRecipes.ts",
  "src/pages/site/compose/editBuffer.ts",
  "src/pages/site/compose/editBuffer.test.ts",
  "src/pages/site/compose/editHandlers.ts",
  "src/pages/site/compose/editKit.tsx",
  "src/pages/site/compose/tileEdits.ts",
  "src/pages/site/compose/TileEditDialog.tsx",
  "src/pages/site/compose/TileEditDialog.test.tsx",
  "src/pages/site/compose/SessionDialog.tsx",
  "src/pages/site/compose/SessionDialog.test.tsx",
  "src/pages/site/compose/tileSections.match.test.tsx",
  "src/pages/site/compose/BuildList.edit.test.tsx",
  "src/components/build/FullPromptWindow.sections.test.tsx",
  "src/pages/site/compose/SessionExtrasFields.tsx",
  "src/pages/site/compose/PairNote.tsx",
  "src/pages/site/compose/RunsFields.tsx",
  "src/pages/site/compose/ModalFrame.tsx",
  "src/pages/site/compose/AddToolDialog.tsx",
  "src/pages/site/compose/AddManualStepDialog.tsx",
  "src/pages/site/compose/AddCodeDialog.tsx",
  "src/pages/site/compose/AddCheckDialog.tsx",
  "src/pages/site/compose/AddAgentDialog.tsx",
  "src/pages/site/compose/AddResultDialog.tsx",
  "src/pages/site/compose/AddSystemPromptDialog.tsx",
  "src/pages/site/compose/AddDatasetDialog.tsx",
  "src/pages/site/compose/AddRepoDialog.tsx",
  "src/pages/site/compose/AddDecisionDialog.tsx",
  "src/pages/site/compose/runtimeView.ts",
  "src/pages/site/compose/SessionHead.tsx",
  "src/pages/site/compose/BuildList.tsx",
  "src/pages/site/compose/SandboxPage.tsx",
  "src/pages/site/compose/DetailsPanel.tsx",
  "src/pages/site/compose/detailsView.ts",
  "src/components/build/FullPromptWindow.tsx",
  // CA-18 P5
  "src/components/shell/siteFrame.wide.test.tsx",
  "src/pages/site/compose/DetailsOverlay.tsx",
  "src/pages/site/compose/DetailsOverlay.test.tsx",
  // CA-18 P4
  "src/pages/site/compose/detailsLayout.ts",
  "src/pages/site/compose/detailsLayout.test.ts",
  // CA-18b P3
  "src/pages/site/compose/DetailsReferences.tsx",
  "src/pages/site/compose/DetailsReferences.test.tsx",
  "src/pages/site/compose/detailsReferences.ts",
  "src/pages/site/compose/DetailsAside.tsx",
  "src/pages/site/compose/SandboxView.tsx",
  "src/pages/site/compose/SandboxView.test.tsx",
  "src/pages/site/compose/ComposeRoute.tsx",
  "src/components/shell/SiteFrame.tsx",
  // CA-19 P1
  "src/lib/build/referenceGroups.ts",
  "src/lib/build/referenceGroups.test.ts",
  "src/lib/build/linkRules.ts",
  "src/lib/build/linkRules.test.ts",
  "src/lib/build/thread.ts",
  "src/components/post/editor/extensions.ts",
  // CA-19 P2
  "src/lib/build/referenceHistory.ts",
  "src/lib/build/referenceHistory.test.tsx",
  "src/pages/site/compose/useReferenceHistory.ts",
  "src/pages/site/compose/referencePieces.tsx",
  "src/components/brand/glyphs.ts",
  // CA-19 P3
  "src/components/post/editor/LinkPanel.tsx",
  "src/components/post/editor/LinkPanel.test.tsx",
  "src/components/post/editor/PostToolbar.tsx",
  "src/components/post/editor/references.test.tsx",
  "src/components/post/RefLinks.tsx",
  "src/components/build/partNav.tsx",
  "src/components/brand/Glyph.tsx",
  "src/components/brand/glyphs.test.tsx",
  "src/lib/build/postRefs.ts",
  "src/lib/build/referenceGroupsWrite.ts",
  "src/pages/site/compose/PostTab.tsx",
  "src/pages/site/compose/usePostLinks.ts",
  "src/pages/site/compose/useReferences.ts",
  "src/pages/site/compose/SandboxPage.tsx",
  "src/pages/site/build/useReaderPostLinks.ts",
  // CA-19 P4
  "src/components/brand/ColourPicker.references.test.tsx",
  "src/pages/site/compose/useReferenceActions.tsx",
  "src/pages/site/compose/referenceActions.ui.test.tsx",
  "src/pages/dev/ReferencesDemo.tsx",
  "src/dev/fixtures/references.ts",
  "src/pages/dev/SandboxDemo.tsx",
  "src/components/brand/ColourPicker.part.test.tsx",
  // CA-19 P5
  "src/pages/site/compose/groupLabels.tsx",
  "src/pages/site/compose/groupLabels.ui.test.tsx",
  // CA-19 P6
  "src/pages/site/compose/ReferenceGroupWindow.tsx",
  "src/pages/site/compose/ReferenceGroupWindow.test.tsx",
  "src/pages/site/compose/ReferenceWindows.tsx",
  "src/pages/site/compose/referencePieces.test.tsx",
  // CA-19 P7
  "src/pages/site/compose/ColoursWindow.tsx",
  "src/pages/site/compose/ColoursWindow.test.tsx",
  // CA-19 P8
  "src/lib/theme/partColour.ts",
  "src/lib/theme/groupLabelContrast.test.ts",
  // CA-20
  "src/lib/build/componentMenus.ts",
  "src/pages/site/compose/ca20.p1.test.tsx",
  "src/pages/site/compose/ca20Harness.tsx",
  "src/pages/site/compose/removePieces.tsx",
  "src/lib/build/buildHistory.ts",
  "src/lib/build/buildSnapshot.ts",
  "src/lib/build/referenceBridge.ts",
  "src/lib/build/removeNodes.ts",
  "src/pages/site/compose/ca20.p2.test.tsx",
  "src/pages/site/compose/ca20Fixture.ts",
  "src/pages/site/compose/useBuildActions.tsx",
  "src/pages/site/compose/useBuildHistory.ts",
  "src/pages/site/compose/useReferenceBridge.ts",
  "src/lib/build/buildSelection.ts",
  "src/pages/site/compose/ca20.p3.test.tsx",
  "src/pages/site/compose/useBuildSelection.ts",
  "src/pages/site/compose/BuildTitleActions.tsx",
  "src/pages/site/compose/ClearBuildDialog.tsx",
  "src/pages/site/compose/ca20.p4.test.tsx",
  "src/lib/build/stepSentences.ts",
  "src/pages/site/compose/ca20.p5.test.tsx",
  "src/lib/build/removedLog.ts",
  "src/pages/site/compose/RecentlyRemovedDialog.tsx",
  "src/pages/site/compose/ca20.p6.test.tsx",
  "src/lib/build/duplicate.ts",
  "src/pages/site/compose/ConvertWindow.tsx",
  "src/lib/build/shortcuts.ts",
  "src/pages/site/compose/ShortcutsDialog.tsx",
  "src/pages/site/compose/useBuildShortcuts.ts",
  // CA-23 P1
  "src/hooks/useComposeBuild.ts",
  "src/hooks/useComposeBuild.save.test.tsx",
  "src/pages/site/compose/ComposePage.tsx",
  "src/pages/site/compose/ComposeView.test.tsx",
  "src/pages/site/compose/SandboxPage.tsx",
  "src/pages/site/compose/SandboxView.test.tsx",
  "src/pages/site/compose/SandboxView.tsx",
  "src/pages/site/compose/SaveLine.tsx",
  "src/pages/site/compose/composeModel.ts",
  "src/pages/site/compose/saveLine.test.tsx",
  "src/pages/site/compose/useComposeThread.test.tsx",
  "src/pages/site/compose/useComposeThread.ts",
  "src/pages/site/compose/useSaveLine.ts",
  // CA-23 P2
  "src/lib/build/connection.ts",
  "src/lib/build/connection.test.ts",
  "src/lib/build/pendingWrites.ts",
  "src/lib/build/pendingWrites.test.ts",
  "src/lib/build/reconnect.ts",
  "src/lib/build/reconnect.test.ts",
  "src/lib/build/writeGuard.ts",
  "src/lib/build/writeGuard.test.ts",
  "src/pages/site/compose/ca23.harness.tsx",
  "src/pages/site/compose/ca23.p2.test.tsx",
  "src/pages/site/compose/referencePieces.tsx",
  "src/pages/site/compose/saveStrips.tsx",
  "src/pages/site/compose/saveStrips.test.tsx",
  "src/pages/site/compose/useBuildHistory.ts",
  "src/pages/site/compose/useClassificationCard.ts",
  "src/pages/site/compose/useComposeNodes.ts",
  "src/pages/site/compose/useComposeNodes.count.test.tsx",
  "src/pages/site/compose/useComposeSessions.ts",
  "src/pages/site/compose/usePendingWrites.ts",
  "src/pages/site/compose/useWriteGuard.ts",
  // CA-23 P3
  "src/pages/site/compose/ca23.p3.page.test.tsx",
  "src/pages/site/compose/ca23.p3.test.tsx",
  "src/pages/site/compose/saveWindows.tsx",
  // CA-26 P5
  "e2e/audit/composer-ca26-shots.spec.ts",
  "src/pages/site/compose/removePieces.tsx",
  "e2e/audit/composer-ca26-touch.spec.ts",
  "e2e/audit/support/harness.ts",
  "src/pages/dev/KitPages.tsx",
  "src/pages/dev/MotionDemo.tsx",
  "src/pages/site/compose/BuildTitleActions.tsx",
  "src/pages/site/compose/ComposeMenu.tsx",
  "src/pages/site/compose/ca26.p5.test.tsx",
  "src/pages/site/compose/listNest.tsx",
  "src/pages/site/compose/modalRecipes.tsx",
  "src/pages/site/compose/tileRecipes.tsx",
  // CA-26 P4
  "src/pages/site/compose/AgentSetupFields.tsx",
  "src/pages/site/compose/BuildAnnouncer.tsx",
  "src/pages/site/compose/DetailsPanel.test.tsx",
  "src/pages/site/compose/DetailsPanel.tsx",
  "src/pages/site/compose/SandboxPage.tsx",
  "src/pages/site/compose/SaveLine.tsx",
  "src/pages/site/compose/ca26.p4.test.tsx",
  // CA-26 P3
  "src/components/brand/ColourButton.tsx",
  "src/pages/site/compose/BuildList.lighter.test.tsx",
  "src/pages/site/compose/BuildList.nest.test.tsx",
  "src/pages/site/compose/BuildList.parts.test.tsx",
  "src/pages/site/compose/OptionalSection.test.tsx",
  "src/pages/site/compose/PostTab.preview.test.tsx",
  "src/pages/site/compose/ReferenceGroupWindow.test.tsx",
  "src/pages/site/compose/SandboxCard.test.tsx",
  "src/pages/site/compose/SandboxPage.parts.test.tsx",
  "src/pages/site/compose/ca26.p3.test.tsx",
  "src/pages/site/compose/colour.ui.test.tsx",
  "src/pages/site/compose/modalBoards.test.tsx",
  "src/pages/site/compose/referenceActions.ui.test.tsx",
  "src/pages/site/compose/useLeaveGuard.ts",
  // CA-23 P4
  "e2e/tier3/two-tabs.spec.ts",
  "src/lib/build/builds.ts",
  "src/lib/build/clash.test.ts",
  "src/lib/build/clash.ts",
  "src/lib/build/clashView.test.ts",
  "src/lib/build/clashView.ts",
  "src/lib/build/nodes.ts",
  "src/lib/build/removedLog.ts",
  "src/lib/build/sessionEdit.ts",
  "src/lib/build/staleWrites.test.ts",
  "src/lib/build/staleWrites.ts",
  "src/lib/build/tabSync.test.ts",
  "src/lib/build/tabSync.ts",
  "src/pages/site/compose/ClashWindow.tsx",
  "src/pages/site/compose/ca23.p4.test.tsx",
  "src/pages/site/compose/useTwoTabs.tsx",
  // CA-23 P5
  "src/pages/dev/SavingDemo.tsx",
  // CA-24 P1
  "e2e/audit/composer-ca24-loading.spec.ts",
  "src/pages/site/compose/ComposeRoute.tsx",
  "src/pages/site/compose/ComposeSkeleton.test.tsx",
  "src/pages/site/compose/ComposeSkeleton.tsx",
  "src/pages/site/compose/DetailsPanel.tsx",
  "src/pages/site/compose/LoadingBlocks.test.tsx",
  "src/pages/site/compose/LoadingBlocks.tsx",
  "src/pages/site/compose/SandboxView.tsx",
  "src/pages/site/compose/SessionDialog.tsx",
  "src/pages/site/compose/SessionMap.tsx",
  "src/pages/site/compose/SourcesPanel.tsx",
  "src/pages/site/compose/loadingBlocks.test.ts",
  "src/pages/site/compose/loadingBlocks.ts",
  // CA-24 P2
  "src/pages/site/compose/AddSessionRow.tsx",
  "src/pages/site/compose/EmptyBuild.test.tsx",
  "src/pages/site/compose/EmptyBuild.tsx",
  "src/pages/site/compose/SandboxPage.add.test.tsx",
  "src/pages/site/compose/SandboxPage.empty.test.tsx",
  "src/pages/site/compose/SandboxPage.parts.test.tsx",
  "src/pages/site/compose/SandboxPage.sessionEdits.test.tsx",
  "src/pages/site/compose/SandboxPage.sessions.test.tsx",
  "src/pages/site/compose/ca20Harness.tsx",
  "src/pages/site/compose/ca21.p7.test.tsx",
  "src/pages/site/compose/emptyBuildRecipes.ts",
  // CA-24 P3
  "src/pages/site/compose/PanelBoundary.test.tsx",
  "src/pages/site/compose/PanelBoundary.tsx",
  "src/pages/site/compose/PostTab.tsx",
  "src/pages/site/compose/useComposeSessions.ts",
  // CA-26 P1
  "src/components/shell/SiteFrame.tsx",
  "src/pages/site/compose/BuildList.tsx",
  "src/pages/site/compose/ComposeRoute.tsx",
  "src/pages/site/compose/SessionHead.tsx",
  "src/pages/site/compose/WorkstreamHead.tsx",
  "src/pages/site/compose/buildFocus.tsx",
  "src/pages/site/compose/ca26.p1.test.tsx",
  // CA-26 P2
  "src/components/brand/BottomSheet.tsx",
  "src/components/shell/BottomSheet.tsx",
  "src/lib/focus/buildItems.ts",
  "src/lib/focus/windowFocus.ts",
  "src/pages/site/compose/DetailsOverlay.tsx",
  "src/pages/site/compose/ModalFrame.tsx",
  "src/pages/site/compose/PublishChecklist.tsx",
  "src/pages/site/compose/ca26.menuHost.tsx",
  "src/pages/site/compose/ca26.p2.test.tsx",
  "src/pages/site/compose/referencePieces.tsx",
  "src/pages/site/compose/removePieces.tsx",
  "src/pages/site/compose/saveWindows.tsx",

  // CA-27 P1
  "src/components/build/FindHit.tsx",
  "src/dev/fixtures/ca27.ts",
  "src/lib/build/findInBuild.ts",
  "src/pages/site/compose/FindField.tsx",
  "src/pages/site/compose/ca27.p1.page.test.tsx",
  "src/pages/site/compose/ca27.p1.test.tsx",
  "src/pages/site/compose/findIndex.ts",
  "src/pages/site/compose/useBuildFind.ts",

  // CA-27 P2
  "e2e/audit/composer-ca27.spec.ts",
  "src/lib/theme/truncate.ts",
  "src/pages/site/compose/ca27.p2.test.tsx",

  // CA-27 P3
  "src/pages/site/compose/buildMotion.tsx",
  "src/pages/site/compose/ca27.p3.test.tsx",
  "src/pages/site/compose/largeBuild.tsx",

  // CA-27 P4
  "src/pages/site/compose/ca27.p4.test.tsx",

  // CA-27 P5 (HeaderSearch.tsx is not listed: its look, a 5 of padding and a lucide Search, is from before CA-27, which adds one line of behaviour to it)
  "e2e/audit/composer-ca27-shots.spec.ts",
  "src/components/shell/NavSearch.tsx",
  "src/components/shell/headerSearch.slash.test.tsx",

  // CA-28 P0
  "e2e/audit/composer-ca28-shots.spec.ts",
  "src/pages/dev/Ca28Demo.tsx",

  // CA-28 P1
  "src/components/build/FullPromptWindow.test.tsx",
  "src/components/build/PartWindow.decision.test.tsx",
  "src/lib/build/decisionDraft.ts",
  "src/lib/build/graph.ca15.test.ts",
  "src/lib/build/sourceTiles.test.ts",
  "src/lib/build/sourceTiles.ts",
  "src/lib/build/tileExtras.ts",
  "src/pages/site/build/BuildSteps.tiles.test.tsx",
  "src/pages/site/compose/ClassificationPicker.test.tsx",
  "src/pages/site/compose/HelpersField.test.tsx",
  "src/pages/site/compose/ReadFromBuild.test.tsx",
  "src/pages/site/compose/detailsOptional.tsx",
  "src/pages/site/compose/readerWords.test.tsx",

  // CA-28 P2
  "src/pages/site/compose/ca28.p2.test.tsx",

  // CA-28 P3
  "src/lib/build/answerShape.ts",
  "src/lib/build/composePrompts.test.ts",
  "src/lib/build/cost.test.ts",
  "src/lib/build/cost.ts",
  "src/lib/build/decision.ts",
  "src/lib/build/helpers.ts",
  "src/lib/build/repo.test.ts",
  "src/lib/build/repo.ts",
  "src/lib/build/sessions.ts",
  "src/lib/build/threadEditor.test.ts",
  "src/lib/build/tileExtras.test.ts",
  "src/pages/site/compose/ca21.p3.test.tsx",
  "src/pages/site/compose/ca21.p6.test.tsx",
  "src/pages/site/compose/ca28.p3.page.test.tsx",
  "src/pages/site/compose/ca28.p3.test.tsx",
  "src/pages/site/compose/codeModel.test.ts",
  "src/pages/site/compose/codeModel.ts",
  "src/pages/site/compose/useBuildSorting.ts",
  "src/pages/site/compose/useComposePrompts.agents.test.tsx",

  // CA-28 P4
  "src/lib/build/buildMotion.ts",
  "src/pages/site/compose/OptionalRows.tsx",
  "src/pages/site/compose/OptionalSection.motion.test.tsx",
  "src/pages/site/compose/optionalKit.ts",

  // SV-02 P2 to P4
  "src/components/routing/KeepSearchRedirect.tsx",
  "src/components/vision/ActiveFilterChip.tsx",
  "src/components/vision/DashedSlot.tsx",
  "src/components/vision/InnerTile.tsx",
  "src/components/vision/PageFigure.tsx",
  "src/components/vision/PlainRow.tsx",
  "src/components/vision/SectionHead.tsx",
  "src/components/vision/TextTabs.tsx",
  "src/components/vision/TypeChip.tsx",
  "src/components/vision/vision.test.tsx",
  "src/pages/dev/VisionNotBuilt.tsx",

  // SV-04
  "src/components/AppShell.tsx",
  "src/components/ProtectedRoute.tsx",
  "src/components/brand/coverHeight.ts",
  "src/components/routing/KeepSearchRedirect.tsx",
  "src/components/shell/Dock.tsx",
  "src/components/shell/FrameLink.tsx",
  "src/components/shell/FrameOutlet.tsx",
  "src/components/shell/PageArrival.tsx",
  "src/components/shell/PageProgress.tsx",
  "src/components/shell/SiteFrame.tsx",
  "src/components/shell/SiteHeader.tsx",
  "src/components/shell/frameChrome.ts",
  "src/components/shell/frameOutlet.test.tsx",
  "src/components/vision/SectionHead.tsx",
  "src/lib/routing/PageChangeProvider.tsx",
  "src/lib/routing/PageLink.tsx",
  "src/lib/routing/RoutePlaceholder.tsx",
  "src/lib/routing/ScrollKeeper.test.ts",
  "src/lib/routing/ScrollKeeper.tsx",
  "src/lib/routing/go.test.tsx",
  "src/lib/routing/go.ts",
  "src/lib/routing/idleLoad.ts",
  "src/lib/routing/placeholders.tsx",
  "src/lib/routing/routeTable.ts",
  "src/lib/routing/sv04Motion.test.ts",
  "src/lib/routing/useIntent.ts",
  "src/lib/routing/warm.ts",
  "src/pages/site/build/BuildPage.tsx",
  "src/pages/site/build/BuildView.tsx",
  "src/pages/site/build/BuildViewSkeleton.tsx",
  "src/pages/site/compose/ComposePage.tsx",
  "src/pages/site/compose/ComposeRoute.test.tsx",
  "src/pages/site/compose/ComposeRoute.tsx",
  "src/pages/site/compose/SandboxPage.tsx",
  "src/pages/site/compose/composerOpen.ts",
  "src/pages/site/drafts/DraftsFrame.tsx",
  "src/pages/site/drafts/DraftsPage.tsx",
  "src/pages/site/drafts/DraftsView.tsx",
  "src/pages/site/profile/ProfilePage.tsx",

  // SV-05
  "src/components/build/SessionJump.tsx",
  "src/components/post/editor/BlockHandle.tsx",
  "src/dev/fixtures/ca21.ts",
  "src/dev/fixtures/ca22.ts",
  "src/dev/fixtures/ca27.ts",
  "src/dev/fixtures/parts.ts",
  "src/dev/fixtures/references.ts",
  "src/dev/fixtures/sandbox.ts",
  "src/lib/build/addSession.ts",
  "src/lib/build/graph.ts",
  "src/lib/build/patternsWrite.ts",
  "src/lib/build/readerSteps.ts",
  "src/lib/build/sessionNumbers.test.ts",
  "src/lib/build/sessionNumbers.ts",
  "src/lib/build/sessions.test.ts",
  "src/lib/build/sessions.ts",
  "src/lib/classify/storage.test.ts",
  "src/lib/classify/storage.ts",
  "src/pages/dev/Ca24Demo.tsx",
  "src/pages/dev/MotionDemo.tsx",
  "src/pages/dev/MovingDemo.tsx",
  "src/pages/dev/ReferencesDemo.tsx",
  "src/pages/site/build/buildModel.ts",
  "src/pages/site/build/sessionNumbers.reader.test.ts",
  "src/pages/site/build/useReaderPostLinks.ts",
  "src/pages/site/compare/ComparePage.tsx",
  "src/pages/site/compose/BuildList.tsx",
  "src/pages/site/compose/CardPreview.tsx",
  "src/pages/site/compose/ComposeSkeleton.test.tsx",
  "src/pages/site/compose/ComposeSkeleton.tsx",
  "src/pages/site/compose/ImportingPieces.test.tsx",
  "src/pages/site/compose/ImportingPieces.tsx",
  "src/pages/site/compose/LoadingBlocks.tsx",
  "src/pages/site/compose/PostTab.tsx",
  "src/pages/site/compose/SandboxCard.test.tsx",
  "src/pages/site/compose/SandboxCard.tsx",
  "src/pages/site/compose/SandboxPage.sessionEdits.test.tsx",
  "src/pages/site/compose/SandboxPage.tsx",
  "src/pages/site/compose/SandboxView.test.tsx",
  "src/pages/site/compose/SandboxView.tsx",
  "src/pages/site/compose/SessionHead.tsx",
  "src/pages/site/compose/SourcesPanel.budget.test.tsx",
  "src/pages/site/compose/SourcesPanel.test.tsx",
  "src/pages/site/compose/SourcesPanel.tsx",
  "src/pages/site/compose/arrival.tsx",
  "src/pages/site/compose/buildDirector.tsx",
  "src/pages/site/compose/buildMotion.tsx",
  "src/pages/site/compose/buildRuns.ts",
  "src/pages/site/compose/ca24.p4.test.tsx",
  "src/pages/site/compose/ca27.p2.test.tsx",
  "src/pages/site/compose/composeModel.test.ts",
  "src/pages/site/compose/composeModel.ts",
  "src/pages/site/compose/findIndex.ts",
  "src/pages/site/compose/loadingBlocks.ts",
  "src/pages/site/compose/skeleton.tsx",
  "src/pages/site/compose/sourcesModel.test.ts",
  "src/pages/site/compose/sourcesModel.ts",
  "src/pages/site/compose/sv05.counts.test.ts",
  "src/pages/site/compose/sv05.imports.test.tsx",
  "src/pages/site/compose/sv05.loading.test.tsx",
  "src/pages/site/compose/sv05.numbers.test.ts",
  "src/pages/site/compose/tabRowRecipes.ts",
  "src/pages/site/compose/useComposePrompts.ts",

  // SV-06
  "e2e/audit/motion.spec.ts",
  "e2e/audit/support/frames.ts",
  "src/pages/site/compose/listMotion.ts",
  "src/pages/site/compose/listMotion.test.tsx",
  "src/pages/site/compose/motionStub.ts",
  "src/pages/site/compose/flip.ts",
  "src/pages/site/compose/buildMotion.test.tsx",
  "src/pages/site/compose/foldMotion.tsx",
  "src/pages/site/compose/mapMorph.tsx",
  "src/pages/site/compose/useBuildSorting.ts",
  "src/pages/site/compose/useTwoTabs.tsx",
  "src/pages/site/compose/labels.test.tsx",
  "src/pages/site/compose/buildDirector.test.tsx",
  "src/pages/site/compose/foldMotion.test.tsx",
  "src/pages/site/compose/reducedMotion.test.tsx",
  "src/pages/site/compose/sourcesLeaving.test.tsx",
  "src/pages/site/compose/useBuildActions.tsx",
  "src/pages/site/compose/sequences.test.tsx",
  "src/pages/site/compose/aroundBuild.test.tsx",
  "src/pages/site/compose/mapMorph.test.tsx",
  "src/pages/site/compose/ca21.p6.test.tsx",
  "src/pages/site/compose/compositor.test.tsx",
  "src/pages/site/compose/framePieces.tsx",
  "src/pages/site/compose/workstreamRecipes.ts",
  "src/pages/site/compose/BuildList.parts.test.tsx",
  "src/pages/site/compose/slideTiming.test.tsx",
  "src/pages/site/compose/dragFrames.test.tsx",
  "src/pages/site/compose/pageScroll.ts",
  "src/pages/site/compose/pageScroll.test.ts",

  // SV-07
  "src/pages/site/compose/sv07.replay.test.tsx",
  "src/lib/build/making.steps.test.ts",
  "src/lib/build/addSession.copy.test.ts",
  "src/pages/site/compose/sessionModel.ts",
  "src/pages/site/compose/sv07.model.test.tsx",
  "src/pages/site/compose/sv07Harness.tsx",
  "src/pages/site/compose/sv07.parts.test.tsx",
  "src/pages/site/compose/sv07.motion.test.tsx",
  "src/pages/site/compose/sv07.notice.test.tsx",
  "src/pages/site/compose/sv07.small.test.tsx",
  "src/lib/build/summaryTurn.ts",
  "src/pages/site/compose/sv07.imports.test.tsx",
  "src/lib/build/publish.ts",
  "src/hooks/useComposeBuild.publish.test.tsx",
  "src/pages/site/compose/sv07Backend.ts",
  "e2e/audit/composer-sv07.spec.ts",

  // SV-09
  "src/components/vision/PageFigure.tsx",
  "src/components/vision/SectionHead.tsx",
  "src/components/vision/TypeChip.tsx",
  "src/dev/fixtures/vision/library.ts",
  "src/lib/routing/placeholders.tsx",
  "src/lib/routing/routeTable.ts",
  "src/pages/CollectionDetail.tsx",
  "src/pages/dev/VisionLibrary.tsx",
  "src/pages/site/library/LibraryFrame.tsx",
  "src/pages/site/library/LibraryPage.test.tsx",
  "src/pages/site/library/LibraryPage.tsx",
  "src/pages/site/library/LibraryView.test.tsx",
  "src/pages/site/library/LibraryView.tsx",
  "src/pages/site/library/libraryModel.ts",

  // SV-10
  "src/components/shell/SiteFrame.tsx",
  "src/components/vision/TextTabs.tsx",
  "src/dev/fixtures/vision/home.ts",
  "src/hooks/useLibrarySessions.ts",
  "src/lib/build/gallery.ts",
  "src/pages/dev/KitPages.tsx",
  "src/pages/dev/VisionHome.tsx",
  "src/pages/site/home/HomeFrame.tsx",
  "src/pages/site/home/HomePage.tsx",
  "src/pages/site/home/HomeView.test.tsx",
  "src/pages/site/home/HomeView.tsx",
  "src/pages/site/home/homeModel.test.ts",
  "src/pages/site/home/homeModel.ts",

  // SV-11
  "e2e/audit/design-compare.spec.ts",
  "src/lib/build/galleryParams.ts",
  "src/pages/dev/ClassificationDemo.tsx",
  "src/lib/build/buildsTable.test.ts",
  "src/pages/site/builds/BuildsClassificationView.tsx",
  "src/dev/fixtures/vision/builds-table.ts",
  "src/pages/dev/VisionBuildsTable.tsx",
  "src/pages/site/builds/BuildsFiltersView.tsx",
  "src/pages/site/builds/BuildsFrame.tsx",
  "src/pages/site/builds/BuildsTableView.tsx",
  "src/pages/site/builds/BuildsView.tsx",
  "src/pages/site/builds/BuildsViews.test.tsx",
  "src/pages/site/builds/BuildsMapsView.tsx",
  "src/pages/site/builds/BuildsPage.test.tsx",
  "src/pages/site/builds/BuildsPage.tsx",
  "src/pages/site/builds/buildsModel.ts",
  "src/pages/site/builds/buildsViews.ts",

  // SV-12
  "src/dev/fixtures/vision/builds-maps.ts",
  "src/lib/build/buildsMaps.ts",
  "src/lib/build/buildsMaps.test.ts",
  "src/lib/build/buildsMapsTestSupport.ts",
  "src/pages/dev/VisionBuildsMaps.tsx",
  "src/pages/site/builds/BuildsMapsPane.tsx",
  "src/pages/site/builds/BuildsMapsView.test.tsx",
  "src/pages/site/builds/mapsModel.ts",

  // SV-13
  "src/pages/site/builds/BuildsClassificationView.test.tsx",
  "src/pages/site/builds/classificationModel.ts",
  "src/pages/site/builds/classificationModel.test.ts",
  "src/dev/fixtures/vision/builds-classification.ts",
  "src/pages/dev/VisionBuildsClassification.tsx",

  // SV-14
  "src/lib/build/graph.ts",
  "src/dev/fixtures/vision/openbuilds.ts",
  "src/pages/dev/VisionOpenBuilds.tsx",
  "src/pages/site/openbuilds/OpenBuildsFrame.tsx",
  "src/pages/site/openbuilds/OpenBuildsView.tsx",
  "src/pages/site/openbuilds/OpenBuildsView.test.tsx",
  "src/pages/site/openbuilds/openBuildsModel.ts",
  "src/pages/site/openbuilds/openBuildsModel.test.ts",
  "src/pages/site/openbuilds/OpenBuildsPage.tsx",
  "src/pages/site/openbuilds/OpenBuildsPage.test.tsx",
  "src/lib/bounty/openBuilds.ts",
  "src/lib/bounty/openBuilds.test.ts",
  "src/lib/bounty/runRequestRules.ts",
  "src/lib/bounty/runRequests.ts",
  "src/lib/bounty/runRequests.test.ts",
  "src/lib/bounty/claims.ts",
  "src/lib/bounty/claims.test.ts",
  "src/lib/bounty/sessionOffers.ts",
  "src/lib/bounty/sessionOffersRead.ts",
  "src/lib/bounty/sessionOffers.test.ts",
  "src/pages/site/openbuilds/OfferSessionDialog.tsx",
  "src/pages/site/compose/OpenRequestDialog.tsx",
  "src/pages/site/compose/AskNextSessionRow.tsx",
  "src/lib/build/openRequest.ts",
  "src/lib/build/openTargets.ts",

  // SV-23
  "src/lib/build/buildCounts.ts",
  "src/lib/build/buildCounts.test.ts",
  "src/lib/build/galleryRanges.ts",
  "src/lib/build/galleryRanges.test.ts",
  "src/pages/site/compose/useStoredBuildCounts.ts",
  "src/pages/site/compose/useStoredBuildCounts.test.tsx",
  "src/lib/build/runsPerWeek.ts",
  "src/lib/build/runsPerWeek.test.ts",
  "src/pages/site/builds/buildsModel.ranges.test.ts",
  "src/lib/models/registry.ts",
  "src/lib/build/buildCountsWrite.ts",
  "src/lib/build/buildCountsWrite.test.ts",
  "src/lib/build/backfillCounts.ts",
  "src/lib/build/backfillCounts.test.ts",
  "src/pages/dev/BackfillCounts.tsx",

  // SV-24
  "src/lib/build/filterSets.ts",
  "src/lib/build/filterSets.test.ts",
  "src/lib/build/buildsLayout.ts",
  "src/lib/build/buildsLayout.test.ts",
  "src/pages/site/builds/SetDialogs.tsx",
  "src/pages/site/builds/filterDrag.ts",
  "src/pages/site/builds/useBuildsLayout.ts",
  "src/pages/site/builds/useBuildsLayout.test.tsx",
  "src/pages/site/builds/buildsModel.layout.test.ts",

  // SV-25
  "src/components/build/BuildConnections.tsx",
  "src/components/build/ConnectionMarks.tsx",
  "src/components/build/ConnectionMarks.test.tsx",
  "src/components/build/AnatomyTree.tsx",
  "src/lib/build/connections.ts",
  "src/pages/site/build/BuildPage.tsx",
  "src/pages/site/build/BuildSteps.tsx",

  // SV-27
  "src/components/build/renderers/configuration.tsx",
  "src/components/build/renderers/renderers.test.tsx",
  "src/lib/build/publishChecklist.test.ts",
  "src/lib/build/publishChecklist.ts",
  "src/lib/build/readerSteps.ts",
  "src/lib/build/setup.ts",
  "src/lib/build/shapes.test.ts",
  "src/lib/build/tileSections.test.ts",
  "src/lib/build/tileSections.ts",
  "src/pages/site/build/BuildSteps.test.tsx",
  "src/pages/site/build/BuildSteps.tsx",
  "src/pages/site/compose/AddAgentDialog.test.tsx",
  "src/pages/site/compose/AddAgentDialog.tsx",
  "src/pages/site/compose/AgentSetupFields.tsx",
  "src/pages/site/compose/BuildList.test.tsx",
  "src/pages/site/compose/SandboxPage.sessions.test.tsx",
  "src/pages/site/compose/SessionDialog.test.tsx",
  "src/pages/site/compose/SessionDialog.tsx",
  "src/pages/site/compose/SessionHead.test.tsx",
  "src/pages/site/compose/SessionHead.tsx",
  "src/pages/site/compose/SessionMap.tsx",
  "src/pages/site/compose/ca21.p7.test.tsx",
  "src/pages/site/compose/detailsView.ts",
  "src/pages/site/compose/modalBoards.test.tsx",
  "src/pages/site/compose/setup.ui.test.tsx",
  "src/pages/site/compose/sourcesModel.test.ts",
  "src/pages/site/compose/sourcesModel.ts",
  "src/pages/site/compose/sv05.imports.test.tsx",
  "src/pages/site/drafts/DraftsView.behaviour.test.tsx",
  "src/pages/site/drafts/DraftsView.test.tsx",
  "src/pages/site/drafts/draftsModel.ts",
  "src/pages/site/openbuilds/openBuildsModel.test.ts",
  "src/pages/site/openbuilds/openBuildsModel.ts",
  "src/lib/build/harnessWords.ts",
  "src/lib/build/sv27.harness.test.ts",
  "src/lib/build/deployment.ts",
  "src/lib/build/fork.ts",
  "src/lib/build/duplicate.ts",
  "src/lib/build/buildUpdates.ts",
];

/**
 * CA-15b: the modal files. Each is built only from `modalRecipes.tsx`: none sets a colour, a size or a radius of its own.
 * The recipes are the one place a modal's measures live.
 */
export const MODAL_FILES: readonly string[] = [
  "src/pages/site/compose/ChoiceGrid.tsx",
  "src/pages/site/compose/OptionalSection.tsx",
  "src/pages/site/compose/AddAgentDialog.tsx",
  "src/pages/site/compose/AddCheckDialog.tsx",
  "src/pages/site/compose/AddCodeDialog.tsx",
  "src/pages/site/compose/AddDatasetDialog.tsx",
  "src/pages/site/compose/AddDecisionDialog.tsx",
  "src/pages/site/compose/AddManualStepDialog.tsx",
  "src/pages/site/compose/AddRepoDialog.tsx",
  "src/pages/site/compose/AddResultDialog.tsx",
  "src/pages/site/compose/AddSystemPromptDialog.tsx",
  "src/pages/site/compose/AddToolDialog.tsx",
  "src/pages/site/compose/DecisionFields.tsx",
  "src/pages/site/compose/editKit.tsx",
  "src/pages/site/compose/TileEditDialog.tsx",
  "src/pages/site/compose/SessionDialog.tsx",
];

/** CA-15b: the recipe modules hold the boards' exact measures (14, 18, 9, 7 ...) and the fields' focus edge. */
const RECIPE_FILES: readonly string[] = ["src/pages/site/compose/detailsRecipes.ts", "src/pages/site/compose/modalRecipes.tsx", "src/pages/site/compose/modalRecipes.test.tsx", "src/pages/site/compose/tileRecipes.tsx", "src/pages/site/compose/tileRecipes.test.tsx", "src/pages/site/compose/workstreamRecipes.ts", "src/pages/site/compose/mapRecipes.ts", "src/pages/site/compose/tabRowRecipes.ts", "src/pages/site/compose/referencePieces.tsx", "src/pages/site/compose/emptyBuildRecipes.ts"];

const ROOT = path.resolve(__dirname, "../../..");

/* ── reading a file ── */

/**
 * The source with every comment replaced by spaces, line breaks kept. A small lexer: strings ('…', "…", `…` with
 * `${}` inside), line and block comments, and code. A quote string never crosses a line, so an apostrophe in JSX
 * text costs at most the rest of its own line.
 */
export function stripComments(source: string): string {
  let out = "";
  let i = 0;
  const stack: ("code" | "template")[] = ["code"];
  let braces: number[] = [0];
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    const mode = stack[stack.length - 1];
    if (mode === "template") {
      if (c === "\\") {
        out += source.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (c === "`") {
        out += c;
        stack.pop();
        i += 1;
        continue;
      }
      if (c === "$" && next === "{") {
        out += "${";
        stack.push("code");
        braces.push(0);
        i += 2;
        continue;
      }
      out += c;
      i += 1;
      continue;
    }
    // code
    if (c === "/" && next === "/") {
      const end = source.indexOf("\n", i);
      const stop = end < 0 ? source.length : end;
      out += blank(source.slice(i, stop));
      i = stop;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end < 0 ? source.length : end + 2;
      out += blank(source.slice(i, stop));
      i = stop;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== c && source[j] !== "\n") j += source[j] === "\\" ? 2 : 1;
      out += source.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === "`") {
      out += c;
      stack.push("template");
      i += 1;
      continue;
    }
    if (c === "{") braces[braces.length - 1] += 1;
    if (c === "}") {
      if (stack.length > 1 && braces[braces.length - 1] === 0) {
        // The end of a `${…}`.
        stack.pop();
        braces = braces.slice(0, -1);
        out += c;
        i += 1;
        continue;
      }
      braces[braces.length - 1] -= 1;
    }
    out += c;
    i += 1;
  }
  return out;
}

const lineOf = (text: string, index: number): number => text.slice(0, index).split("\n").length;

export interface Finding {
  rule: string;
  line: number;
  text: string;
}

const found = (rule: string, code: string, index: number): Finding => ({
  rule,
  line: lineOf(code, index),
  text: code.split("\n")[lineOf(code, index) - 1].trim().slice(0, 140),
});

function every(pattern: RegExp, code: string): RegExpExecArray[] {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return [...code.matchAll(new RegExp(pattern.source, flags))];
}

/* ── rule 2: what never appears ── */

const FORBIDDEN: readonly { rule: string; pattern: RegExp }[] = [
  { rule: "no gradient (linear)", pattern: /linear-gradient/ },
  { rule: "no gradient (radial)", pattern: /radial-gradient/ },
  { rule: "no gradient (conic)", pattern: /conic-gradient/ },
  { rule: "no glass (backdrop-filter)", pattern: /backdrop-filter|backdropFilter/ },
  { rule: "no gradient text", pattern: /background-clip:\s*text|backgroundClip/ },
  // Spelt in two parts: type.test.ts holds the whole source to never naming the retired face.
  { rule: "no Inter", pattern: /"Int(?:er)"/ },
  { rule: "no Space Grotesk", pattern: /Space Grotesk/ },
  { rule: "no Instrument Serif", pattern: /Instrument Serif/ },
  { rule: "no italic", pattern: /fontStyle:\s*"italic"|font-style:\s*italic/ },
  { rule: "no fade-in on scroll", pattern: /IntersectionObserver/ },
  { rule: "no cursor-following light", pattern: /mousemove/ },
  { rule: "no untouched shadcn", pattern: /from "@\/components\/ui\// },
  { rule: "no emoji", pattern: /\p{Extended_Pictographic}/u },
  { rule: "no em dash in copy", pattern: /—/ },
];

/* ── rule 4: spacing only from SPACE_REFINED ── */

const SPACING_KEY = /\b(gap|rowGap|columnGap|padding(?:Top|Right|Bottom|Left|Inline|Block)?|margin(?:Top|Right|Bottom|Left|Inline|Block)?)\s*:\s*/;

/** The numbers a spacing value spells: `12`, `"4px 8px"`, `"0 12px 8px"`, a ternary of either. */
function spacingNumbers(value: string): number[] {
  const out: number[] = [];
  for (const match of value.matchAll(/(-?\d+(?:\.\d+)?)(px)?/g)) out.push(Math.abs(Number(match[1])));
  return out;
}

const SPACE_OK = new Set<number>([0, 1, ...SPACE_REFINED]);

function spacingFindings(code: string): Finding[] {
  const out: Finding[] = [];
  for (const match of every(SPACING_KEY, code)) {
    const start = (match.index ?? 0) + match[0].length;
    const rest = code.slice(start, start + 120);
    // A number, a string of px values, or a ternary of those; anything else (a variable, a sum) is not read.
    const value = /^(?:-?\d+(?:\.\d+)?|"[^"\n]*"|'[^'\n]*'|[\w.]+\s*\?\s*(?:-?\d+(?:\.\d+)?|"[^"\n]*")\s*:\s*(?:-?\d+(?:\.\d+)?|"[^"\n]*"))(?=\s*[,}\n)])/.exec(rest);
    if (!value) continue;
    const literal = value[0].replace(/^[\w.]+\s*\?/, "");
    if (/var\(|calc\(|clamp\(|%|auto|em\b|vw|vh/.test(literal)) continue;
    const bad = spacingNumbers(literal).filter((n) => !SPACE_OK.has(n));
    if (bad.length) out.push(found(`spacing ${bad.join(", ")} is not in SPACE_REFINED`, code, match.index ?? 0));
  }
  return out;
}

/* ── rule 5: the Components table ── */

function componentFindings(code: string, file: string): Finding[] {
  const out: Finding[] = [];
  for (const match of every(/<select\b/, code)) out.push(found("a native <select>", code, match.index ?? 0));

  for (const match of every(/type=\{?["'](radio|checkbox)["']\}?/, code)) {
    const at = match.index ?? 0;
    const before = code.slice(Math.max(0, at - 400), at);
    const tagStart = before.lastIndexOf("<");
    // An input closes itself: read to its "/>", past any arrow function in its props.
    const close = code.indexOf("/>", at);
    const tag = before.slice(tagStart) + code.slice(at, close < 0 ? code.indexOf(">", at) + 1 : close + 2);
    const hidden = /VisuallyHidden|VISUALLY_HIDDEN/.test(tag) || /<VisuallyHidden>\s*$/.test(before.slice(0, tagStart));
    if (!hidden) out.push(found(`a visible ${match[1]} input`, code, at));
  }

  // CA-07: the site has no slider of its own; a native range is allowed only where ALLOWED names it.
  for (const match of every(/type=\{?["']range["']\}?/, code)) out.push(found("a native range input", code, match.index ?? 0));

  for (const match of every(/textTransform:\s*["']uppercase["']/, code)) {
    const at = match.index ?? 0;
    const owner = code.slice(0, at).lastIndexOf("export const ");
    const isEyebrow = file.endsWith("src/pages/site/compose/refinedStyles.ts") && code.slice(owner, owner + 30).startsWith("export const EYEBROW");
    if (!isEyebrow) out.push(found("upper case outside the Details eyebrow", code, at));
  }

  // DM_MONO in a style object that also sets textTransform, or in a <label>'s style.
  for (const match of every(/DM_MONO/, code)) {
    const at = match.index ?? 0;
    const open = code.lastIndexOf("{", at);
    const close = code.indexOf("}", at);
    if (open >= 0 && close > 0 && /textTransform/.test(code.slice(open, close))) out.push(found("the data face with upper case", code, at));
    const tagAt = code.lastIndexOf("<", at);
    if (tagAt >= 0 && /^<label\b/.test(code.slice(tagAt)) && !code.slice(tagAt, at).includes(">")) out.push(found("the data face on a label", code, at));
  }

  // A lucide icon drawn as JSX on its own, rather than handed to IconButton's `icon`.
  const lucide = /import\s*\{([^}]*)\}\s*from\s*"lucide-react"/.exec(code);
  if (lucide) {
    const names = lucide[1].split(",").map((name) => name.trim().split(/\s+as\s+/).pop() ?? "").filter(Boolean);
    for (const name of names) for (const match of every(new RegExp(`<${name}[\\s/>]`), code)) out.push(found(`the lucide icon ${name} drawn on its own`, code, match.index ?? 0));
  }

  // An opacity in a hover style.
  for (const match of every(/hover[^\n]*opacity|opacity[^\n]*hover/i, code)) out.push(found("opacity on hover", code, match.index ?? 0));

  // CA-06: a border's colour is a token, or a maker's colour through partColour.ts and nothing else. A raw colour, or a
  // value read from anything named colour or hex, in a border anywhere else is a coloured card edge.
  // The helper, and its own test, which says what it returns.
  if (!/src\/lib\/theme\/partColour(\.test)?\.ts$/.test(file)) {
    for (const match of every(/\bborder(?:Top|Right|Bottom|Left|Block|Inline)?(?:Color)?\s*:\s*([^,}\n]+)/, code)) {
      if (/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(|\bcolou?r\b|\bhex\b/i.test(match[1])) out.push(found("a border colour not from a token or partColour", code, match.index ?? 0));
    }
  }

  // CA-07, THE ONE EXCEPTION FOR PICTURES: the controls drawn on a picture sit on PICTURE_SHADE with white ink in both
  // themes, because the picture under them can be any colour. The shade, and the few raw values beside it, are written
  // in src/components/post/media/shade.ts and nowhere else; every other file in the media folder names them from there.
  if (!file.endsWith("src/components/post/media/shade.ts")) {
    for (const match of every(/rgba\(\s*15\s*,\s*15\s*,\s*16\b/, code)) out.push(found("the picture shade outside shade.ts", code, match.index ?? 0));
    if (/src\/components\/post\/media\//.test(file) && !/\.test\.tsx?$/.test(file)) {
      for (const match of every(/["'`](?:#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?)\([^"'`]*\))["'`]/, code)) out.push(found("a raw colour on a picture not from shade.ts", code, match.index ?? 0));
    }
  }

  // An outline that is not ring()'s: only `none` or 0 may be written by hand.
  for (const match of every(/\boutline(?:Offset|Color|Width|Style)?\s*:\s*([^,}\n]+)/, code)) {
    const value = match[1].trim();
    if (/^["']none["']$|^0$/.test(value)) continue;
    out.push(found("an outline other than ring()", code, match.index ?? 0));
  }
  return out;
}

/**
 * What may stay, each with its reason. Only an exact piece of a line, and only for the rule named: nothing here
 * excuses anything new.
 */
export const ALLOWED: readonly { rule: string; text: string; why: string }[] = [
  {
    rule: "spacing 14 is not in SPACE_REFINED",
    text: `<Link to={to} data-visual-slot="btn-primary" {...handlers} style={{ ...controlBase, ...PRIMARY, height: phone ? TOUCH_MIN : 32, padding: "0 `,
    why: "SV-14: the OpenBuilds board pads Run an untested build 0 14.",
  },
  {
    rule: "spacing 28 is not in SPACE_REFINED",
    text: `<div aria-hidden="true" style={{ padding: "28px 0", borderBottom: last ? "none"`,
    why: "SV-14: a request is 28 above and below (series README, Visual grammar 7); its loading block is the same.",
  },
  {
    rule: "spacing 28 is not in SPACE_REFINED",
    text: `<article data-testid="openbuilds-request" data-kind={item.kind} style={{ padding: "28px 0"`,
    why: "SV-14: a request is 28 above and below (series README, Visual grammar 7).",
  },
  {
    rule: "spacing 28 is not in SPACE_REFINED",
    text: `<div style={{ display: "flex", alignItems: "center", gap: 12, padding: "28px 0", color: t.text2 }}>`,
    why: "SV-14: the empty requests line takes a request's 28 above and below.",
  },
  {
    rule: "spacing 28 is not in SPACE_REFINED",
    text: `<div style={{ display: "flex", justifyContent: "center", paddingTop: 28, borderTop:`,
    why: "SV-14: Show more sits a request's 28 under the last one.",
  },
  {
    rule: "spacing 28, 28 is not in SPACE_REFINED",
    text: `<section aria-label={label} style={{ padding: first ? "0 0 28px" : "28px 0"`,
    why: "SV-14: the OpenBuilds board's side sections are 28 apart with a hairline between.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: "const tileBox: CSSProperties = { boxSizing: \"border-box\", minWidth: 0, background: t.tile,",
    why: "SV-14: the OpenBuilds board pads a strip tile 10 12.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `<DashedSlot key={tile.id} as="li" style={{ padding: "10px 12px" }}>`,
    why: "SV-14: the OpenBuilds board pads the open strip tile 10 12, as the others.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `<DashedSlot key={session.key} as="li" style={{ padding: "10px 12px",`,
    why: "SV-14: the OpenBuilds board pads the open session tile 10 12, as the others.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `<div style={{ display: "flex", alignItems: "center", gap: 10 }}>`,
    why: "SV-14: the OpenBuilds board puts a request's chip, title and reward 10 apart.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `style={{ boxSizing: "content-box", display: "flex", alignItems: "center", gap: 10, minHeight: 44,`,
    why: "SV-14: the OpenBuilds board puts a top contributor's avatar and handle 10 apart.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `<div style={{ marginTop: 10, fontSize: 12.5 }}>`,
    why: "SV-14: the OpenBuilds board's week tile puts its count 10 under the bar.",
  },
  {
    rule: "no untouched shadcn",
    text: `import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";`,
    why: "SV-24: the Builds Table's Columns chooser is a checklist in the popover the app already uses (MadeWithLine, ToolPicker), behind the board's Columns control.",
  },
  {
    rule: "no untouched shadcn",
    text: `import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropd`,
    why: "SV-14: OpenBuilds' Sort is the menu the Builds Table's Sort opens (SV-11), a radio group behind the board's control. A styled select cannot be drawn: index.css paints every select's fill and border with !important.",
  },
  {
    rule: "no untouched shadcn",
    text: `import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";`,
    why: "SV-21: the offer dialog's list of sessions is a choice of one, a real radio group (one tab stop, arrows), as the report dialog's reasons are.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `<div ref={list} role="group" aria-label={\`\${section.name} values\`} style={{ ...(height ? { maxHeight: height,`,
    why: "SV-11: the Builds board starts a checklist 10 under its head.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `<div style={{ marginTop: 10 }}>`,
    why: "SV-12: the Maps page's loading card puts the title row 10 under the well, as the card does.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `columnGap: 12, padding: "10px 0", borderTop:`,
    why: "SV-13: a Classification row is 10 above and below its facet, as the board draws it.",
  },
  {
    rule: "spacing 7 is not in SPACE_REFINED",
    text: `width: pct(BOX_W, w), height: BOX_H, boxSizing: "border-box"`,
    why: "SV-12: the Maps board pads a session box 4 7.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `alignItems: "flex-start", gap: 8, marginTop: 10 }}>`,
    why: "SV-12: the Maps board puts a card's title row 10 under its well.",
  },
  {
    rule: "spacing 14 is not in SPACE_REFINED",
    text: `gap: 2, height, marginTop: 14 }}>`,
    why: "SV-11: the Builds board puts a histogram 14 under its filter's head.",
  },
  {
    rule: "spacing 14 is not in SPACE_REFINED",
    text: `style={{ marginTop: 14, display: "grid", gridTemplateColumns:`,
    why: "SV-11: the Builds board puts the Autonomy segments 14 under their head.",
  },
  {
    rule: "spacing 14 is not in SPACE_REFINED",
    text: `<div key={group.name} style={{ marginTop: 14 }}>`,
    why: "SV-11: the Builds board's Add a filter tile puts each group 14 under the one before.",
  },
  {
    rule: "spacing 10, 10 is not in SPACE_REFINED",
    text: `padding: last ? "0 0 10px" : "0 12px 10px`,
    why: "SV-11: the Builds board's table heads sit 10 above their hairline (as the Library's do).",
  },
  {
    rule: "spacing 56 is not in SPACE_REFINED",
    text: `columnGap: 56,`,
    why: "SV-11: the Builds board puts its filters and its table 56 apart (series README, Visual grammar 7).",
  },
  {
    rule: "spacing 28 is not in SPACE_REFINED",
    text: `<aside aria-label="Your studio" style={{ padding: "8px 28px 48px 4px",`,
    why: "SV-10: the Home board: the left column is padded 8 28 48 4.",
  },
  {
    rule: "spacing 28 is not in SPACE_REFINED",
    text: `<aside aria-label="The room" style={{ padding: "8px 4px 48px 28px",`,
    why: "SV-10: the Home board: the right column is padded 8 4 48 28.",
  },
  {
    rule: "spacing 14 is not in SPACE_REFINED",
    text: `columnGap: 10, paddingBottom: last ? 0 : 14,`,
    why: "SV-10: the Home board: Since you were last here: a timeline line every 14, its dot and text 10 apart.",
  },
  {
    rule: "spacing 5 is not in SPACE_REFINED",
    text: `<span aria-hidden="true" style={{ marginTop: 5, width: 9, height: 9,`,
    why: "SV-10: the Home board: the timeline's 9px dot sits 5 down, centred on the first line.",
  },
  {
    rule: "spacing 14 is not in SPACE_REFINED",
    text: `<div style={{ marginBottom: 14 }}>`,
    why: "SV-10: the Home board: Your week's head sits 14 above the day bars.",
  },
  {
    rule: "spacing 14 is not in SPACE_REFINED",
    text: `alignItems: "start", padding: "14px 20px" }}>`,
    why: "SV-10: the Home board: a reproduction note is padded 14 20.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `columnGap: 12, marginTop: 12, padding: 10, background: t.module,`,
    why: "SV-10: the Home board: a rebuild's quote box is padded 10.",
  },
  {
    rule: "spacing 14 is not in SPACE_REFINED",
    text: `<div style={{ padding: 14, background: t.module,`,
    why: "SV-10: the Home board: an ask's box is padded 14.",
  },
  {
    rule: "spacing 28 is not in SPACE_REFINED",
    text: `<div style={{ padding: "28px 20px 8px", textAlign: "center" }}>`,
    why: "SV-10: the Home board: \"You're up to date\" sits 28 below the last item.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `<Link key={card.id} to={card.href} style={{ display: "block", padding: 10,`,
    why: "SV-10: the Home board: an end-of-feed card is padded 10.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `<span style={{ display: "block", marginTop: 10, fontWeight: 500, ...ellipsis }}>{card.title}</span>`,
    why: "SV-10: the Home board: an end-of-feed card's title sits 10 under its cover.",
  },
  {
    rule: "spacing 14 is not in SPACE_REFINED",
    text: `<div style={{ marginTop: 14 }} data-testid="home-latest-runs">`,
    why: "SV-10: the Home board: the latest runs start 14 under the two tiles.",
  },
  {
    rule: "no fade-in on scroll",
    text: `if (!node || !onNear || typeof IntersectionObserver === "undefined") return;`,
    why: "SV-10: Home reads a post's post_doc as it comes within a screen of view. Nothing is shown or moved by it.",
  },
  {
    rule: "upper case outside the Details eyebrow",
    text: `export const SECTION_LABEL: CSSProperties = { fontFamily: DM_MONO, fontSize: 11,`,
    why: "CA-19's boards (\"References: from the post\", \"References: groups and the Colours window\") label the link panel's and the hover card's sections in the data face 11, in capitals, .04em apart. Only SECTION_LABEL spends it.",
  },
  {
    rule: "the data face with upper case",
    text: `export const SECTION_LABEL: CSSProperties = { fontFamily: DM_MONO, fontSize: 11,`,
    why: "CA-19's boards (\"References: from the post\", \"References: groups and the Colours window\") label the link panel's and the hover card's sections in the data face 11, in capitals, .04em apart. Only SECTION_LABEL spends it.",
  },
  {
    rule: "upper case outside the Details eyebrow",
    text: `fontFamily: DM_MONO, fontSize: 10.5, fontWeight: 400, lineHeight: "18px", textTransform: "uppercase",`,
    why: "SV-02: the boards' type chip (STEP, PROMPT) is Geist Mono 10.5 in capitals. Only TypeChip spends it.",
  },
  {
    rule: "the data face with upper case",
    text: `fontFamily: DM_MONO, fontSize: 10.5, fontWeight: 400, lineHeight: "18px", textTransform: "uppercase",`,
    why: "SV-02: the boards' type chip (STEP, PROMPT) is Geist Mono 10.5 in capitals. Only TypeChip spends it.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `columnGap: 10,`,
    why: "SV-08: the Drafts board's session row is a grid of grip, mark, text and button 10 apart.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `<ul style={{ margin: "10px 0 0", padding: 0 }}>`,
    why: "SV-08: the Connected tools tile (Drafts board) starts its rows 10 below its head.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `gap: 10, fontWeight: 500 }}>`,
    why: "SV-08: the Drafts board's Start a new build slot puts its plus and label 10 apart.",
  },
  {
    rule: "spacing 28 is not in SPACE_REFINED",
    text: `<nav aria-label="Kinds" style={{ marginTop: 28 }}>`,
    why: "SV-09: the Library board starts its kinds 28 below the page head.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `<p style={{ ...small, margin: "10px 0 0" }}>Ordered by your last use</p>`,
    why: "SV-09: the Library board's \"Ordered by your last use\" sits 10 under the collections.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `const th: CSSProperties = { fontWeight: 400, padding: "0 12px 10px 0"`,
    why: "SV-09: the Library board's table heads sit 10 above their hairline.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `style={{ ...th, padding: "0 0 10px", textAlign: "right"`,
    why: "SV-09: the Library board's table heads sit 10 above their hairline.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `<h2 style={{ margin: "10px 0 0", fontFamily: FIGTREE, fontSize: 14`,
    why: "SV-09: the Library board's selected item puts its title 10 under its chip.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `marginTop: 6, padding: "8px 10px", ...WELL`,
    why: "SV-09: the Library board's note field is padded 8px 10px.",
  },
  {
    rule: "spacing 72 is not in SPACE_REFINED",
    text: `columnGap: 72,`,
    why: "SV-08: the Drafts board's two columns are 72 apart (series README, Visual grammar 7).",
  },
  {
    rule: "spacing 14 is not in SPACE_REFINED",
    text: `padding: "14px 16px",`,
    why: "SV-02: the boards' one boxed tile (InnerTile) is padded 14px 16px.",
  },
  {
    rule: "spacing 9 is not in SPACE_REFINED",
    text: `padding: compact ? "0 9px" : "0 12px",`,
    why: "The map's direction switch (CA-17 P4, board \"Map: horizontal\"): its items are 22 tall with 0 9 of padding, in a 2px well. Only the compact switch spends it; every other Segmented keeps 0 12.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `<div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>`,
    why: "A measure the Classification Card and Gallery boards draw (CA-16b): 5, 9, 10, 11, 14, 18, 22, 28 and 36 are theirs.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `style={{ display: "flex", alignItems: "center", gap: 10, flexGrow: 1, minWidth: 0, padding: phone ? "11px 0" : "5px 0", cursor: "pointer", f`,
    why: "A measure the Classification Card and Gallery boards draw (CA-16b): 5, 9, 10, 11, 14, 18, 22, 28 and 36 are theirs.",
  },
  {
    rule: "spacing 11, 5 is not in SPACE_REFINED",
    text: `style={{ display: "flex", alignItems: "center", gap: 10, flexGrow: 1, minWidth: 0, padding: phone ? "11px 0" : "5px 0", cursor: "pointer", f`,
    why: "A measure the Classification Card and Gallery boards draw (CA-16b): 5, 9, 10, 11, 14, 18, 22, 28 and 36 are theirs.",
  },
  {
    rule: "spacing 10, 10 is not in SPACE_REFINED",
    text: `<section aria-label={name} data-facet-group={facet} style={{ display: "flex", flexDirection: "column", minWidth: 0, padding: first ? "0 0 10`,
    why: "A measure the Classification Card and Gallery boards draw (CA-16b): 5, 9, 10, 11, 14, 18, 22, 28 and 36 are theirs.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `<section aria-label="More filters" style={{ display: "flex", flexDirection: "column", padding: "10px 0", borderTop: \`1px solid \${t.hairline}`,
    why: "A measure the Classification Card and Gallery boards draw (CA-16b): 5, 9, 10, 11, 14, 18, 22, 28 and 36 are theirs.",
  },
  {
    rule: "spacing 14 is not in SPACE_REFINED",
    text: `<article style={{ padding: "14px 16px", boxSizing: "border-box", background: t.well, border: \`1px solid \${t.wellBorder}\`, borderRadius: 10, `,
    why: "A measure the Classification Card and Gallery boards draw (CA-16b): 5, 9, 10, 11, 14, 18, 22, 28 and 36 are theirs.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `<div style={{ marginTop: 10, display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 6, rowGap: 4, minWidth: 0 }}>`,
    why: "A measure the Classification Card and Gallery boards draw (CA-16b): 5, 9, 10, 11, 14, 18, 22, 28 and 36 are theirs.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `<div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>`,
    why: "A measure the Classification Card and Gallery boards draw (CA-16b): 5, 9, 10, 11, 14, 18, 22, 28 and 36 are theirs.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `<li key={facet} data-facet={facet} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 0", borderBottom: \`1px solid \${`,
    why: "A measure the Classification Card and Gallery boards draw (CA-16b): 5, 9, 10, 11, 14, 18, 22, 28 and 36 are theirs.",
  },
  {
    rule: "spacing 14 is not in SPACE_REFINED",
    text: `<div style={{ flexShrink: 0, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 8, padding: "14px 20px", background: WINDO`,
    why: "A measure the Classification Card and Gallery boards draw (CA-16b): 5, 9, 10, 11, 14, 18, 22, 28 and 36 are theirs.",
  },
  {
    rule: "spacing 10, 10 is not in SPACE_REFINED",
    text: `padding: readOnly ? "0 10px" : "0 6px 0 10px",`,
    why: "A measure the Classification Card and Gallery boards draw (CA-16b): 5, 9, 10, 11, 14, 18, 22, 28 and 36 are theirs.",
  },
  {
    rule: "spacing 5 is not in SPACE_REFINED",
    text: `gap: 5,`,
    why: "A measure the Classification Card and Gallery boards draw (CA-16b): 5, 9, 10, 11, 14, 18, 22, 28 and 36 are theirs.",
  },
  {
    rule: "spacing 9 is not in SPACE_REFINED",
    text: `return { ...typeaheadRow(active, phone), color: t.text2, borderTop: \`1px solid \${t.hairlineModule}\`, borderTopLeftRadius: 0, borderTopRightR`,
    why: "A measure the Classification Card and Gallery boards draw (CA-16b): 5, 9, 10, 11, 14, 18, 22, 28 and 36 are theirs.",
  },
  {
    rule: "spacing 36 is not in SPACE_REFINED",
    text: `style={{ width: "100%", boxSizing: "border-box", height: phone ? 44 : 38, padding: "0 12px 0 36px", borderRadius: 9, background: t.well, bor`,
    why: "A measure the Classification Card and Gallery boards draw (CA-16b): 5, 9, 10, 11, 14, 18, 22, 28 and 36 are theirs.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: `style={{ flexShrink: 0, padding: "10px 0", marginBottom: -1, border: 0, borderBottomWidth: 2, borderBottomStyle: "solid", borderBottomColor:`,
    why: "A measure the Classification Card and Gallery boards draw (CA-16b): 5, 9, 10, 11, 14, 18, 22, 28 and 36 are theirs.",
  },
  {
    rule: "spacing 14 is not in SPACE_REFINED",
    text: `style={{ textAlign: "left", cursor: "pointer", padding: "14px 16px", boxSizing: "border-box", borderRadius: 10, background: t.module, border`,
    why: "A measure the Classification Card and Gallery boards draw (CA-16b): 5, 9, 10, 11, 14, 18, 22, 28 and 36 are theirs.",
  },
  {
    rule: "spacing 22 is not in SPACE_REFINED",
    text: `<div role="tablist" aria-label="Group the builds" style={{ display: "flex", gap: 22, borderBottom: \`1px solid \${t.hairline}\`, overflowX: "au`,
    why: "A measure the Classification Card and Gallery boards draw (CA-16b): 5, 9, 10, 11, 14, 18, 22, 28 and 36 are theirs.",
  },
  {
    rule: "spacing 18 is not in SPACE_REFINED",
    text: `<div style={{ marginTop: 18 }}>`,
    why: "A measure the Classification Card and Gallery boards draw (CA-16b): 5, 9, 10, 11, 14, 18, 22, 28 and 36 are theirs.",
  },
  {
    rule: "spacing 18 is not in SPACE_REFINED",
    text: `<div style={{ marginTop: 18 }}>{tabs}</div>`,
    why: "A measure the Classification Card and Gallery boards draw (CA-16b): 5, 9, 10, 11, 14, 18, 22, 28 and 36 are theirs.",
  },
  {
    rule: "spacing 22 is not in SPACE_REFINED",
    text: `<div style={{ marginTop: 22 }}>`,
    why: "A measure the Classification Card and Gallery boards draw (CA-16b): 5, 9, 10, 11, 14, 18, 22, 28 and 36 are theirs.",
  },
  {
    rule: "spacing 28 is not in SPACE_REFINED",
    text: `<div style={{ marginTop: 28, display: "grid", gridTemplateColumns: phone ? "minmax(0, 1fr)" : "248px minmax(0, 1fr)", columnGap: 32, alignIt`,
    why: "A measure the Classification Card and Gallery boards draw (CA-16b): 5, 9, 10, 11, 14, 18, 22, 28 and 36 are theirs.",
  },
  {
    rule: "no glass (backdrop-filter)",
    text: 'not.toContain("backdrop-filter")',
    why: "A test that asserts there is no glass names what it looks for.",
  },
  {
    rule: "no gradient (radial)",
    text: "radial-gradient(${t.dotGrid} 1px, transparent 1px)",
    why: "The map well's dot grid. RULES.md (UI-P99) makes it part of the well recipe for maps and media; it was there before CA-03.",
  },
  {
    rule: "no em dash in copy",
    text: 'export const MISSING = "—";',
    why: "The build page's mark for a fact the maker left empty, there before CA-03 and drawn site-wide; CA-03 only adds a field to the file that holds it.",
  },
  {
    rule: "an outline other than ring()",
    text: "outline: `1px solid ${t.selectedEdge}`, outlineOffset: 3",
    why: "A selected row of pictures in the post editor (PT-06), drawn by a ProseMirror decoration with the selected recipe's edge. It was there before CA-06, which only adds the reference mark to the file.",
  },
  {
    rule: "no em dash in copy",
    text: "the audit cannot",
    why: "The audit harness's own messages and sample rows, there before CA-06, which only adds its four link routes to the file. Not shown on any page.",
  },
  {
    rule: "no em dash in copy",
    text: "Not yet — it is the open gap on the overnight build.",
    why: "The audit harness's own messages and sample rows, there before CA-06, which only adds its four link routes to the file. Not shown on any page.",
  },
  {
    rule: "no em dash in copy",
    text: "React throws on the",
    why: "The audit harness's own messages and sample rows, there before CA-06, which only adds its four link routes to the file. Not shown on any page.",
  },
  {
    rule: "spacing 22 is not in SPACE_REFINED",
    text: 'marginLeft: 22, display: "flex", flexDirection: "column", gap: 2, paddingTop: 4',
    why: "Sources' prompts under a session (UI-P64), lined up under the session's name past its 22px chevron. There before CA-06, which only adds a session's colour dot to the file.",
  },
  {
    rule: "no fade-in on scroll",
    text: "const observer = useRef<IntersectionObserver | null>(null);",
    why: "The build page, before CA-06, which only adds the post's links to the file (useReaderPostLinks). Not new, and not CA-06's to restyle.",
  },
  {
    rule: "no fade-in on scroll",
    text: "if (typeof IntersectionObserver === \"undefined\") {",
    why: "The build page, before CA-06, which only adds the post's links to the file (useReaderPostLinks). Not new, and not CA-06's to restyle.",
  },
  {
    rule: "no fade-in on scroll",
    text: "const watch = new IntersectionObserver(",
    why: "The build page, before CA-06, which only adds the post's links to the file (useReaderPostLinks). Not new, and not CA-06's to restyle.",
  },
  {
    rule: "spacing 7 is not in SPACE_REFINED",
    text: "flexDirection: \"column\", gap: 7 }}>",
    why: "The build page, before CA-06, which only adds the post's links to the file (useReaderPostLinks). Not new, and not CA-06's to restyle.",
  },
  {
    rule: "spacing 7 is not in SPACE_REFINED",
    text: "flexDirection: \"column\", gap: 7, minWidth: 0 }} data-node-id={node.id}>",
    why: "The build page, before CA-06, which only adds the post's links to the file (useReaderPostLinks). Not new, and not CA-06's to restyle.",
  },
  {
    rule: "spacing 17 is not in SPACE_REFINED",
    text: "padding: \"12px 17px\", marginBottom: 9",
    why: "The build page, before CA-06, which only adds the post's links to the file (useReaderPostLinks). Not new, and not CA-06's to restyle.",
  },
  {
    rule: "spacing 9 is not in SPACE_REFINED",
    text: "padding: \"12px 17px\", marginBottom: 9",
    why: "The build page, before CA-06, which only adds the post's links to the file (useReaderPostLinks). Not new, and not CA-06's to restyle.",
  },
  {
    rule: "no cursor-following light",
    text: "root.addEventListener(\"mousemove\", onMove);",
    why: "The post editor's block handle (PT-06) finds the block level with the pointer to put its grip beside it; it draws no light. There before CA-07, which only stops it offering a picture.",
  },
  {
    rule: "no cursor-following light",
    text: "root.removeEventListener(\"mousemove\", onMove);",
    why: "The post editor's block handle (PT-06) finds the block level with the pointer to put its grip beside it; it draws no light. There before CA-07, which only stops it offering a picture.",
  },
  {
    rule: "a native range input",
    text: 'type="range"',
    why: "CA-07 P5: Crop media's zoom. The codebase has no slider, so the prompt allows a native range held to the refined look (accentColor --text, a Field label Zoom), in EditMediaDialog.tsx only.",
  },
  {
    rule: "no untouched shadcn",
    text: "import { Toaster as Sonner } from \"@/components/ui/sonner\";",
    why: "The app root (App.tsx) mounts these providers; there before CA-10, which only adds a default staleTime.",
  },
  {
    rule: "no untouched shadcn",
    text: "import { Toaster } from \"@/components/ui/toaster\";",
    why: "The app root (App.tsx) mounts these providers; there before CA-10, which only adds a default staleTime.",
  },
  {
    rule: "no untouched shadcn",
    text: "import { TooltipProvider } from \"@/components/ui/tooltip\";",
    why: "The app root (App.tsx) mounts these providers; there before CA-10, which only adds a default staleTime.",
  },
  {
    rule: "no em dash in copy",
    text: " — buildgallery\"",
    why: "The page title convention \"Page — buildgallery\" in the tab, there before CA-10; not drawn on the page.",
  },
  {
    rule: "no fade-in on scroll",
    text: "const observer = new IntersectionObserver((entries) => {",
    why: "CA-10: polling only while a panel is on screen (useOnScreen). It reads whether an element shows; it fades nothing in.",
  },
  {
    rule: "no fade-in on scroll",
    text: "let observer: IntersectionObserver | null = null;",
    why: "CA-27 P3: a build of hundreds of tiles draws only the tiles near the view. It reads whether a tile's box is near, to draw its card or not; it fades nothing in.",
  },
  {
    rule: "no fade-in on scroll",
    text: "function sharedObserver(): IntersectionObserver | null {",
    why: "CA-27 P3: a build of hundreds of tiles draws only the tiles near the view. It reads whether a tile's box is near, to draw its card or not; it fades nothing in.",
  },
  {
    rule: "no fade-in on scroll",
    text: "if (typeof IntersectionObserver === \"undefined\") return null;",
    why: "CA-27 P3: a build of hundreds of tiles draws only the tiles near the view. It reads whether a tile's box is near, to draw its card or not; it fades nothing in.",
  },
  {
    rule: "no fade-in on scroll",
    text: "observer = new IntersectionObserver(",
    why: "CA-27 P3: a build of hundreds of tiles draws only the tiles near the view. It reads whether a tile's box is near, to draw its card or not; it fades nothing in.",
  },
  {
    rule: "no fade-in on scroll",
    text: "vi.stubGlobal(\"IntersectionObserver\", FakeObserver);",
    why: "CA-27 P3: a build of hundreds of tiles draws only the tiles near the view. It reads whether a tile's box is near, to draw its card or not; it fades nothing in.",
  },
  {
    rule: "no untouched shadcn",
    text: "} from \"@/components/ui/dropdown-menu\";",
    why: "The Drafts page (UI-P46, UI-P52 density), there before CA-10, which only gives each panel its own status. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "spacing 9 is not in SPACE_REFINED",
    text: "gap: 9,",
    why: "The Drafts page (UI-P46, UI-P52 density), there before CA-10, which only gives each panel its own status. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: "padding: \"0 10px\",",
    why: "The Drafts page (UI-P46, UI-P52 density), there before CA-10, which only gives each panel its own status. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "spacing 7, 10 is not in SPACE_REFINED",
    text: "padding: \"7px 10px\",",
    why: "The Drafts page (UI-P46, UI-P52 density), there before CA-10, which only gives each panel its own status. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "spacing 9 is not in SPACE_REFINED",
    text: "padding: \"0 9px\",",
    why: "The Drafts page (UI-P46, UI-P52 density), there before CA-10, which only gives each panel its own status. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "spacing 7 is not in SPACE_REFINED",
    text: "gap: 7,",
    why: "The Drafts page (UI-P46, UI-P52 density), there before CA-10, which only gives each panel its own status. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "spacing 17 is not in SPACE_REFINED",
    text: "gap: 17,",
    why: "The Drafts page (UI-P46, UI-P52 density), there before CA-10, which only gives each panel its own status. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "spacing 3 is not in SPACE_REFINED",
    text: "padding: \"0 3px\",",
    why: "The unread badge (UI-P87), 12 high with 3 of padding, there before CA-10, which only names the shell's heights in this file.",
  },
  {
    rule: "spacing 9 is not in SPACE_REFINED",
    text: "padding: 9,",
    why: "The composer's Your sessions panel (UI-P64), there before CA-10, which only makes Add model's Other focus in the tap. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "spacing 7 is not in SPACE_REFINED",
    text: "height: phone ? 44 : 33, padding: \"0 7px\", fontSize: phone ? 16 : 14 };",
    why: "The composer's Your sessions panel (UI-P64), there before CA-10, which only makes Add model's Other focus in the tap. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "spacing 7 is not in SPACE_REFINED",
    text: "padding: \"4px 6px 7px\", fontFamily: FIGTREE, fontSize: 12, color: t.text2 }}>No prompts in this session.",
    why: "The composer's Your sessions panel (UI-P64), there before CA-10, which only makes Add model's Other focus in the tap. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "spacing 9 is not in SPACE_REFINED",
    text: "<div style={{ marginTop: 9 }}>",
    why: "The composer's Your sessions panel (UI-P64), there before CA-10, which only makes Add model's Other focus in the tap. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "spacing 7 is not in SPACE_REFINED",
    text: "gap: phone ? 4 : 7, marginTop: 10 }}>",
    why: "The composer's Your sessions panel (UI-P64), there before CA-10, which only makes Add model's Other focus in the tap. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: "gap: phone ? 4 : 7, marginTop: 10 }}>",
    why: "The composer's Your sessions panel (UI-P64), there before CA-10, which only makes Add model's Other focus in the tap. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "a native <select>",
    text: "<select id={`${id}-model`} value={choice}",
    why: "The composer's Your sessions panel (UI-P64), there before CA-10, which only makes Add model's Other focus in the tap. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "the lucide icon ChevronDown drawn on its own",
    text: "<ChevronDown",
    why: "The composer's Your sessions panel (UI-P64), there before CA-10, which only makes Add model's Other focus in the tap. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "spacing 14 is not in SPACE_REFINED",
    text: 'padding: "8px 8px 8px 14px"',
    why: "The strips at the top of the Build column (CA-23): padding 8 8 8 14 is the board's own measure for the Offline and Changed in another tab strips.",
  },
  {
    rule: "spacing 14 is not in SPACE_REFINED",
    text: 'padding: "12px 14px"',
    why: "The clash window's two panels (CA-23): padding 12 14 is the board's own measure.",
  },
  {
    rule: "spacing 7 is not in SPACE_REFINED",
    text: 'padding: "0 7px",',
    why: "The Importing tag (CA-24 P4): 20 tall, padding 0 7, radius 5 is the board's own measure, as the tag in modalRecipes.tsx has.",
  },
  {
    rule: "spacing 14 is not in SPACE_REFINED",
    text: 'margin: "14px 0 4px"',
    why: "The Publish checklist (CA-25): a section's label 14 below the line (or the section above) and 4 above its rows is the board's own measure.",
  },
  {
    rule: "spacing 10 is not in SPACE_REFINED",
    text: "gap: 10, minHeight: 48",
    why: "The Publish checklist's rows (CA-25): the circle sits 10 before the words, the board's own measure.",
  },
  {
    rule: "spacing 17 is not in SPACE_REFINED",
    text: 'padding: "4px 17px", touchAction',
    why: "The phone sheet's grabber (UI-P19), unchanged by CA-26: its 40 by 5 bar sits in a 17-wide grip. CA-26 only gives the sheet its focus handlers.",
  },
  {
    rule: "spacing 9 is not in SPACE_REFINED",
    text: 'justifyContent: "space-between", gap: 9',
    why: "The phone sheet's title row (UI-P55's 9 between its parts), unchanged by CA-26.",
  },
];

/** Every finding for one file's source. Pure, so the rules can be tested on snippets. */
export function lookFindings(source: string, file = "snippet.tsx"): Finding[] {
  const code = stripComments(source);
  const out: Finding[] = [];
  for (const { rule, pattern } of FORBIDDEN) for (const match of every(pattern, code)) out.push(found(rule, code, match.index ?? 0));
  out.push(...spacingFindings(code), ...componentFindings(code, file));
  const recipe = RECIPE_FILES.some((name) => file.endsWith(name));
  return out.filter((finding) => !(recipe && (finding.rule.startsWith("spacing ") || finding.rule === "an outline other than ring()"))).filter((finding) => !ALLOWED.some((allowed) => allowed.rule === finding.rule && finding.text.includes(allowed.text)));
}

/* ── rule 3: no buzzwords in copy ── */

export const BUZZWORDS = [
  "seamless", "effortless", "powerful", "unlock", "supercharge", "elevate", "leverage", "robust", "cutting-edge",
  "next-level", "game-changer", "revolutionary", "magic", "streamline", "empower",
] as const;

const BUZZ = new RegExp(`(?<![\\w-])(${BUZZWORDS.map((word) => word.replace(/-/g, "\\-")).join("|")})(?![\\w-])`, "i");

/** Every string a *_COPY value holds: strings, the strings in objects and arrays, and what a function returns. */
export function copyStrings(value: unknown, depth = 0): string[] {
  if (depth > 6) return [];
  if (typeof value === "string") return [value];
  if (typeof value === "function") {
    const samples: unknown[][] = [[], [2], ["Gmail"], ["Gmail", "Notion"], [2, 3], [["Gmail", "Notion"]]];
    const said: string[] = [];
    for (const args of samples) {
      try {
        said.push(...copyStrings((value as (...a: unknown[]) => unknown)(...args), depth + 1));
      } catch {
        /* a sample the function does not take */
      }
    }
    return said;
  }
  if (Array.isArray(value)) return value.flatMap((entry) => copyStrings(entry, depth + 1));
  if (value && typeof value === "object") return Object.values(value).flatMap((entry) => copyStrings(entry, depth + 1));
  return [];
}

export const buzzwordIn = (text: string): string | null => BUZZ.exec(text)?.[1] ?? null;

/* ── the rules on snippets: each fires, and the allowed forms pass ── */

describe("the look rules, on snippets", () => {
  const rules = (source: string, file?: string) => lookFindings(source, file).map((finding) => finding.rule);

  it("finds every forbidden form, with its line", () => {
    const source = [
      "const a = { background: 'linear-gradient(red, blue)' };",
      "const b = { backdropFilter: 'blur(4px)' };",
      "const c = { fontStyle: \"italic\" };",
      "const d = 'Built with care — by you';",
      "const e = 'Launch \u{1F680}';",
      "import { Button } from \"@/components/ui/button\";",
      "new IntersectionObserver(() => {});",
    ].join("\n");
    const findings = lookFindings(source);
    expect(findings.map((finding) => [finding.rule, finding.line])).toEqual([
      ["no gradient (linear)", 1],
      ["no glass (backdrop-filter)", 2],
      ["no italic", 3],
      ["no fade-in on scroll", 7],
      ["no untouched shadcn", 6],
      ["no emoji", 5],
      ["no em dash in copy", 4],
    ]);
  });

  it("reads past comments, keeping the line numbers", () => {
    const source = "// a linear-gradient — in a comment\n/* backdrop-filter\n */ const x = { padding: 10 };";
    expect(lookFindings(source).map((finding) => [finding.rule, finding.line])).toEqual([["spacing 10 is not in SPACE_REFINED", 3]]);
    expect(stripComments("const u = 'https://example.com'; // x").trim()).toBe("const u = 'https://example.com';");
    expect(stripComments("const s = `a ${b} // not a comment`;")).toContain("// not a comment");
  });

  it("holds spacing to SPACE_REFINED, 0 and 1", () => {
    expect(rules("const s = { gap: 8, padding: \"4px 12px\", margin: 0, paddingTop: 1, rowGap: 16 };")).toEqual([]);
    expect(rules("const s = { gap: 14 };")).toEqual(["spacing 14 is not in SPACE_REFINED"]);
    expect(rules("const s = { padding: \"7px 10px\" };")).toEqual(["spacing 7, 10 is not in SPACE_REFINED"]);
    expect(rules("const s = { padding: phone ? 10 : 8 };")).toEqual(["spacing 10 is not in SPACE_REFINED"]);
    expect(rules("const s = { margin: \"-12px -4px\" };")).toEqual([]);
    expect(rules("const s = { padding: size / 2, gap: MAP.row - row };")).toEqual([]);
  });

  it("holds to the Components table", () => {
    expect(rules("<select value={a} />")).toEqual(["a native <select>"]);
    expect(rules("<input type=\"radio\" checked />")).toEqual(["a visible radio input"]);
    expect(rules("<VisuallyHidden><input type=\"radio\" checked /></VisuallyHidden>")).toEqual([]);
    expect(rules("<input type=\"checkbox\" style={VISUALLY_HIDDEN} />")).toEqual([]);
    expect(rules("<input type=\"radio\" onChange={() => pick(a)} style={VISUALLY_HIDDEN} />")).toEqual([]);
    expect(rules("const s = { textTransform: \"uppercase\" };")).toEqual(["upper case outside the Details eyebrow"]);
    expect(rules("export const EYEBROW = { textTransform: \"uppercase\" };", "src/pages/site/compose/refinedStyles.ts")).toEqual([]);
    expect(rules("const s = { fontFamily: DM_MONO, textTransform: \"none\" };")).toEqual(["the data face with upper case"]);
    expect(rules("<label style={{ fontFamily: DM_MONO }}>Name</label>")).toEqual(["the data face on a label"]);
    expect(rules("import { X } from \"lucide-react\";\nconst a = <X size={12} />;")).toEqual(["the lucide icon X drawn on its own"]);
    expect(rules("import { X } from \"lucide-react\";\nconst a = <IconButton icon={X} glyph=\"x\" label=\"Remove\" />;")).toEqual([]);
    expect(rules("const s = state.hovered ? { opacity: 0.8 } : {};")).toEqual(["opacity on hover"]);
    expect(rules("const s = { outline: \"2px solid red\" };")).toEqual(["an outline other than ring()"]);
    expect(rules("const s = { outline: \"none\", ...ring(focus) };")).toEqual([]);
  });

  it("lets a border take a maker's colour only through partColour.ts (CA-06)", () => {
    expect(rules("const s = { border: `1px solid ${t.hairline}`, borderColor: selected ? t.selectedEdge : t.tileBorder };")).toEqual([]);
    expect(rules("const s = { ...(step.colour ? borderFor(step.colour) : null) };")).toEqual([]);
    expect(rules("const s = { borderColor: step.colour };")).toEqual(["a border colour not from a token or partColour"]);
    expect(rules("const s = { border: `1px solid ${colour}` };")).toEqual(["a border colour not from a token or partColour"]);
    expect(rules("const s = { borderLeft: \"2px solid #7FA7D9\" };")).toEqual(["a border colour not from a token or partColour"]);
    expect(rules("const s = { borderColor: hex };", "src/lib/theme/partColour.ts")).toEqual([]);
  });

  it("lets the picture shade be written only in shade.ts (CA-07)", () => {
    expect(rules('export const PICTURE_SHADE = "rgba(15,15,16,0.72)";', "src/components/post/media/shade.ts")).toEqual([]);
    expect(rules('const s = { background: "rgba(15,15,16,0.72)" };', "src/components/post/editor/GridView.tsx")).toEqual(["the picture shade outside shade.ts"]);
    expect(rules('const s = { background: PICTURE_SHADE, color: PICTURE_INK };', "src/components/post/media/GridTile.tsx")).toEqual([]);
    expect(rules('const s = { color: "#fff" };', "src/components/post/media/GridTile.tsx")).toEqual(["a raw colour on a picture not from shade.ts"]);
  });

  it("lets the map well's dot grid stay, and no other gradient", () => {
    expect(rules("const w = { background: `radial-gradient(${t.dotGrid} 1px, transparent 1px) 0 0 / 16px 16px, ${t.well}` };")).toEqual([]);
    expect(rules("const w = { background: `radial-gradient(${t.lit} 1px, transparent 1px)` };")).toEqual(["no gradient (radial)"]);
  });

  it("finds a buzzword as a whole word only", () => {
    expect(buzzwordIn("A seamless way in")).toBe("seamless");
    expect(buzzwordIn("Unlock it")).toBe("Unlock");
    expect(buzzwordIn("The robustness of it")).toBeNull();
    expect(buzzwordIn("A next-level build")).toBe("next-level");
    expect(copyStrings({ a: "one", b: ["two"], c: (n: number) => `${n} three` })).toEqual(expect.arrayContaining(["one", "two", "2 three"]));
  });
});

/* ── the rules, on every file CA-03 adds or changes ── */

if (CA03_FILES.length > 0) describe.each(CA03_FILES.map((file) => [file]))("%s", (file) => {
  const source = fs.readFileSync(path.join(ROOT, file), "utf8");

  it("keeps the look's rules", () => {
    const findings = lookFindings(source, file).map((finding) => `${file}:${finding.line} ${finding.rule} · ${finding.text}`);
    expect(findings).toEqual([]);
  });

  it("uses no buzzword in its copy", async () => {
    if (!/export const \w+_COPY\b/.test(source)) return;
    const module = (await import(/* @vite-ignore */ path.join(ROOT, file))) as Record<string, unknown>;
    const hits: string[] = [];
    for (const [name, value] of Object.entries(module)) {
      if (!name.endsWith("_COPY")) continue;
      for (const said of copyStrings(value)) {
        const word = buzzwordIn(said);
        if (word) hits.push(`${file} ${name}: "${word}" in "${said}"`);
      }
    }
    expect(hits).toEqual([]);
  });
});

it("lists only files that exist", () => {
  for (const file of CA03_FILES) expect(fs.existsSync(path.join(ROOT, file)), file).toBe(true);
});

/* ── CA-15b: no modal sets a colour, a size or a radius outside the recipes ── */

const MODAL_STYLE = /\bt\.[a-z]\w*|#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(|\b(?:borderRadius|fontSize|fontWeight|lineHeight|boxShadow|background|border(?:Top|Right|Bottom|Left)?|color)\s*:|\b(?:height|width|minHeight|minWidth|maxHeight|maxWidth|padding\w*|margin\w*|gap|rowGap|columnGap)\s*:\s*(?:["'`]|-?[1-9])/;

/** Each place a modal file paints or sizes something itself. */
export function modalStyleFindings(source: string): Finding[] {
  const code = stripComments(source);
  return [...every(MODAL_STYLE, code)].map((match) => found("a modal style outside modalRecipes", code, match.index ?? 0));
}

describe("modal files take their look from modalRecipes.tsx (CA-15b)", () => {
  it("catches a colour, a size and a radius", () => {
    expect(modalStyleFindings("const a = { color: t.text };")).not.toEqual([]);
    expect(modalStyleFindings("<div style={{ padding: 12 }} />")).not.toEqual([]);
    expect(modalStyleFindings("<div style={{ borderRadius: 8 }} />")).not.toEqual([]);
    expect(modalStyleFindings("<Row label=\"Name\" phone={phone} />")).toEqual([]);
  });

  it.each(MODAL_FILES.map((file) => [file]))("%s sets no style of its own", (file) => {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    expect(modalStyleFindings(source).map((finding) => `${file}:${finding.line} ${finding.text}`)).toEqual([]);
  });

  it("lists modal files that are in the look's list", () => {
    for (const file of MODAL_FILES) expect(CA03_FILES, file).toContain(file);
  });
});
