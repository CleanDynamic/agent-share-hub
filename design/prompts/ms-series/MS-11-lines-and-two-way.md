# MS-11 · Lines and two-way arrows in the editor

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After MS-10 has merged. Read the README (Decision 9), then `MODEL.md`: "Lines" (all of it). Look at `08-lines.png` and `04-order-and-two-way.png`. Pull main. Branch `ms-11-lines-and-two-way`. Open one pull request titled `MS-11 map lines and two-way arrows`.

## Part 0: plan

The README's audit file and plan.

## Part 1: showing and hiding lines

1. Clicking a line selects it (a 9px invisible hit stroke over it). Its floating bar shows its sentences ("Prompt 3 uses Prompt 4") and Hide.
2. The toolbar gets the hidden-links counter: "2 links hidden", shown only when at least one is hidden, which opens a small list with Show for each and Show all.
3. Hidden lines are hidden for readers too, and the build page shows the same counter text under the map, so a reader is never misled.
4. Keyboard: with a tile selected, L cycles through its lines; Enter selects one.

## Part 2: moving a line's middle segment

Dragging a selected line's middle segment shows the gutters it could go through; dropping on one stores `linkGutters[id]` and re-routes. The segment snaps to the gutter's centre. Lines keep their right angles. Reset on the line's bar removes the key.

## Part 3: the Arrow tool and two-way arrows

1. The toolbar gets **Arrow ▾** with one choice for now, Two-way. (Build links can't be drawn by hand: they come from the build.)
2. With Two-way chosen, the pointer is a crosshair. Press on a tile or box and drag to another. During the drag, every possible end is marked: allowed ones in `t.evidence`, refused ones dimmed with the reason on hover ("These happen one after the other").
3. On release over an allowed end:
   - If the two ends are level (`isLevel`), the arrow is added to `layout.twoWay`.
   - If not, the bar shows "Slide Session 2 level with Session 1?" with Slide and Cancel. Slide applies `slideToLevel` and adds the arrow in one undo step. If `slideToLevel` refuses, show its reason and add nothing.
4. A two-way arrow is drawn as one straight horizontal segment through the gutter between the two ends, at the vertical middle of their shared band, with an arrowhead at each end, in `t.evidence`, 1.6px. It is never bent. Its accessible description on both ends says "Happens at the same time as Prompt 4".
5. Selecting a two-way arrow offers Remove.
6. **Suggestion.** Where the build's stages say two sessions ran side by side and no two-way arrow joins them, show one dismissible suggestion above the canvas once per map: "Session 1 and Session 2 ran side by side. Add a two-way arrow?" with Add and Dismiss. Dismissing is remembered for that pair in `layout.twoWayDismissed`.
7. After any change, `twoWayProblems` runs. An arrow no longer allowed or no longer level is listed in the notice MS-06 built, with Fix (slide level, or remove when it can't be level) and nothing removed silently.

## Part 4: tests

- Hide and show a line; the counter; hidden lines and the counter on the build page.
- Moving a middle segment stores the gutter and keeps right angles.
- Two-way 1 and 4 added when level; when S2 is lower, Slide makes them level in one undo step; 4 and 5 refused; 3 and 4 refused.
- Suggestion appears once and stays dismissed.
- Moving a box so an arrow is no longer level lists it with Fix.

## Done when

- Lines can be hidden, counted, and re-routed; two-way arrows can only join simultaneous things and are always level.
- `npm test`, `npm run lint` and `npx tsc --noEmit` pass.
