

## Plan: Dark-on-light theme conversion + dark grid background

### What needs to change

The entire app was built with a dark theme (white text on dark surfaces). Now that the background is light (#EDEDEF), all internal colors need to flip to dark-on-light: dark text, dark borders, dark surface tints, etc. Additionally, a subtle dark grey dot/line grid needs to be added to the background.

### Changes

**1. `src/index.css` — Global theme variables and overrides**
- Flip `:root` CSS variables: `--text` to `rgba(0,0,0,0.85)`, `--text-muted` to `rgba(0,0,0,0.45)`, `--border` to `rgba(0,0,0,0.08)`, `--surface` to `rgba(0,0,0,0.03)`, etc.
- Update shadcn/ui layer variables to light theme values (light backgrounds, dark foregrounds)
- Fix input/textarea styles: dark text, dark borders, light surface backgrounds
- Fix scrollbar thumb to dark grey
- Fix `.mention-link` and other utility classes

**2. `src/components/NeoScaleShell.tsx` — All inline CSS (~750 lines of CSS)**
Every `rgba(255,255,255,...)` needs to become `rgba(0,0,0,...)` equivalent:
- **Left panel**: nav labels, icons, dividers, user section, auth buttons, user menu — all to dark text/borders
- **Middle panel**: design tokens (`--mp-text`, etc.), feed skeletons, page headers/titles, back button, outlet overrides, glass input, glass card, section labels — all to dark-on-light
- **Right panel**: titles, search bar, tiles, trending items, curator/collection/follow items, footer links — all to dark text/borders
- **Feed tabs, badges**: adjust for light background contrast
- Surface backgrounds: change from `rgba(255,255,255,0.03)` to `rgba(0,0,0,0.03)` or similar light-appropriate tints
- Hover states: `rgba(0,0,0,0.06)` instead of `rgba(255,255,255,0.04)`
- `.ns-page-title` color: `#1a1a1a` instead of `#fff`
- User menu background: light (`rgba(255,255,255,0.95)`) instead of dark
- Auth buttons: dark text, light borders

**3. `src/components/BlobBackground.tsx` — Add dark grey grid**
- Render an SVG grid pattern (subtle dark grey lines or dots on the #EDEDEF background)
- Fixed position, full viewport, pointer-events none, z-index 0
- Grid spacing ~40px, line color ~`rgba(0,0,0,0.06)`

**4. `src/components/feed-card.tsx` and `src/components/ReblogFeedCard.tsx`** — If they use inline dark-theme colors, flip those too.

### Scope
This is a large cosmetic sweep across ~800 lines of CSS in NeoScaleShell plus global styles. No logic changes — purely color values.

### Files
| File | Change |
|------|--------|
| `src/index.css` | Flip all CSS variables and global styles to light theme |
| `src/components/NeoScaleShell.tsx` | Flip all ~750 lines of inline CSS from white-on-dark to dark-on-light |
| `src/components/BlobBackground.tsx` | Add dark grey SVG grid pattern |
| `src/components/feed-card.tsx` | Flip any inline dark-theme colors |
| `src/components/ReblogFeedCard.tsx` | Flip any inline dark-theme colors |

