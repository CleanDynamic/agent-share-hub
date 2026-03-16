# NeoScale AI — Deployment Checklist

## Before going live — Supabase

- [ ] Confirm `create_profile_on_signup()` trigger is active in Supabase Dashboard > Database > Triggers
- [ ] Enable email confirmation in Supabase Auth settings (currently off for development)
- [ ] Set `STRIPE_SECRET_KEY` as a Supabase Edge Function secret (not a Netlify variable)
- [ ] Confirm `ai_tools_registry` seed data is inserted (Any Tool, ChatGPT, Claude, Gemini, Grok, Zapier, Make, n8n)
- [ ] Confirm all RLS policies are enabled — run a quick test with an unauthenticated Supabase client
- [ ] Set your admin account: insert a row in `profiles` with your user id and `is_admin = true`

## Before going live — Netlify

- [ ] Connect GitHub repo: `neoscale-ai` (main branch)
- [ ] Add environment variables in Netlify Dashboard > Site settings > Environment variables:
      `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_SITE_URL`
- [ ] Add custom domain: `neoscaleai.com`
- [ ] Enable HTTPS (automatic via Netlify)
- [ ] Test the `/*` redirect rule by visiting `/browse` directly — should not 404

## Before going live — Stripe

- [ ] Switch from Stripe test keys to live keys in Netlify environment variables
- [ ] Create donation product in Stripe dashboard
- [ ] Create subscription price in Stripe dashboard for any creators who want subscriptions
- [ ] Test a real £1 payment end-to-end before announcing launch

## Before going live — Content

- [ ] At least 25 approved items across 6+ content types live on `/browse`
- [ ] At least 3 Failure Library posts seeded
- [ ] Normie test passed: show `/browse` to someone who does not use AI, they understand it in under 60 seconds
- [ ] Your own admin account confirmed working at `/admin`
