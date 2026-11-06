# UX-13 · Move the site to openbuilds.ai

PASS, with the checks that need the network or a dashboard listed under "Not verified".

Branch: `claude/ux-13-openbuilds-domain-tw2suf` · commits `UX-13 P1` to `UX-13 P4`, plus one follow-up on P3 (no pull request opened).

## Facts in this prompt that were wrong on disk

- `/u/:username` is not a route. Public profiles are `/profile/:handle`. The sitemap lists `/profile/<username>`. (`robots.txt` allowed `/u/` and ContentDetail's JSON-LD still writes `/u/<handle>`; the first is fixed, the second is left, see Dead code seen.)
- `robots.txt` had `Disallow: /profile`, which would have blocked every profile the sitemap lists. `Allow: /profile/` now beats it (longest match), so `/profile` itself stays blocked.
- `/privacy` and `/terms` were in the old static sitemap, but both texts are unreviewed (`src/content/legal/reviewed.ts` is `false`, the texts hold `{{NEED:` placeholders). They are out of the sitemap until the flags flip; `sitemap.test.ts` holds the sitemap's flags equal to `reviewed.ts`. UX-12's `legalLinks.test.tsx` asserted they were always listed; I changed that test to the reviewed rule.
- Also in the code: a fourth old address, `neoscale.ai`. The AI-PDF function linked to `https://neoscale.ai/b/<slug>` (3 places): now `siteUrl(...)`.
- `index.html` has no canonical and no `og:url`, so there was nothing to change there.
- Email: there is no Resend and no custom sender anywhere in the repo. Sign-up, verification and reset emails are sent by Supabase's own sender.

## Production host

Lovable hosting, not Netlify. Evidence: the README series says "Publish › Publish changes", `.lovable/` exists, and the prompt says the live site is `agent-share-hub.lovable.app`. The README, `DEPLOYMENT_CHECKLIST.md` and `neoscale-ui.md` still say Netlify; they are stale. I could not confirm it live: the sandbox proxy answers `curl -sI https://agent-share-hub.lovable.app/sitemap.xml` with 403.

What that means:
- `netlify.toml` is not read, so the `/sitemap.xml` redirect does nothing in production. The sitemap is now a file written into the build (`npm run build` runs `scripts/generate-sitemap.js` first, using the public key in `.env`; if the network is down it leaves the committed static file).
- The `/b/:slug.json` redirect has the same problem: it very likely does not work in production today. Not fixed, as asked. `netlify.toml` is unchanged and holds no old address.

## Address table (file · match · verb)

Used the constant (`src/lib/site.ts` in the app, `supabase/functions/_shared/site.ts` in functions):
`SeoHead.tsx` (SITE_URL, canonical, og:url) · `portable.ts` (DEFAULT_SITE_URL, the window-origin branch is gone) · `ContentDetail.tsx` (inline fallback, JSON-LD) · `shareMeta.ts` (SITE_ORIGIN, unused, deleted) · `EngagementRow.tsx` (SHARE_ORIGIN, deleted; share link) · `HomePage.tsx` (copy link) · `SignupForm.tsx` (username helper text) · `mcp/constants.ts` (PUBLIC_HOST was the Lovable host) · `sitemap-xml/index.ts` · `generate-ai-pdf/index.ts` (neoscale.ai links).

Changed the text: `index.html` (author, og:title, twitter:title: the domain word only) · `public/robots.txt` · `public/sitemap.xml` · `public/ai.txt` · `.env.example` · page titles and copy in `AccountGateModal`, `About`, `Admin`, `AdminLogin`, `Analytics`, `ApiDocs`, `ContentEdit`, `Drafts`, `HomePage`, `Messages`, `Onboarding`, `PostPreview`, `ProjectDetail`, `Upload` (the domain word only, the wording is untouched).

Tests and fixtures: `cors.test.ts`, `checkout.test.ts`, `authActions.test.ts`, `portable.test.ts`, `signals.test.ts`, `buildfile.test.ts`, `rcGuards.test.ts`, `SignupPage.test.tsx`, `signinForms.test.tsx`, `mcp/index.test.ts`, `e2e/tier3/engagement.spec.ts`, `e2e/fixtures/*.neoscale.md`, `supabase/seeds/ns-demo-build.sql` (the demo URLs).

History: `SeoHead.tsx`'s RC-P16b comment and `rcGuards.test.ts`'s comment now state the current address.

Allowed origins (`_shared/origins.ts`): now `openbuilds.ai`, `www.openbuilds.ai`, the Lovable published address, the Lovable preview, `localhost:8080`. `buildgallery.ai`, `www.buildgallery.ai` and every `neoscaleai.com` origin are out, and the comment says why.

Left alone, on purpose (window origin, follows the visitor): `oauth.ts` redirectTo, `SignupPage.tsx` emailRedirectTo, `ResetPasswordPage.tsx` reset link, `PublishControl.tsx`, `FeedReblogAdapter.tsx`, `feed-card.tsx`, `ResultsViewerSection.tsx`, `deepLink.ts`. Supabase's Redirect URLs list (Part 5 step 3) is what makes these land on openbuilds.ai once people are on it.

## Final grep

`grep -rnE "neoscaleai\.com|buildgallery\.ai" src supabase public scripts index.html netlify.toml .env.example` leaves only:
- 14 header comments in `src/lib/theme/*` and `src/index.css:130` (`buildgallery.ai — the focus ring ...`): the name, not an address, and the prompt says leave them.
- 4 migration/test headers (`supabase/migrations/20260911*`, `supabase/tests/bg-p07*`): the name in a comment of an already-applied migration; editing an applied migration is not done.
- `origins.ts:5`, `cors.test.ts`, `checkout.test.ts`: the tests that prove the old domains are refused, and the comment that says why they were removed.

## Sitemap

| | Before | After |
| --- | --- | --- |
| `public/sitemap.xml` (static file) | 5 URLs (`/`, `/browse`, `/about`, `/privacy`, `/terms`) | 4 URLs (`/`, `/builds`, `/openbuilds`, `/about`), replaced at build by the full list |
| `sitemap-xml` function | 3 static + every approved `content_items` row (up to 5,000, only the first 1,000 actually returned by the API) | 4 static + published/gallery builds (cap 20,000) + public profiles (10,000) + spaces (1,000) + approved old posts (5,000), read in pages of 1,000 |

Not verified: counts by kind from the real database. The sandbox cannot reach Supabase (the build printed `sitemap: nothing could be read` and kept the static file), so `dist/sitemap.xml` here holds the 4 static URLs. The test fixture builds 10 URLs from 4 builds, 3 profiles, 1 space and 3 old posts, with the draft, the private profile, the unapproved post and the duplicate left out. The real count shows after the first Publish; the build log prints it (`sitemap: N urls`).

Caps add up to 36,004, under 50,000 URLs, and at roughly 200 bytes a URL far under 50 MB, so one file is always enough. `buildSitemap` still writes an index plus numbered files if a limit is raised past it (tested). Topics are not listed: whether a topic is public depends on the membership rules of its spaces, which I did not want to guess. Profiles and spaces have no `updated_at` column, so their entries have no `lastmod` rather than a wrong one.

`robots.txt` lines changed: added `Allow: /b2/`, `/builds`, `/openbuilds`, `/profile/`; removed `Allow: /browse` (redirects), `/creator/` (redirects), `/u/` (no route); added `Disallow: /compose`, `/import`; `Sitemap:` is `https://openbuilds.ai/sitemap.xml`. `public/ai.txt`: the `Sitemap:` line only.

## Checks

- `npx tsc --noEmit -p tsconfig.app.json`: clean (needed `--max-old-space-size=6000` here).
- Vitest: 737 files, 32 failed on the first full run. Running the same 15 files on a clean `origin/main` worktree gives 29 failures in 12 files (`lookRules` 12, `readerSteps` 4, `ux03.p4` 3, `ux03.p3` 2, and one each in `everything`, `onePrompt.snapshot`, `shapes`, `BuildSteps`, `BuildSteps.tiles`, `BuildView`, `readerSessions`, `connection`): all present before this work. The other 3 were mine or load: `legalLinks` (fixed above), and `ca20.p2` and `ux02.p2` (timeouts under load; both pass alone, 16 of 16). New and changed tests pass: `site.test.ts`, `sitemap.test.ts` (15), `SeoHead.test.tsx`, `EngagementRow.share.test.tsx`, `src/test/security` (cors, checkout, 135), `portable.test.ts`.
- `npm run build`: passes, and runs the sitemap script first.
- Playwright `e2e/tier1/canonical.spec.ts` on the built site (`vite preview`), desktop and mobile: 4 of 4 pass (one canonical on `/about` and `/api-docs`, both `https://openbuilds.ai/...`, also `og:url`).
- ESLint on the files I touched: the only errors are 2 `no-explicit-any` in `SeoHead.tsx:17`, which were there before.
- Tier 1 (`e2e/tier1`, desktop and mobile, against `vite preview` of this branch) finished: 317 passed, 148 failed, 5 skipped. The failures are in the specs that draw a build, the home page or a profile from data (for example `build-site-frame`, `rebuild-site-frame`, `home-site-frame`, `profile-site-frame`, `post-thread`, `ux03-build`). This sandbox cannot reach Supabase, which those pages need, but I did not get a clean-main comparison, so I cannot prove none of the 148 come from this branch. Treat tier 1 as unverified: run it where the network works, and compare against main if anything fails. The specs that need no data (boot shell, signin, canonical) pass.
- Not run here: `audit:pages`, `audit:size`, `audit:perf`, `audit:themes`, `audit:contrast`, `audit:design`, and the Deno tests in `supabase/functions/mcp/index.test.ts` (no Deno in the sandbox; I updated their expected addresses by hand). No page's markup, styling or bundle was changed beyond the address text.

## Dead code seen

- `ContentDetail.tsx` JSON-LD writes author links `/u/<handle>`, a route that does not exist.
- `PublishMetadataForm.tsx:400` shows a preview address `neoscale.ai/<user>/<slug>`, and `About.tsx:56` shows `hello@neoscale.ai`. Both are a different old address, not in this prompt's scope. The mailbox is not mine to change. The README, `DEPLOYMENT_CHECKLIST.md` and `neoscale-ui.md` say Netlify.
- The PDF function's text "NeoScale (neoscale.ai)" is a name.

## Lovable message

See `design/audits/ux-13/lovable-message.md` (same text below).

```
Deploy every edge function in this repository's supabase/functions folder exactly as written, because all of them read the shared allowed-origins list (supabase/functions/_shared/origins.ts) and sitemap-xml, mcp and generate-ai-pdf also read the new supabase/functions/_shared/site.ts and sitemap.js. Set the Edge Function secret PUBLIC_SITE_URL to https://openbuilds.ai. Change nothing else. Then run, in the SQL editor, EXPLAIN (ANALYZE, BUFFERS) for each of these four reads and paste the plans back: SELECT slug, status, updated_at, published_at FROM public.builds WHERE status IN ('published','gallery') ORDER BY published_at DESC LIMIT 1000; SELECT username, is_private FROM public.profiles WHERE is_private = false AND username IS NOT NULL ORDER BY username LIMIT 1000; SELECT slug FROM public.spaces ORDER BY slug LIMIT 1000; SELECT slug, id, status, updated_at, published_at FROM public.content_items WHERE status = 'approved' ORDER BY published_at DESC LIMIT 1000.
```

The plans should show an Index Scan or Bitmap Index Scan on `idx_builds_status_published`, the unique index on `profiles.username`, the unique index on `spaces.slug` and `idx_content_items_status`, and no Seq Scan once a table holds a few thousand rows.

## What Miles needs to do

Do these in this order. Do not send the Lovable message (step 4) before steps 1 to 3, because the functions then start writing openbuilds.ai links and allowing only openbuilds.ai.

1. **Lovable: connect the domain.** Open the project, then Project (or Settings) › Domains › Connect domain. Add `openbuilds.ai`, then add `www.openbuilds.ai`. Lovable shows DNS records for each (normally an A record for the root, and a CNAME or A record for `www`, plus a TXT record to verify). Copy them exactly into the DNS settings where `openbuilds.ai` was bought. Wait until both rows show Active with automatic HTTPS (this can take up to a few hours). Then set `openbuilds.ai` as the primary domain, so `www` and `agent-share-hub.lovable.app` redirect to it. I could not open Lovable, so I cannot say what the current Domains panel offers: if it has no "primary" option, write what it shows in your reply and I will adjust.
2. **Lovable environment.** If the project lets you set environment variables (Project › Settings › Environment variables), set `VITE_SITE_URL` to `https://openbuilds.ai`. If it does not, do nothing: the code already defaults to that value.
3. **Supabase › Authentication › URL Configuration.** Set Site URL to `https://openbuilds.ai`. Under Redirect URLs add `https://openbuilds.ai/**` and `https://www.openbuilds.ai/**`, and keep `https://agent-share-hub.lovable.app/**` until step 9 passes. Without this, sign-in, email verification and password reset links send people to the old address.
4. **Supabase › Edge Functions › Secrets.** Add `PUBLIC_SITE_URL` with the value `https://openbuilds.ai`, then send Lovable the message above to deploy the functions.
5. **OAuth providers.** The sign-in buttons are Google, GitHub and X. Each provider's callback is Supabase's own address (`https://zybdotagjwektucfdkri.supabase.co/auth/v1/callback`), so it does not change. Where the provider's console has an authorised JavaScript origin or Homepage URL field (Google Cloud Console › Credentials › your OAuth client › Authorised JavaScript origins; GitHub › Settings › Developer settings › OAuth Apps › Homepage URL; X Developer Portal › your app › Website URL), add or set `https://openbuilds.ai`.
6. **Email.** Nothing sends from `buildgallery.ai` or `neoscaleai.com`: the repo has no Resend and no custom sender, so sign-up, verification and reset emails use Supabase's own sender. If you have since set a custom SMTP sender under Supabase › Authentication › Emails › SMTP Settings that uses an old domain, add `openbuilds.ai` as a sending domain at your email provider (SPF, DKIM, and DMARC if offered), wait until it is verified, then change the sender there. Otherwise nothing to do.
7. **Google Search Console.** Add `openbuilds.ai` as a Domain property (Google gives a DNS TXT record to paste into the same DNS settings as step 1), then Sitemaps › add `https://openbuilds.ai/sitemap.xml`.
8. **Old addresses.** Nothing to do. You own neither `neoscaleai.com` nor `buildgallery.ai`, so no redirect is possible; old links to them stop reaching the site, and search engines learn the new address from the sitemap and Search Console (step 7). If either old address is still listed in Lovable's Domains panel, remove it.
9. **Check.** Open `https://openbuilds.ai` and `https://www.openbuilds.ai` (both with a padlock, `www` landing on the root). Sign in with email and with one provider, request a password reset and open the link, open `https://openbuilds.ai/sitemap.xml` (it should list builds, profiles and spaces, not just four pages), and share a build link (`https://openbuilds.ai/b2/<slug>`) to see its preview. When all pass, remove `agent-share-hub.lovable.app` from Supabase's Redirect URLs.

Then merge the pull request and press Publish › Publish changes. The build runs the sitemap script, which needs the network at build time; if the Lovable build cannot reach the database, the sitemap falls back to the 4 static pages, and the `sitemap-xml` function (deployed in step 4) still answers with the full list at `https://zybdotagjwektucfdkri.supabase.co/functions/v1/sitemap-xml`.

## Questions for Miles

None about the domain. The rename to OpenBuilds is UX-14.
