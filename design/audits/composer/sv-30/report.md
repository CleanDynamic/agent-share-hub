# SV-30 follow-up: what was run and what was seen

Audits, against `origin/main` run in a second worktree where a failure needed comparing:

| Audit | Result |
|---|---|
| audit:themes | Zero leaks on the SV-30 routes. The full sweep stops at `ca22-selection` on main too (a null click), so it was run with `SWEEP_ONLY=sv30`. |
| audit:contrast | The only failure on the SV-30 routes is the header search's focus ring, which `links-reader` on main shows the same four times. |
| audit:motion | `remove-a-tile` fails with the same numbers on main (12 frame gaps, a 42% jump). |
| audit:perf | LCP, INP and CLS within run-to-run noise of main; the third test fails on main too (no cards without Supabase). |
| audit:pages | Home 3 rounds, OpenBuilds 18 requests and "Back landed 1337 px" fail identically on main. Composer placeholder passes alone. |
| audit:design | All `vision/*` boards pass. The seven `refined/*` failures are the same seven on main. |

Changed after looking at all 48 screens (12 cases, Dusk and Noon, 1440 and 390):
- The measurement fields were empty in the Check window and the Details row for a stored measurement (the draft was read back with the wrong reader, which would have wiped it on save). Fixed, with tests.
- The five measurement inputs had no visible labels. Added.
- A comparison row's evidence control had no heading. Added. The build page now shows each row's evidence.
- The goal's target field "Reached" read like the Outcome choice above it. Now "Result".
- Output link rows wrapped the remove button onto a second line at desktop width. Fixed.
- The code-part line in the List's Code card sat 18px right of the code well. Fixed.
- The fixture's messages and compactions are marked From the run, as an added import now stores them.
