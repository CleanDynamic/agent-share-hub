## Goal

Make embedded stage grids feel like an inline image in the document: a single clean rectangle that sits in the prose with subtle edges, no permanent toolbars, no white React Flow widgets. Controls only appear on hover.

## Why the current version feels broken

Looking at the screenshot:

1. The frame stacks **three rows of chrome**: 36px header (badge + title + buttons), the canvas, then a 36px footer (+Text/+Prompt/+Code/+Result chips + zoom + minimap toggle), plus a 6px resize gripper. That's ~78px of UI wrapping an empty canvas — heavier than the content itself.
2. React Flow's `<MiniMap />` renders with its **default white background** in the bottom-right corner — that's the white box in the screenshot. It clashes with the dark theme.
3. The frame's max width (`max-w-[720px]`) is wider than the prose column (`max-w-[720px]` minus 48px of padding), so the grid visually breaks out of the text column instead of aligning with it.
4. Default height is 400px and the dot-grid background pattern is duplicated in both the frame and React Flow — visual noise.

Net effect: the grid looks like a separate "app card" pasted into the document, not an embedded element.

## Design — the new embed

A stage grid should read as **one rectangle** sitting in the prose, like a figure:

```text
┌──────────────────────────────────────────┐
│  [hover] ① Stage 1   0 blocks   ⋯  ✕    │   ← header only on hover
│ · · · · · · · · · · · · · · · · · · · ·  │
│ · · ·  (React Flow canvas, dark) · · · · │
│ · · · · · · · · · · · · · · · · · · · ·  │
│           [hover] + Text  + Prompt …     │   ← footer only on hover
└──────────────────────────────────────────┘
                  ═══                          ← thin resize handle on hover
```

Key principles:
- **One container, one border.** No header strip, no footer strip baked in. Controls float over the canvas and fade in on hover.
- **Width matches prose.** The grid spans the same 720px as the surrounding paragraphs — never wider, never narrower.
- **Dark all the way through.** No white React Flow widgets. Minimap removed; zoom controls hidden by default.
- **Quieter default height.** 280px instead of 400px so it doesn't dominate the page.
- **Subtle, single-pixel edge** that matches the article's other embedded blocks (images, code blocks).

## Changes

### 1. `src/components/article/stage/StageGridFrame.tsx` — rewrite the chrome

- Remove the always-visible header bar and footer bar.
- Wrap the canvas in a single rounded rectangle: 1px border at `rgba(255,255,255,0.08)`, no backdrop blur, no drop shadow (matches `.tiptap-article img` styling).
- Add a **hover overlay header** (absolute, top, fades in with `opacity` on container hover): just the stage badge `①`, the editable title, block count, and a small `⋯` / `✕` cluster on the right. ~28px tall, semi-transparent dark gradient bar so it floats over the canvas.
- Add a **hover overlay footer** (absolute, bottom, same fade pattern): the four `+ Text / + Prompt / + Code / + Result` chips. Drop the zoom controls and minimap toggle entirely — zoom lives inside React Flow's own controls if needed later.
- Resize handle stays but becomes a 4px hairline at the bottom edge, only visible on hover.
- Default `height` prop becomes 280, clamp range becomes 200–600.
- Drop `widthClasses` — always render at `width: 100%; max-width: 720px` to match the prose column. Remove the `widthMode` prop usage (keep it in the interface as a no-op so callers don't break).
- Remove the inner dot-grid background (`radial-gradient`) — React Flow already renders dots, doubling them creates moiré.

### 2. `src/components/article/stage/StageCanvas.tsx` — remove white widgets

- Delete the `<MiniMap />` element entirely (this is the white box in the screenshot).
- Keep `<Background>` dots but bump `color` to `rgba(255,255,255,0.06)` so they read as subtle texture, not a grid.
- Add a wrapping `<style>` (or inline style on the React Flow root) that sets the React Flow pane background to `transparent` so the frame's color shows through. Specifically override `.react-flow__pane`, `.react-flow__background`, and `.react-flow__minimap` (defensive, in case it ever returns) to transparent / dark.
- Remove `fitView` default — with no blocks it leaves the canvas in an awkward zoom state. Use a fixed default viewport instead.

### 3. `src/components/article/StageGridNode.tsx` — match new defaults

- Change `persistedHeight` fallback from 400 to 280.
- Update the `handleResize` clamp from `(280, 800)` to `(200, 600)` to match the frame.
- Drop the `widthMode` plumbing (always wide / column-width).

### 4. `src/components/article/ArticleEditor.tsx` — small spacing fix

- The TipTap CSS already gives images `margin: 12px 0`. Add the equivalent rule for `[data-stage-grid]` so the embedded grid has the same vertical rhythm as an image: `margin: 16px 0; border-radius: 8px;`.
- No changes to the toolbar or the Insert Grid button.

### Files touched

- `src/components/article/stage/StageGridFrame.tsx` — major rewrite (chrome → hover overlays)
- `src/components/article/stage/StageCanvas.tsx` — remove MiniMap, transparent React Flow background
- `src/components/article/StageGridNode.tsx` — update default height + clamp
- `src/components/article/ArticleEditor.tsx` — add `[data-stage-grid]` spacing rule

### Out of scope (intentionally)

- The `StageGridExtension`, the slash-command insertion path, and the document store wiring all stay exactly as they are. This is a visual cleanup, not a logic change.
- Zoom controls and minimap can return later as a hover-only popover if needed — for now they're removed because they're the source of the white-box artifact and they aren't useful on a 280px embed.
- The 4 protected files (`AppLayout.tsx`, `LeftPanel.tsx`, `RightPanel.tsx`, `BlobBackground.tsx`) are not touched.

## What you'll see after

- A stage grid inserted via the Insert Grid button or `/stage` appears as a clean dark rectangle the same width as the prose, ~280px tall.
- Hovering it reveals a thin top bar with the stage name and a thin bottom bar with the +Text/+Prompt/+Code/+Result chips, then they fade out when the cursor leaves.
- No white minimap, no double border, no chunky toolbar — it sits in the document like an image or code block does.
