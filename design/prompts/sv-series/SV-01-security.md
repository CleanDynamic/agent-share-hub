# SV-01 · Security fixes

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** The first of the series SV-01 to SV-26. The series README (`design/prompts/sv-series/README.md`) holds the full order; this prompt carries its own rules. Run this after CA-28 has merged. Pull main first. Lovable commits straight to main. Branch `sv-01-security`. Commit at the end of every part with the part number in the message. Open one pull request titled `SV-01 security fixes` at the end.

The facts here were checked on 25 October 2026, at `6b8fe912`. **The file on disk wins.** If something here does not match the code, follow the code, do the nearest correct thing, and list the difference in the report. Never invent a table, a column or a policy.

If the session runs short, stop at the end of a finished part with every test green, commit, and report which parts are left. Parts 1 and 2 come first because they are the most serious.

## How to work

- **Plan first.** End Part 0 by writing two short lists at the top of `design/audits/security/sv-01-before.md`:
  - `Assumptions`: each fact in "What is wrong now" that you checked, and what you found;
  - `Plan`: one line per part, `Part n: what changes -> verified by: which test`.
- **Reproduce first.** For every hole, write the test that shows it open, watch it fail, then close it.
- **A missing premise is reported, not fixed.** If a hole described here isn't there on disk, don't build a fix for it. Say so and move on.
- **Surgical.** Every changed line traces to a part of this prompt. Match the style around it. Remove what your own change leaves unused. Dead code you didn't create goes under `Dead code seen` in the report, for SV-26; don't delete it.
- **Questions.** Miles isn't watching the session. Where you would ask, take the safer reading, carry on, and put the question in the report.
- **The domain isn't live yet.** Don't fetch `https://buildgallery.ai`. Work from the repo.

## What is wrong now

1. **Anyone can set any user's password.**
   - `supabase/functions/update-user-password/index.ts` takes `user_id` and `password` from the request body.
   - It calls `auth.admin.updateUserById` with the service key.
   - It checks nothing: it has no login check and no ownership check.
   - The gateway only asks for a valid key, and the site's public key is one.
   - Nothing in `src` calls it.
2. **Prompt text is drawn as HTML.** `src/components/ContentBlockViewer.tsx` line 701 sets `dangerouslySetInnerHTML` to `highlightVars(getFilledPrompt())`. The prompt text is a maker's own words, and `highlightVars` only wraps variables in a regex replace. A build whose prompt holds markup runs it in every reader's browser. The published build page reaches it through `src/components/build/renderers/shared.tsx` and `artefact.tsx`.
3. **Checkout trusts the browser.**
   - `create-checkout-session` and `create-split-checkout-session` take `price_amount` (pence) from the body. The only check is that it's at least 100 pence, so a buyer can pay £1 for any item.
   - `create-checkout-session`, `create-donation-session`, `create-pwyw-checkout-session` and `create-split-checkout-session` take `success_url` and `cancel_url` from the body. Stripe then sends the buyer to any address the caller chose.
   - `create-pwyw-checkout-session` adds to `pwyw_purchase_count` and `pwyw_avg_paid_gbp` when a checkout **starts** (around line 98), not when it is paid. Anyone can inflate them.
   - The item's price is `content_items.price_gbp`, a `NUMERIC` in pounds; the PWYW floor is `pwyw_floor_gbp`. Stripe takes pence.
   - Nothing in `src` calls `create-split-checkout-session` or `create-subscription-session`.
4. **Open functions that write with the service key.** These have `verify_jwt = false` in `supabase/config.toml` and no login check:
   - `notify-version-update` takes `creator_id` from the body. It sends notifications to everyone who saved or downloaded any `content_id`.
   - `check-compatibility-status` rewrites `compatibility_status` on every approved item and inserts notifications. It looks like a scheduled job, but anyone can call it. No schedule for it was found in `supabase/migrations/`.
   - `generate-ai-pdf` reads posts and reblogs with the service key and uploads to the public `ai-pdfs` bucket. Check that it refuses drafts and private posts.
   - `post-json` and `sitemap-xml` only read public rows, but they use the service key where the public key would do.
5. **Any website can call the functions.** 18 functions answer every origin (`Access-Control-Allow-Origin: *`).
6. **Inputs aren't checked.** Most functions read `await req.json()` and use the fields as they come. `mcp` already uses zod through its `deno.json`.
7. **The connector address is written out twice:** `src/lib/connect/connector.ts:15` and `src/pages/Connect.tsx:81` hold the project's full functions address.
8. **Errors go nowhere.**
   - There is no error reporting.
   - About 150 `console` calls are left in `src`.
   - About 90 writes are a bare `await` whose returned `error` is never read.
   - There are only a few error boundaries: `ErrorBoundary`, `RouteBoundary` and `PanelBoundary`.

