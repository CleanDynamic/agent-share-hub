# How the series was vetted

The VB prompts (VB-00 to VB-16) and the draft CA prompts written in the planning chat (CA-29 to CA-35, now SV-01, SV-03 to SV-07 and SV-26) were merged into one series, SV-01 to SV-26. The drafts were renamed so they can't be confused with the older CA-06 to CA-28 work already in the repo. Every prompt went through the same four lenses used on the CA prompts earlier, and the CA prompts were changed so that the work they build is what the VB prompts plug into. This file records what each lens changed. It is not a prompt; the README is what sessions read. `AUDITS.md` holds the full skill-by-skill audit of the page and feature prompts against all eight boards.

## The four lenses

| Lens | Source | What it brings | What was left out, and why |
| --- | --- | --- | --- |
| **Karpathy** | the `karpathy` skill | Plan and assumptions before code; reproduce first; build the simple layer, measure, add the next only if a target fails; surgical changes; a missing premise is reported, not fixed | "If unsure, ask": sessions run unattended, so questions go in the report |
| **Fluid** | the `improve-design` skill | Watch it move before changing it; interruptible motion; cut back anything that draws the eye; stop when it's already smooth | Ease-in exits, scale on press, short staggers, springs, new hover states: the repo's motion tests ban them |
| **Performance and Vercel** | `optimizing-performance`, then Vercel's `react-best-practices` | Start early, await late; request rounds as a target; `content-visibility` for long lists; preconnect; versioned storage; refs and passive listeners for drags; no components inside components; derived state, not copies; budgets that fail scripts; `EXPLAIN` for indexes; no regression in Web Vitals | SWR, `better-all`, the Next.js `server-` rules, Lighthouse against a live URL, memo without a profile |
| **transitions.dev** | the repo's polish rules | Judge a value by what it does; leaving is quicker than arriving, and nothing that leaves is delayed; same-slot cross-fades; a fixed stagger total | Every recipe's code (blur, `ease-in-out`, bounces, scale, layout animation, CSS classes), the fix service (it uploads files), the Refine panel, UI generation |

The lenses that apply to every prompt live in the README (How to work, Pages, Motion limits, Performance rules, Database rules), so each prompt carries only what is particular to it.

## What the CA prompts now do for the VB prompts

| CA prompt | Change made so the page and feature prompts build on it |
| --- | --- |
| SV-01 | Its `SECURITY DEFINER` rules (Part 6) are the pattern SV-20's notification triggers and SV-19's version trigger follow; no outside fix services |
| SV-02 (was VB-00) | Moved before the data layer, so names and routes are final before anything is keyed on them; `SectionHead`'s chevron becomes a `PageLink` |
| SV-03 | Route table keyed by `SITE_NAV` key; query keys follow the VB convention; every entry's `load`, `prefetch` and `Placeholder` are swappable fields, tested for every nav page; page targets in one list so each page prompt adds one entry; Part 4 changes only the data functions Builds and Home keep, not the Gallery view SV-11 retires; Saved fixed once, here |
| SV-04 | The tour follows the new names; its steps come from one list each page prompt extends; each page prompt replaces its route's `Placeholder` and keeps the match test green; `SectionHead` is routed through `PageLink` |
| SV-05 | The numbering function is pure and outside the composer, so OpenBuilds, Maps, stored counts and the build page use it without the composer's chunk; session rows follow the boards (named by first prompt) |
| SV-06 | Keeps `duplicate` and `add` for SV-18 and SV-21 whatever today's callers |
| SV-07 | One insert path in the model, taking a ready copy and returning keys for `motion.expect`, for SV-18 and SV-21; single-path `making` writers for SV-16 and SV-21; Summary turns skipped for names |
| SV-26 | Moved to the end; measures every redrawn page, every Builds view and the window as its own chunk; checks no page pulls in composer code; reads every prompt's `Dead code seen` |

## What each lens changed in the VB prompts

