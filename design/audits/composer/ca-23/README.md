# CA-23 screens: saving, offline and two tabs

`node scripts/ca23-screens.mjs` (with `npx vite` running) writes `<state>-<theme>-<width>.png` here, in Dusk and Noon at 1440 and 390,
from `/dev/kit/pages/sandbox?build=ca23&show=<state>` (`src/pages/dev/SavingDemo.tsx`, which writes nothing).

| State | What it shows |
|---|---|
| `status-saving` | `Draft · saving…` (held back 300 ms) |
| `status-saved` | `Draft · saved` |
| `status-saved-min` | `Draft · saved 2 min ago` |
| `status-saved-clock` | `Draft · saved at 14:05` |
| `status-offline`, `status-offline-one` | `Draft · offline · 3 changes pending`, `… · 1 change pending` |
| `status-error` | `Draft · not saved · Retry` (not saved in the danger text colour) |
| `status-published` | `Published · saved` |
| `offline-strip` | `Offline. Changes save when you reconnect.` |
| `other-tab-strip` | `Changed in another tab` and `Show changes` |
| `both-strips` | the two together, 8 apart |
| `reconnected` | the notice `Reconnected. 3 changes saved.`, without Undo |
| `leave` | the window `Changes still saving` |
| `clash-tile`, `clash-fields`, `clash-session`, `clash-post` | `{Name} changed in another tab`: one field, several fields, a session's title, the post |

## At rest

`before/` was taken on the branch's base (`03184fa`, before Part 1) and `after/` at the end, by `node scripts/ca23-rest.mjs <before|after>`
(the `ca21` fixture, nothing pending). In all four (Dusk and Noon, 1440 and 390) the only pixels that differ are the status line's
own words: `saved just now` is now `saved` (243 and 246 pixels, in an 11-pixel-high box at the status line, nothing else).

## Design compare

`npm run audit:design -- --grep composer` fails the same three boards on the base (`refined/dusk/composer-map`, `refined/noon/composer-map`: the
script's click on the map tab times out; `refined/noon/composer-card`: 662,692 pixels on the base, 662,624 here) and passes the other three. With
`DESIGN_MAX_DIFF=0` the differing pixels are fewer here than on the base, because the status line is shorter:

| Board | Base | CA-23 |
|---|---|---|
| refined/dusk/composer-list | 57,095 | 57,033 |
| refined/dusk/composer-card | 14,034 | 14,034 |
| refined/noon/composer-list | 59,122 | 59,058 |

## Contrast

`npm run audit:contrast`: 3,728 pairs, 61 unaccepted failures (the base: 3,727 pairs, 60). All are focus-ring pairs on routes this change does not touch
(dev kit, sign-in, publish, home ...); the sweep does not visit the new states. Those were measured from the tokens instead, all at least 4.5:1:

| Pair | Noon | Dusk |
|---|---|---|
| danger text on surface / frame (`not saved`) | 5.09 / 4.61 | 6.46 / 7.05 |
| text on well (strips, clash panels) | 14.43 | 15.74 |
| label on well (panel labels) | 4.86 | 5.65 |
| text2 on window (window notes) | 6.92 | 6.39 |
