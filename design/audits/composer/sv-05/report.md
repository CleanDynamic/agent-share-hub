# SV-05 · after

Branch `sv-05-numbering-and-fixes`, on `sv-04-page-transitions` (pull request #397, not merged yet).

## Screens

`after/` holds the Part 0 cases at 1440 and 390, Dusk and Noon, and Part 9's moments at 1440 in Dusk:

- `move-mid-dusk-1440.png` and `move-after-dusk-1440.png`: Session 3 moved to the top by its menu (`?build=ca22`), mid-slide and after; the moved session reads Session 1 and the others shift down.
- `import-blocks-dusk-1440.png`: an import paused at 6 of 18; each waiting socket is filled with blocks, its number inside the socket.

What differs from `before/`:

- Your sessions rows are named by their first prompt. The dev fixture's rows have none, so they read "Untitled session"; real rows carry the session's first prompt.
- The import's sockets are filled top to bottom; their numbers stand inside the socket, not on a rail outside the part's frame.
- The import demo's arriving session is Session 4 (it read Session 3, a number Session 3 already had).
- "+ Add tile", no "Map is now available", the Classification window's 20 inset.

In the move shots, Sources on the left keeps the demo's fixed rows (the demo does not rebuild them); the List and its heads renumber.

## Checks

- `npm run audit:design -- --grep composer`: composer-list passes in both rooms. composer-map and composer-card fail in both: they press a "Card" button the title row no longer has (it reads "Classification", as in `before/`), so they fail before this branch too.
- `npm run audit:contrast`: 94 unaccepted pairs, all focus rings and inputs on other routes; none is on an element this prompt changed.
- No em dash in the added lines.
