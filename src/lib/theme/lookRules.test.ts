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
  "src/pages/site/compose/BuildMap.test.tsx",
  "src/pages/site/compose/BuildMap.tsx",
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
  "src/lib/build/mapLayout.ts",
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
  "src/lib/build/mapLayout.test.ts",
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
  "src/hooks/useLibrarySessions.ts",
  "src/hooks/useWaitingSessions.test.tsx",
  "src/hooks/useWaitingSessions.ts",
  "src/lib/build/__audit__/fakeSupabase.ts",
  "src/pages/site/compose/ComposePage.tsx",
  "src/pages/site/compose/useComposeSessions.ts",
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
  "src/pages/site/compose/BuildMap.tsx",
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
  "src/pages/site/gallery/GalleryPatterns.test.tsx",
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
  "src/components/gallery/ClassificationFilters.tsx",
  "src/pages/site/compose/CardPreview.tsx",
  "src/pages/site/compose/ClassificationPicker.tsx",
  "src/pages/site/compose/ReadFromBuild.tsx",
  "src/pages/site/compose/SandboxCard.tsx",
  "src/pages/site/compose/classificationPieces.tsx",
  "src/pages/site/gallery/GalleryBoard.tsx",
  "src/pages/site/gallery/GalleryBoardGroups.tsx",
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
  "src/pages/site/compose/DetailsOverlay.tsx",
  "src/pages/site/compose/DetailsOverlay.test.tsx",
  // CA-18 P4
  "src/pages/site/compose/detailsLayout.ts",
  "src/pages/site/compose/detailsLayout.test.ts",
  "src/pages/site/compose/DetailsAside.tsx",
  "src/pages/site/compose/SandboxView.tsx",
  "src/pages/site/compose/SandboxView.test.tsx",
  "src/pages/site/compose/ComposeRoute.tsx",
  "src/components/shell/SiteFrame.tsx",
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
const RECIPE_FILES: readonly string[] = ["src/pages/site/compose/detailsRecipes.ts", "src/pages/site/compose/modalRecipes.tsx", "src/pages/site/compose/modalRecipes.test.tsx", "src/pages/site/compose/tileRecipes.tsx", "src/pages/site/compose/tileRecipes.test.tsx"];

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
    rule: "no untouched shadcn",
    text: "} from \"@/components/ui/dropdown-menu\";",
    why: "The Drafts page (UI-P46, UI-P52 density), there before CA-10, which only gives each panel its own status. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "spacing 9 is not in SPACE_REFINED",
    text: "justifyContent: \"space-between\", gap: 9, padding: \"9px 9px 6px\"",
    why: "The Drafts page (UI-P46, UI-P52 density), there before CA-10, which only gives each panel its own status. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "spacing 9, 9 is not in SPACE_REFINED",
    text: "justifyContent: \"space-between\", gap: 9, padding: \"9px 9px 6px\"",
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
    rule: "spacing 10, 7 is not in SPACE_REFINED",
    text: "padding: phone ? \"4px 4px 4px 10px\" : \"4px 4px 4px 7px\",",
    why: "The Drafts page (UI-P46, UI-P52 density), there before CA-10, which only gives each panel its own status. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "spacing 7 is not in SPACE_REFINED",
    text: "justifyContent: \"flex-end\", gap: 7 }}>",
    why: "The Drafts page (UI-P46, UI-P52 density), there before CA-10, which only gives each panel its own status. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "spacing 9, 9 is not in SPACE_REFINED",
    text: "<div style={{ padding: \"6px 9px 9px\" }}>",
    why: "The Drafts page (UI-P46, UI-P52 density), there before CA-10, which only gives each panel its own status. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "spacing 9 is not in SPACE_REFINED",
    text: "style={{ margin: \"4px 9px 6px\", display: \"block\" }}>",
    why: "The Drafts page (UI-P46, UI-P52 density), there before CA-10, which only gives each panel its own status. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "spacing 17 is not in SPACE_REFINED",
    text: "marginTop: 17,",
    why: "The Drafts page (UI-P46, UI-P52 density), there before CA-10, which only gives each panel its own status. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "spacing 17 is not in SPACE_REFINED",
    text: "gap: 17,",
    why: "The Drafts page (UI-P46, UI-P52 density), there before CA-10, which only gives each panel its own status. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "spacing 17 is not in SPACE_REFINED",
    text: "<div style={{ marginTop: 17, display: \"flex\" }}>{older}</div>",
    why: "The Drafts page (UI-P46, UI-P52 density), there before CA-10, which only gives each panel its own status. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "the lucide icon ChevronRight drawn on its own",
    text: "<ChevronRight size={16} strokeWidth={1.6} color=\"var(--text2)\"",
    why: "The Drafts page (UI-P46, UI-P52 density), there before CA-10, which only gives each panel its own status. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "the lucide icon GripVertical drawn on its own",
    text: "<GripVertical size={14} strokeWidth={1.6} color=\"var(--text2)\"",
    why: "The Drafts page (UI-P46, UI-P52 density), there before CA-10, which only gives each panel its own status. Restyling it would change structural CSS on an existing layout element (RULES.md 3).",
  },
  {
    rule: "the lucide icon Plus drawn on its own",
    text: "<Plus size={16} strokeWidth={1.8} aria-hidden=\"true\" style={{ flexShrink: 0 }} />",
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
