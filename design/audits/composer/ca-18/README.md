# CA-18 screens

`{dusk,noon}-{1440,1920,1100,390-phone}.png`, from `npm run audit -- composer-ca18-shots` (the dev sandbox page with `?window=1`, so the frame fills the window).

- 1440 and 1920: Details beside the build, one column, sized by its content; Build is the same width at both widths' rules (clamp 560 to 760).
- 1100: Details does not fit beside the build, so it is not drawn here. The overlay opens from a click on a tile in the page itself; the dev page selects no tile, so it is covered by `DetailsOverlay.test.tsx`.
- The compared board for the Card (`refined/noon/composer-card`) still draws the old drawer; that mismatch is older than CA-18.
