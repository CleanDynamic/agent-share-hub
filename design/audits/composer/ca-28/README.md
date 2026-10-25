# CA-28 screens

`before/` is the build at the end of CA-27 plus the dev page that opens each window (P0). `after/` is the end of CA-28. Both are 1440 wide, Dusk and Noon, each window closed as it opens and open with every field. `motion/` holds Add a tool paused part way (opening 60, 150 and 300 ms; closing at 100 ms, the lift and then the frame).

Regenerate with:

    SHOTS=after PW_CHROMIUM_PATH=<chrome> npm run audit -- composer-ca28-shots
    PW_CHROMIUM_PATH=<chrome> npm run audit -- composer-ca28-motion

## What changed on screen

- The per-field closed rows are gone. A window ends in one row, `Optional`, with the count at the right (`9 fields`, or `8 fields · 6 filled`) and a chevron.
- Open, the fields stand as the required fields do: label above, grey hint when there is one, then the input. The recipes, tokens, `frameStyle`, header and widths are untouched.
- A window that opens with a value in an optional field opens the section by itself.
- Session extras, the manual step's Picture and the Decision option descriptions now live in the section; required fields kept their places.
- The frame stops at its maximum height; the body scrolls and the toggle row keeps its place in it.
- The `motion/` shots show the clip opening from the old height with the centre fixed, the fields falling in after 100 ms, and the closing in reverse.

## Known

- The frame's shadow is outside the clip, so there is a faint pop at the first and last frame of the size change (the clip reaches 96 px past the frame to leave the shadow room, and the shadow is cut at the moment the animation starts and ends).
