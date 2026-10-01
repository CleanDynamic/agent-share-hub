# UI-P18 — Breadcrumb, footer and the theme control

Follow `design/RULES.md`.

**Goal.** The breadcrumb that mirrors the URL, the footer, and one theme control used in the footer, the sign-in page and the mobile account sheet.

**Read first.** `App.tsx` route table, `ThemeContext.tsx` (`ThemeChoice` is now `noon | dusk | system`), `components/theme/ThemeToggle.tsx`.

**Reference.** Section `Frame` (breadcrumb, footer); `data-ui="breadcrumb"` and `data-ui="site-footer"` on every desktop board.

**Build.**
1. **Breadcrumb** `src/components/shell/Breadcrumb.tsx`, `data-testid="breadcrumb"`: `<nav aria-label="Breadcrumb">`, flex, `align-items: center`, gap 8px, height 40. Ancestors: links, Figtree 13px `--text2`, no underline, each followed by "/" in DM Mono 12px `--label` (`aria-hidden`). Current: a `<span aria-current="page">`, Figtree 13px 600 `--text`, one line with ellipsis at 480px max.
2. **Trails** from `useBreadcrumb()` (route → trail) plus `useCrumbTitle(title)` which a page calls once its record loads (a small context; no global store, no fetching in the hook). Trails, as drawn:
   - `/` → **Home** · `/gallery` → Home / **Gallery** · `/b2/:slug` → Home / Gallery / **{build title}** · `/b2/:slug/lineage` and `/rebuild/:slug` → Home / Gallery / {build title} / **Rebuild** (lineage: **Lineage**) · `/import`, `/compose/*` → Home / New build / **Import** (compose: **Compose**) · `/bounties`, `/bounties/solvers` → Home / **Bounties** (/ **Solvers**) · `/profile/:handle` → Home / **{display name}** · `/notifications` → Home / **Activity** · `/library` → Home / **Library**.
   - While a title is loading, the current crumb is a 120×12 `--recess` skeleton, radius 4.
3. **`ThemeSegmented`** (`size`): `Segmented` with **Noon · Dusk · System**, bound to `ThemeContext`. Replaces what `ThemeToggle` does for SiteFrame surfaces; `ThemeToggle` itself stays for `FlatShell`.
4. **Footer** `src/components/shell/SiteFooter.tsx`, `data-testid="site-footer"`: `<footer>` full width, height 88, 1px top border `--header-border`, background `--header` (no blur). Inner row: the 1280 column, height 88, flex, `align-items: center`, gap 28px:
   - `Lockup` 16 (link home);
   - links, gap 22px, Figtree 13px `--text2`: About `/about`, API docs `/api-docs`, Solvers `/bounties/solvers`, Connect a tool `/connect`, then **Sign in** `/login` when signed out or **Sign out** (a button in the same style) when signed in — the reference shows the signed-out item; this difference is expected in the compare;
   - spacer; `ThemeSegmented` size 32 with its items at Figtree 11px, as drawn; "© buildgallery" in DM Mono 11px `--label`.
5. Mount both in `SiteFrameView` (breadcrumb at the top of `<main>`, footer after it).

**Done when.** Breadcrumb and footer in the Frame section compare within 0.04 in both themes; changing the footer control changes the theme, persists under `bg-theme`, and System follows the OS.

**Commit.** `UI-P18: breadcrumb, footer and theme segmented control`
