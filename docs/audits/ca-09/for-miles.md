# CA-09 · For Miles

The short version of the CA-09 audit (section 1 of `docs/audits/ca-09/report.md`). Draft pull request: https://github.com/CleanDynamic/agent-share-hub/pull/362

- **Why the site is slow:** before a page shows anything, a phone has to download and start about a megabyte of code (four seconds on a slow connection). Then the page asks the database for its pieces one after another instead of all at once, and asks for some of them three times. So a page takes 7 to 11 seconds to become usable on a phone, and 1 to 3 seconds on a computer.
- **Why buttons do nothing:** the composer's Add menu is taller than the space above the Add button, so its top items (New session, and on a phone Prompt) open above the top of the screen, where they can't be pressed. Prompt itself does move the cursor to the prompt box, but the menu takes it straight back to the Add button, so on any device nothing visible happens.
- **Why drafts don't load:** your drafts themselves now load, so tonight's database fix worked for them. But the Drafts page waits for a second list, your waiting sessions, before it shows anything, and if that list is slow or fails it hides your drafts behind "That didn't load." The checks below will tell us which piece fails on the live site.
- **What to run:** paste `docs/audits/ca-09/live-checks.sql` once into Lovable's SQL editor (it only reads, it changes nothing) and paste `docs/audits/ca-09/lovable-message.md` into Lovable's chat, then send back both answers.
- **The fixes, in order:** first make the Drafts page show your drafts on their own and make every Add item work on a phone and a computer. Then make pages faster: fetch things together, read your profile once, sign pictures in one go, send less code up front. Then the rest: clear error messages, the Gallery's missing columns, a likely privacy hole in sign-in, old code and the tests.
- **How long:** about one Claude Code session for the drafts and the buttons, two for speed, and two for the rest, so five sessions in all.

## Files

- `docs/audits/ca-09/live-checks.sql`
- `docs/audits/ca-09/lovable-message.md`
- The full report: `docs/audits/ca-09/report.md`
