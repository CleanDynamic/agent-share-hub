# CA-08 · Browser steps for Miles

These steps take about five minutes. They change nothing. They show the message the website gets back from the database when something fails, which the website itself never shows you.

You need a computer with Google Chrome. Do this on the **live site**, not inside the Lovable editor.

---

## Before you start: two quick looks (no tools)

1. **Look at the word "Drafts" at the top of the site.** Is there a number next to it? Write it down (for example "15", or "no number").
2. **Open the Gallery.** Do builds show, or does it say "That didn't load."? Write down which.

These two answers already narrow things down (see the table at the end).

---

## Part 1 · Starting a new post

1. Open the live site in Chrome, signed in as you.
2. Open the console: in the menu bar choose **View**, then **Developer**, then **JavaScript Console**. A panel opens at the side or bottom of the window. (On Windows, where Chrome has no menu bar, press **Ctrl+Shift+J** instead.)
3. In that panel, click the **circle with a line through it** (top left of the panel, "Clear console"), so only what happens next is shown.
4. Start a new post. Then add something: choose **Add**, then **New session**, then **Add**. Keep going until the red message appears ("Couldn't make that session. Try again.").
   - There may be **two** messages stacked on top of each other, one behind the other. The "Edit with Lovable" badge in the bottom corner can cover them. Move your mouse over the messages to spread them out, and write down **every** message you see.
5. In the console panel, find every red line that starts with **`[Sandbox]`**, **`[Compose]`** or **`[Drafts]`**. Copy each one, **and the first red line under each one** (it usually starts `Error:` and ends with the reason, for example `column builds.post_doc does not exist`).
   - To copy: select the text with your mouse, then press Cmd+C (Mac) or Ctrl+C (Windows).
   - Click the small triangle at the start of a line to open it. If you see a line called `cause`, open that too and copy the `code` and `message` under it.
6. Now open the **Network** tab (at the top of the same panel, next to "Console").
7. Leave the panel open, and do the same add again (**Add**, **New session**, **Add**) so the request is recorded.
8. In the Network list, find the line shown in **red**. It will usually start with `builds?select=` or `builds`. Its **Status** column shows a number such as 400, 401, 403, 404 or 406.
9. Click that red line. A side panel opens. Click **Response** in it. Copy everything the Response shows. It is short, like this:

   ```
   {"code":"42703","details":null,"hint":null,"message":"column builds.post_doc does not exist"}
   ```

   Also write down the **Status** number from the list.

**Do not copy anything from the "Headers" tab.** That tab holds your sign-in.

---

## Part 2 · The Drafts page

1. Keep the panel open. Click the **circle with a line through it** again in both the Console and the Network tabs to clear them.
2. Open the **Drafts** page.
3. Write down exactly what the page says: your list of drafts, **"That didn't load."** (with a **Try again** button, once or twice), **"Nothing in progress."**, or grey bars that never go away.
4. In the **Console**: copy any red line that starts with `[Drafts]`. **There may be none, and that is expected.** When the Drafts page fails to load, the website does not write a line of its own. The answer is in the Network tab instead.
5. In the **Network** tab: find the red line or lines (often `builds?select=` or `import_sessions?select=`). Click each one, open **Response**, and copy what it shows. Note each one's **Status** number.

---

## Part 3 · Before you paste anything: remove keys and tokens

Read through everything you copied **before** you send it.

- **Delete any long string that starts with `eyJ`.** These are sign-in tokens or keys. They look like `eyJhbGciOi…` followed by hundreds more letters and numbers, often with two dots in them.
- Delete anything after `Bearer `, `apikey`, `access_token` or `refresh_token`.
- Delete your **email address** wherever it appears.
- What you keep is short: the red console lines, the Status numbers, and the Response text, which looks like `{"code":"…","message":"…"}`. None of that is secret.

If you are not sure whether something is safe, leave it out. The `code` and `message` are what matter.

---

## Part 4 · The database check

Open the database SQL editor in Lovable. Paste the whole of `docs/audits/ca-08/live-checks.sql` once, run it, and copy back the whole table (or screenshot every row). It only reads. It changes nothing.

---

## If you see… it means…

| If you see… | It means… |
|---|---|
| `column builds.post_doc does not exist` (code `42703`), in the console or a Response | **The most likely case.** The live database is missing the change that adds post threads (`supabase/migrations/20261016120000_post_threads.sql`). Since 16 October, every page that reads or writes a build asks for that column, so Drafts, opening a draft, and starting a new post all fail. Your drafts are safe. They just can't be read this way. The SQL check's first row says `MISSING`. |
| Two messages stacked: "Couldn't make that session. Try again." in front and "Couldn't start your draft. Try again." behind it | The draft could not be created at all (the first step failed). The red `[Compose] createBuild failed` line says why. |
| Only "Couldn't make that session. Try again.", and later a new "Untitled build" appears on the Drafts page | The draft was created, and the session was not saved into it. Look for a red request whose name starts with `builds` and whose Method is PATCH; its Response says why. |
| `column builds.session_count does not exist` or `column builds.making does not exist` | An earlier database change is missing (`20261001280000_sessions_and_making.sql`). |
| `Could not find the 'post_doc' column of 'builds' in the schema cache` (code `PGRST204`) | The same as the first row, met when the Post tab saves. If it appears just after the database change was applied, the database's list of columns hasn't refreshed yet. Wait a minute and reload. |
| `function … does not exist` (code `42883`) or `Could not find the function …` (code `PGRST202`) | Something the site calls, or a database security rule calls, is missing from the live database. The message names it. |
| `new row violates row-level security policy for table "builds"` (code `42501`, Status 403) | The database did not accept you as the owner of the new draft. Sign out and back in. If it continues, the SQL check's E rows show which rule is wrong. |
| `permission denied for table …` (code `42501`, Status 401 or 403) | Your sign-in did not reach the database, or a permission is missing. Sign out and back in. If it continues, see the SQL check's D rows. |
| `JWT expired`, or Status 401 with `PGRST301` / `PGRST303` | Your sign-in has run out. Sign out and back in, then try again. |
| `violates check constraint "…"` (code `23514`) | A database rule refused the change. The rule is named in the message and in the SQL check's G rows. |
| `Cannot coerce the result to a single JSON object` (code `PGRST116`, Status 406) | The change matched no draft: the database did not let the site see that draft as yours. |
| `TypeError: Failed to fetch`, or grey bars on Drafts for about 15 seconds before "That didn't load." | The network, or a browser extension such as an ad blocker, stopped the request. Try again with extensions off or on another network. |
| "That didn't load." on the Drafts page **twice** (both lists), and the number next to "Drafts" at the top still shows your count (about 15) | Your sign-in works and your drafts are there. The page's own request is refused, most likely by the missing column in the first row. (One failed list makes both lists say it.) |
| "Nothing in progress." on the Drafts page, and no red request | The site read no drafts: you are signed in to another account, or the database did not let it see your drafts as yours. |
| The Gallery says "That didn't load." too | The same missing column (`post_doc`) is behind it. The Gallery also asks for `like_count` and `comment_count`, which the live database may not have either. The SQL check's B rows for those columns will say. |
| No red line and no red request at all, and still the message | Send what you have. That rules out the database, and points to the page itself. |
