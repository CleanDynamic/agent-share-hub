Paste everything below the line into Lovable's chat, once.

---

Please do not change any code, any file, any setting or any data in this project while you do this. This is a read-only check for an audit. Report only.

1. In the preview, signed in as me, open these two pages, one after the other, and wait 30 seconds on each:
   - `/drafts`
   - `/compose/new`

2. For each page, list every network request that failed (any status 400 or above, or no response) or that took longer than 1 second. For each one give:
   - the method and the path, with the query string (the part after `?`);
   - the status code;
   - how long it took, in milliseconds;
   - the response body exactly as returned (for Supabase errors this is a small JSON object with `code`, `message`, `details` and `hint`).
   Remove every token, key and email before you paste anything: replace an `Authorization` or `apikey` value, an `access_token`, a `refresh_token` and any email address with `[removed]`.

3. Copy every red error from the browser console on each page, word for word, with the same removals.

4. From the database API logs (PostgREST / API gateway) and the Postgres logs for the last hour, list:
   - every request that returned an error, with its path, status and error code (for example 42703, PGRST204, 57014);
   - every query slower than 1 second, with its duration;
   - any line that says "canceling statement due to statement timeout".
   Again, no tokens, keys, emails or anyone's content.

5. Tell me which commit the published site is running now (the commit hash or the time of the last publish), and whether it includes the commit "Applied 3 migrations & reg. types" (cc6cc8c, 20 October 2026, 21:37 UTC).

Please answer in that order, under the headings 1 to 5. Do not fix anything you find; just report it.
