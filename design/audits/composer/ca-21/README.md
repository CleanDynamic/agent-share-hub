# CA-21 · moving on a skeleton grid

Made against `/dev/kit/pages/sandbox?build=ca21` (`src/dev/fixtures/ca21.ts`, shown by `src/pages/dev/MovingDemo.tsx`), with
`node scripts/ca21-rest.mjs <before|after>`. The fixture: two parts; Part 1 holds Session 1 (Prompts 1 to 3 and a team of two
agents) and Session 2 (an agent, a tool, a decision, a manual step, a file); Part 2 is empty.

## P0 · what Move up and Move down did before (read from the code at `4fd3671`)

| What | Before |
|---|---|
| Prompt (top level) | `useComposePrompts.move` swapped it with the next **prompt in the whole build** (`movePrompt`), skipping every other kind and ignoring sessions. A prompt at the edge of its session swapped into the next session's prompt without changing its own session. The menu greyed it by its place among prompts. |
| Manual step, code, check | Swapped with the step next to it (`moveStep`), whatever that was, in any session. |
| Agent, team, tool, decision, system prompt, dataset, repo, file | Returned without doing anything. |
| A tile nested in a team or a message | Returned without doing anything (it is not in `promptNodes`). |
| Session | `useSessionEdits.onMove` swapped it with the next session; **returned without a word** when that session was in another part. |
| Part | `onPartMove` swapped it with its neighbour (worked). |
| Greyed out | by a tile's number among prompts, or among steps, not by its place in the build. |
| While dragging | the held tile shrank to a name chip, every session folded to its head while a session was held (`WhileDragging`), and a 2px `NestGap` line was the only mark of where it lands. |

Baseline suite on this branch before any change: 57 of 7562 tests fail in 11 files (`AppShell`, `noRail`, `siteFrame`,
`flat-shell.wide`, `BuildPage`, `onePrompt.composer.snapshot`, `retiredSurfaces`, `compliance`, `motion`, `ns-classes`,
`rcStates`). None touches the build page's moving code.

`before/`: the build page at rest, 1440 and 390, Dusk and Noon.

## P8 · screens and checks

Made with `node scripts/ca21-rest.mjs <before|after>`, `node scripts/ca21-screens.mjs` and `node scripts/ca21-measure.mjs` against
`/dev/kit/pages/sandbox?build=ca21` (a running `npx vite`; `PW_CHROMIUM_PATH` points at a Chromium). Dusk and Noon at 1440, and 390
where it says so.

- `before/` and `after/`: the build page at rest, 1440 and 390, both themes. `python3 scripts/ca21-diff.py` compares them: 0.0018%
  (60 pixels) of the 1440 pages differ, 0% of the phone pages. The limit is 0.1%.
- `tile-picked-up-*`: Prompt 2 held, still over its start: a plain socket, no words. `-390` has no rail or numbers.
- `tile-over-session-2-*`: over Session 2, "Lands here · Session 2 · 2 of 6", the numbers sliding with it. `-390` as above.
- `tile-just-dropped-*`: 120 ms after the drop, the copy settling, the line "Moved Prompt 2 to Session 2."
- `session-over-empty-part-*`: Session 2 held whole over the empty Part 2: its place grows to its full height, "Lands here · Part 2 · 1 of 1", the counts "1 session" and "1 session".
- `session-dropped-in-part-2-*`: dropped there.
- `sending-together-*`: held 750 ms in the middle third of Prompt 3: it is the target and the place has left.
- `adding-from-sources-*` and `adding-from-menu-*`: a three-prompt session added to Part 2: `lane-open` (empty sockets, numbered),
  `head-landed`, `prompt-falling`, `finished` (the line "Added Session 3 with 3 prompts.").

`ca21-measure.mjs` during a tile drag and a session drag, in both themes: no tile or other component not being moved changes
height; the two sessions (tile drag) or the two parts (session drag) involved change, as they must; the held copy is exactly the
size of its original (603 by 124 and 618 by 855) and its place is that size plus 4 on every side.

Checks on this branch and on `main` give the same results: `npm run audit:contrast` fails on 62 pairs (a focus ring in Noon among
them) and `npm run audit:design -- --grep composer` fails `refined/dusk/composer-map`, `refined/noon/composer-map` and
`refined/noon/composer-card`; none is in what this prompt touches.
