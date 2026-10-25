# CA-29 · Writes whose returned error is not read

Found by a TypeScript-AST scan of `src` (not tests, not `__audit__`, not the generated `types.ts`) for an `insert`, `update`, `upsert`, `delete` or `rpc` on a Supabase builder whose `await` is a bare statement, or whose result is destructured without `error`. For a follow-up; CA-29 changes none of these.

Count: 175.

Fixed in CA-29 (the paths the prompt changes) and no longer in this list: `PublishUpdateModal.tsx` (content_versions insert), `exportToFormat.ts` (ai_export_log insert), `notifications/insertNotification.ts`, and two updates in `notifications/triggers.ts`. The checkout, notify, PDF and password reset calls already read their error, and now also report it.

| file:line | call | |
| --- | --- | --- |
| `src/components/AddToCollectionModal.tsx:90` | `delete` | discarded |
| `src/components/AddToCollectionModal.tsx:95` | `update` | discarded |
| `src/components/AddToCollectionModal.tsx:102` | `insert` | discarded |
| `src/components/AddToCollectionModal.tsx:108` | `update` | discarded |
| `src/components/AddToCollectionModal.tsx:115` | `insert` | discarded |
| `src/components/AddToCollectionModal.tsx:167` | `insert` | discarded |
| `src/components/AddToCollectionModal.tsx:170` | `insert` | discarded |
| `src/components/AddToLibraryButton.tsx:84` | `insert` | discarded |
| `src/components/ambient/useWelcomeXp.ts:41` | `rpc` | discarded |
| `src/components/BookmarkButton.tsx:148` | `update` | discarded |
| `src/components/BookmarkButton.tsx:160` | `update` | discarded |
| `src/components/BookmarkButton.tsx:164` | `update` | discarded |
| `src/components/BookmarkButton.tsx:173` | `insert` | discarded |
| `src/components/BookmarkButton.tsx:178` | `update` | discarded |
| `src/components/ChangelogTab.tsx:52` | `update` | discarded |
| `src/components/CommentsSection.tsx:135` | `insert` | discarded |
| `src/components/CommentsSection.tsx:207` | `delete` | discarded |
| `src/components/CommentsSection.tsx:213` | `update` | discarded |
| `src/components/CommentsSection.tsx:217` | `insert` | discarded |
| `src/components/CommentsSection.tsx:223` | `update` | discarded |
| `src/components/CommentsSection.tsx:227` | `insert` | discarded |
| `src/components/CompatibilityTable.tsx:58` | `insert` | discarded |
| `src/components/ContentBlockViewer.tsx:1425` | `insert` | discarded |
| `src/components/dm/MessageInputBar.tsx:177` | `insert` | discarded |
| `src/components/dm/MessageInputBar.tsx:192` | `insert` | discarded |
| `src/components/dm/MessageInputBar.tsx:217` | `insert` | discarded |
| `src/components/dm/MessageInputBar.tsx:282` | `insert` | discarded |
| `src/components/dm/ShareToDMModal.tsx:111` | `insert` | error not read |
| `src/components/dm/ShareToDMModal.tsx:121` | `insert` | discarded |
| `src/components/dm/ThreadView.tsx:280` | `delete` | discarded |
| `src/components/dm/ThreadView.tsx:282` | `upsert` | discarded |
| `src/components/dm/ThreadView.tsx:619` | `update` | discarded |
| `src/components/dm/ThreadView.tsx:623` | `update` | discarded |
| `src/components/dm/ThreadView.tsx:630` | `update` | discarded |
| `src/components/dm/ThreadView.tsx:681` | `update` | discarded |
| `src/components/dm/ThreadView.tsx:736` | `delete` | discarded |
| `src/components/dm/ThreadView.tsx:738` | `upsert` | discarded |
| `src/components/dm/ThreadView.tsx:747` | `update` | discarded |
| `src/components/feed-card.tsx:793` | `delete` | discarded |
| `src/components/feed-card.tsx:800` | `insert` | discarded |
| `src/components/ForkModal.tsx:88` | `insert` | error not read |
| `src/components/ForkModal.tsx:127` | `insert` | discarded |
| `src/components/ForkModal.tsx:133` | `insert` | discarded |
| `src/components/GuestDownloadModal.tsx:27` | `insert` | discarded |
| `src/components/GuestDownloadModal.tsx:46` | `update` | discarded |
| `src/components/ProjectUploadForm.tsx:138` | `insert` | discarded |
| `src/components/ProjectUploadForm.tsx:644` | `insert` | discarded |
| `src/components/ProjectUploadForm.tsx:691` | `insert` | discarded |
| `src/components/ProjectUploadForm.tsx:706` | `insert` | error not read |
| `src/components/ProjectUploadForm.tsx:714` | `insert` | discarded |
| `src/components/ProjectUploadForm.tsx:722` | `insert` | discarded |
| `src/components/ProjectUploadForm.tsx:733` | `insert` | discarded |
| `src/components/PublishCollectionModal.tsx:125` | `insert` | discarded |
| `src/components/PublishCollectionModal.tsx:128` | `update` | discarded |
| `src/components/PublishCollectionModal.tsx:310` | `insert` | discarded |
| `src/components/PublishCollectionModal.tsx:313` | `update` | discarded |
| `src/components/ReblogComposer.tsx:642` | `insert` | discarded |
| `src/components/ReblogComposer.tsx:656` | `insert` | discarded |
| `src/components/ReblogComposer.tsx:671` | `update` | discarded |
| `src/components/ReblogComposer.tsx:699` | `update` | discarded |
| `src/components/StarRating.tsx:89` | `update` | discarded |
| `src/components/StarRating.tsx:95` | `insert` | discarded |
| `src/components/StarRating.tsx:119` | `insert` | discarded |
| `src/components/TipsTab.tsx:71` | `delete` | discarded |
| `src/components/TipsTab.tsx:73` | `insert` | discarded |
| `src/components/VerificationButton.tsx:52` | `insert` | discarded |
| `src/components/VerificationButton.tsx:57` | `insert` | discarded |
| `src/hooks/useCanvasDocument.ts:454` | `upsert` | discarded |
| `src/hooks/useCanvasDocument.ts:480` | `delete` | discarded |
| `src/hooks/useCanvasDocument.ts:485` | `insert` | discarded |
| `src/hooks/useCanvasDocument.ts:495` | `delete` | discarded |
| `src/hooks/useCanvasDocument.ts:500` | `insert` | discarded |
| `src/hooks/useCanvasDocument.ts:517` | `update` | discarded |
| `src/hooks/useCanvasDocument.ts:566` | `insert` | discarded |
| `src/hooks/useDocumentComments.ts:146` | `update` | discarded |
| `src/hooks/useDocumentComments.ts:158` | `update` | discarded |
| `src/hooks/useDocumentComments.ts:168` | `delete` | discarded |
| `src/hooks/usePresence.ts:32` | `upsert` | discarded |
| `src/lib/bounty-competition/pledgeToSubBounty.ts:123` | `update` | discarded |
| `src/lib/bounty-competition/promoteBountyToBlueprint.ts:116` | `insert` | discarded |
| `src/lib/bounty-competition/promoteBountyToBlueprint.ts:151` | `insert` | discarded |
| `src/lib/bounty-solver/acceptSolution.ts:81` | `insert` | discarded |
| `src/lib/bounty-solver/acceptSolution.ts:112` | `update` | discarded |
| `src/lib/bounty-solver/acceptSolution.ts:154` | `update` | discarded |
| `src/lib/bounty-solver/markBountyDiscussionRead.ts:15` | `upsert` | discarded |
| `src/lib/bounty-solver/submitSolution.ts:73` | `update` | discarded |
| `src/lib/content-detail/getCanonicalPayload.ts:202` | `update` | discarded |
| `src/lib/content-detail/recordPostView.ts:40` | `rpc` | discarded |
| `src/lib/content-detail/recordReadingProgress.ts:66` | `update` | discarded |
| `src/lib/library/reorderCollectionItems.ts:25` | `update` | discarded |
| `src/lib/library/saveToCollection.ts:79` | `update` | discarded |
| `src/lib/library/saveToCollection.ts:102` | `update` | discarded |
| `src/lib/messaging/createBlueprintGroup.ts:46` | `insert` | discarded |
| `src/lib/messaging/createBountyThread.ts:50` | `insert` | discarded |
| `src/lib/messaging/createDirectThread.ts:40` | `insert` | discarded |
| `src/lib/messaging/markContentViewed.ts:24` | `insert` | discarded |
| `src/lib/messaging/sendMessage.ts:21` | `update` | discarded |
| `src/lib/progress/index.ts:154` | `rpc` | error not read |
| `src/lib/progress/index.ts:170` | `rpc` | error not read |
| `src/lib/progress/index.ts:198` | `insert` | error not read |
| `src/lib/reblog/deleteReblog.ts:39` | `rpc` | error not read |
| `src/lib/remix/createRemix.ts:86` | `delete` | discarded |
| `src/pages/Admin.tsx:219` | `update` | discarded |
| `src/pages/Admin.tsx:764` | `update` | discarded |
| `src/pages/Admin.tsx:765` | `insert` | discarded |
| `src/pages/Admin.tsx:766` | `update` | discarded |
| `src/pages/Admin.tsx:783` | `update` | discarded |
| `src/pages/Admin.tsx:784` | `update` | discarded |
| `src/pages/Admin.tsx:794` | `update` | discarded |
| `src/pages/Admin.tsx:795` | `update` | discarded |
| `src/pages/ContentDetail.legacy.tsx:186` | `delete` | discarded |
| `src/pages/ContentDetail.legacy.tsx:193` | `insert` | discarded |
| `src/pages/ContentDetail.legacy.tsx:320` | `rpc` | discarded |
| `src/pages/ContentDetail.legacy.tsx:323` | `insert` | discarded |
| `src/pages/ContentDetail.legacy.tsx:330` | `insert` | discarded |
| `src/pages/ContentDetail.legacy.tsx:356` | `update` | discarded |
| `src/pages/ContentDetail.legacy.tsx:882` | `delete` | discarded |
| `src/pages/ContentDetail.legacy.tsx:884` | `insert` | discarded |
| `src/pages/ContentDetail.legacy.tsx:1625` | `delete` | discarded |
| `src/pages/ContentDetail.legacy.tsx:1627` | `insert` | discarded |
| `src/pages/ContentDetail.legacy.tsx:1642` | `update` | discarded |
| `src/pages/ContentDetail.legacy.tsx:1872` | `insert` | discarded |
| `src/pages/ContentDetail.legacy.tsx:1873` | `insert` | discarded |
| `src/pages/ContentDetail.tsx:493` | `insert` | discarded |
| `src/pages/ContentDetail.tsx:499` | `delete` | discarded |
| `src/pages/ContentDetail.tsx:523` | `insert` | discarded |
| `src/pages/ContentDetail.tsx:529` | `delete` | discarded |
| `src/pages/ContentDetail.tsx:561` | `insert` | discarded |
| `src/pages/ContentDetail.tsx:567` | `delete` | discarded |
| `src/pages/ContentDetail.tsx:2198` | `insert` | discarded |
| `src/pages/ContentDetail.tsx:2202` | `delete` | discarded |
| `src/pages/ContentEdit.tsx:213` | `update` | discarded |
| `src/pages/ContentEdit.tsx:217` | `insert` | discarded |
| `src/pages/ContentEdit.tsx:237` | `update` | discarded |
| `src/pages/Drafts.tsx:174` | `delete` | discarded |
| `src/pages/Drafts.tsx:175` | `delete` | discarded |
| `src/pages/LearningPathDetail.tsx:92` | `insert` | discarded |
| `src/pages/LearningPathDetail.tsx:114` | `update` | discarded |
| `src/pages/Library.legacy.tsx:123` | `insert` | discarded |
| `src/pages/Library.legacy.tsx:140` | `update` | discarded |
| `src/pages/Library.legacy.tsx:148` | `update` | discarded |
| `src/pages/Library.legacy.tsx:149` | `delete` | discarded |
| `src/pages/Messages.legacy.tsx:520` | `update` | discarded |
| `src/pages/Messages.legacy.tsx:524` | `update` | discarded |
| `src/pages/Messages.legacy.tsx:594` | `update` | discarded |
| `src/pages/Messages.legacy.tsx:600` | `update` | discarded |
| `src/pages/Messages.legacy.tsx:607` | `update` | discarded |
| `src/pages/Messages.legacy.tsx:614` | `update` | discarded |
| `src/pages/Messages.legacy.tsx:620` | `update` | discarded |
| `src/pages/Messages.legacy.tsx:626` | `update` | discarded |
| `src/pages/Messages.legacy.tsx:691` | `insert` | error not read |
| `src/pages/Messages.tsx:339` | `update` | discarded |
| `src/pages/Messages.tsx:350` | `update` | discarded |
| `src/pages/Messages.tsx:360` | `delete` | discarded |
| `src/pages/MyUploads.tsx:104` | `update` | discarded |
| `src/pages/Onboarding.tsx:47` | `update` | discarded |
| `src/pages/Onboarding.tsx:55` | `update` | discarded |
| `src/pages/Onboarding.tsx:67` | `update` | discarded |
| `src/pages/PostPreview.tsx:112` | `update` | discarded |
| `src/pages/ProjectDetail.tsx:189` | `rpc` | discarded |
| `src/pages/Upload.tsx:851` | `delete` | discarded |
| `src/pages/Upload.tsx:1215` | `insert` | discarded |
| `src/pages/Upload.tsx:1233` | `insert` | discarded |
| `src/pages/Upload.tsx:1266` | `update` | discarded |
| `src/pages/Upload.tsx:1289` | `update` | discarded |
| `src/pages/Upload.tsx:1293` | `update` | discarded |
| `src/pages/Upload.tsx:1308` | `update` | discarded |
| `src/pages/Upload.tsx:1317` | `update` | discarded |
| `src/pages/Upload.tsx:1333` | `update` | discarded |
| `src/pages/Upload.tsx:1342` | `insert` | discarded |
| `src/pages/Upload.tsx:1351` | `insert` | discarded |
| `src/pages/Upload.tsx:1362` | `insert` | error not read |
| `src/pages/Upload.tsx:1369` | `insert` | discarded |
| `src/pages/Upload.tsx:1632` | `delete` | discarded |
| `src/pages/Upload.tsx:1633` | `delete` | discarded |
