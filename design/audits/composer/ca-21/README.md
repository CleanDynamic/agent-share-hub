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
