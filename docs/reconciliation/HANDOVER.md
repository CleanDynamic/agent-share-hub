# The reconciliation series — handover diary

Contract: docs/reconciliation/CONTRACT.md. Read it, then the newest entry below.

## Deploy queue
(empty)

## Deferred to after the merge
(empty)

## Critique findings deferred
(empty)

## RC-P00 — Set-up: skills check, contract, diary, baseline
Date: 2026-09-28 · Commits: SETUP-1 · Head: e2db7e50
Landed: docs/reconciliation/CONTRACT.md, this diary (47 prompt headings) and e2e/audit/rc-baseline.spec.ts (anonymous request counts on / and /gallery, backend stubbed).
Skills applied: ⟦neoscale-performance › Measure before you change anything⟧ ⟦neoscale-e2e-testing › Writing tests; Running and reporting⟧ ⟦neoscale-code-review › Review output format⟧ ⟦buildgallery-repo-map › 7⟧
Migrations queued: none
Lovable messages owed: none
Open: tsc PASS · unit tests 1981/1981 passed, 0 failed · build PASS · JS bytes 4292852 · largest chunk 3373934 index-DbkPwbmY.js · requests / 4, /gallery 3 · main was at e2db7e50; ex-door merged: yes · Playwright in a cloud container needs the uncommitted local config described in docs/connector/HANDOVER.md "EX-P16-fix" (Chromium /opt/pw-browsers/chromium, Vite on 127.0.0.1) · Head above is the commit this entry was written on; SETUP-1 sits on it.
Next: RC-P01

## RC-P01 — Clear reconnaissance (live results not supplied)
Date: 2026-09-28 · Commits: CLEAR-1 · Head: 90d7405e
Landed: docs/reconciliation/CLEAR-RECON.md. Q1–Q7 were never pasted and the owner said to continue, so every live value reads "not supplied"; the repo side is filled: 45 types.ts references to content_items in 39 tables, 19 with no index in migrations and 7 indexed only after another column, each "check live".
Skills applied: ⟦supabase-postgres-best-practices › references/schema-foreign-key-indexes.md⟧ ⟦buildgallery-repo-map › 4⟧ ⟦neoscale-code-review › Review output format⟧
Migrations queued: none
Lovable messages owed: RC-P01 results for Q1–Q7
Open: POSTS not supplied · FK_BLOCKING not supplied · SURVIVORS_OK not supplied (types.ts shows the dm_messages, dm_threads and builds references as nullable) · DEMO_ADMINS not supplied · rebuild_count in BUILD_COLUMNS_PRESENT not supplied (types.ts has it; the repo map's §4 note that it lacks it is out of date) · no live value exists until Q1–Q7 are pasted into CLEAR-RECON.md.
Next: RC-P02

## RC-P02 — 

## RC-P03 — 

## RC-P04 — 

## RC-P04b — 

## RC-P05 — 

## RC-P09 — 

## RC-P06 — 

## RC-P07 — 

## RC-P08 — 

## RC-P09c — 

## RC-P09b — 

## RC-P10 — 

## RC-P11 — 

## RC-P12 — 

## RC-P13 — 

## RC-P14 — 

## RC-P14b — 

## RC-P14c — 

## RC-P15 — 

## RC-P15b — 

## RC-P16 — 

## RC-P16b — 

## RC-P17 — 

## RC-P17b — 

## RC-P18 — 

## RC-P19 — 

## RC-P20 — 

## RC-P20b — 

## RC-P21 — 

## RC-P22 — 

## RC-P23 — 

## RC-P24 — 

## RC-P25 — 

## RC-P26 — 

## RC-P27 — 

## RC-P28 — 

## RC-P28a — 

## RC-P28b — 

## RC-P08b — 

## RC-P29 — 

## RC-P30 — 

## RC-P31 — 

## RC-P32 — 

## RC-P33 — 

## RC-P34 — 
