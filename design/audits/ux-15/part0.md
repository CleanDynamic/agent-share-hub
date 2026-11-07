# UX-15 Part 0 · What exists

Read at `ad48b2b` (main, with UX-01 to UX-14 merged). Every name below was found by `grep` and read on disk. No Supabase project is reachable from the session, so database facts come from `supabase/migrations/` only; the live schema may have drifted (RULES §8), which is why Part 1 uses `RESTRICTIVE` policies and catalogue lookups instead of editing policies it cannot see.

## Facts in the prompt that were wrong on disk

| The prompt said | On disk |
| --- | --- |
| `UX-04` to `UX-12` have reports to read | Only `design/audits/ux-03, 06 to 11, 13, 14` exist. UX-04, UX-05 and UX-12 left no report folder; their work was read from the migrations and source (`20261107*`, `ux04_notifications`, `src/content/legal/privacy.ts`). |
| The `···` menus on topics, replies and profiles | Found in `ProfileHead.tsx`, the post page and the thread view. Their file names are in the reach table below. |
| `rc_notify` kinds at writing: `comment, follow, like, published, rebuilt, reply, solution, solved` | The live set is `rebuilt, published, reproduced, comment, reply, like, follow` (RC-P19), SV-20's saver kinds, and UX-04's `post_reply, post_thread, post_mention, post_like, post_started, post_pinned`. `solution` and `solved` were retired by UX-11 part e, which also removed their keys from `notification_preferences`. |
| `profiles.notification_preferences` is read by `rc_notify` or something else | Only by the browser: `src/lib/notifications/createNotification.ts` skips a kind whose key is `false`. `rc_notify` (20261001200000) reads nothing. Part 1 makes `rc_notify` read it. |
| A header `ThemeToggle` | The site header (desktop) has no theme control. `ThemeSegmented` is in the phone's account sheet (`MobileHeader`) and the sign-in page; `ThemeToggle` is in `WorkspaceBar` (legacy) and `AuthShell`. The preference is `localStorage` key `bg-theme` (`ThemeContext`). So on a desktop, Settings › Appearance is the only place to change it once signed in. |
| `MobileHeader.tsx` has no Settings | Its header comment says so; confirmed. The account menu (`AccountMenu.tsx`, SV-26 P2) holds Profile, Library, Drafts, Sign out. |
| `createDirectThread` makes a thread through `dm_threads` | Yes, plus two `dm_thread_members` rows; `dm_messages` has `thread_id`, `sender_id`. Group threads use `dm_thread_members` and are not blocked (see Questions). |

## Assumptions

