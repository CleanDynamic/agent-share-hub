# Data inventory (UX-12 Part 0)

Read from the code at `0f765a1` (main). Every row was confirmed in the file named. Where the code cannot tell, the cell says `unknown` and the privacy text carries a `{{NEED: …}}`. This file is the source for `src/content/legal/privacy.ts`; a Vitest check (`legalContent.test.ts`) holds the outside-service table below to the policy's sharing table.

## Facts in the prompt that were wrong on disk

| The prompt said | On disk |
| --- | --- |
| Resend is found in `supabase/functions/mcp/` | No code mentions Resend. The only hits are the word "resend" in the connector's retry messages. The site sends no email of its own; Supabase Auth sends the verification and password-reset emails. There is no marketing email. |
| Twilio was found 3 times | `grep -ri twilio` over `src/`, `supabase/` and the config finds nothing. Not used. |
| 14 `localStorage.setItem` calls | 15 (three are in `previewAuthStorage.ts`, the Lovable editor's auth broker). There are also 3 `sessionStorage.setItem` calls. |
| No file under `src/` calls the Stripe functions | `src/pages/ProjectDetail.tsx` calls `create-project-package-session` and `verify-project-package` (the "unlock package" button on `/project/:id`). The other four have no caller. Whether any of it is live depends on `STRIPE_SECRET_KEY` being set in Supabase, which the code cannot show. |
| `parse-transcript` and `generate-ai-pdf` send content to an AI model | Neither calls a model. `generate-ai-pdf` builds a PDF with `pdf-lib`; `parse-transcript` is a plain parser; neither function makes any outside request. The only function that calls an AI provider is `generate-build-layers`. |
| `derived_bio` and `last_derived_at` look generated, perhaps by AI | They are worked out in the browser by `src/lib/profile/recomputeDerivedBio.ts` from the maker's own approved posts' domain, tools, models and tags (top few of each, joined into a sentence). No AI model, no outside service. |
| The sign-up form gains one line | The form already has a required checkbox, "I agree to the Terms of Service and Privacy Policy", linking to `/terms` and `/privacy`. Both addresses 404 today. |
| `lookRules.test.ts` includes every new file | It does so through the `CA03_FILES` list; new files are added to it. |

## Data and services

| What | Where in the code | Why it is used | Who can see it | How long it is kept | Outside service |
| --- | --- | --- | --- | --- | --- |
| Email, password (hashed), sign-in session | `src/lib/auth/signInWithEmailOrUsername.ts`, `signUpWithEmail.ts`; `supabase.auth` | Sign-in and account recovery | The person; the site's operators through the database. Passwords are never readable. | Until the account is closed. Unknown after that. | Supabase Auth |
| Google, GitHub and X sign-in | `src/lib/auth/oauth.ts` (`SUPABASE_PROVIDER`: google, github, twitter), `AuthCallback.tsx` | Sign in without a password | The provider tells Supabase who you are (email and name as the provider releases them). Which fields reach `profiles` is set by the `handle_new_user` trigger: `username` and `display_name` from sign-up metadata, else the email's first part. | As the account | Google, GitHub, X (sign-in only) |
| Admin sign-in | `src/pages/AdminLogin.tsx` (`signInWithPassword`), `AdminRoute` | Staff only | Staff | n/a | Supabase Auth |
| Profile | `src/lib/profile/getProfileSummary.ts`: username, display name, bio, location, website, avatar, banner, follower and following counts, level, `is_private`, `derived_bio`, `last_derived_at`, `about`, `links`, `profile_settings` | The public profile | Anyone, unless `is_private` is on (then the profile is limited to what the page allows) | As the account | Supabase |
| Derived bio | `recomputeDerivedBio.ts` (run after publishing in `recomputeMetadata.ts` and `PublishMetadata.tsx`) | A one-line summary on the profile | As the profile | Rewritten on each publish | None (no AI) |
| Builds, steps, sessions, transcripts | `src/lib/build/*`; tables `builds`, `build_nodes`, sessions in `builds.making` | What people share | Public builds: anyone. Drafts: the maker only. | Until deleted. Unknown for backups. | Supabase |
| Drafts | `src/lib/build/drafts.ts` | Work in progress | The maker only | Until deleted | Supabase |
| Uploads and media | Buckets (from migrations): `avatars`, `profile-assets`, `content-files`, `content-results`, `reblog-media`, `ai-pdfs` are public; `build-media`, `imports`, `dm-images`, `dm-voice` are private (signed links) | Pictures, files, voice notes | Public buckets: anyone with the link. Private: the owner or the thread. | Until deleted | Supabase Storage |
| GitHub import | `import-github-readme` (`api.github.com`, reads a public README), `parse-repo` (`api.github.com`; `GITHUB_TOKEN` optional) | Start a build from a repository | The maker. The repository address is sent to GitHub. | Not stored beyond the build | GitHub |
| Lovable import | `parse-lovable` (parses what the person pastes; no outside call) | Start a build from a Lovable conversation | The maker | As the build | None |
| Connector (MCP) | `supabase/functions/mcp`; `import_sessions` table and `imports` bucket | A person's AI tool sends a conversation, verbatim, into a waiting import to review | The person only, until they publish | `import_sessions.expires_at` defaults to 7 days (`20260917120000_import_sessions.sql`); unclaimed imports expire | Supabase |
| Connector monitoring | `supabase/functions/mcp/monitor.ts` posts a Sentry envelope | Fixing connector errors | Operators | Sentry's own | Sentry (only if its DSN is set) |
| Topics, replies, spaces | `src/lib/openbuilds`, migrations `ux04_spaces`, `ux09_*` | The OpenBuilds section | Topics and replies: public in public spaces. A space's members and moderators as the space sets. | Until deleted | Supabase |
| Follows, likes, comments | `src/lib/social/*` | Social features | Public | Until removed | Supabase |
| Saves | `src/lib/social/saves.ts`, `src/lib/library/*` | A private Library | The saver only | Until removed | Supabase |
| Messages | `dm_threads`, `dm_messages`; policy "Members can read thread messages" (`is_thread_member`); buckets `dm-images`, `dm-voice` (private) | Direct messages | Members of the thread. No admin read policy exists in the migrations. People with direct database access could read them technically. | Until deleted | Supabase |
| Notifications | `src/lib/notifications/*` | Tell people what happened | The recipient | Unknown | Supabase |
| Reports | `src/lib/moderation/reports.ts`, `content_reports`, `resolve_report` | Moderation | The reporter reads their own; admins read all. A note is up to 500 characters. | Unknown | Supabase |
| AI processing | `supabase/functions/generate-build-layers/model.ts`, called from `src/lib/build/layers.ts` when a maker asks (`LayerReview.tsx`). It sends a compact description of the build: node types, titles, notes and the required payload fields (for a prompt step, the prompt text). It does not send whole payloads. The key is the deployment's own (`LOVABLE_API_KEY`, else `ANTHROPIC_API_KEY`, else `OPENAI_API_KEY`); no person's own key is used. | Write the "run" and "understand" explanations of a build | The result is stored in `build_layers` with `model_used`. | As the build | Lovable AI gateway (`ai.gateway.lovable.dev`), Anthropic (`api.anthropic.com`) or OpenAI (`api.openai.com`), whichever has a key. Provider data terms: unknown. |
| Link previews | `src/components/compose/fields/UrlField.tsx` (`https://api.microlink.io/?url=…`) | Show a preview of a link a person pastes | The pasted address goes to Microlink | Not stored by the site | Microlink |
| Error reports | `src/lib/errors/report.ts`. Sentry loads only when `VITE_SENTRY_DSN` is set. `sanitise` keeps only `source`, `route`, `context`, `buildId`, `nodeId`, `nodeType`, `shape`, `userId`, `authenticated`. `beforeSend` deletes `request`, `user` and `extra`; `beforeBreadcrumb` returns null (no breadcrumbs); the error's message is replaced by its class name and code, and only stack frames are kept. `tracesSampleRate` is 0. The user id can still arrive as a tag. | Fixing errors | Operators | Sentry's own | Sentry |
| Payments | `create-project-package-session`, `verify-project-package` (called from `ProjectDetail.tsx`); four other Stripe functions with no caller. `reward_gbp` appears in display code only (`bountyDisplay.ts`, `GalleryCard.tsx`); no code moves money for it. | Unlocking a project package | Stripe handles card details; the site never sees them | n/a | Stripe (if live) |
| Hosting and files | `netlify.toml` (Netlify serves the app and redirects `/b/:slug.json` and `/sitemap.xml` to Supabase functions); the Open Graph image is on `r2.dev` (Cloudflare R2, in `index.html`); Lovable builds and edits the project | Serving the site | Visitors' addresses reach the host | Host logs: unknown | Netlify, Cloudflare, Lovable |
| Database | `supabase/config.toml`, project `zybdotagjwektucfdkri`; region is not in the config | Database, auth, storage, edge functions | Operators | See above | Supabase |
| Browser storage | See the next table | | | | |
| Account deletion and export | No self-serve path found (`grep` for delete account, export, `deleteUser` finds nothing) | | | | |
| Age | Sign-up asks for display name, username, email, password and a terms checkbox. No age or date of birth (`SignupForm.tsx`, `Onboarding*.tsx`). | | | | |
| Moderation | Staff: `resolve_report` hides a build, comment or topic or dismisses the report, and closes every open report on that target. Space creators and moderators (`ux04_spaces`): pin and hide inside a space; only the creator changes the space or roles. No account suspension tool was found in code. The reporter is not told the outcome (no notification is sent). | | | | |

## Outside services (one row each, matched to the policy's sharing table)

<!-- services:start -->
| Service | What for |
| --- | --- |
| Supabase | Database, sign-in, file storage and server functions |
| Netlify | Hosting the website |
| Lovable | Building the site, and its AI gateway |
| Cloudflare | Hosting the site's share image |
| Anthropic | Writing build explanations, when a maker asks |
| OpenAI | Writing build explanations, when a maker asks |
| GitHub | Reading a public repository a maker imports, and signing in |
| Google | Signing in |
| X | Signing in |
| Microlink | Previews of links a person pastes |
| Sentry | Finding and fixing errors |
<!-- services:end -->

Stripe is not listed: nothing confirms a live payment (see the report).

## Browser storage

| Key | Where | What it holds | Class |
| --- | --- | --- | --- |
| Supabase auth session (`sb-…-auth-token`) | `supabase.auth`, `persistSession: true`, in `localStorage` | Your sign-in | Strictly necessary |
| `bg-theme` | `ThemeContext.tsx` | Light or Dark | Strictly necessary (a setting you chose) |
| `builds:layout:v1`, `builds:facets:v1` | `buildsLayout.ts`, `classificationModel.ts` | Remembered filters and layout | Strictly necessary (a setting you chose) |
| `bg-compose-view:<id>` | `viewOptions.ts` | Composer view choice | Strictly necessary (a setting) |
| `pinned-context-collapsed:<thread>` | `ConversationHeader.tsx` | A collapsed panel in a message | Strictly necessary (a setting) |
| `bg-home-seen`, `openbuilds:seen:<space>`, `neoscale_last_library_visit`, `neoscale_last_fyp_visit`, `bg-xp-reset-note-seen`, `neoscale.layer-review.declined.<build>` | Home, OpenBuilds, nav badges, notes | What you have already seen, so a badge or note is not repeated | Strictly necessary (a setting) |
| `scroll:v1:<entry>` (session) | `ScrollKeeper.tsx` | Scroll position on Back | Strictly necessary |
| Unsent prompts (session) | `useUnsentPrompts.tsx` | Text you have not sent yet | Strictly necessary |
| `pending_verification_email` (session) | `SignupPage.tsx` | The address you just signed up with | Strictly necessary |
| `neoscale_page_ad_shown_<id>` (session) | `ContentBlockViewer.tsx` | Whether an ad notice was shown on an older page | Not an analytics or advertising cookie; listed for completeness |

The site sets no cookies of its own. No analytics or advertising script is loaded (`grep` for gtag, GTM, Plausible, PostHog, Segment, Mixpanel, Hotjar, fbq finds nothing). Sign-up also keeps your name, username and email in session storage if you leave to read the Terms or Privacy policy and come back (added by UX-12 Part 4); the password is never kept.

## Placeholders Part 3 needs

Controller name, postal address, privacy contact email, ICO registration, each AI provider's data terms, the safeguard for transfers, Supabase backup retention, retention periods, minimum age, appeal route and contact, liability wording, whether staff read messages.
