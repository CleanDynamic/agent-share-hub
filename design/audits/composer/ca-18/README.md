# CA-18 screens

`{dusk,noon}-{1440,1920,1100,390-phone}.png`, from `npm run audit -- composer-ca18-shots` (the dev sandbox page with `?window=1`, so the frame fills the window; the 1100 shots add `&select=3`).

- 1440 and 1920: Details beside the build, one column, sized by its content; Build is the same width at both widths' rules (clamp 560 to 760).
- 1100: Details does not fit beside the build, so it is the overlay over the right of the page, opened on tile 3 with `?select=3` (the dev page takes a step's number or id). Its foot, "Click to edit", is not drawn here: the dev page has no window to open; that is covered by `DetailsOverlay.test.tsx`.
- The compared board for the Card (`refined/noon/composer-card`) still draws the old drawer; that mismatch is older than CA-18.
