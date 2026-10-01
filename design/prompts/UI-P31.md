# UI-P31 — Page: Rebuild and lineage

Follow `design/RULES.md` (§7).

**Goal.** `/rebuild/:slug` as the reference (family tree, what changed, readiness), and `/b2/:slug/lineage` from the same pieces.

**Read first.** `pages/RebuildRoute.tsx` (`/rebuild/:slug`), `src/lib/build/rebuild.ts` — verified: `startRebuild`, `publishRebuild`, `listRebuilds`, `countRebuilds` — `fork.ts` (`forkBuild`, `getForkOrigin`), the `builds` columns `parent_build_id`, `root_build_id`, `rebuild_count`, `rebuild_note`, `forked_from_event_id`, `components/brand/RebuildCredit.tsx`, HANDOFF §5.4.

**Two warnings.** `src/pages/Lineage.tsx` and the RPC `get_post_lineage` belong to the **legacy** post system (`/b/:slug/lineage`) — do not read them for this and do not route to them. And the family tree, the change set and the readiness score may not exist as functions yet: `grep` for them, and where they do not exist add them first, each in its own commit, in `src/lib/build/rebuild.ts` — `getBuildFamily(rootId)` (from `root_build_id` / `parent_build_id`, capped at depth 20 and 200 rows, one query), `changeSet(draftId)` with a `serialiseChangeSet()` returning lines grouped by header with kinds `added | changed | removed`, and `rebuildReadiness(draftId)` reusing `computeCompleteness` — then build the view on them (§8).

**Reference.** `desktop/{noon,dusk}/rebuild.html`, `mobile/{noon,dusk}/rebuild.html`.

**Desktop (`/rebuild/:slug`).** Grid `minmax(0, 1fr) 470px`, filling. Right column: a column with gap 12 — What changed (fills) above Readiness (**290px**).
- **Family** `Panel` padding 16px 18px, full height. `PanelHead` "Family of {root title}" / "{n} builds · {g} generations · lamps show which still work", right `Segmented` 30/11 **Tree · List** (List is the default above 12 nodes).
  - **Tree**: a canvas 18px below, `position: relative`, 460px tall in `board` fit (grows with generations live; scrolls sideways inside the panel when wider). Generations are rows at y = 18 + 150·g. Nodes are 140px wide: padding 6, radius 12, `--glass`, 1px `--glass-border` (the viewer's draft: 1.5px dashed `--action`), `--shadow-card`; a lamp above each (24×7 at top −10, centred, `--lit`, opacity 1 or .45 by `plaqueState`, `--lamp-glow` when lit; none when never reproduced); a 50px cover (radius 8); the title in `type.display(14)`, −0.01em, one line, 5px below; a row `space-between` in DM Mono 10px `--text2`: the maker (or "you · draft") and the reproduction count ("—" for 0). Layout: each parent centred over its children, siblings in `created_at` order, at least 40px apart. Connectors: one SVG behind the nodes, a path `M x1 y1 C x1 y1+26, x2 y2−26, x2 y2` from the parent's bottom centre to each child's top centre, `--line`, 1.5px. Each node links to its build.
  - **List**: the indented list from the mobile board (below).
- **What changed** `Panel` padding 16px 18px. `PanelHead` "What changed" / "Computed from the source — you cannot edit this list", right `Eyebrow` "Δ {n} changes". For each group: a header (DM Mono 10px, .09em, caps, `--label`, padding 12px 0 4px); each line a grid `18px 130px minmax(0, 1fr)`, gap 8, height 30, 1px bottom `--hairline`, DM Mono 12px: the symbol (+ `--cat-configuration`, ~ `--lit-ink`, − `--cat-breakage`, with a visually hidden "added" / "changed" / "removed"), the name in `--text`, the value in `--text2` (ellipsis; "before → after" for changes).
- **Readiness** `Panel` padding 16px 18px. A row, gap 16, centred: `OrbRing` 120 at `rebuildReadiness()` with "{pct}%" / "ready"; a column, gap 8: `Eyebrow` "Rebuild readiness"; `type.display(22)`, −0.02em, line-height 1.1: "One thing before it can hang" / "{n} things before it can hang" / "Ready to hang"; the first missing item's copy in Figtree 12px `--text2`. 14px below, the credit box: padding 12px 14px, radius 12, background `--inset`, 1px `--line`: `Eyebrow` 10px "The credit it will carry"; "Rebuilt from *{source title}* by @{maker}" in Figtree 13px, 6px below; the Δ summary in DM Mono 11px `--text2`, 3px below (from `RebuildCredit`; structural, not removable). 14px below, gap 8: primary "Publish rebuild" with `Check` → `publishRebuild()` (disabled with its reason while readiness forbids it); ghost "Keep as draft".

**Desktop (the lineage route).** Use the build system's own lineage route if one exists; if the only lineage route is the legacy `/b/:slug/lineage`, add `/b2/:slug/lineage` pointing at this page and leave the legacy route alone. The same Family panel in the left track; the right column shows What changed for the node the viewer selects (its change set against its parent; before a selection: "Pick a build in the family to see what changed."). No Readiness panel.

**Mobile** (390×1340), gap 12:
1. Page heading: `Eyebrow` "Rebuild · draft", `h1` `type.display(32)` the draft title, Figtree 14px "Rebuilding {source title} by @{maker}."
2. Readiness first (the decision): `Panel` padding 16; `OrbRing` 112; `Eyebrow` "Readiness"; `type.display(20)`; Figtree 13px; the credit box (Figtree 14px); a full-width 48/15 primary "Publish rebuild".
3. What changed: `Panel` padding 14px 16px, subtitle "Computed from the source — not editable"; lines grid `16px 118px minmax(0, 1fr)`, min-height 36.
4. Family as an indented list: `Panel` padding 14px 16px, `PanelHead` "Family of {root}" / "Lamps show which still work"; rows min-height 52, `padding-left: 22px × depth`, an elbow for depth > 0 (at left 22·depth − 12: 10×26, 1.5px left and bottom borders `--line`, radius `0 0 0 8px`); a 40×40 cover (radius 9; the draft has a 1.5px dashed `--action` border); a column (title `type.display(16)` ellipsis; "{maker} · {n} reproduced" DM Mono 10px `--text2`); the lamp 18×6 on the right (lit / dimmed; the draft: a dashed `--action` outline).

**Done when.** The four Rebuild boards compare within 0.04; the change list equals `serialiseChangeSet()` output line for line; publishing still works end to end.

**Commit.** `UI-P31: Rebuild and lineage in the site frame`
