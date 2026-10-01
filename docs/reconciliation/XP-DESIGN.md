# XP design

## Principle
XP is only ever written by the database, as the side effect of an event other people caused or verified. Nobody can award XP to themselves. Self-actions earn nothing, except publishing, which earns a small amount once per build.

## Sources (the complete list)
| Event | Who earns | XP | Cap |
|---|---|---|---|
| Your build is published (first time only) | creator | 10 | 3 per day |
| Someone else runs your build and it works | creator | 25 | once per (build, runner) |
| You run someone else's build and report the result | runner | 5 | once per build; 10 per day |
| Someone publishes a rebuild of your build | original creator | 30 | once per (parent, rebuild) |
| Your solution is accepted | solver | 50 plus 1 per £ of reward, at most 150 | once per solution |
| Your build is confirmed working again after being stale | creator | 15 | once per build per 120 days |

There are no XP sources for likes, comments, saves, follows, logins or streaks.

## Levels
Keep the existing curve: level = floor((xp/75)^(1/1.7)) + 1.

## Reset
Every user's xp_total and level return to 0 and 1 on deploy. xp_events is copied to rc_backup, then emptied. One in-app note, shown once per user: "Progress has been reset to match how buildgallery works now: XP comes from builds others get working."

## Badges (the complete catalogue; tier after the dash)
- first-build "First build" — publish a build — common
- runner "Runner" — run 10 other people's builds and report back — common
- solver "Solver" — one accepted solution — common
- proven "Proven" — a build of yours is run successfully by 3 other people — rare
- rebuilt "Rebuilt" — someone publishes a rebuild of your work — rare
- keeper "Keeper" — re-confirm a stale build of yours — rare
- founder "Founder" — held an account before the reset — rare
- well-proven "Well proven" — a build of yours is run successfully by 10 other people — highest
- family "Family" — a build of yours has 5 published rebuilds — highest
- fixer "Fixer" — five accepted solutions — highest

## Tiers (buildgallery-theme, Progress and achievement)
common = outline; rare = --recess fill; highest = --lit fill with --on-lit. Never a hue per tier. Amber never carries text on Noon.

## Challenges (weekly only, at most 3 active)
Run three builds you haven't run before · Solve a gap · Re-confirm one of your stale builds

## Parked
Guilds, leaderboards, reputation, perks, the skill tree and daily challenges are hidden behind feature flags set to false. Their tables stay.
