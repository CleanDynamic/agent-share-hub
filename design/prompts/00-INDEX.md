# The prompt series

46 prompts. One per Claude Code session, in this order. Each starts by pointing at `design/RULES.md`, which holds everything the prompts do not repeat.

`ALL-PROMPTS.md` is the whole series in one file. `UI-D01` is a read-only diagnostic — run it any time the site does not look like the boards.

## Order

### Before you start

- **[UI-D01](UI-D01.md)** — What actually landed

### Wave 0 — foundation

- **[UI-P00](UI-P00.md)** — Put the design kit in the repo and record a baseline
- **[UI-P01](UI-P01.md)** — The verbatim check: a compare harness and dev compare pages
- **[UI-P02](UI-P02.md)** — Rename the light theme: Exhibition → Noon
- **[UI-P03](UI-P03.md)** — Noon (Birch Mist) values and the new tokens
- **[UI-P04](UI-P04.md)** — The focus ring on Noon
- **[UI-P05](UI-P05.md)** — Sentient as the display face

### Wave 1 — primitives

- **[UI-P06](UI-P06.md)** — Identity: mark, lockup and the cover fallback
- **[UI-P07](UI-P07.md)** — Controls
- **[UI-P08](UI-P08.md)** — The lamp and the plaque
- **[UI-P09](UI-P09.md)** — Panels, wall labels, stats and striped bars
- **[UI-P09b](UI-P09b.md)** — Liquid glass, on main panels only
- **[UI-P10](UI-P10.md)** — Orbs
- **[UI-P11](UI-P11.md)** — Tagline, hero plate and part viewer
- **[UI-P12](UI-P12.md)** — Charts, timeline, activity grid and rank rungs
- **[UI-P13](UI-P13.md)** — The page backdrop: horizon, arc and grain
- **[UI-P13b](UI-P13b.md)** — The living backdrop
- **[UI-P14](UI-P14.md)** — The build card
- **[UI-P15](UI-P15.md)** — The vacant frame (bounty card)

### Wave 2 — the frame

- **[UI-P16](UI-P16.md)** — The frame skeleton and the `site_frame` flag
- **[UI-P17](UI-P17.md)** — The site header (desktop)
- **[UI-P18](UI-P18.md)** — Breadcrumb, footer and the theme control
- **[UI-P19](UI-P19.md)** — The mobile frame: header, dock, sheets and sideways rows
- **[UI-P20](UI-P20.md)** — Switch on the frame for the first route

### Wave 3 — data functions

- **[UI-P21](UI-P21.md)** — Data: the home signals
- **[UI-P22](UI-P22.md)** — Data: gallery lens counts, gallery stats and the shape facet
- **[UI-P23](UI-P23.md)** — Data: the featured build
- **[UI-P24](UI-P24.md)** — Data: the open bounty pool
- **[UI-P25](UI-P25.md)** — Data: where next, for the viewer
- **[UI-P26](UI-P26.md)** — Data: maker figures, runs of my builds, people this week

### Wave 4 — pages

- **[UI-P27](UI-P27.md)** — Page: Home
- **[UI-P28](UI-P28.md)** — Page: Gallery
- **[UI-P29](UI-P29.md)** — Page: Build page — the first screen
- **[UI-P30](UI-P30.md)** — Page: Build page — tab contents and the rest of the page
- **[UI-P31](UI-P31.md)** — Page: Rebuild and lineage
- **[UI-P32](UI-P32.md)** — Page: Import and compose (the workspace)
- **[UI-P33](UI-P33.md)** — Page: Bounties, solve and solvers
- **[UI-P34](UI-P34.md)** — Page: Profile
- **[UI-P35](UI-P35.md)** — Page: Activity
- **[UI-P36](UI-P36.md)** — Pages: Sign in, Join, reset and verify
- **[UI-P36b](UI-P36b.md)** — Turn the frame on

### Wave 5 — finish

- **[UI-P37](UI-P37.md)** — Every state: loading, empty, error
- **[UI-P38](UI-P38.md)** — The accessibility pass
- **[UI-P39](UI-P39.md)** — Between the boards: 768 to 1279, and the tablet chrome switch
- **[UI-P40](UI-P40.md)** — The performance pass
- **[UI-P41](UI-P41.md)** — Retire the old frame

## Rules of the road

- **In order.** Four must not be skipped or moved: `UI-P01` (the compare harness), `UI-P03` (the tokens), `UI-P16` (the frame skeleton) and **`UI-P36b`** (the switch — until it runs, everything from `UI-P16` on is built but invisible to visitors).
- **Three prompts amend the standing rules** rather than follow them, each saying so in its own text: `UI-P09b` (one CSS class, and `feDisplacementMap` on one filter), `UI-P13b` (the backdrop is no longer static) and `UI-P41` (the only prompt that deletes).
- **One prompt, one session, one commit.** A prompt that ends without a green `PASS` is not done.
- **Names come from the code.** `RULES.md` §8 — never invent a table or widen a policy to make a prompt fit.
- **Both themes, both viewports, every time.**

## If the site still looks the same

Run `UI-D01`. The usual cause is the `site_frame` flag being off, which `UI-P36b` fixes.
