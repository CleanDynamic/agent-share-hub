# CA-17 · parts and the map

Made with `/dev/kit/pages/sandbox?build=parts&theme=<noon|dusk>&viewport=<desktop|mobile>` (the "Two parts" build,
`src/dev/fixtures/parts.ts`), plus `&lens=map`, `&direction=vertical`, `&session=<key>` and `&map=none`.

Sizes: 1440 wide on desktop (the dev frame is 1440 wide, so a 1280 window clips it) and 390 on a phone, in Dusk and Noon.
Not every shot exists at 390 where the screen is the same (mid-drag is desktop only).

- `list-two-parts-*`: the List with both parts, Part B starting after Session 2, letters on.
- `mid-drag-session-onto-part-*`: Session 3 held over Part B's head.
- `add-session-add-to-*`, `add-session-add-to-open-*`: the add a session picker with "Add to".
- `sources-add-this-session-to-*`: the Sources menu "Add this session to".
- `part-menu-*`, `part-menu-starts-after-*`, `part-colour-picker-*`: Part B's menu and colour picker.
- `at-picker-part-row-*`, `part-link-hover-card-*`: the post's picker with a part row, and the part link's card.
- `map-before-created-*`, `map-horizontal-triage-selected-*`, `map-vertical-none-selected-*`.
- `tab-row-list-*`, `tab-row-map-*`.

The build page with the map shown and off is covered by `readerParts.test.tsx` and `ReaderMap.test.tsx`; the dev pages
have no reader screen for it, so there is no picture of it.

Checks: `e2e/audit/ca-17-map.spec.ts` (no overlap, no line ends in a box, the part link centres within 40px).
The boards are not in the repository; the screens were checked against the measures in the CA-17 prompt.
