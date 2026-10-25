# CA-27 · find, truncation, large builds and tablets

Checked on the `ca27` fixture (300 tiles, 20 sessions, 3 parts; `/dev/kit/pages/sandbox?build=ca27&tiles=300`) and the CA-22 and CA-25 builds.

## Screens (Dusk and Noon)

| File | What it shows |
|---|---|
| `find-2-of-5-{dusk,noon}-1440.png` | Find open on the ca27 build, "sourdough", the second of five: the field in the Build head row (sticky under the header while it is open), the count `2 of 5`, the word marked, the ring on Prompt 64 in the middle of the screen |
| `long-{dusk,noon}-1440.png`, `long-{dusk,noon}-390.png` | the long titles and previews: one line and an ellipsis for titles and names, two lines for previews, the ⋯ button in the same place on every tile |
| `scrolled-{dusk,noon}-1440.png` | the ca27 build of 300 scrolled part of the way down (windowed: only the tiles near the view are drawn) |
| `tablet-1024-details-{dusk,noon}.png` | a tablet at 1024, a tile tapped: Details is the 300 panel over the composer box's right edge, `Tap to edit` at its bottom left |

## At rest

`before/` holds the CA-22 and CA-25 builds at 1440 and 390 in both rooms, shot from a checkout of main before CA-27 (`AT_REST_RECORD=1`). `composer-ca27-shots.spec.ts` shoots them again and compares:

- 390: byte for byte the same (there is no Find button on a phone).
- 1440: the only pixels that differ lie in the Find in build button, the list's hint line (it now ends `read all`), and the Sources column (a row whose name wrapped before is one line and an ellipsis now, which Part 2 asks for). A pixel out by a level or two on a rounded corner is not counted.

## Measures (Part 3)

`scripts/ca27-measure.mjs`, 1440, a production build of the page with the dev pages kept, Chromium headless with software rendering in a container (slower than a laptop with a GPU: the numbers say whether the work is light). `measure-p3.json` has every run.

| | before | content-visibility | windowing (final) | target |
|---|---|---|---|---|
| first render (ms) | 875 | 645 | 210 to 253 | 300 |
| scroll (frames a second) | 54.7 | 58.5 | 59.2 to 60.6 | 60 |
| pick-up (ms) | 420 to 550 | 460 to 690 | 126 to 145 | 16 |
| Find's results (ms) | 207 to 341 | 231 to 358 | 40 to 67 | 50 |

Pick-up is JavaScript for about 35 ms of the 130 and native layout and paint for the rest; it still misses its target here.

## The two checks

- `npm run audit:design -- --grep composer`: composer-list (both rooms) and composer-card (Dusk) compare; composer-map (both rooms) and composer-card (Noon) do not, exactly as on main.
- `npm run audit:contrast`: 210 failures on main, 216 here. Four are the new `go-to-far` button of the dev bar (a dev page's test control, not shipped); two are the header search's focus ring (outline and fill the same colour), which main has on 70 route-rooms and this has on 72 (the sweep samples a few more). Nothing on the build page's own controls.
