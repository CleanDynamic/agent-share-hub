# UI-P23 — Data: the featured build

Follow `design/RULES.md`.

**Goal.** "Most reproduced this month" — the build shown in the Gallery's hero composition.

**Read first.** `gallery.ts` (`GalleryBuild`, `GALLERY_BUILD_COLUMNS`, `inGallery`), `build_reproductions` in the types, how `BuildHeader` gets a build's one-line outcome.

**Build** `getFeaturedBuild(now = new Date()): Promise<FeaturedBuild | null>` in `gallery.ts`, `FeaturedBuild = { build: GalleryBuild; reproductions30d: number; outcome: string | null }`:
1. Read `build_id` from `build_reproductions` created in the 30 days before `now`, `.limit(5000)`, and count per build in code. If the cap is reached, log a warning once and still return the top result (add a `// TODO` naming the RPC that would replace this).
2. Take the highest count whose build is in the gallery (`inGallery`); ties go to the most recently confirmed.
3. Load that build with `GALLERY_BUILD_COLUMNS` and its outcome line (the same field the build header uses).
4. `null` when nothing was reproduced in 30 days — the Gallery then drops the featured slot and the wall fills the row.
Unit tests: ranking, tie-break, the gallery filter, the empty case.

**Commit.** `UI-P23: getFeaturedBuild`
