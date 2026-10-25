# CA-26 · Part 0 · the audit

Taken at `d291360` (main, after CA-25), on the build page as the dev page draws it (`/dev/kit/pages/sandbox?build=ca22`, a prompt
selected, 1440 wide, Dusk and Noon, and 390 wide), by a real Tab walk and a script that reads every interactive element. The
real composer needs a signed-in session; its parts are the same components, and the jsdom suites (`ca26.p1` to `ca26.p5`) mount
`SandboxPage` itself behind a faked network.

## 1. Every interactive element on the build page

"Before" is `d291360`. "After" is the end of CA-26. A name that is a pattern in the prompt's table is shown as the pattern.

| Where | Element | Role | Accessible name | Keyboard (before → after) | Where focus goes after it acts |
|---|---|---|---|---|---|
| Frame | Skip link | link | `Skip to content` → `Skip to build` on the composer | first stop → first stop | the build list's current item (new) |
| Frame | Site header (home, Home, Gallery, Bounties, Library, Drafts, search, New build, Activity, Theme, Account) | link / button | named | reachable → reachable | their own |
| Title row | Title, status line | heading, text | the title | — | — |
| Title row | List, Map | button (tab) | `List`, `Map` | reachable → reachable | stays |
| Title row | Undo, Redo | button | `Undo` / `Undo: Removed Prompt 2`, `Redo` / `Redo: …` | reachable → reachable | stays; greyed ones keep the name and point at `Nothing to undo` (`aria-describedby`) |
| Title row | Build options (…) | button, menu | `Build options` | reachable → reachable | the button |
| Title row | Card, Preview, Publish | button / link | named | reachable → reachable | the window closes onto the button |
| Sources | Open session N, the session's row, Add session, Drop sessions or files, files and `{file} options` | button | named | reachable → reachable | their own |
| Post | the post editor, its toolbar | textbox, toolbar | named | reachable → reachable | — |
| Build | Add, View menus | button, menu | `Add`, `View` | reachable → reachable | the button |
| Build | **Tiles** (prompt, agent, manual, code, check, tool, decision, system prompt, dataset, repo, file, result) | group / button | `Prompt 2: untitled` | **one Tab stop each (58 on the page) → the list is one** | stays |
| Build | grip | button | `Move prompt 2` → `Move Prompt 2` (and `Move Prompt sent with prompt 2` for a nested tile, which was `Move prompt`) | reachable in each tile → arrows, then Right | the grip |
| Build | rename pencil | button | `Rename prompt 2` | reachable → reachable by Right from the tile | the field |
| Build | tile `…` | button, menu | `Prompt 2 options` | reachable → reachable by Right from the tile | the button; **the item now in its place when the menu removed the tile** (was: nothing) |
| Build | colour | button | `Colour for Prompt 2: #8FBFB8` → `Prompt 2 colour` | reachable → by Right | the picker, then the button |
| Build | **Session head** | group | `Session 1 · Claude` | one stop each → in the list's one stop | stays |
| Build | session grip, `…`, fold arrow, title field | button | `Move Session 1`, `Session 1 options`, `Collapse Session 1` / `Expand Session 1`, the title | reachable → by Right | the button |
| Build | **Part head** | group | `Part 1` | one stop each → in the list's one stop | stays |
| Build | part grip, `…`, fold arrow, name field | button | `Move Part 1`, `Part 1 options`, `Collapse Part 1` / `Expand Part 1` | reachable → by Right | the button |
| Build | `+ Add Tile`, `Add a part`, `Add session` rows | button | named | reachable → in the list's one stop | the row |
| Build | Add a prompt box | textbox + buttons | named | reachable → reachable | the field |
| Selection bar | Move to…, Duplicate, Group, Ungroup, Remove | button | named | reachable → reachable | the button |
| Selection bar | Clear selection | button | `Clear selection` | reachable → reachable | **the build list's current item** (was: nothing, the bar falls away) |
| Details | the panel, `Copy`, links to tiles | region, button, link | named | reachable → reachable | — |
| Details (narrow) | overlay, `Close details` | region, button | `Close details` | reachable → reachable | the element that opened it, or the item in its place |
| Map | the map, its nodes, its panel | named | named | reachable → reachable | — |

### The Tab walk

| | Before | After |
|---|---|---|
| Tab stops on the page | 95 | 43 |
| of them in the Build column | 58 | 6 (the list, Add, and the controls that are not items) |
| first stop | Skip to content | Skip to build |
| order | header, Sources, Build, Details | header, Sources, post, Build, Details |

## 2. Windows and menus

| Window | Built by | First focus before → after | Returns focus before → after |
|---|---|---|---|
| Add › Tool, Dataset, Repository, System prompt, Result, Check, Code, Decision, Manual step, Agent (and their Edit forms), Classification Card, Colours, Recently removed, Group, Session | `ModalShell` | the Close button (the first stop) → its first field | the opener, unless it was a menu item (gone) or removed → the opener's button, or the item in its place |
| Clear build, Shortcuts, Convert, remove windows | `SmallWindow` | the first button → its primary action | as above |
| Clash, Leave, save windows | `RecipeWindow` | the primary action → the primary action | as above (Clash has no way out but its two answers: Escape does not close it, by design) |
| Publish checklist, Publish confirm, Unpublish | `PublishFrame` | the Close button → its primary action | as above; when an action's target takes focus the window leaves it there |
| Keep which link, Confirm | `referencePieces` | the first button → its primary action | as above |
| Every phone sheet | `BottomSheet` (two) | the Close button → its first field or primary action | as above |
| Details overlay | `DetailsOverlay` | — | the opener, or the item in its place |

Menus (Radix): every menu in the composer is a `MenuContent`; it gives focus back to its button, and, when that button is gone
because the item removed it, to the item now in its place.

Escape closes only the top window or menu (Radix's layers); `ca26.p2` proves it for a menu in a window and a window over a window.

## 3. The live regions

The prompt says four, in `DetailsPanel.tsx`, `AgentSetupFields.tsx`, `BuildList.tsx` and `SessionHead.tsx`. On disk those four files
hold **seven** `aria-live` attributes:

| File | Region | Said |
|---|---|---|
| `DetailsPanel.tsx` | a hidden span | `Copied`, `Couldn't copy` |
| `AgentSetupFields.tsx` | `agent-model-cleared` (two) | a model cleared by a new harness |
| `BuildList.tsx` | `model-cleared` | a model cleared by a new tool |
| `BuildList.tsx` | `nest-said` | CA-21's drag and move lines |
| `BuildList.tsx` | `sessions-said` | the session lines (added, moved, merged) |
| `SessionHead.tsx` | the title's count | `84/100` |

There were also `role="status"` regions (the reference notice, the strips, the footers of windows). The notice's was the one that
duplicated what the announcer now says, and is removed; the others describe state that is on screen and are left.

## 4. axe

axe-core 4.10.2 (a copy on the side; the repository does not depend on it), the build page, Dusk and Noon, 1440 and 390: **0
violations before, 0 after** (45 rules passed). It found, once, a real one along the way: the skip link's target did not exist
(`skip-link`, `region`), fixed by giving the Build panel the id the link points at.