1. **Supabase client.** `@supabase/supabase-js ^2.99.2`, auth-js **2.103.0** installed. The types have `getUserIdentities`, `linkIdentity`, `unlinkIdentity`, `signOut({ scope: 'global' | 'local' | 'others' })`, `auth.oauth.listGrants()` (returns `{ client: { id, name, uri, logo_uri }, scopes, granted_at }[]`) and `auth.oauth.revokeGrant({ clientId })` (revokes consent, deletes that client's sessions, invalidates its refresh tokens). So **Connected apps is buildable** and Part 7 lists real grants.
2. **Manual identity linking** is a Supabase dashboard setting (Authentication › Sign In / Providers › Allow manual linking). `linkIdentity` fails with a clear error if it is off; the page shows one sentence and Miles is told in `What Miles needs to do`.
3. **Connector tokens.** `supabase/functions/mcp` uses `withSupabase({ auth: 'user' })` (the caller's Supabase access token, minted by the OAuth 2.1 server). It issues and stores no token, key or session table of its own, so the only things to list are the OAuth grants.
4. **Email.** Notifications are in-app only. `grep -ri resend` finds the word only in the connector's retry messages. The last notification row therefore reads `Notifications appear on your Notifications page. No notification is sent by email.`
5. **Auth password rules** are 8 characters minimum (`authModel.ts`, `ResetForms.tsx`, `PasswordStrengthMeter`). Change password reuses `passwordOk` from `authModel.ts`.
6. **Deletion.** `profiles.id` references `auth.users(id) ON DELETE CASCADE`; 86 foreign keys to `profiles` or `auth.users` cascade; the ones that do not are listed under "Data and deletion" below. `auth.admin.deleteUser` therefore removes most rows by itself; the function first replaces replies (which must stay readable), deletes storage objects, and writes `account_deletions`.
7. **Blocking does not exist** (`grep` for `user_blocks`, `block_user`, `is_blocked` finds only the editor's unrelated `blocks` tables and `block_*` build-block tables). Built from nothing.
8. **Feeds.** `get_build_feed` (20261107170000) and `get_profile_feed` (20261109120000) are `SECURITY INVOKER` SQL functions; `listPosts` and the topic page read tables through PostgREST. Blocked authors are filtered inside the two functions; the table reads get the viewer's block set from `blocked_with_me()` in the data layer (there is no function to change), and this is reported.
9. **Quiet confirmation** is the site's `sonner` toast (`@/components/ui/sonner`, loaded idle as `idleSonner`); the panel/ModalShell recipe is `src/pages/site/compose/ModalFrame.tsx` and `@/components/ui/dialog`. There is **no danger style** among the brand `Button` variants (`primary | secondary | ghost`), so `Delete account` and `Sign out everywhere` are `secondary` controls; the confirmation does the work.
10. **Existing privacy controls:** `profiles.is_private` and `notes_visible`/`level_visible` in `profile_settings` (Customise profile › Who sees). Not duplicated.

## Reach points: how blocking closes each

| # | Where A reaches B | Table / function | How it is closed | Proof |
| --- | --- | --- | --- | --- |
| 1 | Follow | `follows` INSERT | `RESTRICTIVE` insert policy with `is_blocked_between(auth.uid(), following_id)`; block trigger deletes both directions | `rls-plan.sql` T1, T9 |
| 2 | New direct thread | `dm_threads` INSERT | Restrictive policy on `participant_a/b` (the one that is not the caller) | T2 |
| 3 | Direct message | `dm_messages` INSERT | Restrictive policy: the thread's other participant (direct threads) | T3 |
| 4 | Message reaction | `dm_reactions` INSERT | Restrictive policy: the message's sender | T3b |
| 5 | Reply to a topic or reply | `openbuild_posts` INSERT (`parent_id` not null) | Restrictive policy against the parent's author | T4 |
| 6 | Mention | `post_mentions` INSERT | Restrictive policy on `user_id` | T5 |
| 7 | Like / reaction on an entry | `post_likes`, `post_reactions` INSERT | Restrictive policy against the entry's author | T6 |
| 8 | Like on a build | `build_likes` INSERT | Restrictive policy against `builds.creator_id` | T6b |
| 9 | Comment on a build | `build_comments` INSERT | Restrictive policy against `builds.creator_id` | T7 |
| 10 | Rebuild | `builds` (parent) | **Left open** (public build, Terms). Question for Miles. | n/a |
| 11 | Start a topic from someone's build | `post_attachments` INSERT | Restrictive policy against `post_attachment_owner(...)` | T8 |
| 12 | Notifications | `rc_notify` | Returns early when `is_blocked_between(recipient, actor)`; skips a kind the recipient turned off | T10, T11 |
| 13 | Home / OpenBuilds feed | `get_build_feed` | Every leg filters `NOT IN (SELECT blocked_with_me())` | T12 |
| 14 | A profile's feed | `get_profile_feed` | Returns nothing when `is_blocked_between(viewer, profile)` | T13 |
| 15 | Header search | `search_build_ids` | Filters builds by blocked creators | T14 |
| 16 | A topic's replies | `listPosts` / post page | Block set read once from `blocked_with_me()`; blocked replies render as `A reply from someone you blocked` | Vitest |
| 17 | Seeing the block | `user_blocks` SELECT | RLS: blocker only. The blocked person reads nothing and `is_blocked_between` is `SECURITY DEFINER` | T15 |

## Data and deletion (every table with a person's rows)

From `design/legal/data-inventory.md` and the migrations. "Cascade" means the foreign key to `profiles(id)` or `auth.users(id)` is `ON DELETE CASCADE`, so `deleteUser` removes it.

| Table | Column | Result of deleting the user |
| --- | --- | --- |
| `profiles` | `id` | cascade from `auth.users` |
| `builds`, `build_nodes` (via build), `build_reproductions`, `build_comments`, `build_likes`, `build_saves` | `creator_id`, `author_id`, `user_id` | cascade |
| `follows` | `follower_id`, `following_id` | cascade |
| `saved_items`, `collections`, `collection_items` | `user_id`, `owner_id` | cascade |
| `dm_messages`, `dm_thread_members`, `dm_reactions` | `sender_id`, `user_id` | cascade (sent messages go; threads stay for the other person) |
| `notifications` | `recipient_id` cascade; `actor_id` set null | cascade / set null |
| `openbuild_posts` | `author_id` | **replaced first** with a removed marker (replies in other people's topics); roots of the person's own topics are deleted with their replies |
| `post_likes`, `post_reactions`, `post_mentions` | `user_id` | cascade |
| `content_reports` / reports | reporter | the person's reports are deleted |
| `import_sessions`, `imports` bucket | `user_id` | cascade; storage objects deleted by the function |
| Storage: `avatars`, `profile-assets`, `build-media`, `content-files`, `content-results`, `reblog-media`, `imports`, `dm-images`, `dm-voice` | owner folder | deleted by the function (paths under `<user id>/`) |
| Tables with a non-cascading FK to `profiles` (`content_items.creator_id`, `created_by`, `added_by`, `inviter_id`, `invitee_id`, `set_by`, `source_user_id`, `contestant_id`, `verified_by`, `approved_by`, `last_message_sender_id`) | various | These legacy tables block `deleteUser`. `delete_account_rows(uuid)` (Part 1) deletes or nulls each named column inside a `DO` block that skips any table or column the live schema does not have. |

## Plan

- Part 1: `user_blocks`, `is_blocked_between`, `blocked_with_me`, restrictive insert policies, block trigger, `rc_notify` reads preferences and blocks, `account_deletions`, `delete_account_rows`, the two feed functions and search patched -> verified by: `rls-plan.sql` read against the migration, a Vitest on the preference parse (missing key is on), a scratch-Postgres syntax check.
- Part 2: `/settings`, `/settings/:section`, `SettingsFrame`, six views, three entry points, `SeoHead`, breadcrumbs -> verified by: Vitest for routing, unknown section, `aria-current`, phone list, entry points; Playwright smoke.
- Part 3: Account -> verified by: Vitest for form states, last sign-in method, global sign-out confirm.
- Part 4: Notifications -> verified by: Vitest that each switch writes its key and that every database kind has a row or is retired.
- Part 5: Privacy and blocking, Block in three menus, collapsed replies -> verified by: Vitest for list, unblock, confirm, each menu entry.
- Part 6: `export-my-data`, `delete-my-account`, Your data view, privacy text -> verified by: Vitest (export shape, rate limit, typing rule), Deno test file written (Deno is not installed here, so it is not run), Privacy policy test.
- Part 7: Connected apps from `listGrants`/`revokeGrant` -> verified by: Vitest for list, empty and revoke confirm.
- Part 8: Appearance row -> verified by: Vitest that header and Settings stay in step through `ThemeContext`.
