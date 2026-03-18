

## Plan: Update Follows Network in Seed Function

The existing Step 3 (lines 145–195) already has a follows graph and counter recalculation, but it doesn't match the user's specified follow pairs and is missing `created_at` timestamp spreading.

### What changes

**Replace lines 145–195** in `supabase/functions/seed-demo-data/index.ts` with the user's exact follow graph and add randomized `created_at` timestamps.

### Specific follow pairs to implement

**Regular users following creators:**
- sam → alex, isabelle, sofia (3)
- power → alex, priya, marcus, sofia, jamie, chen, isabelle (7)
- lurker → chen, isabelle (2)
- newjoin → isabelle (1)
- devtest → alex, priya, marcus, sofia, jamie, chen, isabelle (7)

**Creators following each other:**
- alex → chen, isabelle, sofia (3)
- priya → jamie, marcus, chen (3)
- marcus → chen, alex, sofia (3)
- sofia → isabelle, alex, priya (3)
- jamie → priya, marcus (2)
- chen → alex, marcus, sofia (3)
- isabelle → sofia, alex (2)

### Key differences from current code
1. Follow pairs are different (user's spec vs current implementation — e.g., current has `lurker → alex, sofia` but user wants `lurker → chen, isabelle`)
2. Add `created_at` with random spread over 30 days: `new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()`
3. Counter recalculation logic stays the same (already correct pattern)

### Implementation
Single file edit — replace the followPairs array and insert call in `supabase/functions/seed-demo-data/index.ts` lines 145–195.

