

## Refine Upload Page — Nielsen's 10 Heuristics

Applying all 10 usability heuristics to the canvas-based upload editor.

### Issues identified

1. **No Save/Publish buttons** — The toolbar shows Templates/History/Notes but no way to save or publish. Users have no clear path to completion.
2. **No system status** — No progress indicator, no autosave feedback, no block count. Users don't know where they are in the process.
3. **No undo/back** — Can't return to the type chooser or undo block deletions. No "back" button once in the canvas.
4. **Block picker cuts off screen** — Already partially fixed but still uses fixed positioning that can clip.
5. **No confirmation before destructive actions** — Delete block has no confirmation.
6. **No inline help or tooltips** — Block types have no descriptions; new users don't know what "Agent" or "Model" means.
7. **No validation before publish** — Can publish with empty title or no blocks. No error messages guiding the user.
8. **Toolbar lacks visual hierarchy** — Save and Publish should be prominent, not hidden or missing entirely.
9. **No keyboard shortcuts** — No accelerators for power users (Ctrl+S to save, etc.).
10. **"unsaved" label is too subtle** — Dirty state indicator is barely visible.

### Changes

**File: `src/components/canvas/CanvasToolbar.tsx`** — Full rewrite
- Add **Save Draft** button (secondary style) and **Publish** button (primary, orange accent)
- Show saving/submitting spinners (Heuristic 1: visibility of system status)
- Show block count badge (e.g. "4 blocks")
- Show autosave status: "Saved" / "Saving..." / "unsaved" with appropriate colors
- Add a **Back** button (← arrow) to return to type chooser (Heuristic 3: user control)
- Add keyboard shortcut Ctrl/Cmd+S for save (Heuristic 7: flexibility)
- Add a subtle divider between navigation actions (Back) and content actions (Save/Publish)
- Wrap toolbar in a glass-card pill for visual grounding

**File: `src/components/canvas/CanvasShell.tsx`**
- Pass `onBack` prop through to toolbar
- Add `blockCount` to toolbar props

**File: `src/pages/Upload.tsx`**
- Pass `onBack={() => setShowTypeChooser(true)}` to CanvasShell
- Add pre-publish validation: require title (min 1 char) and at least 1 block, show toast errors (Heuristic 5, 9: error prevention and recovery)

**File: `src/components/canvas/CanvasInsertZone.tsx`**
- Add short tooltip descriptions to each block type in the picker (e.g. "Prompt — Write an AI prompt", "Agent — Configure an AI agent") (Heuristic 6: recognition over recall, Heuristic 10: help)
- Ensure picker is viewport-clamped on all edges

**File: `src/components/canvas/CanvasBlock.tsx`**
- Add a confirmation step to the Delete button: first click shows "Confirm?", second click deletes (Heuristic 5: error prevention)

### Heuristic coverage

| # | Heuristic | How addressed |
|---|-----------|---------------|
| 1 | System status | Save state indicator, saving spinners, block count |
| 2 | Match real world | Block type tooltips use plain language |
| 3 | User control | Back button, undo-delete confirmation |
| 4 | Consistency | Toolbar follows same glass-card style as rest of UI |
| 5 | Error prevention | Delete confirmation, pre-publish validation |
| 6 | Recognition > recall | Block type descriptions in picker |
| 7 | Flexibility | Ctrl+S shortcut |
| 8 | Aesthetic minimalism | Clean toolbar with clear visual hierarchy |
| 9 | Error recovery | Toast messages with specific guidance on what's missing |
| 10 | Help | Tooltips on block types |

