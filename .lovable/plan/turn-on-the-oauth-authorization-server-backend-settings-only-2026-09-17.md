# Turn on the OAuth authorization server (backend settings only)

No code, no files, no consent page. Only the sign-in service's own settings change.

## Confirmed already (read-only check)
- Site URL is already `https://agent-share-hub.lovable.app` — no change needed.
- OAuth server: currently off.
- Authorization path: not set.
- Client self-registration: not set.

## What I will do
1. Enable the OAuth 2.1 authorization server for this backend.
2. Enable Dynamic Client Registration (clients can register themselves).
3. Set the authorization (consent) path to `/oauth/consent` instead of the platform default.

Note: the consent path will point at `/oauth/consent`, which will only work once the separately built consent page exists at that address. That is expected here.

## What I will report back
- The backend's project ref
- The Site URL
- The full text fetched from `https://<project ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1`
- Whether that text contains `authorization_response_iss_parameter_supported`
