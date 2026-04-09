

## Plan: Infinite Scroll, Fix Scroll, and Address API Key Concern

### 1. Infinite scroll with 50 initial posts

**File: `src/components/NeoScaleShell.tsx`**

Replace the current `useEffect` fetch (lines 1053-1132) with `useInfiniteQuery` from `@tanstack/react-query`:
- Initial page loads 50 posts (`PAGE_SIZE = 50`)
- Subsequent pages load 25 at a time
- Add an `IntersectionObserver` sentinel div at the bottom of `ns-feed-scroll` that triggers `fetchNextPage` when scrolled into view
- Remove the `setPosts([])` flash — `useInfiniteQuery` handles cache/stale data natively
- Flatten pages into the existing `posts` render loop

State changes:
- Remove `const [posts, setPosts] = useState<any[]>([])` 
- Replace with `useInfiniteQuery` returning `data.pages.flat()`
- Add a `ref` for the scroll sentinel

### 2. Fix scroll on main container

The `ns-middle-front` has both `overflow-y: auto` (line 265) AND contains `ns-feed-scroll` which also has `overflow-y: auto` (line 315). This creates nested scroll containers — the outer one captures scroll events before the inner feed can scroll properly.

Fix: Remove `overflow-y: auto` from `.ns-middle-front` CSS (line 265), keep it only on `.ns-feed-scroll`. The front face uses `display: flex; flex-direction: column` so the feed scroll container will fill remaining space via `flex: 1`.

### 3. API key in request headers — not a vulnerability

The `apikey` header contains the Supabase **anon (publishable) key**. This is by design — it's equivalent to a public API key and is already visible in the client bundle. It cannot be hidden from network requests.

Security is enforced by **Row Level Security (RLS) policies** on each table. The anon key only grants access that RLS allows. To verify protection is solid, I'll check that `content_items` has proper DELETE policies (users should only be able to delete their own posts).

No code changes needed for this — the key is intentionally public. If the `authorization` header (Bearer token) concerns you, that's a per-session JWT that expires and can't be reused by others.

### Technical summary

| Change | File | What |
|--------|------|------|
| Infinite scroll | `NeoScaleShell.tsx` | Replace `useEffect`+`setPosts` with `useInfiniteQuery` + `IntersectionObserver` sentinel |
| Initial load size | `NeoScaleShell.tsx` | First page = 50, subsequent = 25 |
| Fix nested scroll | `NeoScaleShell.tsx` CSS | Remove `overflow-y: auto` from `.ns-middle-front`, keep on `.ns-feed-scroll` only |
| API key | No change | Anon key is a publishable key by design; RLS enforces security |

