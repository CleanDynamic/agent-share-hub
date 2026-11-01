# SV-27 · the composer chunk

Sizes are gzip (`zlib.gzipSync`, as `scripts/check-size.mjs` measures), from `vite build`. Per-module figures come from
`ANALYZE=1 ANALYZE_RAW=1 npx vite build` (rollup-plugin-visualizer's raw data), comparing the modules inside `SandboxPage-*.js` on
main (`56ed470`) and on this branch.

| | Bytes | check-size |
| --- | --- | --- |
| main | 118,959 | 119.0 KB |
| SV-27 Part 10 | about 120,100 | 120.1 KB (over) |
| with Not sure back (three Harness states) | 120,183 | 120.2 KB (over) |
| after this pass | **119,940** | 119.9 KB (within) |

## What SV-27 added to the composer chunk (module gzip, main → branch)

Before this pass:

| Module | Added | What |
| --- | --- | --- |
| `SandboxPage.tsx` | +556 | deployment window state and wiring, the Deployment section's slot, the Map view switch's slot, the Add menu's node type check |
| `detailsView.ts` | +313 | the agent's deployment fields, Deployment line, own setup and run channels, worked out for every agent view |
| `derive.ts` | +195 | Classification's approval, trigger and stack readings |
| `SandboxView.tsx` | +166 | the Add menu's Deployment group and its head |
| `duplicate.ts` | +83 | refs rewritten to the copies on Duplicate |
| `tileSections.ts` | +14 | words |

After this pass:

| Module | Added | Change |
| --- | --- | --- |
| `SandboxPage.tsx` | +473 | the deployment window's open and close handling, its agents and its write moved into the window's chunk (`DeploymentWindow`); an unused `deploymentAim` state removed |
| `detailsView.ts` | +103 | the agent's deployment data is worked out in the agent window's own chunk (`AgentRuntimeSection`) and in How did it run? when it shows channels; the view carries only the tree |
| `derive.ts` | +195 | unchanged: Classification runs without a click |
| `SandboxView.tsx` | +166 | unchanged: the menu's entries are built with the menu |
| `duplicate.ts` | +48 | the copy keeps each old and new id as it copies, instead of walking the copies again |
| `tileSections.ts` | +14 | unchanged |

## Chunks loaded on demand

| Chunk | Bytes | Loaded |
| --- | --- | --- |
| `AgentRuntimeFields` | 3,240 | when an agent's or team's window opens |
| `DeploymentDialog` | 3,321 | on hover or focus of Add › Deployment, and when a kind is chosen |
| `DeploymentSection` | 932 | only for a build with deployment tiles |
| `ArchitectureMap` | 3,632 | when the Map is drawn for a build with deployment tiles |
| `deployment` (shared) | 4,445 | with whichever of the above, or the graph writers, asks first |

## What is left in the composer, and why

`derive.ts` (+195), the Add menu's Deployment entries (+166) and the Deployment section's and Map view's slots run without a click.
SV-28 to SV-30 add composer fields: 60 bytes of headroom will not hold them. The next candidates are Classification's derive (if
the composer can read it only when the Classification window or the publish checklist asks) and the Add menu's entries (built when
the menu opens rather than with the page).
