# SV-29 · sizes (gzip, `node scripts/check-size.mjs`)

| Chunk | Before (aae5b14) | After |
|---|---|---|
| Composer (`SandboxPage-*.js`) | 117.9 KB | 119.0 KB (budget 120) |
| First download, signed out | 230.6 KB | 230.7 KB (the script's 200 KB budget already failed at aae5b14; SV-26 documents 230 KB) |
| `AddRetrievalDialog` (new chunk) | none | 2.1 KB gz (5,459 bytes raw) |
| `AddCheckDialog`, now with the eval fields | n/a | 8.4 KB gz (28,624 raw) |
| `AddDecisionDialog`, now with the pipeline fields | n/a | 11.5 KB gz (36,393 raw) |
| `ArchitectureMap` | n/a | 4.6 KB gz (11,865 raw) |