## House rules

- No component changes its look. Sentence case, no em dashes.
- **Secrets:** name them, never show or write their values. A secret this prompt needs goes in the report as a name for Miles to add in Lovable, for example `CRON_SECRET`.
- **The database:** never apply a migration yourself. Write the file in `supabase/migrations/`, and put the Lovable message in the report.
- **Edge functions check every input,** even one the site never sends. Client code doesn't add error handling for cases that can't happen.
- **Vercel rules.** If the `react-best-practices` skill (`vercel-labs/agent-skills`) is installed, apply the principles of `server-auth-actions` (every function checks its caller, like an API route) and `server-no-shared-module-state` (nothing about a caller is kept at module level). They are written for Next.js; the code here is Deno edge functions. Install no package a rule names.
- **No third-party fix services.** Never run a "fix" service, CLI or CI bot that uploads repository files to someone else's server (for example `transitions-agent fix`). Report any such workflow found in `.github/workflows/`.
- Run `npm test`, `npx tsc --noEmit -p tsconfig.app.json` and `npm run lint` before every commit.

---

## Part 0 · Read first

1. **Edge functions:**
   - every `supabase/functions/*/index.ts`, plus `_shared/`;
   - `supabase/config.toml`, for each function's `verify_jwt` and its comments (a function not listed there defaults to `verify_jwt = true`);
   - for each function, who calls it: search `src` for `functions.invoke("<name>"`, for the function's URL, and in `netlify.toml`.
2. **Raw HTML:** every `dangerouslySetInnerHTML`, `innerHTML =` and `insertAdjacentHTML` in `src`. Known so far:
   - `ContentBlockViewer.tsx:701`;
   - `components/ui/chart.tsx:70`;
   - `pages/site/compose/listNest.tsx:72`, the held copy from `cloneHtml` in `useBuildSorting.ts`;
   - `pages/site/compose/mapMorph.tsx:65`.
3. **Database functions:** list every `SECURITY DEFINER` function in `supabase/migrations/`, using each one's latest definition. For each, record:
   - what it reads and writes;
   - whether it checks `auth.uid()`;
   - who can execute it (`GRANT`, or the default for `PUBLIC`).
4. **Advisor findings:** Miles may paste the Supabase security advisor's findings at the start of the session. If he has, use them. If not, work from the migrations and say so in the report.

Write what you found as a table in `design/audits/security/sv-01-before.md`: one row per function and per raw HTML use, with what it trusts and what you will do. Put the `Assumptions` and `Plan` lists above it.

Commit: `SV-01 P0: security baseline and plan`.

## Part 1 · The password function

1. **Write the test first:** a source check that `supabase/functions/update-user-password/` doesn't exist and that `updateUserById` appears nowhere in `supabase/functions`. Watch it fail.
2. **Delete `supabase/functions/update-user-password/`**, since nothing calls it. Password changes go through `supabase.auth.updateUser` in the signed-in reader's own session, as the reset page does now. Check that path, and say how it works in the report.
3. **Deleting the folder may not remove the function that is already running.** Put this Lovable message in the report: `Delete the edge function update-user-password from this project's Supabase functions, and confirm it no longer answers. Change nothing else.`

Commit: `SV-01 P1: remove the open password function`.

## Part 2 · Prompt text is text

1. **Write the tests first,** and watch the first one fail:
   - a prompt holding `<img src=x onerror=alert(1)>` and `<script>` renders those characters as text, and no `img` or `script` element is made;
   - a snapshot of a prompt with variables and no markup, taken **before** the change: the rendered text and the highlighted spans;
   - the copy button copies the filled text unchanged.
2. **`ContentBlockViewer`:**
   - draw the filled prompt as React text;
   - split it on the variable pattern;
   - draw each variable as a `<span>` with the style `highlightVars` gives it now;
   - drop the HTML string entirely.
   The snapshot from step 1 still matches.
3. **The other raw HTML uses:**
   - `chart.tsx` builds CSS from the chart's own config, not from user text. Keep it, and add a one-line comment saying so.
   - `listNest.tsx` and `mapMorph.tsx` copy markup the page has already drawn with React (`outerHTML`). Check that this is the only source. Keep them, and add a comment.
   - Anything else that takes user text: change it to text.
4. **A guard:** add a test that fails when a new `dangerouslySetInnerHTML`, `innerHTML =` or `insertAdjacentHTML` appears outside an allow list holding the three files above.

