# CA-05 P11 · Screens

Taken with Playwright from the dev pages, Dusk and Noon, at 1280 and 390 wide, from the new shape in
`src/dev/fixtures/shapes.ts` (`/dev/kit/pages/sandbox?build=shape-everything`, `&open=e-p1`, `&lens=map`,
`&select=<id>`, and `/dev/kit/pages/build-steps?build=everything`). The dev boards are laid out at 1440, so a
full-page shot at 1280 is 1440 wide.

| Screenshot | What it shows |
| --- | --- |
| `words-to-change-window-*` | The full prompt window on prompt 1: "Ada's Bakery" and "Ada" in a 1px `--line` inset outline, radius 4, no colour, and "2 words to change before you send it" under the text. |
| `session-facts-list-*` | The List: Session 1's line (length, cost with tokens, later runs, background), Sessions 2 and 3 "At the same time as ... · own copy: ...", the agents' Tidies and changes-each-round lines, and the check with Tested on 40 cases and its three runs. |
| `started-with-details-*` | Session Details: Started with in a code well with its settings in plain words under it. |
| `parallel-map-*` | The Map: sessions 2 and 3 next to each other, labelled "at the same time". |
| `setup-grouped-details-*` | Session Details' Setup under "At the start" and "Only when needed". |
| `check-runs-details-*` | Check Details with Runs, newest first. |
| `local-model-details-*` | A prompt on Ollama: How it was run and Where. |
| `agent-tidy-details-*`, `agent-changes-details-*` | An agent's How it tidies its notes, and What it changes each round. |
| `trained-model-details-*` | A result that is a trained model: What it is, Based on, Trained on, How it was trained. |
| `build-page-everything-*` | The build page with all of it. |

Not taken, because nothing is drawn: the "chat was summarised here" marker and the helper suggestion (P4 stopped; see
`p4-not-in-the-file.md`).

## Audits against the baseline

Both ran on main at the start and on the branch at the end, in this container.

`DESIGN_MAX_DIFF=0 npm run audit:design -- --grep "composer|build-list"`: the pixels different are identical on all
eight boards before and after. Nothing new shows until a build uses it.

`npm run audit:contrast`: 52 unaccepted failures at the start, 51 at the end.
