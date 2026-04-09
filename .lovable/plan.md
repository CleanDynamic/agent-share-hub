

## Fix Upload Page Type Chooser

The upload page hasn't changed because the type chooser the user sees is rendered by `NeoScaleShell.tsx` (lines 1528-1612), not `Upload.tsx`. NeoScaleShell intercepts the `/upload` route and renders its own version with emojis, descriptions, and "Discussion" label before Upload.tsx ever mounts.

### Changes

**File: `src/components/NeoScaleShell.tsx` (lines 1528-1612)**

1. Remove all emojis from the type tiles and bounty CTA
2. Remove description text from each tile
3. Group Build, Technique, Discovery under a "Blueprints" sub-header
4. Rename "Discussion" to "Blog"
5. Clean up the bounty section — remove emoji and description, keep just "Post a Bounty" label
6. Match the cleaner style already implemented in Upload.tsx (simple label + arrow, no emoji/description)

### Technical details
- The `POST_TYPES` array from `content-types.ts` still has emojis/descriptions; we'll just stop rendering them in NeoScaleShell
- Filter `POST_TYPES` to show Build/Technique/Discovery under "Blueprints", then Blog separately, then Bounty
- Override the "Discussion" label to show "Blog"

