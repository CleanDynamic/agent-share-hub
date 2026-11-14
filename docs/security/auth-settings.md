# Auth settings: what the code expects, and what only the owner can switch on

This page goes with the auth hardening work (security prompt 7). The code changes are in the repository. The protections
below count only once they are on in the dashboards. Every item says where to find it. Dashboard names move from time to
time; if a path below has moved, search the dashboard for the setting's name.

What `supabase/config.toml` can express is mirrored in its `[auth]` section. That file drives a local stack and
`supabase config push`; the hosted project keeps whatever its dashboard says until someone pushes or changes it there.

Read from the live project on 2026-11-14 (public settings endpoint, read only): email sign-up on, **confirm email on**
(`mailer_autoconfirm: false`), and **Google, GitHub and X all off**.

---

## The checklist

### 1. Bot check (Cloudflare Turnstile)

1. **Create the widget.** Cloudflare dashboard → Turnstile → Add widget.
   - Widget mode: **Invisible**. The site draws no box and keeps no space for one.
   - Hostnames: `openbuilds.ai`, `www.openbuilds.ai`, plus any preview host you use (see item 6).
2. **Site key → Netlify.** Netlify → your site → Site configuration → Environment variables → add
   `VITE_TURNSTILE_SITE_KEY` with the site key, then redeploy. The site key is public. With it unset, a production build
   sends requests with no token (so sign-in fails once CAPTCHA protection is on); development falls back to Cloudflare's
   always-pass test key and says so in the console.
3. **Secret key → Supabase, then switch it on.** Supabase dashboard → Authentication → Attack Protection →
   **Enable CAPTCHA protection** → provider **Turnstile** → paste the secret key → Save. The secret never goes in the
   repository or in Netlify.
4. Once it is on, the auth service refuses sign-in, sign-up, password-reset and resend requests that carry no valid token.
   The site sends one on all four, and on the current-password check in Settings → Account. Try each once after
   switching it on.

### 2. Accounts and passwords

All on Supabase dashboard → Authentication → Sign In / Providers → **Email**:

- **Confirm email**: on (already on).
- **Secure email change**: on. Both addresses must confirm.
- **Secure password change** (reauthentication): on. Changing a password then needs a recent sign-in. Settings → Account
  already signs in with the current password first, and a reset link opens a fresh session, so both keep working.
- **Minimum password length**: **12**. The dialog's own hints still say 8 (prompt 9 owns that wording). A password of
  8 to 11 characters is refused by the server, and the dialog says "Choose a stronger password."
- **Email OTP expiration** (how long an emailed link works): **3600** seconds or less.

Supabase dashboard → Authentication → Attack Protection:

- **Prevent use of leaked passwords**: on, if your plan has it (Pro and up). Not expressible in `config.toml`.

### 3. Rate limits and where links may send people

- **Rate limits**: Supabase dashboard → Authentication → Rate Limits. Review the limits on emails sent, sign-ups and
  sign-ins, token refreshes and verifications. Nothing in the code depends on particular values.
- **Redirect allow list**: Supabase dashboard → Authentication → URL Configuration.
  - Site URL: `https://openbuilds.ai`
  - Redirect URLs, exact (no wildcards):
    - `https://openbuilds.ai/auth/callback`
    - `https://openbuilds.ai/verify-email`
    - `https://openbuilds.ai/reset-password`
    - `https://openbuilds.ai/settings/account`
    - `https://www.openbuilds.ai/auth/callback`
    - `https://www.openbuilds.ai/verify-email`
    - `https://www.openbuilds.ai/reset-password`
    - `https://www.openbuilds.ai/settings/account`
  - Note: the auth service also accepts any address on the Site URL's own host. OAuth sign-in returns to
    `/auth/callback?provider=…&redirect=…`, which relies on that.
  - Remove any old Lovable or other hosts you no longer use.

### 4. The database

1. **Apply the migration** `supabase/migrations/20261114120000_auth_hardening.sql`: Supabase dashboard → SQL Editor →
   paste → Run, or `supabase db push`. It:
   - takes EXECUTE on `get_email_by_username` (every overload) from PUBLIC, anon and authenticated, and grants it to
     service_role only. Nothing is dropped. If the function is not there, it says so and skips.
   - adds `edge_rate_limits` and `edge_rate_limit_hit` for the per-IP limits (G10). Service role only.
2. **Check it took.** In the SQL Editor:

   ```sql
   select p.oid::regprocedure,
          has_function_privilege('anon', p.oid, 'EXECUTE')          as anon,
          has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
          has_function_privilege('service_role', p.oid, 'EXECUTE')  as service_role
   from pg_proc p where p.proname in ('get_email_by_username', 'edge_rate_limit_hit');
   ```

   Expect `false, false, true` on every row.
3. **Run the security advisor.** Supabase dashboard → Advisors → Security Advisor → Refresh. "Security definer function
   executable by anon" should no longer list `get_email_by_username`.
4. **Look for bulk lookups in the past.** Supabase dashboard → Logs & Analytics → API Gateway (edge logs). Filter the path
   for `/rest/v1/rpc/get_email_by_username` and look at the count per caller address and per day. Many calls from one
   address, or a steady stream, means someone was harvesting addresses. After the migration, every such call is refused.

### 5. Edge functions (G10)

- The per-IP limits need the migration above. Until it is applied, each limited function logs "the rate limit could not
  be checked" and lets the call through. That is deliberate: a fault in the store must not stop payments. Watch the
  function logs (Supabase dashboard → Edge Functions → the function → Logs) after deploying.
