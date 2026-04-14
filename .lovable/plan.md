
Fix the black middle panel by removing the remaining hardcoded dark canvas backgrounds that are overriding the shell.

Step 1 — Fix the actual source of the black surface  
`src/components/NeoScaleShell.tsx` is already correct: `.ns-outlet-wrap` uses `rgba(200,200,210,0.04)`. The problem is deeper inside the upload/editor stack:
- `src/pages/Upload.tsx` article-mode wrapper still sets `background: 'rgba(6,6,10,0.65)'`
- `src/components/canvas/CanvasShell.tsx` still sets `background: 'rgba(6,6,10,0.65)'`

Those two layers repaint the middle panel black even though the shell itself is grey.

Step 2 — Make the upload/article surface inherit the shell glass  
In `src/pages/Upload.tsx`, change the top-level article-mode wrapper from black to either:
- `background: 'transparent'`, or
- `background: 'rgba(200,200,210,0.04)'`

I’d use transparent for the outer wrapper so the shell panel shows through, and keep any intended tint on inner article surfaces only.

Step 3 — Update CanvasShell to the new light-grey article/canvas surface  
In `src/components/canvas/CanvasShell.tsx`, replace the root black background with the same glass tint used by the shell:
```ts
background: 'rgba(200,200,210,0.04)'
```
This keeps the current canvas architecture intact while making full-canvas and embedded usages visually consistent.

Step 4 — Normalize the article/editor interior panels  
To avoid the page still feeling too dark even after the outer surface is fixed:
- keep `ArticleEditor` prose surface transparent or very lightly tinted
- keep `StageGridNode` at `rgba(200,200,210,0.06)` with subtle border
- preserve block cards as darker translucent micro-surfaces so they still read against the lighter panel

This matches the “microcosms of the current canvas” direction without stripping the canvas system.

Step 5 — Verify there are no more middle-panel overrides  
After the background swap, check the upload flow for any remaining black fills in:
- article editor wrapper
- canvas root
- middle panel back face
- stage grid body
- toolbar anchoring area

Technical details  
Current root cause confirmed from code:
```ts
// src/components/NeoScaleShell.tsx
.ns-outlet-wrap {
  background: rgba(200,200,210,0.04);
}
```

```ts
// src/pages/Upload.tsx
background: 'rgba(6,6,10,0.65)'
```

```ts
// src/components/canvas/CanvasShell.tsx
background: 'rgba(6,6,10,0.65)'
```

Files to update
- `src/pages/Upload.tsx`
- `src/components/canvas/CanvasShell.tsx`

Expected result
- the middle upload/canvas page matches the side-panel grey translucent glass
- the canvas system remains fully preserved
- embedded stage grids still feel like mini canvases, but the overall article surface is light grey and readable instead of black
