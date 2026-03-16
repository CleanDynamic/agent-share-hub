

# Pre-Launch Audit Results

## AUTHENTICATION & ACCOUNTS

**□ Supabase trigger create_profile_on_signup() — PASS**
The `handle_new_user()` function exists and correctly inserts into profiles with username, display_name, and account_type from raw_user_meta_data.

**□ After signup, profiles row exists with correct data — PASS**
Signup sends display_name, username, account_type via `options.data`. The trigger reads these. The Signup page also runs an explicit `.update()` as a safety net.

**□ Creators have is_creator = true — PASS**
Signup.tsx explicitly updates `is_creator: accountType === "creator"` after signup.

**□ Protected routes redirect to /login?redirect= — PASS**
ProtectedRoute redirects to `/login?redirect=${encodeURIComponent(location.pathname)}`.

**□ After login, redirect back — PASS**
Login.tsx reads `searchParams.get("redirect")` and navigates to it on success.

**□ Admin route protected server-side — PASS**
AdminRoute fetches the session, then queries `profiles.is_admin` from the database. RLS on content_items and ai_tools_registry also uses the `is_admin()` security-definer function.

**□ Sign out clears session — FAIL**
`AuthContext.signOut()` calls `supabase.auth.signOut()` and clears local state, but does **not** redirect to `/`. The Navbar sign-out just calls `signOut()` (desktop dropdown) or `signOut(); setMobileOpen(false)` (mobile). No `navigate("/")`.
**Fix:** In the sign-out handler in `Navbar.tsx`, add `navigate("/")` after calling `signOut()`. Or update `AuthContext.signOut` to accept an optional redirect callback.

**□ Password reset flow — FAIL**
Login.tsx sends the reset email with `redirectTo: /reset-password`, but there is **no `/reset-password` route or page** in the app. Users clicking the email link will hit a 404.
**Fix:** Create a `src/pages/ResetPassword.tsx` page that detects the `type=recovery` hash param, shows a new-password form, and calls `supabase.auth.updateUser({ password })`. Add the route to App.tsx as a public route.

---

## DATABASE & RLS

**□ content_items: unauthenticated users cannot SELECT pending/rejected — PASS**
The SELECT policy requires `status = 'approved' OR creator_id = auth.uid() OR is_admin(auth.uid())`.

**□ follows: users cannot insert follower_id ≠ auth.uid() — PASS**
INSERT policy: `follower_id = auth.uid()`.

**□ user_saves: users cannot read/modify others' saves — PASS**
SELECT, INSERT, DELETE all scoped to `user_id = auth.uid()`.

**□ ad_impressions: no sensitive data exposed — PASS**
Only admin can SELECT. Public can INSERT. No UPDATE/DELETE policies.

**□ ai_tools_registry: public can only SELECT approved — PASS**
SELECT policy: `status = 'approved' OR is_admin(auth.uid())`.

**□ service_enquiries: creators can only see own listings — PASS**
SELECT policy scoped to `listing_id IN (SELECT id FROM service_listings WHERE creator_id = auth.uid())`.

**□ All RLS tested — MANUAL TESTING REQUIRED**
Cannot be verified in code review alone. Recommend testing with both anon and authenticated clients.

---

## SOCIAL FEATURES

**□ Follow/unfollow updates counts — PASS (with caveat)**
FollowButton does optimistic UI, then after the insert/delete succeeds, it queries the actual count from `follows` and writes it to `profiles.follower_count` and `following_count`. This works but is **race-condition-prone** — two concurrent follows could produce stale counts. Consider a database trigger instead. Not a blocker for launch.

**□ Bookmark works — PASS**
BookmarkButton does optimistic insert/delete with rollback on error.

**□ Activity feed fetches only followed creators' content — PASS**
Feed.tsx fetches `followingIds` first, then queries `content_items.in("creator_id", followingIds)`.

**□ Personalised browse filters by interests/tools — PASS**
Browse.tsx loads user's `user_interests` and `user_ai_tools` from profiles and filters client-side.

**□ Follower counts reflect actual follows table — PASS (with caveat)**
See race condition note above. The counts are synced after each follow/unfollow action.

---

## DYNAMIC AI TOOLS

**□ Browse filter loads from ai_tools_registry — PASS**
Uses `useApprovedToolNames()` hook.

**□ Upload checkboxes load from same source — PASS**
Same `useApprovedToolNames()` hook.

**□ Official tools first — PASS**
`useApprovedTools` orders by `is_official DESC, name ASC`.

**□ New approved tool updates on next page load — PASS**
React Query with 10-minute stale time. Admin approval invalidates the `approved_ai_tools` query key.

**□ Duplicate check on tool submission — PASS**
`SubmitToolModal` does an `ilike` query against the registry and checks both approved and pending status.

---

## AD POPUP & CONVERSION

**□ Guest download shows ad popup — PASS**
ContentCard and ContentDetail both open `GuestDownloadModal` for free content when not logged in.

**□ 5-second countdown — PASS (with caveat)**
Uses `setTimeout` with 1-second intervals. Cannot be "bypassed via dev tools" in any meaningful way — the "Continue as guest" button is disabled until `ready === true`. However, a user could call `onDownload()` directly from the console. This is acceptable for a pre-launch state.

**□ File downloads after 5 seconds — PASS**
`handleContinueAsGuest` calls `onDownload()` which triggers `triggerDownload()`.

