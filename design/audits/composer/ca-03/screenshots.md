# CA-03 P10 · Check it on screen

Taken with Playwright from the dev pages (`/dev/kit/pages/sandbox`, `/dev/kit/pages/build-steps`) in Dusk and Noon
at 1280 and 390 wide. Each line covers both rooms. The Map is not offered at 390 (the List is the phone's only view),
so the two Map states are taken at 1280 only. The dev boards are laid out at 1440, so a full-page shot at 1280 is
1440 wide.

| Screenshot | What it shows | Changed after looking |
| --- | --- | --- |
| `runs-schedule-{dusk,noon}-{1280,390}` | Details for an agent: How did it run? with More ways open, On a schedule chosen, Weekdays and 07:30. At 390, in the bottom sheet with 44 rows. | The dev page now keeps what you pick in How did it run? (it wrote nothing before, so a choice could not be seen). |
| `list-team-{dusk,noon}-{1280,390}` | CA-02's team in the List: the Lead agent eyebrow, Handed work to, Agent · name over each helper. | none |
| `map-side-by-side-{dusk,noon}-1280` | The sixth shape's team opened on the Map: the lead, then Research, Build and Review in one column under Side by side, fanned out from the lead and fanned in to the code step outside. | none |
| `add-menu-{dusk,noon}-{1280,390}` | The Add menu with Check after Code. | none |
| `check-dialog-{dusk,noon}-{1280,390}` | The check dialog filled in with the Part 9 answers, 14 passed of 14, last run 2026-10-12. | none |
| `list-check-passing-{dusk,noon}-{1280,390}` | The sixth shape in the List, the check selected: Passed 14 of 14 runs · since 12 Oct, `--evidence` dot. | none |
| `list-check-failing-{dusk,noon}-{1280,390}` | The same with one run failed (`&check=failed`): Passed 13 of 14 runs, `--cat-breakage` dot. | Added `&check=failed` to the dev page. |
| `details-remembers-{dusk,noon}-{1280,390}` | Details for the Build agent: the outside-content warning naming Gmail, Tools it can use, What it remembers. | What it remembers grew too late in the 280 Details column (a row per 44 characters); it now counts a row per 32, so the saved text is never cut. Still one row when empty. |
| `build-header-{dusk,noon}-{1280,390}` | The build page header: the title, the summary line (5 prompts) under it, and the reproduction column with the plaque, unchanged. | none |
| `shape6-list-{dusk,noon}-{1280,390}` | The sixth shape in the composer: the status line ends A team of 4 agents · checks its own work · 1 code file. | none |
| `shape6-map-{dusk,noon}-1280` | The sixth shape on the Map, closed: the team, the code step, the check and the result. | The check's text ran into its status in the box foot. The check's text is now one line, and the foot never wraps. |

The 14 `controls/*-after.png` from Part 2 were retaken, because the dialogs' type changed to 13 after Part 2 (Part 5).

## Audits against Part 0

`DESIGN_MAX_DIFF=0 npm run audit:design -- --grep composer`, pixels different:

| Board | Before | After |
| --- | --- | --- |
| refined/dusk/composer-list | 2.083% | 2.090% |
| refined/dusk/composer-map | 1.572% | 1.603% |
| refined/dusk/composer-card | 0.896% | 0.896% |
| refined/noon/composer-list | 2.166% | 2.174% |
| refined/noon/composer-map | 1.586% | 1.612% |
| refined/noon/composer-card | 2.229% | 2.230% |

Every board moved less than 0.05 of a point, which is well inside the 1-point limit. The build boards (Part 8's summary
line) went from 2.145% to 2.180% (dusk build-list) and from 2.146% to 2.182% (noon build-list). The build-map boards
did not change.

`npm run audit:contrast`: 1,739 pairings (1,741 before), 50 unaccepted failures (50 before). These are the same
failures as before, and they include the one focus ring per room on compose and build. Nothing got worse.
