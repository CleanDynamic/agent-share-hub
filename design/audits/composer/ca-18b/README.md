# CA-18b screenshots

The composer after CA-18b (the build centred, one box, colour and references in Details), from `/dev/kit/pages/sandbox`.

| Folder | What |
|---|---|
| `composer-<theme>-<width>.png` | The bakery build with prompt 3 selected, Dusk and Noon, at 1280, 1440, 1920 and 2560 wide |
| `boxed/` | The same at 1440 and 1920 after CA-18b P5: the title area runs from Sources' left edge to Details' right edge |
| `references/` | Details at 1440 in the References fixture: Code 4 (in Login flow), Data model (a single colour), Prompt 1 (uncoloured, linked text) and Session 2 (in the group) |

## Checks (`npm run audit:design -- --grep composer` with `DESIGN_MAX_DIFF=0`, and `npm run audit:contrast`)

Pixels different from the board, main (CA-19 merged) then this branch:

| Board | Main | CA-18b |
|---|---|---|
| refined/dusk/composer-list | 57,340 | 57,095 |
| refined/dusk/composer-card | 14,142 | 14,034 |
| refined/noon/composer-list | 59,438 | 59,122 |
| refined/noon/composer-card | 666,300 | 662,683 |

Contrast: 61 unaccepted failures on main and on this branch (one run showed a 62nd, a focus ring on the Publish route, that did not come back on a second run).
