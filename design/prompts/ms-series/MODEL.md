# The structured sandbox: how the map can work

Copied from the doc "The structured sandbox: how the map can work" on 27 November 2026. The MS series README decides anything this leaves open.

## What the map starts from

The map never has to decide what a build contains or in what order things happened. The build editor has already done that, so the map's only job is to arrange what exists.

By the time a maker opens the Map tab, the build editor has filed everything into compartments:

- **Parts** hold sessions (`workstreams` in `builds.making`).
- **Sessions** hold tiles, in an order that never changes.
- **Tiles** hold their content: text, settings, files, code, results.
- **Uses** record which tile depends on which.
- **Stages** record which sessions ran side by side.

That gives the map three layers, and each layer has a different owner:

1. **Content** belongs to the build. A tile's title, text, settings and files are shown as they are. The map can choose which of them to show, but never edits or invents them.
2. **Order** belongs to the build. If tile 6 comes after tile 5, nothing on the map may suggest otherwise. If two sessions ran at the same time, the map may show them side by side.
3. **Arrangement** belongs to the maker. Where boxes sit, how big they are, how they group, what colour they are and what the explanations say are all theirs.

Almost every confusing version we drew came from mixing these layers. Fixed lanes took arrangement away from the maker. Free floating boxes let arrangement contradict the order. The structured sandbox keeps the layers apart: the maker has complete freedom over arrangement, and none over content or order.

## The canvas is one rectangle, completely filled

The single rule that does most of the work is this: the canvas is a rectangle, and boxes tile it completely, with no holes and nothing floating. Every box is a rectangle too, so the outline of the whole map is always four-sided.

This rules out the clutter we kept running into. There are no stray boxes in empty space, no ragged right edges and no lonely notes drifting between sections. It also gives the map the look of the reference sheet: a composed page, not a desktop of windows.

Think of it like a bento box or a tiling window manager. The maker never places a box in empty space, because there is no empty space. Instead they divide, resize and rearrange space that is already full:

- **Adding a box** splits an existing one. Dropping a tile on the right half of a box splits it vertically; dropping on the bottom half splits it horizontally.
- **Removing a box** gives its space to its neighbour, so the canvas closes up.
- **Resizing** drags a shared edge. The boxes on both sides of that edge change together, so nothing opens or overlaps.

Boxes are separated by one fixed gutter, the same everywhere on the canvas. That one constant is what makes a dense map feel calm, so the gutter is not a setting. The canvas has one background colour, which the maker picks. The gutters show that colour, and each box has its own fill on top.

## How boxes divide the canvas

The layout can be stored as a tree of splits. Columns are not drawn by anyone: they appear wherever box edges happen to line up.

The canvas is the root of the tree. Each split divides a region into two or more children, either side by side or one above the other, at proportions the maker sets by dragging. Each leaf is a box. Saving the tree, not pixel positions, has three advantages:

- **No holes, ever.** Every region is split completely, so the canvas is always full and always four-sided. Nothing has to check for gaps after the fact.
- **Resizing stays tidy.** Dragging the edge between two siblings changes their proportions and nothing else.
- **It reflows.** Proportions work at any width, so the same map fits a wide monitor and a laptop (see Canvas size).

### Columns come from shared edges

There are no lanes. A "column" is just a set of boxes whose left and right edges line up. Suppose the maker splits the canvas into three side by side and stacks boxes in each: the map reads as three columns. Now suppose they make one box span the full width halfway down: the columns stop there and start again below it. The shape follows the boxes.

To stop near-misses, edges snap to a hidden 12-column grid across the canvas width and to an 8px rhythm down it. When an edge comes within a few pixels of another edge anywhere on the canvas, it snaps to line up with it, and a thin guide shows the alignment. Columns form because snapping makes lining up easy, not because the canvas forces it.

Rows work the same way. Boxes side by side share a top edge when the maker wants them to. The order rules in the next section decide whether two boxes may share a row at all.

## The order the canvas can never break

The map reads left to right, then top to bottom, like a page. That reading order must never put a later tile before an earlier one. Tiles that ran at the same time may share a row, in either order.

