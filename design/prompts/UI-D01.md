# UI-D01 — What actually landed

Follow `design/RULES.md`.

**This prompt changes nothing.** It reads the repository and reports. Do not edit a file, do not commit, do not run a migration. If something is obviously broken, say so in the report rather than fixing it.

**Goal.** The deployed site still shows the old frame. Find out which of `UI-P00` to `UI-P41` actually landed on this branch, and which of three causes is responsible, so the next prompt is the right one.

**Do, in order, and quote the real output of each — never a summary.**

1. **Where am I.** `git branch --show-current`, `git log --oneline -40`, and `git log --oneline --grep='^UI-P' | wc -l`. List every `UI-Pnn` commit subject you find, in order. Name the ones between `UI-P00` and `UI-P41` that are **absent**.
2. **Is this what is deployed?** `git status -sb` and `git log --oneline origin/HEAD -5` (or the default branch's remote ref). State plainly whether this branch is merged into the default branch. Lovable deploys the default branch, so work sitting on an unmerged branch is invisible on the live site no matter what else is true.
3. **Does the kit exist?** `ls design/` and `python3 design/build-kit.py --check` if it is there.
4. **Does the new frame exist in the code?** For each path, say exists / missing, and for the ones that exist give the line count:
   - `src/components/shell/SiteFrame.tsx`, `SiteHeader.tsx`, `Breadcrumb.tsx`, `SiteFooter.tsx`, `MobileHeader.tsx` (or wherever UI-P19 put the dock), `FrameRoute.tsx`, `siteFrameRoutes.ts`
   - `src/lib/shell/flags.ts`
   - `src/components/brand/` — list it
   - `src/pages/site/` — list it, one line per page
5. **Is the frame wired in?** Print the part of `src/components/AppShell.tsx` that chooses between `SiteFrame` and `FlatShell`. Print the whole of `siteFrameRoutes.ts` (the actual contents of `SITE_FRAME_ROUTES`). Then `grep -rn "FrameRoute" src/App.tsx | head -40`. Say how many routes are on the new frame.
6. **What does the flag do when it cannot find a row?** Print `isSiteFrameOn()` in full. State what it returns when the `feature_flags` table has no `site_frame` row — that is the production case.
7. **What is not behind the flag?** These change the live site whether the flag is on or off, so they tell us whether the early waves landed:
   - `grep -rn "exhibition" src e2e index.html | head` — should be empty but for a migration line.
   - `grep -rn "Sentient" src/index.css src/lib/theme/* index.html | head` — did `UI-P05` land?
   - `grep -n "\-\-lit-ink\|--focus-ring\|--picture-lamp-glow" src/index.css | head` — did `UI-P03` land?
8. **Does it build and pass?** `npx tsc --noEmit -p tsconfig.app.json`, `npm test`, `npm run build`. Report pass/fail and any failing test names. If `npm run audit:design` exists, run it and report the first ten lines.

**Report back exactly this, and nothing else:**

```
BRANCH: <name> · merged into <default>: yes / no
COMMITS: <n> UI-P commits · missing: <list, or none>
KIT: present / missing · build-kit --check: <result>

CODE PRESENT
  frame components : <list of exists / missing>
  page views       : <n> of 10
  data functions   : <n> of the UI-P21..P26 set

WIRING
  AppShell branches on the flag : yes / no
  SITE_FRAME_ROUTES             : <the actual array>
  routes using FrameRoute       : <n>
  isSiteFrameOn() with no row   : true / false

NOT BEHIND THE FLAG
  exhibition removed : yes / no
  Sentient installed : yes / no
  new tokens present : yes / no

CHECKS: tsc <r> · test <r> · build <r> · audit:design <r>

VERDICT: one of
  A — the work is not on the deployed branch
  B — the work is there and the flag is off
  C — the work is not in the repository at all
  D — something else: <say what>
```

**How to read the verdict** (state which one applies and why, in one sentence):

- **A** — `UI-Pnn` commits exist on a branch that is not merged into the default branch. Nothing is wrong with the code; it is not deployed. The fix is a pull request, not a prompt.
- **B** — the components exist, `AppShell` branches on the flag, routes are in `SITE_FRAME_ROUTES`, and `isSiteFrameOn()` returns false with no row. This is the expected state after `UI-P36` and the fix is `UI-P36b`.
- **C** — the frame components are missing and there are few or no `UI-P` commits. The sessions did not do the work. Say which prompts have no commit, and stop; re-running them is the fix, starting from the lowest missing number.
- **D** — anything else. Describe what you found; do not guess.

**Commit.** None. This prompt commits nothing.
