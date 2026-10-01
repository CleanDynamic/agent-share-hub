# UI-P00 — Put the design kit in the repo and record a baseline

Follow `design/RULES.md`.

**Goal.** The `design/` folder (this kit) becomes part of the repository so every later prompt can open the references, tokens, fixtures and prompts from disk. Nothing in the running app changes.

**Before you start — get the kit on disk.** Everything after this prompt reads `design/`, so it has to exist in this checkout before anything else happens.

1. If `design/reference/` is missing and `design/build-kit.py` is present, run `python3 design/build-kit.py`. It writes the whole kit (101 files, ~2.4 MB) and is safe to re-run; `--check` verifies what is there without writing.
2. Confirm `design/` now holds `RULES.md`, `README.md`, `HANDOFF.md`, `prompts/`, `reference/` (`index.json`, `components/`, `desktop/`, `mobile/`, `brand/`, `fonts/`), `tokens/` and `fixtures/`.
3. If it is still incomplete, **stop and say exactly what is missing.** Do not continue, and do not reconstruct any part of the kit from this prompt or from the repository — a reconstructed board is not a reference, and every later comparison would be against a guess.

**Do.**
1. **Commit the kit in this commit**, not a later one: `git add design` (including `build-kit.py`, which keeps the kit reproducible). Everything from UI-P01 on assumes it is on the branch.
2. Make sure tooling ignores the folder where it should: add `design/` to the ESLint ignore list and exclude it from `tsconfig.app.json`'s `include`/`exclude` if the current globs would pick it up. It must never be bundled: it is not under `public/` and nothing imports it except the dev-only fixture loader added in UI-P01.
3. Add a short section to the repository's `CLAUDE.md` (create the section if the file exists; create the file only if there is none):
   - "UI overhaul: the source of truth is `design/`. Read `design/RULES.md` before any UI change. Prompts live in `design/prompts/` and run in order. Names of modules, functions and columns come from the `buildgallery-repo-map` skill and from the files themselves, never from a prompt alone."
4. Record a baseline in `design/BASELINE.md`: the result of `npx tsc --noEmit -p tsconfig.app.json`, `npm test` (pass/fail counts and any failing test names), `npm run build` (success, and the size of the largest JS chunks from the build output), and `npx playwright test e2e/tier1 --project=desktop --project=mobile`. If something already fails, record it; do not fix it here. Later prompts compare against this.

**Do not.** Change any source file under `src/`. Move or rename anything inside `design/`.

**Done when.** `python3 design/build-kit.py --check` reports every file matching; the four checks have been run and their results are in `design/BASELINE.md`; the build output contains nothing from `design/`; and `design/` is in this commit.

**Commit.** `UI-P00: add design kit and baseline`
