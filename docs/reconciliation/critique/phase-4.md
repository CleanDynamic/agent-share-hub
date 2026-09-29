# Phase 4 critique — the social layer (RC-P20b)

The social layer RC-P15 to RC-P20 built, judged from its screenshots and measured in the browser: engagement on cards and build headers, share tags, comments on a build and its parts, reports and the admin's queue, the library on builds, build notifications and builds in messages.

## Method

- **Screens.** `e2e/audit/rc-critique.spec.ts` captures eleven views at 390, 768, 1024 and 1440 wide, in Exhibition and Dusk: 88 screenshots in `e2e/audit/critique/phase-4/`, which is gitignored. Eight are addresses: `/gallery`, `/b2/rc-build-7` (as it opens, and at `#comments`), `/library`, `/library?tab=collections`, `/notifications`, `/messages/<the fixture thread>` and `/admin` (as an admin, on Reports). Three are dialogs, open over the build page: the report dialog, the delete-comment confirmation and the add-to-collection dialog. Regenerate them with `npx playwright test e2e/audit/rc-critique.spec.ts --project=desktop`.
- **Fixtures.** `e2e/audit/fixtures/rcSocial.ts`, on top of phase 3's builds (`rcBuilds.ts`):
  - four comments on rc-build-7: one a reply by the reader (so Delete shows), one attached to its first part;
  - the reader's likes on two builds and saves on three (not rc-build-7, so Save on its page adds it and offers "Add to a collection");
  - two collections holding five builds;
  - one notification of each of the nine kinds the database writes;
  - a direct thread with a maker the reader follows, carrying rc-build-7 and a note;
  - one open report.

  The reader is an admin on `/admin` only. Every table answers through `e2e/audit/support/restFilter.ts`, with the embeds each select names (a comment's author, a report's reporter, a collection's count). Nothing reaches the network.
- **Probes.** Beside each view's screenshots, the spec writes `probes-<view>-<theme>.json`:
  - the interactive elements painted with the primary fill (`--action`) in the topmost layer, which is the open dialog when there is one and the page otherwise;
  - for a dialog, whether a scrim covers the screen and what the screen's bottom-left corner hits.
- **Motion.** Replayed at 10% speed (`Animation.setPlaybackRate(0.1)` over the DevTools protocol), in both rooms, at 1440:
  - the report dialog opening and closing;
  - Save, its toast, and the add-to-collection dialog;
  - Like;
  - the delete confirmation;
  - the build picker in a message.

  Frames and the running animations' properties, durations and easings were recorded (a scratch probe, not committed).
- **Ratings.** Each skill's own scale:
  - **major issue**: a reader cannot reach something the screen is about, or the same thing looks like two things.
  - **minor issue**: friction or inconsistency, with the way forward still in view.
  - **pass**: no finding.

  A dimension takes its worst finding.
- **Scope.** The phase's surfaces, plus whatever else shows in the screenshots. A finding outside RC-P15 to RC-P20's files is rated and deferred.
- **critique-information-density is not installed** in this environment. Its section below uses the four dimensions and the Observation, Problem, Fix form that phase 3's record used for it.

## Summary

| | Before the fixes | After the fixes |
|---|---|---|
| The three critique skills' dimensions (12) | major 3 · minor 4 · pass 5 | major 2 · minor 5 · pass 5 |
| Distinct major findings | 3 | 2, both deferred with their reasons |
| Distinct minor findings and LOW rows | 12, plus one MEDIUM row fixed (CRITIQUE-10) | the same 12, deferred to the handover's list (m1 to m12) |

The three majors:

| # | Finding | Where | Outcome |
|---|---|---|---|
| M1 | `/library?tab=collections` opened under an empty band: the collections sat mid-page, 190 to 470px below their tabs (309 at the desktop project, 210 at the phone) | src/pages/Library.tsx | Fixed, CRITIQUE-9 |
| M2 | `/messages/<thread>` at 390: the page sets its 220px thread list beside the thread at every width, so the thread is about 150px wide. There, a shared build's title wraps one letter a line, the build picker is clipped at its right edge, and Share a build and Send sit under the message box | src/pages/Messages.tsx:465 (MessagesThreadList width={220}) | Deferred: Messages.tsx is outside RC-P15 to RC-P20's files, and the fix is structural (CONTRACT §2.2) |
| M3 | A build reaches a collection only through the toast after a Save. A build saved earlier, or whose toast went by, gets there only by unsaving and saving again | src/components/social/EngagementRow.tsx:173 (RC-P18 step 4) | Deferred: every second entry point is over a budget the owner set (card actions 3, header actions 4) |

---

## critique-affordance

### Clickability Signals: minor issue

- **Observation.**
  - Card and header actions are 44px icon buttons with counts in DM Mono.
  - The comment actions are text in --text2, and the Delete confirmation's primary reads "Delete comment".
  - On `/admin`, the report's summary ("Menu costing sheet with live supplier prices") is a link drawn exactly like the body text, in --text with no underline.
  - In the add-to-collection dialog, the collection rows are a name and a count and nothing else.
  - The dialog's "Create and add" is an outline button. While its field is empty it is disabled, and on the Exhibition panel its --line border is barely there, so it reads as a label.
- **Problem.**
  - The report's link has no cue at rest. An admin has to guess that the title opens the build it is about (m4).
  - The collection rows give no sign that choosing one adds the build, and "Create and add" looks like text until something is typed (m5). This is the ghost button in a low-contrast context the skill names.
- **Fix.**
  - m4: the queue's summary link takes the text-link treatment the rest of the app gives links.
  - m5: each row says what choosing it does (a trailing "Add"). "Create and add" keeps a visible edge while disabled.

  Both deferred as minor.

### State Visibility: pass

- **Observation.**
  - Engagement actions: outline in --text2 at rest, filled --action when liked or saved (STATES.md rows 7 and 8).
  - Unread notifications carry the --action edge BG-P26 gave them.
  - The picker's highlighted row lifts to --recess.
  - "Send report" is disabled until a reason is chosen, and "Post" until there is text.
  - Loading is skeleton rows in every new list: comments, library, collections, notifications, the picker. Error states say "You don't have access to this." or "Something went wrong." with "Try again" (row 21), the picker's included since RC-P20.
  - Focus: the theme's one ring, amber (row 9, escalated in BG-P30).
- **Problem.** None new.
- **Fix.** None.

### CTA Clarity: minor issue

- **Observation.**
  - Each dialog has one filled button: "Send report" and "Delete comment". The add-to-collection dialog has none, because choosing a row is the act.
  - At 768 and wider the build page's only filled element is "Rebuild this".
  - At 390 the phone's bar adds its filled "New build", so the build page, top and comments, has two (the probes: `["Rebuild this", "New build"]`).
- **Problem.** On the phone, two filled controls compete in one layer (m1). It is the pattern phase 2 recorded on Home (m2) and phase 3 carried (m7). The phase did not add either control.
- **Fix.** Decide per view which one yields on the phone: the bar's New build, or the page's primary. Deferred as minor, with phase 3's m7.

### Action Discoverability: major issue (both deferred)

- **Observation.**
  - Comment actions are always visible, never hover-only: Reply and Report for others', Edit and Delete for the reader's own. Delete is last, 16px along (row 16).
  - Report sits in the credit line under the title.
  - The picker opens from "@" in the message box as well as from its button.
  - The only way into the add-to-collection dialog is the toast that follows a Save (M3). The Library's Saved tab, an open collection (Rename, Make public, Delete) and the build page offer no other way.
  - At 390, the message box covers the composer's "Share a build" and Send (M2).
- **Problem.**
  - M3: every build saved before collections held builds, and every save whose toast went by, can reach a collection only by being unsaved and saved again. The collection tab is about something the reader cannot put in it.
  - M2: on a phone, the controls to share a build or send a message cannot be pressed. "@" and Enter still work, which is how the spec reaches them.
- **Fix.**
  - M3 needs the owner. An "Add to a collection" action on the Saved tab's cards is a fourth card action, over the budget of three. One in the header is a fifth, over four. A third option is an "Add saved builds" action inside an open collection, which is a new state for STATES.md.
  - M2: one pane at a time below 768 (the list, or the thread). A structural change to Messages.tsx, which CONTRACT §2.2 reserves for the owner.

---

## critique-visual-hierarchy

### Entry Point: minor issue

- **Observation.**
  - `/b2/:slug` opens on its headline.
  - `/messages/<thread>` opens on the other person's name.
  - `/library` and `/notifications` open on a filled "Back" at 768 and wider (phase 2's m15) and never name themselves. On the phone, the top bar over `/library` says "buildgallery", and over `/notifications` "Alerts" (phase 2's m5).
- **Problem.** A reader who arrives at the Library or the notifications from the drawer or a link has only the tab labels ("Saved", "Collections") or "Mark all as read" to tell them where they are (m7).
- **Fix.** Give ShellHeader the page's name on both (`title="Library"`, `title="Notifications"`). Deferred as minor.

### Eye Flow: major issue → minor issue after CRITIQUE-9

- **Observation.**
  - Before CRITIQUE-9, `/library?tab=collections` put 190 to 470px of nothing between the tabs and the list (M1).
  - At 390, arriving at `/b2/:slug#comments` scrolls the section to the top of the scroll area. Its "Comments" heading lands under the 56px top bar, because the section's scroll margin is 24.
- **Problem.**
  - M1: the eye leaves the tabs, crosses an empty band and meets "New collection" mid-screen, so the tab and what it opened read as two things.
  - The #comments landing hides its own heading on the phone (m2). The composer below it is in view and focused.
- **Fix.**
  - M1, fixed: one root element for the Library page, so the frame's grow rule no longer shares the column's slack with the header. After it, the gap measures under 64 at both projects (library-builds.spec.ts).
  - m2: the section's scroll margin counts the phone's top bar. Deferred.

### Weight: pass

- **Observation.**
  - Comments: the author's name at 16/600, the body at 16/400, the time in DM Mono 12.
  - Notification rows: the actor at 16/600, then the message at 16, the build's title in --text2 and the time in DM Mono 12.
  - Build cards in a message keep the card's Bodoni title over the plaque.
  - The dialogs' titles are 18/600 over 16/400 descriptions.
- **Problem.** None.
- **Fix.** None.

### Emphasis: minor issue

- **Observation.** One emphasis zone per view at 768 and wider. At 390 the build page has two (m1, above). The filled heart and bookmark on liked and saved builds share the primary's hue (row 8); they are icons, not surfaces, and mark state.
- **Problem.** m1 only.
- **Fix.** As CTA Clarity.

---

## critique-information-density

(Not installed; phase 3's four dimensions.)

### Cognitive Load: pass

- **Observation.** Each surface asks for one kind of decision:
  - a card: like, comment or save;
  - a comment: reply or report;
  - the report dialog: one of five reasons;
  - the collection dialog: one collection, or a new one;
  - the picker: one build;
  - the notifications: none, only reading;
  - the Reports tab: hide or dismiss.
- **Problem.** None.
- **Fix.** None.

### Content Priority: major issue (deferred)

- **Observation.**
  - `/messages/<thread>`: at 390 the thread gets about 150px (M2). At 768 it gets about 250px, and the message box about 60 ("M…" is all of its placeholder that shows). At 1440 the page stays in the standard column with the right of the frame empty.
  - `/admin` at 390: six stat tiles, one of them "Total ratings" (a §13 word; the tiles predate the phase), stand above the Reports tab. The first report's Hide and Dismiss start under the fold.
- **Problem.**
  - M2: on a phone the conversation, the shared build and the composer are what the screen is about, and they get a fifth of its width.
  - The admin's queue is behind a dashboard on the phone (m12).
- **Fix.**
  - M2: as above, deferred.
  - m12: the Reports tab first on the phone, tiles after. Deferred.

### Scanning Pattern: pass

- **Observation.**
  - Notifications fall under Today, Yesterday and Earlier.
  - Comments run oldest first, with replies indented on a hairline.
  - The collections list runs most recently used first, with "3 builds · public · used 3 hours ago" in DM Mono.
  - The picker runs newest first, each row saying "Yours" or "Saved".
- **Problem.** None.
- **Fix.** None.

### Progressive Disclosure: pass

- **Observation.**
  - Comments page by 50 with "Show more comments".
  - The picker shows 20 at most.
  - The collection dialog shows seven before it scrolls.
  - A notification names its build and leads to it.
- **Problem.** None.
- **Fix.** None.

---

## von-restorff-effect: filled elements in the topmost layer

Counted by the spec in every screenshot: interactive elements whose background is the primary fill (--action), inside the open dialog when one is open and on the page otherwise. Radios and inputs are fields, not emphasis, and are not counted. The same counts in both rooms.

| View | 390 | 768 | 1024 | 1440 |
|---|---|---|---|---|
| /gallery | 1 (New build, the bar) | 0 | 0 | 0 |
| /b2/rc-build-7 | **2** (Rebuild this, New build) | 1 (Rebuild this) | 1 | 1 |
| /b2/rc-build-7#comments | **2** (Rebuild this, New build) | 1 (Rebuild this) | 1 | 1 |
| /library | 1 (New build) | 0 | 0 | 0 |
| /library?tab=collections | 1 (New build) | 0 | 0 | 0 |
| /notifications | 1 (New build) | 0 | 0 | 0 |
| /messages/<thread> | 1 (New build) | 0 | 0 | 0 |
| /admin (Reports) | 1 (New build) | 0 | 0 | 0 |
| Report dialog (its layer) | 1 (Send report, disabled until a reason) | 1 | 1 | 1 |
| Delete confirmation (its layer) | 1 (Delete comment) | 1 | 1 | 1 |
| Add-to-collection dialog (its layer) | 0 | 0 | 0 | 0 |

**Views with more than one filled element in the topmost layer: 2 of 11** (the build page and its comments, at 390 only: 4 of the 88 screenshots). The RC-P17 prompt expected "I ran this" to stay the build page's only filled button. On the page as built, the one filled button is "Rebuild this" (ForkControl, since BG-P21), and "I ran this and it worked" is secondary.

**Isolation inflation.** The phase added no filled surface to any page. Its emphasis is:
- the --action fill on liked and saved icons (row 8), one per engaged card;
- the --action edge on unread notifications (BG-P26's);
- one filled button per dialog.

The add-to-collection dialog has none, because its choices are the act. Through the dialogs' glass panels the page's own "Rebuild this" shows as a salmon blur at 768 to 1440 (see figure-ground, m6). It is not an element of the dialog's layer, and the count leaves it out.

---

## law-of-figure-ground: the three dialogs, both rooms

All three are the existing Dialog (STATES.md row 17): the --r-panel glass panel at overlay elevation, over its scrim.

| Dialog | Room | Scrim | Covers the screen | Bottom-left corner hits | Panel as figure |
|---|---|---|---|---|---|
| Report | Exhibition | --porthole at 62% (rgb 78 86 94 / .62) | yes, at every width | the scrim | yes: --text title and radios on the light glass, the page greyed behind |
| Report | Dusk | --porthole at 62% (rgb 20 16 32 / .62) | yes | the scrim | yes: the panel's --glass-hi top hairline and shadow lift it off the darkened page |
| Delete confirmation | Exhibition | as above | yes | the scrim | yes |
| Delete confirmation | Dusk | as above | yes | the scrim | yes |
| Add to a collection | Exhibition | as above | yes | the scrim | yes; "Create and add" is faint (m5) |
| Add to a collection | Dusk | as above | yes | the scrim | yes |

**Dialogs without a visible scrim in either theme: 0.** At 390 the scrim covers the phone's top bar and bottom bar too (the RC-P17b spec asserts the corner). One ground shows through the figure: the panel is glass. On the report and add-to-collection dialogs the page's headline and its salmon "Rebuild this" read as a blur inside the panel, beside the radios and the collection rows (m6). The figure still wins on contrast. The fix belongs to dialog.tsx's panel (a more opaque panel, or no blur behind a dialog), which is outside the phase's files. Deferred.

---

## better-ui

**Surfaces: one component, one surface**

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| MEDIUM (fixed) | src/components/messages/ThreadReferencePicker.tsx (the empty state's two actions) | Button's outline variant, which paints glass | STATES.md row 2's transparent secondary (CRITIQUE-10) | A secondary is transparent; a glass button inside the picker is a second surface (CONTRACT §2.7) |
| MEDIUM | src/components/ui/dialog.tsx (dialogPanelStyle) | The glass panel lets the page's headline and filled button show through as a blur | A panel that does not carry the page's colour into the dialog | Figure-ground (m6); outside the phase's files |

**Match icon stroke to text weight**

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| LOW | src/components/messages/ThreadReferencePicker.tsx:183, :197 | The Close and Search icons at lucide's 2px beside 400-weight text | 1.5px, as the engagement row draws | One stroke weight per surface (m8) |

**Subtle exit animations**

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| LOW | src/components/ui/dialog.tsx:44, :62 (tailwindcss-animate) | The dialogs enter and leave on linear easing, 150ms, opacity and transform | ease-out in both directions | Linear easing runs at full speed from its first frame to its last; replayed at 10% the zoom starts and stops at that speed (m9); outside the phase's files |

**Motion restraint**

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| LOW | src/components/ui/sonner.tsx (the "Saved." toast) | 400ms opacity and transform, ease | 200ms or less (the theme's UI feedback limit) | The toast is the one path into a collection (m10) |

**Scale on press**

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| LOW | src/components/social/EngagementRow.tsx:310 | Opacity 0.72 while pressed | scale(0.96) | Tactile feedback on a high-frequency control (m11) |

**Transition only what changes**

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| — | The phase's controls: EngagementRow, the comment actions, the credit line's Report, the picker, the collection rows | Named properties only: color, background-color, border-color, opacity, transform | No change | No `transition: all` anywhere in RC-P15 to RC-P20's files: passes |

**Verification.**
- With a browser, every state was walked: rest, hover, focus, pressed or selected, loading, empty, error and disabled on the phase's controls. Hover and focus were read from the code and the screenshots.
- Motion was replayed at 10% speed in both rooms (see Method). Every animation on the phase's surfaces moves opacity, transform or a colour, and nothing animates layout.
- Under reduced motion, index.css:977 sets every animation and transition to 0.01ms. The picker's entrance also sets its own duration to 0 (RC-P20).
- Not verified: touch hover, 200% zoom, an RTL build.

**Approve.** No HIGH. The MEDIUM and LOW rows outside CRITIQUE-10 stay as work to do.

---

## hicks-law: Choice Audit

Decision points in the order a reader meets them.

| Decision point | n | Criterion | Default | Depth | Scent | Budget | Competing emphasis | Rating |
|---|---|---|---|---|---|---|---|---|
| Card actions | 3: Like, Comment, Save | The card's content order: evidence first, then actions, the same on every card | None | 0 | Counts beside Like and Comment; filled icon when active | ≤ 3 (engagement.budget.test.tsx) | None: icons in --text2 or --action, no fill behind | pass |
| Header actions (the engagement row) | 4: Like, Comment, Save, Share, beside the one primary "Rebuild this" | The same order as the card, Share last | None | 0 | Counts; Share copies a link and says so | ≤ 4 beside the primary (engagement.budget.test.tsx) | Rebuild this only (two on the phone, m1) | pass |
| Comment actions | 2: Reply and Report on others' comments; Edit and Delete on the reader's own | Frequency; the destructive act last and 16px along (row 16) | None | 0 | Plain labels; Delete confirms, naming the act | ≤ 7 for a menu; these are two | None | pass |
| Report dialog | 5 reasons: Spam, Doesn't work, Harmful, Not theirs, Something else; then an optional note | Likelihood, "Something else" last | None: nothing pre-selected, so a report is chosen, not defaulted | 1 | Each reason is two words; the note is optional | ≤ 5 radios | One filled: Send report, disabled until a reason | pass |
| Collection dialog | The reader's collections, 7 visible before the list scrolls, then "New collection" | Recency of the reader's use ("The one you used last is first") | The last used is first | 1 (from the toast) | Each row's build count | ≤ 7 visible | None filled; choosing a row is the act | minor (the rows carry no cue, m5; one path in, M3) |

- **Card and header actions.** Three and four, in one order on every surface. The reproduction count is evidence, never a button. **pass.**
- **Comment actions.** Two per comment, and the destructive one confirmed and last. **pass.**
- **Report dialog.** Five reasons, none pre-selected on purpose: a report is a rare, deliberate decision, and the skill does not optimise those for speed. **pass.**
- **Collection dialog.** Ordered by the reader's own recency, capped at seven visible. **minor**: nothing says that choosing a row adds the build (m5), and the dialog is reached only from a toast (M3).

**Noted outside the decision points.** The comment composer's button says "Post", and the solution notification says "posted a solution to your bounty". §13 forbids "post", but the RC-P17 and RC-P19 prompts named both, so the words are the owner's to change (m3).

---

## buildgallery-theme: Before you call it done

The phase's surfaces:
- the engagement row on cards and the build header;
- the credit line's Report and the hidden banner;
- comments;
- the report, delete and add-to-collection dialogs and the Reports tab;
- the Library's Saved and Collections tabs;
- the notifications list;
- the build card and picker in messages.

1. **Both themes checked.** PASS. 88 screenshots in both rooms, before and after the fixes.
2. **Every colour a semantic token.** PASS. The phase's files use `t.*` only, and src/lib/theme/compliance.test.ts passes.
3. **Every new pairing measured; no amber text on Exhibition.** PASS.
   - The phase's pairings are STATES.md's measured ones (its notes; contrast.test.ts): --text and --text2 on --bg and --recess, --action as an icon on --bg.
   - Amber appears only as the plaque's lamp and the focus ring.
4. **Radius from the scale.** PASS. Chips at --r-chip, rows and buttons at --r-control, cards at --r-card, dialogs and the picker at --r-panel. Avatars are circles.
5. **Glass.** PASS for the phase's own surfaces: the picker is --bg on a hairline, and the build card in a message is --bg. The dialogs' glass is the existing Dialog's (m6).
6. **Display face ≥ 20px; body ≥ 400 under 18px.** PASS. Bodoni only in card titles and headlines; everything else Figtree or DM Mono.
7. **Reproduction and freshness together under the title.** PASS. On the gallery's and the Library's cards, and on the build card in a message (the Plaque at card size, unchanged).
8. **A gap keeps its category chip and reads as an invitation.** PASS where a gap shows: the Library's "Support reply suggester" card keeps its dashed edge and "1 part unsolved · £150". n/a on the build card in a message, which shows no gap.
9. **Motion gated; nothing animates layout.** PASS. Replayed at 10%: opacity, transform and colours only. Reduced motion stops all of it (index.css:977).
10. **No horizontal overflow at 390 / 768 / 1400.** PASS for the document at every width in both rooms (RC-P20 measured 0 at 390 and 1440). At 390 the messages thread clips inside its own pane (M2), which is overflow inside a page, not of it.
11. **States designed.** PASS. Every new list has populated, loading (row 20), empty (row 19) and error (row 21) states. Hover and focus on every control, pressed on the engagement actions, selected on the picker's rows. Disabled on Send report, Post, Create and add, and Hide while working.

---

## Re-rated after the fixes

The screenshots were re-taken after CRITIQUE-9 and CRITIQUE-10: 88 files, the same eleven views, four widths and two rooms. The fixture now also gives the fixture build its cost and speed. Before, the rows lacked those columns and the header printed "£NaN a month", which a real row, where the column is null, cannot.

| Finding | Was | Now | Evidence |
|---|---|---|---|
| M1 the Library's empty band | major (Eye Flow) | pass | library-collections-{390,768,1024,1440}-{exhibition,dusk}.png: "New collection" and the list start under the tabs; library-builds.spec.ts reads the gap (309 and 210 before, under 64 now) |
| The picker's empty-state actions (better-ui MEDIUM) | glass secondary | transparent secondary | ThreadReferencePicker.test.tsx reads each action's background |
| M2 the messages thread at 390 | major (Action Discoverability; Content Priority) | major, deferred | messages-390-*.png unchanged |
| M3 one path into a collection | major (Action Discoverability) | major, deferred | unchanged |
