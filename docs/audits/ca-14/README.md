# CA-14: sessions you can see, name, move, fold and add to

Screenshots taken on the CA-09 stand-in (`docs/audits/ca-09/standin.md`) at 1280 and 430, in both themes.

```sh
docs/audits/ca-09/scripts/standin.sh build && docs/audits/ca-09/scripts/standin.sh start
node docs/audits/ca-14/scripts/scenario.mjs --reset        # the draft: Session 1 typed (3 tiles), Session 2 imported (66), Session 3 fresh
node docs/audits/ca-14/scripts/shots.mjs docs/audits/ca-14/before <draft id>   # before: the draft, and the "Add a session" popover
node docs/audits/ca-14/scripts/after.mjs docs/audits/ca-14/after               # after: the six steps, the session list, the reader's page
```

- `before/`: `main` at `a8692e1`, the draft with three sessions and the "Add a session" popover.
- `after/`: this branch, numbered in the order the brief asks for: start, 1 Session 3 moved to the top, 2 the long session
  open and folded, 3 a tile added from the top Add (the question, then the tile), 4 split at its tile 10, 5 merged back,
  6 after a reload, 7 the session list, 8 the reader's page.
