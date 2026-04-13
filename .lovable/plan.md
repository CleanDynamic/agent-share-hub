

## Revamp: Match reference block aesthetic, dark pastels, and grey grid background

### 1. Background: Add grey dot grid overlay

**File: `src/components/BlobBackground.tsx`**

Add a CSS background-image layer with a repeating dot grid pattern (small grey dots at ~20px intervals) on top of the existing dark radial gradients. This matches the subtle grid visible in the reference images.

```
background:
  radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px),  /* grid dots */
  radial-gradient(ellipse 60% 50% at 20% 40%, rgba(46,196,182,0.07) ...),
  ...
  #07070D
background-size: 20px 20px, 100% 100%, 100% 100%, ...
```

### 2. Canvas blocks: Match reference card aesthetic

**File: `src/components/canvas/CanvasBlock.tsx`**

The reference image shows blocks styled as:
- Dark translucent cards with subtle rounded borders (`rgba(255,255,255,0.10)` border, ~10px radius)
- Coloured square icon badge (solid blue, pink, etc.) in the top-left header row
- Type label pills (e.g. "filter", "Lists", "Delay", "Infinite", "Condition") as small rounded chips with dark bg + subtle border
- Large light text content inside the card body
- Blue dot connection points on edges
- No accent bar at the top — instead, the colored badge square serves as the type indicator

Changes to CanvasBlock:
- **Remove** the 2px accent bar at top
- **Replace** the header row with: a small solid-colour square (using the accent colour), followed by the type label as a rounded chip, and optional secondary chips right-aligned
- **Update** card background to `rgba(20,20,28,0.75)` with `border: 1px solid rgba(255,255,255,0.10)`, `border-radius: 10px`
- **Update** snap dots from orange to `#3B82F6` (blue) to match reference
- **Update** text content area to use larger, lighter text (~16px, `rgba(255,255,255,0.55)`)
- **View mode** cards: same treatment — dark translucent bg, rounded border, no top accent bar, coloured badge square instead

### 3. Block accent colours: Switch to dark pastels

**File: `src/components/canvas/CanvasBlock.tsx`**

Replace the current vivid `BLOCK_ACCENT` palette with dark pastel variants inspired by the uploaded colour swatch:

| Type | Current | New (dark pastel) |
|------|---------|-------------------|
| prompt | `#E8571A` | `#8B4513` (dark brown) |
| code | `#3B82F6` | `#2E5A88` (dark blue) |
| result | `#22C55E` | `#2D6B4F` (dark green) |
| agent_config | `#7C3AED` | `#5B3A7A` (dark purple) |
| workflow | `#2EC4B6` | `#1F7A6D` (dark teal) |
| comparison | `#EC4899` | `#7A3050` (dark rose) |
| image | `#F59E0B` | `#8B6914` (dark gold) |
| tutorial_step | `#E8571A` | `#6B3A2A` (dark sienna) |
| tool_setup | `#06B6D4` | `#1A5E6B` (dark cyan) |
| model_params | `#A78BFA` | `#5A4F7A` (dark lavender) |
| sticky_note | `#FBBF24` | `#7A6B2A` (dark amber) |
| video | `#EC4899` | `#6B2A4A` (dark magenta) |

### 4. Site-wide colour tokens: Dark pastels

**File: `src/components/NeoScaleShell.tsx`**

Update the shell's `--mp-orange` and `--mp-teal` tokens to darker pastel variants:
- `--mp-orange: #8B4513` (from `#E8571A`)
- `--mp-teal: #1F7A6D` (from `#2EC4B6`)

Update any remaining vivid orange/teal references in the shell CSS to their dark pastel equivalents (active nav underlines, badges, category pills, etc.).

**File: `src/lib/canvas-types.ts`**

Update `ARROW_TYPE_META` colours to dark pastel equivalents matching the new palette.

### 5. Canvas DotGrid: Align with background grid

**File: `src/components/canvas/DotGrid.tsx`**

Increase dot opacity from `0.04` to `0.07` and dot radius to match the background grid dot size for visual consistency.

### Files to change
| File | Summary |
|------|---------|
| `src/components/BlobBackground.tsx` | Add repeating grey dot grid layer |
| `src/components/canvas/CanvasBlock.tsx` | Restyle blocks to match reference — remove accent bar, add colour badge square, chip labels, dark translucent cards, blue snap dots, larger body text |
| `src/components/canvas/DotGrid.tsx` | Increase dot visibility |
| `src/components/NeoScaleShell.tsx` | Update colour tokens to dark pastels |
| `src/lib/canvas-types.ts` | Update arrow type colours to dark pastels |

