# UX-13 Lovable message

Send this to Lovable after the domain is Active (Part 5 step 1), the Supabase secret is set (step 4) and, if emails send from an old domain, Resend is verified (step 6).

```
Deploy every edge function in this repository's supabase/functions folder exactly as written, because all of them read the shared allowed-origins list (supabase/functions/_shared/origins.ts) and sitemap-xml, mcp and generate-ai-pdf also read the new supabase/functions/_shared/site.ts and sitemap.js. Set the Edge Function secret PUBLIC_SITE_URL to https://openbuilds.ai. Change nothing else. Then run, in the SQL editor, EXPLAIN (ANALYZE, BUFFERS) for each of these four reads and paste the plans back: SELECT slug, status, updated_at, published_at FROM public.builds WHERE status IN ('published','gallery') ORDER BY published_at DESC LIMIT 1000; SELECT username, is_private FROM public.profiles WHERE is_private = false AND username IS NOT NULL ORDER BY username LIMIT 1000; SELECT slug FROM public.spaces ORDER BY slug LIMIT 1000; SELECT slug, id, status, updated_at, published_at FROM public.content_items WHERE status = 'approved' ORDER BY published_at DESC LIMIT 1000.
```
