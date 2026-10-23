# CA-19 · colour and references

Made with `node scripts/ca19-screens.mjs` against `/dev/kit/pages/sandbox?build=references&theme=<noon|dusk>&viewport=<desktop|mobile>`
(the "References" build, `src/dev/fixtures/references.ts`: CA-17's "Two parts" with the group Login flow, two single colours
that share #7FA7D9, an unnamed group and an old post with two links to Prompt 1). The page runs the composer's own history,
actions and windows on memory, so every state is reached by clicking, as a maker would.

Sizes: 1440 wide on desktop and 390 on a phone, in Dusk and Noon. The windows draw at `--window` (the modal recipe's), where
the boards draw #1B1B1E.

- `link-panel-*`: words highlighted in post 1, the reference button pressed, the link panel open.
- `link-panel-move-*`: the same, with Prompt 1 chosen: it is linked in post 3, so the move panel asks first.
- `notice-*`: "Linked "the screens" to Prompt 3", with Undo.
- `group-hover-card-*`: the card over "Signing in by email link" (desktop only: a phone has no hover).
- `picker-single-*`: Data model's picker (a single colour, linked, "Also used by Manual step 6").
- `picker-group-*`: Code 4's picker in its group state.
- `picker-find-words-*`: Landing page's picker with "screens" found in the post.
- `select-words-bar-*`: "Select words in the post instead": the bar at the top of the post.
- `labels-list-*`, `labels-details-*`, `labels-map-panel-*`: Login flow's label on its members in the List, "In Login flow"
  in Details, and in the map panel (desktop only: a phone has no map).
- `group-window-*`: Login flow's window.
- `colours-window-menu-*`: the Colours window with Login flow's menu open (and Merge into… on desktop).
- `clear-all-confirmation-*`: "Clear all colours and links?".

The four CA-19 boards are not in the repository, so the screens were checked against the measures and words in the CA-19
prompt rather than beside the boards.