The canvas works out reading order from geometry alone. It groups boxes into bands: two boxes are in the same band when their vertical spans overlap by more than half. Bands are read top to bottom, and boxes within a band left to right. Bands are worked out per tile, not per box: a tile's band comes from its own height on the canvas, so the second tile in one box can share a band with the second tile in the box beside it. That's what lets two sessions that ran side by side read as side by side, tile for tile.

The build supplies the rules the reading order is checked against:

1. **Within a session,** tile order is fixed. Tile 6 can never be read before tile 5. If they're in different boxes, tile 6's box must come later in reading order or share a band with tile 5's box.
2. **Across sessions,** a use is a dependency. If Prompt 3 uses Prompt 4, Prompt 4 must come no later than Prompt 3.
3. **Sessions that ran side by side** have no order between them unless a use links them. So tiles 1 to 6 could all share one band, as long as nothing inside them breaks rules 1 and 2.

The check runs during the drag, not after it. While the maker drags a box or a tile, every drop position that would break the order is shown as unavailable, and the pointer carries a one-line reason: "Tile 6 tests tile 5, so it can't come before it." Dropping there is impossible, so a map can't be saved in a wrong order.

This replaces the fixed order rows we tried earlier. The maker gets the same guarantee without a grid of rows across the canvas.

## How sessions and parts sit on the canvas

Sessions and parts are regions, not lanes. A region is a branch of the split tree, so a session or a part can take any rectangular shape the maker gives it, and it stays four-sided like everything else.

Because the build has already filed tiles into sessions and sessions into parts, the tree can mirror that filing when the maker wants it to:

- **A part region** holds only its sessions.
- **A session region** holds only its tiles' boxes.
- **A tile box** holds one or more tiles from that session.

A region is drawn as a frame: a thin border with its name in a tab, and an optional explanation under the name. A part frame can be quieter than a session frame (a lighter line, a tint behind it), so the nesting reads at a glance.

There are two sensible ways to let makers use regions, and they suit different builds.

**Framed.** Session and part regions are real branches of the tree. Moving a session region moves everything in it. The outline is always a clean rectangle, and the map can never mix two sessions in one area. This suits builds where sessions run one after another.

**Interleaved.** Tile boxes from different sessions are siblings in the tree, so a box from session 2 can sit beside the late box of session 1 that uses it. This is the concurrency case from your example. Session membership is then shown by a tab on each box, and an optional outline that hugs that session's boxes.

I'd make framed the default and let a maker break a session frame open when they need to interleave. That keeps simple builds tidy and still allows the parallel layout. A box can never hold tiles from two sessions in either approach.

## Inside a box

A box follows the same idea one level down. Its contents are laid out by rules, not by hand, so the maker arranges them without placing pixels.

