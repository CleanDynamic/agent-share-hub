import { supabase } from "@/integrations/supabase/client";
import { countMissingInStageGrids } from "./countMissing";

export interface BountyValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Client-side mirror of the server-side `validate_bounty_publish` trigger.
 *
 * Runs the same checks the database will reject on, so the publish handler
 * can show clear toasts before the network round-trip.
 *
 * Checks:
 *   - reward_type required; if 'cash' or 'token', amount > 0 + currency set
 *   - acceptance_criteria >= 50 chars
 *   - at least one missing stage OR block in stage_grids
 *
 * Shared metadata requirements (slug, tags, use_case, etc.) are enforced
 * by `PublishMetadataForm`'s own validation pass — no need to duplicate.
 */
export async function validateBountyForPublish(
  contentItemId: string,
): Promise<BountyValidationResult> {
  const errors: string[] = [];

  if (!contentItemId) {
    return { isValid: false, errors: ["Missing content item id."] };
  }

  const { data, error } = await supabase
    .from("content_items")
    .select(
      "post_type, bounty_reward_type, bounty_reward_amount, bounty_reward_currency, bounty_acceptance_criteria, stage_grids",
    )
    .eq("id", contentItemId)
    .maybeSingle();

  if (error) {
    return {
      isValid: false,
      errors: [`Couldn't load bounty for validation: ${error.message}`],
    };
  }
  if (!data) {
    return { isValid: false, errors: ["Bounty not found."] };
  }

  const row = data as any;
  if (row.post_type !== "bounty") {
    // Non-bounties shouldn't be running this validator, but if they do treat
    // as valid so we never block other post types accidentally.
    return { isValid: true, errors: [] };
  }

  const rewardType: string | null = row.bounty_reward_type ?? null;
  if (!rewardType || rewardType.trim().length === 0) {
    errors.push("Pick a reward type (Kudos, Cash, or Token).");
  } else if (rewardType === "cash" || rewardType === "token") {
    const amount = Number(row.bounty_reward_amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(`Set a reward amount greater than 0 for ${rewardType} bounties.`);
    }
    const currency: string | null = row.bounty_reward_currency ?? null;
    if (!currency || currency.trim().length === 0) {
      errors.push(`Pick a currency for ${rewardType} bounties.`);
    }
  }

  const criteria: string = (row.bounty_acceptance_criteria ?? "").toString().trim();
  if (criteria.length < 50) {
    errors.push("Acceptance criteria must be at least 50 characters.");
  }

  const counts = countMissingInStageGrids(row.stage_grids);
  if (counts.total === 0) {
    errors.push("Mark at least one stage or block as missing before publishing.");
  }

  return { isValid: errors.length === 0, errors };
}
