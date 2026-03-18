

## Plan: Compact Clickable Feed Cards

### Scope
Three components need updating:
1. **`FeedItem` in `src/pages/Home.tsx`** (lines 80-139) — used by Recent, Following tabs
2. **`TrendingFeedItem` in `src/pages/Home.tsx`** (lines 143-188) — used by Trending tab
3. **`ForYouTab` inline card in `src/pages/Home.tsx`** (lines 344-361) — wraps FeedItem with interaction context
4. **`/recent` page feed items in `src/pages/Recent.tsx`** (lines 180-258) — completely different layout, needs to match

The `ContentCard` on Browse and the `/feed` page (Feed.tsx) are **not** touched.

### Changes

**1. Extract a shared `FeedItem` component to `src/components/FeedItem.tsx`**

A single reusable component used by Home.tsx (all 4 tabs) and Recent.tsx. Props: `item` (content data with profiles), optional `rank` (for trending).

Layout (top to bottom, Twitter-style):
- **Card wrapper**: `<div>` with `onClick → navigate(/content/:id)`, `cursor-pointer`, hover bg `rgba(255,255,255,0.03)`, padding `12px 16px`, border-bottom `1px solid border` color. No rounded corners, no card border — just a flat row with bottom separator.
- **Line 1 — Header**: 36px Avatar (initials, clickable → `/creator/:username` with stopPropagation), display_name (bold 14px, clickable, stopPropagation), @username (muted 13px), `·`, timeAgo (12px muted), bookmark icon (far right, stopPropagation).
- **Line 2 — Badges**: content_type badge + difficulty badge, 4px below header.
- **Line 3 — Title**: 15px font-weight-600 white, max 2 lines with `line-clamp-2`, 4px below badges.
- **Line 4 — Description**: 13px muted, max 1 line `truncate`, 2px below title. Skip if empty.
- **Line 5 — Stats**: 8px below description. Inline: eye+views · download+downloads · mini-stars (10px) · comment+count. 12px font, muted. No View button.

**2. Update `src/pages/Home.tsx`**
- Import shared `FeedItem` from `@/components/FeedItem.tsx`
- Remove local `FeedItem` and `TrendingFeedItem` components
- Remove the shared helpers (`TYPE_COLORS`, `difficultyColor`, `roundedStars`, `MiniStars`, `timeAgo`, `formatNum`) — move to FeedItem.tsx or a shared util
- `RecentTab`, `FollowingTab`: render `<FeedItem item={item} />`
- `TrendingTab`: render `<FeedItem item={item} rank={i+1} />`
- `ForYouTab`: keep the interaction header row, then render `<FeedItem item={content} />` (no extra border-b wrapper since FeedItem handles its own)

**3. Update `src/pages/Recent.tsx`**
- Import shared `FeedItem`
- Replace the current table-like row layout (lines 180-258) with `<FeedItem item={item} />` for each item
- Keep the filter bar and header as-is
- Add `comment_count` to the Supabase select query (currently missing)

**4. Hover state**
- Applied via Tailwind: `hover:bg-[rgba(255,255,255,0.03)] transition-colors duration-150`
- `cursor-pointer` on the outer div

**5. Click handling**
- Outer div: `onClick={() => navigate(\`/content/${item.id}\`)}` with `useNavigate`
- Avatar circle + display_name Link: `e.stopPropagation()` on click
- BookmarkButton: already calls `e.stopPropagation()` internally
- Stats row: display only, no special handling needed

### Files Changed
| File | Action |
|------|--------|
| `src/components/FeedItem.tsx` | **Create** — shared feed item component |
| `src/pages/Home.tsx` | **Edit** — import FeedItem, remove local components |
| `src/pages/Recent.tsx` | **Edit** — use FeedItem instead of custom row layout |

