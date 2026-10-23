# CA-15b · modals and tiles

Made with `/dev/kit/pages/modals?modal=<name>&theme=<noon|dusk>&viewport=<desktop|mobile>`, one modal at a time, closed
and with one Optional row open (`-open-`), and `modal=tiles` for a List with every kind of tile.

- `before/`: `origin/main` at 29048038 (CA-15 as merged), the same dev page.
- `after/`: this branch.
- `compare/`: before and after side by side, Dusk at 1280, at half size.

Sizes: 1280 × 900 in Dusk and Noon, and 390 × 900 in Dusk. The boards themselves are not in the repository, so the
screens were checked against the measures and words written out in the CA-15b prompt.

Phone checks at 390, on every modal and the List: nothing runs off the side, no option or segment wraps its words onto a
second line, and the footer sits at the bottom of the sheet (`after/checks.json`).
