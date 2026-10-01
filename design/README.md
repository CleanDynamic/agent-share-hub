# The buildgallery design kit

This folder is the approved UI, as files a machine can read: the reference HTML for every screen, a picture of each one, the tokens, sample data, and a series of 42 prompts that build it in the app.

It exists because the last attempt described the design in prose and got the old UI back. Prose is not checkable. **Everything here is checkable**: the reference is real HTML with real numbers, and `npm run audit:design` screenshots the reference and the app side by side and fails on the difference.

Two themes: **Noon** (light — "Birch Mist", a forest sunrise) and **Dusk** (dark — deep aubergine with a violet-and-salmon glow near the arc). Ten screens each, desktop and mobile.

## Checking a change

```
npm run audit:design                                  # every board
npm run audit:design -- --grep "desktop/noon/home"    # one board
npm run audit:design -- --grep "components"           # the component catalogue
```

Test titles are `<kind>/<theme>/<page>` (`desktop/dusk/gallery`, `mobile/noon/build`, `components/noon/catalogue`), so `--grep` takes any slice of them. `DESIGN_MAX_DIFF=0.02` tightens the allowed share of differing pixels from the 0.04 default; `DESIGN_MAX_DIFF=0` makes every board report its exact difference. In a sandbox with its own Chromium, add `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`. A page that has no view yet is skipped ("not built yet"), not failed. Open the report with `npx playwright show-report e2e/audit/out/playwright-report`: every board shows expected (the reference), actual (the app) and the difference. Do not pass `--update-snapshots`; the reference is re-shot on every run.

The harness opens each reference HTML and the matching dev page at the same size and screenshots both. Desktop boards are clipped below the drawn 84px browser strip, so the compared area is 1440 × (height − 84). The dev pages it points at:

```
/dev/kit/components?theme=noon|dusk
/dev/kit/pages/:page?theme=noon|dusk&viewport=desktop|mobile
/dev/kit/pages/:page?state=loading|empty|error        (after UI-P37)
```

They render the page views with `fixtures/sample-data.json`, so a comparison tests the UI and not the database. Dev-only, never in a production bundle. `?theme=` sets the page's theme without touching the stored preference.

To see a real route in the new frame before the flag is on anywhere: `?frame=site` (development builds only).

## Where things are

```
design/
  RULES.md              the standing rules — read this first, and before every prompt
  HANDOFF.md            the design itself: what each page is, how it maps to the code, the gaps
  README.md             this file
  prompts/
    00-INDEX.md         the 42 prompts in order, with what each one does
    UI-P00.md … UI-P41.md   one prompt per file — paste one per Claude Code session
    ALL-PROMPTS.md      the whole series in one file
  reference/
    index.json          every board: file, kind, theme, page, width, height, screenshot
    desktop/{noon,dusk}/*.html    9 boards each, 1440 wide
    mobile/{noon,dusk}/*.html     10 boards each, 390 wide
    components/{noon,dusk}.html   the catalogue: every primitive, every state
    brand/{noon,dusk}.html        the brand board (identity, palette, grammar)
    fonts/                        Sentient 500 and 700, so the HTML renders offline
  screens/              a JPEG of each board, for looking at
  tokens/
    tokens.css          drop-in custom properties for both themes
    token-map.md         raw value → token, and the few values that stay raw
    tokens.json         the machine-readable source (`css` holds the whole table)
  fixtures/
    sample-data.json    the sample content — the only place fake data lives
```

**Open any `reference/**/*.html` in a browser.** It needs nothing else: no server, no build, no network. The fonts load from `reference/fonts/`. Every element that corresponds to a component carries `data-ui="<component>"`, and where there are states, `data-variant="<state>"`. The values in those files are exact — port them, don't approximate them.

Two things in the reference are **not** to be built: the browser strip across the top of each desktop board (that's the visitor's own browser, drawn for context — it's marked `data-ui="browser-frame-PRESENTATION-ONLY-do-not-build"`), and every piece of sample text, name, number and date.

## Getting it into the repository

The kit must be committed — the compare harness opens each board as a `file://` path and the fixture loader imports `sample-data.json` at build time, so neither a hosted page nor a chat attachment can stand in. A cloud Claude Code session clones the repository, which makes this the first thing to do.

**One file.** `design/build-kit.py` carries the entire kit. Put that single file in the repository (GitHub's web uploader takes one file without complaint; 101 would exceed its limit), then:

```
python3 design/build-kit.py          # writes the kit next to the script
python3 design/build-kit.py --check  # verifies it, writes nothing
git add design && git commit -m "UI-P00: add design kit"
```

It needs nothing beyond the standard library, overwrites with identical bytes when re-run, and touches nothing outside `design/`. `UI-P00` runs it for you if the kit is missing.

**Or unzip.** If you have the repository locally, unzip `buildgallery-design-kit.zip` at the root so it lands as `design/`, and commit that instead. Same files.

## Running the prompts

One prompt per Claude Code session, in the order `prompts/00-INDEX.md` lists. Start a session in the repository and say:

```
Run design/prompts/UI-P00.md
```

or paste the file's contents. Each prompt opens with "Follow `design/RULES.md`", which carries everything the prompts don't repeat: how code is written here, what the code review fails automatically, both themes and both viewports every time, the checks before a commit, and the shape of the report back.

`UI-P00` first — it puts this folder in the repository and records a baseline. Then in order. Three cannot be skipped or moved: **UI-P01** (the compare harness — without it "verbatim" is just an opinion), **UI-P03** (the tokens — everything after spends them) and **UI-P16** (the frame skeleton, which every page then fills).

Each prompt ends with a report. A prompt whose report is not `PASS` is not done: run it again with the failures quoted, rather than moving on.

## Known deviations from the reference

Deliberate, and expected in every compare report:

- **10px minimum text.** A few mono labels are 9px at 1440 in the reference; in code they are 10px.
- **`--lit-ink` for amber that is read.** Amber (`--lit`) is light, never text: it fails contrast. Where the reference draws a word or a glyph in amber — the `~` in a change list, the deploy label, the streak flame, a reward figure — code uses `--lit-ink` (darkened on Noon, unchanged on Dusk).
- **The Noon focus ring** is ink, not amber (UI-P04).
- **"Reproduced today" and "48 runs"**, not "reproducing now": nothing in the data records a run in progress.
- **The vacant frame's lamp is always dimmed.** It marks a missing part, not a stale build.
- **The footer's last link** reads "Sign out" for a signed-in visitor; the reference draws the signed-out state.
- **Following** on Home is disabled until the feed has a scope — the RPC takes none today.

## A note on the sample content

Every name, handle, title, count, price, date and quote in the reference and in `fixtures/sample-data.json` is invented: Invoice triage agent, @maya, "41 reproduced", "£4,250", "Level 7". None of it is a target and none of it gets hard-coded. `HANDOFF.md` §8 lists them, and each one is replaced by real data or by an empty state from `UI-P37`.
