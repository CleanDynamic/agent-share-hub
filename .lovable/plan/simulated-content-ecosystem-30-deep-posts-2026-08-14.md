# Simulated content ecosystem — 30 deep posts

Goal: make the site feel like a live community. One re-runnable seeder creates
8 believable creators and 30 posts that each look like ~25 minutes of real
authoring work, plus the social and money layers around them.

## What gets created

**8 demo creators** — real sign-in accounts with avatars, banners, bios,
usernames, follower graphs, interests, and progress/XP levels (a mix of level
2, 5, and 8 so the gamification surfaces light up). Two of them are curators,
two have service listings, one has payouts enabled.

**30 posts** spread across every post type and surface:

| Group | Count | Notes |
| --- | --- | --- |
| Build | 8 | Full article bodies + Stage Grids + prompt/code/config blocks |
| Technique | 7 | Step-by-step method posts with before/after results |
| Discovery | 6 | Findings with evidence, screenshots-style result cards |
| Discussion | 5 | Debates, open questions, challenges |
| Bounties | 2 | One standard bounty, one meta-bounty with sub-bounties |
| Project | 2 | Collections bundling several Blueprints into a package |

Every post carries: cover image, title, plain-English description, topics,
AI tools, difficulty, custom tags, 4–9 content blocks (text, prompt, code,
agent config, image, result), a TipTap article body of real length (800–2,000
words), a changelog entry, and version history.

**Monetisation coverage** — free downloads, fixed-price paid, donation-enabled,
pay-what-you-want, subscription-only, and one collab post with a 70/20/10
revenue split so the split UI has data.

**Social layer** — follows, saves into emoji folders/collections, ratings and
reviews, threaded comments (with a couple of replies and one soft-deleted
placeholder), primitive/block comments, reblogs including two quote-reblogs
with excerpts, remix lineage (2 remix chains so the lineage tree renders),
curator recommendations, view/download counters, and interaction rows so the
For-You feed and Rising sort have signal.

Timestamps are spread over the last 60 days so Recent / Popular / Rising and
the time filters all behave differently.

## Wipe first

Before inserting, the seeder removes previously seeded demo content and demo
accounts (matched by a seed marker), so the feed shows only this new set. Real
user accounts and their content are untouched.

## Technical notes

- New edge function `supabase/functions/seed-ecosystem/index.ts`, service-role,
  idempotent: delete-by-marker, then insert.
- Creators made via the auth admin API, then `profiles` rows updated; profile
  and post images are generated assets uploaded to storage buckets, with cover
  paths/focal points written to `content_items`.
- Inserts respect existing shapes: `content_items` (article_body, stage_grids,
  results, cover_image_*), `content_blocks`, `content_item_results`,
  `content_ratings`, `content_comments` / `primitive_comments`, `reblogs`,
  `post_lineage`, `collections` / `collection_items`, `projects` /
  `project_components`, `solutions`, `meta_bounty_*`, `revenue_splits`,
  `user_progress` / `xp_events` / `streak_days`, `follows`, `user_saves`,
  `user_interactions`, `curator_recommendations`.
- A small admin trigger (button on the Admin page) runs the seeder, so it can
  be re-run after schema changes.
- No schema changes expected; if a required column is missing it will be added
  in its own migration first.
- Verification: run the seeder, then open Home, Discover, a Blueprint detail,
  a bounty, a project, a profile, and Progress in the preview to confirm every
  surface has content.
