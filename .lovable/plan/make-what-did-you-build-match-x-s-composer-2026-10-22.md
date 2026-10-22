# Make "What did you build?" match X's composer

## What changes
1. **Remove the "Add another post" row** (the faded avatar + "Add another post" line under the first post). The + button on the toolbar stays and is the only way to start another post.
2. **Match X's layout and proportions** (from your X screenshot):
   - Avatar 40px at the left, words start 12px to its right, first line lines up with the avatar's centre (X sets the text about 8px below the avatar's top).
   - Placeholder "What did you build?" at X's size (about 20px, regular weight), in the faded text colour.
   - Toolbar sits directly under the words, starting at the same left edge as the words (not under the avatar), about 12px below the text — the gap is much smaller than now.
   - Drop the hairline line above the toolbar (X has none here), and the divider line under the whole composer is kept only as the section break before "Build".
   - Toolbar icons evenly spaced at X's rhythm (about 36px per icon, 20px icons); character ring, divider and + stay on the right, aligned with the row like X's "Post" button.
3. Later posts in a thread (after pressing +) keep the same spacing, so each reads like an X reply in a thread.

## Not changing
Sessions list, Build section, Details panel, publishing, how posts are saved.

## Technical details
- `src/pages/site/compose/PostTab.tsx`: delete the `AddPostRow` render (and the unused component); tune `RAIL_GAP`, `FIRST_LINE_DROP`, and the column gap between words and toolbar.
- `src/components/post/editor/PostToolbar.tsx`: remove `borderTop`/`paddingTop` on the tool row; adjust tool spacing.
- `src/components/post/editor/extensions.ts`: the empty-post placeholder for later posts stays ("Add another post" only shows inside a new empty post created with +); composer type size checked against X.
- Update any tests that look for the add-post row; check desktop and phone, both themes, by screenshot against the X reference.