**□ "Create free account" passes content_id — PASS**
Navigates to `/signup?after_download=${contentId}`.

**□ Post-signup auto-download — PASS**
Signup.tsx checks `afterDownload`, calls `triggerDownload`, and navigates to the content page.

**□ ad_impressions row inserted on popup show — PASS**
`GuestDownloadModal` inserts into `ad_impressions` on open.

**□ converted = true on signup from popup — PASS (partial)**
Signup.tsx attempts to update `ad_impressions.converted = true` but the query is fragile — it matches `user_id IS NULL AND dismissed_at IS NULL` ordered by `shown_at DESC LIMIT 1`. This could match the wrong impression if the user opened multiple popups. Not a launch blocker.

---

## MONETISATION

**□ Paid content not accessible without payment — PASS**
`triggerDownload` uses signed URLs from the private `content-files` bucket. The checkout flow gates access behind Stripe payment.

**□ Stripe key only in edge function secrets — PASS**
`STRIPE_SECRET_KEY` is in Supabase secrets. Frontend code only calls `supabase.functions.invoke()`.

**□ Donation button only on donation_enabled items — PASS**
ContentDetail checks `item.donation_enabled` before rendering TipSelector.

**□ Subscription gate — PASS**
ContentDetail checks `hasActiveSubscription` before allowing download of subscription content.

**□ Service enquiry inserts correctly — PASS**
CreatorProfile's `handleEnquiry` inserts into `service_enquiries`.

---

## PAGES & ROUTING

**□ Every route renders without errors — FAIL**
1. **`/settings` route does not exist.** The Navbar links to `/settings` in both desktop dropdown (line 108) and mobile panel (line 181), but there is no Settings page or route in App.tsx. This will render the NotFound page.
**Fix:** Either create a Settings page or remove the Settings link from the Navbar.

2. **`/reset-password` route missing** (covered above).

**□ /content/:id shows 404 for non-existent IDs — PASS**
ContentDetail shows "This content doesn't exist or has been removed" with a back link.

**□ /creator/:username shows 404 for non-existent usernames — PASS**
CreatorProfile shows "Creator not found" with a back link.

**□ Onboarding only shows once — FAIL**
There is **no check** whether the user has already completed onboarding. Every time a user navigates to `/onboarding`, they see the full 3-step flow again. The signup flow always navigates to `/onboarding` regardless.
**Fix:** Add an `onboarding_completed` flag to the profiles table (or check if `user_interests` is non-empty). In the Onboarding page, if already completed, redirect to `/browse`. In Signup, check the flag before routing to `/onboarding`.

**□ My Uploads shows only own content — PASS**
Queries `content_items` with `creator_id = profile.id`.

---

## SEO & ROBOTS

**□ Private pages have noindex — PASS**
All private pages pass `noIndex` to SeoHead.

**□ robots.txt disallows private routes — PASS**
Verified in robots.txt.

**□ Unique title and meta description per page — PASS**
Every page uses SeoHead with unique title/description.

**□ Canonical URLs use VITE_SITE_URL — PASS**
SeoHead reads `VITE_SITE_URL` with fallback to `https://neoscale.ai`.

**□ JSON-LD valid — PASS (structure)**
ContentDetail and CreatorProfile both output valid JSON-LD schemas. Recommend testing with schema.org validator after deployment.

---

## MOBILE

**□ No horizontal scroll — PASS**
`overflow-x: hidden` on body in index.css.

**□ 44px tap targets — PASS**
Bookmark button wrapped in 44px container. Nav links have `min-h-[44px]`. Filter buttons have `min-h-[44px]`.

**□ iOS 16px font-size — PASS**
Global CSS rule: `input, select, textarea { font-size: 16px !important; }` with desktop override at 768px.

**□ Ad popup usable at 375px — PASS**
GuestDownloadModal uses `max-w-[calc(100vw-32px)]` and buttons stack vertically with `min-h-[44px]`.

**□ Hamburger closes on link tap — PASS**
Each link has `onClick={() => setMobileOpen(false)}`. Also closes on route change via useEffect.

**□ Sticky download bar on ContentDetail — PASS**
Content detail has `pb-24 lg:pb-12` and a fixed bottom bar on mobile (visible in the `lg:hidden` section).

---

## SUMMARY: 4 FAILURES

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | **No `/reset-password` page** | High | Create ResetPassword.tsx with password update form, add route to App.tsx |
| 2 | **Sign out does not redirect to `/`** | Medium | Add `navigate("/")` after `signOut()` in Navbar |
| 3 | **`/settings` link in Navbar leads to 404** | Medium | Remove the Settings link from Navbar (no Settings page exists) |
| 4 | **Onboarding shows every time** | Medium | Check `user_interests` length on Onboarding page — if non-empty, skip to `/browse`. Update Signup to check before routing to `/onboarding`. |

### Implementation Plan

1. **Create `/reset-password` route and page** — detect recovery token from URL hash, show new password form, call `updateUser({ password })`, redirect to `/browse` on success.

2. **Fix sign-out redirect** — in Navbar.tsx, wrap `signOut()` calls with a `navigate("/")` call afterward.

3. **Remove `/settings` link** — delete the Settings menu items from both desktop dropdown and mobile panel in Navbar.tsx.

4. **Add onboarding-skip logic** — in Onboarding.tsx, if `profile.user_interests` has items, redirect to `/browse`. In Signup.tsx, after signup check if interests exist before navigating to `/onboarding`.