Commit: `SV-01 P2: prompt text is text`.

## Part 3 · Checkout

Write the tests first (Deno or Vitest, with the Stripe client faked), and watch them fail:
- a body price lower than the item's is ignored;
- a foreign `success_url` is refused with 400;
- starting a PWYW checkout changes no stats.

1. **The price comes from the database:**
   - `create-checkout-session` reads `content_items.price_gbp`, converts it to pence (`Math.round(price_gbp * 100)`), and ignores `price_amount` from the body;
   - the split checkout reads its price and its splits from the database in the same way;
   - for pay-what-you-want, the body's amount is allowed, between `pwyw_floor_gbp` and £1,000.
   - An item with no price, or not for sale, is refused with 400.
2. **Return addresses:** `success_url` and `cancel_url` must start with an allowed origin, or the function refuses with 400. Keep the list in one constant in `supabase/functions/_shared/origins.ts`, which Part 5's CORS helper also reads:
   - `https://buildgallery.ai`;
   - the project's Lovable preview and published domains (find them in the repo, for example `src/integrations/supabase/previewAuthStorage.ts`, or ask in the report);
   - `http://localhost:8080` while developing.
3. **PWYW stats:** `verify-project-package` already checks `payment_status === "paid"`. If it is the place a PWYW payment is confirmed, move the count and average update there. If nothing in the repo confirms a PWYW payment, stop updating them at checkout start, and say so in the report. Don't write a Stripe webhook in this prompt; report that none exists.
4. **Logged-in buyers:** when the caller sends a session, record the buyer's id from the token, never from the body.
5. **Unused checkout functions:** `create-split-checkout-session` and `create-subscription-session` have no caller in `src`. Fix them the same way (they are still reachable), and list them under `Dead code seen`.

Commit: `SV-01 P3: checkout`.

## Part 4 · Open functions

For each function in Part 0 that writes, or reads private rows, with the service key, write its refusal test first, then:

1. **`notify-version-update`:**
   - require a login;
   - read the creator from the token;
   - check that the caller owns `content_id` (from `content_items.creator_id`, never the body);
   - ignore `creator_id` from the body.
2. **`check-compatibility-status`:**
   - find what runs it (a schedule in the migrations, `pg_cron`, or nothing);
   - require a header `x-cron-secret` matching the secret `CRON_SECRET`, and otherwise answer 401;
   - put the secret's name, and how to set the schedule's header, in the report. If nothing runs it, say so.
3. **`generate-ai-pdf`:** refuse anything that isn't public and approved, unless the caller owns it.
4. **`post-json` and `sitemap-xml`:** use the public key, so the database's own rules apply. They keep answering every origin, because they are public reads.
5. **`import-github-readme`:** check that it only ever fetches `api.github.com`. Refuse any other address.
6. **`config.toml`:** set `verify_jwt = true` for every function that now needs a login. Keep each comment's reasoning, and add one line for each change.
7. **Module-level state.** A Deno edge function can keep module-level variables between requests. In every function, check that no module-level variable holds a caller's data, token, user id or result. Clients built once from environment values are fine. Move anything else inside the handler, and list what you found.

**Tests:**
- each function refuses an unsigned call where it should;
- `notify-version-update` refuses a caller who doesn't own the item;
- `check-compatibility-status` refuses a call without the secret.

Commit: `SV-01 P4: open functions`.

## Part 5 · Origins and inputs

1. **One CORS helper:** `supabase/functions/_shared/cors.ts`, reading the origins from `_shared/origins.ts`.
   - It answers only the allowed origins, and reflects the caller's origin when it is one of them.
   - `public-api`, `post-json`, `sitemap-xml` and the `mcp` discovery address stay open to every origin.
   - Every other function uses the helper.
2. **Input checks where they matter:** a small zod schema at the top of each function that reads a body **and** writes, spends money or calls another service: the checkout and session functions, `notify-version-update`, `generate-ai-pdf`, `import-github-readme`, the `parse-*` functions and `generate-build-layers`. Import zod the way `mcp/deno.json` does. A body that doesn't match gets a 400 naming the field, and nothing runs. List any function you left without a schema, with why.
3. **One error shape:** `{ error: "<what failed>" }` with the right status. Never send a stack trace or a database message to the browser; log it on the server instead.

**Tests:** a call from a foreign origin gets no CORS allow header; a missing field gets a 400 naming it.

Commit: `SV-01 P5: origins and inputs`.

## Part 6 · Database functions

1. From Part 0's list, for each `SECURITY DEFINER` function that writes, or that reads rows that aren't public, check one of these:
   - it checks `auth.uid()` against the row's owner;
   - only `service_role` can execute it.
