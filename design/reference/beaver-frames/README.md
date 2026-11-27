# Beaver refresh frames

16 frames of the beaver dunking and resurfacing, used by the pull to refresh on the phone Home (prompt `design/prompts/mobile/29a-feed-x-proportions-and-beaver-refresh.md`).

- `frame-01.png` to `frame-16.png`: the source frames, 512 x 460, on black, every frame aligned to one waterline at y 262 and one content box starting at x 27, 452 wide. Kept here for editing; the app does not load them.
- The app loads `public/brand/beaver-frames.webp`: the same 16 frames scaled to 384 x 345 on a transparent background, in a 4 x 4 grid (waterline y 196.5, content box x 20.25, 339 wide).

Frames 1 to 4 follow the pull, 4 to 9 are the dunk, 9 to 11 loop while loading, 11 to 16 are the rise. To change a frame, edit its PNG, keep the waterline and content box, and rebuild the webp grid from all 16.
