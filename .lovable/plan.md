## Plan: Replace legacy Browse with the new Discover page

The new Discover page already exists at `/discover`, but the sidebar's "Discover" link historically pointed at `/browse`, which still renders the old `Browse` component. We'll point `/browse` at the new `Discover` component so any cached link, bookmark, or stale tab automatically gets the new UI.

### Changes

1. **`src/App.tsx`**
   - Remove `import Browse from "./pages/Browse"`.
   - Change the `/browse` route to render `<Discover />` instead of `<Browse />`.
   - Keep `/discover` → `Discover` and `/discover-legacy` → `DiscoverLegacy` (the backed-up Browse) as a fallback.

2. **`src/pages/Browse.tsx`** — leave the file in place for now (it's still importable as `Discover.legacy.tsx`). No deletion this round; safer to remove after a release cycle.

3. **No nav changes needed** — the previous turn already updated `LeftPanel` and `MobileNav` to point at `/discover`. With `/browse` now also pointing at the new page, both URLs resolve to the same component.

### Result
- Visiting `/browse` (the URL in your screenshot) shows the new Discover header (Blueprints / Stages / Blocks tabs, ⌘K search, Filters sheet).
- The old Browse UI is still reachable at `/discover-legacy` for reference.
