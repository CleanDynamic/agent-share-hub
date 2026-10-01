# UI-P30 — Page: Build page — tab contents and the rest of the page

Follow `design/RULES.md` (§7).

**Goal.** Every other tab of the build page inside the part viewer, and everything the page shows below the first screen, in the same grammar. There is no board for these; they follow the primitives exactly.

**Read first.** `BuildTabs.tsx` (six keys: `anatomy watch run understand broke rebuilds`), `RebuildsTab.tsx` and `GapPanel.tsx` (both verified), the run / breakage / replay views under `components/build/` by their real names, and whatever else `BuildPage.tsx` renders under the header.

**Build.**
1. **Watch it get built** — the viewer body shows `Replay` with its controls restyled: play/pause `IconButton` 34, a scrubber drawn as a `StripedBar` in `--lit` (height 9) with a real `<input type="range">` over it for keyboard and pointer, the current event's kind label (colour as in `Timeline`) and text in Figtree 14px.
2. **Run it yourself** — `RunView` content in Figtree 14px, line-height 1.65; numbered steps with the number in `type.display(20)` `--label` (like the anatomy rows); code and prompts in a `--recess` well, radius 12, padding 12px 14px, DM Mono 12px, each with a secondary 30/12 Copy.
3. **Where it broke** — `BreakageView` items as rows with a 7px `--cat-breakage` dot, the part name in Figtree 13px 600, what happened in Figtree 13px `--text2`, and the fix in `--text`; an open gap shows as a dashed breakage card with its reward and a primary "Solve it" → the bounty.
4. **Result** — the result media or text inside a radius 10 frame, with `CategoryChip` "evidence" and the run log's date in DM Mono 10px `--label`.
5. **Rebuilds** (if the key exists) — the rebuild cards (build card, cover 86, title 17) in a 3-column grid inside the viewer body, then a link "See the family tree" → lineage.
6. **Below the first screen** (desktop and mobile): each remaining section `BuildPage` renders today becomes a glass `Panel` (padding 16px 18px, `PanelHead` title Figtree 16px 600) in the column, full width, gap 12, in its current order — `WhereNext` as a row of three build cards (desktop) / two-column wall (mobile), `GapPanel` as dashed breakage panels. No new sections.
7. Tabs keep their URL behaviour (hash or search parameter, as today).

**Done when.** Each tab renders real data for a build that has it, in both themes, at 390 and 1440; tier1 build specs pass; no new colours or radii outside the tokens and the radius scale.

**Commit.** `UI-P30: Build page tab contents and lower sections`