- The caller's address is read from `cf-connecting-ip`, then `x-real-ip`, then the first `x-forwarded-for` entry. A
  caller can write `x-forwarded-for` themselves. Check in one function's logs which header the platform actually fills.
- Deploy the changed functions: `create-checkout-session`, `generate-ai-pdf`, and the others once their limits are
  agreed.

### 6. Values to set (not in the repository)

- **Preview hosts.** The Netlify site name is not in the repository, so no preview address is guessed anywhere. Nothing in
  the code needs one now: the CSP allows `'self'`, which is whatever host serves the page, and the sign-in function that
  needed CORS was withdrawn. If you want deploy previews to sign in, add their exact callback addresses to the redirect
  allow list (item 3) and their host to the Turnstile widget (item 1). **Set this.**
- **Sentry.** If `VITE_SENTRY_DSN` is set in Netlify, add its exact ingest host (for example `https://o123.ingest.de.sentry.io`)
  to `connect-src` in `netlify.toml` **before** the CSP is made enforcing, or error reports are blocked. **Set this.**
- **OAuth providers.** Google, GitHub and X are off on the live project, so those buttons cannot work at all today.
  Supabase dashboard → Authentication → Sign In / Providers. Their return-address handling (G18) was checked against
  mocks only.

---

## The content security policy (G20, G21)

Sent by `netlify.toml` on every response, **Report-Only** for now (D5). Violations show in the browser console only; there
is no report endpoint. A separate, clearly marked commit makes it enforcing when you say so.

| Directive | Sources | Why |
|---|---|---|
| `default-src` | `'self'` | Anything not named below comes from this site only. |
| `script-src` | `'self'` | The app's bundles and chunks. |
| | `'sha256-DAKq…aYQ='` | The theme boot script in `index.html` (sets light or dark before the bundle). |
| | `'sha256-Jihd…4HA='` | The boot-shell remover in `index.html`. |
| | `https://challenges.cloudflare.com` | Turnstile's script. |
| | *(no `'unsafe-inline'`, no `'unsafe-eval'`)* | `src/test/security/headers.test.ts` fails if either inline script changes without its hash. |
| `style-src` | `'self' 'unsafe-inline'` | The site styles with inline style objects (D6). |
| `img-src` | `'self' data: blob: https:` | Members' images come from any https host; `data:` and `blob:` for previews. **Known weak point**: any https image host. |
| `font-src` | `'self'` | Geist is self-hosted in `/fonts`. |
| `connect-src` | `'self'` | The site's own address. |
| | `https://zybdotagjwektucfdkri.supabase.co` | Supabase: database, auth, storage, edge functions. |
| | `wss://zybdotagjwektucfdkri.supabase.co` | Supabase realtime (messages, live notices). |
| | `https://api.microlink.io` | Link previews in the article editor's resource block. |
| `frame-src` | `https:` | Members embed YouTube, Vimeo and arbitrary pages; Turnstile's frame. **Known weak point**: any https frame. |
| `media-src` | `'self' blob: https:` | Members' videos from any https host. **Known weak point**, same as images. |
| `worker-src` | `'self' blob:` | Room for a worker; none today. |
| `manifest-src` | `'self'` | |
| `object-src` | `'none'` | No plugins. |
| `base-uri` | `'self'` | A `<base>` tag cannot repoint relative addresses. |
| `form-action` | `'self'` | Forms post only here (Stripe checkout is a redirect, not a form). |
| `frame-ancestors` | `'none'` | Nobody may frame the site (with `X-Frame-Options: DENY` for older browsers). |

The Lovable editor previews the app inside a frame. That runs on Lovable's hosting, not Netlify's, so these headers do
not reach it.

Other headers on every response: `Strict-Transport-Security: max-age=31536000; includeSubDomains`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy: camera=(), microphone=(), geolocation=()`, `X-Frame-Options: DENY`.

Checked by `npx playwright test -c playwright.csp.config.ts --trace off` (add `PW_CHROMIUM_PATH=…` where the bundled
browser does not match): Home, Builds, a build page, the Composer and the sign-in dialog, in both themes, with the policy
enforced, against mocks.

---

## Later: switching the browser client to PKCE (not done; D4)

The browser client uses the implicit flow. Switching it needs all of these, and more than the client file:

1. `flowType: "pkce"` in `src/integrations/supabase/client.ts`.
2. **Email templates.** With PKCE, a link proves itself with a code verifier kept in the browser that asked, so a reset
   or confirmation opened on another device or browser fails. Change the templates to token-hash links that work
   anywhere: Supabase dashboard → Authentication → Emails → Templates.
   - Confirm signup: `{{ .SiteURL }}/verify-email?token_hash={{ .TokenHash }}&type=email`
   - Reset password: `{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery`
   - Change email address: the same pattern with `type=email_change`.
   `src/lib/auth/emailLink.ts` already spends a `token_hash` with `verifyOtp`.
3. **Storage.** `brokeredPreviewStorage` must keep the `sb-<ref>-auth-token-code-verifier` key through the provider
   round trip, in the Lovable preview too.
4. **The OAuth callback.** `detectSessionInUrl` exchanges `?code=` itself; `AuthCallback` waits for the session as now.
5. **Test** a reset and a confirmation opened on a second device, a Google sign-in, and the Lovable preview, before shipping.