| Prompt (was) | Karpathy | Fluid and transitions.dev | Performance and Vercel | Merged with the CA work |
| --- | --- | --- | --- | --- |
| **SV-02** (VB-00) | Part 0 commits a plan; checks each board renders on its own (a missing premise skips it); reuses existing pieces | Shared pieces don't animate | No new barrel file for the pieces | Boards, README and prompts committed here; private sample titles replaced |
| **SV-08** Drafts (VB-08) | Behaviour tests first, before the restyle | No motion added | Passive listeners and a ref for the session drag; no inline components; one round kept | Keeps SV-03's one request, no empty drafts and `Remove empty drafts`; SV-05's counts; the naming decision; SV-07's Summary rule |
| **SV-09** Library (VB-06) | Saved is checked, not fixed again; fixed only if the test fails | Kind, tab, sort and item changes keep old content, no fade | Kinds, counts and the first table page start together; selection read from the address; estimated counts | SV-03's one request and panel error kept, named per kind |
| **SV-10** Home (VB-01) | Element-to-function table marks which round each read is in | The "n new" pill appears in place; new items added at once | Two rounds at most; `post_doc` only for posts on screen, the rest as they near view; `content-visibility` on the feed; `EXPLAIN` for `listMostReproduced` | Uses SV-03's light columns and `getBuildFeed` with classifications; carries the feed SV-11 retires |
| **SV-11** Builds Table (VB-03) | Retires the Gallery views it replaces, instead of leaving them for a cleanup that already ran | Filter, lens, sort and view changes keep old rows, no fade | One round; Maps and Classification are separate chunks prefetched on hover; rows past the first screen skipped; state from the address; estimated counts | Uses SV-03 Part 4's classification-in-select and facets alongside |
| **SV-12** Maps (VB-04) | Stored summary only if on-demand misses its target | Maps don't animate; the composer's map morph isn't used | Own chunk; cards past the first screen skipped; lines found with maps; coordinates rounded | Names and numbers from SV-05; the summary writes through SV-07's queue |
| **SV-13** Classification (VB-05) | Reports facets the board assumes derived but are only declared | Value links keep old content, no fade | Versioned storage key with a blocked-storage test; no second read | Reads what SV-11 loaded |
| **SV-14** OpenBuilds (VB-02) | Draws only the gap tile if one request can't serve the strips | Tabs and sort keep old content; Me too updates at once | Two rounds at most; steps grouped with one map | Step numbers from SV-05 |
| **SV-15** Activity (VB-09) | Names the index each query relies on, and adds any missing one | No motion | One query per kind, in parallel; private keys only under the signed-in user | Starts in Home's first round |
| **SV-16** Credit (VB-10) | Works before its migration is applied (error codes only) | No motion | Contributors in the build's own request | Writes `sessions_meta` only through SV-07's writers |
| **SV-17** Saved items (VB-11) | Privacy tested (another reader can't read a row); "Start a build" waits for the window that makes it work | Save changes its glyph at once | Index for the list and for `source_ref`, with `EXPLAIN`; kinds start together | Snapshots follow the existing copy rules |
| **SV-18** Add from Library (VB-07) | Moved after saved items, so it ships switched on rather than unreachable | Window uses `modalRecipes`' motion; the inserted tile arrives through SV-06's animator; scroll only if wholly off screen | Own chunk, fetched on hover and at idle; what fits is looked up | One insert path in SV-07's model; credit from SV-16; an `audit:motion` moment for the insert |
| **SV-19** Versions (VB-12) | Checks whether SV-07's stale-write guard should use the new stamp, and changes it only if a test shows a gap | Version switch and changed lines don't animate | None needed | The account-deletion question is asked, not decided |
| **SV-20** Notifications (VB-13) | Tests for no self-notification and one per event | No motion on the bell | None needed | Trigger functions follow SV-01 Part 6; security advisor afterwards |
| **SV-21** Requests A (VB-14 P1 to 3) | Split from VB-14; stop at a false premise | Ghost row and menu item join the List through the animator | Index for the active-claim lookup | Writes through SV-07's writers; offered sessions credited through SV-16 |
| **SV-22** Requests B (VB-14 P4 to 6) | Split; the least-needed part last | No motion | Aggregates in one request with `EXPLAIN`, in OpenBuilds' first round | Briefs publish through SV-07's title check; reviews leave Builds' list and counts |
| **SV-23** Builds data A (VB-15 P1 and 2) | Split; `session_count` already exists, so one writer is found and kept | No motion | Builds keeps one round; indexes for range filters | Counts from SV-05's function, written with the facets through SV-07's queue |
| **SV-24** Builds data B (VB-15 P3 and 4) | Split; the least-needed part last | The dragged filter follows the pointer; others don't animate; drop and resize change at once | Pointer in a ref, one update per frame, reads before writes, passive listeners, versioned layout key | Filter sets use SV-17's kind |
| **SV-25** Build page (VB-16) | Reads its plan from the prompts it depends on | Save changes its glyph at once | At most one extra round; estimated collection counts | Links through `PageLink`; the request from a run is SV-21's |

## Decisions made while merging

Listed in the README: session rows named by first prompt; the stagger total; heavier layers built only when a target fails; VB-14 and VB-15 split; saved copies kept with the account-deletion question asked; the Gallery feed view retired by SV-11.
