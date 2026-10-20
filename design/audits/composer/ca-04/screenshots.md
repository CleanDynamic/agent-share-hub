# CA-04 P7 · Shapes and screens

Taken with Playwright from the dev pages, in Dusk and Noon at 1280 and 390 wide, from the two CA-04 shapes in
`src/dev/fixtures/shapes.ts` (`/dev/kit/pages/sandbox?build=shape-one-sitting`, `&select=…`, and
`/dev/kit/pages/build-steps?build=one-sitting|runs-on-github`). The dev boards are laid out at 1440, so a full-page
shot at 1280 is 1440 wide. A full-page shot draws the site's fixed header and the phone's dock where the page was
scrolled to; that is the capture, not the page.

| Screenshot | What it shows | Changed after looking |
| --- | --- | --- |
| `list-sessions-{dusk,noon}-{1280,390}` | The List with two sessions: Session 1 · Claude with order-form.tsx sent with prompt 2 and menu.pdf sent with the code (no numbers, their eyebrows saying what they are sent with), Session 2 · Claude Code with Setup 4 at the end of its head and the Worked until line, its `--evidence` dot, then the team. The grip at each tile's left; Send with the step above and Make it its own step. | none |
| `list-drag-over-tile-{dusk,noon}-1280` | prompt 3 held over prompt 1: prompt 1 takes the selected fill and a `--text2` edge; the chip under the pointer names what is held. | The first shots lost the drag: a full-page capture resizes the page mid-drag. These are taken at the viewport. |
| `list-drag-over-gap-{dusk,noon}-1280` | prompt 3 held over the gap between prompts 1 and 2: the 2px `--text2` line where it would land as its own step. | as above |
| `details-session-setup-{dusk,noon}-{1280,390}` | Session Details for Session 2: Tool and Date, then Setup (Instructions CLAUDE.md, Skill order-forms with its description, MCP server github, Rule npm test, each with Don't share it), Add to setup, then Worked until with its condition, At most 40 turns and Was it reached? on Reached in 12. | none |
| `details-tool-connection-{dusk,noon}-{1280,390}` | Tool Details for github: How it was connected on MCP server, then At a web address and On my computer, and Tools it used as chips with counts (get_file_contents 9, create_pull_request 2). | Where it ran was a segmented control that ran past the 280 Details column; it is two choice rows under MCP server now. The dev page had no handler, so the rows did not show at first. |
| `build-setup-open-{dusk,noon}-{1280,390}` | The build page: New chat in Claude, the code and the file indented 36 under prompt 2, New chat in Claude Code with Setup open (rows indented 28 on a hairline), the Worked until line, then the team. | The tiles' label was the upper-case eyebrow; it is a quiet sentence-case line now (the only upper case is the Details eyebrow). |
| `build-need-mcp-{dusk,noon}-{1280,390}` | What you need: github's row with MCP server · at a web address · sign in with your github account, and Before you connect with its `--cat-breakage` dot and the day it was used. | Before you connect was an eyebrow; it is 12.5/500 now, for the same reason. |
| `download-menu-{dusk,noon}-{1280,390}` | Download as a menu: The build, and The setup, as a folder. | none |
| `build-runs-on-github-{dusk,noon}-{1280,390}` | The GitHub session: New chat in Claude Code, Runs when a pull request is opened, Setup (the workflow), and the prompt read out of the workflow. | none |

Not taken: a setup suggestion from an imported chat. Part 3 could not read tool records (see the report), so no
suggestion is ever made, and there is nothing to draw.

## Audits against Part 0

`DESIGN_MAX_DIFF=0 npm run audit:design -- --grep "composer|build-list"`, pixels different. Part 0 ran the default
threshold (all six composer boards passed); the before column is CA-03's after, the same commit, 4715b6d.

| Board | Before | After |
| --- | --- | --- |
| refined/dusk/composer-list | 2.090% | 2.090% |
| refined/dusk/composer-map | 1.603% | 1.604% |
| refined/dusk/composer-card | 0.896% | 0.912% |
| refined/noon/composer-list | 2.174% | 2.174% |
| refined/noon/composer-map | 1.612% | 1.612% |
| refined/noon/composer-card | 2.230% | 2.222% |
| refined/dusk/build-list | 2.180% | 2.180% |
| refined/noon/build-list | 2.182% | 2.182% |

Every board is within 0.02 of a point of where it was: nothing new shows until a build uses it. `npm run
audit:contrast`: 52 unaccepted failures at Part 0, 50 at the end.
