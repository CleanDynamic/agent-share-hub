# CA-06 P7 · Screens

Taken with Playwright from the dev pages, Dusk and Noon, at 1280 and 390 wide, from the fixture "A post with links"
(`src/dev/fixtures/postLinks.ts`): CA-04's "One sitting, then agents" build with a check added to session 2, three
parts coloured (session 2 `#7FA7D9`, prompt 2 `#C9A86B`, the code sent with it `#B79AD6`), and a post that links
session 1, prompt 2, the code tile sent with it, session 2, the team's Build agent, the check, and a tile that is gone.

Composer: `/dev/kit/pages/sandbox?build=links&fit=content` (`&lens=map`, `&swatches=filled`). Build page:
`/dev/kit/pages/build-steps?build=links`. Each screen is the viewport, after the step named.

| Screenshot | What it shows |
| --- | --- |
| `post-links-*` | The post: coloured links (session 2, prompt 2, the code) on their colour, plain ones on `--row-highlight`, each with its number after it; "first sketch" points at a deleted tile and is plain `--text2` words. |
| `at-picker-*` | "heavy" highlighted, then @: the picker under it, grouped by session, each led by The whole session, nested tiles indented under their parent, a 2px colour bar under a coloured part's number. |
| `hover-card-*` | The maker's card over "form prompt": the eyebrow, the title, its text, Go to it, Change and Remove the link. |
| `prompt-window-from-link-*` | "form prompt" clicked: prompt 2 centred and outlined behind the full prompt window, whose footer reads "Opened from the post · Back to the post". |
| `session-window-*` | "session 2" clicked: the session window, its tool, model and day, Setup · 4 items, and its tiles as rows. |
| `colour-picker-*` | Session 2's colour button: the picker with Recent and Favourites filled, the session's "Also colour its tiles that have no colour"; a BottomSheet at 390. |
| `list-coloured-*` | The List: prompt 2 and its code tile in their colours (the file inside keeps none), session 2's line round its head and tiles, the colour buttons, and "Mentioned in the post · Back to the post". |
| `map-coloured-*` | The Map: prompt 2's box in its colour. 1280 only: a phone has no Map, so there is no 390 Map shot. |
| `build-page-reader-*` | The build page as a reader, after "the totals check": the card centred and rung behind the check's window, with Back to the post. |

## Compared with the refined boards

The links, the picker, the windows and the cards use the board recipes as they are: the window recipe (760, radius
12, `20px 24px`) for both windows, the menu surface for the picker and @, the module recipe for the hover card, the
selected recipe for the chosen row, EYEBROW for eyebrows. Two things differ from the board pages, both from the
CA-06 prompt: the picker's padding is 14 (the boards' spacing scale has no 14), and a coloured part's border is the
one exception to "no coloured card edges", written into `design/RULES.md`.

Found and fixed while comparing: on the build page the part's number sat inside the link's fill (the editor drew it
after the fill, as the prompt asks); it now follows the fill in both. A phone's colour sheet said "Colour" twice.

Not fixed, for Miles: at 390 the post toolbar's first group (picture, row, two lists, Aa, @) is wider than the phone,
so @ is reached by scrolling that row, as its neighbours already are when the row is narrower.

## Checks

- `npm run audit:contrast`, with the six suggested colours each on a linked part (`&presets=1`) in both rooms, in the
  composer and on the build page (four new routes in `e2e/audit/support/harness.ts`): every link's words and every
  number pass in both themes. 50 unaccepted failures at the start, 59 at the end. None is a link: 8 are the header
  search field's focus ring on the four new routes, the same failure the start already had on every route (30
  times); 1 is the publish route's skip link in Dusk, which the start measured as 0 pairs because that route did not
  render then.
- `npm run audit:design -- --grep composer`: 6 of 6 boards within the threshold at the start and at the end.
- `src/lib/theme/partColour.test.ts` holds every suggested colour's link fill at 4.5:1 for `--text` in both themes.
