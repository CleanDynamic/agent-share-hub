## Toolbar cleanup

Remove the following from the article editor top toolbar:

**Inline formatting group** (`src/components/article/TopToolbar.tsx`)
- Strikethrough button
- Subscript button
- Superscript button

**Alignment group** (`src/components/article/TopToolbar.tsx`)
- Line height dropdown (the `1.5 ⌄` selector)

**Review / view groups** (`src/components/article/TopToolbar.tsx`) — both entire groups in screenshot 1, plus their leading dividers:
- Spell check, Comment, Word count, Track changes
- Zoom, Focus mode, Outline panel, Inspector panel, Toolbar options

**Stage templates** (`src/components/article/stage/StageGridFrame.tsx`)
- The "Templates" pill button in the bottom overlay of each Stage Grid frame

Bold, Italic, Underline, Inline code, color pickers, alignment buttons, indent/outdent, lists, insert-block group, and undo/redo all stay.

No new components, no style changes, no behavior changes elsewhere — pure deletions.
