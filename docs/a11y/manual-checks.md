# Screen-reader checks: VoiceOver (Mac) and NVDA (Windows)

The automated suite (`npx playwright test -c e2e/a11y/playwright.a11y.config.ts`) proves the markup: names, roles, focus
moves, live regions. It cannot prove what a screen reader says. This script is that check. Run it once with VoiceOver and
once with NVDA, on a test account (never your own data), and write down what you actually heard in the **Heard** lines.
Anything that differs from **Expect** goes in the table at the end.

Wording in quotes is what the page provides. Screen readers add their own words round it ("button", "link", "heading level
1", "dialog", "selected", list counts) and in their own order, so a match is the same words and the same role, not the same
sentence.

## Before you start

| | VoiceOver (Mac, Safari) | NVDA (Windows, Firefox or Chrome) |
|---|---|---|
| Turn on | Cmd+F5 | Ctrl+Alt+N |
| Read next item | VO (Ctrl+Option) + Right arrow | Down arrow (browse mode) |
| Next control | Tab | Tab |
| Next heading | VO+Cmd+H | H |
| Press | VO+Space, or Enter/Space on a focused control | Enter or Space |
| Stop speech | Ctrl | Ctrl |
| Lists of headings, links, landmarks | VO+U (rotor) | NVDA+F7 (elements list) |

- Date, browser and version, screen reader and version: ______________________
- Theme (Noon or Dusk) and window width: ______________________
- NVDA: keep browse mode on for reading; it switches to focus mode by itself in fields, menus and the editor (you hear a
  click or "focus mode"). VoiceOver: leave Quick Nav off.

---

## 1. Sign in

1. Open the site's home page. Press Tab once.
   - **Expect:** "Skip to content, link".
   - **Heard:** ______________________
2. Tab on until "Sign in, link" and press Enter.
   - **Expect:** a dialog is announced with the title on its left (the tagline), and focus lands in "Email, edit text".
     Reading backwards with VO+Left / Shift+Tab never leaves the dialog.
   - **Heard:** ______________________
3. Type a wrong address such as `me@` and Tab to "Password". Type anything and press Enter.
   - **Expect:** focus goes back to the field at fault, which is read as "invalid" with its message after the name (the
     message is read once, not twice).
   - **Heard:** ______________________
4. Correct the email, type the right password, press Enter.
   - **Expect:** the dialog closes; you hear the page's heading (for example "Home, heading level 1") and the header now has
     "&lt;initials&gt;, &lt;your display name&gt;, account menu, button" (or "&lt;display name&gt;, account menu" if you have a photo).
   - **Heard:** ______________________

## 2. Browse builds

1. Tab to "Builds, link" in the header (or the dock on a phone) and press Enter.
   - **Expect:** focus moves to the page's heading and it is read once: "Builds, heading level 1". You are not left at the
     link you pressed or at the top of the page.
   - **Heard:** ______________________
2. Open the headings list (rotor / elements list).
   - **Expect:** one level-1 heading, then the builds' titles as headings; no skipped levels.
   - **Heard:** ______________________
3. Tab to the filters button and press Enter; change one filter; press Escape.
   - **Expect:** the button is read with its count when filters are on (for example "Filters, 1 on"); the active filter
     chip reads "Remove &lt;filter&gt;, button"; Escape puts focus back on the filters button.
   - **Heard:** ______________________
4. In the table view, Tab to a column heading and press Enter.
   - **Expect:** the sorted column is read as "sorted ascending" (or descending); the other columns say nothing about sort.
   - **Heard:** ______________________

## 3. Open a build

1. Tab to a build's title link and press Enter.
   - **Expect:** "&lt;build title&gt;, heading level 1", read once. While it loads you hear nothing extra; when it arrives focus
     is on the real title, not on a placeholder.
   - **Heard:** ______________________
2. Read on with VO+Right / Down arrow through the first session.
   - **Expect:** sessions are groups named "Session 1 …"; each tile is read with its type and title; the family panel's
     nodes read "&lt;title&gt;, &lt;n&gt; of &lt;total&gt;".
   - **Heard:** ______________________

## 4. Save it

1. Tab to the build's Save button and press it.
   - **Expect:** "Save, toggle button, not pressed" (with its count, for example "Save, 3 saves"), then after pressing
     "pressed". A part's own marker reads "Save this part" / "Unsave this part".
   - **Heard:** ______________________
2. If a toast appears ("Saved to your library" or similar):
   - **Expect:** it is read once, politely, without moving focus. An error toast is read straight away.
   - **Heard:** ______________________

## 5. Start a build in the editor and reorder a tile

1. Tab to "New, link" in the header or dock and press Enter.
   - **Expect:** the first Tab stop is "Skip to build, link"; the build's title is announced once, politely.
   - **Heard:** ______________________
2. Tab to "New empty session" and press Enter. Tab to "Add a prompt", type `First step`, Tab to "Add", Enter. Repeat with
   `Second step`.
   - **Expect:** "Session 1" group appears; each Add is followed by the new tile's heading; focus comes back to "Add a
     prompt", which is empty again.
   - **Heard:** ______________________
3. Shift+Tab into the build list (one Tab stop), then Down arrow to the second tile.
   - **Expect:** "Prompt 2: Second step, group". Left and Right arrows move between its controls: "Move Prompt 2",
     "Prompt 2 options", "Attach to the step above".
   - **Heard:** ______________________
4. On "Move Prompt 2" press Space, then Up arrow, then Space.
   - **Expect:** "Picked up Prompt 2. 2 of 2." → "Over 1 of 2." → "Moved Prompt 2 to 1 of 2." Press Escape instead of the
     second Space and you hear "Put Prompt 2 back, 2 of 2." (or similar).
   - **Heard:** ______________________
5. Type `/` at the start of an empty line in the post's text.
   - **Expect:** "Commands" is announced as a list with its first item; Up/Down move through it, Home/End jump to the ends,
     Escape closes it and you are back in the text.
   - **Heard:** ______________________

## 6. Change a setting

1. Open the account menu (Enter on the account button), Down arrow to "Settings", Enter.
   - **Expect:** a menu with "Profile, Library, Drafts, Settings, Sign out" as menu items; on Enter, "Settings" or
     "Account, heading level 1" is read once.
   - **Heard:** ______________________
2. Change your display name (or the theme) and save.
   - **Expect:** a confirmation read once without focus moving. Saving an invalid email moves focus to that field, read as
     "invalid" with its message.
   - **Heard:** ______________________
3. Go to sessions or connected apps and press a Revoke button, then Cancel.
   - **Expect:** a dialog asking to confirm; Cancel (or Escape) puts focus back on the same Revoke button.
   - **Heard:** ______________________

## 7. Sign out

1. Open the account menu and choose "Sign out".
   - **Expect:** the menu closes; focus is on the page heading or the header (never lost to the top of an empty page); the
     header has "Sign in, link" again.
   - **Heard:** ______________________

## 8. A failed page's Try again

To make a page fail on purpose: turn the network off in the browser (developer tools → Network → Offline), then open
Library or Drafts while signed in. Turn the network back on before step 2.

1. Open the page offline.
   - **Expect:** an alert read once, one sentence such as "Couldn't load your drafts. Try again.", and a "Try again,
     button". No error code is read.
   - **Heard:** ______________________
2. Turn the network on and press "Try again".
   - **Expect:** the page loads; focus goes to its heading (for example "Drafts, heading level 1") and it is read once. If
     it fails again, focus stays on "Try again".
   - **Heard:** ______________________

---

## What differed

| Task / step | Screen reader | Expected | Heard | Severity (blocks / confusing / cosmetic) |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |

## Also worth a listen (optional)

- Voice control (Voice Control on Mac, Voice Access on Windows): say "Click Save", "Click Filters", "Click Sign in". Every
  control should respond to the words you see on it.
- Zoom to 400% (Cmd/Ctrl and +): the header stops sticking on a short window; nothing should scroll sideways except tables.
