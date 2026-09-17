# The extractive connector — handover

One heading per step of the build sequence, EX-P00 to EX-P19. A session writes
its line under its own heading when it stops, so **the newest entry says where
the last session got to**. Keep entries to a line or two: what landed, what is
open, what the next session should read first.

The contract for every step is `.claude/skills/buildgallery-extractor/SKILL.md`.
Read it at the top of each one.

| Step | Title | Merge to main after? |
|---|---|---|
| EX-P00 | Reconnaissance (read-only) | no |
| EX-P01 | The contract documents | no |
| EX-P02 | The door skeleton | no |
| EX-P03 | The consent page | **yes** |
| EX-P04 | The lock | no |
| EX-P05 | The import tables and the bucket | no |
| EX-P06 | The pipe | no |
| EX-P07 | The secret scanner | no |
| EX-P08 | The parse | no |
| EX-P09 | The pickup | **yes** |
| EX-P10 | The destination choice | **yes** |
| EX-P11 | The honest fallback | no |
| EX-P12 | Readers, one per tool | no |
| EX-P13 | Ceilings, idempotency and expiry | no |
| EX-P14 | Provenance | no |
| EX-P15 | Hostile content | no |
| EX-P16 | Observability | no |
| EX-P17 | The connect page | **yes** |
| EX-P18 | Evaluations | no |
| EX-P19 | Live vocabulary (optional) | no |

---

## EX-P00 — Reconnaissance (read-only)

Findings are in [`docs/connector/RECON.md`](./RECON.md), including five blocking
questions for later steps under "Blocking questions for the next step".

## EX-P01 — The contract documents

Created `.claude/skills/buildgallery-extractor/SKILL.md` (the connector's single
source of truth) and this file. No application code. RECON's five blocking
questions are carried into the skill's "Open questions"; question 1 (the SDK
cannot speak `2026-07-28`) still blocks EX-P02.

## EX-P02 — The door skeleton

## EX-P03 — The consent page

## EX-P04 — The lock

## EX-P05 — The import tables and the bucket

## EX-P06 — The pipe

## EX-P07 — The secret scanner

## EX-P08 — The parse

## EX-P09 — The pickup

## EX-P10 — The destination choice

## EX-P11 — The honest fallback

## EX-P12 — Readers, one per tool

## EX-P13 — Ceilings, idempotency and expiry

## EX-P14 — Provenance

## EX-P15 — Hostile content

## EX-P16 — Observability

## EX-P17 — The connect page

## EX-P18 — Evaluations

## EX-P19 — Live vocabulary (optional)
