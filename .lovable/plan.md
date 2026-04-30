## What's actually broken

Your new Messages page (`src/pages/Messages.tsx`) and the data layer are wired correctly. The reason nothing looks like the v0 design is that the **active layout shell isn't `AppLayout` — it's `NeoScaleShell`** (`src/components/Layout.tsx` exports `NeoScaleShell`, not `AppLayout`). All my earlier Messages-route exclusions were applied to the wrong shell.

What the screenshot shows:

```text
NeoScaleShell  (renders the wrapping chrome)
├── "← Back"  button
├── "Messages" page title  ← duplicate
├── "Search messages…" input  ← duplicate, non-functional
└── ns-page-body  ← contains:
        Messages.tsx
        ├── thread list panel ("Messages" header + Primary/Requests + search) ← real
        └── empty conversation pane
```

…and the right Explore panel is still mounted because `NeoScaleShell` doesn't suppress it on `/messages`.

## Fix

All edits are in `src/components/NeoScaleShell.tsx`.

1. **Drop the special `/messages` shell branch** (lines ~1398-1414). Replace its whole block + the page-meta entry for `/messages` so the route renders inside a bare full-bleed container with no header, no back button, no second "Search messages" input, and no `ns-page-body` padding.
2. **Apply the same bare treatment to thread sub-routes** (`/messages/{threadId}`). The current fallback at the bottom still wraps non-matching routes in `ns-page-shell` with a `← Back` button, which adds chrome to `/messages/abc123`. Add a `path.startsWith('/messages')` exclusion so both `/messages` and `/messages/{id}` render `<Outlet />` directly inside a `height: 100%` container.
3. **Hide the right Explore panel on `/messages`**. Find where the right column is rendered in `NeoScaleShell` (the `RightPanel`/Explore aside) and add the same `path.startsWith('/messages')` check so it doesn't mount. This matches what `AppLayout` already does and reclaims the horizontal room the two-column messaging UI needs.
4. **Make sure the centre column gives Messages full height + width**. The Messages.tsx root already uses `style={{ height: "100vh" }}`, but inside `ns-middle-front` that fights the parent. Replace `100vh` with `100%` so it fills the centre column exactly. (Edit in `src/pages/Messages.tsx`, single line.)

## After the fix you'll see

- Edge-to-edge two-column Messages page: thread list (320 px) on the left of the centre column, conversation pane on the right.
- Single "Messages" heading inside the thread list panel — no duplicate page title, no "← Back", no second search box.
- Right Explore panel hidden on `/messages` and `/messages/{id}`.
- Profile "Message" button + ContentDetail "Start discussion" entry points already implemented in the previous turn will route into this clean surface.

## Out of scope for this fix

- I'm not touching the data layer, modals, notifications trigger, or unread badge — those landed correctly already.
- I'm not deleting `AppLayout`; keeping it as the documented fallback as today.