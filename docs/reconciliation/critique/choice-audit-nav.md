# Choice audit — the navigation (RC-P05)

⟦hicks-law › Choice Audit⟧ on the three navigation surfaces as RC-P05 leaves them, read from the rendered frame (signed in and signed out; 390, 768, 1024 and 1440 wide; Noon and Dusk) and from `src/components/shell/navBudget.test.tsx`, which counts them in the DOM. Rows are in the order a reader meets them.

| Decision point | n | Criterion | Default | Depth | Scent | Budget | Competing emphasis | Rating |
|---|---|---|---|---|---|---|---|---|
| Desktop nav, signed in | 9, in 4 groups of 4 / 2 / 2 / 1 | Intent: Browse (Home, Gallery, Bounties, Library) · Make (New build, Drafts) · Talk (Messages, Notifications) · You (Profile) | None needed: the row for the current route carries the rail's one --action mark (2px edge, 8% wash) | 1 | Nouns from the product vocabulary with an icon each; unread counts on Drafts, Messages, Notifications; a dot on Library for unseen saves | ≤ 9 destinations, ≤ 4 groups, one level: 9, 4, 1 | The active row's --action edge is the rail's only accent; the progress chip's lamp is light, not an action | pass |
| Desktop nav, signed out | 4, in 2 groups (Home, Gallery, Bounties · New build) | Intent, the same order as signed in | As above | 1 | As above | ≤ 4: 4 | One filled button in the rail, "Join free", below the nav | pass |
| Phone bottom bar | 5 | Intent, in the budget's order: Home, Gallery, New build, Bounties, Profile | The current route's item in --action text and icon; Profile lights for every route that lives in the drawer | 1 | Label under every icon; one unread dot on Profile for messages and notifications together | Exactly 5: 5 | New build is the bar's single filled element | pass |
| Phone profile drawer | 6 | One group, the reader's own things, in the desktop nav's order for the four they share (Library, Drafts, Messages, Notifications), then Analytics and About | The row for the current route takes the --action wash and label | 2 (bar → Profile → drawer): the split rule, a second level holding one group the reader already understands | Labels, a chevron on each row; the reader's name, handle and follow counts above | ≤ 6: 6 | The progress chip above the list (a lit fill with --on-lit on it) and Sign out, last and separated, in --cat-breakage | pass |

## Observation → Problem → Fix

- **Desktop nav.** Nine nouns, four groups carried by the existing dividers and nothing else ⟦law-of-proximity⟧; the old Discover (a second route to the Gallery's job) and the creator-only Analytics row are gone ⟦hicks-law › Remedies 1 Remove⟧. No problem found. pass.
- **Signed out.** Four rows, the three homes and the one way to make something. No problem found. pass.
- **Phone bar.** Messages left the bar for the drawer, so the bar holds the three homes, New build and the reader. The unread dot moved to Profile, which is where messages and notifications now live. No problem found. pass.
- **Drawer.** Six rows, where it held nine: Home, Discover and Upload were second routes to things the bar already offers. No problem found. pass.

## Noted outside the three decision points

These sit in code RC-P05 does not change; RC-P09c judges them.

- The phone top bar's avatar opens the same drawer as the bar's Profile item: two routes to one destination ⟦hicks-law › Common Failure Patterns⟧. MobileTopBar.tsx.
- The drawer's Sign out is painted --cat-breakage, a category hue the theme forbids borrowing ⟦buildgallery-theme › Part-category hues⟧; STATES.md row 16 says position, label and confirmation carry a destructive meaning, not the red. ProfileDrawer.tsx.
- The desktop rail's rows are `div`s with a click handler: no role, no accessible name, no tab stop, so a keyboard cannot reach the navigation ⟦responsive-design › Input Method Adaptation: Keyboard⟧. FlatShell.tsx, which RC-P05 may not change.
- On /gallery the phone top bar's title reads "Discover", the word this prompt removed everywhere else. MobileTopBar.tsx.