2. **Write one migration**, `supabase/migrations/<timestamp>_ca29_function_access.sql`, that:
   - adds the missing checks, keeping each function's logic otherwise identical;
   - revokes `EXECUTE` from `anon` and `PUBLIC` where only signed-in readers or the server should call it;
   - sets `search_path` on every `SECURITY DEFINER` function that lacks it.
   Change no function that is already safe. Don't apply it.
3. Put the Lovable message in the report: `Apply supabase/migrations/<file> exactly as written. Change nothing else. Then run the security advisor and list what is left.`

**Tests:** a SQL test file, or a written check list in the report if the repo has no SQL tests, covering each changed function: signed out refused, wrong owner refused, owner allowed.

Commit: `SV-01 P6: database functions`.

## Part 7 · Errors are reported

This part wires reporting in. It doesn't sweep the whole repo; the rest goes in a list.

1. **One module,** `src/lib/errors/report.ts`, with `reportError(error, context)`. It:
   - keeps the last 50 errors in memory;
   - prints them in development;
   - sends them to Sentry only when `VITE_SENTRY_DSN` is set.
   Add `@sentry/react`, the one new dependency in this prompt. With no DSN set, nothing is sent and the bundle doesn't load Sentry's code (dynamic import). Check it with `npm run build` before and after: with no DSN, the first download grows by no more than 2 KB compressed.
2. **Wire it in:**
   - `ErrorBoundary`, `RouteBoundary` and `PanelBoundary`;
   - the query client's `QueryCache` and `MutationCache` `onError`;
   - `window` `error` and `unhandledrejection`.
3. **Writes that drop errors:** find every `insert`, `update`, `upsert`, `delete` and `rpc` in `src` whose returned `error` isn't read.
   - Fix the ones on the paths this prompt changes (checkout, notifications, the PDF button, the password reset): each one throws to its caller or calls `reportError`, and the screen says what failed in CA-28's form (`{Thing} not {done}` with Retry) where there is a screen for it.
   - List every other one in the report as `file:line`, for a follow-up. Don't change them here.
4. **`console` calls:** add the lint rule `no-console` as a **warning**, with `report.ts` allowed. Route `console.error` and `console.warn` through `reportError` only in files this prompt already changes. Report the count left. SV-26 turns the rule into an error.
5. **The connector address:** build it from `import.meta.env.VITE_SUPABASE_URL` in one place, `connector.ts`. `Connect.tsx` imports it.

**Tests:**
- a thrown render error reaches `reportError` with the route;
- a failed query reaches it once;
- no DSN means no Sentry chunk is requested.

Commit: `SV-01 P7: errors are reported`.

## Part 8 · Checks

1. Write `design/audits/security/sv-01-after.md`: the Part 0 table, with what each row is now.
2. Search the diff for any secret value and for the em dash character.
3. Run `npm run audit:design` to confirm that nothing looks different.

Commit: `SV-01 P8: checks`.

---

## Report (end the session with exactly this)

```
SV-01 · security fixes
Branch / PR:
Facts in this prompt that were wrong on disk: (list, or "none")
Baseline → end: tests N → N

P1 update-user-password removed yes/no · password change path: (how it works)
P2 prompt text drawn as text yes/no · snapshot unchanged yes/no · other raw HTML: (file: kept/changed, why)
P3 price from the database yes/no · return addresses checked yes/no · PWYW stats moved to: (where, or "stopped") · Stripe webhook exists yes/no
P4 functions now needing a login: (list) · check-compatibility-status runs from: (what) · module-level caller state found: (list, or "none")
P5 functions using the CORS helper N of N · functions with an input check N of N (left without, and why)
P6 database functions changed: (list) · migration file: (name)
P7 reportError wired yes/no · first download growth with no DSN: KB · dropped errors fixed N · dropped errors listed for later N · console calls left N
Dead code seen: (list, or "none")
Third-party upload workflows found: (list, or "none")
Secrets Miles needs to add (names only): (list, or "none")
Lovable messages needed: (each message, in full)
Parts not done: (list, or "none")
Questions for Miles: (list)
```

**What Miles needs to do** (say it in the report, plainly):
1. Merge the pull request and press Publish › Publish changes in Lovable.
2. Send each Lovable message from the report: deleting the password function, and applying the database migration.
3. Add any secret the report names in Lovable's secrets, for example `CRON_SECRET`.
4. Sentry is optional: if Miles wants error reports, he makes a free Sentry project and adds its DSN as `VITE_SENTRY_DSN`.
