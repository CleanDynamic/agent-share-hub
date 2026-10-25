# SV-01 · writes whose returned `error` is never read

Found by scanning `src` (not tests) for a `.insert`, `.update`, `.upsert`, `.delete` or `.rpc` statement that neither assigns its result nor chains `.then` or `.catch`. This is a heuristic: a statement it misses is not listed, and a few listed ones may read the error another way. Each entry is `file:line` and the first line of the statement.

Fixed in SV-01, on the paths it changed (not listed here): `PublishUpdateModal.tsx` (version row, notification call), `ContentEdit.tsx` (item update, changelog, library flag, notification call), and the edge functions (`verify-project-package`, `generate-ai-pdf`, `notify-version-update`, `check-compatibility-status`). The checkout buttons, the AI-PDF button and the password reset already read their errors.

For a follow-up. Do not change them in this prompt.

```
src/components/AddToCollectionModal.tsx:102  await supabase.from("collection_items").insert({
src/components/AddToCollectionModal.tsx:115  supabase.from("user_interactions").insert({
src/components/AddToCollectionModal.tsx:167  await supabase.from("collection_items").insert(inserts);
src/components/AddToCollectionModal.tsx:170  supabase.from("user_interactions").insert({
src/components/AddToLibraryButton.tsx:84  supabase.from("user_interactions").insert({
src/components/BookmarkButton.tsx:148  await supabase.from("library_folders").update({ item_count: Math.max(0, (folder.item_count
src/components/BookmarkButton.tsx:173  await supabase.from("user_library").insert(insertData);
src/components/CommentsSection.tsx:135  await supabase.from("user_interactions" as any).insert({
src/components/CommentsSection.tsx:213  await supabase.from("content_comments" as any)
src/components/CommentsSection.tsx:217  await supabase.from("comment_likes" as any).insert({
src/components/CommentsSection.tsx:223  await supabase.from("content_comments" as any)
src/components/CommentsSection.tsx:227  await supabase.from("user_interactions" as any).insert({
src/components/CompatibilityTable.tsx:58  await (supabase.from("tool_compatibility" as any) as any).insert({
src/components/ContentBlockViewer.tsx:1429  await supabase.from("ad_impressions").insert({ content_id: contentId, user_id: user?.id ??
src/components/FollowButton.tsx:82  supabase.from("profiles").update({ following_count: followingCount ?? 0 } as any).eq("id",
src/components/FollowButton.tsx:83  supabase.from("profiles").update({ follower_count: followerCount ?? 0 } as any).eq("id", c
src/components/FollowButton.tsx:102  supabase.from("profiles").update({ following_count: followingCount ?? 0 } as any).eq("id",
src/components/FollowButton.tsx:103  supabase.from("profiles").update({ follower_count: followerCount ?? 0 } as any).eq("id", c
src/components/ForkModal.tsx:127  await supabase.from("block_variations").insert(newVariations);
src/components/ForkModal.tsx:133  await supabase.from("user_interactions").insert({
src/components/GuestDownloadModal.tsx:27  supabase.from("ad_impressions").insert({
src/components/GuestDownloadModal.tsx:46  supabase.from("ad_impressions").update({ dismissed_at: new Date().toISOString() } as any)
src/components/ProjectUploadForm.tsx:138  await supabase.from("content_blocks").insert({
src/components/ProjectUploadForm.tsx:644  await supabase.from("project_components").insert({
src/components/ProjectUploadForm.tsx:691  await supabase.from("project_components").insert({
src/components/ProjectUploadForm.tsx:714  await supabase.from("revenue_splits").insert({
src/components/ProjectUploadForm.tsx:722  await supabase.from("notifications").insert({
src/components/ProjectUploadForm.tsx:733  await supabase.from("content_dependencies").insert({
src/components/PublishCollectionModal.tsx:125  await supabase.from("collection_items").insert(collectionItems);
src/components/PublishCollectionModal.tsx:310  await supabase.from("collection_items").insert(inserts);
src/components/ReblogComposer.tsx:642  await supabase.from('content_blocks').insert({
src/components/ReblogComposer.tsx:656  await supabase.from('content_blocks').insert({
src/components/StarRating.tsx:95  await supabase.from("content_ratings" as any).insert({
src/components/StarRating.tsx:119  await supabase.from("user_interactions" as any).insert({
src/components/TipsTab.tsx:71  await supabase.from("tip_upvotes").delete().eq("id", existing.id);
src/components/TipsTab.tsx:73  await supabase.from("tip_upvotes").insert({ tip_id: tipId, user_id: user.id });
src/components/VerificationButton.tsx:52  await supabase.from("content_verifications").insert({
src/components/VerificationButton.tsx:57  await supabase.from("user_interactions").insert({
src/components/ambient/useWelcomeXp.ts:41  await (supabase as any).rpc("mark_welcome_xp_shown");
src/components/dm/MessageInputBar.tsx:177  await supabase.from("dm_messages").insert(insertData);
src/components/dm/MessageInputBar.tsx:192  await supabase.from("dm_messages").insert({
src/components/dm/MessageInputBar.tsx:217  await supabase.from("dm_messages").insert({
src/components/dm/MessageInputBar.tsx:282  await supabase.from("dm_messages").insert({
src/components/dm/ShareToDMModal.tsx:121  await supabase.from("dm_messages").insert({
src/components/dm/ThreadView.tsx:280  await supabase.from("dm_reactions").delete().eq("message_id", messageId).eq("user_id", use
src/components/dm/ThreadView.tsx:282  await supabase.from("dm_reactions").upsert({ message_id: messageId, user_id: userId, emoji
src/components/dm/ThreadView.tsx:681  supabase.from("dm_messages").update({ read_at: new Date().toISOString() }).eq("id", newMsg
src/components/dm/ThreadView.tsx:736  await supabase.from("dm_reactions").delete().eq("id", existing.id);
src/components/dm/ThreadView.tsx:738  await supabase.from("dm_reactions").upsert(
src/components/dm/ThreadView.tsx:747  await supabase.from("dm_messages").update({ is_unsent: true }).eq("id", messageId);
src/components/feed-card.tsx:793  await (supabase as any)
src/components/feed-card.tsx:800  await (supabase as any)
src/hooks/useDocumentComments.ts:168  await supabase.from('document_comments').delete().eq('id', id);
src/hooks/usePresence.ts:32  await supabase.from("dm_presence").upsert(
src/lib/analytics/buildStats.ts:143  db.rpc("maker_build_metrics", { uid: userId }),
src/lib/bounty-competition/pledgeToSubBounty.ts:123  await (supabase as any)
src/lib/bounty-competition/promoteBountyToBlueprint.ts:116  await (supabase as any).from("content_blocks").insert(cloned as any);
src/lib/bounty-competition/promoteBountyToBlueprint.ts:151  await (supabase as any).from("content_collaborators").insert({
src/lib/bounty-solver/acceptSolution.ts:81  await (supabase as any).from("solution_acceptance_log").insert({
src/lib/bounty-solver/acceptSolution.ts:112  await (supabase as any)
src/lib/bounty-solver/acceptSolution.ts:154  await (supabase as any)
src/lib/bounty-solver/markBountyDiscussionRead.ts:15  await (supabase as any)
src/lib/bounty-solver/submitSolution.ts:73  await (supabase as any)
src/lib/content-detail/exportToFormat.ts:152  await (supabase as any)
src/lib/content-detail/getCanonicalPayload.ts:202  await (supabase as any)
src/lib/content-detail/recordPostView.ts:40  await supabase.rpc("increment_content_view_count", { _content_id: postId });
src/lib/content-detail/recordReadingProgress.ts:66  await (supabase as any)
src/lib/download.ts:45  supabase.rpc("increment_download_count", { _content_id: contentId }),
src/lib/download.ts:46  supabase.from("downloads").insert({
src/lib/messaging/createBlueprintGroup.ts:46  await supabase.from("dm_thread_members").insert(memberRows as any);
src/lib/messaging/createBountyThread.ts:50  await supabase.from("dm_thread_members").insert([
src/lib/messaging/createDirectThread.ts:40  await supabase.from("dm_thread_members").insert([
src/lib/messaging/markContentViewed.ts:24  await supabase.from("content_share_views").insert({
src/lib/messaging/sendMessage.ts:21  await supabase.from("dm_threads").update(payload).eq("id", threadId);
src/lib/notifications/insertNotification.ts:20  await supabase.from("notifications" as any).insert({
src/lib/remix/createRemix.ts:86  await (supabase as any).from("content_items").delete().eq("id", draft.id);
src/lib/results/mutations.ts:98  (supabase as any)
src/pages/Admin.tsx:764  await supabase.from("curator_applications").update({ status: "approved" } as any).eq("id",
src/pages/Admin.tsx:765  await supabase.from("curators").insert({ user_id: app.user_id, approved_by: user?.id ?? nu
src/pages/Admin.tsx:766  await supabase.from("profiles").update({ is_curator: true, curator_application_status: "ap
src/pages/Admin.tsx:783  await supabase.from("curator_applications").update({ status: "rejected" } as any).eq("id",
src/pages/Admin.tsx:784  await supabase.from("profiles").update({ curator_application_status: "rejected" } as any).
src/pages/Admin.tsx:794  await supabase.from("curators").update({ is_active: false } as any).eq("id", curator.id);
src/pages/Admin.tsx:795  await supabase.from("profiles").update({ is_curator: false } as any).eq("id", curator.user
src/pages/ContentDetail.legacy.tsx:320  supabase.rpc("increment_content_view_count", { _content_id: item.id });
src/pages/ContentDetail.legacy.tsx:323  supabase.from("content_views" as any).insert({
src/pages/ContentDetail.legacy.tsx:330  supabase.from("user_interactions" as any).insert({
src/pages/ContentDetail.legacy.tsx:882  await supabase.from("bounty_me_too" as any).delete().eq("content_id", id!).eq("user_id", u
src/pages/ContentDetail.legacy.tsx:884  await supabase.from("bounty_me_too" as any).insert({ content_id: id!, user_id: user.id } a
src/pages/ContentDetail.legacy.tsx:1625  await supabase.from("bounty_response_verifications" as any).delete().eq("response_id", res
src/pages/ContentDetail.legacy.tsx:1627  await supabase.from("bounty_response_verifications" as any).insert({ response_id: resp.id,
src/pages/ContentDetail.legacy.tsx:1642  await supabase.from("bounty_responses" as any).update({ is_solution: true } as any).eq("id
src/pages/ContentDetail.legacy.tsx:1872  await supabase.from("curator_recommendations").insert({ curator_id: curatorRow.id, content
src/pages/ContentDetail.legacy.tsx:1873  await supabase.from("user_interactions" as any).insert({ user_id: user.id, content_id: ite
src/pages/ContentDetail.tsx:493  await (supabase as any).from("user_interactions").insert({
src/pages/ContentDetail.tsx:499  await (supabase as any)
src/pages/ContentDetail.tsx:523  await (supabase as any).from("user_interactions").insert({
src/pages/ContentDetail.tsx:529  await (supabase as any)
src/pages/ContentDetail.tsx:561  await (supabase as any).from("collection_items").insert({
src/pages/ContentDetail.tsx:567  await (supabase as any)
src/pages/ContentDetail.tsx:2190  await (supabase as any).from("follows").insert({ follower_id: user.id, followed_id: author
src/pages/ContentDetail.tsx:2194  await (supabase as any)
src/pages/Drafts.tsx:174  await supabase.from("content_blocks").delete().eq("content_id", deleteTarget);
src/pages/Drafts.tsx:175  await supabase.from("content_items").delete().eq("id", deleteTarget);
src/pages/LearningPathDetail.tsx:92  await supabase.from("learning_path_progress").insert({
src/pages/Library.legacy.tsx:123  await supabase.from("library_folders").insert({
src/pages/Library.legacy.tsx:140  await supabase.from("library_folders").update({ name: editName.trim().slice(0, 50) } as an
src/pages/Library.legacy.tsx:148  await supabase.from("user_library").update({ folder_id: null } as any).eq("folder_id", fol
src/pages/Library.legacy.tsx:149  await supabase.from("library_folders").delete().eq("id", folderId);
src/pages/Messages.legacy.tsx:594  await supabase.from("dm_threads").update({ [field]: !thread.is_pinned } as any).eq("id", t
src/pages/Messages.legacy.tsx:600  await supabase.from("dm_threads").update({ [field]: !thread.is_muted } as any).eq("id", th
src/pages/Messages.legacy.tsx:607  await supabase.from("dm_threads").update({ [field]: 1 } as any).eq("id", thread.id);
src/pages/Messages.legacy.tsx:614  await supabase.from("dm_threads").update({ [field]: true } as any).eq("id", thread.id);
src/pages/Messages.legacy.tsx:620  await supabase.from("dm_threads").update({ request_status: "accepted" }).eq("id", thread.i
src/pages/Messages.legacy.tsx:626  await supabase.from("dm_threads").update({ [field]: true } as any).eq("id", thread.id);
src/pages/MyUploads.tsx:104  await supabase.from("collab_invites").update({ status: "withdrawn" } as any).eq("id", invi
src/pages/Onboarding.tsx:47  await supabase.from("profiles").update({ user_interests: interests } as any).eq("id", prof
src/pages/Onboarding.tsx:55  await supabase.from("profiles").update({ user_ai_tools: tools } as any).eq("id", profile.i
src/pages/Onboarding.tsx:67  await supabase.from("profiles").update({
src/pages/PostPreview.tsx:112  await supabase.from("content_items").update({
src/pages/ProjectDetail.tsx:188  supabase.rpc("increment_project_view_count", { _project_id: project.id });
src/pages/Upload.tsx:851  await supabase.from('content_items').delete().eq('id', currentDraftId).eq('status', 'draft
src/pages/Upload.tsx:1215  await supabase.from("block_variations").insert({
src/pages/Upload.tsx:1233  await supabase.from('content_blocks').insert({
src/pages/Upload.tsx:1266  await supabase.from('content_items').update(update).eq('id', contentId);
src/pages/Upload.tsx:1289  await supabase.from("content_items").update(metaUpdates).eq("id", contentId);
src/pages/Upload.tsx:1293  await supabase.from("content_items").update({ custom_use_case_description: customUseCaseDe
src/pages/Upload.tsx:1308  await supabase.from("content_items").update({ what_to_expect_blocks: updatedWte } as any).
src/pages/Upload.tsx:1317  await supabase.from("content_items").update({ cover_image_url: urlData.publicUrl } as any)
src/pages/Upload.tsx:1333  await supabase.from('content_items')
src/pages/Upload.tsx:1342  await supabase.from("content_dependencies").insert({
src/pages/Upload.tsx:1351  await supabase.from("revenue_splits").insert({
src/pages/Upload.tsx:1369  await supabase.from("notifications").insert({
src/pages/Upload.tsx:1632  await supabase.from("content_blocks").delete().eq("content_id", draftId);
src/pages/Upload.tsx:1633  await supabase.from("content_items").delete().eq("id", draftId);
```