Every box has the same frame: a title (the session name, or the maker's own), an explanation line under it, then the contents. The contents use one of three layouts:

- **Stack:** tiles one under another.
- **Across:** tiles side by side, sharing the box's width equally.
- **Grid:** two or three columns that fill row by row.

Order inside a box follows the build. In Stack and Grid, tile 6 can't be placed above tile 5. Tiles that ran together may sit side by side in Across or Grid. Dragging a tile up or down reorders it only where the order allows.

Hierarchy is a second axis. Dragging a tile to the right places it under the one above it, one level in, with a thin bracket. A check sits under the tile it tests; a file sits under the prompt that made it. There are three levels at most, each indented by the same step.

Every tile is drawn in one fixed format: number, kind and title on the first line, then the parts the maker chooses to show (text, settings, files, code, a picture). They can't rearrange those parts, only switch them on or off. That's why fifty tiles can sit on one canvas and still look like one family.

Text the maker writes goes in two places only: the explanation under a box or region title, and a note attached to a tile. Free-floating text isn't possible, because there is no empty space for it to float in.

## Formatting tools

Each tool changes the shape of the map while keeping it full, four-sided and in order. None of them can create a gap or a box in empty space.

| Tool | What it does | Why it stays tidy |
|---|---|---|
| Split | Divides a box in two, side by side or one above the other | The two halves fill exactly the space the box had |
| Merge | Joins two neighbouring boxes from the same session into one | Only allowed when the result is still a rectangle |
| Shared edge | Drags the line between boxes to resize both at once | Nothing opens or overlaps; the edge snaps to the grid and to other edges |
| Swap | Drops one box onto another to trade places | Only offered when the swap keeps the build's order |
| Even out | Makes a row or column of boxes equal in size | One click instead of dragging edges by eye |
| Match | Gives selected boxes the same width or height | Keeps repeated shapes consistent |
| Span | Stretches a box across a whole row of the canvas | Used for a Result, an intro, or a session that deserves width |
| Frame | Draws a session or part frame round its region | The frame is a branch of the tree, so it's always a rectangle |
| Layout | Stack, Across or Grid inside a box | Spacing comes from the same scale as the canvas |
| Indent | Places a tile under another inside a box | Three levels at most, one step each |
| Show | Picks which parts of a tile appear | The order of parts never changes |
| Lines | Shows the build's uses, plus optional two-way arrows | Drawn only in gutters, at right angles, never across a box |
| Style | Box fill, border, corners; canvas background | A small palette that stays readable on every background |

## How each formatting tool works

Every tool here follows the same contract. It changes arrangement only. It snaps to the grid and to nearby edges. It shows what it will do before you let go. It refuses, with a one-line reason, anything that would break the build's order or leave a gap. It never changes a tile's content, its session, its number or the build's order, so nothing done on the map can constrain or alter the build itself.

### Shaping the canvas

**Split.** Select a box and choose Split side by side or Split top and bottom from its floating bar, or press S. A dashed line appears at the middle; drag it to choose where to cut, and it snaps to the 12-column grid and to edges elsewhere on the canvas. The original contents stay in the first half and the new half is empty, waiting for tiles from the same session. Dropping a tile from Sources onto the right or bottom quarter of a box does the same split in one move, with the tile in the new half. Refused when either half would fall below the minimum box width, with a line saying how much room is needed.

**Merge.** Select two neighbouring boxes and choose Merge. It's only offered when they share a full edge, so the result is a rectangle, and when both hold tiles from the same session. Tiles join in build order, never in the order they were selected. Two boxes from different sessions show Merge greyed out, with "These boxes hold different sessions" on hover.

**Shared edge.** Hover the gutter between boxes and the pointer becomes a resize arrow. Dragging moves the edge and resizes every box that touches it on both sides, so the canvas stays full. A readout shows both widths as they change, and the edge snaps to grid lines and to other edges it passes. Holding Alt drags a single box's edge only where that doesn't open a gap, otherwise it falls back to the shared drag. Box heights work the same way, except a box can't be dragged shorter than its contents.

**Span.** Stretches a box across the full width of its row, pushing its neighbours to the row below in reading order. Used for a Result, an intro or a session that deserves room. Offered only when moving the neighbours down keeps the build's order; otherwise the bar says which tile would end up out of order.

**Even out.** Select a row or column of boxes and choose Even out: their shared edges move so they're all the same size, within the space they already take. Nothing outside the selection changes.

**Match.** Select boxes anywhere and choose Match width or Match height to give them the size of the first one selected. Their neighbours adjust through shared edges, so the canvas stays full. If matching would push a neighbour below the minimum size, Match is refused and says which box is in the way.

### Moving things

**Dragging a box.** Press on a box's title bar and drag. The box lifts and the canvas shows every place it could go: the edges of other boxes where it can be inserted (a split happens there when you drop), and boxes it could swap with. Places that would break the order are dimmed, and hovering one shows why: "Ship comes after Route." When you drop, the box's old space goes to its neighbour and the new space is split out for it, so the canvas stays full. Its explanation, style and contents come with it.

**Swap.** Drop a box directly onto another box to trade places and sizes. It's only offered when both boxes can sit in each other's position without breaking the order. Two boxes from sessions that ran side by side can always swap; two steps that run in sequence can't. The target shows a swap outline when it's allowed, and a dimmed fill with a reason when it isn't.

**Dragging tiles between boxes.** Drag a tile out of a box and onto another box from the same session to move it there; it lands in its build-order position. Drop it on the edge of a box to split a new box for it. Drop it on a box from another session and it's refused: "Prompt 4 is in Session 2. This box holds Session 1." The last tile can't be dragged out of a box; remove the box instead, which returns its tile to Sources.

**Keyboard.** Every action works without a pointer. Tab moves through boxes in reading order and arrow keys move between tiles inside them. Enter on a box enters it; Escape leaves. M picks up the selected box or tile, arrow keys move it between allowed positions (forbidden ones are skipped and announced), and Enter drops it. Every move is announced to screen readers in plain words: "Box Ship moved to the right of Route, row 3."

### Grouping

**Frame.** In Sources, each session and part row has a frame button. Pressing it on a session wraps all of that session's boxes in a session region, as long as they already form a rectangle together. If they don't (another session's box sits in between), the canvas proposes the smallest rearrangement that makes them one, previews it, and waits for you to accept. Nothing moves until you do. A framed region has a tab with its name, an optional explanation line, and its own fill and border. Dragging the tab moves the whole region; dragging its edges resizes everything inside proportionally. Part frames work the same way one level up, and can only contain whole session regions or interleaved boxes from that part.

**Opening a frame.** Choose Open frame on a region's tab and its boxes become loose siblings again, in exactly the same places. This is how a maker interleaves sessions: open the frames, then slide session 2's first box beside the late box of session 1 that uses it. The order check still applies, so the box can sit level with the tile that uses it or before it, never after.

**Outlines.** For loose boxes there's a lighter option than a frame: Outline, from the same Sources row. It draws a thin right-angled line around all of a session's boxes wherever they are, following the gutters, and redraws itself whenever a box moves. An outline doesn't own its boxes, so it never stops anything moving. Sessions and parts can be outlined at the same time, with parts dashed so the two read apart.

All three only describe the build's existing compartments. There is no tool to group tiles from different sessions, because that grouping doesn't exist in the build.

### Inside a box

**Layout.** The box's floating bar has Stack, Across and Grid. Switching re-flows the tiles in build order with the same spacing, and the box grows or shrinks in height to fit while its neighbours adjust through the shared edges. In Grid a second control sets two or three columns. If Across would make tiles narrower than their minimum, the box offers to widen itself first.

**Reorder.** Drag a tile up, down or across inside its box. A line shows where it will land. Positions that would put it before a tile it comes after are skipped, so a tile can only move within the range the build allows. In practice that's mainly tiles from the same moment, such as a tool and the agent that uses it.

**Indent.** Drag a tile right by one step, or press Tab with it selected, to place it under the tile above; Shift and Tab brings it back. It gets a thin bracket and a slightly smaller title. Three levels at most. Indenting never changes order: an indented tile still sits after the one above it.

**Show.** Selecting a tile shows a bar of checkboxes for the parts it actually has: Text, Settings, Files, Code, Picture. Parts the tile doesn't have aren't offered. Switching one on adds it in its fixed place in the tile's format, and the box grows to fit.

**Notes and explanations.** Click the line under a box or region title to write its explanation. Choose Add note on a tile to attach a short note beside it, joined by a leader line that the box lays out for you. Notes belong to the tile, so they move with it. Placeholders never appear on the published map.

### Lines

**Build links.** Every use in the build can appear as a line, from the tile that is used to the tile that uses it, with an arrow at the user's end. The maker chooses which lines show, per line or with "Show all". Lines can't be drawn between tiles that have no link, so the map never claims a dependency the build doesn't have. Checks get a dashed line to what they test.

**Routing.** Lines are routed automatically: they leave a tile's edge, travel only through gutters at right angles, and enter the other tile's edge. They never cross a box. When several share a gutter they run side by side at an even spacing. A maker can drag a line's middle segment to a different gutter; the line keeps its right angles and snaps to the gutter's centre. Moving a box re-routes its lines straight away.

**Two-way arrows.** A two-way arrow says two things happened at the same time. It can join two tiles, or two boxes. Two rules keep it consistent with everything else:

- **Only between things that can be simultaneous.** That means tiles or boxes from different sessions with no use linking them. Between things in sequence the tool shows "These happen one after the other" and won't draw.
- **Always level.** Things that happen at the same time share a band (see The order the canvas can never break), so they sit side by side. A two-way arrow is therefore always a straight horizontal line through the gutter between them, with an arrowhead at each end, never a bent or diagonal one. If the two ends aren't level, the tool offers to slide one into the other's band first, if the order allows.

To draw one, choose Arrow, then Two-way, then drag from one tile or box to the other. Where the build already says two sessions ran side by side, the canvas suggests the arrow once between their first boxes, and the maker adds or dismisses it.

**Hiding.** Any line can be hidden without affecting the build. A small counter in the toolbar says how many links are hidden, so a reader is never misled into thinking a link doesn't exist.

### Style and helpers

**Box style.** A selected box or region shows Fill, Border (Line, Dashed, None) and Corners on its floating bar. Fills come from a short palette of tints checked for contrast against every canvas background, so text stays readable whatever the maker picks. Style can be copied from one box and pasted onto others, which keeps a map consistent without hunting for the same tint.

**Canvas background.** The Background button sets one colour for the whole canvas from presets or a hex value, and switches the dot grid on or off. On light backgrounds, text and line colours flip automatically. The reader sees the same background.

**Numbers.** Build, Session or Part, from the toolbar. Every tile badge changes at once. Numbers always come from the build, so moving a box never renumbers anything, and the scheme is a display choice only.

**Tidy.** One button that cleans up without redesigning. It snaps edges that are within a few pixels of each other, evens out sizes that are within a few percent, straightens lines that bend for no reason, and removes empty boxes by giving their space to a neighbour. It previews the changes, and it never changes order, grouping or anything inside a box.

**Collapse.** Folds a box or region to one line: its title, its tile number range and its tile count. Neighbours take the freed height. Useful for shaping a 50-tile build before dressing each box. Collapsed boxes can be published collapsed, and readers can open them.

**Start from the build.** Rebuilds the plain arrangement worked out from the build, keeping explanations, notes and styles attached to their tiles and regions. It asks first, because it replaces the layout.

**Undo.** Every action above is one step, undone with Ctrl and Z and redone with Ctrl, Shift and Z, including the automatic adjustments a move caused. The layout saves after each step, as the rest of the composer does.

## Keeping freedom from turning into clutter

Clutter comes from choices that have no rule behind them. The structured sandbox fixes the few choices that make a page feel composed, and leaves everything else open.

**Fixed, so the map always feels the same:**

- One gutter between all boxes, and one padding inside every box.
- One type scale: box title, explanation, tile title, tile text, note.
- One tile format, with parts that switch on and off but never move.
- Lines run at right angles and only through gutters. Where several run side by side they bundle with an even gap, and they never cross a box.
- At most three levels inside a box and two levels of frames (part, then session).

**Open, so every map is the maker's own:**

- How the canvas is divided, how big each box is and where it sits, within the order rules.
- Whether sessions are framed or interleaved.
- What each box shows, how it's laid out inside, and what the explanations say.
- Colours, from a palette that's checked for contrast on every background.

Two helpers keep a busy map in shape:

- **Tidy** evens out near-equal sizes, snaps stray edges to the grid and straightens lines that bend for no reason. It never changes the order or the grouping.
- **Collapse** folds a box down to its title, number range and tile count. A maker can then shape a large build at a glance before opening the boxes they want to dress.

The test for any new feature: does it give the maker a real choice about arrangement without letting them break content, order or the full rectangle? If it does, it fits. If it adds a choice no reader would notice, it's clutter.

## Canvas size, readers' screens and builds with 50 tiles

The canvas has a width the maker chooses and a height that comes from what's in it. Small builds make small canvases; large builds make tall ones that scroll.

**Width.** The maker drags the canvas's right edge, snapping to a few widths that read well (narrow, standard, wide). Every box is stored as a proportion of its parent, so changing the width rescales the layout without breaking it. Boxes have a minimum width; if a region would get narrower than that, the canvas refuses the width.

**Height.** Each box is as tall as its contents need, or taller if the maker drags its bottom edge. A row of boxes takes the height of the tallest, and the canvas height is the sum of its rows. A three-tile build might fill one screen. A fifty-tile build in eight sessions might be four screens tall. Both are still one filled rectangle.

**Big builds.** At fifty tiles the editor needs help finding its way, and the reader does too:

- The canvas scrolls vertically inside the Map tab, with a minimap showing the whole rectangle and where you are.
- Selecting a session or part in Sources scrolls to its region and briefly highlights it.
- Collapsed boxes keep big sessions to one line while the maker shapes the rest.
- Only boxes near the screen are fully drawn, so scrolling stays smooth.

**Readers' screens.** On the build page the map is shown at the reader's width. Because proportions are stored, it scales down evenly on a laptop. Below phone width, side-by-side boxes stack in reading order, which is exactly the build's order. That's another reason the order rules matter: the phone view works without a separate layout.

## What a new map starts as

Because the canvas must always be full, it can't start empty. I'd start every map from a plain arrangement worked out from the build, and let the maker reshape it from there.

The starting arrangement is deliberately simple and always valid:

- One region per part, stacked in build order.
- Inside each part, one box per session. Sessions that ran side by side sit side by side; sessions that ran one after another stack.
- Inside each box, its tiles in Stack layout, in build order, with the text part showing.
- A Result tile, if there is one, gets a full-width box at the end.

That gives every build a correct, readable map in its first second. Everything after that is the maker's: splitting a session's box so its first tile lines up with the late tile that uses it, widening the Result, framing a part, writing explanations, picking colours.

If the maker wants to start over, "Start from the build" puts the plain arrangement back. Their explanations and style choices stay attached to their tiles and regions.

### Decisions

Each open choice is settled by the rule it sits closest to, so the map behaves one way throughout.

1. **Regions are framed by default.** Simple builds stay tidy. A maker opens a frame only when they need to interleave sessions, and the order check still applies.
2. **The Result goes at the end.** That's where the order puts it. It can Span the full width, so it still reads as the outcome without breaking chronology.
3. **Width is free and snaps to the 12-column grid,** with a minimum box width. That's the same snapping every edge uses.
4. **Two-way arrows join tiles or boxes that can be simultaneous, and are always level,** as straight horizontal lines between items in the same band.
5. **The layout is saved as a split tree in `builds.making.map_layout`** and read again whenever tiles change. A tile that no longer exists shows as "removed from the build" in its box until the maker removes it.

## A chat can write the map

Once a build is done, arranging 9 or 50 tiles by hand can take longer than saying how the map should look. So the Map tab gives the maker a second way in: copy the build out as a Markdown file, describe the map to any chat or harness in plain words, and drop the file it writes back onto the canvas. What comes back is an ordinary map. Every formatting tool still works on it afterwards.

This follows a pattern the repo already has. `toMarkdown` in `portable.ts` turns a build into a document a language model can act on, and `useBuildFileDrop` reads a Build File dropped on a page, parses it into a proposal and stops there, leaving the maker to review it. The map file does the same for layout.

### Copy for chat

A **Copy for chat** button in the Map toolbar copies one Markdown file to the clipboard, or downloads it as `<build>.for-chat.md`. It has four parts:

1. **The build:** parts, sessions and every tile by number, kind, title and what it uses.
2. **What can run at the same time:** the pairs with no link between them, the only pairs a two-way arrow may join.
3. **How to write a map file:** the format and an example. The chat needs no other instructions.
4. **The current map file,** when a map already exists, so a chat can change a map as well as start one.

Prompt text, code, files and settings stay out. The chat sees titles, not content.

### The map file

Plain Markdown that a person can read and edit too. A header names the format version, the build, the width, background and numbering. Each `## Row` is a full-width strip, read top to bottom. Each `- Box` names its session, its columns out of 12 and its tiles by number, with optional layout, notes side, indents, fill, border and collapsed. `- Column` stacks boxes inside one column. Under a box: `Title:`, `Explanation:` and `Note N:`. `Frame:` under a row draws a part frame round it. `## Two-way` lists pairs such as `1 <-> 4`. The file never holds pixel sizes, bands or lines.

### The drop check

The file can be dragged onto the Map tab, opened from **Open file**, or pasted. It is checked against the same rules as a drag, and nothing changes until **Replace map**. Undo brings the old map back.

- **Refused:** a different build, a format version the canvas can't read, or a file that places no tiles.
- **Fixed and listed:** columns not adding up to 12 are scaled; a tile listed twice keeps its first place; a box holding two sessions is split; a box above a tile it depends on moves down to the first row where order holds; a two-way pair that depends on each other is removed, and ends that aren't level slide into the same band.
- **Left out and listed:** tiles missing from the file stay unplaced; lines written by the chat are ignored.

Nothing is dropped without being listed, the principle `buildfile.ts` follows for Build Files. The chat never changes the build: it can only arrange tiles that already exist, by number.
