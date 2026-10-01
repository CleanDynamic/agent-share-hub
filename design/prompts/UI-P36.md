# UI-P36 — Pages: Sign in, Join, reset and verify

Follow `design/RULES.md` (§7).

**Goal.** `/login` and `/signup` as the reference, `/reset-password` and `/verify-email` in the same layout. **A repaint of the forms, not a rewrite of auth**: every field name, handler, validation, OAuth provider and `?redirect=` behaviour stays exactly as it is.

**Read first.** `pages/Login.tsx`, `Signup.tsx`, the reset and verify pages, the OAuth buttons they use, `useAuth()`, HANDOFF §5.9.

**Reference.** `desktop/{noon,dusk}/signin.html` (the page is 1440×1000 under the browser strip), `mobile/{noon,dusk}/signin.html`.

**Layout.** `SiteFrameView variant="bare"`: no header, breadcrumb, footer or dock. The page background is `var(--ambient), var(--bg)` with `box-shadow: var(--signin-edge)` on the page root (the glowing inner edge from the brand tile), the arc (viewBox 1440×1000, centre (1800, −560), r 1060) and the Dusk grain — give `PageBackdrop` a `tone="signin"` for this.

**Desktop.** Content centred in the viewport (min-height 100dvh), a row with gap 110:
- **Left**, a column with gap 30: `Lockup` 70; `Tagline` 40 (0 / 70 / 24) with the sentence as real text for screen readers; a row, gap 12: `OrbGlass` 140 "Reproduced" / "{countReproducedToday()} today"; `OrbSolid` 140 "Hung" / {in-gallery count} / "builds".
- **Right**, a centred column, gap 16:
  - **The card**: 420 wide, padding 26, radius 20, background `--header`, 1px `--header-border`, `box-shadow: var(--shadow-float), var(--panel-highlight)`, `backdrop-filter: blur(16px) saturate(1.15)` (the only blurred surface on the page); a column, gap 12:
    1. a row `space-between`: a "Back" link (`ArrowLeft` 15, Figtree 13px `--text2`; history back, or `/`) and `Segmented` 32/12 **Sign in · Join free** (switches between `/login` and `/signup`, keeping `?redirect=`);
    2. one button per existing OAuth provider (Google, GitHub, X as today): height 44, radius 12, `--glass-2`, 1px `--line`, Figtree 14px 500, gap 10, the provider's existing 16px mark, "Continue with {provider}";
    3. a divider, margin 4px 0: two 1px `--line` rules either side of `Eyebrow` 10px "or with email";
    4. the fields, each a `<label>` column with gap 7: `Eyebrow` 10px label ("Email or username", "Password"); the field 44 tall, padding 0 14px, radius 12, `--field`, 1px `--line`, gap 10, `User` / `Lock` icon 16 `--text2`, the input Figtree 14px (16px below 768px);
    5. a row `space-between`, Figtree 13px `--text2`: the "Keep me signed in" checkbox (only if the form has it today) and "Forgot password?" in `--action` → `/reset-password`;
    6. the primary 46/15 "Sign in" (Join: "Create account").
    Errors: one sentence in `--cat-breakage` under the field it belongs to, announced with `aria-live="polite"`.
  - `ThemeSegmented` 34/12 under the card.
- **Join** shows the existing signup fields in the same field style. **Reset** and **verify** use the same page and card with their existing content.

**Mobile** (390×844): `<main>` padding 22px 14px 30px, a column with gap 14:
1. padding 10px 0 4px, a column with gap 18: `Lockup` 34; `Tagline` 26 (0 / 40 / 12).
2. The form in a glass `Panel` (padding 16, column gap 10): `Segmented` 38/13; OAuth buttons 48 tall, Figtree 15px; the divider (margin 2px 0); fields 48 tall with 16px inputs; the remember / "Forgot?" row; a full-width 48/15 primary "Sign in".
3. `ThemeSegmented` 36/12, centred.
No orbs on phones.

**Done when.** The four Sign-in boards compare within 0.04; every existing auth e2e spec passes unchanged; signing in with `?redirect=/gallery` lands on the gallery.

**Commit.** `UI-P36: Sign in, join, reset and verify repainted`
